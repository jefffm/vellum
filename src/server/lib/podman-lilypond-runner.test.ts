import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LILYPOND_IMAGE, PodmanLilyPondRunner } from "./podman-lilypond-runner.js";
import type { SubprocessConfig, SubprocessResult } from "./subprocess.js";

function result(overrides: Partial<SubprocessResult> = {}): SubprocessResult {
  return { stdout: "", stderr: "", exitCode: 0, files: new Map(), durationMs: 1, ...overrides };
}

function successfulPodmanRun() {
  return vi
    .fn<(config: SubprocessConfig) => Promise<SubprocessResult>>()
    .mockResolvedValueOnce(result({ stdout: `${"a".repeat(64)}\n` }))
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result({ stdout: "0" }))
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result())
    .mockResolvedValueOnce(result());
}

describe("PodmanLilyPondRunner policy", () => {
  it("rejects mutable compiler image tags", () => {
    expect(() => new PodmanLilyPondRunner({ image: "example/lilypond:latest" })).toThrow(
      "pinned by sha256"
    );
  });

  it("ignores process environment overrides when choosing the production compiler image", async () => {
    const hostileImage = `example/hostile@sha256:${"1".repeat(64)}`;
    const previous = process.env.VELLUM_LILYPOND_IMAGE;
    process.env.VELLUM_LILYPOND_IMAGE = hostileImage;
    try {
      const run = successfulPodmanRun();
      await new PodmanLilyPondRunner({ commandRunner: { run } }).run({
        command: "lilypond",
        args: [],
        inputFile: { name: "source.ly", content: "{ c'4 }" },
        outputGlobs: [],
      });

      const createArgs = run.mock.calls[0]![0].args;
      expect(createArgs).toContain(DEFAULT_LILYPOND_IMAGE);
      expect(createArgs).not.toContain(hostileImage);
    } finally {
      if (previous === undefined) delete process.env.VELLUM_LILYPOND_IMAGE;
      else process.env.VELLUM_LILYPOND_IMAGE = previous;
    }
  });

  it("creates a pinned, no-network, read-only, bounded container without host environment", async () => {
    const run = vi
      .fn<(config: SubprocessConfig) => Promise<SubprocessResult>>()
      .mockResolvedValueOnce(result({ stdout: `${"a".repeat(64)}\n` }))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result({ stdout: "0" }))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());
    const runner = new PodmanLilyPondRunner({ commandRunner: { run } });

    await runner.run({
      command: "lilypond",
      args: ["-I", "/host/escape", "--svg", "-o", "output", "source.ly"],
      inputFile: { name: "source.ly", content: "{ c'4 }" },
      outputGlobs: ["*.svg"],
    });

    const create = run.mock.calls[0][0];
    expect(create.command).toBe("podman");
    expect(create.args).toEqual(
      expect.arrayContaining([
        "--pull=never",
        "--rm",
        "--network=none",
        "--read-only",
        "--cap-drop=all",
        "--security-opt=no-new-privileges",
        "--pids-limit=64",
        "--memory=512m",
        "--cpus=1",
      ])
    );
    expect(create.args.join(" ")).not.toContain("/host/escape");
    expect(create.args.filter((arg) => arg.startsWith("--env="))).toEqual([
      "--env=HOME=/tmp",
      "--env=LANG=C.UTF-8",
      "--env=VELLUM_COMPILER_TIMEOUT=30",
    ]);
    expect(create.args.some((arg) => arg.includes(":/work"))).toBe(false);
    expect(run.mock.calls.at(-1)?.[0].args.slice(0, 3)).toEqual(["rm", "--force", "--volumes"]);
  });

  it("rejects oversized and non-LilyPond inputs before creating a container", async () => {
    const run = vi.fn();
    const runner = new PodmanLilyPondRunner({ commandRunner: { run } });
    await expect(
      runner.run({ command: "sh", args: [], inputFile: { name: "source.ly", content: "x" } })
    ).rejects.toThrow("only accepts");
    await expect(
      runner.run({
        command: "lilypond",
        args: [],
        inputFile: { name: "source.ly", content: "x".repeat(2 * 1024 * 1024 + 1) },
      })
    ).rejects.toThrow("exceeds");
    expect(run).not.toHaveBeenCalled();
  });

  it("retries a transient Podman machine startup without masking durable failures", async () => {
    const run = vi
      .fn<(config: SubprocessConfig) => Promise<SubprocessResult>>()
      .mockResolvedValueOnce(
        result({ exitCode: 125, stderr: "unable to connect to Podman socket: machine is starting" })
      )
      .mockResolvedValueOnce(result({ stdout: `${"b".repeat(64)}\n` }))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result({ stdout: "0" }))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());
    await new PodmanLilyPondRunner({ commandRunner: { run }, defaultTimeout: 5_000 }).run({
      command: "lilypond",
      args: ["--svg", "-o", "output", "source.ly"],
      inputFile: { name: "source.ly", content: "{ c'4 }" },
      outputGlobs: ["*.svg"],
    });
    expect(run.mock.calls[0]![0].args[0]).toBe("create");
    expect(run.mock.calls[1]![0].args[0]).toBe("create");

    const durable = vi
      .fn<(config: SubprocessConfig) => Promise<SubprocessResult>>()
      .mockResolvedValue(result({ exitCode: 125, stderr: "image not known" }));
    await expect(
      new PodmanLilyPondRunner({ commandRunner: { run: durable } }).run({
        command: "lilypond",
        args: [],
        inputFile: { name: "source.ly", content: "{ c'4 }" },
      })
    ).rejects.toThrow(/image not known/);
    expect(durable).toHaveBeenCalledTimes(1);
  });
});

