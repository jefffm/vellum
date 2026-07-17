import {
  auditBaroqueGuitarIdiom,
  auditBaroqueLuteIdiom,
  auditClassicalGuitarIdiom,
} from "../../lib/baroque-guitar-arranger.js";
import { BASELINE_PUNTEADO_POLICY } from "../../lib/local-idiom-knowledge.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import { loadProfile } from "../profiles.js";
import { WorkspaceStore } from "./workspace-store.js";

export const PRIVATE_HOLDOUT_DIMENSIONS = [
  "source_fidelity",
  "phrase_and_cadence",
  "subordinate_voice_continuity",
  "target_mechanics",
  "historical_and_target_idiom",
  "notation_correctness",
  "playback_identity",
] as const;

export type PrivateHoldoutDimensionId = (typeof PRIVATE_HOLDOUT_DIMENSIONS)[number];
export type PrivateHoldoutStatus = "pass" | "fail" | "incomplete" | "blocked";

export type PrivateHoldoutCase = Readonly<{
  id: string;
  workspaceId: string;
  arrangementScoreId: string;
  truth: Readonly<{
    principalSourceEventIds: readonly string[];
    cadenceSourceEventIds: readonly string[];
    subordinateSourceEventIds: readonly string[];
  }>;
}>;

export type PrivateHoldoutDimensionResult = Readonly<{
  id: PrivateHoldoutDimensionId;
  status: PrivateHoldoutStatus;
  findingCodes: readonly string[];
}>;

export type PrivateHoldoutCaseResult = Readonly<{
  caseId: string;
  status: PrivateHoldoutStatus;
  dimensions: readonly PrivateHoldoutDimensionResult[];
}>;

export function evaluatePrivateHoldout(
  store: WorkspaceStore,
  input: PrivateHoldoutCase
): PrivateHoldoutCaseResult {
  try {
    const workspace = store.get(input.workspaceId);
    const arrangement = store.getArrangementScore(input.workspaceId, input.arrangementScoreId);
    const deliverables = workspace.deliverableIds
      .map((id) => store.getDeliverable(input.workspaceId, id))
      .filter(({ arrangementScoreId }) => arrangementScoreId === arrangement.id);
    const principal = arrangement.events.flatMap(({ principalVoiceSourceEventId }) =>
      principalVoiceSourceEventId ? [principalVoiceSourceEventId] : []
    );
    const representedSources = new Set(
      arrangement.events.flatMap((event) => [
        ...event.sourceEventIds,
        ...(event.voiceConstituents ?? []).map(({ sourceEventId }) => sourceEventId),
      ])
    );
    const subordinateSources = new Set(
      arrangement.events.flatMap((event) =>
        (event.voiceConstituents ?? [])
          .filter(({ role }) => role === "source_voice")
          .map(({ sourceEventId }) => sourceEventId)
      )
    );
    const exactInstance = arrangement.targetConfiguration.instrumentInstance;
    const model = exactInstance
      ? InstrumentModel.fromProfile(
          loadProfile(arrangement.targetConfiguration.instrumentId),
          exactInstance
        )
      : undefined;

    const dimensions: PrivateHoldoutDimensionResult[] = [
      compareExactSequence(
        "source_fidelity",
        input.truth.principalSourceEventIds,
        principal,
        "holdout.principal_voice_mismatch"
      ),
      requireIds(
        "phrase_and_cadence",
        input.truth.cadenceSourceEventIds,
        representedSources,
        "holdout.cadential_goal_missing"
      ),
      requireIds(
        "subordinate_voice_continuity",
        input.truth.subordinateSourceEventIds,
        subordinateSources,
        "holdout.subordinate_voice_missing"
      ),
      model
        ? result(
            "target_mechanics",
            arrangement.events.every(({ positions }) => model.isPlayable(positions).ok)
              ? "pass"
              : "fail",
            "holdout.target_mechanics_failed"
          )
        : result("target_mechanics", "incomplete", "holdout.instrument_instance_missing"),
      gradeIdiom(arrangement.targetConfiguration.instrumentId, arrangement.events, model),
      result(
        "notation_correctness",
        deliverables.some(({ kind }) => kind === "pdf" || kind === "browser_preview")
          ? "pass"
          : "incomplete",
        "holdout.notation_deliverable_missing"
      ),
      result(
        "playback_identity",
        deliverables.some(({ kind }) => kind === "midi" || kind === "audio_preview")
          ? "pass"
          : "incomplete",
        "holdout.playback_deliverable_missing"
      ),
    ];
    return Object.freeze({
      caseId: input.id,
      status: overallPrivateHoldoutStatus(dimensions),
      dimensions,
    });
  } catch {
    const dimensions = PRIVATE_HOLDOUT_DIMENSIONS.map((id) =>
      result(id, "blocked", "holdout.case_unavailable")
    );
    return Object.freeze({ caseId: input.id, status: "blocked", dimensions });
  }
}

