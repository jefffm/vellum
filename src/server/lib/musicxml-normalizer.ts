import { Value } from "@sinclair/typebox/value";
import path from "node:path";
import { RecognizedScoreSchema } from "../../lib/music-domain.js";
import type { RecognizedScore } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { SubprocessRunner } from "./subprocess.js";

type MusicXmlNormalizerOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  scriptPath?: string;
  timeout?: number;
};

export async function normalizeMusicXml(
  content: Buffer,
  filename: string,
  options: MusicXmlNormalizerOptions = {}
): Promise<RecognizedScore> {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? 30_000);
  const extension = path.extname(filename).toLowerCase() === ".mxl" ? ".mxl" : ".musicxml";
  const inputName = `recognized${extension}`;
  const result = await runner.run({
    command: "python3",
    args: [
      options.scriptPath ?? path.resolve(process.cwd(), "src/server/musicxml_normalize.py"),
      inputName,
    ],
    inputFile: { name: inputName, content },
    timeout: options.timeout ?? 30_000,
  });

  if (result.exitCode !== 0) {
    throw new ApiRouteError(`MusicXML normalization failed: ${parseCliError(result.stderr)}`, 500);
  }

  try {
    return Value.Decode(RecognizedScoreSchema, JSON.parse(result.stdout));
  } catch (error) {
    throw new ApiRouteError(
      `MusicXML normalizer returned invalid score data: ${errorMessage(error)}`,
      500
    );
  }
}

function parseCliError(stderr: string): string {
  const trimmed = stderr.trim();
  try {
    const value = JSON.parse(trimmed) as { error?: unknown };
    if (typeof value.error === "string") return value.error;
  } catch {
    // Use raw stderr below.
  }
  return trimmed || "unknown error";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
