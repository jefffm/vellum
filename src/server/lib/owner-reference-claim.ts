import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { platform } from "node:os";
import path from "node:path";

import { ApiRouteError } from "./create-route.js";

type OwnerReferenceClaimReceipt = {
  schemaVersion: 1;
  token: string;
  pid: number;
  hostIdentity: string;
  bootIdentity: string | null;
  processStartIdentity: string | null;
  claimedAt: string;
};

type OwnedClaim = {
  descriptor: number;
  path: string;
  serialized: string;
};

type ClaimDirectoryIdentity = {
  path: string;
  dev: bigint;
  ino: bigint;
};

export type OwnerReferenceWriteClaimOptions = {
  rootDirectory: string;
  now?: () => Date;
  /** Test seam for hosts where a stable machine identity is unavailable. */
  hostIdentity?: () => string | null;
  /** Test seams for deterministic absent-owner and PID-reuse coverage. */
  bootIdentity?: () => string | null;
  processStartIdentity?: (pid: number) => string | null;
  processExists?: (pid: number) => boolean;
  /** Bounded synchronous retries for a healthy writer or recovery ticket. */
  contentionRetryLimit?: number;
  /** Delay between contention retries. Kept injectable for deterministic tests. */
  contentionRetryDelayMs?: number;
};

export class OwnerReferenceClaimIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerReferenceClaimIntegrityError";
  }
}

/**
 * Serializes every OwnerStore manifest writer and stable legacy-reference
 * inventory reader across processes without granting those operations knowledge
 * authority. A claim is recoverable only when its receipt identifies this host
 * and the former process is provably absent.
 */
export class OwnerReferenceWriteClaim {
  private readonly rootDirectory: string;
  private readonly rootDirectoryIdentity: ClaimDirectoryIdentity;
  private readonly now: () => Date;
  private readonly hostIdentity: () => string | null;
  private readonly bootIdentity: () => string | null;
  private readonly getProcessStartIdentity: (pid: number) => string | null;
  private readonly processExists: (pid: number) => boolean;
  private readonly contentionRetryLimit: number;
  private readonly contentionRetryDelayMs: number;

