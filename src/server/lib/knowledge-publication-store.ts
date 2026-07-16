import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
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
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { platform } from "node:os";
import path from "node:path";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { canonicalReferenceJson } from "../../lib/reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const SafeIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const RevisionSchema = Type.Integer({ minimum: 1 });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

export const KnowledgePublicationRecordKindSchema = Type.Union([
  Type.Literal("knowledge_applicability_predicate"),
  Type.Literal("knowledge_candidate"),
  Type.Literal("knowledge_evidence_edge"),
  Type.Literal("knowledge_constraint_derivation"),
  Type.Literal("knowledge_component_binding"),
  Type.Literal("knowledge_component_mapping"),
  Type.Literal("knowledge_profile"),
  Type.Literal("knowledge_pack_draft"),
  Type.Literal("knowledge_pack_release"),
  Type.Literal("knowledge_system_identity_snapshot"),
  Type.Literal("knowledge_test_policy"),
  Type.Literal("release_attestation"),
  Type.Literal("release_advisory"),
  Type.Literal("identity_verification"),
  Type.Literal("authority_verification"),
  Type.Literal("activation_decision"),
  Type.Literal("knowledge_library_inventory_snapshot"),
  Type.Literal("knowledge_catalog_snapshot"),
  Type.Literal("owner_reference_migration_mapping"),
  Type.Literal("owner_reference_migration_quarantine"),
  Type.Literal("owner_reference_migration_journal"),
]);
export type KnowledgePublicationRecordKind = Static<typeof KnowledgePublicationRecordKindSchema>;

export const KnowledgePublicationWriterKindSchema = Type.Union([
  Type.Literal("upload"),
  Type.Literal("review"),
  Type.Literal("advisory"),
  Type.Literal("activation"),
  Type.Literal("system"),
  Type.Literal("migration"),
]);
export type KnowledgePublicationWriterKind = Static<typeof KnowledgePublicationWriterKindSchema>;

export const KnowledgePublicationRecordRefSchema = Type.Object(
  {
    recordKind: KnowledgePublicationRecordKindSchema,
    id: SafeIdSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgePublicationRecordRef = Static<typeof KnowledgePublicationRecordRefSchema>;

export const KnowledgePublicationGenerationRefSchema = Type.Object(
  { id: SafeIdSchema, digest: DigestSchema, revision: RevisionSchema },
  Strict
);
export type KnowledgePublicationGenerationRef = Static<
  typeof KnowledgePublicationGenerationRefSchema
>;

export const KnowledgePublicationWriteSchema = Type.Object(
  {
    recordKind: KnowledgePublicationRecordKindSchema,
    id: SafeIdSchema,
    successorRefs: Type.Array(KnowledgePublicationRecordRefSchema, { maxItems: 256 }),
    content: Type.Unknown(),
  },
  Strict
);
export type KnowledgePublicationWrite = Static<typeof KnowledgePublicationWriteSchema>;

/** Compute the exact immutable record ref a normalized write will publish. */
export function knowledgePublicationRecordRefForWrite(
  write: KnowledgePublicationWrite
): KnowledgePublicationRecordRef {
  const core = {
    schemaVersion: 1 as const,
    recordKind: write.recordKind,
    id: write.id,
    successorRefs: sortRecordRefs(write.successorRefs),
    content: structuredClone(write.content),
  };
  const decoded = decodeRecord({ ...core, digest: publicationDigest("record", core) });
  return recordRef(decoded);
}

export const KnowledgePublicationTransactionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    transactionId: SafeIdSchema,
    writerKind: KnowledgePublicationWriterKindSchema,
    expectedHead: Type.Union([KnowledgePublicationGenerationRefSchema, Type.Null()]),
    writes: Type.Array(KnowledgePublicationWriteSchema, { minItems: 1, maxItems: 256 }),
  },
  Strict
);
export type KnowledgePublicationTransaction = Static<typeof KnowledgePublicationTransactionSchema>;

/**
 * Reproduce the exact digest T07 binds to an immutable publication generation.
 * Callers use this only to verify a durable generation against the complete,
 * reconstructed transaction; it does not grant publication authority.
 */
export function knowledgePublicationRequestDigestForTransaction(value: unknown): string {
  const decoded = decodeTransaction(value);
  return publicationDigest("transaction", normalizeTransaction(decoded));
}

const KnowledgePublicationRecordCoreSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    recordKind: KnowledgePublicationRecordKindSchema,
    id: SafeIdSchema,
    successorRefs: Type.Array(KnowledgePublicationRecordRefSchema, { maxItems: 256 }),
    content: Type.Unknown(),
  },
  Strict
);

export const KnowledgePublicationRecordSchema = Type.Object(
  { ...KnowledgePublicationRecordCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgePublicationRecord = Static<typeof KnowledgePublicationRecordSchema>;

const KnowledgePublicationGenerationCoreSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: SafeIdSchema,
    revision: RevisionSchema,
    parentGenerationRef: Type.Optional(KnowledgePublicationGenerationRefSchema),
    transactionId: SafeIdSchema,
    writerKind: KnowledgePublicationWriterKindSchema,
    createdAt: IsoTimestampSchema,
    requestDigest: DigestSchema,
    recordRefs: Type.Array(KnowledgePublicationRecordRefSchema),
    newRecordRefs: Type.Array(KnowledgePublicationRecordRefSchema),
  },
  Strict
);

export const KnowledgePublicationGenerationSchema = Type.Object(
  { ...KnowledgePublicationGenerationCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgePublicationGeneration = Static<typeof KnowledgePublicationGenerationSchema>;

export const KnowledgePublicationHeadSchema = Type.Object(
  {
    generationId: SafeIdSchema,
    digest: DigestSchema,
    revision: RevisionSchema,
  },
  Strict
);
export type KnowledgePublicationHead = Static<typeof KnowledgePublicationHeadSchema>;

const PublicationStageIntentCoreSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    generationId: SafeIdSchema,
    transactionId: SafeIdSchema,
    requestDigest: DigestSchema,
    revision: RevisionSchema,
    parentGenerationRef: Type.Union([KnowledgePublicationGenerationRefSchema, Type.Null()]),
    createdAt: IsoTimestampSchema,
  },
  Strict
);
const PublicationStageIntentSchema = Type.Object(
  { ...PublicationStageIntentCoreSchema.properties, digest: DigestSchema },
  Strict
);
type PublicationStageIntent = Static<typeof PublicationStageIntentSchema>;

const PublicationTransactionBindingCoreSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    transactionId: SafeIdSchema,
    requestDigest: DigestSchema,
    generationId: SafeIdSchema,
    boundAt: IsoTimestampSchema,
  },
  Strict
);
const PublicationTransactionBindingSchema = Type.Object(
  { ...PublicationTransactionBindingCoreSchema.properties, digest: DigestSchema },
  Strict
);
type PublicationTransactionBinding = Static<typeof PublicationTransactionBindingSchema>;

export type KnowledgePublicationSnapshot = {
  head: KnowledgePublicationHead;
  generation: KnowledgePublicationGeneration;
  records: KnowledgePublicationRecord[];
};

export type KnowledgePublicationPublishResult = KnowledgePublicationSnapshot & {
  outcome: "committed" | "already_committed";
};

export type KnowledgePublicationOrphan = {
  generationId: string;
  state: "incomplete_staging" | "complete_staging" | "complete_generation";
  transactionId: string | null;
  revision: number | null;
  parentGenerationRef: KnowledgePublicationGenerationRef | null;
  stagedRecordCount: number;
};

export type KnowledgePublicationFault = {
  point:
    | "after_staged_record"
    | "after_staged_generation"
    | "before_head_commit"
    | "after_head_commit";
  generationId: string;
  recordIndex?: number;
  recordId?: string;
};

