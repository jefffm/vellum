import { Value } from "@sinclair/typebox/value";
import type { TSchema } from "@sinclair/typebox";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  closeSync,
  copyFileSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  AnalysisRecordSchema,
  ArrangementFamilySchema,
  ArrangementBranchSchema,
  ArrangementCandidateSchema,
  ArrangementSearchSchema,
  ArrangementScoreSchema,
  ArrangementWorkspaceSchema,
  DeliverableSchema,
  EditorialCommitmentSchema,
  FamilyCommitmentSchema,
  StaleDerivationSchema,
  CommitmentConflictSchema,
  PolicyExceptionSchema,
  PerformanceInterpretationSchema,
  ModelActionSchema,
  GuidedWorkflowSchema,
  SourceTruthAssessmentSchema,
  PerformanceBriefSchema,
  ArrangementPlanSchema,
  NormalizedScoreSchema,
  OmrRunSchema,
  ScoreTranscriptionSchema,
  SourceArtifactSchema,
} from "../../lib/music-domain.js";
import type {
  AnalysisRecord,
  ArrangementFamily,
  ArrangementBranch,
  ArrangementCandidate,
  ArrangementSearch,
  ArrangementScore,
  ArrangementWorkspace,
  CreateWorkspace,
  Deliverable,
  EditorialCommitment,
  FamilyCommitment,
  StaleDerivation,
  CommitmentConflict,
  PolicyException,
  PerformanceInterpretation,
  ModelAction,
  GuidedWorkflow,
  SourceTruthAssessment,
  PerformanceBrief,
  ArrangementPlan,
  ModelActionInputVersion,
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
  recoverOnStart?: boolean;
};

export type WorkspaceRecoveryReport = {
  workspaceId: string;
  linkedRecordIds: string[];
  quarantinedPaths: string[];
  staleLockRemoved: boolean;
};

const recoverableRecordCollections = [
  ["omr-runs", "omrRunIds", OmrRunSchema],
  ["transcriptions", "scoreTranscriptionIds", ScoreTranscriptionSchema],
  ["normalized-scores", "normalizedScoreIds", NormalizedScoreSchema],
  ["analysis-records", "analysisRecordIds", AnalysisRecordSchema],
  ["arrangement-scores", "arrangementScoreIds", ArrangementScoreSchema],
  ["model-actions", "modelActionIds", ModelActionSchema],
  ["guided-workflows", "guidedWorkflowIds", GuidedWorkflowSchema],
  ["source-truth-assessments", "sourceTruthAssessmentIds", SourceTruthAssessmentSchema],
  ["performance-briefs", "performanceBriefIds", PerformanceBriefSchema],
  ["arrangement-plans", "arrangementPlanIds", ArrangementPlanSchema],
  ["arrangement-branches", "arrangementBranchIds", ArrangementBranchSchema],
  ["arrangement-searches", "arrangementSearchIds", ArrangementSearchSchema],
  ["arrangement-candidates", "arrangementCandidateIds", ArrangementCandidateSchema],
  ["arrangement-families", "arrangementFamilyIds", ArrangementFamilySchema],
  ["deliverables", "deliverableIds", DeliverableSchema],
  ["stale-derivations", "staleDerivationIds", StaleDerivationSchema],
  ["editorial-commitments", "editorialCommitmentIds", EditorialCommitmentSchema],
  ["family-commitments", "familyCommitmentIds", FamilyCommitmentSchema],
  ["commitment-conflicts", "commitmentConflictIds", CommitmentConflictSchema],
  ["policy-exceptions", "policyExceptionIds", PolicyExceptionSchema],
  ["performance-interpretations", "performanceInterpretationIds", PerformanceInterpretationSchema],
] as const;

