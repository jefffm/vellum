import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  type Dirent,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  opendirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { canonicalReferenceJson } from "../../lib/reference-source-domain.js";
import type {
  OwnerReferenceMigrationQuarantineAction,
  OwnerReferenceMigrationQuarantineReason,
} from "../../lib/owner-reference-migration.js";
import type { OwnerReference } from "../../lib/owner-domain.js";
import { OwnerReferenceWriteClaim } from "./owner-reference-claim.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type LegacyOwnerReferenceReadFailure = {
  reason: OwnerReferenceMigrationQuarantineReason;
  action: OwnerReferenceMigrationQuarantineAction;
  declaredSha256: string | null;
  observedSha256: string | null;
  declaredByteLength: number | null;
  observedByteLength: number | null;
};

export type LegacyOwnerReferenceObservation = {
  /** Safe opaque key used by migration records and public compatibility views. */
  legacyId: string;
  /** Exact private legacy identifier, retained even when it is not schema-safe. */
  rawLegacyId: string;
  rawRecordSha256: string | null;
  rawRecordByteLength: number | null;
  rawRecordBytes: Buffer | null;
  reference: OwnerReference | null;
  content: Buffer | null;
  failure: LegacyOwnerReferenceReadFailure | null;
};

export type LegacyOwnerReferenceInventory = {
  schemaVersion: 1;
  manifestSha256: string;
  inventoryDigest: string;
  observations: LegacyOwnerReferenceObservation[];
};

export type LegacyOwnerReferenceSource = {
  capture(): LegacyOwnerReferenceInventory;
  withStableInventory<T>(operation: (inventory: LegacyOwnerReferenceInventory) => T): T;
};

export type OwnerReferenceLegacyReaderFault =
  | { point: "before_legacy_file_open"; path: string; label: string }
  | { point: "before_legacy_references_enumeration"; path: string };

/**
 * Exact, read-only compatibility reader for the pre-identity-graph Owner store.
 *
 * It fingerprints the bytes actually on disk, rejects symlinks/path escapes,
 * and never normalizes a record before computing its immutable legacy digest.
 */
export class OwnerReferenceLegacyReader implements LegacyOwnerReferenceSource {
  readonly rootDirectory: string;
  private readonly writeClaim: OwnerReferenceWriteClaim;
  private readonly faultInjector?: (fault: OwnerReferenceLegacyReaderFault) => void;

  constructor(
    options: {
      rootDirectory?: string;
      /** Deterministic pre-open path-race seam; production never supplies it. */
      faultInjector?: (fault: OwnerReferenceLegacyReaderFault) => void;
    } = {}
  ) {
    this.rootDirectory =
      options.rootDirectory ?? path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner");
    this.writeClaim = new OwnerReferenceWriteClaim({ rootDirectory: this.rootDirectory });
    this.faultInjector = options.faultInjector;
  }

  withStableInventory<T>(operation: (inventory: LegacyOwnerReferenceInventory) => T): T {
    return this.writeClaim.withClaim(() => operation(this.capture()));
  }

