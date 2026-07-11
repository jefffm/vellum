import type { RecognizedScore, ScoreEvent } from "./music-domain.js";
import { rational } from "./music-domain.js";

export function normalizeAbc(source: string): RecognizedScore {
  const title = header(source, "T");
  const meter = header(source, "M") ?? "4/4";
  const unit = parseFraction(header(source, "L") ?? "1/8");
  const key = header(source, "K") ?? "C";
  const body = source
    .split(/\r?\n/)
    .filter((line) => !/^[A-Za-z]:/.test(line.trim()))
    .join(" ")
    .replace(/%.*$/gm, " ");
  const bars = body
    .split("|")
    .map((bar) => bar.trim())
    .filter(Boolean);
  if (!bars.length) throw new Error("ABC source contains no measures");
  const measureDuration = parseFraction(meter);
  const measures = bars.map((_bar, index) => ({
    id: `measure.${index + 1}`,
    index,
    displayNumber: String(index + 1),
    duration: measureDuration,
  }));
  const events: ScoreEvent[] = [];
  for (const [measureIndex, bar] of bars.entries()) {
    let onset = rational(0);
    for (const match of bar.matchAll(/([_=^]*)([A-Ga-gz])([,']*)(\d+)?(?:\/(\d+))?/g)) {
      const accidental = match[1] ?? "";
      const letter = match[2]!;
      const marks = match[3] ?? "";
      const multiplier = Number(match[4] ?? 1);
      const divisor = Number(match[5] ?? 1);
      const duration = rational(unit.numerator * multiplier, unit.denominator * divisor);
      const base = {
        id: `event.${events.length + 1}`,
        partId: "part.principal",
        measureId: measures[measureIndex]!.id,
        onset,
        duration,
      };
      events.push(
        letter === "z"
          ? { ...base, type: "rest" }
          : { ...base, type: "note", pitch: abcPitch(accidental, letter, marks) }
      );
      onset = add(onset, duration);
    }
  }
  if (!events.length) throw new Error("ABC source contains no supported notes or rests");
  return {
    title,
    key: `${key} major`,
    timeSignature: meter,
    parts: [{ id: "part.principal", name: "Principal Voice", role: "principal_voice" }],
    measures,
    events,
    uncertainties: [],
  };
}

function header(source: string, name: string): string | undefined {
  return source.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
}
function parseFraction(value: string) {
  const [numerator, denominator] = value.split("/").map(Number);
  return rational(numerator!, denominator!);
}
function add(left: ReturnType<typeof rational>, right: ReturnType<typeof rational>) {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator
  );
}
function abcPitch(accidental: string, letter: string, marks: string): string {
  let octave = letter === letter.toLowerCase() ? 5 : 4;
  octave += [...marks].filter((mark) => mark === "'").length;
  octave -= [...marks].filter((mark) => mark === ",").length;
  const modifier = accidental.includes("^^")
    ? "##"
    : accidental.includes("^")
      ? "#"
      : accidental.includes("__")
        ? "bb"
        : accidental.includes("_")
          ? "b"
          : "";
  if (modifier.length > 1) throw new Error("ABC double accidentals are not supported");
  return `${letter.toUpperCase()}${modifier}${octave}`;
}
