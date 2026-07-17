import { InstrumentModel } from "./instrument-model.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import type {
  AnalysisRecord,
  ArrangementCandidate,
  ArrangementEvent,
  ArrangementPlan,
  ArrangementPosition,
  ArrangementScore,
  NormalizedScore,
  PerformanceBrief,
  PreservationAudit,
  Rational,
  ScoreEvent,
  TargetConfiguration,
} from "./music-domain.js";
import { addRational, compareRational } from "./music-domain.js";
import { midiToNote, noteToMidi, transposeNote } from "./pitch.js";
import { buildCompleteTransformationReport } from "./transformation-report.js";
import { applyPreservationPolicy, type PreservationPolicy } from "./preservation-policy.js";

type ArrangementOptions = {
  arrangementId: string;
  createdAt: string;
  targetConfiguration: TargetConfiguration;
  preservationPolicy?: PreservationPolicy;
  arrangementPlan?: ArrangementPlan;
  performanceBrief?: PerformanceBrief;
  phraseSearch?: {
    frontierWidth: number;
    maximumExpandedStates: number;
  };
};

export type ArrangementSearchResult = {
  candidates: ArrangementCandidate[];
  selected: ArrangementScore;
};

type VoicingChoice = {
  pitches: string[];
  positions: ArrangementPosition[];
  sourceEventIds: string[];
  sourcePitchClassCoverage: number;
  averageFret: number;
  openStringCount: number;
};

type PhraseSearchEvidence = NonNullable<ArrangementCandidate["phraseSearchEvidence"]>;

type PhraseState = {
  events: ArrangementEvent[];
  positions: ArrangementPosition[];
  principalPosition?: ArrangementPosition;
  handPosition?: number;
  occupiedFingers: Array<{ finger: number; fret: number; course: number }>;
  barreFrets: number[];
  heldNotes: string[];
  occupiedCourses: number[];
  technique: string;
  transitions: PhraseSearchEvidence["transitions"];
  cost: number;
};

export class PhraseSearchExhaustedError extends Error {
  constructor(
    message: string,
    readonly expandedStates: number,
    readonly maximumExpandedStates: number
  ) {
    super(message);
    this.name = "PhraseSearchExhaustedError";
  }
}

export function isViolentCrossNeckJump(
  from: Pick<ArrangementPosition, "course" | "fret">,
  to: Pick<ArrangementPosition, "course" | "fret">
): boolean {
  return Math.abs(from.fret - to.fret) >= 5 && Math.abs(from.course - to.course) >= 3;
}

export function arrangeFaithfulPluckedString(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: ArrangementOptions
): ArrangementSearchResult {
  assertAuthorityPathRuntime("authority.ranker.plucked-string-arrangement", "production");
  if (
    options.targetConfiguration.instrumentId !== "baroque-guitar-5" &&
    options.targetConfiguration.instrumentId !== "baroque-lute-13" &&
    options.targetConfiguration.instrumentId !== "classical-guitar-6" &&
    options.targetConfiguration.instrumentId !== "renaissance-lute-6"
  ) {
    throw new Error(
      `Faithful plucked-string arranger does not support ${options.targetConfiguration.instrumentId}`
    );
  }
  const target = analysis.preservationTargets.find(
    (candidate) => candidate.kind === "principal_voice"
  );
  if (!target?.partId)
    throw new Error("Faithful plucked-string arrangement requires a Principal Voice target");
  const principalEvents = score.events.filter(
    (
      event
    ): event is Extract<ScoreEvent, { type: "note" }> | Extract<ScoreEvent, { type: "rest" }> =>
      event.partId === target.partId && event.type !== "figured_bass"
  );
  const strategies = ["source-coverage", "economical-fingering"] as const;
  const policy = options.preservationPolicy ?? "faithful_reduction";
  const transpositionAttempts = enumerateTranspositionPlans(score, principalEvents, model)
    .slice(0, 2)
    .map((plan) => {
      try {
        const candidates: ArrangementCandidate[] = strategies.slice(0, 1).map((strategy) => {
          const built: {
            events: ArrangementEvent[];
            phraseSearchEvidence?: PhraseSearchEvidence;
          } = {
            events: buildCandidateEvents(score, principalEvents, model, plan.semitones, strategy),
          };
          const events = built.events;
          const audit = applyPreservationPolicy(
            auditFaithfulPrincipalVoice(score, analysis, events, plan.semitones),
            policy
          );
          return {
            id: `candidate.${strategy}`,
            strategy,
            status: audit.status === "fail" ? ("rejected" as const) : ("survived" as const),
            events,
            audit,
            metrics: candidateMetrics(events),
            ...(built.phraseSearchEvidence
              ? { phraseSearchEvidence: built.phraseSearchEvidence }
              : {}),
          };
        });
        const survivors = candidates.filter((candidate) => candidate.status === "survived");
        survivors.sort((left, right) => compareCandidatesForPolicy(left, right, policy));
        const best = survivors[0];
        return best
          ? { plan, candidates, best, totalPositionMotion: candidatePositionMotion(best) }
          : { plan, candidates, reason: "Every complete candidate failed Preservation Audit." };
      } catch (error) {
        return {
          plan,
          candidates: [] as ArrangementCandidate[],
          error,
          reason: error instanceof Error ? error.message : "Target realization failed.",
        };
      }
    });
  const completeAttempts = transpositionAttempts.filter(
    (attempt): attempt is (typeof transpositionAttempts)[number] & { best: ArrangementCandidate } =>
      "best" in attempt && attempt.best !== undefined
  );
  completeAttempts.sort(
    (left, right) =>
      preferredTranspositionRank(left.plan.semitones) -
        preferredTranspositionRank(right.plan.semitones) ||
      compareCandidatesForPolicy(left.best, right.best, policy) ||
      left.totalPositionMotion - right.totalPositionMotion ||
      left.plan.semitones - right.plan.semitones
  );
  const selectedAttempt = completeAttempts[0];
  if (!selectedAttempt) {
    const exhausted = transpositionAttempts.find(
      (attempt) => "error" in attempt && attempt.error instanceof PhraseSearchExhaustedError
    );
    if (exhausted && "error" in exhausted) throw exhausted.error;
    throw new Error(
      `No ${options.targetConfiguration.instrumentId} candidate passed Preservation Audit`
    );
  }
  const candidates: ArrangementCandidate[] = strategies.map((strategy) => {
    const built: { events: ArrangementEvent[]; phraseSearchEvidence?: PhraseSearchEvidence } = [
      "baroque-guitar-5",
      "baroque-lute-13",
      "classical-guitar-6",
    ].includes(model.exactInstance()?.profileId ?? "")
      ? buildHistoricalPluckedPhraseCandidate(
          score,
          analysis,
          principalEvents,
          model,
          selectedAttempt.plan.semitones,
          strategy,
          options
        )
      : {
          events: buildCandidateEvents(
            score,
            principalEvents,
            model,
            selectedAttempt.plan.semitones,
            strategy
          ),
        };
    const audit = applyPreservationPolicy(
      auditFaithfulPrincipalVoice(
        score,
        analysis,
        built.events,
        selectedAttempt.plan.semitones,
        options.arrangementPlan
      ),
      policy
    );
    return {
      id: `candidate.${strategy}`,
      strategy,
      status: audit.status === "fail" ? "rejected" : "survived",
      events: built.events,
      audit,
      metrics: candidateMetrics(built.events),
      ...(built.phraseSearchEvidence ? { phraseSearchEvidence: built.phraseSearchEvidence } : {}),
    };
  });
  const finalists = candidates.filter((candidate) => candidate.status === "survived");
  finalists.sort((left, right) => compareCandidatesForPolicy(left, right, policy));
  const selectedCandidate = finalists[0];
  if (!selectedCandidate) {
    const failureCodes = [
      ...new Set(
        candidates.flatMap((candidate) => candidate.audit.findings.map((finding) => finding.code))
      ),
    ];
    throw new Error(
      `No ${options.targetConfiguration.instrumentId} candidate passed Preservation Audit (${failureCodes.join(", ")})`
    );
  }
  selectedCandidate.status = "selected";
  const plan = {
    ...selectedAttempt.plan,
    rationale: `${selectedAttempt.plan.rationale} Selected after comparing ${completeAttempts.length} complete target solution${completeAttempts.length === 1 ? "" : "s"}: faithful policy applies the declared target key preference before target mechanics, so range fit alone does not select the key.`,
    alternatives: transpositionAttempts.map((attempt) => ({
      semitones: attempt.plan.semitones,
      targetKey: attempt.plan.targetKey,
      status: "best" in attempt ? ("complete_solution" as const) : ("rejected" as const),
      selected: attempt === selectedAttempt,
      ...(attempt.best
        ? {
            sourcePitchClassCoverage: attempt.best.metrics.sourcePitchClassCoverage,
            totalPositionMotion: attempt.totalPositionMotion,
            averageFret: attempt.best.metrics.averageFret,
          }
        : {}),
      reason:
        attempt === selectedAttempt
          ? "Selected by the policy comparison over complete realized and audited target events."
          : "best" in attempt
            ? "A complete audited solution existed but another complete solution outranked it."
            : attempt.reason,
    })),
  };
  const transformationReport = buildCompleteTransformationReport(
    score,
    analysis,
    selectedCandidate.events,
    plan.semitones
  );

  return {
    candidates,
    selected: {
      id: options.arrangementId,
      analysisRecordId: analysis.id,
      selectedCandidateId: selectedCandidate.id,
      targetConfiguration: options.targetConfiguration,
      transpositionPlan: plan,
      preservationPolicy: policy,
      events: selectedCandidate.events,
      transformationReport,
      preservationAudit: selectedCandidate.audit,
      createdAt: options.createdAt,
    },
  };
}

