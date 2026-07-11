import { randomUUID } from "node:crypto";
import type {
  CommitmentConflict,
  EditorialCommitment,
  FamilyCommitment,
  StaleDerivation,
} from "../../lib/music-domain.js";
import { ArrangementService } from "./arrangement-service.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

type LineageServiceOptions = {
  store: WorkspaceStore;
  arrangementService?: ArrangementService;
  now?: () => Date;
  createId?: () => string;
};

export class LineageService {
  private readonly store: WorkspaceStore;
  private readonly arrangementService: ArrangementService;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: LineageServiceOptions) {
    this.store = options.store;
    this.arrangementService =
      options.arrangementService ?? new ArrangementService({ store: options.store });
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  markArrangementsStale(
    workspaceId: string,
    priorNormalizedScoreId: string,
    currentNormalizedScoreId: string,
    reason: string
  ): StaleDerivation[] {
    const workspace = this.store.get(workspaceId);
    const current = this.store.getNormalizedScore(workspaceId, currentNormalizedScoreId);
    const prior = this.store.getNormalizedScore(workspaceId, priorNormalizedScoreId);
    const records: StaleDerivation[] = [];
    for (const arrangementId of workspace.arrangementScoreIds) {
      const arrangement = this.store.getArrangementScore(workspaceId, arrangementId);
      const search = arrangement.arrangementSearchId
        ? this.store.getArrangementSearch(workspaceId, arrangement.arrangementSearchId)
        : undefined;
      if (search?.normalizedScoreId !== priorNormalizedScoreId) continue;
      records.push(
        this.saveStale(
          workspaceId,
          "arrangement_score",
          arrangement.id,
          reason,
          [
            {
              recordType: "normalized_score",
              recordId: priorNormalizedScoreId,
              version: prior.version,
            },
          ],
          [{ recordType: "normalized_score", recordId: current.id, version: current.version }]
        )
      );
      for (const deliverableId of workspace.deliverableIds) {
        const deliverable = this.store.getDeliverable(workspaceId, deliverableId);
        if (deliverable.arrangementScoreId !== arrangement.id) continue;
        records.push(
          this.saveStale(
            workspaceId,
            "deliverable",
            deliverable.id,
            reason,
            [
              {
                recordType: "arrangement_score",
                recordId: arrangement.id,
                version: arrangement.version ?? 1,
              },
            ],
            [{ recordType: "normalized_score", recordId: current.id, version: current.version }]
          )
        );
      }
    }
    return records;
  }

  createEditorialCommitment(
    workspaceId: string,
    input: Omit<EditorialCommitment, "id" | "status" | "createdAt">
  ): EditorialCommitment {
    this.store.getArrangementScore(workspaceId, input.arrangementScoreId);
    this.store.getArrangementFamily(workspaceId, input.arrangementFamilyId);
    return this.store.saveEditorialCommitment(workspaceId, {
      ...input,
      id: `commitment.${this.createId()}`,
      status: "active",
      createdAt: this.now().toISOString(),
    });
  }

  releaseEditorialCommitment(workspaceId: string, commitmentId: string): EditorialCommitment {
    const commitment = this.store.getEditorialCommitment(workspaceId, commitmentId);
    return this.store.saveEditorialCommitment(workspaceId, {
      ...commitment,
      status: "released",
      releasedAt: this.now().toISOString(),
    });
  }

  promoteFamilyCommitment(
    workspaceId: string,
    commitmentId: string,
    targetConfigurationIds: string[]
  ): FamilyCommitment {
    const source = this.store.getEditorialCommitment(workspaceId, commitmentId);
    if (["notation", "course_fingering"].includes(source.scope.dimension)) {
      throw new ApiRouteError(
        `${source.scope.dimension} is target-local and cannot become a Family Commitment`,
        409
      );
    }
    const record = this.store.saveFamilyCommitment(workspaceId, {
      id: `family-commitment.${this.createId()}`,
      arrangementFamilyId: source.arrangementFamilyId,
      sourceCommitmentId: source.id,
      scope: source.scope,
      value: source.value,
      targetConfigurationIds,
      status: "active",
      createdAt: this.now().toISOString(),
    });
    const workspace = this.store.get(workspaceId);
    for (const arrangementId of workspace.arrangementScoreIds) {
      const score = this.store.getArrangementScore(workspaceId, arrangementId);
      if (score.arrangementFamilyId !== source.arrangementFamilyId) continue;
      this.saveStale(
        workspaceId,
        "arrangement_score",
        score.id,
        `Family Commitment ${record.id} changed`,
        [{ recordType: "arrangement_score", recordId: score.id, version: score.version ?? 1 }],
        [{ recordType: "family_commitment", recordId: record.id, version: 1 }]
      );
    }
    return record;
  }

  approvePolicyException(
    workspaceId: string,
    input: {
      conflictId: string;
      rationale: string;
      musicalConsequence: string;
      severity: "localized" | "critical";
      ownerApproved: true;
    }
  ) {
    const conflict = this.store.getCommitmentConflict(workspaceId, input.conflictId);
    if (conflict.status !== "unresolved") {
      throw new ApiRouteError(`Commitment Conflict is already resolved: ${conflict.id}`, 409);
    }
    if (input.severity === "critical") {
      throw new ApiRouteError(
        "Policy Drift: a critical preservation consequence cannot be normalized as a local exception; revise the source, release the commitment, or start a new arrangement policy.",
        409
      );
    }
    const timestamp = this.now().toISOString();
    const exception = this.store.savePolicyException(workspaceId, {
      id: `exception.${this.createId()}`,
      arrangementScoreId: conflict.arrangementScoreId,
      conflictId: conflict.id,
      scope: conflict.scope,
      affectedPreservationTargetIds: conflict.affectedPreservationTargetIds,
      musicalConsequence: input.musicalConsequence,
      rationale: input.rationale,
      severity: input.severity,
      ownerApproved: true,
      createdAt: timestamp,
    });
    this.store.saveCommitmentConflict(workspaceId, {
      ...conflict,
      status: "exception_approved",
      resolvedAt: timestamp,
    });
    return exception;
  }

  conservativeRegenerate(
    workspaceId: string,
    input: {
      arrangementScoreId: string;
      normalizedScoreId: string;
      changedSourceEventIds: string[];
    }
  ) {
    const stale = this.store.getArrangementScore(workspaceId, input.arrangementScoreId);
    const workspace = this.store.get(workspaceId);
    const commitments = workspace.editorialCommitmentIds
      .map((id) => this.store.getEditorialCommitment(workspaceId, id))
      .filter((record) => record.arrangementScoreId === stale.id)
      .filter((record) => record.status === "active");
    const familyCommitmentIds = workspace.familyCommitmentIds
      .map((id) => this.store.getFamilyCommitment(workspaceId, id))
      .filter(
        (record) =>
          record.arrangementFamilyId === stale.arrangementFamilyId && record.status === "active"
      )
      .map((record) => record.id);
    const exceptedCommitmentIds = new Set(
      workspace.commitmentConflictIds
        .map((id) => this.store.getCommitmentConflict(workspaceId, id))
        .filter(
          (record) =>
            record.arrangementScoreId === stale.id && record.status === "exception_approved"
        )
        .map((record) => record.commitmentId)
    );
    const conflicts = commitments.filter(
      (commitment) =>
        !exceptedCommitmentIds.has(commitment.id) &&
        commitment.scope.objectIds.some((id) =>
          stale.events.some(
            (event) =>
              (event.id === id || event.sourceEventIds.includes(id)) &&
              event.sourceEventIds.some((sourceId) =>
                input.changedSourceEventIds.includes(sourceId)
              )
          )
        )
    );
    if (conflicts.length) {
      const saved = conflicts.map((commitment) =>
        this.saveConflict(workspaceId, stale.id, commitment, input.changedSourceEventIds)
      );
      throw new ApiRouteError(
        `Conservative regeneration is blocked by Commitment Conflicts ${saved.map((item) => item.id).join(", ")}. Resolve by releasing the commitment, revising the source correction, or approving a scoped Policy Exception.`,
        409
      );
    }
    const branchId = `branch.${this.createId()}`;
    this.store.saveArrangementBranch(workspaceId, {
      id: branchId,
      label: `Conservative regeneration from ${stale.id}`,
      rootInputVersions: [
        { recordType: "arrangement_score", recordId: stale.id, version: stale.version ?? 1 },
        { recordType: "normalized_score", recordId: input.normalizedScoreId, version: 1 },
      ],
      createdAt: this.now().toISOString(),
    });
    return this.arrangementService.createFaithfulReduction(workspaceId, {
      normalizedScoreId: input.normalizedScoreId,
      targetConfigurationId: stale.targetConfiguration.id,
      arrangementFamilyId: stale.arrangementFamilyId,
      branchId,
      parentArrangementScoreId: stale.id,
      version: (stale.version ?? 1) + 1,
      editorialCommitmentIds: commitments.map((item) => item.id),
      familyCommitmentIds,
      policyExceptionIds: workspace.policyExceptionIds
        .map((id) => this.store.getPolicyException(workspaceId, id))
        .filter((record) => record.arrangementScoreId === stale.id)
        .map((record) => record.id),
      regenerationFrom: {
        arrangementScoreId: stale.id,
        changedSourceEventIds: input.changedSourceEventIds,
      },
    });
  }

  private saveStale(
    workspaceId: string,
    recordType: StaleDerivation["recordType"],
    recordId: string,
    reason: string,
    priorInputVersions: StaleDerivation["priorInputVersions"],
    currentInputVersions: StaleDerivation["currentInputVersions"]
  ): StaleDerivation {
    return this.store.saveStaleDerivation(workspaceId, {
      id: `stale.${this.createId()}`,
      recordType,
      recordId,
      reason,
      priorInputVersions,
      currentInputVersions,
      acknowledged: false,
      createdAt: this.now().toISOString(),
    });
  }

  private saveConflict(
    workspaceId: string,
    arrangementScoreId: string,
    commitment: EditorialCommitment,
    changedSourceEventIds: string[]
  ): CommitmentConflict {
    return this.store.saveCommitmentConflict(workspaceId, {
      id: `conflict.${this.createId()}`,
      arrangementScoreId,
      commitmentId: commitment.id,
      scope: commitment.scope,
      conflictingObjectIds: commitment.scope.objectIds,
      affectedPreservationTargetIds: changedSourceEventIds,
      consequence: "The upstream correction changes material protected by an active commitment.",
      status: "unresolved",
      createdAt: this.now().toISOString(),
    });
  }
}
