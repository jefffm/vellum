import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  type Dirent,
  fsyncSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { platform } from "node:os";
import path from "node:path";

import {
  ReferenceDigitalAssetSchema,
  ReferenceRecordRefSchema,
  canonicalReferenceJson,
  referenceSourceDigest,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceControlledArtifactBindingSchema,
  type ReferenceSourceControlledArtifactBinding,
  type ReferenceSourceStoreEnumerationCore,
} from "../../lib/reference-source-inventory.js";
import type { ReferenceSourceControlledStoreInventoryAdapter } from "./reference-source-inventory-provider.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";

export type { ReferenceSourceControlledArtifactBinding } from "../../lib/reference-source-inventory.js";

const Strict = { additionalProperties: false } as const;
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

const ControlledArtifactCatalogCoreSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    generation: Type.Integer({ minimum: 0 }),
    bindings: Type.Array(ReferenceSourceControlledArtifactBindingSchema),
  },
  Strict
);
type ControlledArtifactCatalogCore = Static<typeof ControlledArtifactCatalogCoreSchema>;

const ControlledArtifactCatalogSchema = Type.Object(
  {
    ...ControlledArtifactCatalogCoreSchema.properties,
    digest: DigestSchema,
  },
  Strict
);
type ControlledArtifactCatalog = Static<typeof ControlledArtifactCatalogSchema>;

const LastBindingReleaseIntentCoreSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    kind: Type.Literal("last_binding_release"),
    artifactRef: ReferenceRecordRefSchema,
    blobSha256: DigestSchema,
    byteLength: Type.Integer({ minimum: 0 }),
    catalogBeforeGeneration: Type.Integer({ minimum: 0 }),
    catalogBeforeDigest: DigestSchema,
    catalogAfterGeneration: Type.Integer({ minimum: 1 }),
    catalogAfterDigest: DigestSchema,
  },
  Strict
);
type LastBindingReleaseIntentCore = Static<typeof LastBindingReleaseIntentCoreSchema>;

const LastBindingReleaseIntentSchema = Type.Object(
  {
    ...LastBindingReleaseIntentCoreSchema.properties,
    digest: DigestSchema,
  },
  Strict
);
type LastBindingReleaseIntent = Static<typeof LastBindingReleaseIntentSchema>;

const CatalogRecoveryReceiptSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    kind: Type.Union([Type.Literal("catalog-claim"), Type.Literal("recovery-guard")]),
    recoveredClaimDigest: DigestSchema,
    absentOwner: Type.Object(
      {
        pid: Type.Integer({ minimum: 1 }),
        hostIdentity: DigestSchema,
        bootIdentity: Type.Union([Type.String(), Type.Null()]),
        processStartIdentity: Type.Union([Type.String(), Type.Null()]),
      },
      Strict
    ),
    recoveredAt: Type.String(),
  },
  Strict
);
type CatalogRecoveryReceipt = Static<typeof CatalogRecoveryReceiptSchema>;

type WithoutStoreId<T> = T extends unknown ? Omit<T, "storeId"> : never;
type StoreObservation = WithoutStoreId<ReferenceSourceStoreEnumerationCore>;

type ObservedStoreEntry = {
  name: string;
  kind: "file" | "directory" | "symlink" | "other" | "unexpected_entry";
  byteLength?: number;
  sha256?: string;
  valid?: boolean;
};

type PreparedBlob = {
  pendingPath: string | null;
};

export type ReferenceSourceControlledArtifactStoreOptions = {
  rootDirectory?: string;
  storeId?: string;
  storeKind?: string;
  now?: () => Date;
  /** Test seam for hosts where a stable machine identity is unavailable. */
  hostIdentity?: () => string | null;
};

type CatalogClaimReceipt = {
  schemaVersion: 1;
  token: string;
  pid: number;
  hostIdentity: string;
  bootIdentity: string | null;
  processStartIdentity: string | null;
  claimedAt: string;
};

type CatalogClaim = {
  descriptor: number;
  path: string;
  receipt: CatalogClaimReceipt;
  serialized: string;
};

export type PutReferenceSourceControlledArtifactInput = {
  artifactRef: ReferenceRecordRef;
  sha256: string;
  byteLength: number;
  bytes: Uint8Array;
};

export type ReleaseReferenceSourceControlledArtifactInput = {
  artifactRef: ReferenceRecordRef;
  expectedBlobSha256: string;
};

/**
 * Durable, local, content-addressed storage for lifecycle-governed bytes.
 *
 * The catalog is the exact artifact-ref to blob binding authority. Inventory
 * observations walk this catalog and the blob directory directly; no staging
 * snapshot or expected artifact list is accepted at this boundary.
 */
export class ReferenceSourceControlledArtifactStore implements ReferenceSourceControlledStoreInventoryAdapter {
  readonly rootDirectory: string;
  readonly storeId: string;
  readonly storeKind: string;
  private readonly now: () => Date;
  private readonly hostIdentity: () => string | null;
  private catalogTransactionDepth = 0;

  constructor(options: ReferenceSourceControlledArtifactStoreOptions = {}) {
    this.rootDirectory =
      options.rootDirectory ??
      path.join(
        process.env.HOME ?? process.cwd(),
        ".vellum",
        "owner",
        "reference-source-controlled-artifacts"
      );
    // Preserve the T06 policy identifier while replacing its former synthetic
    // metadata witness with this real byte-store boundary.
    this.storeId = options.storeId ?? "reference-source-staging";
    this.storeKind = options.storeKind ?? "content_addressed_bytes";
    this.now = options.now ?? (() => new Date());
    this.hostIdentity = options.hostIdentity ?? currentHostIdentity;
    assertIdentifier(this.storeId, "controlled-store ID");
    assertIdentifier(this.storeKind, "controlled-store kind");
    this.initialize();
    try {
      this.withCatalogClaim(() => this.reconcileInterruptedArtifacts());
    } catch (error) {
      // A live or conservatively unrecoverable owner keeps startup read-only;
      // observe() will report failed evidence until the claim can be proved stale.
      if (!(error instanceof ReferenceSourceControlledArtifactStoreConflictError)) throw error;
    }
  }

