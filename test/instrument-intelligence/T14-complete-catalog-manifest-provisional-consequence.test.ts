import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Value } from "@sinclair/typebox/value";
import { afterEach, describe, expect, it } from "vitest";

import { SearchExecutionIdentitySchema } from "../../src/lib/constraint-search.js";
import {
  KnowledgeComponentRegistrySnapshotSchema,
  KnowledgeInventoryOutcomeSchema,
  KnowledgeLibraryInventorySnapshotSchema,
  buildKnowledgeResolutionRecord,
  type KnowledgeComponentRegistrySnapshot,
  type KnowledgeInventoryOutcome,
  type KnowledgeLibraryInventorySnapshot,
  type KnowledgeResolutionRef,
} from "../../src/lib/knowledge-resolution-contract.js";
import { referenceSourceDigest } from "../../src/lib/reference-source-domain.js";
import { EvaluationStore } from "../../src/server/lib/evaluation-store.js";
import {
  KnowledgeResolutionService,
  validateKnowledgeResolutionProjection,
  type KnowledgeResolutionRequest,
} from "../../src/server/lib/knowledge-resolution-service.js";
import { createT14KnowledgeResolutionFixture } from "../support/t14-knowledge-resolution-fixture.js";

const NOW = "2026-07-16T17:00:00.000Z";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T14 complete catalog, manifest, and provisional consequence", () => {
  it("rebuilds the exact T12 release closure and keeps default Guided Start inactive", () => {
    const harness = fixture();
    const service = resolver(harness.store);
    const ordinary = service.preview(request("ordinary_default"));

    expect(ordinary.inventory.allReleaseRefs).toHaveLength(1);
    expect(ordinary.outcomes).toHaveLength(1);
    expect(ordinary.outcomes[0]).toMatchObject({
      state: "eligible",
      profileRefs: [expect.objectContaining({ id: expect.stringContaining("knowledge-profile") })],
      rightsDecisionRefs: [
        expect.objectContaining({ id: expect.stringContaining("authority-verification") }),
      ],
    });
    expect(ordinary.manifest.completeness).toBe("complete");
    expect(ordinary.manifest.entries).toHaveLength(1);
    expect(ordinary.manifest.entries[0]!.status).toBe("unknown");
    expect(ordinary.activationDecisions.every(({ result }) => result !== "allow")).toBe(true);
    expect(ordinary.consequences).toEqual([]);
    expect(ordinary.ordinaryActivation).toBe(false);
    expect(ordinary.readinessClaim).toBe(false);
    expect(ordinary.componentRegistry.authorityPathOutcomes).not.toHaveLength(0);
    expect(ordinary.executionIdentity).toMatchObject({
      inventorySnapshotRef: ref(ordinary.inventory),
      catalogSnapshotRef: ref(ordinary.catalog),
      componentRegistrySnapshotRef: ref(ordinary.componentRegistry),
      resolutionPolicyRef: ref(ordinary.policy),
      appliedKnowledgeManifestRef: ref(ordinary.manifest),
    });
  });

  it("shows and atomically publishes the exact Mace consequence only in provisional research", () => {
    const harness = fixture();
    const service = resolver(harness.store);
    const provisional = service.preview(request("provisional_research"));

    expect(provisional.manifest.entries).toEqual([
      expect.objectContaining({
        status: "applicable",
        rationaleCode: "provisional_research_test_only_consequence",
      }),
    ]);
    expect(provisional.activationDecisions).toEqual([
      expect.objectContaining({
        result: "allow",
        authority: expect.objectContaining({
          kind: "test_only",
          permittedUse: "provisional_research",
        }),
      }),
    ]);
    expect(provisional.consequences).toEqual([
      expect.objectContaining({
        courseMappings: [
          { course: 7, sign: "a" },
          { course: 8, sign: "/a" },
          { course: 9, sign: "//a" },
          { course: 10, sign: "///a" },
          { course: 11, sign: "4" },
          { course: 12, sign: "5" },
        ],
        course13Disposition: "unresolved_no_mapping",
        presentation: "provisional_research_only",
        readinessClaim: false,
      }),
    ]);

    const before = harness.store.readCurrent()!;
    const committed = service.resolve({
      ...request("provisional_research"),
      expectedHead: generationRef(before),
    });
    expect(committed.snapshot.head.revision).toBe(before.head.revision + 1);
    expect(committed.snapshot.generation.writerKind).toBe("activation");
    expect(committed.snapshot.generation.newRecordRefs.map(({ recordKind }) => recordKind)).toEqual(
      expect.arrayContaining([
        "knowledge_library_inventory_snapshot",
        "knowledge_catalog_snapshot",
        "activation_decision",
        "knowledge_component_registry_snapshot",
        "knowledge_provisional_consequence",
        "applied_knowledge_manifest",
      ])
    );
    expect(committed.projection.publicationGenerationRef).toEqual(generationRef(before));
    validateKnowledgeResolutionProjection(committed.projection, before);
  });

  it.each([
    "release",
    "outcome",
    "profile",
    "dependency",
    "component",
    "authority_path",
    "rights_decision",
  ] as const)("invalidates completeness when the %s closure is omitted", (omission) => {
    const harness = fixture();
    const snapshot = harness.store.readCurrent()!;
    const projection = resolver(harness.store).preview(request("provisional_research"));
    const forged = structuredClone(projection);

    if (omission === "release") {
      forged.inventory = buildKnowledgeResolutionRecord<KnowledgeLibraryInventorySnapshot>(
        KnowledgeLibraryInventorySnapshotSchema,
        "knowledge_library_inventory_snapshot",
        { ...withoutDigest(forged.inventory), allReleaseRefs: [] }
      );
    } else if (omission === "outcome") {
      forged.outcomes = [];
    } else if (omission === "component" || omission === "authority_path") {
      forged.componentRegistry = buildKnowledgeResolutionRecord<KnowledgeComponentRegistrySnapshot>(
        KnowledgeComponentRegistrySnapshotSchema,
        "knowledge_component_registry_snapshot",
        {
          ...withoutDigest(forged.componentRegistry),
          ...(omission === "component"
            ? { entries: forged.componentRegistry.entries.slice(1) }
            : { authorityPathOutcomes: forged.componentRegistry.authorityPathOutcomes.slice(1) }),
        }
      );
    } else {
      const outcome = forged.outcomes[0]!;
      forged.outcomes[0] = buildKnowledgeResolutionRecord<KnowledgeInventoryOutcome>(
        KnowledgeInventoryOutcomeSchema,
        "knowledge_inventory_outcome",
        {
          ...withoutDigest(outcome),
          ...(omission === "profile" ? { profileRefs: [] } : {}),
          ...(omission === "dependency"
            ? { dependencyRefs: [externalRef("release.omitted-dependency")] }
            : {}),
          ...(omission === "rights_decision" ? { rightsDecisionRefs: [] } : {}),
        }
      );
    }

    expect(() => validateKnowledgeResolutionProjection(forged, snapshot)).toThrow();
  });

  it("preserves distinct inventory and contextual applicability states", () => {
    const harness = fixture();
    const base = resolver(harness.store).preview(request("ordinary_default")).outcomes[0]!;
    const states = [
      "eligible",
      "excluded",
      "conflicting",
      "retracted",
      "unavailable_source",
      "inapplicable",
      "unknown",
    ] as const;
    const decoded = states.map(
      (state) =>
        buildKnowledgeResolutionRecord<KnowledgeInventoryOutcome>(
          KnowledgeInventoryOutcomeSchema,
          "knowledge_inventory_outcome",
          {
            ...withoutDigest(base),
            id: `knowledge-inventory-outcome.synthetic-${state}`,
            state,
            exclusionReasonCodes: state === "eligible" ? [] : [`state_${state}`],
          }
        ).state
    );
    expect(decoded).toEqual(states);
    expect(
      resolver(harness.store).preview(request("provisional_research")).manifest.entries[0]!.status
    ).toBe("applicable");
  });

  it("persists the exact resolver identity on search and Evaluation Run records", () => {
    const harness = fixture();
    const identity = resolver(harness.store).preview(
      request("provisional_research")
    ).executionIdentity;
    const digest = "a".repeat(64);
    const searchIdentity = Value.Decode(SearchExecutionIdentitySchema, {
      digest,
      adapter: component("adapter.synthetic", digest),
      compiler: component("compiler.synthetic", digest),
      evaluators: [component("evaluator.synthetic", digest)],
      profiles: [],
      capabilities: [component("capability.synthetic", digest)],
      knowledgePacks: [],
      dependencies: [component("dependency.synthetic", digest)],
      arrangementPlanId: "arrangement-plan.synthetic",
      performanceBriefId: "performance-brief.synthetic",
      targetConfigurationId: "target.synthetic",
      constraintDigests: [],
      attemptConfigurationDigest: digest,
      orderingDigest: digest,
      pruningDigest: digest,
      seed: 0,
      knowledgeResolutionIdentity: identity,
    });
    expect(searchIdentity.knowledgeResolutionIdentity).toEqual(identity);

    const evaluationStore = new EvaluationStore({
      rootDirectory: temporaryRoot("vellum-t14-eval-"),
    });
    const running = evaluationStore.saveRun({
      id: "evaluation-run.synthetic-t14",
      manifestId: "evaluation-manifest.synthetic-t14",
      executionStatus: "running",
      caseRunIds: [],
      startedAt: NOW,
      knowledgeResolutionIdentity: identity,
    });
    evaluationStore.saveRun({
      ...running,
      executionStatus: "completed",
      completedAt: NOW,
    });
    expect(
      evaluationStore.getRun("evaluation-run.synthetic-t14").knowledgeResolutionIdentity
    ).toEqual(identity);
  });
});

