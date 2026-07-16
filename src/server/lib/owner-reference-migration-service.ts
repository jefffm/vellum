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
  readSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { platform } from "node:os";
import path from "node:path";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  OwnerReferenceMigrationJournalSchema,
  OwnerReferenceMigrationMappingSchema,
  OwnerReferenceMigrationQuarantineSchema,
  type LegacyOwnerReferenceIdentityDisposition,
  type OwnerReferenceMigrationJournal,
  type OwnerReferenceMigrationEvidenceRef,
  type OwnerReferenceMigrationMapping,
  type OwnerReferenceMigrationQuarantine,
  type OwnerReferenceMigrationQuarantineAction,
  type OwnerReferenceMigrationQuarantineReason,
  type OwnerReferenceMigrationTargetRecord,
} from "../../lib/owner-reference-migration.js";
import type { OwnerReference } from "../../lib/owner-domain.js";
import {
  canonicalReferenceJson,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingInputRecord,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  KnowledgePublicationConflictError,
  KnowledgePublicationIntegrityError,
  KnowledgePublicationRecoveryRequiredError,
  KnowledgePublicationStore,
  KnowledgePublicationTransactionSchema,
  knowledgePublicationRecordRefForWrite,
  type KnowledgePublicationGenerationRef,
  type KnowledgePublicationHead,
  type KnowledgePublicationRecord,
  type KnowledgePublicationRecordRef,
  type KnowledgePublicationSnapshot,
  type KnowledgePublicationTransaction,
  type KnowledgePublicationWrite,
} from "./knowledge-publication-store.js";
import {
  OwnerReferenceLegacyReader,
  OwnerReferenceLegacyReadError,
  type LegacyOwnerReferenceInventory,
  type LegacyOwnerReferenceObservation,
  type LegacyOwnerReferenceSource,
} from "./owner-reference-legacy-reader.js";
import { OwnerReferenceClaimIntegrityError } from "./owner-reference-claim.js";
import { ApiRouteError } from "./create-route.js";
import {
  ReferenceSourceControlledArtifactStore,
  ReferenceSourceControlledArtifactStoreIntegrityError,
} from "./reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingStore,
  type ReferenceSourceStagingHead,
} from "./reference-source-staging-store.js";

export type { LegacyOwnerReferenceIdentityDisposition } from "../../lib/owner-reference-migration.js";

const MIGRATION_POLICY_REF = externalRef("policy.owner-reference-legacy-migration.v1");
const PLAN_SCHEMA_ID = "vellum.owner-reference-migration.plan.v1" as const;
const MIGRATION_STAGE_PROTOCOL_VERSION = 1 as const;
const MIGRATION_STAGE_CHUNK_SIZE = 256 as const;
const MIGRATION_VISIBILITY_PROTOCOL_VERSION = 1 as const;
const MIGRATION_ABORT_PROTOCOL_VERSION = 1 as const;
const MIGRATION_ROLLBACK_PROTOCOL_VERSION = 1 as const;
const CAPABILITIES = {
  compatibilityReads: true as const,
  canonicalWriter: false as const,
  activation: false as const,
};

export type OwnerReferenceMigrationExpectedHead = KnowledgePublicationGenerationRef | null;

export type OwnerReferenceMigrationPlanView = {
  schemaVersion: 1;
  mode: "dry_run";
  planDigest: string;
  expectedHead: OwnerReferenceMigrationExpectedHead;
  expectedGraphHead: ReferenceSourceStagingHead | null;
  writesPerformed: false;
  mappings: Array<{
    legacyId: string;
    bibliographicIdentity: "not_asserted";
    alreadyMapped: boolean;
  }>;
  quarantines: Array<{
    legacyId: string;
    reason: OwnerReferenceMigrationQuarantineReason;
    action: OwnerReferenceMigrationQuarantineAction;
  }>;
  capabilities: typeof CAPABILITIES;
};

export type OwnerReferenceMigrationLegacySourceState =
  | "verified"
  | "missing"
  | "diverged"
  | "unavailable";

export type OwnerReferenceMigrationCommitView = {
  schemaVersion: 1;
  mode: "commit";
  planDigest: string;
  batchId: string;
  outcome: "committed" | "already_committed" | "no_changes";
  journalState: "committed" | "unchanged";
  mappedCount: number;
  quarantineCount: number;
  head: KnowledgePublicationHead | null;
  capabilities: typeof CAPABILITIES;
};

export type OwnerReferenceMigrationRollbackView = {
  schemaVersion: 1;
  mode: "rollback";
  batchId: string;
  outcome: "committed" | "already_committed";
  journalState: "rolled_back";
  head: KnowledgePublicationHead;
  capabilities: typeof CAPABILITIES;
};

export type OwnerReferenceMigrationInterruptedRollbackView = {
  schemaVersion: 1;
  mode: "rollback";
  rollbackScope: "interrupted_commit";
  planDigest: string;
  batchId: string;
  outcome: "committed" | "already_committed";
  journalState: "rolled_back";
  head: KnowledgePublicationHead;
  capabilities: typeof CAPABILITIES;
};

export type OwnerReferenceMigrationCompatibilityView = {
  schemaVersion: 1;
  publicationState: "migration_only";
  head: KnowledgePublicationHead | null;
  legacySourceState: OwnerReferenceMigrationLegacySourceState;
  ownerReferences: Array<{
    legacyId: string;
    state: "pending" | "mapped" | "quarantined" | "rolled_back";
    legacySourceState: OwnerReferenceMigrationLegacySourceState;
    mappingId?: string;
    quarantineReason?: OwnerReferenceMigrationQuarantineReason;
  }>;
  capabilities: typeof CAPABILITIES;
};

export type OwnerReferenceMigrationPrivateAudit = {
  schemaVersion: 1;
  batchId: string;
  history: OwnerReferenceMigrationJournal[];
  mappings: OwnerReferenceMigrationMapping[];
  quarantines: OwnerReferenceMigrationQuarantine[];
};

type PlanEntry =
  | {
      kind: "mapping";
      mapping: OwnerReferenceMigrationMapping;
      alreadyMapped: boolean;
      alreadyActive: boolean;
    }
  | {
      kind: "quarantine";
      legacyId: string;
      rawLegacyId: string;
      legacyRecordDigest: string | null;
      reason: OwnerReferenceMigrationQuarantineReason;
      action: OwnerReferenceMigrationQuarantineAction;
      declaredSha256: string | null;
      observedSha256: string | null;
      declaredByteLength: number | null;
      observedByteLength: number | null;
      legacyRecordByteLength: number | null;
      legacySnapshot: OwnerReferenceMigrationMapping["legacySnapshot"] | null;
      legacyRecordEvidence: OwnerReferenceMigrationEvidenceRef | null;
      observedContentEvidence: OwnerReferenceMigrationEvidenceRef | null;
      alreadyQuarantined: boolean;
    };

type ComputedPlan = {
  planDigest: string;
  batchId: string;
  expectedHead: OwnerReferenceMigrationExpectedHead;
  expectedGraphHead: ReferenceSourceStagingHead | null;
  inventory: LegacyOwnerReferenceInventory;
  entries: PlanEntry[];
};

type CommitIntent = {
  schemaVersion: 1;
  kind: "owner_reference_migration_commit_intent";
  stageProtocolVersion: typeof MIGRATION_STAGE_PROTOCOL_VERSION;
  chunkSize: typeof MIGRATION_STAGE_CHUNK_SIZE;
  planDigest: string;
  batchId: string;
  expectedHead: OwnerReferenceMigrationExpectedHead;
  expectedGraphHead: ReferenceSourceStagingHead | null;
  legacyInventoryDigest: string;
  recordedAt: string;
  mappings: OwnerReferenceMigrationMapping[];
  quarantines: OwnerReferenceMigrationQuarantine[];
  digest: string;
};

type StagedMigrationPayload = {
  cursor: KnowledgePublicationSnapshot | null;
  mappingRecordRefs: ReferenceRecordRef[];
  quarantineRecordRefs: ReferenceRecordRef[];
};

type RollbackIntent = {
  schemaVersion: 1;
  kind: "owner_reference_migration_rollback_intent";
  batchId: string;
  expectedHead: KnowledgePublicationGenerationRef;
  transaction: KnowledgePublicationTransaction;
  digest: string;
};

type InterruptedRollbackIntent = {
  schemaVersion: 1;
  kind: "owner_reference_migration_interrupted_rollback_intent";
  planDigest: string;
  batchId: string;
  expectedHead: OwnerReferenceMigrationExpectedHead;
  recordedAt: string;
  digest: string;
};

type MigrationPublicationTransactionIntent = {
  schemaVersion: 1;
  kind: "owner_reference_migration_publication_transaction_intent";
  planDigest: string;
  transaction: KnowledgePublicationTransaction;
  digest: string;
};

type MigrationGraphReceipt = {
  schemaVersion: 1;
  kind: "owner_reference_migration_graph_receipt";
  planDigest: string;
  expectedGraphHead: ReferenceSourceStagingHead | null;
  committedGraphHead: ReferenceSourceStagingHead | null;
  targetRecordRefs: ReferenceRecordRef[];
  digest: string;
};

type MigrationClaimReceipt = {
  schemaVersion: 1;
  token: string;
  pid: number;
  hostIdentity: string;
  bootIdentity: string | null;
  processStartIdentity: string | null;
  claimedAt: string;
};

export type OwnerReferenceMigrationFault =
  | {
      point: "after_migration_claim_published" | "after_migration_recovery_ticket_published";
      path: string;
    }
  | {
      point: "before_private_file_open";
      path: string;
      operation: "read" | "create";
    };

type MigrationClaimRuntime = {
  hostIdentity: () => string | null;
  bootIdentity: () => string | null;
  processStartIdentity: (pid: number) => string | null;
  processExists: (pid: number) => boolean;
};

export type OwnerReferenceMigrationServiceOptions = {
  journalStore?: KnowledgePublicationStore;
  controlledStore?: ReferenceSourceControlledArtifactStore;
  migrationGraphService?: ReferenceSourceStagingService;
  legacySource?: LegacyOwnerReferenceSource;
  /** Test seam; production uses OwnerReferenceLegacyReader. */
  listLegacyReferences?: () => OwnerReference[];
  /** Test seam paired with listLegacyReferences. */
  readLegacyBytes?: (id: string) => Buffer;
  /** A pinned reviewed assessment provider; absence leaves identity unresolved. */
  classifyIdentity?: (reference: OwnerReference) => LegacyOwnerReferenceIdentityDisposition;
  migrationRootDirectory?: string;
  intentRootDirectory?: string;
  now?: () => Date;
  /** Deterministic crash/race seam; production never supplies it. */
  faultInjector?: (fault: OwnerReferenceMigrationFault) => void;
  /** Deterministic process-identity seam for cross-process claim tests. */
  claimRuntime?: Partial<MigrationClaimRuntime>;
};

/**
 * Transactional, compatibility-only OwnerReference migration.
 *
 * Router production wiring supplies the shared T07 publication store and shared
 * T05 source graph. Only immutable transaction intents and exact legacy evidence
 * live under the private migration root. Controlled bytes and graph records may
 * be prepared first; no mapping becomes readable until its journal-only
 * visibility generation commits. Canonical activation remains unavailable.
 */
export class OwnerReferenceMigrationService {
  readonly journalStore: KnowledgePublicationStore;
  readonly controlledStore: ReferenceSourceControlledArtifactStore;
  readonly migrationGraphService: ReferenceSourceStagingService;
  readonly intentRootDirectory: string;
  readonly quarantineEvidenceRootDirectory: string;
  private readonly privateOutputRootDirectory: string;
  private readonly legacySource: LegacyOwnerReferenceSource;
  private readonly classifyIdentity: (
    reference: OwnerReference
  ) => LegacyOwnerReferenceIdentityDisposition;
  private readonly now: () => Date;
  private readonly faultInjector?: (fault: OwnerReferenceMigrationFault) => void;
  private readonly claimRuntime: MigrationClaimRuntime;

  constructor(options: OwnerReferenceMigrationServiceOptions = {}) {
    const ownerRoot = path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner");
    const migrationRoot =
      options.migrationRootDirectory ??
      (options.intentRootDirectory
        ? path.dirname(options.intentRootDirectory)
        : path.join(ownerRoot, "owner-reference-migration"));
    this.journalStore =
      options.journalStore ??
      new KnowledgePublicationStore({ rootDirectory: path.join(migrationRoot, "journal") });
    this.controlledStore = options.controlledStore ?? new ReferenceSourceControlledArtifactStore();
    this.privateOutputRootDirectory = migrationRoot;
    this.intentRootDirectory = options.intentRootDirectory ?? path.join(migrationRoot, "intents");
    this.quarantineEvidenceRootDirectory = path.join(migrationRoot, "quarantine-evidence");
    this.migrationGraphService =
      options.migrationGraphService ??
      new ReferenceSourceStagingService({
        store: new ReferenceSourceStagingStore({
          rootDirectory: path.join(migrationRoot, "graph"),
        }),
      });
    this.legacySource =
      options.legacySource ??
      (options.listLegacyReferences && options.readLegacyBytes
        ? callbackLegacySource(options.listLegacyReferences, options.readLegacyBytes)
        : new OwnerReferenceLegacyReader({ rootDirectory: ownerRoot }));
    this.classifyIdentity = options.classifyIdentity ?? (() => "incomplete");
    this.now = options.now ?? (() => new Date());
    this.faultInjector = options.faultInjector;
    this.claimRuntime = {
      hostIdentity: options.claimRuntime?.hostIdentity ?? currentHostIdentity,
      bootIdentity: options.claimRuntime?.bootIdentity ?? currentBootIdentity,
      processStartIdentity: options.claimRuntime?.processStartIdentity ?? processStartIdentity,
      processExists: options.claimRuntime?.processExists ?? processExists,
    };
  }

  dryRun(input: {
    expectedHead: OwnerReferenceMigrationExpectedHead;
  }): OwnerReferenceMigrationPlanView {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return planView(this.computePlan(input.expectedHead));
  }

  commit(input: {
    expectedHead: OwnerReferenceMigrationExpectedHead;
    planDigest: string;
  }): OwnerReferenceMigrationCommitView {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertDigest(input.planDigest, "migration plan digest");
    return this.withMigrationClaim(() => {
      const completed = this.readCompletedCommitRetry(input);
      if (completed) return completed;
      return this.withStableLegacyInventory((inventory) =>
        this.controlledStore.withExclusiveTransaction(() => this.commitClaimed(input, inventory))
      );
    });
  }

  rollback(input: {
    batchId: string;
    expectedHead: KnowledgePublicationGenerationRef | null;
  }): OwnerReferenceMigrationRollbackView {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertSafeId(input.batchId, "migration batch ID");
    if (!input.expectedHead) {
      throw new OwnerReferenceMigrationConflictError(
        "A committed migration head is required for rollback"
      );
    }
    return this.withMigrationClaim(() => this.rollbackClaimed(input.batchId, input.expectedHead!));
  }

  rollbackInterrupted(input: {
    planDigest: string;
    expectedHead: OwnerReferenceMigrationExpectedHead;
  }): OwnerReferenceMigrationInterruptedRollbackView {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertDigest(input.planDigest, "migration plan digest");
    return this.withMigrationClaim(() =>
      this.rollbackInterruptedClaimed(input.planDigest, input.expectedHead)
    );
  }

  readCompatibility(): OwnerReferenceMigrationCompatibilityView {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    // Compatibility state and the head naming that state must come from one
    // immutable publication snapshot. Legacy capture can overlap a migration
    // writer, so rereading the head after capture could otherwise pair the
    // prior journal projection with a newer head.
    const current = this.journalStore.readCurrent();
    const decoded = decodeMigrationRecords(current?.records ?? []);
    const effectiveByLegacy = effectiveLegacyResolutions(decoded);
    const inventory = this.captureCompatibilityInventory();
    const observations = inventory?.observations ?? [];
    const observationsByLegacy = observationsByLegacyId(observations);
    const legacyIds = [
      ...new Set([...effectiveByLegacy.keys(), ...observations.map(({ legacyId }) => legacyId)]),
    ].sort();

    const ownerReferences = legacyIds.map((legacyId) => {
      const liveObservations = observationsByLegacy.get(legacyId) ?? [];
      const effective = effectiveByLegacy.get(legacyId);
      const legacySourceState = inventory
        ? compatibilityLegacyItemSourceState(liveObservations, effective)
        : ("unavailable" as const);
      if (effective?.kind === "rolled_back") {
        return {
          legacyId,
          state: "rolled_back" as const,
          legacySourceState,
          ...(effective.coexistingMapping
            ? { mappingId: effective.coexistingMapping.record.id }
            : {}),
        };
      }
      if (effective?.kind === "mapping") {
        if (legacySourceState === "diverged") {
          return {
            legacyId,
            state: "quarantined" as const,
            legacySourceState,
            quarantineReason: "immutable_mapping_conflict" as const,
            mappingId: effective.record.id,
          };
        }
        return {
          legacyId,
          state: "mapped" as const,
          legacySourceState,
          mappingId: effective.record.id,
        };
      }
      if (effective?.kind === "quarantine") {
        return {
          legacyId,
          state: "quarantined" as const,
          legacySourceState,
          quarantineReason: effective.content.reason,
          ...(effective.coexistingMapping
            ? { mappingId: effective.coexistingMapping.record.id }
            : {}),
        };
      }
      return { legacyId, state: "pending" as const, legacySourceState };
    });

    return {
      schemaVersion: 1,
      publicationState: "migration_only",
      head: current?.head ?? null,
      legacySourceState: inventory
        ? compatibilityLegacySourceState(observations, effectiveByLegacy)
        : "unavailable",
      ownerReferences,
      capabilities: CAPABILITIES,
    };
  }

