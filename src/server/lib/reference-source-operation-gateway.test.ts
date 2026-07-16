import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import {
  withReferenceRecordDigest,
  type ReferenceAccessDestination,
  type ReferenceAccessOperation,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceOperationGateway,
  ReferenceSourceOperationRequestError,
  referenceSourceAcquisitionIsCurrentAndApplicable,
  type ReferenceSourceOperationEffects,
  type ReferenceSourceOperationRequest,
} from "./reference-source-operation-gateway.js";
import type { ReferenceSourceStagingState } from "./reference-source-staging-store.js";

const NOW = "2026-07-16T12:00:00.000Z";
const PRIVATE_CANARY = "PRIVATE-SOURCE-PATH-AND-TITLE-CANARY";
const CONTROLLED_BYTES = new TextEncoder().encode("%PDF-1.7\ncontrolled fixture\n");

describe("reference-source owner-private operation gateway", () => {
  it.each<{
    operation: ReferenceAccessOperation;
    destination: ReferenceAccessDestination;
    status: "deny" | "review_required";
    reasonCode: "owner_private_default_denied" | "owner_private_local_review_required";
  }>([
    {
      operation: "underlying_work_use",
      destination: { kind: "local_runtime" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "manifestation_use",
      destination: { kind: "local_runtime" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "exemplar_access",
      destination: { kind: "local_runtime" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "scan_provider_use",
      destination: { kind: "local_runtime" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "provider_model_processing",
      destination: { kind: "provider", id: "provider.test" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "provider_ocr",
      destination: { kind: "provider", id: "provider.test" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "provider_omr",
      destination: { kind: "provider", id: "provider.test" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "provider_translation",
      destination: { kind: "provider", id: "provider.test" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "pack_citation",
      destination: { kind: "repository", id: "repository.pack" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "pack_excerpt",
      destination: { kind: "repository", id: "repository.pack" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "fixture_inclusion",
      destination: { kind: "repository", id: "repository.fixture" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "repository_inclusion",
      destination: { kind: "repository", id: "repository.source" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "export",
      destination: { kind: "export", id: "export.bundle" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "redistribution",
      destination: { kind: "recipient", id: "recipient.test" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "report",
      destination: { kind: "local_runtime" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "log",
      destination: { kind: "local_runtime" },
      status: "deny",
      reasonCode: "owner_private_default_denied",
    },
    {
      operation: "owner_private_study",
      destination: { kind: "local_runtime" },
      status: "review_required",
      reasonCode: "owner_private_local_review_required",
    },
    {
      operation: "local_extraction",
      destination: { kind: "local_runtime" },
      status: "review_required",
      reasonCode: "owner_private_local_review_required",
    },
  ])(
    "defaults $operation to $status without reading bytes or invoking its sink",
    async ({ operation, destination, status, reasonCode }) => {
      const state = stagingState();
      const readCurrentState = vi.fn(() => state);
      const effects = effectSpies();
      const gateway = new ReferenceSourceOperationGateway({
        stagingStore: { readCurrentState },
      });

      const result = await gateway.execute(
        request(operation, destination, PRIVATE_CANARY),
        effects
      );

      expect(result).toEqual({
        schemaVersion: 1,
        acquisitionId: "acquisition.owner-private.opaque-1",
        snapshotId: "snapshot.owner-private.1",
        operation,
        status,
        reasonCode,
      });
      expect(Object.keys(result).sort()).toEqual(
        ["acquisitionId", "operation", "reasonCode", "schemaVersion", "snapshotId", "status"].sort()
      );
      expect(JSON.stringify(result)).not.toContain(PRIVATE_CANARY);
      expect(JSON.stringify(result)).not.toContain(state.snapshot.digest);
      expect(JSON.stringify(result)).not.toContain("asset.private-source-canary");
      expect(readCurrentState).toHaveBeenCalledTimes(1);
      expect(effects.readControlledBytes).not.toHaveBeenCalled();
      expect(effects.writeSink).not.toHaveBeenCalled();
    }
  );

  it("fails closed on an inexact acquisition or incompatible destination", async () => {
    const state = stagingState();
    const effects = effectSpies();
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState: () => state },
    });

    const mismatched = await gateway.execute(
      {
        ...request("export", { kind: "export", id: "export.bundle" }, "bounded purpose"),
        acquisitionRef: {
          id: "acquisition.owner-private.opaque-1",
          digest: "f".repeat(64),
        },
      },
      effects
    );
    const incompatible = await gateway.execute(
      request("report", { kind: "export", id: "export.bundle" }, "bounded purpose"),
      effects
    );

    expect(mismatched).toMatchObject({
      status: "deny",
      reasonCode: "reference_not_found_or_mismatched",
    });
    expect(incompatible).toMatchObject({
      status: "deny",
      reasonCode: "operation_destination_invalid",
    });
    expect(effects.readControlledBytes).not.toHaveBeenCalled();
    expect(effects.writeSink).not.toHaveBeenCalled();
  });

  it("does not resurrect a superseded acquisition when its replacement is invalidated", () => {
    const state = stagingState();
    const acquisition = state.snapshot.records.find(
      (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
    )!;
    const asset = state.snapshot.records.find(
      (record): record is ReferenceDigitalAsset => record.recordKind === "digital_asset"
    )!;
    const replacement = withReferenceRecordDigest({
      ...acquisition,
      id: `${acquisition.id}.replacement`,
      supersedesAcquisitionRef: ref(acquisition),
      digest: undefined,
    }) as ReferenceAssetAcquisition;
    const dependency = withReferenceRecordDigest({
      recordKind: "dependency_edge" as const,
      id: "dependency.replacement-invalidation",
      dependencyRef: externalRef("rights.replacement-basis"),
      dependentRef: ref(replacement),
      scope: "rights" as const,
      reason: "The replacement depended on a later-invalidated basis",
      createdAt: NOW,
    });
    const invalidation = withReferenceRecordDigest({
      recordKind: "invalidation" as const,
      id: "invalidation.replacement",
      triggerRef: dependency.dependencyRef,
      invalidatedRef: ref(replacement),
      dependencyEdgeRefs: [ref(dependency)],
      dependencyPath: [dependency.dependencyRef, ref(replacement)],
      scope: "rights" as const,
      reason: "The replacement is no longer applicable",
      invalidatedAt: NOW,
    });

    expect(
      referenceSourceAcquisitionIsCurrentAndApplicable(
        [...state.snapshot.records, replacement, dependency, invalidation],
        acquisition,
        asset,
        NOW
      )
    ).toBe(false);
  });

  it("rejects malformed free-form scope with a bounded error before reading staging or effects", async () => {
    const readCurrentState = vi.fn(() => stagingState());
    const effects = effectSpies();
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState },
    });

    await expect(
      gateway.execute(request("owner_private_study", { kind: "local_runtime" }, "   "), effects)
    ).rejects.toEqual(expect.any(ReferenceSourceOperationRequestError));
    expect(readCurrentState).not.toHaveBeenCalled();
    expect(effects.readControlledBytes).not.toHaveBeenCalled();
    expect(effects.writeSink).not.toHaveBeenCalled();
  });

  it("keeps effects sealed for absent, rejecting, or failed capability verification", async () => {
    const state = stagingState();
    const effects = effectSpies();
    const rejectCapability = vi.fn(() => false);
    const rejectingGateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState: () => state },
      verifyAllowCapability: rejectCapability,
    });

    const denied = await rejectingGateway.execute(
      request("export", { kind: "export", id: "export.bundle" }, "bounded purpose"),
      effects,
      { forged: true }
    );
    expect(denied).toMatchObject({
      status: "deny",
      reasonCode: "owner_private_default_denied",
    });
    expect(rejectCapability).toHaveBeenCalledTimes(1);

    const failedGateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState: () => state },
      verifyAllowCapability: () => {
        throw new Error(PRIVATE_CANARY);
      },
    });
    const failed = await failedGateway.execute(
      request("local_extraction", { kind: "local_runtime" }, "bounded purpose"),
      effects,
      { forged: true }
    );
    expect(failed).toMatchObject({
      status: "review_required",
      reasonCode: "owner_private_local_review_required",
    });
    expect(JSON.stringify(failed)).not.toContain(PRIVATE_CANARY);
    expect(effects.readControlledBytes).not.toHaveBeenCalled();
    expect(effects.writeSink).not.toHaveBeenCalled();
  });

  it("releases effects only after a verifier authenticates the exact immutable scope", async () => {
    const state = stagingState();
    const token = Object.freeze({ receiptId: "opaque-receipt-1" });
    const effects = effectSpies();
    const verifyAllowCapability = vi.fn(
      ({
        scope,
        capability,
      }: Parameters<
        NonNullable<
          ConstructorParameters<typeof ReferenceSourceOperationGateway>[0]["verifyAllowCapability"]
        >
      >[0]) =>
        capability === token &&
        scope.snapshotRef.id === state.snapshot.id &&
        scope.snapshotRef.digest === state.snapshot.digest &&
        scope.acquisitionRef.id === "acquisition.owner-private.opaque-1" &&
        scope.operation === "owner_private_study" &&
        scope.destination.kind === "local_runtime" &&
        scope.purpose === "explicit owner-private study"
    );
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState: () => state },
      verifyAllowCapability,
    });

    const allowed = await gateway.execute(
      request("owner_private_study", { kind: "local_runtime" }, "explicit owner-private study"),
      effects,
      token
    );

    expect(allowed).toEqual({
      schemaVersion: 1,
      acquisitionId: "acquisition.owner-private.opaque-1",
      snapshotId: "snapshot.owner-private.1",
      operation: "owner_private_study",
      status: "allow",
      reasonCode: "verified_allow_capability",
    });
    expect(verifyAllowCapability).toHaveBeenCalledTimes(1);
    expect(effects.readControlledBytes).toHaveBeenCalledTimes(1);
    expect(effects.writeSink).toHaveBeenCalledTimes(1);
  });

  it("fails closed before the sink when authenticated storage returns absent or mismatched bytes", async () => {
    const state = stagingState();
    const requestInput = request(
      "owner_private_study",
      { kind: "local_runtime" },
      "explicit owner-private study"
    );
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState: () => state },
      verifyAllowCapability: () => true,
    });

    for (const readControlledBytes of [
      vi.fn(() => new Uint8Array([9, 8, 7])),
      vi.fn(() => {
        throw new Error(PRIVATE_CANARY);
      }),
    ]) {
      const writeSink = vi.fn();
      const denied = await gateway.execute(
        requestInput,
        { readControlledBytes, writeSink },
        { authenticated: true }
      );
      expect(denied).toMatchObject({
        status: "deny",
        reasonCode: "controlled_bytes_unavailable_or_mismatched",
      });
      expect(JSON.stringify(denied)).not.toContain(PRIVATE_CANARY);
      expect(writeSink).not.toHaveBeenCalled();
    }
  });

  it("rechecks the exact staging head immediately before controlled-byte read", async () => {
    const state = stagingState();
    const moved = advancedStagingState(state);
    const readCurrentState = vi
      .fn<() => ReferenceSourceStagingState>()
      .mockReturnValueOnce(state)
      .mockReturnValue(moved);
    const effects = effectSpies();
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState },
      verifyAllowCapability: () => true,
    });

    const denied = await gateway.execute(
      request("owner_private_study", { kind: "local_runtime" }, "bounded private study"),
      effects,
      { authenticated: true }
    );

    expect(denied).toMatchObject({ status: "deny", reasonCode: "staging_snapshot_changed" });
    expect(effects.readControlledBytes).not.toHaveBeenCalled();
    expect(effects.writeSink).not.toHaveBeenCalled();
  });

  it("rechecks the exact staging head after byte verification and immediately before sink", async () => {
    const state = stagingState();
    const moved = advancedStagingState(state);
    const readCurrentState = vi
      .fn<() => ReferenceSourceStagingState>()
      .mockReturnValueOnce(state)
      .mockReturnValueOnce(state)
      .mockReturnValue(moved);
    const effects = effectSpies();
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState },
      verifyAllowCapability: () => true,
    });

    const denied = await gateway.execute(
      request("owner_private_study", { kind: "local_runtime" }, "bounded private study"),
      effects,
      { authenticated: true }
    );

    expect(denied).toMatchObject({ status: "deny", reasonCode: "staging_snapshot_changed" });
    expect(effects.readControlledBytes).toHaveBeenCalledOnce();
    expect(effects.writeSink).not.toHaveBeenCalled();
  });
});