  constructor(options: OwnerReferenceWriteClaimOptions) {
    this.rootDirectory = path.resolve(options.rootDirectory);
    this.now = options.now ?? (() => new Date());
    this.hostIdentity = options.hostIdentity ?? currentHostIdentity;
    this.bootIdentity = options.bootIdentity ?? currentBootIdentity;
    this.getProcessStartIdentity = options.processStartIdentity ?? processStartIdentity;
    this.processExists = options.processExists ?? processIsPresent;
    this.contentionRetryLimit = options.contentionRetryLimit ?? 250;
    this.contentionRetryDelayMs = options.contentionRetryDelayMs ?? 10;
    if (!Number.isInteger(this.contentionRetryLimit) || this.contentionRetryLimit < 0) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference contention retry limit must be a non-negative integer"
      );
    }
    if (!Number.isInteger(this.contentionRetryDelayMs) || this.contentionRetryDelayMs < 0) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference contention retry delay must be a non-negative integer"
      );
    }
    this.rootDirectoryIdentity = ensureClaimRootDirectory(this.rootDirectory);
  }

  withClaim<T>(operation: () => T): T {
    this.assertRootDirectoryIdentity();
    const claim = this.acquireClaim();
    try {
      return operation();
    } finally {
      this.releaseClaim(claim);
    }
  }

  private acquireClaim(attempt = 0): OwnedClaim {
    if (this.recoveryClaimPaths().length > 0) {
      const recoveryClaim = this.acquireRecoveryClaim();
      if (!recoveryClaim) {
        return this.retryContention(
          attempt,
          "Owner Reference write-claim recovery is already in progress"
        );
      }
      this.releaseClaim(recoveryClaim);
    }

    try {
      const claim = this.createClaim(this.claimPath());
      if (this.recoveryClaimPaths().length > 0) {
        this.releaseClaim(claim);
        return this.retryContention(
          attempt,
          "Owner Reference write-claim recovery raced this writer"
        );
      }
      return claim;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      if (!this.recoverAbsentClaimOwner()) {
        return this.retryContention(attempt, "Another Owner Reference write is in progress");
      }
      if (attempt > this.contentionRetryLimit) {
        throw claimConflict("Owner Reference write claim kept changing during recovery");
      }
      return this.acquireClaim(attempt + 1);
    }
  }

  private retryContention(attempt: number, message: string): OwnedClaim {
    if (attempt >= this.contentionRetryLimit) throw claimConflict(message);
    waitForClaimRetry(this.contentionRetryDelayMs);
    return this.acquireClaim(attempt + 1);
  }

  private recoverAbsentClaimOwner(): boolean {
    const recoveryClaim = this.acquireRecoveryClaim();
    if (!recoveryClaim) return false;
    try {
      if (!pathEntryExists(this.claimPath())) return true;
      return this.recoverStaleClaim(this.claimPath(), "write-claim");
    } finally {
      this.releaseClaim(recoveryClaim);
    }
  }

  private acquireRecoveryClaim(): OwnedClaim | null {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const claim = this.createClaim(this.recoveryTicketPath());
      let keepClaim = false;
      try {
        for (const candidate of this.recoveryClaimPaths()) {
          if (candidate === claim.path || candidate === this.recoveryClaimPath()) continue;
          if (!this.recoverStaleClaim(candidate, "recovery-guard")) return null;
        }
        if (
          this.recoveryClaimPaths().some(
            (candidate) => candidate !== claim.path && candidate !== this.recoveryClaimPath()
          )
        ) {
          continue;
        }
        if (
          pathEntryExists(this.recoveryClaimPath()) &&
          !this.recoverStaleClaim(this.recoveryClaimPath(), "recovery-guard")
        ) {
          return null;
        }
        if (this.recoveryClaimPaths().some((candidate) => candidate !== claim.path)) continue;
        keepClaim = true;
        return claim;
      } finally {
        if (!keepClaim) this.releaseClaim(claim);
      }
    }
    return null;
  }

  private createClaim(file: string): OwnedClaim {
    this.assertRootDirectoryIdentity();
    if (path.dirname(path.resolve(file)) !== this.rootDirectory) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference claim path escapes its root directory"
      );
    }
    const stableHostIdentity = this.hostIdentity();
    if (stableHostIdentity !== null && !isStableHostIdentity(stableHostIdentity)) {
      throw new OwnerReferenceClaimIntegrityError(
        "Stable Owner Reference claim host identity must be a SHA-256 digest"
      );
    }
    const receipt: OwnerReferenceClaimReceipt = {
      schemaVersion: 1,
      token: randomUUID(),
      pid: process.pid,
      hostIdentity: stableHostIdentity ?? `unrecoverable:${randomUUID()}`,
      bootIdentity: this.bootIdentity(),
      processStartIdentity: this.getProcessStartIdentity(process.pid),
      claimedAt: this.now().toISOString(),
    };
    const serialized = `${JSON.stringify(receipt)}\n`;
    const temporary = path.join(this.rootDirectory, `.reference-write-claim.${randomUUID()}.tmp`);
    let descriptor: number | undefined;
    let published = false;
    try {
      descriptor = openSync(
        temporary,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
        0o600
      );
      if (!fstatSync(descriptor).isFile()) {
        throw new OwnerReferenceClaimIntegrityError(
          "Owner Reference claim temporary target is not a regular file"
        );
      }
      this.assertRootDirectoryIdentity();
      writeFileSync(descriptor, serialized);
      fsyncSync(descriptor);
      this.assertRootDirectoryIdentity();
      // Hard-link publication is an atomic no-replace operation across processes.
      linkSync(temporary, file);
      published = true;
      this.assertRootDirectoryIdentity();
      fsyncDirectory(this.rootDirectory);
      unlinkSync(temporary);
      fsyncDirectory(this.rootDirectory);
      return { descriptor, path: file, serialized };
    } catch (error) {
      if (descriptor !== undefined && this.rootDirectoryIsStable()) {
        if (published && pathMatchesDescriptor(file, descriptor)) unlinkSync(file);
        if (pathMatchesDescriptor(temporary, descriptor)) unlinkSync(temporary);
        fsyncDirectory(this.rootDirectory);
      }
      if (descriptor !== undefined) closeSync(descriptor);
      throw error;
    }
  }

  private recoverStaleClaim(file: string, kind: "write-claim" | "recovery-guard"): boolean {
    this.assertRootDirectoryIdentity();
    if (!pathEntryExists(file)) return true;
    let observed: ReturnType<typeof readClaim>;
    try {
      observed = readClaim(file);
    } catch (error) {
      if (isMissingPathError(error)) return true;
      throw error;
    }
    const { descriptor, receipt, serialized } = observed;
    try {
      if (!this.ownerIsProvablyAbsent(receipt)) return false;
      if (!pathMatchesDescriptor(file, descriptor)) return !pathEntryExists(file);
      if (readStableClaimBytes(file, descriptor) !== serialized) return false;

      const recoveryDirectoryIdentities = this.prepareRecoveryDirectory();
      this.assertRootDirectoryIdentity();
      const quarantine = `${file}.orphan.${randomUUID()}`;
      renameSync(file, quarantine);
      let quarantineOwned = false;
      let recoveryReceiptPublished = false;
      try {
        this.assertRootDirectoryIdentity();
        if (
          !pathMatchesDescriptor(quarantine, descriptor) ||
          readStableClaimBytes(quarantine, descriptor) !== serialized
        ) {
          throw new OwnerReferenceClaimIntegrityError(
            `Recovered Owner Reference ${kind} bytes changed during guarded rename`
          );
        }
        quarantineOwned = true;
        this.writeRecoveryReceipt(kind, serialized, receipt, recoveryDirectoryIdentities);
        recoveryReceiptPublished = true;
      } finally {
        if (
          quarantineOwned &&
          this.rootDirectoryIsStable() &&
          pathMatchesDescriptor(quarantine, descriptor)
        ) {
          if (recoveryReceiptPublished) unlinkSync(quarantine);
          else if (!pathEntryExists(file)) renameSync(quarantine, file);
        }
        if (this.rootDirectoryIsStable()) fsyncDirectory(this.rootDirectory);
      }
      return true;
    } finally {
      closeSync(descriptor);
    }
  }

  private ownerIsProvablyAbsent(receipt: OwnerReferenceClaimReceipt): boolean {
    if (!isStableHostIdentity(receipt.hostIdentity)) return false;
    const currentHost = this.hostIdentity();
    if (!currentHost || currentHost !== receipt.hostIdentity) return false;
    const bootIdentity = this.bootIdentity();
    if (receipt.bootIdentity && bootIdentity && receipt.bootIdentity !== bootIdentity) return true;
    if (!this.processExists(receipt.pid)) return true;
    const currentStart = this.getProcessStartIdentity(receipt.pid);
    return Boolean(
      receipt.processStartIdentity && currentStart && receipt.processStartIdentity !== currentStart
    );
  }

  private writeRecoveryReceipt(
    kind: "write-claim" | "recovery-guard",
    serialized: string,
    receipt: OwnerReferenceClaimReceipt,
    directoryIdentities: ClaimDirectoryIdentity[]
  ): void {
    const recoveryDirectory = this.recoveryDirectory();
    assertClaimDirectoryIdentities(directoryIdentities);
    const value = {
      schemaVersion: 1,
      kind,
      recoveredClaimDigest: createHash("sha256").update(serialized).digest("hex"),
      absentOwner: {
        pid: receipt.pid,
        hostIdentity: receipt.hostIdentity,
        bootIdentity: receipt.bootIdentity,
        processStartIdentity: receipt.processStartIdentity,
      },
      recoveredAt: this.now().toISOString(),
    };
    const file = path.join(recoveryDirectory, `${kind}.${randomUUID()}.json`);
    const temporary = `${file}.${randomUUID()}.tmp`;
    let descriptor: number | undefined;
    let published = false;
    try {
      descriptor = openSync(
        temporary,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
        0o600
      );
      if (!fstatSync(descriptor).isFile()) {
        throw new OwnerReferenceClaimIntegrityError(
          "Owner Reference recovery receipt temporary target is not a regular file"
        );
      }
      assertClaimDirectoryIdentities(directoryIdentities);
      writeFileSync(descriptor, `${JSON.stringify(value)}\n`);
      fsyncSync(descriptor);
      assertClaimDirectoryIdentities(directoryIdentities);
      linkSync(temporary, file);
      published = true;
      if (!pathMatchesDescriptor(file, descriptor)) {
        throw new OwnerReferenceClaimIntegrityError(
          "Owner Reference recovery receipt changed during publication"
        );
      }
      assertClaimDirectoryIdentities(directoryIdentities);
      unlinkSync(temporary);
      fsyncDirectory(recoveryDirectory);
    } catch (error) {
      if (descriptor !== undefined && claimDirectoryIdentitiesAreStable(directoryIdentities)) {
        if (published && pathMatchesDescriptor(file, descriptor)) unlinkSync(file);
        if (pathMatchesDescriptor(temporary, descriptor)) unlinkSync(temporary);
        fsyncDirectory(recoveryDirectory);
      }
      throw error;
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  private releaseClaim(claim: OwnedClaim): void {
    try {
      this.assertRootDirectoryIdentity();
      if (readStableClaimBytes(claim.path, claim.descriptor) !== claim.serialized) {
        throw new OwnerReferenceClaimIntegrityError(
          "Owner Reference write claim ownership changed before release"
        );
      }
      this.assertRootDirectoryIdentity();
      unlinkSync(claim.path);
      fsyncDirectory(this.rootDirectory);
    } finally {
      closeSync(claim.descriptor);
    }
  }

  private claimPath(): string {
    return path.join(this.rootDirectory, ".reference-write.claim");
  }

  private recoveryClaimPath(): string {
    return path.join(this.rootDirectory, ".reference-write.claim.recovery");
  }

  private recoveryTicketPath(): string {
    return path.join(this.rootDirectory, `.reference-write.claim.recovery.${randomUUID()}`);
  }

  private recoveryClaimPaths(): string[] {
    this.assertRootDirectoryIdentity();
    const legacy = this.recoveryClaimPath();
    const claims = pathEntryExists(legacy) ? [legacy] : [];
    for (const entry of readdirSync(this.rootDirectory, { withFileTypes: true })) {
      if (!/^\.reference-write\.claim\.recovery\.[0-9a-f-]{36}$/.test(entry.name)) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new OwnerReferenceClaimIntegrityError(
          "Owner Reference recovery ticket is not a regular file"
        );
      }
      claims.push(path.join(this.rootDirectory, entry.name));
    }
    this.assertRootDirectoryIdentity();
    return claims.sort();
  }

  private recoveryDirectory(): string {
    return path.join(this.rootDirectory, ".reference-write-claim-recoveries");
  }

  private prepareRecoveryDirectory(): ClaimDirectoryIdentity[] {
    return ensureClaimChildDirectory(this.rootDirectoryIdentity, this.recoveryDirectory());
  }

  private assertRootDirectoryIdentity(): void {
    assertClaimDirectoryIdentities([this.rootDirectoryIdentity]);
  }

  private rootDirectoryIsStable(): boolean {
    return claimDirectoryIdentitiesAreStable([this.rootDirectoryIdentity]);
  }
}