  inspectPrivateAudit(batchId: string): OwnerReferenceMigrationPrivateAudit {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertSafeId(batchId, "migration batch ID");
    const decoded = this.decodedJournal();
    const history = decoded.journals
      .filter(({ content }) => content.batchId === batchId)
      .map(({ content }) => content)
      .sort((left, right) => left.sequence - right.sequence);
    if (history.length === 0) {
      throw new OwnerReferenceMigrationNotFoundError(`Migration batch not found: ${batchId}`);
    }
    const mappingRefs = uniqueRefs(history.flatMap(({ mappingRecordRefs }) => mappingRecordRefs));
    const quarantineRefs = uniqueRefs(
      history.flatMap(({ quarantineRecordRefs }) => quarantineRecordRefs)
    );
    const mappings = recordsForRefs(decoded.recordsByRef, mappingRefs).map((record) =>
      decodeMapping(record.content)
    );
    for (const mapping of mappings) {
      this.verifyStoredEvidence(mapping.legacyRecordEvidence, mapping.legacyId);
    }
    const quarantines = recordsForRefs(decoded.recordsByRef, quarantineRefs).map((record) =>
      decodeQuarantine(record.content)
    );
    for (const quarantine of quarantines) {
      this.verifyStoredEvidence(quarantine.legacyRecordEvidence, quarantine.legacyId);
      this.verifyStoredEvidence(quarantine.observedContentEvidence, quarantine.legacyId);
    }
    return {
      schemaVersion: 1,
      batchId,
      history,
      mappings,
      quarantines,
    };
  }

  private commitClaimed(
    input: {
      expectedHead: OwnerReferenceMigrationExpectedHead;
      planDigest: string;
    },
    lockedInventory: LegacyOwnerReferenceInventory
  ): OwnerReferenceMigrationCommitView {
    const intentFile = this.commitIntentPath(input.planDigest);
    let intent: CommitIntent;
    if (this.privateRegularFileExists(intentFile, "migration commit intent")) {
      intent = readCommitIntent(
        intentFile,
        this.privateOutputRootDirectory,
        this.privateIoHook("read")
      );
      if (
        intent.planDigest !== input.planDigest ||
        canonicalReferenceJson(intent.expectedHead) !== canonicalReferenceJson(input.expectedHead)
      ) {
        throw new OwnerReferenceMigrationConflictError(
          "Migration plan digest or expected head changed after commit intent creation"
        );
      }
    } else {
      const plan = this.computePlan(input.expectedHead);
      if (plan.planDigest !== input.planDigest) {
        throw new OwnerReferenceMigrationConflictError(
          "Legacy inventory or migration destination changed after dry run"
        );
      }
      if (!planHasSemanticChanges(plan)) {
        const current = this.journalStore.readCurrent();
        const currentHead = current?.head ?? null;
        if (!sameNullablePublicationHead(currentHead, input.expectedHead)) {
          throw new OwnerReferenceMigrationConflictError(
            "Migration journal head changed before the no-op commit was confirmed"
          );
        }
        return {
          schemaVersion: 1,
          mode: "commit",
          planDigest: plan.planDigest,
          batchId: plan.batchId,
          outcome: "no_changes",
          journalState: "unchanged",
          mappedCount: plan.entries.filter(({ kind }) => kind === "mapping").length,
          quarantineCount: plan.entries.filter(({ kind }) => kind === "quarantine").length,
          head: currentHead,
          capabilities: CAPABILITIES,
        };
      }
      intent = bindCommitIntent(plan, this.now().toISOString());
      // The intent authorizes source-free interrupted rollback. Publish it only
      // after every exact legacy evidence object it names is durable and
      // verified under the stable legacy-source claim.
      this.stageMappingEvidence(intent, lockedInventory);
      this.stageQuarantineEvidence(intent, lockedInventory);
      writeImmutableIntent(
        intentFile,
        intent,
        this.privateOutputRootDirectory,
        this.privateIoHook("create")
      );
    }

    const currentBeforeStaging = this.journalStore.readCurrent();
    const effectiveBatch = currentBeforeStaging
      ? effectiveBatchStates(decodeMigrationRecords(currentBeforeStaging.records).journals).get(
          intent.batchId
        )
      : undefined;
    if (effectiveBatch?.state === "committed" && currentBeforeStaging) {
      return {
        schemaVersion: 1,
        mode: "commit",
        planDigest: intent.planDigest,
        batchId: intent.batchId,
        outcome: "already_committed",
        journalState: "committed",
        mappedCount: effectiveBatch.mappingRecordRefs.length,
        quarantineCount: effectiveBatch.quarantineRecordRefs.length,
        head: currentBeforeStaging.head,
        capabilities: CAPABILITIES,
      };
    }
    if (effectiveBatch?.state === "rolled_back") {
      throw new OwnerReferenceMigrationConflictError(
        "The requested migration batch was rolled back; create a fresh plan against the current head"
      );
    }

    const currentInventory = lockedInventory;
    assertInventoryMatchesIntent(currentInventory, intent);

    this.stageControlledBytes(intent, currentInventory);
    this.stageMappingEvidence(intent, currentInventory);
    this.stageQuarantineEvidence(intent, currentInventory);
    const graphHead = this.stageMigrationGraph(intent);
    assertInventoryMatchesIntent(this.captureLegacyInventory(), intent);
    const staged = this.stageMigrationPayload(intent);
    const transaction = commitTransaction(intent, graphHead, staged);
    this.rememberPublicationTransaction(intent, transaction);
    this.reclaimPlanRetryOrphans(intent);
    let published;
    try {
      published = this.journalStore.publish(transaction);
    } catch (error) {
      throw translateMigrationStoreError(error);
    }
    assertTerminalGeneration(published, transaction, staged.cursor);
    const journal = findJournalInSnapshot(published.records, intent.batchId, "committed");
    assertJournalPayloadClosure(journal, staged);
    return {
      schemaVersion: 1,
      mode: "commit",
      planDigest: intent.planDigest,
      batchId: intent.batchId,
      outcome: published.outcome,
      journalState: "committed",
      mappedCount: journal.mappingRecordRefs.length,
      quarantineCount: journal.quarantineRecordRefs.length,
      head: published.head,
      capabilities: CAPABILITIES,
    };
  }

  private readCompletedCommitRetry(input: {
    expectedHead: OwnerReferenceMigrationExpectedHead;
    planDigest: string;
  }): OwnerReferenceMigrationCommitView | null {
    const intentFile = this.commitIntentPath(input.planDigest);
    if (!this.privateRegularFileExists(intentFile, "migration commit intent")) return null;
    const intent = readCommitIntent(
      intentFile,
      this.privateOutputRootDirectory,
      this.privateIoHook("read")
    );
    if (
      intent.planDigest !== input.planDigest ||
      canonicalReferenceJson(intent.expectedHead) !== canonicalReferenceJson(input.expectedHead)
    ) {
      throw new OwnerReferenceMigrationConflictError(
        "Migration plan digest or expected head changed after commit intent creation"
      );
    }

    const current = this.journalStore.readCurrent();
    if (!current) return null;
    const decoded = decodeMigrationRecords(current.records);
    const effective = effectiveBatchStates(decoded.journals).get(intent.batchId);
    if (effective?.state === "rolled_back") {
      throw new OwnerReferenceMigrationConflictError(
        "The requested migration batch was rolled back; create a fresh plan against the current head"
      );
    }
    if (effective?.state !== "committed") return null;
    if (
      effective.action !== "commit" ||
      effective.planDigest !== intent.planDigest ||
      effective.legacyInventoryDigest !== intent.legacyInventoryDigest
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Committed migration journal does not close over its immutable commit intent"
      );
    }

