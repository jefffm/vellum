import { access, chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRestrictedSandboxLaunch,
  isTrustedExecutableResolution,
  resolveTrustedExecutable,
  runSubprocess,
  SubprocessAbortedError,
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

  it.runIf(process.platform === "darwin")(
    "runs local work while the OS sandbox denies socket egress",
    async () => {
      const local = await runSubprocess({
        command: process.execPath,
        args: ["-e", "process.stdout.write('local-only')"],
        networkAccess: "deny",
      });
      expect(local).toMatchObject({ exitCode: 0, stdout: "local-only" });

      const socket = await runSubprocess({
        command: process.execPath,
        args: [
          "-e",
          "const s=require('node:net').connect({host:'127.0.0.1',port:9});s.once('connect',()=>process.exit(3));s.once('error',e=>{process.stdout.write(String(e.code));process.exit(e.code==='EPERM'?0:4)});setTimeout(()=>process.exit(5),1000)",
        ],
        networkAccess: "deny",
      });
      expect(socket).toMatchObject({ exitCode: 0, stdout: "EPERM" });
    }
  );

  it.runIf(process.platform === "darwin")(
    "restricts an untrusted child to its disposable inputs and exact outputs",
    async () => {
      const canaryDirectory = await mkdtemp(path.join(homedir(), ".vellum-sandbox-canary-"));
      const canary = path.join(canaryDirectory, "owner-secret.txt");
      try {
        await writeFile(canary, "owner-secret");
        const result = await runSubprocess({
          command: process.execPath,
          args: [
            "-e",
            [
              "const fs=require('node:fs');",
              "const cp=require('node:child_process');",
              "const outcomes=[];",
              "try{fs.readFileSync(process.argv[1]);outcomes.push('ambient-read')}catch(e){outcomes.push(e.code)}",
              "try{fs.writeFileSync('undeclared.out','bad');outcomes.push('ambient-write')}catch(e){outcomes.push(e.code)}",
              "const nested=cp.spawnSync('/usr/bin/true');outcomes.push(nested.error?.code??'nested-exec');",
              "fs.writeFileSync('allowed.out','allowed');",
              "process.stdout.write(JSON.stringify(outcomes));",
            ].join(""),
            canary,
          ],
          outputGlobs: ["*.out"],
          writableOutputFiles: ["allowed.out"],
          maxOutputFiles: 1,
          maxOutputFileBytes: 1_024,
          maxOutputTotalBytes: 1_024,
          maxScannedEntries: 4,
          maxAddressSpaceBytes: 768 * 1_024 * 1_024,
          maxCpuSeconds: 5,
          maxOpenFiles: 64,
          maxFileWriteBytes: 1_024,
          networkAccess: "deny",
          filesystemAccess: "workdir-only",
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.files.get("allowed.out")?.toString("utf8")).toBe("allowed");
        const outcomes = JSON.parse(result.stdout) as string[];
        expect(outcomes).not.toContain("ambient-read");
        expect(outcomes).not.toContain("ambient-write");
        expect(outcomes).not.toContain("nested-exec");
        expect(outcomes.every((outcome) => outcome === "EPERM" || outcome === "EACCES")).toBe(true);
      } finally {
        await rm(canaryDirectory, { recursive: true, force: true });
      }
    }
  );

  it("aborts the whole process group so descendants cannot outlive cancellation", async () => {
    const markerDirectory = await mkdtemp(path.join(tmpdir(), "vellum-abort-marker-"));
    const marker = path.join(markerDirectory, "descendant-survived");
    const controller = new AbortController();
    try {
      const pending = runSubprocess(
        {
          command: process.execPath,
          args: [
            "-e",
            [
              "const {spawn}=require('node:child_process');",
              "const childScript=\"setTimeout(()=>require(\\'node:fs\\').writeFileSync(process.argv[1],\\'survived\\'),500)\";",
              "const child=spawn(process.execPath,['-e',childScript,process.argv[1]]);",
              "child.unref();setInterval(()=>{},1000);",
            ].join(""),
            marker,
          ],
          timeout: 5_000,
        },
        { signal: controller.signal }
      );
      setTimeout(() => controller.abort(), 100);
      await expect(pending).rejects.toBeInstanceOf(SubprocessAbortedError);
      await delay(750);
      await expect(access(marker)).rejects.toThrow();
    } finally {
      await rm(markerDirectory, { recursive: true, force: true });
    }
  });

  it("force-kills descendants when the process-group leader exits after SIGTERM", async () => {
    const markerDirectory = await mkdtemp(path.join(tmpdir(), "vellum-term-exit-marker-"));
    const ready = path.join(markerDirectory, "descendant-ready");
    const survived = path.join(markerDirectory, "descendant-survived");
    const controller = new AbortController();
    try {
      const pending = runSubprocess(
        {
          command: process.execPath,
          args: [
            "-e",
            [
              "const {spawn}=require('node:child_process');",
              "process.on('SIGTERM',()=>process.exit(0));",
              "const childScript=\"const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[1],'ready');setTimeout(()=>{fs.writeFileSync(process.argv[2],'survived');process.exit(0)},2100)\";",
              "const child=spawn(process.execPath,['-e',childScript,process.argv[1],process.argv[2]],{stdio:['ignore','inherit','inherit']});",
              "child.unref();setInterval(()=>{},1000);",
            ].join(""),
            ready,
            survived,
          ],
          timeout: 5_000,
        },
        { signal: controller.signal }
      );

      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          await access(ready);
          break;
        } catch {
          if (attempt === 99) throw new Error("descendant did not become ready");
          await delay(10);
        }
      }

      const abortedAt = Date.now();
      controller.abort();
      await expect(pending).rejects.toBeInstanceOf(SubprocessAbortedError);
      expect(Date.now() - abortedAt).toBeLessThan(1_500);
      await delay(Math.max(0, 2_250 - (Date.now() - abortedAt)));
      await expect(access(survived)).rejects.toThrow();
    } finally {
      await rm(markerDirectory, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform === "linux")(
    "prevents restricted Linux tools from creating descendant processes",
    async () => {
      const result = await runSubprocess({
        command: "python3",
        args: [
          "-c",
          [
            "import os,sys",
            "try:",
            " os.fork()",
            "except PermissionError:",
            " print('fork-blocked')",
            " sys.exit(0)",
            "sys.exit(9)",
          ].join("\n"),
        ],
        timeout: 5_000,
        maxAddressSpaceBytes: 512 * 1_024 * 1_024,
        maxCpuSeconds: 2,
        maxOpenFiles: 64,
        maxFileWriteBytes: 0,
        networkAccess: "deny",
        filesystemAccess: "workdir-only",
      });

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toBe("fork-blocked\n");
    }
  );

  it("rejects an already-aborted subprocess without launching it", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runSubprocess({ command: "true", args: [] }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(SubprocessAbortedError);
  });

  it.runIf(process.platform === "darwin")(
    "terminates a process group when the macOS memory watchdog exceeds its budget",
    async () => {
      await expect(
        runSubprocess({
          command: process.execPath,
          args: ["-e", "setInterval(()=>{},1000)"],
          timeout: 5_000,
          maxAddressSpaceBytes: 1,
        })
      ).rejects.toMatchObject({
        status: 413,
        code: "request_too_large",
        details: {
          resource: "subprocess",
          resourceLimit: "process_group_memory",
          limitBytes: 1,
        },
      });
    }
  );

  it("builds a Linux untrusted-document sandbox without exposing the host root", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vellum-linux-sandbox-shape-"));
    const output = path.join(directory, "page.png");
    try {
      await writeFile(output, "");
      const launch = buildRestrictedSandboxLaunch({
        platform: "linux",
        sandboxExecutable: "/usr/bin/bwrap",
        executable: "/usr/bin/pdfinfo",
        args: ["source.pdf"],
        workingDir: directory,
        writableOutputPaths: [output],
        linuxSeccompFileDescriptor: 42,
      });

      expect(launch.executable).toBe("/usr/bin/bwrap");
      expect(launch.args.join(" ")).not.toContain("--ro-bind / /");
      expect(launch.args).toContain("--unshare-net");
      expect(launch.args).toContain("--unshare-pid");
      expect(launch.args).toContain("--seccomp");
      expect(launch.inheritedFileDescriptors).toEqual([42]);
      expect(launch.args).toContain("/work");
      expect(launch.args).not.toContain(homedir());
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
