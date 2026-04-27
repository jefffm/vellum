import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  ValidateParamsSchema,
  type CompileError,
  type ValidateParams,
  type ValidateResult,
} from "../../types.js";
import { createApiRoute } from "./create-route.js";
import { lilypondIncludeDirs, parseLilyPondErrors } from "./compile-route.js";
import { SubprocessRunner } from "./subprocess.js";

export type ValidateRouteOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  timeout?: number;
};

export function createValidateRoute(options: ValidateRouteOptions = {}): RequestHandler {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? 15_000);
  const timeout = options.timeout ?? 15_000;

  return createApiRoute<ValidateParams, ValidateResult>({
    validate: (body) => Value.Decode(ValidateParamsSchema, body),
    handler: async (params) => validateSource(params, runner, timeout),
  });
}

async function validateSource(
  params: ValidateParams,
  runner: Pick<SubprocessRunner, "run">,
  timeout: number
): Promise<ValidateResult> {
  const includeArgs = lilypondIncludeDirs().flatMap((dir) => ["-I", dir]);
  const result = await runner.run({
    command: "lilypond",
    args: [...includeArgs, "-dno-print-pages", "--loglevel=ERROR", "-o", "output", "source.ly"],
    inputFile: { name: "source.ly", content: params.source },
    timeout,
    outputGlobs: [],
  });

  const errors: CompileError[] = parseLilyPondErrors(result.stderr, params.source);

  if (errors.length === 0 && result.exitCode !== 0) {
    errors.push({
      bar: 0,
      beat: 0,
      line: 0,
      type: "lilypond",
      message: result.stderr.trim() || `LilyPond exited with code ${result.exitCode}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
