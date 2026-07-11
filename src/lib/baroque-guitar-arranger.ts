import { InstrumentModel } from "./instrument-model.js";
import type {
  AnalysisRecord,
  ArrangementCandidate,
  ArrangementEvent,
  ArrangementScore,
  NormalizedScore,
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
};

export type ArrangementSearchResult = {
  candidates: ArrangementCandidate[];
  selected: ArrangementScore;
};

type VoicingChoice = {
  pitches: string[];
  positions: {
    course: number;
    fret: number;
    pitch: string;
    quality: "open" | "low_fret" | "high_fret" | "diapason";
  }[];
  sourceEventIds: string[];
  sourcePitchClassCoverage: number;
  averageFret: number;
  openStringCount: number;
};

export function arrangeFaithfulPluckedString(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: ArrangementOptions
): ArrangementSearchResult {
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
  const plan = chooseTranspositionPlan(score, principalEvents, model);
  const strategies = ["source-coverage", "economical-fingering"] as const;
  const candidates: ArrangementCandidate[] = strategies.map((strategy) => {
    const events = buildCandidateEvents(score, principalEvents, model, plan.semitones, strategy);
    const audit = applyPreservationPolicy(
      auditFaithfulPrincipalVoice(score, analysis, events, plan.semitones),
      options.preservationPolicy ?? "faithful_reduction"
    );
    const metrics = candidateMetrics(events);
    return {
      id: `candidate.${strategy}`,
      strategy,
      status: audit.status === "fail" ? ("rejected" as const) : ("survived" as const),
      events,
      audit,
      metrics,
    };
  });
  const survivors = candidates.filter((candidate) => candidate.status === "survived");
  if (survivors.length === 0)
    throw new Error(
      `No ${options.targetConfiguration.instrumentId} candidate passed Preservation Audit`
    );
  const policy = options.preservationPolicy ?? "faithful_reduction";
  survivors.sort((left, right) => {
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
      left.metrics.averageFret - right.metrics.averageFret ||
      right.metrics.openStringCount - left.metrics.openStringCount
    );
  });
  const selectedCandidate = survivors[0]!;
  selectedCandidate.status = "selected";
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

export function arrangeFaithfulBaroqueGuitar(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: ArrangementOptions
): ArrangementSearchResult {
  if (options.targetConfiguration.instrumentId !== "baroque-guitar-5") {
    throw new Error("Baroque-guitar arrangement requires target instrument baroque-guitar-5");
  }
  return arrangeFaithfulPluckedString(score, analysis, model, options);
}

export function auditFaithfulPrincipalVoice(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  arrangedEvents: ArrangementEvent[],
  transpositionSemitones: number
): PreservationAudit {
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

  return {
    status: findings.some((finding) => finding.severity === "hard") ? "fail" : "pass",
    targetIds: analysis.preservationTargets.map((candidate) => candidate.id),
    findings,
  };
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

function chooseTranspositionPlan(
  score: NormalizedScore,
  principalEvents: ScoreEvent[],
  model: InstrumentModel
): ArrangementScore["transpositionPlan"] {
  const notes = principalEvents.filter(
    (event): event is Extract<ScoreEvent, { type: "note" }> => event.type === "note"
  );
  const preferredIntervals = [0, -5, 5, -7, 7, -2, -3];
  const semitones = preferredIntervals.find((interval) =>
    notes.every((event) => model.positionsForPitch(transposeNote(event.pitch, interval)).length > 0)
  );
  if (semitones === undefined) {
    throw new Error(
      "Principal Voice cannot fit the target instrument range under a uniform transposition"
    );
  }
  return {
    sourceKey: score.key,
    targetKey: transposeKey(score.key, semitones),
    semitones,
    rationale:
      semitones === 0
        ? "The source key fits the complete Principal Voice on the target instrument."
        : `Uniformly transpose ${semitones} semitones so every Principal Voice event is playable while preserving intervals and rhythm.`,
  };
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
      continue;
    }

    const melodyPitch = transposeNote(sourceEvent.pitch, semitones);
    const soundingSourceEvents = sourceEventsAt(score, sourceEvent.measureId, sourceEvent.onset);
    const choices = enumerateVoicings(melodyPitch, soundingSourceEvents, model, semitones);
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
    const arranged: ArrangementEvent = {
      id: `arrangement-event.${strategy}.${index + 1}`,
      type: choice.pitches.length > 1 ? "chord" : "note",
      measureId: sourceEvent.measureId,
      onset: sourceEvent.onset,
      duration: sourceEvent.duration,
      pitches: choice.pitches,
      positions: choice.positions,
      sourceEventIds: Array.from(new Set([sourceEvent.id, ...choice.sourceEventIds])),
      principalVoiceSourceEventId: sourceEvent.id,
    };
    result.push(arranged);
    previousPositions = choice.positions;
  }

  return result;
}

function enumerateVoicings(
  melodyPitch: string,
  sourceEvents: Extract<ScoreEvent, { type: "note" }>[],
  model: InstrumentModel,
  semitones: number
): VoicingChoice[] {
  const melodyMidi = noteToMidi(melodyPitch);
  const melodyPositions = model.positionsForPitch(melodyPitch);
  const sourceByPitchClass = new Map<number, Extract<ScoreEvent, { type: "note" }>[]>();
  for (const event of sourceEvents) {
    const transposed = transposeNote(event.pitch, semitones);
    const pitchClass = noteToMidi(transposed) % 12;
    if (pitchClass === melodyMidi % 12) continue;
    const entries = sourceByPitchClass.get(pitchClass) ?? [];
    entries.push(event);
    sourceByPitchClass.set(pitchClass, entries);
  }
  const accompanimentOptions = [...sourceByPitchClass.entries()].map(([pitchClass, events]) => ({
    events,
    positions: playablePitchClassPositions(pitchClass, melodyMidi, model),
  }));
  const totalPitchClasses = accompanimentOptions.filter(
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
      const allPitches = [melodyPitch, ...pitches];
      if (allPitches.some((pitch) => noteToMidi(pitch) > melodyMidi)) return;
      results.push({
        pitches: allPitches,
        positions,
        sourceEventIds: sourceIds,
        sourcePitchClassCoverage:
          totalPitchClasses === 0
            ? 1
            : new Set(pitches.map((pitch) => noteToMidi(pitch) % 12)).size / totalPitchClasses,
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
    const key = choice.positions
      .slice()
      .sort((left, right) => left.course - right.course)
      .map((position) => `${position.course}:${position.fret}`)
      .join("|");
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
