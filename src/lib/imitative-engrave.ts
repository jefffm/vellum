import { rationalToLilyDuration } from "./arrangement-engrave.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import type {
  ArrangementEvent,
  ArrangementScore,
  NormalizedScore,
  Rational,
} from "./music-domain.js";
import { scientificToLilyPond } from "./pitch.js";

export function imitativeArrangementToLilyPond(
  arrangement: ArrangementScore,
  score: NormalizedScore
): string {
  assertAuthorityPathRuntime("authority.compiler.notation-projection", "production");
  if (arrangement.targetConfiguration.instrumentId !== "renaissance-lute-6") {
    throw new Error("Imitative intabulation engraving requires renaissance-lute-6");
  }
  const voices = score.parts.map((part, index) => ({
    part,
    command: ["voiceOne", "voiceTwo", "voiceThree"][index] ?? "voiceNeutral",
    variable: ["sourceVoiceOne", "sourceVoiceTwo", "sourceVoiceThree"][index] ?? "sourceVoice",
    events: arrangement.events.filter((event) => event.voiceId === part.id),
  }));
  if (voices.some((voice) => voice.events.length === 0)) {
    throw new Error("Every imitative source voice must have an intabulation lineage");
  }
  const key = lilyKey(score.key);
  const time = score.timeSignature ? `\\time ${score.timeSignature}` : "";
  const variables = voices
    .map(
      (voice, index) => `${voice.variable} = {
  ${index === 0 ? `${key}\n  ${time}` : ""}
  ${renderVoice(voice.events, score)}
}

${voice.variable}Rhythm = {
  ${renderRhythm(voice.events, score)}
}`
    )
    .join("\n\n");
  const tabVoices = voices
    .map(
      (voice, index) =>
        `\\new TabVoice = "lineage${index + 1}" { \\${voice.command} \\${voice.variable} }`
    )
    .join("\n      ");

  return `\\version "2.24.0"
\\include "instruments/renaissance-lute-6.ily"

\\header {
  title = "${escapeLilyString(score.title ?? "Imitative Intabulation")}"
  subtitle = "Three-voice intabulation · six-course Renaissance lute"
}

${variables}

\\score {
  <<
    ${voices
      .map(
        (voice, index) => `\\new RhythmicStaff \\with {
      instrumentName = "${index + 1}"
      \\override StaffSymbol.line-count = 0
      \\remove "Time_signature_engraver"
      \\remove "Clef_engraver"
    } {
      \\new Voice = "rhythm${index + 1}" \\with { \\remove "Note_performer" } {
        \\autoBeamOff \\${voice.variable}Rhythm
      }
    }`
      )
      .join("\n    ")}
    \\new TabStaff \\with {
      instrumentName = "Lute"
      tablatureFormat = \\renaissanceLuteTabFormat
      stringTunings = \\renaissanceLuteStringTunings
    } <<
        ${tabVoices}
    >>
  >>
  \\layout { }
  \\midi { \\tempo 4 = 72 }
}
`;
}

function renderRhythm(events: ArrangementEvent[], score: NormalizedScore): string {
  return score.measures
    .map((measure) => {
      const inMeasure = events
        .filter((event) => event.measureId === measure.id)
        .slice()
        .sort((left, right) => compareRational(left.onset, right.onset));
      let cursor: Rational = { numerator: 0, denominator: 1 };
      const tokens: string[] = [];
      for (const event of inMeasure) {
        if (compareRational(event.onset, cursor) > 0) {
          tokens.push(`r${rationalToLilyDuration(subtract(event.onset, cursor))}`);
        }
        const duration = rationalToLilyDuration(event.duration);
        tokens.push(event.type === "rest" ? `r${duration}` : `c'${duration}`);
        cursor = add(event.onset, event.duration);
      }
      if (compareRational(cursor, measure.duration) < 0) {
        tokens.push(`r${rationalToLilyDuration(subtract(measure.duration, cursor))}`);
      }
      return `${tokens.join(" ")} |`;
    })
    .join("\n  ");
}

function renderVoice(events: ArrangementEvent[], score: NormalizedScore): string {
  return score.measures
    .map((measure) => {
      const inMeasure = events
        .filter((event) => event.measureId === measure.id)
        .slice()
        .sort((left, right) => compareRational(left.onset, right.onset));
      let cursor: Rational = { numerator: 0, denominator: 1 };
      const tokens: string[] = [];
      for (const event of inMeasure) {
        if (compareRational(event.onset, cursor) > 0) {
          tokens.push(`r${rationalToLilyDuration(subtract(event.onset, cursor))}`);
        }
        tokens.push(eventToken(event));
        cursor = add(event.onset, event.duration);
      }
      if (compareRational(cursor, measure.duration) < 0) {
        tokens.push(`r${rationalToLilyDuration(subtract(measure.duration, cursor))}`);
      }
      return `${tokens.join(" ")} |`;
    })
    .join("\n  ");
}

function eventToken(event: ArrangementEvent): string {
  const duration = rationalToLilyDuration(event.duration);
  if (event.type === "rest") return `r${duration}`;
  const position = event.positions[0];
  if (!position || event.pitches.length !== 1) {
    throw new Error(`Imitative voice event must have one explicit lute position: ${event.id}`);
  }
  return `${scientificToLilyPond(event.pitches[0]!)}${duration}\\${position.course}`;
}

function lilyKey(key: string | undefined): string {
  const match = key?.match(/^([A-G](?:#|b)?)\s+(major|minor)$/);
  if (!match) return "";
  const tonic = match[1]!.toLowerCase().replace("#", "is").replace("b", "es");
  return `\\key ${tonic} \\${match[2]}`;
}

function escapeLilyString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function compareRational(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function add(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function subtract(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}