const podmanAvailable = (() => {
  try {
    execFileSync("podman", ["info"], { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
})();

const REAL_SANDBOX_RUN_BUDGET_MS = 60_000;
const SERIALIZED_GREENSLEEVES_SANDBOX_RUNS = 6;
const FULL_SUITE_COMPILER_QUEUE_BUDGET_MS =
  SERIALIZED_GREENSLEEVES_SANDBOX_RUNS * REAL_SANDBOX_RUN_BUDGET_MS;
const SANDBOX_TEST_CLEANUP_BUDGET_MS = 30_000;
// The full host suite also serializes Greensleeves' six real compiler containers
// through the same cross-process slot. Vitest must allow the complete queue wait
// before starting the sandbox's own compiler budget and cleanup.
const QUEUE_AWARE_SANDBOX_TEST_TIMEOUT_MS =
  FULL_SUITE_COMPILER_QUEUE_BUDGET_MS + REAL_SANDBOX_RUN_BUDGET_MS + SANDBOX_TEST_CLEANUP_BUDGET_MS;

describe.skipIf(!podmanAvailable)("PodmanLilyPondRunner isolation", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempPaths.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))
    );
  });

  it(
    "compiles ordinary notation inside the pinned sandbox",
    async () => {
      const runner = new PodmanLilyPondRunner({ defaultTimeout: REAL_SANDBOX_RUN_BUDGET_MS });
      const compiled = await runner.run({
        command: "lilypond",
        args: ["--svg", "-o", "output", "source.ly"],
        inputFile: {
          name: "source.ly",
          content:
            "\\version \"2.24.0\" \\include \"instruments/baroque-guitar-5.ily\" { c'4 d' e' f' }",
        },
        timeout: REAL_SANDBOX_RUN_BUDGET_MS,
        outputGlobs: ["*.svg"],
      });
      expect(compiled.exitCode).toBe(0);
      expect([...compiled.files.keys()]).toContain("output.svg");
      expect(compiled.files.get("output.svg")?.toString()).toContain("<svg");
    },
    QUEUE_AWARE_SANDBOX_TEST_TIMEOUT_MS
  );

  it(
    "cannot read or overwrite a host sentinel and does not inherit secrets",
    async () => {
      const host = await mkdtemp(path.join(tmpdir(), "vellum-host-sentinel-"));
      tempPaths.push(host);
      const sentinel = path.join(host, "sentinel.txt");
      await writeFile(sentinel, "untouched", "utf8");
      process.env.VELLUM_SANDBOX_TEST_SECRET = "must-not-cross-boundary";

      const schemePath = sentinel.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      const source = `\\version "2.24.0"
#(system "sh -c 'cat ${schemePath}; echo pwned > ${schemePath}'")
#(system "ln -s /etc/passwd symlink.svg")
#(call-with-output-file "leak.svg" (lambda (port) (display (or (getenv "VELLUM_SANDBOX_TEST_SECRET") "absent") port)))
{ c'4 }`;
      const runner = new PodmanLilyPondRunner({ defaultTimeout: REAL_SANDBOX_RUN_BUDGET_MS });
      const compiled = await runner.run({
        command: "lilypond",
        args: ["--svg", "-o", "output", "source.ly"],
        inputFile: { name: "source.ly", content: source },
        timeout: REAL_SANDBOX_RUN_BUDGET_MS,
        outputGlobs: ["*.svg"],
      });

      delete process.env.VELLUM_SANDBOX_TEST_SECRET;
      expect(await readFile(sentinel, "utf8")).toBe("untouched");
      expect(compiled.stdout + compiled.stderr).not.toContain("untouched");
      expect(compiled.files.get("leak.svg")?.toString()).toBe("absent");
      expect(compiled.files.has("symlink.svg")).toBe(false);
    },
    QUEUE_AWARE_SANDBOX_TEST_TIMEOUT_MS
  );
});