  capture(): LegacyOwnerReferenceInventory {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const manifestPath = path.join(this.rootDirectory, "manifest.json");
    const manifestBytes = stableContainedRead(
      this.rootDirectory,
      manifestPath,
      "legacy manifest",
      this.beforeFileOpen
    );
    const manifestSha256 = sha256(manifestBytes);
    const manifest = parseManifest(manifestBytes);
    const duplicateIds = duplicateValues(manifest.referenceIds);
    const observations: LegacyOwnerReferenceObservation[] = [];

    for (const legacyId of [...new Set(manifest.referenceIds)].sort()) {
      if (!SAFE_ID.test(legacyId)) {
        observations.push(
          failedObservation(
            `invalid-manifest-id.${sha256(legacyId).slice(0, 32)}`,
            "invalid_legacy_record",
            "review_legacy_record",
            { rawLegacyId: legacyId }
          )
        );
        continue;
      }
      if (duplicateIds.has(legacyId)) {
        observations.push(
          withForcedFailure(
            this.captureRecord(legacyId),
            "legacy_id_collision",
            "resolve_legacy_id_collision"
          )
        );
        continue;
      }
      observations.push(this.captureRecord(legacyId));
    }

    const referencesDirectory = path.join(this.rootDirectory, "references");
    if (existsSync(referencesDirectory)) {
      const listed = new Set(manifest.referenceIds);
      for (const entry of stableContainedDirectoryEntries(
        this.rootDirectory,
        referencesDirectory,
        "legacy references",
        () =>
          this.faultInjector?.({
            point: "before_legacy_references_enumeration",
            path: referencesDirectory,
          })
      )) {
        if (!entry.name.endsWith(".json")) continue;
        const legacyId = entry.name.slice(0, -5);
        if (listed.has(legacyId)) continue;
        if (SAFE_ID.test(legacyId)) {
          observations.push(
            withForcedFailure(
              this.captureRecord(legacyId),
              "invalid_legacy_record",
              "review_legacy_record"
            )
          );
          continue;
        }
        // `readdirSync` supplied this exact basename, so it cannot traverse
        // outside `references/`. Capture the contained legacy bytes before
        // replacing the schema-unsafe identifier with an opaque public key.
        // Arbitrary invalid IDs from the manifest do not receive this path:
        // they remain evidence-free rather than being interpreted as paths.
        const opaqueLegacyId = `invalid-record.${sha256(entry.name).slice(0, 24)}`;
        observations.push(
          remapUnsafeLegacyId(
            withForcedFailure(
              this.captureRecord(legacyId),
              "invalid_legacy_record",
              "review_legacy_record"
            ),
            opaqueLegacyId,
            legacyId
          )
        );
      }
    }

    observations.sort((left, right) => left.legacyId.localeCompare(right.legacyId));
    const finalManifestBytes = stableContainedRead(
      this.rootDirectory,
      manifestPath,
      "legacy manifest",
      this.beforeFileOpen
    );
    if (!finalManifestBytes.equals(manifestBytes)) {
      throw new OwnerReferenceLegacyReadError(
        "Legacy Owner manifest changed during inventory capture",
        "unstable_legacy_bytes"
      );
    }
    const inventoryDigest = sha256(
      canonicalReferenceJson({
        schemaVersion: 1,
        manifestSha256,
        observations: observations.map(inventoryObservationDigestView),
      })
    );
    return { schemaVersion: 1, manifestSha256, inventoryDigest, observations };
  }

  private captureRecord(legacyId: string): LegacyOwnerReferenceObservation {
    const recordPath = path.join(this.rootDirectory, "references", `${legacyId}.json`);
    let recordBytes: Buffer;
    try {
      recordBytes = stableContainedRead(
        this.rootDirectory,
        recordPath,
        "legacy record",
        this.beforeFileOpen
      );
    } catch (error) {
      return failedObservation(legacyId, classifyReadFailure(error), actionForReadFailure(error));
    }
    const rawRecordSha256 = sha256(recordBytes);
    const rawRecordByteLength = recordBytes.byteLength;
    let parsed: unknown;
    try {
      parsed = JSON.parse(recordBytes.toString("utf8"));
    } catch {
      return failedObservation(legacyId, "invalid_legacy_record", "review_legacy_record", {
        rawRecordSha256,
        rawRecordByteLength,
        rawRecordBytes: recordBytes,
      });
    }
    const reference = decodeLegacyRecord(parsed, legacyId);
    if (!reference) {
      return failedObservation(legacyId, "invalid_legacy_record", "review_legacy_record", {
        rawRecordSha256,
        rawRecordByteLength,
        rawRecordBytes: recordBytes,
      });
    }
    const expectedStoredPath = path.join("references", legacyId, "content");
    if (path.normalize(reference.storedPath) !== expectedStoredPath) {
      return failedObservation(legacyId, "unsafe_legacy_path", "repair_legacy_storage_boundary", {
        rawRecordSha256,
        rawRecordByteLength,
        rawRecordBytes: recordBytes,
        reference,
      });
    }
    const contentPath = path.join(this.rootDirectory, expectedStoredPath);
    let content: Buffer;
    try {
      content = stableContainedRead(
        this.rootDirectory,
        contentPath,
        "legacy content",
        this.beforeFileOpen
      );
    } catch (error) {
      return failedObservation(legacyId, classifyReadFailure(error), actionForReadFailure(error), {
        rawRecordSha256,
        rawRecordByteLength,
        rawRecordBytes: recordBytes,
        reference,
      });
    }
    const observedSha256 = sha256(content);
    if (observedSha256 !== reference.sha256) {
      return failedObservation(legacyId, "hash_mismatch", "restore_exact_legacy_bytes", {
        rawRecordSha256,
        rawRecordByteLength,
        reference,
        rawRecordBytes: recordBytes,
        content,
        observedSha256,
        observedByteLength: content.byteLength,
      });
    }
    if (reference.byteLength !== undefined && reference.byteLength !== content.byteLength) {
      return failedObservation(legacyId, "length_mismatch", "restore_exact_legacy_bytes", {
        rawRecordSha256,
        rawRecordByteLength,
        reference,
        rawRecordBytes: recordBytes,
        content,
        observedSha256,
        observedByteLength: content.byteLength,
      });
    }
    return {
      legacyId,
      rawLegacyId: legacyId,
      rawRecordSha256,
      rawRecordByteLength,
      rawRecordBytes: recordBytes,
      reference,
      content,
      failure: null,
    };
  }