function readClaim(file: string): {
  descriptor: number;
  serialized: string;
  receipt: OwnerReferenceClaimReceipt;
} {
  let descriptor: number;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | noFollowFlag());
  } catch (error) {
    if (isMissingPathError(error)) throw error;
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference write claim could not be opened without following links"
    );
  }
  try {
    if (!fstatSync(descriptor).isFile() || !pathMatchesDescriptor(file, descriptor)) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference write claim is not a stable regular file"
      );
    }
    const serialized = readFileSync(descriptor, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new OwnerReferenceClaimIntegrityError("Owner Reference write claim is malformed");
    }
    return { descriptor, serialized, receipt: decodeClaimReceipt(parsed) };
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

function decodeClaimReceipt(value: unknown): OwnerReferenceClaimReceipt {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "token",
      "pid",
      "hostIdentity",
      "bootIdentity",
      "processStartIdentity",
      "claimedAt",
    ]) ||
    value.schemaVersion !== 1 ||
    typeof value.token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.token) ||
    !Number.isInteger(value.pid) ||
    Number(value.pid) < 1 ||
    typeof value.hostIdentity !== "string" ||
    !(
      isStableHostIdentity(value.hostIdentity) || isUnrecoverableHostIdentity(value.hostIdentity)
    ) ||
    !(value.bootIdentity === null || typeof value.bootIdentity === "string") ||
    !(value.processStartIdentity === null || typeof value.processStartIdentity === "string") ||
    typeof value.claimedAt !== "string" ||
    Number.isNaN(Date.parse(value.claimedAt))
  ) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference write claim failed closed-schema validation"
    );
  }
  return value as OwnerReferenceClaimReceipt;
}

