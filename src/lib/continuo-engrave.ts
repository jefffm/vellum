import { rationalToLilyDuration } from "./arrangement-engrave.js";
import type {
  ArrangementEvent,
  ArrangementScore,
  NormalizedScore,
  Rational,
  ScoreEvent,
} from "./music-domain.js";
import { scientificToLilyPond } from "./pitch.js";

export function continuoArrangementToLilyPond(
  arrangement: ArrangementScore,
  score: NormalizedScore
): string {
  if (!arrangement.targetConfiguration.notationLayouts.includes("continuo-score")) {
    throw new Error("Continuo engraving requires the continuo-score Notation Layout");
  }
  const principal = arrangement.events.filter((event) => event.role === "principal_voice");
  const foundation = arrangement.events.filter((event) => event.role === "continuo_foundation");
  const realization = arrangement.events.filter((event) => event.role === "realization");
  if (principal.length === 0 || foundation.length === 0 || realization.length === 0) {
    throw new Error(
      "Continuo engraving requires Principal Voice, foundation, and realization events"
    );
  }
  const figures = score.events.filter(
    (event): event is Extract<ScoreEvent, { type: "figured_bass" }> => event.type === "figured_bass"
  );
  const profile = arrangement.targetConfiguration.realizationProfileId!;
  const key = lilyKey(score.key);
  const time = score.timeSignature ? `\\time ${score.timeSignature}` : "";

  return `\\version "2.24.0"
\\include "instruments/piano.ily"

\\header {
  title = "${escapeLilyString(score.title ?? "Continuo Realization")}"
  subtitle = "Continuo Realization · ${escapeLilyString(profile)}"
}

principalMusic = {
  \\clef treble
  ${key}
  ${time}
  ${renderArrangementVoice(principal, score)}
}

realizationMusic = {
  \\clef bass
  ${key}
  ${time}
  ${renderArrangementVoice(realization, score)}
}

foundationMusic = {
  \\clef bass
  ${key}
  ${time}
  ${renderArrangementVoice(foundation, score)}
}

continuoFigures = \\figuremode {
  ${renderFigures(figures, score)}
}

\\score {
  <<
    \\new Staff = "principal" \\with { instrumentName = "Soprano" } {
      \\new Voice = "principalVoice" { \\principalMusic }
    }
    \\new PianoStaff \\with { instrumentName = "Piano" } <<
      \\new Staff = "realization" {
        \\new Voice = "generatedRealization" { \\realizationMusic }
      }
      \\new Staff = "foundation" {
        \\new Voice = "continuoFoundation" { \\foundationMusic }
      }
    >>
    \\new FiguredBass { \\continuoFigures }
  >>
  \\layout { }
  \\midi { \\tempo 4 = 70 }
}
`;
}

function renderArrangementVoice(events: ArrangementEvent[], score: NormalizedScore): string {
  return score.measures
    .map((measure) => {
      const inMeasure = events
        .filter((event) => event.measureId === measure.id)
        .slice()
        .sort((left, right) => compareRational(left.onset, right.onset));
      let cursor: Rational = { numerator: 0, denominator: 1 };
      const tokens: string[] = [];
      for (const event of inMeasure) {
        if (compareRational(event.onset, cursor) < 0) {
          throw new Error(`Overlapping events in semantic playback role ${event.role}`);
        }
        if (compareRational(event.onset, cursor) > 0) {
          tokens.push(`r${rationalToLilyDuration(subtractRational(event.onset, cursor))}`);
        }
        tokens.push(arrangementToken(event));
        cursor = addRational(event.onset, event.duration);
      }
      if (compareRational(cursor, measure.duration) < 0) {
        tokens.push(`r${rationalToLilyDuration(subtractRational(measure.duration, cursor))}`);
      }
      if (compareRational(cursor, measure.duration) > 0) {
        throw new Error(`Events exceed source measure ${measure.id}`);
      }
      return `${tokens.join(" ")} |`;
    })
    .join("\n  ");
}

function arrangementToken(event: ArrangementEvent): string {
  const duration = rationalToLilyDuration(event.duration);
  if (event.type === "rest") return `r${duration}`;
  if (event.pitches.length === 1) return `${scientificToLilyPond(event.pitches[0]!)}${duration}`;
  return `<${event.pitches.map(scientificToLilyPond).join(" ")}>${duration}`;
}

function renderFigures(
  events: Array<Extract<ScoreEvent, { type: "figured_bass" }>>,
  score: NormalizedScore
): string {
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
          tokens.push(`<_>${rationalToLilyDuration(subtractRational(event.onset, cursor))}`);
        }
        const figures = event.figures.map((figure) => {
          const accidental =
            figure.accidental === "#"
              ? "+"
              : figure.accidental === "b"
                ? "-"
                : figure.accidental === "natural"
                  ? "!"
                  : "";
          return `${figure.interval}${accidental}`;
        });
        tokens.push(`<${figures.join(" ")}>${rationalToLilyDuration(event.duration)}`);
        cursor = addRational(event.onset, event.duration);
      }
      if (compareRational(cursor, measure.duration) < 0) {
        tokens.push(`<_>${rationalToLilyDuration(subtractRational(measure.duration, cursor))}`);
      }
      return `${tokens.join(" ")} |`;
    })
    .join("\n  ");
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

function addRational(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function subtractRational(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}