    const payload = migrationPayload(intent);
    assertPayloadRecordsReachable(current.records, payload.writes);
    assertJournalPayloadClosure(effective, {
      cursor: current,
      mappingRecordRefs: payload.mappingRecordRefs,
      quarantineRecordRefs: payload.quarantineRecordRefs,
    });
    this.verifyIntentEvidence(intent);
    this.verifyCommittedGraph(intent, effective);
    for (const mapping of intent.mappings) {
      if (!this.controlledContainsMapping(mapping)) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          `Controlled mapping bytes are unavailable for committed retry: ${mapping.legacyId}`
        );
      }
    }
    return {
      schemaVersion: 1,
      mode: "commit",
      planDigest: intent.planDigest,
      batchId: intent.batchId,
      outcome: "already_committed",
      journalState: "committed",
      mappedCount: effective.mappingRecordRefs.length,
      quarantineCount: effective.quarantineRecordRefs.length,
      head: current.head,
      capabilities: CAPABILITIES,
    };
  }

  private rollbackClaimed(
    batchId: string,
    expectedHead: KnowledgePublicationGenerationRef
  ): OwnerReferenceMigrationRollbackView {
    const current = this.journalStore.readCurrent();
    if (!current) {
      throw new OwnerReferenceMigrationNotFoundError(`Migration batch not found: ${batchId}`);
    }
    const decoded = decodeMigrationRecords(current.records);
    const batchHistory = decoded.journals
      .filter(({ content }) => content.batchId === batchId)
      .sort((left, right) => left.content.sequence - right.content.sequence);
    if (batchHistory.length === 0) {
      throw new OwnerReferenceMigrationNotFoundError(`Migration batch not found: ${batchId}`);
    }
    const latest = batchHistory.at(-1)!;
    if (latest.content.state === "rolled_back") {
      const exactHistoricalRollbackRetry =
        latest.content.action === "rollback" &&
        sameNullableGenerationRef(latest.content.publicationParentRef, expectedHead) &&
        this.hasReachableExactRollbackGeneration(current, batchId, expectedHead, latest.record);
      if (!samePublicationHead(current.head, expectedHead) && !exactHistoricalRollbackRetry) {
        throw new OwnerReferenceMigrationConflictError(
          "Migration head changed after the rollback completed"
        );
      }
      return {
        schemaVersion: 1,
        mode: "rollback",
        batchId,
        outcome: "already_committed",
        journalState: "rolled_back",
        head: current.head,
        capabilities: CAPABILITIES,
      };
    }
    if (!samePublicationHead(current.head, expectedHead)) {
      throw new OwnerReferenceMigrationConflictError(
        "Migration head changed before rollback could commit"
      );
    }

    const intentFile = this.rollbackIntentPath(batchId, expectedHead);
    let intent: RollbackIntent;
    if (this.privateRegularFileExists(intentFile, "migration rollback intent")) {
      intent = readRollbackIntent(
        intentFile,
        this.privateOutputRootDirectory,
        this.privateIoHook("read")
      );
    } else {
      const journalWrite = rollbackJournalWrite({
        batchId,
        prior: latest,
        expectedHead,
        recordedAt: this.now().toISOString(),
      });
      const transaction: KnowledgePublicationTransaction = {
        schemaVersion: 1,
        transactionId: rollbackTransactionId(batchId, expectedHead),
        writerKind: "migration",
        expectedHead,
        writes: [journalWrite],
      };
      intent = bindRollbackIntent({ batchId, expectedHead, transaction });
      writeImmutableIntent(
        intentFile,
        intent,
        this.privateOutputRootDirectory,
        this.privateIoHook("create")
      );
    }
    verifyRollbackIntent(intent, batchId, expectedHead, latest);
    this.reclaimRetryOrphan(intent.transaction);
    let published;
    try {
      published = this.journalStore.publish(intent.transaction);
    } catch (error) {
      throw translateMigrationStoreError(error);
    }
    return {
      schemaVersion: 1,
      mode: "rollback",
      batchId,
      outcome: published.outcome,
      journalState: "rolled_back",
      head: published.head,
      capabilities: CAPABILITIES,
    };
  }

  private hasReachableExactRollbackGeneration(
    current: KnowledgePublicationSnapshot,
    batchId: string,
    expectedHead: KnowledgePublicationGenerationRef,
    journalRecord: KnowledgePublicationRecord
  ): boolean {
    const transactionId = rollbackTransactionId(batchId, expectedHead);
    const journalRef = publicationRecordRef(journalRecord);
    let cursor: KnowledgePublicationSnapshot | null = current;
    while (cursor) {
      const generation = cursor.generation;
      if (generation.transactionId === transactionId) {
        return (
          generation.writerKind === "migration" &&
          sameNullableGenerationRef(generation.parentGenerationRef ?? null, expectedHead) &&
          generation.revision === expectedHead.revision + 1 &&
          canonicalReferenceJson(generation.newRecordRefs) === canonicalReferenceJson([journalRef])
        );
      }
      const parent = generation.parentGenerationRef ?? null;
      if (!parent) return false;
      cursor = this.journalStore.readGeneration(parent.id);
      if (
        cursor.generation.digest !== parent.digest ||
        cursor.generation.revision !== parent.revision
      ) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Rollback ancestry did not resolve to its exact parent generation"
        );
      }
    }
    return false;
  }

  private rollbackInterruptedClaimed(
    planDigest: string,
    expectedHead: OwnerReferenceMigrationExpectedHead
  ): OwnerReferenceMigrationInterruptedRollbackView {
    const intentFile = this.commitIntentPath(planDigest);
    if (!this.privateRegularFileExists(intentFile, "migration commit intent")) {
      throw new OwnerReferenceMigrationNotFoundError(
        `Interrupted migration plan not found: ${planDigest}`
      );
    }
    const commitIntent = readCommitIntent(
      intentFile,
      this.privateOutputRootDirectory,
      this.privateIoHook("read")
    );
    if (commitIntent.planDigest !== planDigest) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Interrupted migration commit intent does not match the requested plan"
      );
    }

    const current = this.journalStore.readCurrent();
    const decoded = decodeMigrationRecords(current?.records ?? []);
    const effectiveBatch = effectiveBatchStates(decoded.journals).get(commitIntent.batchId);
    if (effectiveBatch?.state === "committed") {
      throw new OwnerReferenceMigrationConflictError(
        "The migration commit is already visible; use committed rollback"
      );
    }
    if (effectiveBatch?.state === "rolled_back" && current) {
      if (
        !sameNullablePublicationHead(current.head, expectedHead) &&
        !sameNullableGenerationRef(commitIntent.expectedHead, expectedHead)
      ) {
        throw new OwnerReferenceMigrationConflictError(
          "Migration head changed after the interrupted rollback completed"
        );
      }
      return interruptedRollbackView(commitIntent, current.head, "already_committed");
    }
    if (!sameNullableGenerationRef(commitIntent.expectedHead, expectedHead)) {
      throw new OwnerReferenceMigrationConflictError(
        "Interrupted rollback must name the commit intent's exact base head"
      );
    }

    this.verifyIntentEvidence(commitIntent);
    const graphHead = this.recoverInterruptedGraphHead(commitIntent);
    const staged = this.stageMigrationPayload(commitIntent);
    const rollbackIntentFile = this.interruptedRollbackIntentPath(
      planDigest,
      commitIntent.expectedHead
    );
    let rollbackIntent: InterruptedRollbackIntent;
    if (this.privateRegularFileExists(rollbackIntentFile, "interrupted rollback intent")) {
      rollbackIntent = readInterruptedRollbackIntent(
        rollbackIntentFile,
        this.privateOutputRootDirectory,
        this.privateIoHook("read")
      );
      if (
        rollbackIntent.planDigest !== planDigest ||
        !sameNullableGenerationRef(rollbackIntent.expectedHead, commitIntent.expectedHead)
      ) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Immutable interrupted rollback intent does not match the request"
        );
      }
    } else {
      rollbackIntent = bindInterruptedRollbackIntent({
        planDigest,
        batchId: commitIntent.batchId,
        expectedHead: commitIntent.expectedHead,
        recordedAt: this.now().toISOString(),
      });
      writeImmutableIntent(
        rollbackIntentFile,
        rollbackIntent,
        this.privateOutputRootDirectory,
        this.privateIoHook("create")
      );
    }
    verifyInterruptedRollbackIntent(rollbackIntent, commitIntent);

    const transaction = interruptedRollbackTransaction({
      intent: commitIntent,
      graphHead,
      staged,
      recordedAt: rollbackIntent.recordedAt,
    });
    this.rememberPublicationTransaction(commitIntent, transaction);
    this.reclaimPlanRetryOrphans(commitIntent);
    let published;
    try {
      published = this.journalStore.publish(transaction);
    } catch (error) {
      throw translateMigrationStoreError(error);
    }
    assertTerminalGeneration(published, transaction, staged.cursor);
    const journal = findJournalInSnapshot(published.records, commitIntent.batchId, "rolled_back");
    assertJournalPayloadClosure(journal, staged);
    return interruptedRollbackView(commitIntent, published.head, published.outcome);
  }

  private recoverInterruptedGraphHead(intent: CommitIntent): ReferenceSourceStagingHead | null {
    const targetRecords = uniqueTargetRecords(
      intent.mappings.flatMap(({ targetRecords }) => targetRecords)
    );
    const targetRecordRefs = targetRecords.map(refFor);
    const receiptFile = this.graphReceiptPath(intent.planDigest);
    if (this.privateRegularFileExists(receiptFile, "migration graph receipt")) {
      const receipt = readGraphReceipt(
        receiptFile,
        this.privateOutputRootDirectory,
        this.privateIoHook("read")
      );
      if (
        receipt.planDigest !== intent.planDigest ||
        canonicalReferenceJson(receipt.expectedGraphHead) !==
          canonicalReferenceJson(intent.expectedGraphHead) ||
        canonicalReferenceJson(receipt.targetRecordRefs) !==
          canonicalReferenceJson(targetRecordRefs)
      ) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Immutable migration graph receipt does not match the interrupted commit intent"
        );
      }
      this.verifyGraphReceipt(receipt, intent.mappings);
      return receipt.committedGraphHead;
    }

    const expectedSnapshot = intent.expectedGraphHead
      ? requireGraphSnapshot(
          this.migrationGraphService.readSnapshot(intent.expectedGraphHead.snapshotId).snapshot,
          intent.expectedGraphHead.snapshotId
        )
      : null;
    if (
      expectedSnapshot &&
      (expectedSnapshot.digest !== intent.expectedGraphHead?.digest ||
        expectedSnapshot.revision !== intent.expectedGraphHead.revision)
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Interrupted migration plan graph head no longer resolves to its exact snapshot"
      );
    }
    if (targetRecords.length === 0) return intent.expectedGraphHead;
    return this.findRecoveredGraphHead(
      intent.expectedGraphHead,
      expectedSnapshot?.records ?? [],
      targetRecords
    );
  }

  private stageMigrationPayload(intent: CommitIntent): StagedMigrationPayload {
    const base = readPublicationBase(this.journalStore, intent.expectedHead);
    const payload = migrationPayload(intent);
    assertPayloadRecordBindings(base?.records ?? [], payload.writes);
    const current = this.journalStore.readCurrent();
    let cursor: KnowledgePublicationSnapshot | null;
    if (sameNullablePublicationHead(current?.head ?? null, intent.expectedHead)) {
      cursor = current;
    } else if (
      current &&
      hasReachableOwnedMigrationStage(this.journalStore, current, intent, payload.writes)
    ) {
      cursor = current;
    } else {
      throw new OwnerReferenceMigrationConflictError(
        "Migration publication head moved before any exact owned payload stage became reachable"
      );
    }

    assertPayloadRecordBindings(cursor?.records ?? [], payload.writes);
    this.reclaimPlanRetryOrphans(intent);
    const cursorById = new Map(
      (cursor?.records ?? []).map((record) => [record.id, record] as const)
    );
    const missing = payload.writes.filter(({ ref }) => !cursorById.has(ref.id));
    const chunks = chunked(missing, intent.chunkSize);
    for (const chunk of chunks) {
      const expectedHead = publicationSnapshotRef(cursor);
      const transaction = migrationStageTransaction(intent, expectedHead, chunk);
      this.rememberPublicationTransaction(intent, transaction);
      this.reclaimRetryOrphan(transaction);
      let published;
      try {
        published = this.journalStore.publish(transaction);
      } catch (error) {
        throw translateMigrationStoreError(error);
      }
      assertStageGeneration(published, transaction, chunk, cursor);
      cursor = published;
    }

    assertPayloadRecordsReachable(cursor?.records ?? [], payload.writes);
    return {
      cursor,
      mappingRecordRefs: payload.mappingRecordRefs,
      quarantineRecordRefs: payload.quarantineRecordRefs,
    };
  }

  private computePlan(expectedHead: OwnerReferenceMigrationExpectedHead): ComputedPlan {
    const currentHead = this.journalStore.readHead();
    if (!sameNullablePublicationHead(currentHead, expectedHead)) {
      throw new OwnerReferenceMigrationConflictError(
        "Migration journal head changed before dry run"
      );
    }
    const graphState = this.migrationGraphService.readCurrent();
    const inventory = this.captureLegacyInventory();
    const existing = this.decodedJournal();
    const existingMappingByLegacy = journalReferencedMappings(existing);
    const effectiveByLegacy = effectiveLegacyResolutions(existing);
    const entries: PlanEntry[] = [];
    const duplicateIds = duplicateObservationIds(inventory.observations);

    for (const observation of inventory.observations) {
      const addQuarantine = (
        reason: OwnerReferenceMigrationQuarantineReason,
        action: OwnerReferenceMigrationQuarantineAction
      ) => {
        const entry = quarantineEntry(observation, reason, action);
        const effective = effectiveByLegacy.get(observation.legacyId);
        entry.alreadyQuarantined =
          effective?.kind === "quarantine" &&
          effective.quarantines.some(({ content }) => sameQuarantineEvidence(entry, content));
        entries.push(entry);
      };
      if (duplicateIds.has(observation.legacyId)) {
        addQuarantine("legacy_id_collision", "resolve_legacy_id_collision");
        continue;
      }
      if (observation.failure) {
        addQuarantine(observation.failure.reason, observation.failure.action);
        continue;
      }
      if (!observation.reference || !observation.content || !observation.rawRecordSha256) {
        addQuarantine("invalid_legacy_record", "review_legacy_record");
        continue;
      }
      const existingMapping = existingMappingByLegacy.get(observation.legacyId);
      let mapping: OwnerReferenceMigrationMapping;
      let alreadyMapped = false;
      if (existingMapping) {
        if (
          existingMapping.legacyRecordDigest !== observation.rawRecordSha256 ||
          existingMapping.byteVerification.observedSha256 !== sha256(observation.content)
        ) {
          addQuarantine("immutable_mapping_conflict", "review_immutable_mapping_conflict");
          continue;
        }
        mapping = existingMapping;
        alreadyMapped = true;
      } else {
        mapping = mappingFor(observation);
      }
      const activeResolution = effectiveByLegacy.get(observation.legacyId);
      const identity = this.classifyIdentity(observation.reference);
      const requiresIdentityQuarantine = identity === "incomplete" || identity === "composite";
      entries.push({
        kind: "mapping",
        mapping,
        alreadyMapped,
        alreadyActive:
          (activeResolution?.kind === "mapping" &&
            activeResolution.content.legacyRecordDigest === mapping.legacyRecordDigest) ||
          (requiresIdentityQuarantine &&
            activeResolution?.kind === "quarantine" &&
            activeResolution.coexistingMapping?.content.legacyRecordDigest ===
              mapping.legacyRecordDigest),
      });

      if (requiresIdentityQuarantine) {
        addQuarantine(
          identity === "incomplete" ? "incomplete_identity" : "composite_identity",
          "review_source_identity"
        );
      }
    }
    const collisionCheckedEntries = quarantineTargetRecordCollisions({
      entries,
      observations: inventory.observations,
      graphRecords: graphState?.snapshot?.records ?? [],
      effectiveByLegacy,
    });
    collisionCheckedEntries.sort((left, right) => {
      const byId = entryLegacyId(left).localeCompare(entryLegacyId(right));
      const byKind = left.kind.localeCompare(right.kind);
      return (
        byId ||
        byKind ||
        canonicalReferenceJson(planEntryDigestView(left)).localeCompare(
          canonicalReferenceJson(planEntryDigestView(right))
        )
      );
    });

    const expectedGraphHead = graphState?.head ?? null;
    const planCore = {
      schemaId: PLAN_SCHEMA_ID,
      expectedHead,
      expectedGraphHead,
      legacyInventoryDigest: inventory.inventoryDigest,
      policyRef: MIGRATION_POLICY_REF,
      entries: collisionCheckedEntries.map(planEntryDigestView),
    };
    const planDigest = sha256(canonicalReferenceJson(planCore));
    return {
      planDigest,
      batchId: `owner-reference-migration.${planDigest.slice(0, 32)}`,
      expectedHead,
      expectedGraphHead,
      inventory,
      entries: collisionCheckedEntries,
    };
  }

  private stageControlledBytes(
    intent: CommitIntent,
    inventory: LegacyOwnerReferenceInventory
  ): void {
    const observationByDigest = new Map(
      inventory.observations
        .filter(
          (observation): observation is LegacyOwnerReferenceObservation & { content: Buffer } =>
            observation.content !== null && observation.rawRecordSha256 !== null
        )
        .map((observation) => [observation.rawRecordSha256!, observation] as const)
    );
    for (const mapping of intent.mappings) {
      if (this.controlledContainsMapping(mapping)) continue;
      const observation = observationByDigest.get(mapping.legacyRecordDigest);
      if (!observation) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          "Exact legacy bytes are unavailable and no verified controlled copy exists"
        );
      }
      const asset = targetAsset(mapping);
      this.controlledStore.putDigitalAsset({ digitalAsset: asset, bytes: observation.content });
      if (!this.controlledContainsMapping(mapping)) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          "Controlled bytes did not verify after migration staging"
        );
      }
    }
  }

  private stageQuarantineEvidence(
    intent: CommitIntent,
    inventory: LegacyOwnerReferenceInventory
  ): void {
    for (const quarantine of intent.quarantines) {
      const observation = inventory.observations.find(
        (candidate) =>
          candidate.legacyId === quarantine.legacyId &&
          evidenceMatchesBytes(quarantine.legacyRecordEvidence, candidate.rawRecordBytes) &&
          evidenceMatchesBytes(quarantine.observedContentEvidence, candidate.content)
      );
      if (!observation) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          `Legacy quarantine evidence disappeared for ${quarantine.legacyId}`
        );
      }
      this.stageEvidenceBytes(
        quarantine.legacyRecordEvidence,
        observation.rawRecordBytes,
        quarantine.legacyId
      );
      this.stageEvidenceBytes(
        quarantine.observedContentEvidence,
        observation.content,
        quarantine.legacyId
      );
    }
  }

  private stageMappingEvidence(
    intent: CommitIntent,
    inventory: LegacyOwnerReferenceInventory
  ): void {
    for (const mapping of intent.mappings) {
      const observation = inventory.observations.find(
        (candidate) =>
          candidate.legacyId === mapping.legacyId &&
          evidenceMatchesBytes(mapping.legacyRecordEvidence, candidate.rawRecordBytes)
      );
      if (!observation) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          `Legacy mapping record evidence disappeared for ${mapping.legacyId}`
        );
      }
      this.stageEvidenceBytes(
        mapping.legacyRecordEvidence,
        observation.rawRecordBytes,
        mapping.legacyId
      );
    }
  }

  private stageEvidenceBytes(
    evidence: OwnerReferenceMigrationEvidenceRef | null,
    bytes: Buffer | null,
    legacyId: string
  ): void {
    if (!evidence) return;
    if (!bytes || bytes.byteLength !== evidence.byteLength || sha256(bytes) !== evidence.sha256) {
      throw new OwnerReferenceMigrationRecoveryRequiredError(
        `Exact ${evidence.kind} evidence is unavailable for ${legacyId}`
      );
    }
    const file = this.quarantineEvidencePath(evidence);
    writeImmutableBuffer(
      file,
      bytes,
      this.privateOutputRootDirectory,
      this.privateIoHook("create")
    );
    const stored = readPrivateRegularFile(
      this.privateOutputRootDirectory,
      file,
      `stored ${evidence.kind} evidence`,
      this.privateIoHook("read")
    );
    if (stored.byteLength !== evidence.byteLength || sha256(stored) !== evidence.sha256) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Stored ${evidence.kind} evidence failed exact-byte verification for ${legacyId}`
      );
    }
  }

  private verifyStoredEvidence(
    evidence: OwnerReferenceMigrationEvidenceRef | null,
    legacyId: string
  ): void {
    if (!evidence) return;
    const file = this.quarantineEvidencePath(evidence);
    if (!this.privateRegularFileExists(file, `private ${evidence.kind} evidence`)) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Private ${evidence.kind} evidence is missing for ${legacyId}`
      );
    }
    const bytes = readPrivateRegularFile(
      this.privateOutputRootDirectory,
      file,
      `private ${evidence.kind} evidence`,
      this.privateIoHook("read")
    );
    if (bytes.byteLength !== evidence.byteLength || sha256(bytes) !== evidence.sha256) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Private ${evidence.kind} evidence failed verification for ${legacyId}`
      );
    }
  }

  private verifyIntentEvidence(intent: CommitIntent): void {
    for (const mapping of intent.mappings) {
      this.verifyStoredEvidence(mapping.legacyRecordEvidence, mapping.legacyId);
    }
    for (const quarantine of intent.quarantines) {
      this.verifyStoredEvidence(quarantine.legacyRecordEvidence, quarantine.legacyId);
      this.verifyStoredEvidence(quarantine.observedContentEvidence, quarantine.legacyId);
    }
  }

  private verifyCommittedGraph(
    intent: CommitIntent,
    journal: OwnerReferenceMigrationJournal
  ): void {
    const receiptFile = this.graphReceiptPath(intent.planDigest);
    if (!this.privateRegularFileExists(receiptFile, "migration graph receipt")) {
      throw new OwnerReferenceMigrationRecoveryRequiredError(
        "Committed migration graph receipt is unavailable"
      );
    }
    const receipt = readGraphReceipt(
      receiptFile,
      this.privateOutputRootDirectory,
      this.privateIoHook("read")
    );
    const targetRecordRefs = uniqueTargetRecords(
      intent.mappings.flatMap(({ targetRecords }) => targetRecords)
    ).map(refFor);
    if (
      receipt.planDigest !== intent.planDigest ||
      canonicalReferenceJson(receipt.expectedGraphHead) !==
        canonicalReferenceJson(intent.expectedGraphHead) ||
      canonicalReferenceJson(receipt.targetRecordRefs) !== canonicalReferenceJson(targetRecordRefs)
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Committed migration graph receipt does not close over its immutable intent"
      );
    }
    this.verifyGraphReceipt(receipt, intent.mappings);
    const receiptGraphHead = receipt.committedGraphHead
      ? { id: receipt.committedGraphHead.snapshotId, digest: receipt.committedGraphHead.digest }
      : null;
    if (canonicalReferenceJson(journal.graphHeadRef) !== canonicalReferenceJson(receiptGraphHead)) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Committed migration journal does not name its exact verified graph snapshot"
      );
    }
  }

  private quarantineEvidencePath(evidence: OwnerReferenceMigrationEvidenceRef): string {
    return path.join(this.quarantineEvidenceRootDirectory, evidence.kind, `${evidence.sha256}.bin`);
  }

  private stageMigrationGraph(intent: CommitIntent): ReferenceSourceStagingHead | null {
    const targetRecords = uniqueTargetRecords(
      intent.mappings.flatMap(({ targetRecords }) => targetRecords)
    );
    const targetRecordRefs = targetRecords.map(refFor);
    const receiptFile = this.graphReceiptPath(intent.planDigest);
    if (this.privateRegularFileExists(receiptFile, "migration graph receipt")) {
      const receipt = readGraphReceipt(
        receiptFile,
        this.privateOutputRootDirectory,
        this.privateIoHook("read")
      );
      if (
        receipt.planDigest !== intent.planDigest ||
        canonicalReferenceJson(receipt.expectedGraphHead) !==
          canonicalReferenceJson(intent.expectedGraphHead) ||
        canonicalReferenceJson(receipt.targetRecordRefs) !==
          canonicalReferenceJson(targetRecordRefs)
      ) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Immutable migration graph receipt does not match the commit intent"
        );
      }
      this.verifyGraphReceipt(receipt, intent.mappings);
      return receipt.committedGraphHead;
    }

    const current = this.migrationGraphService.readCurrent();
    const expectedSnapshot = intent.expectedGraphHead
      ? requireGraphSnapshot(
          this.migrationGraphService.readSnapshot(intent.expectedGraphHead.snapshotId).snapshot,
          intent.expectedGraphHead.snapshotId
        )
      : null;
    if (
      expectedSnapshot &&
      (expectedSnapshot.digest !== intent.expectedGraphHead?.digest ||
        expectedSnapshot.revision !== intent.expectedGraphHead.revision)
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Migration plan graph head no longer resolves to its exact snapshot"
      );
    }
    const expectedRecords = expectedSnapshot?.records ?? [];
    const expectedById = new Map(expectedRecords.map((record) => [record.id, record] as const));
    const missing = targetRecords.filter((record) => !expectedById.has(record.id));
    for (const record of targetRecords) {
      const present = expectedById.get(record.id);
      if (
        present &&
        (present.digest !== record.digest || present.recordKind !== record.recordKind)
      ) {
        throw new OwnerReferenceMigrationConflictError(
          `Migration target record ID is already bound to different bytes: ${record.id}`
        );
      }
    }

    let committedGraphHead: ReferenceSourceStagingHead | null;
    if (missing.length === 0) {
      committedGraphHead = intent.expectedGraphHead;
    } else if (sameNullableStagingHead(current.head, intent.expectedGraphHead)) {
      const expectedHeadRef = stagingHeadRef(current.head);
      const transaction: ReferenceSourceStagingTransaction = {
        schemaVersion: 1,
        id: `transaction.owner-reference-migration.${intent.planDigest.slice(0, 32)}`,
        ...(expectedHeadRef ? { expectedHeadRef } : {}),
        operations: missing.map((record) => ({ type: "append_record" as const, record })),
        submittedAt: intent.recordedAt,
      };
      try {
        committedGraphHead = this.migrationGraphService.applyTransaction(transaction).head;
      } catch (error) {
        if (error instanceof ReferenceSourceStagingConflictError) {
          throw new OwnerReferenceMigrationConflictError(error.message);
        }
        throw error;
      }
    } else {
      committedGraphHead = this.findRecoveredGraphHead(
        intent.expectedGraphHead,
        expectedRecords,
        targetRecords
      );
      if (!committedGraphHead) {
        throw new OwnerReferenceMigrationConflictError(
          "Migration graph head advanced without the exact planned migration snapshot"
        );
      }
    }

    const receipt = bindGraphReceipt({
      planDigest: intent.planDigest,
      expectedGraphHead: intent.expectedGraphHead,
      committedGraphHead,
      targetRecordRefs,
    });
    writeImmutableIntent(
      receiptFile,
      receipt,
      this.privateOutputRootDirectory,
      this.privateIoHook("create")
    );
    this.verifyGraphReceipt(receipt, intent.mappings);
    return committedGraphHead;
  }

  private findRecoveredGraphHead(
    expectedHead: ReferenceSourceStagingHead | null,
    expectedRecords: GraphRecordIdentity[],
    targetRecords: ReferenceSourceStagingInputRecord[]
  ): ReferenceSourceStagingHead | null {
    let snapshot = this.migrationGraphService.readCurrent().snapshot;
    while (snapshot) {
      const parentMatches = expectedHead
        ? Boolean(
            snapshot.parentSnapshotRef?.id === expectedHead.snapshotId &&
            snapshot.parentSnapshotRef?.digest === expectedHead.digest
          )
        : !snapshot.parentSnapshotRef;
      if (
        parentMatches &&
        exactGraphRecordSet(snapshot.records, [...expectedRecords, ...targetRecords])
      ) {
        return { snapshotId: snapshot.id, digest: snapshot.digest, revision: snapshot.revision };
      }
      if (!snapshot.parentSnapshotRef) break;
      snapshot = requireGraphSnapshot(
        this.migrationGraphService.readSnapshot(snapshot.parentSnapshotRef.id).snapshot,
        snapshot.parentSnapshotRef.id
      );
    }
    return null;
  }

  private verifyGraphReceipt(
    receipt: MigrationGraphReceipt,
    mappings: OwnerReferenceMigrationMapping[]
  ): void {
    if (!receipt.committedGraphHead) {
      if (mappings.length > 0) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Migration graph receipt omitted a required committed graph head"
        );
      }
      return;
    }
    const snapshot = requireGraphSnapshot(
      this.migrationGraphService.readSnapshot(receipt.committedGraphHead.snapshotId).snapshot,
      receipt.committedGraphHead.snapshotId
    );
    if (
      snapshot.digest !== receipt.committedGraphHead.digest ||
      snapshot.revision !== receipt.committedGraphHead.revision ||
      !graphSnapshotContainsMappings(snapshot.records, mappings)
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Migration graph receipt does not resolve to the exact staged target records"
      );
    }
  }

  private controlledContainsMapping(mapping: OwnerReferenceMigrationMapping): boolean {
    const asset = targetAsset(mapping);
    const observation = this.controlledStore.observe();
    if (observation.status !== "complete") return false;
    return observation.artifactBindings.some(
      (binding) =>
        binding.artifactRef.id === asset.id &&
        binding.artifactRef.digest === asset.digest &&
        binding.blobSha256 === asset.sha256 &&
        binding.byteLength === asset.byteLength
    );
  }

  private decodedJournal() {
    const current = this.journalStore.readCurrent();
    return decodeMigrationRecords(current?.records ?? []);
  }

  private captureLegacyInventory(): LegacyOwnerReferenceInventory {
    try {
      return this.legacySource.capture();
    } catch (error) {
      if (error instanceof OwnerReferenceLegacyReadError) {
        throw new OwnerReferenceMigrationIntegrityError(error.message);
      }
      throw error;
    }
  }

  private captureCompatibilityInventory(): LegacyOwnerReferenceInventory | null {
    try {
      return this.legacySource.capture();
    } catch (error) {
      // Compatibility is journal-authoritative after publication. A missing,
      // corrupt, unsafe, unstable, or otherwise unreadable legacy source must
      // remain explicit without erasing permanent migration resolutions.
      if (
        error instanceof OwnerReferenceLegacyReadError ||
        error instanceof OwnerReferenceClaimIntegrityError ||
        (error instanceof ApiRouteError && [404, 409, 410].includes(error.status))
      ) {
        return null;
      }
      throw error;
    }
  }

  private withStableLegacyInventory<T>(
    operation: (inventory: LegacyOwnerReferenceInventory) => T
  ): T {
    try {
      return this.legacySource.withStableInventory(operation);
    } catch (error) {
      if (error instanceof OwnerReferenceClaimIntegrityError) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(error.message);
      }
      if (error instanceof ApiRouteError && error.status === 409) {
        throw new OwnerReferenceMigrationConflictError(error.message);
      }
      throw error;
    }
  }

  private reclaimRetryOrphan(transaction: KnowledgePublicationTransaction): void {
    try {
      this.journalStore.reclaimExactTransactionOrphan(transaction);
    } catch (error) {
      throw translateMigrationStoreError(error);
    }
  }

  private rememberPublicationTransaction(
    intent: CommitIntent,
    transaction: KnowledgePublicationTransaction
  ): void {
    const receipt = bindPublicationTransactionIntent(intent.planDigest, transaction);
    writeImmutableIntent(
      this.publicationTransactionIntentPath(transaction.transactionId),
      receipt,
      this.privateOutputRootDirectory,
      this.privateIoHook("create")
    );
  }

  private reclaimPlanRetryOrphans(intent: CommitIntent): void {
    for (const orphan of this.journalStore.listOrphans()) {
      if (
        !orphan.transactionId ||
        !migrationTransactionBelongsToPlan(orphan.transactionId, intent.planDigest)
      ) {
        continue;
      }
      const receiptFile = this.publicationTransactionIntentPath(orphan.transactionId);
      if (!this.privateRegularFileExists(receiptFile, "migration publication transaction intent")) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          "Migration-owned publication orphan lacks its exact private transaction intent"
        );
      }
      const receipt = readPublicationTransactionIntent(
        receiptFile,
        this.privateOutputRootDirectory,
        this.privateIoHook("read")
      );
      if (
        receipt.planDigest !== intent.planDigest ||
        receipt.transaction.transactionId !== orphan.transactionId
      ) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Migration publication transaction intent does not match its orphan"
        );
      }
      this.reclaimRetryOrphan(receipt.transaction);
    }
  }

  private withMigrationClaim<T>(operation: () => T): T {
    ensurePrivateDirectory(this.privateOutputRootDirectory, this.intentRootDirectory);
    const claimPath = path.join(this.intentRootDirectory, ".migration.claim");
    const claim = this.acquireMigrationClaim(claimPath);
    try {
      return operation();
    } finally {
      this.releaseOwnedMigrationClaim(claim, "migration transaction claim");
    }
  }

  private acquireMigrationClaim(claimPath: string): {
    descriptor: number;
    path: string;
    receipt: MigrationClaimReceipt;
    serialized: string;
  } {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      this.reapDeadMigrationRecoveryTickets();
      if (this.migrationRecoveryTicketPaths().length > 0) {
        throw new OwnerReferenceMigrationConflictError(
          "OwnerReference migration claim recovery is already in progress"
        );
      }
      let claim: ReturnType<OwnerReferenceMigrationService["createOwnedMigrationClaim"]>;
      try {
        claim = this.createOwnedMigrationClaim(claimPath);
      } catch (error) {
        if (!isFileExistsError(error)) throw error;
        this.privateRegularFileExists(claimPath, "migration claim");
        if (this.recoverStaleMigrationClaim(claimPath)) continue;
        throw new OwnerReferenceMigrationConflictError(
          "Another OwnerReference migration writer owns the transaction claim"
        );
      }
      try {
        this.faultInjector?.({ point: "after_migration_claim_published", path: claim.path });
        this.reapDeadMigrationRecoveryTickets();
        if (this.migrationRecoveryTicketPaths().length > 0) {
          throw new OwnerReferenceMigrationConflictError(
            "OwnerReference migration claim recovery raced this writer"
          );
        }
        return claim;
      } catch (error) {
        this.releaseOwnedMigrationClaim(claim, "racing migration transaction claim");
        throw error;
      }
    }
    throw new OwnerReferenceMigrationConflictError(
      "OwnerReference migration claim remained unavailable after recovery"
    );
  }

  private recoverStaleMigrationClaim(claimPath: string): boolean {
    const ticketPath = path.join(
      this.intentRootDirectory,
      `.migration-recovery.${randomUUID()}.ticket`
    );
    const ticket = this.createOwnedMigrationClaim(ticketPath);
    try {
      this.faultInjector?.({
        point: "after_migration_recovery_ticket_published",
        path: ticket.path,
      });
      this.reapDeadMigrationRecoveryTickets(ticket.path);
      if (this.migrationRecoveryTicketPaths().some((candidate) => candidate !== ticket.path)) {
        return false;
      }

      if (!this.privateRegularFileExists(claimPath, "migration claim")) return true;
      const original = readPrivateRegularFile(
        this.privateOutputRootDirectory,
        claimPath,
        "migration claim",
        this.privateIoHook("read")
      ).toString("utf8");
      const receipt = decodeMigrationClaim(original);
      if (!migrationClaimOwnerIsProvablyAbsent(receipt, this.claimRuntime)) return false;
      if (
        !this.privateRegularFileExists(claimPath, "migration claim") ||
        readPrivateRegularFile(
          this.privateOutputRootDirectory,
          claimPath,
          "migration claim",
          this.privateIoHook("read")
        ).toString("utf8") !== original
      )
        return false;
      const quarantine = `${claimPath}.orphan.${randomUUID()}`;
      renameSync(claimPath, quarantine);
      try {
        if (
          readPrivateRegularFile(
            this.privateOutputRootDirectory,
            quarantine,
            "recovered migration claim",
            this.privateIoHook("read")
          ).toString("utf8") !== original
        ) {
          throw new OwnerReferenceMigrationRecoveryRequiredError(
            "Recovered migration claim bytes changed during guarded rename"
          );
        }
        this.recordRecoveredMigrationClaim("migration-claim", original, receipt);
        return true;
      } finally {
        rmSync(quarantine, { force: true });
        fsyncDirectory(this.intentRootDirectory);
      }
    } finally {
      this.releaseOwnedMigrationClaim(ticket, "migration recovery ticket");
    }
  }

  private createOwnedMigrationClaim(file: string): {
    descriptor: number;
    path: string;
    receipt: MigrationClaimReceipt;
    serialized: string;
  } {
    const stableHostIdentity = this.claimRuntime.hostIdentity();
    const receipt: MigrationClaimReceipt = {
      schemaVersion: 1,
      token: randomUUID(),
      pid: process.pid,
      hostIdentity: stableHostIdentity ?? `unrecoverable:${randomUUID()}`,
      bootIdentity: this.claimRuntime.bootIdentity(),
      processStartIdentity: this.claimRuntime.processStartIdentity(process.pid),
      claimedAt: this.now().toISOString(),
    };
    const serialized = `${canonicalReferenceJson(receipt)}\n`;
    ensurePrivateDirectory(this.privateOutputRootDirectory, path.dirname(file));
    const ancestorIdentities = privateAncestorIdentities(this.privateOutputRootDirectory, file);
    this.privateIoHook("create")(file);
    const descriptor = openSync(
      file,
      fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
    try {
      assertOpenedPrivateFile(
        this.privateOutputRootDirectory,
        file,
        descriptor,
        ancestorIdentities,
        "migration claim"
      );
      writeFileSync(descriptor, serialized);
      fsyncSync(descriptor);
      assertOpenedPrivateFile(
        this.privateOutputRootDirectory,
        file,
        descriptor,
        ancestorIdentities,
        "migration claim"
      );
      fsyncDirectory(this.intentRootDirectory);
      return { descriptor, path: file, receipt, serialized };
    } catch (error) {
      if (pathMatchesDescriptor(file, descriptor)) rmSync(file, { force: true });
      closeSync(descriptor);
      throw error;
    }
  }

  private releaseOwnedMigrationClaim(
    claim: { descriptor: number; path: string; serialized: string },
    label: string
  ): void {
    try {
      if (
        !pathMatchesDescriptor(claim.path, claim.descriptor) ||
        readDescriptorText(claim.descriptor) !== claim.serialized
      ) {
        throw new OwnerReferenceMigrationRecoveryRequiredError(
          `OwnerReference ${label} changed before release`
        );
      }
      rmSync(claim.path);
      fsyncDirectory(this.intentRootDirectory);
    } finally {
      closeSync(claim.descriptor);
    }
  }

  private migrationRecoveryTicketPaths(): string[] {
    if (!pathEntryExists(this.intentRootDirectory)) return [];
    return readdirSync(this.intentRootDirectory)
      .filter((name) => /^\.migration-recovery\.[0-9a-f-]{36}\.ticket$/.test(name))
      .map((name) => path.join(this.intentRootDirectory, name))
      .sort();
  }

  private reapDeadMigrationRecoveryTickets(ownedTicketPath?: string): void {
    for (const ticketPath of this.migrationRecoveryTicketPaths()) {
      if (ticketPath === ownedTicketPath) continue;
      const original = readPrivateRegularFile(
        this.privateOutputRootDirectory,
        ticketPath,
        "migration recovery ticket",
        this.privateIoHook("read")
      ).toString("utf8");
      const receipt = decodeMigrationClaim(original);
      if (!migrationClaimOwnerIsProvablyAbsent(receipt, this.claimRuntime)) continue;
      if (
        !this.privateRegularFileExists(ticketPath, "migration recovery ticket") ||
        readPrivateRegularFile(
          this.privateOutputRootDirectory,
          ticketPath,
          "migration recovery ticket",
          this.privateIoHook("read")
        ).toString("utf8") !== original
      ) {
        continue;
      }
      const quarantine = `${ticketPath}.orphan.${randomUUID()}`;
      renameSync(ticketPath, quarantine);
      try {
        if (
          readPrivateRegularFile(
            this.privateOutputRootDirectory,
            quarantine,
            "recovered migration recovery ticket",
            this.privateIoHook("read")
          ).toString("utf8") !== original
        ) {
          throw new OwnerReferenceMigrationRecoveryRequiredError(
            "Recovered migration recovery ticket changed during guarded rename"
          );
        }
        this.recordRecoveredMigrationClaim("migration-recovery-ticket", original, receipt);
      } finally {
        rmSync(quarantine, { force: true });
        fsyncDirectory(this.intentRootDirectory);
      }
    }
  }

  private recordRecoveredMigrationClaim(
    kind: "migration-claim" | "migration-recovery-ticket",
    original: string,
    receipt: MigrationClaimReceipt
  ): void {
    const recoveryDirectory = path.join(this.intentRootDirectory, "recoveries");
    ensurePrivateDirectory(this.privateOutputRootDirectory, recoveryDirectory);
    const recoveryPath = path.join(recoveryDirectory, `claim.${randomUUID()}.json`);
    const recovery = {
      schemaVersion: 1,
      kind,
      recoveredClaimDigest: sha256(original),
      absentOwner: {
        pid: receipt.pid,
        hostIdentity: receipt.hostIdentity,
        bootIdentity: receipt.bootIdentity,
        processStartIdentity: receipt.processStartIdentity,
      },
      recoveredAt: this.now().toISOString(),
    };
    writeImmutableBytes(
      recoveryPath,
      `${canonicalReferenceJson(recovery)}\n`,
      this.privateOutputRootDirectory,
      this.privateIoHook("create")
    );
  }

  private commitIntentPath(planDigest: string): string {
    return path.join(this.intentRootDirectory, `commit.${planDigest}.json`);
  }

  private graphReceiptPath(planDigest: string): string {
    return path.join(this.intentRootDirectory, `graph.${planDigest}.json`);
  }

  private rollbackIntentPath(
    batchId: string,
    expectedHead: KnowledgePublicationGenerationRef
  ): string {
    return path.join(
      this.intentRootDirectory,
      `rollback.${sha256(`${batchId}\u0000${expectedHead.digest}`)}.json`
    );
  }

  private interruptedRollbackIntentPath(
    planDigest: string,
    expectedHead: OwnerReferenceMigrationExpectedHead
  ): string {
    return path.join(
      this.intentRootDirectory,
      `rollback-interrupted.${sha256(
        `${planDigest}\u0000${canonicalReferenceJson(expectedHead)}`
      )}.json`
    );
  }

  private publicationTransactionIntentPath(transactionId: string): string {
    return path.join(
      this.intentRootDirectory,
      `publication-transaction.${sha256(transactionId)}.json`
    );
  }

  private privateRegularFileExists(file: string, label: string): boolean {
    ensurePrivateDirectory(this.privateOutputRootDirectory, path.dirname(file));
    if (!pathEntryExists(file)) return false;
    assertPrivateRegularFile(this.privateOutputRootDirectory, file, label);
    return true;
  }

  private privateIoHook(operation: "read" | "create"): (file: string) => void {
    return (file) =>
      this.faultInjector?.({ point: "before_private_file_open", path: file, operation });
  }
}

function mappingFor(observation: LegacyOwnerReferenceObservation): OwnerReferenceMigrationMapping {
  const reference = observation.reference!;
  const content = observation.content!;
  const rawRecordSha256 = observation.rawRecordSha256!;
  const rawRecordByteLength = observation.rawRecordByteLength!;
  const legacyRecordRef: ReferenceRecordRef = {
    id: `legacy-owner-reference-record.${sha256(reference.id).slice(0, 32)}`,
    digest: rawRecordSha256,
  };
  const asset = withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.sha256.${reference.sha256}`,
    sha256: reference.sha256,
    mediaType: reference.mimeType,
    byteLength: content.byteLength,
  }) as ReferenceDigitalAsset;
  const acquisition = withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: `acquisition.legacy-owner-reference.${sha256(reference.id).slice(0, 32)}`,
    digitalAssetRef: refFor(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "legacy_owner_reference" as const, legacyRecordRef },
    acquiredAt: reference.createdAt,
    rightsAssertionRefs: [],
    processingPolicyRef: MIGRATION_POLICY_REF,
  }) as ReferenceAssetAcquisition;
  const mapping: OwnerReferenceMigrationMapping = {
    schemaId: "vellum.owner-reference-migration.mapping.v1",
    legacyId: reference.id,
    legacyRecordDigest: rawRecordSha256,
    legacyRecordRef,
    legacyCitationDigest: sha256(reference.citation),
    legacySnapshot: {
      id: reference.id,
      title: reference.title,
      citation: reference.citation,
      mimeType: reference.mimeType,
      sha256: reference.sha256,
      byteLength: reference.byteLength ?? null,
      createdAt: reference.createdAt,
      rawRecordSha256,
      rawRecordByteLength,
    },
    legacyRecordEvidence: {
      kind: "legacy_record",
      sha256: rawRecordSha256,
      byteLength: rawRecordByteLength,
    },
    byteVerification: {
      declaredSha256: reference.sha256,
      observedSha256: sha256(content),
      targetSha256: asset.sha256,
      declaredByteLength: reference.byteLength ?? null,
      observedByteLength: content.byteLength,
      targetByteLength: asset.byteLength,
      exact: true,
    },
    targetRecords: [asset, acquisition],
    targetAssetRef: refFor(asset),
    targetAcquisitionRef: refFor(acquisition),
    accessDecisionRefs: [],
    bibliographicIdentity: {
      state: "not_asserted",
      workRefs: [],
      manifestationRefs: [],
      exemplarRefs: [],
    },
    bindingDisposition: "pending_owner_authorization",
  };
  return Value.Decode(OwnerReferenceMigrationMappingSchema, mapping);
}

