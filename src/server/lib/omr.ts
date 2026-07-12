import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import type {
  OmrBackendRecordSchema,
  OmrDiagnosticSchema,
  OmrPageMappingSchema,
} from "../../lib/music-domain.js";
import type {
  NormalizedScore,
  OmrRun,
  RecognizedScore,
  ScoreTranscription,
  SourceArtifact,
} from "../../lib/music-domain.js";
import type { Static } from "@sinclair/typebox";
import { ApiRouteError } from "./create-route.js";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import {
  normalizeAudiverisMusicXml,
  type AudiverisNormalizationResult,
} from "./musicxml-normalizer.js";
import { SubprocessError, SubprocessRunner } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

type OmrBackendRecord = Static<typeof OmrBackendRecordSchema>;
type OmrDiagnostic = Static<typeof OmrDiagnosticSchema>;
type OmrPageMapping = Static<typeof OmrPageMappingSchema>;

export type OmrBackendArtifact = {
  filename: string;
  category: "native" | "interchange" | "log";
  content: Buffer;
};

export type OmrBackendInput = {
  source: SourceArtifact;
  content: Buffer;
};

export type OmrBackendResult = {
  backend: OmrBackendRecord;
  artifacts: OmrBackendArtifact[];
  pageMappings: OmrPageMapping[];
  diagnostics: OmrDiagnostic[];
  recognizedScore: RecognizedScore;
};

export interface OmrBackend {
  readonly id: string;
  recognize(input: OmrBackendInput): Promise<OmrBackendResult>;
}

type AudiverisBackendOptions = {
  command?: string;
  runner?: Pick<SubprocessRunner, "run">;
  timeout?: number;
  normalizer?: (
    content: Buffer,
    filename: string,
    nativeOmr: Buffer
  ) => Promise<AudiverisNormalizationResult>;
};

export class AudiverisBackend implements OmrBackend {
  readonly id = "audiveris";
  private readonly command: string;
  private readonly runner: Pick<SubprocessRunner, "run">;
  private readonly timeout: number;
  private readonly normalizer: (
    content: Buffer,
    filename: string,
    nativeOmr: Buffer
  ) => Promise<AudiverisNormalizationResult>;

  constructor(options: AudiverisBackendOptions = {}) {
    this.command = options.command ?? audiverisCommand();
    this.timeout = options.timeout ?? 5 * 60_000;
    this.runner = options.runner ?? new SubprocessRunner(this.timeout);
    this.normalizer = options.normalizer ?? normalizeAudiverisMusicXml;
  }

  async recognize(input: OmrBackendInput): Promise<OmrBackendResult> {
    if (input.source.kind !== "pdf" && input.source.kind !== "image") {
      throw new ApiRouteError(`Audiveris cannot recognize source kind: ${input.source.kind}`, 400);
    }

    const version = await this.resolveVersion();
    const inputName = `source${path.extname(input.source.filename).toLowerCase() || ".pdf"}`;
    const args = ["-batch", "-transcribe", "-save", "-export", "-output", ".", "--", inputName];
    let result;
    try {
      result = await this.runner.run({
        command: this.command,
        args,
        inputFile: { name: inputName, content: input.content },
        outputGlobs: ["*.omr", "*.mxl", "*.musicxml", "*.xml", "*.log"],
        timeout: this.timeout,
      });
    } catch (error) {
      if (error instanceof SubprocessError) {
        throw new ApiRouteError(
          `Audiveris is unavailable. Install it or set VELLUM_AUDIVERIS_COMMAND: ${error.message}`,
          503
        );
      }
      throw error;
    }

    if (result.exitCode !== 0) {
      throw new ApiRouteError(
        `Audiveris recognition failed with exit code ${result.exitCode}: ${result.stderr.trim()}`,
        422
      );
    }

    const interchange = [...result.files.entries()].find(([filename]) =>
      /\.(?:mxl|musicxml|xml)$/i.test(filename)
    );
    if (!interchange) {
      throw new ApiRouteError("Audiveris completed without a MusicXML export", 422);
    }

    const native = [...result.files.entries()].find(([filename]) => /\.omr$/i.test(filename));
    if (!native) {
      throw new ApiRouteError(
        "Audiveris completed without its native .omr evidence project; recognition cannot be reviewed safely",
        422
      );
    }
    const [interchangeFilename, interchangeContent] = interchange;
    const normalization = await this.normalizer(interchangeContent, interchangeFilename, native[1]);
    const artifacts: OmrBackendArtifact[] = [...result.files.entries()].map(
      ([filename, content]) => ({
        filename,
        category: /\.omr$/i.test(filename)
          ? "native"
          : /\.(?:mxl|musicxml|xml)$/i.test(filename)
            ? "interchange"
            : "log",
        content,
      })
    );
    artifacts.push(...(await extractAudiverisPageImages(native[1])));
    artifacts.push({
      filename: "audiveris-process.log",
      category: "log",
      content: Buffer.from(`stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n`, "utf8"),
    });

    return {
      backend: {
        id: this.id,
        version,
        configuration: { args },
      },
      artifacts,
      pageMappings: normalization.pageMappings,
      diagnostics: [
        ...normalization.diagnostics,
        ...(result.stderr.trim().length > 0
          ? [
              {
                severity: "info" as const,
                code: "audiveris.stderr",
                message: "Audiveris emitted diagnostic output; inspect the preserved process log.",
              },
            ]
          : []),
      ],
      recognizedScore: normalization.recognizedScore,
    };
  }

