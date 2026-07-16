import { InstrumentModel } from "./instrument-model.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import type {
  AnalysisRecord,
  ArrangementCandidate,
  ArrangementEvent,
  ArrangementPosition,
  ArrangementScore,
  NormalizedScore,
  PreservationAudit,
  ScoreEvent,
  TargetConfiguration,
} from "./music-domain.js";
import { compareRational } from "./music-domain.js";
import { noteToMidi } from "./pitch.js";
import { buildCompleteTransformationReport } from "./transformation-report.js";
import { applyPreservationPolicy, type PreservationPolicy } from "./preservation-policy.js";

type Options = {
  arrangementId: string;
  createdAt: string;
  targetConfiguration: TargetConfiguration;
  preservationPolicy?: PreservationPolicy;
  allowedStrategies?: Array<"low-fret-polyphony" | "voice-continuity">;
};

type AssignedNote = {
  source: Extract<ScoreEvent, { type: "note" }>;
  position: ArrangementPosition;
  start: number;
  end: number;
};

export function arrangeImitativeIntabulation(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: Options
): { candidates: ArrangementCandidate[]; selected: ArrangementScore } {
  assertAuthorityPathRuntime("authority.ranker.imitative-intabulation", "production");
  if (analysis.texture !== "imitative-polyphony") {
    throw new Error("Imitative intabulation requires imitative-polyphony analysis");
  }
  if (options.targetConfiguration.instrumentId !== "renaissance-lute-6") {
    throw new Error("Initial imitative intabulation target must be renaissance-lute-6");
  }
  const strategies = options.allowedStrategies ?? ["low-fret-polyphony", "voice-continuity"];
  const candidates: ArrangementCandidate[] = strategies.map((strategy) => {
    const assignments = rankImitativeAssignments(score, model, strategy).selected;
    const events = projectEvents(score, assignments);
    const audit = applyPreservationPolicy(
      auditImitative(score, analysis, events, model),
      options.preservationPolicy ?? "faithful_reduction"
    );
    const positions = events.flatMap((event) => event.positions);
    return {
      id: `candidate.${strategy}`,
      strategy,
      status: audit.status === "fail" ? "rejected" : "survived",
      events,
      audit,
      metrics: {
        sourcePitchClassCoverage: 1,
        averageFret:
          positions.length === 0
            ? 0
            : positions.reduce((sum, position) => sum + position.fret, 0) / positions.length,
        openStringCount: positions.filter((position) => position.fret === 0).length,
      },
    };
  });
  const survivors = candidates.filter((candidate) => candidate.status === "survived");
  const policy = options.preservationPolicy ?? "faithful_reduction";
  survivors.sort(
    (left, right) =>
      left.metrics.averageFret - right.metrics.averageFret ||
      right.metrics.openStringCount - left.metrics.openStringCount
  );
  const selected = survivors[0];
  if (!selected) throw new Error("No imitative intabulation candidate passed Preservation Audit");
  selected.status = "selected";
  return {
    candidates,
    selected: {
      id: options.arrangementId,
      analysisRecordId: analysis.id,
      selectedCandidateId: selected.id,
      targetConfiguration: options.targetConfiguration,
      transpositionPlan: {
        sourceKey: score.key,
        targetKey: score.key,
        semitones: 0,
        rationale:
          "All three source voices and ordered subject entries fit the six-course lute at source pitch.",
      },
      preservationPolicy: policy,
      events: selected.events,
      transformationReport: buildCompleteTransformationReport(score, analysis, selected.events, 0),
      preservationAudit: selected.audit,
      createdAt: options.createdAt,
    },
  };
}

