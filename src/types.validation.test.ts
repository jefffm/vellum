import { Value } from "@sinclair/typebox/value";
import {
  CompileParamsSchema,
  CompileResultSchema,
  InstrumentProfileSchema,
  TabPositionSchema
} from "./types.js";

const samples = [
  [TabPositionSchema, { course: 1, fret: 0, quality: "open" }],
  [CompileParamsSchema, { source: "\\version \"2.24.0\"", format: "svg" }],
  [CompileResultSchema, { errors: [], barCount: 0, voiceCount: 0 }],
  [
    InstrumentProfileSchema,
    {
      id: "sample",
      name: "Sample Instrument",
      courses: 1,
      tuning: [{ course: 1, pitch: "c'", note: "C4" }],
      frets: 8,
      constraints: ["Sample constraint"],
      notation: "french-letter"
    }
  ]
] as const;

for (const [schema, sample] of samples) {
  if (!Value.Check(schema, sample)) {
    throw new Error(`Sample failed validation: ${JSON.stringify(sample)}`);
  }
}