function compareCandidatesForPolicy(
  left: ArrangementCandidate,
  right: ArrangementCandidate,
  policy: PreservationPolicy
): number {
  if (policy === "free_paraphrase") {
    return (
      right.metrics.openStringCount - left.metrics.openStringCount ||
      left.metrics.averageFret - right.metrics.averageFret
    );
  }
  if (policy === "idiomatic_adaptation") {
    return (
      left.metrics.averageFret - right.metrics.averageFret ||
      right.metrics.sourcePitchClassCoverage - left.metrics.sourcePitchClassCoverage
    );
  }
  return (
    right.metrics.sourcePitchClassCoverage - left.metrics.sourcePitchClassCoverage ||
    candidatePositionMotion(left) - candidatePositionMotion(right) ||
    left.metrics.averageFret - right.metrics.averageFret ||
    right.metrics.openStringCount - left.metrics.openStringCount
  );
}

function candidatePositionMotion(candidate: ArrangementCandidate): number {
  const modeled = candidate.phraseSearchEvidence?.transitions.reduce(
    (total, transition) =>
      total +
      transition.fretDisplacement +
      transition.courseDisplacement +
      transition.handPositionDelta,
    0
  );
  if (modeled !== undefined) return modeled;
  const representatives = candidate.events.flatMap((event) =>
    event.positions.length
      ? [
          event.positions.reduce((highest, position) =>
            noteToMidi(position.pitch) > noteToMidi(highest.pitch) ? position : highest
          ),
        ]
      : []
  );
  return representatives.slice(1).reduce((total, position, index) => {
    const prior = representatives[index]!;
    return total + Math.abs(position.fret - prior.fret) + Math.abs(position.course - prior.course);
  }, 0);
}

export function arrangeFaithfulBaroqueGuitar(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: ArrangementOptions
): ArrangementSearchResult {
  assertAuthorityPathRuntime("authority.ranker.plucked-string-arrangement", "production");
  if (options.targetConfiguration.instrumentId !== "baroque-guitar-5") {
    throw new Error("Baroque-guitar arrangement requires target instrument baroque-guitar-5");
  }
  return arrangeFaithfulPluckedString(score, analysis, model, options);
}

export function auditFaithfulPrincipalVoice(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  arrangedEvents: ArrangementEvent[],
  transpositionSemitones: number,
  arrangementPlan?: ArrangementPlan
): PreservationAudit {
  assertAuthorityPathRuntime("authority.validator.preservation-editorial", "production");
  const target = analysis.preservationTargets.find(
    (candidate) => candidate.kind === "principal_voice"
  );
  if (!target) throw new Error("Principal Voice Preservation Target is missing");
  const findings: PreservationAudit["findings"] = [];

  for (const sourceEventId of target.eventIds) {
    const source = score.events.find((event) => event.id === sourceEventId);
    const arranged = arrangedEvents.find(
      (event) => event.principalVoiceSourceEventId === sourceEventId
    );
    if (!source || source.type !== "note") {
      findings.push({
        targetId: target.id,
        sourceEventId,
        severity: "hard",
        code: "principal.source_missing",
        message: `Protected Principal Voice source event is unavailable: ${sourceEventId}`,
      });
      continue;
    }
    if (!arranged) {
      findings.push({
        targetId: target.id,
        sourceEventId,
        severity: "hard",
        code: "principal.omitted",
        message: `Principal Voice event is omitted: ${sourceEventId}`,
      });
      continue;
    }

    const expectedPitch = transposeNote(source.pitch, transpositionSemitones);
    const highestPitch = arranged.pitches
      .slice()
      .sort((left, right) => noteToMidi(right) - noteToMidi(left))[0];
    if (!arranged.pitches.includes(expectedPitch)) {
      findings.push({
        targetId: target.id,
        sourceEventId,
        arrangementEventId: arranged.id,
        severity: "hard",
        code: "principal.pitch_changed",
        message: `Expected transposed Principal Voice pitch ${expectedPitch} is absent.`,
      });
    }
    if (highestPitch !== expectedPitch) {
      findings.push({
        targetId: target.id,
        sourceEventId,
        arrangementEventId: arranged.id,
        severity: "hard",
        code: "principal.not_top_line",
        message: `Principal Voice ${expectedPitch} is not the sounding top line.`,
      });
    }
    if (compareRational(source.duration, arranged.duration) !== 0) {
      findings.push({
        targetId: target.id,
        sourceEventId,
        arrangementEventId: arranged.id,
        severity: "hard",
        code: "principal.rhythm_changed",
        message: "Principal Voice duration changed.",
      });
    }
    if (
      compareRational(source.onset, arranged.onset) !== 0 ||
      source.measureId !== arranged.measureId
    ) {
      findings.push({
        targetId: target.id,
        sourceEventId,
        arrangementEventId: arranged.id,
        severity: "hard",
        code: "principal.onset_changed",
        message: "Principal Voice onset or measure position changed.",
      });
    }
  }

  const sequenceTarget = analysis.preservationTargets.find(
    (candidate) => candidate.relationshipType === "principal_sequence"
  );
  if (sequenceTarget) {
    const sourceSequence = sequenceTarget.eventIds.flatMap((id) => {
      const event = score.events.find(
        (candidate): candidate is Extract<ScoreEvent, { type: "note" }> =>
          candidate.id === id && candidate.type === "note"
      );
      return event ? [event] : [];
    });
    const arrangedSequence = sequenceTarget.eventIds.flatMap((id) => {
      const event = arrangedEvents.find(
        (candidate) => candidate.principalVoiceSourceEventId === id
      );
      return event ? [event] : [];
    });
    const chronological = arrangedSequence.every(
      (event, index) =>
        index === 0 ||
        absoluteEventOnset(score, arrangedSequence[index - 1]!) <= absoluteEventOnset(score, event)
    );
    const sourceContour = intervalContour(sourceSequence.map((event) => event.pitch));
    const arrangedContour = intervalContour(
      arrangedSequence.map(
        (event) => event.pitches.slice().sort((a, b) => noteToMidi(b) - noteToMidi(a))[0]!
      )
    );
    if (
      arrangedSequence.length !== sourceSequence.length ||
      !chronological ||
      sourceContour.join(",") !== arrangedContour.join(",")
    ) {
      findings.push({
        targetId: sequenceTarget.id,
        severity: "hard",
        code: "principal.sequence_changed",
        message:
          "Principal Voice chronological order or interval contour no longer matches the reviewed source sequence.",
      });
    }
  }

  const cadenceTarget = analysis.preservationTargets.find(
    (candidate) => candidate.relationshipType === "cadential_goal"
  );
  if (cadenceTarget) {
    const cadenceId = cadenceTarget.eventIds.at(-1);
    const sourceCadence = score.events.find(
      (event): event is Extract<ScoreEvent, { type: "note" }> =>
        event.id === cadenceId && event.type === "note"
    );
    const arrangedCadence = arrangedEvents.find(
      (event) => event.principalVoiceSourceEventId === cadenceId
    );
    const lastPrincipalEvent = arrangedEvents
      .filter((event) => event.principalVoiceSourceEventId)
      .slice()
      .sort((left, right) => absoluteEventOnset(score, left) - absoluteEventOnset(score, right))
      .at(-1);
    if (
      !sourceCadence ||
      !arrangedCadence ||
      lastPrincipalEvent?.id !== arrangedCadence.id ||
      !arrangedCadence.pitches.includes(transposeNote(sourceCadence.pitch, transpositionSemitones))
    ) {
      findings.push({
        targetId: cadenceTarget.id,
        sourceEventId: cadenceId,
        arrangementEventId: arrangedCadence?.id,
        severity: "hard",
        code: "principal.cadential_goal_changed",
        message: "Principal Voice no longer reaches the reviewed cadential goal.",
      });
    }
  }

  for (const phraseTarget of analysis.preservationTargets.filter(
    (candidate) => candidate.relationshipType === "phrase_contour"
  )) {
    const sourcePhrase = phraseTarget.eventIds.flatMap((id) => {
      const event = score.events.find(
        (candidate): candidate is Extract<ScoreEvent, { type: "note" }> =>
          candidate.id === id && candidate.type === "note"
      );
      return event ? [event] : [];
    });
    const arrangedPhrase = phraseTarget.eventIds.flatMap((id) => {
      const event = arrangedEvents.find(
        (candidate) => candidate.principalVoiceSourceEventId === id
      );
      return event ? [event] : [];
    });
    const sourceContour = intervalContour(sourcePhrase.map((event) => event.pitch));
    const arrangedContour = intervalContour(
      arrangedPhrase.map(
        (event) => event.pitches.slice().sort((a, b) => noteToMidi(b) - noteToMidi(a))[0]!
      )
    );
    if (
      arrangedPhrase.length !== sourcePhrase.length ||
      sourceContour.join(",") !== arrangedContour.join(",") ||
      arrangedPhrase.some(
        (event, index) =>
          event.measureId !== sourcePhrase[index]!.measureId ||
          compareRational(event.onset, sourcePhrase[index]!.onset) !== 0 ||
          compareRational(event.duration, sourcePhrase[index]!.duration) !== 0
      )
    ) {
      findings.push({
        targetId: phraseTarget.id,
        severity: "hard",
        code: "principal.phrase_contour_changed",
        message:
          "A protected Principal Voice phrase no longer retains its source contour, rhythm, or placement.",
      });
    }
  }

  findings.push(
    ...auditPlannedVoiceObligations(score, arrangedEvents, transpositionSemitones, arrangementPlan)
  );

  const plannedTargetIds = (arrangementPlan?.phraseObligations ?? []).flatMap((obligation) => [
    ...obligation.targetVoices.map((voice) => voice.id),
    ...obligation.relationshipPlan.map((relationship) => relationship.id),
  ]);

  return {
    status: findings.some((finding) => finding.severity === "hard") ? "fail" : "pass",
    targetIds: [
      ...analysis.preservationTargets.map((candidate) => candidate.id),
      ...plannedTargetIds,
    ],
    findings,
  };
}

