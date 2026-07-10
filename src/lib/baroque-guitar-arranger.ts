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

type ArrangementOptions = {
  arrangementId: string;
  createdAt: string;
  targetConfiguration: TargetConfiguration;
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

export function arrangeFaithfulBaroqueGuitar(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: ArrangementOptions
): ArrangementSearchResult {
  if (options.targetConfiguration.instrumentId !== "baroque-guitar-5") {
    throw new Error("Baroque-guitar arranger requires target instrument baroque-guitar-5");
  }
  const target = analysis.preservationTargets.find(
    (candidate) => candidate.kind === "principal_voice"
  );
  if (!target?.partId)
    throw new Error("Faithful baroque-guitar arrangement requires a Principal Voice target");
  const principalEvents = score.events.filter((event) => event.partId === target.partId);
  const plan = chooseTranspositionPlan(score, principalEvents, model);
  const strategies = ["source-coverage", "economical-fingering"] as const;
  const candidates: ArrangementCandidate[] = strategies.map((strategy) => {
    const events = buildCandidateEvents(score, principalEvents, model, plan.semitones, strategy);
    const audit = auditFaithfulPrincipalVoice(score, analysis, events, plan.semitones);
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
    throw new Error("No baroque-guitar candidate passed Preservation Audit");
  survivors.sort(
    (left, right) =>
      right.metrics.sourcePitchClassCoverage - left.metrics.sourcePitchClassCoverage ||
      left.metrics.averageFret - right.metrics.averageFret ||
      right.metrics.openStringCount - left.metrics.openStringCount
  );
  const selectedCandidate = survivors[0]!;
  selectedCandidate.status = "selected";
  const transformationReport = buildTransformationReport(
    score,
    selectedCandidate.events,
    target.eventIds,
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
      preservationPolicy: "faithful_reduction",
      events: selectedCandidate.events,
      transformationReport,
      preservationAudit: selectedCandidate.audit,
      createdAt: options.createdAt,
    },
  };
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
  }

  return {
    status: findings.some((finding) => finding.severity === "hard") ? "fail" : "pass",
    targetIds: [target.id],
    findings,
  };
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
      "Principal Voice cannot fit the five-course baroque-guitar range under a uniform transposition"
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
  principalEvents: ScoreEvent[],
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
  for (let midi = noteToMidi("G3"); midi <= melodyMidi; midi += 1) {
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

function buildTransformationReport(
  score: NormalizedScore,
  arrangedEvents: ArrangementEvent[],
  protectedEventIds: string[],
  semitones: number
): ArrangementScore["transformationReport"] {
  return score.events.map((sourceEvent) => {
    const descendants = arrangedEvents.filter((event) =>
      event.sourceEventIds.includes(sourceEvent.id)
    );
    if (descendants.length === 0) {
      return {
        sourceEventId: sourceEvent.id,
        arrangementEventIds: [],
        classification: "omitted" as const,
        rationale:
          "Inner source material yielded to Principal Voice preservation and target playability.",
      };
    }
    const protectedEvent = protectedEventIds.includes(sourceEvent.id);
    return {
      sourceEventId: sourceEvent.id,
      arrangementEventIds: descendants.map((event) => event.id),
      classification: protectedEvent
        ? semitones === 0
          ? ("retained" as const)
          : ("transposed" as const)
        : ("revoiced" as const),
      rationale: protectedEvent
        ? "Principal Voice event retained under the uniform Transposition Plan."
        : "Source harmony pitch class retained in a playable target-instrument register.",
    };
  });
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
