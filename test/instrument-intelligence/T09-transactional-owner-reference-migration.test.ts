import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/server/index.js";
import {
  canonicalReferenceJson,
  withReferenceRecordDigest,
  type ReferenceSourceStagingInputRecord,
} from "../../src/lib/reference-source-domain.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import {
  OwnerReferenceMigrationConflictError,
  OwnerReferenceMigrationService,
  type LegacyOwnerReferenceIdentityDisposition,
  type OwnerReferenceMigrationServiceOptions,
} from "../../src/server/lib/owner-reference-migration-service.js";
import { OwnerReferenceLegacyReader } from "../../src/server/lib/owner-reference-legacy-reader.js";
import { OwnerStore } from "../../src/server/lib/owner-store.js";
import {
  ReferenceSourceControlledArtifactStore,
  ReferenceSourceControlledArtifactStoreConflictError,
} from "../../src/server/lib/reference-source-controlled-artifact-store.js";

const NOW = "2026-07-15T16:00:00.000Z";
const LATER = "2026-07-15T16:05:00.000Z";
const PRIVATE_TITLE = "Owner-private lute method";
const PRIVATE_CITATION = "Private shelf, volume 3, leaf 19";
const PRIVATE_BYTES = Buffer.from("%PDF-1.4\nPRIVATE OWNER REFERENCE\n%%EOF\n");

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T09 transactional OwnerReference migration", () => {
  it("dry-runs without writes, then commits an exact asset-only mapping without inventing bibliography or rights", () => {
    const harness = createHarness();
    const legacy = addReference(harness.owner);
    const legacyRecordBytes = readFileSync(
      path.join(harness.owner.rootDirectory, "references", `${legacy.id}.json`)
    );
    const ownerBefore = JSON.stringify(harness.owner.listReferences());
    const controlledBefore = harness.controlled.observe();

    const plan = harness.service.dryRun({ expectedHead: null });

    expect(plan).toMatchObject({
      schemaVersion: 1,
      mode: "dry_run",
      writesPerformed: false,
      expectedHead: null,
      mappings: [
        {
          legacyId: legacy.id,
          bibliographicIdentity: "not_asserted",
        },
      ],
      quarantines: [],
      capabilities: {
        compatibilityReads: true,
        canonicalWriter: false,
        activation: false,
      },
    });
    expect(harness.journal.readCurrent()).toBeNull();
    expect(harness.controlled.observe()).toEqual(controlledBefore);

    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    expect(committed).toMatchObject({
      mode: "commit",
      outcome: "committed",
      journalState: "committed",
      planDigest: plan.planDigest,
    });

    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.mappings).toHaveLength(1);
    expect(audit.mappings[0]).toMatchObject({
      legacySnapshot: {
        id: legacy.id,
        title: PRIVATE_TITLE,
        citation: PRIVATE_CITATION,
        sha256: legacy.sha256,
        byteLength: PRIVATE_BYTES.byteLength,
      },
      legacyRecordEvidence: {
        kind: "legacy_record",
        sha256: sha256(legacyRecordBytes),
        byteLength: legacyRecordBytes.byteLength,
      },
      byteVerification: {
        declaredSha256: legacy.sha256,
        observedSha256: legacy.sha256,
        targetSha256: legacy.sha256,
        declaredByteLength: PRIVATE_BYTES.byteLength,
        observedByteLength: PRIVATE_BYTES.byteLength,
        targetByteLength: PRIVATE_BYTES.byteLength,
        exact: true,
      },
      bibliographicIdentity: {
        state: "not_asserted",
        workRefs: [],
        manifestationRefs: [],
        exemplarRefs: [],
      },
    });
    expect(audit.mappings[0]!.targetRecords.map(({ recordKind }) => recordKind)).toEqual([
      "digital_asset",
      "asset_acquisition",
    ]);
    expect(
      readQuarantineEvidence(harness.service, audit.mappings[0]!.legacyRecordEvidence)
    ).toEqual(legacyRecordBytes);
    expect(
      audit.mappings[0]!.targetRecords.some(({ recordKind }) =>
        [
          "work",
          "source_manifestation",
          "exemplar",
          "rights_assertion",
          "owner_reference_binding",
        ].includes(recordKind)
      )
    ).toBe(false);
    expect(audit.mappings[0]!.bindingDisposition).toBe("pending_owner_authorization");
    expect(
      audit.mappings[0]!.targetRecords.find((record) => record.recordKind === "asset_acquisition")
    ).toMatchObject({ origin: { sourceKind: "legacy_owner_reference" } });
    expect(audit.mappings[0]!.accessDecisionRefs).toEqual([]);

    const observation = harness.controlled.observe();
    expect(observation).toMatchObject({
      status: "complete",
      artifactBindings: [
        {
          blobSha256: legacy.sha256,
          byteLength: PRIVATE_BYTES.byteLength,
        },
      ],
    });
    expect(JSON.stringify(harness.owner.listReferences())).toBe(ownerBefore);

    const compatibility = harness.service.readCompatibility();
    expect(compatibility).toMatchObject({
      publicationState: "migration_only",
      ownerReferences: [
        {
          legacyId: legacy.id,
          state: "mapped",
        },
      ],
      capabilities: {
        compatibilityReads: true,
        canonicalWriter: false,
        activation: false,
      },
    });
    const publicText = JSON.stringify({ plan, committed, compatibility });
    expect(publicText).not.toContain(PRIVATE_TITLE);
    expect(publicText).not.toContain(PRIVATE_CITATION);
    expect(publicText).not.toContain(PRIVATE_BYTES.toString("utf8"));
    expect(publicText).not.toMatch(/storedPath|contentBase64|privateAudit/);
  });

  it("returns compatibility state and head from one snapshot while a rollback advances publication", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    let advanceDuringCapture: (() => void) | null = null;
    harness.service = migrationService(harness, {
      listLegacyReferences: () => {
        const advance = advanceDuringCapture;
        advanceDuringCapture = null;
        advance?.();
        return harness.owner.listReferences();
      },
    });
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    const committedHead = migrationHeadRef(harness.journal)!;
    advanceDuringCapture = () => {
      harness.service.rollback({ batchId: committed.batchId, expectedHead: committedHead });
    };

    const compatibility = harness.service.readCompatibility();

    expect(compatibility).toMatchObject({
      head: committed.head,
      ownerReferences: [{ legacyId: reference.id, state: "mapped" }],
    });
    expect(harness.journal.readHead()?.revision).toBe(committedHead.revision + 1);
    expect(harness.service.readCompatibility()).toMatchObject({
      head: harness.journal.readHead(),
      ownerReferences: [{ legacyId: reference.id, state: "rolled_back" }],
    });
  });

  it("confirms an empty pristine inventory as a semantic no-op without minting a head", () => {
    const harness = createHarness();
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(plan).toMatchObject({ mappings: [], quarantines: [], writesPerformed: false });
    expect(
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toMatchObject({
      outcome: "no_changes",
      journalState: "unchanged",
      mappedCount: 0,
      quarantineCount: 0,
      head: null,
    });
    expect(harness.journal.readCurrent()).toBeNull();
    expect(harness.service.migrationGraphService.readCurrent().head).toBeNull();
    expect(harness.controlled.observe().artifactBindings).toEqual([]);
  });

  it("fails closed to unresolved identity when production has no pinned classifier", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    harness.service = new OwnerReferenceMigrationService({
      journalStore: harness.journal,
      controlledStore: harness.controlled,
      legacySource: new OwnerReferenceLegacyReader({
        rootDirectory: harness.owner.rootDirectory,
      }),
      intentRootDirectory: path.join(harness.root, "default-identity-migration-intents"),
      now: () => new Date(NOW),
    });

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings).toEqual([
      expect.objectContaining({ legacyId: reference.id, bibliographicIdentity: "not_asserted" }),
    ]);
    expect(plan.quarantines).toEqual([
      {
        legacyId: reference.id,
        reason: "incomplete_identity",
        action: "review_source_identity",
      },
    ]);

    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.mappings[0]!.targetRecords.map(({ recordKind }) => recordKind)).toEqual([
      "digital_asset",
      "asset_acquisition",
    ]);
    expect(audit.mappings[0]!.bibliographicIdentity).toEqual({
      state: "not_asserted",
      workRefs: [],
      manifestationRefs: [],
      exemplarRefs: [],
    });
    expect(audit.mappings[0]!.accessDecisionRefs).toEqual([]);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({
        legacyId: reference.id,
        state: "quarantined",
        quarantineReason: "incomplete_identity",
      }),
    ]);
  });

  it("clears a reviewed identity quarantine with a mapping-only successor", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    let disposition: LegacyOwnerReferenceIdentityDisposition = "composite";
    harness.service = migrationService(harness, {
      identityDisposition: () => disposition,
    });

    const initialPlan = harness.service.dryRun({ expectedHead: null });
    const initial = harness.service.commit({
      expectedHead: null,
      planDigest: initialPlan.planDigest,
    });
    expect(initial).toMatchObject({ mappedCount: 1, quarantineCount: 1 });
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({
        legacyId: reference.id,
        state: "quarantined",
        quarantineReason: "composite_identity",
      }),
    ]);

    const unchangedHead = migrationHeadRef(harness.journal)!;
    const unchangedPlan = harness.service.dryRun({ expectedHead: unchangedHead });
    expect(
      harness.service.commit({
        expectedHead: unchangedHead,
        planDigest: unchangedPlan.planDigest,
      })
    ).toMatchObject({ outcome: "no_changes", journalState: "unchanged" });

    disposition = "asset_only";
    const reassessedPlan = harness.service.dryRun({ expectedHead: unchangedHead });
    expect(reassessedPlan).toMatchObject({
      mappings: [expect.objectContaining({ legacyId: reference.id, alreadyMapped: true })],
      quarantines: [],
    });
    const reassessed = harness.service.commit({
      expectedHead: unchangedHead,
      planDigest: reassessedPlan.planDigest,
    });
    expect(reassessed).toMatchObject({
      outcome: "committed",
      mappedCount: 1,
      quarantineCount: 0,
    });
    expect(harness.service.inspectPrivateAudit(reassessed.batchId).quarantines).toEqual([]);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "mapped" }),
    ]);
  });

  it("quarantines collisions, missing or changed bytes, and incomplete or composite identity", () => {
    const harness = createHarness();
    const valid = addReference(harness.owner);
    const missing = addReference(harness.owner, {
      title: "Missing bytes",
      citation: "Missing source",
      bytes: Buffer.from("%PDF-missing"),
    });
    const changed = addReference(harness.owner, {
      title: "Changed bytes",
      citation: "Tampered source",
      bytes: Buffer.from("%PDF-original"),
    });
    const incomplete = addReference(harness.owner, {
      title: "Incomplete identity",
      citation: "Unresolved source",
      bytes: Buffer.from("%PDF-incomplete"),
    });
    const composite = addReference(harness.owner, {
      title: "Composite identity",
      citation: "Bound compilation",
      bytes: Buffer.from("%PDF-composite"),
    });
    unlinkSync(referenceContentPath(harness.owner, missing.id));
    writeFileSync(referenceContentPath(harness.owner, changed.id), "%PDF-mutated");

    const duplicate = {
      ...valid,
      sha256: "f".repeat(64),
      byteLength: 4,
    };
    const baseReferences = harness.owner.listReferences();
    harness.service = migrationService(harness, {
      listLegacyReferences: () => [...baseReferences, duplicate],
      identityDisposition: (reference) =>
        reference.id === incomplete.id
          ? "incomplete"
          : reference.id === composite.id
            ? "composite"
            : "asset_only",
    });

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings.map(({ legacyId }) => legacyId).sort()).toEqual(
      [composite.id, incomplete.id].sort()
    );
    expect(new Map(plan.quarantines.map((item) => [item.legacyId, item.reason]))).toEqual(
      new Map([
        [valid.id, "legacy_id_collision"],
        [missing.id, "missing_bytes"],
        [changed.id, "hash_mismatch"],
        [incomplete.id, "incomplete_identity"],
        [composite.id, "composite_identity"],
      ])
    );
    expect(plan.quarantines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ legacyId: missing.id, action: "restore_exact_legacy_bytes" }),
        expect.objectContaining({ legacyId: valid.id, action: "resolve_legacy_id_collision" }),
        expect.objectContaining({ legacyId: incomplete.id, action: "review_source_identity" }),
      ])
    );
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    expect(committed).toMatchObject({
      journalState: "committed",
      mappedCount: 2,
      quarantineCount: 6,
    });
    expect(harness.controlled.observe().artifactBindings).toHaveLength(2);
    expect(harness.service.readCompatibility().ownerReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacyId: incomplete.id,
          state: "quarantined",
          quarantineReason: "incomplete_identity",
          mappingId: expect.any(String),
        }),
        expect.objectContaining({
          legacyId: composite.id,
          state: "quarantined",
          quarantineReason: "composite_identity",
          mappingId: expect.any(String),
        }),
      ])
    );
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.mappings.map(({ legacyId }) => legacyId).sort()).toEqual(
      [composite.id, incomplete.id].sort()
    );
  });

  it("uses a safe opaque ID while retaining an invalid raw callback ID only in private audit", () => {
    const harness = createHarness();
    const rawLegacyId = "../../private invalid reference";
    const reference = callbackReference({ id: rawLegacyId, bytes: PRIVATE_BYTES });
    harness.service = migrationService(harness, {
      listLegacyReferences: () => [reference],
      readLegacyBytes: () => PRIVATE_BYTES,
    });

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings).toEqual([]);
    expect(plan.quarantines).toEqual([
      expect.objectContaining({
        legacyId: expect.stringMatching(/^invalid-callback-id\.[a-f0-9]{32}$/),
        reason: "invalid_legacy_record",
      }),
    ]);
    expect(JSON.stringify(plan)).not.toContain(rawLegacyId);

    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.quarantines).toEqual([
      expect.objectContaining({
        legacyId: plan.quarantines[0]!.legacyId,
        rawLegacyId,
        legacySnapshot: null,
        reason: "invalid_legacy_record",
      }),
    ]);
    expect(
      readQuarantineEvidence(harness.service, audit.quarantines[0]!.legacyRecordEvidence!)
    ).toEqual(Buffer.from(`${canonicalReferenceJson(reference)}\n`));
    expect(JSON.stringify(harness.service.readCompatibility())).not.toContain(rawLegacyId);
  });

  it("preserves every divergent duplicate callback contender with deterministic ordering", () => {
    const firstBytes = Buffer.from("%PDF-divergent-collision-first");
    const secondBytes = Buffer.from("%PDF-divergent-collision-second");
    const first = callbackReference({
      id: "reference.divergent-collision",
      bytes: firstBytes,
      title: "Divergent first",
    });
    const second = callbackReference({
      id: "reference.divergent-collision",
      bytes: secondBytes,
      title: "Divergent second",
    });
    const configure = (harness: Harness, references: [typeof first, typeof second]) => {
      let readIndex = 0;
      harness.service = migrationService(harness, {
        listLegacyReferences: () => {
          readIndex = 0;
          return references;
        },
        readLegacyBytes: () =>
          references[readIndex++]!.sha256 === first.sha256 ? firstBytes : secondBytes,
      });
    };
    const harness = createHarness();
    configure(harness, [first, second]);
    const reversedHarness = createHarness();
    configure(reversedHarness, [second, first]);

    const plan = harness.service.dryRun({ expectedHead: null });
    const reversedPlan = reversedHarness.service.dryRun({ expectedHead: null });
    expect(plan.planDigest).toBe(reversedPlan.planDigest);
    expect(plan.mappings).toEqual([]);
    expect(plan.quarantines).toHaveLength(2);
    expect(plan.quarantines).toEqual(
      plan.quarantines.map(() =>
        expect.objectContaining({
          legacyId: first.id,
          reason: "legacy_id_collision",
          action: "resolve_legacy_id_collision",
        })
      )
    );

    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.quarantines).toHaveLength(2);
    expect(
      new Set(audit.quarantines.map(({ legacyRecordDigest }) => legacyRecordDigest)).size
    ).toBe(2);
    expect(
      new Set(
        audit.quarantines.map(({ observedContentEvidence }) => observedContentEvidence?.sha256)
      ).size
    ).toBe(2);
    expect(audit.history[0]!.quarantineRecordRefs).toHaveLength(2);
  });

  it("preserves exact private quarantine evidence while every public migration view stays redacted", () => {
    const harness = createHarness();
    const legacy = addReference(harness.owner);
    const recordPath = path.join(harness.owner.rootDirectory, "references", `${legacy.id}.json`);
    const exactRawRecord = readFileSync(recordPath);
    const mismatchedObservedBytes = Buffer.from("%PDF-mutated private observed bytes\n");
    writeFileSync(referenceContentPath(harness.owner, legacy.id), mismatchedObservedBytes);

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan).toMatchObject({
      mappings: [],
      quarantines: [
        {
          legacyId: legacy.id,
          reason: "hash_mismatch",
          action: "restore_exact_legacy_bytes",
        },
      ],
    });
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    const compatibility = harness.service.readCompatibility();
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.quarantines).toHaveLength(1);
    const quarantine = audit.quarantines[0]!;
    expect(quarantine).toMatchObject({
      legacyId: legacy.id,
      legacySnapshot: {
        id: legacy.id,
        title: PRIVATE_TITLE,
        citation: PRIVATE_CITATION,
      },
      legacyRecordDigest: sha256(exactRawRecord),
      legacyRecordByteLength: exactRawRecord.byteLength,
      legacyRecordEvidence: {
        kind: "legacy_record",
        sha256: sha256(exactRawRecord),
        byteLength: exactRawRecord.byteLength,
      },
      observedContentEvidence: {
        kind: "observed_content",
        sha256: sha256(mismatchedObservedBytes),
        byteLength: mismatchedObservedBytes.byteLength,
      },
      declaredSha256: legacy.sha256,
      observedSha256: sha256(mismatchedObservedBytes),
    });
    expect(readQuarantineEvidence(harness.service, quarantine.legacyRecordEvidence!)).toEqual(
      exactRawRecord
    );
    expect(readQuarantineEvidence(harness.service, quarantine.observedContentEvidence!)).toEqual(
      mismatchedObservedBytes
    );

    const publicText = JSON.stringify({ plan, committed, compatibility });
    expect(publicText).not.toContain(PRIVATE_TITLE);
    expect(publicText).not.toContain(PRIVATE_CITATION);
    expect(publicText).not.toContain(exactRawRecord.toString("utf8"));
    expect(publicText).not.toContain(mismatchedObservedBytes.toString("utf8"));
    expect(publicText).not.toContain(sha256(exactRawRecord));
    expect(publicText).not.toContain(sha256(mismatchedObservedBytes));
  });

  it("quarantines planned target collisions while committing an unaffected sibling", () => {
    const harness = createHarness();
    const sharedBytes = Buffer.from("%PDF-planned-target-collision");
    const siblingBytes = Buffer.from("%PDF-valid-planned-collision-sibling");
    const references = [
      callbackReference({
        id: "reference.planned-collision-alpha",
        bytes: sharedBytes,
        mimeType: "application/pdf",
      }),
      callbackReference({
        id: "reference.planned-collision-beta",
        bytes: sharedBytes,
        mimeType: "application/octet-stream",
      }),
      callbackReference({ id: "reference.planned-valid-sibling", bytes: siblingBytes }),
    ];
    const bytesById = new Map([
      [references[0]!.id, sharedBytes],
      [references[1]!.id, sharedBytes],
      [references[2]!.id, siblingBytes],
    ]);
    harness.service = migrationService(harness, {
      listLegacyReferences: () => references,
      readLegacyBytes: (id) => bytesById.get(id)!,
    });

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings.map(({ legacyId }) => legacyId)).toEqual([
      "reference.planned-valid-sibling",
    ]);
    expect(plan.quarantines).toEqual([
      expect.objectContaining({
        legacyId: "reference.planned-collision-alpha",
        reason: "target_record_collision",
      }),
      expect.objectContaining({
        legacyId: "reference.planned-collision-beta",
        reason: "target_record_collision",
      }),
    ]);
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    expect(committed).toMatchObject({ mappedCount: 1, quarantineCount: 2 });
    expect(harness.service.readCompatibility().ownerReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacyId: "reference.planned-valid-sibling",
          state: "mapped",
        }),
        expect.objectContaining({
          legacyId: "reference.planned-collision-alpha",
          state: "quarantined",
          quarantineReason: "target_record_collision",
        }),
        expect.objectContaining({
          legacyId: "reference.planned-collision-beta",
          state: "quarantined",
          quarantineReason: "target_record_collision",
        }),
      ])
    );
  });

  it("quarantines an existing target collision while committing an unaffected sibling", () => {
    const harness = createHarness();
    const collidingBytes = Buffer.from("%PDF-existing-target-collision");
    const siblingBytes = Buffer.from("%PDF-valid-existing-collision-sibling");
    const colliding = callbackReference({
      id: "reference.existing-collision",
      bytes: collidingBytes,
    });
    const sibling = callbackReference({
      id: "reference.existing-valid-sibling",
      bytes: siblingBytes,
    });
    const preexisting = targetCollisionAsset(colliding.sha256, collidingBytes.byteLength);
    harness.service.migrationGraphService.applyTransaction({
      schemaVersion: 1,
      id: "transaction.seed-existing-target-collision",
      operations: [{ type: "append_record", record: preexisting }],
      submittedAt: NOW,
    });
    harness.service = migrationService(harness, {
      listLegacyReferences: () => [colliding, sibling],
      readLegacyBytes: (id) => (id === colliding.id ? collidingBytes : siblingBytes),
    });

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings.map(({ legacyId }) => legacyId)).toEqual([sibling.id]);
    expect(plan.quarantines).toEqual([
      {
        legacyId: colliding.id,
        reason: "target_record_collision",
        action: "review_target_record_collision",
      },
    ]);
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    expect(committed).toMatchObject({ mappedCount: 1, quarantineCount: 1 });
    expect(harness.service.readCompatibility().ownerReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ legacyId: sibling.id, state: "mapped" }),
        expect.objectContaining({
          legacyId: colliding.id,
          state: "quarantined",
          quarantineReason: "target_record_collision",
        }),
      ])
    );
  });

  it("deduplicates exact bytes while preserving distinct legacy acquisitions and citations", () => {
    const harness = createHarness();
    const sha256 = createHash("sha256").update(PRIVATE_BYTES).digest("hex");
    const references = [
      {
        id: "reference.shared-alpha",
        title: "Shared bytes alpha",
        citation: "Synthetic citation alpha",
        mimeType: "application/pdf",
        sha256,
        byteLength: PRIVATE_BYTES.byteLength,
        storedPath: "references/reference.shared-alpha/content",
        authorityState: "raw_staged" as const,
        activationAllowed: false as const,
        createdAt: NOW,
      },
      {
        id: "reference.shared-beta",
        title: "Shared bytes beta",
        citation: "Synthetic citation beta",
        mimeType: "application/pdf",
        sha256,
        byteLength: PRIVATE_BYTES.byteLength,
        storedPath: "references/reference.shared-beta/content",
        authorityState: "raw_staged" as const,
        activationAllowed: false as const,
        createdAt: LATER,
      },
    ];
    harness.service = migrationService(harness, {
      listLegacyReferences: () => references,
      readLegacyBytes: () => PRIVATE_BYTES,
    });

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings).toHaveLength(2);
    expect(plan.mappings.every((mapping) => !("targetAssetId" in mapping))).toBe(true);
    expect(plan.mappings.every((mapping) => !("targetAcquisitionId" in mapping))).toBe(true);
    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.mappings.map(({ legacySnapshot }) => legacySnapshot.citation).sort()).toEqual([
      "Synthetic citation alpha",
      "Synthetic citation beta",
    ]);
    expect(new Set(audit.mappings.map(({ targetAssetRef }) => targetAssetRef.id)).size).toBe(1);
    expect(
      new Set(audit.mappings.map(({ targetAcquisitionRef }) => targetAcquisitionRef.id)).size
    ).toBe(2);
    expect(harness.controlled.observe().artifactBindings).toHaveLength(1);
  });

  it("treats exact legacy replay as idempotent and refuses metadata overwrite", () => {
    const harness = createHarness();
    const first = addReference(harness.owner);
    const recordPath = path.join(harness.owner.rootDirectory, "references", `${first.id}.json`);
    const recordBefore = readFileSync(recordPath);
    const contentBefore = readFileSync(referenceContentPath(harness.owner, first.id));

    expect(addReference(harness.owner)).toEqual(first);
    expect(readFileSync(recordPath)).toEqual(recordBefore);
    expect(readFileSync(referenceContentPath(harness.owner, first.id))).toEqual(contentBefore);
    expect(() =>
      addReference(harness.owner, { title: "Attempted overwrite of immutable metadata" })
    ).toThrow(/immutable ID collision/);
    expect(readFileSync(recordPath)).toEqual(recordBefore);
    expect(readFileSync(referenceContentPath(harness.owner, first.id))).toEqual(contentBefore);
  });

  it("quarantines a symlinked legacy content path without reading outside the Owner root", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    const outside = path.join(harness.root, "outside-private-source.pdf");
    writeFileSync(outside, PRIVATE_BYTES);
    const contentPath = referenceContentPath(harness.owner, reference.id);
    unlinkSync(contentPath);
    symlinkSync(outside, contentPath);

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings).toEqual([]);
    expect(plan.quarantines).toEqual([
      {
        legacyId: reference.id,
        reason: "unsafe_legacy_path",
        action: "repair_legacy_storage_boundary",
      },
    ]);
    expect(harness.controlled.observe().artifactBindings).toEqual([]);
  });

  it("fails closed when the legacy content parent is replaced by an outside symlink", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    const contentParent = path.dirname(referenceContentPath(harness.owner, reference.id));
    const displacedParent = path.join(harness.root, "displaced-private-reference-parent");
    renameSync(contentParent, displacedParent);
    symlinkSync(displacedParent, contentParent, "dir");

    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan.mappings).toEqual([]);
    expect(plan.quarantines).toEqual([
      {
        legacyId: reference.id,
        reason: "unsafe_legacy_path",
        action: "repair_legacy_storage_boundary",
      },
    ]);
    expect(harness.controlled.observe().artifactBindings).toEqual([]);
  });

  it("rejects a symlinked private intent root without writing through it", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-t09-outside-intents-"));
    roots.push(outside);
    symlinkSync(outside, harness.service.intentRootDirectory, "dir");
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/private migration output directory is not a real directory/i);
    expect(readdirSync(outside)).toEqual([]);
    expect(harness.journal.readCurrent()).toBeNull();
  });

  it("rejects a symlinked quarantine-evidence kind without writing outside its root", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    writeFileSync(
      referenceContentPath(harness.owner, reference.id),
      "%PDF-mismatched-private-evidence"
    );
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-t09-outside-evidence-"));
    roots.push(outside);
    mkdirSync(harness.service.quarantineEvidenceRootDirectory, {
      recursive: true,
      mode: 0o700,
    });
    symlinkSync(
      outside,
      path.join(harness.service.quarantineEvidenceRootDirectory, "legacy_record"),
      "dir"
    );
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/private migration output directory is not a real directory/i);
    expect(readdirSync(outside)).toEqual([]);
    expect(
      readdirSync(harness.service.intentRootDirectory).filter((name) => name.startsWith("commit."))
    ).toEqual([]);
    expect(harness.journal.readCurrent()).toBeNull();
  });

  it("rejects a quarantine-evidence parent swapped to a symlink immediately before create", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    writeFileSync(
      referenceContentPath(harness.owner, reference.id),
      "%PDF-mismatched-preopen-evidence"
    );
    const plan = harness.service.dryRun({ expectedHead: null });
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-t09-outside-preopen-evidence-"));
    roots.push(outside);
    let swapped = false;
    harness.service = migrationService(harness, {
      migrationFaultInjector: (fault) => {
        if (
          fault.point !== "before_private_file_open" ||
          fault.operation !== "create" ||
          !fault.path.includes(`${path.sep}legacy_record${path.sep}`) ||
          swapped
        ) {
          return;
        }
        swapped = true;
        const kindDirectory = path.dirname(fault.path);
        renameSync(kindDirectory, `${kindDirectory}.displaced`);
        symlinkSync(outside, kindDirectory, "dir");
      },
    });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/symlink|path identity|ancestor/i);
    expect(swapped).toBe(true);
    expect(readdirSync(outside)).toEqual([]);
    expect(harness.journal.readCurrent()).toBeNull();
    expect(
      readdirSync(harness.service.intentRootDirectory).filter((name) => name.startsWith("commit."))
    ).toEqual([]);
  });

  it("resumes with the original expected journal head after controlled bytes and graph records staged", () => {
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (!injected && fault.point === "after_staged_record") {
          injected = true;
          throw new Error("injected after graph and byte staging");
        }
      },
    });
    const reference = addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/injected after graph and byte staging/);
    expect(harness.journal.readHead()).toBeNull();
    expect(harness.service.migrationGraphService.readCurrent().head).not.toBeNull();
    expect(harness.controlled.observe().artifactBindings).toEqual([
      expect.objectContaining({ blobSha256: reference.sha256 }),
    ]);

    const resumed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    expect(resumed).toMatchObject({
      outcome: "committed",
      journalState: "committed",
      mappedCount: 1,
    });
    expect(harness.journal.listOrphans()).toEqual([]);
  });

  it("refuses interrupted rollback when intent-bound mapping evidence has disappeared", () => {
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (!injected && fault.point === "after_staged_record") {
          injected = true;
          throw new Error("interrupt after mapping payload record stage");
        }
      },
    });
    const reference = addReference(harness.owner);
    const rawRecordBytes = readFileSync(
      path.join(harness.owner.rootDirectory, "references", `${reference.id}.json`)
    );
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/interrupt after mapping payload record stage/);
    const evidencePath = path.join(
      harness.service.quarantineEvidenceRootDirectory,
      "legacy_record",
      `${sha256(rawRecordBytes)}.bin`
    );
    expect(readFileSync(evidencePath)).toEqual(rawRecordBytes);
    unlinkSync(evidencePath);

    expect(() =>
      harness.service.rollbackInterrupted({ planDigest: plan.planDigest, expectedHead: null })
    ).toThrow(/private legacy_record evidence is missing/i);
    expect(
      harness.journal
        .readCurrent()
        ?.records.filter(({ recordKind }) => recordKind === "owner_reference_migration_journal") ??
        []
    ).toEqual([]);
  });

  it("rebases the final 1 of 257 payload records after an unrelated descendant of the first 256", () => {
    let beforeHeadCommits = 0;
    let interrupted = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (fault.point !== "before_head_commit") return;
        beforeHeadCommits += 1;
        if (beforeHeadCommits === 2) {
          interrupted = true;
          throw new Error("interrupt second oversized payload stage");
        }
      },
    });
    const references = Array.from({ length: 257 }, (_, index) => {
      const bytes = Buffer.from(`missing private reference ${index}`);
      return callbackReference({
        id: `reference.oversized.${String(index).padStart(3, "0")}`,
        bytes,
      });
    });
    harness.service = migrationService(harness, {
      listLegacyReferences: () => references,
      readLegacyBytes: () => {
        throw new Error("fixture bytes are intentionally absent");
      },
    });
    const plan = harness.service.dryRun({ expectedHead: null });
    expect(plan).toMatchObject({ mappings: [], quarantines: expect.any(Array) });
    expect(plan.quarantines).toHaveLength(257);

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/interrupt second oversized payload stage/);
    expect(interrupted).toBe(true);

    const intent = JSON.parse(
      readFileSync(
        path.join(harness.service.intentRootDirectory, `commit.${plan.planDigest}.json`),
        "utf8"
      )
    );
    expect(intent).toMatchObject({ stageProtocolVersion: 1, chunkSize: 256 });

    const stageTip = harness.journal.readCurrent()!;
    expect(stageTip.head.revision).toBe(1);
    expect(stageTip.generation.newRecordRefs).toHaveLength(256);
    expect(
      stageTip.records.filter(
        ({ recordKind }) => recordKind === "owner_reference_migration_quarantine"
      )
    ).toHaveLength(256);
    expect(
      stageTip.records.filter(
        ({ recordKind }) => recordKind === "owner_reference_migration_journal"
      )
    ).toEqual([]);
    expect(harness.journal.listOrphans()).toEqual([
      expect.objectContaining({
        state: "complete_generation",
        transactionId: expect.stringMatching(
          new RegExp(`^owner-reference-migration-stage-v1\\.${plan.planDigest.slice(0, 32)}\\.`)
        ),
        revision: 2,
      }),
    ]);

    const unrelated = harness.journal.publish({
      schemaVersion: 1,
      transactionId: "unrelated-publication-after-first-oversized-stage",
      writerKind: "system",
      expectedHead: migrationHeadRef(harness.journal),
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "unrelated-draft-after-first-oversized-stage",
          successorRefs: [],
          content: { purpose: "preserved interleaving fixture" },
        },
      ],
    });
    expect(unrelated.head.revision).toBe(2);
    expect(harness.service.readCompatibility().ownerReferences).toHaveLength(257);
    expect(
      harness.service.readCompatibility().ownerReferences.every(({ state }) => state === "pending")
    ).toBe(true);

    const resumed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    expect(resumed).toMatchObject({
      outcome: "committed",
      journalState: "committed",
      mappedCount: 0,
      quarantineCount: 257,
      head: { revision: 4 },
    });
    const final = harness.journal.readCurrent()!;
    expect(final.generation.newRecordRefs).toHaveLength(1);
    expect(final.generation.newRecordRefs[0]!.recordKind).toBe("owner_reference_migration_journal");
    expect(
      final.records.filter(({ recordKind }) => recordKind === "owner_reference_migration_journal")
    ).toHaveLength(1);
    expect(final.records).toContainEqual(
      expect.objectContaining({ id: "unrelated-draft-after-first-oversized-stage" })
    );
    expect(harness.service.inspectPrivateAudit(resumed.batchId).quarantines).toHaveLength(257);
    expect(
      harness.service
        .readCompatibility()
        .ownerReferences.every(({ state }) => state === "quarantined")
    ).toBe(true);
    expect(harness.journal.listOrphans()).toEqual([]);
  });

  it("rejects an unrelated publication before the first owned stage and stays pending", () => {
    const harness = createHarness();
    const missing = callbackReference({
      id: "reference.unrelated-before-first-stage",
      bytes: Buffer.from("missing before-first-stage fixture"),
    });
    harness.service = migrationService(harness, {
      listLegacyReferences: () => [missing],
      readLegacyBytes: () => {
        throw new Error("fixture bytes are intentionally absent");
      },
    });
    const plan = harness.service.dryRun({ expectedHead: null });
    harness.journal.publish({
      schemaVersion: 1,
      transactionId: "unrelated-publication-before-first-migration-stage",
      writerKind: "system",
      expectedHead: null,
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "unrelated-draft-before-first-migration-stage",
          successorRefs: [],
          content: { purpose: "stale-base fixture" },
        },
      ],
    });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(OwnerReferenceMigrationConflictError);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: missing.id, state: "pending" }),
    ]);
    expect(
      harness.journal
        .readCurrent()!
        .records.filter(({ recordKind }) => recordKind === "owner_reference_migration_journal")
    ).toEqual([]);
  });

  it("cancels an interrupted terminal commit atop an unrelated descendant of its owned stage", () => {
    let beforeHeadCommits = 0;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (fault.point !== "before_head_commit") return;
        beforeHeadCommits += 1;
        if (beforeHeadCommits === 2) {
          throw new Error("interrupt visibility commit before head");
        }
      },
    });
    const missing = callbackReference({
      id: "reference.cancel-after-interleaving",
      bytes: Buffer.from("missing cancellation interleaving fixture"),
    });
    harness.service = migrationService(harness, {
      listLegacyReferences: () => [missing],
      readLegacyBytes: () => {
        throw new Error("fixture bytes are intentionally absent");
      },
    });
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/interrupt visibility commit before head/);
    expect(migrationHeadRef(harness.journal)).toMatchObject({ revision: 1 });
    expect(harness.journal.listOrphans()).toEqual([
      expect.objectContaining({
        transactionId: expect.stringMatching(
          new RegExp(
            `^owner-reference-migration-visibility-v1\\.${plan.planDigest.slice(0, 32)}\\.`
          )
        ),
        revision: 2,
      }),
    ]);

    const unrelated = harness.journal.publish({
      schemaVersion: 1,
      transactionId: "unrelated-publication-before-interrupted-cancel",
      writerKind: "system",
      expectedHead: migrationHeadRef(harness.journal),
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "unrelated-draft-before-interrupted-cancel",
          successorRefs: [],
          content: { purpose: "preserved cancellation interleaving fixture" },
        },
      ],
    });
    const unrelatedHead = migrationHeadRef(harness.journal)!;
    expect(unrelated.head.revision).toBe(2);

    const cancelled = harness.service.rollbackInterrupted({
      planDigest: plan.planDigest,
      expectedHead: null,
    });
    expect(cancelled).toMatchObject({
      outcome: "committed",
      journalState: "rolled_back",
      head: { revision: 3 },
    });
    const audit = harness.service.inspectPrivateAudit(cancelled.batchId);
    expect(audit.history).toEqual([
      expect.objectContaining({
        action: "rollback_interrupted",
        publicationParentRef: unrelatedHead,
      }),
    ]);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: missing.id, state: "rolled_back" }),
    ]);
    expect(harness.journal.readCurrent()!.records).toContainEqual(
      expect.objectContaining({ id: "unrelated-draft-before-interrupted-cancel" })
    );
    expect(harness.journal.listOrphans()).toEqual([]);
  });

  it("cancels an interrupted pre-head commit transactionally and permits a fresh exact remigration", () => {
    let phase: "commit" | "rollback" | "done" = "commit";
    let commitInterrupted = false;
    let rollbackInterrupted = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (phase === "commit" && !commitInterrupted && fault.point === "before_head_commit") {
          commitInterrupted = true;
          throw new Error("interrupt commit before head");
        }
        if (
          phase === "rollback" &&
          !rollbackInterrupted &&
          fault.point === "after_staged_generation"
        ) {
          rollbackInterrupted = true;
          throw new Error("interrupt cancellation after staged generation");
        }
      },
    });
    const reference = addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/interrupt commit before head/);
    expect(harness.journal.readCurrent()).toBeNull();
    expect(harness.journal.listOrphans()).toHaveLength(1);
    const retainedGraphHead = harness.service.migrationGraphService.readCurrent().head!;
    const retainedBinding = harness.controlled.observe().artifactBindings[0]!;
    unlinkSync(referenceContentPath(harness.owner, reference.id));

    phase = "rollback";
    expect(() =>
      harness.service.rollbackInterrupted({ planDigest: plan.planDigest, expectedHead: null })
    ).toThrow(/interrupt cancellation after staged generation/);
    expect(harness.journal.readCurrent()).toBeNull();
    expect(harness.journal.listOrphans()).toHaveLength(1);

    const rolledBack = harness.service.rollbackInterrupted({
      planDigest: plan.planDigest,
      expectedHead: null,
    });
    phase = "done";
    expect(rolledBack).toMatchObject({
      mode: "rollback",
      rollbackScope: "interrupted_commit",
      planDigest: plan.planDigest,
      outcome: "committed",
      journalState: "rolled_back",
    });
    expect(harness.journal.listOrphans()).toEqual([]);
    expect(harness.service.migrationGraphService.readCurrent().head).toEqual(retainedGraphHead);
    expect(harness.controlled.observe().artifactBindings).toContainEqual(retainedBinding);
    const audit = harness.service.inspectPrivateAudit(rolledBack.batchId);
    expect(audit.history).toEqual([
      expect.objectContaining({
        action: "rollback_interrupted",
        state: "rolled_back",
        predecessorJournalRef: null,
        graphHeadRef: {
          id: retainedGraphHead.snapshotId,
          digest: retainedGraphHead.digest,
        },
      }),
    ]);

    const replay = harness.service.rollbackInterrupted({
      planDigest: plan.planDigest,
      expectedHead: migrationHeadRef(harness.journal),
    });
    expect(replay).toMatchObject({ outcome: "already_committed", journalState: "rolled_back" });
    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(OwnerReferenceMigrationConflictError);

    writeFileSync(referenceContentPath(harness.owner, reference.id), PRIVATE_BYTES);
    const rolledBackHead = migrationHeadRef(harness.journal)!;
    const freshPlan = harness.service.dryRun({ expectedHead: rolledBackHead });
    expect(freshPlan.planDigest).not.toBe(plan.planDigest);
    expect(freshPlan.mappings).toEqual([
      expect.objectContaining({ legacyId: reference.id, alreadyMapped: true }),
    ]);
    const fresh = harness.service.commit({
      expectedHead: rolledBackHead,
      planDigest: freshPlan.planDigest,
    });
    expect(fresh).toMatchObject({ outcome: "committed", mappedCount: 1, quarantineCount: 0 });
    expect(harness.controlled.observe().artifactBindings).toContainEqual(retainedBinding);
    expect(harness.service.migrationGraphService.readCurrent().head).toEqual(retainedGraphHead);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "mapped" }),
    ]);
  });

  it.each([
    "after_staged_record",
    "after_staged_generation",
    "before_head_commit",
    "after_head_commit",
  ] as const)("resumes safely after an injected %s interruption", (point) => {
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (!injected && fault.point === point) {
          injected = true;
          throw new Error(`injected ${point}`);
        }
      },
    });
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(new RegExp(`injected ${point}`));

    const resumed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    expect(resumed).toMatchObject({ journalState: "committed", mappedCount: 1 });
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ state: "mapped" }),
    ]);
    expect(harness.journal.listOrphans()).toEqual([]);
  });

  it("replays a committed after-head interruption without reopening the deleted legacy source", () => {
    let afterHeadCommits = 0;
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (fault.point !== "after_head_commit") return;
        afterHeadCommits += 1;
        if (afterHeadCommits === 2) {
          injected = true;
          throw new Error("injected after terminal migration head commit");
        }
      },
    });
    const reference = addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/injected after terminal migration head commit/);
    expect(injected).toBe(true);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "mapped" }),
    ]);
    rmSync(harness.owner.rootDirectory, { recursive: true, force: true });

    expect(
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toMatchObject({
      outcome: "already_committed",
      journalState: "committed",
      planDigest: plan.planDigest,
    });
    expect(harness.service.readCompatibility()).toMatchObject({
      legacySourceState: "unavailable",
      ownerReferences: [
        {
          legacyId: reference.id,
          state: "mapped",
          legacySourceState: "unavailable",
        },
      ],
    });
  });

  it("refuses a source-free committed retry when its immutable graph receipt is missing", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    rmSync(harness.owner.rootDirectory, { recursive: true, force: true });
    unlinkSync(path.join(harness.service.intentRootDirectory, `graph.${plan.planDigest}.json`));

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/graph receipt is unavailable/i);
  });

  it("refuses a source-free committed retry when its named graph snapshot is corrupt", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const graphHead = harness.service.inspectPrivateAudit(committed.batchId).history[0]!
      .graphHeadRef!;
    rmSync(harness.owner.rootDirectory, { recursive: true, force: true });
    writeFileSync(
      path.join(
        harness.service.migrationGraphService.store.rootDirectory,
        "snapshots",
        `${graphHead.id}.json`
      ),
      "{}\n"
    );

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/snapshot|schema|record/i);
  });

  it("holds the controlled-artifact binding lock through journal visibility commit", () => {
    let harness!: Harness;
    let contender!: ReferenceSourceControlledArtifactStore;
    let releaseWasExcluded = false;
    harness = createHarness({
      faultInjector: (fault) => {
        if (fault.point !== "before_head_commit") return;
        const binding = harness.controlled.observe().artifactBindings[0]!;
        expect(binding).toBeDefined();
        expect(() =>
          contender.release({
            artifactRef: binding.artifactRef,
            expectedBlobSha256: binding.blobSha256,
          })
        ).toThrow(ReferenceSourceControlledArtifactStoreConflictError);
        releaseWasExcluded = true;
      },
    });
    contender = new ReferenceSourceControlledArtifactStore({
      rootDirectory: harness.controlled.rootDirectory,
      now: () => new Date(NOW),
    });
    const reference = addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });

    harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });

    expect(releaseWasExcluded).toBe(true);
    expect(harness.controlled.observe().artifactBindings).toEqual([
      expect.objectContaining({ blobSha256: reference.sha256 }),
    ]);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "mapped" }),
    ]);
  });

  it("keeps a new migration claimant out while a unique recovery ticket reclaims a stale claim", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const stableHostIdentity = "a".repeat(64);
    const claimRuntime: NonNullable<OwnerReferenceMigrationServiceOptions["claimRuntime"]> = {
      hostIdentity: () => stableHostIdentity,
      bootIdentity: () => "boot.current",
      processStartIdentity: (pid) => (pid === process.pid ? "process.current" : null),
      processExists: (pid) => pid === process.pid,
    };
    let capturedClaim = "";
    harness.service = migrationService(harness, {
      claimRuntime,
      migrationFaultInjector: (fault) => {
        if (fault.point !== "after_migration_claim_published" || capturedClaim) return;
        capturedClaim = readFileSync(fault.path, "utf8");
        throw new Error("capture migration claim before simulated process death");
      },
    });
    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/simulated process death/);

    const stale = JSON.parse(capturedClaim);
    stale.pid = 999_999;
    stale.processStartIdentity = "process.dead";
    const claimPath = path.join(harness.service.intentRootDirectory, ".migration.claim");
    writeFileSync(claimPath, `${canonicalReferenceJson(stale)}\n`, { flag: "wx", mode: 0o600 });
    const contender = migrationService(harness, { claimRuntime });
    let contenderWasExcluded = false;
    harness.service = migrationService(harness, {
      claimRuntime,
      migrationFaultInjector: (fault) => {
        if (fault.point !== "after_migration_recovery_ticket_published") return;
        expect(() => contender.commit({ expectedHead: null, planDigest: plan.planDigest })).toThrow(
          /claim recovery is already in progress/i
        );
        contenderWasExcluded = true;
      },
    });

    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });

    expect(contenderWasExcluded).toBe(true);
    expect(committed).toMatchObject({ outcome: "committed", journalState: "committed" });
    expect(
      readdirSync(harness.service.intentRootDirectory).filter((name) =>
        name.startsWith(".migration")
      )
    ).toEqual([]);
    expect(readdirSync(path.join(harness.service.intentRootDirectory, "recoveries"))).toHaveLength(
      1
    );
  });

  it("binds the journal to the exact staged migration snapshot across an unrelated graph advance", () => {
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (!injected && fault.point === "after_staged_record") {
          injected = true;
          throw new Error("pause after migration graph receipt");
        }
      },
    });
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/pause after migration graph receipt/);
    const migrationGraphHead = harness.service.migrationGraphService.readCurrent().head!;
    const unrelated = unrelatedGraphAsset("after-migration-receipt");
    const advanced = harness.service.migrationGraphService.applyTransaction({
      schemaVersion: 1,
      id: "transaction.unrelated-after-migration-receipt",
      expectedHeadRef: {
        id: migrationGraphHead.snapshotId,
        digest: migrationGraphHead.digest,
      },
      operations: [{ type: "append_record", record: unrelated }],
      submittedAt: LATER,
    });
    expect(advanced.head?.snapshotId).not.toBe(migrationGraphHead.snapshotId);

    const resumed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    const audit = harness.service.inspectPrivateAudit(resumed.batchId);
    expect(audit.history).toHaveLength(1);
    expect(audit.history[0]!.graphHeadRef).toEqual({
      id: migrationGraphHead.snapshotId,
      digest: migrationGraphHead.digest,
    });
    expect(audit.history[0]!.graphHeadRef?.id).not.toBe(advanced.head?.snapshotId);
  });

  it.each([
    "after_staged_record",
    "after_staged_generation",
    "before_head_commit",
    "after_head_commit",
  ] as const)("resumes an interrupted rollback after %s", (point) => {
    let rollbackArmed = false;
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (rollbackArmed && !injected && fault.point === point) {
          injected = true;
          throw new Error(`injected rollback ${point}`);
        }
      },
    });
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    rollbackArmed = true;
    const expectedHead = migrationHeadRef(harness.journal)!;

    expect(() => harness.service.rollback({ batchId: committed.batchId, expectedHead })).toThrow(
      new RegExp(`injected rollback ${point}`)
    );
    const resumed = harness.service.rollback({
      batchId: committed.batchId,
      expectedHead,
    });
    expect(resumed).toMatchObject({ journalState: "rolled_back" });
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ state: "rolled_back" }),
    ]);
    expect(harness.journal.listOrphans()).toEqual([]);
  });

  it("rejects a digest-valid rollback intent that is not closed over the requested rollback", () => {
    let rollbackArmed = false;
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (rollbackArmed && !injected && fault.point === "before_head_commit") {
          injected = true;
          throw new Error("injected rollback before_head_commit");
        }
      },
    });
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const expectedHead = migrationHeadRef(harness.journal)!;
    rollbackArmed = true;
    expect(() => harness.service.rollback({ batchId: committed.batchId, expectedHead })).toThrow(
      /injected rollback before_head_commit/
    );

    const intentPath = path.join(
      harness.service.intentRootDirectory,
      `rollback.${sha256(`${committed.batchId}\u0000${expectedHead.digest}`)}.json`
    );
    const intent = JSON.parse(readFileSync(intentPath, "utf8")) as Record<string, any>;
    intent.transaction = {
      schemaVersion: 1,
      transactionId: "tampered-rollback-transaction",
      writerKind: "migration",
      expectedHead,
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "draft.tampered-rollback-transaction",
          successorRefs: [],
          content: { mustNotPublish: true },
        },
      ],
    };
    delete intent.digest;
    intent.digest = sha256(canonicalReferenceJson(intent));
    writeFileSync(intentPath, `${canonicalReferenceJson(intent)}\n`);

    expect(() => harness.service.rollback({ batchId: committed.batchId, expectedHead })).toThrow(
      /rollback intent failed closure verification/i
    );
    expect(migrationHeadRef(harness.journal)).toEqual(expectedHead);
    expect(
      harness.journal
        .readCurrent()
        ?.records.some(({ id }) => id === "draft.tampered-rollback-transaction")
    ).toBe(false);
  });

  it("rejects stale-head and concurrent legacy mutation without manufacturing a second mapping", () => {
    const shared = createHarness();
    addReference(shared.owner);
    const writerA = shared.service;
    const planA = writerA.dryRun({ expectedHead: null });

    const competingReference = {
      id: "reference.competing",
      title: "Competing private reference",
      citation: "Competing citation",
      mimeType: "application/pdf",
      sha256: createHash("sha256").update("%PDF-competing").digest("hex"),
      byteLength: Buffer.byteLength("%PDF-competing"),
      storedPath: "references/reference.competing/content",
      authorityState: "raw_staged" as const,
      activationAllowed: false as const,
      createdAt: NOW,
    };
    const writerB = migrationService(shared, {
      listLegacyReferences: () => [competingReference],
      readLegacyBytes: () => Buffer.from("%PDF-competing"),
    });
    const planB = writerB.dryRun({ expectedHead: null });

    writerA.commit({ expectedHead: null, planDigest: planA.planDigest });
    expect(() => writerB.commit({ expectedHead: null, planDigest: planB.planDigest })).toThrow(
      OwnerReferenceMigrationConflictError
    );
    expect(writerA.readCompatibility().ownerReferences).toHaveLength(1);

    const file = referenceContentPath(shared.owner, shared.owner.listReferences()[0]!.id);
    writeFileSync(file, "%PDF-mutated-after-plan");
    const head = migrationHeadRef(shared.journal);
    expect(() => writerA.commit({ expectedHead: head, planDigest: planA.planDigest })).toThrow(
      /plan digest|legacy inventory|changed/i
    );
    expect(writerA.readCompatibility().ownerReferences).toHaveLength(1);
  });

  it("retains exact mapping evidence and supports source-free compatibility reads and rollback", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    const recordBytes = readFileSync(
      path.join(harness.owner.rootDirectory, "references", `${reference.id}.json`)
    );
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    const beforeDeletion = harness.service.readCompatibility();
    const mappingId = beforeDeletion.ownerReferences[0]!.mappingId;

    rmSync(harness.owner.rootDirectory, { recursive: true, force: true });

    expect(harness.service.readCompatibility()).toMatchObject({
      legacySourceState: "unavailable",
      ownerReferences: [
        {
          legacyId: reference.id,
          state: "mapped",
          legacySourceState: "unavailable",
          mappingId,
        },
      ],
    });
    const audit = harness.service.inspectPrivateAudit(committed.batchId);
    expect(audit.mappings[0]!.legacyRecordEvidence).toEqual({
      kind: "legacy_record",
      sha256: sha256(recordBytes),
      byteLength: recordBytes.byteLength,
    });
    expect(
      readQuarantineEvidence(harness.service, audit.mappings[0]!.legacyRecordEvidence)
    ).toEqual(recordBytes);

    harness.service.rollback({
      batchId: committed.batchId,
      expectedHead: migrationHeadRef(harness.journal),
    });
    expect(harness.service.readCompatibility()).toMatchObject({
      legacySourceState: "unavailable",
      ownerReferences: [
        {
          legacyId: reference.id,
          state: "rolled_back",
          legacySourceState: "unavailable",
          mappingId,
        },
      ],
    });
    expect(harness.service.inspectPrivateAudit(committed.batchId).mappings).toEqual(audit.mappings);
  });

  it("reports mixed per-reference source verification without dropping permanent mappings", () => {
    const harness = createHarness();
    const verified = addReference(harness.owner, {
      title: "Verified sibling",
      bytes: Buffer.from("verified sibling bytes"),
    });
    const missing = addReference(harness.owner, {
      title: "Missing sibling",
      bytes: Buffer.from("missing sibling bytes"),
    });
    const plan = harness.service.dryRun({ expectedHead: null });
    harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });

    unlinkSync(referenceContentPath(harness.owner, missing.id));
    const compatibility = harness.service.readCompatibility();

    expect(compatibility.legacySourceState).toBe("missing");
    expect(compatibility.ownerReferences.find(({ legacyId }) => legacyId === verified.id)).toEqual(
      expect.objectContaining({ state: "mapped", legacySourceState: "verified" })
    );
    expect(compatibility.ownerReferences.find(({ legacyId }) => legacyId === missing.id)).toEqual(
      expect.objectContaining({ state: "mapped", legacySourceState: "missing" })
    );
  });

  it("quarantines a readable post-commit source divergence while retaining its mapping ID", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({
      expectedHead: null,
      planDigest: plan.planDigest,
    });
    const mappingId = harness.service.readCompatibility().ownerReferences[0]!.mappingId;
    const auditBefore = harness.service.inspectPrivateAudit(committed.batchId);

    writeFileSync(referenceContentPath(harness.owner, reference.id), "corrupt live source bytes");
    expect(harness.service.readCompatibility()).toMatchObject({
      legacySourceState: "diverged",
      ownerReferences: [
        {
          legacyId: reference.id,
          state: "quarantined",
          legacySourceState: "diverged",
          quarantineReason: "immutable_mapping_conflict",
          mappingId,
        },
      ],
    });
    expect(harness.service.inspectPrivateAudit(committed.batchId).mappings).toEqual(
      auditBefore.mappings
    );
  });

  it("leaves the journal head unchanged for a semantic no-op rerun of mapped inventory", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const firstPlan = harness.service.dryRun({ expectedHead: null });
    harness.service.commit({ expectedHead: null, planDigest: firstPlan.planDigest });
    const headBefore = migrationHeadRef(harness.journal)!;

    const rerunPlan = harness.service.dryRun({ expectedHead: headBefore });
    expect(rerunPlan.mappings).toEqual([expect.objectContaining({ alreadyMapped: true })]);
    const rerun = harness.service.commit({
      expectedHead: headBefore,
      planDigest: rerunPlan.planDigest,
    });
    expect(rerun).toMatchObject({
      outcome: "no_changes",
      journalState: "unchanged",
      head: {
        generationId: headBefore.id,
        digest: headBefore.digest,
        revision: headBefore.revision,
      },
    });
    expect(migrationHeadRef(harness.journal)).toEqual(headBefore);
  });

  it("leaves the journal head unchanged for a semantic no-op rerun of quarantined inventory", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    writeFileSync(referenceContentPath(harness.owner, reference.id), "%PDF-stably-mismatched");
    const firstPlan = harness.service.dryRun({ expectedHead: null });
    harness.service.commit({ expectedHead: null, planDigest: firstPlan.planDigest });
    const headBefore = migrationHeadRef(harness.journal)!;

    const rerunPlan = harness.service.dryRun({ expectedHead: headBefore });
    expect(rerunPlan.quarantines).toEqual(firstPlan.quarantines);
    const rerun = harness.service.commit({
      expectedHead: headBefore,
      planDigest: rerunPlan.planDigest,
    });
    expect(rerun).toMatchObject({
      outcome: "no_changes",
      journalState: "unchanged",
      head: {
        generationId: headBefore.id,
        digest: headBefore.digest,
        revision: headBefore.revision,
      },
    });
    expect(migrationHeadRef(harness.journal)).toEqual(headBefore);
  });

  it("rolls back through a monotonic journal successor while retaining permanent mappings", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const auditBefore = harness.service.inspectPrivateAudit(committed.batchId);
    const committedHead = migrationHeadRef(harness.journal);

    const rolledBack = harness.service.rollback({
      batchId: committed.batchId,
      expectedHead: committedHead,
    });
    expect(rolledBack).toMatchObject({
      mode: "rollback",
      journalState: "rolled_back",
      outcome: "committed",
    });
    expect(rolledBack.head.revision).toBe(committedHead!.revision + 1);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ state: "rolled_back" }),
    ]);
    expect(harness.service.inspectPrivateAudit(committed.batchId).mappings).toEqual(
      auditBefore.mappings
    );

    const replay = harness.service.rollback({
      batchId: committed.batchId,
      expectedHead: migrationHeadRef(harness.journal),
    });
    expect(replay).toMatchObject({ journalState: "rolled_back", outcome: "already_committed" });
  });

  it("replays a completed rollback from its original commit head after unrelated descendants", () => {
    const harness = createHarness();
    addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    const committed = harness.service.commit({ expectedHead: null, planDigest: plan.planDigest });
    const committedHead = migrationHeadRef(harness.journal)!;
    harness.service.rollback({ batchId: committed.batchId, expectedHead: committedHead });
    const unrelated = harness.journal.publish({
      schemaVersion: 1,
      transactionId: "unrelated-publication-after-completed-rollback",
      writerKind: "system",
      expectedHead: migrationHeadRef(harness.journal),
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "unrelated-draft-after-completed-rollback",
          successorRefs: [],
          content: { purpose: "must survive historical rollback replay" },
        },
      ],
    });

    const replay = harness.service.rollback({
      batchId: committed.batchId,
      expectedHead: committedHead,
    });

    expect(replay).toMatchObject({
      outcome: "already_committed",
      journalState: "rolled_back",
      head: unrelated.head,
    });
    expect(harness.journal.readCurrent()).toMatchObject({
      head: unrelated.head,
      records: expect.arrayContaining([
        expect.objectContaining({ id: "unrelated-draft-after-completed-rollback" }),
      ]),
    });
  });

  it("allows a fresh remigration after rollback and rejects replay of the rolled-back commit", () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    const firstPlan = harness.service.dryRun({ expectedHead: null });
    const firstCommit = harness.service.commit({
      expectedHead: null,
      planDigest: firstPlan.planDigest,
    });
    harness.service.rollback({
      batchId: firstCommit.batchId,
      expectedHead: migrationHeadRef(harness.journal),
    });
    const rolledBackHead = migrationHeadRef(harness.journal)!;

    const freshPlan = harness.service.dryRun({ expectedHead: rolledBackHead });
    expect(freshPlan.planDigest).not.toBe(firstPlan.planDigest);
    const freshCommit = harness.service.commit({
      expectedHead: rolledBackHead,
      planDigest: freshPlan.planDigest,
    });
    expect(freshCommit).toMatchObject({ outcome: "committed", journalState: "committed" });
    expect(freshCommit.batchId).not.toBe(firstCommit.batchId);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "mapped" }),
    ]);

    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: firstPlan.planDigest })
    ).toThrow(OwnerReferenceMigrationConflictError);
    expect(harness.service.readCompatibility().ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "mapped" }),
    ]);
  });

  it("exposes only redacted compatibility, dry-run, commit, and rollback views over HTTP", async () => {
    const harness = createHarness();
    const reference = addReference(harness.owner);
    const rawRecordSha256 = sha256(
      readFileSync(path.join(harness.owner.rootDirectory, "references", `${reference.id}.json`))
    );
    const server = await listen(createApp({ ownerReferenceMigrationService: harness.service }));
    servers.push(server);
    const base = address(server);

    const dryRun = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/dry-run`,
      {
        method: "POST",
        body: JSON.stringify({ expectedHead: null }),
      }
    );
    expect(dryRun.response.status).toBe(200);
    expect(dryRun.json.data).not.toHaveProperty("legacyInventoryDigest");
    expect(dryRun.json.data.mappings[0]).not.toHaveProperty("targetAssetId");
    expect(dryRun.json.data.mappings[0]).not.toHaveProperty("targetAcquisitionId");
    const planDigest = String(dryRun.json.data.planDigest);

    const commit = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/commit`,
      {
        method: "POST",
        body: JSON.stringify({ expectedHead: null, planDigest }),
      }
    );
    expect(commit.response.status).toBe(200);
    const current = await jsonRequest(`${base}/api/owner/reference-migrations/owner-references`, {
      method: "GET",
    });
    expect(current.response.status).toBe(200);
    expect(current.json.data.ownerReferences).toEqual([
      expect.objectContaining({ state: "mapped" }),
    ]);

    const rollback = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/rollback`,
      {
        method: "POST",
        body: JSON.stringify({
          batchId: commit.json.data.batchId,
          expectedHead: {
            id: commit.json.data.head.generationId,
            digest: commit.json.data.head.digest,
            revision: commit.json.data.head.revision,
          },
        }),
      }
    );
    expect(rollback.response.status).toBe(200);
    expect(rollback.json.data.journalState).toBe("rolled_back");

    const publicText = JSON.stringify({
      dryRun: dryRun.json,
      commit: commit.json,
      current: current.json,
    });
    for (const privateFingerprint of [
      PRIVATE_TITLE,
      PRIVATE_CITATION,
      PRIVATE_BYTES.toString("utf8"),
      reference.sha256,
      rawRecordSha256,
    ]) {
      expect(publicText).not.toContain(privateFingerprint);
    }
  });

  it("exposes transactional interrupted-commit rollback and idempotent replay over HTTP", async () => {
    let injected = false;
    const harness = createHarness({
      faultInjector: (fault) => {
        if (!injected && fault.point === "before_head_commit") {
          injected = true;
          throw new Error("interrupt HTTP fixture commit");
        }
      },
    });
    const reference = addReference(harness.owner);
    const plan = harness.service.dryRun({ expectedHead: null });
    expect(() =>
      harness.service.commit({ expectedHead: null, planDigest: plan.planDigest })
    ).toThrow(/interrupt HTTP fixture commit/);
    const server = await listen(createApp({ ownerReferenceMigrationService: harness.service }));
    servers.push(server);
    const base = address(server);

    const rollback = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/rollback-interrupted`,
      {
        method: "POST",
        body: JSON.stringify({ planDigest: plan.planDigest, expectedHead: null }),
      }
    );
    expect(rollback.response.status).toBe(200);
    expect(rollback.json.data).toMatchObject({
      rollbackScope: "interrupted_commit",
      planDigest: plan.planDigest,
      outcome: "committed",
      journalState: "rolled_back",
    });

    const compatibility = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references`,
      { method: "GET" }
    );
    expect(compatibility.response.status).toBe(200);
    expect(compatibility.json.data.ownerReferences).toEqual([
      expect.objectContaining({ legacyId: reference.id, state: "rolled_back" }),
    ]);

    const replay = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/rollback-interrupted`,
      {
        method: "POST",
        body: JSON.stringify({
          planDigest: plan.planDigest,
          expectedHead: {
            id: rollback.json.data.head.generationId,
            digest: rollback.json.data.head.digest,
            revision: rollback.json.data.head.revision,
          },
        }),
      }
    );
    expect(replay.response.status).toBe(200);
    expect(replay.json.data.outcome).toBe("already_committed");

    const invalid = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/rollback-interrupted`,
      {
        method: "POST",
        body: JSON.stringify({ planDigest: "not-a-digest", expectedHead: null }),
      }
    );
    expect(invalid.response.status).toBe(400);
  });
});

type Harness = ReturnType<typeof createHarness> & { service: OwnerReferenceMigrationService };

function createHarness(
  options: {
    faultInjector?: ConstructorParameters<typeof KnowledgePublicationStore>[0]["faultInjector"];
  } = {}
) {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t09-owner-reference-migration-"));
  roots.push(root);
  const owner = new OwnerStore({
    rootDirectory: path.join(root, "owner"),
    now: () => new Date(NOW),
  });
  const controlled = new ReferenceSourceControlledArtifactStore({
    rootDirectory: path.join(root, "controlled"),
    now: () => new Date(NOW),
  });
  const journal = new KnowledgePublicationStore({
    rootDirectory: path.join(root, "migration-journal"),
    now: () => new Date(NOW),
    faultInjector: options.faultInjector,
  });
  const harness = { root, owner, controlled, journal } as Omit<Harness, "service">;
  return { ...harness, service: migrationService(harness) } as Harness;
}

function migrationService(
  harness: Pick<Harness, "root" | "owner" | "controlled" | "journal">,
  overrides: {
    listLegacyReferences?: () => ReturnType<OwnerStore["listReferences"]>;
    readLegacyBytes?: (id: string) => Buffer;
    identityDisposition?: (
      reference: ReturnType<OwnerStore["listReferences"]>[number]
    ) => LegacyOwnerReferenceIdentityDisposition;
    migrationFaultInjector?: OwnerReferenceMigrationServiceOptions["faultInjector"];
    claimRuntime?: OwnerReferenceMigrationServiceOptions["claimRuntime"];
  } = {}
) {
  const callbackSource = overrides.listLegacyReferences || overrides.readLegacyBytes;
  return new OwnerReferenceMigrationService({
    journalStore: harness.journal,
    controlledStore: harness.controlled,
    intentRootDirectory: path.join(harness.root, "migration-intents"),
    ...(callbackSource
      ? {
          listLegacyReferences:
            overrides.listLegacyReferences ?? (() => harness.owner.listReferences()),
          readLegacyBytes:
            overrides.readLegacyBytes ??
            ((id: string) => readFileSync(referenceContentPath(harness.owner, id))),
        }
      : {
          legacySource: new OwnerReferenceLegacyReader({
            rootDirectory: harness.owner.rootDirectory,
          }),
        }),
    classifyIdentity: overrides.identityDisposition ?? (() => "asset_only"),
    now: () => new Date(NOW),
    faultInjector: overrides.migrationFaultInjector,
    claimRuntime: overrides.claimRuntime,
  });
}

function addReference(
  owner: OwnerStore,
  options: { title?: string; citation?: string; bytes?: Buffer } = {}
) {
  const bytes = options.bytes ?? PRIVATE_BYTES;
  return owner.addReference({
    title: options.title ?? PRIVATE_TITLE,
    citation: options.citation ?? PRIVATE_CITATION,
    mimeType: "application/pdf",
    contentBase64: bytes.toString("base64"),
  });
}

function callbackReference(input: {
  id: string;
  bytes: Buffer;
  mimeType?: string;
  title?: string;
  citation?: string;
}) {
  return {
    id: input.id,
    title: input.title ?? `Private title for ${input.id}`,
    citation: input.citation ?? `Private citation for ${input.id}`,
    mimeType: input.mimeType ?? "application/pdf",
    sha256: sha256(input.bytes),
    byteLength: input.bytes.byteLength,
    storedPath: `references/${input.id}/content`,
    authorityState: "raw_staged" as const,
    activationAllowed: false as const,
    createdAt: NOW,
  };
}

function targetCollisionAsset(
  declaredSha256: string,
  byteLength: number
): ReferenceSourceStagingInputRecord {
  return withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.sha256.${declaredSha256}`,
    sha256: declaredSha256,
    mediaType: "application/x-intentional-target-collision",
    byteLength,
  }) as ReferenceSourceStagingInputRecord;
}

