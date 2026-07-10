import { addRational, compareRational, rational } from "./music-domain.js";
import type { Rational, ScoreEvent, ScoreMeasure, ScorePart } from "./music-domain.js";

export type ParsedLilypondScore = {
  title?: string;
  key?: string;
  timeSignature?: string;
  parts: ScorePart[];
  measures: ScoreMeasure[];
  events: ScoreEvent[];
};

type ParsedEvent = {
  type: "note" | "rest";
  pitch?: string;
  duration: Rational;
};

export function parseExplicitVoiceLilypond(
  source: string,
  voiceNames: string[]
): ParsedLilypondScore {
  if (voiceNames.length === 0) {
    throw new Error("At least one LilyPond voice name is required");
  }

  const withoutComments = source.replace(/%.*$/gm, "");
  const timeSignature = matchCapture(withoutComments, /\\time\s+(\d+\/\d+)/);
  const partialDenominator = Number(matchCapture(withoutComments, /\\partial\s+(\d+)/) ?? 0);
  const measureDuration = timeSignatureDuration(timeSignature);
  const pickupDuration =
    partialDenominator > 0 ? durationFromDenominator(partialDenominator) : undefined;
  const parsedVoices = voiceNames.map((name) => ({
    name,
    events: parseVoice(extractAssignmentBlock(withoutComments, name)),
  }));
  const totalDuration = sumDurations(parsedVoices[0]!.events);
  const measures = buildMeasures(totalDuration, measureDuration, pickupDuration);
  const parts = parsedVoices.map(({ name }) => ({
    id: `part.${slug(name)}`,
    name,
    role: voiceRole(name),
  }));

  const events = parsedVoices.flatMap(({ name, events: parsedEvents }) =>
    assignEventsToMeasures(`part.${slug(name)}`, parsedEvents, measures)
  );

  return {
    title: matchCapture(withoutComments, /\btitle\s*=\s*"([^"]+)"/),
    key: parseKey(withoutComments),
    timeSignature,
    parts,
    measures,
    events,
  };
}

