import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceDependencyEdge,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingInputRecord,
} from "../../lib/reference-source-domain.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import {
  OwnerReferenceLocalStudyConflictError,
  OwnerReferenceLocalStudyService,
  OwnerReferenceLocalStudyStaleError,
  OwnerReferenceLocalStudyUnavailableError,
} from "./owner-reference-local-study-service.js";
import { OwnerReferenceWorkbenchOpaqueProjector } from "./owner-reference-workbench-service.js";
import {
  createOwnerPrivateStudyStagingWriter,
  ReferenceSourceStagingService,
} from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

const NOW = "2026-07-16T12:00:00.000Z";
const LATER = "2026-07-16T13:00:00.000Z";
const OPERATION_KEY = `owner-local-study.v1.${"A".repeat(22)}`;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("OwnerReferenceLocalStudyService", () => {
  it.each(["upload", "migrated"] as const)(
    "executes and restart-replays one exact %s authorization without duplicate records",
    async (origin) => {
      const harness = createHarness(origin);
      const sink = vi.fn();

      const first = await harness.service.execute(harness.input, sink);
      const afterFirst = harness.staging.readCurrent().snapshot!;
      const restarted = new OwnerReferenceLocalStudyService({
        stagingWriter: createOwnerPrivateStudyStagingWriter(harness.staging),
        stagingStore: harness.staging.store,
        controlledArtifacts: new ReferenceSourceControlledArtifactStore({
          rootDirectory: harness.controlledRoot,
        }),
        opaqueProjector: new OwnerReferenceWorkbenchOpaqueProjector(Buffer.alloc(32, 0x41)),
        now: () => new Date("2026-07-16T13:00:00.000Z"),
      });
      const replay = await restarted.execute(
        {
          ...harness.input,
          currentWorkbenchSnapshotRef: harness.projector.project("snapshot", "new-current"),
          currentStagingSnapshotRef: ref(afterFirst),
        },
        sink
      );
      const afterReplay = harness.staging.readCurrent().snapshot!;

      expect(first).toMatchObject({ status: "executed", replayed: false });
      expect(replay).toMatchObject({
        status: "executed",
        replayed: true,
        rightsAssertionRef: first.rightsAssertionRef,
        accessDecisionRef: first.accessDecisionRef,
      });
      expect(afterReplay).toEqual(afterFirst);
      expect(
        afterReplay.records.filter(({ recordKind }) => recordKind === "rights_assertion")
      ).toHaveLength(1);
      expect(
        afterReplay.records.filter(({ recordKind }) => recordKind === "access_decision")
      ).toHaveLength(1);
      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenLastCalledWith({
        bytes: new Uint8Array(harness.bytes),
        mediaType: "application/pdf",
      });
      expect(JSON.stringify(afterReplay)).not.toContain(OPERATION_KEY);
    }
  );

  it("conflicts when the same operation key is reused for another exact scope", async () => {
    const harness = createHarness("upload");
    await harness.service.execute(harness.input, vi.fn());
    const current = harness.staging.readCurrent().snapshot!;

    await expect(
      harness.service.execute(
        {
          ...harness.input,
          request: { ...harness.input.request, purpose: "A different local-only purpose" },
          currentStagingSnapshotRef: ref(current),
        },
        vi.fn()
      )
    ).rejects.toBeInstanceOf(OwnerReferenceLocalStudyConflictError);
    expect(
      current.records.filter(
        ({ recordKind }) => recordKind === "rights_assertion" || recordKind === "access_decision"
      )
    ).toHaveLength(2);
  });

  it("rejects a stale first request before appending authorization or reading bytes", async () => {
    const harness = createHarness("migrated");
    const sink = vi.fn();
    const read = vi.spyOn(harness.controlled, "readDigitalAssetBytes");

    await expect(
      harness.service.execute(
        {
          ...harness.input,
          request: {
            ...harness.input.request,
            snapshotRef: harness.projector.project("snapshot", "stale"),
          },
        },
        sink
      )
    ).rejects.toBeInstanceOf(OwnerReferenceLocalStudyStaleError);
    expect(
      harness.staging
        .readCurrent()
        .snapshot!.records.filter(
          ({ recordKind }) => recordKind === "rights_assertion" || recordKind === "access_decision"
        )
    ).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });

  it("blocks an exact replay after either authorization record is invalidated", async () => {
    const harness = createHarness("upload");
    const first = await harness.service.execute(harness.input, vi.fn());
    appendAuthorizationInvalidations(harness, first);
    const read = vi.spyOn(harness.controlled, "readDigitalAssetBytes");
    const sink = vi.fn();

    await expect(
      harness.service.execute(
        {
          ...harness.input,
          currentStagingSnapshotRef: ref(harness.staging.readCurrent().snapshot!),
        },
        sink
      )
    ).rejects.toBeInstanceOf(OwnerReferenceLocalStudyUnavailableError);
    expect(read).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });

  it("blocks byte read and sink when authorization is invalidated after capability issuance", async () => {
    const harness = createHarness("upload");
    const first = await harness.service.execute(harness.input, vi.fn());
    let stateReads = 0;
    let advanced = false;
    const racingService = new OwnerReferenceLocalStudyService({
      stagingWriter: createOwnerPrivateStudyStagingWriter(harness.staging),
      stagingStore: {
        readCurrentState: () => {
          stateReads += 1;
          if (stateReads === 3 && !advanced) {
            advanced = true;
            appendAuthorizationInvalidations(harness, first);
          }
          return harness.staging.store.readCurrentState();
        },
      },
      controlledArtifacts: harness.controlled,
      opaqueProjector: harness.projector,
      now: () => new Date(advanced ? LATER : NOW),
    });
    const read = vi.spyOn(harness.controlled, "readDigitalAssetBytes");
    const sink = vi.fn();

    await expect(racingService.execute(harness.input, sink)).rejects.toBeInstanceOf(
      OwnerReferenceLocalStudyUnavailableError
    );
    expect(advanced).toBe(true);
    expect(read).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });

  it.each(["rights", "decision"] as const)(
    "blocks an exact replay after its %s authorization record is superseded",
    async (kind) => {
      const harness = createHarness("migrated");
      const first = await harness.service.execute(harness.input, vi.fn());
      appendAuthorizationSuccessor(harness, first, kind);
      const read = vi.spyOn(harness.controlled, "readDigitalAssetBytes");
      const sink = vi.fn();

      await expect(
        harness.service.execute(
          {
            ...harness.input,
            currentStagingSnapshotRef: ref(harness.staging.readCurrent().snapshot!),
          },
          sink
        )
      ).rejects.toBeInstanceOf(OwnerReferenceLocalStudyUnavailableError);
      expect(read).not.toHaveBeenCalled();
      expect(sink).not.toHaveBeenCalled();
    }
  );

  it("blocks an exact replay after its acquisition is superseded", async () => {
    const harness = createHarness("upload");
    await harness.service.execute(harness.input, vi.fn());
    appendAcquisitionSuccessor(harness);
    const read = vi.spyOn(harness.controlled, "readDigitalAssetBytes");
    const sink = vi.fn();

    await expect(
      harness.service.execute(
        {
          ...harness.input,
          currentStagingSnapshotRef: ref(harness.staging.readCurrent().snapshot!),
        },
        sink
      )
    ).rejects.toBeInstanceOf(OwnerReferenceLocalStudyUnavailableError);
    expect(read).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });

  it("makes server-minted study records unavailable to the generic staging writer", async () => {
    const harness = createHarness("upload");
    const result = await harness.service.execute(harness.input, vi.fn());
    const current = harness.staging.readCurrent().snapshot!;
    const records = current.records.filter(
      (record): record is ReferenceSourceStagingInputRecord =>
        (record.id === result.rightsAssertionRef.id && record.recordKind === "rights_assertion") ||
        (record.id === result.accessDecisionRef.id && record.recordKind === "access_decision")
    );

    expect(() =>
      harness.staging.applyTransaction({
        schemaVersion: 1,
        id: "transaction.forged-owner-study",
        expectedHeadRef: ref(current),
        operations: records.map((record) => ({ type: "append_record", record })),
        submittedAt: NOW,
      })
    ).toThrow(/server-minted/);
  });

  it.each(["local_extraction", "provider_model_processing"])(
    "strictly rejects attempted %s widening before any effect",
    async (operation) => {
      const harness = createHarness("upload");
      const sink = vi.fn();
      await expect(
        harness.service.execute(
          {
            ...harness.input,
            request: { ...harness.input.request, operation } as typeof harness.input.request,
          },
          sink
        )
      ).rejects.toThrow();
      expect(sink).not.toHaveBeenCalled();
    }
  );
});