function stagingState(): ReferenceSourceStagingState {
  const asset = withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: "asset.private-source-canary",
    sha256: createHash("sha256").update(CONTROLLED_BYTES).digest("hex"),
    mediaType: "application/pdf",
    byteLength: CONTROLLED_BYTES.byteLength,
  }) as ReferenceDigitalAsset;
  const acquisition = withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: "acquisition.owner-private.opaque-1",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload" as const,
      ownerActionRef: externalRef("owner-action.opaque-1"),
    },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.owner-private"),
  }) as ReferenceAssetAcquisition;
  const core = {
    schemaVersion: 1 as const,
    id: "snapshot.owner-private.1",
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: NOW,
    records: [asset, acquisition],
  };
  const snapshot = withReferenceRecordDigest(core) as ReferenceSourceStagingSnapshot;
  return {
    head: {
      snapshotId: snapshot.id,
      digest: snapshot.digest,
      revision: snapshot.revision,
    },
    snapshot,
  };
}

function advancedStagingState(prior: ReferenceSourceStagingState): ReferenceSourceStagingState {
  const snapshot = withReferenceRecordDigest({
    ...prior.snapshot,
    id: "snapshot.owner-private.2",
    revision: prior.snapshot.revision + 1,
    parentSnapshotRef: ref(prior.snapshot),
    digest: undefined,
  }) as ReferenceSourceStagingSnapshot;
  return {
    head: { snapshotId: snapshot.id, digest: snapshot.digest, revision: snapshot.revision },
    snapshot,
  };
}

function request(
  operation: ReferenceAccessOperation,
  destination: ReferenceAccessDestination,
  purpose: string
): ReferenceSourceOperationRequest {
  const state = stagingState();
  const acquisition = state.snapshot.records.find(
    (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
  );
  if (!acquisition) throw new Error("Expected an acquisition fixture");
  return {
    schemaVersion: 1,
    acquisitionRef: ref(acquisition),
    operation,
    destination,
    purpose,
  };
}

function effectSpies() {
  return {
    readControlledBytes: vi.fn(() => new Uint8Array(CONTROLLED_BYTES)),
    writeSink: vi.fn((_input: Parameters<ReferenceSourceOperationEffects["writeSink"]>[0]) => {}),
  } satisfies ReferenceSourceOperationEffects;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}
