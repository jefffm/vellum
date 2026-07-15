import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { ReferenceSourceStagingTransactionSchema } from "../../lib/reference-source-domain.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import {
  ReferenceSourceStagingService,
  type ReferenceSourceStagingDiagnostics,
} from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingNotFoundError,
} from "./reference-source-staging-store.js";

const SnapshotParamsSchema = Type.Object(
  {
    snapshotId: Type.String({
      minLength: 1,
      maxLength: 256,
      pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
    }),
  },
  { additionalProperties: false }
);

export function createReferenceSourceStagingReadRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute<undefined, ReferenceSourceStagingDiagnostics>({
    validate: () => undefined,
    handler: async () => translateServiceErrors(() => service.readCurrent()),
  });
}

export function createReferenceSourceStagingSnapshotRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute<{ snapshotId: string }, ReferenceSourceStagingDiagnostics>({
    validate: (_body, request) => Value.Decode(SnapshotParamsSchema, request.params),
    handler: async ({ snapshotId }) =>
      translateServiceErrors(() => service.readSnapshot(snapshotId)),
  });
}

export function createReferenceSourceStagingTransactionRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute({
    validate: (body) => Value.Decode(ReferenceSourceStagingTransactionSchema, body),
    handler: async (transaction) =>
      translateServiceErrors(() => service.applyTransaction(transaction)),
  });
}

function translateServiceErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ReferenceSourceStagingConflictError) {
      throw new ApiRouteError(error.message, 409, "conflict", {
        currentHead: error.currentHead,
      });
    }
    if (error instanceof ReferenceSourceStagingNotFoundError) {
      throw new ApiRouteError(error.message, 404, "not_found");
    }
    if (error instanceof ReferenceSourceStagingIntegrityError) {
      throw new ApiRouteError(error.message, 422, "unprocessable_content");
    }
    throw error;
  }
}