export function rankImitativeAssignments(
  score: NormalizedScore,
  model: InstrumentModel,
  strategy: "low-fret-polyphony" | "voice-continuity",
  maximumCompleteAssignments = 128
): {
  selected: Map<string, ArrangementPosition>;
  completeAssignmentCount: number;
  truncated: boolean;
} {
  assertAuthorityPathRuntime("authority.ranker.imitative-intabulation", "production");
  const notes = score.events
    .filter((event): event is Extract<ScoreEvent, { type: "note" }> => event.type === "note")
    .map((source) => ({
      source,
      start: absoluteOnset(score, source),
      end: absoluteOnset(score, source) + rationalValue(source.duration),
    }))
    .sort(
      (left, right) =>
        left.start - right.start || left.source.partId.localeCompare(right.source.partId)
    );
  const assigned: AssignedNote[] = [];
  const completeAssignments: AssignedNote[][] = [];

  function search(index: number): void {
    if (completeAssignments.length >= maximumCompleteAssignments) return;
    if (index >= notes.length) {
      completeAssignments.push(
        assigned.map((item) => ({ ...item, position: { ...item.position } }))
      );
      return;
    }
    const note = notes[index]!;
    const previous = assigned
      .filter((candidate) => candidate.source.partId === note.source.partId)
      .sort((left, right) => right.start - left.start)[0];
    const positions = model
      .positionsForPitch(note.source.pitch)
      .map((position) => ({ ...position, pitch: note.source.pitch }))
      .sort((left, right) =>
        strategy === "voice-continuity" && previous
          ? Number(left.course !== previous.position.course) -
              Number(right.course !== previous.position.course) ||
            Math.abs(left.fret - previous.position.fret) -
              Math.abs(right.fret - previous.position.fret)
          : left.fret - right.fret || left.course - right.course
      );
    for (const position of positions) {
      const simultaneous = assigned.filter(
        (candidate) => candidate.start < note.end && note.start < candidate.end
      );
      if (simultaneous.some((candidate) => candidate.position.course === position.course)) continue;
      if (!model.isPlayable([...simultaneous.map((candidate) => candidate.position), position]).ok)
        continue;
      assigned.push({ ...note, position });
      search(index + 1);
      assigned.pop();
    }
  }

  search(0);
  if (completeAssignments.length === 0) {
    throw new Error("No collision-free six-course assignment preserves all imitative voices");
  }
  completeAssignments.sort((left, right) => compareCompleteAssignments(left, right, strategy));
  const selected = completeAssignments[0]!;
  return {
    selected: new Map(selected.map((assignment) => [assignment.source.id, assignment.position])),
    completeAssignmentCount: completeAssignments.length,
    truncated: completeAssignments.length >= maximumCompleteAssignments,
  };
}

function compareCompleteAssignments(
  left: AssignedNote[],
  right: AssignedNote[],
  strategy: "low-fret-polyphony" | "voice-continuity"
): number {
  const lowFretCost = (items: AssignedNote[]) =>
    items.reduce((sum, item) => sum + item.position.fret, 0);
  const openCount = (items: AssignedNote[]) =>
    items.filter((item) => item.position.fret === 0).length;
  const continuityCost = (items: AssignedNote[]) => {
    const byVoice = new Map<string, AssignedNote[]>();
    for (const item of items) {
      const voice = byVoice.get(item.source.partId) ?? [];
      voice.push(item);
      byVoice.set(item.source.partId, voice);
    }
    return [...byVoice.values()].reduce((total, voice) => {
      voice.sort((a, b) => a.start - b.start);
      return (
        total +
        voice.slice(1).reduce((sum, item, index) => {
          const prior = voice[index]!;
          return (
            sum +
            Number(item.position.course !== prior.position.course) * 4 +
            Math.abs(item.position.fret - prior.position.fret)
          );
        }, 0)
      );
    }, 0);
  };
  return strategy === "voice-continuity"
    ? continuityCost(left) - continuityCost(right) || lowFretCost(left) - lowFretCost(right)
    : lowFretCost(left) - lowFretCost(right) || openCount(right) - openCount(left);
}

function projectEvents(
  score: NormalizedScore,
  assignments: Map<string, ArrangementPosition>
): ArrangementEvent[] {
  return score.events
    .filter(
      (event): event is Exclude<ScoreEvent, { type: "figured_bass" | "chord_symbol" }> =>
        event.type !== "figured_bass" && event.type !== "chord_symbol"
    )
    .map((source) => {
      const position = source.type === "note" ? assignments.get(source.id) : undefined;
      if (source.type === "note" && !position) throw new Error(`No lute position for ${source.id}`);
      return {
        id: `arrangement-${source.id}`,
        type: source.type,
        measureId: source.measureId,
        onset: source.onset,
        duration: source.duration,
        pitches: source.type === "note" ? [source.pitch] : [],
        positions: position ? [position] : [],
        sourceEventIds: [source.id],
        role: "source_voice" as const,
        voiceId: source.partId,
      };
    });
}

