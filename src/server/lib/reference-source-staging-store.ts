import { Value } from "@sinclair/typebox/value";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { platform } from "node:os";
import path from "node:path";

import {
  ReferenceSourceStagingSnapshotSchema,
  canonicalReferenceJson,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";

export type ReferenceSourceStagingHead = {
  snapshotId: string;
  digest: string;
  revision: number;
};

export type ReferenceSourceStagingStoreOptions = {
  rootDirectory?: string;
  now?: () => Date;
  /** Test seam for platforms or containers without a stable machine identity. */
  hostIdentity?: () => string | null;
};

export type ReferenceSourceStagingState = {
  head: ReferenceSourceStagingHead;
  snapshot: ReferenceSourceStagingSnapshot;
};

type HeadClaimReceipt = {
  schemaVersion: 1;
  token: string;
  pid: number;
  hostIdentity: string;
  bootIdentity: string | null;
  processStartIdentity: string | null;
  claimedAt: string;
};

type HeadClaim = {
  file: number;
  path: string;
  receipt: HeadClaimReceipt;
  serialized: string;
};

/**
 * Immutable staging snapshots plus one compare-and-swap head.
 *
 * Snapshots are intentionally written before the head claim. A losing writer can
 * therefore leave an immutable orphan, but public reads walk only the current
 * head's parent chain and can never resolve that orphan.
 */
export class ReferenceSourceStagingStore {
  readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly hostIdentity: () => string | null;

  constructor(options: ReferenceSourceStagingStoreOptions = {}) {
    this.rootDirectory =
      options.rootDirectory ??
      path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner", "reference-source-staging");
    this.now = options.now ?? (() => new Date());
    this.hostIdentity = options.hostIdentity ?? currentHostIdentity;
  }

  readHead(): ReferenceSourceStagingHead | null {
    if (!existsSync(this.headPath())) return null;
    return decodeHead(JSON.parse(readFileSync(this.headPath(), "utf8")));
  }

  readCurrentSnapshot(): ReferenceSourceStagingSnapshot | null {
    return this.readCurrentState()?.snapshot ?? null;
  }

  /** Capture a self-consistent head and snapshot even while another writer advances. */
  readCurrentState(): ReferenceSourceStagingState | null {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const before = this.readHead();
      if (!before) {
        if (!this.readHead()) return null;
        continue;
      }
      const snapshot = this.readSnapshotFile(before.snapshotId);
      assertHeadMatchesSnapshot(before, snapshot);
      const after = this.readHead();
      if (after && sameHead(before, after)) return { head: before, snapshot };
    }
    throw new ReferenceSourceStagingConflictError(
      "Reference-source staging head kept moving during a stable read",
      this.readHead()
    );
  }

  /** Read one immutable snapshot only when it is reachable from the current head. */
  readSnapshot(snapshotId: string): ReferenceSourceStagingSnapshot {
    return this.readSnapshotState(snapshotId).snapshot;
  }

  readSnapshotState(snapshotId: string): ReferenceSourceStagingState {
    assertSafeId(snapshotId, "snapshot ID");
    const current = this.readCurrentState();
    if (!current) {
      throw new ReferenceSourceStagingNotFoundError(
        `Reference-source staging snapshot is not reachable: ${snapshotId}`
      );
    }
    let cursor: ReferenceSourceStagingSnapshot | null = current.snapshot;
    const visited = new Set<string>();

    while (cursor) {
      if (visited.has(cursor.id)) {
        throw new ReferenceSourceStagingIntegrityError(
          `Reference-source staging history contains a parent cycle at ${cursor.id}`
        );
      }
      visited.add(cursor.id);
      if (cursor.id === snapshotId) {
        return {
          // `head` always means the live compare-and-swap head. The requested
          // historical snapshot is carried separately and must never masquerade
          // as the current generation.
          head: current.head,
          snapshot: cursor,
        };
      }
      if (!cursor.parentSnapshotRef) break;
      const parent = this.readSnapshotFile(cursor.parentSnapshotRef.id);
      if (parent.digest !== cursor.parentSnapshotRef.digest) {
        throw new ReferenceSourceStagingIntegrityError(
          `Reference-source staging parent digest mismatch for ${cursor.id}`
        );
      }
      if (parent.revision >= cursor.revision) {
        throw new ReferenceSourceStagingIntegrityError(
          `Reference-source staging parent revision is not older than ${cursor.id}`
        );
      }
      cursor = parent;
    }

    throw new ReferenceSourceStagingNotFoundError(
      `Reference-source staging snapshot is not reachable: ${snapshotId}`
    );
  }

  commit(
    snapshot: ReferenceSourceStagingSnapshot,
    expectedHeadRef?: ReferenceRecordRef
  ): ReferenceSourceStagingHead {
    const decoded = decodeSnapshot(snapshot);
    this.writeImmutableSnapshot(decoded);

    const claim = this.acquireHeadClaim();
    try {
      const currentHead = this.readHead();
      if (!sameExpectedHead(currentHead, expectedHeadRef)) {
        throw new ReferenceSourceStagingConflictError(
          "Reference-source staging head changed before the transaction committed",
          currentHead
        );
      }

      assertValidSuccessor(decoded, currentHead, expectedHeadRef);
      const nextHead: ReferenceSourceStagingHead = {
        snapshotId: decoded.id,
        digest: decoded.digest,
        revision: decoded.revision,
      };
      writeJsonAtomic(this.headPath(), nextHead);
      return nextHead;
    } finally {
      this.releaseHeadClaim(claim);
    }
  }

  private writeImmutableSnapshot(snapshot: ReferenceSourceStagingSnapshot): void {
    const file = this.snapshotPath(snapshot.id);
    const serialized = `${canonicalReferenceJson(snapshot)}\n`;
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    let created = false;
    try {
      const descriptor = openSync(file, "wx", 0o600);
      created = true;
      try {
        writeFileSync(descriptor, serialized);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      fsyncDirectory(path.dirname(file));
    } catch (error) {
      if (!isFileExistsError(error)) {
        if (created) {
          rmSync(file, { force: true });
          fsyncDirectory(path.dirname(file));
        }
        throw error;
      }
      const existing = readFileSync(file, "utf8");
      if (existing !== serialized) {
        throw new ReferenceSourceStagingIntegrityError(
          `Immutable reference-source snapshot ID was reused with different bytes: ${snapshot.id}`
        );
      }
    }
  }

  private readSnapshotFile(snapshotId: string): ReferenceSourceStagingSnapshot {
    const file = this.snapshotPath(snapshotId);
    if (!existsSync(file)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source staging history is missing snapshot ${snapshotId}`
      );
    }
    return decodeSnapshot(JSON.parse(readFileSync(file, "utf8")));
  }

  private acquireHeadClaim(): HeadClaim {
    mkdirSync(this.rootDirectory, { recursive: true, mode: 0o700 });
    if (existsSync(this.recoveryClaimPath())) {
      if (!this.recoverStaleOwnedClaim(this.recoveryClaimPath(), "recovery-guard")) {
        throw new ReferenceSourceStagingConflictError(
          "Reference-source staging head claim recovery is in progress",
          this.readHead()
        );
      }
    }
    try {
      const claim = this.createOwnedClaim(this.headClaimPath());
      if (existsSync(this.recoveryClaimPath())) {
        this.releaseOwnedClaim(claim);
        throw new ReferenceSourceStagingConflictError(
          "Reference-source staging head claim recovery raced this writer",
          this.readHead()
        );
      }
      return claim;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      if (!this.recoverAbsentHeadClaimOwner()) {
        throw new ReferenceSourceStagingConflictError(
          "Another reference-source staging writer owns the head claim",
          this.readHead()
        );
      }
      return this.acquireHeadClaim();
    }
  }

  private recoverAbsentHeadClaimOwner(): boolean {
    const recoveryClaim = this.acquireRecoveryClaim();
    if (!recoveryClaim) return false;

    try {
      if (!existsSync(this.headClaimPath())) return true;
      return this.recoverStaleOwnedClaim(this.headClaimPath(), "head-claim");
    } finally {
      this.releaseOwnedClaim(recoveryClaim);
    }
  }

  private acquireRecoveryClaim(): HeadClaim | null {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return this.createOwnedClaim(this.recoveryClaimPath());
      } catch (error) {
        if (!isFileExistsError(error)) throw error;
        if (!this.recoverStaleOwnedClaim(this.recoveryClaimPath(), "recovery-guard")) return null;
      }
    }
    return null;
  }

  private createOwnedClaim(filePath: string): HeadClaim {
    const file = openSync(filePath, "wx", 0o600);
    try {
      const stableHostIdentity = this.hostIdentity();
      if (stableHostIdentity !== null && !isStableHostIdentity(stableHostIdentity)) {
        throw new ReferenceSourceStagingIntegrityError(
          "Stable staging-claim host identity must be a SHA-256 digest"
        );
      }
      const receipt: HeadClaimReceipt = {
        schemaVersion: 1,
        token: randomUUID(),
        pid: process.pid,
        hostIdentity: stableHostIdentity ?? unrecoverableHostClaimMarker,
        bootIdentity: currentBootIdentity(),
        processStartIdentity: processStartIdentity(process.pid),
        claimedAt: this.now().toISOString(),
      };
      const serialized = `${canonicalReferenceJson(receipt)}\n`;
      writeFileSync(file, serialized);
      fsyncSync(file);
      return { file, path: filePath, receipt, serialized };
    } catch (error) {
      closeSync(file);
      rmSync(filePath, { force: true });
      throw error;
    }
  }

  private recoverStaleOwnedClaim(filePath: string, kind: string): boolean {
    if (!existsSync(filePath)) return true;
    let originalBytes: string;
    try {
      originalBytes = readFileSync(filePath, "utf8");
    } catch (error) {
      if (isFileMissingError(error)) return true;
      throw error;
    }
    const receipt = decodeHeadClaim(JSON.parse(originalBytes));
    if (!headClaimOwnerIsProvablyAbsent(receipt, this.hostIdentity)) return false;
    try {
      if (readFileSync(filePath, "utf8") !== originalBytes) return false;
    } catch (error) {
      if (isFileMissingError(error)) return true;
      throw error;
    }

    const quarantine = `${filePath}.orphan.${randomUUID()}`;
    try {
      renameSync(filePath, quarantine);
    } catch (error) {
      if (isFileMissingError(error)) return true;
      throw error;
    }
    try {
      const quarantinedBytes = readFileSync(quarantine, "utf8");
      if (quarantinedBytes !== originalBytes) {
        throw new ReferenceSourceStagingIntegrityError(
          `Recovered ${kind} bytes changed during the guarded rename`
        );
      }
      writeJsonAtomic(path.join(this.rootDirectory, "recoveries", `${kind}.${randomUUID()}.json`), {
        schemaVersion: 1,
        kind,
        recoveredClaimDigest: createHash("sha256").update(originalBytes).digest("hex"),
        absentOwner: {
          pid: receipt.pid,
          hostIdentity: receipt.hostIdentity,
          bootIdentity: receipt.bootIdentity,
          processStartIdentity: receipt.processStartIdentity,
        },
        recoveredAt: this.now().toISOString(),
      });
      return true;
    } finally {
      rmSync(quarantine, { force: true });
    }
  }

  private releaseHeadClaim(claim: HeadClaim): void {
    this.releaseOwnedClaim(claim);
  }

  private releaseOwnedClaim(claim: HeadClaim): void {
    closeSync(claim.file);
    if (!existsSync(claim.path)) {
      throw new ReferenceSourceStagingIntegrityError(
        "Reference-source staging head claim disappeared before release"
      );
    }
    if (readFileSync(claim.path, "utf8") !== claim.serialized) {
      throw new ReferenceSourceStagingIntegrityError(
        "Reference-source staging head claim ownership changed before release"
      );
    }
    rmSync(claim.path, { force: true });
  }

  private headPath(): string {
    return path.join(this.rootDirectory, "head.json");
  }

  private headClaimPath(): string {
    return path.join(this.rootDirectory, ".head.claim");
  }

  private recoveryClaimPath(): string {
    return path.join(this.rootDirectory, ".head.claim.recovery");
  }

  private snapshotsDirectory(): string {
    return path.join(this.rootDirectory, "snapshots");
  }

  private snapshotPath(snapshotId: string): string {
    assertSafeId(snapshotId, "snapshot ID");
    return path.join(this.snapshotsDirectory(), `${snapshotId}.json`);
  }
}

export class ReferenceSourceStagingConflictError extends Error {
  constructor(
    message: string,
    readonly currentHead: ReferenceSourceStagingHead | null
  ) {
    super(message);
    this.name = "ReferenceSourceStagingConflictError";
  }
}

export class ReferenceSourceStagingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceStagingNotFoundError";
  }
}

export class ReferenceSourceStagingIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceStagingIntegrityError";
  }
}

function decodeSnapshot(value: unknown): ReferenceSourceStagingSnapshot {
  let decoded: ReferenceSourceStagingSnapshot;
  try {
    decoded = Value.Decode(ReferenceSourceStagingSnapshotSchema, value);
  } catch (error) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source staging snapshot failed schema validation: ${errorMessage(error)}`
    );
  }
  const { digest: _digest, ...core } = decoded;
  if (referenceSourceDigest(core) !== decoded.digest) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source staging snapshot digest mismatch for ${decoded.id}`
    );
  }
  for (const record of decoded.records) {
    if (!verifyReferenceRecordDigest(record)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source staging snapshot contains a record digest mismatch for ${record.id}`
      );
    }
  }
  return decoded;
}

