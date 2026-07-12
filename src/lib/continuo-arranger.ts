import { Key } from "tonal";
import { InstrumentModel } from "./instrument-model.js";
import type {
  AnalysisRecord,
  ArrangementCandidate,
  ArrangementEvent,
  ArrangementScore,
  NormalizedScore,
  PreservationAudit,
  ScoreEvent,
  TargetConfiguration,
} from "./music-domain.js";
import { compareRational } from "./music-domain.js";
import { noteToMidi, parsePitch, transposeNote } from "./pitch.js";
import { buildCompleteTransformationReport } from "./transformation-report.js";
import { applyPreservationPolicy, type PreservationPolicy } from "./preservation-policy.js";

type ContinuoArrangementOptions = {
  arrangementId: string;
  createdAt: string;
  targetConfiguration: TargetConfiguration;
  targetInstrument?: InstrumentModel;
  preservationPolicy?: PreservationPolicy;
  allowedStrategies?: ContinuoStrategy[];
};

type ContinuoStrategy =
  | "complete-realization"
  | "lean-realization"
  | "separate-bass-realization"
  | "continuo-reduction";

export type ContinuoSearchResult = {
  candidates: ArrangementCandidate[];
  selected: ArrangementScore;
};

export function arrangeContinuo(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  options: ContinuoArrangementOptions
): ContinuoSearchResult {
  const profileId = options.targetConfiguration.realizationProfileId;
  if (!profileId) throw new Error("Continuo Realization requires an explicit Realization Profile");
  if (analysis.texture !== "continuo") {
    throw new Error(`Continuo arranger requires continuo texture, received ${analysis.texture}`);
  }
  const principalTarget = analysis.preservationTargets.find(
    (target) => target.kind === "principal_voice"
  );
  const foundationTarget = analysis.preservationTargets.find(
    (target) => target.kind === "continuo_foundation"
  );
  if (!principalTarget?.partId || !foundationTarget?.partId) {
    throw new Error(
      "Continuo arrangement requires Principal Voice and Continuo Foundation targets"
    );
  }
  const foundationNotes = score.events.filter(
    (event): event is Extract<ScoreEvent, { type: "note" }> =>
      event.partId === foundationTarget.partId && event.type === "note"
  );
  const targetLowest = options.targetInstrument?.soundingRange().lowest;
  const targetCanSoundFoundation =
    options.targetConfiguration.instrumentId === "piano" ||
    (targetLowest !== undefined &&
      foundationNotes.every((event) => noteToMidi(event.pitch) >= noteToMidi(targetLowest)));
  const policy = options.preservationPolicy ?? "faithful_reduction";
  if (
    !targetCanSoundFoundation &&
    !options.targetConfiguration.continuoBassInstrumentId &&
    policy === "faithful_reduction"
  ) {
    throw new Error(
      `${options.targetConfiguration.instrumentId} cannot sound the complete Continuo Foundation. Choose a separate bass instrument or explicitly request a Continuo Reduction.`
    );
  }
  const availableStrategies: ContinuoStrategy[] = targetCanSoundFoundation
    ? ["complete-realization", "lean-realization"]
    : options.targetConfiguration.continuoBassInstrumentId
      ? ["separate-bass-realization", "continuo-reduction"]
      : ["continuo-reduction"];
  const strategies = options.allowedStrategies
    ? availableStrategies.filter((strategy) => options.allowedStrategies!.includes(strategy))
    : availableStrategies;
  if (strategies.length === 0) {
    throw new Error("The Continuo Plan permits no strategy feasible for this target");
  }
  const candidates: ArrangementCandidate[] = strategies.map((strategy) => {
    const events = buildContinuoEvents(
      score,
      principalTarget.partId!,
      foundationTarget.partId!,
      strategy,
      options.targetInstrument,
      options.targetConfiguration.continuoBassInstrumentId,
      options.targetInstrument ? options.targetConfiguration.instrumentId : undefined
    );
    const audit = applyPreservationPolicy(
      auditContinuo(score, analysis, events),
      options.preservationPolicy ?? "faithful_reduction"
    );
    return {
      id: `candidate.${strategy}`,
      strategy,
      status: audit.status === "fail" ? "rejected" : "survived",
      events,
      audit,
      metrics: {
        sourcePitchClassCoverage: 1,
        averageFret: 0,
        openStringCount: 0,
      },
    };
  });
  const preferredStrategy =
    policy === "faithful_reduction"
      ? targetCanSoundFoundation
        ? "complete-realization"
        : "separate-bass-realization"
      : targetCanSoundFoundation
        ? "lean-realization"
        : "continuo-reduction";
  const selectedCandidate = candidates.find(
    (candidate) => candidate.strategy === preferredStrategy && candidate.status === "survived"
  );
  if (!selectedCandidate)
    throw new Error("No complete Continuo Realization or separate-bass alternative passed audit");
  selectedCandidate.status = "selected";

  return {
    candidates,
    selected: {
      id: options.arrangementId,
      analysisRecordId: analysis.id,
      selectedCandidateId: selectedCandidate.id,
      targetConfiguration: options.targetConfiguration,
      transpositionPlan: {
        sourceKey: score.key,
        targetKey: score.key,
        semitones: 0,
        rationale:
          "The complete Principal Voice and Continuo Foundation fit the keyboard target at source pitch.",
      },
      preservationPolicy: policy,
      events: selectedCandidate.events,
      transformationReport: buildCompleteTransformationReport(
        score,
        analysis,
        selectedCandidate.events,
        0
      ),
      preservationAudit: selectedCandidate.audit,
      continuoDisposition: {
        kind:
          selectedCandidate.strategy === "continuo-reduction"
            ? "continuo_reduction"
            : targetCanSoundFoundation
              ? "complete_realization"
              : "separate_bass_realization",
        label:
          selectedCandidate.strategy === "continuo-reduction"
            ? `Continuo Reduction · ${profileId} · ${options.targetConfiguration.instrumentId}`
            : targetCanSoundFoundation
              ? `Complete Continuo Realization · ${profileId} · ${options.targetConfiguration.instrumentId}`
              : `Complete Continuo Realization · ${profileId} · ${options.targetConfiguration.instrumentId} with separate ${options.targetConfiguration.continuoBassInstrumentId}`,
        soundedFoundationEventIds:
          selectedCandidate.strategy === "continuo-reduction"
            ? []
            : foundationNotes.map((event) => event.id),
        unsoundedFoundationEventIds:
          selectedCandidate.strategy === "continuo-reduction"
            ? foundationNotes.map((event) => event.id)
            : [],
        bassInstrumentId:
          selectedCandidate.strategy === "continuo-reduction"
            ? undefined
            : targetCanSoundFoundation
              ? options.targetConfiguration.instrumentId
              : options.targetConfiguration.continuoBassInstrumentId,
      },
      createdAt: options.createdAt,
    },
  };
}

