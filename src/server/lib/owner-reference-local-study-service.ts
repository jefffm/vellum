import { Value } from "@sinclair/typebox/value";

import {
  OwnerReferenceWorkbenchLocalStudyRequestSchema,
  type OwnerReferenceWorkbenchLocalStudyRequest,
} from "../../lib/owner-reference-workbench-contract.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import type { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import {
  ReferenceSourceOperationGateway,
  referenceSourceAcquisitionIsCurrentAndApplicable,
  type ReferenceSourceOperationEffects,
  type ReferenceSourceOperationScope,
} from "./reference-source-operation-gateway.js";
import {
  assertReferenceSourceStagingSnapshotIntegrity,
  OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF,
  OWNER_PRIVATE_LOCAL_STUDY_POLICY_REF,
  OWNER_PRIVATE_LOCAL_STUDY_RATIONALE,
  type OwnerPrivateStudyStagingWriter,
} from "./reference-source-staging-service.js";
import type {
  ReferenceSourceStagingState,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

type OpaqueProjector = Readonly<{
  project: (kind: string, value: unknown) => ReferenceRecordRef;
}>;

export type OwnerReferenceLocalStudySink = (input: {
  bytes: Uint8Array;
  mediaType: string;
}) => void | Promise<void>;

export type OwnerReferenceLocalStudyExecutionResult = Readonly<{
  status: "executed";
  replayed: boolean;
  rightsAssertionRef: ReferenceRecordRef;
  accessDecisionRef: ReferenceRecordRef;
}>;

export type OwnerReferenceLocalStudyExecutionInput = Readonly<{
  request: OwnerReferenceWorkbenchLocalStudyRequest;
  currentWorkbenchSnapshotRef: ReferenceRecordRef;
  currentStagingSnapshotRef: ReferenceRecordRef;
  acquisition: ReferenceAssetAcquisition;
  digitalAsset: ReferenceDigitalAsset;
}>;

export type OwnerReferenceLocalStudyServiceOptions = Readonly<{
  stagingWriter: OwnerPrivateStudyStagingWriter;
  stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">;
  controlledArtifacts: Pick<ReferenceSourceControlledArtifactStore, "readDigitalAssetBytes">;
  opaqueProjector: OpaqueProjector;
  now?: () => Date;
}>;

type AuthorizationIdentity = Readonly<{
  suffix: string;
  rightsId: string;
  decisionId: string;
  scopeEvidenceRef: ReferenceRecordRef;
}>;

type AuthorizationPair = Readonly<{
  rights: ReferenceRightsAssertion;
  decision: ReferenceAccessDecision;
}>;

type LocalStudyCapability = Readonly<{
  snapshotRef: ReferenceRecordRef;
  acquisitionRef: ReferenceRecordRef;
  digitalAssetRef: ReferenceRecordRef;
  rightsAssertionRef: ReferenceRecordRef;
  accessDecisionRef: ReferenceRecordRef;
  purpose: string;
}>;

const SAFE_LOCAL_STUDY_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

/**
 * Owner-attested, byte-for-byte private study.
 *
 * This service is the only issuer of its one-use process-private capability.
 * The durable records bind a server-keyed operation identity and the exact
 * opaque Workbench request, but never persist the client operation key.
 */
export class OwnerReferenceLocalStudyService {
  private readonly stagingWriter: OwnerPrivateStudyStagingWriter;
  private readonly stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">;
  private readonly controlledArtifacts: Pick<
    ReferenceSourceControlledArtifactStore,
    "readDigitalAssetBytes"
  >;
  private readonly opaqueProjector: OpaqueProjector;
  private readonly now: () => Date;
  private readonly issuedCapabilities = new WeakSet<object>();
  private readonly gateway: ReferenceSourceOperationGateway;

  constructor(options: OwnerReferenceLocalStudyServiceOptions) {
    this.stagingWriter = options.stagingWriter;
    this.stagingStore = options.stagingStore;
    this.controlledArtifacts = options.controlledArtifacts;
    this.opaqueProjector = options.opaqueProjector;
    this.now = options.now ?? (() => new Date());
    this.gateway = new ReferenceSourceOperationGateway({
      stagingStore: this.stagingStore,
      verifyAllowCapability: (input) => this.verifyCapability(input),
      now: this.now,
    });
  }

  async execute(
    input: OwnerReferenceLocalStudyExecutionInput,
    sink: OwnerReferenceLocalStudySink
  ): Promise<OwnerReferenceLocalStudyExecutionResult> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(OwnerReferenceWorkbenchLocalStudyRequestSchema, input.request);
    const mediaType = normalizeSafeMediaType(input.digitalAsset.mediaType);
    const identity = this.authorizationIdentity(request);
    let state = this.readCurrentState();
    let pair = locateAuthorizationPair(state.snapshot.records, identity);
    let replayed = false;

    if (pair) {
      assertExactAuthorizationPair(pair, identity, input.acquisition, request);
      replayed = true;
    } else {
      if (hasAuthorizationResidue(state.snapshot.records, identity)) {
        throw new OwnerReferenceLocalStudyConflictError();
      }
      if (
        !refsEqual(request.snapshotRef, input.currentWorkbenchSnapshotRef) ||
        !refsEqual(refFor(state.snapshot), input.currentStagingSnapshotRef)
      ) {
        throw new OwnerReferenceLocalStudyStaleError();
      }
      assertCurrentSource(state, input.acquisition, input.digitalAsset, this.now().toISOString());
      const committedAuthorization = this.commitAuthorization(
        identity,
        input.acquisition,
        request,
        state
      );
      pair = committedAuthorization.pair;
      replayed = committedAuthorization.replayed;
      state = this.readCurrentState();
      const committed = locateAuthorizationPair(state.snapshot.records, identity);
      if (!committed) throw new OwnerReferenceLocalStudyUnavailableError();
      assertExactAuthorizationPair(committed, identity, input.acquisition, request);
      pair = committed;
    }

    const effectiveAt = this.now().toISOString();
    assertCurrentSource(state, input.acquisition, input.digitalAsset, effectiveAt);
    assertExactAuthorizationPair(pair, identity, input.acquisition, request);
    assertAuthorizationPairCurrentAndApplicable(state.snapshot.records, pair, effectiveAt);
    const capability: LocalStudyCapability = Object.freeze({
      snapshotRef: refFor(state.snapshot),
      acquisitionRef: refFor(input.acquisition),
      digitalAssetRef: refFor(input.digitalAsset),
      rightsAssertionRef: refFor(pair.rights),
      accessDecisionRef: refFor(pair.decision),
      purpose: request.purpose,
    });
    this.issuedCapabilities.add(capability);
    let sinkInvoked = false;
    const effects: ReferenceSourceOperationEffects = {
      readControlledBytes: (digitalAssetRef) =>
        this.controlledArtifacts.readDigitalAssetBytes(digitalAssetRef),
      writeSink: async ({ bytes, operation, destination, purpose }) => {
        if (
          sinkInvoked ||
          operation !== "owner_private_study" ||
          destination.kind !== "local_runtime" ||
          destination.id !== undefined ||
          purpose !== request.purpose
        ) {
          throw new OwnerReferenceLocalStudyUnavailableError();
        }
        sinkInvoked = true;
        await sink({ bytes: new Uint8Array(bytes), mediaType });
      },
    };

    try {
      const result = await this.gateway.execute(
        {
          schemaVersion: 1,
          acquisitionRef: refFor(input.acquisition),
          operation: "owner_private_study",
          destination: { kind: "local_runtime" },
          purpose: request.purpose,
        },
        effects,
        capability
      );
      if (
        result.status !== "allow" ||
        result.reasonCode !== "verified_allow_capability" ||
        !sinkInvoked
      ) {
        throw new OwnerReferenceLocalStudyUnavailableError();
      }
    } finally {
      this.issuedCapabilities.delete(capability);
    }

    return Object.freeze({
      status: "executed",
      replayed,
      rightsAssertionRef: refFor(pair.rights),
      accessDecisionRef: refFor(pair.decision),
    });
  }

  private commitAuthorization(
    identity: AuthorizationIdentity,
    acquisition: ReferenceAssetAcquisition,
    request: OwnerReferenceWorkbenchLocalStudyRequest,
    state: ReferenceSourceStagingState
  ): Readonly<{ pair: AuthorizationPair; replayed: boolean }> {
    const decidedAt = this.now().toISOString();
    const rights = withReferenceRecordDigest({
      recordKind: "rights_assertion" as const,
      id: identity.rightsId,
      version: 1,
      subjectRef: refFor(acquisition),
      subjectKind: "asset_acquisition" as const,
      rightsKind: "owner_private_access" as const,
      status: "permitted" as const,
      claimant: {
        kind: "owner" as const,
        claimantRef: OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF,
      },
      evidenceRefs: [identity.scopeEvidenceRef],
      assertedAt: decidedAt,
    }) as ReferenceRightsAssertion;
    const decision = withReferenceRecordDigest({
      recordKind: "access_decision" as const,
      id: identity.decisionId,
      version: 1,
      outcome: "allow" as const,
      operation: "owner_private_study" as const,
      sourceRefs: [refFor(acquisition)],
      derivativeRefs: [],
      destination: { kind: "local_runtime" as const },
      purpose: request.purpose,
      policyRef: OWNER_PRIVATE_LOCAL_STUDY_POLICY_REF,
      rightsAssertionRefs: [refFor(rights)],
      authorityRefs: [OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF],
      rationale: OWNER_PRIVATE_LOCAL_STUDY_RATIONALE,
      decidedAt,
    }) as ReferenceAccessDecision;
    const transaction: ReferenceSourceStagingTransaction = {
      schemaVersion: 1,
      id: `transaction.owner-private-study.${identity.suffix}`,
      expectedHeadRef: refFor(state.snapshot),
      operations: [rights, decision].map((record) => ({ type: "append_record", record })),
      submittedAt: decidedAt,
    };

    try {
      this.stagingWriter.applyTransaction(transaction);
      return { pair: { rights, decision }, replayed: false };
    } catch {
      const raced = this.readCurrentState();
      const existing = locateAuthorizationPair(raced.snapshot.records, identity);
      if (existing) {
        assertExactAuthorizationPair(existing, identity, acquisition, request);
        return { pair: existing, replayed: true };
      }
      if (hasAuthorizationResidue(raced.snapshot.records, identity)) {
        throw new OwnerReferenceLocalStudyConflictError();
      }
      throw new OwnerReferenceLocalStudyStaleError();
    }
  }

  private authorizationIdentity(
    request: OwnerReferenceWorkbenchLocalStudyRequest
  ): AuthorizationIdentity {
    const operationCommitment = this.opaqueProjector.project(
      "local-study-operation-key",
      request.operationKey
    );
    const scopeEvidenceRef = this.opaqueProjector.project("local-study-scope", {
      operationCommitment,
      snapshotRef: request.snapshotRef,
      cardRef: request.cardRef,
      operation: request.operation,
      purpose: request.purpose,
      authorization: request.authorization,
    });
    const suffix = operationCommitment.digest.slice(0, 32);
    return {
      suffix,
      rightsId: `rights-assertion.owner-private-study.${suffix}`,
      decisionId: `access-decision.owner-private-study.${suffix}`,
      scopeEvidenceRef,
    };
  }

  private verifyCapability(input: {
    scope: ReferenceSourceOperationScope;
    capability: unknown;
  }): boolean {
    if (
      typeof input.capability !== "object" ||
      input.capability === null ||
      !this.issuedCapabilities.has(input.capability)
    ) {
      return false;
    }
    const capability = input.capability as LocalStudyCapability;
    if (
      !refsEqual(input.scope.snapshotRef, capability.snapshotRef) ||
      !refsEqual(input.scope.acquisitionRef, capability.acquisitionRef) ||
      !refsEqual(input.scope.digitalAssetRef, capability.digitalAssetRef) ||
      input.scope.operation !== "owner_private_study" ||
      input.scope.destination.kind !== "local_runtime" ||
      input.scope.destination.id !== undefined ||
      input.scope.purpose !== capability.purpose
    ) {
      return false;
    }
    let state: ReferenceSourceStagingState;
    try {
      state = this.readCurrentState();
    } catch {
      return false;
    }
    if (!refsEqual(refFor(state.snapshot), capability.snapshotRef)) return false;
    const rights = state.snapshot.records.find(
      (record): record is ReferenceRightsAssertion =>
        record.recordKind === "rights_assertion" && refsEqual(record, capability.rightsAssertionRef)
    );
    const decision = state.snapshot.records.find(
      (record): record is ReferenceAccessDecision =>
        record.recordKind === "access_decision" && refsEqual(record, capability.accessDecisionRef)
    );
    return (
      rights !== undefined &&
      decision !== undefined &&
      authorizationPairIsCurrentAndApplicable(
        state.snapshot.records,
        { rights, decision },
        this.now().toISOString()
      ) &&
      decision.outcome === "allow" &&
      decision.operation === "owner_private_study" &&
      decision.sourceRefs.length === 1 &&
      refsEqual(decision.sourceRefs[0]!, capability.acquisitionRef) &&
      decision.derivativeRefs.length === 0 &&
      decision.rightsAssertionRefs.length === 1 &&
      refsEqual(decision.rightsAssertionRefs[0]!, rights) &&
      decision.authorityRefs.length === 1 &&
      refsEqual(decision.authorityRefs[0]!, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF)
    );
  }

  private readCurrentState(): ReferenceSourceStagingState {
    try {
      const state = this.stagingStore.readCurrentState();
      if (!state) throw new Error("missing staging state");
      assertReferenceSourceStagingSnapshotIntegrity(state.snapshot);
      if (
        state.head.snapshotId !== state.snapshot.id ||
        state.head.digest !== state.snapshot.digest ||
        state.head.revision !== state.snapshot.revision
      ) {
        throw new Error("incoherent staging state");
      }
      return state;
    } catch {
      throw new OwnerReferenceLocalStudyUnavailableError();
    }
  }
}

