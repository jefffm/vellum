import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  ReferenceSourceOperationGateway,
  ReferenceSourceOperationRequestSchema,
  type ReferenceSourceOperationEffects,
  type ReferenceSourceOperationRequest,
  type ReferenceSourceOperationResult,
} from "./reference-source-operation-gateway.js";
import {
  ReferenceSourceCompilerInputRequestSchema,
  type ReferenceSourceCompilerInputRequest,
  ReferenceSourceProtectedOperationAdapter,
} from "./reference-source-protected-operation-adapter.js";
import type { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";
import { createApiRoute } from "./create-route.js";

const SEALED_DEFAULT_EFFECTS: ReferenceSourceOperationEffects = Object.freeze({
  readControlledBytes: () => {
    throw new ReferenceSourceOperationBoundaryBreachError();
  },
  writeSink: () => {
    throw new ReferenceSourceOperationBoundaryBreachError();
  },
});

/**
 * Production-facing evaluation of the current owner-private default.
 *
 * This route deliberately constructs a gateway without an allow-capability
 * verifier. It can therefore return only deny or review_required and cannot
 * read controlled bytes or invoke a derivative sink. A later authorized
 * operation tracer must add a separate server-authenticated execution path;
 * client input cannot turn this decision endpoint into one.
 */
export function createReferenceSourceOperationDefaultDecisionRoute(
  stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  const gateway = new ReferenceSourceOperationGateway({ stagingStore });
  return createApiRoute<ReferenceSourceOperationRequest, ReferenceSourceOperationResult>({
    validate: (body) => Value.Decode(ReferenceSourceOperationRequestSchema, body),
    handler: async (request) => gateway.execute(request, SEALED_DEFAULT_EFFECTS),
  });
}

/**
 * Production execution boundary for an operation over an Owner Reference.
 *
 * The request can select only the closed operation scope. The adapter, byte
 * reader, sink registry, and any future authority resolver are all constructed
 * by the server; none can be supplied or widened by this HTTP request.
 */
export function createReferenceSourceProtectedOperationRoute(
  adapter: Pick<ReferenceSourceProtectedOperationAdapter, "execute">
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute<ReferenceSourceOperationRequest, ReferenceSourceOperationResult>({
    validate: (body) => Value.Decode(ReferenceSourceOperationRequestSchema, body),
    handler: async (request) => adapter.execute(request),
  });
}

/**
 * Fixed-scope direct-compiler proposal boundary. It cannot name a provider,
 * sink, destination, effects object, or capability. Owner-private defaults
 * therefore stop the proposal before controlled bytes reach any compiler.
 */
export function createReferenceSourceCompilerInputRoute(
  adapter: Pick<ReferenceSourceProtectedOperationAdapter, "executeCompilerInput">
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute<ReferenceSourceCompilerInputRequest, ReferenceSourceOperationResult>({
    validate: (body) => Value.Decode(ReferenceSourceCompilerInputRequestSchema, body),
    handler: async (request) => adapter.executeCompilerInput(request),
  });
}

class ReferenceSourceOperationBoundaryBreachError extends Error {
  constructor() {
    super("reference_source_operation_default_decision_effect_invoked");
    this.name = "ReferenceSourceOperationBoundaryBreachError";
  }
}