function buildContinuoEvents(
  score: NormalizedScore,
  principalPartId: string,
  foundationPartId: string,
  strategy: ContinuoStrategy,
  targetInstrument?: InstrumentModel,
  bassInstrumentId?: string,
  targetInstrumentId?: string
): ArrangementEvent[] {
  const events: ArrangementEvent[] = [];
  for (const source of score.events) {
    if (
      source.partId === principalPartId &&
      source.type !== "figured_bass" &&
      source.type !== "chord_symbol"
    ) {
      events.push(copyVoiceEvent(source, "principal_voice"));
    } else if (
      source.partId === foundationPartId &&
      source.type === "note" &&
      strategy !== "continuo-reduction"
    ) {
      events.push({
        ...copyVoiceEvent(source, "continuo_foundation"),
        instrumentId: strategy === "separate-bass-realization" ? bassInstrumentId : undefined,
      });
    }
  }
  const figures = score.events.filter(
    (event): event is Extract<ScoreEvent, { type: "figured_bass" }> => event.type === "figured_bass"
  );
  for (const [index, figure] of figures.entries()) {
    const bass = score.events.find(
      (event): event is Extract<ScoreEvent, { type: "note" }> =>
        event.id === figure.bassEventId && event.type === "note"
    );
    if (!bass) throw new Error(`Figured Bass event references missing bass ${figure.bassEventId}`);
    const intervals = realizationIntervals(
      figure,
      strategy === "continuo-reduction"
        ? "lean-realization"
        : strategy === "separate-bass-realization"
          ? "complete-realization"
          : strategy
    );
    const requestedPitches = intervals.map((token) =>
      diatonicPitchAbove(bass.pitch, token.interval, score.key, token.accidental)
    );
    const voicing = playableVoicing(requestedPitches, targetInstrument);
    events.push({
      id: `arrangement-event.realization.${index + 1}`,
      type: voicing.pitches.length > 1 ? "chord" : "note",
      measureId: figure.measureId,
      onset: figure.onset,
      duration: figure.duration,
      pitches: voicing.pitches,
      positions: voicing.positions,
      sourceEventIds: [figure.id, bass.id],
      role: "realization",
      instrumentId: targetInstrumentId,
    });
  }
  return events.sort(
    (left, right) =>
      left.measureId.localeCompare(right.measureId) ||
      compareRational(left.onset, right.onset) ||
      roleOrder(left.role) - roleOrder(right.role)
  );
}

