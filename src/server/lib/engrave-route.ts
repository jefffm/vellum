import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  EngraveParamsSchema,
  type EngraveParams,
  type EngraveResult,
} from "../../lib/engrave-schema.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { EngraveValidationError, engrave } from "./engrave.js";

export function createEngraveRoute(): RequestHandler {
  return createApiRoute<EngraveParams, EngraveResult>({
    validate: (body) => Value.Decode(EngraveParamsSchema, body),
    handler: async (params) => {
      try {
        return engrave(params);
      } catch (error) {
        if (isClientEngraveError(error)) {
          throw new ApiRouteError((error as Error).message, 400);
        }

        throw error;
      }
    },
  });
}

function isClientEngraveError(error: unknown): error is Error {
  if (error instanceof EngraveValidationError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("Unknown instrument") || error.message.startsWith("Unknown template")
  );
}