function fixture() {
  return createT14KnowledgeResolutionFixture(temporaryRoot("vellum-t14-fixture-"));
}

function resolver(store: ReturnType<typeof fixture>["store"]) {
  return new KnowledgeResolutionService({ publicationStore: store, now: () => new Date(NOW) });
}

function request(mode: "ordinary_default" | "provisional_research" | "isolated_evaluation") {
  const scoped = mode === "ordinary_default" ? null : true;
  return {
    mode,
    sourceProfile: scoped ? ("mace-musicks-monument-1676" as const) : null,
    instrumentFamily: scoped ? ("baroque_lute" as const) : null,
    notationSystem: scoped ? ("french_tablature" as const) : null,
    sourceCourseCount: scoped ? (12 as const) : null,
    historicalSignState: scoped ? ("unresolved" as const) : null,
    passageRef: externalRef("passage.synthetic-t14"),
    sourceContextRefs: [],
    analysisRef: externalRef("analysis.synthetic-t14"),
    arrangementPlanRef: externalRef("arrangement-plan.synthetic-t14"),
    arrangementBriefRef: externalRef("arrangement-brief.synthetic-t14"),
    performanceBriefRef: externalRef("performance-brief.synthetic-t14"),
    preservationPolicyRef: externalRef("preservation-policy.synthetic-t14"),
    instrumentInstanceRef: externalRef("instrument-instance.synthetic-t14"),
  } satisfies Omit<KnowledgeResolutionRequest, "expectedHead">;
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...rest } = value;
  return rest;
}

function generationRef(snapshot: { generation: { id: string; digest: string; revision: number } }) {
  return {
    id: snapshot.generation.id,
    digest: snapshot.generation.digest,
    revision: snapshot.generation.revision,
  };
}

function ref(value: { id: string; digest: string }): KnowledgeResolutionRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): KnowledgeResolutionRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function component(id: string, digest: string) {
  return { id, version: "1.0.0", digest };
}

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