function copyVoiceEvent(
  source: Extract<ScoreEvent, { type: "note" }> | Extract<ScoreEvent, { type: "rest" }>,
  role: "principal_voice" | "continuo_foundation"
): ArrangementEvent {
  return {
    id: `arrangement-${source.id}`,
    type: source.type,
    measureId: source.measureId,
    onset: source.onset,
    duration: source.duration,
    pitches: source.type === "note" ? [source.pitch] : [],
    positions: [],
    sourceEventIds: [source.id],
    principalVoiceSourceEventId: role === "principal_voice" ? source.id : undefined,
    role,
  };
}

function playableVoicing(
  requestedPitches: string[],
  model: InstrumentModel | undefined
): { pitches: string[]; positions: ArrangementEvent["positions"] } {
  if (!model) return { pitches: requestedPitches, positions: [] };
  const choices = requestedPitches.map((pitch) =>
    [0, 12, 24].flatMap((semitones) => {
      const candidate = transposeNote(pitch, semitones);
      return model.positionsForPitch(candidate).map((position) => ({
        pitch: candidate,
        position: { ...position, pitch: candidate },
      }));
    })
  );
  const selected: Array<{ pitch: string; position: ArrangementEvent["positions"][number] }> = [];
  const search = (index: number): boolean => {
    if (index === choices.length) return model.isPlayable(selected.map((item) => item.position)).ok;
    for (const choice of choices[index] ?? []) {
      if (selected.some((item) => item.position.course === choice.position.course)) continue;
      selected.push(choice);
      if (search(index + 1)) return true;
      selected.pop();
    }
    return false;
  };
  if (!search(0)) {
    throw new Error(
      `No playable target voicing realizes continuo pitches ${requestedPitches.join(", ")}`
    );
  }
  return {
    pitches: selected.map((item) => item.pitch),
    positions: selected.map((item) => item.position),
  };
}

function realizationIntervals(
  event: Extract<ScoreEvent, { type: "figured_bass" }>,
  strategy: "complete-realization" | "lean-realization"
): Array<{ interval: number; accidental?: "#" | "b" | "natural" }> {
  const explicit = event.figures.map((figure) => ({ ...figure }));
  if (strategy === "lean-realization") return explicit;
  const intervals = new Set(explicit.map((figure) => figure.interval));
  const implied: number[] = [];
  if (intervals.has(7)) implied.push(3, 5);
  else if (intervals.has(6) && !intervals.has(4)) implied.push(3);
  else if (intervals.has(4) || intervals.has(3)) implied.push(5);
  for (const interval of implied) {
    if (!intervals.has(interval)) explicit.push({ interval });
  }
  return explicit.sort((left, right) => left.interval - right.interval);
}