export type KnowledgePublicationStoreOptions = {
  rootDirectory?: string;
  now?: () => Date;
  hostIdentity?: () => string | null;
  faultInjector?: (fault: KnowledgePublicationFault) => void;
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
  descriptor: number;
  path: string;
  receipt: HeadClaimReceipt;
  serialized: string;
};

type PreparedGeneration = {
  generation: KnowledgePublicationGeneration;
  location: "staging" | "generation";
};

/**
 * Append-only publication transport for canonical knowledge records.
 *
 * Every writer builds an unreachable generation first. Exactly one filesystem
 * compare-and-swap updates the public head; readers never enumerate staging.
 * Old committed generations remain immutable and reachable through parent refs.
 */
export class KnowledgePublicationStore {
  readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly hostIdentity: () => string | null;
  private readonly faultInjector?: (fault: KnowledgePublicationFault) => void;

  constructor(options: KnowledgePublicationStoreOptions = {}) {
    assertAuthorityPathRuntime(
      "authority.validator.knowledge-publication-governance",
      "production"
    );
    this.rootDirectory =
      options.rootDirectory ??
      path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner", "knowledge-publication");
    this.now = options.now ?? (() => new Date());
    this.hostIdentity = options.hostIdentity ?? currentHostIdentity;
    this.faultInjector = options.faultInjector;
  }

  readHead(): KnowledgePublicationHead | null {
    if (existsSync(this.rootDirectory)) {
      assertRealDirectory(this.rootDirectory, "knowledge publication root");
    }
    const file = this.headPath();
    if (!existsSync(file)) return null;
    return decodeHead(readJsonFile(file, "publication head"));
  }