function extractAssignmentBlock(source: string, name: string): string {
  const assignment = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*\\{`, "g");
  const match = assignment.exec(source);
  if (!match) {
    throw new Error(`LilyPond voice assignment not found: ${name}`);
  }

  const openBraceIndex = source.indexOf("{", match.index);
  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openBraceIndex + 1, index);
  }

  throw new Error(`Unclosed LilyPond voice assignment: ${name}`);
}

function parseVoice(block: string): ParsedEvent[] {
  const musicalBody = block
    .replace(/\\key\s+[a-g](?:is|es)?[,']*\s+\\(?:major|minor)/g, " ")
    .replace(/\\time\s+\d+\/\d+/g, " ")
    .replace(/\\partial\s+\d+\.?/g, " ")
    .replace(/\\bar\s+"[^"]*"/g, " ")
    .replace(/\\[A-Za-z][A-Za-z-]*/g, " ");
  const tokenPattern =
    /(?:^|[\s(){}|])([a-g](?:isis|eses|is|es)?[,']*|[rs])(\d+)?(\.)?(?=$|[\s(){}|])/g;
  const events: ParsedEvent[] = [];
  let inheritedDenominator: number | undefined;

  for (const match of musicalBody.matchAll(tokenPattern)) {
    const token = match[1]!;
    const explicitDenominator = match[2] === undefined ? undefined : Number(match[2]);
    inheritedDenominator = explicitDenominator ?? inheritedDenominator;
    if (inheritedDenominator === undefined) {
      throw new Error(`LilyPond event has no inherited duration: ${token}`);
    }

    let duration = durationFromDenominator(inheritedDenominator);
    if (match[3] === ".") {
      duration = rational(duration.numerator * 3, duration.denominator * 2);
    }

    if (token === "r" || token === "s") {
      events.push({ type: "rest", duration });
    } else {
      events.push({ type: "note", pitch: lilyPitchToScientific(token), duration });
    }
  }

  if (events.length === 0) {
    throw new Error("LilyPond voice contains no supported note or rest events");
  }
  return events;
}

function buildMeasures(
  totalDuration: Rational,
  measureDuration: Rational,
  pickupDuration?: Rational
): ScoreMeasure[] {
  const measures: ScoreMeasure[] = [];
  let accumulated = rational(0);
  let index = 0;

  if (pickupDuration && compareRational(pickupDuration, rational(0)) > 0) {
    measures.push({
      id: "measure.0",
      index: 0,
      displayNumber: "0",
      duration: pickupDuration,
    });
    accumulated = addRational(accumulated, pickupDuration);
    index = 1;
  }

  while (compareRational(accumulated, totalDuration) < 0) {
    const remaining = rational(
      totalDuration.numerator * accumulated.denominator -
        accumulated.numerator * totalDuration.denominator,
      totalDuration.denominator * accumulated.denominator
    );
    const duration = compareRational(remaining, measureDuration) < 0 ? remaining : measureDuration;
    measures.push({
      id: `measure.${index}`,
      index,
      displayNumber: String(index),
      duration,
    });
    accumulated = addRational(accumulated, duration);
    index += 1;
  }

  return measures;
}

function assignEventsToMeasures(
  partId: string,
  parsedEvents: ParsedEvent[],
  measures: ScoreMeasure[]
): ScoreEvent[] {
  const result: ScoreEvent[] = [];
  let measureIndex = 0;
  let onset = rational(0);

  for (const [eventIndex, event] of parsedEvents.entries()) {
    const measure = measures[measureIndex];
    if (!measure) {
      throw new Error(`${partId} extends beyond the score measure graph`);
    }

    if (compareRational(addRational(onset, event.duration), measure.duration) > 0) {
      throw new Error(`${partId} event ${eventIndex + 1} crosses a measure boundary`);
    }

    const id = `event.${partId.slice("part.".length)}.${eventIndex + 1}`;
    result.push(
      event.type === "note"
        ? {
            id,
            type: "note",
            partId,
            measureId: measure.id,
            onset,
            duration: event.duration,
            pitch: event.pitch!,
            confidence: 1,
          }
        : {
            id,
            type: "rest",
            partId,
            measureId: measure.id,
            onset,
            duration: event.duration,
            confidence: 1,
          }
    );

    onset = addRational(onset, event.duration);
    if (compareRational(onset, measure.duration) === 0) {
      measureIndex += 1;
      onset = rational(0);
    }
  }

  if (measureIndex !== measures.length) {
    throw new Error(`${partId} does not fill the score measure graph`);
  }
  return result;
}

function lilyPitchToScientific(token: string): string {
  const match = token.match(/^([a-g])((?:isis|eses|is|es)?)([,']*)$/);
  if (!match) throw new Error(`Unsupported LilyPond pitch: ${token}`);

  const [, letter, accidentalToken, octaveMarks] = match;
  const accidental = accidentalToken === "is" ? "#" : accidentalToken === "es" ? "b" : "";
  if (accidentalToken === "isis" || accidentalToken === "eses") {
    throw new Error(`Double accidentals are not supported yet: ${token}`);
  }
  const apostrophes = [...octaveMarks].filter((mark) => mark === "'").length;
  const commas = [...octaveMarks].filter((mark) => mark === ",").length;
  const octave = 3 + apostrophes - commas;
  return `${letter!.toUpperCase()}${accidental}${octave}`;
}

function durationFromDenominator(denominator: number): Rational {
  if (!Number.isInteger(denominator) || denominator <= 0) {
    throw new Error(`Invalid LilyPond duration denominator: ${denominator}`);
  }
  return rational(4, denominator);
}

function timeSignatureDuration(timeSignature?: string): Rational {
  if (!timeSignature) throw new Error("LilyPond source has no time signature");
  const match = timeSignature.match(/^(\d+)\/(\d+)$/);
  if (!match) throw new Error(`Invalid time signature: ${timeSignature}`);
  return rational(Number(match[1]) * 4, Number(match[2]));
}

function sumDurations(events: ParsedEvent[]): Rational {
  return events.reduce((total, event) => addRational(total, event.duration), rational(0));
}

function parseKey(source: string): string | undefined {
  const match = source.match(/\\key\s+([a-g](?:is|es)?)\s+\\(major|minor)/);
  if (!match) return undefined;
  const tonic = lilyPitchToScientific(`${match[1]}'`).replace(/\d+$/, "");
  return `${tonic} ${match[2]}`;
}

function voiceRole(name: string): ScorePart["role"] {
  const normalized = name.toLowerCase();
  if (normalized === "soprano") return "soprano";
  if (normalized === "alto") return "alto";
  if (normalized === "tenor") return "tenor";
  if (normalized === "bass") return "bass";
  return "other";
}

function matchCapture(source: string, pattern: RegExp): string | undefined {
  return source.match(pattern)?.[1];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