function diatonicPitchAbove(
  bassPitch: string,
  interval: number,
  key: string | undefined,
  accidental: "#" | "b" | "natural" | undefined
): string {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const bass = parsePitch(bassPitch);
  const start = letters.indexOf(bass.letter);
  const absoluteDegree = start + interval - 1;
  const letter = letters[absoluteDegree % 7]!;
  const octave = bass.octave + Math.floor(absoluteDegree / 7);
  const scale = keyScale(key);
  const scalePitchClass = scale.find((pitchClass) => pitchClass.startsWith(letter)) ?? letter;
  const pitchClass =
    accidental === "#"
      ? `${letter}#`
      : accidental === "b"
        ? `${letter}b`
        : accidental === "natural"
          ? letter
          : scalePitchClass;
  return `${pitchClass}${octave}`;
}

function keyScale(key: string | undefined): string[] {
  const match = key?.match(/^([A-G](?:#|b)?)\s+(major|minor)$/);
  if (!match) return ["C", "D", "E", "F", "G", "A", "B"];
  return match[2] === "major"
    ? [...Key.majorKey(match[1]!).scale]
    : [...Key.minorKey(match[1]!).natural.scale];
}

export function auditContinuo(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  events: ArrangementEvent[]
): PreservationAudit {
  const findings: PreservationAudit["findings"] = [];
  const targets = analysis.preservationTargets.filter((target) =>
    ["principal_voice", "continuo_foundation", "relationship"].includes(target.kind)
  );
  for (const target of targets.filter((candidate) => candidate.kind !== "relationship")) {
    for (const sourceId of target.eventIds) {
      const source = score.events.find((event) => event.id === sourceId);
      const descendants = events.filter((event) => event.sourceEventIds.includes(sourceId));
      if (!source || descendants.length === 0) {
        findings.push({
          targetId: target.id,
          sourceEventId: sourceId,
          severity: "hard",
          code: "continuo.source_omitted",
          message: `Protected Continuo source event is not represented: ${sourceId}`,
        });
        continue;
      }
      if (source.type === "note") {
        const literal = descendants.find(
          (event) =>
            event.pitches.includes(source.pitch) &&
            (target.kind !== "continuo_foundation" || event.role === "continuo_foundation")
        );
        if (!literal) {
          findings.push({
            targetId: target.id,
            sourceEventId: sourceId,
            severity: "hard",
            code:
              target.kind === "continuo_foundation"
                ? "continuo.foundation_unsounded"
                : "continuo.pitch_changed",
            message:
              target.kind === "continuo_foundation"
                ? `Continuo Foundation event is linked but not sounded as bass: ${sourceId}`
                : `Protected source pitch is absent: ${source.pitch}`,
          });
        }
      } else if (source.type === "figured_bass") {
        const realized = descendants.find((event) => event.role === "realization");
        const bass = score.events.find(
          (event): event is Extract<ScoreEvent, { type: "note" }> =>
            event.id === source.bassEventId && event.type === "note"
        );
        if (
          !realized ||
          !bass ||
          source.figures.some((figure) =>
            realized.pitches.every(
              (pitch) =>
                !equivalentDiatonicInterval(diatonicDistance(bass.pitch, pitch), figure.interval) ||
                (figure.accidental !== undefined &&
                  parsePitch(pitch).accidental !== accidentalText(figure.accidental))
            )
          )
        ) {
          findings.push({
            targetId: target.id,
            sourceEventId: sourceId,
            severity: "hard",
            code: "continuo.figure_unrealized",
            message: `Figured Bass event is not fully realized: ${sourceId}`,
          });
        }
      }
    }
  }
  const relationship = targets.find((target) => target.relationshipType === "prepared_suspension");
  if (relationship && preparedSuspensionPreserved(score, events, relationship.eventIds)) {
    findings.push({
      targetId: relationship.id,
      sourceEventId: relationship.eventIds.find((id) => id.includes("figure")),
      severity: "observation",
      code: "continuo.prepared_suspension_accepted",
      message:
        "The continuo validation profile accepts the source-supported prepared fourth and downward 4-3 resolution.",
    });
  } else if (relationship) {
    findings.push({
      targetId: relationship.id,
      severity: "hard",
      code: "continuo.prepared_suspension_changed",
      message:
        "The arranged preparation, dissonant fourth, downward resolution, figure realization, or source timing no longer preserves the reviewed 4-3 suspension.",
    });
  }
  return {
    status: findings.some((finding) => finding.severity === "hard") ? "fail" : "pass",
    targetIds: targets.map((target) => target.id),
    findings,
  };
}

function preparedSuspensionPreserved(
  score: NormalizedScore,
  events: ArrangementEvent[],
  sourceIds: string[]
): boolean {
  const sourceNotes = sourceIds.flatMap((id) => {
    const event = score.events.find(
      (candidate): candidate is Extract<ScoreEvent, { type: "note" }> =>
        candidate.id === id && candidate.type === "note"
    );
    return event ? [event] : [];
  });
  const figures = sourceIds.flatMap((id) => {
    const event = score.events.find(
      (candidate): candidate is Extract<ScoreEvent, { type: "figured_bass" }> =>
        candidate.id === id && candidate.type === "figured_bass"
    );
    return event ? [event] : [];
  });
  if (sourceNotes.length < 5 || figures.length < 2) return false;
  const [preparation, suspension, resolution] = sourceNotes;
  const [fourth, third] = figures;
  if (!preparation || !suspension || !resolution || !fourth || !third) return false;
  const arrangedPreparation = descendant(events, preparation.id, "principal_voice");
  const arrangedSuspension = descendant(events, suspension.id, "principal_voice");
  const arrangedResolution = descendant(events, resolution.id, "principal_voice");
  const realizedFourth = descendant(events, fourth.id, "realization");
  const realizedThird = descendant(events, third.id, "realization");
  const bass = score.events.find(
    (event): event is Extract<ScoreEvent, { type: "note" }> =>
      event.id === fourth.bassEventId && event.type === "note"
  );
  if (
    !arrangedPreparation ||
    !arrangedSuspension ||
    !arrangedResolution ||
    !realizedFourth ||
    !realizedThird ||
    !bass
  ) {
    return false;
  }
  const timedDescendants = [
    [preparation, arrangedPreparation],
    [suspension, arrangedSuspension],
    [resolution, arrangedResolution],
    [fourth, realizedFourth],
    [third, realizedThird],
  ] as const;
  const timingPreserved = timedDescendants.every(
    ([source, arranged]) =>
      source.measureId === arranged.measureId && compareRational(source.onset, arranged.onset) === 0
  );
  return (
    timingPreserved &&
    arrangedPreparation.pitches[0] === arrangedSuspension.pitches[0] &&
    pitchSemitones(arrangedResolution.pitches[0]!) ===
      pitchSemitones(arrangedSuspension.pitches[0]!) - 1 &&
    realizedFourth.pitches.some((pitch) =>
      equivalentDiatonicInterval(diatonicDistance(bass.pitch, pitch), 4)
    ) &&
    realizedThird.pitches.some((pitch) =>
      equivalentDiatonicInterval(diatonicDistance(bass.pitch, pitch), 3)
    )
  );
}

function descendant(
  events: ArrangementEvent[],
  sourceId: string,
  role: ArrangementEvent["role"]
): ArrangementEvent | undefined {
  return events.find((event) => event.role === role && event.sourceEventIds.includes(sourceId));
}

function pitchSemitones(pitch: string): number {
  const parsed = parsePitch(pitch);
  const pitchClasses: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const accidental = parsed.accidental === "#" ? 1 : parsed.accidental === "b" ? -1 : 0;
  return (parsed.octave + 1) * 12 + pitchClasses[parsed.letter]! + accidental;
}

function diatonicDistance(bassPitch: string, upperPitch: string): number {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const bass = parsePitch(bassPitch);
  const upper = parsePitch(upperPitch);
  return (
    (upper.octave - bass.octave) * 7 +
    letters.indexOf(upper.letter) -
    letters.indexOf(bass.letter) +
    1
  );
}

function equivalentDiatonicInterval(actual: number, expected: number): boolean {
  return ((actual - 1) % 7) + 1 === ((expected - 1) % 7) + 1;
}

function accidentalText(accidental: "#" | "b" | "natural"): string {
  return accidental === "natural" ? "" : accidental;
}

function roleOrder(role: ArrangementEvent["role"]): number {
  return ["principal_voice", "realization", "continuo_foundation", "accompaniment"].indexOf(
    role ?? "accompaniment"
  );
}
