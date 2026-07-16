import { randomUUID } from "node:crypto";

import { Value } from "@sinclair/typebox/value";

import {
  REFERENCE_ACCESS_OPERATION_DESTINATIONS,
  ReferenceSourceStagingTransactionSchema,
  ReferenceSourceStagingSnapshotSchema,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetIdentityResolution,
  type ReferenceAssetAcquisition,
  type ReferenceAssetRoleBinding,
  type ReferenceCitedExtractionVersion,
  type ReferenceCitationSuccessor,
  type ReferenceDependencyEdge,
  type ReferenceDerivativeArtifact,
  type ReferenceExtractionProposal,
  type ReferencePageAtlasAttempt,
  type ReferencePageAtlasCorrection,
  type ReferencePageAtlasVersion,
  type ReferenceSourceIdentityAssertion,
  type ReferenceSourceDerivation,
  type ReferenceInvalidation,
  type ReferenceLifecycleStoragePolicy,
  type ReferenceLifecycleUse,
  type ReferenceProvenanceSubstitution,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceRecordObservation,
  type ReferenceSourceSegmentVersion,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import { assertCanonicalReferenceSourceTimestampFields } from "../../lib/reference-source-instant.js";
import {
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingStore,
  type ReferenceSourceStagingHead,
} from "./reference-source-staging-store.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";

export type LegacyOwnerReference = {
  id: string;
  title: string;
  citation: string;
  mimeType: string;
  sha256: string;
  byteLength?: number;
  createdAt: string;
  /** Compatibility readers accept richer legacy records but never project this path. */
  storedPath?: string;
};

export type RedactedLegacyOwnerReference = {
  id: string;
  title: string;
  citation: string;
  mimeType: string;
  sha256: string;
  byteLength?: number;
  createdAt: string;
  readOnly: true;
  identityConfidence: { kind: "unknown" };
};

export type ReferenceSourceStagingDiagnostics = {
  publicationState: "staging_only";
  head: ReferenceSourceStagingHead | null;
  snapshot: ReferenceSourceStagingSnapshot | null;
  view: { kind: "current" } | { kind: "historical"; viewedSnapshotRef: ReferenceRecordRef };
  legacyProjection: {
    ownerReferences: RedactedLegacyOwnerReference[];
  };
  capabilities: {
    stagingTransactions: true;
    canonicalPublication: false;
  };
};

export type ReferenceSourceStagingServiceOptions = {
  store?: ReferenceSourceStagingStore;
  listLegacyOwnerReferences?: () => LegacyOwnerReference[];
  now?: () => Date;
  createId?: () => string;
};

export const OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF: ReferenceRecordRef = Object.freeze({
  id: "processing-policy.owner-local-reference-upload.v1",
  digest: referenceSourceDigest({ id: "processing-policy.owner-local-reference-upload.v1" }),
});

const CONTROLLED_UPLOAD_AUTHORITY = Object.freeze({ kind: "controlled_upload" as const });
const CONTROLLED_UPLOAD_TRANSACTION_ID = /^transaction\.owner-upload\.([a-f0-9]{32})$/;
const CONTROLLED_UPLOAD_ACQUISITION_ID = /^acquisition\.owner-upload\.([a-f0-9]{32})$/;
const CONTROLLED_UPLOAD_OWNER_ACTION_ID = /^owner-action\.reference-upload\.([a-f0-9]{32})$/;
const OWNER_PRIVATE_STUDY_AUTHORITY = Object.freeze({ kind: "owner_private_study" as const });
const OWNER_PRIVATE_STUDY_TRANSACTION_ID = /^transaction\.owner-private-study\.([a-f0-9]{32})$/;
const OWNER_PRIVATE_STUDY_RIGHTS_ID = /^rights-assertion\.owner-private-study\.([a-f0-9]{32})$/;
const OWNER_PRIVATE_STUDY_DECISION_ID = /^access-decision\.owner-private-study\.([a-f0-9]{32})$/;
const OWNER_LOCAL_EXTRACTION_AUTHORITY = Object.freeze({ kind: "owner_local_extraction" as const });
const OWNER_LOCAL_EXTRACTION_TRANSACTION_ID =
  /^transaction\.owner-local-extraction\.([a-f0-9]{32})$/;
const OWNER_LOCAL_EXTRACTION_RIGHTS_ID =
  /^rights-assertion\.owner-local-extraction\.([a-f0-9]{32})$/;
const OWNER_LOCAL_EXTRACTION_DECISION_ID =
  /^access-decision\.owner-local-extraction\.([a-f0-9]{32})$/;
const PAGE_ATLAS_AUTHORITY = Object.freeze({ kind: "page_atlas" as const });

export const OWNER_PRIVATE_LOCAL_STUDY_POLICY_REF: ReferenceRecordRef = Object.freeze({
  id: "policy.owner-private-local-study.v1",
  digest: referenceSourceDigest({ id: "policy.owner-private-local-study.v1" }),
});
export const OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF: ReferenceRecordRef = Object.freeze({
  id: "authority.owner-local-study-attestation.v1",
  digest: referenceSourceDigest({ id: "authority.owner-local-study-attestation.v1" }),
});
export const OWNER_PRIVATE_LOCAL_STUDY_RATIONALE =
  "The Owner explicitly attested to byte-for-byte private study on this local runtime; this grants no extraction, egress, export, redistribution, fixture, repository, historical, or specialist authority.";
export const OWNER_LOCAL_EXTRACTION_POLICY_REF: ReferenceRecordRef = Object.freeze({
  id: "policy.owner-local-extraction.v1",
  digest: referenceSourceDigest({ id: "policy.owner-local-extraction.v1" }),
});
export const OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF: ReferenceRecordRef = Object.freeze({
  id: "authority.owner-local-extraction-attestation.v1",
  digest: referenceSourceDigest({ id: "authority.owner-local-extraction-attestation.v1" }),
});
export const OWNER_LOCAL_EXTRACTION_RATIONALE =
  "The Owner explicitly attested to bounded extraction of this exact acquisition on the local runtime; this grants no provider egress, export, redistribution, fixture, repository, historical, or specialist authority.";

/**
 * Server-minted capability presented only to the controlled-byte ingestion
 * service. The generic staging service and HTTP route never receive the
 * unexported symbol that authorizes the reserved provenance namespace.
 */
export type ReferenceSourceControlledUploadStagingWriter = Readonly<{
  readCurrent: () => ReferenceSourceStagingDiagnostics;
  applyTransaction: (
    transaction: ReferenceSourceStagingTransaction
  ) => ReferenceSourceStagingDiagnostics;
}>;

export function createReferenceSourceControlledUploadStagingWriter(
  service: ReferenceSourceStagingService
): ReferenceSourceControlledUploadStagingWriter {
  return Object.freeze({
    readCurrent: () => service.readCurrent(),
    applyTransaction: (transaction: ReferenceSourceStagingTransaction) =>
      service.applyControlledUploadTransaction(transaction, CONTROLLED_UPLOAD_AUTHORITY),
  });
}

/** Server-only writer for one exact Owner-attested local-study pair. */
export type OwnerPrivateStudyStagingWriter = Readonly<{
  readCurrent: () => ReferenceSourceStagingDiagnostics;
  applyTransaction: (
    transaction: ReferenceSourceStagingTransaction
  ) => ReferenceSourceStagingDiagnostics;
}>;

export function createOwnerPrivateStudyStagingWriter(
  service: ReferenceSourceStagingService
): OwnerPrivateStudyStagingWriter {
  return Object.freeze({
    readCurrent: () => service.readCurrent(),
    applyTransaction: (transaction: ReferenceSourceStagingTransaction) =>
      service.applyOwnerPrivateStudyTransaction(transaction, OWNER_PRIVATE_STUDY_AUTHORITY),
  });
}

/** Server-only writer for one exact Owner-attested local-extraction pair. */
export type OwnerLocalExtractionStagingWriter = Readonly<{
  readCurrent: () => ReferenceSourceStagingDiagnostics;
  applyTransaction: (
    transaction: ReferenceSourceStagingTransaction
  ) => ReferenceSourceStagingDiagnostics;
}>;

export function createOwnerLocalExtractionStagingWriter(
  service: ReferenceSourceStagingService
): OwnerLocalExtractionStagingWriter {
  return Object.freeze({
    readCurrent: () => service.readCurrent(),
    applyTransaction: (transaction: ReferenceSourceStagingTransaction) =>
      service.applyOwnerLocalExtractionTransaction(transaction, OWNER_LOCAL_EXTRACTION_AUTHORITY),
  });
}

/**
 * Server-only capability for immutable Page Atlas, cited-extraction, and
 * nonauthoritative extraction-proposal records. The generic staging route
 * cannot append any of these protected records.
 */
export type ReferenceSourcePageAtlasStagingWriter = Readonly<{
  readCurrent: () => ReferenceSourceStagingDiagnostics;
  applyTransaction: (
    transaction: ReferenceSourceStagingTransaction
  ) => ReferenceSourceStagingDiagnostics;
}>;

export function createReferenceSourcePageAtlasStagingWriter(
  service: ReferenceSourceStagingService
): ReferenceSourcePageAtlasStagingWriter {
  return Object.freeze({
    readCurrent: () => service.readCurrent(),
    applyTransaction: (transaction: ReferenceSourceStagingTransaction) =>
      service.applyPageAtlasTransaction(transaction, PAGE_ATLAS_AUTHORITY),
  });
}

/**
 * A pre-observation snapshot cannot be advanced without inventing trusted
 * arrival order for records that the server did not observe being appended.
 */
export class ReferenceSourceStagingMigrationRequiredError extends ReferenceSourceStagingIntegrityError {
  readonly code = "reference_source_staging_migration_required" as const;
  readonly migration = "record_observations" as const;

  constructor(
    readonly snapshotRef: ReferenceRecordRef,
    readonly snapshotRevision: number
  ) {
    super(
      `Reference-source staging snapshot ${snapshotRef.id} predates complete server observation ordering; appends require an explicit record-observation migration`
    );
    this.name = "ReferenceSourceStagingMigrationRequiredError";
  }
}

/** Validate one complete immutable staging snapshot before any derived planning. */
export function assertReferenceSourceStagingSnapshotIntegrity(
  snapshot: ReferenceSourceStagingSnapshot
): void {
  let decoded: ReferenceSourceStagingSnapshot;
  try {
    decoded = Value.Decode(ReferenceSourceStagingSnapshotSchema, snapshot);
  } catch (error) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source staging snapshot failed schema validation: ${errorMessage(error)}`
    );
  }
  const { digest, ...core } = decoded;
  if (referenceSourceDigest(core) !== digest) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source staging snapshot digest mismatch for ${decoded.id}`
    );
  }
  assertRecordObservations(decoded);
  assertRecordGraphIntegrity(decoded.records, observationRevisionMap(decoded));
  assertCanonicalTimestamps(decoded, `snapshot ${decoded.id}`);
}

/**
 * A deliberately noncanonical transaction boundary for the reference identity graph.
 * It has no publication, migration, activation, or canonical binding capability.
 */
export class ReferenceSourceStagingService {
  readonly store: ReferenceSourceStagingStore;
  private readonly listLegacyOwnerReferences: () => LegacyOwnerReference[];
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: ReferenceSourceStagingServiceOptions = {}) {
    this.store = options.store ?? new ReferenceSourceStagingStore();
    this.listLegacyOwnerReferences = options.listLegacyOwnerReferences ?? (() => []);
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  readCurrent(): ReferenceSourceStagingDiagnostics {
    const state = this.store.readCurrentState();
    return this.diagnostics(state?.snapshot ?? null, state?.head ?? null);
  }

  readSnapshot(snapshotId: string): ReferenceSourceStagingDiagnostics {
    const state = this.store.readSnapshotState(snapshotId);
    return this.diagnostics(state.snapshot, state.head);
  }

  applyTransaction(
    transaction: ReferenceSourceStagingTransaction
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return this.applyTransactionWithAuthority(transaction, "generic");
  }

  applyControlledUploadTransaction(
    transaction: ReferenceSourceStagingTransaction,
    authority: unknown
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    if (authority !== CONTROLLED_UPLOAD_AUTHORITY) {
      throw new ReferenceSourceStagingIntegrityError(
        "Controlled owner-upload staging authority is unavailable"
      );
    }
    return this.applyTransactionWithAuthority(transaction, "controlled_upload");
  }

  applyOwnerPrivateStudyTransaction(
    transaction: ReferenceSourceStagingTransaction,
    authority: unknown
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    if (authority !== OWNER_PRIVATE_STUDY_AUTHORITY) {
      throw new ReferenceSourceStagingIntegrityError(
        "Owner-private study staging authority is unavailable"
      );
    }
    return this.applyTransactionWithAuthority(transaction, "owner_private_study");
  }

  applyPageAtlasTransaction(
    transaction: ReferenceSourceStagingTransaction,
    authority: unknown
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    if (authority !== PAGE_ATLAS_AUTHORITY) {
      throw new ReferenceSourceStagingIntegrityError("Page Atlas staging authority is unavailable");
    }
    return this.applyTransactionWithAuthority(transaction, "page_atlas");
  }

  applyOwnerLocalExtractionTransaction(
    transaction: ReferenceSourceStagingTransaction,
    authority: unknown
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    if (authority !== OWNER_LOCAL_EXTRACTION_AUTHORITY) {
      throw new ReferenceSourceStagingIntegrityError(
        "Owner-local extraction staging authority is unavailable"
      );
    }
    return this.applyTransactionWithAuthority(transaction, "owner_local_extraction");
  }

  private applyTransactionWithAuthority(
    transaction: ReferenceSourceStagingTransaction,
    authority:
      | "generic"
      | "controlled_upload"
      | "owner_private_study"
      | "owner_local_extraction"
      | "page_atlas"
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    let decodedTransaction: ReferenceSourceStagingTransaction;
    try {
      decodedTransaction = Value.Decode(ReferenceSourceStagingTransactionSchema, transaction);
    } catch (error) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source staging transaction failed schema validation: ${errorMessage(error)}`
      );
    }
    assertCanonicalTimestamps(decodedTransaction, `transaction ${decodedTransaction.id}`);
    if (authority === "controlled_upload") {
      assertCanonicalControlledUploadTransaction(decodedTransaction);
      assertNoReservedOwnerPrivateStudyProvenance(decodedTransaction);
      assertNoReservedOwnerLocalExtractionProvenance(decodedTransaction);
      assertNoProtectedPageAtlasRecords(decodedTransaction);
    } else if (authority === "owner_private_study") {
      assertCanonicalOwnerPrivateStudyTransaction(decodedTransaction);
      assertNoReservedControlledUploadProvenance(decodedTransaction);
      assertNoReservedOwnerLocalExtractionProvenance(decodedTransaction);
      assertNoProtectedPageAtlasRecords(decodedTransaction);
    } else if (authority === "owner_local_extraction") {
      assertCanonicalOwnerLocalExtractionTransaction(decodedTransaction);
      assertNoReservedControlledUploadProvenance(decodedTransaction);
      assertNoReservedOwnerPrivateStudyProvenance(decodedTransaction);
      assertNoProtectedPageAtlasRecords(decodedTransaction);
    } else if (authority === "page_atlas") {
      assertCanonicalPageAtlasTransaction(decodedTransaction);
      assertNoReservedControlledUploadProvenance(decodedTransaction);
      assertNoReservedOwnerPrivateStudyProvenance(decodedTransaction);
      assertNoReservedOwnerLocalExtractionProvenance(decodedTransaction);
    } else {
      assertNoReservedControlledUploadProvenance(decodedTransaction);
      assertNoReservedOwnerPrivateStudyProvenance(decodedTransaction);
      assertNoReservedOwnerLocalExtractionProvenance(decodedTransaction);
      assertNoProtectedPageAtlasRecords(decodedTransaction);
    }
    const currentState = this.store.readCurrentState();
    const current = currentState?.snapshot ?? null;
    if (current) assertCompleteObservationHistoryBeforeAppend(current);
    const existing = current?.records ?? [];
    const appended: ReferenceSourceStagingRecord[] = decodedTransaction.operations.map(
      (operation) => operation.record
    );
    if (authority === "page_atlas") {
      assertProtectedPageAtlasSegments(existing, appended);
    } else {
      assertNoProtectedPageAtlasSegments(existing, appended);
    }
    if (appended.some((record) => record.recordKind === "invalidation")) {
      throw new ReferenceSourceStagingIntegrityError(
        "Invalidation overlays are service-derived and cannot be supplied by a staging client"
      );
    }
    assertAppendOnlyRecords(existing, appended);

    const records = [...existing, ...appended];
    const committedAt = this.now().toISOString();
    const revision = (current?.revision ?? 0) + 1;
    const prospectiveObservationRevisions = new Map(
      (current?.recordObservations ?? []).map((observation) => [
        refKey(observation.recordRef),
        observation.firstObservedRevision,
      ])
    );
    for (const record of appended) prospectiveObservationRevisions.set(refKey(record), revision);
    assertRecordGraphIntegrity(records, prospectiveObservationRevisions);
    const invalidations = deriveInvalidationOverlays({
      appended,
      allRecords: records,
      createdAt: committedAt,
      createId: this.createId,
    });
    const nextRecords = [...records, ...invalidations];
    for (const record of invalidations) {
      prospectiveObservationRevisions.set(refKey(record), revision);
    }
    assertRecordGraphIntegrity(nextRecords, prospectiveObservationRevisions);
    const priorObservations = current?.recordObservations ?? [];
    const priorObservedRefs = new Set(priorObservations.map(({ recordRef }) => refKey(recordRef)));
    const recordObservations: ReferenceSourceRecordObservation[] = [
      ...priorObservations,
      ...nextRecords
        .filter((record) => !priorObservedRefs.has(refKey(record)))
        .map((record) => ({
          recordRef: refFor(record),
          firstObservedRevision: revision,
          observedAt: committedAt,
          orderingTrust: "server_observed" as const,
        })),
    ];
    const snapshotCore: Omit<ReferenceSourceStagingSnapshot, "digest"> = {
      schemaVersion: 1,
      id: `reference-source-snapshot.${this.createId()}`,
      revision,
      ...(current ? { parentSnapshotRef: refFor(current) } : {}),
      publicationState: "staging_only",
      createdAt: committedAt,
      recordObservations,
      records: nextRecords,
    };
    const snapshot: ReferenceSourceStagingSnapshot = {
      ...snapshotCore,
      digest: referenceSourceDigest(snapshotCore),
    };
    const committedHead = this.store.commit(snapshot, decodedTransaction.expectedHeadRef);
    return this.diagnostics(snapshot, committedHead);
  }

  /**
   * Make a pre-observation snapshot appendable without claiming to know the
   * arrival order of records that predate server observation metadata.
   *
   * This is deliberately explicit and compare-and-swap protected. Historical
   * observations are preserved where present, missing entries are added only
   * as legacy-unverifiable facts, and lifecycle authorization continues to
   * reject every ordering claim that depends on them.
   */
  migrateLegacyObservationHistory(
    expectedHeadRef: ReferenceRecordRef
  ): ReferenceSourceStagingDiagnostics {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const currentState = this.store.readCurrentState();
    if (!currentState) {
      throw new ReferenceSourceStagingIntegrityError(
        "Reference-source staging has no snapshot to migrate"
      );
    }
    const current = currentState.snapshot;
    assertReferenceSourceStagingSnapshotIntegrity(current);
    const priorByRef = new Map(
      (current.recordObservations ?? []).map((observation) => [
        refKey(observation.recordRef),
        observation,
      ])
    );
    const needsMigration = current.records.some((record) => {
      const observation = priorByRef.get(refKey(record));
      return observation === undefined || observation.orderingTrust === undefined;
    });
    if (!needsMigration) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source staging snapshot ${current.id} already has complete observation-trust metadata`
      );
    }

    const migratedAt = this.now().toISOString();
    const revision = current.revision + 1;
    const recordObservations: ReferenceSourceRecordObservation[] = current.records.map((record) => {
      const prior = priorByRef.get(refKey(record));
      if (prior?.orderingTrust === "server_observed") return prior;
      return {
        recordRef: refFor(record),
        firstObservedRevision: prior?.firstObservedRevision ?? current.revision,
        observedAt: prior?.observedAt ?? migratedAt,
        orderingTrust: "legacy_unverifiable",
      };
    });
    const snapshotCore: Omit<ReferenceSourceStagingSnapshot, "digest"> = {
      schemaVersion: 1,
      id: `reference-source-snapshot.${this.createId()}`,
      revision,
      parentSnapshotRef: refFor(current),
      publicationState: "staging_only",
      createdAt: migratedAt,
      recordObservations,
      records: current.records,
    };
    const snapshot: ReferenceSourceStagingSnapshot = {
      ...snapshotCore,
      digest: referenceSourceDigest(snapshotCore),
    };
    // Migration changes the ordering semantics used by graph validation. A
    // legacy snapshot that was valid only under documentary timestamps must
    // not become current if the conservative observation projection exposes a
    // missing historical retention root or another ordering-dependent flaw.
    assertReferenceSourceStagingSnapshotIntegrity(snapshot);
    const committedHead = this.store.commit(snapshot, expectedHeadRef);
    return this.diagnostics(snapshot, committedHead);
  }

  private diagnostics(
    snapshot: ReferenceSourceStagingSnapshot | null,
    head: ReferenceSourceStagingHead | null
  ): ReferenceSourceStagingDiagnostics {
    return {
      publicationState: "staging_only",
      head,
      snapshot,
      view:
        snapshot && head && (head.snapshotId !== snapshot.id || head.digest !== snapshot.digest)
          ? { kind: "historical", viewedSnapshotRef: refFor(snapshot) }
          : { kind: "current" },
      legacyProjection: {
        ownerReferences: this.listLegacyOwnerReferences().map(redactLegacyOwnerReference),
      },
      capabilities: {
        stagingTransactions: true,
        canonicalPublication: false,
      },
    };
  }
}