export function overallPrivateHoldoutStatus(
  dimensions: readonly PrivateHoldoutDimensionResult[]
): PrivateHoldoutStatus {
  if (dimensions.some(({ status }) => status === "fail")) return "fail";
  if (dimensions.some(({ status }) => status === "blocked")) return "blocked";
  if (dimensions.some(({ status }) => status === "incomplete")) return "incomplete";
  return "pass";
}

export function redactPrivateHoldoutAttempt(input: PrivateHoldoutCaseResult): {
  caseId: string;
  status: PrivateHoldoutStatus;
  dimensions: Array<{
    id: PrivateHoldoutDimensionId;
    status: PrivateHoldoutStatus;
    findingCodes: readonly string[];
  }>;
} {
  return {
    caseId: input.caseId,
    status: input.status,
    dimensions: input.dimensions.map(({ id, status, findingCodes }) => ({
      id,
      status,
      findingCodes,
    })),
  };
}

function gradeIdiom(
  instrumentId: string,
  events: Parameters<typeof auditBaroqueGuitarIdiom>[0],
  model: InstrumentModel | undefined
): PrivateHoldoutDimensionResult {
  if (instrumentId === "baroque-guitar-5") {
    const version2Applied = events.some(
      ({ baroqueGuitarGesture }) => baroqueGuitarGesture?.appliedKnowledge?.version === 2
    );
    const policy = version2Applied
      ? {
          ...BASELINE_PUNTEADO_POLICY,
          version: 2 as const,
          authorityLane: "historical_practice" as const,
          consequence: {
            maximumSimultaneousAttacks: 4 as const,
            rightHandFingers: ["p", "i", "m", "a"] as const,
          },
        }
      : BASELINE_PUNTEADO_POLICY;
    return idiomResult(auditBaroqueGuitarIdiom(events, policy));
  }
  if (instrumentId === "baroque-lute-13" && model) {
    return idiomResult(auditBaroqueLuteIdiom(events, model));
  }
  if (instrumentId === "classical-guitar-6" && model) {
    return idiomResult(auditClassicalGuitarIdiom(events, model));
  }
  return result("historical_and_target_idiom", "incomplete", "holdout.idiom_evaluator_unavailable");
}

function idiomResult(findings: readonly string[]): PrivateHoldoutDimensionResult {
  return {
    id: "historical_and_target_idiom",
    status: findings.length ? "fail" : "pass",
    findingCodes: findings.length ? [...findings] : [],
  };
}

function compareExactSequence(
  id: PrivateHoldoutDimensionId,
  expected: readonly string[],
  actual: readonly string[],
  code: string
): PrivateHoldoutDimensionResult {
  if (!expected.length) return result(id, "incomplete", "holdout.reviewed_truth_missing");
  const matches =
    expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  return result(id, matches ? "pass" : "fail", code);
}

function requireIds(
  id: PrivateHoldoutDimensionId,
  expected: readonly string[],
  actual: ReadonlySet<string>,
  code: string
): PrivateHoldoutDimensionResult {
  if (!expected.length) return result(id, "incomplete", "holdout.reviewed_truth_missing");
  return result(id, expected.every((value) => actual.has(value)) ? "pass" : "fail", code);
}

function result(
  id: PrivateHoldoutDimensionId,
  status: PrivateHoldoutStatus,
  failureCode: string
): PrivateHoldoutDimensionResult {
  return Object.freeze({
    id,
    status,
    findingCodes: status === "pass" ? [] : [failureCode],
  });
}
