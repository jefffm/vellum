import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readlinkSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const RESOURCE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export interface ResourceLeaseOwnerIdentity {
  leaseId: string;
  host: string;
  machineIdentity: string | null;
  bootIdentity: string | null;
  pid: number;
  processStartIdentity: string | null;
  acquiredAt: string;
}

export interface ResourceLeaseOwnerReceipt extends ResourceLeaseOwnerIdentity {
  schemaId: "vellum.resource-lease-owner.v1";
  resourceId: string;
}

export interface ResourceOrphanCleanupReceipt {
  schemaId: "vellum.resource-orphan-cleanup.v1";
  receiptId: string;
  resourceId: string;
  removedOwner: ResourceLeaseOwnerReceipt;
  proof: {
    kind: "same_host_pid_absent";
    checkedHost: string;
    checkedPid: number;
    checkedAt: string;
  };
  cleanedAt: string;
}

export interface CleanRerunRequiredMarker {
  schemaId: "vellum.clean-rerun-required.v1";
  resourceId: string;
  cleanupReceiptIds: string[];
  requiredSince: string;
}

export interface CleanRerunAcknowledgment {
  schemaId: "vellum.clean-rerun-acknowledgment.v1";
  acknowledgmentId: string;
  leaseId: string;
  resourceIds: string[];
  cleanupReceiptIds: string[];
  cleanRerunReceipt: CleanRerunPassReceipt;
  acknowledgedAt: string;
}

export interface CleanRerunPassReceipt {
  schemaId: "vellum.clean-rerun-pass.v1";
  runId: string;
  leaseId: string;
  cleanupReceiptIds: string[];
  startedAt: string;
  finishedAt: string;
  outcome: "pass";
  commandDigest: string;
  profileDigest: string;
  reportDigest: string;
}

export interface ResourceLeaseHandle {
  readonly resourceIds: readonly string[];
  readonly owner: Readonly<ResourceLeaseOwnerIdentity>;
  readonly ownerReceipts: readonly ResourceLeaseOwnerReceipt[];
  readonly orphanCleanupReceipts: readonly ResourceOrphanCleanupReceipt[];
  readonly cleanRerunMarkers: readonly CleanRerunRequiredMarker[];
  readonly cleanRerunRequired: boolean;
  acknowledgeCleanRerunRequirement(
    receipt: CleanRerunPassReceipt
  ): Promise<CleanRerunAcknowledgment | null>;
  release(): Promise<void>;
}

export interface AcquireResourceLeaseOptions {
  rootDirectory: string;
  resourceIds: readonly string[];
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export type ResourceLeaseBlockerState = "live_owner" | "remote_owner" | "unknown_owner";

export interface ResourceLeaseBlockedResult {
  status: "blocked";
  reason: "timeout" | "remote_owner" | "unknown_owner";
  resourceId: string;
  blockerState: ResourceLeaseBlockerState;
  owner: ResourceLeaseOwnerReceipt | null;
  waitedMs: number;
}

export interface ResourceLeaseAcquiredResult {
  status: "acquired";
  lease: ResourceLeaseHandle;
}

export type AcquireResourceLeaseResult = ResourceLeaseAcquiredResult | ResourceLeaseBlockedResult;

interface LeasePaths {
  leases: string;
  cleanupReceipts: string;
  cleanRerunMarkers: string;
  cleanRerunAcknowledgments: string;
  quarantine: string;
  recoveryGuards: string;
}

interface BlockerInspection {
  state: ResourceLeaseBlockerState;
  owner: ResourceLeaseOwnerReceipt | null;
  ownerBytes: string | null;
}

interface LocalHostIdentity {
  host: string;
  machineIdentity: string | null;
  bootIdentity: string | null;
}

interface SingleAcquireSuccess {
  status: "acquired";
  receipt: ResourceLeaseOwnerReceipt;
}

type SingleAcquireResult = SingleAcquireSuccess | { status: "blocked"; blocker: BlockerInspection };

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function isCanonicalInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isOwnerReceipt(value: unknown, resourceId: string): value is ResourceLeaseOwnerReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    exactKeys(record, [
      "schemaId",
      "resourceId",
      "leaseId",
      "host",
      "machineIdentity",
      "bootIdentity",
      "pid",
      "processStartIdentity",
      "acquiredAt",
    ]) &&
    record.schemaId === "vellum.resource-lease-owner.v1" &&
    record.resourceId === resourceId &&
    typeof record.leaseId === "string" &&
    record.leaseId.length > 0 &&
    typeof record.host === "string" &&
    record.host.length > 0 &&
    (record.machineIdentity === null ||
      (typeof record.machineIdentity === "string" && record.machineIdentity.length > 0)) &&
    (record.bootIdentity === null ||
      (typeof record.bootIdentity === "string" && record.bootIdentity.length > 0)) &&
    Number.isInteger(record.pid) &&
    (record.pid as number) > 0 &&
    (record.processStartIdentity === null ||
      (typeof record.processStartIdentity === "string" &&
        record.processStartIdentity.length > 0)) &&
    isCanonicalInstant(record.acquiredAt)
  );
}