function createHarness(origin: "upload" | "migrated") {
  let currentTime = NOW;
  const stagingRoot = temporaryRoot("staging");
  const controlledRoot = temporaryRoot("controlled");
  const bytes = Buffer.from(`%PDF-1.7\nprivate ${origin} fixture\n%%EOF`);
  const asset = withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.fixture.${origin}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mediaType: "application/pdf",
    byteLength: bytes.byteLength,
  }) as ReferenceDigitalAsset;
  const acquisition = withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: `acquisition.fixture.${origin}`,
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin:
      origin === "upload"
        ? {
            sourceKind: "upload" as const,
            ownerActionRef: externalRef("owner-action.fixture.local-study"),
          }
        : {
            sourceKind: "legacy_owner_reference" as const,
            legacyRecordRef: externalRef("legacy-owner-reference.fixture.local-study"),
          },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.fixture.owner-private"),
  }) as ReferenceAssetAcquisition;
  const staging = new ReferenceSourceStagingService({
    store: new ReferenceSourceStagingStore({ rootDirectory: stagingRoot }),
    now: () => new Date(currentTime),
  });
  staging.applyTransaction({
    schemaVersion: 1,
    id: `transaction.fixture.${origin}`,
    operations: ([asset, acquisition] satisfies ReferenceSourceStagingInputRecord[]).map(
      (record) => ({
        type: "append_record" as const,
        record,
      })
    ),
    submittedAt: NOW,
  });
  const controlled = new ReferenceSourceControlledArtifactStore({
    rootDirectory: controlledRoot,
  });
  controlled.putDigitalAsset({ digitalAsset: asset, bytes });
  const projector = new OwnerReferenceWorkbenchOpaqueProjector(Buffer.alloc(32, 0x41));
  const snapshotRef = projector.project("snapshot", `${origin}-initial`);
  const cardRef = projector.project("card", { acquisition, asset });
  const request = {
    schemaVersion: 1 as const,
    snapshotRef,
    cardRef,
    operation: "owner_private_study" as const,
    purpose: "Read this exact reference privately on the local runtime",
    authorization: "owner_attested_local_study" as const,
    operationKey: OPERATION_KEY,
  };
  const service = new OwnerReferenceLocalStudyService({
    stagingWriter: createOwnerPrivateStudyStagingWriter(staging),
    stagingStore: staging.store,
    controlledArtifacts: controlled,
    opaqueProjector: projector,
    now: () => new Date(currentTime),
  });
  return {
    bytes,
    acquisition,
    asset,
    staging,
    controlled,
    controlledRoot,
    setNow: (value: string) => {
      currentTime = value;
    },
    projector,
    service,
    input: {
      request,
      currentWorkbenchSnapshotRef: snapshotRef,
      currentStagingSnapshotRef: ref(staging.readCurrent().snapshot!),
      acquisition,
      digitalAsset: asset,
    },
  };
}

