import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  openSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { lstat, mkdtemp, opendir, readFile, rm, writeFile } from "node:fs/promises";
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
  /**
   * Maximum process-group memory. Linux enforces address space with rlimit;
   * macOS uses a fail-closed aggregate resident-set watchdog because RLIMIT_AS
   * cannot be lowered reliably on current Apple Silicon releases.
   */
  maxAddressSpaceBytes?: number;
  /** Maximum CPU seconds inherited by the tool and all of its descendants. */
  maxCpuSeconds?: number;
  /** Maximum number of simultaneously open file descriptors. */
  maxOpenFiles?: number;
  /** OS-enforced maximum size of any file created or extended by the child. */
  maxFileWriteBytes?: number;
  /**
   * Fail closed unless the child can be placed in an OS network namespace or
   * an equivalent platform sandbox. This is intentionally opt-in so existing
   * compiler/provider subprocesses do not silently change behavior.
   */
  networkAccess?: "inherit" | "deny";
  /**
   * Restrict reads to the disposable working tree plus the executable's
   * immutable runtime closure. Writes are limited to `writableOutputFiles`.
   */
  filesystemAccess?: "inherit" | "workdir-only";
  /** Exact, traversal-free output filenames the restricted child may write. */
  writableOutputFiles?: string[];
}