function readStableClaimBytes(file: string, ownerDescriptor: number): string {
  if (!pathMatchesDescriptor(file, ownerDescriptor)) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference write claim path changed during ownership check"
    );
  }
  const descriptor = openSync(file, fsConstants.O_RDONLY | noFollowFlag());
  try {
    const owner = fstatSync(ownerDescriptor);
    const observed = fstatSync(descriptor);
    if (!observed.isFile() || owner.dev !== observed.dev || owner.ino !== observed.ino) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference write claim identity changed during ownership check"
      );
    }
    const serialized = readFileSync(descriptor, "utf8");
    if (!pathMatchesDescriptor(file, ownerDescriptor)) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference write claim path changed during ownership check"
      );
    }
    return serialized;
  } finally {
    closeSync(descriptor);
  }
}

function pathMatchesDescriptor(file: string, descriptor: number): boolean {
  try {
    const opened = fstatSync(descriptor);
    const named = lstatSync(file);
    return named.isFile() && opened.dev === named.dev && opened.ino === named.ino;
  } catch {
    return false;
  }
}

function currentHostIdentity(): string | null {
  try {
    let stable: string;
    if (platform() === "linux") {
      const machineId = readFileSync("/etc/machine-id", "utf8").trim();
      const pidNamespace = readlinkSync("/proc/self/ns/pid");
      if (!machineId || !pidNamespace) return null;
      stable = `${machineId}\u0000${pidNamespace}`;
    } else if (platform() === "darwin") {
      const output = execFileSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
        encoding: "utf8",
        timeout: 1_000,
      });
      const uuid = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(output)?.[1];
      if (!uuid) return null;
      stable = uuid;
    } else {
      return null;
    }
    return createHash("sha256").update(`${platform()}\u0000${stable}`).digest("hex");
  } catch {
    return null;
  }
}

