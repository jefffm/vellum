import { Value } from "@sinclair/typebox/value";
import path from "node:path";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  OmrDiagnosticSchema,
  OmrPageMappingSchema,
  RecognizedScoreSchema,
} from "../../lib/music-domain.js";
import type { RecognizedScore } from "../../lib/music-domain.js";
import type { Static } from "@sinclair/typebox";
import { ApiRouteError } from "./create-route.js";
import { SubprocessRunner } from "./subprocess.js";

type MusicXmlNormalizerOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  scriptPath?: string;
  timeout?: number;
};

export type AudiverisNormalizationResult = {
  recognizedScore: RecognizedScore;
  pageMappings: Array<Static<typeof OmrPageMappingSchema>>;
  diagnostics: Array<Static<typeof OmrDiagnosticSchema>>;
};

export async function normalizeMusicXml(
  content: Buffer,
  filename: string,
  options: MusicXmlNormalizerOptions = {}
): Promise<RecognizedScore> {
  assertAuthorityPathRuntime("authority.validator.source-normalization", "production");
  return (await runNormalizer(content, filename, options)).recognizedScore;
}

export async function normalizeAudiverisMusicXml(
  content: Buffer,
  filename: string,
  nativeOmr: Buffer,
  options: MusicXmlNormalizerOptions = {}
): Promise<AudiverisNormalizationResult> {
  return await runNormalizer(content, filename, options, nativeOmr);
}

async function runNormalizer(
  content: Buffer,
  filename: string,
  options: MusicXmlNormalizerOptions,
  nativeOmr?: Buffer
): Promise<AudiverisNormalizationResult> {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? 30_000);
  const extension = path.extname(filename).toLowerCase() === ".mxl" ? ".mxl" : ".musicxml";
  const inputName = `recognized${extension}`;
  const result = await runner.run({
    command: "python3",
    args: [
      options.scriptPath ?? path.resolve(process.cwd(), "src/server/musicxml_normalize.py"),
      inputName,
      ...(nativeOmr ? ["recognized.omr"] : []),
    ],
    inputFiles: [
      { name: inputName, content },
      ...(nativeOmr ? [{ name: "recognized.omr", content: nativeOmr }] : []),
    ],
    timeout: options.timeout ?? 30_000,
  });

  if (result.exitCode !== 0) {
    throw new ApiRouteError(`MusicXML normalization failed: ${parseCliError(result.stderr)}`, 500);
  }

  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    if (nativeOmr) {
      const envelope = parsed as {
        recognizedScore?: unknown;
        pageMappings?: unknown;
        diagnostics?: unknown;
      };
      return {
        recognizedScore: Value.Decode(RecognizedScoreSchema, envelope.recognizedScore),
        pageMappings: Array.isArray(envelope.pageMappings)
          ? envelope.pageMappings.map((mapping) => Value.Decode(OmrPageMappingSchema, mapping))
          : [],
        diagnostics: Array.isArray(envelope.diagnostics)
          ? envelope.diagnostics.map((diagnostic) => Value.Decode(OmrDiagnosticSchema, diagnostic))
          : [],
      };
    }
    return {
      recognizedScore: Value.Decode(RecognizedScoreSchema, parsed),
      pageMappings: [],
      diagnostics: [],
    };
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
