import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { referenceSourceDigest } from "../../lib/reference-source-domain.js";
import type { KnowledgeResolutionRef } from "../../lib/knowledge-resolution-contract.js";
import { KnowledgePublicationConflictError } from "./knowledge-publication-store.js";
import {
  KnowledgeResolutionIntegrityError,
  KnowledgeResolutionService,
  KnowledgeResolutionUnavailableError,
} from "./knowledge-resolution-service.js";

const RefSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" }),
    digest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  },
  { additionalProperties: false }
);
const HeadSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    digest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    revision: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false }
);
const RequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    mode: Type.Union([
      Type.Literal("ordinary_default"),
      Type.Literal("provisional_research"),
      Type.Literal("isolated_evaluation"),
    ]),
    expectedHead: Type.Optional(HeadSchema),
    context: Type.Optional(
      Type.Object(
        {
          passageRef: RefSchema,
          sourceContextRefs: Type.Array(RefSchema, { maxItems: 64 }),
          analysisRef: RefSchema,
          arrangementPlanRef: RefSchema,
          arrangementBriefRef: RefSchema,
          performanceBriefRef: RefSchema,
          preservationPolicyRef: RefSchema,
          instrumentInstanceRef: RefSchema,
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);

export function createKnowledgeResolutionRoute(
  service: KnowledgeResolutionService
): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  return (request, response) => {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    try {
      const body =
        request.method === "GET"
          ? { schemaVersion: 1 as const, mode: "ordinary_default" as const }
          : Value.Decode(RequestSchema, request.body);
      const base = resolutionRequest(body.mode, body.context);
      const projection = body.expectedHead
        ? service.resolve({ ...base, expectedHead: body.expectedHead }).projection
        : service.preview(base);
      response.status(200).json({ ok: true, data: projection });
    } catch (error) {
      if (error instanceof KnowledgePublicationConflictError) {
        response.status(409).json({ ok: false, error: "publication_head_changed" });
        return;
      }
      if (error instanceof KnowledgeResolutionUnavailableError) {
        response.status(409).json({ ok: false, error: "knowledge_resolution_unavailable" });
        return;
      }
      if (error instanceof KnowledgeResolutionIntegrityError || error instanceof TypeError) {
        response.status(422).json({ ok: false, error: "knowledge_resolution_integrity_failed" });
        return;
      }
      throw error;
    }
  };
}

function resolutionRequest(
  mode: "ordinary_default" | "provisional_research" | "isolated_evaluation",
  supplied?: {
    passageRef: KnowledgeResolutionRef;
    sourceContextRefs: KnowledgeResolutionRef[];
    analysisRef: KnowledgeResolutionRef;
    arrangementPlanRef: KnowledgeResolutionRef;
    arrangementBriefRef: KnowledgeResolutionRef;
    performanceBriefRef: KnowledgeResolutionRef;
    preservationPolicyRef: KnowledgeResolutionRef;
    instrumentInstanceRef: KnowledgeResolutionRef;
  }
) {
  const context = supplied ?? defaultContextRefs();
  return {
    mode,
    sourceProfile: mode === "ordinary_default" ? null : ("mace-musicks-monument-1676" as const),
    instrumentFamily: mode === "ordinary_default" ? null : ("baroque_lute" as const),
    notationSystem: mode === "ordinary_default" ? null : ("french_tablature" as const),
    sourceCourseCount: mode === "ordinary_default" ? null : (12 as const),
    historicalSignState: mode === "ordinary_default" ? null : ("unresolved" as const),
    ...context,
  };
}

export function defaultKnowledgeResolutionRequest() {
  return resolutionRequest("ordinary_default", defaultContextRefs());
}

function defaultContextRefs() {
  return {
    passageRef: fixedRef("passage.guided-start.unbound"),
    sourceContextRefs: [],
    analysisRef: fixedRef("analysis.guided-start.unbound"),
    arrangementPlanRef: fixedRef("arrangement-plan.guided-start.unbound"),
    arrangementBriefRef: fixedRef("arrangement-brief.guided-start.unbound"),
    performanceBriefRef: fixedRef("performance-brief.guided-start.unbound"),
    preservationPolicyRef: fixedRef("preservation-policy.guided-start.default"),
    instrumentInstanceRef: fixedRef("instrument-instance.guided-start.unbound"),
  };
}

function fixedRef(id: string): KnowledgeResolutionRef {
  return { id, digest: referenceSourceDigest({ id, t14: "guided-start-context" }) };
}