function currentBootIdentity(): string | null {
  try {
    if (platform() === "linux") {
      return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() || null;
    }
    if (platform() === "darwin") {
      return (
        execFileSync("/usr/sbin/sysctl", ["-n", "kern.boottime"], {
          encoding: "utf8",
          timeout: 1_000,
        }).trim() || null
      );
    }
  } catch {
    // Identity probes fail closed for recovery.
  }
  return null;
}

function processStartIdentity(pid: number): string | null {
  try {
    if (platform() === "linux") {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const tail = stat
        .slice(stat.lastIndexOf(")") + 2)
        .trim()
        .split(/\s+/);
      return tail[19] ?? null;
    }
    if (platform() === "darwin") {
      return (
        execFileSync("/bin/ps", ["-o", "lstart=", "-p", String(pid)], {
          encoding: "utf8",
          timeout: 1_000,
        }).trim() || null
      );
    }
  } catch {
    // An absent process has no start identity.
  }
  return null;
}

function processIsPresent(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ESRCH"
    );
  }
}

function ensureClaimRootDirectory(root: string): ClaimDirectoryIdentity {
  if (!pathEntryExists(root)) mkdirSync(root, { recursive: true, mode: 0o700 });
  const stat = lstatSync(root, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference claim root must be a real directory"
    );
  }
  assertClaimDirectoryAccess(stat.uid, stat.mode);
  return { path: root, dev: stat.dev, ino: stat.ino };
}