function quarantineEntry(
  observation: LegacyOwnerReferenceObservation,
  reason: OwnerReferenceMigrationQuarantineReason,
  action: OwnerReferenceMigrationQuarantineAction
): Extract<PlanEntry, { kind: "quarantine" }> {
  const legacySnapshot = legacySnapshotForObservation(observation);
  return {
    kind: "quarantine",
    legacyId: observation.legacyId,
    rawLegacyId: observation.rawLegacyId,
    legacyRecordDigest: observation.rawRecordSha256,
    legacyRecordByteLength: observation.rawRecordByteLength,
    legacySnapshot,
    legacyRecordEvidence: evidenceRef("legacy_record", observation.rawRecordBytes),
    observedContentEvidence: evidenceRef("observed_content", observation.content),
    reason,
    action,
    declaredSha256: observation.reference?.sha256 ?? null,
    observedSha256: observation.content
      ? sha256(observation.content)
      : (observation.failure?.observedSha256 ?? null),
    declaredByteLength: observation.reference?.byteLength ?? null,
    observedByteLength:
      observation.content?.byteLength ?? observation.failure?.observedByteLength ?? null,
    alreadyQuarantined: false,
  };
}

function legacySnapshotForObservation(
  observation: LegacyOwnerReferenceObservation
): OwnerReferenceMigrationMapping["legacySnapshot"] | null {
  const reference = observation.reference;
  if (
    !reference ||
    reference.id !== observation.legacyId ||
    !isSafeId(reference.id) ||
    !observation.rawRecordSha256 ||
    !observation.rawRecordByteLength
  )
    return null;
  return {
    id: reference.id,
    title: reference.title,
    citation: reference.citation,
    mimeType: reference.mimeType,
    sha256: reference.sha256,
    byteLength: reference.byteLength ?? null,
    createdAt: reference.createdAt,
    rawRecordSha256: observation.rawRecordSha256,
    rawRecordByteLength: observation.rawRecordByteLength,
  };
}

