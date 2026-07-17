import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { KnowledgeResolverPreflightSchema } from "../../lib/knowledge-resolver-cutover-contract.js";
import { KnowledgeResolutionGenerationRefSchema } from "../../lib/knowledge-resolution-contract.js";
import { KnowledgePublicationConflictError } from "./knowledge-publication-store.js";
import { defaultKnowledgeResolutionRequest } from "./knowledge-resolution-route.js";
import {
  KnowledgeResolverCutoverIntegrityError,
  type KnowledgeResolverCutoverService,
} from "./knowledge-resolver-cutover-service.js";

const RequestSchema = Type.Union([
  Type.Object(
    { schemaVersion: Type.Literal(1), action: Type.Literal("preflight") },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      action: Type.Literal("cutover"),
      expectedHead: KnowledgeResolutionGenerationRefSchema,
      preflight: KnowledgeResolverPreflightSchema,
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      action: Type.Literal("rollback"),
      expectedHead: KnowledgeResolutionGenerationRefSchema,
    },
    { additionalProperties: false }
  ),
]);

export function createKnowledgeResolverCutoverRoute(
  service: KnowledgeResolverCutoverService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  return (request, response) => {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    try {
      if (request.method === "GET") {
        response.status(200).json({ ok: true, data: { active: service.readActive() } });
        return;
      }
      const body = Value.Decode(RequestSchema, request.body);
      if (body.action === "preflight") {
        response.status(200).json({
          ok: true,
          data: {
            active: service.readActive(),
            preflight: service.preflight(defaultKnowledgeResolutionRequest()),
          },
        });
        return;
      }
      const result =
        body.action === "cutover"
          ? service.cutover({ preflight: body.preflight, expectedHead: body.expectedHead })
          : service.rollback({ expectedHead: body.expectedHead });
      response.status(200).json({ ok: true, data: { active: result.active } });
    } catch (error) {
      if (error instanceof KnowledgePublicationConflictError) {
        response.status(409).json({ ok: false, error: "publication_head_changed" });
        return;
      }
      if (error instanceof KnowledgeResolverCutoverIntegrityError || error instanceof TypeError) {
        response.status(422).json({ ok: false, error: "resolver_cutover_integrity_failed" });
        return;
      }
      throw error;
    }
  };
}