function assertNoReservedControlledUploadProvenance(
  transaction: ReferenceSourceStagingTransaction
): void {
  const usesReservedNamespace =
    transaction.id.startsWith("transaction.owner-upload.") ||
    transaction.operations.some(({ record }) => {
      if (record.id.startsWith("acquisition.owner-upload.")) return true;
      if (record.recordKind !== "asset_acquisition") return false;
      return (
        record.processingPolicyRef.id === OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF.id ||
        (record.origin.sourceKind === "upload" &&
          record.origin.ownerActionRef.id.startsWith("owner-action.reference-upload."))
      );
    });
  if (usesReservedNamespace) {
    throw new ReferenceSourceStagingIntegrityError(
      "Controlled owner-upload provenance is server-minted and unavailable to generic staging transactions"
    );
  }
}

function assertCanonicalControlledUploadTransaction(
  transaction: ReferenceSourceStagingTransaction
): void {
  const transactionMatch = transaction.id.match(CONTROLLED_UPLOAD_TRANSACTION_ID);
  const records = transaction.operations.map(({ record }) => record);
  const acquisitions = records.filter(
    (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
  );
  const otherRecords = records.filter(
    (record) => record.recordKind !== "asset_acquisition" && record.recordKind !== "digital_asset"
  );
  const acquisition = acquisitions[0];
  const acquisitionMatch = acquisition?.id.match(CONTROLLED_UPLOAD_ACQUISITION_ID);
  const ownerActionMatch =
    acquisition?.origin.sourceKind === "upload"
      ? acquisition.origin.ownerActionRef.id.match(CONTROLLED_UPLOAD_OWNER_ACTION_ID)
      : null;
  const ownerActionRef = ownerActionMatch
    ? {
        id:
          acquisition!.origin.sourceKind === "upload" ? acquisition!.origin.ownerActionRef.id : "",
        digest: referenceSourceDigest({
          id:
            acquisition!.origin.sourceKind === "upload"
              ? acquisition!.origin.ownerActionRef.id
              : "",
        }),
      }
    : null;
  const digitalAssets = records.filter((record) => record.recordKind === "digital_asset");
  const exact =
    transactionMatch !== null &&
    acquisitions.length === 1 &&
    otherRecords.length === 0 &&
    digitalAssets.length <= 1 &&
    records.length === acquisitions.length + digitalAssets.length &&
    acquisition !== undefined &&
    acquisitionMatch !== null &&
    acquisition.origin.sourceKind === "upload" &&
    ownerActionMatch !== null &&
    transactionMatch[1] === acquisition.digest.slice(0, 32) &&
    acquisitionMatch[1] === ownerActionMatch[1] &&
    refsEqual(acquisition.processingPolicyRef, OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF) &&
    ownerActionRef !== null &&
    refsEqual(acquisition.origin.ownerActionRef, ownerActionRef) &&
    acquisition.representedExemplarRefs.length === 0 &&
    acquisition.rightsAssertionRefs.length === 0 &&
    acquisition.supersedesAcquisitionRef === undefined &&
    transaction.submittedAt === acquisition.acquiredAt &&
    (digitalAssets.length === 0 || refsEqual(acquisition.digitalAssetRef, digitalAssets[0]!));
  if (!exact) {
    throw new ReferenceSourceStagingIntegrityError(
      "Controlled owner-upload staging transaction does not satisfy the server-minted provenance invariant"
    );
  }
}

function assertNoReservedOwnerPrivateStudyProvenance(
  transaction: ReferenceSourceStagingTransaction
): void {
  const usesReservedNamespace =
    transaction.id.startsWith("transaction.owner-private-study.") ||
    transaction.operations.some(({ record }) => {
      if (
        record.id.startsWith("rights-assertion.owner-private-study.") ||
        record.id.startsWith("access-decision.owner-private-study.")
      ) {
        return true;
      }
      if (record.recordKind === "rights_assertion") {
        return (
          refsEqual(record.claimant.claimantRef, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF) ||
          record.evidenceRefs.some(({ id }) => id.startsWith("owner-reference-local-study-scope."))
        );
      }
      return (
        record.recordKind === "access_decision" &&
        (refsEqual(record.policyRef, OWNER_PRIVATE_LOCAL_STUDY_POLICY_REF) ||
          record.authorityRefs.some((reference) =>
            refsEqual(reference, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF)
          ))
      );
    });
  if (usesReservedNamespace) {
    throw new ReferenceSourceStagingIntegrityError(
      "Owner-private local-study attestations are server-minted and unavailable to generic staging transactions"
    );
  }
}

function assertCanonicalOwnerPrivateStudyTransaction(
  transaction: ReferenceSourceStagingTransaction
): void {
  const transactionMatch = transaction.id.match(OWNER_PRIVATE_STUDY_TRANSACTION_ID);
  const records = transaction.operations.map(({ record }) => record);
  const rights = records.filter(
    (record): record is ReferenceRightsAssertion => record.recordKind === "rights_assertion"
  );
  const decisions = records.filter(
    (record): record is ReferenceAccessDecision => record.recordKind === "access_decision"
  );
  const assertion = rights[0];
  const decision = decisions[0];
  const rightsMatch = assertion?.id.match(OWNER_PRIVATE_STUDY_RIGHTS_ID);
  const decisionMatch = decision?.id.match(OWNER_PRIVATE_STUDY_DECISION_ID);
  const exact =
    transactionMatch !== null &&
    records.length === 2 &&
    transaction.operations[0]?.record.recordKind === "rights_assertion" &&
    transaction.operations[1]?.record.recordKind === "access_decision" &&
    rights.length === 1 &&
    decisions.length === 1 &&
    assertion !== undefined &&
    decision !== undefined &&
    rightsMatch !== undefined &&
    rightsMatch !== null &&
    decisionMatch !== undefined &&
    decisionMatch !== null &&
    transactionMatch[1] === rightsMatch[1] &&
    transactionMatch[1] === decisionMatch[1] &&
    assertion.version === 1 &&
    assertion.parentVersionRef === undefined &&
    assertion.subjectKind === "asset_acquisition" &&
    assertion.rightsKind === "owner_private_access" &&
    assertion.status === "permitted" &&
    assertion.claimant.kind === "owner" &&
    refsEqual(assertion.claimant.claimantRef, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF) &&
    assertion.evidenceRefs.length === 1 &&
    assertion.evidenceRefs[0]!.id.startsWith("owner-reference-local-study-scope.") &&
    assertion.validFrom === undefined &&
    assertion.validUntil === undefined &&
    assertion.assertedAt === transaction.submittedAt &&
    decision.version === 1 &&
    decision.parentVersionRef === undefined &&
    decision.outcome === "allow" &&
    decision.operation === "owner_private_study" &&
    decision.sourceRefs.length === 1 &&
    refsEqual(decision.sourceRefs[0]!, assertion.subjectRef) &&
    decision.derivativeRefs.length === 0 &&
    decision.destination.kind === "local_runtime" &&
    decision.destination.id === undefined &&
    decision.assetRole === undefined &&
    refsEqual(decision.policyRef, OWNER_PRIVATE_LOCAL_STUDY_POLICY_REF) &&
    decision.rightsAssertionRefs.length === 1 &&
    refsEqual(decision.rightsAssertionRefs[0]!, assertion) &&
    decision.authorityRefs.length === 1 &&
    refsEqual(decision.authorityRefs[0]!, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF) &&
    decision.rationale === OWNER_PRIVATE_LOCAL_STUDY_RATIONALE &&
    decision.decidedAt === transaction.submittedAt &&
    decision.validUntil === undefined;
  if (!exact) {
    throw new ReferenceSourceStagingIntegrityError(
      "Owner-private local-study transaction does not satisfy the server-minted attestation invariant"
    );
  }
}

function assertNoReservedOwnerLocalExtractionProvenance(
  transaction: ReferenceSourceStagingTransaction
): void {
  const usesReservedNamespace =
    transaction.id.startsWith("transaction.owner-local-extraction.") ||
    transaction.operations.some(({ record }) => {
      if (
        record.id.startsWith("rights-assertion.owner-local-extraction.") ||
        record.id.startsWith("access-decision.owner-local-extraction.")
      ) {
        return true;
      }
      if (record.recordKind === "rights_assertion") {
        return (
          refsEqual(
            record.claimant.claimantRef,
            OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF
          ) ||
          record.evidenceRefs.some(({ id }) =>
            id.startsWith("owner-reference-local-extraction-scope.")
          )
        );
      }
      return (
        record.recordKind === "access_decision" &&
        (refsEqual(record.policyRef, OWNER_LOCAL_EXTRACTION_POLICY_REF) ||
          record.authorityRefs.some((reference) =>
            refsEqual(reference, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF)
          ))
      );
    });
  if (usesReservedNamespace) {
    throw new ReferenceSourceStagingIntegrityError(
      "Owner-local extraction attestations are server-minted and unavailable to generic staging transactions"
    );
  }
}

function assertCanonicalOwnerLocalExtractionTransaction(
  transaction: ReferenceSourceStagingTransaction
): void {
  const transactionMatch = transaction.id.match(OWNER_LOCAL_EXTRACTION_TRANSACTION_ID);
  const records = transaction.operations.map(({ record }) => record);
  const assertion = records.find(
    (record): record is ReferenceRightsAssertion => record.recordKind === "rights_assertion"
  );
  const decision = records.find(
    (record): record is ReferenceAccessDecision => record.recordKind === "access_decision"
  );
  const rightsMatch = assertion?.id.match(OWNER_LOCAL_EXTRACTION_RIGHTS_ID);
  const decisionMatch = decision?.id.match(OWNER_LOCAL_EXTRACTION_DECISION_ID);
  const exact =
    transactionMatch !== null &&
    records.length === 2 &&
    transaction.operations[0]?.record.recordKind === "rights_assertion" &&
    transaction.operations[1]?.record.recordKind === "access_decision" &&
    assertion !== undefined &&
    decision !== undefined &&
    rightsMatch !== undefined &&
    rightsMatch !== null &&
    decisionMatch !== undefined &&
    decisionMatch !== null &&
    transactionMatch[1] === rightsMatch[1] &&
    transactionMatch[1] === decisionMatch[1] &&
    assertion.version === 1 &&
    assertion.parentVersionRef === undefined &&
    assertion.subjectKind === "asset_acquisition" &&
    assertion.rightsKind === "local_extraction" &&
    assertion.status === "permitted" &&
    assertion.claimant.kind === "owner" &&
    refsEqual(assertion.claimant.claimantRef, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF) &&
    assertion.evidenceRefs.length === 1 &&
    assertion.evidenceRefs[0]!.id.startsWith("owner-reference-local-extraction-scope.") &&
    assertion.validFrom === undefined &&
    assertion.validUntil === undefined &&
    assertion.assertedAt === transaction.submittedAt &&
    decision.version === 1 &&
    decision.parentVersionRef === undefined &&
    decision.outcome === "allow" &&
    decision.operation === "local_extraction" &&
    decision.sourceRefs.length === 1 &&
    refsEqual(decision.sourceRefs[0]!, assertion.subjectRef) &&
    decision.derivativeRefs.length === 0 &&
    decision.destination.kind === "local_runtime" &&
    decision.destination.id === undefined &&
    decision.assetRole === undefined &&
    decision.purpose.trim().length > 0 &&
    refsEqual(decision.policyRef, OWNER_LOCAL_EXTRACTION_POLICY_REF) &&
    decision.rightsAssertionRefs.length === 1 &&
    refsEqual(decision.rightsAssertionRefs[0]!, assertion) &&
    decision.authorityRefs.length === 1 &&
    refsEqual(decision.authorityRefs[0]!, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF) &&
    decision.rationale === OWNER_LOCAL_EXTRACTION_RATIONALE &&
    decision.decidedAt === transaction.submittedAt &&
    decision.validUntil === undefined;
  if (!exact) {
    throw new ReferenceSourceStagingIntegrityError(
      "Owner-local extraction transaction does not satisfy the server-minted attestation invariant"
    );
  }
}

const PAGE_ATLAS_PROTECTED_RECORD_KINDS = new Set<ReferenceSourceStagingRecord["recordKind"]>([
  "asset_identity_resolution",
  "page_atlas_version",
  "page_atlas_attempt",
  "page_atlas_correction",
  "reference_derivative_artifact",
  "cited_extraction_version",
  "extraction_proposal",
  "citation_successor",
]);

function assertNoProtectedPageAtlasRecords(transaction: ReferenceSourceStagingTransaction): void {
  if (
    transaction.operations.some(({ record }) =>
      PAGE_ATLAS_PROTECTED_RECORD_KINDS.has(record.recordKind)
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Page Atlas and cited-extraction records are server-minted and unavailable to the generic staging writer"
    );
  }
}

function assertCanonicalPageAtlasTransaction(transaction: ReferenceSourceStagingTransaction): void {
  const identityBundleKinds = new Set<ReferenceSourceStagingRecord["recordKind"]>([
    "work",
    "source_manifestation",
    "exemplar",
    "identity_assertion",
  ]);
  if (
    transaction.operations.some(
      ({ record }) =>
        !PAGE_ATLAS_PROTECTED_RECORD_KINDS.has(record.recordKind) &&
        record.recordKind !== "source_segment_version" &&
        !identityBundleKinds.has(record.recordKind)
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "The Page Atlas staging writer cannot append records outside its protected graph"
    );
  }

  const records = transaction.operations.map(({ record }) => record);
  const identityBundle = records.filter(({ recordKind }) => identityBundleKinds.has(recordKind));
  if (identityBundle.length === 0) return;
  const resolutions = records.filter(
    (record): record is ReferenceAssetIdentityResolution =>
      record.recordKind === "asset_identity_resolution"
  );
  if (resolutions.length !== 1) {
    throw new ReferenceSourceStagingIntegrityError(
      "A Page Atlas identity bundle requires exactly one protected Asset Identity Resolution"
    );
  }
  const resolution = resolutions[0]!;
  const allowed = new Set([
    refKey(resolution.workRef),
    refKey(resolution.manifestationRef),
    ...resolution.exemplarRefs.map(refKey),
    ...resolution.identityAssertionRefs.map(refKey),
  ]);
  if (identityBundle.some((record) => !allowed.has(refKey(record)))) {
    throw new ReferenceSourceStagingIntegrityError(
      "A Page Atlas identity bundle cannot append identity records outside its exact resolution"
    );
  }
}

function assertNoProtectedPageAtlasSegments(
  existing: ReferenceSourceStagingRecord[],
  appended: ReferenceSourceStagingRecord[]
): void {
  const localAtlasRefs = new Set(
    [...existing, ...appended]
      .filter(
        (record): record is ReferencePageAtlasVersion => record.recordKind === "page_atlas_version"
      )
      .map(refKey)
  );
  if (
    appended.some(
      (record) =>
        record.recordKind === "source_segment_version" &&
        localAtlasRefs.has(refKey(record.pageAtlasRef))
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Source segments attached to a protected local Page Atlas are server-minted and unavailable to the generic staging writer"
    );
  }
}

function assertProtectedPageAtlasSegments(
  existing: ReferenceSourceStagingRecord[],
  appended: ReferenceSourceStagingRecord[]
): void {
  const localAtlasRefs = new Set(
    [...existing, ...appended]
      .filter(
        (record): record is ReferencePageAtlasVersion => record.recordKind === "page_atlas_version"
      )
      .map(refKey)
  );
  if (
    appended.some(
      (record) =>
        record.recordKind === "source_segment_version" &&
        !localAtlasRefs.has(refKey(record.pageAtlasRef))
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "The Page Atlas staging writer requires every new source segment to resolve a protected local Page Atlas Version"
    );
  }
}

function assertCanonicalTimestamps(value: unknown, label: string): void {
  try {
    assertCanonicalReferenceSourceTimestampFields(value);
  } catch {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} contains a noncanonical or impossible timestamp`
    );
  }
}

function assertRecordObservations(snapshot: ReferenceSourceStagingSnapshot): void {
  if (!snapshot.recordObservations) return;
  const records = new Map(snapshot.records.map((record) => [refKey(record), record]));
  const observed = new Set<string>();
  for (const observation of snapshot.recordObservations) {
    const key = refKey(observation.recordRef);
    if (!records.has(key)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source observation names a record outside snapshot ${snapshot.id}`
      );
    }
    if (observed.has(key)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source snapshot repeats first-observation metadata for ${observation.recordRef.id}`
      );
    }
    if (observation.firstObservedRevision > snapshot.revision) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source observation revision exceeds snapshot ${snapshot.id}`
      );
    }
    observed.add(key);
  }
}

