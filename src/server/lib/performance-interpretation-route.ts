import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { buildInterpretedAudioPreview } from "../../lib/audio-preview.js";
import type { PerformanceInterpretation } from "../../lib/music-domain.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const ArrangementParams = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  arrangementId: Type.String({ pattern: "^arrangement\\.[a-f0-9-]{16,}$" }),
});
const InterpretationParams = Type.Intersect([
  ArrangementParams,
  Type.Object({
    interpretationId: Type.String({ pattern: "^interpretation\\.[a-f0-9-]{16,}$" }),
  }),
]);
const CreateBody = Type.Object(
  {
    parent_interpretation_id: Type.Optional(Type.String({ minLength: 1 })),
    choices: Type.Object(
      {
        tempo: Type.Integer({ minimum: 30, maximum: 240 }),
        arpeggiation_ms: Type.Integer({ minimum: 0, maximum: 250 }),
        inequality: Type.Number({ minimum: 0, maximum: 0.4 }),
        articulation: Type.Number({ minimum: 0.1, maximum: 1 }),
        principal_voice_ornament: Type.Union([
          Type.Literal("none"),
          Type.Literal("upper_neighbor"),
        ]),
      },
      { additionalProperties: false }
    ),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

type Options = { store?: WorkspaceStore; now?: () => Date; createId?: () => string };

export function createPerformanceInterpretationListRoute(options: Options = {}): RequestHandler {
  assertAuthorityPathRuntime("authority.parameter.performance-interpretation", "production");
  const store = options.store ?? new WorkspaceStore();
  return createApiRoute({
    validate: (_body, request) => Value.Decode(ArrangementParams, request.params),
    handler: async ({ workspaceId, arrangementId }) => {
      const workspace = store.get(workspaceId);
      store.getArrangementScore(workspaceId, arrangementId);
      const stale = workspace.staleDerivationIds
        .map((id) => store.getStaleDerivation(workspaceId, id))
        .find(
          (record) =>
            record.recordType === "arrangement_score" &&
            record.recordId === arrangementId &&
            !record.acknowledged
        );
      return {
        literalIsDefault: true,
        staleReason: stale?.reason,
        interpretations: workspace.performanceInterpretationIds
          .map((id) => store.getPerformanceInterpretation(workspaceId, id))
          .filter((item) => item.arrangementScoreId === arrangementId),
      };
    },
  });
}

export function createPerformanceInterpretationCreateRoute(options: Options = {}): RequestHandler {
  assertAuthorityPathRuntime("authority.parameter.performance-interpretation", "production");
  const store = options.store ?? new WorkspaceStore();
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ArrangementParams, request.params),
      ...Value.Decode(CreateBody, body),
    }),
    handler: async ({
      workspaceId,
      arrangementId,
      parent_interpretation_id,
      choices,
      rationale,
    }) => {
      const arrangement = store.getArrangementScore(workspaceId, arrangementId);
      const parent = parent_interpretation_id
        ? store.getPerformanceInterpretation(workspaceId, parent_interpretation_id)
        : undefined;
      if (parent && parent.arrangementScoreId !== arrangement.id)
        throw new ApiRouteError("Parent interpretation belongs to another Arrangement Score", 400);
      const interpretation: PerformanceInterpretation = {
        id: `interpretation.${createId()}`,
        arrangementScoreId: arrangement.id,
        arrangementScoreVersion: arrangement.version ?? 1,
        version: (parent?.version ?? 0) + 1,
        parentInterpretationId: parent?.id,
        choices: {
          tempo: choices.tempo,
          arpeggiationMs: choices.arpeggiation_ms,
          inequality: choices.inequality,
          articulation: choices.articulation,
          principalVoiceOrnament: choices.principal_voice_ornament,
        },
        rationale,
        createdAt: now().toISOString(),
      };
      return store.savePerformanceInterpretation(workspaceId, interpretation);
    },
  });
}

export function createPerformanceInterpretationPreviewRoute(options: Options = {}): RequestHandler {
  assertAuthorityPathRuntime("authority.parameter.performance-interpretation", "production");
  const store = options.store ?? new WorkspaceStore();
  return createApiRoute({
    validate: (_body, request) => Value.Decode(InterpretationParams, request.params),
    handler: async ({ workspaceId, arrangementId, interpretationId }) => {
      assertAuthorityPathRuntime("authority.parameter.performance-interpretation", "production");
      const arrangement = store.getArrangementScore(workspaceId, arrangementId);
      const interpretation = store.getPerformanceInterpretation(workspaceId, interpretationId);
      const analysis = store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
      const score = store.getNormalizedScore(workspaceId, analysis.normalizedScoreId);
      return buildInterpretedAudioPreview(arrangement, score, interpretation);
    },
  });
}
