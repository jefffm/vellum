import { noteToMidi } from "./pitch.js";
import type { AnalysisRecord, NormalizedScore, ScoreEvent, ScorePart } from "./music-domain.js";

export type AnalyzeMusicOptions = {
  id: string;
  createdAt: string;
};

export function analyzeMusicologicalScore(
  score: NormalizedScore,
  options: AnalyzeMusicOptions
): AnalysisRecord {
  const principal = selectPrincipalVoice(score);
  const principalEvents = score.events.filter(
    (event) => event.partId === principal.part.id && event.type === "note"
  );
  if (principalEvents.length === 0) {
    throw new Error(`Principal Voice candidate has no notes: ${principal.part.id}`);
  }
  const continuoPart = score.parts.find((part) => part.role === "continuo_foundation");
  const continuoEvents = continuoPart
    ? score.events.filter((event) => event.partId === continuoPart.id && event.type !== "rest")
    : [];
  const suspension = detectPreparedSuspension(score, principal.part.id);
  const texture = inferTexture(score);
  const claims: AnalysisRecord["claims"] = [
    {
      id: `claim.${options.id.slice("analysis.".length)}.principal-voice`,
      kind: "principal_voice",
      subjectIds: [principal.part.id],
      statement: `${principal.part.name} carries the Principal Voice (${principal.reason}).`,
      basis: principal.basis,
      confidence: principal.confidence,
    },
    {
      id: `claim.${options.id.slice("analysis.".length)}.texture`,
      kind: "texture",
      subjectIds: score.parts.map((part) => part.id),
      statement: `The source texture is ${texture}.`,
      basis: "observation",
      confidence: 0.9,
    },
  ];
  if (continuoPart) {
    claims.push({
      id: `claim.${options.id.slice("analysis.".length)}.continuo-foundation`,
      kind: "continuo_foundation",
      subjectIds: continuoEvents.map((event) => event.id),
      statement: `${continuoPart.name} supplies an authoritative bass line and Figured Bass signs.`,
      basis: "observation",
      confidence: 1,
    });
  }
  if (suspension) {
    claims.push({
      id: `claim.${options.id.slice("analysis.".length)}.prepared-suspension`,
      kind: "prepared_suspension",
      subjectIds: suspension.eventIds,
      statement:
        "A source-supported 4-3 suspension is prepared consonantly, held as a fourth above the bass, and resolved downward by step to a third.",
      basis: "observation",
      confidence: 1,
    });
  }

  const preservationTargets: AnalysisRecord["preservationTargets"] = [
    {
      id: `target.${options.id.slice("analysis.".length)}.principal-voice`,
      kind: "principal_voice",
      partId: principal.part.id,
      eventIds: principalEvents.map((event) => event.id),
      rationale:
        "Faithful Reduction preserves every Principal Voice pitch, duration, order, phrase position, and perceptual prominence.",
    },
  ];
  if (continuoPart) {
    preservationTargets.push({
      id: `target.${options.id.slice("analysis.".length)}.continuo-foundation`,
      kind: "continuo_foundation",
      partId: continuoPart.id,
      eventIds: continuoEvents.map((event) => event.id),
      rationale:
        "Continuo Realization preserves every foundation bass event, figure, accidental, duration, and source order.",
    });
  }
  if (suspension) {
    preservationTargets.push({
      id: `target.${options.id.slice("analysis.".length)}.prepared-suspension`,
      kind: "relationship",
      eventIds: suspension.eventIds,
      rationale:
        "The prepared dissonance and its downward resolution are source-supported contrapuntal structure, not a generic voice-leading violation.",
    });
  }

  return {
    id: options.id,
    normalizedScoreId: score.id,
    version: 1,
    texture,
    principalVoicePartId: principal.part.id,
    validationProfileId: continuoPart ? "continuo.italian-baroque" : undefined,
    contrapuntalTechniques: suspension ? ["prepared_suspension"] : [],
    claims,
    preservationTargets,
    createdAt: options.createdAt,
  };
}

type PrincipalSelection = {
  part: ScorePart;
  reason: string;
  basis: "observation" | "inference";
  confidence: number;
};

function selectPrincipalVoice(score: NormalizedScore): PrincipalSelection {
  const explicit = score.parts.find((part) => part.role === "principal_voice");
  if (explicit) {
    return {
      part: explicit,
      reason: "the source explicitly assigns the Principal Voice role",
      basis: "observation",
      confidence: 1,
    };
  }

  const soprano = score.parts.find(
    (part) => part.role === "soprano" || /\bsoprano\b/i.test(part.name)
  );
  if (soprano) {
    return {
      part: soprano,
      reason: "the labeled soprano presents the tune in this four-part setting",
      basis: "observation",
      confidence: 0.99,
    };
  }

  const ranked = score.parts
    .map((part) => ({ part, median: medianMidi(score.events, part.id) }))
    .filter((entry): entry is { part: ScorePart; median: number } => entry.median !== undefined)
    .sort((left, right) => right.median - left.median || left.part.id.localeCompare(right.part.id));
  if (ranked.length === 0) {
    throw new Error(
      "Normalized score contains no pitched voice suitable for Principal Voice inference"
    );
  }

  return {
    part: ranked[0]!.part,
    reason: "it has the highest median register among the available unlabeled voices",
    basis: "inference",
    confidence: ranked.length === 1 ? 0.8 : 0.65,
  };
}

