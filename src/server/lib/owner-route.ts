import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { KnowledgeScopeSchema } from "../../lib/owner-domain.js";
import { createApiRoute } from "./create-route.js";
import { OwnerStore } from "./owner-store.js";
import { loadBuiltInKnowledgePacks } from "./knowledge-pack-loader.js";

const IdParams = Type.Object({ id: Type.String({ minLength: 1 }) });

export function createOwnerStateRoute(store = new OwnerStore()): RequestHandler {
  return createApiRoute<undefined, unknown>({
    validate: () => undefined,
    handler: async () => ({
      personalDefaultCandidates: store.listDefaultCandidates(),
      personalDefaults: store.listDefaults(),
      ownerReferences: store.listReferences(),
      knowledgeCandidates: store.listKnowledgeCandidates(),
      historicalPracticeClaims: store.listClaims(),
      knowledgePacks: store.listPacks(),
      builtInKnowledgePacks: loadBuiltInKnowledgePacks(),
    }),
  });
}

export function createOwnerChoiceRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    workspaceId: Type.String({ minLength: 1 }),
    dimension: Type.String({ minLength: 1 }),
    value: Type.Unknown(),
    scope: Type.Record(Type.String(), Type.String()),
  });
  return createApiRoute<any, unknown>({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.recordChoice(input),
  });
}

export function createDefaultCandidateDecisionRoute(
  decision: "approve" | "reject",
  store = new OwnerStore()
): RequestHandler {
  return createApiRoute<any, unknown>({
    validate: (_body, request) => Value.Decode(IdParams, request.params),
    handler: async ({ id }) =>
      decision === "approve" ? store.approveDefaultCandidate(id) : store.rejectDefaultCandidate(id),
  });
}

export function createDefaultCandidateProposalRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    dimension: Type.String({ minLength: 1 }),
    value: Type.Unknown(),
    scope: Type.Record(Type.String(), Type.String()),
    evidenceChoiceIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  });
  return createApiRoute<any, unknown>({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.proposeDefaultCandidate(input),
  });
}

export function createDefaultCandidateCorrectionRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    dimension: Type.String({ minLength: 1 }),
    value: Type.Unknown(),
    scope: Type.Record(Type.String(), Type.String()),
  });
  return createApiRoute<any, unknown>({
    validate: (body, request) => ({
      ...Value.Decode(IdParams, request.params),
      correction: Value.Decode(Body, body),
    }),
    handler: async ({ id, correction }) => store.reviseDefaultCandidate(id, correction),
  });
}

export function createDefaultReleaseRoute(store = new OwnerStore()): RequestHandler {
  return createApiRoute<any, unknown>({
    validate: (_body, request) => Value.Decode(IdParams, request.params),
    handler: async ({ id }) => store.releaseDefault(id),
  });
}

export function createOwnerReferenceRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    title: Type.String({ minLength: 1 }),
    citation: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    contentBase64: Type.String({ minLength: 1 }),
  });
  return createApiRoute<any, unknown>({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.addReference(input),
  });
}

export function createKnowledgeCandidateRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    statement: Type.String({ minLength: 1 }),
    scope: KnowledgeScopeSchema,
    referenceId: Type.String({ minLength: 1 }),
    citationLocator: Type.String({ minLength: 1 }),
  });
  return createApiRoute<any, unknown>({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.proposeKnowledge(input),
  });
}

export function createKnowledgePromotionRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    candidateId: Type.String({ minLength: 1 }),
    packId: Type.String({ minLength: 1 }),
    packName: Type.String({ minLength: 1 }),
    authority: Type.Union([
      Type.Literal("documented_practice"),
      Type.Literal("modern_editorial_convention"),
      Type.Literal("vellum_heuristic"),
    ]),
  });
  return createApiRoute<any, unknown>({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.promoteKnowledge(input),
  });
}

export function createKnowledgeRejectionRoute(store = new OwnerStore()): RequestHandler {
  return createApiRoute<any, unknown>({
    validate: (_body, request) => Value.Decode(IdParams, request.params),
    handler: async ({ id }) => store.rejectKnowledge(id),
  });
}

export function createKnowledgeCorrectionRoute(store = new OwnerStore()): RequestHandler {
  const Body = Type.Object({
    statement: Type.String({ minLength: 1 }),
    scope: KnowledgeScopeSchema,
    citationLocator: Type.String({ minLength: 1 }),
  });
  return createApiRoute<any, unknown>({
    validate: (body, request) => ({
      ...Value.Decode(IdParams, request.params),
      correction: Value.Decode(Body, body),
    }),
    handler: async ({ id, correction }) => store.reviseKnowledge(id, correction),
  });
}

export function createHistoricalClaimReleaseRoute(store = new OwnerStore()): RequestHandler {
  return createApiRoute<any, unknown>({
    validate: (_body, request) => Value.Decode(IdParams, request.params),
    handler: async ({ id }) => store.releaseClaim(id),
  });
}