function appendAuthorizationInvalidations(
  harness: ReturnType<typeof createHarness>,
  authorization: Awaited<ReturnType<OwnerReferenceLocalStudyService["execute"]>>
): void {
  const basis = withReferenceRecordDigest({
    recordKind: "rights_assertion" as const,
    id: "rights.fixture.owner-private-withdrawal-basis",
    version: 1,
    subjectRef: ref(harness.acquisition),
    subjectKind: "asset_acquisition" as const,
    rightsKind: "owner_private_access" as const,
    status: "permitted" as const,
    claimant: { kind: "owner" as const, claimantRef: externalRef("authority.fixture.owner") },
    evidenceRefs: [externalRef("evidence.fixture.owner-private-withdrawal")],
    assertedAt: NOW,
  }) as ReferenceRightsAssertion;
  const edges = ([authorization.rightsAssertionRef, authorization.accessDecisionRef] as const).map(
    (dependentRef, index) =>
      withReferenceRecordDigest({
        recordKind: "dependency_edge" as const,
        id: `dependency.fixture.owner-private-withdrawal.${index}`,
        dependencyRef: ref(basis),
        dependentRef,
        scope: "rights" as const,
        reason: "The local-study authorization depends on a withdrawable Owner basis",
        createdAt: NOW,
      }) as ReferenceDependencyEdge
  );
  const beforeBasis = harness.staging.readCurrent().snapshot!;
  harness.staging.applyTransaction({
    schemaVersion: 1,
    id: "transaction.fixture.owner-private-withdrawal-basis",
    expectedHeadRef: ref(beforeBasis),
    operations: [basis, ...edges].map((record) => ({ type: "append_record" as const, record })),
    submittedAt: NOW,
  });
  const { digest: _digest, ...basisCore } = basis;
  const withdrawn = withReferenceRecordDigest({
    ...basisCore,
    version: 2,
    parentVersionRef: { ...ref(basis), version: 1 },
    status: "restricted" as const,
    assertedAt: LATER,
  }) as ReferenceRightsAssertion;
  const beforeWithdrawal = harness.staging.readCurrent().snapshot!;
  harness.setNow(LATER);
  harness.staging.applyTransaction({
    schemaVersion: 1,
    id: "transaction.fixture.owner-private-withdrawal",
    expectedHeadRef: ref(beforeWithdrawal),
    operations: [{ type: "append_record", record: withdrawn }],
    submittedAt: LATER,
  });
}

