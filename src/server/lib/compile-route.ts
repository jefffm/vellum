import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import path from "node:path";
import process from "node:process";
import {
  CompileParamsSchema,
  type CompileError,
  type CompileParams,
  type CompileResult,
} from "../../types.js";
import { createApiRoute } from "./create-route.js";
import { SubprocessRunner, type SubprocessResult } from "./subprocess.js";

function lilypondIncludeDirs(): string[] {
  const base = process.cwd();
  return [
    process.env.VELLUM_INSTRUMENTS_DIR ?? path.join(base, "instruments"),
    path.join(base, "templates"),
  ];
}

export type CompileRouteOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  timeout?: number;
};

export function createCompileRoute(options: CompileRouteOptions = {}): RequestHandler {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? 30_000);

  return createApiRoute<CompileParams, CompileResult>({
    validate: (body) => Value.Decode(CompileParamsSchema, body),
    handler: async (params) => compileLilyPond(params, runner, options.timeout ?? 30_000),
  });
}

async function compileLilyPond(
  params: CompileParams,
  runner: Pick<SubprocessRunner, "run">,
  timeout: number
): Promise<CompileResult> {
  const format = params.format ?? "svg";
  const runs: SubprocessResult[] = [];

  if (format === "svg" || format === "both") {
    runs.push(
      await runLilyPond(runner, params.source, ["--svg", "-o", "output", "source.ly"], timeout)
    );
  }

  if (format === "pdf" || format === "both") {
    runs.push(await runLilyPond(runner, params.source, ["-o", "output", "source.ly"], timeout));
  }

  const files = new Map<string, Buffer>();
  for (const run of runs) {
    for (const [name, content] of run.files) {
      files.set(name, content);
    }
  }

  const errors = runs.flatMap((run) => parseLilyPondErrors(run.stderr, params.source));

  if (errors.length === 0) {
    for (const run of runs) {
      if (run.exitCode !== 0) {
        errors.push({
          bar: 0,
          beat: 0,
          line: 0,
          type: "lilypond",
          message: run.stderr.trim() || `LilyPond exited with code ${run.exitCode}`,
        });
      }
    }
  }

  return {
    svg: readTextArtifact(files, ".svg"),
    pdf: readBase64Artifact(files, ".pdf"),
    midi: readBase64Artifact(files, ".midi") ?? readBase64Artifact(files, ".mid"),
    errors,
    barCount: countBars(params.source),
    voiceCount: countVoices(params.source),
  };
}

async function runLilyPond(
  runner: Pick<SubprocessRunner, "run">,
  source: string,
  args: string[],
  timeout: number
): Promise<SubprocessResult> {
  const includeArgs = lilypondIncludeDirs().flatMap((dir) => ["-I", dir]);
  return await runner.run({
    command: "lilypond",
    args: [...includeArgs, ...args],
    inputFile: { name: "source.ly", content: source },
    timeout,
    outputGlobs: ["*.svg", "*.pdf", "*.midi", "*.mid"],
  });
}

export function parseLilyPondErrors(stderr: string, source?: string): CompileError[] {
  const errors: CompileError[] = [];
  const barMap = source ? buildLineToBarMap(source) : undefined;
  const lines = stderr.split(/\r?\n/);
  let skipContinuation = false;

  for (const line of lines) {
    // Skip continuation lines (context lines after an error)
    if (skipContinuation) {
      if (/^\s/.test(line) || /^\s*\^+\s*$/.test(line)) {
        continue;
      }
      skipContinuation = false;
    }

    const locationMatch = line.match(
      /(?:(?:[^:\s]+):)?(\d+):(\d+):\s*(?:error:|warning:)?\s*(.+)$/i
    );
    if (locationMatch && /error|warning|syntax|unexpected|barcheck/i.test(line)) {
      const lineNumber = Number(locationMatch[1]);
      const message = locationMatch[3].trim();
      const type = classifyError(line, message);
      const bar = barMap ? lookupBar(barMap, lineNumber) : 0;
      const beat = extractBeat(message);

      errors.push({
        bar,
        beat,
        line: lineNumber,
        type,
        message,
      });
      skipContinuation = true;
      continue;
    }

    const genericError = line.match(/(?:error|fatal error):\s*(.+)$/i);
    if (genericError) {
      errors.push({
        bar: 0,
        beat: 0,
        line: 0,
        type: "lilypond",
        message: genericError[1].trim(),
      });
      skipContinuation = true;
    }
  }

  return errors;
}

function classifyError(_line: string, message: string): string {
  const lower = message.toLowerCase();

  if (/syntax error|unexpected/i.test(lower)) {
    return "syntax";
  }
  if (/out of range|too high|too low/i.test(lower)) {
    return "note_out_of_range";
  }
  if (/unknown|undefined|not defined/i.test(lower)) {
    return "undefined_variable";
  }
  if (/barcheck failed/i.test(lower)) {
    return "barcheck";
  }

  return "lilypond";
}

function buildLineToBarMap(source: string): Map<number, number> {
  const map = new Map<number, number>();
  const sourceLines = source.split(/\r?\n/);
  let currentBar = 1;

  for (let i = 0; i < sourceLines.length; i++) {
    const lineNumber = i + 1;
    map.set(lineNumber, currentBar);

    // Count bar checks (|) and \bar commands on this line
    // Strip comments before counting; \stringTuning <...> blocks are not stripped
    // (no current .ily files contain | in stringTuning, so this is safe for now)
    const stripped = sourceLines[i].replace(/%.*$/, "");
    const barChecks = (stripped.match(/\|/g) ?? []).length;
    const barCommands = (stripped.match(/\\bar\b/g) ?? []).length;
    currentBar += barChecks + barCommands;
  }

  return map;
}

function lookupBar(map: Map<number, number>, lineNumber: number): number {
  return map.get(lineNumber) ?? 0;
}

function extractBeat(message: string): number {
  const beatMatch = message.match(/barcheck failed at:\s*(\d+)/);
  return beatMatch ? Number(beatMatch[1]) : 0;
}

function readTextArtifact(files: Map<string, Buffer>, extension: string): string | undefined {
  const matching = [...files.entries()]
    .filter(([name]) => name.endsWith(extension))
    .sort(([left], [right]) => left.localeCompare(right));

  if (matching.length === 0) {
    return undefined;
  }

  return matching.map(([, content]) => content.toString("utf8")).join("\n");
}

function readBase64Artifact(files: Map<string, Buffer>, extension: string): string | undefined {
  const artifact = [...files.entries()]
    .filter(([name]) => name.endsWith(extension))
    .sort(([left], [right]) => left.localeCompare(right))[0];

  return artifact ? artifact[1].toString("base64") : undefined;
}

function countBars(source: string): number | undefined {
  const stripped = source.replace(/%.*$/gm, "");
  const count = (stripped.match(/\|/g) ?? []).length;
  return count > 0 ? count : undefined;
}

function countVoices(source: string): number | undefined {
  const voiceMatches = source.match(/\\new\s+Voice/g) ?? [];
  return voiceMatches.length > 0 ? voiceMatches.length : undefined;
}
