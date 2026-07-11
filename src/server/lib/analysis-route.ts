import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { AnalysisService } from "./analysis-service.js";
import { createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const ParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  analysisRecordId: Type.String({ pattern: "^analysis\\.[a-zA-Z0-9.-]+$" }),
});

const CorrectionParamsSchema = Type.Intersect([
  ParamsSchema,
  Type.Object({ claimId: Type.String({ pattern: "^claim\\.[a-zA-Z0-9.-]+$" }) }),
]);

const CorrectionSchema = Type.Object(
  {
    statement: Type.String({ minLength: 1 }),
    subjectIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
    selectedAlternativeId: Type.Optional(Type.String({ minLength: 1 })),
    semanticValue: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export function createAnalysisGetRoute(store = new WorkspaceStore()) {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(ParamsSchema, request.params),
    handler: async ({ workspaceId, analysisRecordId }) =>
      store.getAnalysisRecord(workspaceId, analysisRecordId),
  });
}

export function createAnalysisCorrectionRoute(
  store = new WorkspaceStore(),
  service = new AnalysisService({ store })
) {
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(CorrectionParamsSchema, request.params),
      correction: Value.Decode(CorrectionSchema, body),
    }),
    handler: async ({ workspaceId, analysisRecordId, claimId, correction }) =>
      service.correctClaim(workspaceId, analysisRecordId, claimId, correction),
  });
}
