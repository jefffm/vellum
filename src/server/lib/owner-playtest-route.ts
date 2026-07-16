import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { withAuthorityPath } from "../../lib/authority-path-inventory.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { digestValue } from "../../lib/content-digest.js";
import { digestInstrumentInstance } from "../../lib/instrument-instance.js";
import type { ArrangementReadinessView, OwnerPlaytest } from "../../lib/music-domain.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const Params = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  arrangementId: Type.String({ pattern: "^arrangement\\.[a-f0-9-]{16,}$" }),
});

const Observation = Type.Object(
  {
    dimension: Type.Union(
      ["mechanics", "technique", "clarity", "identity", "history", "notation"].map((value) =>
        Type.Literal(value)
      )
    ),
    code: Type.Union(
      [
        "reach",
        "shift_reliability",
        "held_note_conflict",
        "right_hand_difficulty",
        "damping",
        "voice_clarity",
        "cadence",
        "source_identity",
        "historical_practice",
        "notation",
      ].map((value) => Type.Literal(value))
    ),
    outcome: Type.Union(
      ["supports", "concern", "blocks", "not_applicable"].map((value) => Type.Literal(value))
    ),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

const CreateBody = Type.Object(
  {
    candidate_id: Type.Optional(Type.String({ minLength: 1 })),
    arrangement_event_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    playback_occurrence_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    tempo_bpm: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    practice_context: Type.String({ minLength: 1 }),
    evidence_basis: Type.Array(
      Type.Union(["notation", "listening", "physical_playing"].map((value) => Type.Literal(value))),
      { minItems: 1, uniqueItems: true }
    ),
    outcome: Type.Union(
      [
        "comfortable",
        "practice_playable",
        "marginal",
        "unplayable",
        "unclear_unmusical",
        "historically_questionable",
        "notation_problem",
        "not_tested",
      ].map((value) => Type.Literal(value))
    ),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    observations: Type.Array(Observation),
    rationale: Type.String({ minLength: 1 }),
    proposed_consequences: Type.Array(
      Type.Union(
        [
          "adoption",
          "rejection",
          "correction",
          "commitment",
          "ergonomic_profile",
          "calibration_candidate",
          "fixture_nomination",
        ].map((value) => Type.Literal(value))
      ),
      { uniqueItems: true }
    ),
  },
  { additionalProperties: false }
);

export const OWNER_PLAYTEST_READINESS_AUTHORITY_PATH_ID =
  "authority.validator.owner-playtest-readiness";

type Options = {
  store?: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
  authorityGuard?: typeof withAuthorityPath;
};

export function createOwnerPlaytestCreateRoute(options: Options = {}): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.owner-playtest-readiness", "production");
  const store = options.store ?? new WorkspaceStore();
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const authorityGuard = options.authorityGuard ?? withAuthorityPath;
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(Params, request.params),
      ...Value.Decode(CreateBody, body),
    }),
    handler: async (input) => {
      assertAuthorityPathRuntime("authority.validator.owner-playtest-readiness", "production");
      return authorityGuard(OWNER_PLAYTEST_READINESS_AUTHORITY_PATH_ID, "production", () => {
        const score = store.getArrangementScore(input.workspaceId, input.arrangementId);
        const search = score.arrangementSearchId
          ? store.getArrangementSearch(input.workspaceId, score.arrangementSearchId)
          : undefined;
        if (!search || !score.targetConfiguration.instrumentInstance) {
          throw new ApiRouteError(
            "Owner Playtest requires an exact Search, Performance Brief, and Instrument Instance",
            409
          );
        }
        const brief = store.getPerformanceBrief(input.workspaceId, search.performanceBriefId);
        const analysis = store.getAnalysisRecord(input.workspaceId, score.analysisRecordId);
        const normalized = store.getNormalizedScore(input.workspaceId, analysis.normalizedScoreId);
        const occurrenceIds = new Set(
          normalized.performedForm?.measureOccurrences.map((occurrence) => occurrence.id) ?? []
        );
        if (input.playback_occurrence_ids.some((id) => !occurrenceIds.has(id))) {
          throw new ApiRouteError("Owner Playtest references an unknown Playback Occurrence", 400);
        }
        const candidate = input.candidate_id
          ? store.getArrangementCandidate(input.workspaceId, input.candidate_id)
          : undefined;
        const playtest: OwnerPlaytest = {
          id: `playtest.${createId()}`,
          arrangementScoreId: score.id,
          arrangementScoreVersion: score.version ?? 1,
          arrangementScoreDigest: digestValue(score),
          ...(candidate
            ? { candidateId: candidate.id, candidateDigest: digestValue(candidate) }
            : {}),
          arrangementEventIds: input.arrangement_event_ids,
          playbackOccurrenceIds: input.playback_occurrence_ids,
          instrumentInstanceDigest: digestInstrumentInstance(
            score.targetConfiguration.instrumentInstance
          ),
          performanceBriefId: brief.id,
          performanceBriefDigest: digestValue(brief),
          actualContext: {
            ...(input.tempo_bpm === undefined ? {} : { tempoBpm: input.tempo_bpm }),
            practiceContext: input.practice_context,
            evidenceBasis: input.evidence_basis,
          },
          outcome: input.outcome,
          confidence: input.confidence,
          observations: input.observations,
          rationale: input.rationale,
          proposedConsequences: input.proposed_consequences,
          createdAt: now().toISOString(),
        };
        return {
          playtest: store.saveOwnerPlaytest(input.workspaceId, playtest),
          readiness: computeReadiness(store, input.workspaceId, score.id),
        };
      });
    },
  });
}