  /** Capture one head and its exact immutable record closure. */
  readCurrent(): KnowledgePublicationSnapshot | null {
    assertAuthorityPathRuntime(
      "authority.validator.knowledge-publication-governance",
      "production"
    );
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const before = this.readHead();
      if (!before) {
        if (!this.readHead()) return null;
        continue;
      }
      const snapshot = this.readGenerationDirect(before.generationId);
      assertHeadMatchesGeneration(before, snapshot.generation);
      const after = this.readHead();
      if (after && sameHead(before, after)) return { ...snapshot, head: before };
    }
    throw new KnowledgePublicationConflictError(
      "Knowledge publication head kept moving during a stable read",
      this.readHead(),
      null
    );
  }

  /** Read a committed current or historical generation; unreachable orphans use listOrphans. */
  readGeneration(generationId: string): KnowledgePublicationSnapshot {
    assertSafeId(generationId, "publication generation ID");
    if (!this.reachableGenerationIds().has(generationId)) {
      throw new KnowledgePublicationNotFoundError(
        `Knowledge publication generation is not reachable: ${generationId}`
      );
    }
    return this.readGenerationDirect(generationId);
  }

  publish(transactionValue: KnowledgePublicationTransaction): KnowledgePublicationPublishResult {
    assertAuthorityPathRuntime(
      "authority.validator.knowledge-publication-governance",
      "production"
    );
    const transaction = decodeTransaction(transactionValue);
    const normalized = normalizeTransaction(transaction);
    const requestDigest = publicationDigest("transaction", normalized);
    const generationId = `publication-generation.${publicationDigest("generation-id", { requestDigest }).slice(0, 32)}`;
    const claim = this.acquireHeadClaim();
    try {
      cleanupKnownTemporaryFiles(this.rootDirectory);
      this.bindTransactionIdentity(transaction.transactionId, requestDigest, generationId);
      this.assertTransactionIdentity(transaction.transactionId, requestDigest);
      const committed = this.committedGenerationIfReachable(generationId, requestDigest);
      if (committed) return { ...committed, outcome: "already_committed" };

      const prepared = this.prepareGeneration(normalized, requestDigest, generationId);
      const liveHead = this.readHead();
      if (this.isGenerationReachable(generationId, liveHead)) {
        return {
          ...this.readGenerationDirect(generationId),
          outcome: "already_committed",
        };
      }
      if (!sameExpectedHead(liveHead, normalized.expectedHead)) {
        throw new KnowledgePublicationConflictError(
          "Knowledge publication head changed before the generation committed",
          liveHead,
          generationId
        );
      }
      assertValidSuccessor(prepared.generation, liveHead, normalized.expectedHead);

      if (prepared.location === "staging") this.finalizeStagedGeneration(generationId);
      this.inject({ point: "before_head_commit", generationId });
      const persisted = this.readGenerationDirect(generationId);
      if (
        persisted.generation.digest !== prepared.generation.digest ||
        persisted.generation.requestDigest !== requestDigest
      ) {
        throw new KnowledgePublicationIntegrityError(
          "Persisted publication generation changed before head commit"
        );
      }
      const nextHead = headFor(persisted.generation);
      writeJsonAtomic(this.headPath(), nextHead);
      this.inject({ point: "after_head_commit", generationId });
      return {
        ...this.readGenerationDirect(generationId),
        head: nextHead,
        outcome: "committed",
      };
    } finally {
      this.releaseHeadClaim(claim);
    }
  }

  listOrphans(): KnowledgePublicationOrphan[] {
    const reachable = this.reachableGenerationIds();
    const orphans: KnowledgePublicationOrphan[] = [];

    for (const generationId of listSafeDirectories(
      this.stagingDirectory(),
      "publication staging"
    )) {
      const directory = this.stagingGenerationPath(generationId);
      const intent = this.tryReadStageIntent(directory);
      const manifestPath = path.join(directory, "generation.json");
      let generation: KnowledgePublicationGeneration | null = null;
      if (existsSync(manifestPath)) generation = this.tryReadGenerationManifest(directory);
      orphans.push({
        generationId,
        state: generation ? "complete_staging" : "incomplete_staging",
        transactionId: generation?.transactionId ?? intent?.transactionId ?? null,
        revision: generation?.revision ?? intent?.revision ?? null,
        parentGenerationRef: generation?.parentGenerationRef ?? intent?.parentGenerationRef ?? null,
        stagedRecordCount: countStagedRecords(directory),
      });
    }

    for (const generationId of listSafeDirectories(
      this.generationsDirectory(),
      "publication generations"
    )) {
      if (reachable.has(generationId)) continue;
      const directory = this.generationPath(generationId);
      const generation = this.tryReadGenerationManifest(directory);
      orphans.push({
        generationId,
        state: "complete_generation",
        transactionId: generation?.transactionId ?? null,
        revision: generation?.revision ?? null,
        parentGenerationRef: generation?.parentGenerationRef ?? null,
        stagedRecordCount: countStagedRecords(directory),
      });
    }

    return orphans.sort((left, right) => compareCodePoints(left.generationId, right.generationId));
  }

  reclaimOrphan(generationId: string): { reclaimed: boolean } {
    assertSafeId(generationId, "publication generation ID");
    const claim = this.acquireHeadClaim();
    try {
      cleanupKnownTemporaryFiles(this.rootDirectory);
      if (this.isGenerationReachable(generationId, this.readHead())) {
        throw new KnowledgePublicationIntegrityError(
          `Committed publication generation cannot be reclaimed: ${generationId}`
        );
      }
      const staging = this.stagingGenerationPath(generationId);
      const generation = this.generationPath(generationId);
      const targets = [staging, generation].filter(existsSync);
      if (targets.length === 0) return { reclaimed: false };
      for (const target of targets) {
        assertRealDirectory(target, "publication orphan");
        rmSync(target, { recursive: true, force: true });
        fsyncDirectory(path.dirname(target));
      }
      return { reclaimed: true };
    } finally {
      this.releaseHeadClaim(claim);
    }
  }

  /**
   * Reclaim only the unreachable generation bound to these exact transaction
   * bytes. This is the safe retry path for a caller that already has an
   * immutable transaction intent; a transaction-ID match alone is not enough
   * authority to delete an orphan.
   */
  reclaimExactTransactionOrphan(transactionValue: KnowledgePublicationTransaction): {
    reclaimed: boolean;
  } {
    assertAuthorityPathRuntime(
      "authority.validator.knowledge-publication-governance",
      "production"
    );
    const transaction = decodeTransaction(transactionValue);
    const normalized = normalizeTransaction(transaction);
    const requestDigest = publicationDigest("transaction", normalized);
    const generationId = `publication-generation.${publicationDigest("generation-id", {
      requestDigest,
    }).slice(0, 32)}`;
    const claim = this.acquireHeadClaim();
    try {
      cleanupKnownTemporaryFiles(this.rootDirectory);
      const liveHead = this.readHead();
      if (this.isGenerationReachable(generationId, liveHead)) {
        const committed = this.readGenerationDirect(generationId);
        if (committed.generation.requestDigest !== requestDigest) {
          throw new KnowledgePublicationIntegrityError(
            "Reachable publication generation does not match its exact retry transaction"
          );
        }
        return { reclaimed: false };
      }

      const staging = this.stagingGenerationPath(generationId);
      const generation = this.generationPath(generationId);
      const targets = [staging, generation].filter(existsSync);
      if (targets.length === 0) return { reclaimed: false };

      const bindingFile = this.transactionBindingPath(transaction.transactionId);
      if (!existsSync(bindingFile)) {
        throw new KnowledgePublicationIntegrityError(
          "Publication orphan lacks its immutable transaction binding"
        );
      }
      const binding = decodeTransactionBinding(
        readJsonFile(bindingFile, "publication transaction binding")
      );
      if (
        binding.transactionId !== transaction.transactionId ||
        binding.requestDigest !== requestDigest ||
        binding.generationId !== generationId
      ) {
        throw new KnowledgePublicationIntegrityError(
          "Publication orphan transaction binding does not match the exact retry"
        );
      }

      if (existsSync(staging)) {
        assertRealDirectory(staging, "publication staging orphan");
        const intent = this.tryReadStageIntent(staging);
        if (
          !intent ||
          intent.generationId !== generationId ||
          intent.transactionId !== transaction.transactionId ||
          intent.requestDigest !== requestDigest ||
          !sameGenerationRef(intent.parentGenerationRef, normalized.expectedHead)
        ) {
          throw new KnowledgePublicationIntegrityError(
            "Publication staging orphan is not the exact requested transaction"
          );
        }
        const manifestFile = path.join(staging, "generation.json");
        if (existsSync(manifestFile)) {
          const manifest = this.readGenerationManifest(staging);
          assertRequestMatchesGeneration(manifest, normalized, requestDigest);
          this.validateGenerationRecords(staging, manifest);
        }
      }
      if (existsSync(generation)) {
        assertRealDirectory(generation, "publication generation orphan");
        const manifest = this.readGenerationManifest(generation);
        assertRequestMatchesGeneration(manifest, normalized, requestDigest);
        this.validateGenerationRecords(generation, manifest);
      }

      for (const target of targets) {
        rmSync(target, { recursive: true, force: true });
        fsyncDirectory(path.dirname(target));
      }
      return { reclaimed: true };
    } finally {
      this.releaseHeadClaim(claim);
    }
  }

  private prepareGeneration(
    transaction: KnowledgePublicationTransaction,
    requestDigest: string,
    generationId: string
  ): PreparedGeneration {
    const generationDirectory = this.generationPath(generationId);
    if (existsSync(generationDirectory)) {
      cleanupKnownTemporaryFiles(generationDirectory);
      const generation = this.tryReadGenerationManifest(generationDirectory);
      if (!generation) {
        throw new KnowledgePublicationRecoveryRequiredError(
          `Publication transaction has a malformed finalized orphan: ${generationId}`
        );
      }
      assertRequestMatchesGeneration(generation, transaction, requestDigest);
      this.validateGenerationRecords(generationDirectory, generation);
      return { generation, location: "generation" };
    }

    const stagingDirectory = this.stagingGenerationPath(generationId);
    if (existsSync(stagingDirectory)) {
      cleanupKnownTemporaryFiles(stagingDirectory);
      const intent = this.tryReadStageIntent(stagingDirectory);
      if (!intent) {
        throw new KnowledgePublicationRecoveryRequiredError(
          `Publication transaction has an incomplete inspectable staging set: ${generationId}`
        );
      }
      if (
        intent.transactionId !== transaction.transactionId ||
        intent.requestDigest !== requestDigest
      ) {
        throw new KnowledgePublicationIntegrityError(
          "Publication staging identity was reused with different transaction bytes"
        );
      }
      const manifestPath = path.join(stagingDirectory, "generation.json");
      if (!existsSync(manifestPath)) {
        throw new KnowledgePublicationRecoveryRequiredError(
          `Publication transaction has an incomplete inspectable staging set: ${generationId}`
        );
      }
      const generation = this.readGenerationManifest(stagingDirectory);
      assertRequestMatchesGeneration(generation, transaction, requestDigest);
      this.validateGenerationRecords(stagingDirectory, generation);
      return { generation, location: "staging" };
    }

    const base = this.baseSnapshot(transaction.expectedHead);
    const recordsById = new Map(base.records.map((record) => [record.id, record] as const));
    const newRecords: KnowledgePublicationRecord[] = [];
    const writesById = new Set<string>();
    for (const write of transaction.writes) {
      if (writesById.has(write.id)) {
        throw new KnowledgePublicationIntegrityError(
          `Publication transaction writes record ID more than once: ${write.id}`
        );
      }
      writesById.add(write.id);
      const core = {
        schemaVersion: 1 as const,
        recordKind: write.recordKind,
        id: write.id,
        successorRefs: sortRecordRefs(write.successorRefs),
        content: structuredClone(write.content),
      };
      const record = decodeRecord({ ...core, digest: publicationDigest("record", core) });
      const existing = recordsById.get(record.id);
      if (existing) {
        if (existing.digest !== record.digest || existing.recordKind !== record.recordKind) {
          throw new KnowledgePublicationIntegrityError(
            `Cannot mutate immutable publication record ID ${record.id}; publish a successor`
          );
        }
        continue;
      }
      recordsById.set(record.id, record);
      newRecords.push(record);
    }

    for (const record of newRecords) {
      for (const predecessor of record.successorRefs) {
        const target = recordsById.get(predecessor.id);
        if (!target || !sameRecordRef(predecessor, target) || predecessor.id === record.id) {
          throw new KnowledgePublicationIntegrityError(
            `Publication successor ${record.id} references an absent or invalid predecessor`
          );
        }
      }
    }

    const createdAt = this.now().toISOString();
    if (!Value.Check(IsoTimestampSchema, createdAt)) {
      throw new KnowledgePublicationIntegrityError(
        "Publication clock did not produce a canonical UTC timestamp"
      );
    }
    const parentGenerationRef = transaction.expectedHead ?? undefined;
    const core = {
      schemaVersion: 1 as const,
      id: generationId,
      revision: (transaction.expectedHead?.revision ?? 0) + 1,
      ...(parentGenerationRef ? { parentGenerationRef } : {}),
      transactionId: transaction.transactionId,
      writerKind: transaction.writerKind,
      createdAt,
      requestDigest,
      recordRefs: sortRecordRefs([...recordsById.values()].map(recordRef)),
      newRecordRefs: sortRecordRefs(newRecords.map(recordRef)),
    };
    const generation = decodeGeneration({
      ...core,
      digest: publicationDigest("generation", core),
    });
    const intentCore = {
      schemaVersion: 1 as const,
      generationId,
      transactionId: transaction.transactionId,
      requestDigest,
      revision: generation.revision,
      parentGenerationRef: transaction.expectedHead,
      createdAt,
    };
    const intent = decodeStageIntent({
      ...intentCore,
      digest: publicationDigest("stage-intent", intentCore),
    });

    ensureRealDirectory(this.stagingDirectory());
    try {
      mkdirSync(stagingDirectory, { mode: 0o700 });
      assertRealDirectory(stagingDirectory, "publication staging generation");
    } catch (error) {
      if (isFileExistsError(error)) {
        throw new KnowledgePublicationRecoveryRequiredError(
          `Publication staging appeared concurrently: ${generationId}`
        );
      }
      throw error;
    }
    fsyncDirectory(this.stagingDirectory());
    writeImmutableJson(path.join(stagingDirectory, "intent.json"), intent);
    const recordsDirectory = path.join(stagingDirectory, "records");
    mkdirSync(recordsDirectory, { mode: 0o700 });
    assertRealDirectory(recordsDirectory, "publication staging records");
    fsyncDirectory(stagingDirectory);
    for (let index = 0; index < newRecords.length; index += 1) {
      const record = newRecords[index]!;
      writeImmutableJson(path.join(recordsDirectory, `${record.digest}.json`), record);
      this.inject({
        point: "after_staged_record",
        generationId,
        recordIndex: index,
        recordId: record.id,
      });
    }
    writeImmutableJson(path.join(stagingDirectory, "generation.json"), generation);
    this.inject({ point: "after_staged_generation", generationId });
    return { generation, location: "staging" };
  }

  private baseSnapshot(expectedHead: KnowledgePublicationGenerationRef | null): {
    generation: KnowledgePublicationGeneration | null;
    records: KnowledgePublicationRecord[];
  } {
    if (!expectedHead) return { generation: null, records: [] };
    const snapshot = this.readGenerationDirect(expectedHead.id);
    if (
      snapshot.generation.digest !== expectedHead.digest ||
      snapshot.generation.revision !== expectedHead.revision
    ) {
      throw new KnowledgePublicationIntegrityError(
        "Expected publication head does not identify exact immutable generation bytes"
      );
    }
    return { generation: snapshot.generation, records: snapshot.records };
  }

  private finalizeStagedGeneration(generationId: string): void {
    const source = this.stagingGenerationPath(generationId);
    const target = this.generationPath(generationId);
    assertRealDirectory(source, "complete publication staging generation");
    cleanupKnownTemporaryFiles(source);
    const generation = this.readGenerationManifest(source);
    this.validateGenerationRecords(source, generation);
    ensureRealDirectory(this.generationsDirectory());
    if (existsSync(target)) {
      throw new KnowledgePublicationIntegrityError(
        `Publication generation destination already exists: ${generationId}`
      );
    }
    renameSync(source, target);
    fsyncDirectory(this.stagingDirectory());
    fsyncDirectory(this.generationsDirectory());
  }

  private committedGenerationIfReachable(
    generationId: string,
    requestDigest: string
  ): KnowledgePublicationSnapshot | null {
    const head = this.readHead();
    if (!this.isGenerationReachable(generationId, head)) return null;
    const snapshot = this.readGenerationDirect(generationId);
    if (snapshot.generation.requestDigest !== requestDigest) {
      throw new KnowledgePublicationIntegrityError(
        "Committed publication generation request digest does not match its retry"
      );
    }
    return snapshot;
  }

  private bindTransactionIdentity(
    transactionId: string,
    requestDigest: string,
    generationId: string
  ): void {
    ensureRealDirectory(this.transactionsDirectory());
    const file = this.transactionBindingPath(transactionId);
    if (existsSync(file)) {
      const existing = decodeTransactionBinding(
        readJsonFile(file, "publication transaction binding")
      );
      if (
        existing.transactionId !== transactionId ||
        existing.requestDigest !== requestDigest ||
        existing.generationId !== generationId
      ) {
        throw new KnowledgePublicationIntegrityError(
          `Publication transaction ID was reused with different bytes: ${transactionId}`
        );
      }
      return;
    }
    const boundAt = this.now().toISOString();
    const core = {
      schemaVersion: 1 as const,
      transactionId,
      requestDigest,
      generationId,
      boundAt,
    };
    writeImmutableJson(file, {
      ...core,
      digest: publicationDigest("transaction-binding", core),
    });
  }

  private assertTransactionIdentity(transactionId: string, requestDigest: string): void {
    const binding = decodeTransactionBinding(
      readJsonFile(this.transactionBindingPath(transactionId), "publication transaction binding")
    );
    if (binding.transactionId !== transactionId || binding.requestDigest !== requestDigest) {
      throw new KnowledgePublicationIntegrityError(
        `Publication transaction ID was reused with different bytes: ${transactionId}`
      );
    }
    for (const generationId of listSafeDirectories(
      this.stagingDirectory(),
      "publication staging"
    )) {
      const intent = this.tryReadStageIntent(this.stagingGenerationPath(generationId));
      if (!intent) continue;
      if (intent.transactionId === transactionId && intent.requestDigest !== requestDigest) {
        throw new KnowledgePublicationIntegrityError(
          `Publication transaction ID was reused with different bytes: ${transactionId}`
        );
      }
    }
    for (const generationId of listSafeDirectories(
      this.generationsDirectory(),
      "publication generations"
    )) {
      const generation = this.readGenerationManifest(this.generationPath(generationId));
      if (
        generation.transactionId === transactionId &&
        generation.requestDigest !== requestDigest
      ) {
        throw new KnowledgePublicationIntegrityError(
          `Publication transaction ID was reused with different bytes: ${transactionId}`
        );
      }
    }
  }

  private readGenerationDirect(generationId: string): KnowledgePublicationSnapshot {
    assertSafeId(generationId, "publication generation ID");
    const target = this.readGenerationManifest(this.generationPath(generationId));
    const lineage: KnowledgePublicationGeneration[] = [];
    const visited = new Set<string>();
    let cursor: KnowledgePublicationGeneration | null = target;
    while (cursor) {
      if (visited.has(cursor.id)) {
        throw new KnowledgePublicationIntegrityError(
          `Publication generation history contains a cycle at ${cursor.id}`
        );
      }
      visited.add(cursor.id);
      lineage.push(cursor);
      if (!cursor.parentGenerationRef) break;
      const parent = this.readGenerationManifest(
        this.generationPath(cursor.parentGenerationRef.id)
      );
      if (
        parent.digest !== cursor.parentGenerationRef.digest ||
        parent.revision !== cursor.parentGenerationRef.revision ||
        parent.revision + 1 !== cursor.revision
      ) {
        throw new KnowledgePublicationIntegrityError(
          `Publication generation parent binding is invalid for ${cursor.id}`
        );
      }
      cursor = parent;
    }
    const recordsById = new Map<string, KnowledgePublicationRecord>();
    for (const generation of lineage.reverse()) {
      const directory = this.generationPath(generation.id);
      this.validateGenerationRecords(directory, generation);
      for (const ref of generation.newRecordRefs) {
        const record = this.readGenerationRecord(directory, ref);
        if (recordsById.has(record.id)) {
          throw new KnowledgePublicationIntegrityError(
            `Publication lineage reuses immutable record ID ${record.id}`
          );
        }
        recordsById.set(record.id, record);
      }
      const actualRefs = sortRecordRefs([...recordsById.values()].map(recordRef));
      if (canonicalReferenceJson(actualRefs) !== canonicalReferenceJson(generation.recordRefs)) {
        throw new KnowledgePublicationIntegrityError(
          `Publication generation record closure mismatch for ${generation.id}`
        );
      }
    }
    const records = [...recordsById.values()].sort(compareRecords);
    for (const record of records) {
      for (const predecessor of record.successorRefs) {
        const targetRecord = recordsById.get(predecessor.id);
        if (!targetRecord || !sameRecordRef(predecessor, targetRecord)) {
          throw new KnowledgePublicationIntegrityError(
            `Publication successor relationship is unresolved for ${record.id}`
          );
        }
      }
    }
    return { head: headFor(target), generation: target, records };
  }

  private validateGenerationRecords(
    directory: string,
    generation: KnowledgePublicationGeneration
  ): void {
    assertRealDirectory(directory, "publication generation");
    const expected = new Set(generation.newRecordRefs.map((ref) => `${ref.digest}.json`));
    const recordsDirectory = path.join(directory, "records");
    const actual = listRegularFiles(recordsDirectory, "publication generation records");
    if (actual.length !== expected.size || actual.some((name) => !expected.has(name))) {
      throw new KnowledgePublicationIntegrityError(
        `Publication generation ${generation.id} has an incomplete or unexpected record set`
      );
    }
    for (const ref of generation.newRecordRefs) this.readGenerationRecord(directory, ref);
  }

  private readGenerationRecord(
    directory: string,
    ref: KnowledgePublicationRecordRef
  ): KnowledgePublicationRecord {
    const record = decodeRecord(
      readJsonFile(path.join(directory, "records", `${ref.digest}.json`), "publication record")
    );
    if (!sameRecordRef(ref, record)) {
      throw new KnowledgePublicationIntegrityError(
        `Publication record bytes do not match generation ref ${ref.id}`
      );
    }
    return record;
  }

  private readGenerationManifest(directory: string): KnowledgePublicationGeneration {
    assertRealDirectory(directory, "publication generation");
    const generation = decodeGeneration(
      readJsonFile(path.join(directory, "generation.json"), "publication generation manifest")
    );
    if (path.basename(directory) !== generation.id) {
      throw new KnowledgePublicationIntegrityError(
        "Publication generation directory does not match manifest identity"
      );
    }
    return generation;
  }

  private readStageIntent(directory: string): PublicationStageIntent {
    assertRealDirectory(directory, "publication staging generation");
    const intent = decodeStageIntent(
      readJsonFile(path.join(directory, "intent.json"), "publication stage intent")
    );
    if (path.basename(directory) !== intent.generationId) {
      throw new KnowledgePublicationIntegrityError(
        "Publication staging directory does not match its intent identity"
      );
    }
    return intent;
  }

  private tryReadStageIntent(directory: string): PublicationStageIntent | null {
    try {
      return this.readStageIntent(directory);
    } catch (error) {
      if (
        error instanceof KnowledgePublicationIntegrityError ||
        error instanceof KnowledgePublicationNotFoundError
      ) {
        return null;
      }
      throw error;
    }
  }

  private tryReadGenerationManifest(directory: string): KnowledgePublicationGeneration | null {
    try {
      return this.readGenerationManifest(directory);
    } catch (error) {
      if (
        error instanceof KnowledgePublicationIntegrityError ||
        error instanceof KnowledgePublicationNotFoundError
      ) {
        return null;
      }
      throw error;
    }
  }

  private reachableGenerationIds(): Set<string> {
    const reachable = new Set<string>();
    let head = this.readHead();
    while (head) {
      if (reachable.has(head.generationId)) {
        throw new KnowledgePublicationIntegrityError(
          `Publication head history contains a cycle at ${head.generationId}`
        );
      }
      reachable.add(head.generationId);
      const generation = this.readGenerationManifest(this.generationPath(head.generationId));
      assertHeadMatchesGeneration(head, generation);
      head = generation.parentGenerationRef
        ? {
            generationId: generation.parentGenerationRef.id,
            digest: generation.parentGenerationRef.digest,
            revision: generation.parentGenerationRef.revision,
          }
        : null;
    }
    return reachable;
  }

  private isGenerationReachable(
    generationId: string,
    head: KnowledgePublicationHead | null
  ): boolean {
    const visited = new Set<string>();
    let cursor = head;
    while (cursor) {
      if (visited.has(cursor.generationId)) {
        throw new KnowledgePublicationIntegrityError(
          `Publication head history contains a cycle at ${cursor.generationId}`
        );
      }
      visited.add(cursor.generationId);
      const generation = this.readGenerationManifest(this.generationPath(cursor.generationId));
      assertHeadMatchesGeneration(cursor, generation);
      if (cursor.generationId === generationId) return true;
      cursor = generation.parentGenerationRef
        ? {
            generationId: generation.parentGenerationRef.id,
            digest: generation.parentGenerationRef.digest,
            revision: generation.parentGenerationRef.revision,
          }
        : null;
    }
    return false;
  }

  private acquireHeadClaim(attempt = 0): HeadClaim {
    ensureRealDirectory(this.rootDirectory);
    if (this.recoveryClaimPaths().length > 0) {
      const recoveryClaim = this.acquireRecoveryClaim();
      if (!recoveryClaim) {
        if (attempt < 250) {
          waitForClaimRetry();
          return this.acquireHeadClaim(attempt + 1);
        }
        throw new KnowledgePublicationConflictError(
          "Knowledge publication head recovery is in progress",
          this.readHead(),
          null
        );
      }
      this.releaseOwnedClaim(recoveryClaim);
    }
    try {
      const claim = this.createOwnedClaim(this.headClaimPath());
      if (this.recoveryClaimPaths().length > 0) {
        this.releaseOwnedClaim(claim);
        if (attempt < 250) {
          waitForClaimRetry();
          return this.acquireHeadClaim(attempt + 1);
        }
        throw new KnowledgePublicationConflictError(
          "Knowledge publication head recovery raced this writer",
          this.readHead(),
          null
        );
      }
      return claim;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      if (!this.recoverAbsentHeadClaimOwner()) {
        if (attempt < 250) {
          waitForClaimRetry();
          return this.acquireHeadClaim(attempt + 1);
        }
        throw new KnowledgePublicationConflictError(
          "Another knowledge publication writer owns the head claim",
          this.readHead(),
          null
        );
      }
      if (attempt > 250) {
        throw new KnowledgePublicationConflictError(
          "Knowledge publication head claim kept changing during recovery",
          this.readHead(),
          null
        );
      }
      return this.acquireHeadClaim(attempt + 1);
    }
  }

  private recoverAbsentHeadClaimOwner(): boolean {
    const recovery = this.acquireRecoveryClaim();
    if (!recovery) return false;
    try {
      if (!pathEntryExists(this.headClaimPath())) return true;
      return this.recoverStaleOwnedClaim(this.headClaimPath(), "head-claim");
    } finally {
      this.releaseOwnedClaim(recovery);
    }
  }

  private acquireRecoveryClaim(): HeadClaim | null {
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

  private createOwnedClaim(file: string): HeadClaim {
    const stableHostIdentity = this.hostIdentity();
    if (stableHostIdentity !== null && !isStableHostIdentity(stableHostIdentity)) {
      throw new KnowledgePublicationIntegrityError(
        "Stable publication-claim host identity must be a SHA-256 digest"
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
    const directory = path.dirname(file);
    const temporary = path.join(directory, `.head-claim.${randomUUID()}.tmp`);
    let descriptor: number | undefined;
    let published = false;
    try {
      descriptor = openSync(
        temporary,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
        0o600
      );
      if (!fstatSync(descriptor).isFile()) {
        throw new KnowledgePublicationIntegrityError(
          "Publication claim temporary target is not a regular file"
        );
      }
      writeFileSync(descriptor, serialized);
      fsyncSync(descriptor);
      // The public claim name appears only after its complete receipt is durable.
      // Hard-link creation is an atomic no-replace operation across processes.
      linkSync(temporary, file);
      published = true;
      fsyncDirectory(directory);
      unlinkSync(temporary);
      fsyncDirectory(directory);
      return { descriptor, path: file, receipt, serialized };
    } catch (error) {
      if (published && descriptor !== undefined && pathMatchesDescriptor(file, descriptor)) {
        unlinkSync(file);
        fsyncDirectory(directory);
      }
      if (descriptor !== undefined) closeSync(descriptor);
      rmSync(temporary, { force: true });
      throw error;
    }
  }

  private recoverStaleOwnedClaim(file: string, kind: string): boolean {
    if (!pathEntryExists(file)) return true;
    let descriptor: number;
    try {
      descriptor = openSync(file, fsConstants.O_RDONLY | noFollowFlag());
    } catch (error) {
      if (isFileMissingError(error)) return true;
      throw new KnowledgePublicationIntegrityError(
        `Publication ${kind} could not be opened without following links`
      );
    }
    try {
      if (!pathMatchesDescriptor(file, descriptor)) {
        throw new KnowledgePublicationIntegrityError(
          `Publication ${kind} is not one stable regular file`
        );
      }
      const original = readFileSync(descriptor, "utf8");
      if (readCanonicalJsonBytes(file, `publication ${kind}`) !== original) return false;
      const receipt = decodeHeadClaim(JSON.parse(original));
      if (!claimOwnerIsProvablyAbsent(receipt, this.hostIdentity)) return false;
      // Establish the durable receipt destination before moving the stale
      // claim away from its public name. A bad or substituted recovery path
      // must not consume the only evidence that serialized writers.
      ensureRealDirectory(this.recoveriesDirectory());
      const quarantine = `${file}.orphan.${randomUUID()}`;
      renameSync(file, quarantine);
      let quarantineOwned = false;
      let recoveryReceiptPublished = false;
      try {
        if (
          !pathMatchesDescriptor(quarantine, descriptor) ||
          readCanonicalJsonBytes(quarantine, `quarantined publication ${kind}`) !== original
        ) {
          throw new KnowledgePublicationIntegrityError(
            `Recovered publication ${kind} bytes changed during guarded rename`
          );
        }
        quarantineOwned = true;
        writeJsonAtomic(path.join(this.recoveriesDirectory(), `${kind}.${randomUUID()}.json`), {
          schemaVersion: 1,
          kind,
          recoveredClaimDigest: createHash("sha256").update(original).digest("hex"),
          absentOwner: {
            pid: receipt.pid,
            hostIdentity: receipt.hostIdentity,
            bootIdentity: receipt.bootIdentity,
            processStartIdentity: receipt.processStartIdentity,
          },
          recoveredAt: this.now().toISOString(),
        });
        recoveryReceiptPublished = true;
        return true;
      } finally {
        if (quarantineOwned && pathMatchesDescriptor(quarantine, descriptor)) {
          if (recoveryReceiptPublished) unlinkSync(quarantine);
          else if (!pathEntryExists(file)) renameSync(quarantine, file);
        }
        fsyncDirectory(this.rootDirectory);
      }
    } finally {
      closeSync(descriptor);
    }
  }

  private releaseHeadClaim(claim: HeadClaim): void {
    this.releaseOwnedClaim(claim);
  }

  private releaseOwnedClaim(claim: HeadClaim): void {
    if (
      !pathEntryExists(claim.path) ||
      !pathMatchesDescriptor(claim.path, claim.descriptor) ||
      readCanonicalJsonBytes(claim.path, "publication head claim") !== claim.serialized
    ) {
      closeSync(claim.descriptor);
      throw new KnowledgePublicationIntegrityError(
        "Knowledge publication head claim ownership changed before release"
      );
    }
    closeSync(claim.descriptor);
    rmSync(claim.path, { force: true });
    fsyncDirectory(path.dirname(claim.path));
  }

  private inject(fault: KnowledgePublicationFault): void {
    this.faultInjector?.(fault);
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

  private recoveryTicketPath(): string {
    return path.join(this.rootDirectory, `.head.claim.recovery.${randomUUID()}`);
  }

  private recoveryClaimPaths(): string[] {
    const legacy = this.recoveryClaimPath();
    const claims = pathEntryExists(legacy) ? [legacy] : [];
    for (const entry of readdirSync(this.rootDirectory, { withFileTypes: true })) {
      if (!/^\.head\.claim\.recovery\.[0-9a-f-]{36}$/.test(entry.name)) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new KnowledgePublicationIntegrityError(
          "Knowledge publication recovery ticket is not a regular file"
        );
      }
      claims.push(path.join(this.rootDirectory, entry.name));
    }
    return claims.sort();
  }

  private stagingDirectory(): string {
    return path.join(this.rootDirectory, "staging");
  }

  private generationsDirectory(): string {
    return path.join(this.rootDirectory, "generations");
  }

  private transactionsDirectory(): string {
    return path.join(this.rootDirectory, "transactions");
  }

  private recoveriesDirectory(): string {
    return path.join(this.rootDirectory, "recoveries");
  }

  private transactionBindingPath(transactionId: string): string {
    assertSafeId(transactionId, "publication transaction ID");
    return path.join(this.transactionsDirectory(), `${transactionId}.json`);
  }

  private stagingGenerationPath(generationId: string): string {
    assertSafeId(generationId, "publication generation ID");
    return path.join(this.stagingDirectory(), generationId);
  }

  private generationPath(generationId: string): string {
    assertSafeId(generationId, "publication generation ID");
    return path.join(this.generationsDirectory(), generationId);
  }
}

export class KnowledgePublicationConflictError extends Error {
  constructor(
    message: string,
    readonly currentHead: KnowledgePublicationHead | null,
    readonly orphanGenerationId: string | null
  ) {
    super(message);
    this.name = "KnowledgePublicationConflictError";
  }
}

export class KnowledgePublicationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgePublicationNotFoundError";
  }
}

