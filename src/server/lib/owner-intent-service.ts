import { randomUUID } from "node:crypto";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  classifyOwnerIntent,
  type CanonicalOwnerIntentLayer,
  type OwnerIntentAnchor,
  type OwnerIntentProposal,
} from "../../lib/owner-intent.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

export class OwnerIntentService {
  private readonly store: WorkspaceStore;
  private readonly createId: () => string;

  constructor(options: { store: WorkspaceStore; createId?: () => string }) {
    assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
    this.store = options.store;
    this.createId = options.createId ?? randomUUID;
  }

  classify(
    anchor: OwnerIntentAnchor,
    request: string,
    modelProposedLayer?: CanonicalOwnerIntentLayer
  ): OwnerIntentProposal {
    const score = this.store.getArrangementScore(anchor.workspaceId, anchor.arrangementScoreId);
    if ((score.version ?? 1) !== anchor.arrangementScoreVersion) {
      throw new ApiRouteError(
        "Owner-intent anchor references a stale Arrangement Score version",
        409
      );
    }
    if (
      score.arrangementFamilyId !== anchor.arrangementFamilyId ||
      score.arrangementSearchId !== anchor.arrangementSearchId ||
      score.arrangementPlanId !== anchor.arrangementPlanId ||
      score.analysisRecordId !== anchor.analysisRecordId ||
      score.targetConfiguration.id !== anchor.targetConfigurationId ||
      score.preservationPolicy !== anchor.preservationPolicy
    ) {
      throw new ApiRouteError("Owner-intent anchor does not match Arrangement Score lineage", 409);
    }
    const selected = score.events.filter((event) => anchor.eventIds.includes(event.id));
    if (
      selected.length !== new Set(anchor.eventIds).size ||
      anchor.measureIds.some((id) => !selected.some((event) => event.measureId === id)) ||
      anchor.sourceEventIds.some(
        (id) => !selected.some((event) => event.sourceEventIds.includes(id))
      )
    ) {
      throw new ApiRouteError("Owner-intent selection anchor is stale or outside the score", 409);
    }
    const findingIds = new Set(
      score.preservationAudit.findings.map((finding) => `${finding.targetId}:${finding.code}`)
    );
    if (anchor.findingIds.some((id) => !findingIds.has(id))) {
      throw new ApiRouteError("Owner-intent finding anchor is stale", 409);
    }
    this.store.getArrangementSearch(anchor.workspaceId, anchor.arrangementSearchId);
    this.store.getArrangementPlan(anchor.workspaceId, anchor.arrangementPlanId);
    this.store.getAnalysisRecord(anchor.workspaceId, anchor.analysisRecordId);
    return classifyOwnerIntent({
      id: `owner-intent.${this.createId()}`,
      request,
      anchor,
      modelProposedLayer,
    });
  }
}
