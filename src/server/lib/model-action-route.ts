import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { ModelActionInputVersionSchema } from "../../lib/music-domain.js";
import { createApiRoute } from "./create-route.js";
import { ModelActionService } from "./model-action-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const WorkspaceParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});
const ActionParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  modelActionId: Type.String({ pattern: "^model-action\\.[a-f0-9-]{16,}$" }),
});
const CreateSchema = Type.Object(
  {
    kind: Type.Literal("interactive_guidance_v1"),
    intent: Type.String({ minLength: 1 }),
    inputVersions: Type.Optional(Type.Array(ModelActionInputVersionSchema)),
    idempotencyKey: Type.Optional(Type.String({ minLength: 16 })),
  },
  { additionalProperties: false }
);
const AuthorizationSchema = Type.Object(
  {
    decision: Type.Union([
      Type.Literal("authorize"),
      Type.Literal("deny"),
      Type.Literal("withdraw"),
    ]),
    disclosureDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  },
  { additionalProperties: false }
);
const InterruptSchema = Type.Object(
  { reason: Type.String({ minLength: 1 }) },
  { additionalProperties: false }
);
const RunSchema = Type.Object(
  { envelopeDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }) },
  { additionalProperties: false }
);
const RetrySchema = Type.Object(
  {
    mode: Type.Optional(
      Type.Union([Type.Literal("current_version"), Type.Literal("original_snapshot_branch")])
    ),
  },
  { additionalProperties: false }
);

type Options = { store?: WorkspaceStore; service?: ModelActionService };

function dependencies(options: Options) {
  const store = options.store ?? new WorkspaceStore();
  return { store, service: options.service ?? new ModelActionService({ store }) };
}

export function createModelActionCreateRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceParamsSchema, request.params),
      input: Value.Decode(CreateSchema, body),
    }),
    handler: async ({ workspaceId, input }) => service.create(workspaceId, input),
  });
}

export function createModelActionListRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(WorkspaceParamsSchema, request.params),
    handler: async ({ workspaceId }) => store.listModelActions(workspaceId),
  });
}

export function createModelActionGetRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(ActionParamsSchema, request.params),
    handler: async ({ workspaceId, modelActionId }) =>
      store.getModelAction(workspaceId, modelActionId),
  });
}

export function createModelActionPublicationGetRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(ActionParamsSchema, request.params),
    handler: async ({ workspaceId, modelActionId }) =>
      store.getModelActionPublicationForAction(workspaceId, modelActionId),
  });
}

export function createModelActionAuthorizationRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ActionParamsSchema, request.params),
      ...Value.Decode(AuthorizationSchema, body),
    }),
    handler: async ({ workspaceId, modelActionId, decision, disclosureDigest }) =>
      service.authorize(workspaceId, modelActionId, decision, disclosureDigest),
  });
}

export function createModelActionInterruptRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ActionParamsSchema, request.params),
      ...Value.Decode(InterruptSchema, body),
    }),
    handler: async ({ workspaceId, modelActionId, reason }) =>
      service.interrupt(workspaceId, modelActionId, reason),
  });
}

export function createModelActionRunRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ActionParamsSchema, request.params),
      ...Value.Decode(RunSchema, body),
    }),
    handler: async ({ workspaceId, modelActionId, envelopeDigest }, _request, response) => {
      const controller = new AbortController();
      const abortDisconnectedRequest = () => {
        if (!response.writableEnded) controller.abort("Model Action client disconnected");
      };
      response.once("close", abortDisconnectedRequest);
      try {
        return await service.run(workspaceId, modelActionId, envelopeDigest, controller.signal);
      } finally {
        response.off("close", abortDisconnectedRequest);
      }
    },
  });
}

export function createModelActionRetryRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ActionParamsSchema, request.params),
      ...Value.Decode(RetrySchema, body),
    }),
    handler: async ({ workspaceId, modelActionId, mode }) =>
      service.retry(workspaceId, modelActionId, mode),
  });
}

export function createModelActionCancelRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(ActionParamsSchema, request.params),
    handler: async ({ workspaceId, modelActionId }) => service.cancel(workspaceId, modelActionId),
  });
}