function locateAuthorizationPair(
  records: readonly ReferenceSourceStagingRecord[],
  identity: AuthorizationIdentity
): AuthorizationPair | null {
  const rights = records.find(({ id }) => id === identity.rightsId);
  const decision = records.find(({ id }) => id === identity.decisionId);
  if (!rights && !decision) return null;
  if (rights?.recordKind !== "rights_assertion" || decision?.recordKind !== "access_decision") {
    return null;
  }
  return { rights, decision };
}

function hasAuthorizationResidue(
  records: readonly ReferenceSourceStagingRecord[],
  identity: AuthorizationIdentity
): boolean {
  return records.some(({ id }) => id === identity.rightsId || id === identity.decisionId);
}

function assertExactAuthorizationPair(
  pair: AuthorizationPair,
  identity: AuthorizationIdentity,
  acquisition: ReferenceAssetAcquisition,
  request: OwnerReferenceWorkbenchLocalStudyRequest
): void {
  const rights = pair.rights;
  const decision = pair.decision;
  const exact =
    verifyReferenceRecordDigest(rights) &&
    verifyReferenceRecordDigest(decision) &&
    rights.id === identity.rightsId &&
    rights.version === 1 &&
    rights.parentVersionRef === undefined &&
    rights.subjectKind === "asset_acquisition" &&
    refsEqual(rights.subjectRef, acquisition) &&
    rights.rightsKind === "owner_private_access" &&
    rights.status === "permitted" &&
    rights.claimant.kind === "owner" &&
    refsEqual(rights.claimant.claimantRef, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF) &&
    rights.evidenceRefs.length === 1 &&
    refsEqual(rights.evidenceRefs[0]!, identity.scopeEvidenceRef) &&
    rights.validFrom === undefined &&
    rights.validUntil === undefined &&
    decision.id === identity.decisionId &&
    decision.version === 1 &&
    decision.parentVersionRef === undefined &&
    decision.outcome === "allow" &&
    decision.operation === "owner_private_study" &&
    decision.sourceRefs.length === 1 &&
    refsEqual(decision.sourceRefs[0]!, acquisition) &&
    decision.derivativeRefs.length === 0 &&
    decision.destination.kind === "local_runtime" &&
    decision.destination.id === undefined &&
    decision.purpose === request.purpose &&
    decision.assetRole === undefined &&
    refsEqual(decision.policyRef, OWNER_PRIVATE_LOCAL_STUDY_POLICY_REF) &&
    decision.rightsAssertionRefs.length === 1 &&
    refsEqual(decision.rightsAssertionRefs[0]!, rights) &&
    decision.authorityRefs.length === 1 &&
    refsEqual(decision.authorityRefs[0]!, OWNER_LOCAL_STUDY_ATTESTATION_AUTHORITY_REF) &&
    decision.rationale === OWNER_PRIVATE_LOCAL_STUDY_RATIONALE &&
    decision.decidedAt === rights.assertedAt &&
    decision.validUntil === undefined;
  if (!exact) throw new OwnerReferenceLocalStudyConflictError();
}

