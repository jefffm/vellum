import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  EngraveParamsSchema,
  type EngraveParams,
  type EngraveResult,
} from "../../lib/engrave-schema.js";
import { createApiRoute } from "./create-route.js";
import { engrave } from "./engrave.js";

export function createEngraveRoute(): RequestHandler {
  return createApiRoute<EngraveParams, EngraveResult>({
    validate: (body) => Value.Decode(EngraveParamsSchema, body),
    handler: async (params) => engrave(params),
  });
}
