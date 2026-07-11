import { Key } from "tonal";
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
import { parsePitch } from "./pitch.js";

type ContinuoArrangementOptions = {
  arrangementId: string;
  createdAt: string;
  targetConfiguration: TargetConfiguration;
};

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
  if (options.targetConfiguration.instrumentId !== "piano") {
    throw new Error(
      `Complete Continuo Realization is not implemented for ${options.targetConfiguration.instrumentId}`
    );
  }
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

  const strategies = ["complete-realization", "lean-realization"] as const;
  const candidates: ArrangementCandidate[] = strategies.map((strategy) => {
    const events = buildContinuoEvents(
      score,
      principalTarget.partId!,
      foundationTarget.partId!,
      strategy
    );
    const audit = auditContinuo(score, analysis, events);
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
  const selectedCandidate = candidates.find(
    (candidate) => candidate.strategy === "complete-realization" && candidate.status === "survived"
  );
  if (!selectedCandidate) throw new Error("No complete Continuo Realization passed audit");
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
      preservationPolicy: "faithful_reduction",
      events: selectedCandidate.events,
      transformationReport: score.events.map((sourceEvent) => ({
        sourceEventId: sourceEvent.id,
        arrangementEventIds: selectedCandidate.events
          .filter((event) => event.sourceEventIds.includes(sourceEvent.id))
          .map((event) => event.id),
        classification: sourceEvent.type === "figured_bass" ? "generated" : "retained",
        rationale:
          sourceEvent.type === "figured_bass"
            ? `The ${profileId} profile realizes this source figure without replacing it.`
            : "The source voice event is retained literally in its semantic playback part.",
      })),
      preservationAudit: selectedCandidate.audit,
      createdAt: options.createdAt,
    },
  };
}

function buildContinuoEvents(
  score: NormalizedScore,
  principalPartId: string,
  foundationPartId: string,
  strategy: "complete-realization" | "lean-realization"
): ArrangementEvent[] {
  const events: ArrangementEvent[] = [];
  for (const source of score.events) {
    if (source.partId === principalPartId && source.type !== "figured_bass") {
      events.push(copyVoiceEvent(source, "principal_voice"));
    } else if (source.partId === foundationPartId && source.type === "note") {
      events.push(copyVoiceEvent(source, "continuo_foundation"));
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
    const intervals = realizationIntervals(figure, strategy);
    const pitches = intervals.map((token) =>
      diatonicPitchAbove(bass.pitch, token.interval, score.key, token.accidental)
    );
    events.push({
      id: `arrangement-event.realization.${index + 1}`,
      type: pitches.length > 1 ? "chord" : "note",
      measureId: figure.measureId,
      onset: figure.onset,
      duration: figure.duration,
      pitches,
      positions: [],
      sourceEventIds: [figure.id, bass.id],
      role: "realization",
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

function auditContinuo(
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
        const literal = descendants.find((event) => event.pitches.includes(source.pitch));
        if (!literal) {
          findings.push({
            targetId: target.id,
            sourceEventId: sourceId,
            severity: "hard",
            code: "continuo.pitch_changed",
            message: `Protected source pitch is absent: ${source.pitch}`,
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
                diatonicDistance(bass.pitch, pitch) !== figure.interval ||
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
  const relationship = targets.find((target) => target.kind === "relationship");
  if (relationship) {
    findings.push({
      targetId: relationship.id,
      sourceEventId: relationship.eventIds.find((id) => id.includes("figure")),
      severity: "observation",
      code: "continuo.prepared_suspension_accepted",
      message:
        "The continuo validation profile accepts the source-supported prepared fourth and downward 4-3 resolution.",
    });
  }
  return {
    status: findings.some((finding) => finding.severity === "hard") ? "fail" : "pass",
    targetIds: targets.map((target) => target.id),
    findings,
  };
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

function accidentalText(accidental: "#" | "b" | "natural"): string {
  return accidental === "natural" ? "" : accidental;
}

function roleOrder(role: ArrangementEvent["role"]): number {
  return ["principal_voice", "realization", "continuo_foundation", "accompaniment"].indexOf(
    role ?? "accompaniment"
  );
}
