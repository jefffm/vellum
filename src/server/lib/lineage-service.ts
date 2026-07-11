import { randomUUID } from "node:crypto";
import { auditFaithfulPrincipalVoice } from "../../lib/baroque-guitar-arranger.js";
import { auditContinuo } from "../../lib/continuo-arranger.js";
import { auditImitative } from "../../lib/imitative-arranger.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import { applyPreservationPolicy } from "../../lib/preservation-policy.js";
import { buildCompleteTransformationReport } from "../../lib/transformation-report.js";
import type {
  ArrangementEvent,
  CommitmentConflict,
  EditorialCommitment,
  FamilyCommitment,
  StaleDerivation,
} from "../../lib/music-domain.js";
import { ArrangementService } from "./arrangement-service.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";
import { loadProfile } from "../profiles.js";

type LineageServiceOptions = {
  store: WorkspaceStore;
  arrangementService?: ArrangementService;
  now?: () => Date;
  createId?: () => string;
};

export type ArrangementEventPatch = {
  pitches?: string[];
  duration?: { numerator: number; denominator: number };
  positions?: Array<{
    course: number;
    fret: number;
    pitch: string;
    quality: "open" | "low_fret" | "high_fret" | "diapason";
  }>;
};

export type ArrangementEventEdit = { eventId: string; patch: ArrangementEventPatch };

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
    reason: string,
    changedObjectIds: string[] = []
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
          [{ recordType: "normalized_score", recordId: current.id, version: current.version }],
          changedObjectIds
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
            [{ recordType: "normalized_score", recordId: current.id, version: current.version }],
            changedObjectIds
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

  acknowledgeStaleDerivation(workspaceId: string, staleDerivationId: string): StaleDerivation {
    const record = this.store.getStaleDerivation(workspaceId, staleDerivationId);
    return this.store.saveStaleDerivation(workspaceId, { ...record, acknowledged: true });
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

  editArrangementEvent(
    workspaceId: string,
    arrangementScoreId: string,
    eventId: string,
    patch: ArrangementEventPatch
  ) {
    const result = this.editArrangementEvents(workspaceId, arrangementScoreId, [
      { eventId, patch },
    ]);
    return {
      arrangementScore: result.arrangementScore,
      editorialCommitment: result.editorialCommitments[0]!,
    };
  }

  editArrangementEvents(
    workspaceId: string,
    arrangementScoreId: string,
    edits: ArrangementEventEdit[]
  ) {
    if (edits.length === 0)
      throw new ApiRouteError("An Edit Batch requires at least one edit", 400);
    const original = this.store.getArrangementScore(workspaceId, arrangementScoreId);
    const changes = edits.map((edit) => {
      const event = original.events.find((candidate) => candidate.id === edit.eventId);
      if (!event) throw new ApiRouteError(`Arrangement event not found: ${edit.eventId}`, 404);
      const changed = [edit.patch.pitches, edit.patch.duration, edit.patch.positions].filter(
        (value) => value !== undefined
      );
      if (changed.length !== 1) {
        throw new ApiRouteError(
          "Each Edit Batch item must change exactly one semantic dimension",
          400
        );
      }
      return {
        event,
        patch: edit.patch,
        dimension: editDimension(event, edit.patch),
      };
    });
    const editKeys = changes.map(({ event, dimension }) => `${event.id}:${dimension}`);
    if (new Set(editKeys).size !== editKeys.length) {
      throw new ApiRouteError(
        "An Edit Batch cannot change the same event dimension more than once",
        400
      );
    }
    const editedEvents = original.events.map((event) =>
      changes
        .filter((change) => change.event.id === event.id)
        .reduce((current, change) => ({ ...current, ...change.patch }), event)
    );
    const search = this.store.getArrangementSearch(workspaceId, original.arrangementSearchId!);
    const source = this.store.getNormalizedScore(workspaceId, search.normalizedScoreId);
    const analysis = this.store.getAnalysisRecord(workspaceId, original.analysisRecordId);
    const model = InstrumentModel.fromProfile(
      loadProfile(original.targetConfiguration.instrumentId)
    );
    validateEditedEvents(model, editedEvents);
    const faithfulAudit =
      analysis.texture === "continuo"
        ? auditContinuo(source, analysis, editedEvents)
        : analysis.texture === "imitative-polyphony"
          ? auditImitative(source, analysis, editedEvents, model)
          : auditFaithfulPrincipalVoice(
              source,
              analysis,
              editedEvents,
              original.transpositionPlan.semitones
            );
    const preservationAudit = applyPreservationPolicy(faithfulAudit, original.preservationPolicy);
    if (preservationAudit.status === "fail") {
      throw new ApiRouteError(
        `Edit Batch fails the ${original.preservationPolicy.replaceAll("_", " ")} Preservation Audit: ${preservationAudit.findings.map((finding) => finding.message).join("; ")}`,
        409
      );
    }
    const timestamp = this.now().toISOString();
    const commitments = changes.map(({ event, patch, dimension }) => ({
      id: `commitment.${this.createId()}`,
      arrangementScoreId: original.id,
      arrangementFamilyId: original.arrangementFamilyId!,
      scope: { objectIds: [event.id], measureIds: [event.measureId], dimension },
      value: patch.positions ?? patch.duration ?? patch.pitches,
      origin: "user_edit" as const,
      status: "active" as const,
      createdAt: timestamp,
    }));
    const branchId = `branch.${this.createId()}`;
    const branch = {
      id: branchId,
      label: `Owner Edit Batch · ${changes.length} change${changes.length === 1 ? "" : "s"}`,
      rootInputVersions: [
        {
          recordType: "arrangement_score",
          recordId: original.id,
          version: original.version ?? 1,
        },
      ],
      createdAt: timestamp,
    };
    const editedInput = {
      ...original,
      id: `arrangement.${this.createId()}`,
      version: (original.version ?? 1) + 1,
      parentArrangementScoreId: original.id,
      branchId,
      editorialCommitmentIds: [
        ...(original.editorialCommitmentIds ?? []),
        ...commitments.map((commitment) => commitment.id),
      ],
      events: editedEvents,
      transformationReport: buildCompleteTransformationReport(
        source,
        analysis,
        editedEvents,
        original.transpositionPlan.semitones
      ),
      preservationAudit,
      createdAt: timestamp,
    };
    for (const commitment of commitments)
      this.store.saveEditorialCommitment(workspaceId, commitment);
    this.store.saveArrangementBranch(workspaceId, branch);
    const edited = this.store.saveArrangementScore(workspaceId, editedInput);
    return { arrangementScore: edited, editorialCommitments: commitments, branch };
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
      preservationPolicy: stale.preservationPolicy,
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
    currentInputVersions: StaleDerivation["currentInputVersions"],
    changedObjectIds: string[] = []
  ): StaleDerivation {
    return this.store.saveStaleDerivation(workspaceId, {
      id: `stale.${this.createId()}`,
      recordType,
      recordId,
      reason,
      priorInputVersions,
      currentInputVersions,
      changedObjectIds,
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
    const arrangement = this.store.getArrangementScore(workspaceId, arrangementScoreId);
    const analysis = this.store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
    const matchedTargetIds = analysis.preservationTargets
      .filter((target) => target.eventIds.some((id) => changedSourceEventIds.includes(id)))
      .map((target) => target.id);
    const affectedPreservationTargetIds = matchedTargetIds.length
      ? matchedTargetIds
      : arrangement.preservationAudit.targetIds;
    return this.store.saveCommitmentConflict(workspaceId, {
      id: `conflict.${this.createId()}`,
      arrangementScoreId,
      commitmentId: commitment.id,
      scope: commitment.scope,
      conflictingObjectIds: commitment.scope.objectIds,
      affectedPreservationTargetIds,
      consequence: "The upstream correction changes material protected by an active commitment.",
      status: "unresolved",
      createdAt: this.now().toISOString(),
    });
  }
}

function editDimension(
  event: ArrangementEvent,
  patch: ArrangementEventPatch
): EditorialCommitment["scope"]["dimension"] {
  if (patch.positions) return "course_fingering";
  if (patch.duration) return "rhythm";
  if (event.role === "principal_voice") return "principal_voice_pitch";
  if (event.role === "continuo_foundation") return "bass";
  return "harmony";
}

function validateEditedEvents(model: InstrumentModel, events: ArrangementEvent[]): void {
  for (const event of events) {
    if (event.type === "rest") continue;
    if (event.pitches.length === 0) {
      throw new ApiRouteError(`Edited sounding event has no pitches: ${event.id}`, 400);
    }
    if (event.positions.length === 0) {
      throw new ApiRouteError(`Edited sounding event has no course positions: ${event.id}`, 400);
    }
    const playable = model.isPlayable(event.positions);
    if (!playable.ok) {
      throw new ApiRouteError(
        `Edit Batch is not playable at ${event.id}: ${playable.violations.map((violation) => violation.description).join("; ")}`,
        409
      );
    }
    for (const position of event.positions) {
      const sounding = model.soundingPitch(position.course, position.fret);
      if (sounding !== position.pitch) {
        throw new ApiRouteError(
          `Edit Batch position pitch mismatch at ${event.id}: course ${position.course} fret ${position.fret} sounds ${sounding}, not ${position.pitch}`,
          400
        );
      }
    }
    const eventPitches = event.pitches.slice().sort().join("|");
    const positionPitches = event.positions
      .map((position) => position.pitch)
      .sort()
      .join("|");
    if (eventPitches !== positionPitches) {
      throw new ApiRouteError(
        `Edit Batch pitch and fingering disagree at ${event.id}: event pitches ${eventPitches} versus position pitches ${positionPitches}`,
        400
      );
    }
  }
}