function ensureClaimChildDirectory(
  rootIdentity: ClaimDirectoryIdentity,
  directory: string
): ClaimDirectoryIdentity[] {
  assertClaimDirectoryIdentities([rootIdentity]);
  const absoluteDirectory = path.resolve(directory);
  if (path.dirname(absoluteDirectory) !== rootIdentity.path) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference claim storage path escapes its root"
    );
  }
  if (!pathEntryExists(absoluteDirectory)) {
    try {
      mkdirSync(absoluteDirectory, { mode: 0o700 });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
  }
  const stat = lstatSync(absoluteDirectory, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference claim storage traverses a symlink or non-directory"
    );
  }
  assertClaimDirectoryAccess(stat.uid, stat.mode);
  const identities = [rootIdentity, { path: absoluteDirectory, dev: stat.dev, ino: stat.ino }];
  assertClaimDirectoryIdentities(identities);
  return identities;
}

function assertClaimDirectoryIdentities(identities: ClaimDirectoryIdentity[]): void {
  for (const identity of identities) {
    const current = lstatSync(identity.path, { bigint: true });
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino
    ) {
      throw new OwnerReferenceClaimIntegrityError(
        "Owner Reference claim directory changed during the operation"
      );
    }
    assertClaimDirectoryAccess(current.uid, current.mode);
  }
}

function claimDirectoryIdentitiesAreStable(identities: ClaimDirectoryIdentity[]): boolean {
  try {
    assertClaimDirectoryIdentities(identities);
    return true;
  } catch {
    return false;
  }
}

function assertClaimDirectoryAccess(uid: number | bigint, mode: number | bigint): void {
  const effectiveUid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (effectiveUid !== null && BigInt(uid) !== BigInt(effectiveUid)) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference claim directory is not owned by the current OS user"
    );
  }
  if ((BigInt(mode) & BigInt(0o022)) !== BigInt(0)) {
    throw new OwnerReferenceClaimIntegrityError(
      "Owner Reference claim directory is writable outside the Owner OS user"
    );
  }
}

function pathEntryExists(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(
    directory,
    fsConstants.O_RDONLY |
      noFollowFlag() |
      (typeof fsConstants.O_DIRECTORY === "number" ? fsConstants.O_DIRECTORY : 0)
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function waitForClaimRetry(delayMs: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function noFollowFlag(): number {
  return typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isStableHostIdentity(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isUnrecoverableHostIdentity(value: string): boolean {
  return /^unrecoverable:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value
  );
}

function isFileExistsError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function claimConflict(message: string): ApiRouteError {
  return new ApiRouteError(message, 409, "conflict");
}
