import { randomUUID } from "node:crypto";
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
    this.command = options.command ?? process.env.VELLUM_AUDIVERIS_COMMAND ?? "audiveris";
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

async function extractAudiverisPageImages(nativeOmr: Buffer): Promise<OmrBackendArtifact[]> {
  const zip = await JSZip.loadAsync(nativeOmr);
  const pages = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^sheet#\d+\/BINARY\.png$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  return await Promise.all(
    pages.map(async (entry) => {
      const page = Number(entry.name.match(/^sheet#(\d+)/i)?.[1]);
      return {
        filename: `audiveris-page-${page}.png`,
        category: "native" as const,
        content: await entry.async("nodebuffer"),
      };
    })
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
    backend: OmrBackend
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

      const recognizedScore = classifyCriticalUncertainties(
        result.recognizedScore,
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