export interface SubprocessRunOptions {
  signal?: AbortSignal;
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

export class SubprocessAbortedError extends Error {
  constructor() {
    super("Subprocess execution was cancelled");
    this.name = "SubprocessAbortedError";
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
  pdfinfo: ["/opt/homebrew/bin/pdfinfo", "/usr/local/bin/pdfinfo"],
  pdftoppm: ["/opt/homebrew/bin/pdftoppm", "/usr/local/bin/pdftoppm"],
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

async function acquireSubprocessPermit(signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) throw new SubprocessAbortedError();
  if (activeSubprocesses >= MAX_CONCURRENT_SUBPROCESSES) {
    await new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        const index = subprocessWaiters.indexOf(grant);
        if (index >= 0) subprocessWaiters.splice(index, 1);
        reject(new SubprocessAbortedError());
      };
      subprocessWaiters.push(grant);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  if (signal?.aborted) throw new SubprocessAbortedError();
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

  async run(
    config: SubprocessConfig,
    options: SubprocessRunOptions = {}
  ): Promise<SubprocessResult> {
    assertAuthorityPathRuntime("authority.compiler.external-tool-execution", "production");
    const releasePermit = await acquireSubprocessPermit(options.signal);
    const startedAt = Date.now();
    let tempDir: string | undefined;

    try {
      tempDir = await mkdtemp(path.join(tmpdir(), "vellum-subprocess-"));
      if (config.filesystemAccess === "workdir-only" && config.cwd !== undefined) {
        throw new SubprocessError(
          "A restricted subprocess cannot use a caller-selected working directory"
        );
      }
      const workingDir = config.cwd ?? realpathSync(tempDir);
      if (options.signal?.aborted) throw new SubprocessAbortedError();
      await prepareWorkingFiles(workingDir, config);
      if (options.signal?.aborted) throw new SubprocessAbortedError();

      const result = await this.spawnAndCapture(
        config,
        workingDir,
        tempDir,
        startedAt,
        options.signal
      );
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
    startedAt: number,
    signal?: AbortSignal
  ): Promise<Omit<SubprocessResult, "files" | "durationMs">> {
    const timeout = config.timeout ?? this.defaultTimeout;
    const maxCaptureBytes = config.maxCaptureBytes ?? 4 * 1024 * 1024;
    const maxEmittedBytes = config.maxEmittedBytes ?? 16 * 1024 * 1024;
    const executable = resolveTrustedExecutable(config.command);

    return await new Promise<Omit<SubprocessResult, "files" | "durationMs">>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let aborted = false;
      let settled = false;
      let terminationStarted = false;
      let killTimer: NodeJS.Timeout | undefined;
      let emittedBytes = 0;
      let limitExceeded = false;
      let memoryLimitExceeded = false;
      let memoryProbeFailed = false;
      let memoryProbeInFlight = false;
      let memoryTimer: NodeJS.Timeout | undefined;

      const writableOutputPaths = (config.writableOutputFiles ?? []).map((name) =>
        path.join(workingDir, name)
      );
      const sandboxed = sandboxedLaunch(
        executable,
        config.args,
        config.networkAccess ?? "inherit",
        config.filesystemAccess ?? "inherit",
        workingDir,
        writableOutputPaths
      );
      const detached = process.platform !== "win32";
      const memoryProbeExecutable =
        config.maxAddressSpaceBytes !== undefined && process.platform === "darwin"
          ? resolveTrustedExecutable("ps")
          : undefined;
      const child = (() => {
        try {
          const launch = resourceLimitedLaunch(sandboxed, config);
          return spawn(launch.executable, [...launch.args], {
            cwd: workingDir,
            env: minimalSubprocessEnvironment(executable, isolatedHome),
            stdio: ["pipe", "pipe", "pipe", ...(launch.inheritedFileDescriptors ?? [])],
            shell: false,
            detached,
          });
        } finally {
          closeInheritedFileDescriptors(sandboxed);
        }
      })();
      const childStdin = child.stdin;
      const childStdout = child.stdout;
      const childStderr = child.stderr;
      if (!childStdin || !childStdout || !childStderr) {
        child.kill("SIGKILL");
        throw new SubprocessError("Subprocess stdio pipes were not created");
      }

      const terminate = (signalName: NodeJS.Signals) => {
        if (child.pid !== undefined && detached) {
          try {
            process.kill(-child.pid, signalName);
            return;
          } catch {
            // The process group may already have exited; fall back to the child.
          }
        }
        try {
          child.kill(signalName);
        } catch {
          // Close/error remains authoritative if the child already disappeared.
        }
      };

      const terminateWithEscalation = () => {
        terminationStarted = true;
        terminate("SIGTERM");
        if (killTimer) return;
        killTimer = setTimeout(() => {
          killTimer = undefined;
          terminate("SIGKILL");
        }, 2_000);
      };

      const forceTerminateGroup = () => {
        if (killTimer) clearTimeout(killTimer);
        killTimer = undefined;
        terminate("SIGKILL");
      };

      const clearMemoryTimer = () => {
        if (memoryTimer) clearInterval(memoryTimer);
        memoryTimer = undefined;
      };
      const probeMemory = () => {
        if (
          !memoryProbeExecutable ||
          child.pid === undefined ||
          settled ||
          memoryProbeInFlight ||
          memoryLimitExceeded ||
          memoryProbeFailed
        ) {
          return;
        }
        memoryProbeInFlight = true;
        void processGroupResidentBytes(memoryProbeExecutable, child.pid)
          .then((residentBytes) => {
            if (settled) return;
            if (residentBytes > config.maxAddressSpaceBytes!) {
              memoryLimitExceeded = true;
              clearMemoryTimer();
              terminateWithEscalation();
            }
          })
          .catch(() => {
            if (settled) return;
            memoryProbeFailed = true;
            clearMemoryTimer();
            terminateWithEscalation();
          })
          .finally(() => {
            memoryProbeInFlight = false;
          });
      };
      if (memoryProbeExecutable) {
        memoryTimer = setInterval(probeMemory, 100);
        probeMemory();
      }

      const timeoutTimer = setTimeout(() => {
        if (aborted || limitExceeded || memoryLimitExceeded || memoryProbeFailed) return;
        timedOut = true;
        stderr = appendBounded(stderr, `Timed out after ${timeout}ms`, maxCaptureBytes, "stderr");
        terminateWithEscalation();
      }, timeout);

      const abort = () => {
        if (timedOut || limitExceeded || memoryLimitExceeded || memoryProbeFailed || settled)
          return;
        aborted = true;
        terminateWithEscalation();
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();

      childStdout.setEncoding("utf8");
      childStderr.setEncoding("utf8");

      childStdout.on("data", (chunk: string) => {
        emittedBytes += Buffer.byteLength(chunk);
        stdout = appendBounded(stdout, chunk, maxCaptureBytes, "stdout");
        enforceEmissionLimit();
      });

      childStderr.on("data", (chunk: string) => {
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
        terminateWithEscalation();
      };

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        clearMemoryTimer();
        signal?.removeEventListener("abort", abort);
        if (aborted) {
          reject(new SubprocessAbortedError());
          return;
        }
        reject(new SubprocessError(`Failed to spawn ${config.command}: ${error.message}`, error));
      });

      child.on("exit", () => {
        // `close` waits for inherited stdio. A leader that exits cleanly after
        // SIGTERM can therefore leave a TERM-ignoring descendant alive while
        // keeping the promise open forever. Once the leader has exited there
        // is no cleanup grace left to preserve, so synchronously force-kill
        // the original process group before waiting for its pipes to close.
        if (terminationStarted) forceTerminateGroup();
      });

      childStdin.on("error", (error: NodeJS.ErrnoException) => {
        // A child may validly exit without consuming all supplied stdin. The
        // process close event remains authoritative for its exit status; do
        // not let the resulting pipe teardown become an unhandled exception.
        if (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED") return;
        if (aborted || limitExceeded || memoryLimitExceeded || memoryProbeFailed || timedOut)
          return;
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        clearMemoryTimer();
        signal?.removeEventListener("abort", abort);
        terminateWithEscalation();
        reject(new SubprocessError(`Failed to write stdin for ${config.command}`, error));
      });

      child.on("close", (code, terminationSignal) => {
        if (settled) return;
        if (terminationStarted) forceTerminateGroup();
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        clearMemoryTimer();
        signal?.removeEventListener("abort", abort);

        if (aborted) {
          reject(new SubprocessAbortedError());
          return;
        }

        if (memoryProbeFailed) {
          reject(new SubprocessError("Subprocess memory enforcement became unavailable"));
          return;
        }

        if (memoryLimitExceeded) {
          reject(
            new SubprocessLimitError("Subprocess memory budget exceeded", {
              limitBytes: config.maxAddressSpaceBytes,
              resourceLimit: "process_group_memory",
            })
          );
          return;
        }

        const timeoutStderr = timedOut
          ? `${stderr}${stderr.endsWith("\n") ? "" : "\n"}Process killed with ${terminationSignal ?? "timeout"}`
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
          exitCode: timedOut ? 124 : (code ?? signalToExitCode(terminationSignal)),
        });
      });

      if (config.stdin !== undefined) {
        childStdin.end(config.stdin);
      } else {
        childStdin.end();
      }
    }).catch((error: unknown) => {
      if (
        error instanceof SubprocessError ||
        error instanceof SubprocessLimitError ||
        error instanceof SubprocessAbortedError
      ) {
        throw error;
      }
      throw new SubprocessError(
        `Subprocess ${config.command} failed after ${Date.now() - startedAt}ms`,
        error
      );
    });
  }
}

