import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { ArrangementService } from "./arrangement-service.js";
import type {
  CreateFaithfulArrangementInput,
  CreateFaithfulArrangementResult,
} from "./arrangement-service.js";
import { createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";
import { OwnerStore } from "./owner-store.js";

const ParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});

const RequestSchema = Type.Object(
  {
    normalizedScoreId: Type.String({ pattern: "^score\\.[a-f0-9-]{16,}$" }),
    targetConfigurationId: Type.String({ minLength: 1 }),
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
  },
  { additionalProperties: false }
);

type RouteInput = CreateFaithfulArrangementInput & { workspaceId: string };

type RouteOptions = {
  store?: WorkspaceStore;
  service?: ArrangementService;
};

export function createFaithfulArrangementRoute(options: RouteOptions = {}): RequestHandler {
  const store = options.store ?? new WorkspaceStore();
  const service =
    options.service ?? new ArrangementService({ store, ownerStore: new OwnerStore() });
  return createApiRoute<RouteInput, CreateFaithfulArrangementResult>({
    validate: (body, request) => {
      const requestBody = Value.Decode(RequestSchema, body);
      return {
        ...Value.Decode(ParamsSchema, request.params),
        normalizedScoreId: requestBody.normalizedScoreId,
        targetConfigurationId: requestBody.targetConfigurationId,
        preservationPolicy: requestBody.preservationPolicy,
      };
    },
    handler: async ({ workspaceId, ...input }) =>
      service.createFaithfulReduction(workspaceId, input),
  });
}