function appendAuthorizationSuccessor(
  harness: ReturnType<typeof createHarness>,
  authorization: Awaited<ReturnType<OwnerReferenceLocalStudyService["execute"]>>,
  kind: "rights" | "decision"
): void {
  const current = harness.staging.store.readCurrentState()!;
  harness.setNow(LATER);
  const prior = current.snapshot.records.find(
    (record) =>
      record.id ===
      (kind === "rights" ? authorization.rightsAssertionRef.id : authorization.accessDecisionRef.id)
  );
  if (
    !prior ||
    (prior.recordKind !== "rights_assertion" && prior.recordKind !== "access_decision")
  ) {
    throw new Error("Expected exact local-study authorization fixture");
  }
  const { digest: _digest, ...priorCore } = prior;
  const successor =
    prior.recordKind === "rights_assertion"
      ? (withReferenceRecordDigest({
          ...priorCore,
          version: 2,
          parentVersionRef: { ...ref(prior), version: 1 },
          status: "restricted" as const,
          assertedAt: LATER,
        }) as ReferenceRightsAssertion)
      : (withReferenceRecordDigest({
          ...priorCore,
          version: 2,
          parentVersionRef: { ...ref(prior), version: 1 },
          outcome: "deny" as const,
          decidedAt: LATER,
        }) as ReferenceAccessDecision);
  commitDirectTestSnapshot(harness, current.snapshot, successor, `authorization-${kind}`);
}

function appendAcquisitionSuccessor(harness: ReturnType<typeof createHarness>): void {
  harness.setNow(LATER);
  const before = harness.staging.readCurrent().snapshot!;
  const replacement = withReferenceRecordDigest({
    ...harness.acquisition,
    id: `${harness.acquisition.id}.replacement`,
    acquiredAt: LATER,
    supersedesAcquisitionRef: ref(harness.acquisition),
    digest: undefined,
  }) as ReferenceAssetAcquisition;
  harness.staging.applyTransaction({
    schemaVersion: 1,
    id: "transaction.fixture.supersede-owner-private-acquisition",
    expectedHeadRef: ref(before),
    operations: [{ type: "append_record", record: replacement }],
    submittedAt: LATER,
  });
}

function commitDirectTestSnapshot(
  harness: ReturnType<typeof createHarness>,
  prior: ReferenceSourceStagingSnapshot,
  successor: ReferenceRightsAssertion | ReferenceAccessDecision,
  suffix: string
): void {
  const { digest: _digest, ...priorCore } = prior;
  const revision = prior.revision + 1;
  const snapshot = withReferenceRecordDigest({
    ...priorCore,
    id: `reference-source-snapshot.fixture.${suffix}`,
    revision,
    parentSnapshotRef: ref(prior),
    createdAt: LATER,
    records: [...prior.records, successor],
    recordObservations: [
      ...(prior.recordObservations ?? []),
      {
        recordRef: ref(successor),
        firstObservedRevision: revision,
        observedAt: LATER,
        orderingTrust: "server_observed" as const,
      },
    ],
  }) as ReferenceSourceStagingSnapshot;
  harness.staging.store.commit(snapshot, ref(prior));
}

function temporaryRoot(kind: string): string {
  const root = mkdtempSync(path.join(tmpdir(), `vellum-local-study-${kind}-`));
  roots.push(root);
  return root;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return withReferenceRecordDigest({ id });
}
