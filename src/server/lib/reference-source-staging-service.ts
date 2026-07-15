import { randomUUID } from "node:crypto";

import { Value } from "@sinclair/typebox/value";

import {
  ReferenceSourceStagingTransactionSchema,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceDependencyEdge,
  type ReferenceSourceIdentityAssertion,
  type ReferenceInvalidation,
  type ReferenceProvenanceSubstitution,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingStore,
  type ReferenceSourceStagingHead,
} from "./reference-source-staging-store.js";

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
    let decodedTransaction: ReferenceSourceStagingTransaction;
    try {
      decodedTransaction = Value.Decode(ReferenceSourceStagingTransactionSchema, transaction);
    } catch (error) {
      throw new ReferenceSourceStagingIntegrityError(
        `Reference-source staging transaction failed schema validation: ${errorMessage(error)}`
      );
    }
    const currentState = this.store.readCurrentState();
    const current = currentState?.snapshot ?? null;
    const existing = current?.records ?? [];
    const appended: ReferenceSourceStagingRecord[] = decodedTransaction.operations.map(
      (operation) => operation.record
    );
    if (appended.some((record) => record.recordKind === "invalidation")) {
      throw new ReferenceSourceStagingIntegrityError(
        "Invalidation overlays are service-derived and cannot be supplied by a staging client"
      );
    }
    assertAppendOnlyRecords(existing, appended);

    const records = [...existing, ...appended];
    assertRecordGraphIntegrity(records);
    const committedAt = this.now().toISOString();
    const invalidations = deriveInvalidationOverlays({
      appended,
      allRecords: records,
      createdAt: committedAt,
      createId: this.createId,
    });
    const nextRecords = [...records, ...invalidations];
    assertRecordGraphIntegrity(nextRecords);
    const revision = (current?.revision ?? 0) + 1;
    const snapshotCore: Omit<ReferenceSourceStagingSnapshot, "digest"> = {
      schemaVersion: 1,
      id: `reference-source-snapshot.${this.createId()}`,
      revision,
      ...(current ? { parentSnapshotRef: refFor(current) } : {}),
      publicationState: "staging_only",
      createdAt: committedAt,
      records: nextRecords,
    };
    const snapshot: ReferenceSourceStagingSnapshot = {
      ...snapshotCore,
      digest: referenceSourceDigest(snapshotCore),
    };
    const committedHead = this.store.commit(snapshot, decodedTransaction.expectedHeadRef);
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

function assertRecordGraphIntegrity(records: ReferenceSourceStagingRecord[]): void {
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
    assertLocalStructuralEdges(record, byRef);
  }
  assertDependencyGraphAcyclic(records.filter(isDependencyEdge));
}

function assertLocalStructuralEdges(
  record: ReferenceSourceStagingRecord,
  byRef: Map<string, ReferenceSourceStagingRecord>
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
      assertOpaqueExternalRef(
        record.processingPolicyRef,
        byRef,
        `${record.id}.processingPolicyRef`
      );
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
      assertOpaqueExternalRef(record.pageAtlasRef, byRef, `${record.id}.pageAtlasRef`);
      assertLocalOrOpaqueRef(record.sourceImageRef, byRef, `${record.id}.sourceImageRef`);
      return;
    }
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
  const providerOperations = new Set([
    "provider_ocr",
    "provider_omr",
    "provider_translation",
    "provider_model_processing",
  ]);
  if (providerOperations.has(decision.operation)) {
    if (decision.destination.kind !== "provider" || !decision.destination.id) {
      throw new ReferenceSourceStagingIntegrityError(
        `Access Decision ${decision.id} must name its exact provider destination`
      );
    }
    return;
  }
  if (decision.operation === "fixture_inclusion" || decision.operation === "repository_inclusion") {
    if (decision.destination.kind !== "repository" || !decision.destination.id) {
      throw new ReferenceSourceStagingIntegrityError(
        `Access Decision ${decision.id} must name its exact repository destination`
      );
    }
    return;
  }
  if (decision.operation === "owner_private_study" || decision.operation === "local_extraction") {
    if (decision.destination.kind !== "local_runtime") {
      throw new ReferenceSourceStagingIntegrityError(
        `Access Decision ${decision.id} must remain inside the local runtime`
      );
    }
    return;
  }
  if (
    decision.operation === "export" &&
    decision.destination.kind !== "export" &&
    decision.destination.kind !== "recipient"
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} has an incompatible export destination`
    );
  }
  if (
    decision.operation === "redistribution" &&
    !["recipient", "repository", "export"].includes(decision.destination.kind)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Access Decision ${decision.id} has an incompatible redistribution destination`
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
  if (
    refKey(substitution.from.acquisitionRef) === refKey(substitution.to.acquisitionRef) &&
    refKey(substitution.from.derivationRef) === refKey(substitution.to.derivationRef)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      `Provenance substitution ${substitution.id} does not substitute a different exact path`
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
  assertSubstitutionAuthorized(substitution, access);
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
  access: ReferenceAccessDecision
): void {
  const authorizedRefs = new Set([...access.sourceRefs, ...access.derivativeRefs].map(refKey));
  const endpointRefs = [
    substitution.from.acquisitionRef,
    substitution.from.derivationRef,
    substitution.to.acquisitionRef,
    substitution.to.derivationRef,
  ];
  const scopedRefs = new Set(substitution.scope.sourceAndDerivativeRefs.map(refKey));
  const authorityMatches =
    substitution.authority.kind === "policy"
      ? refKey(substitution.authority.authorityRef) === refKey(access.policyRef)
      : access.authorityRefs.some(
          (ref) => refKey(ref) === refKey(substitution.authority.authorityRef)
        );
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
    endpointRefs.some((ref) => !authorizedRefs.has(refKey(ref))) ||
    substitution.scope.sourceAndDerivativeRefs.some((ref) => !authorizedRefs.has(refKey(ref)))
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
): void {
  for (const ref of refs) resolveKind(ref, kind, byRef, label);
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

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
