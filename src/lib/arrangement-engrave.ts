import type { EngraveMusicEvent, EngraveParams } from "./engrave-schema.js";
import type {
  ArrangementEvent,
  ArrangementScore,
  NormalizedScore,
  Rational,
} from "./music-domain.js";

export function arrangementToEngraveParams(
  arrangement: ArrangementScore,
  sourceScore: NormalizedScore
): EngraveParams {
  const standardNotation =
    arrangement.targetConfiguration.notationLayouts.includes("standard-notation");
  const eventsByMeasure = new Map<string, ArrangementEvent[]>();
  for (const event of arrangement.events) {
    const events = eventsByMeasure.get(event.measureId) ?? [];
    events.push(event);
    eventsByMeasure.set(event.measureId, events);
  }

  const bars = sourceScore.measures.map((measure) => {
    const events = (eventsByMeasure.get(measure.id) ?? [])
      .slice()
      .sort((left, right) => compareOnset(left.onset, right.onset))
      .map((event) => toEngraveEvent(event, standardNotation));
    if (events.length === 0) {
      throw new Error(`Arrangement has no events for source measure ${measure.id}`);
    }
    return { events };
  });
  const key = parseKey(arrangement.transpositionPlan.targetKey);
  const firstMeasure = sourceScore.measures[0];
  const fullMeasureDuration = timeSignatureDuration(sourceScore.timeSignature);
  const pickup =
    firstMeasure &&
    fullMeasureDuration &&
    compareRational(firstMeasure.duration, fullMeasureDuration) < 0
      ? rationalToLilyDuration(firstMeasure.duration)
      : undefined;

  return {
    instrument: arrangement.targetConfiguration.instrumentId,
    template: standardNotation ? "solo-staff" : "french-tab",
    title: sourceScore.title,
    key,
    time: sourceScore.timeSignature,
    tempo: 70,
    pickup,
    diapason_scheme:
      arrangement.targetConfiguration.instrumentId === "baroque-lute-13"
        ? arrangement.targetConfiguration.tuningId
        : undefined,
    bars,
  };
}

export function rationalToLilyDuration(duration: Rational): string {
  const supported: Array<[Rational, string]> = [
    [{ numerator: 4, denominator: 1 }, "1"],
    [{ numerator: 3, denominator: 1 }, "2."],
    [{ numerator: 2, denominator: 1 }, "2"],
    [{ numerator: 3, denominator: 2 }, "4."],
    [{ numerator: 1, denominator: 1 }, "4"],
    [{ numerator: 3, denominator: 4 }, "8."],
    [{ numerator: 1, denominator: 2 }, "8"],
    [{ numerator: 3, denominator: 8 }, "16."],
    [{ numerator: 1, denominator: 4 }, "16"],
    [{ numerator: 1, denominator: 8 }, "32"],
  ];
  const match = supported.find(([candidate]) => compareRational(duration, candidate) === 0);
  if (!match) {
    throw new Error(
      `Arrangement duration cannot be represented by the current engraver: ${duration.numerator}/${duration.denominator}`
    );
  }
  return match[1];
}

function toEngraveEvent(event: ArrangementEvent, standardNotation: boolean): EngraveMusicEvent {
  const duration = rationalToLilyDuration(event.duration);
  if (event.type === "rest") return { type: "rest", duration };
  if (standardNotation) {
    if (event.type === "note" || event.pitches.length === 1) {
      return {
        type: "note",
        input: "pitch",
        pitch: event.pitches[0]!,
        duration,
      };
    }
    return {
      type: "chord",
      duration,
      positions: event.pitches.map((pitch) => ({ input: "pitch" as const, pitch })),
    };
  }
  if (event.positions.length === 0) {
    throw new Error(`Sounding arrangement event has no course positions: ${event.id}`);
  }
  if (event.type === "note" || event.positions.length === 1) {
    const position = event.positions[0]!;
    return {
      type: "note",
      input: "position",
      course: position.course,
      fret: position.fret,
      duration,
    };
  }
  return {
    type: "chord",
    duration,
    positions: event.positions.map((position) => ({
      input: "position" as const,
      course: position.course,
      fret: position.fret,
    })),
  };
}

function parseKey(key: string | undefined): EngraveParams["key"] {
  if (!key) return undefined;
  const match = key.match(/^([A-G](?:#|b)?)\s+(major|minor)$/);
  if (!match) throw new Error(`Unsupported target key: ${key}`);
  const tonic = match[1]!.toLowerCase().replace("#", "is").replace("b", "es");
  return { tonic, mode: match[2]! };
}

function timeSignatureDuration(time: string | undefined): Rational | undefined {
  const match = time?.match(/^(\d+)\/(\d+)$/);
  if (!match) return undefined;
  return reduce({ numerator: Number(match[1]) * 4, denominator: Number(match[2]) });
}

function compareOnset(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function compareRational(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function reduce(value: Rational): Rational {
  let left = Math.abs(value.numerator);
  let right = value.denominator;
  while (right !== 0) [left, right] = [right, left % right];
  const divisor = left || 1;
  return { numerator: value.numerator / divisor, denominator: value.denominator / divisor };
}