function evidenceRef(
  kind: OwnerReferenceMigrationEvidenceRef["kind"],
  bytes: Buffer | null
): OwnerReferenceMigrationEvidenceRef | null {
  return bytes ? { kind, sha256: sha256(bytes), byteLength: bytes.byteLength } : null;
}

function evidenceMatchesBytes(
  evidence: OwnerReferenceMigrationEvidenceRef | null,
  bytes: Buffer | null
): boolean {
  if (!evidence) return true;
  return Boolean(
    bytes && bytes.byteLength === evidence.byteLength && sha256(bytes) === evidence.sha256
  );
}

function sameQuarantineEvidence(
  planned: Extract<PlanEntry, { kind: "quarantine" }>,
  existing: OwnerReferenceMigrationQuarantine
): boolean {
  return (
    planned.rawLegacyId === existing.rawLegacyId &&
    planned.legacyRecordDigest === existing.legacyRecordDigest &&
    planned.legacyRecordByteLength === existing.legacyRecordByteLength &&
    canonicalReferenceJson(planned.legacySnapshot) ===
      canonicalReferenceJson(existing.legacySnapshot) &&
    canonicalReferenceJson(planned.legacyRecordEvidence) ===
      canonicalReferenceJson(existing.legacyRecordEvidence) &&
    canonicalReferenceJson(planned.observedContentEvidence) ===
      canonicalReferenceJson(existing.observedContentEvidence) &&
    planned.reason === existing.reason &&
    planned.action === existing.action &&
    planned.declaredSha256 === existing.declaredSha256 &&
    planned.observedSha256 === existing.observedSha256 &&
    planned.declaredByteLength === existing.declaredByteLength &&
    planned.observedByteLength === existing.observedByteLength
  );
}

function bindCommitIntent(plan: ComputedPlan, recordedAt: string): CommitIntent {
  const mappings = plan.entries
    .filter((entry): entry is Extract<PlanEntry, { kind: "mapping" }> => entry.kind === "mapping")
    .map(({ mapping }) => mapping);
  const quarantines = plan.entries
    .filter(
      (entry): entry is Extract<PlanEntry, { kind: "quarantine" }> => entry.kind === "quarantine"
    )
    .map((entry) =>
      Value.Decode(OwnerReferenceMigrationQuarantineSchema, {
        schemaId: "vellum.owner-reference-migration.quarantine.v1",
        batchId: plan.batchId,
        legacyId: entry.legacyId,
        rawLegacyId: entry.rawLegacyId,
        legacyRecordDigest: entry.legacyRecordDigest,
        legacyRecordByteLength: entry.legacyRecordByteLength,
        legacySnapshot: entry.legacySnapshot,
        legacyRecordEvidence: entry.legacyRecordEvidence,
        observedContentEvidence: entry.observedContentEvidence,
        reason: entry.reason,
        action: entry.action,
        declaredSha256: entry.declaredSha256,
        observedSha256: entry.observedSha256,
        declaredByteLength: entry.declaredByteLength,
        observedByteLength: entry.observedByteLength,
      })
    );
  const core = {
    schemaVersion: 1 as const,
    kind: "owner_reference_migration_commit_intent" as const,
    stageProtocolVersion: MIGRATION_STAGE_PROTOCOL_VERSION,
    chunkSize: MIGRATION_STAGE_CHUNK_SIZE,
    planDigest: plan.planDigest,
    batchId: plan.batchId,
    expectedHead: plan.expectedHead,
    expectedGraphHead: plan.expectedGraphHead,
    legacyInventoryDigest: plan.inventory.inventoryDigest,
    recordedAt,
    mappings,
    quarantines,
  };
  return { ...core, digest: sha256(canonicalReferenceJson(core)) };
}

type MigrationPayloadWrite = {
  write: KnowledgePublicationWrite;
  ref: KnowledgePublicationRecordRef;
};

function migrationPayload(intent: CommitIntent): {
  writes: MigrationPayloadWrite[];
  mappingRecordRefs: ReferenceRecordRef[];
  quarantineRecordRefs: ReferenceRecordRef[];
} {
  const mappingWrites = uniqueMigrationPayloadWrites(intent.mappings.map(mappingWrite));
  const quarantineWrites = uniqueMigrationPayloadWrites(intent.quarantines.map(quarantineWrite));
  const writes = uniqueMigrationPayloadWrites([
    ...mappingWrites.map(({ write }) => write),
    ...quarantineWrites.map(({ write }) => write),
  ]);
  return {
    writes,
    mappingRecordRefs: uniqueRefs(mappingWrites.map(({ ref }) => stripRecordKind(ref))),
    quarantineRecordRefs: uniqueRefs(quarantineWrites.map(({ ref }) => stripRecordKind(ref))),
  };
}

function uniqueMigrationPayloadWrites(
  writes: KnowledgePublicationWrite[]
): MigrationPayloadWrite[] {
  const byId = new Map<string, MigrationPayloadWrite>();
  for (const write of writes) {
    const candidate = { write, ref: knowledgePublicationRecordRefForWrite(write) };
    const existing = byId.get(candidate.ref.id);
    if (
      existing &&
      (existing.ref.recordKind !== candidate.ref.recordKind ||
        existing.ref.digest !== candidate.ref.digest)
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Migration payload reuses immutable record ID with different bytes: ${candidate.ref.id}`
      );
    }
    byId.set(candidate.ref.id, existing ?? candidate);
  }
  return [...byId.values()].sort((left, right) => {
    const byKind = left.ref.recordKind.localeCompare(right.ref.recordKind);
    const byId = left.ref.id.localeCompare(right.ref.id);
    return byKind || byId || left.ref.digest.localeCompare(right.ref.digest);
  });
}

function migrationStageTransaction(
  intent: CommitIntent,
  expectedHead: OwnerReferenceMigrationExpectedHead,
  writes: MigrationPayloadWrite[]
): KnowledgePublicationTransaction {
  if (writes.length === 0 || writes.length > intent.chunkSize) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Migration stage chunk violates the immutable publication protocol"
    );
  }
  return {
    schemaVersion: 1,
    transactionId: migrationStageTransactionId(
      intent,
      expectedHead,
      writes.map(({ ref }) => ref)
    ),
    writerKind: "migration",
    expectedHead,
    writes: writes.map(({ write }) => write),
  };
}

function migrationStageTransactionId(
  intent: CommitIntent,
  expectedHead: OwnerReferenceMigrationExpectedHead,
  refs: KnowledgePublicationRecordRef[]
): string {
  const chunkDigest = sha256(canonicalReferenceJson(sortedPublicationRefs(refs)));
  return `owner-reference-migration-stage-v${MIGRATION_STAGE_PROTOCOL_VERSION}.${intent.planDigest.slice(
    0,
    32
  )}.${chunkDigest}.${publicationParentDigest(expectedHead)}`;
}

function chunked<T>(values: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new OwnerReferenceMigrationIntegrityError("Migration stage chunk size is invalid");
  }
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function readPublicationBase(
  store: KnowledgePublicationStore,
  expectedHead: OwnerReferenceMigrationExpectedHead
): KnowledgePublicationSnapshot | null {
  if (!expectedHead) return null;
  const snapshot = store.readGeneration(expectedHead.id);
  if (!sameNullablePublicationHead(snapshot.head, expectedHead)) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Migration base head does not resolve to its exact immutable generation"
    );
  }
  return snapshot;
}

function hasReachableOwnedMigrationStage(
  store: KnowledgePublicationStore,
  current: KnowledgePublicationSnapshot,
  intent: CommitIntent,
  payload: MigrationPayloadWrite[]
): boolean {
  const payloadById = new Map(payload.map(({ ref }) => [ref.id, ref] as const));
  let generation = current.generation;
  for (;;) {
    if (intent.expectedHead && generation.id === intent.expectedHead.id) return false;
    const refs = sortedPublicationRefs(generation.newRecordRefs);
    const exactPayloadChunk =
      refs.length > 0 &&
      refs.length <= intent.chunkSize &&
      refs.every((ref) => {
        const expected = payloadById.get(ref.id);
        return expected?.recordKind === ref.recordKind && expected.digest === ref.digest;
      });
    if (
      generation.writerKind === "migration" &&
      exactPayloadChunk &&
      generation.transactionId ===
        migrationStageTransactionId(intent, generation.parentGenerationRef ?? null, refs)
    ) {
      return true;
    }
    if (!generation.parentGenerationRef) return false;
    generation = store.readGeneration(generation.parentGenerationRef.id).generation;
  }
}

function assertPayloadRecordBindings(
  records: KnowledgePublicationRecord[],
  payload: MigrationPayloadWrite[]
): void {
  const byId = new Map(records.map((record) => [record.id, record] as const));
  for (const { ref } of payload) {
    const existing = byId.get(ref.id);
    if (existing && (existing.recordKind !== ref.recordKind || existing.digest !== ref.digest)) {
      throw new OwnerReferenceMigrationConflictError(
        `Migration payload record ID is already bound to different bytes: ${ref.id}`
      );
    }
  }
}

function publicationSnapshotRef(
  snapshot: KnowledgePublicationSnapshot | null
): OwnerReferenceMigrationExpectedHead {
  return snapshot
    ? {
        id: snapshot.head.generationId,
        digest: snapshot.head.digest,
        revision: snapshot.head.revision,
      }
    : null;
}

function publicationParentDigest(expectedHead: OwnerReferenceMigrationExpectedHead): string {
  return expectedHead?.digest ?? sha256(canonicalReferenceJson(null));
}

function assertStageGeneration(
  published: KnowledgePublicationSnapshot,
  transaction: KnowledgePublicationTransaction,
  chunk: MigrationPayloadWrite[],
  parent: KnowledgePublicationSnapshot | null
): void {
  const expectedHead = publicationSnapshotRef(parent);
  const expectedRefs = sortedPublicationRefs(chunk.map(({ ref }) => ref));
  if (
    transaction.expectedHead === undefined ||
    !sameNullableGenerationRef(transaction.expectedHead, expectedHead) ||
    published.generation.transactionId !== transaction.transactionId ||
    published.generation.writerKind !== "migration" ||
    !sameNullableGenerationRef(published.generation.parentGenerationRef ?? null, expectedHead) ||
    published.generation.revision !== (expectedHead?.revision ?? 0) + 1 ||
    canonicalReferenceJson(sortedPublicationRefs(published.generation.newRecordRefs)) !==
      canonicalReferenceJson(expectedRefs) ||
    published.head.generationId !== published.generation.id ||
    published.head.digest !== published.generation.digest ||
    published.head.revision !== published.generation.revision
  ) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Migration payload stage did not publish the exact chained generation"
    );
  }
  assertPayloadRecordsReachable(published.records, chunk);
}

function assertPayloadRecordsReachable(
  records: KnowledgePublicationRecord[],
  payload: MigrationPayloadWrite[]
): void {
  const byId = new Map(records.map((record) => [record.id, record] as const));
  for (const { ref } of payload) {
    const record = byId.get(ref.id);
    if (!record || record.recordKind !== ref.recordKind || record.digest !== ref.digest) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Migration payload record is not exactly reachable at the stage tip: ${ref.id}`
      );
    }
  }
}

function assertTerminalGeneration(
  published: KnowledgePublicationSnapshot,
  transaction: KnowledgePublicationTransaction,
  parent: KnowledgePublicationSnapshot | null
): void {
  const expectedHead = publicationSnapshotRef(parent);
  const journal = decodeJournal(transaction.writes[0]?.content);
  const expectedRefs = sortedPublicationRefs(
    transaction.writes.map(knowledgePublicationRecordRefForWrite)
  );
  if (
    transaction.writes.length !== 1 ||
    transaction.writes[0]?.recordKind !== "owner_reference_migration_journal" ||
    !sameNullableGenerationRef(transaction.expectedHead, expectedHead) ||
    !sameNullableGenerationRef(journal.publicationParentRef, expectedHead) ||
    published.generation.transactionId !== transaction.transactionId ||
    !sameNullableGenerationRef(published.generation.parentGenerationRef ?? null, expectedHead) ||
    published.generation.revision !== (expectedHead?.revision ?? 0) + 1 ||
    canonicalReferenceJson(sortedPublicationRefs(published.generation.newRecordRefs)) !==
      canonicalReferenceJson(expectedRefs) ||
    published.head.generationId !== published.generation.id ||
    published.head.digest !== published.generation.digest ||
    published.head.revision !== published.generation.revision
  ) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Migration terminal generation is not the exact journal-only visibility commit"
    );
  }
}

function assertJournalPayloadClosure(
  journal: OwnerReferenceMigrationJournal,
  staged: StagedMigrationPayload
): void {
  if (
    canonicalReferenceJson(uniqueRefs(journal.mappingRecordRefs)) !==
      canonicalReferenceJson(staged.mappingRecordRefs) ||
    canonicalReferenceJson(uniqueRefs(journal.quarantineRecordRefs)) !==
      canonicalReferenceJson(staged.quarantineRecordRefs)
  ) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Migration journal does not name the exact staged payload closure"
    );
  }
}

function sortedPublicationRefs(
  refs: KnowledgePublicationRecordRef[]
): KnowledgePublicationRecordRef[] {
  return [...refs].sort((left, right) => {
    const byKind = left.recordKind.localeCompare(right.recordKind);
    const byId = left.id.localeCompare(right.id);
    return byKind || byId || left.digest.localeCompare(right.digest);
  });
}

function commitTransaction(
  intent: CommitIntent,
  graphHead: ReferenceSourceStagingHead | null,
  staged: StagedMigrationPayload
): KnowledgePublicationTransaction {
  const expectedHead = publicationSnapshotRef(staged.cursor);
  const predecessor = latestJournalRecord(staged.cursor?.records ?? [], intent.batchId);
  const journalContent: OwnerReferenceMigrationJournal = Value.Decode(
    OwnerReferenceMigrationJournalSchema,
    {
      schemaId: "vellum.owner-reference-migration.journal.v1",
      batchId: intent.batchId,
      planDigest: intent.planDigest,
      legacyInventoryDigest: intent.legacyInventoryDigest,
      action: "commit",
      state: "committed",
      sequence: (expectedHead?.revision ?? 0) + 1,
      publicationParentRef: expectedHead,
      graphHeadRef: graphHead ? { id: graphHead.snapshotId, digest: graphHead.digest } : null,
      mappingRecordRefs: staged.mappingRecordRefs,
      quarantineRecordRefs: staged.quarantineRecordRefs,
      predecessorJournalRef: predecessor
        ? stripRecordKind(publicationRecordRef(predecessor))
        : null,
      recordedAt: intent.recordedAt,
    }
  );
  const journalWrite: KnowledgePublicationWrite = {
    recordKind: "owner_reference_migration_journal",
    id: `owner-reference-migration-journal.${intent.batchId.slice(-32)}.commit`,
    successorRefs: predecessor ? [publicationRecordRef(predecessor)] : [],
    content: journalContent,
  };
  return {
    schemaVersion: 1,
    transactionId: commitTransactionId(intent, expectedHead),
    writerKind: "migration",
    expectedHead,
    writes: [journalWrite],
  };
}

