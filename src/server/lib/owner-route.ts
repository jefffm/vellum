import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { KnowledgeScopeSchema } from "../../lib/owner-domain.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { OwnerStore } from "./owner-store.js";
import {
  listQuarantinedBuiltInKnowledgePacks,
  loadBuiltInKnowledgePacks,
} from "./knowledge-pack-loader.js";

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
      quarantinedBuiltInKnowledgePacks: listQuarantinedBuiltInKnowledgePacks(),
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

export function createOwnerReferenceRoute(
  store = new OwnerStore(),
  options: { maxBytes?: number } = {}
): RequestHandler {
  const maxBytes = options.maxBytes ?? 128 * 1024 * 1024;
  const Body = Type.Object({
    title: Type.String({ minLength: 1 }),
    citation: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    contentBase64: Type.String({ minLength: 1 }),
  });
  const legacyJsonRoute = createApiRoute<any, unknown>({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.addReference(input),
  });
  return (request, response, next) => {
    if (request.is("application/json")) {
      legacyJsonRoute(request, response, next);
      return;
    }
    void (async () => {
      let spoolDirectory: string | undefined;
      try {
        const title = decodeReferenceHeader(request.header("X-Reference-Title"), "title");
        const citation = decodeReferenceHeader(request.header("X-Reference-Citation"), "citation");
        const declaredLength = Number(request.header("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          throw new ApiRouteError(
            `Owner Reference upload exceeds byte limit ${maxBytes}`,
            413,
            "request_too_large",
            { limitBytes: maxBytes }
          );
        }
        spoolDirectory = await mkdtemp(path.join(tmpdir(), "vellum-owner-reference-"));
        const spoolPath = path.join(spoolDirectory, "reference.upload");
        const hash = createHash("sha256");
        let byteLength = 0;
        const meter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            byteLength += chunk.byteLength;
            if (byteLength > maxBytes) {
              callback(
                new ApiRouteError(
                  `Owner Reference upload exceeds byte limit ${maxBytes}`,
                  413,
                  "request_too_large",
                  { limitBytes: maxBytes }
                )
              );
              return;
            }
            hash.update(chunk);
            callback(null, chunk);
          },
        });
        await pipeline(request, meter, createWriteStream(spoolPath, { mode: 0o600 }));
        const reference = store.addReferenceFromSpool({
          title,
          citation,
          mimeType: request.header("Content-Type")?.split(";", 1)[0] ?? "application/octet-stream",
          spoolPath,
          sha256: hash.digest("hex"),
          byteLength,
        });
        response.status(200).json({ ok: true, data: reference });
      } catch (error) {
        next(error);
      } finally {
        if (spoolDirectory) await rm(spoolDirectory, { recursive: true, force: true });
      }
    })();
  };
}

function decodeReferenceHeader(value: string | undefined, field: string): string {
  if (!value) throw new ApiRouteError(`X-Reference-${field} is required`, 400);
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded) throw new Error("empty");
    return decoded;
  } catch {
    throw new ApiRouteError(`X-Reference-${field} is not valid URI-encoded text`, 400);
  }
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