function assertCurrentSource(
  state: ReferenceSourceStagingState,
  acquisition: ReferenceAssetAcquisition,
  digitalAsset: ReferenceDigitalAsset,
  effectiveAt: string
): void {
  if (
    !referenceSourceAcquisitionIsCurrentAndApplicable(
      state.snapshot.records,
      acquisition,
      digitalAsset,
      effectiveAt
    )
  ) {
    throw new OwnerReferenceLocalStudyUnavailableError();
  }
}

function assertAuthorizationPairCurrentAndApplicable(
  records: readonly ReferenceSourceStagingRecord[],
  pair: AuthorizationPair,
  effectiveAt: string
): void {
  if (!authorizationPairIsCurrentAndApplicable(records, pair, effectiveAt)) {
    throw new OwnerReferenceLocalStudyUnavailableError();
  }
}

function authorizationPairIsCurrentAndApplicable(
  records: readonly ReferenceSourceStagingRecord[],
  pair: AuthorizationPair,
  effectiveAt: string
): boolean {
  const effectiveTime = Date.parse(effectiveAt);
  if (!Number.isFinite(effectiveTime)) return false;
  const currentRights = latestEffectiveVersion(
    records.filter(
      (record): record is ReferenceRightsAssertion =>
        record.recordKind === "rights_assertion" &&
        record.id === pair.rights.id &&
        Date.parse(record.assertedAt) <= effectiveTime
    )
  );
  const currentDecision = latestEffectiveVersion(
    records.filter(
      (record): record is ReferenceAccessDecision =>
        record.recordKind === "access_decision" &&
        record.id === pair.decision.id &&
        Date.parse(record.decidedAt) <= effectiveTime
    )
  );
  return (
    currentRights !== undefined &&
    currentDecision !== undefined &&
    refsEqual(currentRights, pair.rights) &&
    refsEqual(currentDecision, pair.decision) &&
    !recordIsInvalidated(records, pair.rights, effectiveTime) &&
    !recordIsInvalidated(records, pair.decision, effectiveTime) &&
    Date.parse(pair.rights.assertedAt) <= effectiveTime &&
    (pair.rights.validFrom === undefined || Date.parse(pair.rights.validFrom) <= effectiveTime) &&
    (pair.rights.validUntil === undefined || Date.parse(pair.rights.validUntil) > effectiveTime) &&
    Date.parse(pair.decision.decidedAt) <= effectiveTime &&
    (pair.decision.validUntil === undefined || Date.parse(pair.decision.validUntil) > effectiveTime)
  );
}