export type SandboxedLaunch = Readonly<{
  executable: string;
  args: readonly string[];
  /** Parent descriptors copied to child descriptors 3..n for sandbox setup. */
  inheritedFileDescriptors?: readonly number[];
}>;

/**
 * Build a fail-closed, no-network launch without a shell. On macOS Seatbelt
 * denies every socket operation. Linux uses Bubblewrap's isolated network
 * namespace; an installation without the platform sandbox is rejected rather
 * than quietly running a supposedly local-only parser with ambient egress.
 */
function sandboxedLaunch(
  executable: string,
  args: readonly string[],
  networkAccess: "inherit" | "deny",
  filesystemAccess: "inherit" | "workdir-only",
  workingDir: string,
  writableOutputPaths: readonly string[]
): SandboxedLaunch {
  if (filesystemAccess === "workdir-only") {
    if (networkAccess !== "deny") {
      throw new SubprocessError(
        "A restricted filesystem sandbox must also deny ambient network access"
      );
    }
    const sandboxExecutable =
      process.platform === "darwin"
        ? resolveTrustedExecutable("sandbox-exec")
        : process.platform === "linux"
          ? resolveTrustedExecutable("bwrap")
          : undefined;
    if (!sandboxExecutable) {
      throw new SubprocessError("A trusted untrusted-document sandbox is unavailable");
    }
    const linuxSeccompFileDescriptor =
      process.platform === "linux" ? openLinuxNoForkSeccompFilter(workingDir) : undefined;
    try {
      return buildRestrictedSandboxLaunch({
        platform: process.platform,
        sandboxExecutable,
        executable,
        args,
        workingDir,
        writableOutputPaths,
        linuxSeccompFileDescriptor,
      });
    } catch (error) {
      if (linuxSeccompFileDescriptor !== undefined) {
        try {
          closeSync(linuxSeccompFileDescriptor);
        } catch {
          // The original fail-closed sandbox error remains authoritative.
        }
      }
      throw error;
    }
  }
  if (networkAccess === "inherit") return { executable, args };
  if (process.platform === "darwin") {
    return {
      executable: resolveTrustedExecutable("sandbox-exec"),
      args: ["-p", "(version 1)(allow default)(deny network*)", executable, ...args],
    };
  }
  if (process.platform === "linux") {
    return {
      executable: resolveTrustedExecutable("bwrap"),
      args: [
        "--die-with-parent",
        "--new-session",
        "--unshare-net",
        "--ro-bind",
        "/",
        "/",
        executable,
        ...args,
      ],
    };
  }
  throw new SubprocessError("A trusted no-network subprocess sandbox is unavailable");
}

