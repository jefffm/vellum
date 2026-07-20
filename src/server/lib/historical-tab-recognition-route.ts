import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import {
  CreateHistoricalTabRecognitionCommandSchema,
  PublishHistoricalTabDraftCommandSchema,
} from "../../lib/historical-tab-recognition-domain.js";
import { createApiRoute } from "./create-route.js";
import { HistoricalTabRecognitionService } from "./historical-tab-recognition-service.js";
import { HistoricalTabRecognitionStore } from "./historical-tab-recognition-store.js";

const WorkspaceSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});
const RunSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  runId: Type.String({ pattern: "^tab-recognition\\.[a-f0-9-]{16,}$" }),
});

export function createHistoricalTabRecognitionRoute(): RequestHandler {
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceSchema, request.params),
      command: Value.Decode(CreateHistoricalTabRecognitionCommandSchema, body),
    }),
    handler: ({ workspaceId, command }) =>
      new HistoricalTabRecognitionService().recognize(workspaceId, command),
  });
}

export function createHistoricalTabRecognitionGetRoute(): RequestHandler {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(RunSchema, request.params),
    handler: async ({ workspaceId, runId }) =>
      new HistoricalTabRecognitionStore().get(workspaceId, runId),
  });
}

export function createHistoricalTabPublishRoute(): RequestHandler {
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(RunSchema, request.params),
      command: Value.Decode(PublishHistoricalTabDraftCommandSchema, body),
    }),
    handler: async ({ workspaceId, runId, command }) =>
      new HistoricalTabRecognitionService().publish(workspaceId, runId, command),
  });
}

export function createHistoricalTabRecognitionFacsimileRoute(): RequestHandler {
  return (request, response, next) => {
    try {
      const { workspaceId, runId } = Value.Decode(RunSchema, request.params);
      response.type("image/png");
      response.setHeader("Cache-Control", "private, max-age=300");
      response.send(new HistoricalTabRecognitionStore().pageImage(workspaceId, runId));
    } catch (error) {
      next(error);
    }
  };
}
