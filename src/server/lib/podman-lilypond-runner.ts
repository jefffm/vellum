import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import {
  SubprocessError,
  SubprocessRunner,
  type SubprocessConfig,
  type SubprocessResult,
} from "./subprocess.js";

export const DEFAULT_LILYPOND_IMAGE =
  "docker.io/codello/lilypond@sha256:e9aeee661e40f9cd4b7cd573e3787f09abc52858b074e03ba04c2e17326b69f4";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_OUTPUT_FILES = 32;

export type PodmanLilyPondRunnerOptions = {
  image?: string;
  projectRoot?: string;
  commandRunner?: Pick<SubprocessRunner, "run">;
  defaultTimeout?: number;
};

/**
 * Executes externally influenced LilyPond in a disposable, no-network container.
 * The source and compiler outputs cross the boundary through `podman cp`; no
 * writable host directory, host environment, or Podman socket is exposed.
 */
export class PodmanLilyPondRunner {
  private readonly image: string;
  private readonly projectRoot: string;
  private readonly commandRunner: Pick<SubprocessRunner, "run">;
  private readonly defaultTimeout: number;

  constructor(options: PodmanLilyPondRunnerOptions = {}) {
    this.image = options.image ?? process.env.VELLUM_LILYPOND_IMAGE ?? DEFAULT_LILYPOND_IMAGE;
    if (!/@sha256:[a-f0-9]{64}$/i.test(this.image)) {
      throw new SubprocessError("The LilyPond sandbox image must be pinned by sha256 digest");
    }
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.defaultTimeout = options.defaultTimeout ?? 30_000;
    this.commandRunner = options.commandRunner ?? new SubprocessRunner(this.defaultTimeout);
  }