export function buildRestrictedSandboxLaunch(
  input: Readonly<{
    platform: NodeJS.Platform;
    sandboxExecutable: string;
    executable: string;
    args: readonly string[];
    workingDir: string;
    writableOutputPaths: readonly string[];
    /** Linux-only source descriptor copied to child descriptor 3. */
    linuxSeccompFileDescriptor?: number;
  }>
): SandboxedLaunch {
  const workingDir = realpathSync(input.workingDir);
  const writableOutputPaths = input.writableOutputPaths.map((candidate) => {
    const resolved = realpathSync(candidate);
    if (path.dirname(resolved) !== workingDir) {
      throw new SubprocessError("A restricted subprocess output escaped its working directory");
    }
    return resolved;
  });

  if (input.platform === "darwin") {
    const runtimeRoots = [
      "/nix/store",
      "/opt/homebrew/Cellar",
      "/opt/homebrew/etc/openssl@3",
      "/opt/homebrew/opt",
      "/usr/local/Cellar",
      "/usr/local/etc/openssl@3",
      "/usr/local/opt",
    ].filter(existsSync);
    const runtimeFilters = [
      `(literal ${seatbeltString(input.executable)})`,
      ...runtimeRoots.map((root) => `(subpath ${seatbeltString(root)})`),
    ].join(" ");
    const writeRule =
      writableOutputPaths.length === 0
        ? ""
        : `(allow file-write* ${writableOutputPaths
            .map((candidate) => `(literal ${seatbeltString(candidate)})`)
            .join(" ")})`;
    const profile = [
      "(version 1)",
      "(deny default)",
      '(import "system.sb")',
      "(deny network*)",
      "(deny mach-lookup)",
      "(deny process-fork)",
      `(allow process-exec (literal ${seatbeltString(input.executable)}))`,
      `(allow file-read* file-test-existence file-map-executable ${runtimeFilters})`,
      '(allow file-read* file-test-existence (subpath (param "WORKDIR")))',
      writeRule,
    ].join("");
    return {
      executable: input.sandboxExecutable,
      args: ["-D", `WORKDIR=${workingDir}`, "-p", profile, input.executable, ...input.args],
    };
  }

  if (input.platform === "linux") {
    if (
      input.linuxSeccompFileDescriptor === undefined ||
      !Number.isSafeInteger(input.linuxSeccompFileDescriptor) ||
      input.linuxSeccompFileDescriptor < 0
    ) {
      throw new SubprocessError("The Linux sandbox requires a no-fork seccomp filter");
    }
    const runtimeRoots = [
      "/usr",
      "/bin",
      "/sbin",
      "/lib",
      "/lib64",
      "/nix/store",
      "/opt/podman",
    ].filter(existsSync);
    const args: string[] = [
      "--die-with-parent",
      "--new-session",
      "--unshare-net",
      "--unshare-pid",
      "--unshare-ipc",
      "--unshare-uts",
      "--seccomp",
      "3",
      "--cap-drop",
      "ALL",
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      "--dir",
      "/etc",
      "--tmpfs",
      "/tmp",
    ];
    for (const root of runtimeRoots) args.push("--ro-bind", root, root);
    for (const systemPath of ["/etc/fonts", "/etc/ld.so.cache", "/etc/localtime"]) {
      if (existsSync(systemPath)) args.push("--ro-bind", systemPath, systemPath);
    }
    args.push("--ro-bind", workingDir, "/work");
    for (const candidate of writableOutputPaths) {
      args.push("--bind", candidate, `/work/${path.basename(candidate)}`);
    }
    args.push(
      "--setenv",
      "HOME",
      "/work",
      "--setenv",
      "TMPDIR",
      "/tmp",
      "--chdir",
      "/work",
      input.executable,
      ...input.args
    );
    return {
      executable: input.sandboxExecutable,
      args,
      inheritedFileDescriptors: [input.linuxSeccompFileDescriptor],
    };
  }

  throw new SubprocessError("A trusted untrusted-document sandbox is unavailable");
}

