import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createHash } from "node:crypto";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  REFERENCE_ACCESS_OPERATION_DESTINATIONS,
  ReferenceAccessDestinationSchema,
  ReferenceAccessOperationSchema,
  ReferenceRecordRefSchema,
  type ReferenceAccessDestination,
  type ReferenceAccessOperation,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingRecord,
} from "../../lib/reference-source-domain.js";
import { assertReferenceSourceStagingSnapshotIntegrity } from "./reference-source-staging-service.js";
import type {
  ReferenceSourceStagingState,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

const Strict = { additionalProperties: false } as const;

export const ReferenceSourceOperationRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    acquisitionRef: ReferenceRecordRefSchema,
    operation: ReferenceAccessOperationSchema,
    destination: ReferenceAccessDestinationSchema,
    purpose: Type.String({ minLength: 1, maxLength: 512, pattern: "\\S" }),
  },
  Strict
);
export type ReferenceSourceOperationRequest = Static<typeof ReferenceSourceOperationRequestSchema>;

export type ReferenceSourceOperationStatus = "allow" | "deny" | "review_required";

export type ReferenceSourceOperationReasonCode =
  | "owner_private_default_denied"
  | "owner_private_local_review_required"
  | "operation_destination_invalid"
  | "reference_not_found_or_mismatched"
  | "staging_snapshot_unavailable_or_invalid"
  | "staging_snapshot_changed"
  | "controlled_bytes_unavailable_or_mismatched"
  | "verified_allow_capability";

/**
 * Deliberately bounded response. Source titles, paths, byte identities, record
 * digests, destinations, and free-form purposes never cross this boundary.
 */
export type ReferenceSourceOperationResult = Readonly<{
  schemaVersion: 1;
  acquisitionId: string;
  snapshotId: string | null;
  operation: ReferenceAccessOperation;
  status: ReferenceSourceOperationStatus;
  reasonCode: ReferenceSourceOperationReasonCode;
}>;

export type ReferenceSourceOperationScope = Readonly<{
  snapshotRef: ReferenceRecordRef;
  acquisitionRef: ReferenceRecordRef;
  digitalAssetRef: ReferenceRecordRef;
  operation: ReferenceAccessOperation;
  destination: ReferenceAccessDestination;
  purpose: string;
}>;

export type ReferenceSourceAllowCapabilityVerifier = (input: {
  scope: ReferenceSourceOperationScope;
  capability: unknown;
}) => boolean | Promise<boolean>;

export type ReferenceSourceOperationEffects = {
  readControlledBytes: (digitalAssetRef: ReferenceRecordRef) => Uint8Array | Promise<Uint8Array>;
  writeSink: (input: {
    bytes: Uint8Array;
    operation: ReferenceAccessOperation;
    destination: ReferenceAccessDestination;
    purpose: string;
  }) => void | Promise<void>;
};

export type ReferenceSourceOperationGatewayOptions = {
  stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">;
  /**
   * No verifier means no allow path. A later authority tracer can inject a
   * verifier backed by a server-authenticated, exact-scope allow receipt.
   */
  verifyAllowCapability?: ReferenceSourceAllowCapabilityVerifier;
  now?: () => Date;
};

export class ReferenceSourceOperationRequestError extends Error {
  readonly code = "reference_source_operation_request_invalid" as const;

  constructor() {
    super("reference_source_operation_request_invalid");
    this.name = "ReferenceSourceOperationRequestError";
  }
}

/**
 * Single fail-closed boundary between owner-private staging records and any
 * controlled-byte reader or derivative sink.
 *
 * Each execution captures exactly one self-consistent immutable staging state.
 * Default policy never touches either effect. An allow path exists only when a
 * separately supplied verifier authenticates a capability over the exact
 * snapshot, acquisition, operation, destination, and purpose scope.
 */
export class ReferenceSourceOperationGateway {
  private readonly stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">;
  private readonly verifyAllowCapability: ReferenceSourceAllowCapabilityVerifier | undefined;
  private readonly now: () => Date;

