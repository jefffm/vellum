import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  ReferencePageAtlasOperationRequestSchema,
  ReferencePageAtlasPreviewRequestSchema,
  ReferencePageAtlasProjectionSchema,
  type ReferencePageAtlasOperationRequest,
  type ReferencePageAtlasPreviewRequest,
  type ReferencePageAtlasProjection,
} from "../../lib/reference-page-atlas-contract.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import {
  OwnerReferencePageAtlasLineageLimitError,
  type OwnerReferencePageAtlasPreview,
} from "./owner-reference-page-atlas-service.js";
import type { OwnerReferenceWorkbenchService } from "./owner-reference-workbench-service.js";

type PageAtlasOperator = Pick<OwnerReferenceWorkbenchService, "executePageAtlas">;
type PageAtlasPreviewer = Pick<OwnerReferenceWorkbenchService, "previewPageAtlas">;

/** Closed JSON operation boundary; source bytes and raw graph refs never cross it. */
export function createOwnerReferencePageAtlasOperationRoute(
  service: PageAtlasOperator
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return createApiRoute<ReferencePageAtlasOperationRequest, ReferencePageAtlasProjection>({
    validate: (body) => Value.Decode(ReferencePageAtlasOperationRequestSchema, body),
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
        return await translatePageAtlasErrors(async () =>
          Value.Decode(
            ReferencePageAtlasProjectionSchema,
            await service.executePageAtlas(request, controller.signal)
          )
        );
      } finally {
        httpRequest.off("aborted", abort);
        response.off("close", abortOnPrematureClose);
      }
    },
  });
}

/**
 * Stream one ephemeral local PNG. The response has no filename, source label,
 * digest, parser diagnostic, retry key, ETag, or JSON envelope.
 */
export function createOwnerReferencePageAtlasPreviewRoute(
  service: PageAtlasPreviewer
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  return (request, response, next) => {
    void (async () => {
      let decoded: ReferencePageAtlasPreviewRequest;
      try {
        decoded = Value.Decode(ReferencePageAtlasPreviewRequestSchema, request.body);
      } catch {
        throw new ApiRouteError("Invalid Page Atlas preview request", 400, "invalid_request");
      }
      const preview = await translatePageAtlasErrors(() => service.previewPageAtlas(decoded));
      writePrivatePng(response, preview);
    })().catch((error: unknown) => next(pageAtlasApiError(error)));
  };
}

function writePrivatePng(
  response: Parameters<RequestHandler>[1],
  preview: OwnerReferencePageAtlasPreview
): void {
  const bytes = Buffer.from(preview.bytes);
  if (
    preview.mediaType !== "image/png" ||
    bytes.byteLength < 1 ||
    preview.widthPixels < 1 ||
    preview.heightPixels < 1
  ) {
    throw new ApiRouteError("Page Atlas preview is unavailable", 422, "unprocessable_content");
  }
  response.statusCode = 200;
  response.setHeader("Content-Type", "image/png");
  response.setHeader("Content-Length", String(bytes.byteLength));
  response.setHeader("Content-Disposition", "inline");
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.removeHeader("ETag");
  response.end(bytes);
}

async function translatePageAtlasErrors<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw pageAtlasApiError(error);
  }
}

function pageAtlasApiError(error: unknown): ApiRouteError {
  if (error instanceof ApiRouteError) return error;
  if (error instanceof OwnerReferencePageAtlasLineageLimitError) {
    return new ApiRouteError(
      "The Page Atlas correction history reached its bounded review limit. The existing lineage remains readable and unchanged; review it or begin a new Page Atlas operation.",
      409,
      "conflict"
    );
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code.includes("stale") || code.includes("conflict")) {
    return new ApiRouteError(
      "Refresh the exact Page Atlas operation before retrying",
      409,
      "conflict"
    );
  }
  if (
    code.includes("unavailable") ||
    code.includes("mapping") ||
    code.includes("parser") ||
    code.includes("unsupported")
  ) {
    return new ApiRouteError(
      "The local Page Atlas operation is unavailable",
      422,
      "unprocessable_content"
    );
  }
  return new ApiRouteError("The local Page Atlas operation failed safely", 500, "internal_error");
}
