import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import type { ReferenceSourceLifecyclePlanResult } from "../../lib/reference-source-lifecycle.js";
import {
  ReferenceSourceLifecycleDryRunRequestSchema,
  ReferenceSourceLifecyclePlanningService,
  type ReferenceSourceLifecycleDryRunRequest,
} from "./reference-source-lifecycle-service.js";
import { createApiRoute } from "./create-route.js";
import { translateReferenceSourceStagingErrors } from "./reference-source-staging-route.js";

/** Exposes lifecycle planning only; execution and canonical mutation remain absent. */
export function createReferenceSourceLifecyclePlanRoute(
  service = new ReferenceSourceLifecyclePlanningService()
): RequestHandler {
  return createApiRoute<ReferenceSourceLifecycleDryRunRequest, ReferenceSourceLifecyclePlanResult>({
    validate: (body) => Value.Decode(ReferenceSourceLifecycleDryRunRequestSchema, body),
    handler: async (request) =>
      translateReferenceSourceStagingErrors(() => service.planDryRun(request)),
  });
}
