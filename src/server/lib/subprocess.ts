import { spawn } from "node:child_process";
import { lstat, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ApiRouteError } from "./create-route.js";

export interface SubprocessConfig {
  command: string;
  args: string[];
  stdin?: string;
  inputFile?: {
    name: string;
    content: string | Buffer;
  };
  inputFiles?: Array<{
    name: string;
    content: string | Buffer;
  }>;
  timeout?: number;
  outputGlobs?: string[];
  cwd?: string;
  /** Maximum retained bytes per stdout/stderr stream. The newest output is retained. */
  maxCaptureBytes?: number;
  /** Maximum bytes a child may emit across stdout and stderr before termination. */
  maxEmittedBytes?: number;
  maxOutputFiles?: number;
  maxOutputFileBytes?: number;
  maxOutputTotalBytes?: number;
  maxScannedEntries?: number;
  maxInputBytes?: number;
}

export interface SubprocessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  files: Map<string, Buffer>;
  durationMs: number;
}

export class SubprocessError extends Error {
  constructor(
    message: string,
    public readonly causeError?: unknown
  ) {
    super(message);
    this.name = "SubprocessError";
  }
}

export class SubprocessLimitError extends ApiRouteError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 413, "request_too_large", { resource: "subprocess", ...details });
    this.name = "SubprocessLimitError";
  }
}

const MAX_CONCURRENT_SUBPROCESSES = 4;
let activeSubprocesses = 0;
const subprocessWaiters: Array<() => void> = [];

async function acquireSubprocessPermit(): Promise<() => void> {
  if (activeSubprocesses >= MAX_CONCURRENT_SUBPROCESSES) {
    await new Promise<void>((resolve) => subprocessWaiters.push(resolve));
  }
  activeSubprocesses += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeSubprocesses -= 1;
    subprocessWaiters.shift()?.();
  };
}

export class SubprocessRunner {
  constructor(private readonly defaultTimeout = 30_000) {}

  async run(config: SubprocessConfig): Promise<SubprocessResult> {
    const releasePermit = await acquireSubprocessPermit();
    const startedAt = Date.now();
    let tempDir: string | undefined;

    try {
      tempDir = await mkdtemp(path.join(tmpdir(), "vellum-subprocess-"));
      const workingDir = config.cwd ?? tempDir;
      let inputBytes = 0;
      if (config.inputFile) {
        assertSafeInputFile(config.inputFile.name);
        inputBytes += Buffer.byteLength(config.inputFile.content);
        await writeFile(path.join(workingDir, config.inputFile.name), config.inputFile.content);
      }
      for (const inputFile of config.inputFiles ?? []) {
        assertSafeInputFile(inputFile.name);
        inputBytes += Buffer.byteLength(inputFile.content);
        if (inputBytes > (config.maxInputBytes ?? 64 * 1024 * 1024)) {
          throw new SubprocessLimitError("Subprocess input exceeds byte limit");
        }
        await writeFile(path.join(workingDir, inputFile.name), inputFile.content);
      }
      if (inputBytes > (config.maxInputBytes ?? 64 * 1024 * 1024)) {
        throw new SubprocessLimitError("Subprocess input exceeds byte limit");
      }

      const result = await this.spawnAndCapture(config, workingDir, startedAt);
      const files = await readOutputFiles(workingDir, config.outputGlobs ?? [], config);

      return {
        ...result,
        files,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
      releasePermit();
    }
  }

  private async spawnAndCapture(
    config: SubprocessConfig,
    workingDir: string,
    startedAt: number
  ): Promise<Omit<SubprocessResult, "files" | "durationMs">> {
    const timeout = config.timeout ?? this.defaultTimeout;
    const maxCaptureBytes = config.maxCaptureBytes ?? 4 * 1024 * 1024;
    const maxEmittedBytes = config.maxEmittedBytes ?? 16 * 1024 * 1024;

    return await new Promise<Omit<SubprocessResult, "files" | "durationMs">>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;
      let emittedBytes = 0;
      let limitExceeded = false;

      const child = spawn(config.command, config.args, {
        cwd: workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        stderr = appendBounded(stderr, `Timed out after ${timeout}ms`, maxCaptureBytes, "stderr");
        child.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        }, 2_000);
      }, timeout);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        emittedBytes += Buffer.byteLength(chunk);
        stdout = appendBounded(stdout, chunk, maxCaptureBytes, "stdout");
        enforceEmissionLimit();
      });

      child.stderr.on("data", (chunk: string) => {
        emittedBytes += Buffer.byteLength(chunk);
        stderr = appendBounded(stderr, chunk, maxCaptureBytes, "stderr");
        enforceEmissionLimit();
      });

      const enforceEmissionLimit = () => {
        if (limitExceeded || emittedBytes <= maxEmittedBytes) return;
        limitExceeded = true;
        stderr = appendBounded(
          stderr,
          `\n[vellum: subprocess_resource_limit emitted_bytes=${emittedBytes} limit=${maxEmittedBytes}]`,
          maxCaptureBytes,
          "stderr"
        );
        child.kill("SIGTERM");
      };

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        reject(new SubprocessError(`Failed to spawn ${config.command}: ${error.message}`, error));
      });

      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);

        const timeoutStderr = timedOut
          ? `${stderr}${stderr.endsWith("\n") ? "" : "\n"}Process killed with ${signal ?? "timeout"}`
          : stderr;

        if (limitExceeded) {
          reject(
            new SubprocessLimitError("Subprocess emitted-output budget exceeded", {
              emittedBytes,
              limitBytes: maxEmittedBytes,
              stdoutTail: stdout,
              stderrTail: timeoutStderr,
            })
          );
          return;
        }

        resolve({
          stdout,
          stderr: timeoutStderr,
          exitCode: timedOut ? 124 : (code ?? signalToExitCode(signal)),
        });
      });

      if (config.stdin !== undefined) {
        child.stdin.end(config.stdin);
      } else {
        child.stdin.end();
      }
    }).catch((error: unknown) => {
      if (error instanceof SubprocessError || error instanceof SubprocessLimitError) {
        throw error;
      }
      throw new SubprocessError(
        `Subprocess ${config.command} failed after ${Date.now() - startedAt}ms`,
        error
      );
    });
  }
}