function latestEffectiveVersion<T extends { version: number; digest: string }>(
  records: readonly T[]
): T | undefined {
  return [...records].sort(
    (left, right) => right.version - left.version || right.digest.localeCompare(left.digest)
  )[0];
}

function recordIsInvalidated(
  records: readonly ReferenceSourceStagingRecord[],
  record: { id: string; digest: string },
  effectiveTime: number
): boolean {
  return records.some(
    (candidate) =>
      candidate.recordKind === "invalidation" &&
      Date.parse(candidate.invalidatedAt) <= effectiveTime &&
      refsEqual(candidate.invalidatedRef, record)
  );
}

function normalizeSafeMediaType(value: string): string {
  const normalized = value.split(";", 1)[0]!.trim().toLowerCase();
  if (!SAFE_LOCAL_STUDY_MEDIA_TYPES.has(normalized)) {
    throw new OwnerReferenceLocalStudyUnsupportedMediaError();
  }
  return normalized;
}

function refFor(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refsEqual(left: { id: string; digest: string }, right: { id: string; digest: string }) {
  return left.id === right.id && left.digest === right.digest;
}

export class OwnerReferenceLocalStudyConflictError extends Error {
  readonly code = "owner_reference_local_study_operation_conflict" as const;

  constructor() {
    super("The local-study operation key is already bound to a different exact request");
    this.name = "OwnerReferenceLocalStudyConflictError";
  }
}

export class OwnerReferenceLocalStudyStaleError extends Error {
  readonly code = "owner_reference_local_study_snapshot_stale" as const;

  constructor() {
    super("The Owner-reference Workbench changed before local study was authorized");
    this.name = "OwnerReferenceLocalStudyStaleError";
  }
}

export class OwnerReferenceLocalStudyUnsupportedMediaError extends Error {
  readonly code = "owner_reference_local_study_media_unsupported" as const;

  constructor() {
    super("The selected Owner reference is not a supported local-study document or image");
    this.name = "OwnerReferenceLocalStudyUnsupportedMediaError";
  }
}

export class OwnerReferenceLocalStudyUnavailableError extends Error {
  readonly code = "owner_reference_local_study_unavailable" as const;

  constructor() {
    super("The Owner-private local-study view is unavailable");
    this.name = "OwnerReferenceLocalStudyUnavailableError";
  }
}
