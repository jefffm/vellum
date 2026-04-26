import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface SubprocessConfig {
  command: string;
  args: string[];
  stdin?: string;
  inputFile?: {
    name: string;
    content: string;
  };
  timeout?: number;
  outputGlobs?: string[];
  cwd?: string;
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

export class SubprocessRunner {
  constructor(private readonly defaultTimeout = 30_000) {}

  async run(config: SubprocessConfig): Promise<SubprocessResult> {
    const startedAt = Date.now();
    const tempDir = await mkdtemp(path.join(tmpdir(), "vellum-subprocess-"));
    const workingDir = config.cwd ?? tempDir;

    try {
      if (config.inputFile) {
        await writeFile(
          path.join(workingDir, config.inputFile.name),
          config.inputFile.content,
          "utf8"
        );
      }

      const result = await this.spawnAndCapture(config, workingDir, startedAt);
      const files = await readOutputFiles(workingDir, config.outputGlobs ?? []);

      return {
        ...result,
        files,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async spawnAndCapture(
    config: SubprocessConfig,
    workingDir: string,
    startedAt: number
  ): Promise<Omit<SubprocessResult, "files" | "durationMs">> {
    const timeout = config.timeout ?? this.defaultTimeout;

    return await new Promise<Omit<SubprocessResult, "files" | "durationMs">>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;

      const child = spawn(config.command, config.args, {
        cwd: workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        stderr += `Timed out after ${timeout}ms`;
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
        stdout += chunk;
      });

      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

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
      if (error instanceof SubprocessError) {
        throw error;
      }
      throw new SubprocessError(
        `Subprocess ${config.command} failed after ${Date.now() - startedAt}ms`,
        error
      );
    });
  }
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

async function readOutputFiles(directory: string, globs: string[]): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();

  if (globs.length === 0) {
    return files;
  }

  const matchers = globs.map(globToRegExp);
  const paths = await walkFiles(directory);

  for (const filePath of paths) {
    const relativePath = path.relative(directory, filePath).replaceAll(path.sep, "/");

    if (matchers.some((matcher) => matcher.test(relativePath))) {
      files.set(relativePath, await readFile(filePath));
    }
  }

  return files;
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
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