function assertSafeInputFile(name: string): void {
  if (path.basename(name) !== name || name === "." || name === "..") {
    throw new SubprocessLimitError(`Unsafe subprocess input filename: ${name}`);
  }
}

function appendBounded(current: string, chunk: string, limit: number, stream: string): string {
  const combined = current + chunk;
  if (Buffer.byteLength(combined) <= limit) return combined;
  const marker = `[vellum: ${stream} truncated; retaining tail]\n`;
  const tailBudget = Math.max(0, limit - Buffer.byteLength(marker));
  return marker + Buffer.from(combined).subarray(-tailBudget).toString("utf8");
}

export async function runSubprocess(config: SubprocessConfig): Promise<SubprocessResult> {
  return await new SubprocessRunner().run(config);
}

function signalToExitCode(signal: NodeJS.Signals | null): number {
  if (!signal) return 1;
  return 128 + signalNumber(signal);
}

function signalNumber(signal: NodeJS.Signals): number {
  switch (signal) {
    case "SIGTERM":
      return 15;
    case "SIGKILL":
      return 9;
    case "SIGINT":
      return 2;
    default:
      return 1;
  }
}

async function readOutputFiles(
  directory: string,
  globs: string[],
  config: SubprocessConfig
): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();

  if (globs.length === 0) {
    return files;
  }

  const matchers = globs.map(globToRegExp);
  const paths = await walkFiles(directory, config.maxScannedEntries ?? 2_048);
  const maxFiles = config.maxOutputFiles ?? 64;
  const maxFileBytes = config.maxOutputFileBytes ?? 32 * 1024 * 1024;
  const maxTotalBytes = config.maxOutputTotalBytes ?? 64 * 1024 * 1024;
  let totalBytes = 0;

  for (const filePath of paths) {
    const relativePath = path.relative(directory, filePath).replaceAll(path.sep, "/");

    if (matchers.some((matcher) => matcher.test(relativePath))) {
      if (files.size >= maxFiles) {
        throw new SubprocessLimitError(`Generated file count exceeds limit ${maxFiles}`);
      }
      const metadata = await lstat(filePath);
      if (!metadata.isFile() || metadata.isSymbolicLink()) continue;
      if (metadata.size > maxFileBytes) {
        throw new SubprocessLimitError(
          `Generated file ${relativePath} exceeds byte limit ${maxFileBytes}`
        );
      }
      totalBytes += metadata.size;
      if (totalBytes > maxTotalBytes) {
        throw new SubprocessLimitError(`Generated files exceed total byte limit ${maxTotalBytes}`);
      }
      files.set(relativePath, await readFile(filePath));
    }
  }

  return files;
}

async function walkFiles(directory: string, maxEntries: number): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (files.length + entries.length > maxEntries) {
      throw new SubprocessLimitError(`Generated entry count exceeds scan limit ${maxEntries}`);
    }
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkFiles(entryPath, maxEntries - files.length);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function globToRegExp(glob: string): RegExp {
  let pattern = "^";

  for (const char of glob) {
    if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += escapeRegExp(char);
    }
  }

  pattern += "$";
  return new RegExp(pattern);
}

function escapeRegExp(char: string): string {
  return /[\\^$+?.()|{}[\]]/.test(char) ? `\\${char}` : char;
}