  private readonly beforeFileOpen = (file: string, label: string): void => {
    this.faultInjector?.({ point: "before_legacy_file_open", path: file, label });
  };
}

function remapUnsafeLegacyId(
  observation: LegacyOwnerReferenceObservation,
  legacyId: string,
  rawLegacyId: string
): LegacyOwnerReferenceObservation {
  return { ...observation, legacyId, rawLegacyId };
}

function parseManifest(bytes: Buffer): { referenceIds: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new OwnerReferenceLegacyReadError(
      "Legacy Owner manifest is not valid JSON",
      "invalid_legacy_record"
    );
  }
  if (!isPlainObject(value) || !Array.isArray(value.referenceIds)) {
    throw new OwnerReferenceLegacyReadError(
      "Legacy Owner manifest has no reference ID inventory",
      "invalid_legacy_record"
    );
  }
  if (!value.referenceIds.every((item) => typeof item === "string")) {
    throw new OwnerReferenceLegacyReadError(
      "Legacy Owner manifest reference inventory is malformed",
      "invalid_legacy_record"
    );
  }
  return { referenceIds: [...value.referenceIds] };
}

function decodeLegacyRecord(value: unknown, expectedId: string): OwnerReference | null {
  if (!isPlainObject(value)) return null;
  const byteLength = value.byteLength;
  if (
    value.id !== expectedId ||
    typeof value.title !== "string" ||
    value.title.length === 0 ||
    typeof value.citation !== "string" ||
    value.citation.length === 0 ||
    typeof value.mimeType !== "string" ||
    value.mimeType.length === 0 ||
    typeof value.sha256 !== "string" ||
    !SHA256.test(value.sha256) ||
    !(byteLength === undefined || (Number.isSafeInteger(byteLength) && Number(byteLength) > 0)) ||
    typeof value.storedPath !== "string" ||
    value.storedPath.length === 0 ||
    typeof value.createdAt !== "string" ||
    !ISO_TIMESTAMP.test(value.createdAt)
  ) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    citation: value.citation,
    mimeType: value.mimeType,
    sha256: value.sha256,
    ...(byteLength === undefined ? {} : { byteLength: Number(byteLength) }),
    storedPath: value.storedPath,
    authorityState: "raw_staged",
    activationAllowed: false,
    createdAt: value.createdAt,
  };
}

