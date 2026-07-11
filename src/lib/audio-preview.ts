import type { ArrangementScore, NormalizedScore, Rational } from "./music-domain.js";
import { noteToMidi } from "./pitch.js";

export type PlaybackPart =
  | "full"
  | "principal-voice"
  | "continuo-foundation"
  | "realization"
  | "accompaniment"
  | `voice:${string}`;

export type PlaybackEvent = {
  occurrenceId: string;
  measureOccurrenceId: string;
  iteration: number;
  arrangementEventId: string;
  sourceEventIds: string[];
  transformationEntryIds: string[];
  auditTargetIds: string[];
  instrumentId?: string;
  part: Exclude<PlaybackPart, "full">;
  midi: number;
  startSeconds: number;
  durationSeconds: number;
};

export type AudioPreview = {
  tempo: number;
  durationSeconds: number;
  synthesis: "basic-oscillator";
  mode: "literal";
  performedForm: {
    measureOccurrences: Array<{
      id: string;
      measureId: string;
      iteration: number;
      startSeconds: number;
      durationSeconds: number;
    }>;
    traversalDecisions: string[];
    skipRepeats: boolean;
  };
  parts: Array<{ id: PlaybackPart; label: string }>;
  events: PlaybackEvent[];
};

export function buildAudioPreview(
  arrangement: ArrangementScore,
  score: NormalizedScore,
  tempo = 70,
  options: { skipRepeats?: boolean } = {}
): AudioPreview {
  const secondsPerQuarter = 60 / tempo;
  const canonicalOccurrences =
    score.performedForm?.measureOccurrences ??
    score.measures.map((measure) => ({
      id: `measure-occurrence.${measure.id}`,
      measureId: measure.id,
      iteration: 1,
    }));
  const seenMeasures = new Set<string>();
  const occurrences = options.skipRepeats
    ? canonicalOccurrences.filter((occurrence) => {
        if (seenMeasures.has(occurrence.measureId)) return false;
        seenMeasures.add(occurrence.measureId);
        return true;
      })
    : canonicalOccurrences;
  const performedMeasures: AudioPreview["performedForm"]["measureOccurrences"] = [];
  let elapsedQuarters = 0;
  for (const occurrence of occurrences) {
    const measure = score.measures.find((candidate) => candidate.id === occurrence.measureId);
    if (!measure)
      throw new Error(`Performed Form references unknown measure: ${occurrence.measureId}`);
    const durationQuarters = rationalValue(measure.duration);
    performedMeasures.push({
      id: occurrence.id,
      measureId: occurrence.measureId,
      iteration: occurrence.iteration,
      startSeconds: elapsedQuarters * secondsPerQuarter,
      durationSeconds: durationQuarters * secondsPerQuarter,
    });
    elapsedQuarters += rationalValue(measure.duration);
  }
  const events: PlaybackEvent[] = [];
  for (const occurrence of performedMeasures) {
    for (const event of arrangement.events.filter(
      (candidate) => candidate.measureId === occurrence.measureId
    )) {
      if (event.type === "rest") continue;
      const pitches = event.pitches.map((pitch) => ({ pitch, midi: noteToMidi(pitch) }));
      const principalMidi = event.principalVoiceSourceEventId
        ? Math.max(...pitches.map(({ midi }) => midi))
        : undefined;
      for (const [{ midi }, pitchIndex] of pitches.map((pitch, index) => [pitch, index] as const)) {
        const part = playbackPart(event, midi, principalMidi);
        const transformationEntries = (arrangement.transformationReport ?? []).filter((entry) =>
          entry.arrangementEventIds.includes(event.id)
        );
        events.push({
          occurrenceId: `playback-occurrence.${occurrence.id}.${event.id}.${pitchIndex + 1}`,
          measureOccurrenceId: occurrence.id,
          iteration: occurrence.iteration,
          arrangementEventId: event.id,
          sourceEventIds: event.sourceEventIds,
          transformationEntryIds: transformationEntries.flatMap((entry) =>
            entry.id ? [entry.id] : []
          ),
          auditTargetIds: transformationEntries.flatMap(
            (entry) =>
              entry.preservationTargetIds ??
              (entry.sourceRelationshipId ? [entry.sourceRelationshipId] : [])
          ),
          instrumentId: event.instrumentId,
          part,
          midi,
          startSeconds: occurrence.startSeconds + rationalValue(event.onset) * secondsPerQuarter,
          durationSeconds: rationalValue(event.duration) * secondsPerQuarter,
        });
      }
    }
  }
  return {
    tempo,
    durationSeconds: elapsedQuarters * secondsPerQuarter,
    synthesis: "basic-oscillator",
    mode: "literal",
    performedForm: {
      measureOccurrences: performedMeasures,
      traversalDecisions: score.performedForm?.traversalDecisions ?? [
        "Play written measures once in score order.",
      ],
      skipRepeats: options.skipRepeats ?? false,
    },
    parts: playbackParts(events, score),
    events,
  };
}