export function auditPlannedVoiceObligations(
  score: NormalizedScore,
  arrangedEvents: ArrangementEvent[],
  transpositionSemitones: number,
  arrangementPlan?: ArrangementPlan
): PreservationAudit["findings"] {
  const findings: PreservationAudit["findings"] = [];
  for (const obligation of arrangementPlan?.phraseObligations ?? []) {
    for (const targetVoice of obligation.targetVoices) {
      const realized: Array<{
        source: Extract<ScoreEvent, { type: "note" }>;
        arrangement: ArrangementEvent;
        pitch: string;
      }> = [];
      for (const sourceEventId of targetVoice.sourceEventIds) {
        const source = score.events.find(
          (event): event is Extract<ScoreEvent, { type: "note" }> =>
            event.id === sourceEventId && event.type === "note"
        );
        if (!source) continue;
        const arrangement = arrangedEvents.find((event) =>
          event.voiceConstituents?.some(
            (constituent) =>
              constituent.sourceEventId === source.id &&
              constituent.voiceId === targetVoice.sourcePartId
          )
        );
        const constituent = arrangement?.voiceConstituents?.find(
          (item) => item.sourceEventId === source.id && item.voiceId === targetVoice.sourcePartId
        );
        if (!arrangement || !constituent) {
          findings.push({
            targetId: targetVoice.id,
            sourceEventId: source.id,
            severity: "hard",
            code: "voice.obligation_omitted",
            message: `Planned ${targetVoice.role} event disappeared without an explicit transformation.`,
          });
          continue;
        }
        const expected = transposeNote(source.pitch, transpositionSemitones);
        if (noteToMidi(constituent.pitch) % 12 !== noteToMidi(expected) % 12) {
          findings.push({
            targetId: targetVoice.id,
            sourceEventId: source.id,
            arrangementEventId: arrangement.id,
            severity: "hard",
            code: "voice.pitch_identity_changed",
            message: `Planned ${targetVoice.role} pitch identity changed outside its allowed transformations.`,
          });
        }
        if (
          arrangement.measureId !== source.measureId ||
          compareRational(constituent.onset, source.onset) !== 0 ||
          compareRational(constituent.duration, source.duration) !== 0
        ) {
          findings.push({
            targetId: targetVoice.id,
            sourceEventId: source.id,
            arrangementEventId: arrangement.id,
            severity: "hard",
            code: "voice.phrase_timing_changed",
            message: `Planned ${targetVoice.role} phrase timing changed without authorization.`,
          });
        }
        realized.push({ source, arrangement, pitch: constituent.pitch });
      }
      if (targetVoice.continuity === "required") {
        for (let index = 1; index < realized.length; index += 1) {
          const prior = realized[index - 1]!;
          const current = realized[index]!;
          const sourceMotion = noteToMidi(current.source.pitch) - noteToMidi(prior.source.pitch);
          const targetMotion = noteToMidi(current.pitch) - noteToMidi(prior.pitch);
          const disproportionateLeap =
            Math.abs(targetMotion) > Math.max(12, Math.abs(sourceMotion) + 7);
          if (disproportionateLeap) {
            findings.push({
              targetId: targetVoice.id,
              sourceEventId: current.source.id,
              arrangementEventId: current.arrangement.id,
              severity: "hard",
              code: "voice.continuity_jump",
              message: `Planned ${targetVoice.role} continuity contains an unplanned registral jump.`,
            });
          }
        }
      }
    }
    for (const cadenceId of obligation.harmonicPlan.cadenceGoalEventIds) {
      const targetVoice = obligation.targetVoices.find((voice) =>
        voice.sourceEventIds.includes(cadenceId)
      );
      if (
        targetVoice &&
        !arrangedEvents.some((event) =>
          event.voiceConstituents?.some((constituent) => constituent.sourceEventId === cadenceId)
        )
      ) {
        findings.push({
          targetId: targetVoice.id,
          sourceEventId: cadenceId,
          severity: "hard",
          code: "voice.cadential_goal_omitted",
          message: `Planned ${targetVoice.role} does not reach its cadential goal.`,
        });
      }
    }
  }
  return findings;
}

function absoluteEventOnset(
  score: NormalizedScore,
  event: Pick<ScoreEvent | ArrangementEvent, "measureId" | "onset">
): number {
  let result = 0;
  for (const measure of score.measures) {
    if (measure.id === event.measureId) break;
    result += measure.duration.numerator / measure.duration.denominator;
  }
  return result + event.onset.numerator / event.onset.denominator;
}

function intervalContour(pitches: string[]): number[] {
  return pitches.slice(1).map((pitch, index) => noteToMidi(pitch) - noteToMidi(pitches[index]!));
}

function enumerateTranspositionPlans(
  score: NormalizedScore,
  principalEvents: ScoreEvent[],
  model: InstrumentModel
): ArrangementScore["transpositionPlan"][] {
  const notes = principalEvents.filter(
    (event): event is Extract<ScoreEvent, { type: "note" }> => event.type === "note"
  );
  const feasibleIntervals = PREFERRED_TRANSPOSITION_INTERVALS.filter((interval) =>
    notes.every(
      (event) => principalPositions(model, transposeNote(event.pitch, interval)).length > 0
    )
  );
  if (feasibleIntervals.length === 0) {
    throw new Error(
      "Principal Voice cannot fit the target instrument range under a uniform transposition"
    );
  }
  return feasibleIntervals.map((semitones) => ({
    sourceKey: score.key,
    targetKey: transposeKey(score.key, semitones),
    semitones,
    rationale:
      semitones === 0
        ? "The source key fits the complete Principal Voice on the target instrument."
        : `Uniformly transpose ${semitones} semitones so every Principal Voice event is playable while preserving intervals and rhythm.`,
  }));
}