function observationRevisionMap(
  snapshot: ReferenceSourceStagingSnapshot
): ReadonlyMap<string, number> {
  return new Map(
    (snapshot.recordObservations ?? []).map((observation) => [
      refKey(observation.recordRef),
      observation.firstObservedRevision,
    ])
  );
}

function observedNoLaterThanRecord(
  candidate: { id: string; digest: string; createdAt: string },
  container: { id: string; digest: string; createdAt: string },
  firstObservedRevisions: ReadonlyMap<string, number>
): boolean {
  const candidateRevision = firstObservedRevisions.get(refKey(candidate));
  const containerRevision = firstObservedRevisions.get(refKey(container));
  if (candidateRevision !== undefined && containerRevision !== undefined) {
    return candidateRevision <= containerRevision;
  }
  return Date.parse(candidate.createdAt) <= Date.parse(container.createdAt);
}

function assertCompleteObservationHistoryBeforeAppend(
  snapshot: ReferenceSourceStagingSnapshot
): void {
  if (snapshot.records.length === 0) return;
  const observationsByRef = new Map(
    (snapshot.recordObservations ?? []).map((observation) => [
      refKey(observation.recordRef),
      observation,
    ])
  );
  if (
    snapshot.records.some((record) => {
      const observation = observationsByRef.get(refKey(record));
      return observation === undefined || observation.orderingTrust === undefined;
    })
  ) {
    throw new ReferenceSourceStagingMigrationRequiredError(refFor(snapshot), snapshot.revision);
  }
}

export function redactLegacyOwnerReference(
  reference: LegacyOwnerReference
): RedactedLegacyOwnerReference {
  return {
    id: reference.id,
    title: reference.title,
    citation: reference.citation,
    mimeType: reference.mimeType,
    sha256: reference.sha256,
    ...(reference.byteLength === undefined ? {} : { byteLength: reference.byteLength }),
    createdAt: reference.createdAt,
    readOnly: true,
    identityConfidence: { kind: "unknown" },
  };
}

function assertAppendOnlyRecords(
  existing: ReferenceSourceStagingRecord[],
  appended: ReferenceSourceStagingRecord[]
): void {
  const byExactRef = new Set<string>();
  const byLogicalVersion = new Set<string>();
  const kindsById = new Map<string, string>();
  for (const record of existing) {
    assertRecordDigest(record);
    byExactRef.add(refKey(record));
    registerLogicalIdentity(record, byLogicalVersion, kindsById);
  }
  for (const record of appended) {
    assertRecordDigest(record);
    if (byExactRef.has(refKey(record))) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source staging records are append-only; duplicate exact record ${record.id}`
      );
    }
    byExactRef.add(refKey(record));
    registerLogicalIdentity(record, byLogicalVersion, kindsById);
  }
}

function assertRecordGraphIntegrity(
  records: ReferenceSourceStagingRecord[],
  firstObservedRevisions: ReadonlyMap<string, number> = new Map()
): void {
  const byRef = new Map<string, ReferenceSourceStagingRecord>();
  const assetsBySha256 = new Map<string, ReferenceSourceStagingRecord>();
  const byLogicalVersion = new Set<string>();
  const kindsById = new Map<string, string>();
  for (const record of records) {
    assertRecordDigest(record);
    const key = refKey(record);
    if (byRef.has(key)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source graph contains duplicate exact record ${record.id}`
      );
    }
    byRef.set(key, record);
    registerLogicalIdentity(record, byLogicalVersion, kindsById);
    if (record.recordKind === "digital_asset") {
      const prior = assetsBySha256.get(record.sha256);
      if (prior && refKey(prior) !== refKey(record)) {
        throw new ReferenceSourceStagingIntegrityError(
          `Digital Asset bytes ${record.sha256} already have exact identity ${prior.id}`
        );
      }
      assetsBySha256.set(record.sha256, record);
    }
  }

  for (const record of records) {
    assertVersionParent(record, byRef);
    assertLocalStructuralEdges(record, byRef, firstObservedRevisions);
  }
  assertDependencyGraphAcyclic(records.filter(isDependencyEdge));
}

function assertLocalStructuralEdges(
  record: ReferenceSourceStagingRecord,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  firstObservedRevisions: ReadonlyMap<string, number>
): void {
  switch (record.recordKind) {
    case "identity_assertion": {
      resolveKind(record.subjectRef, record.subjectKind, byRef, `${record.id}.subjectRef`);
      for (const ref of record.componentAssertionRefs) {
        resolveKind(ref, "identity_assertion", byRef, `${record.id}.componentAssertionRefs`);
      }
      for (const ref of record.predecessorAssertionRefs) {
        resolveKind(ref, "identity_assertion", byRef, `${record.id}.predecessorAssertionRefs`);
      }
      for (const ref of record.conflictAssertionRefs) {
        resolveKind(ref, "identity_assertion", byRef, `${record.id}.conflictAssertionRefs`);
      }
      if (record.assertedValue.kind === "entity_ref") {
        assertOpaqueExternalRef(record.assertedValue.value, byRef, `${record.id}.assertedValue`);
      }
      if (record.assertedValue.kind === "entity_refs") {
        assertOpaqueExternalRefs(record.assertedValue.values, byRef, `${record.id}.assertedValue`);
      }
      assertOpaqueExternalRef(
        record.claimant.claimantRef,
        byRef,
        `${record.id}.claimant.claimantRef`
      );
      assertLocalOrOpaqueRefs(record.evidenceRefs, byRef, `${record.id}.evidenceRefs`);
      if (record.confidence.kind === "assessed") {
        if (record.confidence.evidenceRefs.length === 0) {
          throw new ReferenceSourceStagingIntegrityError(
            `Assessed Identity Assertion ${record.id} requires explicit confidence evidence`
          );
        }
        assertLocalOrOpaqueRefs(
          record.confidence.evidenceRefs,
          byRef,
          `${record.id}.confidence.evidenceRefs`
        );
        if (
          record.assertedValue.kind === "classification" &&
          record.confidence.value === 1 &&
          ["provider", "catalog", "importer", "system"].includes(record.claimant.kind)
        ) {
          throw new ReferenceSourceStagingIntegrityError(
            `Documentary classification ${record.id} cannot receive automatic perfect confidence`
          );
        }
      }
      assertIdentityLineage(record, byRef);
      return;
    }
    case "work":
      resolveMany(
        record.identityAssertionRefs,
        "identity_assertion",
        byRef,
        `${record.id}.identityAssertionRefs`
      );
      assertIdentityAssertionsDescribe(record, record.identityAssertionRefs, byRef);
      assertOpaqueExternalRefs(
        record.creatorIdentityRefs,
        byRef,
        `${record.id}.creatorIdentityRefs`
      );
      return;
    case "source_manifestation":
      for (const relation of record.workRelations) {
        resolveKind(relation.workRef, "work", byRef, `${record.id}.workRelations`);
      }
      for (const relation of record.parentRelations) {
        resolveKind(
          relation.manifestationRef,
          "source_manifestation",
          byRef,
          `${record.id}.parentRelations`
        );
      }
      resolveMany(
        record.identityAssertionRefs,
        "identity_assertion",
        byRef,
        `${record.id}.identityAssertionRefs`
      );
      assertIdentityAssertionsDescribe(record, record.identityAssertionRefs, byRef);
      assertOpaqueExternalRefs(record.editorIdentityRefs, byRef, `${record.id}.editorIdentityRefs`);
      assertOpaqueExternalRefs(
        record.translatorIdentityRefs,
        byRef,
        `${record.id}.translatorIdentityRefs`
      );
      return;
    case "exemplar":
      resolveMany(
        record.manifestationRefs,
        "source_manifestation",
        byRef,
        `${record.id}.manifestationRefs`
      );
      resolveMany(
        record.identityAssertionRefs,
        "identity_assertion",
        byRef,
        `${record.id}.identityAssertionRefs`
      );
      assertIdentityAssertionsDescribe(record, record.identityAssertionRefs, byRef);
      return;
    case "digital_asset":
      return;
    case "asset_acquisition":
      resolveKind(record.digitalAssetRef, "digital_asset", byRef, `${record.id}.digitalAssetRef`);
      resolveMany(
        record.representedExemplarRefs,
        "exemplar",
        byRef,
        `${record.id}.representedExemplarRefs`
      );
      for (const rightsRef of record.rightsAssertionRefs) {
        const rights = resolveKind(
          rightsRef,
          "rights_assertion",
          byRef,
          `${record.id}.rightsAssertionRefs`
        );
        const concernsAcquisition =
          rights.subjectKind === "asset_acquisition" &&
          (refKey(rights.subjectRef) === refKey(record) ||
            (record.supersedesAcquisitionRef !== undefined &&
              refKey(rights.subjectRef) === refKey(record.supersedesAcquisitionRef)));
        const concernsAsset =
          rights.subjectKind === "digital_asset" &&
          refKey(rights.subjectRef) === refKey(record.digitalAssetRef);
        if (!concernsAcquisition && !concernsAsset) {
          throw new ReferenceSourceStagingIntegrityError(
            `Asset Acquisition ${record.id} cites a Rights Assertion for an unrelated subject`
          );
        }
      }
      if (record.supersedesAcquisitionRef) {
        const predecessor = resolveKind(
          record.supersedesAcquisitionRef,
          "asset_acquisition",
          byRef,
          `${record.id}.supersedesAcquisitionRef`
        );
        if (refKey(predecessor.digitalAssetRef) !== refKey(record.digitalAssetRef)) {
          throw new ReferenceSourceStagingIntegrityError(
            `Asset Acquisition ${record.id} cannot supersede an acquisition of different bytes`
          );
        }
        assertAcquisitionSupersessionAcyclic(record, predecessor, byRef);
      }
      if ("providerRef" in record.origin) {
        assertOpaqueExternalRef(
          record.origin.providerRef,
          byRef,
          `${record.id}.origin.providerRef`
        );
      }
      if ("ownerActionRef" in record.origin) {
        assertOpaqueExternalRef(
          record.origin.ownerActionRef,
          byRef,
          `${record.id}.origin.ownerActionRef`
        );
      }
      if ("legacyRecordRef" in record.origin) {
        assertOpaqueExternalRef(
          record.origin.legacyRecordRef,
          byRef,
          `${record.id}.origin.legacyRecordRef`
        );
      }
      assertOpaqueExternalRef(
        record.processingPolicyRef,
        byRef,
        `${record.id}.processingPolicyRef`
      );
      return;
    case "asset_identity_resolution":
      assertAssetIdentityResolution(record, byRef);
      return;
    case "source_derivation":
      resolveMany(
        record.sourceAcquisitionRefs,
        "asset_acquisition",
        byRef,
        `${record.id}.sourceAcquisitionRefs`
      );
      resolveMany(
        record.sourceDerivationRefs,
        "source_derivation",
        byRef,
        `${record.id}.sourceDerivationRefs`
      );
      assertLocalOrOpaqueRefs(record.inputRefs, byRef, `${record.id}.inputRefs`);
      assertLocalOrOpaqueRef(record.derivedRef, byRef, `${record.id}.derivedRef`);
      assertOpaqueExternalRef(record.componentRef, byRef, `${record.id}.componentRef`);
      return;
    case "page_atlas_version":
      assertPageAtlasVersion(record, byRef);
      return;
    case "page_atlas_attempt":
      assertPageAtlasAttempt(record, byRef);
      return;
    case "page_atlas_correction":
      assertPageAtlasCorrection(record, byRef);
      return;
    case "reference_derivative_artifact":
      assertDerivativeArtifact(record, byRef);
      return;
    case "source_segment_version": {
      resolveKind(record.digitalAssetRef, "digital_asset", byRef, `${record.id}.digitalAssetRef`);
      const acquisitions = record.acquisitionRefs.map((ref) =>
        resolveKind(ref, "asset_acquisition", byRef, `${record.id}.acquisitionRefs`)
      );
      const provenanceRecords = resolveManyOfKinds(
        record.provenancePathRefs,
        ["asset_acquisition", "source_derivation"],
        byRef,
        `${record.id}.provenancePathRefs`
      );
      for (const acquisition of acquisitions) {
        if (refKey(acquisition.digitalAssetRef) !== refKey(record.digitalAssetRef)) {
          throw new ReferenceSourceStagingIntegrityError(
            `Source Segment Version ${record.id} names an acquisition for different bytes`
          );
        }
        const pathPinsAcquisition = provenanceRecords.some(
          (pathRecord) =>
            (pathRecord.recordKind === "asset_acquisition" &&
              refKey(pathRecord) === refKey(acquisition)) ||
            (pathRecord.recordKind === "source_derivation" &&
              pathRecord.sourceAcquisitionRefs.some((ref) => refKey(ref) === refKey(acquisition)))
        );
        if (!pathPinsAcquisition) {
          throw new ReferenceSourceStagingIntegrityError(
            `Source Segment Version ${record.id} provenance path omits acquisition ${acquisition.id}`
          );
        }
      }
      const localAtlas = byRef.get(refKey(record.pageAtlasRef));
      if (localAtlas) {
        if (localAtlas.recordKind !== "page_atlas_version") {
          throw new ReferenceSourceStagingIntegrityError(
            `Source Segment Version ${record.id} pageAtlasRef does not resolve to a Page Atlas Version`
          );
        }
        assertModernSourceSegment(record, localAtlas, byRef);
      } else {
        // Compatibility for immutable T05-era segments whose Page Atlas lived
        // outside this graph. Every newly protected segment must resolve a
        // local Page Atlas Version and is validated by the branch above.
        assertOpaqueExternalRef(record.pageAtlasRef, byRef, `${record.id}.pageAtlasRef`);
        assertLocalOrOpaqueRef(record.sourceImageRef, byRef, `${record.id}.sourceImageRef`);
      }
      return;
    }
    case "cited_extraction_version":
      assertCitedExtractionVersion(record, byRef);
      return;
    case "extraction_proposal":
      assertExtractionProposal(record, byRef);
      return;
    case "citation_successor":
      assertCitationSuccessor(record, byRef);
      return;
    case "rights_assertion":
      resolveKind(record.subjectRef, record.subjectKind, byRef, `${record.id}.subjectRef`);
      if (record.status !== "unknown" && record.evidenceRefs.length === 0) {
        throw new ReferenceSourceStagingIntegrityError(
          `Rights Assertion ${record.id} requires evidence unless its status is unknown`
        );
      }
      assertOpaqueExternalRef(
        record.claimant.claimantRef,
        byRef,
        `${record.id}.claimant.claimantRef`
      );
      assertLocalOrOpaqueRefs(record.evidenceRefs, byRef, `${record.id}.evidenceRefs`);
      assertRightsSemantics(record, byRef);
      return;
    case "access_decision":
      resolveMany(
        record.rightsAssertionRefs,
        "rights_assertion",
        byRef,
        `${record.id}.rightsAssertionRefs`
      );
      if (
        record.outcome === "allow" &&
        record.rightsAssertionRefs.length === 0 &&
        record.authorityRefs.length === 0
      ) {
        throw new ReferenceSourceStagingIntegrityError(
          `Allow Access Decision ${record.id} has neither rights evidence nor explicit authority`
        );
      }
      assertAccessDecisionSemantics(record, byRef);
      return;
    case "lifecycle_storage_policy":
      assertLifecycleStoragePolicy(record, byRef, firstObservedRevisions);
      return;
    case "lifecycle_use":
      assertLifecycleUse(record, byRef);
      return;
    case "arrangement_source_binding":
      assertRoleBinding(record, byRef);
      assertOpaqueExternalRef(record.retentionPolicyRef, byRef, `${record.id}.retentionPolicyRef`);
      assertOpaqueExternalRef(record.workspaceRef, byRef, `${record.id}.workspaceRef`);
      return;
    case "owner_reference_binding":
      assertRoleBinding(record, byRef);
      assertOpaqueExternalRef(record.retentionPolicyRef, byRef, `${record.id}.retentionPolicyRef`);
      assertOpaqueExternalRef(record.ownerLibraryRef, byRef, `${record.id}.ownerLibraryRef`);
      return;
    case "evaluation_source_binding":
      assertRoleBinding(record, byRef);
      assertOpaqueExternalRef(record.retentionPolicyRef, byRef, `${record.id}.retentionPolicyRef`);
      assertDisclosedEvaluationBinding(record, byRef);
      return;
    case "evaluation_source_binding_commitment":
      return;
    case "identity_redirect":
      for (const ref of [...record.fromRefs, ...record.toRefs]) {
        resolveRecord(ref, byRef, `${record.id}.identityRedirectRefs`);
      }
      assertLocalOrOpaqueRefs(record.evidenceRefs, byRef, `${record.id}.evidenceRefs`);
      assertOpaqueExternalRef(record.decidedByRef, byRef, `${record.id}.decidedByRef`);
      return;
    case "provenance_substitution":
      assertProvenanceSubstitution(record, byRef);
      return;
    case "dependency_edge":
      assertDependencyEdge(record, byRef);
      return;
    case "invalidation":
      assertInvalidation(record, byRef);
      return;
    default:
      assertNever(record);
  }
}

