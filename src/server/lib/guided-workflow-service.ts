import { randomUUID } from "node:crypto";
import type { GuidedWorkflow } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

type Options = { store?: WorkspaceStore; now?: () => Date; createId?: () => string };
export type CreateGuidedWorkflow = Pick<
  GuidedWorkflow,
  "sourceArtifactId" | "optical" | "ocrAutoAcceptConfidence" | "preservationPolicy"
> & { performanceBrief?: GuidedWorkflow["performanceBrief"] };
export type GuidedWorkflowCheckpoint = Partial<
  Pick<
    GuidedWorkflow,
    | "stage"
    | "omrRunId"
    | "scoreTranscriptionId"
    | "scoreTranscriptionVersion"
    | "normalizedScoreId"
    | "normalizedScoreVersion"
    | "analysisRecordId"
    | "analysisRecordVersion"
  >
> & { targets?: GuidedWorkflow["targets"] };
export type RestartGuidedWorkflow = Pick<GuidedWorkflow, "ocrAutoAcceptConfidence">;

const STAGES: GuidedWorkflow["stage"][] = [
  "source_saved",
  "recognizing",
  "transcription_review",
  "analysis_review",
  "target_search",
  "projection",
  "complete",
];

export class GuidedWorkflowService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: Options = {}) {
    this.store = options.store ?? new WorkspaceStore();
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  create(workspaceId: string, input: CreateGuidedWorkflow): GuidedWorkflow {
    this.store.getSourceArtifact(workspaceId, input.sourceArtifactId);
    const workspace = this.store.get(workspaceId);
    const existing = this.store
      .listGuidedWorkflows(workspaceId)
      .find(
        (workflow) =>
          workflow.status !== "cancelled" &&
          workflow.status !== "complete" &&
          workflow.sourceArtifactId === input.sourceArtifactId
      );
    if (existing) return existing;
    const timestamp = this.now().toISOString();
    return this.store.saveGuidedWorkflow(workspaceId, {
      id: `workflow.${this.createId()}`,
      workspaceId,
      status: "active",
      stage: "source_saved",
      sourceArtifactId: input.sourceArtifactId,
      optical: input.optical,
      ...(input.ocrAutoAcceptConfidence === undefined
        ? {}
        : { ocrAutoAcceptConfidence: input.ocrAutoAcceptConfidence }),
      preservationPolicy: input.preservationPolicy,
      performanceBrief: input.performanceBrief ?? defaultPerformanceBrief(),
      targets: workspace.brief.targetConfigurations.map((target) => ({
        targetConfigurationId: target.id,
        status: "pending",
        deliverableIds: [],
      })),
      resumeCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  checkpoint(
    workspaceId: string,
    workflowId: string,
    update: GuidedWorkflowCheckpoint
  ): GuidedWorkflow {
    const current = this.store.getGuidedWorkflow(workspaceId, workflowId);
    if (current.status === "cancelled" || current.status === "complete") {
      throw new ApiRouteError(`Cannot update ${current.status} Guided Start workflow`, 409);
    }
    const stage = update.stage ?? current.stage;
    if (STAGES.indexOf(stage) < STAGES.indexOf(current.stage)) {
      throw new ApiRouteError("Guided Start workflow stage cannot move backward", 409);
    }
    const targets = update.targets
      ? mergeTargetProgress(current.targets, update.targets)
      : current.targets;
    this.validateReferences(workspaceId, update, targets);
    const complete = stage === "complete";
    if (complete && targets.some((target) => target.status !== "complete")) {
      throw new ApiRouteError("Every target must complete before the workflow completes", 409);
    }
    return this.store.saveGuidedWorkflow(workspaceId, {
      ...current,
      ...update,
      stage,
      targets,
      status: complete ? "complete" : "active",
      failureCode: undefined,
      updatedAt: this.now().toISOString(),
    });
  }

  interrupt(workspaceId: string, workflowId: string, code: string): GuidedWorkflow {
    const current = this.store.getGuidedWorkflow(workspaceId, workflowId);
    if (current.status === "complete" || current.status === "cancelled") return current;
    return this.store.saveGuidedWorkflow(workspaceId, {
      ...current,
      status: "interrupted",
      failureCode: code.trim() || "workflow_interrupted",
      updatedAt: this.now().toISOString(),
    });
  }

  resume(workspaceId: string, workflowId: string): GuidedWorkflow {
    const current = this.store.getGuidedWorkflow(workspaceId, workflowId);
    if (current.status !== "interrupted") {
      throw new ApiRouteError("Only an interrupted Guided Start workflow can resume", 409);
    }
    return this.store.saveGuidedWorkflow(workspaceId, {
      ...current,
      status: "active",
      failureCode: undefined,
      resumeCount: current.resumeCount + 1,
      updatedAt: this.now().toISOString(),
    });
  }

  restart(
    workspaceId: string,
    workflowId: string,
    input: Partial<RestartGuidedWorkflow> = {}
  ): GuidedWorkflow {
    const current = this.store.getGuidedWorkflow(workspaceId, workflowId);
    if (current.status !== "complete" && current.status !== "cancelled") {
      this.store.saveGuidedWorkflow(workspaceId, {
        ...current,
        status: "cancelled",
        updatedAt: this.now().toISOString(),
      });
    }
    return this.create(workspaceId, {
      sourceArtifactId: current.sourceArtifactId,
      optical: current.optical,
      ocrAutoAcceptConfidence: input.ocrAutoAcceptConfidence ?? current.ocrAutoAcceptConfidence,
      preservationPolicy: current.preservationPolicy,
      performanceBrief: current.performanceBrief,
    });
  }

  active(workspaceId: string): GuidedWorkflow | undefined {
    return this.store
      .listGuidedWorkflows(workspaceId)
      .filter((workflow) => workflow.status === "active" || workflow.status === "interrupted")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  private validateReferences(
    workspaceId: string,
    update: GuidedWorkflowCheckpoint,
    targets: GuidedWorkflow["targets"]
  ): void {
    if (update.omrRunId) this.store.getOmrRun(workspaceId, update.omrRunId);
    if (update.scoreTranscriptionId) {
      const record = this.store.getScoreTranscription(workspaceId, update.scoreTranscriptionId);
      if (update.scoreTranscriptionVersion !== record.version)
        throw new ApiRouteError("Transcription checkpoint version mismatch", 409);
    }
    if (update.normalizedScoreId) {
      const record = this.store.getNormalizedScore(workspaceId, update.normalizedScoreId);
      if (update.normalizedScoreVersion !== record.version)
        throw new ApiRouteError("Normalized Score checkpoint version mismatch", 409);
    }
    if (update.analysisRecordId) {
      const record = this.store.getAnalysisRecord(workspaceId, update.analysisRecordId);
      if (update.analysisRecordVersion !== record.version)
        throw new ApiRouteError("Analysis checkpoint version mismatch", 409);
    }
    for (const target of targets.filter((candidate) => candidate.status === "complete")) {
      if (
        !target.arrangementScoreId ||
        !target.arrangementSearchId ||
        !target.arrangementScoreVersion
      )
        throw new ApiRouteError(
          "Complete target checkpoint lacks exact arrangement identities",
          409
        );
      const score = this.store.getArrangementScore(workspaceId, target.arrangementScoreId);
      if (score.version !== target.arrangementScoreVersion)
        throw new ApiRouteError("Arrangement checkpoint version mismatch", 409);
      this.store.getArrangementSearch(workspaceId, target.arrangementSearchId);
      for (const id of target.deliverableIds) this.store.getDeliverable(workspaceId, id);
    }
  }
}

function defaultPerformanceBrief(): NonNullable<GuidedWorkflow["performanceBrief"]> {
  return {
    intendedUse: "study",
    performerProfile: {
      proficiency: "intermediate",
      assumptionSource: "guided_start_default_pending_owner_review",
      techniqueFamiliarity: [],
    },
    tempoContext: { status: "not_specified" },
    difficultyIntent: "intermediate",
    preparationExpectation: "practice_expected",
    reliabilityGoal: "repeatable",
    techniqueContext: { status: "unspecified" },
    notationContext: { needs: ["target-appropriate notation"], ensembleRole: "solo" },
  };
}

function mergeTargetProgress(
  current: GuidedWorkflow["targets"],
  updates: GuidedWorkflow["targets"]
): GuidedWorkflow["targets"] {
  const updateById = new Map(updates.map((target) => [target.targetConfigurationId, target]));
  if (updateById.size !== updates.length)
    throw new ApiRouteError("Duplicate target checkpoint", 400);
  for (const id of updateById.keys()) {
    if (!current.some((target) => target.targetConfigurationId === id))
      throw new ApiRouteError(`Unknown target checkpoint: ${id}`, 400);
  }
  return current.map((target) => {
    const update = updateById.get(target.targetConfigurationId);
    if (!update) return target;
    if (target.status === "complete" && JSON.stringify(update) !== JSON.stringify(target))
      throw new ApiRouteError(
        `Completed target is immutable: ${target.targetConfigurationId}`,
        409
      );
    return update;
  });
}
