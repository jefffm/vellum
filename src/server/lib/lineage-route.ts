import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { CommitmentScopeSchema } from "../../lib/music-domain.js";
import { createApiRoute } from "./create-route.js";
import { LineageService } from "./lineage-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const WorkspaceParams = Type.Object({ workspaceId: Type.String({ minLength: 1 }) });
const ArrangementParams = Type.Object({
  workspaceId: Type.String({ minLength: 1 }),
  arrangementId: Type.String({ minLength: 1 }),
});
const CommitmentParams = Type.Object({
  workspaceId: Type.String({ minLength: 1 }),
  commitmentId: Type.String({ minLength: 1 }),
});

type Options = { store?: WorkspaceStore; service?: LineageService };

function dependencies(options: Options) {
  const store = options.store ?? new WorkspaceStore();
  return { store, service: options.service ?? new LineageService({ store }) };
}

export function createArrangementLineageRoute(options: Options = {}): RequestHandler {
  const { store } = dependencies(options);
  return createApiRoute<{ workspaceId: string; arrangementId: string }, unknown>({
    validate: (_body, request) => Value.Decode(ArrangementParams, request.params),
    handler: async ({ workspaceId, arrangementId }) => {
      const workspace = store.get(workspaceId);
      store.getArrangementScore(workspaceId, arrangementId);
      return {
        staleDerivations: workspace.staleDerivationIds
          .map((id) => store.getStaleDerivation(workspaceId, id))
          .filter((record) => record.recordId === arrangementId),
        editorialCommitments: workspace.editorialCommitmentIds
          .map((id) => store.getEditorialCommitment(workspaceId, id))
          .filter((record) => record.arrangementScoreId === arrangementId),
        conflicts: workspace.commitmentConflictIds
          .map((id) => store.getCommitmentConflict(workspaceId, id))
          .filter((record) => record.arrangementScoreId === arrangementId),
      };
    },
  });
}

export function createEditorialCommitmentRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  const Body = Type.Object({
    arrangementFamilyId: Type.String({ minLength: 1 }),
    scope: CommitmentScopeSchema,
    value: Type.Unknown(),
    origin: Type.Union([Type.Literal("user_edit"), Type.Literal("approved_model_choice")]),
  });
  return createApiRoute<any, unknown>({
    validate: (body, request) => ({
      ...Value.Decode(ArrangementParams, request.params),
      ...Value.Decode(Body, body),
    }),
    handler: async ({ workspaceId, arrangementId, ...input }) =>
      service.createEditorialCommitment(workspaceId, {
        ...input,
        arrangementScoreId: arrangementId,
      }),
  });
}

export function createCommitmentReleaseRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  return createApiRoute<any, unknown>({
    validate: (_body, request) => Value.Decode(CommitmentParams, request.params),
    handler: async ({ workspaceId, commitmentId }) =>
      service.releaseEditorialCommitment(workspaceId, commitmentId),
  });
}

export function createConservativeRegenerationRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  const Body = Type.Object({
    normalizedScoreId: Type.String({ minLength: 1 }),
    changedSourceEventIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  });
  return createApiRoute<any, unknown>({
    validate: (body, request) => ({
      ...Value.Decode(ArrangementParams, request.params),
      ...Value.Decode(Body, body),
    }),
    handler: async ({ workspaceId, arrangementId, ...input }) =>
      service.conservativeRegenerate(workspaceId, {
        ...input,
        arrangementScoreId: arrangementId,
      }),
  });
}

export function createPolicyExceptionRoute(options: Options = {}): RequestHandler {
  const { service } = dependencies(options);
  const Params = Type.Object({
    workspaceId: Type.String({ minLength: 1 }),
    conflictId: Type.String({ minLength: 1 }),
  });
  const Body = Type.Object({
    rationale: Type.String({ minLength: 1 }),
    musicalConsequence: Type.String({ minLength: 1 }),
    severity: Type.Union([Type.Literal("localized"), Type.Literal("critical")]),
    ownerApproved: Type.Literal(true),
  });
  return createApiRoute<any, unknown>({
    validate: (body, request) => ({
      ...Value.Decode(Params, request.params),
      ...Value.Decode(Body, body),
    }),
    handler: async ({ workspaceId, conflictId, ...input }) =>
      service.approvePolicyException(workspaceId, { conflictId, ...input }),
  });
}
