import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import type { ReviewerAuthorityService } from "./reviewer-authority-service.js";

export function createReviewerAuthorityWorkbenchRoute(
  service: Pick<ReviewerAuthorityService, "readWorkbench">
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  return createApiRoute({
    validate: () => undefined,
    handler: async () => {
      try {
        return await service.readWorkbench();
      } catch (error) {
        const code = stableErrorCode(error);
        if (code === "reviewer_authority_integrity") {
          throw new ApiRouteError(
            "Reviewer authority records failed closed integrity validation",
            422,
            "unprocessable_content",
            { reason: code }
          );
        }
        if (code === "reviewer_authority_unavailable") {
          throw new ApiRouteError(
            "Reviewer authority verification is unavailable",
            503,
            "service_unavailable",
            { reason: code }
          );
        }
        throw error;
      }
    },
  });
}

function stableErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}