export class KnowledgePublicationIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgePublicationIntegrityError";
  }
}

export class KnowledgePublicationRecoveryRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgePublicationRecoveryRequiredError";
  }
}

function decodeTransaction(value: unknown): KnowledgePublicationTransaction {
  try {
    return Value.Decode(KnowledgePublicationTransactionSchema, value);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication transaction failed schema validation: ${errorMessage(error)}`
    );
  }
}

function normalizeTransaction(
  value: KnowledgePublicationTransaction
): KnowledgePublicationTransaction {
  const writes = value.writes
    .map((write) => ({
      recordKind: write.recordKind,
      id: write.id,
      successorRefs: sortRecordRefs(write.successorRefs),
      content: structuredClone(write.content),
    }))
    .sort(
      (left, right) =>
        compareCodePoints(left.recordKind, right.recordKind) || compareCodePoints(left.id, right.id)
    );
  // Canonicalization rejects non-JSON values before any filesystem side effect.
  canonicalReferenceJson(writes);
  return {
    schemaVersion: 1,
    transactionId: value.transactionId,
    writerKind: value.writerKind,
    expectedHead: value.expectedHead ? { ...value.expectedHead } : null,
    writes,
  };
}

function decodeRecord(value: unknown): KnowledgePublicationRecord {
  let decoded: KnowledgePublicationRecord;
  try {
    decoded = Value.Decode(KnowledgePublicationRecordSchema, value);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication record failed schema validation: ${errorMessage(error)}`
    );
  }
  const { digest, ...core } = decoded;
  if (publicationDigest("record", core) !== digest) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication record digest mismatch for ${decoded.id}`
    );
  }
  assertUniqueRecordRefs(decoded.successorRefs, `${decoded.id} successor refs`);
  if (
    canonicalReferenceJson(decoded.successorRefs) !==
    canonicalReferenceJson(sortRecordRefs(decoded.successorRefs))
  ) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication successor refs are not canonical for ${decoded.id}`
    );
  }
  return decoded;
}

