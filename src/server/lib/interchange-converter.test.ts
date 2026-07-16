import { describe, expect, it, vi } from "vitest";
import { convertInterchangeToMusicXml } from "./interchange-converter.js";
import type { SubprocessConfig, SubprocessResult } from "./subprocess.js";

function convertedResult(): SubprocessResult {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    files: new Map([["converted.musicxml", Buffer.from("<score-partwise/>")]]),
    durationMs: 1,
  };
}

describe("interchange converter command policy", () => {
  it("ignores process environment overrides when choosing the production MuseScore command", async () => {
    const previous = process.env.VELLUM_MUSESCORE_COMMAND;
    process.env.VELLUM_MUSESCORE_COMMAND = "/tmp/hostile-musescore";
    try {
      const run = vi
        .fn<(config: SubprocessConfig) => Promise<SubprocessResult>>()
        .mockResolvedValue(convertedResult());
      const converted = await convertInterchangeToMusicXml("mscz", Buffer.from("fixture"), {
        runner: { run },
      });

      expect(run.mock.calls[0]![0].command).toBe("mscore");
      expect(converted.converter).toBe("mscore");
    } finally {
      if (previous === undefined) delete process.env.VELLUM_MUSESCORE_COMMAND;
      else process.env.VELLUM_MUSESCORE_COMMAND = previous;
    }
  });

  it("accepts an explicitly injected MuseScore command for controlled callers", async () => {
    const run = vi
      .fn<(config: SubprocessConfig) => Promise<SubprocessResult>>()
      .mockResolvedValue(convertedResult());
    const converted = await convertInterchangeToMusicXml("mscz", Buffer.from("fixture"), {
      runner: { run },
      musescoreCommand: "/test/musescore",
    });

    expect(run.mock.calls[0]![0].command).toBe("/test/musescore");
    expect(converted.converter).toBe("/test/musescore");
  });
});
