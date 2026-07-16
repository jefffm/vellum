import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { KnowledgePublicationGenerationRefSchema } from "./knowledge-publication-store.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import {
  OwnerReferenceMigrationConflictError,
  OwnerReferenceMigrationIntegrityError,
  OwnerReferenceMigrationNotFoundError,
  OwnerReferenceMigrationRecoveryRequiredError,
  OwnerReferenceMigrationService,
} from "./owner-reference-migration-service.js";

const Strict = { additionalProperties: false } as const;
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const SafeIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const ExpectedHeadSchema = Type.Union([KnowledgePublicationGenerationRefSchema, Type.Null()]);
const DryRunSchema = Type.Object({ expectedHead: ExpectedHeadSchema }, Strict);
const CommitSchema = Type.Object(
  { expectedHead: ExpectedHeadSchema, planDigest: DigestSchema },
  Strict
);
const RollbackSchema = Type.Object(
  {
    batchId: SafeIdSchema,
    expectedHead: KnowledgePublicationGenerationRefSchema,
  },
  Strict
);
const InterruptedRollbackSchema = Type.Object(
  {
    planDigest: DigestSchema,
    expectedHead: ExpectedHeadSchema,
  },
  Strict
);

/** Redacted compatibility view; exact private audit is intentionally not routed. */
export function createOwnerReferenceMigrationCompatibilityRoute(
  service: OwnerReferenceMigrationService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute({
    validate: () => undefined,
    handler: async () => translateMigrationErrors(() => service.readCompatibility()),
  });
}

export function createOwnerReferenceMigrationDryRunRoute(
  service: OwnerReferenceMigrationService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute({
    validate: (body) => Value.Decode(DryRunSchema, body),
    handler: async (input) => translateMigrationErrors(() => service.dryRun(input)),
  });
}

export function createOwnerReferenceMigrationCommitRoute(
  service: OwnerReferenceMigrationService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute({
    validate: (body) => Value.Decode(CommitSchema, body),
    handler: async (input) => translateMigrationErrors(() => service.commit(input)),
  });
}

export function createOwnerReferenceMigrationRollbackRoute(
  service: OwnerReferenceMigrationService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute({
    validate: (body) => Value.Decode(RollbackSchema, body),
    handler: async (input) => translateMigrationErrors(() => service.rollback(input)),
  });
}

export function createOwnerReferenceMigrationInterruptedRollbackRoute(
  service: OwnerReferenceMigrationService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute({
    validate: (body) => Value.Decode(InterruptedRollbackSchema, body),
    handler: async (input) => translateMigrationErrors(() => service.rollbackInterrupted(input)),
  });
}

function translateMigrationErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof OwnerReferenceMigrationConflictError) {
      throw new ApiRouteError(error.message, 409, "conflict");
    }
    if (error instanceof OwnerReferenceMigrationNotFoundError) {
      throw new ApiRouteError(error.message, 404, "not_found");
    }
    if (
      error instanceof OwnerReferenceMigrationIntegrityError ||
      error instanceof OwnerReferenceMigrationRecoveryRequiredError
    ) {
      throw new ApiRouteError(error.message, 422, "unprocessable_content");
    }
    throw error;
  }
}