function decodeGeneration(value: unknown): KnowledgePublicationGeneration {
  let decoded: KnowledgePublicationGeneration;
  try {
    decoded = Value.Decode(KnowledgePublicationGenerationSchema, value);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication generation failed schema validation: ${errorMessage(error)}`
    );
  }
  const { digest, ...core } = decoded;
  if (publicationDigest("generation", core) !== digest) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication generation digest mismatch for ${decoded.id}`
    );
  }
  assertUniqueRecordRefs(decoded.recordRefs, `${decoded.id} record refs`);
  assertUniqueRecordRefs(decoded.newRecordRefs, `${decoded.id} new-record refs`);
  if (
    canonicalReferenceJson(decoded.recordRefs) !==
      canonicalReferenceJson(sortRecordRefs(decoded.recordRefs)) ||
    canonicalReferenceJson(decoded.newRecordRefs) !==
      canonicalReferenceJson(sortRecordRefs(decoded.newRecordRefs))
  ) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication generation refs are not canonical for ${decoded.id}`
    );
  }
  const closure = new Set(decoded.recordRefs.map(recordRefKey));
  if (decoded.newRecordRefs.some((ref) => !closure.has(recordRefKey(ref)))) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication generation has a new record outside its closure: ${decoded.id}`
    );
  }
  return decoded;
}

