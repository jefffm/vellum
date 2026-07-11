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
