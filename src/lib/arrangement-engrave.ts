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
  const notationVoices = standardNotation
    ? buildNotationVoices(arrangement, sourceScore)
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
    stringing:
      arrangement.targetConfiguration.instrumentId === "baroque-guitar-5"
        ? arrangement.targetConfiguration.instrumentInstance?.tuningState.variant
        : undefined,
    instrument_configuration:
      arrangement.targetConfiguration.instrumentId !== "baroque-guitar-5"
        ? arrangement.targetConfiguration.instrumentInstance?.tuningState.variant
        : undefined,
    bars,
    ...(notationVoices?.length ? { notation_voices: notationVoices } : {}),
  };
}

function buildNotationVoices(
  arrangement: ArrangementScore,
  sourceScore: NormalizedScore
): NonNullable<EngraveParams["notation_voices"]> | undefined {
  const constituents = arrangement.events.flatMap((event) => event.voiceConstituents ?? []);
  const voiceIds = [...new Set(constituents.map((constituent) => constituent.voiceId))];
  if (voiceIds.length < 2) return undefined;
  return voiceIds.map((voiceId) => ({
    id: voiceId,
    bars: sourceScore.measures.map((measure) => {
      const voiceEvents = constituents
        .filter(
          (constituent) =>
            constituent.voiceId === voiceId &&
            arrangement.events.some(
              (event) =>
                event.measureId === measure.id &&
                event.voiceConstituents?.some((candidate) => candidate.id === constituent.id)
            )
        )
        .sort((left, right) => compareRational(left.onset, right.onset));
      const events: EngraveMusicEvent[] = [];
      let cursor: Rational = { numerator: 0, denominator: 1 };
      for (const constituent of voiceEvents) {
        if (compareRational(constituent.onset, cursor) < 0) {
          throw new Error(`Overlapping retained events in notation voice ${voiceId}`);
        }
        if (compareRational(constituent.onset, cursor) > 0) {
          events.push({
            type: "rest",
            spacer: true,
            duration: rationalToLilyDuration(subtractRational(constituent.onset, cursor)),
          });
        }
        events.push({
          type: "note",
          input: "pitch",
          pitch: constituent.pitch,
          duration: rationalToLilyDuration(constituent.duration),
          event_id: constituent.id,
          measure_id: measure.id,
          stem_direction: constituent.stemDirection,
          ...(constituent.tie === "start" ? { tie: true } : {}),
        });
        cursor = addRational(constituent.onset, constituent.duration);
      }
      if (compareRational(cursor, measure.duration) < 0) {
        events.push({
          type: "rest",
          spacer: true,
          duration: rationalToLilyDuration(subtractRational(measure.duration, cursor)),
        });
      }
      if (events.length === 0) {
        events.push({
          type: "rest",
          spacer: true,
          duration: rationalToLilyDuration(measure.duration),
        });
      }
      return { events };
    }),
  }));
}

function subtractRational(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
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
  if (standardNotation && event.notationSemantics) {
    assertCanonicalNotationSemantics(event);
  }
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
    ...(standardNotation && event.notationSemantics
      ? { stem_direction: event.notationSemantics.stemDirection }
      : {}),
  };
  const tieStarts = event.notationSemantics
    ? event.notationSemantics.tie === "start"
    : sourceEvent?.type === "note" && sourceEvent.tie === "start";
  const tie = tieStarts ? { tie: true } : {};
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

function assertCanonicalNotationSemantics(event: ArrangementEvent): void {
  const notation = event.notationSemantics!;
  if (
    JSON.stringify(notation.soundingPitches) !== JSON.stringify(event.pitches) ||
    compareRational(notation.duration, event.duration) !== 0
  ) {
    throw new Error(`Standard-notation semantics disagree with canonical event ${event.id}`);
  }
  if (
    notation.writtenToSoundingSemitones !== -12 ||
    notation.writtenPitches.length !== notation.soundingPitches.length ||
    notation.writtenPitches.some(
      (pitch, index) => pitch !== transposePitch(notation.soundingPitches[index]!, 12)
    )
  ) {
    throw new Error(`Classical-guitar written/sounding octave is inconsistent at ${event.id}`);
  }
}

function transposePitch(pitch: string, semitones: number): string {
  const match = pitch.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match || semitones % 12 !== 0) throw new Error(`Unsupported notation pitch: ${pitch}`);
  return `${match[1]}${Number(match[2]) + semitones / 12}`;
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