export function skipRepeatedOccurrences(preview: AudioPreview): AudioPreview {
  const seen = new Set<string>();
  const kept = preview.performedForm.measureOccurrences.filter((occurrence) => {
    if (seen.has(occurrence.measureId)) return false;
    seen.add(occurrence.measureId);
    return true;
  });
  let elapsed = 0;
  const shifts = new Map<string, number>();
  const measures = kept.map((occurrence) => {
    shifts.set(occurrence.id, elapsed - occurrence.startSeconds);
    const shifted = { ...occurrence, startSeconds: elapsed };
    elapsed += occurrence.durationSeconds;
    return shifted;
  });
  return {
    ...preview,
    durationSeconds: elapsed,
    performedForm: { ...preview.performedForm, measureOccurrences: measures, skipRepeats: true },
    events: preview.events
      .filter((event) => shifts.has(event.measureOccurrenceId))
      .map((event) => ({
        ...event,
        startSeconds: event.startSeconds + shifts.get(event.measureOccurrenceId)!,
      })),
  };
}

function playbackPart(
  event: ArrangementScore["events"][number],
  midi: number,
  principalMidi: number | undefined
): Exclude<PlaybackPart, "full"> {
  if (event.role === "principal_voice") return "principal-voice";
  if (event.role === "continuo_foundation") return "continuo-foundation";
  if (event.role === "realization") return "realization";
  if (event.role === "source_voice" && event.voiceId) return `voice:${event.voiceId}`;
  return midi === principalMidi ? "principal-voice" : "accompaniment";
}

function playbackParts(events: PlaybackEvent[], score: NormalizedScore): AudioPreview["parts"] {
  const labels: Partial<Record<Exclude<PlaybackPart, "full">, string>> = {
    "principal-voice": "Principal Voice",
    "continuo-foundation": "Continuo Foundation",
    realization: "Generated realization",
    accompaniment: "Accompaniment",
  };
  const foundationInstrument = events.find(
    (event) => event.part === "continuo-foundation"
  )?.instrumentId;
  const realizationInstrument = events.find((event) => event.part === "realization")?.instrumentId;
  if (foundationInstrument)
    labels["continuo-foundation"] = `Continuo Foundation · ${foundationInstrument}`;
  if (realizationInstrument)
    labels.realization = `Generated realization · ${realizationInstrument}`;
  const order: Array<Exclude<PlaybackPart, "full">> = [
    "principal-voice",
    "continuo-foundation",
    "realization",
    "accompaniment",
  ];
  const used = new Set(events.map((event) => event.part));
  const voiceParts = (score.parts ?? []).flatMap((part) => {
    const id = `voice:${part.id}` as const;
    return used.has(id) ? [{ id, label: part.name }] : [];
  });
  return [
    { id: "full", label: "Full arrangement" },
    ...voiceParts,
    ...order.filter((part) => used.has(part)).map((part) => ({ id: part, label: labels[part]! })),
  ];
}

function rationalValue(value: Rational): number {
  return value.numerator / value.denominator;
}