  put(input: PutReferenceSourceControlledArtifactInput): ReferenceSourceControlledArtifactBinding {
    const artifactRef = decodeArtifactRef(input.artifactRef);
    assertDigest(input.sha256, "blob SHA-256");
    if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 0) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled artifact byte length must be a non-negative safe integer"
      );
    }
    const bytes = Buffer.from(input.bytes);
    if (bytes.byteLength !== input.byteLength) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled artifact bytes do not match the supplied byte length"
      );
    }
    if (sha256(bytes) !== input.sha256) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled artifact bytes do not match the supplied SHA-256"
      );
    }

    return this.putValidated({
      artifactRef,
      sha256: input.sha256,
      byteLength: input.byteLength,
      bytes,
    }).binding;
  }

  putDigitalAsset(input: { digitalAsset: ReferenceDigitalAsset; bytes: Uint8Array }): {
    binding: ReferenceSourceControlledArtifactBinding;
    created: boolean;
  } {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    let digitalAsset: ReferenceDigitalAsset;
    try {
      digitalAsset = Value.Decode(ReferenceDigitalAssetSchema, input.digitalAsset);
    } catch (error) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        `Controlled Digital Asset failed schema validation: ${errorMessage(error)}`
      );
    }
    const { digest, ...core } = digitalAsset;
    if (referenceSourceDigest(core) !== digest) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled Digital Asset identity or record digest is invalid"
      );
    }
    const bytes = Buffer.from(input.bytes);
    if (bytes.byteLength !== digitalAsset.byteLength || sha256(bytes) !== digitalAsset.sha256) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled Digital Asset bytes do not match its declared identity"
      );
    }
    return this.putValidated({
      artifactRef: { id: digitalAsset.id, digest: digitalAsset.digest },
      sha256: digitalAsset.sha256,
      byteLength: digitalAsset.byteLength,
      bytes,
    });
  }

  private putValidated(input: {
    artifactRef: ReferenceRecordRef;
    sha256: string;
    byteLength: number;
    bytes: Buffer;
  }): { binding: ReferenceSourceControlledArtifactBinding; created: boolean } {
    const { artifactRef, bytes } = input;

    return this.withCatalogClaim(() => {
      const catalog = this.readCatalog();
      const key = refKey(artifactRef);
      const existing = catalog.bindings.find((binding) => refKey(binding.artifactRef) === key);
      if (existing) {
        if (existing.blobSha256 !== input.sha256 || existing.byteLength !== input.byteLength) {
          throw new ReferenceSourceControlledArtifactStoreConflictError(
            `Controlled artifact ${artifactRef.id} is already bound to different bytes`
          );
        }
        const prepared = this.prepareImmutableBlob(input.sha256, bytes);
        this.completePreparedBlob(prepared);
        return { binding: structuredClone(existing), created: false };
      }

      const inconsistentLength = catalog.bindings.find(
        (binding) => binding.blobSha256 === input.sha256 && binding.byteLength !== input.byteLength
      );
      if (inconsistentLength) {
        throw new ReferenceSourceControlledArtifactStoreIntegrityError(
          `Controlled blob ${input.sha256} has inconsistent catalog lengths`
        );
      }

      const prepared = this.prepareImmutableBlob(input.sha256, bytes);
      const binding: ReferenceSourceControlledArtifactBinding = {
        artifactRef,
        blobSha256: input.sha256,
        byteLength: input.byteLength,
      };
      this.writeCatalog(
        bindCatalog({
          schemaVersion: 1,
          generation: catalog.generation + 1,
          bindings: sortBindings([...catalog.bindings, binding]),
        })
      );
      this.completePreparedBlob(prepared);
      return { binding: structuredClone(binding), created: true };
    });
  }

  release(input: ReleaseReferenceSourceControlledArtifactInput): {
    releasedBinding: ReferenceSourceControlledArtifactBinding;
    blobDeleted: boolean;
    generation: number;
  } {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const artifactRef = decodeArtifactRef(input.artifactRef);
    assertDigest(input.expectedBlobSha256, "expected blob SHA-256");

    return this.withCatalogClaim(() => {
      const catalog = this.readCatalog();
      const key = refKey(artifactRef);
      const binding = catalog.bindings.find((item) => refKey(item.artifactRef) === key);
      if (!binding) {
        throw new ReferenceSourceControlledArtifactStoreNotFoundError(
          `Controlled artifact binding not found: ${artifactRef.id}`
        );
      }
      if (binding.blobSha256 !== input.expectedBlobSha256) {
        throw new ReferenceSourceControlledArtifactStoreConflictError(
          `Controlled artifact ${artifactRef.id} does not match the expected blob digest`
        );
      }

      const remaining = catalog.bindings.filter((item) => refKey(item.artifactRef) !== key);
      const blobStillBound = remaining.some(({ blobSha256 }) => blobSha256 === binding.blobSha256);
      const next = bindCatalog({
        schemaVersion: 1,
        generation: catalog.generation + 1,
        bindings: remaining,
      });
      let blobDeleted = false;
      if (blobStillBound) {
        this.assertHealthyBlob(binding.blobSha256, binding.byteLength);
        this.writeCatalog(next);
      } else {
        const releaseIntentPath = this.writeLastBindingReleaseIntent(
          bindLastBindingReleaseIntent(catalog, next, binding)
        );
        const blobPath = this.blobPath(binding.blobSha256);
        if (pathEntryExists(blobPath)) {
          this.assertHealthyBlob(binding.blobSha256, binding.byteLength);
          unlinkSync(blobPath);
          fsyncDirectory(this.blobsDirectory());
          blobDeleted = true;
        }
        this.writeCatalog(next);
        this.removePendingFile(releaseIntentPath);
      }
      return {
        releasedBinding: structuredClone(binding),
        blobDeleted,
        generation: next.generation,
      };
    });
  }

  /**
   * Hold the cross-process catalog claim across a synchronous multi-store
   * transaction boundary. Calls back into this instance are re-entrant on the
   * same stack; every other instance or process remains excluded until the
   * callback returns.
   */
  withExclusiveTransaction<T>(operation: () => T): T {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return this.withCatalogClaim(() => {
      this.catalogTransactionDepth += 1;
      try {
        const result = operation();
        if (isPromiseLike(result)) {
          throw new ReferenceSourceControlledArtifactStoreIntegrityError(
            "Controlled-artifact exclusive transactions must be synchronous"
          );
        }
        return result;
      } finally {
        this.catalogTransactionDepth -= 1;
      }
    });
  }

  /** Enumerate the exact persisted catalog and disk state without snapshot input. */
  observe(): StoreObservation {
    try {
      return this.withCatalogClaim(() => this.observeClaimed());
    } catch {
      return {
        storeGeneration: 0,
        storeStateDigest: referenceSourceDigest({
          schemaVersion: 1,
          storeId: this.storeId,
          storeKind: this.storeKind,
          status: "read_error",
        }),
        status: "failed",
        failureCode: "read_error",
        artifactBindings: [],
      };
    }
  }

  private observeClaimed(): StoreObservation {
    this.assertStoreLayout();
    const catalog = this.readCatalog();
    const expectedBlobNames = new Set(catalog.bindings.map(({ blobSha256 }) => blobSha256));
    const observedBlobs: ObservedStoreEntry[] = [];
    const observedPending: ObservedStoreEntry[] = [];
    const observedRecoveries: ObservedStoreEntry[] = [];
    const issues = new Set<"missing" | "orphan" | "tampered">();
    const expectedRootEntries = new Map<string, "file" | "directory">([
      [".catalog.claim", "file"],
      [".pending", "directory"],
      ["blobs", "directory"],
      ["catalog.json", "file"],
      ["recoveries", "directory"],
    ]);
    const observedRootEntries = readdirSync(this.rootDirectory, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        kind: directoryEntryKind(entry),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const unexpectedRootEntries = observedRootEntries.filter(
      (entry) =>
        !expectedRootEntries.has(entry.name) &&
        !(entry.kind === "file" && /^\.catalog-claim\.[0-9a-f-]{36}\.tmp$/.test(entry.name))
    );
    if (unexpectedRootEntries.length > 0) issues.add("orphan");
    if (
      observedRootEntries.some((entry) => {
        const expectedKind = expectedRootEntries.get(entry.name);
        return expectedKind !== undefined && entry.kind !== expectedKind;
      })
    ) {
      issues.add("tampered");
    }

    for (const entry of readdirSync(this.blobsDirectory(), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (!entry.isFile()) {
        observedBlobs.push({ name: entry.name, kind: "unexpected_entry" });
        issues.add("orphan");
        continue;
      }
      const observed = inspectFile(path.join(this.blobsDirectory(), entry.name));
      observedBlobs.push({ name: entry.name, kind: "file", ...observed });
      if (!expectedBlobNames.has(entry.name)) issues.add("orphan");
      if (/^[a-f0-9]{64}$/.test(entry.name) && entry.name !== observed.sha256) {
        issues.add("tampered");
      }
    }

    for (const entry of readdirSync(this.pendingDirectory(), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (!entry.isFile()) {
        observedPending.push({ name: entry.name, kind: "unexpected_entry" });
      } else {
        observedPending.push({
          name: entry.name,
          kind: "file",
          ...inspectFile(path.join(this.pendingDirectory(), entry.name)),
        });
      }
      // Pending entries contain source bytes and are part of inventory even
      // though they have not reached the immutable blob namespace.
      issues.add("orphan");
    }

    for (const entry of readdirSync(this.recoveriesDirectory(), {
      withFileTypes: true,
    }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile()) {
        observedRecoveries.push({ name: entry.name, kind: directoryEntryKind(entry) });
        issues.add("orphan");
        continue;
      }
      const file = path.join(this.recoveriesDirectory(), entry.name);
      const observed = inspectFile(file);
      let valid = false;
      try {
        valid = recoveryReceiptNameMatches(entry.name, readRecoveryReceipt(file));
      } catch {
        // Invalid recovery receipts remain inventory-visible and fail closed.
      }
      observedRecoveries.push({ name: entry.name, kind: "file", ...observed, valid });
      if (!valid) issues.add("tampered");
    }

    const observedByName = new Map(observedBlobs.map((blob) => [blob.name, blob]));
    for (const binding of catalog.bindings) {
      const observed = observedByName.get(binding.blobSha256);
      if (!observed || observed.kind !== "file") {
        issues.add("missing");
      } else if (
        observed.sha256 !== binding.blobSha256 ||
        observed.byteLength !== binding.byteLength
      ) {
        issues.add("tampered");
      }
    }

    const artifactBindings = catalog.bindings.map((binding) => structuredClone(binding));
    const storeStateDigest = referenceSourceDigest({
      schemaVersion: 1,
      storeId: this.storeId,
      storeKind: this.storeKind,
      catalogDigest: catalog.digest,
      observedRootEntries,
      observedBlobs,
      observedPending,
      observedRecoveries,
      unexpectedRootEntries,
      issues: [...issues].sort(),
    });
    if (issues.size === 0) {
      return {
        storeGeneration: catalog.generation,
        storeStateDigest,
        status: "complete",
        artifactBindings,
      };
    }
    return {
      storeGeneration: catalog.generation,
      storeStateDigest,
      status: "failed",
      failureCode: issues.has("tampered") ? "state_digest_changed" : "enumeration_incomplete",
      artifactBindings,
    };
  }

  private reconcileInterruptedArtifacts(): void {
    this.assertStoreLayout();
    this.reconcileInterruptedMetadata();
    this.reconcileInterruptedRecoveryMetadata();
    this.reconcileInterruptedPendingMetadata();
    let catalog = this.readCatalog();
    catalog = this.reconcileLastBindingReleaseIntent(catalog);
    let changed = false;
    for (const entry of readdirSync(this.pendingDirectory(), { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const match = /^([a-f0-9]{64})\.[0-9a-f-]{36}\.pending$/.exec(entry.name);
      if (!match) continue;
      const expectedSha256 = match[1]!;
      const pendingPath = path.join(this.pendingDirectory(), entry.name);
      const observed = inspectFile(pendingPath);
      if (observed.sha256 !== expectedSha256) continue;

      const bindings = catalog.bindings.filter(({ blobSha256 }) => blobSha256 === expectedSha256);
      if (bindings.length > 0) {
        if (bindings.some(({ byteLength }) => byteLength !== observed.byteLength)) continue;
        const destination = this.blobPath(expectedSha256);
        if (pathEntryExists(destination)) {
          this.assertHealthyBlob(expectedSha256, observed.byteLength);
        } else {
          try {
            linkSync(pendingPath, destination);
            fsyncDirectory(this.blobsDirectory());
          } catch (error) {
            if (!isFileExistsError(error)) throw error;
            this.assertHealthyBlob(expectedSha256, observed.byteLength);
          }
        }
      } else {
        const destination = this.blobPath(expectedSha256);
        if (pathEntryExists(destination)) {
          // A newly created blob and its durable pending name are hard links.
          // Delete only that provable interrupted-put shape; an unrelated
          // same-digest file is left visible for fail-closed inventory.
          if (!sameRegularFile(pendingPath, destination)) continue;
          this.assertHealthyBlob(expectedSha256, observed.byteLength);
          unlinkSync(destination);
          fsyncDirectory(this.blobsDirectory());
        }
      }
      // With no catalog binding, the interrupted put never committed. With a
      // binding, the immutable blob is now present and verified. In both cases
      // the duplicate pending bytes can be removed while holding the claim.
      unlinkSync(pendingPath);
      changed = true;
    }
    if (changed) fsyncDirectory(this.pendingDirectory());
  }

  private reconcileLastBindingReleaseIntent(
    catalog: ControlledArtifactCatalog
  ): ControlledArtifactCatalog {
    const candidates = readdirSync(this.pendingDirectory(), { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && /^release\.[0-9a-f-]{36}\.intent\.json$/.test(entry.name)
      )
      .map((entry) => path.join(this.pendingDirectory(), entry.name));
    // Serialization permits at most one durable release intent. Multiple
    // intents are not guessed into an order and therefore remain visible.
    if (candidates.length !== 1) return catalog;

    const intentPath = candidates[0]!;
    let intent: LastBindingReleaseIntent;
    try {
      intent = readLastBindingReleaseIntent(intentPath);
    } catch {
      return catalog;
    }
    if (
      intent.catalogAfterGeneration !== intent.catalogBeforeGeneration + 1 ||
      !IdentifierPattern.test(intent.artifactRef.id)
    ) {
      return catalog;
    }

    if (
      catalog.generation === intent.catalogBeforeGeneration &&
      catalog.digest === intent.catalogBeforeDigest
    ) {
      const key = refKey(intent.artifactRef);
      const binding = catalog.bindings.find((item) => refKey(item.artifactRef) === key);
      if (
        !binding ||
        binding.blobSha256 !== intent.blobSha256 ||
        binding.byteLength !== intent.byteLength ||
        catalog.bindings.filter(({ blobSha256 }) => blobSha256 === intent.blobSha256).length !== 1
      ) {
        return catalog;
      }
      const next = bindCatalog({
        schemaVersion: 1,
        generation: catalog.generation + 1,
        bindings: catalog.bindings.filter((item) => refKey(item.artifactRef) !== key),
      });
      if (
        next.generation !== intent.catalogAfterGeneration ||
        next.digest !== intent.catalogAfterDigest
      ) {
        return catalog;
      }
      const blobPath = this.blobPath(intent.blobSha256);
      if (pathEntryExists(blobPath)) {
        this.assertHealthyBlob(intent.blobSha256, intent.byteLength);
        unlinkSync(blobPath);
        fsyncDirectory(this.blobsDirectory());
      }
      this.writeCatalog(next);
      this.removePendingFile(intentPath);
      return next;
    }

    if (
      catalog.generation === intent.catalogAfterGeneration &&
      catalog.digest === intent.catalogAfterDigest &&
      !catalog.bindings.some((item) => refKey(item.artifactRef) === refKey(intent.artifactRef)) &&
      !catalog.bindings.some(({ blobSha256 }) => blobSha256 === intent.blobSha256) &&
      !pathEntryExists(this.blobPath(intent.blobSha256))
    ) {
      // The catalog replacement committed before the process could remove the
      // durable intent. Clearing it is the idempotent final step.
      this.removePendingFile(intentPath);
    }
    return catalog;
  }

  private reconcileInterruptedMetadata(): void {
    let changed = false;
    for (const entry of readdirSync(this.rootDirectory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (
        /^\.catalog\.[0-9a-f-]{36}\.tmp$/.test(entry.name) ||
        /^\.catalog\.claim(?:\.recovery)?\.orphan\.[0-9a-f-]{36}$/.test(entry.name)
      ) {
        unlinkSync(path.join(this.rootDirectory, entry.name));
        changed = true;
      }
    }
    if (changed) fsyncDirectory(this.rootDirectory);
  }

  private reconcileInterruptedRecoveryMetadata(): void {
    let changed = false;
    for (const entry of readdirSync(this.recoveriesDirectory(), { withFileTypes: true })) {
      if (
        entry.isFile() &&
        /^(?:catalog-claim|recovery-guard)\.[0-9a-f-]{36}\.json\.[0-9a-f-]{36}\.tmp$/.test(
          entry.name
        )
      ) {
        unlinkSync(path.join(this.recoveriesDirectory(), entry.name));
        changed = true;
      }
    }
    if (changed) fsyncDirectory(this.recoveriesDirectory());
  }

  private reconcileInterruptedPendingMetadata(): void {
    let changed = false;
    for (const entry of readdirSync(this.pendingDirectory(), { withFileTypes: true })) {
      if (
        entry.isFile() &&
        /^release\.[0-9a-f-]{36}\.intent\.json\.[0-9a-f-]{36}\.tmp$/.test(entry.name)
      ) {
        unlinkSync(path.join(this.pendingDirectory(), entry.name));
        changed = true;
      }
    }
    if (changed) fsyncDirectory(this.pendingDirectory());
  }

  private initialize(): void {
    ensureRealDirectory(this.rootDirectory, true);
    ensureRealDirectory(this.blobsDirectory(), false);
    ensureRealDirectory(this.pendingDirectory(), false);
    ensureRealDirectory(this.recoveriesDirectory(), false);
    if (pathEntryExists(this.catalogPath())) {
      assertRegularFilePath(this.catalogPath(), "controlled-artifact catalog");
      this.readCatalog();
      return;
    }
    const empty = bindCatalog({ schemaVersion: 1, generation: 0, bindings: [] });
    try {
      const descriptor = openSync(this.catalogPath(), "wx", 0o600);
      try {
        writeFileSync(descriptor, `${canonicalReferenceJson(empty)}\n`);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      fsyncDirectory(this.rootDirectory);
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      this.readCatalog();
    }
  }

  private readCatalog(): ControlledArtifactCatalog {
    let decoded: ControlledArtifactCatalog;
    try {
      decoded = Value.Decode(
        ControlledArtifactCatalogSchema,
        JSON.parse(readRegularTextFile(this.catalogPath(), "controlled-artifact catalog"))
      );
    } catch (error) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        `Controlled-artifact catalog failed schema validation: ${errorMessage(error)}`
      );
    }
    const { digest, ...core } = decoded;
    if (referenceSourceDigest(core) !== digest) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled-artifact catalog digest does not match its content"
      );
    }
    const sorted = sortBindings(decoded.bindings);
    if (canonicalReferenceJson(sorted) !== canonicalReferenceJson(decoded.bindings)) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled-artifact catalog bindings are not canonically ordered"
      );
    }
    const keys = new Set<string>();
    const lengthsByBlob = new Map<string, number>();
    for (const binding of decoded.bindings) {
      assertIdentifier(binding.artifactRef.id, "controlled artifact reference ID");
      const key = refKey(binding.artifactRef);
      if (keys.has(key)) {
        throw new ReferenceSourceControlledArtifactStoreIntegrityError(
          `Controlled-artifact catalog repeats exact binding ${binding.artifactRef.id}`
        );
      }
      keys.add(key);
      const length = lengthsByBlob.get(binding.blobSha256);
      if (length !== undefined && length !== binding.byteLength) {
        throw new ReferenceSourceControlledArtifactStoreIntegrityError(
          `Controlled blob ${binding.blobSha256} has inconsistent catalog lengths`
        );
      }
      lengthsByBlob.set(binding.blobSha256, binding.byteLength);
    }
    return decoded;
  }

  private writeCatalog(catalog: ControlledArtifactCatalog): void {
    const temporary = path.join(this.rootDirectory, `.catalog.${randomUUID()}.tmp`);
    try {
      const descriptor = openSync(temporary, "wx", 0o600);
      try {
        writeFileSync(descriptor, `${canonicalReferenceJson(catalog)}\n`);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      renameSync(temporary, this.catalogPath());
      fsyncDirectory(this.rootDirectory);
    } finally {
      rmSync(temporary, { force: true });
    }
  }

  private prepareImmutableBlob(blobSha256: string, bytes: Buffer): PreparedBlob {
    const destination = this.blobPath(blobSha256);
    if (pathEntryExists(destination)) {
      this.assertHealthyBlob(blobSha256, bytes.byteLength);
      return { pendingPath: null };
    }

    const temporary = path.join(this.pendingDirectory(), `${blobSha256}.${randomUUID()}.pending`);
    const descriptor = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    // Persist the recovery name before the blob hard link. A crash can then be
    // classified as either an uncommitted put or a committed binding.
    fsyncDirectory(this.pendingDirectory());
    try {
      linkSync(temporary, destination);
      fsyncDirectory(this.blobsDirectory());
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      this.assertHealthyBlob(blobSha256, bytes.byteLength);
    }
    return { pendingPath: temporary };
  }

  private completePreparedBlob(prepared: PreparedBlob): void {
    if (prepared.pendingPath) this.removePendingFile(prepared.pendingPath);
  }

  private writeLastBindingReleaseIntent(intent: LastBindingReleaseIntent): string {
    const file = path.join(this.pendingDirectory(), `release.${randomUUID()}.intent.json`);
    writeJsonAtomic(file, intent);
    return file;
  }

  private removePendingFile(file: string): void {
    assertPathInside(file, this.pendingDirectory(), "controlled-artifact pending file");
    assertRegularFilePath(file, "controlled-artifact pending file");
    unlinkSync(file);
    fsyncDirectory(this.pendingDirectory());
  }

  private assertHealthyBlob(blobSha256: string, byteLength: number): void {
    const blobPath = this.blobPath(blobSha256);
    if (!pathEntryExists(blobPath)) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        `Controlled blob is missing: ${blobSha256}`
      );
    }
    const observed = inspectFile(blobPath);
    if (observed.sha256 !== blobSha256 || observed.byteLength !== byteLength) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        `Controlled blob failed digest or length verification: ${blobSha256}`
      );
    }
  }

  private withCatalogClaim<T>(operation: () => T): T {
    if (this.catalogTransactionDepth > 0) return operation();
    this.assertStoreLayout();
    const claim = this.acquireCatalogClaim();
    try {
      this.assertStoreLayout();
      return operation();
    } finally {
      this.releaseOwnedClaim(claim);
    }
  }

  private acquireCatalogClaim(): CatalogClaim {
    if (this.recoveryClaimPaths().length > 0) {
      const recoveryClaim = this.acquireRecoveryClaim();
      if (!recoveryClaim) {
        throw new ReferenceSourceControlledArtifactStoreConflictError(
          "Controlled-artifact catalog claim recovery is already in progress"
        );
      }
      this.releaseOwnedClaim(recoveryClaim);
    }
    try {
      const claim = this.createOwnedClaim(this.catalogClaimPath());
      if (this.recoveryClaimPaths().length > 0) {
        this.releaseOwnedClaim(claim);
        throw new ReferenceSourceControlledArtifactStoreConflictError(
          "Controlled-artifact catalog claim recovery raced this operation"
        );
      }
      return claim;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      if (!this.recoverAbsentCatalogClaimOwner()) {
        throw new ReferenceSourceControlledArtifactStoreConflictError(
          "Another writer or inventory reader owns the controlled-artifact catalog claim"
        );
      }
      return this.acquireCatalogClaim();
    }
  }

  private recoverAbsentCatalogClaimOwner(): boolean {
    const recoveryClaim = this.acquireRecoveryClaim();
    if (!recoveryClaim) return false;
    try {
      if (!pathEntryExists(this.catalogClaimPath())) return true;
      return this.recoverStaleOwnedClaim(this.catalogClaimPath(), "catalog-claim");
    } finally {
      this.releaseOwnedClaim(recoveryClaim);
    }
  }

  private acquireRecoveryClaim(): CatalogClaim | null {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const claim = this.createOwnedClaim(this.recoveryTicketPath());
      let keepClaim = false;
      try {
        for (const candidate of this.recoveryClaimPaths()) {
          if (candidate === claim.path || candidate === this.recoveryClaimPath()) continue;
          if (!this.recoverStaleOwnedClaim(candidate, "recovery-guard")) return null;
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
          !this.recoverStaleOwnedClaim(this.recoveryClaimPath(), "recovery-guard")
        ) {
          return null;
        }
        if (this.recoveryClaimPaths().some((candidate) => candidate !== claim.path)) continue;
        keepClaim = true;
        return claim;
      } finally {
        if (!keepClaim) this.releaseOwnedClaim(claim);
      }
    }
    return null;
  }

  private createOwnedClaim(filePath: string): CatalogClaim {
    const stableHostIdentity = this.hostIdentity();
    if (stableHostIdentity !== null && !isStableHostIdentity(stableHostIdentity)) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Stable controlled-artifact host identity must be a SHA-256 digest"
      );
    }
    const receipt: CatalogClaimReceipt = {
      schemaVersion: 1,
      token: randomUUID(),
      pid: process.pid,
      hostIdentity: stableHostIdentity ?? unrecoverableHostClaimMarker,
      bootIdentity: currentBootIdentity(),
      processStartIdentity: processStartIdentity(process.pid),
      claimedAt: this.now().toISOString(),
    };
    const serialized = `${canonicalReferenceJson(receipt)}\n`;
    const temporary = path.join(this.rootDirectory, `.catalog-claim.${randomUUID()}.tmp`);
    let descriptor: number | undefined;
    let published = false;
    try {
      descriptor = openSync(
        temporary,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
        0o600
      );
      if (!fstatSync(descriptor).isFile()) {
        throw new ReferenceSourceControlledArtifactStoreIntegrityError(
          "Controlled-artifact claim temporary target is not a regular file"
        );
      }
      writeFileSync(descriptor, serialized);
      fsyncSync(descriptor);
      // Publish a complete durable receipt with one atomic no-replace link.
      linkSync(temporary, filePath);
      published = true;
      fsyncDirectory(this.rootDirectory);
      unlinkSync(temporary);
      fsyncDirectory(this.rootDirectory);
      return { descriptor, path: filePath, receipt, serialized };
    } catch (error) {
      if (published && descriptor !== undefined && pathMatchesDescriptor(filePath, descriptor)) {
        unlinkSync(filePath);
        fsyncDirectory(this.rootDirectory);
      }
      if (descriptor !== undefined) closeSync(descriptor);
      rmSync(temporary, { force: true });
      throw error;
    }
  }

  private recoverStaleOwnedClaim(
    filePath: string,
    kind: "catalog-claim" | "recovery-guard"
  ): boolean {
    if (!pathEntryExists(filePath)) return true;
    let descriptor: number;
    try {
      descriptor = openSync(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    } catch (error) {
      if (isFileMissingError(error)) return true;
      throw error;
    }
    try {
      if (!pathMatchesDescriptor(filePath, descriptor)) {
        throw new ReferenceSourceControlledArtifactStoreIntegrityError(
          `Controlled-artifact ${kind} is not one stable regular file`
        );
      }
      const originalBytes = readFileSync(descriptor, "utf8");
      const receipt = decodeCatalogClaim(JSON.parse(originalBytes));
      if (!catalogClaimOwnerIsProvablyAbsent(receipt, this.hostIdentity)) return false;
      if (
        !pathMatchesDescriptor(filePath, descriptor) ||
        readRegularTextFile(filePath, `controlled-artifact ${kind}`) !== originalBytes
      ) {
        return false;
      }

      // Validate the receipt destination before removing the stale claim from
      // its public name. If it is substituted after this check, the guarded
      // failure path below restores the exact quarantined claim.
      assertDirectoryPath(
        this.recoveriesDirectory(),
        "controlled-artifact recovery receipt directory"
      );
      const quarantine = `${filePath}.orphan.${randomUUID()}`;
      try {
        renameSync(filePath, quarantine);
      } catch (error) {
        if (isFileMissingError(error)) return true;
        throw error;
      }
      let quarantineOwned = false;
      let recoveryReceiptPublished = false;
      try {
        if (
          !pathMatchesDescriptor(quarantine, descriptor) ||
          readRegularTextFile(quarantine, `recovered controlled-artifact ${kind}`) !== originalBytes
        ) {
          throw new ReferenceSourceControlledArtifactStoreIntegrityError(
            `Recovered controlled-artifact ${kind} bytes changed during guarded rename`
          );
        }
        quarantineOwned = true;
        writeJsonAtomic(
          path.join(this.rootDirectory, "recoveries", `${kind}.${randomUUID()}.json`),
          {
            schemaVersion: 1,
            kind,
            recoveredClaimDigest: sha256(Buffer.from(originalBytes)),
            absentOwner: {
              pid: receipt.pid,
              hostIdentity: receipt.hostIdentity,
              bootIdentity: receipt.bootIdentity,
              processStartIdentity: receipt.processStartIdentity,
            },
            recoveredAt: this.now().toISOString(),
          }
        );
        recoveryReceiptPublished = true;
      } finally {
        if (quarantineOwned && pathMatchesDescriptor(quarantine, descriptor)) {
          if (recoveryReceiptPublished) unlinkSync(quarantine);
          else if (!pathEntryExists(filePath)) renameSync(quarantine, filePath);
        }
        fsyncDirectory(this.rootDirectory);
      }
      return true;
    } finally {
      closeSync(descriptor);
    }
  }

  private releaseOwnedClaim(claim: CatalogClaim): void {
    if (
      !pathEntryExists(claim.path) ||
      !pathMatchesDescriptor(claim.path, claim.descriptor) ||
      readRegularTextFile(claim.path, "controlled-artifact owned claim") !== claim.serialized
    ) {
      closeSync(claim.descriptor);
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled-artifact catalog claim ownership changed during the operation"
      );
    }
    closeSync(claim.descriptor);
    unlinkSync(claim.path);
    fsyncDirectory(this.rootDirectory);
  }

  private catalogPath(): string {
    return path.join(this.rootDirectory, "catalog.json");
  }

  private catalogClaimPath(): string {
    return path.join(this.rootDirectory, ".catalog.claim");
  }

  private recoveryClaimPath(): string {
    return path.join(this.rootDirectory, ".catalog.claim.recovery");
  }

  private recoveryTicketPath(): string {
    return path.join(this.rootDirectory, `.catalog.claim.recovery.${randomUUID()}`);
  }

  private recoveryClaimPaths(): string[] {
    const legacy = this.recoveryClaimPath();
    const claims = pathEntryExists(legacy) ? [legacy] : [];
    for (const entry of readdirSync(this.rootDirectory, { withFileTypes: true })) {
      if (!/^\.catalog\.claim\.recovery\.[0-9a-f-]{36}$/.test(entry.name)) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new ReferenceSourceControlledArtifactStoreIntegrityError(
          "Controlled-artifact recovery ticket is not a regular file"
        );
      }
      claims.push(path.join(this.rootDirectory, entry.name));
    }
    return claims.sort();
  }

  private blobsDirectory(): string {
    return path.join(this.rootDirectory, "blobs");
  }

  private pendingDirectory(): string {
    return path.join(this.rootDirectory, ".pending");
  }

  private recoveriesDirectory(): string {
    return path.join(this.rootDirectory, "recoveries");
  }

  private assertStoreLayout(): void {
    assertDirectoryPath(this.rootDirectory, "controlled-artifact root");
    assertDirectoryPath(this.blobsDirectory(), "controlled-artifact blobs directory");
    assertDirectoryPath(this.pendingDirectory(), "controlled-artifact pending directory");
    assertDirectoryPath(this.recoveriesDirectory(), "controlled-artifact recoveries directory");
    assertRegularFilePath(this.catalogPath(), "controlled-artifact catalog");
    for (const [file, label] of [
      [this.catalogClaimPath(), "controlled-artifact catalog claim"],
      [this.recoveryClaimPath(), "controlled-artifact recovery claim"],
    ] as const) {
      if (pathEntryExists(file)) assertRegularFilePath(file, label);
    }
    this.recoveryClaimPaths();
  }

  private blobPath(blobSha256: string): string {
    assertDigest(blobSha256, "blob SHA-256");
    return path.join(this.blobsDirectory(), blobSha256);
  }
}

export class ReferenceSourceControlledArtifactStoreIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceControlledArtifactStoreIntegrityError";
  }
}

export class ReferenceSourceControlledArtifactStoreConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceControlledArtifactStoreConflictError";
  }
}

export class ReferenceSourceControlledArtifactStoreNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceControlledArtifactStoreNotFoundError";
  }
}

function bindCatalog(core: ControlledArtifactCatalogCore): ControlledArtifactCatalog {
  const normalized = { ...structuredClone(core), bindings: sortBindings(core.bindings) };
  return Value.Decode(ControlledArtifactCatalogSchema, {
    ...normalized,
    digest: referenceSourceDigest(normalized),
  });
}

function bindLastBindingReleaseIntent(
  before: ControlledArtifactCatalog,
  after: ControlledArtifactCatalog,
  binding: ReferenceSourceControlledArtifactBinding
): LastBindingReleaseIntent {
  const core: LastBindingReleaseIntentCore = {
    schemaVersion: 1,
    kind: "last_binding_release",
    artifactRef: structuredClone(binding.artifactRef),
    blobSha256: binding.blobSha256,
    byteLength: binding.byteLength,
    catalogBeforeGeneration: before.generation,
    catalogBeforeDigest: before.digest,
    catalogAfterGeneration: after.generation,
    catalogAfterDigest: after.digest,
  };
  return Value.Decode(LastBindingReleaseIntentSchema, {
    ...core,
    digest: referenceSourceDigest(core),
  });
}