type ClassicBpfInstruction = readonly [
  code: number,
  jumpTrue: number,
  jumpFalse: number,
  k: number,
];

/**
 * Build a classic-BPF seccomp program that denies every process-creation
 * syscall available to the supported 64-bit Linux ABIs. The restricted tools
 * are single-process document parsers, matching macOS Seatbelt's
 * `deny process-fork` contract. With fan-out impossible, the inherited address
 * space, CPU, descriptor, and file limits bound the complete sandbox workload.
 */
function linuxNoForkSeccompFilter(architecture: NodeJS.Architecture): Buffer {
  const BPF_LOAD_WORD_ABSOLUTE = 0x20;
  const BPF_JUMP_EQUAL = 0x15;
  const BPF_JUMP_BITS_SET = 0x45;
  const BPF_RETURN = 0x06;
  const SECCOMP_RETURN_KILL_PROCESS = 0x80000000;
  const SECCOMP_RETURN_ERRNO_EPERM = 0x00050001;
  const SECCOMP_RETURN_ALLOW = 0x7fff0000;
  const X32_SYSCALL_BIT = 0x40000000;

  const profile =
    architecture === "x64"
      ? {
          auditArchitecture: 0xc000003e,
          processCreationSyscalls: [56, 57, 58, 435] as const,
          rejectX32: true,
        }
      : architecture === "arm64"
        ? {
            auditArchitecture: 0xc00000b7,
            processCreationSyscalls: [220, 435] as const,
            rejectX32: false,
          }
        : undefined;
  if (!profile) {
    throw new SubprocessError(
      `No no-fork seccomp profile exists for Linux architecture ${architecture}`
    );
  }

  const instructions: ClassicBpfInstruction[] = [
    // seccomp_data.arch is the 32-bit word at byte offset 4. Kill rather than
    // evaluate syscall numbers under an ABI we did not compile this filter for.
    [BPF_LOAD_WORD_ABSOLUTE, 0, 0, 4],
    [BPF_JUMP_EQUAL, 1, 0, profile.auditArchitecture],
    [BPF_RETURN, 0, 0, SECCOMP_RETURN_KILL_PROCESS],
    // seccomp_data.nr is the 32-bit word at byte offset 0.
    [BPF_LOAD_WORD_ABSOLUTE, 0, 0, 0],
  ];
  if (profile.rejectX32) {
    // x32 shares AUDIT_ARCH_X86_64 but has a distinct syscall-number space.
    // Reject it wholesale so it cannot bypass the x86_64 deny list.
    instructions.push(
      [BPF_JUMP_BITS_SET, 0, 1, X32_SYSCALL_BIT],
      [BPF_RETURN, 0, 0, SECCOMP_RETURN_ERRNO_EPERM]
    );
  }
  for (const syscall of profile.processCreationSyscalls) {
    instructions.push(
      [BPF_JUMP_EQUAL, 0, 1, syscall],
      [BPF_RETURN, 0, 0, SECCOMP_RETURN_ERRNO_EPERM]
    );
  }
  instructions.push([BPF_RETURN, 0, 0, SECCOMP_RETURN_ALLOW]);

  const encoded = Buffer.alloc(instructions.length * 8);
  instructions.forEach(([code, jumpTrue, jumpFalse, k], index) => {
    const offset = index * 8;
    encoded.writeUInt16LE(code, offset);
    encoded.writeUInt8(jumpTrue, offset + 2);
    encoded.writeUInt8(jumpFalse, offset + 3);
    encoded.writeUInt32LE(k >>> 0, offset + 4);
  });
  return encoded;
}