function decodeHead(value: unknown): ReferenceSourceStagingHead {
  if (!isPlainObject(value) || !hasExactKeys(value, ["snapshotId", "digest", "revision"])) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source staging head failed closed-schema validation"
    );
  }
  const candidate = value as Partial<ReferenceSourceStagingHead>;
  if (
    typeof candidate.snapshotId !== "string" ||
    typeof candidate.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.digest) ||
    !Number.isInteger(candidate.revision) ||
    (candidate.revision ?? -1) < 0
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source staging head failed schema validation"
    );
  }
  assertSafeId(candidate.snapshotId, "head snapshot ID");
  return {
    snapshotId: candidate.snapshotId,
    digest: candidate.digest,
    revision: candidate.revision,
  } as ReferenceSourceStagingHead;
}

function assertHeadMatchesSnapshot(
  head: ReferenceSourceStagingHead,
  snapshot: ReferenceSourceStagingSnapshot
): void {
  if (
    snapshot.id !== head.snapshotId ||
    snapshot.digest !== head.digest ||
    snapshot.revision !== head.revision
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source staging head does not match its immutable snapshot"
    );
  }
}

function sameExpectedHead(
  actual: ReferenceSourceStagingHead | null,
  expected?: ReferenceRecordRef
): boolean {
  if (!actual || !expected) return actual === null && expected === undefined;
  return actual.snapshotId === expected.id && actual.digest === expected.digest;
}

