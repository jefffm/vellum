import { Value } from "@sinclair/typebox/value";
import type { TSchema } from "@sinclair/typebox";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  AnalysisRecordSchema,
  ArrangementScoreSchema,
  ArrangementWorkspaceSchema,
  NormalizedScoreSchema,
  OmrRunSchema,
  ScoreTranscriptionSchema,
  SourceArtifactSchema,
} from "../../lib/music-domain.js";
import type {
  AnalysisRecord,
  ArrangementScore,
  ArrangementWorkspace,
  CreateWorkspace,
  NormalizedScore,
  OmrRun,
  ScoreTranscription,
  SourceArtifact,
  UploadSourceArtifact,
} from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";

type WorkspaceStoreOptions = {
  rootDirectory?: string;
  now?: () => Date;
  createId?: () => string;
};

export class WorkspaceStore {
  readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: WorkspaceStoreOptions = {}) {
    this.rootDirectory = options.rootDirectory ?? workspaceRootDirectory();
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  create(input: CreateWorkspace): ArrangementWorkspace {
    mkdirSync(this.rootDirectory, { recursive: true });
    const id = `workspace.${this.createId()}`;
    const timestamp = this.now().toISOString();
    const workspace: ArrangementWorkspace = {
      id,
      title: input.title,
      brief: input.brief ?? { targetConfigurations: [] },
      sourceArtifactIds: [],
      omrRunIds: [],
      scoreTranscriptionIds: [],
      normalizedScoreIds: [],
      analysisRecordIds: [],
      arrangementScoreIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    mkdirSync(this.workspaceDirectory(id), { recursive: false });
    this.writeWorkspace(workspace);
    return workspace;
  }

  list(): ArrangementWorkspace[] {
    if (!existsSync(this.rootDirectory)) {
      return [];
    }

    return readdirSync(this.rootDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("workspace."))
      .map((entry) => this.get(entry.name))
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.title.localeCompare(right.title)
      );
  }

  get(workspaceId: string): ArrangementWorkspace {
    const manifestPath = this.workspaceManifestPath(workspaceId);
    if (!existsSync(manifestPath)) {
      throw new ApiRouteError(`Arrangement workspace not found: ${workspaceId}`, 404);
    }

    return Value.Decode(ArrangementWorkspaceSchema, JSON.parse(readFileSync(manifestPath, "utf8")));
  }

  addSourceArtifact(workspaceId: string, input: UploadSourceArtifact): SourceArtifact {
    const workspace = this.get(workspaceId);
    const content = decodeBase64(input.contentBase64);
    validateSourceContent(input.mimeType, content);

    const sha256 = createHash("sha256").update(content).digest("hex");
    const id = `source.${sha256.slice(0, 24)}`;
    const sourceDirectory = path.join(this.workspaceDirectory(workspaceId), "sources", id);
    const safeFilename = safeSourceFilename(input.filename);
    const storedPath = path.posix.join("sources", id, safeFilename);
    const metadataPath = path.join(sourceDirectory, "source.json");

    if (existsSync(metadataPath)) {
      const existing = Value.Decode(
        SourceArtifactSchema,
        JSON.parse(readFileSync(metadataPath, "utf8"))
      );
      this.linkSourceArtifact(workspace, existing.id);
      return existing;
    }

    mkdirSync(sourceDirectory, { recursive: true });
    writeFileAtomic(path.join(sourceDirectory, safeFilename), content);

    const artifact: SourceArtifact = {
      id,
      kind: sourceKind(input.mimeType),
      filename: safeFilename,
      mimeType: input.mimeType,
      sha256,
      byteLength: content.byteLength,
      storedPath,
      provenance: input.provenance,
      createdAt: this.now().toISOString(),
    };

    writeJsonAtomic(metadataPath, artifact);
    this.linkSourceArtifact(workspace, id);
    return artifact;
  }

  getSourceArtifact(workspaceId: string, sourceArtifactId: string): SourceArtifact {
    const workspace = this.get(workspaceId);
    if (!workspace.sourceArtifactIds.includes(sourceArtifactId)) {
      throw new ApiRouteError(
        `Source artifact ${sourceArtifactId} is not part of workspace ${workspaceId}`,
        404
      );
    }

    const metadataPath = path.join(
      this.workspaceDirectory(workspaceId),
      "sources",
      validateRecordId(sourceArtifactId, "source"),
      "source.json"
    );

    if (!existsSync(metadataPath)) {
      throw new ApiRouteError(`Source artifact not found: ${sourceArtifactId}`, 404);
    }

    return Value.Decode(SourceArtifactSchema, JSON.parse(readFileSync(metadataPath, "utf8")));
  }

  readSourceContent(workspaceId: string, sourceArtifactId: string): Buffer {
    const artifact = this.getSourceArtifact(workspaceId, sourceArtifactId);
    const filePath = path.resolve(this.workspaceDirectory(workspaceId), artifact.storedPath);
    const workspaceDirectory = `${this.workspaceDirectory(workspaceId)}${path.sep}`;

    if (!filePath.startsWith(workspaceDirectory)) {
      throw new ApiRouteError(`Invalid stored source path for ${sourceArtifactId}`, 500);
    }

    return readFileSync(filePath);
  }

  writeOmrArtifact(
    workspaceId: string,
    omrRunId: string,
    filename: string,
    content: Buffer
  ): string {
    const workspace = this.get(workspaceId);
    if (!workspace.omrRunIds.includes(omrRunId)) {
      throw new ApiRouteError(`OMR run is not part of workspace: ${omrRunId}`, 400);
    }
    validateRecordId(omrRunId, "omr");
    const safeFilename = safeSourceFilename(filename);
    const relativePath = path.posix.join("records", "omr-runs", omrRunId, safeFilename);
    writeFileAtomic(path.join(this.workspaceDirectory(workspaceId), relativePath), content);
    return relativePath;
  }

  saveOmrRun(workspaceId: string, run: OmrRun): OmrRun {
    const workspace = this.get(workspaceId);
    if (!workspace.sourceArtifactIds.includes(run.sourceArtifactId)) {
      throw new ApiRouteError(`OMR source is not part of workspace: ${run.sourceArtifactId}`, 400);
    }
    const decoded = Value.Decode(OmrRunSchema, run);
    this.writeRecord(workspaceId, "omr-runs", decoded.id, decoded);
    this.linkRecord(workspace, "omrRunIds", decoded.id);
    return decoded;
  }

  getOmrRun(workspaceId: string, omrRunId: string): OmrRun {
    return this.readRecord(workspaceId, "omr-runs", omrRunId, "omr", OmrRunSchema);
  }

  saveScoreTranscription(
    workspaceId: string,
    transcription: ScoreTranscription
  ): ScoreTranscription {
    const workspace = this.get(workspaceId);
    if (!workspace.sourceArtifactIds.includes(transcription.sourceArtifactId)) {
      throw new ApiRouteError(
        `Transcription source is not part of workspace: ${transcription.sourceArtifactId}`,
        400
      );
    }
    if (!workspace.omrRunIds.includes(transcription.omrRunId)) {
      throw new ApiRouteError(
        `Transcription OMR run is not part of workspace: ${transcription.omrRunId}`,
        400
      );
    }
    const decoded = Value.Decode(ScoreTranscriptionSchema, transcription);
    this.writeImmutableRecord(workspaceId, "transcriptions", decoded.id, decoded);
    this.linkRecord(workspace, "scoreTranscriptionIds", decoded.id);
    return decoded;
  }

  getScoreTranscription(workspaceId: string, transcriptionId: string): ScoreTranscription {
    return this.readRecord(
      workspaceId,
      "transcriptions",
      transcriptionId,
      "transcription",
      ScoreTranscriptionSchema
    );
  }

  saveNormalizedScore(workspaceId: string, score: NormalizedScore): NormalizedScore {
    const workspace = this.get(workspaceId);
    if (!workspace.scoreTranscriptionIds.includes(score.scoreTranscriptionId)) {
      throw new ApiRouteError(
        `Normalized score transcription is not part of workspace: ${score.scoreTranscriptionId}`,
        400
      );
    }
    const decoded = Value.Decode(NormalizedScoreSchema, score);
    this.writeImmutableRecord(workspaceId, "normalized-scores", decoded.id, decoded);
    this.linkRecord(workspace, "normalizedScoreIds", decoded.id);
    return decoded;
  }

  getNormalizedScore(workspaceId: string, normalizedScoreId: string): NormalizedScore {
    return this.readRecord(
      workspaceId,
      "normalized-scores",
      normalizedScoreId,
      "score",
      NormalizedScoreSchema
    );
  }

  saveAnalysisRecord(workspaceId: string, analysis: AnalysisRecord): AnalysisRecord {
    const workspace = this.get(workspaceId);
    if (!workspace.normalizedScoreIds.includes(analysis.normalizedScoreId)) {
      throw new ApiRouteError(
        `Analysis normalized score is not part of workspace: ${analysis.normalizedScoreId}`,
        400
      );
    }
    const decoded = Value.Decode(AnalysisRecordSchema, analysis);
    this.writeImmutableRecord(workspaceId, "analysis-records", decoded.id, decoded);
    this.linkRecord(workspace, "analysisRecordIds", decoded.id);
    return decoded;
  }

  getAnalysisRecord(workspaceId: string, analysisRecordId: string): AnalysisRecord {
    return this.readRecord(
      workspaceId,
      "analysis-records",
      analysisRecordId,
      "analysis",
      AnalysisRecordSchema
    );
  }

  saveArrangementScore(workspaceId: string, arrangement: ArrangementScore): ArrangementScore {
    const workspace = this.get(workspaceId);
    if (!workspace.analysisRecordIds.includes(arrangement.analysisRecordId)) {
      throw new ApiRouteError(
        `Arrangement analysis is not part of workspace: ${arrangement.analysisRecordId}`,
        400
      );
    }
    const decoded = Value.Decode(ArrangementScoreSchema, arrangement);
    this.writeImmutableRecord(workspaceId, "arrangement-scores", decoded.id, decoded);
    this.linkRecord(workspace, "arrangementScoreIds", decoded.id);
    return decoded;
  }

  getArrangementScore(workspaceId: string, arrangementScoreId: string): ArrangementScore {
    return this.readRecord(
      workspaceId,
      "arrangement-scores",
      arrangementScoreId,
      "arrangement",
      ArrangementScoreSchema
    );
  }

  private linkSourceArtifact(workspace: ArrangementWorkspace, sourceArtifactId: string): void {
    if (!workspace.sourceArtifactIds.includes(sourceArtifactId)) {
      workspace.sourceArtifactIds.push(sourceArtifactId);
      workspace.updatedAt = this.now().toISOString();
      this.writeWorkspace(workspace);
    }
  }

  private linkRecord<K extends keyof ArrangementWorkspace>(
    workspace: ArrangementWorkspace,
    collection: K,
    id: string
  ): void {
    const values = workspace[collection];
    if (!Array.isArray(values)) {
      throw new ApiRouteError(
        `Workspace field is not a record collection: ${String(collection)}`,
        500
      );
    }
    const ids = values as string[];
    if (!ids.includes(id)) {
      ids.push(id);
      workspace.updatedAt = this.now().toISOString();
      this.writeWorkspace(workspace);
    }
  }

  private readRecord<T>(
    workspaceId: string,
    category: string,
    id: string,
    prefix: string,
    schema: TSchema
  ): T {
    this.get(workspaceId);
    validateRecordId(id, prefix);
    const recordPath = path.join(
      this.workspaceDirectory(workspaceId),
      "records",
      category,
      `${id}.json`
    );
    if (!existsSync(recordPath)) {
      throw new ApiRouteError(`${prefix} record not found: ${id}`, 404);
    }
    return Value.Decode(schema, JSON.parse(readFileSync(recordPath, "utf8"))) as T;
  }

  private writeRecord(workspaceId: string, category: string, id: string, value: unknown): void {
    const recordPath = path.join(
      this.workspaceDirectory(workspaceId),
      "records",
      category,
      `${id}.json`
    );
    writeJsonAtomic(recordPath, value);
  }

  private writeImmutableRecord(
    workspaceId: string,
    category: string,
    id: string,
    value: unknown
  ): void {
    const recordPath = path.join(
      this.workspaceDirectory(workspaceId),
      "records",
      category,
      `${id}.json`
    );
    if (existsSync(recordPath)) {
      throw new ApiRouteError(`Versioned record already exists: ${id}`, 409);
    }
    writeJsonAtomic(recordPath, value);
  }

  private writeWorkspace(workspace: ArrangementWorkspace): void {
    Value.Decode(ArrangementWorkspaceSchema, workspace);
    writeJsonAtomic(this.workspaceManifestPath(workspace.id), workspace);
  }

  private workspaceManifestPath(workspaceId: string): string {
    return path.join(this.workspaceDirectory(workspaceId), "workspace.json");
  }

  private workspaceDirectory(workspaceId: string): string {
    return path.join(this.rootDirectory, validateRecordId(workspaceId, "workspace"));
  }
}