function assertAssetIdentityResolution(
  resolution: ReferenceAssetIdentityResolution,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const expectedResolutionState =
    resolution.reviewState === "reviewed"
      ? "resolved"
      : resolution.reviewState === "disputed"
        ? "disputed"
        : "candidate";
  if (resolution.resolutionState !== expectedResolutionState) {
    throw new ReferenceSourceStagingIntegrityError(
      `Asset Identity Resolution ${resolution.id} overstates or contradicts its review state`
    );
  }
  resolveKind(
    resolution.digitalAssetRef,
    "digital_asset",
    byRef,
    `${resolution.id}.digitalAssetRef`
  );
  const acquisitions = resolveMany(
    resolution.acquisitionRefs,
    "asset_acquisition",
    byRef,
    `${resolution.id}.acquisitionRefs`
  );
  assertDistinctRefs(resolution.acquisitionRefs, `${resolution.id}.acquisitionRefs`);
  assertAcquisitionsDescribeAsset(acquisitions, resolution.digitalAssetRef, resolution.id);

  const work = resolveKind(resolution.workRef, "work", byRef, `${resolution.id}.workRef`);
  const manifestation = resolveKind(
    resolution.manifestationRef,
    "source_manifestation",
    byRef,
    `${resolution.id}.manifestationRef`
  );
  if (!manifestation.workRelations.some(({ workRef }) => refKey(workRef) === refKey(work))) {
    throw new ReferenceSourceStagingIntegrityError(
      `Asset Identity Resolution ${resolution.id} manifestation does not represent its exact Work`
    );
  }
  const exemplars = resolveMany(
    resolution.exemplarRefs,
    "exemplar",
    byRef,
    `${resolution.id}.exemplarRefs`
  );
  assertDistinctRefs(resolution.exemplarRefs, `${resolution.id}.exemplarRefs`);
  if (
    exemplars.some(
      (exemplar) => !exemplar.manifestationRefs.some((ref) => refKey(ref) === refKey(manifestation))
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Asset Identity Resolution ${resolution.id} exemplar does not represent its exact manifestation`
    );
  }

  const allowedSubjects = new Set(
    [
      resolution.digitalAssetRef,
      ...resolution.acquisitionRefs,
      resolution.workRef,
      resolution.manifestationRef,
      ...resolution.exemplarRefs,
    ].map(refKey)
  );
  const assertions = resolveMany(
    resolution.identityAssertionRefs,
    "identity_assertion",
    byRef,
    `${resolution.id}.identityAssertionRefs`
  );
  assertDistinctRefs(resolution.identityAssertionRefs, `${resolution.id}.identityAssertionRefs`);
  if (
    assertions.some(
      (assertion) =>
        !allowedSubjects.has(refKey(assertion.subjectRef)) ||
        assertion.completeness !== "complete" ||
        assertion.assertedValue.kind === "unknown" ||
        assertion.assertionState === "rejected"
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Resolved Asset Identity ${resolution.id} contains incomplete, rejected, or unrelated assertions`
    );
  }
  if (
    resolution.reviewState === "reviewed" &&
    assertions.some(({ assertionState }) => assertionState !== "reviewed")
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reviewed Asset Identity Resolution ${resolution.id} contains an unreviewed assertion`
    );
  }
  if (
    resolution.reviewState === "candidate" &&
    assertions.some(({ assertionState }) => assertionState !== "candidate")
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Candidate Asset Identity Resolution ${resolution.id} contains a non-candidate assertion`
    );
  }
  if (
    resolution.reviewState === "disputed" &&
    assertions.every(({ assertionState }) => assertionState !== "disputed")
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Disputed Asset Identity Resolution ${resolution.id} contains no disputed assertion`
    );
  }
  assertOpaqueExternalRef(resolution.resolverRef, byRef, `${resolution.id}.resolverRef`);
  assertLocalOrOpaqueRefs(resolution.evidenceRefs, byRef, `${resolution.id}.evidenceRefs`);
  assertDistinctRefs(resolution.evidenceRefs, `${resolution.id}.evidenceRefs`);

  if (resolution.parentVersionRef) {
    const parent = resolveKind(
      resolution.parentVersionRef,
      "asset_identity_resolution",
      byRef,
      `${resolution.id}.parentVersionRef`
    );
    if (
      refKey(parent.digitalAssetRef) !== refKey(resolution.digitalAssetRef) ||
      !sameRefSet(parent.acquisitionRefs, resolution.acquisitionRefs)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Asset Identity Resolution ${resolution.id} successor changes its exact acquired bytes`
      );
    }
  }
}

function assertPageAtlasVersion(
  atlas: ReferencePageAtlasVersion,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  resolveKind(atlas.digitalAssetRef, "digital_asset", byRef, `${atlas.id}.digitalAssetRef`);
  const acquisitions = resolveMany(
    atlas.acquisitionRefs,
    "asset_acquisition",
    byRef,
    `${atlas.id}.acquisitionRefs`
  );
  assertDistinctRefs(atlas.acquisitionRefs, `${atlas.id}.acquisitionRefs`);
  assertAcquisitionsDescribeAsset(acquisitions, atlas.digitalAssetRef, atlas.id);
  assertLocalExtractionAccess(
    atlas.accessDecisionRef,
    atlas.digitalAssetRef,
    atlas.acquisitionRefs,
    atlas.createdAt,
    byRef,
    atlas.id
  );
  assertOpaqueExternalRef(atlas.componentRef, byRef, `${atlas.id}.componentRef`);
  assertOpaqueExternalRef(atlas.resourcePolicyRef, byRef, `${atlas.id}.resourcePolicyRef`);

  const processed = expandPageRanges(
    atlas.processedScanRanges,
    atlas.canvasCount,
    `${atlas.id}.processedScanRanges`
  );
  const unprocessed = expandPageRanges(
    atlas.unprocessedScanRanges,
    atlas.canvasCount,
    `${atlas.id}.unprocessedScanRanges`
  );
  if ([...processed].some((value) => unprocessed.has(value))) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas ${atlas.id} processed and unprocessed ranges overlap`
    );
  }
  if (processed.size + unprocessed.size !== atlas.canvasCount) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas ${atlas.id} ranges do not account for every declared canvas`
    );
  }
  for (let scanOrder = 1; scanOrder <= atlas.canvasCount; scanOrder += 1) {
    if (!processed.has(scanOrder) && !unprocessed.has(scanOrder)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Page Atlas ${atlas.id} leaves scan order ${scanOrder} implicit`
      );
    }
  }
  if (
    (atlas.coverage === "complete" && unprocessed.size !== 0) ||
    (atlas.coverage === "partial" && unprocessed.size === 0)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas ${atlas.id} coverage contradicts its explicit unprocessed ranges`
    );
  }
  if (atlas.canvases.length !== processed.size) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas ${atlas.id} must contain exactly one canvas for each processed scan order`
    );
  }

  const canvasIds = new Set<string>();
  const scanOrders = new Set<number>();
  const scanLocators = new Set<string>();
  const locatorKeys = new Set<string>();
  for (const canvas of atlas.canvases) {
    if (
      canvasIds.has(canvas.canvasId) ||
      scanOrders.has(canvas.scanOrder) ||
      scanLocators.has(canvas.scanLocator) ||
      !processed.has(canvas.scanOrder)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Page Atlas ${atlas.id} contains a duplicate or unprocessed canvas identity`
      );
    }
    canvasIds.add(canvas.canvasId);
    scanOrders.add(canvas.scanOrder);
    scanLocators.add(canvas.scanLocator);
    assertUniqueStrings(canvas.conditions, `${atlas.id}.${canvas.canvasId}.conditions`);
    if (
      (canvas.conditions.includes("missing") || canvas.conditions.includes("blank")) &&
      canvas.regions.length !== 0
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Page Atlas ${atlas.id} missing or blank canvas cannot contain detected regions`
      );
    }
    const regionIds = new Set<string>();
    for (const region of canvas.regions) {
      if (regionIds.has(region.id)) {
        throw new ReferenceSourceStagingIntegrityError(
          `Page Atlas ${atlas.id} repeats region ${region.id} on canvas ${canvas.canvasId}`
        );
      }
      regionIds.add(region.id);
      assertRegionWithinCanvas(region, canvas, `${atlas.id}.${canvas.canvasId}.${region.id}`);
    }
    for (const locator of canvas.locators) {
      if (locator.side && locator.kind !== "folio") {
        throw new ReferenceSourceStagingIntegrityError(
          `Page Atlas ${atlas.id} uses recto/verso on a non-folio locator`
        );
      }
      const key = [
        locator.kind,
        locator.sequenceId,
        locator.label,
        locator.ordinal ?? "",
        locator.side ?? "",
      ].join("\u0000");
      if (locatorKeys.has(key)) {
        throw new ReferenceSourceStagingIntegrityError(
          `Page Atlas ${atlas.id} contains an ambiguous duplicate page locator`
        );
      }
      locatorKeys.add(key);
    }
  }

  if (atlas.parentVersionRef) {
    const parent = resolveKind(
      atlas.parentVersionRef,
      "page_atlas_version",
      byRef,
      `${atlas.id}.parentVersionRef`
    );
    if (
      refKey(parent.digitalAssetRef) !== refKey(atlas.digitalAssetRef) ||
      !sameRefSet(parent.acquisitionRefs, atlas.acquisitionRefs)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Page Atlas ${atlas.id} successor changes its exact acquired bytes`
      );
    }
  }
}

function assertAcquisitionsDescribeAsset(
  acquisitions: ReferenceAssetAcquisition[],
  digitalAssetRef: ReferenceRecordRef,
  label: string
): void {
  if (
    acquisitions.some(
      (acquisition) => refKey(acquisition.digitalAssetRef) !== refKey(digitalAssetRef)
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} names an acquisition for different bytes`
    );
  }
}

function assertLocalExtractionAccess(
  accessDecisionRef: ReferenceRecordRef,
  _digitalAssetRef: ReferenceRecordRef,
  acquisitionRefs: ReferenceRecordRef[],
  effectiveAt: string,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): ReferenceAccessDecision {
  const decision = resolveKind(
    accessDecisionRef,
    "access_decision",
    byRef,
    `${label}.accessDecisionRef`
  );
  const rights = decision.rightsAssertionRefs.map((ref) =>
    resolveKind(ref, "rights_assertion", byRef, `${label}.accessDecisionRef.rightsAssertionRefs`)
  );
  if (
    decision.outcome !== "allow" ||
    decision.operation !== "local_extraction" ||
    decision.destination.kind !== "local_runtime" ||
    decision.destination.id !== undefined ||
    decision.assetRole !== undefined ||
    !sameRefSet(decision.sourceRefs, acquisitionRefs) ||
    decision.derivativeRefs.length !== 0 ||
    decision.purpose.trim().length === 0 ||
    !refsEqual(decision.policyRef, OWNER_LOCAL_EXTRACTION_POLICY_REF) ||
    decision.authorityRefs.length !== 1 ||
    !refsEqual(decision.authorityRefs[0]!, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF) ||
    rights.length !== acquisitionRefs.length ||
    rights.some(
      (assertion) =>
        assertion.subjectKind !== "asset_acquisition" ||
        !acquisitionRefs.some((ref) => refsEqual(ref, assertion.subjectRef)) ||
        assertion.rightsKind !== "local_extraction" ||
        assertion.status !== "permitted" ||
        assertion.claimant.kind !== "owner" ||
        !refsEqual(assertion.claimant.claimantRef, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF)
    ) ||
    Date.parse(decision.decidedAt) > Date.parse(effectiveAt) ||
    (decision.validUntil !== undefined &&
      Date.parse(decision.validUntil) <= Date.parse(effectiveAt))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} lacks an exact current local-extraction allow decision`
    );
  }
  return decision;
}

function assertPageAtlasAttempt(
  attempt: ReferencePageAtlasAttempt,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  resolveKind(attempt.digitalAssetRef, "digital_asset", byRef, `${attempt.id}.digitalAssetRef`);
  const acquisitions = resolveMany(
    attempt.acquisitionRefs,
    "asset_acquisition",
    byRef,
    `${attempt.id}.acquisitionRefs`
  );
  assertDistinctRefs(attempt.acquisitionRefs, `${attempt.id}.acquisitionRefs`);
  assertAcquisitionsDescribeAsset(acquisitions, attempt.digitalAssetRef, attempt.id);
  assertLocalExtractionAccess(
    attempt.accessDecisionRef,
    attempt.digitalAssetRef,
    attempt.acquisitionRefs,
    attempt.startedAt,
    byRef,
    attempt.id
  );
  assertOpaqueExternalRef(attempt.componentRef, byRef, `${attempt.id}.componentRef`);
  assertOpaqueExternalRef(attempt.resourcePolicyRef, byRef, `${attempt.id}.resourcePolicyRef`);
  assertLocalOrOpaqueRefs(
    attempt.redactedDiagnosticRefs,
    byRef,
    `${attempt.id}.redactedDiagnosticRefs`
  );
  assertDistinctRefs(attempt.redactedDiagnosticRefs, `${attempt.id}.redactedDiagnosticRefs`);
  if (Date.parse(attempt.endedAt) < Date.parse(attempt.startedAt)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} ends before it starts`
    );
  }

  const expectedFailureCode: Record<ReferencePageAtlasAttempt["status"], string[] | undefined> = {
    completed: undefined,
    interrupted: ["interrupted"],
    cancelled: ["cancelled"],
    resource_exhausted: ["resource_limit"],
    failed: ["parser_failure", "malformed_asset", "unsupported_asset"],
  };
  const allowedCodes = expectedFailureCode[attempt.status];
  if (
    (allowedCodes === undefined && attempt.failureCode !== undefined) ||
    (allowedCodes !== undefined &&
      (attempt.failureCode === undefined || !allowedCodes.includes(attempt.failureCode)))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} status and failure code disagree`
    );
  }

  const basis = attempt.basisAtlasRef
    ? resolveKind(attempt.basisAtlasRef, "page_atlas_version", byRef, `${attempt.id}.basisAtlasRef`)
    : undefined;
  const output = attempt.outputAtlasRef
    ? resolveKind(
        attempt.outputAtlasRef,
        "page_atlas_version",
        byRef,
        `${attempt.id}.outputAtlasRef`
      )
    : undefined;
  if (
    (attempt.attemptKind === "initial" && basis !== undefined) ||
    (attempt.attemptKind !== "initial" && basis === undefined)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} has an invalid ${attempt.attemptKind} basis`
    );
  }
  if (attempt.attemptKind === "resume" && basis?.coverage !== "partial") {
    throw new ReferenceSourceStagingIntegrityError(
      `Resumed Page Atlas Attempt ${attempt.id} must begin from partial coverage`
    );
  }
  if (basis && Date.parse(basis.createdAt) > Date.parse(attempt.startedAt)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} begins before its exact basis exists`
    );
  }
  const interruptedBeforeFirstAtlas =
    attempt.status === "interrupted" &&
    attempt.attemptKind === "initial" &&
    basis === undefined &&
    output === undefined;
  if (
    (attempt.status === "completed" || attempt.status === "interrupted") &&
    output === undefined &&
    !interruptedBeforeFirstAtlas
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} must retain its bounded output`
    );
  }
  // `completed` describes this bounded attempt, not necessarily the entire
  // source. A successful attempt may deliberately stop at a partial atlas and
  // be resumed later. Failed, interrupted, cancelled, and exhausted attempts
  // may retain partial progress, but must never claim complete coverage.
  if (attempt.status !== "completed" && output !== undefined && output.coverage !== "partial") {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} status contradicts output coverage`
    );
  }
  if (basis) assertAtlasAttemptIdentity(attempt, basis, "basis");
  if (output) {
    assertAtlasAttemptIdentity(attempt, output, "output");
    if (
      Date.parse(output.createdAt) < Date.parse(attempt.startedAt) ||
      Date.parse(output.createdAt) > Date.parse(attempt.endedAt)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Page Atlas Attempt ${attempt.id} output falls outside its execution interval`
      );
    }
    if (
      (basis === undefined && output.parentVersionRef !== undefined) ||
      (basis !== undefined &&
        (output.parentVersionRef === undefined ||
          refKey(output.parentVersionRef) !== refKey(basis) ||
          output.parentVersionRef.version !== basis.version))
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Page Atlas Attempt ${attempt.id} output does not descend from its exact basis`
      );
    }
  }
}

function assertAtlasAttemptIdentity(
  attempt: ReferencePageAtlasAttempt,
  atlas: ReferencePageAtlasVersion,
  role: "basis" | "output"
): void {
  if (
    refKey(atlas.digitalAssetRef) !== refKey(attempt.digitalAssetRef) ||
    !sameRefSet(atlas.acquisitionRefs, attempt.acquisitionRefs) ||
    refKey(atlas.accessDecisionRef) !== refKey(attempt.accessDecisionRef) ||
    refKey(atlas.componentRef) !== refKey(attempt.componentRef) ||
    atlas.configurationDigest !== attempt.configurationDigest ||
    refKey(atlas.resourcePolicyRef) !== refKey(attempt.resourcePolicyRef)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Attempt ${attempt.id} ${role} changes its exact source or execution identity`
    );
  }
}

function assertPageAtlasCorrection(
  correction: ReferencePageAtlasCorrection,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const prior = resolveKind(
    correction.priorAtlasRef,
    "page_atlas_version",
    byRef,
    `${correction.id}.priorAtlasRef`
  );
  const successor = resolveKind(
    correction.successorAtlasRef,
    "page_atlas_version",
    byRef,
    `${correction.id}.successorAtlasRef`
  );
  if (
    successor.parentVersionRef === undefined ||
    refKey(successor.parentVersionRef) !== refKey(prior) ||
    successor.parentVersionRef.version !== prior.version ||
    refKey(successor.digitalAssetRef) !== refKey(prior.digitalAssetRef) ||
    !sameRefSet(successor.acquisitionRefs, prior.acquisitionRefs)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Correction ${correction.id} does not name one exact successor lineage`
    );
  }
  if (
    refKey(successor.accessDecisionRef) !== refKey(prior.accessDecisionRef) ||
    refKey(successor.componentRef) !== refKey(prior.componentRef) ||
    successor.configurationDigest !== prior.configurationDigest ||
    refKey(successor.resourcePolicyRef) !== refKey(prior.resourcePolicyRef) ||
    successor.coverage !== prior.coverage ||
    successor.canvasCount !== prior.canvasCount ||
    referenceSourceDigest(successor.processedScanRanges) !==
      referenceSourceDigest(prior.processedScanRanges) ||
    referenceSourceDigest(successor.unprocessedScanRanges) !==
      referenceSourceDigest(prior.unprocessedScanRanges)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Correction ${correction.id} changes execution identity or coverage instead of canvas facts`
    );
  }
  assertUniqueStrings(correction.changedCanvasIds, `${correction.id}.changedCanvasIds`);
  const priorCanvases = new Map(prior.canvases.map((canvas) => [canvas.canvasId, canvas]));
  const successorCanvases = new Map(successor.canvases.map((canvas) => [canvas.canvasId, canvas]));
  if (
    priorCanvases.size !== successorCanvases.size ||
    [...priorCanvases.keys()].some((id) => !successorCanvases.has(id))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Correction ${correction.id} cannot add or remove canvases`
    );
  }
  const actualChanges = [...priorCanvases.entries()]
    .filter(
      ([id, canvas]) =>
        referenceSourceDigest(canvas) !== referenceSourceDigest(successorCanvases.get(id)!)
    )
    .map(([id]) => id);
  if (!sameStrings(correction.changedCanvasIds, actualChanges)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Correction ${correction.id} must enumerate exactly its changed canvases`
    );
  }
  assertLocalOrOpaqueRefs(correction.evidenceRefs, byRef, `${correction.id}.evidenceRefs`);
  assertDistinctRefs(correction.evidenceRefs, `${correction.id}.evidenceRefs`);
  assertOpaqueExternalRef(correction.correctedByRef, byRef, `${correction.id}.correctedByRef`);
  if (
    Date.parse(correction.correctedAt) < Date.parse(prior.createdAt) ||
    Date.parse(correction.correctedAt) < Date.parse(successor.createdAt)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Page Atlas Correction ${correction.id} predates its atlas lineage`
    );
  }
}