  constructor(options: ReferenceSourceOperationGatewayOptions) {
    this.stagingStore = options.stagingStore;
    this.verifyAllowCapability = options.verifyAllowCapability;
    this.now = options.now ?? (() => new Date());
  }

  async execute(
    request: ReferenceSourceOperationRequest,
    effects: ReferenceSourceOperationEffects,
    allowCapability?: unknown
  ): Promise<ReferenceSourceOperationResult> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = decodeRequest(request);
    const invalidDestination = !destinationIsExactAndCompatible(
      decoded.operation,
      decoded.destination
    );
    const captured = this.captureCurrentState();

    if (!captured) {
      return result(decoded, null, "deny", "staging_snapshot_unavailable_or_invalid");
    }
    if (invalidDestination) {
      return result(decoded, captured.snapshot.id, "deny", "operation_destination_invalid");
    }

    const acquisition = captured.snapshot.records.find(
      (record): record is ReferenceAssetAcquisition =>
        record.recordKind === "asset_acquisition" &&
        record.id === decoded.acquisitionRef.id &&
        record.digest === decoded.acquisitionRef.digest
    );
    if (!acquisition) {
      return result(decoded, captured.snapshot.id, "deny", "reference_not_found_or_mismatched");
    }
    const digitalAsset = captured.snapshot.records.find(
      (record): record is ReferenceDigitalAsset =>
        record.recordKind === "digital_asset" &&
        record.id === acquisition.digitalAssetRef.id &&
        record.digest === acquisition.digitalAssetRef.digest
    );
    if (!digitalAsset) {
      return result(decoded, captured.snapshot.id, "deny", "reference_not_found_or_mismatched");
    }
    if (
      !referenceSourceAcquisitionIsCurrentAndApplicable(
        captured.snapshot.records,
        acquisition,
        digitalAsset,
        this.now().toISOString()
      )
    ) {
      return result(decoded, captured.snapshot.id, "deny", "reference_not_found_or_mismatched");
    }

    const defaultResult = privateDefaultResult(decoded, captured.snapshot.id);
    if (allowCapability === undefined || !this.verifyAllowCapability) return defaultResult;

    const scope: ReferenceSourceOperationScope = Object.freeze({
      snapshotRef: Object.freeze({
        id: captured.snapshot.id,
        digest: captured.snapshot.digest,
      }),
      acquisitionRef: Object.freeze({ ...decoded.acquisitionRef }),
      digitalAssetRef: Object.freeze({ ...acquisition.digitalAssetRef }),
      operation: decoded.operation,
      destination: Object.freeze({ ...decoded.destination }),
      purpose: decoded.purpose,
    });

    let verified = false;
    try {
      verified = await this.verifyAllowCapability({ scope, capability: allowCapability });
    } catch {
      return defaultResult;
    }
    if (!verified) return defaultResult;
    if (!this.currentStateMatches(captured)) {
      return result(decoded, captured.snapshot.id, "deny", "staging_snapshot_changed");
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await effects.readControlledBytes(scope.digitalAssetRef));
    } catch {
      return result(
        decoded,
        captured.snapshot.id,
        "deny",
        "controlled_bytes_unavailable_or_mismatched"
      );
    }
    if (
      bytes.byteLength !== digitalAsset.byteLength ||
      createHash("sha256").update(bytes).digest("hex") !== digitalAsset.sha256
    ) {
      return result(
        decoded,
        captured.snapshot.id,
        "deny",
        "controlled_bytes_unavailable_or_mismatched"
      );
    }
    if (!this.currentStateMatches(captured)) {
      return result(decoded, captured.snapshot.id, "deny", "staging_snapshot_changed");
    }
    await effects.writeSink({
      bytes,
      operation: scope.operation,
      destination: scope.destination,
      purpose: scope.purpose,
    });
    return result(decoded, captured.snapshot.id, "allow", "verified_allow_capability");
  }

  private captureCurrentState(): ReferenceSourceStagingState | null {
    let state: ReferenceSourceStagingState | null;
    try {
      state = this.stagingStore.readCurrentState();
      if (!state) return null;
      assertReferenceSourceStagingSnapshotIntegrity(state.snapshot);
      if (
        state.head.snapshotId !== state.snapshot.id ||
        state.head.digest !== state.snapshot.digest ||
        state.head.revision !== state.snapshot.revision
      ) {
        return null;
      }
    } catch {
      return null;
    }
    return state;
  }

  private currentStateMatches(expected: ReferenceSourceStagingState): boolean {
    const current = this.captureCurrentState();
    return (
      current !== null &&
      current.head.snapshotId === expected.head.snapshotId &&
      current.head.digest === expected.head.digest &&
      current.head.revision === expected.head.revision &&
      current.snapshot.id === expected.snapshot.id &&
      current.snapshot.digest === expected.snapshot.digest &&
      current.snapshot.revision === expected.snapshot.revision
    );
  }
}

