import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { noteToMidi, transposeNote } from "./pitch.js";

const Id = Type.String({ pattern: "^[a-z0-9][a-z0-9._:-]*$", minLength: 1 });
const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ConstituentStringSchema = Type.Object(
  {
    id: Id,
    openPitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
    fretsWithCourse: Type.Boolean(),
  },
  { additionalProperties: false }
);
export type ConstituentString = Static<typeof ConstituentStringSchema>;

export const CourseConfigurationSchema = Type.Object(
  {
    course: Type.Integer({ minimum: 1 }),
    stopped: Type.Boolean(),
    strings: Type.Array(ConstituentStringSchema, { minItems: 1 }),
    notationIdentity: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type CourseConfiguration = Static<typeof CourseConfigurationSchema>;

export const TechniqueApplicabilitySchema = Type.Object(
  {
    technique: Type.Union([
      Type.Literal("rasgueado"),
      Type.Literal("punteado"),
      Type.Literal("campanella"),
      Type.Literal("barre"),
      Type.Literal("damping"),
    ]),
    status: Type.Union([
      Type.Literal("applicable"),
      Type.Literal("not_applicable"),
      Type.Literal("unknown"),
    ]),
    evidenceIds: Type.Array(Id, { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const InstrumentInstanceConfigurationSchema = Type.Object(
  {
    id: Id,
    profileId: Id,
    profileVersion: Type.String({ minLength: 1 }),
    scaleLength: Type.Optional(
      Type.Object(
        { value: Type.Number({ exclusiveMinimum: 0 }), unit: Type.Literal("mm") },
        { additionalProperties: false }
      )
    ),
    physicalSetup: Type.Record(
      Type.String(),
      Type.Union([Type.String(), Type.Number(), Type.Boolean()])
    ),
    courses: Type.Array(CourseConfigurationSchema, { minItems: 1 }),
    tuningState: Type.Object(
      {
        id: Id,
        variant: Type.String({ minLength: 1 }),
        referencePitchHz: Type.Number({ exclusiveMinimum: 0 }),
      },
      { additionalProperties: false }
    ),
    notationConfiguration: Type.Object(
      {
        system: Type.String({ minLength: 1 }),
        courseOrder: Type.Literal("highest_first"),
        notationIdentityByCourse: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
      },
      { additionalProperties: false }
    ),
    techniqueApplicability: Type.Array(TechniqueApplicabilitySchema, { minItems: 1 }),
    contentDigest: Digest,
  },
  { additionalProperties: false }
);
export type InstrumentInstanceConfiguration = Static<typeof InstrumentInstanceConfigurationSchema>;

export type BaroqueGuitarStringing = "french" | "italian" | "mixed";

const BAROQUE_GUITAR_STRINGING: Record<BaroqueGuitarStringing, readonly (readonly string[])[]> = {
  french: [["E4"], ["B3", "B3"], ["G3", "G3"], ["D4", "D4"], ["A3", "A3"]],
  italian: [["E4"], ["B3", "B3"], ["G3", "G3"], ["D4", "D3"], ["A3", "A2"]],
  mixed: [["E4"], ["B3", "B3"], ["G3", "G3"], ["D4", "D3"], ["A3", "A3"]],
};

export function createBaroqueGuitarInstance(
  stringing: BaroqueGuitarStringing = "french",
  overrides: { scaleLengthMm?: number; referencePitchHz?: number } = {}
): InstrumentInstanceConfiguration {
  const withoutIdentity = {
    profileId: "baroque-guitar-5",
    profileVersion: "2.0.0",
    scaleLength: { value: overrides.scaleLengthMm ?? 690, unit: "mm" as const },
    physicalSetup: { frets: 8, courseCount: 5, stringing },
    courses: BAROQUE_GUITAR_STRINGING[stringing].map((pitches, courseIndex) => ({
      course: courseIndex + 1,
      stopped: true,
      strings: pitches.map((openPitch, stringIndex) => ({
        id: `string.c${courseIndex + 1}.s${stringIndex + 1}`,
        openPitch,
        fretsWithCourse: true,
      })),
      notationIdentity: `course-${courseIndex + 1}`,
    })),
    tuningState: {
      id: `tuning.baroque-guitar.${stringing}`,
      variant: stringing,
      referencePitchHz: overrides.referencePitchHz ?? 440,
    },
    notationConfiguration: {
      system: "french-letter",
      courseOrder: "highest_first" as const,
      notationIdentityByCourse: ["course-1", "course-2", "course-3", "course-4", "course-5"],
    },
    techniqueApplicability: [
      {
        technique: "rasgueado" as const,
        status: "applicable" as const,
        evidenceIds: ["profile.baroque-guitar-5"],
        rationale:
          "Five stopped courses support strummed chordal technique; suitability remains passage-specific.",
      },
      {
        technique: "punteado" as const,
        status: "applicable" as const,
        evidenceIds: ["profile.baroque-guitar-5"],
        rationale:
          "Individually plucked course technique is mechanically applicable; suitability remains passage-specific.",
      },
      ...(["campanella", "barre", "damping"] as const).map((technique) => ({
        technique,
        status: "applicable" as const,
        evidenceIds: ["profile.baroque-guitar-5"],
        rationale: `${technique} is mechanically available but requires separate musical and ergonomic evaluation.`,
      })),
    ],
  };
  const contentDigest = digestInstrumentInstance(withoutIdentity);
  return Value.Decode(InstrumentInstanceConfigurationSchema, {
    id: `instrument-instance.${contentDigest.slice(0, 24)}`,
    ...withoutIdentity,
    contentDigest,
  });
}

export function assertInstrumentInstanceIdentity(instance: InstrumentInstanceConfiguration): void {
  const { id, contentDigest, ...content } = instance;
  const expected = digestInstrumentInstance(content);
  if (contentDigest !== expected || id !== `instrument-instance.${expected.slice(0, 24)}`) {
    throw new Error("Instrument Instance identity does not match its canonical content");
  }
}

export function digestInstrumentInstance(
  value: Omit<InstrumentInstanceConfiguration, "id" | "contentDigest">
): string {
  return sha256(canonicalInstrumentInstanceJson(value));
}

export function soundingPitches(
  instance: InstrumentInstanceConfiguration,
  courseNumber: number,
  fret: number
): string[] {
  const course = instance.courses.find((candidate) => candidate.course === courseNumber);
  if (!course) throw new Error(`Instrument Instance has no course ${courseNumber}`);
  if (!Number.isInteger(fret) || fret < 0) throw new Error(`Invalid fret: ${fret}`);
  if (!course.stopped && fret !== 0) throw new Error(`Course ${courseNumber} is unstopped`);
  return course.strings.map((string) => {
    if (fret > 0 && !string.fretsWithCourse) {
      throw new Error(`${string.id} does not fret with course ${courseNumber}`);
    }
    return fret === 0 ? string.openPitch : transposeNote(string.openPitch, fret);
  });
}

export function instrumentInstanceRange(instance: InstrumentInstanceConfiguration, frets = 8) {
  const pitches = instance.courses.flatMap((course) =>
    course.strings.flatMap((string) => [
      string.openPitch,
      ...(course.stopped && string.fretsWithCourse ? [transposeNote(string.openPitch, frets)] : []),
    ])
  );
  return {
    lowest: pitches.reduce((left, right) => (noteToMidi(left) <= noteToMidi(right) ? left : right)),
    highest: pitches.reduce((left, right) =>
      noteToMidi(left) >= noteToMidi(right) ? left : right
    ),
  };
}

export function canonicalInstrumentInstanceJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalInstrumentInstanceJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalInstrumentInstanceJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// Synchronous, browser-safe SHA-256 keeps exact instance identities identical in UI and server code.
function sha256(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const x = w[index - 15]!;
      const y = w[index - 2]!;
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      w[index] = (w[index - 16]! + s0 + w[index - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const t1 = (hh! + s1 + choice + k[index]! + w[index]!) >>> 0;
      const s0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + majority) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a!) >>> 0;
    h[1] = (h[1]! + b!) >>> 0;
    h[2] = (h[2]! + c!) >>> 0;
    h[3] = (h[3]! + d!) >>> 0;
    h[4] = (h[4]! + e!) >>> 0;
    h[5] = (h[5]! + f!) >>> 0;
    h[6] = (h[6]! + g!) >>> 0;
    h[7] = (h[7]! + hh!) >>> 0;
  }
  return h.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