function isCleanRerunMarker(value: unknown, resourceId: string): value is CleanRerunRequiredMarker {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    exactKeys(record, ["schemaId", "resourceId", "cleanupReceiptIds", "requiredSince"]) &&
    record.schemaId === "vellum.clean-rerun-required.v1" &&
    record.resourceId === resourceId &&
    Array.isArray(record.cleanupReceiptIds) &&
    record.cleanupReceiptIds.length > 0 &&
    new Set(record.cleanupReceiptIds).size === record.cleanupReceiptIds.length &&
    record.cleanupReceiptIds.every((id) => typeof id === "string" && id.length > 0) &&
    isCanonicalInstant(record.requiredSince)
  );
}

function isCleanupReceipt(
  value: unknown,
  receiptId: string,
  resourceId: string
): value is ResourceOrphanCleanupReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, [
      "schemaId",
      "receiptId",
      "resourceId",
      "removedOwner",
      "proof",
      "cleanedAt",
    ]) ||
    record.schemaId !== "vellum.resource-orphan-cleanup.v1" ||
    record.receiptId !== receiptId ||
    record.resourceId !== resourceId ||
    !isOwnerReceipt(record.removedOwner, resourceId) ||
    !isCanonicalInstant(record.cleanedAt) ||
    !record.proof ||
    typeof record.proof !== "object" ||
    Array.isArray(record.proof)
  ) {
    return false;
  }
  const proof = record.proof as Record<string, unknown>;
  return (
    exactKeys(proof, ["kind", "checkedHost", "checkedPid", "checkedAt"]) &&
    proof.kind === "same_host_pid_absent" &&
    proof.checkedHost === record.removedOwner.host &&
    proof.checkedPid === record.removedOwner.pid &&
    isCanonicalInstant(proof.checkedAt)
  );
}

function pathsFor(rootDirectory: string): LeasePaths {
  return {
    leases: join(rootDirectory, "leases"),
    cleanupReceipts: join(rootDirectory, "orphan-cleanup-receipts"),
    cleanRerunMarkers: join(rootDirectory, "clean-rerun-required"),
    cleanRerunAcknowledgments: join(rootDirectory, "clean-rerun-acknowledgments"),
    quarantine: join(rootDirectory, "orphan-quarantine"),
    recoveryGuards: join(rootDirectory, "recovery-guards"),
  };
}

function leaseDirectory(paths: LeasePaths, resourceId: string): string {
  return join(paths.leases, `${resourceId}.lease`);
}

function ownerReceiptPath(paths: LeasePaths, resourceId: string): string {
  return join(leaseDirectory(paths, resourceId), "owner.json");
}