export function workspaceRootDirectory(): string {
  return process.env.VELLUM_WORKSPACES_DIR ?? path.resolve(process.cwd(), "workspaces");
}

function validateRecordId(id: string, prefix: string): string {
  const pattern = new RegExp(`^${prefix}\\.[a-f0-9-]{16,}$`);
  if (!pattern.test(id)) {
    throw new ApiRouteError(`Invalid ${prefix} id: ${id}`, 400);
  }
  return id;
}

function safeSourceFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^A-Za-z0-9._-]/g, "-");
  if (base.length === 0 || base === "." || base === "..") {
    throw new ApiRouteError("Invalid source filename", 400);
  }
  return base;
}

function decodeBase64(value: string): Buffer {
  const content = Buffer.from(value, "base64");
  if (
    content.length === 0 ||
    content.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")
  ) {
    throw new ApiRouteError("Source content must be valid base64", 400);
  }
  return content;
}

function validateSourceContent(mimeType: string, content: Buffer): void {
  if (mimeType === "application/pdf" && !content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new ApiRouteError("Uploaded PDF does not have a valid PDF signature", 400);
  }

  if (!supportedMimeTypes.has(mimeType)) {
    throw new ApiRouteError(`Unsupported source MIME type: ${mimeType}`, 400);
  }
}

const supportedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.recordare.musicxml+xml",
  "application/xml",
  "text/xml",
  "text/x-lilypond",
  "image/png",
  "image/jpeg",
]);

function sourceKind(mimeType: string): SourceArtifact["kind"] {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "text/x-lilypond") return "lilypond";
  return "musicxml";
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

function writeFileAtomic(filePath: string, content: Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, content, { mode: 0o600 });
  renameSync(temporaryPath, filePath);
}