export function auditImitative(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  events: ArrangementEvent[],
  model: InstrumentModel
): PreservationAudit {
  assertAuthorityPathRuntime("authority.validator.preservation-editorial", "production");
  const findings: PreservationAudit["findings"] = [];
  const targets = analysis.preservationTargets;
  for (const target of targets.filter((candidate) => candidate.kind === "voice")) {
    for (const sourceId of target.eventIds) {
      const source = score.events.find((event) => event.id === sourceId);
      const arranged = events.find((event) => event.sourceEventIds.includes(sourceId));
      if (!source || !arranged) {
        findings.push({
          targetId: target.id,
          sourceEventId: sourceId,
          severity: "hard",
          code: "imitation.voice_event_omitted",
          message: `Required source voice event is omitted: ${sourceId}`,
        });
        continue;
      }
      if (
        source.type === "note" &&
        (arranged.pitches[0] !== source.pitch || !model.isPlayable(arranged.positions).ok)
      ) {
        findings.push({
          targetId: target.id,
          sourceEventId: sourceId,
          arrangementEventId: arranged.id,
          severity: "hard",
          code: "imitation.voice_event_changed",
          message: `Source voice pitch or course assignment changed: ${sourceId}`,
        });
      }
      if (compareRational(source.duration, arranged.duration) !== 0) {
        findings.push({
          targetId: target.id,
          sourceEventId: sourceId,
          arrangementEventId: arranged.id,
          severity: "hard",
          code: "imitation.rhythm_changed",
          message: `Source voice rhythm changed: ${sourceId}`,
        });
      }
      if (
        source.measureId !== arranged.measureId ||
        compareRational(source.onset, arranged.onset) !== 0
      ) {
        findings.push({
          targetId: target.id,
          sourceEventId: sourceId,
          arrangementEventId: arranged.id,
          severity: "hard",
          code: "imitation.onset_changed",
          message: `Source voice onset changed: ${sourceId}`,
        });
      }
      if (arranged.voiceId !== source.partId) {
        findings.push({
          targetId: target.id,
          sourceEventId: sourceId,
          arrangementEventId: arranged.id,
          severity: "hard",
          code: "imitation.voice_identity_changed",
          message: `Source voice identity changed: ${sourceId}`,
        });
      }
    }
  }
  const relationshipTargets = targets.filter((target) => target.kind === "relationship");
  const entryTarget = relationshipTargets.find(
    (target) => target.relationshipType === "ordered_entries"
  );
  if (entryTarget) {
    const groups = entryTarget.eventGroups ?? [];
    const sourceGroups = groups.map((group) => noteGroup(score.events, group));
    const arrangedGroups = groups.map((group) => arrangedNoteGroup(events, group));
    const sourceStarts = sourceGroups.map((group) =>
      group[0] ? absoluteOnset(score, group[0]) : Number.NaN
    );
    const arrangedStarts = arrangedGroups.map((group) =>
      group[0] ? absoluteOnset(score, group[0]) : Number.NaN
    );
    const valid =
      sourceGroups.every((group) => group.length > 0) &&
      arrangedGroups.every((group, index) => group.length === sourceGroups[index]!.length) &&
      sameStrictOrder(sourceStarts, arrangedStarts) &&
      arrangedGroups.every((group, index) => sameSubjectShape(sourceGroups[index]!, group));
    if (!valid) {
      findings.push({
        targetId: entryTarget.id,
        severity: "hard",
        code: "imitation.ordered_entries_changed",
        message:
          "Ordered subject entries no longer retain source order, interval-rhythm shape, or voice lineage.",
      });
    }
  }
  const cadenceTarget = relationshipTargets.find(
    (target) => target.relationshipType === "cadential_goal"
  );
  if (cadenceTarget) {
    for (const sourceId of cadenceTarget.eventIds) {
      const source = score.events.find(
        (event): event is Extract<ScoreEvent, { type: "note" }> =>
          event.id === sourceId && event.type === "note"
      );
      const arranged = events.find((event) => event.sourceEventIds.includes(sourceId));
      const voiceEvents = source
        ? events.filter((event) => event.voiceId === source.partId && event.type !== "rest")
        : [];
      const last = voiceEvents
        .slice()
        .sort((a, b) => absoluteOnset(score, a) - absoluteOnset(score, b))
        .at(-1);
      if (
        !source ||
        !arranged ||
        last?.id !== arranged.id ||
        arranged.pitches[0] !== source.pitch
      ) {
        findings.push({
          targetId: cadenceTarget.id,
          sourceEventId: sourceId,
          arrangementEventId: arranged?.id,
          severity: "hard",
          code: "imitation.cadential_goal_changed",
          message: `Source voice no longer reaches its reviewed cadential goal: ${sourceId}`,
        });
      }
    }
  }
  if (findings.every((finding) => finding.severity !== "hard") && entryTarget) {
    findings.push({
      targetId: entryTarget.id,
      severity: "observation",
      code: "imitation.ordered_entries_preserved",
      message:
        "All ordered subject entries were recomputed and retain voice identity, interval-rhythm shape, and source timing under the imitative validation profile.",
    });
  }
  return {
    status: findings.some((finding) => finding.severity === "hard") ? "fail" : "pass",
    targetIds: targets.map((target) => target.id),
    findings,
  };
}