function assertDerivativeArtifact(
  artifact: ReferenceDerivativeArtifact,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  resolveKind(artifact.digitalAssetRef, "digital_asset", byRef, `${artifact.id}.digitalAssetRef`);
  const acquisitions = resolveMany(
    artifact.acquisitionRefs,
    "asset_acquisition",
    byRef,
    `${artifact.id}.acquisitionRefs`
  );
  assertDistinctRefs(artifact.acquisitionRefs, `${artifact.id}.acquisitionRefs`);
  assertAcquisitionsDescribeAsset(acquisitions, artifact.digitalAssetRef, artifact.id);
  const atlas = resolveKind(
    artifact.pageAtlasRef,
    "page_atlas_version",
    byRef,
    `${artifact.id}.pageAtlasRef`
  );
  if (
    refKey(atlas.digitalAssetRef) !== refKey(artifact.digitalAssetRef) ||
    !sameRefSet(atlas.acquisitionRefs, artifact.acquisitionRefs)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference Derivative ${artifact.id} changes its exact source acquisition`
    );
  }
  const canvas = requireAtlasCanvas(atlas, artifact.canvasId, artifact.id);
  if ((artifact.artifactKind === "crop") !== (artifact.region !== undefined)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference Derivative ${artifact.id} crop geometry and artifact kind disagree`
    );
  }
  if (artifact.region) assertRegionWithinCanvas(artifact.region, canvas, `${artifact.id}.region`);
  if (
    artifact.artifactKind === "page_image" &&
    (artifact.widthPixels !== canvas.widthPixels || artifact.heightPixels !== canvas.heightPixels)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference Derivative ${artifact.id} full-page dimensions do not match its canvas`
    );
  }
  if (Date.parse(artifact.createdAt) < Date.parse(atlas.createdAt)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference Derivative ${artifact.id} predates its Page Atlas`
    );
  }
}

function assertModernSourceSegment(
  segment: ReferenceSourceSegmentVersion,
  atlas: ReferencePageAtlasVersion,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  if (
    refKey(segment.digitalAssetRef) !== refKey(atlas.digitalAssetRef) ||
    !sameRefSet(segment.acquisitionRefs, atlas.acquisitionRefs)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Source Segment Version ${segment.id} changes its Page Atlas source acquisition`
    );
  }
  assertDistinctRefs(segment.acquisitionRefs, `${segment.id}.acquisitionRefs`);
  const canvas = requireAtlasCanvas(atlas, segment.canvasId, segment.id);
  if (
    segment.scanLocator !== canvas.scanLocator ||
    segment.coordinateSystem !== canvas.coordinateSystem
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Source Segment Version ${segment.id} does not preserve its exact canvas locator system`
    );
  }
  if (
    segment.printedLocator !== undefined &&
    !canvas.locators.some(
      (locator) => locator.label === segment.printedLocator && locator.kind !== "internal_sequence"
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Source Segment Version ${segment.id} printed locator is absent from its Page Atlas canvas`
    );
  }
  assertUniqueStrings(
    segment.regions.map(({ id }) => id),
    `${segment.id}.regions`
  );
  const atlasRegions = new Map(canvas.regions.map((region) => [region.id, region]));
  for (const region of segment.regions) {
    const atlasRegion = atlasRegions.get(region.id);
    if (
      !atlasRegion ||
      region.x !== atlasRegion.x ||
      region.y !== atlasRegion.y ||
      region.width !== atlasRegion.width ||
      region.height !== atlasRegion.height ||
      region.unit !== atlasRegion.unit
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Source Segment Version ${segment.id} region ${region.id} does not resolve exact atlas geometry`
      );
    }
    if (
      segment.modality !== "mixed" &&
      atlasRegion.modality !== "mixed" &&
      atlasRegion.modality !== segment.modality
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Source Segment Version ${segment.id} modality contradicts atlas region ${region.id}`
      );
    }
  }
  if (
    segment.regionTransforms.length !== 0 &&
    segment.regionTransforms.length !== segment.regions.length
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Source Segment Version ${segment.id} must bind transforms one-to-one with its regions`
    );
  }
  if (
    segment.regionTransforms.some(({ matrix }) => matrix.some((value) => !Number.isFinite(value)))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Source Segment Version ${segment.id} contains a non-finite region transform`
    );
  }

  const sourceImage = resolveRecord(segment.sourceImageRef, byRef, `${segment.id}.sourceImageRef`);
  if (sourceImage.recordKind === "digital_asset") {
    if (refKey(sourceImage) !== refKey(segment.digitalAssetRef)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Source Segment Version ${segment.id} source image is not its original Digital Asset`
      );
    }
  } else if (sourceImage.recordKind === "reference_derivative_artifact") {
    if (
      refKey(sourceImage.pageAtlasRef) !== refKey(atlas) ||
      sourceImage.canvasId !== segment.canvasId ||
      refKey(sourceImage.digitalAssetRef) !== refKey(segment.digitalAssetRef) ||
      !sameRefSet(sourceImage.acquisitionRefs, segment.acquisitionRefs) ||
      sourceImage.sha256 !== segment.cropDigest
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Source Segment Version ${segment.id} source image does not preserve its exact atlas crop`
      );
    }
  } else {
    throw new ReferenceSourceStagingIntegrityError(
      `Source Segment Version ${segment.id} sourceImageRef must resolve to original bytes or a protected image derivative`
    );
  }

  if (segment.parentVersionRef) {
    const parent = resolveKind(
      segment.parentVersionRef,
      "source_segment_version",
      byRef,
      `${segment.id}.parentVersionRef`
    );
    if (
      refKey(parent.digitalAssetRef) !== refKey(segment.digitalAssetRef) ||
      !sameRefSet(parent.acquisitionRefs, segment.acquisitionRefs)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Source Segment Version ${segment.id} successor changes its exact acquired bytes`
      );
    }
  }
}

function assertCitedExtractionVersion(
  extraction: ReferenceCitedExtractionVersion,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const segments = resolveMany(
    extraction.sourceSegmentRefs,
    "source_segment_version",
    byRef,
    `${extraction.id}.sourceSegmentRefs`
  );
  assertDistinctRefs(extraction.sourceSegmentRefs, `${extraction.id}.sourceSegmentRefs`);
  if (
    segments.some(
      (segment) => byRef.get(refKey(segment.pageAtlasRef))?.recordKind !== "page_atlas_version"
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Cited Extraction ${extraction.id} must resolve every segment through a protected local Page Atlas`
    );
  }
  const decisions = resolveMany(
    extraction.accessDecisionRefs,
    "access_decision",
    byRef,
    `${extraction.id}.accessDecisionRefs`
  );
  assertDistinctRefs(extraction.accessDecisionRefs, `${extraction.id}.accessDecisionRefs`);
  for (const decision of decisions) {
    assertLocalExtractionAccess(
      refFor(decision),
      segments[0]!.digitalAssetRef,
      decision.sourceRefs,
      extraction.createdAt,
      byRef,
      extraction.id
    );
  }
  const acquisitionRefs = uniqueRefs(segments.flatMap(({ acquisitionRefs: refs }) => refs));
  if (
    decisions.some(
      (decision) =>
        decision.outcome !== "allow" ||
        decision.operation !== "local_extraction" ||
        decision.destination.kind !== "local_runtime" ||
        decision.destination.id !== undefined ||
        Date.parse(decision.decidedAt) > Date.parse(extraction.createdAt) ||
        (decision.validUntil !== undefined &&
          Date.parse(decision.validUntil) <= Date.parse(extraction.createdAt))
    ) ||
    !sameRefSet(uniqueRefs(decisions.flatMap(({ sourceRefs }) => sourceRefs)), acquisitionRefs)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Cited Extraction ${extraction.id} lacks exact current local-extraction coverage`
    );
  }
  assertOpaqueExternalRef(extraction.componentRef, byRef, `${extraction.id}.componentRef`);

  assertUniqueStrings(
    extraction.anchors.map(({ id }) => id),
    `${extraction.id}.anchors`
  );
  const anchorKinds = new Set(extraction.anchors.map(({ kind }) => kind));
  if (!anchorKinds.has("image") || !anchorKinds.has("text") || !anchorKinds.has("notation")) {
    throw new ReferenceSourceStagingIntegrityError(
      `Cited Extraction ${extraction.id} requires image, text, and notation anchors`
    );
  }
  const segmentByRef = new Map(segments.map((segment) => [refKey(segment), segment]));
  const tokenIds = new Set(extraction.notationTokens.map(({ id }) => id));
  if (tokenIds.size !== extraction.notationTokens.length) {
    throw new ReferenceSourceStagingIntegrityError(
      `Cited Extraction ${extraction.id} repeats a notation token identity`
    );
  }
  for (const anchor of extraction.anchors) {
    const segment = segmentByRef.get(refKey(anchor.sourceSegmentRef));
    if (!segment) {
      throw new ReferenceSourceStagingIntegrityError(
        `Cited Extraction ${extraction.id} anchor ${anchor.id} names an undeclared segment`
      );
    }
    const segmentRegionIds = new Set(segment.regions.map(({ id }) => id));
    assertUniqueStrings(anchor.regionIds, `${extraction.id}.${anchor.id}.regionIds`);
    if (anchor.regionIds.some((id) => !segmentRegionIds.has(id))) {
      throw new ReferenceSourceStagingIntegrityError(
        `Cited Extraction ${extraction.id} anchor ${anchor.id} does not resolve exact segment geometry`
      );
    }
    const atlas = resolveKind(
      segment.pageAtlasRef,
      "page_atlas_version",
      byRef,
      `${extraction.id}.${anchor.id}.pageAtlasRef`
    );
    const canvas = requireAtlasCanvas(atlas, segment.canvasId, `${extraction.id}.${anchor.id}`);
    const compatibleModalities = new Set([anchor.kind, "mixed"]);
    if (
      anchor.regionIds.some((id) => {
        const region = canvas.regions.find((candidate) => candidate.id === id);
        return !region || !compatibleModalities.has(region.modality);
      })
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Cited Extraction ${extraction.id} anchor ${anchor.id} contradicts its atlas-region modality`
      );
    }
    if (
      anchor.kind === "text" &&
      anchor.characterRange !== undefined &&
      (anchor.characterRange.start >= anchor.characterRange.end ||
        anchor.characterRange.end > extraction.originalTranscription.length)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Cited Extraction ${extraction.id} text anchor ${anchor.id} exceeds its original transcription`
      );
    }
    if (anchor.kind === "notation") {
      assertUniqueStrings(anchor.tokenIds, `${extraction.id}.${anchor.id}.tokenIds`);
      if (anchor.tokenIds.some((id) => !tokenIds.has(id))) {
        throw new ReferenceSourceStagingIntegrityError(
          `Cited Extraction ${extraction.id} notation anchor ${anchor.id} names an unknown token`
        );
      }
    }
  }

  const referencedNotationTokens = new Set(
    extraction.anchors.flatMap((anchor) => (anchor.kind === "notation" ? anchor.tokenIds : []))
  );
  if (
    referencedNotationTokens.size !== tokenIds.size ||
    [...tokenIds].some((id) => !referencedNotationTokens.has(id))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Cited Extraction ${extraction.id} must cite every notation token exactly by anchor membership`
    );
  }
  const allSegmentRegions = segments.flatMap((segment) =>
    segment.regions.map((region) => ({ segment, region }))
  );
  for (const token of extraction.notationTokens) {
    const matches = allSegmentRegions.filter(({ region }) => region.id === token.regionId);
    if (matches.length !== 1) {
      throw new ReferenceSourceStagingIntegrityError(
        `Cited Extraction ${extraction.id} token ${token.id} has ambiguous or missing geometry`
      );
    }
  }
  for (const [dimension, confidence] of Object.entries(extraction.confidence)) {
    if (confidence.kind !== "assessed") continue;
    assertLocalOrOpaqueRefs(
      confidence.evidenceRefs,
      byRef,
      `${extraction.id}.confidence.${dimension}.evidenceRefs`
    );
    assertDistinctRefs(
      confidence.evidenceRefs,
      `${extraction.id}.confidence.${dimension}.evidenceRefs`
    );
  }
}

function assertExtractionProposal(
  proposal: ReferenceExtractionProposal,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const extraction = resolveKind(
    proposal.citedExtractionRef,
    "cited_extraction_version",
    byRef,
    `${proposal.id}.citedExtractionRef`
  );
  const courseTokens = extraction.notationTokens.filter(
    (token): token is typeof token & { course: number } => token.course !== undefined
  );
  const expectedCourses = [7, 8, 9, 10, 11, 12];
  const expectedSymbols = ["a", "/a", "//a", "///a", "4", "5"];
  if (
    courseTokens.length !== expectedCourses.length ||
    courseTokens.some(
      (token, index) =>
        token.course !== expectedCourses[index] || token.value !== expectedSymbols[index]
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Extraction Proposal ${proposal.id} is not grounded in the exact cited twelve-course sequence`
    );
  }
  if (proposal.proposal.kind === "twelve_course_diapason_mapping") {
    if (
      proposal.proposal.courses.some((course, index) => course !== expectedCourses[index]) ||
      proposal.proposal.symbols.some((symbol, index) => symbol !== expectedSymbols[index])
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Extraction Proposal ${proposal.id} changes the exact cited twelve-course mapping`
      );
    }
  } else if (courseTokens.some(({ course }) => course === 13)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Extraction Proposal ${proposal.id} cannot answer course thirteen by extrapolation`
    );
  }
  if (proposal.parentVersionRef) {
    const parent = resolveKind(
      proposal.parentVersionRef,
      "extraction_proposal",
      byRef,
      `${proposal.id}.parentVersionRef`
    );
    if (
      parent.scope.instrument !== proposal.scope.instrument ||
      parent.scope.notationSystem !== proposal.scope.notationSystem ||
      parent.scope.sourceCourseCount !== proposal.scope.sourceCourseCount ||
      parent.proposal.kind !== proposal.proposal.kind
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Extraction Proposal ${proposal.id} successor changes its bounded research question`
      );
    }
  }
}

function assertCitationSuccessor(
  mapping: ReferenceCitationSuccessor,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const correction = resolveKind(
    mapping.atlasCorrectionRef,
    "page_atlas_correction",
    byRef,
    `${mapping.id}.atlasCorrectionRef`
  );
  const priorSegment = resolveKind(
    mapping.priorSegmentRef,
    "source_segment_version",
    byRef,
    `${mapping.id}.priorSegmentRef`
  );
  const successorSegment = resolveKind(
    mapping.successorSegmentRef,
    "source_segment_version",
    byRef,
    `${mapping.id}.successorSegmentRef`
  );
  if (
    successorSegment.parentVersionRef === undefined ||
    refKey(successorSegment.parentVersionRef) !== refKey(priorSegment) ||
    successorSegment.parentVersionRef.version !== priorSegment.version ||
    !atlasLineagePreservesCitedCanvas(priorSegment, correction.priorAtlasRef, byRef) ||
    refKey(successorSegment.pageAtlasRef) !== refKey(correction.successorAtlasRef)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Citation Successor ${mapping.id} does not follow its exact corrected atlas segment lineage`
    );
  }
  assertDistinctRefs(mapping.priorCitedExtractionRefs, `${mapping.id}.priorCitedExtractionRefs`);
  assertDistinctRefs(
    mapping.successorCitedExtractionRefs,
    `${mapping.id}.successorCitedExtractionRefs`
  );
  const priorExtractions = resolveMany(
    mapping.priorCitedExtractionRefs,
    "cited_extraction_version",
    byRef,
    `${mapping.id}.priorCitedExtractionRefs`
  );
  const successorExtractions = resolveMany(
    mapping.successorCitedExtractionRefs,
    "cited_extraction_version",
    byRef,
    `${mapping.id}.successorCitedExtractionRefs`
  );
  if (
    priorExtractions.some(
      (extraction) =>
        !extraction.sourceSegmentRefs.some((ref) => refKey(ref) === refKey(priorSegment))
    ) ||
    successorExtractions.some(
      (extraction) =>
        !extraction.sourceSegmentRefs.some((ref) => refKey(ref) === refKey(successorSegment))
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Citation Successor ${mapping.id} extraction refs do not cite their exact segment side`
    );
  }

  switch (mapping.extractionTransition) {
    case "not_applicable":
      if (
        priorExtractions.length !== 0 ||
        successorExtractions.length !== 0 ||
        priorSegment.modality !== "image" ||
        successorSegment.modality !== "image"
      ) {
        throw new ReferenceSourceStagingIntegrityError(
          `Citation Successor ${mapping.id} has an invalid not-applicable extraction transition`
        );
      }
      break;
    case "reextraction_required":
      if (
        priorExtractions.length === 0 ||
        successorExtractions.length !== 0 ||
        successorSegment.modality !== "image"
      ) {
        throw new ReferenceSourceStagingIntegrityError(
          `Citation Successor ${mapping.id} has an invalid re-extraction-required transition`
        );
      }
      break;
    case "reextracted":
      if (
        priorExtractions.length !== 0 ||
        successorExtractions.length === 0 ||
        priorSegment.modality !== "image" ||
        successorExtractions.some((successor) => {
          if (!successor.parentVersionRef) return true;
          const parent = resolveKind(
            successor.parentVersionRef,
            "cited_extraction_version",
            byRef,
            `${mapping.id}.successorCitedExtractionRefs.parentVersionRef`
          );
          return parent.sourceSegmentRefs.some(
            (segmentRef) => !segmentIsAncestorOf(segmentRef, priorSegment, byRef)
          );
        })
      ) {
        throw new ReferenceSourceStagingIntegrityError(
          `Citation Successor ${mapping.id} has an invalid re-extracted transition`
        );
      }
      break;
    case "mapped_successor":
      if (
        priorExtractions.length === 0 ||
        priorExtractions.length !== successorExtractions.length
      ) {
        throw new ReferenceSourceStagingIntegrityError(
          `Citation Successor ${mapping.id} requires one mapped successor per prior extraction`
        );
      }
      for (let index = 0; index < priorExtractions.length; index += 1) {
        const prior = priorExtractions[index]!;
        const successor = successorExtractions[index]!;
        const expectedSuccessorSegments = prior.sourceSegmentRefs.map((ref) =>
          refKey(ref) === refKey(priorSegment) ? refFor(successorSegment) : ref
        );
        if (
          successor.parentVersionRef === undefined ||
          refKey(successor.parentVersionRef) !== refKey(prior) ||
          successor.parentVersionRef.version !== prior.version ||
          !sameRefSet(successor.sourceSegmentRefs, expectedSuccessorSegments)
        ) {
          throw new ReferenceSourceStagingIntegrityError(
            `Citation Successor ${mapping.id} does not preserve one exact extraction lineage`
          );
        }
      }
      break;
  }
  if (Date.parse(mapping.createdAt) < Date.parse(correction.correctedAt)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Citation Successor ${mapping.id} predates its Page Atlas correction`
    );
  }
}