function markerPath(paths: LeasePaths, resourceId: string): string {
  return join(paths.cleanRerunMarkers, `${resourceId}.json`);
}

function recoveryGuardPath(paths: LeasePaths, resourceId: string): string {
  return join(paths.recoveryGuards, `${resourceId}.recovery`);
}

async function recoveryGuardExists(paths: LeasePaths, resourceId: string): Promise<boolean> {
  try {
    await stat(recoveryGuardPath(paths, resourceId));
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

async function ensureDirectories(paths: LeasePaths): Promise<void> {
  await Promise.all(Object.values(paths).map((directory) => mkdir(directory, { recursive: true })));
}

function hashedIdentity(kind: string, value: string): string {
  return `${kind}:sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function machineIdentity(): string | null {
  if (process.platform === "linux") {
    try {
      const pidNamespace = readlinkSync("/proc/self/ns/pid");
      const machineId = (() => {
        try {
          return readFileSync("/etc/machine-id", "utf8").trim();
        } catch {
          return "machine-id-unavailable";
        }
      })();
      return pidNamespace
        ? hashedIdentity("linux-execution-domain", `${machineId}\0${pidNamespace}`)
        : null;
    } catch {
      return null;
    }
  }
  if (process.platform === "darwin") {
    const result = spawnSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 1_000,
    });
    if (result.status !== 0 || typeof result.stdout !== "string") return null;
    const value = result.stdout.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1];
    return value ? hashedIdentity("darwin-platform-uuid", value) : null;
  }
  return null;
}

function bootIdentity(): string | null {
  if (process.platform === "linux") {
    try {
      let value: string;
      try {
        value = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
      } catch {
        value = readFileSync("/proc/stat", "utf8").match(/^btime\s+(\d+)$/m)?.[1] ?? "";
      }
      return value ? hashedIdentity("linux-boot-id", value) : null;
    } catch {
      return null;
    }
  }
  if (process.platform === "darwin") {
    const result = spawnSync("/usr/sbin/sysctl", ["-n", "kern.boottime"], {
      encoding: "utf8",
      timeout: 1_000,
    });
    if (result.status !== 0 || typeof result.stdout !== "string") return null;
    const value = result.stdout.trim();
    return value ? hashedIdentity("darwin-boot-time", value) : null;
  }
  return null;
}

function currentHostIdentity(): LocalHostIdentity {
  return {
    host: hostname(),
    machineIdentity: machineIdentity(),
    bootIdentity: bootIdentity(),
  };
}

function processStartIdentity(pid: number): string | null {
  if (process.platform === "linux") {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const closingParenthesis = stat.lastIndexOf(")");
      if (closingParenthesis < 0) return null;
      const fields = stat
        .slice(closingParenthesis + 1)
        .trim()
        .split(/\s+/);
      const startTicks = fields[19];
      return startTicks ? `linux-proc-start-ticks:${startTicks}` : null;
    } catch {
      return null;
    }
  }
  if (process.platform === "darwin") {
    try {
      const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart="], {
        encoding: "utf8",
        timeout: 1_000,
      });
      if (result.status !== 0 || typeof result.stdout !== "string") return null;
      const started = result.stdout.trim().replace(/\s+/g, " ");
      return started ? `darwin-ps-lstart:${started}` : null;
    } catch {
      return null;
    }
  }
  return null;
}

function pidState(pid: number): "present" | "absent" | "unknown" {
  try {
    process.kill(pid, 0);
    return "present";
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") return "absent";
    return "unknown";
  }
}

async function inspectBlocker(
  paths: LeasePaths,
  resourceId: string,
  local: LocalHostIdentity
): Promise<BlockerInspection> {
  let ownerBytes: string;
  try {
    ownerBytes = await readFile(ownerReceiptPath(paths, resourceId), "utf8");
  } catch {
    return { state: "unknown_owner", owner: null, ownerBytes: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(ownerBytes);
  } catch {
    return { state: "unknown_owner", owner: null, ownerBytes };
  }
  if (!isOwnerReceipt(parsed, resourceId)) {
    return { state: "unknown_owner", owner: null, ownerBytes };
  }
  if (parsed.host !== local.host) {
    return { state: "remote_owner", owner: parsed, ownerBytes };
  }
  if (
    local.machineIdentity === null ||
    local.bootIdentity === null ||
    parsed.machineIdentity === null ||
    parsed.bootIdentity === null
  ) {
    return { state: "unknown_owner", owner: parsed, ownerBytes };
  }
  if (
    parsed.machineIdentity !== local.machineIdentity ||
    parsed.bootIdentity !== local.bootIdentity
  ) {
    return { state: "remote_owner", owner: parsed, ownerBytes };
  }
  const state = pidState(parsed.pid);
  if (state !== "present") {
    return {
      state: state === "absent" ? "live_owner" : "unknown_owner",
      owner: parsed,
      ownerBytes,
    };
  }
  const observedStart = processStartIdentity(parsed.pid);
  if (
    parsed.processStartIdentity !== null &&
    observedStart !== null &&
    parsed.processStartIdentity !== observedStart
  ) {
    return { state: "unknown_owner", owner: parsed, ownerBytes };
  }
  return { state: "live_owner", owner: parsed, ownerBytes };
}

async function writeCanonicalExclusive(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${canonicalJson(value)}\n`, { encoding: "utf8", flag: "wx" });
}

async function writeMarker(
  paths: LeasePaths,
  cleanupReceipt: ResourceOrphanCleanupReceipt
): Promise<void> {
  const path = markerPath(paths, cleanupReceipt.resourceId);
  let existing: CleanRerunRequiredMarker | null = null;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!isCleanRerunMarker(parsed, cleanupReceipt.resourceId)) {
      throw new Error(`Invalid clean-rerun marker for ${cleanupReceipt.resourceId}`);
    }
    existing = parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      existing = null;
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid clean-rerun marker for ${cleanupReceipt.resourceId}`);
    } else {
      throw error;
    }
  }
  const marker: CleanRerunRequiredMarker = {
    schemaId: "vellum.clean-rerun-required.v1",
    resourceId: cleanupReceipt.resourceId,
    cleanupReceiptIds: [
      ...new Set([...(existing?.cleanupReceiptIds ?? []), cleanupReceipt.receiptId]),
    ].sort(),
    requiredSince: existing?.requiredSince ?? cleanupReceipt.cleanedAt,
  };
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${canonicalJson(marker)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}

async function recoverAbsentOwner(
  paths: LeasePaths,
  resourceId: string,
  inspection: BlockerInspection,
  local: LocalHostIdentity
): Promise<ResourceOrphanCleanupReceipt | null> {
  if (
    !inspection.owner ||
    inspection.owner.host !== local.host ||
    inspection.owner.machineIdentity !== local.machineIdentity ||
    inspection.owner.bootIdentity !== local.bootIdentity ||
    local.machineIdentity === null ||
    local.bootIdentity === null ||
    pidState(inspection.owner.pid) !== "absent"
  ) {
    return null;
  }

  const checkedAt = new Date().toISOString();
  const receiptId = `cleanup-${randomUUID()}`;
  const quarantine = join(paths.quarantine, `${resourceId}.${receiptId}.lease`);
  const guard = recoveryGuardPath(paths, resourceId);
  try {
    await mkdir(guard);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") return null;
    throw error;
  }
  let canonicalLeaseQuarantined = false;
  let completed = false;
  try {
    await writeCanonicalExclusive(join(guard, "owner.json"), {
      schemaId: "vellum.resource-recovery-guard.v1",
      resourceId,
      receiptId,
      host: local.host,
      machineIdentity: local.machineIdentity,
      bootIdentity: local.bootIdentity,
      pid: process.pid,
      createdAt: checkedAt,
    });
    const freshInspection = await inspectBlocker(paths, resourceId, local);
    if (
      freshInspection.ownerBytes !== inspection.ownerBytes ||
      !freshInspection.owner ||
      pidState(freshInspection.owner.pid) !== "absent"
    ) {
      return null;
    }
    try {
      await rename(leaseDirectory(paths, resourceId), quarantine);
      canonicalLeaseQuarantined = true;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return null;
      throw error;
    }

    const quarantinedOwnerBytes = await readFile(join(quarantine, "owner.json"), "utf8").catch(
      () => null
    );
    if (quarantinedOwnerBytes !== inspection.ownerBytes) {
      await rename(quarantine, leaseDirectory(paths, resourceId));
      canonicalLeaseQuarantined = false;
      throw new Error(`Resource ${resourceId} changed owner during orphan cleanup`);
    }

    const receipt: ResourceOrphanCleanupReceipt = {
      schemaId: "vellum.resource-orphan-cleanup.v1",
      receiptId,
      resourceId,
      removedOwner: inspection.owner,
      proof: {
        kind: "same_host_pid_absent",
        checkedHost: local.host,
        checkedPid: inspection.owner.pid,
        checkedAt,
      },
      cleanedAt: checkedAt,
    };
    await writeCanonicalExclusive(join(paths.cleanupReceipts, `${receiptId}.json`), receipt);
    await writeMarker(paths, receipt);
    await rm(quarantine, { recursive: true, force: false });
    completed = true;
    return receipt;
  } finally {
    if (!canonicalLeaseQuarantined || completed) {
      await rm(guard, { recursive: true, force: true });
    }
  }
}

async function acquireSingle(
  paths: LeasePaths,
  resourceId: string,
  owner: ResourceLeaseOwnerIdentity
): Promise<SingleAcquireResult> {
  const directory = leaseDirectory(paths, resourceId);
  if (await recoveryGuardExists(paths, resourceId)) {
    return {
      status: "blocked",
      blocker: { state: "unknown_owner", owner: null, ownerBytes: null },
    };
  }
  try {
    await mkdir(directory);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") throw error;
    const local = {
      host: owner.host,
      machineIdentity: owner.machineIdentity,
      bootIdentity: owner.bootIdentity,
    };
    const inspection = await inspectBlocker(paths, resourceId, local);
    if (
      inspection.state === "live_owner" &&
      inspection.owner &&
      inspection.owner.host === owner.host &&
      pidState(inspection.owner.pid) === "absent"
    ) {
      const cleanupReceipt = await recoverAbsentOwner(paths, resourceId, inspection, local);
      if (cleanupReceipt) {
        return acquireSingle(paths, resourceId, owner);
      }
    }
    return { status: "blocked", blocker: inspection };
  }

  if (await recoveryGuardExists(paths, resourceId)) {
    await rm(directory, { recursive: true, force: true });
    return {
      status: "blocked",
      blocker: { state: "unknown_owner", owner: null, ownerBytes: null },
    };
  }

  const receipt: ResourceLeaseOwnerReceipt = {
    schemaId: "vellum.resource-lease-owner.v1",
    resourceId,
    ...owner,
  };
  try {
    await writeCanonicalExclusive(ownerReceiptPath(paths, resourceId), receipt);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return { status: "acquired", receipt };
}

async function readCleanRerunState(
  paths: LeasePaths,
  resourceIds: readonly string[]
): Promise<{
  markers: CleanRerunRequiredMarker[];
  cleanupReceipts: ResourceOrphanCleanupReceipt[];
}> {
  const markers: CleanRerunRequiredMarker[] = [];
  const cleanupReceipts = new Map<string, ResourceOrphanCleanupReceipt>();
  for (const resourceId of resourceIds) {
    let raw: string;
    try {
      raw = await readFile(markerPath(paths, resourceId), "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") continue;
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid clean-rerun marker for ${resourceId}`);
    }
    if (!isCleanRerunMarker(parsed, resourceId)) {
      throw new Error(`Invalid clean-rerun marker for ${resourceId}`);
    }
    for (const receiptId of parsed.cleanupReceiptIds) {
      let receipt: unknown;
      try {
        receipt = JSON.parse(
          await readFile(join(paths.cleanupReceipts, `${receiptId}.json`), "utf8")
        ) as unknown;
      } catch {
        throw new Error(`Clean-rerun marker for ${resourceId} lacks cleanup receipt ${receiptId}`);
      }
      if (!isCleanupReceipt(receipt, receiptId, resourceId)) {
        throw new Error(
          `Clean-rerun marker for ${resourceId} has invalid cleanup receipt ${receiptId}`
        );
      }
      cleanupReceipts.set(receiptId, receipt);
    }
    markers.push(parsed);
  }
  return { markers, cleanupReceipts: [...cleanupReceipts.values()] };
}

