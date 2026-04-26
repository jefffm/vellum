import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runSubprocess, SubprocessError } from "./subprocess.js";
import type { SubprocessConfig } from "./subprocess.js";

type SubprocessCase = {
  name: string;
  config: SubprocessConfig;
  expectedStdout?: string;
  expectedExit?: number;
  expectTimeout?: boolean;
  expectError?: boolean;
};

const cases: SubprocessCase[] = [
  {
    name: "echo",
    config: { command: "echo", args: ["hello"] },
    expectedStdout: "hello\n",
    expectedExit: 0,
  },
  {
    name: "stdin pipe",
    config: { command: "cat", args: [], stdin: "piped input" },
    expectedStdout: "piped input",
    expectedExit: 0,
  },
  {
    name: "timeout",
    config: { command: "sleep", args: ["60"], timeout: 100 },
    expectTimeout: true,
    expectedExit: 124,
  },
  {
    name: "input file",
    config: {
      command: "cat",
      args: ["input.txt"],
      inputFile: { name: "input.txt", content: "file content" },
    },
    expectedStdout: "file content",
    expectedExit: 0,
  },
  {
    name: "bad command",
    config: { command: "vellum-nonexistent-command", args: [] },
    expectError: true,
  },
];

describe("SubprocessRunner", () => {
  it.each(cases)(
    "runs $name",
    async ({ config, expectedStdout, expectedExit, expectTimeout, expectError }) => {
      if (expectError) {
        await expect(runSubprocess(config)).rejects.toBeInstanceOf(SubprocessError);
        return;
      }

      const result = await runSubprocess(config);

      if (expectedStdout !== undefined) {
        expect(result.stdout).toBe(expectedStdout);
      }

      if (expectedExit !== undefined) {
        expect(result.exitCode).toBe(expectedExit);
      }

      if (expectTimeout) {
        expect(result.stderr).toMatch(/timed out/i);
        expect(result.durationMs).toBeLessThan(3_000);
      }
    }
  );

  it("reads output files matched by glob", async () => {
    const result = await runSubprocess({
      command: process.execPath,
      args: ["-e", "require('fs').writeFileSync('out.svg', '<svg>ok</svg>')"],
      outputGlobs: ["*.svg"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.files.get("out.svg")?.toString("utf8")).toBe("<svg>ok</svg>");
  });

  it("cleans up temporary directories after successful runs", async () => {
    const result = await runSubprocess({ command: "pwd", args: [] });
    const tempDir = result.stdout.trim();

    await expect(access(tempDir)).rejects.toThrow();
  });

  it("cleans up temporary directories after spawn errors", async () => {
    const tempDirResult = await runSubprocess({ command: "pwd", args: [] });
    const knownTempParent = tempDirResult.stdout.trim().replace(/\/[^/]+$/, "");

    await expect(
      runSubprocess({ command: "vellum-nonexistent-command", args: [], cwd: knownTempParent })
    ).rejects.toBeInstanceOf(SubprocessError);
  });
});