function segmentIsAncestorOf(
  candidateRef: ReferenceRecordRef,
  descendant: ReferenceSourceSegmentVersion,
  byRef: Map<string, ReferenceSourceStagingRecord>
): boolean {
  let cursor: ReferenceSourceSegmentVersion = descendant;
  while (true) {
    if (refKey(cursor) === refKey(candidateRef)) return true;
    if (!cursor.parentVersionRef) return false;
    cursor = resolveKind(
      cursor.parentVersionRef,
      "source_segment_version",
      byRef,
      `${descendant.id}.ancestorSegmentRef`
    );
  }
}

function atlasLineagePreservesCitedCanvas(
  segment: ReferenceSourceSegmentVersion,
  descendantAtlasRef: ReferenceRecordRef,
  byRef: Map<string, ReferenceSourceStagingRecord>
): boolean {
  let descendant = resolveKind(
    descendantAtlasRef,
    "page_atlas_version",
    byRef,
    `${segment.id}.citationAtlasLineage`
  );
  while (refKey(descendant) !== refKey(segment.pageAtlasRef)) {
    if (!descendant.parentVersionRef) return false;
    const parent = resolveKind(
      descendant.parentVersionRef,
      "page_atlas_version",
      byRef,
      `${segment.id}.citationAtlasLineage.parentVersionRef`
    );
    const descendantCanvas = descendant.canvases.find(
      ({ canvasId }) => canvasId === segment.canvasId
    );
    const parentCanvas = parent.canvases.find(({ canvasId }) => canvasId === segment.canvasId);
    if (
      !descendantCanvas ||
      !parentCanvas ||
      referenceSourceDigest(descendantCanvas) !== referenceSourceDigest(parentCanvas)
    ) {
      return false;
    }
    descendant = parent;
  }
  return true;
}

function requireAtlasCanvas(
  atlas: ReferencePageAtlasVersion,
  canvasId: string,
  label: string
): ReferencePageAtlasVersion["canvases"][number] {
  const canvas = atlas.canvases.find((candidate) => candidate.canvasId === canvasId);
  if (!canvas) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} cannot resolve canvas ${canvasId} in its exact Page Atlas`
    );
  }
  return canvas;
}

function expandPageRanges(
  ranges: Array<{ start: number; end: number }>,
  canvasCount: number,
  label: string
): Set<number> {
  const values = new Set<number>();
  let priorEnd = 0;
  for (const range of ranges) {
    if (range.start > range.end || range.end > canvasCount || range.start <= priorEnd) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source ${label} must be ordered, disjoint, and within the canvas count`
      );
    }
    for (let value = range.start; value <= range.end; value += 1) values.add(value);
    priorEnd = range.end;
  }
  return values;
}

function assertRegionWithinCanvas(
  region: { x: number; y: number; width: number; height: number; unit: "pixel" | "normalized" },
  canvas: { widthPixels: number; heightPixels: number },
  label: string
): void {
  if (
    ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width <= 0 ||
    region.height <= 0
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source region ${label} has invalid geometry`
    );
  }
  const maximumX = region.unit === "normalized" ? 1 : canvas.widthPixels;
  const maximumY = region.unit === "normalized" ? 1 : canvas.heightPixels;
  if (region.x + region.width > maximumX || region.y + region.height > maximumY) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source region ${label} extends beyond its exact canvas`
    );
  }
}

function assertIdentityLineage(
  assertion: ReferenceSourceIdentityAssertion,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  if (
    (assertion.composition === "atomic" && assertion.componentAssertionRefs.length !== 0) ||
    (assertion.composition === "composite" && assertion.componentAssertionRefs.length === 0)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Identity Assertion ${assertion.id} has contradictory composition semantics`
    );
  }
  for (const componentRef of assertion.componentAssertionRefs) {
    const component = resolveKind(
      componentRef,
      "identity_assertion",
      byRef,
      `${assertion.id}.componentAssertionRefs`
    );
    assertSameIdentitySubject(assertion, component, "component");
  }
  for (const conflictRef of assertion.conflictAssertionRefs) {
    const conflict = resolveKind(
      conflictRef,
      "identity_assertion",
      byRef,
      `${assertion.id}.conflictAssertionRefs`
    );
    assertSameIdentitySubject(assertion, conflict, "conflict");
    if (conflict.property !== assertion.property) {
      throw new ReferenceSourceStagingIntegrityError(
        `Identity Assertion ${assertion.id} conflicts with an assertion about another property`
      );
    }
  }
  if (!assertion.parentVersionRef) {
    if (
      assertion.version !== 1 ||
      assertion.successorRelationship !== "initial" ||
      assertion.predecessorAssertionRefs.length !== 0
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Initial Identity Assertion ${assertion.id} has contradictory lineage semantics`
      );
    }
    return;
  }
  const parent = resolveKind(
    assertion.parentVersionRef,
    "identity_assertion",
    byRef,
    `${assertion.id}.parentVersionRef`
  );
  assertSameIdentitySubject(assertion, parent, "parent");
  if (parent.property !== assertion.property) {
    throw new ReferenceSourceStagingIntegrityError(
      `Successor Identity Assertion ${assertion.id} changes the asserted property`
    );
  }
  if (
    assertion.successorRelationship === "initial" ||
    !assertion.predecessorAssertionRefs.some(
      (ref) =>
        ref.id === assertion.parentVersionRef!.id &&
        ref.digest === assertion.parentVersionRef!.digest
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Successor Identity Assertion ${assertion.id} must name its exact parent as a predecessor`
    );
  }
  for (const predecessorRef of assertion.predecessorAssertionRefs) {
    const predecessor = resolveKind(
      predecessorRef,
      "identity_assertion",
      byRef,
      `${assertion.id}.predecessorAssertionRefs`
    );
    assertSameIdentitySubject(assertion, predecessor, "predecessor");
    if (predecessor.property !== assertion.property) {
      throw new ReferenceSourceStagingIntegrityError(
        `Identity Assertion ${assertion.id} names a predecessor for another property`
      );
    }
  }
}

function assertSameIdentitySubject(
  assertion: ReferenceSourceIdentityAssertion,
  related: ReferenceSourceIdentityAssertion,
  relationship: string
): void {
  if (
    assertion.subjectKind !== related.subjectKind ||
    refKey(assertion.subjectRef) !== refKey(related.subjectRef)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Identity Assertion ${assertion.id} ${relationship} does not describe the same exact subject`
    );
  }
}

function assertIdentityAssertionsDescribe(
  subject: Extract<
    ReferenceSourceStagingRecord,
    { recordKind: "work" | "source_manifestation" | "exemplar" }
  >,
  assertionRefs: ReferenceRecordRef[],
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  for (const assertionRef of assertionRefs) {
    const assertion = resolveKind(
      assertionRef,
      "identity_assertion",
      byRef,
      `${subject.id}.identityAssertionRefs`
    );
    if (
      assertion.subjectKind !== subject.recordKind ||
      refKey(assertion.subjectRef) !== refKey(subject)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `${subject.recordKind} ${subject.id} links an Identity Assertion for another subject`
      );
    }
  }
}

function assertRightsSemantics(
  assertion: ReferenceRightsAssertion,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const constrainedSubjects: Partial<
    Record<
      ReferenceRightsAssertion["rightsKind"],
      readonly ReferenceRightsAssertion["subjectKind"][]
    >
  > = {
    underlying_work_status: ["work"],
    manifestation_editorial: ["source_manifestation"],
    translation: ["source_manifestation", "source_derivation"],
    exemplar_restriction: ["exemplar"],
    scan_provider_terms: ["digital_asset", "asset_acquisition"],
  };
  const allowedSubjects = constrainedSubjects[assertion.rightsKind];
  if (allowedSubjects && !allowedSubjects.includes(assertion.subjectKind)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Rights Assertion ${assertion.id} applies ${assertion.rightsKind} to incompatible subject kind ${assertion.subjectKind}`
    );
  }
  if (
    assertion.validFrom &&
    assertion.validUntil &&
    Date.parse(assertion.validFrom) > Date.parse(assertion.validUntil)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Rights Assertion ${assertion.id} has an inverted validity interval`
    );
  }
  if (assertion.parentVersionRef) {
    const parent = resolveKind(
      assertion.parentVersionRef,
      "rights_assertion",
      byRef,
      `${assertion.id}.parentVersionRef`
    );
    if (
      parent.subjectKind !== assertion.subjectKind ||
      refKey(parent.subjectRef) !== refKey(assertion.subjectRef) ||
      parent.rightsKind !== assertion.rightsKind
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Successor Rights Assertion ${assertion.id} changes its subject or rights kind`
      );
    }
  }
}

function assertAccessDecisionSemantics(
  decision: ReferenceAccessDecision,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  assertLocalOrOpaqueRefs(decision.sourceRefs, byRef, `${decision.id}.sourceRefs`);
  assertLocalOrOpaqueRefs(decision.derivativeRefs, byRef, `${decision.id}.derivativeRefs`);
  assertOpaqueExternalRef(decision.policyRef, byRef, `${decision.id}.policyRef`);
  assertOpaqueExternalRefs(decision.authorityRefs, byRef, `${decision.id}.authorityRefs`);
  assertAccessDestination(decision);
  const sourceKeys = new Set(decision.sourceRefs.map(refKey));
  const derivativeKeys = new Set(decision.derivativeRefs.map(refKey));
  if (
    sourceKeys.size !== decision.sourceRefs.length ||
    derivativeKeys.size !== decision.derivativeRefs.length ||
    [...sourceKeys].some((key) => derivativeKeys.has(key))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} requires disjoint, duplicate-free source and derivative sets`
    );
  }
  for (const sourceRef of decision.sourceRefs) {
    if (byRef.get(refKey(sourceRef))?.recordKind === "source_derivation") {
      throw new ReferenceSourceStagingIntegrityError(
        `Access Decision ${decision.id} places a derivation in sourceRefs`
      );
    }
  }
  for (const derivativeRef of decision.derivativeRefs) {
    const record = byRef.get(refKey(derivativeRef));
    const isAcquiredSourceAsset =
      record?.recordKind === "digital_asset" &&
      [...byRef.values()].some(
        (candidate) =>
          candidate.recordKind === "asset_acquisition" &&
          refKey(candidate.digitalAssetRef) === refKey(record)
      );
    if (record?.recordKind === "asset_acquisition" || isAcquiredSourceAsset) {
      throw new ReferenceSourceStagingIntegrityError(
        `Access Decision ${decision.id} places source identity in derivativeRefs`
      );
    }
  }

  if (decision.validUntil && Date.parse(decision.validUntil) <= Date.parse(decision.decidedAt)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} expires no later than its decision time`
    );
  }
  if (decision.outcome !== "allow" || !operationFailsClosedOnUnknownRights(decision.operation)) {
    return;
  }

  const supportingRights = decision.rightsAssertionRefs.map((ref) =>
    resolveKind(ref, "rights_assertion", byRef, `${decision.id}.rightsAssertionRefs`)
  );
  if (decision.authorityRefs.length === 0 || supportingRights.length === 0) {
    throw new ReferenceSourceStagingIntegrityError(
      `Allow Access Decision ${decision.id} requires rights evidence and explicit authority for ${decision.operation}`
    );
  }
  if (
    supportingRights.some(
      (assertion) => assertion.status === "unknown" || assertion.status === "conflicting"
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Allow Access Decision ${decision.id} cannot treat unknown or conflicting rights as permission`
    );
  }
  const decisionTime = Date.parse(decision.decidedAt);
  const hasCurrentAffirmativeAssertion = supportingRights.some(
    (assertion) =>
      (assertion.status === "public_domain" ||
        assertion.status === "licensed" ||
        assertion.status === "permitted") &&
      (!assertion.validFrom || Date.parse(assertion.validFrom) <= decisionTime) &&
      (!assertion.validUntil || Date.parse(assertion.validUntil) > decisionTime) &&
      rightsAssertionConcernsDecision(assertion, decision, byRef)
  );
  if (!hasCurrentAffirmativeAssertion) {
    throw new ReferenceSourceStagingIntegrityError(
      `Allow Access Decision ${decision.id} lacks a current affirmative Rights Assertion`
    );
  }
}

function rightsAssertionConcernsDecision(
  assertion: ReferenceRightsAssertion,
  decision: ReferenceAccessDecision,
  byRef: Map<string, ReferenceSourceStagingRecord>
): boolean {
  const authorizedRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
  if (authorizedRefs.some((ref) => refKey(ref) === refKey(assertion.subjectRef))) return true;

  for (const authorizedRef of authorizedRefs) {
    const authorizedRecord = byRef.get(refKey(authorizedRef));
    if (!authorizedRecord) continue;
    if (
      authorizedRecord.recordKind === "asset_acquisition" &&
      assertion.subjectKind === "digital_asset" &&
      refKey(authorizedRecord.digitalAssetRef) === refKey(assertion.subjectRef)
    ) {
      return true;
    }
    if (authorizedRecord.recordKind === "source_derivation") {
      if (
        assertion.subjectKind === "asset_acquisition" &&
        authorizedRecord.sourceAcquisitionRefs.some(
          (ref) => refKey(ref) === refKey(assertion.subjectRef)
        )
      ) {
        return true;
      }
      if (
        assertion.subjectKind === "digital_asset" &&
        authorizedRecord.sourceAcquisitionRefs.some((acquisitionRef) => {
          const acquisition = byRef.get(refKey(acquisitionRef));
          return (
            acquisition?.recordKind === "asset_acquisition" &&
            refKey(acquisition.digitalAssetRef) === refKey(assertion.subjectRef)
          );
        })
      ) {
        return true;
      }
    }
    if (authorizedRecord.recordKind === "source_segment_version") {
      if (
        assertion.subjectKind === "digital_asset" &&
        refKey(authorizedRecord.digitalAssetRef) === refKey(assertion.subjectRef)
      ) {
        return true;
      }
      if (
        assertion.subjectKind === "asset_acquisition" &&
        authorizedRecord.acquisitionRefs.some((ref) => refKey(ref) === refKey(assertion.subjectRef))
      ) {
        return true;
      }
    }
  }
  return false;
}

function assertAccessDestination(decision: ReferenceAccessDecision): void {
  const exactIdKinds = new Set(["provider", "repository", "export", "recipient"]);
  if (exactIdKinds.has(decision.destination.kind) && !decision.destination.id) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} must name its exact ${decision.destination.kind} destination`
    );
  }
  if (decision.destination.kind === "local_runtime" && decision.destination.id !== undefined) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} cannot smuggle a remote identity into local_runtime`
    );
  }

  if (
    !REFERENCE_ACCESS_OPERATION_DESTINATIONS[decision.operation].some(
      (permitted) => permitted === decision.destination.kind
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} has an incompatible ${decision.operation}/${decision.destination.kind} scope`
    );
  }
}

function assertLifecycleStoragePolicy(
  policy: ReferenceLifecycleStoragePolicy,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  firstObservedRevisions: ReadonlyMap<string, number>
): void {
  if (
    policy.custody.kind === "vellum_controlled" &&
    new Set(policy.custody.storeIds).size !== policy.custody.storeIds.length
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle storage policy ${policy.id} repeats a controlled store identifier`
    );
  }
  const isUnmanaged = policy.custody.kind === "unmanaged_recipient";
  if ((policy.subjectKind === "unmanaged_disclosure") !== isUnmanaged) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle storage policy ${policy.id} must model unmanaged disclosure with unmanaged custody and nothing else`
    );
  }

  for (const path of policy.provenancePaths) {
    assertExactLifecycleProvenancePath(
      policy.subjectRef,
      path.acquisitionRefs,
      path.derivationRefs,
      policy.createdAt,
      byRef,
      `${policy.id}.provenancePaths`
    );
    const expectedRoleBindingRefs = [...byRef.values()]
      .filter(
        (record): record is ReferenceAssetRoleBinding =>
          (record.recordKind === "arrangement_source_binding" ||
            record.recordKind === "owner_reference_binding" ||
            record.recordKind === "evaluation_source_binding") &&
          sameRefSet(record.acquisitionRefs, path.acquisitionRefs) &&
          observedNoLaterThanRecord(record, policy, firstObservedRevisions)
      )
      .map(refFor);
    if (!sameRefSet(path.roleBindingRefs ?? [], expectedRoleBindingRefs)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle storage policy ${policy.id} must pin the exact role-binding retention roots for each path`
      );
    }
  }
  assertUniqueLifecyclePaths(policy.provenancePaths, policy.id);
  assertOpaqueExternalRef(policy.policyRef, byRef, `${policy.id}.policyRef`);

  if (policy.custody.kind === "unmanaged_recipient") {
    assertOpaqueExternalRef(
      policy.custody.recipientRef,
      byRef,
      `${policy.id}.custody.recipientRef`
    );
    const disclosureDecision = resolveKind(
      policy.custody.disclosureAccessDecisionRef,
      "access_decision",
      byRef,
      `${policy.id}.custody.disclosureAccessDecisionRef`
    );
    if (
      disclosureDecision.outcome !== "allow" ||
      !["export", "redistribution"].includes(disclosureDecision.operation) ||
      disclosureDecision.destination.kind !== "recipient" ||
      disclosureDecision.destination.id !== policy.custody.recipientRef.id ||
      !disclosureDecision.derivativeRefs.some((ref) => refKey(ref) === refKey(policy.subjectRef)) ||
      Date.parse(disclosureDecision.decidedAt) > Date.parse(policy.custody.disclosedAt) ||
      Date.parse(policy.custody.disclosedAt) > Date.parse(policy.createdAt)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle storage policy ${policy.id} lacks an exact prior disclosure authorization`
      );
    }
  }

  assertLifecycleVersionPathChangesReviewed(policy, byRef);
}

function assertLifecycleUse(
  use: ReferenceLifecycleUse,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  for (const path of use.provenancePaths) {
    assertExactLifecycleProvenancePath(
      use.subjectRef,
      path.acquisitionRefs,
      path.derivationRefs,
      use.createdAt,
      byRef,
      `${use.id}.provenancePaths`
    );
    const decision = resolveKind(
      path.accessDecisionRef,
      "access_decision",
      byRef,
      `${use.id}.provenancePaths.accessDecisionRef`
    );
    if (
      decision.operation !== use.operation ||
      decision.destination.kind !== use.destination.kind ||
      decision.destination.id !== use.destination.id ||
      decision.purpose !== use.purpose ||
      refKey(decision.policyRef) !== refKey(use.policyRef) ||
      decision.assetRole !== use.assetRole ||
      Date.parse(decision.decidedAt) > Date.parse(use.createdAt)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle use ${use.id} is not pinned to its Access Decision's exact path, role, operation, destination, purpose, and policy`
      );
    }
    assertExactLifecycleDecisionScope(use, decision, path, byRef);
    assertLifecycleRoleBinding(use, decision, path, byRef);
  }
  assertUniqueLifecyclePaths(use.provenancePaths, use.id);
  assertLifecycleVersionPathChangesReviewed(use, byRef);
  assertNoRetroactiveLifecyclePath(use, byRef);
}