  private async resolveVersion(): Promise<string> {
    try {
      const result = await this.runner.run({
        command: this.command,
        args: ["-version"],
        timeout: 30_000,
      });
      if (result.exitCode !== 0) return "unknown";
      return (
        result.stdout.match(/Version:\s*([^\s]+)/i)?.[1] ?? (result.stdout.trim() || "unknown")
      );
    } catch (error) {
      if (error instanceof SubprocessError) {
        throw new ApiRouteError(
          `Audiveris is unavailable. Install it or set VELLUM_AUDIVERIS_COMMAND: ${error.message}`,
          503
        );
      }
      throw error;
    }
  }
}

export function audiverisCommand(): string {
  if (process.env.VELLUM_AUDIVERIS_COMMAND) return process.env.VELLUM_AUDIVERIS_COMMAND;
  const macApp = "/Applications/Audiveris.app/Contents/MacOS/Audiveris";
  return process.platform === "darwin" && existsSync(macApp) ? macApp : "audiveris";
}

type OmrArchiveLimits = {
  maxArchiveBytes: number;
  maxEntries: number;
  maxPages: number;
  maxEntryBytes: number;
  maxExpandedBytes: number;
};

const DEFAULT_OMR_ARCHIVE_LIMITS: OmrArchiveLimits = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxEntries: 2_048,
  maxPages: 512,
  maxEntryBytes: 16 * 1024 * 1024,
  maxExpandedBytes: 128 * 1024 * 1024,
};