const PREFERRED_TRANSPOSITION_INTERVALS = [0, -5, 5, -7, 7, -2, -3] as const;

function preferredTranspositionRank(semitones: number): number {
  const index = PREFERRED_TRANSPOSITION_INTERVALS.indexOf(
    semitones as (typeof PREFERRED_TRANSPOSITION_INTERVALS)[number]
  );
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function buildHistoricalPluckedPhraseCandidate(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  principalEvents: Array<
    Extract<ScoreEvent, { type: "note" }> | Extract<ScoreEvent, { type: "rest" }>
  >,
  model: InstrumentModel,
  semitones: number,
  strategy: "source-coverage" | "economical-fingering",
  options: ArrangementOptions
): { events: ArrangementEvent[]; phraseSearchEvidence: PhraseSearchEvidence } {
  const instance = model.exactInstance();
  if (
    !instance ||
    !["baroque-guitar-5", "baroque-lute-13", "classical-guitar-6"].includes(instance.profileId)
  ) {
    throw new Error("Historical phrase search requires an exact supported Instrument Instance");
  }
  const limits = options.phraseSearch ?? {
    frontierWidth: 32,
    maximumExpandedStates: 10_000,
  };
  if (limits.frontierWidth < 1 || limits.maximumExpandedStates < 1) {
    throw new Error("Phrase-search limits must be positive integers");
  }
  const baroqueGuitar = instance.profileId === "baroque-guitar-5";
  const baroqueLute = instance.profileId === "baroque-lute-13";
  const classicalGuitar = instance.profileId === "classical-guitar-6";
  const technique = baroqueGuitar
    ? selectBaroqueGuitarTechnique(options.performanceBrief, instance)
    : baroqueLute
      ? "right_hand_thumb"
      : "right_hand_fingering_unknown";
  const styleBrise = baroqueLute
    ? styleBriseAuthorization(options.arrangementPlan, analysis)
    : {
        status: "not_applied" as const,
        planDecisionIds: [],
        historicalClaimIds: [],
        rationale: "Style brisé is not applicable to this target adapter.",
      };
  const effectiveFrontierWidth = Math.min(limits.frontierWidth, 8);
  let expandedStates = 0;
  let frontier: PhraseState[] = [
    {
      events: [],
      positions: [],
      occupiedFingers: [],
      barreFrets: [],
      heldNotes: [],
      occupiedCourses: [],
      technique,
      transitions: [],
      cost: 0,
    },
  ];

  for (const [index, sourceEvent] of principalEvents.entries()) {
    const eventId = `arrangement-event.${strategy}.${index + 1}`;
    if (sourceEvent.type === "rest") {
      frontier = frontier.map((state) => ({
        ...state,
        events: [
          ...state.events,
          {
            id: eventId,
            type: "rest",
            measureId: sourceEvent.measureId,
            onset: sourceEvent.onset,
            duration: sourceEvent.duration,
            pitches: [],
            positions: [],
            sourceEventIds: [sourceEvent.id],
          },
        ],
        heldNotes: [],
      }));
      continue;
    }

    const melodyPitch = transposeNote(sourceEvent.pitch, semitones);
    const sourceHarmony = sourceEventsAt(score, sourceEvent.measureId, sourceEvent.onset);
    const requiredParts = new Set(
      plannedActiveVoiceParts(
        options.arrangementPlan,
        sourceHarmony.map((event) => event.id)
      )
    );
    const requiredSourceEventIds = sourceHarmony
      .filter((event) => event.id !== sourceEvent.id && requiredParts.has(event.partId))
      .map((event) => event.id);
    const plannedHarmony = requiredParts.size
      ? sourceHarmony.filter((event) => requiredParts.has(event.partId))
      : sourceHarmony;
    const choices = enumerateVoicings(
      melodyPitch,
      plannedHarmony,
      model,
      semitones,
      sourceEvent.id,
      Boolean(options.arrangementPlan?.phraseObligations?.length)
    )
      .filter((choice) =>
        requiredSourceEventIds.every((sourceId) => choice.sourceEventIds.includes(sourceId))
      )
      .sort((left, right) =>
        strategy === "source-coverage"
          ? right.sourcePitchClassCoverage - left.sourcePitchClassCoverage ||
            right.openStringCount - left.openStringCount ||
            left.averageFret - right.averageFret
          : left.averageFret - right.averageFret ||
            right.sourcePitchClassCoverage - left.sourcePitchClassCoverage ||
            right.openStringCount - left.openStringCount
      )
      .slice(0, 12);
    const successors: PhraseState[] = [];
    const rejected = { principalPosition: 0, violentJump: 0, fingering: 0, voicePlan: 0 };
    for (const state of frontier) {
      for (const choice of choices) {
        expandedStates += 1;
        if (expandedStates > limits.maximumExpandedStates) {
          throw new PhraseSearchExhaustedError(
            `${instance.profileId} bounded phrase search exhausted after ${limits.maximumExpandedStates} expanded states; no impossibility claim is made`,
            expandedStates,
            limits.maximumExpandedStates
          );
        }
        const positions = annotatePhraseFingering(
          choice.positions,
          eventId,
          sourceEvent.tie === "start" ? `arrangement-event.${strategy}.${index + 2}` : undefined,
          classicalGuitar ? state.positions : [],
          classicalGuitar ? state.events.at(-1)?.id : undefined
        );
        const principalPosition = positions.find((position) =>
          model
            .soundingPitches(position.course, position.fret)
            .some((pitch) => noteToMidi(pitch) === noteToMidi(melodyPitch))
        );
        if (!principalPosition) {
          rejected.principalPosition += 1;
          continue;
        }
        const handPosition = positionCentroid(positions);
        const transition = buildPhraseTransition(
          state,
          eventId,
          principalPosition,
          positions,
          handPosition,
          technique,
          instance.profileId,
          styleBrise.status === "applied",
          sourceHarmony.map((event) => ({ voiceId: event.partId, duration: event.duration }))
        );
        if (baroqueGuitar && transition.violentCrossNeckJump) {
          rejected.violentJump += 1;
          continue;
        }
        const occupiedFingers = positions.flatMap((position) =>
          position.leftHandFinger
            ? [{ finger: position.leftHandFinger, fret: position.fret, course: position.course }]
            : []
        );
        if (!fingerOccupationIsPossible(occupiedFingers)) {
          rejected.fingering += 1;
          continue;
        }
        const voiceConstituents =
          classicalGuitar || options.arrangementPlan?.phraseObligations?.length
            ? buildTargetVoiceConstituents(
                score,
                sourceEvent,
                sourceHarmony,
                choice,
                positions,
                semitones,
                options.arrangementPlan,
                classicalGuitar
              )
            : [];
        const requiredActiveParts = plannedActiveVoiceParts(
          options.arrangementPlan,
          sourceHarmony.map((event) => event.id)
        );
        if (
          requiredActiveParts.some(
            (partId) =>
              !voiceConstituents.some((voice) => voice.voiceId === partId) &&
              !state.events.some((priorEvent) =>
                priorEvent.voiceConstituents?.some(
                  (voice) =>
                    voice.voiceId === partId && requiredSourceEventIds.includes(voice.sourceEventId)
                )
              )
          )
        ) {
          rejected.voicePlan += 1;
          continue;
        }
        if (
          options.arrangementPlan?.phraseObligations?.length &&
          hasUnplannedVoiceJump(score, state.events, voiceConstituents)
        ) {
          rejected.voicePlan += 1;
          continue;
        }
        const arranged: ArrangementEvent = {
          id: eventId,
          type: choice.pitches.length > 1 ? "chord" : "note",
          measureId: sourceEvent.measureId,
          onset: sourceEvent.onset,
          duration: sourceEvent.duration,
          pitches: choice.pitches,
          positions,
          sourceEventIds: Array.from(new Set([sourceEvent.id, ...choice.sourceEventIds])),
          principalVoiceSourceEventId: sourceEvent.id,
          ...(voiceConstituents.length ? { voiceConstituents } : {}),
          ...(classicalGuitar
            ? {
                notationSemantics: {
                  voiceId: sourceEvent.partId,
                  voiceLayer: 1,
                  stemDirection: "up" as const,
                  writtenPitches: choice.pitches.map(raiseWrittenOctave),
                  soundingPitches: choice.pitches,
                  writtenToSoundingSemitones: -12,
                  duration: sourceEvent.duration,
                  tie: sourceEvent.tie ?? ("none" as const),
                },
              }
            : {}),
        };
        successors.push({
          events: [...state.events, arranged],
          positions,
          principalPosition,
          handPosition,
          occupiedFingers,
          barreFrets: Array.from(
            new Set(
              positions.filter((position) => position.barreId).map((position) => position.fret)
            )
          ),
          heldNotes: sourceEvent.tie === "start" ? choice.pitches : [],
          occupiedCourses: positions.map((position) => position.course),
          technique,
          transitions: [...state.transitions, transition],
          cost: state.cost + phraseChoiceCost(choice, transition, strategy, state.positions),
        });
      }
    }
    if (successors.length === 0) {
      throw new PhraseSearchExhaustedError(
        `${instance.profileId} bounded phrase search found no surviving state at Principal Voice event ${sourceEvent.id} after examining ${choices.length} planned voicing(s) from ${frontier.length} state(s) (${JSON.stringify(rejected)}); no impossibility claim is made`,
        expandedStates,
        limits.maximumExpandedStates
      );
    }
    frontier = deduplicatePhraseStates(successors)
      .sort(
        (left, right) =>
          left.cost - right.cost || phraseStateKey(left).localeCompare(phraseStateKey(right))
      )
      .slice(0, effectiveFrontierWidth);
  }

  const selected = frontier.sort(
    (left, right) =>
      left.cost - right.cost || phraseStateKey(left).localeCompare(phraseStateKey(right))
  )[0]!;
  const referenceComparison = baroqueGuitar
    ? undefined
    : compareWithEventLocalFirstFit(
        selected.events,
        buildCandidateEvents(score, principalEvents, model, semitones, strategy)
      );
  return {
    events: selected.events,
    phraseSearchEvidence: {
      schemaVersion: 1,
      arrangementPlanId: options.arrangementPlan?.id,
      performanceBriefId: options.performanceBrief?.id,
      instrumentInstanceDigest: instance.contentDigest,
      completeness: "bounded",
      expandedStates,
      maximumExpandedStates: limits.maximumExpandedStates,
      frontierWidth: effectiveFrontierWidth,
      stateDimensions: baroqueGuitar
        ? [
            "left_hand_fingers",
            "barre_frets",
            "hand_position",
            "held_notes",
            "occupied_courses",
            "exact_stringing",
            "applicable_technique",
          ]
        : baroqueLute
          ? [
              "left_hand_stopped_courses",
              "right_hand_diapason_access",
              "prepared_bass_courses",
              "resonating_bass_courses",
              "damping_requirements",
              "held_notes",
              "voice_lineage",
              "exact_bass_tuning",
              "style_brise_authorization",
            ]
          : [
              "left_hand_position",
              "finger_occupation",
              "barre_frets",
              "guide_fingers",
              "sustained_positions",
              "active_voice_durations",
              "standard_notation_voices",
              "right_hand_scope_disclosure",
            ],
      techniqueApplicability: instance.techniqueApplicability.map((claim) => ({
        technique: claim.technique,
        status: claim.status,
        evidenceIds: claim.evidenceIds,
      })),
      ...(baroqueGuitar
        ? {
            bassCapability: {
              status: instance.courses.some((course) =>
                course.strings.some((string) => noteToMidi(string.openPitch) < noteToMidi("G3"))
              )
                ? ("bourdon_available" as const)
                : ("reentrant_limited" as const),
              lowestSoundingPitch: model.soundingRange().lowest,
              bourdonCourses: instance.courses
                .filter((course) =>
                  course.strings.some((string) => noteToMidi(string.openPitch) < noteToMidi("G3"))
                )
                .map((course) => course.course),
              rationale:
                "Bass claims derive from the exact constituent-string set; re-entrant courses are not treated as a complete low foundation.",
            },
          }
        : baroqueLute
          ? {
              luteTechniqueEvidence: {
                stoppedCourseCount: instance.courses.filter((course) => course.stopped).length,
                diapasonCount: instance.courses.filter((course) => !course.stopped).length,
                rightHandBassAccess: "represented" as const,
                bassPreparation: "represented" as const,
                resonance: "represented" as const,
                damping: "represented" as const,
                sustain: "represented" as const,
                voiceLineage: "represented" as const,
                styleBrise,
              },
            }
          : {
              classicalTechniqueEvidence: {
                leftHandScope: "represented" as const,
                rightHandScope: "unknown" as const,
                rightHandRationale:
                  "No right-hand fingering has been generated or evaluated; phrase feasibility is limited to represented left-hand and notation state.",
                independentVoiceDuration: "represented" as const,
                standardNotationVoices: "represented" as const,
              },
            }),
      ...(referenceComparison ? { referenceComparison } : {}),
      transitions: selected.transitions,
    },
  };
}

function compareWithEventLocalFirstFit(
  selected: ArrangementEvent[],
  reference: ArrangementEvent[]
): NonNullable<PhraseSearchEvidence["referenceComparison"]> {
  const selectedSummary = physicalMotionSummary(selected);
  const referenceSummary = physicalMotionSummary(reference);
  return {
    reference: "event_local_first_fit",
    selectedTotalMotion: selectedSummary.totalMotion,
    referenceTotalMotion: referenceSummary.totalMotion,
    selectedMaximumHandShift: selectedSummary.maximumHandShift,
    referenceMaximumHandShift: referenceSummary.maximumHandShift,
    selectedDiapasonPreparations: selectedSummary.diapasonPreparations,
    referenceDiapasonPreparations: referenceSummary.diapasonPreparations,
  };
}

function physicalMotionSummary(events: ArrangementEvent[]): {
  totalMotion: number;
  maximumHandShift: number;
  diapasonPreparations: number;
} {
  let totalMotion = 0;
  let maximumHandShift = 0;
  let diapasonPreparations = 0;
  let previous: ArrangementPosition[] = [];
  for (const event of events) {
    if (event.type === "rest") continue;
    const priorHand = positionCentroid(previous);
    const nextHand = positionCentroid(event.positions);
    const handShift = Math.abs(priorHand - nextHand);
    maximumHandShift = Math.max(maximumHandShift, handShift);
    totalMotion += transitionCost(event.positions, previous) + handShift;
    const previousCourses = new Set(previous.map((position) => position.course));
    diapasonPreparations += event.positions.filter(
      (position) => position.quality === "diapason" && !previousCourses.has(position.course)
    ).length;
    previous = event.positions;
  }
  return { totalMotion, maximumHandShift, diapasonPreparations };
}

function buildTargetVoiceConstituents(
  score: NormalizedScore,
  principalEvent: Extract<ScoreEvent, { type: "note" }>,
  soundingSourceEvents: Extract<ScoreEvent, { type: "note" }>[],
  choice: VoicingChoice,
  positions: ArrangementPosition[],
  semitones: number,
  plan: ArrangementPlan | undefined,
  classicalGuitar: boolean
): NonNullable<ArrangementEvent["voiceConstituents"]> {
  const plannedParts = plannedActiveVoiceParts(
    plan,
    soundingSourceEvents.map((event) => event.id)
  );
  const orderedPartIds = plannedParts.length
    ? [principalEvent.partId, ...plannedParts.filter((id) => id !== principalEvent.partId)]
    : [
        principalEvent.partId,
        ...Array.from(
          new Set(
            score.events.flatMap((event) =>
              event.type === "note" && event.partId !== principalEvent.partId ? [event.partId] : []
            )
          )
        ),
      ].slice(0, 4);
  const usedCourses = new Set<number>();
  const retainedSources = orderedPartIds.flatMap((partId) => {
    if (partId === principalEvent.partId) return [principalEvent];
    const event = soundingSourceEvents.find(
      (candidate) =>
        candidate.partId === partId &&
        choice.sourceEventIds.includes(candidate.id) &&
        compareRational(candidate.onset, principalEvent.onset) === 0
    );
    return event ? [event] : [];
  });
  const constituents = retainedSources.flatMap((source) => {
    const desired = transposeNote(source.pitch, semitones);
    const desiredMidi = noteToMidi(desired);
    const positionIndex = positions.findIndex((position) => {
      if (usedCourses.has(position.course)) return false;
      return source.id === principalEvent.id
        ? noteToMidi(position.pitch) === desiredMidi
        : noteToMidi(position.pitch) % 12 === desiredMidi % 12;
    });
    if (positionIndex < 0) return [];
    const position = positions[positionIndex]!;
    const pitch = respellAtPhysicalOctave(desired, position.pitch);
    usedCourses.add(position.course);
    const voiceLayer = Math.max(1, orderedPartIds.indexOf(source.partId) + 1);
    return [
      {
        id: `voice-constituent.${source.id}`,
        sourceEventId: source.id,
        voiceId: source.partId,
        role:
          source.id === principalEvent.id
            ? ("principal_voice" as const)
            : ("source_voice" as const),
        pitch,
        position,
        onset: source.onset,
        duration: source.duration,
        voiceLayer,
        stemDirection: source.id === principalEvent.id ? ("up" as const) : ("down" as const),
        writtenPitch: classicalGuitar ? raiseWrittenOctave(pitch) : pitch,
        writtenToSoundingSemitones: classicalGuitar ? -12 : 0,
        tie: source.tie ?? ("none" as const),
      },
    ];
  });
  if (!constituents.some((constituent) => constituent.role === "principal_voice")) {
    throw new Error(`Phrase state lost Principal Voice ${principalEvent.id}`);
  }
  return constituents;
}

function plannedActiveVoiceParts(
  plan: ArrangementPlan | undefined,
  sourceEventIds: string[]
): string[] {
  const active = new Set(sourceEventIds);
  return (plan?.phraseObligations ?? []).flatMap((obligation) =>
    obligation.targetVoices.flatMap((voice) =>
      voice.sourceEventIds.some((id) => active.has(id)) ? [voice.sourcePartId] : []
    )
  );
}

function hasUnplannedVoiceJump(
  score: NormalizedScore,
  priorEvents: ArrangementEvent[],
  current: NonNullable<ArrangementEvent["voiceConstituents"]>
): boolean {
  return current.some((voice) => {
    if (voice.role === "principal_voice") return false;
    const prior = priorEvents
      .flatMap((event) => event.voiceConstituents ?? [])
      .filter((candidate) => candidate.voiceId === voice.voiceId)
      .at(-1);
    if (!prior) return false;
    const sourcePrior = score.events.find(
      (event): event is Extract<ScoreEvent, { type: "note" }> =>
        event.id === prior.sourceEventId && event.type === "note"
    );
    const sourceCurrent = score.events.find(
      (event): event is Extract<ScoreEvent, { type: "note" }> =>
        event.id === voice.sourceEventId && event.type === "note"
    );
    if (!sourcePrior || !sourceCurrent) return true;
    const sourceMotion = noteToMidi(sourceCurrent.pitch) - noteToMidi(sourcePrior.pitch);
    const targetMotion = noteToMidi(voice.pitch) - noteToMidi(prior.pitch);
    return Math.abs(targetMotion) > Math.max(12, Math.abs(sourceMotion) + 7);
  });
}

function respellAtPhysicalOctave(desired: string, physical: string): string {
  const desiredMatch = desired.match(/^([A-G](?:#|b)?)-?\d+$/);
  const physicalMatch = physical.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!desiredMatch || !physicalMatch) {
    throw new Error(`Cannot preserve canonical spelling ${desired} at physical pitch ${physical}`);
  }
  return `${desiredMatch[1]}${physicalMatch[2]}`;
}

function annotatePhraseFingering(
  positions: ArrangementPosition[],
  eventId: string,
  sustainThroughEventId: string | undefined,
  previous: ArrangementPosition[] = [],
  previousEventId?: string
): ArrangementPosition[] {
  const fretted = positions.filter((position) => position.fret > 0);
  const handPosition = fretted.length ? Math.min(...fretted.map((position) => position.fret)) : 1;
  const fretCounts = new Map<number, number>();
  for (const position of fretted) {
    fretCounts.set(position.fret, (fretCounts.get(position.fret) ?? 0) + 1);
  }
  return positions.map((position) => {
    if (position.fret === 0) return position;
    const barred = (fretCounts.get(position.fret) ?? 0) > 1;
    const leftHandFinger = barred ? 1 : Math.max(1, Math.min(4, position.fret - handPosition + 1));
    const guide = previous.find(
      (candidate) =>
        candidate.course === position.course && candidate.leftHandFinger === leftHandFinger
    );
    return {
      ...position,
      leftHandFinger,
      handPosition,
      ...(barred ? { barreId: `barre.${eventId}.${position.fret}` } : {}),
      ...(guide && previousEventId ? { guideFromPreviousEventId: previousEventId } : {}),
      ...(sustainThroughEventId ? { sustainThroughEventId } : {}),
    };
  });
}

function buildPhraseTransition(
  state: PhraseState,
  toEventId: string,
  principalTo: ArrangementPosition,
  positions: ArrangementPosition[],
  handPositionTo: number,
  technique: string,
  profileId: string,
  styleBriseApplied: boolean,
  activeVoiceDurations: Array<{ voiceId: string; duration: Rational }>
): PhraseSearchEvidence["transitions"][number] {
  const previousCourses = new Set(state.occupiedCourses);
  const nextCourses = new Set(positions.map((position) => position.course));
  const fretDisplacement = state.principalPosition
    ? Math.abs(state.principalPosition.fret - principalTo.fret)
    : principalTo.fret;
  const courseDisplacement = state.principalPosition
    ? Math.abs(state.principalPosition.course - principalTo.course)
    : 0;
  const diapasonCourses = positions
    .filter((position) => position.quality === "diapason")
    .map((position) => position.course)
    .sort((left, right) => left - right);
  const priorDiapasons = state.positions
    .filter((position) => position.quality === "diapason")
    .map((position) => position.course);
  const stoppedCourseFretDelta = positions
    .filter((position) => position.quality !== "diapason")
    .reduce((maximum, position) => {
      const prior = state.positions.find(
        (candidate) => candidate.course === position.course && candidate.quality !== "diapason"
      );
      return Math.max(maximum, prior ? Math.abs(prior.fret - position.fret) : position.fret);
    }, 0);
  return {
    fromEventId: state.events.at(-1)?.id,
    toEventId,
    principalFrom: state.principalPosition
      ? { course: state.principalPosition.course, fret: state.principalPosition.fret }
      : undefined,
    principalTo: { course: principalTo.course, fret: principalTo.fret },
    fretDisplacement,
    courseDisplacement,
    handPositionFrom: state.handPosition,
    handPositionTo,
    handPositionDelta:
      state.handPosition === undefined
        ? handPositionTo
        : Math.abs(state.handPosition - handPositionTo),
    retainedCourses: [...nextCourses].filter((course) => previousCourses.has(course)).sort(),
    introducedCourses: [...nextCourses].filter((course) => !previousCourses.has(course)).sort(),
    releasedCourses: [...previousCourses].filter((course) => !nextCourses.has(course)).sort(),
    heldPitchCount: state.heldNotes.length,
    barreChanged:
      state.barreFrets.join(",") !==
      Array.from(
        new Set(positions.filter((position) => position.barreId).map((position) => position.fret))
      ).join(","),
    technique,
    violentCrossNeckJump: state.principalPosition
      ? isViolentCrossNeckJump(state.principalPosition, principalTo)
      : false,
    ...(profileId === "baroque-lute-13"
      ? {
          stoppedCourseFretDelta,
          diapasonCourses,
          preparedBassCourses: diapasonCourses.filter(
            (course) => !state.occupiedCourses.includes(course)
          ),
          resonatingBassCourses: priorDiapasons.filter((course) => nextCourses.has(course)),
          dampingRequiredCourses: priorDiapasons.filter((course) => !nextCourses.has(course)),
          rightHandBassAccessCount: diapasonCourses.length,
          styleBriseApplied,
        }
      : {}),
    ...(profileId === "classical-guitar-6"
      ? {
          activeVoiceDurations,
          guideFingerCount: positions.filter((position) => position.guideFromPreviousEventId)
            .length,
          sustainedPositionCount: positions.filter((position) => position.sustainThroughEventId)
            .length,
        }
      : {}),
  };
}

function phraseChoiceCost(
  choice: VoicingChoice,
  transition: PhraseSearchEvidence["transitions"][number],
  strategy: "source-coverage" | "economical-fingering",
  previousPositions: ArrangementPosition[]
): number {
  const fullPositionMotion = transitionCost(choice.positions, previousPositions);
  const movement =
    fullPositionMotion +
    transition.fretDisplacement +
    transition.courseDisplacement * 0.75 +
    transition.handPositionDelta * 1.5 +
    (transition.barreChanged ? 0.5 : 0);
  return strategy === "source-coverage"
    ? movement + (1 - choice.sourcePitchClassCoverage) * 12 - choice.openStringCount * 0.25
    : movement +
        choice.averageFret * 0.2 +
        (1 - choice.sourcePitchClassCoverage) * 0.5 +
        choice.positions.length * 0.75;
}

function positionCentroid(positions: ArrangementPosition[]): number {
  const fretted = positions.filter((position) => position.fret > 0);
  return fretted.length === 0
    ? 0
    : fretted.reduce((sum, position) => sum + position.fret, 0) / fretted.length;
}

function fingerOccupationIsPossible(
  occupied: Array<{ finger: number; fret: number; course: number }>
): boolean {
  const fretByFinger = new Map<number, number>();
  for (const item of occupied) {
    const fret = fretByFinger.get(item.finger);
    if (fret !== undefined && fret !== item.fret) return false;
    fretByFinger.set(item.finger, item.fret);
  }
  return true;
}

function deduplicatePhraseStates(states: PhraseState[]): PhraseState[] {
  const byKey = new Map<string, PhraseState>();
  for (const state of states) {
    const key = phraseStateKey(state);
    const prior = byKey.get(key);
    if (!prior || state.cost < prior.cost) byKey.set(key, state);
  }
  return [...byKey.values()];
}

function phraseStateKey(state: PhraseState): string {
  return [
    state.positions
      .map((position) => `${position.course}:${position.fret}`)
      .sort()
      .join("|"),
    state.occupiedFingers
      .map((item) => `${item.finger}:${item.fret}:${item.course}`)
      .sort()
      .join("|"),
    state.barreFrets.join(","),
    state.heldNotes.join(","),
    state.technique,
  ].join(";");
}

function selectBaroqueGuitarTechnique(
  brief: PerformanceBrief | undefined,
  instance: NonNullable<ReturnType<InstrumentModel["exactInstance"]>>
): string {
  const allowed =
    brief?.techniqueContext.status === "specified" ? brief.techniqueContext.allowed : [];
  const avoided =
    brief?.techniqueContext.status === "specified" ? brief.techniqueContext.avoided : [];
  const applicable = instance.techniqueApplicability.filter(
    (claim) => claim.status === "applicable"
  );
  const preferred = allowed.find(
    (technique) =>
      !avoided.includes(technique) && applicable.some((claim) => claim.technique === technique)
  );
  if (preferred) return preferred;
  if (!avoided.includes("punteado") && applicable.some((claim) => claim.technique === "punteado")) {
    return "punteado";
  }
  return "technique_unspecified";
}

export function styleBriseAuthorization(
  plan: ArrangementPlan | undefined,
  analysis: AnalysisRecord
): NonNullable<PhraseSearchEvidence["luteTechniqueEvidence"]>["styleBrise"] {
  assertAuthorityPathRuntime("authority.ranker.plucked-string-arrangement", "production");
  const planDecisions = (plan?.decisions ?? []).filter((decision) =>
    `${decision.dimension} ${decision.selectedValue}`.toLowerCase().match(/style[_ -]?bris/)
  );
  const historicalClaims = analysis.claims.filter(
    (claim) =>
      `${claim.kind} ${claim.statement}`.toLowerCase().match(/style[_ -]?bris/) &&
      claim.evidence?.some((evidence) => evidence.kind === "historical_profile")
  );
  const supportedPairs = planDecisions.flatMap((decision) =>
    historicalClaims
      .filter((claim) => styleContextsOverlap(decision, claim))
      .map((claim) => ({ decisionId: decision.id, claimId: claim.id }))
  );
  const planDecisionIds = [...new Set(supportedPairs.map((pair) => pair.decisionId))];
  const historicalClaimIds = [...new Set(supportedPairs.map((pair) => pair.claimId))];
  const applied = planDecisionIds.length > 0 && historicalClaimIds.length > 0;
  return {
    status: applied ? "applied" : "not_applied",
    planDecisionIds,
    historicalClaimIds,
    rationale: applied
      ? "Style brisé is authorized by both an exact Plan Decision and historical-profile evidence for this scope."
      : "Style brisé is not applied without both an exact Plan Decision and historical-profile evidence for this scope.",
  };
}

function styleContextsOverlap(
  decision: ArrangementPlan["decisions"][number],
  claim: AnalysisRecord["claims"][number]
): boolean {
  if (!claim.scope) return true;
  const decisionEvents = new Set(decision.scope.eventIds);
  const decisionMeasures = new Set(decision.scope.measureIds);
  if (decisionEvents.size === 0 && decisionMeasures.size === 0) return true;
  return (
    claim.scope.eventIds.some((id) => decisionEvents.has(id)) ||
    claim.scope.measureIds.some((id) => decisionMeasures.has(id))
  );
}

function buildCandidateEvents(
  score: NormalizedScore,
  principalEvents: Array<
    Extract<ScoreEvent, { type: "note" }> | Extract<ScoreEvent, { type: "rest" }>
  >,
  model: InstrumentModel,
  semitones: number,
  strategy: "source-coverage" | "economical-fingering"
): ArrangementEvent[] {
  const result: ArrangementEvent[] = [];
  let previousPositions: VoicingChoice["positions"] = [];
  let previousSoundingEventId: string | undefined;

  for (const [index, sourceEvent] of principalEvents.entries()) {
    if (sourceEvent.type === "rest") {
      result.push({
        id: `arrangement-event.${strategy}.${index + 1}`,
        type: "rest",
        measureId: sourceEvent.measureId,
        onset: sourceEvent.onset,
        duration: sourceEvent.duration,
        pitches: [],
        positions: [],
        sourceEventIds: [sourceEvent.id],
      });
      previousPositions = [];
      previousSoundingEventId = undefined;
      continue;
    }

    const melodyPitch = transposeNote(sourceEvent.pitch, semitones);
    const soundingSourceEvents = sourceEventsAt(score, sourceEvent.measureId, sourceEvent.onset);
    const enumerated = enumerateVoicings(
      melodyPitch,
      soundingSourceEvents,
      model,
      semitones,
      sourceEvent.id
    );
    const choices =
      model.exactInstance()?.profileId === "classical-guitar-6"
        ? enumerated.filter(classicalGuitarFingeringFeasible)
        : enumerated;
    const ranked = choices.sort((left, right) =>
      strategy === "source-coverage"
        ? right.sourcePitchClassCoverage - left.sourcePitchClassCoverage ||
          right.openStringCount - left.openStringCount ||
          left.averageFret - right.averageFret
        : transitionCost(left.positions, previousPositions) -
            transitionCost(right.positions, previousPositions) ||
          right.sourcePitchClassCoverage - left.sourcePitchClassCoverage
    );
    const choice = ranked[0];
    if (!choice) throw new Error(`No playable voicing for Principal Voice event ${sourceEvent.id}`);
    const eventId = `arrangement-event.${strategy}.${index + 1}`;
    const positions =
      model.exactInstance()?.profileId === "classical-guitar-6"
        ? annotateClassicalGuitarFingering(
            choice.positions,
            previousPositions,
            eventId,
            previousSoundingEventId,
            sourceEvent.tie === "start" ? `arrangement-event.${strategy}.${index + 2}` : undefined
          )
        : choice.positions;
    const arranged: ArrangementEvent = {
      id: eventId,
      type: choice.pitches.length > 1 ? "chord" : "note",
      measureId: sourceEvent.measureId,
      onset: sourceEvent.onset,
      duration: sourceEvent.duration,
      pitches: choice.pitches,
      positions,
      sourceEventIds: Array.from(new Set([sourceEvent.id, ...choice.sourceEventIds])),
      principalVoiceSourceEventId: sourceEvent.id,
      ...(model.exactInstance()?.profileId === "classical-guitar-6"
        ? {
            notationSemantics: {
              voiceId: sourceEvent.partId,
              voiceLayer: 1,
              stemDirection: "up" as const,
              writtenPitches: choice.pitches.map(raiseWrittenOctave),
              soundingPitches: choice.pitches,
              writtenToSoundingSemitones: -12,
              duration: sourceEvent.duration,
              tie: sourceEvent.tie ?? ("none" as const),
            },
          }
        : {}),
    };
    result.push(arranged);
    previousPositions = positions;
    previousSoundingEventId = eventId;
  }

  return result;
}

function annotateClassicalGuitarFingering(
  positions: ArrangementPosition[],
  previous: ArrangementPosition[],
  eventId: string,
  previousEventId: string | undefined,
  sustainThroughEventId: string | undefined
): ArrangementPosition[] {
  const fretted = positions.filter((position) => position.fret > 0);
  const handPosition = fretted.length ? Math.min(...fretted.map((position) => position.fret)) : 1;
  const fretCounts = new Map<number, number>();
  for (const position of fretted) {
    fretCounts.set(position.fret, (fretCounts.get(position.fret) ?? 0) + 1);
  }
  return positions.map((position) => {
    if (position.fret === 0) {
      return sustainThroughEventId ? { ...position, sustainThroughEventId } : position;
    }
    const barred = (fretCounts.get(position.fret) ?? 0) > 1;
    const leftHandFinger = barred ? 1 : Math.max(1, Math.min(4, position.fret - handPosition + 1));
    const prior = previous.find(
      (candidate) =>
        candidate.course === position.course && candidate.leftHandFinger === leftHandFinger
    );
    return {
      ...position,
      leftHandFinger,
      handPosition,
      ...(barred ? { barreId: `barre.${eventId}.${position.fret}` } : {}),
      ...(prior && previousEventId ? { guideFromPreviousEventId: previousEventId } : {}),
      ...(sustainThroughEventId ? { sustainThroughEventId } : {}),
    };
  });
}

function classicalGuitarFingeringFeasible(choice: VoicingChoice): boolean {
  const annotated = annotateClassicalGuitarFingering(
    choice.positions,
    [],
    "event.feasibility",
    undefined,
    undefined
  );
  const occupied = new Map<number, number>();
  for (const position of annotated) {
    if (!position.leftHandFinger) continue;
    const priorFret = occupied.get(position.leftHandFinger);
    if (priorFret !== undefined && priorFret !== position.fret) return false;
    occupied.set(position.leftHandFinger, position.fret);
  }
  return true;
}

function enumerateVoicings(
  melodyPitch: string,
  sourceEvents: Extract<ScoreEvent, { type: "note" }>[],
  model: InstrumentModel,
  semitones: number,
  principalSourceEventId: string,
  preserveSourceVoiceIdentity = false
): VoicingChoice[] {
  const melodyMidi = noteToMidi(melodyPitch);
  const melodyPositions = principalPositions(model, melodyPitch);
  const sourceByPitchClass = new Map<number, Array<Extract<ScoreEvent, { type: "note" }>>>();
  for (const event of sourceEvents) {
    if (event.id === principalSourceEventId) continue;
    const pitchClass = noteToMidi(transposeNote(event.pitch, semitones)) % 12;
    if (!preserveSourceVoiceIdentity && pitchClass === melodyMidi % 12) continue;
    const key = preserveSourceVoiceIdentity
      ? noteToMidi(transposeNote(event.pitch, semitones)) * 10_000 + sourceEvents.indexOf(event)
      : pitchClass;
    sourceByPitchClass.set(key, [...(sourceByPitchClass.get(key) ?? []), event]);
  }
  const accompanimentOptions = [...sourceByPitchClass.entries()].map(([key, events]) => {
    const pitchClass = preserveSourceVoiceIdentity
      ? noteToMidi(transposeNote(events[0]!.pitch, semitones)) % 12
      : key;
    return {
      events,
      positions: playablePitchClassPositions(pitchClass, melodyMidi, model),
    };
  });
  const totalSourceVoices = accompanimentOptions.filter(
    (option) => option.positions.length > 0
  ).length;
  const results: VoicingChoice[] = [];

  for (const melodyPosition of melodyPositions) {
    const base = [{ ...melodyPosition, pitch: melodyPitch }];
    enumerateAccompaniment(0, accompanimentOptions, base, [], []);
  }

  function enumerateAccompaniment(
    optionIndex: number,
    options: typeof accompanimentOptions,
    positions: VoicingChoice["positions"],
    pitches: string[],
    sourceIds: string[]
  ): void {
    if (optionIndex >= options.length || positions.length >= 4) {
      if (!model.isPlayable(positions).ok) return;
      const soundedPitches = positions.flatMap((position) =>
        model.soundingPitches(position.course, position.fret)
      );
      if (!soundedPitches.some((pitch) => noteToMidi(pitch) === melodyMidi)) return;
      let melodySpellingRetained = false;
      const physicalPitches = soundedPitches.map((pitch) => {
        if (!melodySpellingRetained && noteToMidi(pitch) === melodyMidi) {
          melodySpellingRetained = true;
          return melodyPitch;
        }
        return pitch;
      });
      if (physicalPitches.some((pitch) => noteToMidi(pitch) > melodyMidi)) return;
      results.push({
        pitches: physicalPitches,
        positions,
        sourceEventIds: sourceIds,
        sourcePitchClassCoverage:
          totalSourceVoices === 0 ? 1 : new Set(sourceIds).size / totalSourceVoices,
        averageFret: positions.reduce((sum, position) => sum + position.fret, 0) / positions.length,
        openStringCount: positions.filter((position) => position.fret === 0).length,
      });
      return;
    }

    enumerateAccompaniment(optionIndex + 1, options, positions, pitches, sourceIds);
    const option = options[optionIndex]!;
    for (const position of option.positions) {
      if (positions.some((existing) => existing.course === position.course)) continue;
      enumerateAccompaniment(
        optionIndex + 1,
        options,
        [...positions, position],
        [...pitches, position.pitch],
        [...sourceIds, ...option.events.map((event) => event.id)]
      );
    }
  }

  return deduplicateVoicings(results);
}

function principalPositions(model: InstrumentModel, pitch: string) {
  const midi = noteToMidi(pitch);
  return model.positionsForPitch(pitch).filter((position) => {
    const sounded = model.soundingPitches(position.course, position.fret).map(noteToMidi);
    return sounded.includes(midi) && Math.max(...sounded) <= midi;
  });
}

function playablePitchClassPositions(
  pitchClass: number,
  melodyMidi: number,
  model: InstrumentModel
): VoicingChoice["positions"] {
  const positions: VoicingChoice["positions"] = [];
  for (let midi = noteToMidi(model.soundingRange().lowest); midi <= melodyMidi; midi += 1) {
    if (midi % 12 !== pitchClass) continue;
    const pitch = midiToNote(midi);
    for (const position of model.positionsForPitch(pitch)) positions.push({ ...position, pitch });
  }
  return positions;
}

function sourceEventsAt(
  score: NormalizedScore,
  measureId: string,
  onset: Rational
): Extract<ScoreEvent, { type: "note" }>[] {
  return score.events.flatMap((event) => {
    if (event.type !== "note" || event.measureId !== measureId) return [];
    const eventEnd = addRational(event.onset, event.duration);
    return compareRational(event.onset, onset) <= 0 && compareRational(onset, eventEnd) < 0
      ? [event]
      : [];
  });
}

function candidateMetrics(events: ArrangementEvent[]): ArrangementCandidate["metrics"] {
  const sounding = events.filter((event) => event.positions.length > 0);
  const positions = sounding.flatMap((event) => event.positions);
  const coveredSources = new Set(sounding.flatMap((event) => event.sourceEventIds));
  const harmonySources = sounding.reduce(
    (total, event) => total + Math.max(0, event.sourceEventIds.length - 1),
    0
  );
  return {
    sourcePitchClassCoverage:
      harmonySources === 0
        ? 1
        : Math.min(1, (coveredSources.size - sounding.length) / harmonySources),
    averageFret:
      positions.length === 0
        ? 0
        : positions.reduce((sum, position) => sum + position.fret, 0) / positions.length,
    openStringCount: positions.filter((position) => position.fret === 0).length,
  };
}

function deduplicateVoicings(choices: VoicingChoice[]): VoicingChoice[] {
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key =
      choice.positions
        .slice()
        .sort((left, right) => left.course - right.course)
        .map((position) => `${position.course}:${position.fret}`)
        .join("|") + `;${choice.sourceEventIds.slice().sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function transitionCost(
  positions: VoicingChoice["positions"],
  previous: VoicingChoice["positions"]
): number {
  if (previous.length === 0) return positions.reduce((sum, position) => sum + position.fret, 0);
  return positions.reduce((sum, position) => {
    const sameCourse = previous.find((candidate) => candidate.course === position.course);
    return sum + (sameCourse ? Math.abs(sameCourse.fret - position.fret) : position.fret + 1);
  }, 0);
}

function transposeKey(key: string | undefined, semitones: number): string | undefined {
  if (!key) return undefined;
  const match = key.match(/^([A-G](?:#|b)?)\s+(major|minor)$/);
  if (!match) return key;
  const tonic = transposeNote(`${match[1]}4`, semitones).replace(/-?\d+$/, "");
  return `${tonic} ${match[2]}`;
}

function raiseWrittenOctave(pitch: string): string {
  const match = pitch.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match) throw new Error(`Invalid canonical pitch spelling: ${pitch}`);
  return `${match[1]}${Number(match[2]) + 1}`;
}
