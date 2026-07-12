import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ArrangementPlanSchema } from "../../lib/music-domain.js";
import { ArrangementPlanService } from "./arrangement-plan-service.js";
import { createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const ParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  planId: Type.String({ pattern: "^plan\\.[a-zA-Z0-9.-]+$" }),
});

const CorrectionSchema = Type.Object(
  {
    reason: Type.String({ minLength: 1 }),
    correction: Type.Object(
      {
        kind: ArrangementPlanSchema.properties.kind,
        planningScope: ArrangementPlanSchema.properties.planningScope,
        transpositionPlan: ArrangementPlanSchema.properties.transpositionPlan,
        sectionalIntent: ArrangementPlanSchema.properties.sectionalIntent,
        materialDisposition: ArrangementPlanSchema.properties.materialDisposition,
        specialistIntent: ArrangementPlanSchema.properties.specialistIntent,
        decisions: ArrangementPlanSchema.properties.decisions,
        status: ArrangementPlanSchema.properties.status,
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export function createArrangementPlanGetRoute(store = new WorkspaceStore()) {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(ParamsSchema, request.params),
    handler: async ({ workspaceId, planId }) => store.getArrangementPlan(workspaceId, planId),
  });
}

export function createArrangementPlanCorrectionRoute(
  store = new WorkspaceStore(),
  service = new ArrangementPlanService({ store })
) {
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ParamsSchema, request.params),
      ...Value.Decode(CorrectionSchema, body),
    }),
    handler: async ({ workspaceId, planId, correction, reason }) =>
      service.correct(workspaceId, planId, correction, reason),
  });
}