function sameHead(left: ReferenceSourceStagingHead, right: ReferenceSourceStagingHead): boolean {
  return (
    left.snapshotId === right.snapshotId &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function assertValidSuccessor(
  snapshot: ReferenceSourceStagingSnapshot,
  currentHead: ReferenceSourceStagingHead | null,
  expectedHeadRef?: ReferenceRecordRef
): void {
  if (snapshot.publicationState !== "staging_only") {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source snapshots cannot leave staging-only publication state"
    );
  }
  if (!currentHead) {
    if (snapshot.parentSnapshotRef || snapshot.revision !== 1) {
      throw new ReferenceSourceStagingIntegrityError(
        "The first reference-source staging snapshot must be revision 1 with no parent"
      );
    }
    return;
  }
  if (
    !expectedHeadRef ||
    !snapshot.parentSnapshotRef ||
    snapshot.parentSnapshotRef.id !== expectedHeadRef.id ||
    snapshot.parentSnapshotRef.digest !== expectedHeadRef.digest ||
    snapshot.revision !== currentHead.revision + 1
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source staging snapshot is not an exact successor of the expected head"
    );
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const descriptor = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(descriptor, `${canonicalReferenceJson(value)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, file);
    fsyncDirectory(path.dirname(file));
  } finally {
    rmSync(temporary, { force: true });
  }
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function assertSafeId(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(value)) {
    throw new ReferenceSourceStagingIntegrityError(`Unsafe ${label}`);
  }
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isFileMissingError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function decodeHeadClaim(value: unknown): HeadClaimReceipt {
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
    value.token.length < 1 ||
    !Number.isInteger(value.pid) ||
    Number(value.pid) < 1 ||
    typeof value.hostIdentity !== "string" ||
    !(
      isStableHostIdentity(value.hostIdentity) || isUnrecoverableHostClaimMarker(value.hostIdentity)
    ) ||
    !(value.bootIdentity === null || typeof value.bootIdentity === "string") ||
    !(value.processStartIdentity === null || typeof value.processStartIdentity === "string") ||
    typeof value.claimedAt !== "string"
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source staging head claim failed closed-schema validation"
    );
  }
  return value as HeadClaimReceipt;
}

function headClaimOwnerIsProvablyAbsent(
  receipt: HeadClaimReceipt,
  getCurrentHostIdentity: () => string | null
): boolean {
  // An unrecoverable marker permits normal ownership and release in environments
  // without a stable machine identity, but can never establish same-host recovery.
  if (!isStableHostIdentity(receipt.hostIdentity)) return false;
  const hostIdentity = getCurrentHostIdentity();
  if (!hostIdentity || receipt.hostIdentity !== hostIdentity) return false;
  const bootIdentity = currentBootIdentity();
  if (receipt.bootIdentity && bootIdentity && receipt.bootIdentity !== bootIdentity) return true;
  if (!processExists(receipt.pid)) return true;
  const startIdentity = processStartIdentity(receipt.pid);
  return Boolean(
    receipt.processStartIdentity && startIdentity && receipt.processStartIdentity !== startIdentity
  );
}

function currentHostIdentity(): string | null {
  let stableMachineIdentity: string;
  try {
    if (platform() === "linux") {
      const machineId = readFileSync("/etc/machine-id", "utf8").trim();
      const pidNamespace = readlinkSync("/proc/self/ns/pid");
      if (!machineId || !pidNamespace) throw new Error("missing Linux machine identity");
      stableMachineIdentity = `${machineId}\u0000${pidNamespace}`;
    } else if (platform() === "darwin") {
      const output = execFileSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
        encoding: "utf8",
        timeout: 1_000,
      });
      const uuid = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(output)?.[1];
      if (!uuid) throw new Error("missing macOS platform identity");
      stableMachineIdentity = uuid;
    } else {
      throw new Error(`unsupported platform ${platform()}`);
    }
  } catch {
    // Claim acquisition remains available, but recovery must fail closed.
    return null;
  }
  return createHash("sha256").update(`${platform()}\u0000${stableMachineIdentity}`).digest("hex");
}

const unrecoverableHostClaimMarker = `unrecoverable:${randomUUID()}`;

function isStableHostIdentity(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isUnrecoverableHostClaimMarker(value: string): boolean {
  return /^unrecoverable:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value
  );
}

function currentBootIdentity(): string | null {
  try {
    if (platform() === "linux") {
      return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() || null;
    }
    if (platform() === "darwin") {
      return execFileSync("/usr/sbin/sysctl", ["-n", "kern.boottime"], {
        encoding: "utf8",
        timeout: 1_000,
      }).trim();
    }
  } catch {
    // Unsupported identity probes fail closed in owner recovery.
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

function processExists(pid: number): boolean {
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

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}