async function releaseReceipts(
  paths: LeasePaths,
  receipts: readonly ResourceLeaseOwnerReceipt[]
): Promise<void> {
  const failures: unknown[] = [];
  for (const receipt of [...receipts].reverse()) {
    try {
      const raw = await readFile(ownerReceiptPath(paths, receipt.resourceId), "utf8");
      const current = JSON.parse(raw) as unknown;
      if (!isOwnerReceipt(current, receipt.resourceId) || current.leaseId !== receipt.leaseId) {
        throw new Error(`Resource ${receipt.resourceId} is no longer owned by this lease`);
      }
      await rm(leaseDirectory(paths, receipt.resourceId), { recursive: true, force: false });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "Failed to release resource lease");
}

function validateCleanRerunPassReceipt(
  value: CleanRerunPassReceipt,
  owner: Readonly<ResourceLeaseOwnerIdentity>,
  markers: readonly CleanRerunRequiredMarker[]
): CleanRerunPassReceipt {
  const record = value as unknown as Record<string, unknown>;
  const expectedCleanupReceiptIds = [
    ...new Set(markers.flatMap((marker) => marker.cleanupReceiptIds)),
  ].sort();
  if (
    !exactKeys(record, [
      "schemaId",
      "runId",
      "leaseId",
      "cleanupReceiptIds",
      "startedAt",
      "finishedAt",
      "outcome",
      "commandDigest",
      "profileDigest",
      "reportDigest",
    ]) ||
    value.schemaId !== "vellum.clean-rerun-pass.v1" ||
    !RESOURCE_ID.test(value.runId) ||
    value.leaseId !== owner.leaseId ||
    !Array.isArray(value.cleanupReceiptIds) ||
    JSON.stringify([...value.cleanupReceiptIds].sort()) !==
      JSON.stringify(expectedCleanupReceiptIds) ||
    !isCanonicalInstant(value.startedAt) ||
    !isCanonicalInstant(value.finishedAt) ||
    Date.parse(value.startedAt) < Date.parse(owner.acquiredAt) ||
    markers.some((marker) => Date.parse(value.startedAt) < Date.parse(marker.requiredSince)) ||
    Date.parse(value.finishedAt) < Date.parse(value.startedAt) ||
    value.outcome !== "pass" ||
    !SHA256.test(value.commandDigest) ||
    !SHA256.test(value.profileDigest) ||
    !SHA256.test(value.reportDigest)
  ) {
    throw new Error("Clean-rerun pass receipt is invalid or does not bind this lease and cleanup");
  }
  return deepFreeze(structuredClone(value));
}

class FileResourceLease implements ResourceLeaseHandle {
  readonly resourceIds: readonly string[];
  readonly owner: Readonly<ResourceLeaseOwnerIdentity>;
  readonly ownerReceipts: readonly ResourceLeaseOwnerReceipt[];
  readonly orphanCleanupReceipts: readonly ResourceOrphanCleanupReceipt[];
  #markers: readonly CleanRerunRequiredMarker[];
  #released = false;

  constructor(
    private readonly paths: LeasePaths,
    resourceIds: string[],
    owner: ResourceLeaseOwnerIdentity,
    ownerReceipts: ResourceLeaseOwnerReceipt[],
    orphanCleanupReceipts: ResourceOrphanCleanupReceipt[],
    markers: CleanRerunRequiredMarker[]
  ) {
    this.resourceIds = Object.freeze([...resourceIds]);
    this.owner = deepFreeze({ ...owner });
    this.ownerReceipts = deepFreeze(structuredClone(ownerReceipts));
    this.orphanCleanupReceipts = deepFreeze(structuredClone(orphanCleanupReceipts));
    this.#markers = deepFreeze(structuredClone(markers));
  }

  get cleanRerunMarkers(): readonly CleanRerunRequiredMarker[] {
    return this.#markers;
  }

  get cleanRerunRequired(): boolean {
    return this.#markers.length > 0;
  }

  async acknowledgeCleanRerunRequirement(
    receipt: CleanRerunPassReceipt
  ): Promise<CleanRerunAcknowledgment | null> {
    if (this.#released) throw new Error("Cannot acknowledge a released resource lease");
    if (!this.#markers.length) return null;
    const validatedReceipt = validateCleanRerunPassReceipt(receipt, this.owner, this.#markers);
    const acknowledgment: CleanRerunAcknowledgment = {
      schemaId: "vellum.clean-rerun-acknowledgment.v1",
      acknowledgmentId: `rerun-ack-${randomUUID()}`,
      leaseId: this.owner.leaseId,
      resourceIds: [...this.resourceIds],
      cleanupReceiptIds: [
        ...new Set(this.#markers.flatMap((marker) => marker.cleanupReceiptIds)),
      ].sort(),
      cleanRerunReceipt: validatedReceipt,
      acknowledgedAt: new Date().toISOString(),
    };
    const guards: string[] = [];
    const claims = join(
      this.paths.cleanRerunAcknowledgments,
      `${acknowledgment.acknowledgmentId}.claims`
    );
    let claimedMarker = false;
    try {
      for (const resourceId of this.resourceIds) {
        const guard = recoveryGuardPath(this.paths, resourceId);
        await mkdir(guard);
        guards.push(guard);
        await writeCanonicalExclusive(join(guard, "owner.json"), {
          schemaId: "vellum.clean-rerun-acknowledgment-guard.v1",
          acknowledgmentId: acknowledgment.acknowledgmentId,
          resourceId,
          leaseId: this.owner.leaseId,
          createdAt: acknowledgment.acknowledgedAt,
        });
      }
      await mkdir(claims);
      for (const marker of this.#markers) {
        const claimedPath = join(claims, `${marker.resourceId}.json`);
        await rename(markerPath(this.paths, marker.resourceId), claimedPath);
        claimedMarker = true;
        const claimedBytes = await readFile(claimedPath, "utf8");
        if (claimedBytes !== `${canonicalJson(marker)}\n`) {
          throw new Error(`Clean-rerun marker changed for ${marker.resourceId}`);
        }
      }
      await writeCanonicalExclusive(
        join(this.paths.cleanRerunAcknowledgments, `${acknowledgment.acknowledgmentId}.json`),
        acknowledgment
      );
      await rm(claims, { recursive: true, force: false });
      this.#markers = Object.freeze([]);
      for (const guard of guards.reverse()) {
        await rm(guard, { recursive: true, force: false });
      }
      return deepFreeze(acknowledgment);
    } catch (error) {
      if (!claimedMarker) {
        await rm(claims, { recursive: true, force: true });
        await Promise.all(guards.map((guard) => rm(guard, { recursive: true, force: true })));
      }
      throw error;
    }
  }

  async release(): Promise<void> {
    if (this.#released) return;
    await releaseReceipts(this.paths, this.ownerReceipts);
    this.#released = true;
  }
}

function validateOptions(options: AcquireResourceLeaseOptions): {
  resourceIds: string[];
  timeoutMs: number;
  pollIntervalMs: number;
} {
  if (!options.rootDirectory) throw new Error("Resource lease rootDirectory is required");
  if (!options.resourceIds.length) throw new Error("At least one resource ID is required");
  if (new Set(options.resourceIds).size !== options.resourceIds.length) {
    throw new Error("Resource IDs must be unique");
  }
  for (const resourceId of options.resourceIds) {
    if (!RESOURCE_ID.test(resourceId)) throw new Error(`Invalid resource ID: ${resourceId}`);
  }
  const timeoutMs = options.timeoutMs ?? 0;
  const pollIntervalMs = options.pollIntervalMs ?? 25;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    throw new Error("timeoutMs must be a nonnegative integer");
  }
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1) {
    throw new Error("pollIntervalMs must be a positive integer");
  }
  return { resourceIds: [...options.resourceIds].sort(), timeoutMs, pollIntervalMs };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquireResourceLease(
  options: AcquireResourceLeaseOptions
): Promise<AcquireResourceLeaseResult> {
  const { resourceIds, timeoutMs, pollIntervalMs } = validateOptions(options);
  const paths = pathsFor(options.rootDirectory);
  await ensureDirectories(paths);
  const startedAt = Date.now();
  const local = currentHostIdentity();
  const owner: ResourceLeaseOwnerIdentity = {
    leaseId: randomUUID(),
    ...local,
    pid: process.pid,
    processStartIdentity: processStartIdentity(process.pid),
    acquiredAt: new Date().toISOString(),
  };

  while (true) {
    const receipts: ResourceLeaseOwnerReceipt[] = [];
    let blocked: { resourceId: string; blocker: BlockerInspection } | null = null;
    try {
      for (const resourceId of resourceIds) {
        const result = await acquireSingle(paths, resourceId, owner);
        if (result.status === "blocked") {
          blocked = { resourceId, blocker: result.blocker };
          break;
        }
        receipts.push(result.receipt);
      }
    } catch (error) {
      try {
        await releaseReceipts(paths, receipts);
      } catch (releaseError) {
        throw new AggregateError(
          [error, releaseError],
          "Resource acquisition failed and partial leases could not be released"
        );
      }
      throw error;
    }
    if (!blocked) {
      let cleanRerunState: Awaited<ReturnType<typeof readCleanRerunState>>;
      try {
        cleanRerunState = await readCleanRerunState(paths, resourceIds);
      } catch (error) {
        await releaseReceipts(paths, receipts);
        throw error;
      }
      return {
        status: "acquired",
        lease: new FileResourceLease(
          paths,
          resourceIds,
          owner,
          receipts,
          cleanRerunState.cleanupReceipts,
          cleanRerunState.markers
        ),
      };
    }

    await releaseReceipts(paths, receipts);
    const waitedMs = Date.now() - startedAt;
    if (blocked.blocker.state === "remote_owner") {
      return {
        status: "blocked",
        reason: "remote_owner",
        resourceId: blocked.resourceId,
        blockerState: blocked.blocker.state,
        owner: blocked.blocker.owner,
        waitedMs,
      };
    }
    if (blocked.blocker.state === "unknown_owner") {
      return {
        status: "blocked",
        reason: "unknown_owner",
        resourceId: blocked.resourceId,
        blockerState: blocked.blocker.state,
        owner: blocked.blocker.owner,
        waitedMs,
      };
    }
    if (waitedMs >= timeoutMs) {
      return {
        status: "blocked",
        reason: "timeout",
        resourceId: blocked.resourceId,
        blockerState: blocked.blocker.state,
        owner: blocked.blocker.owner,
        waitedMs,
      };
    }
    await wait(Math.min(pollIntervalMs, timeoutMs - waitedMs));
  }
}
