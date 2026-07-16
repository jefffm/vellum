import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { ApiRouteError, createApiRoute } from "./create-route.js";
import {
  KnowledgePublicationConflictError,
  KnowledgePublicationIntegrityError,
  KnowledgePublicationNotFoundError,
  KnowledgePublicationRecoveryRequiredError,
  KnowledgePublicationStore,
  KnowledgePublicationTransactionSchema,
  type KnowledgePublicationSnapshot,
} from "./knowledge-publication-store.js";
import type { OwnerReferenceWorkbenchOpaqueProjector } from "./owner-reference-workbench-service.js";

const Strict = { additionalProperties: false } as const;
const SafeIdSchema = Type.String({
  minLength: 1,
  maxLength: 256,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
});
const GenerationParamsSchema = Type.Object({ generationId: SafeIdSchema }, Strict);

export function createKnowledgePublicationCurrentRoute(
  store: KnowledgePublicationStore,
  opaqueProjector: Pick<OwnerReferenceWorkbenchOpaqueProjector, "project">
): RequestHandler {
  return createApiRoute({
    validate: () => undefined,
    handler: async () =>
      translateKnowledgePublicationErrors(() => ({
        current: publicationSnapshotView(store.readCurrent()),
        orphans: store.listOrphans().map((orphan) => ({
          ...orphan,
          displayRef: opaqueProjector.project("publication-orphan", {
            generationId: orphan.generationId,
          }),
        })),
      })),
  });
}

export function createKnowledgePublicationGenerationRoute(
  store = new KnowledgePublicationStore()
): RequestHandler {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(GenerationParamsSchema, request.params),
    handler: async ({ generationId }) =>
      translateKnowledgePublicationErrors(() =>
        publicationSnapshotView(store.readGeneration(generationId))
      ),
  });
}

export function createKnowledgePublicationPublishRoute(
  publisher: Pick<KnowledgePublicationStore, "publish">
): RequestHandler {
  return createApiRoute({
    validate: (body) => Value.Decode(KnowledgePublicationTransactionSchema, body),
    handler: async (transaction) =>
      translateKnowledgePublicationErrors(() => {
        const result = publisher.publish(transaction);
        return { ...publicationSnapshotView(result)!, outcome: result.outcome };
      }),
  });
}

export function createKnowledgePublicationOrphansRoute(
  store = new KnowledgePublicationStore()
): RequestHandler {
  return createApiRoute({
    validate: () => undefined,
    handler: async () => translateKnowledgePublicationErrors(() => store.listOrphans()),
  });
}

export function createKnowledgePublicationOrphanReclaimRoute(
  store = new KnowledgePublicationStore()
): RequestHandler {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(GenerationParamsSchema, request.params),
    handler: async ({ generationId }) =>
      translateKnowledgePublicationErrors(() => store.reclaimOrphan(generationId)),
  });
}

export function translateKnowledgePublicationErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof KnowledgePublicationConflictError) {
      throw new ApiRouteError(error.message, 409, "conflict", {
        currentHead: error.currentHead,
        orphanGenerationId: error.orphanGenerationId,
      });
    }
    if (error instanceof KnowledgePublicationNotFoundError) {
      throw new ApiRouteError(error.message, 404, "not_found");
    }
    if (
      error instanceof KnowledgePublicationIntegrityError ||
      error instanceof KnowledgePublicationRecoveryRequiredError
    ) {
      throw new ApiRouteError(error.message, 422, "unprocessable_content");
    }
    throw error;
  }
}

function publicationSnapshotView(snapshot: KnowledgePublicationSnapshot | null) {
  if (!snapshot) return null;
  return {
    head: snapshot.head,
    generation: snapshot.generation,
    records: snapshot.records.map(({ content: _privateContent, ...record }) => record),
  };
}