function interruptedRollbackTransaction(input: {
  intent: CommitIntent;
  graphHead: ReferenceSourceStagingHead | null;
  staged: StagedMigrationPayload;
  recordedAt: string;
}): KnowledgePublicationTransaction {
  const expectedHead = publicationSnapshotRef(input.staged.cursor);
  const revision = (expectedHead?.revision ?? 0) + 1;
  const journalContent: OwnerReferenceMigrationJournal = Value.Decode(
    OwnerReferenceMigrationJournalSchema,
    {
      schemaId: "vellum.owner-reference-migration.journal.v1",
      batchId: input.intent.batchId,
      planDigest: input.intent.planDigest,
      legacyInventoryDigest: input.intent.legacyInventoryDigest,
      action: "rollback_interrupted",
      state: "rolled_back",
      sequence: revision,
      publicationParentRef: expectedHead,
      graphHeadRef: input.graphHead
        ? { id: input.graphHead.snapshotId, digest: input.graphHead.digest }
        : null,
      mappingRecordRefs: input.staged.mappingRecordRefs,
      quarantineRecordRefs: input.staged.quarantineRecordRefs,
      predecessorJournalRef: null,
      recordedAt: input.recordedAt,
    }
  );
  const journalWrite: KnowledgePublicationWrite = {
    recordKind: "owner_reference_migration_journal",
    id: `owner-reference-migration-journal.${input.intent.batchId.slice(-32)}.rollback-interrupted.${revision}`,
    successorRefs: [],
    content: journalContent,
  };
  return {
    schemaVersion: 1,
    transactionId: `owner-reference-migration-abort-v${MIGRATION_ABORT_PROTOCOL_VERSION}.${input.intent.planDigest.slice(
      0,
      32
    )}.${publicationParentDigest(expectedHead)}.final`,
    writerKind: "migration",
    expectedHead,
    writes: [journalWrite],
  };
}

function commitTransactionId(
  intent: CommitIntent,
  expectedHead: OwnerReferenceMigrationExpectedHead
): string {
  return `owner-reference-migration-visibility-v${MIGRATION_VISIBILITY_PROTOCOL_VERSION}.${intent.planDigest.slice(
    0,
    32
  )}.${publicationParentDigest(expectedHead)}.final`;
}

function rollbackTransactionId(
  batchId: string,
  expectedHead: KnowledgePublicationGenerationRef
): string {
  return `owner-reference-migration-rollback-v${MIGRATION_ROLLBACK_PROTOCOL_VERSION}.${sha256(
    `${batchId}\u0000${expectedHead.digest}`
  ).slice(0, 32)}`;
}

function migrationTransactionBelongsToPlan(transactionId: string, planDigest: string): boolean {
  const planPrefix = planDigest.slice(0, 32);
  return [
    `owner-reference-migration-stage-v${MIGRATION_STAGE_PROTOCOL_VERSION}.${planPrefix}.`,
    `owner-reference-migration-visibility-v${MIGRATION_VISIBILITY_PROTOCOL_VERSION}.${planPrefix}.`,
    `owner-reference-migration-abort-v${MIGRATION_ABORT_PROTOCOL_VERSION}.${planPrefix}.`,
  ].some((prefix) => transactionId.startsWith(prefix));
}

function verifyInterruptedRollbackIntent(
  rollbackIntent: InterruptedRollbackIntent,
  commitIntent: CommitIntent
): void {
  try {
    if (
      rollbackIntent.batchId !== commitIntent.batchId ||
      rollbackIntent.planDigest !== commitIntent.planDigest ||
      !sameNullableGenerationRef(rollbackIntent.expectedHead, commitIntent.expectedHead) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(rollbackIntent.recordedAt)
    ) {
      throw new Error("interrupted rollback batch closure is invalid");
    }
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `Interrupted migration rollback intent failed closure verification: ${errorMessage(error)}`
    );
  }
}

function verifyRollbackIntent(
  intent: RollbackIntent,
  batchId: string,
  expectedHead: KnowledgePublicationGenerationRef,
  prior: { record: KnowledgePublicationRecord; content: OwnerReferenceMigrationJournal }
): void {
  try {
    if (
      intent.batchId !== batchId ||
      !sameNullableGenerationRef(intent.expectedHead, expectedHead)
    ) {
      throw new Error("rollback request identity is invalid");
    }
    const journal = decodeJournal(intent.transaction.writes[0]?.content);
    const expectedTransaction: KnowledgePublicationTransaction = {
      schemaVersion: 1,
      transactionId: rollbackTransactionId(batchId, expectedHead),
      writerKind: "migration",
      expectedHead,
      writes: [
        rollbackJournalWrite({
          batchId,
          prior,
          expectedHead,
          recordedAt: journal.recordedAt,
        }),
      ],
    };
    if (
      canonicalReferenceJson(intent.transaction) !== canonicalReferenceJson(expectedTransaction)
    ) {
      throw new Error("rollback transaction closure is invalid");
    }
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `Migration rollback intent failed closure verification: ${errorMessage(error)}`
    );
  }
}

function rollbackJournalWrite(input: {
  batchId: string;
  prior: { record: KnowledgePublicationRecord; content: OwnerReferenceMigrationJournal };
  expectedHead: KnowledgePublicationGenerationRef;
  recordedAt: string;
}): KnowledgePublicationWrite {
  const content: OwnerReferenceMigrationJournal = Value.Decode(
    OwnerReferenceMigrationJournalSchema,
    {
      ...input.prior.content,
      action: "rollback",
      state: "rolled_back",
      sequence: input.expectedHead.revision + 1,
      publicationParentRef: input.expectedHead,
      predecessorJournalRef: stripRecordKind(publicationRecordRef(input.prior.record)),
      recordedAt: input.recordedAt,
    }
  );
  return {
    recordKind: "owner_reference_migration_journal",
    id: `owner-reference-migration-journal.${input.batchId.slice(-32)}.rollback.${input.expectedHead.revision + 1}`,
    successorRefs: [publicationRecordRef(input.prior.record)],
    content,
  };
}

function mappingWrite(mapping: OwnerReferenceMigrationMapping): KnowledgePublicationWrite {
  return {
    recordKind: "owner_reference_migration_mapping",
    id: `owner-reference-migration-mapping.${sha256(mapping.legacyId).slice(0, 32)}`,
    successorRefs: [],
    content: mapping,
  };
}

function quarantineWrite(quarantine: OwnerReferenceMigrationQuarantine): KnowledgePublicationWrite {
  return {
    recordKind: "owner_reference_migration_quarantine",
    id: `owner-reference-migration-quarantine.${quarantine.batchId.slice(-32)}.${sha256(
      canonicalReferenceJson(quarantine)
    ).slice(0, 32)}`,
    successorRefs: [],
    content: quarantine,
  };
}

function bindRollbackIntent(input: {
  batchId: string;
  expectedHead: KnowledgePublicationGenerationRef;
  transaction: KnowledgePublicationTransaction;
}): RollbackIntent {
  const core = {
    schemaVersion: 1 as const,
    kind: "owner_reference_migration_rollback_intent" as const,
    ...input,
  };
  return { ...core, digest: sha256(canonicalReferenceJson(core)) };
}

function bindInterruptedRollbackIntent(input: {
  planDigest: string;
  batchId: string;
  expectedHead: OwnerReferenceMigrationExpectedHead;
  recordedAt: string;
}): InterruptedRollbackIntent {
  const core = {
    schemaVersion: 1 as const,
    kind: "owner_reference_migration_interrupted_rollback_intent" as const,
    ...input,
  };
  return { ...core, digest: sha256(canonicalReferenceJson(core)) };
}

function bindPublicationTransactionIntent(
  planDigest: string,
  transaction: KnowledgePublicationTransaction
): MigrationPublicationTransactionIntent {
  const core = {
    schemaVersion: 1 as const,
    kind: "owner_reference_migration_publication_transaction_intent" as const,
    planDigest,
    transaction,
  };
  return { ...core, digest: sha256(canonicalReferenceJson(core)) };
}

function bindGraphReceipt(input: {
  planDigest: string;
  expectedGraphHead: ReferenceSourceStagingHead | null;
  committedGraphHead: ReferenceSourceStagingHead | null;
  targetRecordRefs: ReferenceRecordRef[];
}): MigrationGraphReceipt {
  const core = {
    schemaVersion: 1 as const,
    kind: "owner_reference_migration_graph_receipt" as const,
    ...input,
  };
  return { ...core, digest: sha256(canonicalReferenceJson(core)) };
}

function readCommitIntent(
  file: string,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): CommitIntent {
  const value = JSON.parse(
    readPrivateRegularFile(privateRoot, file, "migration commit intent", beforeOpen).toString(
      "utf8"
    )
  ) as CommitIntent;
  const { digest, ...core } = value;
  if (
    value.schemaVersion !== 1 ||
    value.kind !== "owner_reference_migration_commit_intent" ||
    value.stageProtocolVersion !== MIGRATION_STAGE_PROTOCOL_VERSION ||
    value.chunkSize !== MIGRATION_STAGE_CHUNK_SIZE ||
    sha256(canonicalReferenceJson(core)) !== digest ||
    !Array.isArray(value.mappings) ||
    !Array.isArray(value.quarantines)
  ) {
    throw new OwnerReferenceMigrationIntegrityError("Migration commit intent is invalid");
  }
  value.mappings = value.mappings.map((mapping) =>
    Value.Decode(OwnerReferenceMigrationMappingSchema, mapping)
  );
  value.quarantines = value.quarantines.map((quarantine) =>
    Value.Decode(OwnerReferenceMigrationQuarantineSchema, quarantine)
  );
  return value;
}

function readRollbackIntent(
  file: string,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): RollbackIntent {
  const value = JSON.parse(
    readPrivateRegularFile(privateRoot, file, "migration rollback intent", beforeOpen).toString(
      "utf8"
    )
  ) as RollbackIntent;
  const { digest, ...core } = value;
  if (
    value.schemaVersion !== 1 ||
    value.kind !== "owner_reference_migration_rollback_intent" ||
    sha256(canonicalReferenceJson(core)) !== digest
  ) {
    throw new OwnerReferenceMigrationIntegrityError("Migration rollback intent is invalid");
  }
  value.transaction = Value.Decode(KnowledgePublicationTransactionSchema, value.transaction);
  return value;
}

function readInterruptedRollbackIntent(
  file: string,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): InterruptedRollbackIntent {
  const value = JSON.parse(
    readPrivateRegularFile(
      privateRoot,
      file,
      "interrupted migration rollback intent",
      beforeOpen
    ).toString("utf8")
  ) as InterruptedRollbackIntent;
  const { digest, ...core } = value;
  if (
    value.schemaVersion !== 1 ||
    value.kind !== "owner_reference_migration_interrupted_rollback_intent" ||
    sha256(canonicalReferenceJson(core)) !== digest
  ) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Interrupted migration rollback intent is invalid"
    );
  }
  return value;
}

function readPublicationTransactionIntent(
  file: string,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): MigrationPublicationTransactionIntent {
  const value = JSON.parse(
    readPrivateRegularFile(
      privateRoot,
      file,
      "migration publication transaction intent",
      beforeOpen
    ).toString("utf8")
  ) as MigrationPublicationTransactionIntent;
  const { digest, ...core } = value;
  if (
    value.schemaVersion !== 1 ||
    value.kind !== "owner_reference_migration_publication_transaction_intent" ||
    !/^[a-f0-9]{64}$/.test(value.planDigest) ||
    sha256(canonicalReferenceJson(core)) !== digest
  ) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Migration publication transaction intent is invalid"
    );
  }
  value.transaction = Value.Decode(KnowledgePublicationTransactionSchema, value.transaction);
  return value;
}

function readGraphReceipt(
  file: string,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): MigrationGraphReceipt {
  const value = JSON.parse(
    readPrivateRegularFile(privateRoot, file, "migration graph receipt", beforeOpen).toString(
      "utf8"
    )
  ) as MigrationGraphReceipt;
  const { digest, ...core } = value;
  if (
    value.schemaVersion !== 1 ||
    value.kind !== "owner_reference_migration_graph_receipt" ||
    sha256(canonicalReferenceJson(core)) !== digest ||
    !Array.isArray(value.targetRecordRefs)
  ) {
    throw new OwnerReferenceMigrationIntegrityError("Migration graph receipt is invalid");
  }
  return value;
}

function writeImmutableIntent(
  file: string,
  value:
    | CommitIntent
    | RollbackIntent
    | InterruptedRollbackIntent
    | MigrationPublicationTransactionIntent
    | MigrationGraphReceipt,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): void {
  ensurePrivateDirectory(privateRoot, path.dirname(file));
  const serialized = `${canonicalReferenceJson(value)}\n`;
  if (pathEntryExists(file)) {
    if (
      readPrivateRegularFile(privateRoot, file, "immutable migration intent", beforeOpen).toString(
        "utf8"
      ) !== serialized
    ) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Immutable migration intent path was reused with different bytes"
      );
    }
    return;
  }
  writeImmutableBytes(file, serialized, privateRoot, beforeOpen);
}

function decodeMigrationRecords(records: KnowledgePublicationRecord[]) {
  const mappings: Array<{
    record: KnowledgePublicationRecord;
    content: OwnerReferenceMigrationMapping;
  }> = [];
  const quarantines: Array<{
    record: KnowledgePublicationRecord;
    content: OwnerReferenceMigrationQuarantine;
  }> = [];
  const journals: Array<{
    record: KnowledgePublicationRecord;
    content: OwnerReferenceMigrationJournal;
  }> = [];
  const recordsByRef = new Map<string, KnowledgePublicationRecord>();
  for (const record of records) {
    recordsByRef.set(refKey(stripRecordKind(publicationRecordRef(record))), record);
    if (record.recordKind === "owner_reference_migration_mapping") {
      mappings.push({ record, content: decodeMapping(record.content) });
    } else if (record.recordKind === "owner_reference_migration_quarantine") {
      quarantines.push({ record, content: decodeQuarantine(record.content) });
    } else if (record.recordKind === "owner_reference_migration_journal") {
      journals.push({ record, content: decodeJournal(record.content) });
    }
  }
  return { mappings, quarantines, journals, recordsByRef };
}

function journalReferencedMappings(
  decoded: ReturnType<typeof decodeMigrationRecords>
): Map<string, OwnerReferenceMigrationMapping> {
  const byLegacyId = new Map<string, OwnerReferenceMigrationMapping>();
  for (const { content: journal } of decoded.journals) {
    for (const record of recordsForRefs(decoded.recordsByRef, journal.mappingRecordRefs)) {
      const mapping = decodeMapping(record.content);
      const existing = byLegacyId.get(mapping.legacyId);
      if (existing && canonicalReferenceJson(existing) !== canonicalReferenceJson(mapping)) {
        throw new OwnerReferenceMigrationIntegrityError(
          `Journal history binds legacy ID to conflicting permanent mappings: ${mapping.legacyId}`
        );
      }
      byLegacyId.set(mapping.legacyId, existing ?? mapping);
    }
  }
  return byLegacyId;
}

function decodeMapping(value: unknown): OwnerReferenceMigrationMapping {
  try {
    const mapping = Value.Decode(OwnerReferenceMigrationMappingSchema, value);
    if (
      mapping.legacyRecordEvidence.kind !== "legacy_record" ||
      mapping.legacyRecordEvidence.sha256 !== mapping.legacyRecordDigest ||
      mapping.legacyRecordEvidence.sha256 !== mapping.legacySnapshot.rawRecordSha256 ||
      mapping.legacyRecordEvidence.byteLength !== mapping.legacySnapshot.rawRecordByteLength ||
      mapping.targetRecords.some((record) => !verifyReferenceRecordDigest(record)) ||
      !mapping.targetRecords.some(
        (record) =>
          record.id === mapping.targetAssetRef.id && record.digest === mapping.targetAssetRef.digest
      ) ||
      !mapping.targetRecords.some(
        (record) =>
          record.id === mapping.targetAcquisitionRef.id &&
          record.digest === mapping.targetAcquisitionRef.digest
      )
    ) {
      throw new Error("mapping target closure is invalid");
    }
    return mapping;
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `OwnerReference migration mapping failed validation: ${errorMessage(error)}`
    );
  }
}

function decodeQuarantine(value: unknown): OwnerReferenceMigrationQuarantine {
  try {
    return Value.Decode(OwnerReferenceMigrationQuarantineSchema, value);
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `OwnerReference migration quarantine failed validation: ${errorMessage(error)}`
    );
  }
}

function decodeJournal(value: unknown): OwnerReferenceMigrationJournal {
  try {
    return Value.Decode(OwnerReferenceMigrationJournalSchema, value);
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `OwnerReference migration journal failed validation: ${errorMessage(error)}`
    );
  }
}

function effectiveBatchStates(
  journals: Array<{ record: KnowledgePublicationRecord; content: OwnerReferenceMigrationJournal }>
): Map<string, OwnerReferenceMigrationJournal> {
  const result = new Map<string, OwnerReferenceMigrationJournal>();
  for (const { content } of [...journals].sort(
    (left, right) => left.content.sequence - right.content.sequence
  )) {
    const prior = result.get(content.batchId);
    if (!prior || content.sequence > prior.sequence) result.set(content.batchId, content);
  }
  return result;
}

