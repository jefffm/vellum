import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { buildAudioPreview } from "../../lib/audio-preview.js";
import type { ArrangementScore } from "../../lib/music-domain.js";
import { ArrangementService } from "./arrangement-service.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const SearchParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  searchId: Type.String({ pattern: "^search\\.[a-f0-9-]{16,}$" }),
});
const CandidateParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  searchId: Type.String({ pattern: "^search\\.[a-f0-9-]{16,}$" }),
  candidateId: Type.String({ pattern: "^candidate\\.[a-f0-9-]{16,}$" }),
});
const ArrangementParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  arrangementId: Type.String({ pattern: "^arrangement\\.[a-f0-9-]{16,}$" }),
});
const PassageCandidateBodySchema = Type.Object(
  {
    arrangement_event_ids: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    source_candidate_id: Type.Optional(Type.String({ pattern: "^candidate\\.[a-f0-9-]{16,}$" })),
    passage_search_id: Type.Optional(Type.String({ pattern: "^passage-search\\.[a-f0-9-]{16,}$" })),
  },
  { additionalProperties: false }
);

type Options = { store?: WorkspaceStore; service?: ArrangementService };

function dependencies(options: Options) {
  const store = options.store ?? new WorkspaceStore();
  return { store, service: options.service ?? new ArrangementService({ store }) };
}

export function createArrangementSearchGetRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(SearchParamsSchema, request.params),
    handler: async ({ workspaceId, searchId }) => store.getArrangementSearch(workspaceId, searchId),
  });
}

export function createArrangementCandidateGetRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(CandidateParamsSchema, request.params),
    handler: async ({ workspaceId, searchId, candidateId }) =>
      candidateForSearch(store, workspaceId, searchId, candidateId),
  });
}

export function createArrangementCandidatePreviewRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(CandidateParamsSchema, request.params),
    handler: async ({ workspaceId, searchId, candidateId }) => {
      const candidate = candidateForSearch(store, workspaceId, searchId, candidateId);
      const search = store.getArrangementSearch(workspaceId, searchId);
      if (candidate.status === "rejected") {
        throw new ApiRouteError("Rejected candidates cannot be auditioned", 409);
      }
      if (!search.selectedArrangementScoreId) {
        throw new ApiRouteError("Arrangement Search has no completed score projection", 409);
      }
      const selected = store.getArrangementScore(workspaceId, search.selectedArrangementScoreId);
      const score = store.getNormalizedScore(workspaceId, search.normalizedScoreId);
      const projection: ArrangementScore = {
        ...selected,
        selectedCandidateId: candidate.id,
        events: candidate.events,
        preservationAudit: candidate.audit,
      };
      return buildAudioPreview(projection, score);
    },
  });
}

export function createArrangementCandidateBranchRoute(options: Options = {}): RequestHandler {
  const { store, service } = dependencies(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(CandidateParamsSchema, request.params),
    handler: async ({ workspaceId, searchId, candidateId }) => {
      candidateForSearch(store, workspaceId, searchId, candidateId);
      return service.branchFromCandidate(workspaceId, candidateId);
    },
  });
}

export function createPassageCandidateListRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ArrangementParamsSchema, request.params),
      ...Value.Decode(PassageCandidateBodySchema, body),
    }),
    handler: async ({ workspaceId, arrangementId, arrangement_event_ids }) =>
      service.passageCandidates(workspaceId, arrangementId, arrangement_event_ids),
  });
}

export function createPassageCandidatePreviewRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ArrangementParamsSchema, request.params),
      ...Value.Decode(PassageCandidateBodySchema, body),
    }),
    handler: async ({
      workspaceId,
      arrangementId,
      arrangement_event_ids,
      source_candidate_id,
      passage_search_id,
    }) => {
      if (!source_candidate_id) throw new ApiRouteError("source_candidate_id is required", 400);
      if (!passage_search_id) throw new ApiRouteError("passage_search_id is required", 400);
      return service.previewPassageCandidate(
        workspaceId,
        arrangementId,
        arrangement_event_ids,
        source_candidate_id,
        passage_search_id
      );
    },
  });
}

export function createPassageCandidateAdoptRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ArrangementParamsSchema, request.params),
      ...Value.Decode(PassageCandidateBodySchema, body),
    }),
    handler: async ({
      workspaceId,
      arrangementId,
      arrangement_event_ids,
      source_candidate_id,
      passage_search_id,
    }) => {
      if (!source_candidate_id) throw new ApiRouteError("source_candidate_id is required", 400);
      if (!passage_search_id) throw new ApiRouteError("passage_search_id is required", 400);
      return service.adoptPassageCandidate(
        workspaceId,
        arrangementId,
        arrangement_event_ids,
        source_candidate_id,
        passage_search_id
      );
    },
  });
}

function candidateForSearch(
  store: WorkspaceStore,
  workspaceId: string,
  searchId: string,
  candidateId: string
) {
  const search = store.getArrangementSearch(workspaceId, searchId);
  if (!search.candidateIds.includes(candidateId)) {
    throw new ApiRouteError(`Arrangement Candidate is not part of search: ${candidateId}`, 404);
  }
  const candidate = store.getArrangementCandidate(workspaceId, candidateId);
  if (candidate.arrangementSearchId !== searchId) {
    throw new ApiRouteError(
      `Arrangement Candidate has inconsistent search lineage: ${candidateId}`,
      500
    );
  }
  return candidate;
}