function assertExactLifecycleProvenancePath(
  subjectRef: ReferenceRecordRef,
  acquisitionRefs: ReferenceRecordRef[],
  derivationRefs: ReferenceRecordRef[],
  recordedAt: string,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): void {
  const acquisitions = acquisitionRefs.map((ref) =>
    resolveKind(ref, "asset_acquisition", byRef, `${label}.acquisitionRefs`)
  );
  if (derivationRefs.length === 0) {
    const subject = resolveKind(subjectRef, "digital_asset", byRef, `${label}.subjectRef`);
    if (
      acquisitions.length !== 1 ||
      refKey(acquisitions[0]!.digitalAssetRef) !== refKey(subject) ||
      Date.parse(acquisitions[0]!.acquiredAt) > Date.parse(recordedAt)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle path ${label} without derivations must name one exact acquisition of its Digital Asset`
      );
    }
    return;
  }

  const declaredDerivations = derivationRefs.map((ref) =>
    resolveKind(ref, "source_derivation", byRef, `${label}.derivationRefs`)
  );
  const terminals = declaredDerivations.filter(
    (derivation) => refKey(derivation.derivedRef) === refKey(subjectRef)
  );
  if (terminals.length !== 1) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle path ${label} must end in exactly one derivation of its exact subject`
    );
  }
  const closure = lifecycleDerivationClosure(terminals[0]!, byRef);
  if (
    !sameRefSet(derivationRefs, [...closure.derivations.values()].map(refFor)) ||
    !sameRefSet(acquisitionRefs, [...closure.acquisitions.values()].map(refFor))
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle path ${label} must pin the complete transitive acquisition and derivation closure`
    );
  }
  if (
    [...closure.derivations.values()].some(
      (derivation) => Date.parse(derivation.createdAt) > Date.parse(recordedAt)
    ) ||
    [...closure.acquisitions.values()].some(
      (acquisition) => Date.parse(acquisition.acquiredAt) > Date.parse(recordedAt)
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle path ${label} cannot cite provenance created after the lifecycle record`
    );
  }
}

function lifecycleDerivationClosure(
  terminal: ReferenceSourceDerivation,
  byRef: Map<string, ReferenceSourceStagingRecord>
): {
  acquisitions: Map<
    string,
    Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>
  >;
  derivations: Map<string, ReferenceSourceDerivation>;
} {
  const acquisitions = new Map<
    string,
    Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>
  >();
  const derivations = new Map<string, ReferenceSourceDerivation>();
  const visiting = new Set<string>();
  const visit = (derivation: ReferenceSourceDerivation): void => {
    const key = refKey(derivation);
    if (visiting.has(key)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle provenance reaches cyclic derivation ${derivation.id}`
      );
    }
    if (derivations.has(key)) return;
    visiting.add(key);
    derivations.set(key, derivation);
    for (const acquisitionRef of derivation.sourceAcquisitionRefs) {
      const acquisition = resolveKind(
        acquisitionRef,
        "asset_acquisition",
        byRef,
        `${derivation.id}.sourceAcquisitionRefs`
      );
      acquisitions.set(refKey(acquisition), acquisition);
    }
    for (const sourceRef of derivation.sourceDerivationRefs) {
      visit(
        resolveKind(sourceRef, "source_derivation", byRef, `${derivation.id}.sourceDerivationRefs`)
      );
    }
    visiting.delete(key);
  };
  visit(terminal);
  return { acquisitions, derivations };
}

function assertUniqueLifecyclePaths(
  paths: Array<{ acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] }>,
  id: string
): void {
  const keys = paths.map(lifecyclePathKey);
  if (new Set(keys).size !== keys.length) {
    throw new ReferenceSourceStagingIntegrityError(`Lifecycle record ${id} repeats an exact path`);
  }
}

function lifecyclePathKey(path: {
  acquisitionRefs: ReferenceRecordRef[];
  derivationRefs: ReferenceRecordRef[];
}): string {
  return `${path.acquisitionRefs.map(refKey).sort().join("\u0001")}\u0000${path.derivationRefs
    .map(refKey)
    .sort()
    .join("\u0001")}`;
}

function assertLifecycleVersionPathChangesReviewed(
  record: ReferenceLifecycleStoragePolicy | ReferenceLifecycleUse,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  if (!record.parentVersionRef) return;
  const parent = resolveKind(
    record.parentVersionRef,
    record.recordKind,
    byRef,
    `${record.id}.parentVersionRef`
  ) as ReferenceLifecycleStoragePolicy | ReferenceLifecycleUse;
  const priorKeys = new Set(parent.provenancePaths.map(lifecyclePathKey));
  for (const path of record.provenancePaths) {
    if (priorKeys.has(lifecyclePathKey(path))) continue;
    if (!lifecyclePathHasReviewedSubstitution(path, parent.provenancePaths, record, byRef)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle record ${record.id} cannot add provenance to an existing subject without an exact reviewed substitution`
      );
    }
  }
}

function lifecyclePathHasReviewedSubstitution(
  next: { acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] },
  priorPaths: Array<{
    acquisitionRefs: ReferenceRecordRef[];
    derivationRefs: ReferenceRecordRef[];
  }>,
  record: ReferenceLifecycleStoragePolicy | ReferenceLifecycleUse,
  byRef: Map<string, ReferenceSourceStagingRecord>
): boolean {
  const nextTerminal = terminalDerivationRef(next, record.subjectRef, byRef);
  if (!nextTerminal) return false;
  const substitutions = [...byRef.values()].filter(
    (item): item is ReferenceProvenanceSubstitution =>
      item.recordKind === "provenance_substitution" &&
      Date.parse(item.decidedAt) <= Date.parse(record.createdAt)
  );
  return next.acquisitionRefs.every((nextAcquisition) =>
    priorPaths.some((prior) => {
      const priorTerminal = terminalDerivationRef(prior, record.subjectRef, byRef);
      return (
        priorTerminal !== undefined &&
        prior.acquisitionRefs.some((priorAcquisition) =>
          substitutions.some(
            (substitution) =>
              refKey(substitution.from.acquisitionRef) === refKey(priorAcquisition) &&
              refKey(substitution.from.derivationRef) === refKey(priorTerminal) &&
              refKey(substitution.to.acquisitionRef) === refKey(nextAcquisition) &&
              refKey(substitution.to.derivationRef) === refKey(nextTerminal) &&
              refKey(substitution.scope.policyRef) === refKey(record.policyRef) &&
              (record.recordKind === "lifecycle_storage_policy" ||
                (substitution.scope.operation === record.operation &&
                  substitution.scope.destination.kind === record.destination.kind &&
                  substitution.scope.destination.id === record.destination.id &&
                  substitution.scope.purpose === record.purpose)) &&
              substitution.scope.sourceAndDerivativeRefs.some(
                (ref) => refKey(ref) === refKey(record.subjectRef)
              )
          )
        )
      );
    })
  );
}

function terminalDerivationRef(
  path: { derivationRefs: ReferenceRecordRef[] },
  subjectRef: ReferenceRecordRef,
  byRef: Map<string, ReferenceSourceStagingRecord>
): ReferenceRecordRef | undefined {
  return path.derivationRefs.find((ref) => {
    const record = byRef.get(refKey(ref));
    return (
      record?.recordKind === "source_derivation" && refKey(record.derivedRef) === refKey(subjectRef)
    );
  });
}

function assertNoRetroactiveLifecyclePath(
  use: ReferenceLifecycleUse,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const allDerivations = [...byRef.values()].filter(
    (record): record is ReferenceSourceDerivation => record.recordKind === "source_derivation"
  );
  for (const path of use.provenancePaths) {
    const terminalRef = terminalDerivationRef(path, use.subjectRef, byRef);
    if (!terminalRef) continue;
    const terminal = resolveKind(terminalRef, "source_derivation", byRef, `${use.id}.terminal`);
    const earlierAlternatives = allDerivations.filter(
      (candidate) =>
        refKey(candidate.derivedRef) === refKey(use.subjectRef) &&
        refKey(candidate) !== refKey(terminal) &&
        Date.parse(candidate.createdAt) < Date.parse(terminal.createdAt)
    );
    if (earlierAlternatives.length === 0) continue;
    const priorPaths = earlierAlternatives.map((candidate) => ({
      acquisitionRefs: lifecycleDerivationClosure(candidate, byRef).acquisitions.size
        ? [...lifecycleDerivationClosure(candidate, byRef).acquisitions.values()].map(refFor)
        : [],
      derivationRefs: [...lifecycleDerivationClosure(candidate, byRef).derivations.values()].map(
        refFor
      ),
    }));
    if (!lifecyclePathHasReviewedSubstitution(path, priorPaths, use, byRef)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle use ${use.id} cannot retroactively authorize an existing derivative through a later acquisition`
      );
    }
  }
}

function assertLifecycleRoleBinding(
  use: ReferenceLifecycleUse,
  decision: ReferenceAccessDecision,
  path: ReferenceLifecycleUse["provenancePaths"][number],
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  if (!use.assetRole) {
    if (path.roleBindingRef) {
      throw new ReferenceSourceStagingIntegrityError(
        `Lifecycle use ${use.id} cannot cite a role binding without an Asset Role`
      );
    }
    return;
  }
  if (!path.roleBindingRef) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle use ${use.id} must pin its exact Asset Role Binding`
    );
  }
  const bindingKind =
    use.assetRole === "arrangement_source"
      ? "arrangement_source_binding"
      : use.assetRole === "owner_reference"
        ? "owner_reference_binding"
        : "evaluation_source_binding";
  const binding = resolveKind(
    path.roleBindingRef,
    bindingKind,
    byRef,
    `${use.id}.provenancePaths.roleBindingRef`
  );
  if (
    !sameRefSet(binding.acquisitionRefs, path.acquisitionRefs) ||
    !sameRefSet(binding.accessDecisionRefs, [refFor(decision)])
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle use ${use.id} cannot borrow ${use.assetRole} authority without its exact role binding`
    );
  }
}

function assertExactLifecycleDecisionScope(
  use: ReferenceLifecycleUse,
  decision: ReferenceAccessDecision,
  path: ReferenceLifecycleUse["provenancePaths"][number],
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const acquisitions = path.acquisitionRefs.map((ref) =>
    resolveKind(ref, "asset_acquisition", byRef, `${use.id}.provenancePaths.acquisitionRefs`)
  );
  const sourceRefs = [
    ...path.acquisitionRefs,
    ...acquisitions.map((acquisition) => acquisition.digitalAssetRef),
  ];
  const derivativeRefs = [
    ...path.derivationRefs,
    ...(sourceRefs.some((ref) => refKey(ref) === refKey(use.subjectRef)) ? [] : [use.subjectRef]),
  ];
  if (
    !sameRefSet(decision.sourceRefs, sourceRefs) ||
    !sameRefSet(decision.derivativeRefs, derivativeRefs)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Lifecycle use ${use.id} requires exact, disjoint source and derivative decision sets`
    );
  }
}

function operationFailsClosedOnUnknownRights(
  operation: ReferenceAccessDecision["operation"]
): boolean {
  return [
    "provider_ocr",
    "provider_omr",
    "provider_translation",
    "provider_model_processing",
    "pack_citation",
    "pack_excerpt",
    "fixture_inclusion",
    "repository_inclusion",
    "export",
    "redistribution",
    "report",
    "log",
  ].includes(operation);
}

function registerLogicalIdentity(
  record: ReferenceSourceStagingRecord,
  versions: Set<string>,
  kindsById: Map<string, string>
): void {
  const existingKind = kindsById.get(record.id);
  if (existingKind !== undefined && existingKind !== record.recordKind) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source record ID ${record.id} is reused across record kinds`
    );
  }
  kindsById.set(record.id, record.recordKind);
  if (!("version" in record)) {
    if (existingKind !== undefined) {
      throw new ReferenceSourceStagingIntegrityError(
        `Unversioned reference-source record ID was reused: ${record.id}`
      );
    }
    return;
  }
  const key = `${record.recordKind}\u0000${record.id}\u0000${record.version}`;
  if (versions.has(key)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source logical version was reused: ${record.id} v${record.version}`
    );
  }
  versions.add(key);
}

function assertVersionParent(
  record: ReferenceSourceStagingRecord,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  if (!("version" in record)) return;
  if (!record.parentVersionRef) {
    if (record.version !== 1) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source record ${record.id} v${record.version} has no exact parent`
      );
    }
    return;
  }
  const parent = resolveRecord(record.parentVersionRef, byRef, "parentVersionRef");
  if (
    parent.recordKind !== record.recordKind ||
    parent.id !== record.id ||
    !("version" in parent) ||
    parent.version !== record.parentVersionRef.version ||
    record.version !== parent.version + 1
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source parentVersionRef is not the exact prior same-kind version for ${record.id}`
    );
  }
}

function assertDependencyEdge(
  edge: ReferenceDependencyEdge,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const dependency = resolveRecord(edge.dependencyRef, byRef, `${edge.id}.dependencyRef`);
  resolveRecord(edge.dependentRef, byRef, `${edge.id}.dependentRef`);
  if (refKey(edge.dependencyRef) === refKey(edge.dependentRef)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source dependency edge cannot depend on itself: ${edge.id}`
    );
  }
  const requiredScope = triggerScope(dependency);
  if (requiredScope && edge.scope !== requiredScope) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source dependency edge ${edge.id} must start with ${requiredScope} scope`
    );
  }
}

function assertDependencyGraphAcyclic(edges: ReferenceDependencyEdge[]): void {
  const outgoing = new Map<string, ReferenceDependencyEdge[]>();
  const tuples = new Set<string>();
  for (const edge of edges) {
    const tuple = `${refKey(edge.dependencyRef)}\u0000${refKey(edge.dependentRef)}\u0000${edge.scope}`;
    if (tuples.has(tuple)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source dependency graph repeats exact edge ${edge.dependencyRef.id} -> ${edge.dependentRef.id}`
      );
    }
    tuples.add(tuple);
    const values = outgoing.get(refKey(edge.dependencyRef)) ?? [];
    values.push(edge);
    outgoing.set(refKey(edge.dependencyRef), values);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): void => {
    if (visiting.has(node)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source dependency graph contains a cycle at ${node.split("\u0000")[0]}`
      );
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const edge of outgoing.get(node) ?? []) visit(refKey(edge.dependentRef));
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of outgoing.keys()) visit(node);
}

