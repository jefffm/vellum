import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  setDeliverableResponseHeaders,
  validateDeliverableForServing,
} from "./artifact-response.js";
import { WorkspaceStore } from "./workspace-store.js";

const FamilyParams = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  familyId: Type.String({ pattern: "^family\\.[a-f0-9-]{16,}$" }),
});
const DeliverableParams = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  deliverableId: Type.String({ pattern: "^deliverable\\.[a-f0-9-]{16,}$" }),
});

export function createArrangementFamilyGetRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const params = Value.Decode(FamilyParams, request.params);
      response.json({
        ok: true,
        data: store.getArrangementFamily(params.workspaceId, params.familyId),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createDeliverableGetRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const params = Value.Decode(DeliverableParams, request.params);
      response.json({
        ok: true,
        data: store.getDeliverable(params.workspaceId, params.deliverableId),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createDeliverableContentRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const params = Value.Decode(DeliverableParams, request.params);
      const deliverable = store.getDeliverable(params.workspaceId, params.deliverableId);
      const content = store.readDeliverableContent(params.workspaceId, params.deliverableId);
      validateDeliverableForServing(deliverable, content);
      setDeliverableResponseHeaders(response, deliverable);
      response.send(content);
    } catch (error) {
      next(error);
    }
  };
}