function decodeHead(value: unknown): KnowledgePublicationHead {
  try {
    return Value.Decode(KnowledgePublicationHeadSchema, value);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication head failed schema validation: ${errorMessage(error)}`
    );
  }
}

function decodeStageIntent(value: unknown): PublicationStageIntent {
  let decoded: PublicationStageIntent;
  try {
    decoded = Value.Decode(PublicationStageIntentSchema, value);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication stage intent failed schema validation: ${errorMessage(error)}`
    );
  }
  const { digest, ...core } = decoded;
  if (publicationDigest("stage-intent", core) !== digest) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication stage intent digest mismatch for ${decoded.generationId}`
    );
  }
  return decoded;
}

function decodeTransactionBinding(value: unknown): PublicationTransactionBinding {
  let decoded: PublicationTransactionBinding;
  try {
    decoded = Value.Decode(PublicationTransactionBindingSchema, value);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication transaction binding failed schema validation: ${errorMessage(error)}`
    );
  }
  const { digest, ...core } = decoded;
  if (publicationDigest("transaction-binding", core) !== digest) {
    throw new KnowledgePublicationIntegrityError(
      `Knowledge publication transaction binding digest mismatch for ${decoded.transactionId}`
    );
  }
  return decoded;
}

function assertRequestMatchesGeneration(
  generation: KnowledgePublicationGeneration,
  transaction: KnowledgePublicationTransaction,
  requestDigest: string
): void {
  if (
    generation.transactionId !== transaction.transactionId ||
    generation.writerKind !== transaction.writerKind ||
    generation.requestDigest !== requestDigest ||
    !sameGenerationRef(generation.parentGenerationRef ?? null, transaction.expectedHead)
  ) {
    throw new KnowledgePublicationIntegrityError(
      "Publication generation does not match the exact transaction retry"
    );
  }
}