export async function extractAudiverisPageImages(
  nativeOmr: Buffer,
  limits: OmrArchiveLimits = DEFAULT_OMR_ARCHIVE_LIMITS
): Promise<OmrBackendArtifact[]> {
  if (nativeOmr.byteLength > limits.maxArchiveBytes) {
    throw omrArchiveLimit("compressed archive bytes", nativeOmr.byteLength, limits.maxArchiveBytes);
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(nativeOmr);
  } catch {
    throw new ApiRouteError("OMR archive is malformed and cannot be inspected safely", 422);
  }
  const entries = Object.values(zip.files);
  if (entries.length > limits.maxEntries) {
    throw omrArchiveLimit("entry count", entries.length, limits.maxEntries);
  }
  let expandedBytes = 0;
  for (const entry of entries) {
    const originalName = entry.unsafeOriginalName ?? entry.name;
    if (
      path.posix.isAbsolute(originalName) ||
      originalName.split("/").some((segment) => segment === "..")
    ) {
      throw new ApiRouteError("OMR archive contains an unsafe member path", 422);
    }
    const entryBytes = omrEntryUncompressedBytes(entry);
    if (entryBytes > limits.maxEntryBytes) {
      throw omrArchiveLimit(`entry ${entry.name} bytes`, entryBytes, limits.maxEntryBytes);
    }
    expandedBytes += entryBytes;
    if (expandedBytes > limits.maxExpandedBytes) {
      throw omrArchiveLimit("expanded archive bytes", expandedBytes, limits.maxExpandedBytes);
    }
  }
  const pages = entries
    .filter((entry) => !entry.dir && /^sheet#\d+\/BINARY\.png$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  if (pages.length > limits.maxPages) {
    throw omrArchiveLimit("page image count", pages.length, limits.maxPages);
  }
  const artifacts: OmrBackendArtifact[] = [];
  for (const entry of pages) {
    const page = Number(entry.name.match(/^sheet#(\d+)/i)?.[1]);
    artifacts.push({
      filename: `audiveris-page-${page}.png`,
      category: "native",
      content: await entry.async("nodebuffer"),
    });
  }
  return artifacts;
}

function omrEntryUncompressedBytes(entry: JSZip.JSZipObject): number {
  if (entry.dir) return 0;
  const value = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
    ?.uncompressedSize;
  if (!Number.isSafeInteger(value) || value! < 0) {
    throw new ApiRouteError(`OMR archive member size is unavailable: ${entry.name}`, 422);
  }
  return value!;
}

function omrArchiveLimit(label: string, actual: number, limit: number): ApiRouteError {
  return new ApiRouteError(
    `OMR archive resource limit exceeded: ${label} ${actual}, limit ${limit}`,
    413
  );
}

type OmrServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
};

export type OmrServiceResult = {
  omrRun: OmrRun;
  scoreTranscription: ScoreTranscription;
  normalizedScore: NormalizedScore;
};

export type OmrRecognitionOptions = {
  autoAcceptConfidence?: number;
};

export class OmrService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: OmrServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async recognize(
    workspaceId: string,
    sourceArtifactId: string,
    backend: OmrBackend,
    options: OmrRecognitionOptions = {}
  ): Promise<OmrServiceResult> {
    const source = this.store.getSourceArtifact(workspaceId, sourceArtifactId);
    const runId = `omr.${this.createId()}`;
    const createdAt = this.now().toISOString();
    const running: OmrRun = {
      id: runId,
      sourceArtifactId,
      backend: { id: backend.id, version: "pending", configuration: {} },
      status: "running",
      nativeArtifactPaths: [],
      interchangeArtifactPaths: [],
      pageMappings: [],
      diagnostics: [],
      createdAt,
    };
    this.store.saveOmrRun(workspaceId, running);

    try {
      const result = await backend.recognize({
        source,
        content: this.store.readSourceContent(workspaceId, sourceArtifactId),
      });
      const storedArtifacts = result.artifacts.map((artifact) => ({
        ...artifact,
        path: this.store.writeOmrArtifact(workspaceId, runId, artifact.filename, artifact.content),
      }));
      const completedAt = this.now().toISOString();
      const completed: OmrRun = {
        ...running,
        backend: result.backend,
        status: "completed",
        nativeArtifactPaths: storedArtifacts
          .filter((artifact) => artifact.category === "native")
          .map((artifact) => artifact.path),
        interchangeArtifactPaths: storedArtifacts
          .filter((artifact) => artifact.category === "interchange")
          .map((artifact) => artifact.path),
        logPath: storedArtifacts.find((artifact) => artifact.category === "log")?.path,
        pageMappings: result.pageMappings,
        diagnostics: result.diagnostics,
        completedAt,
      };
      this.store.saveOmrRun(workspaceId, completed);

      const { recognizedScore: thresholdedScore, acceptanceBatch } = applyConfidenceAcceptance(
        result.recognizedScore,
        options.autoAcceptConfidence,
        completedAt,
        completed
      );
      const recognizedScore = classifyCriticalUncertainties(
        thresholdedScore,
        runId.slice("omr.".length),
        completedAt
      );
      const transcription: ScoreTranscription = {
        id: `transcription.${this.createId()}`,
        sourceArtifactId,
        omrRunId: runId,
        version: 1,
        status: recognizedScore.uncertainties.some(
          (uncertainty) => uncertainty.critical && !uncertainty.resolved
        )
          ? "needs_review"
          : "reviewed",
        ...recognizedScore,
        ...(acceptanceBatch ? { acceptanceBatches: [acceptanceBatch] } : {}),
        createdAt: completedAt,
      };
      this.store.saveScoreTranscription(workspaceId, transcription);

      const normalizedScore: NormalizedScore = {
        id: `score.${this.createId()}`,
        scoreTranscriptionId: transcription.id,
        version: 1,
        title: transcription.title,
        key: transcription.key,
        timeSignature: transcription.timeSignature,
        parts: transcription.parts,
        measures: transcription.measures,
        events: transcription.events,
        createdAt: completedAt,
      };
      this.store.saveNormalizedScore(workspaceId, normalizedScore);

      return { omrRun: completed, scoreTranscription: transcription, normalizedScore };
    } catch (error) {
      this.store.saveOmrRun(workspaceId, {
        ...running,
        status: "failed",
        diagnostics: [
          {
            severity: "error",
            code: "omr.failed",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        completedAt: this.now().toISOString(),
      });
      throw error;
    }
  }
}

function applyConfidenceAcceptance(
  recognizedScore: RecognizedScore,
  threshold: number | undefined,
  createdAt: string,
  run: OmrRun
): {
  recognizedScore: RecognizedScore;
  acceptanceBatch?: NonNullable<ScoreTranscription["acceptanceBatches"]>[number];
} {
  if (threshold === undefined) return { recognizedScore };
  const accepted = new Set<string>();
  for (const uncertainty of recognizedScore.uncertainties) {
    if (
      uncertainty.resolved ||
      uncertainty.critical ||
      uncertainty.category !== "pitch_recognition"
    )
      continue;
    const events = uncertainty.eventIds.map((id) =>
      recognizedScore.events.find((event) => event.id === id)
    );
    if (
      events.length > 0 &&
      events.every(
        (event) =>
          event?.type === "note" && event.confidence !== undefined && event.confidence >= threshold
      )
    ) {
      accepted.add(uncertainty.id);
    }
  }
  return {
    recognizedScore: {
      ...recognizedScore,
      uncertainties: recognizedScore.uncertainties.map((uncertainty) =>
        accepted.has(uncertainty.id) ? { ...uncertainty, resolved: true } : uncertainty
      ),
    },
    acceptanceBatch: {
      id: `acceptance.${run.id.slice("omr.".length)}`,
      policy: "ocr_confidence_threshold",
      threshold,
      scope: "noncritical_pitch_recognition",
      omrRunId: run.id,
      backendId: run.backend.id,
      backendVersion: run.backend.version,
      accepted: recognizedScore.uncertainties
        .filter((uncertainty) => accepted.has(uncertainty.id))
        .map((uncertainty) => ({
          uncertaintyId: uncertainty.id,
          eventIds: uncertainty.eventIds,
          minimumConfidence: Math.min(
            ...uncertainty.eventIds.map((id) => {
              const event = recognizedScore.events.find((candidate) => candidate.id === id);
              return event?.type === "note" && event.confidence !== undefined
                ? event.confidence
                : 0;
            })
          ),
        })),
      notAccepted: recognizedScore.uncertainties
        .filter((uncertainty) => !accepted.has(uncertainty.id) && !uncertainty.resolved)
        .map((uncertainty) => ({
          uncertaintyId: uncertainty.id,
          eventIds: uncertainty.eventIds,
          reason: confidenceRejectionReason(recognizedScore, uncertainty, threshold),
        })),
      createdAt,
    },
  };
}

function confidenceRejectionReason(
  score: RecognizedScore,
  uncertainty: RecognizedScore["uncertainties"][number],
  threshold: number
): "critical" | "below_threshold" | "missing_confidence" | "not_pitch_recognition" {
  if (uncertainty.critical) return "critical";
  if (uncertainty.category !== "pitch_recognition") return "not_pitch_recognition";
  const events = uncertainty.eventIds.map((id) => score.events.find((event) => event.id === id));
  if (events.some((event) => event?.type !== "note" || event.confidence === undefined))
    return "missing_confidence";
  return events.some(
    (event) =>
      event?.type === "note" && event.confidence !== undefined && event.confidence < threshold
  )
    ? "below_threshold"
    : "missing_confidence";
}

export function classifyCriticalUncertainties(
  recognizedScore: RecognizedScore,
  previewId: string,
  createdAt: string
): RecognizedScore {
  if (recognizedScore.uncertainties.length === 0) return recognizedScore;
  try {
    const preview: NormalizedScore = {
      id: `score.${previewId}`,
      scoreTranscriptionId: `transcription.${previewId}`,
      version: 1,
      title: recognizedScore.title,
      key: recognizedScore.key,
      timeSignature: recognizedScore.timeSignature,
      parts: recognizedScore.parts,
      measures: recognizedScore.measures,
      events: recognizedScore.events,
      createdAt,
    };
    const analysis = analyzeMusicologicalScore(preview, {
      id: `analysis.${previewId}`,
      createdAt,
    });
    const protectedIds = new Set(analysis.preservationTargets.flatMap((target) => target.eventIds));
    return {
      ...recognizedScore,
      uncertainties: recognizedScore.uncertainties.map((uncertainty) => {
        const critical =
          uncertainty.critical || uncertainty.eventIds.some((eventId) => protectedIds.has(eventId));
        return {
          ...uncertainty,
          critical,
          message: critical
            ? `${uncertainty.message} It may alter a Preservation Target and requires Score-Anchored Review.`
            : `${uncertainty.message} It is disclosed as non-critical recognition evidence.`,
        };
      }),
    };
  } catch {
    return {
      ...recognizedScore,
      uncertainties: recognizedScore.uncertainties.map((uncertainty) => ({
        ...uncertainty,
        critical: true,
        message: `${uncertainty.message} Musical consequence could not be resolved automatically, so review is required.`,
      })),
    };
  }
}