type EffectiveLegacyResolution =
  | {
      kind: "mapping";
      batchId: string;
      sequence: number;
      record: KnowledgePublicationRecord;
      content: OwnerReferenceMigrationMapping;
    }
  | {
      kind: "quarantine";
      batchId: string;
      sequence: number;
      record: KnowledgePublicationRecord;
      content: OwnerReferenceMigrationQuarantine;
      quarantines: Array<{
        record: KnowledgePublicationRecord;
        content: OwnerReferenceMigrationQuarantine;
      }>;
      coexistingMapping?: {
        record: KnowledgePublicationRecord;
        content: OwnerReferenceMigrationMapping;
      };
    }
  | {
      kind: "rolled_back";
      batchId: string;
      sequence: number;
      coexistingMapping?: {
        record: KnowledgePublicationRecord;
        content: OwnerReferenceMigrationMapping;
      };
    };

function effectiveLegacyResolutions(
  decoded: ReturnType<typeof decodeMigrationRecords>
): Map<string, EffectiveLegacyResolution> {
  const result = new Map<string, EffectiveLegacyResolution>();
  const permanentMappings = new Map<
    string,
    { record: KnowledgePublicationRecord; content: OwnerReferenceMigrationMapping }
  >();
  for (const { content: journal } of [...decoded.journals].sort(
    (left, right) => left.content.sequence - right.content.sequence
  )) {
    const mappings = recordsForRefs(decoded.recordsByRef, journal.mappingRecordRefs).map(
      (record) => ({ record, content: decodeMapping(record.content) })
    );
    const quarantines = recordsForRefs(decoded.recordsByRef, journal.quarantineRecordRefs).map(
      (record) => ({ record, content: decodeQuarantine(record.content) })
    );
    const mappingByLegacy = new Map(
      mappings.map((mapping) => [mapping.content.legacyId, mapping] as const)
    );
    for (const [legacyId, mapping] of mappingByLegacy) {
      const existing = permanentMappings.get(legacyId);
      if (
        existing &&
        canonicalReferenceJson(existing.content) !== canonicalReferenceJson(mapping.content)
      ) {
        throw new OwnerReferenceMigrationIntegrityError(
          `Journal history binds legacy ID to conflicting permanent mappings: ${legacyId}`
        );
      }
      permanentMappings.set(legacyId, existing ?? mapping);
    }
    if (journal.state === "rolled_back") {
      for (const legacyId of new Set([
        ...mappings.map(({ content }) => content.legacyId),
        ...quarantines.map(({ content }) => content.legacyId),
      ])) {
        const current = result.get(legacyId);
        if (!current || current.batchId === journal.batchId) {
          result.set(legacyId, {
            kind: "rolled_back",
            batchId: journal.batchId,
            sequence: journal.sequence,
            ...(permanentMappings.get(legacyId)
              ? { coexistingMapping: permanentMappings.get(legacyId) }
              : {}),
          });
        }
      }
      continue;
    }
    for (const { record, content } of mappings) {
      result.set(content.legacyId, {
        kind: "mapping",
        batchId: journal.batchId,
        sequence: journal.sequence,
        record,
        content,
      });
    }
    // A byte mapping can coexist with an unresolved identity quarantine. The
    // compatibility projection remains quarantined until that review is done.
    const quarantineByLegacy = new Map<
      string,
      Array<{ record: KnowledgePublicationRecord; content: OwnerReferenceMigrationQuarantine }>
    >();
    for (const quarantine of quarantines) {
      const candidates = quarantineByLegacy.get(quarantine.content.legacyId) ?? [];
      candidates.push(quarantine);
      quarantineByLegacy.set(quarantine.content.legacyId, candidates);
    }
    for (const [legacyId, candidates] of quarantineByLegacy) {
      const primary = candidates.at(-1)!;
      result.set(legacyId, {
        kind: "quarantine",
        batchId: journal.batchId,
        sequence: journal.sequence,
        record: primary.record,
        content: primary.content,
        quarantines: candidates,
        ...(permanentMappings.get(legacyId)
          ? { coexistingMapping: permanentMappings.get(legacyId) }
          : {}),
      });
    }
  }
  return result;
}

function observationsByLegacyId(
  observations: LegacyOwnerReferenceObservation[]
): Map<string, LegacyOwnerReferenceObservation[]> {
  const result = new Map<string, LegacyOwnerReferenceObservation[]>();
  for (const observation of observations) {
    const candidates = result.get(observation.legacyId) ?? [];
    candidates.push(observation);
    result.set(observation.legacyId, candidates);
  }
  return result;
}

function mappingLiveSourceState(
  observations: LegacyOwnerReferenceObservation[],
  mapping: OwnerReferenceMigrationMapping
): "verified" | "missing" | "diverged" {
  if (observations.length === 0) return "missing";
  if (observations.length !== 1) return "diverged";
  const observation = observations[0]!;
  if (observation.failure?.reason === "missing_bytes") return "missing";
  if (
    observation.failure ||
    observation.rawRecordSha256 !== mapping.legacyRecordDigest ||
    !observation.content ||
    sha256(observation.content) !== mapping.byteVerification.observedSha256 ||
    observation.content.byteLength !== mapping.byteVerification.observedByteLength
  ) {
    return "diverged";
  }
  return "verified";
}

function compatibilityLegacyItemSourceState(
  observations: LegacyOwnerReferenceObservation[],
  effective: EffectiveLegacyResolution | undefined
): Exclude<OwnerReferenceMigrationLegacySourceState, "unavailable"> {
  if (observations.length === 0) return "missing";
  if (observations.length !== 1) return "diverged";
  const observation = observations[0]!;
  if (observation.failure?.reason === "missing_bytes") return "missing";
  if (observation.failure) return "diverged";

  const mapping =
    effective?.kind === "mapping" ? effective.content : effective?.coexistingMapping?.content;
  if (mapping) return mappingLiveSourceState(observations, mapping);
  if (
    effective?.kind === "quarantine" &&
    effective.content.reason === "immutable_mapping_conflict"
  ) {
    return "diverged";
  }
  return "verified";
}

function compatibilityLegacySourceState(
  observations: LegacyOwnerReferenceObservation[],
  effectiveByLegacy: Map<string, EffectiveLegacyResolution>
): OwnerReferenceMigrationLegacySourceState {
  const observationsByLegacy = observationsByLegacyId(observations);
  let missing = false;
  let diverged = false;

  for (const observation of observations) {
    if (!observation.failure) continue;
    if (observation.failure.reason === "missing_bytes") missing = true;
    else diverged = true;
  }
  for (const [legacyId, effective] of effectiveByLegacy) {
    const live = observationsByLegacy.get(legacyId) ?? [];
    const state = compatibilityLegacyItemSourceState(live, effective);
    if (state === "missing") missing = true;
    if (state === "diverged") diverged = true;
  }
  return diverged ? "diverged" : missing ? "missing" : "verified";
}

function recordsForRefs(
  records: Map<string, KnowledgePublicationRecord>,
  refs: ReferenceRecordRef[]
): KnowledgePublicationRecord[] {
  return refs.map((ref) => {
    const record = records.get(refKey(ref));
    if (!record) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Migration journal references an absent immutable record: ${ref.id}`
      );
    }
    return record;
  });
}

function findJournalInSnapshot(
  records: KnowledgePublicationRecord[],
  batchId: string,
  state: OwnerReferenceMigrationJournal["state"]
): OwnerReferenceMigrationJournal {
  const matches = decodeMigrationRecords(records)
    .journals.map(({ content }) => content)
    .filter((content) => content.batchId === batchId && content.state === state)
    .sort((left, right) => right.sequence - left.sequence);
  if (!matches[0]) {
    throw new OwnerReferenceMigrationIntegrityError(
      `Committed migration generation lacks its ${state} journal`
    );
  }
  return matches[0];
}

function latestJournalRecord(
  records: KnowledgePublicationRecord[],
  batchId: string
): KnowledgePublicationRecord | null {
  return (
    decodeMigrationRecords(records)
      .journals.filter(({ content }) => content.batchId === batchId)
      .sort((left, right) => right.content.sequence - left.content.sequence)[0]?.record ?? null
  );
}

function planView(plan: ComputedPlan): OwnerReferenceMigrationPlanView {
  return {
    schemaVersion: 1,
    mode: "dry_run",
    planDigest: plan.planDigest,
    expectedHead: plan.expectedHead,
    expectedGraphHead: plan.expectedGraphHead,
    writesPerformed: false,
    mappings: plan.entries
      .filter((entry): entry is Extract<PlanEntry, { kind: "mapping" }> => entry.kind === "mapping")
      .map(({ mapping, alreadyMapped }) => ({
        legacyId: mapping.legacyId,
        bibliographicIdentity: "not_asserted" as const,
        alreadyMapped,
      })),
    quarantines: plan.entries
      .filter(
        (entry): entry is Extract<PlanEntry, { kind: "quarantine" }> => entry.kind === "quarantine"
      )
      .map(({ legacyId, reason, action }) => ({ legacyId, reason, action })),
    capabilities: CAPABILITIES,
  };
}

function interruptedRollbackView(
  intent: CommitIntent,
  head: KnowledgePublicationHead,
  outcome: "committed" | "already_committed"
): OwnerReferenceMigrationInterruptedRollbackView {
  return {
    schemaVersion: 1,
    mode: "rollback",
    rollbackScope: "interrupted_commit",
    planDigest: intent.planDigest,
    batchId: intent.batchId,
    outcome,
    journalState: "rolled_back",
    head,
    capabilities: CAPABILITIES,
  };
}

function planEntryDigestView(entry: PlanEntry) {
  if (entry.kind === "quarantine") {
    return {
      kind: entry.kind,
      legacyId: entry.legacyId,
      rawLegacyId: entry.rawLegacyId,
      legacyRecordDigest: entry.legacyRecordDigest,
      legacyRecordByteLength: entry.legacyRecordByteLength,
      legacySnapshot: entry.legacySnapshot,
      legacyRecordEvidence: entry.legacyRecordEvidence,
      observedContentEvidence: entry.observedContentEvidence,
      reason: entry.reason,
      action: entry.action,
      declaredSha256: entry.declaredSha256,
      observedSha256: entry.observedSha256,
      declaredByteLength: entry.declaredByteLength,
      observedByteLength: entry.observedByteLength,
      alreadyQuarantined: entry.alreadyQuarantined,
    };
  }
  return {
    kind: entry.kind,
    legacyId: entry.mapping.legacyId,
    legacyRecordDigest: entry.mapping.legacyRecordDigest,
    targetAssetRef: entry.mapping.targetAssetRef,
    targetAcquisitionRef: entry.mapping.targetAcquisitionRef,
    alreadyMapped: entry.alreadyMapped,
    alreadyActive: entry.alreadyActive,
  };
}

function planHasSemanticChanges(plan: ComputedPlan): boolean {
  return plan.entries.some((entry) =>
    entry.kind === "mapping" ? !entry.alreadyActive : !entry.alreadyQuarantined
  );
}

function assertInventoryMatchesIntent(
  inventory: LegacyOwnerReferenceInventory,
  intent: CommitIntent
): void {
  if (inventory.inventoryDigest !== intent.legacyInventoryDigest) {
    throw new OwnerReferenceMigrationConflictError(
      "Legacy inventory changed after the migration plan was captured"
    );
  }
}

function callbackLegacySource(
  listLegacyReferences: () => OwnerReference[],
  readLegacyBytes: (id: string) => Buffer
): LegacyOwnerReferenceSource {
  const source: LegacyOwnerReferenceSource = {
    capture() {
      const references = listLegacyReferences();
      const observations: LegacyOwnerReferenceObservation[] = references.map((reference) => {
        const rawLegacyId = reference.id;
        const legacyId = safeOpaqueLegacyId(rawLegacyId);
        const raw = Buffer.from(`${canonicalReferenceJson(reference)}\n`);
        const rawRecordSha256 = sha256(raw);
        let content: Buffer;
        try {
          content = Buffer.from(readLegacyBytes(reference.id));
        } catch {
          return {
            legacyId,
            rawLegacyId,
            rawRecordSha256,
            rawRecordByteLength: raw.byteLength,
            rawRecordBytes: raw,
            reference,
            content: null,
            failure: {
              reason: isSafeId(rawLegacyId)
                ? ("missing_bytes" as const)
                : ("invalid_legacy_record" as const),
              action: isSafeId(rawLegacyId)
                ? ("restore_exact_legacy_bytes" as const)
                : ("review_legacy_record" as const),
              declaredSha256: reference.sha256,
              observedSha256: null,
              declaredByteLength: reference.byteLength ?? null,
              observedByteLength: null,
            },
          };
        }
        const observedSha256 = sha256(content);
        const failure = !isSafeId(rawLegacyId)
          ? {
              reason: "invalid_legacy_record" as const,
              action: "review_legacy_record" as const,
              declaredSha256: reference.sha256,
              observedSha256,
              declaredByteLength: reference.byteLength ?? null,
              observedByteLength: content.byteLength,
            }
          : observedSha256 !== reference.sha256
            ? {
                reason: "hash_mismatch" as const,
                action: "restore_exact_legacy_bytes" as const,
                declaredSha256: reference.sha256,
                observedSha256,
                declaredByteLength: reference.byteLength ?? null,
                observedByteLength: content.byteLength,
              }
            : reference.byteLength !== undefined && reference.byteLength !== content.byteLength
              ? {
                  reason: "length_mismatch" as const,
                  action: "restore_exact_legacy_bytes" as const,
                  declaredSha256: reference.sha256,
                  observedSha256,
                  declaredByteLength: reference.byteLength,
                  observedByteLength: content.byteLength,
                }
              : null;
        return {
          legacyId,
          rawLegacyId,
          rawRecordSha256,
          rawRecordByteLength: raw.byteLength,
          rawRecordBytes: raw,
          reference,
          content,
          failure,
        };
      });
      observations.sort((left, right) => {
        const byId = left.legacyId.localeCompare(right.legacyId);
        if (byId) return byId;
        return observationStableKey(left).localeCompare(observationStableKey(right));
      });
      const manifestSha256 = sha256(canonicalReferenceJson(references.map(({ id }) => id).sort()));
      return {
        schemaVersion: 1 as const,
        manifestSha256,
        inventoryDigest: sha256(
          canonicalReferenceJson({
            manifestSha256,
            observations: observations.map((observation) => ({
              legacyId: observation.legacyId,
              rawLegacyId: observation.rawLegacyId,
              rawRecordSha256: observation.rawRecordSha256,
              rawRecordByteLength: observation.rawRecordByteLength,
              observedSha256: observation.content
                ? sha256(observation.content)
                : observation.failure?.observedSha256,
              observedByteLength:
                observation.content?.byteLength ?? observation.failure?.observedByteLength,
              failure: observation.failure,
            })),
          })
        ),
        observations,
      };
    },
    withStableInventory(operation) {
      return operation(source.capture());
    },
  };
  return source;
}

function uniqueTargetRecords(
  records: OwnerReferenceMigrationTargetRecord[]
): ReferenceSourceStagingInputRecord[] {
  const byId = new Map<string, ReferenceSourceStagingInputRecord>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (
      existing &&
      (existing.digest !== record.digest || existing.recordKind !== record.recordKind)
    ) {
      throw new OwnerReferenceMigrationConflictError(
        `Migration plan contains a target record collision: ${record.id}`
      );
    }
    byId.set(record.id, record);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function quarantineTargetRecordCollisions(input: {
  entries: PlanEntry[];
  observations: LegacyOwnerReferenceObservation[];
  graphRecords: GraphRecordIdentity[];
  effectiveByLegacy: Map<string, EffectiveLegacyResolution>;
}): PlanEntry[] {
  const collidingLegacyIds = new Set<string>();
  const graphById = new Map(input.graphRecords.map((record) => [record.id, record] as const));
  const plannedByTargetId = new Map<
    string,
    Array<{ legacyId: string; record: OwnerReferenceMigrationTargetRecord }>
  >();
  for (const entry of input.entries) {
    if (entry.kind !== "mapping") continue;
    for (const record of entry.mapping.targetRecords) {
      const existing = graphById.get(record.id);
      if (
        existing &&
        (existing.recordKind !== record.recordKind || existing.digest !== record.digest)
      ) {
        collidingLegacyIds.add(entry.mapping.legacyId);
      }
      const planned = plannedByTargetId.get(record.id) ?? [];
      planned.push({ legacyId: entry.mapping.legacyId, record });
      plannedByTargetId.set(record.id, planned);
    }
  }
  for (const planned of plannedByTargetId.values()) {
    const identities = new Set(
      planned.map(({ record }) => `${record.recordKind}:${record.digest}`)
    );
    if (identities.size > 1) {
      for (const { legacyId } of planned) collidingLegacyIds.add(legacyId);
    }
  }
  if (collidingLegacyIds.size === 0) return input.entries;

  const observationByLegacy = new Map(
    input.observations.map((observation) => [observation.legacyId, observation] as const)
  );
  const result = input.entries.filter((entry) => !collidingLegacyIds.has(entryLegacyId(entry)));
  for (const legacyId of [...collidingLegacyIds].sort()) {
    const observation = observationByLegacy.get(legacyId);
    if (!observation) {
      throw new OwnerReferenceMigrationIntegrityError(
        `Target collision lacks its legacy observation: ${legacyId}`
      );
    }
    const quarantine = quarantineEntry(
      observation,
      "target_record_collision",
      "review_target_record_collision"
    );
    const effective = input.effectiveByLegacy.get(legacyId);
    quarantine.alreadyQuarantined =
      effective?.kind === "quarantine" &&
      effective.quarantines.some(({ content }) => sameQuarantineEvidence(quarantine, content));
    result.push(quarantine);
  }
  return result;
}

function graphSnapshotContainsMappings(
  records: GraphRecordIdentity[],
  mappings: OwnerReferenceMigrationMapping[]
): boolean {
  const byId = new Map(records.map((record) => [record.id, record] as const));
  return mappings.every((mapping) =>
    mapping.targetRecords.every((target) => {
      const observed = byId.get(target.id);
      return observed?.recordKind === target.recordKind && observed.digest === target.digest;
    })
  );
}

function exactGraphRecordSet(
  observed: GraphRecordIdentity[],
  expected: GraphRecordIdentity[]
): boolean {
  const observedById = new Map(observed.map((record) => [record.id, record] as const));
  const expectedById = new Map(expected.map((record) => [record.id, record] as const));
  if (observedById.size !== expectedById.size) return false;
  for (const [id, record] of expectedById) {
    const actual = observedById.get(id);
    if (actual?.recordKind !== record.recordKind || actual.digest !== record.digest) return false;
  }
  return true;
}

type GraphRecordIdentity = { id: string; digest: string; recordKind: string };

function requireGraphSnapshot(
  snapshot: ReferenceSourceStagingSnapshot | null,
  snapshotId: string
): ReferenceSourceStagingSnapshot {
  if (!snapshot) {
    throw new OwnerReferenceMigrationIntegrityError(
      `Migration graph snapshot did not resolve: ${snapshotId}`
    );
  }
  return snapshot;
}

function targetAsset(mapping: OwnerReferenceMigrationMapping): ReferenceDigitalAsset {
  const asset = mapping.targetRecords.find(
    (record): record is ReferenceDigitalAsset =>
      record.recordKind === "digital_asset" && record.id === mapping.targetAssetRef.id
  );
  if (!asset || asset.digest !== mapping.targetAssetRef.digest) {
    throw new OwnerReferenceMigrationIntegrityError(
      `Migration mapping lacks exact target asset ${mapping.targetAssetRef.id}`
    );
  }
  return asset;
}

function publicationRecordRef(record: KnowledgePublicationRecord): KnowledgePublicationRecordRef {
  return { recordKind: record.recordKind, id: record.id, digest: record.digest };
}

function stripRecordKind(ref: KnowledgePublicationRecordRef): ReferenceRecordRef {
  return { id: ref.id, digest: ref.digest };
}

function uniqueRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  const byKey = new Map(refs.map((ref) => [refKey(ref), ref]));
  return [...byKey.values()].sort((left, right) => refKey(left).localeCompare(refKey(right)));
}

function refFor(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function stagingHeadRef(head: ReferenceSourceStagingHead | null): ReferenceRecordRef | undefined {
  return head ? { id: head.snapshotId, digest: head.digest } : undefined;
}

function sameNullableStagingHead(
  left: ReferenceSourceStagingHead | null,
  right: ReferenceSourceStagingHead | null
): boolean {
  if (!left || !right) return left === null && right === null;
  return (
    left.snapshotId === right.snapshotId &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function sameNullablePublicationHead(
  left: KnowledgePublicationHead | null,
  right: KnowledgePublicationGenerationRef | null
): boolean {
  if (!left || !right) return left === null && right === null;
  return samePublicationHead(left, right);
}

function sameNullableGenerationRef(
  left: KnowledgePublicationGenerationRef | null,
  right: KnowledgePublicationGenerationRef | null
): boolean {
  if (!left || !right) return left === null && right === null;
  return left.id === right.id && left.digest === right.digest && left.revision === right.revision;
}

function samePublicationHead(
  left: KnowledgePublicationHead,
  right: KnowledgePublicationGenerationRef
): boolean {
  return (
    left.generationId === right.id &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function duplicateObservationIds(observations: LegacyOwnerReferenceObservation[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { legacyId } of observations) {
    if (seen.has(legacyId)) duplicates.add(legacyId);
    seen.add(legacyId);
  }
  return duplicates;
}

function safeOpaqueLegacyId(rawLegacyId: string): string {
  return isSafeId(rawLegacyId)
    ? rawLegacyId
    : `invalid-callback-id.${sha256(rawLegacyId).slice(0, 32)}`;
}

function observationStableKey(observation: LegacyOwnerReferenceObservation): string {
  return canonicalReferenceJson({
    rawLegacyId: observation.rawLegacyId,
    rawRecordSha256: observation.rawRecordSha256,
    rawRecordByteLength: observation.rawRecordByteLength,
    observedSha256: observation.content ? sha256(observation.content) : null,
    observedByteLength: observation.content?.byteLength ?? null,
    failure: observation.failure,
  });
}

function entryLegacyId(entry: PlanEntry): string {
  return entry.kind === "mapping" ? entry.mapping.legacyId : entry.legacyId;
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}:${ref.digest}`;
}

function assertDigest(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new OwnerReferenceMigrationIntegrityError(`${label} is invalid`);
  }
}

function assertSafeId(value: string, label: string): void {
  if (!isSafeId(value)) {
    throw new OwnerReferenceMigrationIntegrityError(`${label} is invalid`);
  }
}

function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(value);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function pathMatchesDescriptor(file: string, descriptor: number): boolean {
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(file, { bigint: true });
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

function readDescriptorText(descriptor: number): string {
  const stat = fstatSync(descriptor);
  if (!stat.isFile() || stat.size > 1_048_576) {
    throw new OwnerReferenceMigrationRecoveryRequiredError(
      "OwnerReference migration claim is not a bounded regular file"
    );
  }
  const bytes = Buffer.alloc(stat.size);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  if (offset !== bytes.byteLength) {
    throw new OwnerReferenceMigrationRecoveryRequiredError(
      "OwnerReference migration claim changed while it was being read"
    );
  }
  return bytes.toString("utf8");
}

function writeImmutableBytes(
  file: string,
  serialized: string,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): void {
  writeImmutableBuffer(file, Buffer.from(serialized), privateRoot, beforeOpen);
}

function writeImmutableBuffer(
  file: string,
  bytes: Buffer,
  privateRoot: string,
  beforeOpen?: (file: string) => void
): void {
  const directory = path.dirname(file);
  ensurePrivateDirectory(privateRoot, directory);
  if (pathEntryExists(file)) {
    const existing = readPrivateRegularFile(
      privateRoot,
      file,
      "immutable migration output",
      beforeOpen
    );
    if (!existing.equals(bytes)) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Immutable migration output path was reused with different bytes"
      );
    }
    return;
  }
  const ancestorIdentities = privateAncestorIdentities(privateRoot, file);
  beforeOpen?.(file);
  const temporary = path.join(directory, `.pending.${randomUUID()}.tmp`);
  let descriptor: number;
  try {
    descriptor = openSync(
      temporary,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600
    );
  } catch (error) {
    throw error;
  }
  let linked = false;
  try {
    assertOpenedPrivateFile(
      privateRoot,
      temporary,
      descriptor,
      ancestorIdentities,
      "immutable migration output"
    );
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    assertOpenedPrivateFile(
      privateRoot,
      temporary,
      descriptor,
      ancestorIdentities,
      "immutable migration output"
    );
    if (fstatSync(descriptor).size !== bytes.byteLength) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Immutable migration output length changed during durable creation"
      );
    }
    assertPrivateAncestorsUnchanged(
      privateRoot,
      file,
      ancestorIdentities,
      "immutable migration output"
    );
    try {
      linkSync(temporary, file);
      linked = true;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      const existing = readPrivateRegularFile(
        privateRoot,
        file,
        "immutable migration output",
        beforeOpen
      );
      if (!existing.equals(bytes)) throw error;
    }
    if (linked) {
      const stored = readPrivateRegularFile(
        privateRoot,
        file,
        "immutable migration output",
        beforeOpen
      );
      if (!stored.equals(bytes)) {
        throw new OwnerReferenceMigrationIntegrityError(
          "Immutable migration output changed after atomic publication"
        );
      }
    }
    fsyncDirectory(directory);
  } catch (error) {
    if (linked && pathMatchesDescriptor(file, descriptor)) rmSync(file, { force: true });
    throw error;
  } finally {
    if (pathMatchesDescriptor(temporary, descriptor)) rmSync(temporary, { force: true });
    closeSync(descriptor);
  }
}