  async run(config: SubprocessConfig): Promise<SubprocessResult> {
    if (config.command !== "lilypond") {
      throw new SubprocessError("The LilyPond sandbox only accepts the lilypond command");
    }
    if (!config.inputFile || config.inputFile.name !== "source.ly" || config.inputFiles?.length) {
      throw new SubprocessError("The LilyPond sandbox requires exactly one source.ly input");
    }

    const source = Buffer.isBuffer(config.inputFile.content)
      ? config.inputFile.content
      : Buffer.from(config.inputFile.content);
    if (source.byteLength > MAX_SOURCE_BYTES) {
      throw new SubprocessError(`LilyPond source exceeds ${MAX_SOURCE_BYTES} bytes`);
    }

    const startedAt = Date.now();
    const timeout = config.timeout ?? this.defaultTimeout;
    const staging = await mkdtemp(path.join(tmpdir(), "vellum-lilypond-sandbox-"));
    const sourcePath = path.join(staging, "source.ly");
    const outputPath = path.join(staging, "output");
    let containerId: string | undefined;

    try {
      await writeFile(sourcePath, normalizeMountedIncludes(source), { mode: 0o600 });
      const create = await this.commandRunner.run({
        command: "podman",
        args: this.createArgs(config.args, timeout),
        timeout,
      });
      if (create.exitCode !== 0) {
        throw new SubprocessError(
          `Unable to create the LilyPond sandbox: ${create.stderr.trim() || create.stdout.trim()}`
        );
      }
      containerId = create.stdout.trim().split(/\s+/).at(-1);
      if (!containerId || !/^[a-f0-9]{12,64}$/i.test(containerId)) {
        throw new SubprocessError("Podman did not return a valid LilyPond sandbox id");
      }

      await this.requireSuccess(
        ["cp", sourcePath, `${containerId}:/work/source.ly`],
        timeout,
        "copy source into"
      );
      await this.requireSuccess(["start", containerId], timeout, "start");
      const exitCode = await this.waitForCompiler(containerId, timeout);
      const execution = await this.commandRunner.run({
        command: "podman",
        args: ["logs", containerId],
        timeout: Math.min(timeout, 10_000),
        maxCaptureBytes: 1024 * 1024,
      });

      await mkdir(outputPath);
      await this.requireSuccess(
        ["cp", `${containerId}:/work/.`, outputPath],
        Math.min(timeout, 10_000),
        "copy results from"
      );
      const files = await collectBoundedOutputs(outputPath, config.outputGlobs ?? []);

      return {
        stdout: execution.stdout,
        stderr: execution.stderr,
        exitCode,
        files,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      if (containerId) {
        await this.commandRunner
          .run({
            command: "podman",
            args: ["rm", "--force", "--volumes", containerId],
            timeout: 10_000,
          })
          .catch(() => undefined);
      }
      await rm(staging, { recursive: true, force: true });
    }
  }

  private createArgs(lilypondArgs: string[], timeoutMs: number): string[] {
    const instruments = path.join(this.projectRoot, "instruments");
    const templates = path.join(this.projectRoot, "templates");
    return [
      "create",
      "--rm",
      "--pull=never",
      "--platform=linux/amd64",
      "--network=none",
      "--read-only",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--memory=512m",
      "--cpus=1",
      "--ulimit=nofile=256:256",
      "--env=HOME=/tmp",
      "--env=LANG=C.UTF-8",
      `--env=VELLUM_COMPILER_TIMEOUT=${Math.max(1, Math.ceil(timeoutMs / 1_000))}`,
      "--label=io.vellum.compiler=true",
      "--workdir=/work",
      "--tmpfs=/work:rw,nosuid,nodev,size=64m",
      "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m",
      `--volume=${instruments}:/vellum/instruments:ro,z`,
      `--volume=${templates}:/vellum/templates:ro,z`,
      "--entrypoint=/bin/sh",
      this.image,
      "-c",
      'timeout "$VELLUM_COMPILER_TIMEOUT" lilypond "$@"; code=$?; printf "%s" "$code" > /work/.vellum-exit-code; sleep 60; exit "$code"',
      "vellum-lilypond",
      "-I",
      "/vellum/instruments",
      "-I",
      "/vellum/templates",
      ...stripUnsafeIncludeArgs(lilypondArgs),
    ];
  }

  private async requireSuccess(args: string[], timeout: number, action: string): Promise<void> {
    const result = await this.commandRunner.run({ command: "podman", args, timeout });
    if (result.exitCode !== 0) {
      throw new SubprocessError(
        `Unable to ${action} the LilyPond sandbox: ${result.stderr.trim() || result.stdout.trim()}`
      );
    }
  }

  private async waitForCompiler(containerId: string, timeout: number): Promise<number> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await this.commandRunner.run({
        command: "podman",
        args: ["exec", containerId, "cat", "/work/.vellum-exit-code"],
        timeout: Math.min(5_000, Math.max(500, deadline - Date.now())),
      });
      const code = Number(result.stdout.trim());
      if (result.exitCode === 0 && Number.isInteger(code) && code >= 0 && code <= 255) return code;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new SubprocessError(`LilyPond sandbox timed out after ${timeout}ms`);
  }
}

function normalizeMountedIncludes(source: Buffer): Buffer {
  const text = source.toString("utf8");
  return Buffer.from(
    text.replace(/(\\include\s+")instruments\//g, "$1").replace(/(\\include\s+")templates\//g, "$1")
  );
}

function stripUnsafeIncludeArgs(args: string[]): string[] {
  const safe: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "-I" || args[index] === "--include") {
      index += 1;
      continue;
    }
    if (args[index].startsWith("--include=")) continue;
    safe.push(args[index]);
  }
  return safe;
}

async function collectBoundedOutputs(
  directory: string,
  globs: string[]
): Promise<Map<string, Buffer>> {
  const matchers = globs.map(globToRegExp);
  const files = new Map<string, Buffer>();
  let totalBytes = 0;

  for (const name of await readdir(directory)) {
    const filePath = path.join(directory, name);
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || !matchers.some((matcher) => matcher.test(name))) continue;
    if (files.size >= MAX_OUTPUT_FILES) {
      throw new SubprocessError(`LilyPond produced more than ${MAX_OUTPUT_FILES} artifacts`);
    }
    totalBytes += metadata.size;
    if (metadata.size > MAX_OUTPUT_BYTES || totalBytes > MAX_OUTPUT_BYTES) {
      throw new SubprocessError(`LilyPond output exceeds ${MAX_OUTPUT_BYTES} bytes`);
    }
    files.set(name, await readFile(filePath));
  }
  return files;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp(`^${escaped}$`);
}
