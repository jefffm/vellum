import { Chord, Interval, Key, Note, Progression, RomanNumeral, Scale } from "tonal";
import type { TheoryParams } from "./types.js";

export type TheoryValue = string | string[] | RomanParseResult;

export type RomanParseResult = {
  roman: string;
  key: string;
  chord: string;
  interval: string;
  chordType: string;
};

export function runTheoryOperation(params: TheoryParams): TheoryValue {
  switch (params.operation) {
    case "interval":
      return normalizeInterval(
        Interval.distance(requireString(params.args, "from"), requireString(params.args, "to"))
      );
    case "transpose":
      return Note.transpose(
        requireString(params.args, "note"),
        requireString(params.args, "interval")
      );
    case "chord_detect":
      return Chord.detect(requireStringArray(params.args, "notes"));
    case "chord_notes":
      return Chord.get(chordName(params.args)).notes;
    case "scale_notes":
      return Scale.get(scaleName(params.args)).notes;
    case "scale_chords":
      return scaleChords(params.args);
    case "roman_parse":
      return romanParse(params.args);
    case "enharmonic":
      return Note.enharmonic(requireString(params.args, "note"));
  }
}

function chordName(args: Record<string, unknown>): string {
  if (typeof args.chord === "string") {
    return args.chord;
  }

  const tonic = requireString(args, "tonic");
  const type = typeof args.type === "string" ? args.type : "";
  return `${tonic}${type}`;
}

function scaleName(args: Record<string, unknown>): string {
  if (typeof args.scale === "string") {
    return args.scale;
  }

  return `${requireString(args, "tonic")} ${requireString(args, "type")}`;
}

function scaleChords(args: Record<string, unknown>): string[] {
  const key = requireString(args, "key");
  const seventh = args.seventh === true;
  const [tonic, ...modeParts] = key.trim().split(/\s+/);
  const mode = modeParts.join(" ").toLowerCase();

  if (!tonic) {
    throw new Error("Theory argument 'key' must include a tonic");
  }

  if (mode.includes("minor")) {
    const minor = Key.minorKey(tonic).natural;
    return [...(seventh ? minor.chords : minor.triads)];
  }

  const major = Key.majorKey(tonic);
  return [...(seventh ? major.chords : major.triads)];
}

function romanParse(args: Record<string, unknown>): RomanParseResult {
  const key = requireString(args, "key");
  const roman = requireString(args, "roman");
  const parsed = RomanNumeral.get(roman);
  const chord = Progression.fromRomanNumerals(key, [roman])[0] ?? "";

  return {
    roman: parsed.name || roman,
    key,
    chord,
    interval: normalizeInterval(parsed.interval ?? ""),
    chordType: parsed.chordType ?? "",
  };
}

function normalizeInterval(interval: string): string {
  const match = interval.match(/^(-?\d+)([AdmMP]+)$/);

  if (!match) {
    return interval;
  }

  return `${match[2]}${match[1]}`;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Theory argument '${key}' must be a non-empty string`);
  }

  return value;
}

function requireStringArray(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Theory argument '${key}' must be an array of strings`);
  }

  return value;
}