function readLastBindingReleaseIntent(file: string): LastBindingReleaseIntent {
  const raw = readRegularTextFile(file, "controlled-artifact release intent");
  const decoded = Value.Decode(LastBindingReleaseIntentSchema, JSON.parse(raw));
  const { digest, ...core } = decoded;
  if (referenceSourceDigest(core) !== digest || raw !== `${canonicalReferenceJson(decoded)}\n`) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      "Controlled-artifact release intent failed canonical digest validation"
    );
  }
  return decoded;
}

function readRecoveryReceipt(file: string): CatalogRecoveryReceipt {
  const raw = readRegularTextFile(file, "controlled-artifact recovery receipt");
  const decoded = Value.Decode(CatalogRecoveryReceiptSchema, JSON.parse(raw));
  if (
    raw !== `${canonicalReferenceJson(decoded)}\n` ||
    !Number.isFinite(Date.parse(decoded.recoveredAt))
  ) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      "Controlled-artifact recovery receipt failed canonical validation"
    );
  }
  return decoded;
}

function recoveryReceiptNameMatches(name: string, receipt: CatalogRecoveryReceipt): boolean {
  const match = /^(catalog-claim|recovery-guard)\.[0-9a-f-]{36}\.json$/.exec(name);
  return match?.[1] === receipt.kind;
}