export function createArrangementReadinessRoute(options: Options = {}): RequestHandler {
  const store = options.store ?? new WorkspaceStore();
  const authorityGuard = options.authorityGuard ?? withAuthorityPath;
  return createApiRoute({
    validate: (_body, request) => Value.Decode(Params, request.params),
    handler: async ({ workspaceId, arrangementId }) =>
      readiness(store, workspaceId, arrangementId, authorityGuard),
  });
}

export function readiness(
  store: WorkspaceStore,
  workspaceId: string,
  arrangementId: string,
  authorityGuard: typeof withAuthorityPath = withAuthorityPath
): ArrangementReadinessView {
  assertAuthorityPathRuntime("authority.validator.owner-playtest-readiness", "production");
  return authorityGuard(OWNER_PLAYTEST_READINESS_AUTHORITY_PATH_ID, "production", () =>
    computeReadiness(store, workspaceId, arrangementId)
  );
}

function computeReadiness(
  store: WorkspaceStore,
  workspaceId: string,
  arrangementId: string
): ArrangementReadinessView {
  assertAuthorityPathRuntime("authority.validator.owner-playtest-readiness", "production");
  const score = store.getArrangementScore(workspaceId, arrangementId);
  const exactDigest = digestValue(score);
  const lineageScoreIds = new Set([score.id]);
  let ancestorId = score.parentArrangementScoreId;
  while (ancestorId && !lineageScoreIds.has(ancestorId)) {
    lineageScoreIds.add(ancestorId);
    ancestorId = store.getArrangementScore(workspaceId, ancestorId).parentArrangementScoreId;
  }
  const related = store
    .listOwnerPlaytests(workspaceId)
    .filter((playtest) => lineageScoreIds.has(playtest.arrangementScoreId));
  const current = related.filter(
    (playtest) =>
      playtest.arrangementScoreId === score.id &&
      playtest.arrangementScoreVersion === (score.version ?? 1) &&
      playtest.arrangementScoreDigest === exactDigest
  );
  const stale = related.filter((playtest) => !current.includes(playtest));
  const blocking = current.filter(
    (playtest) =>
      playtest.outcome === "unplayable" ||
      playtest.outcome === "notation_problem" ||
      playtest.observations.some((observation) => observation.outcome === "blocks")
  );
  const physicallyTested = current.some(
    (playtest) =>
      playtest.outcome !== "not_tested" &&
      playtest.actualContext.evidenceBasis.includes("physical_playing")
  );
  const scoreIsStale = store
    .get(workspaceId)
    .staleDerivationIds.map((id) => store.getStaleDerivation(workspaceId, id))
    .some(
      (record) =>
        record.recordType === "arrangement_score" &&
        record.recordId === score.id &&
        !record.acknowledged
    );
  const status = scoreIsStale
    ? "stale"
    : blocking.length
      ? "blocked"
      : physicallyTested
        ? "owner_tested"
        : current.length
          ? "playtest_available"
          : stale.length
            ? "stale"
            : "inspection_only";
  const rationale =
    status === "stale"
      ? scoreIsStale
        ? "The Arrangement Score has stale upstream lineage; prior playtests remain scoped evidence but cannot establish current readiness."
        : "Playtest evidence exists only for a different score version or digest."
      : status === "blocked"
        ? "Current scoped Owner evidence identifies a blocking physical or notation finding."
        : status === "owner_tested"
          ? "The exact score version has current physical Owner playtest evidence."
          : status === "playtest_available"
            ? "The exact score version has scoped inspection or listening evidence but no physical playtest."
            : "No Owner playtest exists; readiness is limited to machine inspection evidence.";
  return {
    arrangementScoreId: score.id,
    arrangementScoreVersion: score.version ?? 1,
    status,
    currentPlaytestIds: current.map(({ id }) => id),
    stalePlaytestIds: stale.map(({ id }) => id),
    blockingPlaytestIds: blocking.map(({ id }) => id),
    rationale,
  };
}