function assertProvenanceSubstitution(
  substitution: ReferenceProvenanceSubstitution,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const fromAcquisition = resolveKind(
    substitution.from.acquisitionRef,
    "asset_acquisition",
    byRef,
    `${substitution.id}.from.acquisitionRef`
  );
  const fromDerivation = resolveKind(
    substitution.from.derivationRef,
    "source_derivation",
    byRef,
    `${substitution.id}.from.derivationRef`
  );
  const toAcquisition = resolveKind(
    substitution.to.acquisitionRef,
    "asset_acquisition",
    byRef,
    `${substitution.id}.to.acquisitionRef`
  );
  const toDerivation = resolveKind(
    substitution.to.derivationRef,
    "source_derivation",
    byRef,
    `${substitution.id}.to.derivationRef`
  );
  assertDerivationUsesAcquisition(fromDerivation, fromAcquisition, "from");
  assertDerivationUsesAcquisition(toDerivation, toAcquisition, "to");
  if (refKey(fromAcquisition.digitalAssetRef) !== refKey(toAcquisition.digitalAssetRef)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} crosses Digital Asset identity`
    );
  }
  if (refKey(fromDerivation.derivedRef) !== refKey(toDerivation.derivedRef)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} does not preserve the exact derived artifact`
    );
  }
  if (refKey(substitution.from.acquisitionRef) === refKey(substitution.to.acquisitionRef)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} must replace the acquisition, not merely relabel a derivation`
    );
  }

  const access = resolveKind(
    substitution.accessDecisionRef,
    "access_decision",
    byRef,
    `${substitution.id}.accessDecisionRef`
  );
  for (const evidenceRef of substitution.authority.evidenceRefs) {
    assertLocalOrOpaqueRef(evidenceRef, byRef, `${substitution.id}.authority.evidenceRefs`);
  }
  for (const sourceRef of substitution.scope.sourceAndDerivativeRefs) {
    assertLocalOrOpaqueRef(sourceRef, byRef, `${substitution.id}.scope.sourceAndDerivativeRefs`);
  }
  assertOpaqueExternalRef(
    substitution.authority.authorityRef,
    byRef,
    `${substitution.id}.authority.authorityRef`
  );
  assertOpaqueExternalRef(
    substitution.scope.policyRef,
    byRef,
    `${substitution.id}.scope.policyRef`
  );
  assertSubstitutionRoleBinding(substitution, access, toDerivation, byRef);
  assertSubstitutionAuthorized(substitution, access, toAcquisition, toDerivation, byRef);
}

function assertSubstitutionRoleBinding(
  substitution: ReferenceProvenanceSubstitution,
  access: ReferenceAccessDecision,
  toDerivation: ReferenceSourceDerivation,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  if (!access.assetRole) {
    if (substitution.roleBindingRef) {
      throw new ReferenceSourceStagingIntegrityError(
        `Provenance substitution ${substitution.id} cannot cite a role binding without an Asset Role`
      );
    }
    return;
  }
  if (!substitution.roleBindingRef) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} must pin its exact replacement Asset Role Binding`
    );
  }
  const bindingKind =
    access.assetRole === "arrangement_source"
      ? "arrangement_source_binding"
      : access.assetRole === "owner_reference"
        ? "owner_reference_binding"
        : "evaluation_source_binding";
  const binding = resolveKind(
    substitution.roleBindingRef,
    bindingKind,
    byRef,
    `${substitution.id}.roleBindingRef`
  );
  const closure = lifecycleDerivationClosure(toDerivation, byRef);
  const acquisitionRefs = [...closure.acquisitions.values()].map(refFor);
  if (
    !sameRefSet(binding.acquisitionRefs, acquisitionRefs) ||
    !sameRefSet(binding.accessDecisionRefs, [refFor(access)]) ||
    acquisitionRefs.length === 0 ||
    [...closure.acquisitions.values()].some(
      (acquisition) => refKey(acquisition.digitalAssetRef) !== refKey(binding.digitalAssetRef)
    )
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} cannot borrow an Asset Role Binding from a different replacement path`
    );
  }
}

function assertRoleBinding(
  binding: Extract<
    ReferenceSourceStagingRecord,
    {
      recordKind:
        | "arrangement_source_binding"
        | "owner_reference_binding"
        | "evaluation_source_binding";
    }
  >,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  resolveKind(binding.digitalAssetRef, "digital_asset", byRef, `${binding.id}.digitalAssetRef`);
  const acquisitions = binding.acquisitionRefs.map((ref) =>
    resolveKind(ref, "asset_acquisition", byRef, `${binding.id}.acquisitionRefs`)
  );
  for (const acquisition of acquisitions) {
    if (refKey(acquisition.digitalAssetRef) !== refKey(binding.digitalAssetRef)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source role binding ${binding.id} names an acquisition for a different Digital Asset`
      );
    }
  }
  const accessDecisions = binding.accessDecisionRefs.map((ref) =>
    resolveKind(ref, "access_decision", byRef, `${binding.id}.accessDecisionRefs`)
  );
  const uncoveredAcquisition = binding.acquisitionRefs.find(
    (acquisitionRef) =>
      !accessDecisions.some(
        (decision) =>
          decision.outcome === "allow" &&
          Date.parse(decision.decidedAt) <= Date.parse(binding.createdAt) &&
          (!decision.validUntil ||
            Date.parse(decision.validUntil) > Date.parse(binding.createdAt)) &&
          decision.assetRole === accessRoleForBinding(binding.recordKind) &&
          (binding.recordKind === "evaluation_source_binding"
            ? decision.destination.kind === "repository"
            : decision.destination.kind === "local_runtime" &&
              (decision.operation === "owner_private_study" ||
                decision.operation === "local_extraction")) &&
          [...decision.sourceRefs, ...decision.derivativeRefs].some(
            (authorizedRef) => refKey(authorizedRef) === refKey(acquisitionRef)
          )
      )
  );
  if (uncoveredAcquisition) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source role binding ${binding.id} lacks an allow Access Decision for acquisition ${uncoveredAcquisition.id}`
    );
  }
}

function assertAcquisitionSupersessionAcyclic(
  acquisition: Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>,
  predecessor: Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const visited = new Set([refKey(acquisition)]);
  let cursor: Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }> | null =
    predecessor;
  while (cursor) {
    const key = refKey(cursor);
    if (visited.has(key)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Asset Acquisition ${acquisition.id} creates a supersession cycle`
      );
    }
    visited.add(key);
    cursor = cursor.supersedesAcquisitionRef
      ? resolveKind(
          cursor.supersedesAcquisitionRef,
          "asset_acquisition",
          byRef,
          `${cursor.id}.supersedesAcquisitionRef`
        )
      : null;
  }
}

function assertDisclosedEvaluationBinding(
  binding: Extract<ReferenceSourceStagingRecord, { recordKind: "evaluation_source_binding" }>,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const fixture = resolveKind(
    binding.evaluationContext.evaluationFixtureRef,
    "source_derivation",
    byRef,
    `${binding.id}.evaluationContext.evaluationFixtureRef`
  );
  if (fixture.derivationKind !== "fixture") {
    throw new ReferenceSourceStagingIntegrityError(
      `Disclosed evaluation binding ${binding.id} must name a fixture derivation`
    );
  }
  if (!fixture.inputRefs.some((ref) => refKey(ref) === refKey(binding.digitalAssetRef))) {
    throw new ReferenceSourceStagingIntegrityError(
      `Disclosed evaluation binding ${binding.id} fixture does not use its exact Digital Asset`
    );
  }
  if (!sameRefSet(fixture.sourceAcquisitionRefs, binding.acquisitionRefs)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Disclosed evaluation binding ${binding.id} fixture does not use its exact acquisition set`
    );
  }

  const requiredRefs = [
    ...binding.acquisitionRefs,
    binding.evaluationContext.evaluationFixtureRef,
    fixture.derivedRef,
  ];
  const hasRepositoryAuthorization = binding.accessDecisionRefs.some((ref) => {
    const decision = resolveKind(ref, "access_decision", byRef, `${binding.id}.accessDecisionRefs`);
    const authorized = new Set([...decision.sourceRefs, ...decision.derivativeRefs].map(refKey));
    return (
      decision.outcome === "allow" &&
      (decision.operation === "fixture_inclusion" ||
        decision.operation === "repository_inclusion") &&
      decision.destination.kind === "repository" &&
      decision.assetRole === "evaluation_source" &&
      requiredRefs.every((required) => authorized.has(refKey(required)))
    );
  });
  if (!hasRepositoryAuthorization) {
    throw new ReferenceSourceStagingIntegrityError(
      `Disclosed evaluation binding ${binding.id} lacks exact repository fixture authorization`
    );
  }
}

function accessRoleForBinding(
  kind: "arrangement_source_binding" | "owner_reference_binding" | "evaluation_source_binding"
): "arrangement_source" | "owner_reference" | "evaluation_source" {
  if (kind === "arrangement_source_binding") return "arrangement_source";
  if (kind === "owner_reference_binding") return "owner_reference";
  return "evaluation_source";
}

function assertDerivationUsesAcquisition(
  derivation: Extract<ReferenceSourceStagingRecord, { recordKind: "source_derivation" }>,
  acquisition: Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>,
  endpoint: "from" | "to"
): void {
  if (!derivation.sourceAcquisitionRefs.some((ref) => refKey(ref) === refKey(acquisition))) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${endpoint} derivation does not use its exact acquisition`
    );
  }
}

function assertSubstitutionAuthorized(
  substitution: ReferenceProvenanceSubstitution,
  access: ReferenceAccessDecision,
  toAcquisition: Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>,
  toDerivation: ReferenceSourceDerivation,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const endpointRefs = [
    substitution.from.acquisitionRef,
    substitution.from.derivationRef,
    substitution.to.acquisitionRef,
    substitution.to.derivationRef,
    toDerivation.derivedRef,
  ];
  const scopedRefs = new Set(substitution.scope.sourceAndDerivativeRefs.map(refKey));
  const authorityMatches = access.authorityRefs.some(
    (ref) => refKey(ref) === refKey(substitution.authority.authorityRef)
  );
  const replacementClosure = lifecycleDerivationClosure(toDerivation, byRef);
  const replacementAcquisitions = [...replacementClosure.acquisitions.values()];
  const replacementDerivations = [...replacementClosure.derivations.values()];
  const expectedSourceRefs = uniqueRefs([
    ...replacementAcquisitions.map(refFor),
    ...replacementAcquisitions.map(({ digitalAssetRef }) => digitalAssetRef),
  ]);
  const expectedDerivativeRefs = uniqueRefs([
    ...replacementDerivations.map(refFor),
    toDerivation.derivedRef,
  ]);
  if (
    access.outcome !== "allow" ||
    access.operation !== substitution.scope.operation ||
    access.purpose !== substitution.scope.purpose ||
    access.policyRef.id !== substitution.scope.policyRef.id ||
    access.policyRef.digest !== substitution.scope.policyRef.digest ||
    access.destination.kind !== substitution.scope.destination.kind ||
    access.destination.id !== substitution.scope.destination.id ||
    Date.parse(access.decidedAt) > Date.parse(substitution.decidedAt) ||
    (access.validUntil !== undefined &&
      Date.parse(access.validUntil) <= Date.parse(substitution.decidedAt)) ||
    !authorityMatches ||
    endpointRefs.some((ref) => !scopedRefs.has(refKey(ref))) ||
    !replacementAcquisitions.some((item) => refKey(item) === refKey(toAcquisition)) ||
    !sameRefSet(access.sourceRefs, expectedSourceRefs) ||
    !sameRefSet(access.derivativeRefs, expectedDerivativeRefs)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} is not authorized by its exact Access Decision`
    );
  }
}

function assertInvalidation(
  invalidation: ReferenceInvalidation,
  byRef: Map<string, ReferenceSourceStagingRecord>
): void {
  const trigger = resolveRecord(invalidation.triggerRef, byRef, `${invalidation.id}.triggerRef`);
  resolveRecord(invalidation.invalidatedRef, byRef, `${invalidation.id}.invalidatedRef`);
  const requiredScope = triggerScope(trigger);
  if (!requiredScope || invalidation.scope !== requiredScope) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source invalidation ${invalidation.id} has a scope incompatible with its trigger`
    );
  }
  if (invalidation.replacementRef) {
    const replacement = resolveRecord(
      invalidation.replacementRef,
      byRef,
      `${invalidation.id}.replacementRef`
    );
    if (
      replacement.recordKind !== trigger.recordKind ||
      !("parentVersionRef" in replacement) ||
      !replacement.parentVersionRef ||
      replacement.parentVersionRef.id !== trigger.id ||
      replacement.parentVersionRef.digest !== trigger.digest
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source invalidation ${invalidation.id} replacement is not an exact successor of its trigger`
      );
    }
  }
  if (
    refKey(invalidation.dependencyPath[0]!) !== refKey(invalidation.triggerRef) ||
    refKey(invalidation.dependencyPath[invalidation.dependencyPath.length - 1]!) !==
      refKey(invalidation.invalidatedRef) ||
    invalidation.dependencyEdgeRefs.length !== invalidation.dependencyPath.length - 1
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source invalidation ${invalidation.id} does not contain a complete dependency path`
    );
  }
  invalidation.dependencyEdgeRefs.forEach((edgeRef, index) => {
    const edge = resolveKind(
      edgeRef,
      "dependency_edge",
      byRef,
      `${invalidation.id}.dependencyEdgeRefs`
    );
    if (
      (index === 0 && edge.scope !== invalidation.scope) ||
      refKey(edge.dependencyRef) !== refKey(invalidation.dependencyPath[index]!) ||
      refKey(edge.dependentRef) !== refKey(invalidation.dependencyPath[index + 1]!)
    ) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source invalidation ${invalidation.id} contains a discontinuous dependency path`
      );
    }
  });
}

function triggerScope(
  record: ReferenceSourceStagingRecord
): "identity" | "rights" | "access" | undefined {
  if (record.recordKind === "identity_assertion") return "identity";
  if (record.recordKind === "rights_assertion") return "rights";
  if (record.recordKind === "access_decision") return "access";
  return undefined;
}

function resolveRecord(
  ref: ReferenceRecordRef,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): ReferenceSourceStagingRecord {
  const record = byRef.get(refKey(ref));
  if (!record) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} does not resolve to an exact staged record`
    );
  }
  return record;
}

function resolveKind<K extends ReferenceSourceStagingRecord["recordKind"]>(
  ref: ReferenceRecordRef,
  kind: K,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): Extract<ReferenceSourceStagingRecord, { recordKind: K }> {
  const record = resolveRecord(ref, byRef, label);
  if (record.recordKind !== kind) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} resolves to ${record.recordKind}, not ${kind}`
    );
  }
  return record as Extract<ReferenceSourceStagingRecord, { recordKind: K }>;
}

function resolveMany<K extends ReferenceSourceStagingRecord["recordKind"]>(
  refs: ReferenceRecordRef[],
  kind: K,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): Array<Extract<ReferenceSourceStagingRecord, { recordKind: K }>> {
  return refs.map((ref) => resolveKind(ref, kind, byRef, label));
}

function resolveManyOfKinds(
  refs: ReferenceRecordRef[],
  kinds: readonly ReferenceSourceStagingRecord["recordKind"][],
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): ReferenceSourceStagingRecord[] {
  const resolved: ReferenceSourceStagingRecord[] = [];
  for (const ref of refs) {
    const record = resolveRecord(ref, byRef, label);
    if (!kinds.includes(record.recordKind)) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source ${label} resolves to ${record.recordKind}, not one of ${kinds.join(", ")}`
      );
    }
    resolved.push(record);
  }
  return resolved;
}

/**
 * Evidence and other opaque refs may live outside this staging graph. If an ID
 * does collide with a staged record, however, it must retain that record's
 * exact digest instead of bypassing local integrity as a pretend external ref.
 */
function assertLocalOrOpaqueRef(
  ref: ReferenceRecordRef,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): void {
  if (byRef.has(refKey(ref))) return;
  if ([...byRef.values()].some((record) => record.id === ref.id)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} reuses a staged record ID with a nonmatching digest`
    );
  }
}

function assertLocalOrOpaqueRefs(
  refs: ReferenceRecordRef[],
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): void {
  for (const ref of refs) assertLocalOrOpaqueRef(ref, byRef, label);
}

/**
 * These refs identify authorities or resources governed outside the staging
 * graph. A local-ID collision is rejected so a local record cannot masquerade
 * as an external authority by changing only its digest.
 */
function assertOpaqueExternalRef(
  ref: ReferenceRecordRef,
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): void {
  if ([...byRef.values()].some((record) => record.id === ref.id)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} must remain an opaque external reference`
    );
  }
}

function assertOpaqueExternalRefs(
  refs: ReferenceRecordRef[],
  byRef: Map<string, ReferenceSourceStagingRecord>,
  label: string
): void {
  for (const ref of refs) assertOpaqueExternalRef(ref, byRef, label);
}

function sameRefSet(left: ReferenceRecordRef[], right: ReferenceRecordRef[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(refKey));
  return rightKeys.size === right.length && left.every((ref) => rightKeys.has(refKey(ref)));
}

function assertDistinctRefs(refs: ReferenceRecordRef[], label: string): void {
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} must contain duplicate-free exact references`
    );
  }
}

function assertUniqueStrings(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source ${label} must contain unique values`
    );
  }
}

function sameStrings(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightValues = new Set(right);
  return rightValues.size === right.length && left.every((value) => rightValues.has(value));
}

function uniqueRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((ref) => [refKey(ref), ref])).values()];
}

function assertNever(value: never): never {
  throw new ReferenceSourceStagingIntegrityError(
    `Unsupported reference-source staging record kind: ${String(value)}`
  );
}

function assertRecordDigest(record: ReferenceSourceStagingRecord): void {
  if (!verifyReferenceRecordDigest(record)) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source record digest mismatch for ${record.id}`
    );
  }
}

type InvalidationInput = {
  appended: ReferenceSourceStagingRecord[];
  allRecords: ReferenceSourceStagingRecord[];
  createdAt: string;
  createId: () => string;
};

function deriveInvalidationOverlays(input: InvalidationInput): ReferenceInvalidation[] {
  const edges = input.allRecords.filter(isDependencyEdge);
  const emitted = new Set<string>();
  const overlays: ReferenceInvalidation[] = [];

  for (const replacement of input.appended.filter(isInvalidationTrigger)) {
    const replacedRef = supersededRef(replacement);
    if (!replacedRef) continue;
    for (const path of reverseDependencyPaths(replacedRef, invalidationScope(replacement), edges)) {
      const invalidatedRef = path[path.length - 1]!.dependentRef;
      const key = `${refKey(replacedRef)}\u0000${refKey(invalidatedRef)}\u0000${refKey(replacement)}\u0000${path.map((edge) => refKey(edge)).join("\u0001")}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      overlays.push(
        withReferenceRecordDigest({
          recordKind: "invalidation",
          id: `reference-invalidation.${input.createId()}`,
          triggerRef: replacedRef,
          invalidatedRef,
          dependencyEdgeRefs: path.map(refFor),
          dependencyPath: [replacedRef, ...path.map((edge) => edge.dependentRef)],
          scope: invalidationScope(replacement),
          replacementRef: refFor(replacement),
          reason: "superseded_source_identity_or_access_basis",
          invalidatedAt: input.createdAt,
        }) as ReferenceInvalidation
      );
    }
  }

  return overlays;
}

function reverseDependencyPaths(
  root: ReferenceRecordRef,
  startScope: "identity" | "rights" | "access",
  edges: ReferenceDependencyEdge[]
): ReferenceDependencyEdge[][] {
  const outgoing = new Map<string, ReferenceDependencyEdge[]>();
  for (const edge of edges) {
    const key = refKey(edge.dependencyRef);
    const values = outgoing.get(key) ?? [];
    values.push(edge);
    outgoing.set(key, values);
  }
  for (const values of outgoing.values()) {
    values.sort((left, right) => left.id.localeCompare(right.id));
  }

  const paths: ReferenceDependencyEdge[][] = [];
  const queue: Array<{ ref: ReferenceRecordRef; path: ReferenceDependencyEdge[] }> = [
    { ref: root, path: [] },
  ];
  const visited = new Set([refKey(root)]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of outgoing.get(refKey(current.ref)) ?? []) {
      if (current.path.length === 0 && edge.scope !== startScope) continue;
      const dependentKey = refKey(edge.dependentRef);
      if (visited.has(dependentKey)) continue;
      visited.add(dependentKey);
      const path = [...current.path, edge];
      paths.push(path);
      queue.push({ ref: edge.dependentRef, path });
    }
  }
  return paths;
}

function supersededRef(
  record: ReferenceSourceIdentityAssertion | ReferenceRightsAssertion | ReferenceAccessDecision
): ReferenceRecordRef | undefined {
  return record.parentVersionRef
    ? { id: record.parentVersionRef.id, digest: record.parentVersionRef.digest }
    : undefined;
}

function isInvalidationTrigger(
  record: ReferenceSourceStagingRecord
): record is ReferenceSourceIdentityAssertion | ReferenceRightsAssertion | ReferenceAccessDecision {
  return (
    record.recordKind === "identity_assertion" ||
    record.recordKind === "rights_assertion" ||
    record.recordKind === "access_decision"
  );
}

function isDependencyEdge(record: ReferenceSourceStagingRecord): record is ReferenceDependencyEdge {
  return record.recordKind === "dependency_edge";
}

function invalidationScope(
  record: ReferenceSourceIdentityAssertion | ReferenceRightsAssertion | ReferenceAccessDecision
): "identity" | "rights" | "access" {
  if (record.recordKind === "identity_assertion") return "identity";
  if (record.recordKind === "rights_assertion") return "rights";
  return "access";
}

function refFor(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function refsEqual(
  left: { id: string; digest: string },
  right: { id: string; digest: string }
): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
