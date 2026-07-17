import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { referenceSourceDigest } from "../../src/lib/reference-source-domain.js";
import {
  KnowledgeResolverPreflightSchema,
  buildCutoverRecord,
  type KnowledgeResolverPreflight,
} from "../../src/lib/knowledge-resolver-cutover-contract.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import {
  KnowledgeResolverCutoverService,
  type KnowledgeResolverPreflightRequest,
} from "../../src/server/lib/knowledge-resolver-cutover-service.js";
import { createT14KnowledgeResolutionFixture } from "../support/t14-knowledge-resolution-fixture.js";

const NOW = "2026-07-16T20:00:00.000Z";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T15 transactional resolver cutover", () => {
  it("atomically enables the complete manifest resolver while disabling legacy activation", () => {
    const fixture = createT14KnowledgeResolutionFixture(temporaryRoot());
    const service = new KnowledgeResolverCutoverService({
      publicationStore: fixture.store,
      now: () => new Date(NOW),
    });

    const before = service.readActive();
    expect(before).toMatchObject({
      mode: "legacy",
      legacyActivationEnabled: true,
      completeManifestResolverEnabled: false,
    });

    const preflight = service.preflight(preflightRequest());
    expect(preflight.result).toBe("pass");
    expect(preflight.checks.map(({ check }) => check)).toEqual([
      "authority_registry",
      "compatible_readers",
      "migration",
      "rights",
      "rollback",
      "shadow_comparison",
    ]);

    const cutover = service.cutover({
      preflight,
      expectedHead: before.publicationGenerationRef,
    });
    expect(cutover.active).toMatchObject({
      mode: "complete_manifest",
      legacyActivationEnabled: false,
      completeManifestResolverEnabled: true,
      activeExecutionIdentity: cutover.projection.executionIdentity,
    });
    expect(cutover.active.cutoverProofManifestRef).toEqual({
      id: cutover.projection.manifest.id,
      digest: cutover.projection.manifest.digest,
    });
    expect(service.readActive()).toEqual(cutover.active);
  });

  it("rolls behavior back to the exact prior authority head without deleting successors", () => {
    const fixture = createT14KnowledgeResolutionFixture(temporaryRoot());
    const service = new KnowledgeResolverCutoverService({
      publicationStore: fixture.store,
      now: () => new Date(NOW),
    });
    const before = service.readActive();
    const cutover = service.cutover({
      preflight: service.preflight(preflightRequest()),
      expectedHead: before.publicationGenerationRef,
    });
    const successorRecordRefs = cutover.snapshot.generation.recordRefs;

    const rollback = service.rollback({
      expectedHead: cutover.active.publicationGenerationRef,
    });

    expect(rollback.active).toMatchObject({
      mode: "legacy",
      legacyActivationEnabled: true,
      completeManifestResolverEnabled: false,
      activeAuthorityHeadRef: before.activeAuthorityHeadRef,
    });
    expect(rollback.snapshot.generation.recordRefs).toEqual(
      expect.arrayContaining(successorRecordRefs)
    );
    expect(rollback.snapshot.generation.newRecordRefs).toEqual([
      expect.objectContaining({ recordKind: "knowledge_resolver_control_state" }),
    ]);
  });

  it.each([
    "after_staged_record",
    "after_staged_generation",
    "before_head_commit",
    "after_head_commit",
  ] as const)("recovers a cutover interrupted at %s to one valid authority", (point) => {
    const root = temporaryRoot();
    const fixture = createT14KnowledgeResolutionFixture(root);
    let injected = false;
    const faultingStore = new KnowledgePublicationStore({
      rootDirectory: fixture.store.rootDirectory,
      now: () => new Date(NOW),
      faultInjector: (fault) => {
        if (!injected && fault.point === point) {
          injected = true;
          throw new Error(`injected cutover ${point}`);
        }
      },
    });
    const faulting = new KnowledgeResolverCutoverService({
      publicationStore: faultingStore,
      now: () => new Date(NOW),
    });
    const before = faulting.readActive();
    const preflight = faulting.preflight(preflightRequest());
    expect(() =>
      faulting.cutover({ preflight, expectedHead: before.publicationGenerationRef })
    ).toThrow(`injected cutover ${point}`);

    const recovered = new KnowledgeResolverCutoverService({
      publicationStore: new KnowledgePublicationStore({
        rootDirectory: fixture.store.rootDirectory,
        now: () => new Date(NOW),
      }),
      now: () => new Date(NOW),
    });
    const outcome = recovered.cutover({
      preflight,
      expectedHead: before.publicationGenerationRef,
    });
    expect(outcome.active).toMatchObject({
      mode: "complete_manifest",
      legacyActivationEnabled: false,
      completeManifestResolverEnabled: true,
    });
    expect(
      Number(outcome.active.legacyActivationEnabled) +
        Number(outcome.active.completeManifestResolverEnabled)
    ).toBe(1);
  });

  it.each([
    "after_staged_record",
    "after_staged_generation",
    "before_head_commit",
    "after_head_commit",
  ] as const)("recovers rollback interrupted at %s without losing successor data", (point) => {
    const root = temporaryRoot();
    const fixture = createT14KnowledgeResolutionFixture(root);
    const setup = new KnowledgeResolverCutoverService({
      publicationStore: fixture.store,
      now: () => new Date(NOW),
    });
    const before = setup.readActive();
    const cutover = setup.cutover({
      preflight: setup.preflight(preflightRequest()),
      expectedHead: before.publicationGenerationRef,
    });
    let injected = false;
    const faulting = new KnowledgeResolverCutoverService({
      publicationStore: new KnowledgePublicationStore({
        rootDirectory: fixture.store.rootDirectory,
        now: () => new Date(NOW),
        faultInjector: (fault) => {
          if (!injected && fault.point === point) {
            injected = true;
            throw new Error(`injected rollback ${point}`);
          }
        },
      }),
      now: () => new Date(NOW),
    });
    expect(() =>
      faulting.rollback({ expectedHead: cutover.active.publicationGenerationRef })
    ).toThrow(`injected rollback ${point}`);

    const recovered = new KnowledgeResolverCutoverService({
      publicationStore: new KnowledgePublicationStore({
        rootDirectory: fixture.store.rootDirectory,
        now: () => new Date(NOW),
      }),
      now: () => new Date(NOW),
    }).rollback({ expectedHead: cutover.active.publicationGenerationRef });
    expect(recovered.active).toMatchObject({
      mode: "legacy",
      activeAuthorityHeadRef: before.activeAuthorityHeadRef,
    });
    expect(recovered.snapshot.generation.recordRefs).toEqual(
      expect.arrayContaining(cutover.snapshot.generation.recordRefs)
    );
  });

  it("rejects direct legacy activation and stale cached authority after cutover", () => {
    const fixture = createT14KnowledgeResolutionFixture(temporaryRoot());
    const service = new KnowledgeResolverCutoverService({
      publicationStore: fixture.store,
      now: () => new Date(NOW),
    });
    const before = service.readActive();
    const cutover = service.cutover({
      preflight: service.preflight(preflightRequest()),
      expectedHead: before.publicationGenerationRef,
    });
    expect(() => service.assertExecutionAuthority({ authority: "legacy" })).toThrow(
      "legacy is not the active resolver authority"
    );
    expect(() =>
      service.assertExecutionAuthority({
        authority: "complete_manifest",
        cachedControlStateRef: { id: "stale-control-state", digest: "0".repeat(64) },
      })
    ).toThrow("Resolver authority cache is stale");
    const exactExecution = service.resolveForExecution(
      preflightRequest(),
      cutover.active.controlStateRef
    );
    expect(exactExecution.manifest.entries.length).toBeGreaterThan(0);
    expect(exactExecution.executionIdentity.appliedKnowledgeManifestRef).toEqual({
      id: exactExecution.manifest.id,
      digest: exactExecution.manifest.digest,
    });
  });

  it("fails closed when migration quarantine is present", () => {
    const fixture = createT14KnowledgeResolutionFixture(temporaryRoot());
    const head = fixture.store.readCurrent()!;
    fixture.store.publish({
      schemaVersion: 1,
      transactionId: "t15-migration-quarantine",
      writerKind: "migration",
      expectedHead: generationRef(head),
      writes: [
        {
          recordKind: "owner_reference_migration_quarantine",
          id: "published.owner-reference-migration-quarantine.t15",
          successorRefs: [],
          content: { id: "migration-quarantine.t15", reason: "unresolved_reference" },
        },
      ],
    });
    const service = new KnowledgeResolverCutoverService({
      publicationStore: fixture.store,
      now: () => new Date(NOW),
    });
    const preflight = service.preflight(preflightRequest());
    expect(preflight.result).toBe("fail");
    expect(preflight.checks.find(({ check }) => check === "migration")?.status).toBe("fail");
    expect(() =>
      service.cutover({
        preflight,
        expectedHead: service.readActive().publicationGenerationRef,
      })
    ).toThrow("Resolver cutover preflight did not pass");
  });

  it("rejects a stale cutover head and a preflight with missing manifest components", () => {
    const fixture = createT14KnowledgeResolutionFixture(temporaryRoot());
    const service = new KnowledgeResolverCutoverService({
      publicationStore: fixture.store,
      now: () => new Date(NOW),
    });
    const before = service.readActive();
    const preflight = service.preflight(preflightRequest());
    const withoutAuthorityPaths = buildCutoverRecord<KnowledgeResolverPreflight>(
      KnowledgeResolverPreflightSchema,
      "knowledge-resolver-preflight",
      {
        ...preflight,
        projection: {
          ...preflight.projection,
          componentRegistry: {
            ...preflight.projection.componentRegistry,
            authorityPathOutcomes:
              preflight.projection.componentRegistry.authorityPathOutcomes.slice(1),
          },
        },
      }
    );
    expect(() =>
      service.cutover({
        preflight: withoutAuthorityPaths,
        expectedHead: before.publicationGenerationRef,
      })
    ).toThrow();

    const current = fixture.store.readCurrent()!;
    fixture.store.publish({
      schemaVersion: 1,
      transactionId: "t15-concurrent-writer",
      writerKind: "system",
      expectedHead: generationRef(current),
      writes: [
        {
          recordKind: "knowledge_test_policy",
          id: "published.knowledge-test-policy.t15-concurrent",
          successorRefs: [],
          content: { id: "knowledge-test-policy.t15-concurrent" },
        },
      ],
    });
    expect(() =>
      service.cutover({ preflight, expectedHead: before.publicationGenerationRef })
    ).toThrow("Resolver cutover publication head changed");
  });
});

function preflightRequest(): KnowledgeResolverPreflightRequest {
  return {
    mode: "ordinary_default",
    sourceProfile: null,
    instrumentFamily: null,
    notationSystem: null,
    sourceCourseCount: null,
    historicalSignState: null,
    passageRef: externalRef("passage.synthetic-t15"),
    sourceContextRefs: [],
    analysisRef: externalRef("analysis.synthetic-t15"),
    arrangementPlanRef: externalRef("arrangement-plan.synthetic-t15"),
    arrangementBriefRef: externalRef("arrangement-brief.synthetic-t15"),
    performanceBriefRef: externalRef("performance-brief.synthetic-t15"),
    preservationPolicyRef: externalRef("preservation-policy.synthetic-t15"),
    instrumentInstanceRef: externalRef("instrument-instance.synthetic-t15"),
  };
}

function externalRef(id: string) {
  return { id, digest: referenceSourceDigest({ id }) };
}

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t15-cutover-"));
  roots.push(root);
  return root;
}

function generationRef(
  snapshot: NonNullable<ReturnType<KnowledgePublicationStore["readCurrent"]>>
) {
  return {
    id: snapshot.generation.id,
    digest: snapshot.generation.digest,
    revision: snapshot.generation.revision,
  };
}
