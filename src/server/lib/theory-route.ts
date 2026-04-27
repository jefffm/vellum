import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import path from "node:path";
import process from "node:process";
import {
  AnalysisResultSchema,
  AnalyzeParamsSchema,
  ChordAnalysisSchema,
  ChordifyParamsSchema,
  LintParamsSchema,
  LintViolationSchema,
  type AnalysisResult,
  type AnalyzeParams,
  type ChordAnalysis,
  type ChordifyParams,
  type LintParams,
  type LintViolation,
} from "../../types.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { SubprocessRunner } from "./subprocess.js";

export type TheoryRouteOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  timeout?: number;
  theoryPath?: string;
};

const DEFAULT_TIMEOUT = 30_000;
const LintResultSchema = Type.Object({ violations: Type.Array(LintViolationSchema) });

export function createChordifyRoute(options: TheoryRouteOptions = {}): RequestHandler {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? DEFAULT_TIMEOUT);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  return createApiRoute<ChordifyParams, ChordAnalysis[]>({
    validate: (body) => Value.Decode(ChordifyParamsSchema, body),
    handler: async (params) =>
      normalizeChordifyResult(
        await runTheorySubcommand("chordify", params.source, runner, timeout, options.theoryPath)
      ),
  });
}

export function createAnalyzeRoute(options: TheoryRouteOptions = {}): RequestHandler {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? DEFAULT_TIMEOUT);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  return createApiRoute<AnalyzeParams, AnalysisResult>({
    validate: (body) => Value.Decode(AnalyzeParamsSchema, body),
    handler: async (params) =>
      normalizeAnalysisResult(
        await runTheorySubcommand("analyze", params.source, runner, timeout, options.theoryPath)
      ),
  });
}

export function createLintRoute(options: TheoryRouteOptions = {}): RequestHandler {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? DEFAULT_TIMEOUT);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  return createApiRoute<LintParams, { violations: LintViolation[] }>({
    validate: (body) => Value.Decode(LintParamsSchema, body),
    handler: async (params) =>
      normalizeLintResult(
        await runTheorySubcommand("lint", params.source, runner, timeout, options.theoryPath)
      ),
  });
}

type TheorySubcommand = "chordify" | "analyze" | "lint";

async function runTheorySubcommand(
  subcommand: TheorySubcommand,
  source: string,
  runner: Pick<SubprocessRunner, "run">,
  timeout: number,
  theoryPath = defaultTheoryPath()
): Promise<unknown> {
  const result = await runner.run({
    command: "python3",
    args: [theoryPath, subcommand],
    stdin: source,
    timeout,
  });

  if (result.exitCode !== 0) {
    const message =
      parseTheoryError(result.stderr) ??
      `theory.py ${subcommand} exited with code ${result.exitCode}`;
    throw new ApiRouteError(message, isEmptyInputError(message) ? 400 : 500);
  }

  try {
    return JSON.parse(result.stdout) as unknown;
  } catch (error) {
    throw new ApiRouteError(
      `Invalid JSON from theory.py ${subcommand}: ${errorMessage(error)}`,
      500
    );
  }
}

function defaultTheoryPath(): string {
  return path.resolve(process.cwd(), "src/server/theory.py");
}

function normalizeChordifyResult(value: unknown): ChordAnalysis[] {
  const rawChords = isRecord(value) && Array.isArray(value.chords) ? value.chords : value;
  if (!Array.isArray(rawChords)) {
    throw new ApiRouteError("Invalid chordify response from theory.py", 500);
  }

  return Value.Decode(Type.Array(ChordAnalysisSchema), rawChords.map(normalizeChord));
}

function normalizeAnalysisResult(value: unknown): AnalysisResult {
  if (!isRecord(value)) {
    throw new ApiRouteError("Invalid analyze response from theory.py", 500);
  }

  const normalized = {
    key: typeof value.key === "string" ? value.key : "unknown",
    timeSignature: typeof value.timeSignature === "string" ? value.timeSignature : "unknown",
    voices: Array.isArray(value.voices) ? value.voices : [],
    chords: Array.isArray(value.chords) ? value.chords.map(normalizeChord) : [],
  };

  return Value.Decode(AnalysisResultSchema, normalized);
}

function normalizeLintResult(value: unknown): { violations: LintViolation[] } {
  const normalized = {
    violations: isRecord(value) && Array.isArray(value.violations) ? value.violations : [],
  };

  return Value.Decode(LintResultSchema, normalized);
}

function normalizeChord(value: unknown): ChordAnalysis {
  if (!isRecord(value)) {
    throw new ApiRouteError("Invalid chord entry from theory.py", 500);
  }

  return Value.Decode(ChordAnalysisSchema, {
    bar: value.bar,
    beat: value.beat,
    pitches: value.pitches,
    chord: stringProperty(value, "chord") ?? stringProperty(value, "name"),
    romanNumeral: stringProperty(value, "romanNumeral") ?? stringProperty(value, "roman"),
  });
}

function parseTheoryError(stderr: string): string | undefined {
  const trimmed = stderr.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed) && typeof parsed.error === "string" && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch {
    // Fall back to raw stderr below.
  }

  return trimmed;
}

function isEmptyInputError(message: string): boolean {
  return /no musicxml input|empty input|stdin/i.test(message);
}

function stringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === "string" ? property : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "unknown error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