function sortBindings(
  bindings: readonly ReferenceSourceControlledArtifactBinding[]
): ReferenceSourceControlledArtifactBinding[] {
  return bindings
    .map((binding) => structuredClone(binding))
    .sort((left, right) => refKey(left.artifactRef).localeCompare(refKey(right.artifactRef)));
}

function decodeArtifactRef(value: unknown): ReferenceRecordRef {
  try {
    const decoded = Value.Decode(ReferenceRecordRefSchema, value);
    assertIdentifier(decoded.id, "controlled artifact reference ID");
    return decoded;
  } catch (error) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      `Controlled artifact reference is invalid: ${errorMessage(error)}`
    );
  }
}

function inspectFile(file: string): { sha256: string; byteLength: number } {
  const before = lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      "Controlled blob path is not a regular file"
    );
  }
  const descriptor = openSync(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        "Controlled blob path changed during guarded open"
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
      byteLength += count;
    }
    return { sha256: hash.digest("hex"), byteLength };
  } finally {
    closeSync(descriptor);
  }
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertDigest(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(`Invalid ${label}`);
  }
}

function assertIdentifier(value: string, label: string): void {
  if (!IdentifierPattern.test(value)) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(`Invalid ${label}`);
  }
}

function fsyncDirectory(directory: string): void {
  assertDirectoryPath(directory, "controlled-artifact fsync directory");
  const descriptor = openSync(
    directory,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_DIRECTORY
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function pathMatchesDescriptor(file: string, descriptor: number): boolean {
  try {
    const opened = fstatSync(descriptor);
    const named = lstatSync(file);
    return (
      opened.isFile() &&
      named.isFile() &&
      !named.isSymbolicLink() &&
      opened.dev === named.dev &&
      opened.ino === named.ino
    );
  } catch {
    return false;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  assertDirectoryPath(path.dirname(file), "controlled-artifact atomic-write directory");
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

function ensureRealDirectory(directory: string, recursive: boolean): void {
  if (!pathEntryExists(directory)) {
    mkdirSync(directory, { recursive, mode: 0o700 });
  }
  assertDirectoryPath(directory, "controlled-artifact directory");
}

function assertDirectoryPath(directory: string, label: string): void {
  let stat;
  try {
    stat = lstatSync(directory);
  } catch (error) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      `${label} is unavailable: ${errorMessage(error)}`
    );
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      `${label} must be a real directory, not a symlink or another entry type`
    );
  }
}

function assertRegularFilePath(file: string, label: string): void {
  let stat;
  try {
    stat = lstatSync(file);
  } catch (error) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      `${label} is unavailable: ${errorMessage(error)}`
    );
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      `${label} must be a real regular file, not a symlink or another entry type`
    );
  }
}

