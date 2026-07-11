import type { ArrangementScore, NormalizedScore, Rational } from "./music-domain.js";
import { noteToMidi } from "./pitch.js";

export type PlaybackPart =
  | "full"
  | "principal-voice"
  | "continuo-foundation"
  | "realization"
  | "accompaniment";

export type PlaybackEvent = {
  arrangementEventId: string;
  sourceEventIds: string[];
  part: Exclude<PlaybackPart, "full">;
  midi: number;
  startSeconds: number;
  durationSeconds: number;
};

export type AudioPreview = {
  tempo: number;
  durationSeconds: number;
  synthesis: "basic-oscillator";
  parts: Array<{ id: PlaybackPart; label: string }>;
  events: PlaybackEvent[];
};

export function buildAudioPreview(
  arrangement: ArrangementScore,
  score: NormalizedScore,
  tempo = 70
): AudioPreview {
  const secondsPerQuarter = 60 / tempo;
  const measureStarts = new Map<string, number>();
  let elapsedQuarters = 0;
  for (const measure of score.measures) {
    measureStarts.set(measure.id, elapsedQuarters);
    elapsedQuarters += rationalValue(measure.duration);
  }
  const events: PlaybackEvent[] = [];
  for (const event of arrangement.events) {
    if (event.type === "rest") continue;
    const measureStart = measureStarts.get(event.measureId);
    if (measureStart === undefined)
      throw new Error(`Unknown arrangement measure: ${event.measureId}`);
    const pitches = event.pitches.map((pitch) => ({ pitch, midi: noteToMidi(pitch) }));
    const principalMidi = event.principalVoiceSourceEventId
      ? Math.max(...pitches.map(({ midi }) => midi))
      : undefined;
    for (const { midi } of pitches) {
      const part = playbackPart(event, midi, principalMidi);
      events.push({
        arrangementEventId: event.id,
        sourceEventIds: event.sourceEventIds,
        part,
        midi,
        startSeconds: (measureStart + rationalValue(event.onset)) * secondsPerQuarter,
        durationSeconds: rationalValue(event.duration) * secondsPerQuarter,
      });
    }
  }
  return {
    tempo,
    durationSeconds: elapsedQuarters * secondsPerQuarter,
    synthesis: "basic-oscillator",
    parts: playbackParts(events),
    events,
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
  return midi === principalMidi ? "principal-voice" : "accompaniment";
}

function playbackParts(events: PlaybackEvent[]): AudioPreview["parts"] {
  const labels: Record<Exclude<PlaybackPart, "full">, string> = {
    "principal-voice": "Principal Voice",
    "continuo-foundation": "Continuo Foundation",
    realization: "Generated realization",
    accompaniment: "Accompaniment",
  };
  const order: Array<Exclude<PlaybackPart, "full">> = [
    "principal-voice",
    "continuo-foundation",
    "realization",
    "accompaniment",
  ];
  const used = new Set(events.map((event) => event.part));
  return [
    { id: "full", label: "Full arrangement" },
    ...order.filter((part) => used.has(part)).map((part) => ({ id: part, label: labels[part] })),
  ];
}

function rationalValue(value: Rational): number {
  return value.numerator / value.denominator;
}
