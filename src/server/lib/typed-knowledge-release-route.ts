import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  TypedKnowledgeReleaseOperationRequestSchema,
  TypedKnowledgeReleaseProjectionSchema,
  type TypedKnowledgeReleaseOperationRequest,
  type TypedKnowledgeReleaseProjection,
} from "../../lib/typed-knowledge-release-contract.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";

type TypedKnowledgeReleaseOperator = Readonly<{
  executeTypedKnowledgeRelease: (
    request: TypedKnowledgeReleaseOperationRequest,
    signal?: AbortSignal
  ) => TypedKnowledgeReleaseProjection | Promise<TypedKnowledgeReleaseProjection>;
}>;

/** Closed preview/publish boundary; raw pack content and authority input are impossible here. */
export function createTypedKnowledgeReleaseRoute(
  operator: TypedKnowledgeReleaseOperator
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  return createApiRoute<TypedKnowledgeReleaseOperationRequest, TypedKnowledgeReleaseProjection>({
    validate: (body) => Value.Decode(TypedKnowledgeReleaseOperationRequestSchema, body),
    handler: async (request, httpRequest, response) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      const abortOnPrematureClose = () => {
        if (!response.writableEnded) abort();
      };
      if (httpRequest.aborted || response.destroyed) abort();
      httpRequest.once("aborted", abort);
      response.once("close", abortOnPrematureClose);
      try {
        if (controller.signal.aborted) {
          throw new ApiRouteError(
            "The typed release request was cancelled before publication",
            409,
            "cancelled"
          );
        }
        const projection = Value.Decode(
          TypedKnowledgeReleaseProjectionSchema,
          await translateTypedReleaseErrors(
            () => operator.executeTypedKnowledgeRelease(request, controller.signal),
            controller.signal
          )
        );
        assertProjectionOutcome(request, projection);
        return projection;
      } finally {
        httpRequest.off("aborted", abort);
        response.off("close", abortOnPrematureClose);
      }
    },
  });
}

async function translateTypedReleaseErrors<T>(
  operation: () => T | Promise<T>,
  signal: AbortSignal
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (signal.aborted) {
      throw new ApiRouteError(
        "The typed knowledge release operation was cancelled before publication",
        409,
        "cancelled",
        { reason: "typed_knowledge_release_cancelled" }
      );
    }
    throw typedReleaseApiError(error);
  }
}

function typedReleaseApiError(error: unknown): ApiRouteError {
  const code = stableErrorCode(error);
  switch (code) {
    case "typed_knowledge_release_stale":
      return new ApiRouteError(
        "Refresh the exact Page Atlas candidate before previewing or publishing",
        409,
        "conflict",
        { reason: code }
      );
    case "typed_knowledge_release_pack_citation_authority_required":
      return new ApiRouteError(
        "Separate pack-citation authority is required before publication",
        403,
        "forbidden",
        { reason: code }
      );
    case "typed_knowledge_release_conflict":
      return new ApiRouteError(
        "Refresh the exact publication head before retrying",
        409,
        "conflict",
        { reason: code }
      );
    case "typed_knowledge_release_cancelled":
      return new ApiRouteError(
        "The typed knowledge release operation was cancelled before publication",
        409,
        "cancelled",
        { reason: code }
      );
    case "typed_knowledge_release_unavailable":
    case "typed_knowledge_release_integrity":
      return new ApiRouteError(
        "The typed knowledge release service is safely unavailable",
        503,
        "service_unavailable",
        { reason: code }
      );
    default:
      return new ApiRouteError("The typed knowledge release operation failed safely", 500);
  }
}

function assertProjectionOutcome(
  request: TypedKnowledgeReleaseOperationRequest,
  projection: TypedKnowledgeReleaseProjection
): void {
  if (
    (request.action === "preview" &&
      projection.publicationOutcome !== "preview_candidate" &&
      projection.publicationOutcome !== "preview_existing") ||
    (request.action === "publish" &&
      projection.publicationOutcome !== "publish_committed" &&
      projection.publicationOutcome !== "publish_idempotent")
  ) {
    throw new Error("Typed release projection outcome does not match its operation");
  }
}

function stableErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}