function openLinuxNoForkSeccompFilter(workingDir: string): number {
  const filterPath = path.join(workingDir, `.vellum-no-fork-${randomUUID()}.bpf`);
  try {
    writeFileSync(filterPath, linuxNoForkSeccompFilter(process.arch), {
      flag: "wx",
      mode: 0o600,
    });
    return openSync(filterPath, constants.O_RDONLY);
  } catch (error) {
    throw new SubprocessError("Unable to prepare the Linux no-fork seccomp filter", error);
  } finally {
    try {
      unlinkSync(filterPath);
    } catch {
      // The descriptor remains valid after unlink; absence after a failed
      // create is equally safe and the original result stays authoritative.
    }
  }
}

function closeInheritedFileDescriptors(launch: SandboxedLaunch): void {
  for (const descriptor of launch.inheritedFileDescriptors ?? []) {
    try {
      closeSync(descriptor);
    } catch {
      // The spawned child owns its duplicate. Closing an already-closed parent
      // descriptor must not replace the subprocess result.
    }
  }
}

function resourceLimitedLaunch(launch: SandboxedLaunch, config: SubprocessConfig): SandboxedLaunch {
  const limits: Array<readonly [string, number]> = [];
  if (config.maxAddressSpaceBytes !== undefined) {
    assertFiniteLimit("maxAddressSpaceBytes", config.maxAddressSpaceBytes, 1);
    if (process.platform === "linux") {
      limits.push(["v", Math.ceil(config.maxAddressSpaceBytes / 1_024)]);
    } else if (process.platform !== "darwin") {
      throw new SubprocessError("Subprocess memory enforcement is unavailable on this platform");
    }
  }
  if (config.maxCpuSeconds !== undefined) {
    assertFiniteLimit("maxCpuSeconds", config.maxCpuSeconds, 1);
    limits.push(["t", config.maxCpuSeconds]);
  }
  if (config.maxOpenFiles !== undefined) {
    assertFiniteLimit("maxOpenFiles", config.maxOpenFiles, 3);
    limits.push(["n", config.maxOpenFiles]);
  }
  if (config.maxFileWriteBytes !== undefined) {
    assertFiniteLimit("maxFileWriteBytes", config.maxFileWriteBytes, 0);
    limits.push([
      "f",
      config.maxFileWriteBytes === 0 ? 0 : Math.ceil(config.maxFileWriteBytes / 512),
    ]);
  }
  if (limits.length === 0) return launch;

  const script = [
    "set -eu",
    "ulimit -c 0",
    ...limits.map(([flag], index) => `ulimit -${flag} \"$${index + 1}\"`),
    `shift ${limits.length}`,
    'exec "$@"',
  ].join("\n");
  return {
    executable: resolveTrustedExecutable("sh"),
    args: [
      "-c",
      script,
      "vellum-resource-limits",
      ...limits.map(([, value]) => String(value)),
      launch.executable,
      ...launch.args,
    ],
    inheritedFileDescriptors: launch.inheritedFileDescriptors,
  };
}

function assertFiniteLimit(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new SubprocessLimitError(`Invalid subprocess ${name}`);
  }
}

function seatbeltString(value: string): string {
  return JSON.stringify(value);
}

