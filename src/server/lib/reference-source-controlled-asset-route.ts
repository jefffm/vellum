import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";

import {
  ReferenceRecordRefSchema,
  type ReferenceRecordRef,
} from "../../lib/reference-source-domain.js";
import { ApiRouteError } from "./create-route.js";
import {
  ReferenceSourceControlledArtifactStoreConflictError,
  ReferenceSourceControlledArtifactStoreIntegrityError,
  ReferenceSourceControlledArtifactStoreNotFoundError,
} from "./reference-source-controlled-artifact-store.js";
import {
  ReferenceSourceControlledAssetIngestionConflictError,
  ReferenceSourceControlledAssetIngestionIntegrityError,
  ReferenceSourceControlledAssetIngestionRecoveryRequiredError,
  ReferenceSourceControlledAssetIngestionService,
} from "./reference-source-controlled-asset-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingNotFoundError,
} from "./reference-source-staging-store.js";

const ACQUISITION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

type IngestionServiceProvider =
  | ReferenceSourceControlledAssetIngestionService
  | (() => ReferenceSourceControlledAssetIngestionService);

/** Raw, bounded owner-local upload route for staging-only reference bytes. */
export function createReferenceSourceControlledAssetUploadRoute(
  service: IngestionServiceProvider,
  options: { maxBytes?: number } = {}
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  return async (request, response, next) => {
    try {
      const declaredLength = Number(request.header("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw tooLarge(maxBytes);
      }
      const acquisitionKey = requiredAcquisitionKey(request.header("X-Reference-Acquisition-Key"));
      const declaredMediaType = requiredMediaType(request.header("Content-Type"));
      const expectedHeadRef = expectedHeadFromHeaders({
        id: request.header("X-Reference-Expected-Head-Id"),
        digest: request.header("X-Reference-Expected-Head-Digest"),
      });
      const chunks: Buffer[] = [];
      let byteLength = 0;
      for await (const value of request) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        byteLength += chunk.byteLength;
        if (byteLength > maxBytes) throw tooLarge(maxBytes);
        chunks.push(chunk);
      }
      const result = await resolveService(service).ingest({
        bytes: Buffer.concat(chunks, byteLength),
        declaredMediaType,
        acquisitionKey,
        ...(expectedHeadRef ? { expectedHeadRef } : {}),
      });
      response.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(referenceSourceControlledAssetApiError(error));
    }
  };
}

function resolveService(
  provider: IngestionServiceProvider
): ReferenceSourceControlledAssetIngestionService {
  return typeof provider === "function" ? provider() : provider;
}

function requiredAcquisitionKey(value: string | undefined): string {
  if (!value || !ACQUISITION_KEY_PATTERN.test(value)) {
    throw new ApiRouteError(
      "X-Reference-Acquisition-Key is required and must be an opaque URL-safe retry key",
      400,
      "invalid_request"
    );
  }
  return value;
}

function requiredMediaType(value: string | undefined): string {
  const mediaType = value?.split(";", 1)[0]?.trim();
  if (!mediaType) {
    throw new ApiRouteError("Content-Type is required for reference source uploads", 400);
  }
  return mediaType;
}

function expectedHeadFromHeaders(input: {
  id: string | undefined;
  digest: string | undefined;
}): ReferenceRecordRef | undefined {
  if (input.id === undefined && input.digest === undefined) return undefined;
  if (input.id === undefined || input.digest === undefined) {
    throw new ApiRouteError(
      "Expected staging head ID and digest headers must be supplied together",
      400,
      "invalid_request"
    );
  }
  try {
    return Value.Decode(ReferenceRecordRefSchema, { id: input.id, digest: input.digest });
  } catch {
    throw new ApiRouteError("Expected staging head headers are invalid", 400, "invalid_request");
  }
}

function tooLarge(maxBytes: number): ApiRouteError {
  return new ApiRouteError(
    `Reference source upload exceeds byte limit ${maxBytes}`,
    413,
    "request_too_large",
    { limitBytes: maxBytes }
  );
}

function referenceSourceControlledAssetApiError(error: unknown): unknown {
  if (error instanceof ApiRouteError) return error;
  if (error instanceof ReferenceSourceStagingConflictError) {
    return new ApiRouteError(error.message, 409, "conflict", {
      currentHead: error.currentHead,
    });
  }
  if (
    error instanceof ReferenceSourceControlledAssetIngestionConflictError ||
    error instanceof ReferenceSourceControlledArtifactStoreConflictError
  ) {
    return new ApiRouteError(error.message, 409, "conflict");
  }
  if (error instanceof ReferenceSourceStagingNotFoundError) {
    return new ApiRouteError(error.message, 404, "not_found");
  }
  if (
    error instanceof ReferenceSourceControlledAssetIngestionIntegrityError ||
    error instanceof ReferenceSourceControlledAssetIngestionRecoveryRequiredError ||
    error instanceof ReferenceSourceControlledArtifactStoreIntegrityError ||
    error instanceof ReferenceSourceControlledArtifactStoreNotFoundError ||
    error instanceof ReferenceSourceStagingIntegrityError
  ) {
    return new ApiRouteError(error.message, 422, "unprocessable_content");
  }
  return error;
}
