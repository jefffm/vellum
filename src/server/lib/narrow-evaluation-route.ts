import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  buildNarrowEvaluationCard,
  type NarrowPlanningRecords,
} from "../../lib/narrow-intelligence.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const Params = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  arrangementId: Type.String({ pattern: "^arrangement\\.[a-f0-9-]{16,}$" }),
});

export function createNarrowEvaluationCardRoute(store?: WorkspaceStore): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.arrangement-evaluation-card", "production");
  const resolvedStore = store ?? new WorkspaceStore();
  return createApiRoute({
    validate: (_body, request) => Value.Decode(Params, request.params),
    handler: async ({ workspaceId, arrangementId }) => {
      const score = resolvedStore.getArrangementScore(workspaceId, arrangementId);
      if (!score.arrangementPlanId) {
        throw new ApiRouteError("Arrangement Score has no Arrangement Plan lineage", 409);
      }
      const arrangementPlan = resolvedStore.getArrangementPlan(
        workspaceId,
        score.arrangementPlanId
      );
      const planning: NarrowPlanningRecords = {
        arrangementPlan,
        sourceTruthAssessment: resolvedStore.getSourceTruthAssessment(
          workspaceId,
          arrangementPlan.sourceTruthAssessmentId
        ),
        performanceBrief: resolvedStore.getPerformanceBrief(
          workspaceId,
          arrangementPlan.performanceBriefId
        ),
      };
      const deliverableIds = resolvedStore
        .get(workspaceId)
        .deliverableIds.map((id) => resolvedStore.getDeliverable(workspaceId, id))
        .filter(
          (deliverable) =>
            deliverable.arrangementScoreId === score.id &&
            deliverable.arrangementScoreVersion === (score.version ?? 1)
        )
        .map((deliverable) => deliverable.id);
      return buildNarrowEvaluationCard({ score, planning, deliverableIds });
    },
  });
}