function readPrivateRegularFile(
  privateRoot: string,
  file: string,
  label: string,
  beforeOpen?: (file: string) => void
): Buffer {
  ensurePrivateDirectory(privateRoot, path.dirname(file));
  const ancestorIdentities = privateAncestorIdentities(privateRoot, file);
  beforeOpen?.(file);
  const descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const before = fstatSync(descriptor, { bigint: true });
    assertOpenedPrivateFile(privateRoot, file, descriptor, ancestorIdentities, label);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    assertOpenedPrivateFile(privateRoot, file, descriptor, ancestorIdentities, label);
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      after.size !== BigInt(bytes.byteLength)
    ) {
      throw new OwnerReferenceMigrationIntegrityError(`${label} changed while it was being read`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

type PrivateAncestorIdentity = { path: string; dev: bigint; ino: bigint };

function privateAncestorIdentities(privateRoot: string, file: string): PrivateAncestorIdentity[] {
  const root = path.resolve(privateRoot);
  const target = path.resolve(file);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Private migration file escaped its anchored root"
    );
  }
  const directories = [root];
  let cursor = root;
  for (const component of path
    .relative(root, path.dirname(target))
    .split(path.sep)
    .filter(Boolean)) {
    cursor = path.join(cursor, component);
    directories.push(cursor);
  }
  return directories.map((directory) => {
    const stat = lstatSync(directory, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new OwnerReferenceMigrationIntegrityError(
        "Private migration file traverses a symlink or non-directory ancestor"
      );
    }
    assertOwnedPrivateStat(stat, "private migration directory");
    return { path: directory, dev: stat.dev, ino: stat.ino };
  });
}

function assertOpenedPrivateFile(
  privateRoot: string,
  file: string,
  descriptor: number,
  ancestorIdentities: PrivateAncestorIdentity[],
  label: string
): void {
  assertPrivateAncestorsUnchanged(privateRoot, file, ancestorIdentities, label);
  const opened = fstatSync(descriptor, { bigint: true });
  const named = lstatSync(file, { bigint: true });
  assertOwnedPrivateStat(opened, label);
  assertOwnedPrivateStat(named, label);
  if (!pathMatchesDescriptor(file, descriptor)) {
    throw new OwnerReferenceMigrationIntegrityError(
      `${label} path identity changed during descriptor acquisition`
    );
  }
  const realRoot = realpathSync(path.resolve(privateRoot));
  const realFile = realpathSync(path.resolve(file));
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
    throw new OwnerReferenceMigrationIntegrityError(`${label} escaped its anchored root`);
  }
}

function assertPrivateAncestorsUnchanged(
  privateRoot: string,
  file: string,
  ancestorIdentities: PrivateAncestorIdentity[],
  label: string
): void {
  const afterAncestors = privateAncestorIdentities(privateRoot, file);
  if (
    ancestorIdentities.length !== afterAncestors.length ||
    ancestorIdentities.some(
      (identity, index) =>
        identity.path !== afterAncestors[index]?.path ||
        identity.dev !== afterAncestors[index]?.dev ||
        identity.ino !== afterAncestors[index]?.ino
    )
  ) {
    throw new OwnerReferenceMigrationIntegrityError(
      `${label} ancestor identity changed during descriptor acquisition`
    );
  }
}

function ensurePrivateDirectory(privateRoot: string, directory: string): void {
  const root = path.resolve(privateRoot);
  const target = path.resolve(directory);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new OwnerReferenceMigrationIntegrityError(
      "Private migration output escaped its anchored root"
    );
  }

  if (!pathEntryExists(root)) mkdirSync(root, { recursive: true, mode: 0o700 });
  assertRealPrivateDirectory(root, "private migration output root");
  let cursor = root;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    if (!pathEntryExists(cursor)) {
      try {
        mkdirSync(cursor, { mode: 0o700 });
      } catch (error) {
        if (!isFileExistsError(error)) throw error;
      }
    }
    assertRealPrivateDirectory(cursor, "private migration output directory");
  }
}

function assertPrivateRegularFile(privateRoot: string, file: string, label: string): void {
  ensurePrivateDirectory(privateRoot, path.dirname(file));
  const ancestorIdentities = privateAncestorIdentities(privateRoot, file);
  let descriptor: number;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `${label} is unavailable: ${errorMessage(error)}`
    );
  }
  try {
    assertOpenedPrivateFile(privateRoot, file, descriptor, ancestorIdentities, label);
  } finally {
    closeSync(descriptor);
  }
}

function assertRealPrivateDirectory(directory: string, label: string): void {
  let metadata;
  try {
    metadata = lstatSync(directory);
  } catch (error) {
    throw new OwnerReferenceMigrationIntegrityError(
      `${label} is unavailable: ${errorMessage(error)}`
    );
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new OwnerReferenceMigrationIntegrityError(`${label} is not a real directory`);
  }
  assertOwnedPrivateStat(metadata, label);
}

function assertOwnedPrivateStat(
  stat: { uid: number | bigint; mode: number | bigint },
  label: string
): void {
  const effectiveUid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (effectiveUid === null) {
    throw new OwnerReferenceMigrationIntegrityError(`${label} ownership cannot be verified`);
  }
  const owned =
    typeof stat.uid === "bigint" ? stat.uid === BigInt(effectiveUid) : stat.uid === effectiveUid;
  const unsafeMode =
    typeof stat.mode === "bigint" ? (stat.mode & 0o022n) !== 0n : (stat.mode & 0o022) !== 0;
  if (!owned || unsafeMode) {
    throw new OwnerReferenceMigrationIntegrityError(
      `${label} must be euid-owned and not group/other-writable`
    );
  }
}

function pathEntryExists(entry: string): boolean {
  try {
    lstatSync(entry);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
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

function decodeMigrationClaim(serialized: string): MigrationClaimReceipt {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new OwnerReferenceMigrationRecoveryRequiredError(
      "OwnerReference migration claim is malformed"
    );
  }
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== 1 ||
    typeof value.token !== "string" ||
    value.token.length === 0 ||
    !Number.isInteger(value.pid) ||
    Number(value.pid) < 1 ||
    typeof value.hostIdentity !== "string" ||
    !(
      isStableHostIdentity(value.hostIdentity) || isUnrecoverableHostIdentity(value.hostIdentity)
    ) ||
    !(value.bootIdentity === null || typeof value.bootIdentity === "string") ||
    !(value.processStartIdentity === null || typeof value.processStartIdentity === "string") ||
    typeof value.claimedAt !== "string"
  ) {
    throw new OwnerReferenceMigrationRecoveryRequiredError(
      "OwnerReference migration claim failed closed-schema validation"
    );
  }
  return value as MigrationClaimReceipt;
}

function migrationClaimOwnerIsProvablyAbsent(
  receipt: MigrationClaimReceipt,
  runtime: MigrationClaimRuntime
): boolean {
  if (!isStableHostIdentity(receipt.hostIdentity)) return false;
  const hostIdentity = runtime.hostIdentity();
  if (!hostIdentity || hostIdentity !== receipt.hostIdentity) return false;
  const bootIdentity = runtime.bootIdentity();
  if (receipt.bootIdentity && bootIdentity && receipt.bootIdentity !== bootIdentity) return true;
  if (!runtime.processExists(receipt.pid)) return true;
  const startIdentity = runtime.processStartIdentity(receipt.pid);
  return Boolean(
    receipt.processStartIdentity && startIdentity && receipt.processStartIdentity !== startIdentity
  );
}

function currentHostIdentity(): string | null {
  try {
    let identity: string;
    if (platform() === "linux") {
      const machineId = readFileSync("/etc/machine-id", "utf8").trim();
      const pidNamespace = readlinkSync("/proc/self/ns/pid");
      if (!machineId || !pidNamespace) return null;
      identity = `${machineId}\u0000${pidNamespace}`;
    } else if (platform() === "darwin") {
      const output = execFileSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
        encoding: "utf8",
        timeout: 1_000,
      });
      const uuid = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(output)?.[1];
      if (!uuid) return null;
      identity = uuid;
    } else {
      return null;
    }
    return sha256(`${platform()}\u0000${identity}`);
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
    // Unsupported probes keep recovery fail-closed.
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

function isStableHostIdentity(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isUnrecoverableHostIdentity(value: string): boolean {
  return /^unrecoverable:[0-9a-f-]{36}$/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function translateMigrationStoreError(error: unknown): Error {
  if (error instanceof OwnerReferenceMigrationError) return error;
  if (
    error instanceof KnowledgePublicationConflictError ||
    error instanceof ReferenceSourceStagingConflictError
  ) {
    return new OwnerReferenceMigrationConflictError(error.message);
  }
  if (error instanceof KnowledgePublicationRecoveryRequiredError) {
    return new OwnerReferenceMigrationRecoveryRequiredError(error.message);
  }
  if (
    error instanceof KnowledgePublicationIntegrityError ||
    error instanceof ReferenceSourceControlledArtifactStoreIntegrityError
  ) {
    return new OwnerReferenceMigrationIntegrityError(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

export class OwnerReferenceMigrationError extends Error {}

export class OwnerReferenceMigrationConflictError extends OwnerReferenceMigrationError {
  constructor(message: string) {
    super(message);
    this.name = "OwnerReferenceMigrationConflictError";
  }
}

export class OwnerReferenceMigrationIntegrityError extends OwnerReferenceMigrationError {
  constructor(message: string) {
    super(message);
    this.name = "OwnerReferenceMigrationIntegrityError";
  }
}

export class OwnerReferenceMigrationRecoveryRequiredError extends OwnerReferenceMigrationError {
  constructor(message: string) {
    super(message);
    this.name = "OwnerReferenceMigrationRecoveryRequiredError";
  }
}

export class OwnerReferenceMigrationNotFoundError extends OwnerReferenceMigrationError {
  constructor(message: string) {
    super(message);
    this.name = "OwnerReferenceMigrationNotFoundError";
  }
}
