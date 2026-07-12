import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runSubprocess, SubprocessError, SubprocessLimitError } from "./subprocess.js";
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

  it("writes binary input files without UTF-8 coercion", async () => {
    const bytes = Buffer.from([0x00, 0xff, 0x89, 0x50, 0x4e, 0x47]);
    const result = await runSubprocess({
      command: process.execPath,
      args: ["-e", "process.stdout.write(require('fs').readFileSync('input.bin').toString('hex'))"],
      inputFile: { name: "input.bin", content: bytes },
    });

    expect(result.stdout).toBe(bytes.toString("hex"));
  });

  it("bounds stdout and stderr while retaining their tails", async () => {
    const result = await runSubprocess({
      command: process.execPath,
      args: [
        "-e",
        "process.stdout.write('a'.repeat(1000)+'TAIL');process.stderr.write('b'.repeat(1000)+'END')",
      ],
      maxCaptureBytes: 128,
    });

    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(128);
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(128);
    expect(result.stdout).toContain("truncated");
    expect(result.stdout.endsWith("TAIL")).toBe(true);
    expect(result.stderr.endsWith("END")).toBe(true);
  });

  it("terminates a child that exceeds its emitted-output budget", async () => {
    await expect(
      runSubprocess({
        command: process.execPath,
        args: ["-e", "for(let i=0;i<100;i++)process.stdout.write('x'.repeat(4096))"],
        maxCaptureBytes: 512,
        maxEmittedBytes: 8_192,
      })
    ).rejects.toMatchObject({
      status: 413,
      code: "request_too_large",
      details: {
        resource: "subprocess",
        limitBytes: 8_192,
        stdoutTail: expect.any(String),
        stderrTail: expect.stringContaining("subprocess_resource_limit"),
      },
    });
  });

  it("rejects generated file count and byte budgets before reading output", async () => {
    await expect(
      runSubprocess({
        command: process.execPath,
        args: [
          "-e",
          "const f=require('fs');f.writeFileSync('a.out','a');f.writeFileSync('b.out','b')",
        ],
        outputGlobs: ["*.out"],
        maxOutputFiles: 1,
      })
    ).rejects.toBeInstanceOf(SubprocessLimitError);
    await expect(
      runSubprocess({
        command: process.execPath,
        args: ["-e", "require('fs').writeFileSync('large.out','x'.repeat(1024))"],
        outputGlobs: ["*.out"],
        maxOutputFileBytes: 128,
      })
    ).rejects.toBeInstanceOf(SubprocessLimitError);
  });

  it("rejects input traversal and input byte overflow inside the disposable tree", async () => {
    await expect(
      runSubprocess({
        command: "true",
        args: [],
        inputFile: { name: "../escape", content: "no" },
      })
    ).rejects.toBeInstanceOf(SubprocessLimitError);
    await expect(
      runSubprocess({
        command: "true",
        args: [],
        inputFile: { name: "large.bin", content: Buffer.alloc(256) },
        maxInputBytes: 128,
      })
    ).rejects.toBeInstanceOf(SubprocessLimitError);
  });

  it("bounds global subprocess concurrency", async () => {
    const started = Date.now();
    await Promise.all(
      Array.from({ length: 8 }, () =>
        runSubprocess({
          command: process.execPath,
          args: ["-e", "setTimeout(()=>{},150)"],
        })
      )
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
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