function unrelatedGraphAsset(label: string): ReferenceSourceStagingInputRecord {
  const bytes = Buffer.from(`unrelated graph asset ${label}`);
  const digest = sha256(bytes);
  return withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.sha256.${digest}`,
    sha256: digest,
    mediaType: "application/octet-stream",
    byteLength: bytes.byteLength,
  }) as ReferenceSourceStagingInputRecord;
}

function readQuarantineEvidence(
  service: OwnerReferenceMigrationService,
  evidence: { kind: "legacy_record" | "observed_content"; sha256: string }
): Buffer {
  return readFileSync(
    path.join(service.quarantineEvidenceRootDirectory, evidence.kind, `${evidence.sha256}.bin`)
  );
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function referenceContentPath(owner: OwnerStore, id: string): string {
  return path.join(owner.rootDirectory, "references", id, "content");
}

function migrationHeadRef(store: KnowledgePublicationStore) {
  const head = store.readHead();
  return head ? { id: head.generationId, digest: head.digest, revision: head.revision } : null;
}

async function listen(app: ReturnType<typeof createApp>): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function address(server: Server): string {
  const value = server.address();
  if (!value || typeof value === "string") throw new Error("Missing test server address");
  return `http://127.0.0.1:${value.port}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return { response, json: (await response.json()) as any };
}
