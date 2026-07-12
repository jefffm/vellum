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
      .map((event) => toEngraveEvent(event, standardNotation, sourceScore));
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
    instrument_instance_digest: arrangement.targetConfiguration.instrumentInstance?.contentDigest,
    stringing: arrangement.targetConfiguration.instrumentInstance?.tuningState.variant,
    bars,
  };
}

export function rationalToLilyDuration(duration: Rational): string {
  for (const denominator of [1, 2, 4, 8, 16, 32, 64, 128, 256]) {
    const base: Rational = { numerator: 4, denominator };
    let value = base;
    let addition = base;
    for (let dots = 0; dots <= 3; dots += 1) {
      if (compareRational(duration, value) === 0) return `${denominator}${".".repeat(dots)}`;
      addition = { numerator: addition.numerator, denominator: addition.denominator * 2 };
      value = addRational(value, addition);
    }
  }
  if (duration.numerator <= 0 || duration.denominator <= 0) {
    throw new Error(
      `Arrangement duration must be positive: ${duration.numerator}/${duration.denominator}`
    );
  }
  return `4*${duration.numerator}/${duration.denominator}`;
}

function toEngraveEvent(
  event: ArrangementEvent,
  standardNotation: boolean,
  sourceScore: NormalizedScore
): EngraveMusicEvent {
  const sourceEvent = sourceScore.events.find((candidate) =>
    event.sourceEventIds.includes(candidate.id)
  );
  const notation = sourceEvent?.rhythmicNotation;
  const duration = rationalToLilyDuration(notation?.writtenDuration ?? event.duration);
  const boundary = notation?.tuplet?.boundary;
  const identity = {
    event_id: event.id,
    measure_id: event.measureId,
    ...(notation?.tuplet && (boundary === "start" || boundary === "start_stop")
      ? {
          tuplet_start: {
            actual_notes: notation.tuplet.actualNotes,
            normal_notes: notation.tuplet.normalNotes,
          },
        }
      : {}),
    ...(notation?.tuplet && (boundary === "stop" || boundary === "start_stop")
      ? { tuplet_end: true }
      : {}),
  };
  const tie = sourceEvent?.type === "note" && sourceEvent.tie === "start" ? { tie: true } : {};
  if (event.type === "rest") return { type: "rest", duration, ...identity };
  if (standardNotation) {
    if (event.type === "note" || event.pitches.length === 1) {
      return {
        type: "note",
        input: "pitch",
        pitch: event.pitches[0]!,
        duration,
        ...identity,
        ...tie,
      };
    }
    return {
      type: "chord",
      duration,
      positions: event.pitches.map((pitch) => ({ input: "pitch" as const, pitch })),
      ...identity,
      ...tie,
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
      ...identity,
      ...tie,
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
    ...identity,
    ...tie,
  };
}

function addRational(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
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