function stableContainedRead(
  root: string,
  file: string,
  label: string,
  beforeOpen?: (file: string, label: string) => void
): Buffer {
  assertContainedPath(root, file, label);
  const ancestorIdentities = containedAncestorIdentities(root, file, label);
  beforeOpen?.(file, label);
  const noFollow = "O_NOFOLLOW" in fsConstants ? fsConstants.O_NOFOLLOW : 0;
  let descriptor: number;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    throw normalizeReadError(error, label);
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile()) {
      throw new OwnerReferenceLegacyReadError(
        `${label} is not a regular file`,
        "unsafe_legacy_path"
      );
    }
    assertOwnedPrivateEntry(before, label);
    assertContainedPath(root, file, label);
    assertContainedAncestorsUnchanged(ancestorIdentities, root, file, label);
    const openedPath = lstatSync(file, { bigint: true });
    assertOwnedPrivateEntry(openedPath, label);
    if (
      !openedPath.isFile() ||
      openedPath.isSymbolicLink() ||
      before.dev !== openedPath.dev ||
      before.ino !== openedPath.ino
    ) {
      throw new OwnerReferenceLegacyReadError(
        `${label} path changed before its descriptor could be read`,
        "unstable_legacy_bytes"
      );
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    // Re-resolve containment and every ancestor after the descriptor read. If
    // a parent was swapped to a symlink or another directory during open, the
    // descriptor/file identity or this ancestor comparison fails closed.
    assertContainedPath(root, file, label);
    assertContainedAncestorsUnchanged(ancestorIdentities, root, file, label);
    const finalPath = lstatSync(file, { bigint: true });
    assertOwnedPrivateEntry(after, label);
    assertOwnedPrivateEntry(finalPath, label);
    if (
      !after.isFile() ||
      !finalPath.isFile() ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      after.dev !== finalPath.dev ||
      after.ino !== finalPath.ino ||
      after.size !== finalPath.size
    ) {
      throw new OwnerReferenceLegacyReadError(
        `${label} changed while it was being read`,
        "unstable_legacy_bytes"
      );
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function stableContainedDirectoryEntries(
  root: string,
  directory: string,
  label: string,
  beforeOpen?: () => void
): Dirent[] {
  assertContainedPath(root, directory, label);
  const sentinel = path.join(directory, ".vellum-directory-identity");
  const ancestorIdentities = containedAncestorIdentities(root, sentinel, label);
  beforeOpen?.();
  let handle;
  try {
    handle = opendirSync(directory);
  } catch (error) {
    throw normalizeReadError(error, label);
  }
  try {
    assertContainedPath(root, directory, label);
    assertContainedAncestorsUnchanged(ancestorIdentities, root, sentinel, label);
    const before = lstatSync(directory, { bigint: true });
    if (!before.isDirectory() || before.isSymbolicLink()) {
      throw new OwnerReferenceLegacyReadError(
        `${label} is not a real directory`,
        "unsafe_legacy_path"
      );
    }
    assertOwnedPrivateEntry(before, label);
    const entries: Dirent[] = [];
    for (let entry = handle.readSync(); entry !== null; entry = handle.readSync()) {
      entries.push(entry);
    }
    assertContainedPath(root, directory, label);
    assertContainedAncestorsUnchanged(ancestorIdentities, root, sentinel, label);
    const after = lstatSync(directory, { bigint: true });
    assertOwnedPrivateEntry(after, label);
    if (
      !after.isDirectory() ||
      after.isSymbolicLink() ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      throw new OwnerReferenceLegacyReadError(
        `${label} changed during directory enumeration`,
        "unstable_legacy_bytes"
      );
    }
    return entries;
  } finally {
    handle.closeSync();
  }
}

type ContainedAncestorIdentity = { path: string; dev: bigint; ino: bigint };

function containedAncestorIdentities(
  root: string,
  target: string,
  label: string
): ContainedAncestorIdentity[] {
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(target);
  const directories = [absoluteRoot];
  let cursor = absoluteRoot;
  for (const component of path
    .relative(absoluteRoot, path.dirname(absoluteTarget))
    .split(path.sep)
    .filter(Boolean)) {
    cursor = path.join(cursor, component);
    directories.push(cursor);
  }
  return directories.map((directory) => {
    let stat;
    try {
      stat = lstatSync(directory, { bigint: true });
    } catch (error) {
      throw normalizeReadError(error, label);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new OwnerReferenceLegacyReadError(
        `${label} traverses a non-directory or symlink ancestor`,
        "unsafe_legacy_path"
      );
    }
    assertOwnedPrivateEntry(stat, label);
    return { path: directory, dev: stat.dev, ino: stat.ino };
  });
}

function assertContainedAncestorsUnchanged(
  before: ContainedAncestorIdentity[],
  root: string,
  target: string,
  label: string
): void {
  const after = containedAncestorIdentities(root, target, label);
  if (
    before.length !== after.length ||
    before.some(
      (identity, index) =>
        identity.path !== after[index]?.path ||
        identity.dev !== after[index]?.dev ||
        identity.ino !== after[index]?.ino
    )
  ) {
    throw new OwnerReferenceLegacyReadError(
      `${label} ancestor changed while it was being read`,
      "unstable_legacy_bytes"
    );
  }
}

function assertContainedPath(root: string, target: string, label: string): void {
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(target);
  if (absoluteTarget !== absoluteRoot && !absoluteTarget.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new OwnerReferenceLegacyReadError(
      `${label} escapes the Owner root`,
      "unsafe_legacy_path"
    );
  }
  let cursor = absoluteRoot;
  const relative = path.relative(absoluteRoot, absoluteTarget);
  for (const component of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    if (!existsSync(cursor)) continue;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new OwnerReferenceLegacyReadError(`${label} traverses a symlink`, "unsafe_legacy_path");
    }
  }
  if (existsSync(absoluteRoot) && existsSync(absoluteTarget)) {
    const realRoot = realpathSync(absoluteRoot);
    const realTarget = realpathSync(absoluteTarget);
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
      throw new OwnerReferenceLegacyReadError(
        `${label} escapes the Owner root`,
        "unsafe_legacy_path"
      );
    }
  }
}

function assertOwnedPrivateEntry(
  stat: { uid: number | bigint; mode: number | bigint },
  label: string
): void {
  const effectiveUid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (effectiveUid === null) {
    throw new OwnerReferenceLegacyReadError(
      `${label} ownership cannot be verified on this host`,
      "unsafe_legacy_path"
    );
  }
  const owned =
    typeof stat.uid === "bigint" ? stat.uid === BigInt(effectiveUid) : stat.uid === effectiveUid;
  const unsafeMode =
    typeof stat.mode === "bigint" ? (stat.mode & 0o022n) !== 0n : (stat.mode & 0o022) !== 0;
  if (!owned || unsafeMode) {
    throw new OwnerReferenceLegacyReadError(
      `${label} is not an euid-owned private entry`,
      "unsafe_legacy_path"
    );
  }
}

