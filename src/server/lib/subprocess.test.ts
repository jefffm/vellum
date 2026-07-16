import { access, chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTrustedExecutableResolution,
  resolveTrustedExecutable,
  runSubprocess,
  SubprocessError,
  SubprocessLimitError,
} from "./subprocess.js";
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

const lilyPondAvailable = (() => {
  try {
    resolveTrustedExecutable("lilypond");
    return true;
  } catch {
    return false;
  }
})();

describe("SubprocessRunner", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(cases)(
    "runs $name",
    async ({ config, expectedStdout, expectedExit, expectTimeout, expectError }) => {
      if (expectError) {
        await expect(runSubprocess(config)).rejects.toBeInstanceOf(SubprocessError);
        return;
      }

      if (!path.isAbsolute(config.command)) {
        expect(path.basename(resolveTrustedExecutable(config.command))).toBe(config.command);
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

  it.runIf(lilyPondAvailable)(
    "provides trusted LilyPond runtime dependencies for PDF and MIDI output",
    async () => {
      const result = await runSubprocess({
        command: "lilypond",
        args: ["-o", "output", "source.ly"],
        inputFile: {
          name: "source.ly",
          content: String.raw`\version "2.24.0"
\score {
  { c'4 }
  \layout { }
  \midi { }
}`,
        },
        outputGlobs: ["*.pdf", "*.midi", "*.mid"],
      });

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stderr).not.toMatch(
        /Cannot load default config file|No writable cache directories/
      );
      expect(result.files.has("output.pdf")).toBe(true);
      expect(result.files.has("output.midi") || result.files.has("output.mid")).toBe(true);
    }
  );

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

  it("ignores untrusted executables injected through PATH", async () => {
    const hostileDirectory = await mkdtemp(path.join(tmpdir(), "vellum-hostile-path-"));
    const hostileExecutable = path.join(hostileDirectory, "vellum-hostile-tool");
    try {
      await writeFile(hostileExecutable, "#!/bin/sh\nprintf 'hostile-path-won'\n");
      await chmod(hostileExecutable, 0o755);
      vi.stubEnv("PATH", `${hostileDirectory}${path.delimiter}${process.env.PATH ?? ""}`);

      expect(() => resolveTrustedExecutable("vellum-hostile-tool")).toThrow(SubprocessError);
      await expect(
        runSubprocess({ command: "vellum-hostile-tool", args: [] })
      ).rejects.toBeInstanceOf(SubprocessError);
    } finally {
      await rm(hostileDirectory, { recursive: true, force: true });
    }
  });

  it("does not inherit Python startup injection variables", async () => {
    const hostileDirectory = await mkdtemp(path.join(tmpdir(), "vellum-hostile-python-"));
    const marker = path.join(hostileDirectory, "sitecustomize-ran");
    try {
      await writeFile(
        path.join(hostileDirectory, "sitecustomize.py"),
        `from pathlib import Path\nPath(${JSON.stringify(marker)}).write_text("hostile")\n`
      );
      vi.stubEnv("PYTHONPATH", hostileDirectory);

      const result = await runSubprocess({ command: "python3", args: ["-c", "print('safe')"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("safe\n");
      await expect(access(marker)).rejects.toThrow();
    } finally {
      await rm(hostileDirectory, { recursive: true, force: true });
    }
  });

  it("tolerates a child closing stdin before consuming a large payload", async () => {
    const result = await runSubprocess({
      command: "true",
      args: [],
      stdin: "x".repeat(1024 * 1024),
    });

    expect(result.exitCode).toBe(0);
  });

  it("rejects absolute executables outside trusted installation roots", async () => {
    const hostileDirectory = await mkdtemp(path.join(tmpdir(), "vellum-hostile-absolute-"));
    const hostileExecutable = path.join(hostileDirectory, "tool");
    try {
      await writeFile(hostileExecutable, "#!/bin/sh\nprintf 'hostile-absolute-won'\n");
      await chmod(hostileExecutable, 0o755);

      expect(() => resolveTrustedExecutable(hostileExecutable)).toThrow(SubprocessError);
      await expect(runSubprocess({ command: hostileExecutable, args: [] })).rejects.toBeInstanceOf(
        SubprocessError
      );
    } finally {
      await rm(hostileDirectory, { recursive: true, force: true });
    }
  });

  it("rejects an untrusted absolute symlink to a trusted executable", async () => {
    const hostileDirectory = await mkdtemp(path.join(tmpdir(), "vellum-hostile-symlink-"));
    const hostileExecutable = path.join(hostileDirectory, "trusted-alias");
    const trustedExecutable = resolveTrustedExecutable("true");
    try {
      await symlink(trustedExecutable, hostileExecutable);

      expect(isTrustedExecutableResolution(hostileExecutable, trustedExecutable)).toBe(false);
      expect(() => resolveTrustedExecutable(hostileExecutable)).toThrow(SubprocessError);
    } finally {
      await rm(hostileDirectory, { recursive: true, force: true });
    }
  });

  it("rejects fabricated executables inside a user-writable Homebrew Cellar", () => {
    const fabricated = "/opt/homebrew/Cellar/vellum-hostile/1.0.0/bin/podman";

    expect(isTrustedExecutableResolution(fabricated, fabricated)).toBe(false);
  });

  it("rejects a fixed application path whose real target escaped the application bundle", () => {
    const fixedMuseScore = "/Applications/MuseScore 4.app/Contents/MacOS/mscore";

    expect(isTrustedExecutableResolution(fixedMuseScore, fixedMuseScore)).toBe(true);
    expect(isTrustedExecutableResolution(fixedMuseScore, "/tmp/hostile-mscore")).toBe(false);
  });
});