function readRegularTextFile(file: string, label: string): string {
  assertRegularFilePath(file, label);
  const before = lstatSync(file);
  const descriptor = openSync(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new ReferenceSourceControlledArtifactStoreIntegrityError(
        `${label} changed during guarded open`
      );
    }
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
}

function pathEntryExists(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if (isFileMissingError(error)) return false;
    throw error;
  }
}

function sameRegularFile(left: string, right: string): boolean {
  const leftStat = lstatSync(left);
  const rightStat = lstatSync(right);
  if (
    !leftStat.isFile() ||
    leftStat.isSymbolicLink() ||
    !rightStat.isFile() ||
    rightStat.isSymbolicLink()
  ) {
    return false;
  }
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

function assertPathInside(file: string, directory: string, label: string): void {
  if (path.dirname(path.resolve(file)) !== path.resolve(directory)) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      `${label} escapes its controlled directory`
    );
  }
}

function directoryEntryKind(entry: Dirent): ObservedStoreEntry["kind"] {
  if (entry.isFile()) return "file";
  if (entry.isDirectory()) return "directory";
  if (entry.isSymbolicLink()) return "symlink";
  return "other";
}

function decodeCatalogClaim(value: unknown): CatalogClaimReceipt {
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
    !Number.isSafeInteger(value.pid) ||
    Number(value.pid) < 1 ||
    typeof value.hostIdentity !== "string" ||
    !(
      isStableHostIdentity(value.hostIdentity) || isUnrecoverableHostClaimMarker(value.hostIdentity)
    ) ||
    !(value.bootIdentity === null || typeof value.bootIdentity === "string") ||
    !(value.processStartIdentity === null || typeof value.processStartIdentity === "string") ||
    typeof value.claimedAt !== "string" ||
    !Number.isFinite(Date.parse(value.claimedAt))
  ) {
    throw new ReferenceSourceControlledArtifactStoreIntegrityError(
      "Controlled-artifact catalog claim failed closed-schema validation"
    );
  }
  return value as CatalogClaimReceipt;
}

function catalogClaimOwnerIsProvablyAbsent(
  receipt: CatalogClaimReceipt,
  getCurrentHostIdentity: () => string | null
): boolean {
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
    return null;
  }
  return sha256(Buffer.from(`${platform()}\u0000${stableMachineIdentity}`));
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
      return (
        execFileSync("/usr/sbin/sysctl", ["-n", "kern.boottime"], {
          encoding: "utf8",
          timeout: 1_000,
        }).trim() || null
      );
    }
  } catch {
    // Unsupported identity probes fail closed during recovery.
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

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isFileMissingError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}
