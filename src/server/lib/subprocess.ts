import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, realpathSync, statSync } from "node:fs";
import { lstat, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
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
const TRUSTED_EXECUTABLE_ROOTS = [
  "/bin",
  "/nix/store",
  "/opt/podman",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
] as const;
const HOMEBREW_CELLAR_ROOTS = ["/opt/homebrew/Cellar", "/usr/local/Cellar"] as const;
const SYSTEM_EXECUTABLE_DIRECTORIES = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"] as const;
const FIXED_APPLICATION_EXECUTABLES: Readonly<Record<string, readonly string[]>> = {
  audiveris: ["/Applications/Audiveris.app/Contents/MacOS/Audiveris"],
  mscore: ["/Applications/MuseScore 4.app/Contents/MacOS/mscore"],
  musescore: ["/Applications/MuseScore 4.app/Contents/MacOS/mscore"],
};
const FIXED_HOMEBREW_EXECUTABLES: Readonly<Record<string, readonly string[]>> = {
  gs: ["/opt/homebrew/bin/gs", "/usr/local/bin/gs"],
  lilypond: ["/opt/homebrew/bin/lilypond", "/usr/local/bin/lilypond"],
  node: ["/opt/homebrew/bin/node", "/usr/local/bin/node"],
  podman: ["/opt/homebrew/bin/podman", "/usr/local/bin/podman"],
  python3: ["/opt/homebrew/bin/python3", "/usr/local/bin/python3"],
};
const TRUSTED_RUNTIME_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  lilypond: ["gs"],
};
const trustedHome = userInfo().homedir;
const resolvedExecutables = new Map<string, string>();
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
    assertAuthorityPathRuntime("authority.compiler.external-tool-execution", "production");
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

      const result = await this.spawnAndCapture(config, workingDir, tempDir, startedAt);
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
    isolatedHome: string,
    startedAt: number
  ): Promise<Omit<SubprocessResult, "files" | "durationMs">> {
    const timeout = config.timeout ?? this.defaultTimeout;
    const maxCaptureBytes = config.maxCaptureBytes ?? 4 * 1024 * 1024;
    const maxEmittedBytes = config.maxEmittedBytes ?? 16 * 1024 * 1024;
    const executable = resolveTrustedExecutable(config.command);

    return await new Promise<Omit<SubprocessResult, "files" | "durationMs">>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;
      let emittedBytes = 0;
      let limitExceeded = false;

      const child = spawn(executable, config.args, {
        cwd: workingDir,
        env: minimalSubprocessEnvironment(executable, isolatedHome),
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

      child.stdin.on("error", (error: NodeJS.ErrnoException) => {
        // A child may validly exit without consuming all supplied stdin. The
        // process close event remains authoritative for its exit status; do
        // not let the resulting pipe teardown become an unhandled exception.
        if (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED") return;
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        child.kill("SIGTERM");
        reject(new SubprocessError(`Failed to write stdin for ${config.command}`, error));
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

/**
 * Resolve a configured tool name to one absolute executable under an immutable
 * Nix closure, a root-managed system/application tree, or a fixed Homebrew
 * launcher whose target is in a versioned Cellar. User-controlled PATH entries
 * and relative executables are ignored.
 */
export function resolveTrustedExecutable(command: string): string {
  assertAuthorityPathRuntime("authority.compiler.external-tool-execution", "production");
  const cached = resolvedExecutables.get(command);
  if (cached) return cached;
  const candidates = path.isAbsolute(command)
    ? [command]
    : command.includes(path.sep)
      ? []
      : [
          ...(FIXED_APPLICATION_EXECUTABLES[command] ?? []),
          ...(FIXED_HOMEBREW_EXECUTABLES[command] ?? []),
          ...executableSearchDirectories().map((directory) => path.join(directory, command)),
        ];
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      const resolved = realpathSync(candidate);
      if (!isTrustedExecutableResolution(candidate, resolved)) continue;
      // Nix coreutils is a multi-call binary: the immutable `bin/echo`,
      // `bin/cat`, etc. launchers select behavior through argv[0]. Invoking
      // their shared realpath directly silently changes the command. Preserve
      // launchers that are themselves under a trusted root; fixed Homebrew
      // symlinks remain resolved into their versioned Cellar target so a
      // user-writable launcher cannot be swapped after validation.
      const executable = isTrustedExecutableDirectory(path.dirname(candidate))
        ? candidate
        : resolved;
      resolvedExecutables.set(command, executable);
      return executable;
    } catch {
      // A missing, unreadable, non-executable, or raced candidate is not trusted.
    }
  }
  throw new SubprocessError(
    `Executable ${JSON.stringify(command)} is unavailable in trusted absolute tool locations`
  );
}

function executableSearchDirectories(): string[] {
  const supplied = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  return [
    ...new Set(
      [...supplied, ...SYSTEM_EXECUTABLE_DIRECTORIES].flatMap((directory) => {
        if (!path.isAbsolute(directory)) return [];
        try {
          return [realpathSync(directory)];
        } catch {
          return [];
        }
      })
    ),
  ].filter(isTrustedExecutableDirectory);
}

export function isTrustedExecutableResolution(candidate: string, resolved: string): boolean {
  assertAuthorityPathRuntime("authority.compiler.external-tool-execution", "production");
  const fixedApplication = Object.values(FIXED_APPLICATION_EXECUTABLES)
    .flat()
    .some((fixed) => path.resolve(fixed) === path.resolve(candidate));
  const fixedHomebrew = Object.values(FIXED_HOMEBREW_EXECUTABLES)
    .flat()
    .some((fixed) => {
      try {
        return (
          path.resolve(realpathSync(fixed)) === path.resolve(resolved) &&
          HOMEBREW_CELLAR_ROOTS.some(
            (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
          )
        );
      } catch {
        return false;
      }
    });
  return (
    (fixedApplication && path.resolve(candidate) === path.resolve(resolved)) ||
    fixedHomebrew ||
    (isTrustedExecutableDirectory(path.dirname(path.resolve(candidate))) &&
      TRUSTED_EXECUTABLE_ROOTS.some(
        (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
      ))
  );
}

function isTrustedExecutableDirectory(directory: string): boolean {
  return TRUSTED_EXECUTABLE_ROOTS.some(
    (root) => directory === root || directory.startsWith(`${root}${path.sep}`)
  );
}

function minimalSubprocessEnvironment(executable: string, isolatedHome: string): NodeJS.ProcessEnv {
  const executableDirectory = path.dirname(executable);
  const home = path.basename(executable).startsWith("podman") ? trustedHome : isolatedHome;
  const fontconfigFile =
    path.basename(executable) === "lilypond" && executable.startsWith("/nix/store/")
      ? trustedNixFontconfigFile()
      : undefined;
  const safeNixDirectories = executableSearchDirectories().filter(
    (directory) => directory === "/nix/store" || directory.startsWith("/nix/store/")
  );
  const runtimeDependencyDirectories = trustedRuntimeDependencyDirectories(executable);
  return {
    ...(fontconfigFile ? { FONTCONFIG_FILE: fontconfigFile } : {}),
    HOME: home,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    PATH: [
      ...new Set([
        executableDirectory,
        ...runtimeDependencyDirectories,
        ...safeNixDirectories,
        ...SYSTEM_EXECUTABLE_DIRECTORIES,
      ]),
    ].join(path.delimiter),
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONHASHSEED: "0",
    PYTHONNOUSERSITE: "1",
    QT_QPA_PLATFORM: "offscreen",
    TMPDIR: "/tmp",
    TZ: "UTC",
  };
}

function trustedNixFontconfigFile(): string | undefined {
  const candidate = process.env.FONTCONFIG_FILE;
  if (!candidate || !path.isAbsolute(candidate)) return undefined;
  try {
    const resolved = realpathSync(candidate);
    const segments = path.relative("/nix/store", resolved).split(path.sep);
    if (
      segments.length !== 4 ||
      !/^[a-z0-9]{32}-fontconfig-/.test(segments[0] ?? "") ||
      segments[1] !== "etc" ||
      segments[2] !== "fonts" ||
      segments[3] !== "fonts.conf"
    ) {
      return undefined;
    }
    if (!statSync(resolved).isFile()) return undefined;
    return resolved;
  } catch {
    return undefined;
  }
}

function trustedRuntimeDependencyDirectories(executable: string): string[] {
  const dependencies = TRUSTED_RUNTIME_DEPENDENCIES[path.basename(executable)] ?? [];
  return dependencies.flatMap((dependency) => {
    try {
      return [path.dirname(resolveTrustedExecutable(dependency))];
    } catch {
      // Keep tools that do not exercise the optional dependency usable. A mode
      // that requires it will fail normally and surface the compiler stderr.
      return [];
    }
  });
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