export class WorkspaceStore {
  readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: WorkspaceStoreOptions = {}) {
    this.rootDirectory = options.rootDirectory ?? workspaceRootDirectory();
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    if (options.recoverOnStart === true) this.recoverAllWorkspaces();
  }

  create(input: CreateWorkspace): ArrangementWorkspace {
    mkdirSync(this.rootDirectory, { recursive: true });
    const id = `workspace.${this.createId()}`;
    const timestamp = this.now().toISOString();
    const workspace: ArrangementWorkspace = {
      schemaVersion: 6,
      revision: 1,
      id,
      title: input.title,
      brief: input.brief ?? { targetConfigurations: [] },
      sourceArtifactIds: [],
      omrRunIds: [],
      scoreTranscriptionIds: [],
      normalizedScoreIds: [],
      analysisRecordIds: [],
      arrangementScoreIds: [],
      modelActionIds: [],
      guidedWorkflowIds: [],
      sourceTruthAssessmentIds: [],
      performanceBriefIds: [],
      arrangementPlanIds: [],
      arrangementBranchIds: [],
      arrangementSearchIds: [],
      arrangementCandidateIds: [],
      arrangementFamilyIds: [],
      deliverableIds: [],
      staleDerivationIds: [],
      editorialCommitmentIds: [],
      familyCommitmentIds: [],
      commitmentConflictIds: [],
      policyExceptionIds: [],
      performanceInterpretationIds: [],
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

  recoverWorkspace(workspaceId: string): WorkspaceRecoveryReport {
    const staleLockRemoved = this.removeStaleWorkspaceLock(workspaceId);
    let workspace = this.get(workspaceId);
    const linkedRecordIds: string[] = [];
    const quarantinedPaths: string[] = [];
    for (const [category, collection, schema] of recoverableRecordCollections) {
      const directory = path.join(this.workspaceDirectory(workspaceId), "records", category);
      if (!existsSync(directory)) continue;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const recordPath = path.join(directory, entry.name);
        let record: { id: string };
        try {
          record = Value.Decode(schema, JSON.parse(readFileSync(recordPath, "utf8"))) as {
            id: string;
          };
          if (category === "deliverables") {
            this.assertRecoverableDeliverable(workspaceId, record as Deliverable);
          }
        } catch {
          quarantinedPaths.push(this.quarantineRecoveryPath(workspaceId, recordPath));
          continue;
        }
        const ids = workspace[collection] as string[];
        if (!ids.includes(record.id)) {
          workspace = this.linkWorkspaceRecord(workspaceId, collection, record.id);
          linkedRecordIds.push(record.id);
        }
      }
    }
    const report = { workspaceId, linkedRecordIds, quarantinedPaths, staleLockRemoved };
    writeJsonAtomic(
      path.join(this.workspaceDirectory(workspaceId), ".recovery", "last-report.json"),
      report
    );
    return report;
  }

  private recoverAllWorkspaces(): void {
    if (!existsSync(this.rootDirectory)) return;
    for (const entry of readdirSync(this.rootDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("workspace.")) continue;
      try {
        this.recoverWorkspace(entry.name);
      } catch {
        // A damaged workspace remains isolated; opening it will return its precise validation error.
      }
    }
  }

  updateBrief(workspaceId: string, brief: ArrangementWorkspace["brief"]): ArrangementWorkspace {
    return this.mutateWorkspace(workspaceId, undefined, (workspace) => ({
      ...workspace,
      brief,
      updatedAt: this.now().toISOString(),
    }));
  }

  rename(workspaceId: string, title: string, expectedRevision?: number): ArrangementWorkspace {
    const trimmed = title.trim();
    if (!trimmed) throw new ApiRouteError("Workspace title cannot be empty", 400);
    return this.mutateWorkspace(workspaceId, expectedRevision, (workspace) => ({
      ...workspace,
      title: trimmed,
      updatedAt: this.now().toISOString(),
    }));
  }

  remove(workspaceId: string, confirmation: string): void {
    const workspace = this.get(workspaceId);
    if (confirmation !== workspace.id) {
      throw new ApiRouteError("Workspace removal requires its exact workspace id", 400);
    }
    rmSync(this.workspaceDirectory(workspaceId), { recursive: true, force: false });
  }

  get(workspaceId: string): ArrangementWorkspace {
    const manifestPath = this.workspaceManifestPath(workspaceId);
    if (!existsSync(manifestPath)) {
      throw new ApiRouteError(`Arrangement workspace not found: ${workspaceId}`, 404);
    }

    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      throw new ApiRouteError(`Invalid Arrangement Workspace manifest: ${workspaceId}`, 500);
    }
    if (typeof parsed.schemaVersion === "number" && parsed.schemaVersion > 6) {
      throw new ApiRouteError(
        `Arrangement Workspace ${workspaceId} uses unsupported schema version ${parsed.schemaVersion}`,
        409
      );
    }
    const migrated = {
      ...parsed,
      schemaVersion: 6,
      revision:
        typeof parsed.revision === "number" && Number.isInteger(parsed.revision)
          ? parsed.revision
          : 1,
      modelActionIds: Array.isArray(parsed.modelActionIds) ? parsed.modelActionIds : [],
      guidedWorkflowIds: Array.isArray(parsed.guidedWorkflowIds) ? parsed.guidedWorkflowIds : [],
      sourceTruthAssessmentIds: Array.isArray(parsed.sourceTruthAssessmentIds)
        ? parsed.sourceTruthAssessmentIds
        : [],
      performanceBriefIds: Array.isArray(parsed.performanceBriefIds)
        ? parsed.performanceBriefIds
        : [],
      arrangementPlanIds: Array.isArray(parsed.arrangementPlanIds) ? parsed.arrangementPlanIds : [],
      arrangementBranchIds: Array.isArray(parsed.arrangementBranchIds)
        ? parsed.arrangementBranchIds
        : [],
      arrangementSearchIds: Array.isArray(parsed.arrangementSearchIds)
        ? parsed.arrangementSearchIds
        : [],
      arrangementCandidateIds: Array.isArray(parsed.arrangementCandidateIds)
        ? parsed.arrangementCandidateIds
        : [],
      arrangementFamilyIds: Array.isArray(parsed.arrangementFamilyIds)
        ? parsed.arrangementFamilyIds
        : [],
      deliverableIds: Array.isArray(parsed.deliverableIds) ? parsed.deliverableIds : [],
      staleDerivationIds: Array.isArray(parsed.staleDerivationIds) ? parsed.staleDerivationIds : [],
      editorialCommitmentIds: Array.isArray(parsed.editorialCommitmentIds)
        ? parsed.editorialCommitmentIds
        : [],
      familyCommitmentIds: Array.isArray(parsed.familyCommitmentIds)
        ? parsed.familyCommitmentIds
        : [],
      commitmentConflictIds: Array.isArray(parsed.commitmentConflictIds)
        ? parsed.commitmentConflictIds
        : [],
      policyExceptionIds: Array.isArray(parsed.policyExceptionIds) ? parsed.policyExceptionIds : [],
      performanceInterpretationIds: Array.isArray(parsed.performanceInterpretationIds)
        ? parsed.performanceInterpretationIds
        : [],
    };
    const workspace = Value.Decode(ArrangementWorkspaceSchema, migrated);
    if (
      parsed.schemaVersion !== 6 ||
      typeof parsed.revision !== "number" ||
      !Array.isArray(parsed.modelActionIds) ||
      !Array.isArray(parsed.guidedWorkflowIds) ||
      !Array.isArray(parsed.sourceTruthAssessmentIds) ||
      !Array.isArray(parsed.performanceBriefIds) ||
      !Array.isArray(parsed.arrangementPlanIds) ||
      !Array.isArray(parsed.arrangementBranchIds) ||
      !Array.isArray(parsed.arrangementSearchIds) ||
      !Array.isArray(parsed.arrangementCandidateIds) ||
      !Array.isArray(parsed.arrangementFamilyIds) ||
      !Array.isArray(parsed.deliverableIds) ||
      !Array.isArray(parsed.staleDerivationIds) ||
      !Array.isArray(parsed.editorialCommitmentIds) ||
      !Array.isArray(parsed.familyCommitmentIds) ||
      !Array.isArray(parsed.commitmentConflictIds) ||
      !Array.isArray(parsed.policyExceptionIds) ||
      !Array.isArray(parsed.performanceInterpretationIds)
    ) {
      writeJsonAtomic(manifestPath, workspace);
    }
    return workspace;
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

  addSourceArtifactFromSpool(
    workspaceId: string,
    input: Omit<UploadSourceArtifact, "contentBase64"> & {
      spoolPath: string;
      sha256: string;
      byteLength: number;
    }
  ): SourceArtifact {
    const workspace = this.get(workspaceId);
    validateSourceFile(input.mimeType, input.spoolPath, input.byteLength);
    if (!/^[a-f0-9]{64}$/.test(input.sha256)) {
      throw new ApiRouteError("Source spool hash is invalid", 400);
    }
    const id = `source.${input.sha256.slice(0, 24)}`;
    const sourceDirectory = path.join(this.workspaceDirectory(workspaceId), "sources", id);
    const safeFilename = safeSourceFilename(input.filename);
    const storedPath = path.posix.join("sources", id, safeFilename);
    const metadataPath = path.join(sourceDirectory, "source.json");
    if (existsSync(metadataPath)) {
      const existing = Value.Decode(
        SourceArtifactSchema,
        JSON.parse(readFileSync(metadataPath, "utf8"))
      );
      if (existing.sha256 !== input.sha256 || existing.byteLength !== input.byteLength) {
        throw new ApiRouteError("Source identity collides with different bytes", 409);
      }
      this.linkSourceArtifact(workspace, existing.id);
      return existing;
    }
    mkdirSync(sourceDirectory, { recursive: true });
    const artifactPath = path.join(sourceDirectory, safeFilename);
    const pendingPath = `${artifactPath}.${process.pid}.${randomUUID()}.tmp`;
    copyFileSync(input.spoolPath, pendingPath);
    renameSync(pendingPath, artifactPath);
    const artifact: SourceArtifact = {
      id,
      kind: sourceKind(input.mimeType),
      filename: safeFilename,
      mimeType: input.mimeType,
      sha256: input.sha256,
      byteLength: input.byteLength,
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

  readOmrArtifact(workspaceId: string, omrRunId: string, filename: string): Buffer {
    const run = this.getOmrRun(workspaceId, omrRunId);
    const safeFilename = safeSourceFilename(filename);
    const candidates = [
      ...run.nativeArtifactPaths,
      ...run.interchangeArtifactPaths,
      ...(run.logPath ? [run.logPath] : []),
    ];
    const storedPath = candidates.find(
      (candidate) => path.posix.basename(candidate) === safeFilename
    );
    if (!storedPath) {
      throw new ApiRouteError(`OMR artifact not found: ${safeFilename}`, 404);
    }
    const filePath = path.resolve(this.workspaceDirectory(workspaceId), storedPath);
    const workspaceDirectory = `${this.workspaceDirectory(workspaceId)}${path.sep}`;
    if (!filePath.startsWith(workspaceDirectory)) {
      throw new ApiRouteError(`Invalid OMR artifact path for ${omrRunId}`, 500);
    }
    return readFileSync(filePath);
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
    if (transcription.omrRunId && !workspace.omrRunIds.includes(transcription.omrRunId)) {
      throw new ApiRouteError(
        `Transcription OMR run is not part of workspace: ${transcription.omrRunId}`,
        400
      );
    }
    const decoded = Value.Decode(ScoreTranscriptionSchema, transcription);
    validateRhythmicReferences(decoded);
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
    validateRhythmicReferences(decoded);
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

  saveArrangementFamily(workspaceId: string, family: ArrangementFamily): ArrangementFamily {
    const workspace = this.get(workspaceId);
    if (
      !workspace.normalizedScoreIds.includes(family.normalizedScoreId) ||
      !workspace.analysisRecordIds.includes(family.analysisRecordId)
    ) {
      throw new ApiRouteError("Arrangement Family source or analysis is not in the workspace", 400);
    }
    const decoded = Value.Decode(ArrangementFamilySchema, family);
    this.writeRecord(workspaceId, "arrangement-families", decoded.id, decoded);
    this.linkRecord(workspace, "arrangementFamilyIds", decoded.id);
    return decoded;
  }

  getArrangementFamily(workspaceId: string, familyId: string): ArrangementFamily {
    return this.readRecord(
      workspaceId,
      "arrangement-families",
      familyId,
      "family",
      ArrangementFamilySchema
    );
  }

  saveStaleDerivation(workspaceId: string, record: StaleDerivation): StaleDerivation {
    return this.saveLineageRecord(
      workspaceId,
      "stale-derivations",
      "staleDerivationIds",
      StaleDerivationSchema,
      record
    );
  }
  getStaleDerivation(workspaceId: string, id: string): StaleDerivation {
    return this.readRecord(workspaceId, "stale-derivations", id, "stale", StaleDerivationSchema);
  }
  saveEditorialCommitment(workspaceId: string, record: EditorialCommitment): EditorialCommitment {
    return this.saveLineageRecord(
      workspaceId,
      "editorial-commitments",
      "editorialCommitmentIds",
      EditorialCommitmentSchema,
      record
    );
  }
  getEditorialCommitment(workspaceId: string, id: string): EditorialCommitment {
    return this.readRecord(
      workspaceId,
      "editorial-commitments",
      id,
      "commitment",
      EditorialCommitmentSchema
    );
  }
  saveFamilyCommitment(workspaceId: string, record: FamilyCommitment): FamilyCommitment {
    return this.saveLineageRecord(
      workspaceId,
      "family-commitments",
      "familyCommitmentIds",
      FamilyCommitmentSchema,
      record
    );
  }
  getFamilyCommitment(workspaceId: string, id: string): FamilyCommitment {
    return this.readRecord(
      workspaceId,
      "family-commitments",
      id,
      "family-commitment",
      FamilyCommitmentSchema
    );
  }
  saveCommitmentConflict(workspaceId: string, record: CommitmentConflict): CommitmentConflict {
    return this.saveLineageRecord(
      workspaceId,
      "commitment-conflicts",
      "commitmentConflictIds",
      CommitmentConflictSchema,
      record
    );
  }
  getCommitmentConflict(workspaceId: string, id: string): CommitmentConflict {
    return this.readRecord(
      workspaceId,
      "commitment-conflicts",
      id,
      "conflict",
      CommitmentConflictSchema
    );
  }
  savePolicyException(workspaceId: string, record: PolicyException): PolicyException {
    return this.saveLineageRecord(
      workspaceId,
      "policy-exceptions",
      "policyExceptionIds",
      PolicyExceptionSchema,
      record
    );
  }
  getPolicyException(workspaceId: string, id: string): PolicyException {
    return this.readRecord(
      workspaceId,
      "policy-exceptions",
      id,
      "exception",
      PolicyExceptionSchema
    );
  }

  saveDeliverable(workspaceId: string, deliverable: Deliverable, content: Buffer): Deliverable {
    const workspace = this.get(workspaceId);
    const arrangement = this.getArrangementScore(workspaceId, deliverable.arrangementScoreId);
    if (arrangement.version !== deliverable.arrangementScoreVersion) {
      throw new ApiRouteError("Deliverable Arrangement Score version is inconsistent", 400);
    }
    const decoded = Value.Decode(DeliverableSchema, deliverable);
    const requiredPrefix = path.posix.join("records", "deliverable-artifacts", decoded.id);
    if (
      decoded.storedPath !== requiredPrefix &&
      !decoded.storedPath.startsWith(`${requiredPrefix}/`)
    ) {
      throw new ApiRouteError("Deliverable path does not match its immutable identity", 400);
    }
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (sha256 !== deliverable.sha256 || content.byteLength !== deliverable.byteLength) {
      throw new ApiRouteError("Deliverable content hash or length is inconsistent", 400);
    }
    const metadataPath = path.join(
      this.workspaceDirectory(workspaceId),
      "records",
      "deliverables",
      `${decoded.id}.json`
    );
    const artifactPath = this.resolveStoredWorkspacePath(workspaceId, decoded.storedPath);
    if (existsSync(metadataPath)) {
      const existing = Value.Decode(
        DeliverableSchema,
        JSON.parse(readFileSync(metadataPath, "utf8"))
      );
      if (JSON.stringify(existing) !== JSON.stringify(decoded)) {
        throw new ApiRouteError(`Immutable Deliverable metadata conflicts: ${decoded.id}`, 409);
      }
      this.assertRecoverableDeliverable(workspaceId, existing);
      this.linkRecord(workspace, "deliverableIds", existing.id);
      return existing;
    }
    if (existsSync(artifactPath)) {
      throw new ApiRouteError(`Uncommitted Deliverable bytes already exist: ${decoded.id}`, 409);
    }
    writeFileAtomic(artifactPath, content);
    try {
      this.writeImmutableRecord(workspaceId, "deliverables", decoded.id, decoded);
    } catch (error) {
      rmSync(artifactPath, { force: true });
      throw error;
    }
    this.linkRecord(workspace, "deliverableIds", decoded.id);
    return decoded;
  }

  getDeliverable(workspaceId: string, deliverableId: string): Deliverable {
    return this.readRecord(
      workspaceId,
      "deliverables",
      deliverableId,
      "deliverable",
      DeliverableSchema
    );
  }

  readDeliverableContent(workspaceId: string, deliverableId: string): Buffer {
    const deliverable = this.getDeliverable(workspaceId, deliverableId);
    return readFileSync(path.join(this.workspaceDirectory(workspaceId), deliverable.storedPath));
  }

  saveArrangementScore(workspaceId: string, arrangement: ArrangementScore): ArrangementScore {
    const workspace = this.get(workspaceId);
    if (!workspace.analysisRecordIds.includes(arrangement.analysisRecordId)) {
      throw new ApiRouteError(
        `Arrangement analysis is not part of workspace: ${arrangement.analysisRecordId}`,
        400
      );
    }
    if (
      !arrangement.arrangementSearchId ||
      !arrangement.version ||
      !arrangement.arrangementFamilyId
    ) {
      throw new ApiRouteError(
        "A persisted Arrangement Score requires an Arrangement Family, Search, and version",
        400
      );
    }
    const search = this.getArrangementSearch(workspaceId, arrangement.arrangementSearchId);
    const family = this.getArrangementFamily(workspaceId, arrangement.arrangementFamilyId);
    const candidate = this.getArrangementCandidate(workspaceId, arrangement.selectedCandidateId);
    if (arrangement.arrangementPlanId) {
      const plan = this.getArrangementPlan(workspaceId, arrangement.arrangementPlanId);
      const required = plan.decisions
        .filter((decision) =>
          decision.targetConfigurationIds.includes(arrangement.targetConfiguration.id)
        )
        .map((decision) => decision.id)
        .sort();
      const realized = [...(arrangement.realizedPlanDecisionIds ?? [])].sort();
      if (JSON.stringify(required) !== JSON.stringify(realized)) {
        throw new ApiRouteError(
          "Arrangement Score does not realize every applicable Plan Decision",
          400
        );
      }
    }
    if (
      candidate.arrangementSearchId !== search.id ||
      search.analysisRecordId !== arrangement.analysisRecordId ||
      search.targetConfiguration.id !== arrangement.targetConfiguration.id
    ) {
      throw new ApiRouteError(
        "Arrangement Score search, candidate, analysis, or target lineage is inconsistent",
        400
      );
    }
    if (arrangement.branchId && !workspace.arrangementBranchIds.includes(arrangement.branchId)) {
      throw new ApiRouteError(
        `Arrangement Score branch is not part of workspace: ${arrangement.branchId}`,
        400
      );
    }
    const score = this.getNormalizedScore(workspaceId, search.normalizedScoreId);
    const analysis = this.getAnalysisRecord(workspaceId, search.analysisRecordId);
    const sourceEntryIds = arrangement.transformationReport
      .filter((entry) => entry.entryType === "event" && entry.sourceEventId)
      .map((entry) => entry.sourceEventId!);
    const relationshipIds = arrangement.transformationReport
      .filter((entry) => entry.entryType === "relationship" && entry.sourceRelationshipId)
      .map((entry) => entry.sourceRelationshipId!);
    const completeSourceCoverage = score.events.every(
      (event) => sourceEntryIds.filter((id) => id === event.id).length === 1
    );
    const completeRelationshipCoverage = analysis.preservationTargets
      .filter((target) => target.kind === "relationship")
      .every((target) => relationshipIds.filter((id) => id === target.id).length === 1);
    const generatedCoverage = arrangement.events
      .filter((event) => event.role === "realization" || event.sourceEventIds.length === 0)
      .every((event) =>
        arrangement.transformationReport.some(
          (entry) =>
            entry.classification === "generated" && entry.arrangementEventIds.includes(event.id)
        )
      );
    if (!completeSourceCoverage || !completeRelationshipCoverage || !generatedCoverage) {
      throw new ApiRouteError(
        "Arrangement Score requires a complete event, relationship, and generated-material Transformation Report",
        400
      );
    }
    const decoded = Value.Decode(ArrangementScoreSchema, arrangement);
    this.writeImmutableRecord(workspaceId, "arrangement-scores", decoded.id, decoded);
    this.linkRecord(workspace, "arrangementScoreIds", decoded.id);
    if (!family.arrangementScoreIds.includes(decoded.id)) {
      this.saveArrangementFamily(workspaceId, {
        ...family,
        arrangementScoreIds: [...family.arrangementScoreIds, decoded.id],
        updatedAt: this.now().toISOString(),
      });
    }
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

  saveArrangementSearch(workspaceId: string, search: ArrangementSearch): ArrangementSearch {
    const workspace = this.get(workspaceId);
    if (!workspace.normalizedScoreIds.includes(search.normalizedScoreId)) {
      throw new ApiRouteError(
        `Arrangement Search score is not part of workspace: ${search.normalizedScoreId}`,
        400
      );
    }
    if (!workspace.analysisRecordIds.includes(search.analysisRecordId)) {
      throw new ApiRouteError(
        `Arrangement Search analysis is not part of workspace: ${search.analysisRecordId}`,
        400
      );
    }
    if (
      search.status === "completed" &&
      (search.candidateIds.length === 0 ||
        !search.selectedCandidateId ||
        !search.candidateIds.includes(search.selectedCandidateId) ||
        !search.selectedArrangementScoreId ||
        !search.candidateIds.every((id) => workspace.arrangementCandidateIds.includes(id)) ||
        !workspace.arrangementScoreIds.includes(search.selectedArrangementScoreId))
    ) {
      throw new ApiRouteError(
        "A completed Arrangement Search requires candidates, a selected candidate, and its Arrangement Score",
        400
      );
    }
    const decoded = Value.Decode(ArrangementSearchSchema, search);
    this.writeRecord(workspaceId, "arrangement-searches", decoded.id, decoded);
    this.linkRecord(workspace, "arrangementSearchIds", decoded.id);
    return decoded;
  }

  getArrangementSearch(workspaceId: string, searchId: string): ArrangementSearch {
    return this.readRecord(
      workspaceId,
      "arrangement-searches",
      searchId,
      "search",
      ArrangementSearchSchema
    );
  }

  saveArrangementCandidate(
    workspaceId: string,
    candidate: ArrangementCandidate
  ): ArrangementCandidate {
    const workspace = this.get(workspaceId);
    if (
      !candidate.arrangementSearchId ||
      !workspace.arrangementSearchIds.includes(candidate.arrangementSearchId)
    ) {
      throw new ApiRouteError(
        "Arrangement Candidate must belong to a persisted Arrangement Search",
        400
      );
    }
    if (
      !candidate.derivationChoices?.length ||
      !candidate.evaluation ||
      !candidate.createdAt ||
      (candidate.status !== "rejected" && !candidate.rank) ||
      (candidate.status === "rejected" && !candidate.rejectionReason)
    ) {
      throw new ApiRouteError(
        "A persisted Arrangement Candidate requires derivation, evaluation, ranking or rejection evidence, and creation time",
        400
      );
    }
    const decoded = Value.Decode(ArrangementCandidateSchema, candidate);
    this.writeImmutableRecord(workspaceId, "arrangement-candidates", decoded.id, decoded);
    this.linkRecord(workspace, "arrangementCandidateIds", decoded.id);
    return decoded;
  }

  getArrangementCandidate(workspaceId: string, candidateId: string): ArrangementCandidate {
    return this.readRecord(
      workspaceId,
      "arrangement-candidates",
      candidateId,
      "candidate",
      ArrangementCandidateSchema
    );
  }

  saveModelAction(workspaceId: string, action: ModelAction): ModelAction {
    const workspace = this.get(workspaceId);
    const decoded = Value.Decode(ModelActionSchema, action);
    this.writeRecord(workspaceId, "model-actions", decoded.id, decoded);
    this.linkRecord(workspace, "modelActionIds", decoded.id);
    return decoded;
  }

  getModelAction(workspaceId: string, modelActionId: string): ModelAction {
    return this.readRecord(
      workspaceId,
      "model-actions",
      modelActionId,
      "model-action",
      ModelActionSchema
    );
  }

  listModelActions(workspaceId: string): ModelAction[] {
    const workspace = this.get(workspaceId);
    return workspace.modelActionIds.map((id) => this.getModelAction(workspaceId, id));
  }

  saveGuidedWorkflow(workspaceId: string, workflow: GuidedWorkflow): GuidedWorkflow {
    const workspace = this.get(workspaceId);
    const decoded = Value.Decode(GuidedWorkflowSchema, workflow);
    if (decoded.workspaceId !== workspaceId) {
      throw new ApiRouteError("Guided workflow workspace identity mismatch", 400);
    }
    this.writeRecord(workspaceId, "guided-workflows", decoded.id, decoded);
    this.linkRecord(workspace, "guidedWorkflowIds", decoded.id);
    return decoded;
  }

  getGuidedWorkflow(workspaceId: string, workflowId: string): GuidedWorkflow {
    return this.readRecord(
      workspaceId,
      "guided-workflows",
      workflowId,
      "workflow",
      GuidedWorkflowSchema
    );
  }

  listGuidedWorkflows(workspaceId: string): GuidedWorkflow[] {
    return this.get(workspaceId).guidedWorkflowIds.map((id) =>
      this.getGuidedWorkflow(workspaceId, id)
    );
  }

  saveSourceTruthAssessment(
    workspaceId: string,
    assessment: SourceTruthAssessment
  ): SourceTruthAssessment {
    const decoded = Value.Decode(SourceTruthAssessmentSchema, assessment);
    const source = this.getSourceArtifact(workspaceId, decoded.sourceArtifactId);
    const transcription = this.getScoreTranscription(workspaceId, decoded.scoreTranscriptionId);
    const normalized = this.getNormalizedScore(workspaceId, decoded.normalizedScoreId);
    const analysis = this.getAnalysisRecord(workspaceId, decoded.analysisRecordId);
    if (
      transcription.sourceArtifactId !== source.id ||
      transcription.version !== decoded.scoreTranscriptionVersion ||
      normalized.scoreTranscriptionId !== transcription.id ||
      normalized.version !== decoded.normalizedScoreVersion ||
      analysis.normalizedScoreId !== normalized.id ||
      analysis.version !== decoded.analysisRecordVersion
    ) {
      throw new ApiRouteError("Source Truth Assessment lineage versions do not match", 400);
    }
    const workspace = this.get(workspaceId);
    const validScopeIds = new Set([
      ...normalized.parts.map((part) => part.id),
      ...normalized.measures.map((measure) => measure.id),
      ...normalized.events.map((event) => event.id),
    ]);
    if (
      [...decoded.scope.partIds, ...decoded.scope.measureIds, ...decoded.scope.eventIds].some(
        (id) => !validScopeIds.has(id)
      )
    ) {
      throw new ApiRouteError("Source Truth Assessment scope is outside its Normalized Score", 400);
    }
    if (
      decoded.targetConfigurationIds.some(
        (id) => !workspace.brief.targetConfigurations.some((target) => target.id === id)
      )
    ) {
      throw new ApiRouteError(
        "Source Truth Assessment target is outside its Arrangement Brief",
        400
      );
    }
    if (decoded.performanceBriefId) {
      const brief = this.getPerformanceBrief(workspaceId, decoded.performanceBriefId);
      if (!decoded.targetConfigurationIds.includes(brief.targetConfigurationId)) {
        throw new ApiRouteError(
          "Source Truth Assessment Performance Brief target is not assessed",
          400
        );
      }
    }
    const claimIds = new Set(analysis.claims.map((claim) => claim.id));
    const authorized = new Set(decoded.authorizedClaimIds);
    if (
      [...decoded.authorizedClaimIds, ...decoded.blockedClaimIds].some((id) => !claimIds.has(id)) ||
      decoded.blockedClaimIds.some((id) => authorized.has(id))
    ) {
      throw new ApiRouteError("Source Truth Assessment claim authorization is inconsistent", 400);
    }
    const uncertaintyIds = new Set([
      ...transcription.uncertainties.map((item) => item.id),
      ...(analysis.ambiguities ?? []).map((item) => item.id),
    ]);
    if (
      [
        ...decoded.consideredUncertaintyIds,
        ...decoded.unresolvedUncertaintyIds,
        ...decoded.blockingUncertaintyIds,
      ].some((id) => !uncertaintyIds.has(id)) ||
      decoded.consequences.some((consequence) => !uncertaintyIds.has(consequence.uncertaintyId))
    ) {
      throw new ApiRouteError("Source Truth Assessment uncertainty lineage is inconsistent", 400);
    }
    const considered = new Set(decoded.consideredUncertaintyIds);
    const unresolved = new Set(decoded.unresolvedUncertaintyIds);
    if (
      decoded.unresolvedUncertaintyIds.some((id) => !considered.has(id)) ||
      decoded.blockingUncertaintyIds.some((id) => !unresolved.has(id))
    ) {
      throw new ApiRouteError("Source Truth Assessment uncertainty sets are inconsistent", 400);
    }
    if (decoded.supersedesAssessmentId) {
      const prior = this.getSourceTruthAssessment(workspaceId, decoded.supersedesAssessmentId);
      const sameScope =
        JSON.stringify({
          ...prior.scope,
          partIds: [...prior.scope.partIds].sort(),
          measureIds: [...prior.scope.measureIds].sort(),
          eventIds: [...prior.scope.eventIds].sort(),
        }) ===
        JSON.stringify({
          ...decoded.scope,
          partIds: [...decoded.scope.partIds].sort(),
          measureIds: [...decoded.scope.measureIds].sort(),
          eventIds: [...decoded.scope.eventIds].sort(),
        });
      const sameTargets =
        JSON.stringify([...prior.targetConfigurationIds].sort()) ===
        JSON.stringify([...decoded.targetConfigurationIds].sort());
      const lineageContinues =
        decoded.scoreTranscriptionId === prior.scoreTranscriptionId ||
        transcription.parentId === prior.scoreTranscriptionId;
      if (
        prior.id === decoded.id ||
        prior.purpose !== decoded.purpose ||
        !sameScope ||
        !sameTargets ||
        prior.preservationPolicy !== decoded.preservationPolicy ||
        prior.performanceBriefId !== decoded.performanceBriefId ||
        !lineageContinues
      ) {
        throw new ApiRouteError("Source Truth Assessment supersession is invalid", 400);
      }
      if (
        workspace.sourceTruthAssessmentIds
          .map((id) => this.getSourceTruthAssessment(workspaceId, id))
          .some((assessment) => assessment.supersedesAssessmentId === prior.id)
      ) {
        throw new ApiRouteError("Source Truth Assessment already has a superseding iteration", 409);
      }
    }
    this.writeImmutableRecord(workspaceId, "source-truth-assessments", decoded.id, decoded);
    this.linkWorkspaceRecord(workspaceId, "sourceTruthAssessmentIds", decoded.id);
    return decoded;
  }

  getSourceTruthAssessment(workspaceId: string, id: string): SourceTruthAssessment {
    return this.readRecord(
      workspaceId,
      "source-truth-assessments",
      id,
      "truth",
      SourceTruthAssessmentSchema
    );
  }

  savePerformanceBrief(workspaceId: string, brief: PerformanceBrief): PerformanceBrief {
    const decoded = Value.Decode(PerformanceBriefSchema, brief);
    const workspace = this.get(workspaceId);
    if (
      !workspace.brief.targetConfigurations.some(
        (target) => target.id === decoded.targetConfigurationId
      )
    )
      throw new ApiRouteError("Performance Brief target is not part of workspace", 400);
    this.writeImmutableRecord(workspaceId, "performance-briefs", decoded.id, decoded);
    this.linkWorkspaceRecord(workspaceId, "performanceBriefIds", decoded.id);
    return decoded;
  }

  getPerformanceBrief(workspaceId: string, id: string): PerformanceBrief {
    return this.readRecord(
      workspaceId,
      "performance-briefs",
      id,
      "performance",
      PerformanceBriefSchema
    );
  }

  saveArrangementPlan(workspaceId: string, plan: ArrangementPlan): ArrangementPlan {
    const decoded = Value.Decode(ArrangementPlanSchema, plan);
    const truth = this.getSourceTruthAssessment(workspaceId, decoded.sourceTruthAssessmentId);
    const normalized = this.getNormalizedScore(workspaceId, decoded.normalizedScoreId);
    const analysis = this.getAnalysisRecord(workspaceId, decoded.analysisRecordId);
    const brief = this.getPerformanceBrief(workspaceId, decoded.performanceBriefId);
    if (
      truth.normalizedScoreId !== normalized.id ||
      truth.normalizedScoreVersion !== decoded.normalizedScoreVersion ||
      truth.analysisRecordId !== analysis.id ||
      truth.analysisRecordVersion !== decoded.analysisRecordVersion ||
      normalized.version !== decoded.normalizedScoreVersion ||
      analysis.version !== decoded.analysisRecordVersion ||
      brief.targetConfigurationId !== decoded.targetConfigurationId
    ) {
      throw new ApiRouteError("Arrangement Plan lineage versions do not match", 400);
    }
    this.writeImmutableRecord(workspaceId, "arrangement-plans", decoded.id, decoded);
    this.linkWorkspaceRecord(workspaceId, "arrangementPlanIds", decoded.id);
    return decoded;
  }

  getArrangementPlan(workspaceId: string, id: string): ArrangementPlan {
    return this.readRecord(workspaceId, "arrangement-plans", id, "plan", ArrangementPlanSchema);
  }

  resolveCurrentInputVersions(
    workspaceId: string,
    originals: ModelActionInputVersion[]
  ): ModelActionInputVersion[] {
    const workspace = this.get(workspaceId);
    return originals.map((original) => {
      if (original.recordId.startsWith("transcription.")) {
        this.getScoreTranscription(workspaceId, original.recordId);
        return latestVersion(
          workspace.scoreTranscriptionIds
            .map((id) => this.getScoreTranscription(workspaceId, id))
            .filter((record) =>
              this.isTranscriptionDescendant(workspaceId, record.id, original.recordId)
            ),
          original
        );
      }
      if (original.recordId.startsWith("score.")) {
        const originalTranscriptionId = this.getNormalizedScore(
          workspaceId,
          original.recordId
        ).scoreTranscriptionId;
        return latestVersion(
          workspace.normalizedScoreIds
            .map((id) => this.getNormalizedScore(workspaceId, id))
            .filter((record) =>
              this.isTranscriptionDescendant(
                workspaceId,
                record.scoreTranscriptionId,
                originalTranscriptionId
              )
            ),
          original
        );
      }
      if (original.recordId.startsWith("analysis.")) {
        const originalTranscriptionId = this.getNormalizedScore(
          workspaceId,
          this.getAnalysisRecord(workspaceId, original.recordId).normalizedScoreId
        ).scoreTranscriptionId;
        return latestVersion(
          workspace.analysisRecordIds
            .map((id) => this.getAnalysisRecord(workspaceId, id))
            .filter((record) =>
              this.isTranscriptionDescendant(
                workspaceId,
                this.getNormalizedScore(workspaceId, record.normalizedScoreId).scoreTranscriptionId,
                originalTranscriptionId
              )
            ),
          original
        );
      }
      throw new ApiRouteError(
        `Unsupported or missing versioned Model Action input: ${original.recordId}`,
        400
      );
    });
  }

  assertCanonicalResultReference(workspaceId: string, reference: string): void {
    if (reference.startsWith("transcription.")) {
      this.getScoreTranscription(workspaceId, reference);
      return;
    }
    if (reference.startsWith("score.")) {
      this.getNormalizedScore(workspaceId, reference);
      return;
    }
    if (reference.startsWith("analysis.")) {
      this.getAnalysisRecord(workspaceId, reference);
      return;
    }
    if (reference.startsWith("arrangement.")) {
      this.getArrangementScore(workspaceId, reference);
      return;
    }
    throw new ApiRouteError(`Unsupported canonical Model Action result: ${reference}`, 400);
  }

  private isTranscriptionDescendant(
    workspaceId: string,
    candidateId: string,
    ancestorId: string
  ): boolean {
    const visited = new Set<string>();
    let current: ScoreTranscription | undefined = this.getScoreTranscription(
      workspaceId,
      candidateId
    );
    while (current && !visited.has(current.id)) {
      if (current.id === ancestorId) return true;
      visited.add(current.id);
      current = current.parentId
        ? this.getScoreTranscription(workspaceId, current.parentId)
        : undefined;
    }
    return false;
  }

  saveArrangementBranch(workspaceId: string, branch: ArrangementBranch): ArrangementBranch {
    const workspace = this.get(workspaceId);
    const decoded = Value.Decode(ArrangementBranchSchema, branch);
    this.writeImmutableRecord(workspaceId, "arrangement-branches", decoded.id, decoded);
    this.linkRecord(workspace, "arrangementBranchIds", decoded.id);
    return decoded;
  }

  getArrangementBranch(workspaceId: string, branchId: string): ArrangementBranch {
    return this.readRecord(
      workspaceId,
      "arrangement-branches",
      branchId,
      "branch",
      ArrangementBranchSchema
    );
  }

  savePerformanceInterpretation(
    workspaceId: string,
    interpretation: PerformanceInterpretation
  ): PerformanceInterpretation {
    const workspace = this.get(workspaceId);
    const arrangement = this.getArrangementScore(workspaceId, interpretation.arrangementScoreId);
    if ((arrangement.version ?? 1) !== interpretation.arrangementScoreVersion) {
      throw new ApiRouteError("Performance Interpretation score version is inconsistent", 400);
    }
    const decoded = Value.Decode(PerformanceInterpretationSchema, interpretation);
    this.writeImmutableRecord(workspaceId, "performance-interpretations", decoded.id, decoded);
    this.linkRecord(workspace, "performanceInterpretationIds", decoded.id);
    return decoded;
  }

  getPerformanceInterpretation(workspaceId: string, id: string): PerformanceInterpretation {
    return this.readRecord(
      workspaceId,
      "performance-interpretations",
      id,
      "interpretation",
      PerformanceInterpretationSchema
    );
  }

  private linkSourceArtifact(workspace: ArrangementWorkspace, sourceArtifactId: string): void {
    if (!workspace.sourceArtifactIds.includes(sourceArtifactId)) {
      this.linkWorkspaceRecord(workspace.id, "sourceArtifactIds", sourceArtifactId);
    }
  }

  private saveLineageRecord<T>(
    workspaceId: string,
    category: string,
    key:
      | "staleDerivationIds"
      | "editorialCommitmentIds"
      | "familyCommitmentIds"
      | "commitmentConflictIds"
      | "policyExceptionIds",
    schema: TSchema,
    record: T
  ): T {
    const workspace = this.get(workspaceId);
    const decoded = Value.Decode(schema, record) as T;
    const id = (decoded as { id: string }).id;
    this.writeRecord(workspaceId, category, id, decoded);
    this.linkRecord(workspace, key, id);
    return decoded;
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
      this.linkWorkspaceRecord(workspace.id, collection, id);
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
    const decoded = Value.Decode(ArrangementWorkspaceSchema, workspace);
    writeJsonAtomic(this.workspaceManifestPath(workspace.id), decoded);
  }

  private linkWorkspaceRecord<K extends keyof ArrangementWorkspace>(
    workspaceId: string,
    collection: K,
    id: string
  ): ArrangementWorkspace {
    return this.mutateWorkspace(workspaceId, undefined, (workspace) => {
      const values = workspace[collection];
      if (!Array.isArray(values)) {
        throw new ApiRouteError(
          `Workspace field is not a record collection: ${String(collection)}`,
          500
        );
      }
      if (!(values as string[]).includes(id)) (values as string[]).push(id);
      return { ...workspace, updatedAt: this.now().toISOString() };
    });
  }

  private mutateWorkspace(
    workspaceId: string,
    expectedRevision: number | undefined,
    mutate: (workspace: ArrangementWorkspace) => ArrangementWorkspace
  ): ArrangementWorkspace {
    const release = this.acquireWorkspaceLock(workspaceId);
    try {
      const manifestPath = this.workspaceManifestPath(workspaceId);
      if (!existsSync(manifestPath)) {
        throw new ApiRouteError(`Arrangement workspace not found: ${workspaceId}`, 404);
      }
      const current = Value.Decode(
        ArrangementWorkspaceSchema,
        JSON.parse(readFileSync(manifestPath, "utf8"))
      );
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw new ApiRouteError(
          `Workspace revision conflict: expected ${expectedRevision}, current ${current.revision}`,
          409
        );
      }
      const updated = Value.Decode(ArrangementWorkspaceSchema, {
        ...mutate(structuredClone(current)),
        revision: current.revision + 1,
      });
      writeJsonAtomic(manifestPath, updated);
      return updated;
    } finally {
      release();
    }
  }

  private acquireWorkspaceLock(workspaceId: string): () => void {
    const lockPath = path.join(this.workspaceDirectory(workspaceId), ".workspace.lock");
    let descriptor: number;
    try {
      descriptor = openSync(lockPath, "wx", 0o600);
    } catch {
      if (!this.removeStaleWorkspaceLock(workspaceId)) {
        throw new ApiRouteError("Workspace mutation is already in progress", 409);
      }
      try {
        descriptor = openSync(lockPath, "wx", 0o600);
      } catch {
        throw new ApiRouteError("Workspace mutation is already in progress", 409);
      }
    }
    try {
      writeFileSync(descriptor, String(process.pid));
    } catch (error) {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
      throw error;
    }
    return () => {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
    };
  }

  private removeStaleWorkspaceLock(workspaceId: string): boolean {
    const lockPath = path.join(this.workspaceDirectory(workspaceId), ".workspace.lock");
    if (!existsSync(lockPath)) return false;
    const owner = Number(readFileSync(lockPath, "utf8"));
    if (Number.isInteger(owner) && owner > 0) {
      try {
        process.kill(owner, 0);
        return false;
      } catch {
        rmSync(lockPath, { force: true });
        return true;
      }
    }
    if (Date.now() - statSync(lockPath).mtimeMs < 30_000) return false;
    rmSync(lockPath, { force: true });
    return true;
  }

  private assertRecoverableDeliverable(workspaceId: string, deliverable: Deliverable): void {
    const arrangement = this.getArrangementScore(workspaceId, deliverable.arrangementScoreId);
    if (arrangement.version !== deliverable.arrangementScoreVersion) {
      throw new ApiRouteError(`Deliverable lineage does not match: ${deliverable.id}`, 500);
    }
    const artifactPath = this.resolveStoredWorkspacePath(workspaceId, deliverable.storedPath);
    if (!existsSync(artifactPath)) {
      throw new ApiRouteError(`Deliverable bytes are missing: ${deliverable.id}`, 500);
    }
    const content = readFileSync(artifactPath);
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (content.byteLength !== deliverable.byteLength || sha256 !== deliverable.sha256) {
      throw new ApiRouteError(`Deliverable bytes do not match metadata: ${deliverable.id}`, 500);
    }
  }

  private quarantineRecoveryPath(workspaceId: string, sourcePath: string): string {
    const relative = path.relative(this.workspaceDirectory(workspaceId), sourcePath);
    const quarantinePath = path.join(
      this.workspaceDirectory(workspaceId),
      ".recovery",
      "quarantine",
      relative
    );
    mkdirSync(path.dirname(quarantinePath), { recursive: true });
    renameSync(sourcePath, quarantinePath);
    return path.relative(this.workspaceDirectory(workspaceId), quarantinePath);
  }

  private resolveStoredWorkspacePath(workspaceId: string, storedPath: string): string {
    const workspaceDirectory = path.resolve(this.workspaceDirectory(workspaceId));
    const resolved = path.resolve(workspaceDirectory, storedPath);
    if (!resolved.startsWith(`${workspaceDirectory}${path.sep}`)) {
      throw new ApiRouteError("Stored workspace path escapes its workspace", 400);
    }
    return resolved;
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

function validateSourceFile(mimeType: string, filePath: string, byteLength: number): void {
  if (byteLength <= 0) throw new ApiRouteError("Source upload is empty", 400);
  if (!supportedMimeTypes.has(mimeType)) {
    throw new ApiRouteError(`Unsupported source MIME type: ${mimeType}`, 400);
  }
  if (mimeType !== "application/pdf") return;
  const descriptor = openSync(filePath, "r");
  try {
    const signature = Buffer.alloc(5);
    const bytesRead = readSync(descriptor, signature, 0, signature.length, 0);
    if (bytesRead !== 5 || !signature.equals(Buffer.from("%PDF-"))) {
      throw new ApiRouteError("Uploaded PDF does not have a valid PDF signature", 400);
    }
  } finally {
    closeSync(descriptor);
  }
}

const supportedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.recordare.musicxml+xml",
  "application/xml",
  "text/xml",
  "text/x-lilypond",
  "text/vnd.abc",
  "application/mei+xml",
  "application/vnd.musescore.mscz",
  "application/vnd.vellum.lead-sheet+json",
  "application/vnd.vellum.tablature+json",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

function sourceKind(mimeType: string): SourceArtifact["kind"] {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "text/x-lilypond") return "lilypond";
  if (mimeType === "text/vnd.abc") return "abc";
  if (mimeType === "application/mei+xml") return "mei";
  if (mimeType === "application/vnd.musescore.mscz") return "mscz";
  if (mimeType === "application/vnd.vellum.lead-sheet+json") return "lead_sheet";
  if (mimeType === "application/vnd.vellum.tablature+json") return "tablature";
  if (mimeType === "text/plain") return "natural_language";
  return "musicxml";
}

function latestVersion(
  records: Array<{ id: string; version: number }>,
  original: ModelActionInputVersion
): ModelActionInputVersion {
  const latest = [...records].sort(
    (left, right) => right.version - left.version || left.id.localeCompare(right.id)
  )[0];
  if (!latest) return original;
  const tied = records.filter((record) => record.version === latest.version);
  if (tied.length > 1) {
    throw new ApiRouteError(
      `Ambiguous correction lineage at version ${latest.version}: ${tied
        .map((record) => record.id)
        .sort()
        .join(", ")}`,
      409
    );
  }
  const { sha256: _obsoleteHash, ...identity } = original;
  return { ...identity, recordId: latest.id, version: latest.version };
}

function validateRhythmicReferences(
  score: Pick<ScoreTranscription, "measures" | "events" | "performedForm" | "notationIssues">
): void {
  const measureIds = new Set(score.measures.map((measure) => measure.id));
  const eventIds = new Set(score.events.map((event) => event.id));
  const occurrenceIds = new Set<string>();
  for (const occurrence of score.performedForm?.measureOccurrences ?? []) {
    if (!measureIds.has(occurrence.measureId)) {
      throw new ApiRouteError(
        `Performed Form occurrence ${occurrence.id} references missing measure ${occurrence.measureId}`,
        400
      );
    }
    if (occurrenceIds.has(occurrence.id)) {
      throw new ApiRouteError(`Duplicate Performed Form occurrence: ${occurrence.id}`, 400);
    }
    occurrenceIds.add(occurrence.id);
  }
  for (const issue of score.notationIssues ?? []) {
    const missingMeasure = issue.measureIds.find((id) => !measureIds.has(id));
    const missingEvent = issue.eventIds.find((id) => !eventIds.has(id));
    if (missingMeasure || missingEvent) {
      throw new ApiRouteError(
        `Notation issue ${issue.id} has invalid scope: ${missingMeasure ?? missingEvent}`,
        400
      );
    }
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
