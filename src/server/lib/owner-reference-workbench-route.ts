import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  OwnerReferenceWorkbenchLocalOperationReviewRequestSchema,
  OwnerReferenceWorkbenchLocalOperationReviewResultSchema,
  OwnerReferenceWorkbenchLocalStudyConflictDetailsSchema,
  OwnerReferenceWorkbenchLocalStudyRequestSchema,
  OwnerReferenceWorkbenchSnapshotSchema,
  OwnerReferenceWorkbenchUploadConfirmationRequestSchema,
  OwnerReferenceWorkbenchUploadConfirmationResultSchema,
  type OwnerReferenceWorkbenchLocalOperationReviewRequest,
  type OwnerReferenceWorkbenchLocalOperationReviewResult,
  type OwnerReferenceWorkbenchLocalStudyRequest,
  type OwnerReferenceWorkbenchUploadConfirmationRequest,
  type OwnerReferenceWorkbenchUploadConfirmationResult,
} from "../../lib/owner-reference-workbench-contract.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import {
  OwnerReferenceWorkbenchIntegrityError,
  type OwnerReferenceWorkbenchService,
} from "./owner-reference-workbench-service.js";
import {
  OwnerReferenceLocalStudyConflictError,
  OwnerReferenceLocalStudyStaleError,
  OwnerReferenceLocalStudyUnavailableError,
  OwnerReferenceLocalStudyUnsupportedMediaError,
  type OwnerReferenceLocalStudySink,
} from "./owner-reference-local-study-service.js";

type OwnerReferenceWorkbenchReader = Pick<OwnerReferenceWorkbenchService, "read">;
type OwnerReferenceWorkbenchOperationReviewer = Pick<
  OwnerReferenceWorkbenchService,
  "reviewLocalOperation"
>;
type OwnerReferenceWorkbenchUploadConfirmer = Pick<OwnerReferenceWorkbenchService, "confirmUpload">;
type OwnerReferenceWorkbenchLocalStudyExecutor = Pick<
  OwnerReferenceWorkbenchService,
  "executeLocalStudy"
>;

/**
 * Closed-schema read handler for the Owner-reference Workbench snapshot.
 *
 * Mount this handler with `router.get`. It intentionally has no mutation
 * method and does not expose either underlying service independently.
 */
export function createOwnerReferenceWorkbenchReadRoute(
  service: OwnerReferenceWorkbenchReader
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute({
    validate: () => undefined,
    handler: async () =>
      translateOwnerReferenceWorkbenchErrors(() =>
        Value.Decode(OwnerReferenceWorkbenchSnapshotSchema, service.read())
      ),
  });
}

/** Prove that one retry key resolves to a healthy redacted Workbench card. */
export function createOwnerReferenceWorkbenchUploadConfirmationRoute(
  service: OwnerReferenceWorkbenchUploadConfirmer
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute<
    OwnerReferenceWorkbenchUploadConfirmationRequest,
    OwnerReferenceWorkbenchUploadConfirmationResult
  >({
    validate: (body) => Value.Decode(OwnerReferenceWorkbenchUploadConfirmationRequestSchema, body),
    handler: async (request) =>
      translateOwnerReferenceWorkbenchErrors(() =>
        Value.Decode(
          OwnerReferenceWorkbenchUploadConfirmationResultSchema,
          service.confirmUpload(request)
        )
      ),
  });
}

/** Closed-schema, local-only operation review that can never execute effects. */
export function createOwnerReferenceWorkbenchLocalOperationReviewRoute(
  service: OwnerReferenceWorkbenchOperationReviewer
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute<
    OwnerReferenceWorkbenchLocalOperationReviewRequest,
    OwnerReferenceWorkbenchLocalOperationReviewResult
  >({
    validate: (body) =>
      Value.Decode(OwnerReferenceWorkbenchLocalOperationReviewRequestSchema, body),
    handler: async (request) =>
      translateOwnerReferenceWorkbenchAsyncErrors(async () =>
        Value.Decode(
          OwnerReferenceWorkbenchLocalOperationReviewResultSchema,
          await service.reviewLocalOperation(request)
        )
      ),
  });
}