function assertValidSuccessor(
  generation: KnowledgePublicationGeneration,
  currentHead: KnowledgePublicationHead | null,
  expectedHead: KnowledgePublicationGenerationRef | null
): void {
  if (!currentHead) {
    if (expectedHead || generation.parentGenerationRef || generation.revision !== 1) {
      throw new KnowledgePublicationIntegrityError(
        "The first publication generation must be revision 1 with no parent"
      );
    }
    return;
  }
  if (
    !expectedHead ||
    !generation.parentGenerationRef ||
    !sameGenerationRef(generation.parentGenerationRef, expectedHead) ||
    generation.revision !== currentHead.revision + 1
  ) {
    throw new KnowledgePublicationIntegrityError(
      "Knowledge publication generation is not an exact successor of the expected head"
    );
  }
}

function assertHeadMatchesGeneration(
  head: KnowledgePublicationHead,
  generation: KnowledgePublicationGeneration
): void {
  if (
    head.generationId !== generation.id ||
    head.digest !== generation.digest ||
    head.revision !== generation.revision
  ) {
    throw new KnowledgePublicationIntegrityError(
      "Knowledge publication head does not match its immutable generation"
    );
  }
}

function headFor(generation: KnowledgePublicationGeneration): KnowledgePublicationHead {
  return {
    generationId: generation.id,
    digest: generation.digest,
    revision: generation.revision,
  };
}

function recordRef(record: KnowledgePublicationRecord): KnowledgePublicationRecordRef {
  return { recordKind: record.recordKind, id: record.id, digest: record.digest };
}

function sameRecordRef(
  left: KnowledgePublicationRecordRef,
  right: KnowledgePublicationRecordRef
): boolean {
  return (
    left.recordKind === right.recordKind && left.id === right.id && left.digest === right.digest
  );
}

function sameGenerationRef(
  left: KnowledgePublicationGenerationRef | null,
  right: KnowledgePublicationGenerationRef | null
): boolean {
  if (!left || !right) return left === right;
  return left.id === right.id && left.digest === right.digest && left.revision === right.revision;
}

function sameExpectedHead(
  actual: KnowledgePublicationHead | null,
  expected: KnowledgePublicationGenerationRef | null
): boolean {
  if (!actual || !expected) return actual === null && expected === null;
  return (
    actual.generationId === expected.id &&
    actual.digest === expected.digest &&
    actual.revision === expected.revision
  );
}

function sameHead(left: KnowledgePublicationHead, right: KnowledgePublicationHead): boolean {
  return (
    left.generationId === right.generationId &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function sortRecordRefs<T extends KnowledgePublicationRecordRef>(refs: readonly T[]): T[] {
  return [...refs].sort(
    (left, right) =>
      compareCodePoints(left.recordKind, right.recordKind) ||
      compareCodePoints(left.id, right.id) ||
      compareCodePoints(left.digest, right.digest)
  );
}

function compareRecords(
  left: KnowledgePublicationRecord,
  right: KnowledgePublicationRecord
): number {
  return (
    compareCodePoints(left.recordKind, right.recordKind) ||
    compareCodePoints(left.id, right.id) ||
    compareCodePoints(left.digest, right.digest)
  );
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertUniqueRecordRefs(refs: KnowledgePublicationRecordRef[], label: string): void {
  const keys = refs.map(recordRefKey);
  if (new Set(keys).size !== keys.length) {
    throw new KnowledgePublicationIntegrityError(`${label} contains duplicate refs`);
  }
}

function recordRefKey(ref: KnowledgePublicationRecordRef): string {
  return `${ref.recordKind}:${ref.id}:${ref.digest}`;
}

function publicationDigest(domain: string, value: unknown): string {
  return createHash("sha256")
    .update("vellum.knowledge-publication.v1\u0000")
    .update(domain)
    .update("\u0000")
    .update(canonicalReferenceJson(value))
    .digest("hex");
}

function writeImmutableJson(file: string, value: unknown): void {
  const serialized = `${canonicalReferenceJson(value)}\n`;
  const directory = path.dirname(file);
  ensureRealDirectory(directory);
  const temporary = path.join(directory, `.pending.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
      0o600
    );
    if (!fstatSync(descriptor).isFile()) {
      throw new KnowledgePublicationIntegrityError(
        "Immutable publication temporary target is not a regular file"
      );
    }
    writeFileSync(descriptor, serialized);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try {
      linkSync(temporary, file);
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      const existing = readCanonicalJsonBytes(file, "immutable publication file");
      if (existing !== serialized) {
        throw new KnowledgePublicationIntegrityError(
          `Immutable publication file was reused with different bytes: ${file}`
        );
      }
      return;
    }
    fsyncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      descriptor = undefined;
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      unlinkSync(temporary);
      fsyncDirectory(directory);
    } catch (error) {
      if (!isFileMissingError(error)) throw error;
    }
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  const directory = path.dirname(file);
  ensureRealDirectory(directory);
  const temporary = path.join(directory, `.pending.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
      0o600
    );
    if (!fstatSync(descriptor).isFile()) {
      throw new KnowledgePublicationIntegrityError(
        "Atomic publication temporary target is not a regular file"
      );
    }
    writeFileSync(descriptor, `${canonicalReferenceJson(value)}\n`);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, file);
    fsyncDirectory(directory);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporary, { force: true });
  }
}

