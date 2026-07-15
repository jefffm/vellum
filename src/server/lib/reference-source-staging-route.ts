import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import {
  ReferenceRecordRefSchema,
  ReferenceSourceStagingTransactionSchema,
} from "../../lib/reference-source-domain.js";
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

const ObservationHistoryMigrationRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    expectedHeadRef: ReferenceRecordRefSchema,
  },
  { additionalProperties: false }
);

export function createReferenceSourceStagingReadRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute<undefined, ReferenceSourceStagingDiagnostics>({
    validate: () => undefined,
    handler: async () => translateReferenceSourceStagingErrors(() => service.readCurrent()),
  });
}

export function createReferenceSourceStagingSnapshotRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute<{ snapshotId: string }, ReferenceSourceStagingDiagnostics>({
    validate: (_body, request) => Value.Decode(SnapshotParamsSchema, request.params),
    handler: async ({ snapshotId }) =>
      translateReferenceSourceStagingErrors(() => service.readSnapshot(snapshotId)),
  });
}

export function createReferenceSourceStagingTransactionRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute({
    validate: (body) => Value.Decode(ReferenceSourceStagingTransactionSchema, body),
    handler: async (transaction) =>
      translateReferenceSourceStagingErrors(() => service.applyTransaction(transaction)),
  });
}

/**
 * Explicit repair for snapshots written before server-minted observation trust.
 *
 * This advances only the staging-only generation. It cannot publish, migrate,
 * canonicalize, or activate source records.
 */
export function createReferenceSourceObservationHistoryMigrationRoute(
  service = new ReferenceSourceStagingService()
): RequestHandler {
  return createApiRoute({
    validate: (body) => Value.Decode(ObservationHistoryMigrationRequestSchema, body),
    handler: async ({ expectedHeadRef }) =>
      translateReferenceSourceStagingErrors(() =>
        service.migrateLegacyObservationHistory(expectedHeadRef)
      ),
  });
}

export function translateReferenceSourceStagingErrors<T>(operation: () => T): T {
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