/**
 * Stream only the exact authorized PDF/image bytes. Unlike JSON API routes,
 * this response deliberately has no envelope, identity header, filename,
 * digest, ETag, or operation-key echo.
 */
export function createOwnerReferenceWorkbenchLocalStudyRoute(
  service: OwnerReferenceWorkbenchLocalStudyExecutor
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return (request, response, next) => {
    void (async () => {
      let decoded: OwnerReferenceWorkbenchLocalStudyRequest;
      try {
        decoded = Value.Decode(OwnerReferenceWorkbenchLocalStudyRequestSchema, request.body);
      } catch {
        throw new ApiRouteError(
          "Invalid Owner-private local-study request",
          400,
          "invalid_request"
        );
      }

      let responseWritten = false;
      const sink: OwnerReferenceLocalStudySink = ({ bytes, mediaType }) => {
        if (responseWritten || response.headersSent) {
          throw new OwnerReferenceLocalStudyUnavailableError();
        }
        responseWritten = true;
        response.statusCode = 200;
        response.setHeader("Content-Type", mediaType);
        response.setHeader("Content-Length", String(bytes.byteLength));
        response.setHeader("Content-Disposition", "inline");
        response.setHeader("Cache-Control", "private, no-store, max-age=0");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.removeHeader("ETag");
        response.end(Buffer.from(bytes));
      };

      await service.executeLocalStudy(decoded, sink);
      if (!responseWritten || !response.writableEnded) {
        throw new OwnerReferenceLocalStudyUnavailableError();
      }
    })().catch((error: unknown) => next(localStudyApiError(error)));
  };
}

function localStudyApiError(error: unknown): ApiRouteError {
  if (error instanceof ApiRouteError) return error;
  if (error instanceof OwnerReferenceLocalStudyConflictError) {
    return new ApiRouteError(
      "The local-study operation key is already bound to another exact request",
      409,
      "conflict",
      Value.Decode(OwnerReferenceWorkbenchLocalStudyConflictDetailsSchema, {
        reason: "operation_key_bound_to_different_scope",
        retrySafety: "reuse_exact_request",
      })
    );
  }
  if (error instanceof OwnerReferenceLocalStudyStaleError) {
    return new ApiRouteError(
      "Refresh the Owner-reference Workbench before authorizing local study",
      409,
      "conflict",
      Value.Decode(OwnerReferenceWorkbenchLocalStudyConflictDetailsSchema, {
        reason: "workbench_snapshot_stale_before_commit",
        retrySafety: "refresh_and_rebind_same_operation_key",
      })
    );
  }
  if (error instanceof OwnerReferenceLocalStudyUnsupportedMediaError) {
    return new ApiRouteError(
      "The selected reference is not a supported local-study document or image",
      422,
      "unprocessable_content"
    );
  }
  if (
    error instanceof OwnerReferenceLocalStudyUnavailableError ||
    error instanceof OwnerReferenceWorkbenchIntegrityError
  ) {
    return new ApiRouteError(
      "The Owner-private local-study view is unavailable",
      422,
      "unprocessable_content"
    );
  }
  return new ApiRouteError("Owner-private local study failed safely", 500, "internal_error");
}

function translateOwnerReferenceWorkbenchErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof OwnerReferenceWorkbenchIntegrityError) {
      throw new ApiRouteError(
        "The Owner-reference Workbench snapshot is internally inconsistent",
        422,
        "unprocessable_content"
      );
    }
    throw error;
  }
}

async function translateOwnerReferenceWorkbenchAsyncErrors<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OwnerReferenceWorkbenchIntegrityError) {
      throw new ApiRouteError(
        "The Owner-reference Workbench snapshot is internally inconsistent",
        422,
        "unprocessable_content"
      );
    }
    throw error;
  }
}
