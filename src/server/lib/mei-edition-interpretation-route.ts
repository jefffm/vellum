import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import {
  CreateEditionAcceptanceDecisionCommandSchema,
  CreateTablatureInterpretationCommandSchema,
  type CreateEditionAcceptanceDecisionCommand,
  type CreateTablatureInterpretationCommand,
} from "../../lib/mei-edition-domain.js";
import { createApiRoute } from "./create-route.js";
import { MeiEditionInterpretationService } from "./mei-edition-interpretation-service.js";
import { MeiEditionInterpretationStore } from "./mei-edition-interpretation-store.js";
import { MeiEditionStore } from "./mei-edition-store.js";

const EditionParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  editionId: Type.String({ pattern: "^edition\\.[a-f0-9-]{16,}$" }),
});
const InterpretationParamsSchema = Type.Intersect([
  EditionParamsSchema,
  Type.Object({
    interpretationId: Type.String({ pattern: "^tab-interpretation\\.[a-f0-9-]{16,}$" }),
  }),
]);

function service(): MeiEditionInterpretationService {
  const editions = new MeiEditionStore();
  return new MeiEditionInterpretationService({
    editions,
    records: new MeiEditionInterpretationStore({ editions }),
  });
}

export function createMeiEditionInterpretationStateRoute(): RequestHandler {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(EditionParamsSchema, request.params),
    handler: async ({ workspaceId, editionId }) => service().state(workspaceId, editionId),
  });
}

export function createMeiEditionInterpretationCreateRoute(): RequestHandler {
  return createApiRoute<
    {
      workspaceId: string;
      editionId: string;
      command: CreateTablatureInterpretationCommand;
    },
    unknown
  >({
    validate: (body, request) => ({
      ...Value.Decode(EditionParamsSchema, request.params),
      command: Value.Decode(CreateTablatureInterpretationCommandSchema, body),
    }),
    handler: async ({ workspaceId, editionId, command }) => {
      const active = service();
      const interpretation = active.createInterpretation(workspaceId, editionId, command);
      return { interpretation, state: active.state(workspaceId, editionId) };
    },
  });
}

export function createMeiEditionAcceptanceDecisionRoute(): RequestHandler {
  return createApiRoute<
    {
      workspaceId: string;
      editionId: string;
      command: CreateEditionAcceptanceDecisionCommand;
    },
    unknown
  >({
    validate: (body, request) => ({
      ...Value.Decode(EditionParamsSchema, request.params),
      command: Value.Decode(CreateEditionAcceptanceDecisionCommandSchema, body),
    }),
    handler: async ({ workspaceId, editionId, command }) => {
      const active = service();
      const decision = active.decide(workspaceId, editionId, command);
      return { decision, state: active.state(workspaceId, editionId) };
    },
  });
}

export function createMeiEditionPlaybackRoute(): RequestHandler {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(InterpretationParamsSchema, request.params),
    handler: async ({ workspaceId, editionId, interpretationId }) =>
      service().playback(workspaceId, editionId, interpretationId),
  });
}