function medianMidi(events: ScoreEvent[], partId: string): number | undefined {
  const values = events
    .flatMap((event) =>
      event.partId === partId && event.type === "note" ? [noteToMidi(event.pitch)] : []
    )
    .sort((left, right) => left - right);
  if (values.length === 0) return undefined;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1]! + values[middle]!) / 2 : values[middle];
}

function inferTexture(score: NormalizedScore): string {
  if (score.parts.length === 1) return "monophonic";
  if (score.parts.some((part) => part.role === "continuo_foundation")) {
    return "continuo";
  }
  if (score.parts.length === 4 && score.parts.some((part) => part.role === "bass")) {
    return "homophonic-four-part";
  }
  return "polyphonic";
}

function detectPreparedSuspension(
  score: NormalizedScore,
  principalPartId: string
): { eventIds: string[] } | undefined {
  const figures = score.events
    .filter((event) => event.type === "figured_bass")
    .sort(
      (left, right) =>
        score.measures.findIndex((measure) => measure.id === left.measureId) -
          score.measures.findIndex((measure) => measure.id === right.measureId) ||
        compareOnset(left.onset, right.onset)
    );
  for (let index = 0; index < figures.length - 1; index += 1) {
    const suspensionFigure = figures[index]!;
    const resolutionFigure = figures[index + 1]!;
    if (
      suspensionFigure.bassEventId !== resolutionFigure.bassEventId ||
      !suspensionFigure.figures.some((figure) => figure.interval === 4) ||
      !resolutionFigure.figures.some((figure) => figure.interval === 3)
    ) {
      continue;
    }
    const suspensionNote = soundingNoteAt(
      score,
      principalPartId,
      suspensionFigure.measureId,
      suspensionFigure.onset
    );
    const resolutionNote = soundingNoteAt(
      score,
      principalPartId,
      resolutionFigure.measureId,
      resolutionFigure.onset
    );
    const bass = score.events.find(
      (event): event is Extract<ScoreEvent, { type: "note" }> =>
        event.id === suspensionFigure.bassEventId && event.type === "note"
    );
    const previousPrincipal = previousNote(score, principalPartId, suspensionNote?.id);
    const previousBass = previousNote(score, bass?.partId ?? "", bass?.id);
    if (!suspensionNote || !resolutionNote || !bass || !previousPrincipal || !previousBass)
      continue;
    const prepared = noteToMidi(previousPrincipal.pitch) === noteToMidi(suspensionNote.pitch);
    const dissonance = mod12(noteToMidi(suspensionNote.pitch) - noteToMidi(bass.pitch)) === 5;
    const resolvesDown = noteToMidi(resolutionNote.pitch) === noteToMidi(suspensionNote.pitch) - 1;
    const resolution = mod12(noteToMidi(resolutionNote.pitch) - noteToMidi(bass.pitch)) === 4;
    const preparationConsonant = [3, 4, 8, 9].includes(
      mod12(noteToMidi(previousPrincipal.pitch) - noteToMidi(previousBass.pitch))
    );
    if (prepared && preparationConsonant && dissonance && resolvesDown && resolution) {
      return {
        eventIds: [
          previousPrincipal.id,
          suspensionNote.id,
          resolutionNote.id,
          previousBass.id,
          bass.id,
          suspensionFigure.id,
          resolutionFigure.id,
        ],
      };
    }
  }
  return undefined;
}

function soundingNoteAt(
  score: NormalizedScore,
  partId: string,
  measureId: string,
  onset: { numerator: number; denominator: number }
): Extract<ScoreEvent, { type: "note" }> | undefined {
  return score.events.find(
    (event): event is Extract<ScoreEvent, { type: "note" }> =>
      event.type === "note" &&
      event.partId === partId &&
      event.measureId === measureId &&
      compareOnset(event.onset, onset) <= 0 &&
      compareOnset(onset, addDuration(event.onset, event.duration)) < 0
  );
}

function previousNote(
  score: NormalizedScore,
  partId: string,
  beforeEventId: string | undefined
): Extract<ScoreEvent, { type: "note" }> | undefined {
  const notes = score.events.filter(
    (event): event is Extract<ScoreEvent, { type: "note" }> =>
      event.type === "note" && event.partId === partId
  );
  const index = notes.findIndex((event) => event.id === beforeEventId);
  return index > 0 ? notes[index - 1] : undefined;
}

function compareOnset(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function addDuration(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
): { numerator: number; denominator: number } {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}