function readJsonFile(file: string, label: string): unknown {
  const raw = readCanonicalJsonBytes(file, label);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new KnowledgePublicationIntegrityError(
      `${label} is not valid JSON: ${errorMessage(error)}`
    );
  }
}

function readCanonicalJsonBytes(file: string, label: string): string {
  if (!existsSync(file)) throw new KnowledgePublicationNotFoundError(`Missing ${label}: ${file}`);
  assertRealDirectory(path.dirname(file), `${label} parent directory`);
  let descriptor: number;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | noFollowFlag());
  } catch (error) {
    if (isFileMissingError(error)) {
      throw new KnowledgePublicationNotFoundError(`Missing ${label}: ${file}`);
    }
    throw new KnowledgePublicationIntegrityError(
      `${label} could not be opened without following links`
    );
  }
  try {
    const opened = fstatSync(descriptor);
    const named = lstatSync(file);
    if (
      !opened.isFile() ||
      named.isSymbolicLink() ||
      !named.isFile() ||
      opened.dev !== named.dev ||
      opened.ino !== named.ino
    ) {
      throw new KnowledgePublicationIntegrityError(`${label} must be one stable regular file`);
    }
    const raw = readFileSync(descriptor, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new KnowledgePublicationIntegrityError(
        `${label} is not valid JSON: ${errorMessage(error)}`
      );
    }
    if (raw !== `${canonicalReferenceJson(parsed)}\n`) {
      throw new KnowledgePublicationIntegrityError(`${label} bytes are not canonical JSON`);
    }
    return raw;
  } finally {
    closeSync(descriptor);
  }
}

function listSafeDirectories(directory: string, label: string): string[] {
  if (!existsSync(directory)) return [];
  assertRealDirectory(directory, label);
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new KnowledgePublicationIntegrityError(`${label} contains a non-directory entry`);
      }
      assertSafeId(entry.name, `${label} entry`);
      return entry.name;
    })
    .sort();
}

function listRegularFiles(directory: string, label: string): string[] {
  if (!existsSync(directory)) {
    throw new KnowledgePublicationIntegrityError(`${label} directory is missing`);
  }
  assertRealDirectory(directory, label);
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) {
        throw new KnowledgePublicationIntegrityError(`${label} contains an unexpected entry`);
      }
      return entry.name;
    })
    .sort();
}

function countStagedRecords(directory: string): number {
  const records = path.join(directory, "records");
  if (!existsSync(records)) return 0;
  assertRealDirectory(records, "publication staged records");
  let count = 0;
  for (const entry of readdirSync(records, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new KnowledgePublicationIntegrityError(
        "Publication staged records contain a non-regular entry"
      );
    }
    if (/^[a-f0-9]{64}\.json$/.test(entry.name)) count += 1;
    else if (!isKnownTemporaryName(entry.name)) {
      throw new KnowledgePublicationIntegrityError(
        "Publication staged records contain an unexpected entry"
      );
    }
  }
  return count;
}

function assertRealDirectory(directory: string, label: string): void {
  if (!existsSync(directory)) {
    throw new KnowledgePublicationNotFoundError(`Missing ${label}: ${directory}`);
  }
  const named = lstatSync(directory);
  if (!named.isDirectory() || named.isSymbolicLink()) {
    throw new KnowledgePublicationIntegrityError(`${label} must be a real directory`);
  }
  let descriptor: number;
  try {
    descriptor = openSync(directory, fsConstants.O_RDONLY | directoryFlag() | noFollowFlag());
  } catch {
    throw new KnowledgePublicationIntegrityError(
      `${label} could not be opened as a real directory`
    );
  }
  try {
    const opened = fstatSync(descriptor);
    const current = lstatSync(directory);
    if (
      !opened.isDirectory() ||
      current.isSymbolicLink() ||
      !current.isDirectory() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino
    ) {
      throw new KnowledgePublicationIntegrityError(`${label} changed during validation`);
    }
  } finally {
    closeSync(descriptor);
  }
}

function ensureRealDirectory(directory: string): void {
  if (existsSync(directory)) {
    assertRealDirectory(directory, "controlled publication directory");
    return;
  }
  const parent = path.dirname(directory);
  if (parent === directory) {
    throw new KnowledgePublicationIntegrityError(
      `Could not establish controlled publication directory ${directory}`
    );
  }
  ensureRealDirectory(parent);
  try {
    mkdirSync(directory, { mode: 0o700 });
    fsyncDirectory(parent);
  } catch (error) {
    if (!isFileExistsError(error)) throw error;
  }
  assertRealDirectory(directory, "controlled publication directory");
}

function cleanupKnownTemporaryFiles(directory: string): void {
  if (!existsSync(directory)) return;
  assertRealDirectory(directory, "publication temporary-file recovery directory");
  let changed = false;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new KnowledgePublicationIntegrityError(
        "Publication store contains a symbolic-link substitution"
      );
    }
    if (entry.isDirectory()) {
      cleanupKnownTemporaryFiles(candidate);
      continue;
    }
    if (entry.isFile() && isKnownTemporaryName(entry.name)) {
      unlinkSync(candidate);
      changed = true;
    }
  }
  if (changed) fsyncDirectory(directory);
}

function isKnownTemporaryName(name: string): boolean {
  return /^\.pending\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/.test(
    name
  );
}

function noFollowFlag(): number {
  return typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
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

function pathEntryExists(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if (isFileMissingError(error)) return false;
    throw error;
  }
}

function directoryFlag(): number {
  return typeof fsConstants.O_DIRECTORY === "number" ? fsConstants.O_DIRECTORY : 0;
}

function fsyncDirectory(directory: string): void {
  assertRealDirectory(directory, "publication fsync directory");
  const descriptor = openSync(directory, fsConstants.O_RDONLY | directoryFlag() | noFollowFlag());
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function assertSafeId(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(value)) {
    throw new KnowledgePublicationIntegrityError(`Unsafe ${label}`);
  }
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
    throw new KnowledgePublicationIntegrityError(
      "Knowledge publication head claim failed closed-schema validation"
    );
  }
  return value as HeadClaimReceipt;
}

function claimOwnerIsProvablyAbsent(
  receipt: HeadClaimReceipt,
  getCurrentHostIdentity: () => string | null
): boolean {
  if (!isStableHostIdentity(receipt.hostIdentity)) return false;
  const currentHost = getCurrentHostIdentity();
  if (!currentHost || currentHost !== receipt.hostIdentity) return false;
  const bootIdentity = currentBootIdentity();
  if (receipt.bootIdentity && bootIdentity && receipt.bootIdentity !== bootIdentity) return true;
  if (!processExists(receipt.pid)) return true;
  const startIdentity = processStartIdentity(receipt.pid);
  return Boolean(
    receipt.processStartIdentity && startIdentity && receipt.processStartIdentity !== startIdentity
  );
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

function waitForClaimRetry(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
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

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isFileMissingError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}
