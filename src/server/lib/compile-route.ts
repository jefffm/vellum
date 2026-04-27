import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  CompileParamsSchema,
  type CompileError,
  type CompileParams,
  type CompileResult,
} from "../../types.js";
import { createApiRoute } from "./create-route.js";
import { SubprocessRunner, type SubprocessResult } from "./subprocess.js";

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

  const errors = runs.flatMap((run) => parseLilyPondErrors(run.stderr));

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
  return await runner.run({
    command: "lilypond",
    args,
    inputFile: { name: "source.ly", content: source },
    timeout,
    outputGlobs: ["*.svg", "*.pdf", "*.midi", "*.mid"],
  });
}

export function parseLilyPondErrors(stderr: string): CompileError[] {
  const errors: CompileError[] = [];

  for (const line of stderr.split(/\r?\n/)) {
    const locationMatch = line.match(/(?:(?:[^:\s]+):)?(\d+):(\d+):\s*(?:error:)?\s*(.+)$/i);
    if (locationMatch && /error|warning|syntax|unexpected/i.test(line)) {
      errors.push({
        bar: 0,
        beat: 0,
        line: Number(locationMatch[1]),
        type: line.toLowerCase().includes("warning") ? "warning" : "lilypond",
        message: locationMatch[3].trim(),
      });
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
    }
  }

  return errors;
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
  const count = (source.match(/\|/g) ?? []).length;
  return count > 0 ? count : undefined;
}

function countVoices(source: string): number | undefined {
  const voiceMatches = source.match(/\\new\s+Voice/g) ?? [];
  return voiceMatches.length > 0 ? voiceMatches.length : undefined;
}