function processGroupResidentBytes(psExecutable: string, processGroupId: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = spawn(psExecutable, ["-o", "rss=", "-g", String(processGroupId)], {
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let overflow = false;
    const timer = setTimeout(() => {
      probe.kill("SIGKILL");
      reject(new Error("Process memory probe timed out"));
    }, 1_000);
    probe.stdout.setEncoding("utf8");
    probe.stderr.setEncoding("utf8");
    probe.stdout.on("data", (chunk: string) => {
      if (Buffer.byteLength(stdout) + Buffer.byteLength(chunk) > 64 * 1_024) {
        overflow = true;
        probe.kill("SIGKILL");
        return;
      }
      stdout += chunk;
    });
    probe.stderr.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) + Buffer.byteLength(chunk) <= 4_096) stderr += chunk;
    });
    probe.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    probe.once("close", (code) => {
      clearTimeout(timer);
      if (overflow || (code !== 0 && stderr.trim().length > 0)) {
        reject(new Error("Process memory probe failed"));
        return;
      }
      let totalKilobytes = 0;
      for (const line of stdout.split(/\r?\n/u)) {
        if (line.trim().length === 0) continue;
        if (!/^\s*[0-9]+\s*$/u.test(line)) {
          reject(new Error("Process memory probe returned invalid output"));
          return;
        }
        totalKilobytes += Number(line.trim());
        if (!Number.isSafeInteger(totalKilobytes)) {
          reject(new Error("Process memory probe overflowed"));
          return;
        }
      }
      resolve(totalKilobytes * 1_024);
    });
  });
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
  const podman = path.basename(executable).startsWith("podman");
  const home = podman ? trustedHome : isolatedHome;
  const containerHost =
    podman &&
    process.env.CONTAINER_HOST === "unix:///run/podman/podman.sock" &&
    existsSync("/run/podman/podman.sock")
      ? process.env.CONTAINER_HOST
      : undefined;
  const fontconfigFile =
    path.basename(executable) === "lilypond" && executable.startsWith("/nix/store/")
      ? trustedNixFontconfigFile()
      : undefined;
  const safeNixDirectories = executableSearchDirectories().filter(
    (directory) => directory === "/nix/store" || directory.startsWith("/nix/store/")
  );
  const runtimeDependencyDirectories = trustedRuntimeDependencyDirectories(executable);
  return {
    ...(containerHost ? { CONTAINER_HOST: containerHost } : {}),
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

async function prepareWorkingFiles(directory: string, config: SubprocessConfig): Promise<void> {
  const inputs = [...(config.inputFile ? [config.inputFile] : []), ...(config.inputFiles ?? [])];
  const inputNames = new Set<string>();
  let inputBytes = 0;
  for (const input of inputs) {
    assertSafeInputFile(input.name);
    if (inputNames.has(input.name)) {
      throw new SubprocessLimitError(`Duplicate subprocess input filename: ${input.name}`);
    }
    inputNames.add(input.name);
    inputBytes += Buffer.byteLength(input.content);
  }
  if (inputBytes > (config.maxInputBytes ?? 64 * 1024 * 1024)) {
    throw new SubprocessLimitError("Subprocess input exceeds byte limit");
  }

  const writableNames = config.writableOutputFiles ?? [];
  const uniqueWritableNames = new Set<string>();
  for (const name of writableNames) {
    assertSafeInputFile(name);
    if (inputNames.has(name) || uniqueWritableNames.has(name)) {
      throw new SubprocessLimitError(`Conflicting subprocess output filename: ${name}`);
    }
    if (!(config.outputGlobs ?? []).some((glob) => globToRegExp(glob).test(name))) {
      throw new SubprocessLimitError(`Writable subprocess output is not captured: ${name}`);
    }
    uniqueWritableNames.add(name);
  }
  if (writableNames.length > (config.maxOutputFiles ?? 64)) {
    throw new SubprocessLimitError("Writable subprocess output count exceeds file limit");
  }
  if (config.filesystemAccess === "workdir-only" && config.outputGlobs?.length) {
    if (writableNames.length === 0) {
      throw new SubprocessLimitError(
        "A restricted subprocess with captured output requires exact writable filenames"
      );
    }
  }

  for (const input of inputs) {
    await writeFile(path.join(directory, input.name), input.content);
  }
  for (const name of writableNames) {
    await writeFile(path.join(directory, name), Buffer.alloc(0), { flag: "wx" });
  }
}

function appendBounded(current: string, chunk: string, limit: number, stream: string): string {
  const combined = current + chunk;
  if (Buffer.byteLength(combined) <= limit) return combined;
  const marker = `[vellum: ${stream} truncated; retaining tail]\n`;
  const tailBudget = Math.max(0, limit - Buffer.byteLength(marker));
  return marker + Buffer.from(combined).subarray(-tailBudget).toString("utf8");
}

export async function runSubprocess(
  config: SubprocessConfig,
  options: SubprocessRunOptions = {}
): Promise<SubprocessResult> {
  return await new SubprocessRunner().run(config, options);
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
  const files: string[] = [];
  const state = { scannedEntries: 0 };
  await walkFilesInto(directory, maxEntries, state, files);
  return files;
}

async function walkFilesInto(
  directory: string,
  maxEntries: number,
  state: { scannedEntries: number },
  files: string[]
): Promise<void> {
  const handle = await opendir(directory);
  try {
    for await (const entry of handle) {
      state.scannedEntries += 1;
      if (state.scannedEntries > maxEntries) {
        throw new SubprocessLimitError(`Generated entry count exceeds scan limit ${maxEntries}`);
      }
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walkFilesInto(entryPath, maxEntries, state, files);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
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
