import path from "node:path";
import { ApiRouteError } from "./create-route.js";
import { SubprocessError, SubprocessRunner } from "./subprocess.js";

type ConverterOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  timeout?: number;
  musescoreCommand?: string;
};

export async function convertInterchangeToMusicXml(
  kind: "abc" | "mei" | "mscz",
  content: Buffer,
  options: ConverterOptions = {}
): Promise<{ content: Buffer; converter: string }> {
  const timeout = options.timeout ?? 60_000;
  const runner = options.runner ?? new SubprocessRunner(timeout);
  const inputName = `source.${kind}`;
  const command =
    kind === "mscz"
      ? (options.musescoreCommand ?? process.env.VELLUM_MUSESCORE_COMMAND ?? "mscore")
      : "python3";
  const args =
    kind === "mscz"
      ? ["-o", "converted.musicxml", inputName]
      : [path.resolve(process.cwd(), "src/server/interchange_convert.py"), inputName];
  let result;
  try {
    result = await runner.run({
      command,
      args,
      inputFile: { name: inputName, content },
      outputGlobs: ["converted.musicxml"],
      timeout,
    });
  } catch (error) {
    if (error instanceof SubprocessError) {
      throw new ApiRouteError(
        `${kind.toUpperCase()} converter is unavailable: ${error.message}`,
        503
      );
    }
    throw error;
  }
  const converted = result.files.get("converted.musicxml");
  if (result.exitCode !== 0 || !converted) {
    throw new ApiRouteError(
      `${kind.toUpperCase()} conversion failed: ${result.stderr.trim() || "no MusicXML was produced"}`,
      422
    );
  }
  return {
    content: converted,
    converter: kind === "mscz" ? command : "music21",
  };
}