/**
 * Prove that an exact acquisition still denotes an active controlled asset at
 * one execution instant. Presence is insufficient: invalidation and a live
 * superseding acquisition both retire the old source from effectful use.
 */
export function referenceSourceAcquisitionIsCurrentAndApplicable(
  records: readonly ReferenceSourceStagingRecord[],
  acquisition: ReferenceAssetAcquisition,
  digitalAsset: ReferenceDigitalAsset,
  effectiveAt: string
): boolean {
  const effectiveTime = Date.parse(effectiveAt);
  if (!Number.isFinite(effectiveTime)) return false;
  const exactAcquisition = records.some(
    (record) => record.recordKind === "asset_acquisition" && refsEqual(record, acquisition)
  );
  const exactAsset = records.some(
    (record) => record.recordKind === "digital_asset" && refsEqual(record, digitalAsset)
  );
  if (
    !exactAcquisition ||
    !exactAsset ||
    !refsEqual(acquisition.digitalAssetRef, digitalAsset) ||
    Date.parse(acquisition.acquiredAt) > effectiveTime ||
    recordIsInvalidated(records, acquisition, effectiveTime) ||
    recordIsInvalidated(records, digitalAsset, effectiveTime)
  ) {
    return false;
  }
  return !records.some(
    (record) =>
      record.recordKind === "asset_acquisition" &&
      record.supersedesAcquisitionRef !== undefined &&
      refsEqual(record.supersedesAcquisitionRef, acquisition) &&
      Date.parse(record.acquiredAt) <= effectiveTime
  );
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

function refsEqual(left: { id: string; digest: string }, right: { id: string; digest: string }) {
  return left.id === right.id && left.digest === right.digest;
}

function decodeRequest(request: ReferenceSourceOperationRequest): ReferenceSourceOperationRequest {
  try {
    return Value.Decode(ReferenceSourceOperationRequestSchema, request);
  } catch {
    throw new ReferenceSourceOperationRequestError();
  }
}

function destinationIsExactAndCompatible(
  operation: ReferenceAccessOperation,
  destination: ReferenceAccessDestination
): boolean {
  if (destination.kind === "local_runtime") {
    if (destination.id !== undefined) return false;
  } else if (!destination.id || destination.id.trim().length === 0) {
    return false;
  }
  return REFERENCE_ACCESS_OPERATION_DESTINATIONS[operation].some(
    (permitted) => permitted === destination.kind
  );
}

function privateDefaultResult(
  request: ReferenceSourceOperationRequest,
  snapshotId: string
): ReferenceSourceOperationResult {
  if (request.operation === "owner_private_study" || request.operation === "local_extraction") {
    return result(request, snapshotId, "review_required", "owner_private_local_review_required");
  }
  return result(request, snapshotId, "deny", "owner_private_default_denied");
}

function result(
  request: ReferenceSourceOperationRequest,
  snapshotId: string | null,
  status: ReferenceSourceOperationStatus,
  reasonCode: ReferenceSourceOperationReasonCode
): ReferenceSourceOperationResult {
  return Object.freeze({
    schemaVersion: 1,
    acquisitionId: request.acquisitionRef.id,
    snapshotId,
    operation: request.operation,
    status,
    reasonCode,
  });
}