function normalizeReadError(error: unknown, label: string): OwnerReferenceLegacyReadError {
  if (error instanceof OwnerReferenceLegacyReadError) return error;
  const code =
    error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
  if (code === "ENOENT") {
    return new OwnerReferenceLegacyReadError(`${label} is missing`, "missing_bytes");
  }
  if (code === "ELOOP") {
    return new OwnerReferenceLegacyReadError(`${label} is a symlink`, "unsafe_legacy_path");
  }
  return new OwnerReferenceLegacyReadError(`${label} could not be read`, "unsafe_legacy_path");
}

function classifyReadFailure(error: unknown): OwnerReferenceMigrationQuarantineReason {
  return error instanceof OwnerReferenceLegacyReadError ? error.reason : "unsafe_legacy_path";
}

function actionForReadFailure(error: unknown): OwnerReferenceMigrationQuarantineAction {
  const reason = classifyReadFailure(error);
  if (reason === "missing_bytes") return "restore_exact_legacy_bytes";
  if (reason === "unstable_legacy_bytes") return "retry_stable_snapshot";
  if (reason === "invalid_legacy_record") return "review_legacy_record";
  return "repair_legacy_storage_boundary";
}

function failedObservation(
  legacyId: string,
  reason: OwnerReferenceMigrationQuarantineReason,
  action: OwnerReferenceMigrationQuarantineAction,
  details: {
    rawRecordSha256?: string;
    rawRecordByteLength?: number;
    rawRecordBytes?: Buffer;
    reference?: OwnerReference;
    content?: Buffer;
    observedSha256?: string;
    observedByteLength?: number;
    rawLegacyId?: string;
  } = {}
): LegacyOwnerReferenceObservation {
  return {
    legacyId,
    rawLegacyId: details.rawLegacyId ?? legacyId,
    rawRecordSha256: details.rawRecordSha256 ?? null,
    rawRecordByteLength: details.rawRecordByteLength ?? null,
    rawRecordBytes: details.rawRecordBytes ?? null,
    reference: details.reference ?? null,
    content: details.content ?? null,
    failure: {
      reason,
      action,
      declaredSha256: details.reference?.sha256 ?? null,
      observedSha256: details.observedSha256 ?? null,
      declaredByteLength: details.reference?.byteLength ?? null,
      observedByteLength: details.observedByteLength ?? null,
    },
  };
}

function withForcedFailure(
  observation: LegacyOwnerReferenceObservation,
  reason: OwnerReferenceMigrationQuarantineReason,
  action: OwnerReferenceMigrationQuarantineAction
): LegacyOwnerReferenceObservation {
  return {
    ...observation,
    failure: {
      reason,
      action,
      declaredSha256: observation.reference?.sha256 ?? observation.failure?.declaredSha256 ?? null,
      observedSha256:
        observation.content !== null
          ? sha256(observation.content)
          : (observation.failure?.observedSha256 ?? null),
      declaredByteLength:
        observation.reference?.byteLength ?? observation.failure?.declaredByteLength ?? null,
      observedByteLength:
        observation.content?.byteLength ?? observation.failure?.observedByteLength ?? null,
    },
  };
}

function inventoryObservationDigestView(observation: LegacyOwnerReferenceObservation) {
  return {
    legacyId: observation.legacyId,
    rawLegacyId: observation.rawLegacyId,
    rawRecordSha256: observation.rawRecordSha256,
    rawRecordByteLength: observation.rawRecordByteLength,
    reference: observation.reference
      ? {
          id: observation.reference.id,
          title: observation.reference.title,
          citation: observation.reference.citation,
          mimeType: observation.reference.mimeType,
          sha256: observation.reference.sha256,
          byteLength: observation.reference.byteLength ?? null,
          createdAt: observation.reference.createdAt,
        }
      : null,
    observedSha256: observation.content
      ? sha256(observation.content)
      : observation.failure?.observedSha256,
    observedByteLength: observation.content?.byteLength ?? observation.failure?.observedByteLength,
    failure: observation.failure,
  };
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export class OwnerReferenceLegacyReadError extends Error {
  constructor(
    message: string,
    readonly reason: OwnerReferenceMigrationQuarantineReason
  ) {
    super(message);
    this.name = "OwnerReferenceLegacyReadError";
  }
}