function noteGroup(
  events: ScoreEvent[],
  ids: string[]
): Array<Extract<ScoreEvent, { type: "note" }>> {
  return ids.flatMap((id) => {
    const event = events.find(
      (candidate): candidate is Extract<ScoreEvent, { type: "note" }> =>
        candidate.id === id && candidate.type === "note"
    );
    return event ? [event] : [];
  });
}

function arrangedNoteGroup(events: ArrangementEvent[], ids: string[]): ArrangementEvent[] {
  return ids.flatMap((id) => {
    const event = events.find((candidate) => candidate.sourceEventIds.includes(id));
    return event && event.type !== "rest" ? [event] : [];
  });
}

function sameSubjectShape(
  source: Array<Extract<ScoreEvent, { type: "note" }>>,
  arranged: ArrangementEvent[]
): boolean {
  const sourceIntervals = source
    .slice(1)
    .map((event, index) => noteToMidi(event.pitch) - noteToMidi(source[index]!.pitch));
  const arrangedIntervals = arranged
    .slice(1)
    .map(
      (event, index) => noteToMidi(event.pitches[0]!) - noteToMidi(arranged[index]!.pitches[0]!)
    );
  return (
    sourceIntervals.join(",") === arrangedIntervals.join(",") &&
    source.every((event, index) => compareRational(event.duration, arranged[index]!.duration) === 0)
  );
}

function sameStrictOrder(sourceStarts: number[], arrangedStarts: number[]): boolean {
  if (sourceStarts.length !== arrangedStarts.length) return false;
  const sourceOrder = sourceStarts
    .map((start, index) => ({ start, index }))
    .sort((a, b) => a.start - b.start)
    .map(({ index }) => index);
  const arrangedOrder = arrangedStarts
    .map((start, index) => ({ start, index }))
    .sort((a, b) => a.start - b.start)
    .map(({ index }) => index);
  return (
    sourceOrder.join(",") === arrangedOrder.join(",") &&
    arrangedStarts.every((start, index) => index === 0 || start > arrangedStarts[index - 1]!)
  );
}

function absoluteOnset(
  score: NormalizedScore,
  event: Pick<ScoreEvent | ArrangementEvent, "measureId" | "onset">
): number {
  let result = 0;
  for (const measure of score.measures) {
    if (measure.id === event.measureId) break;
    result += rationalValue(measure.duration);
  }
  return result + rationalValue(event.onset);
}

function rationalValue(value: { numerator: number; denominator: number }): number {
  return value.numerator / value.denominator;
}
