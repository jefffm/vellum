import { randomUUID } from "node:crypto";
import path from "node:path";
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
import { normalizeMusicXml } from "./musicxml-normalizer.js";
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
  normalizer?: (content: Buffer, filename: string) => Promise<RecognizedScore>;
};

export class AudiverisBackend implements OmrBackend {
  readonly id = "audiveris";
  private readonly command: string;
  private readonly runner: Pick<SubprocessRunner, "run">;
  private readonly timeout: number;
  private readonly normalizer: (content: Buffer, filename: string) => Promise<RecognizedScore>;

  constructor(options: AudiverisBackendOptions = {}) {
    this.command = options.command ?? process.env.VELLUM_AUDIVERIS_COMMAND ?? "audiveris";
    this.timeout = options.timeout ?? 5 * 60_000;
    this.runner = options.runner ?? new SubprocessRunner(this.timeout);
    this.normalizer = options.normalizer ?? normalizeMusicXml;
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

    const [interchangeFilename, interchangeContent] = interchange;
    const recognizedScore = await this.normalizer(interchangeContent, interchangeFilename);
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
      pageMappings: [],
      diagnostics:
        result.stderr.trim().length > 0
          ? [
              {
                severity: "info",
                code: "audiveris.stderr",
                message: "Audiveris emitted diagnostic output; inspect the preserved process log.",
              },
            ]
          : [],
      recognizedScore,
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

      const transcription: ScoreTranscription = {
        id: `transcription.${this.createId()}`,
        sourceArtifactId,
        omrRunId: runId,
        version: 1,
        status: result.recognizedScore.uncertainties.some(
          (uncertainty) => uncertainty.critical && !uncertainty.resolved
        )
          ? "needs_review"
          : "reviewed",
        ...result.recognizedScore,
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
