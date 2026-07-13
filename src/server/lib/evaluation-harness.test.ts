import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import { afterEach, describe, expect, it } from "vitest";
import {
  AbsoluteDimensionResultSchema,
  EvaluationCaseSchema,
  type AbsoluteDimensionResult,
  type ComponentEvaluationCase,
} from "../../lib/evaluation-domain.js";
import {
  digestValue,
  EvaluationHarness,
  generatorVisibleInput,
  resolveEvaluationManifest,
  validateAbsoluteResult,
  type EvaluationRegistry,
} from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import {
  createFirstLoopRegistry,
  FIRST_LOOP_SUITE_REF,
  runFirstLoopEvaluation,
} from "./first-loop-evaluation.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("versioned Evaluation Harness", () => {
  it("separates end-to-end inputs from component snapshots and evaluator-only data", () => {
    const endToEnd = createFirstLoopRegistry().cases[0]!;
    expect(generatorVisibleInput(endToEnd)).toEqual({
      mode: "end_to_end",
      sourceArtifact: endToEnd.mode === "end_to_end" ? endToEnd.sourceArtifact : undefined,
      arrangementBriefRef:
        endToEnd.mode === "end_to_end" ? endToEnd.arrangementBriefRef : undefined,
      performanceBriefRef:
        endToEnd.mode === "end_to_end" ? endToEnd.performanceBriefRef : undefined,
    });
    expect(generatorVisibleInput(endToEnd)).not.toHaveProperty("expectedAnalysisRef");
    expect(() =>
      Value.Decode(EvaluationCaseSchema, {
        ...endToEnd,
        arrangementScore: { forbidden: "precomputed downstream answer" },
      })
    ).toThrow();

    const component = componentCase();
    expect(generatorVisibleInput(component)).toEqual({
      mode: "component",
      componentUnderTest: "plan_realization",
      pinnedInputSnapshots: component.pinnedInputSnapshots,
    });
  });

  it("pins every transitive definition and leaves old manifests byte-stable", () => {
    const registry = createFirstLoopRegistry();
    const executionIdentity = {
      productVersion: "test",
      runtime: "node-test",
      platform: "test",
      architecture: "test",
      command: "eval:fast",
    };
    const first = resolveEvaluationManifest({
      suiteRef: FIRST_LOOP_SUITE_REF,
      registry,
      executionIdentity,
    });
    expect(first.cases[0]).toMatchObject({
      expectationRefs: expect.arrayContaining([
        expect.objectContaining({ digest: expect.any(String) }),
      ]),
      mutationRefs: [expect.objectContaining({ digest: expect.any(String) })],
      fixtureRefs: [expect.objectContaining({ digest: expect.any(String) })],
      briefRefs: [expect.objectContaining({ digest: expect.any(String) }), expect.any(Object)],
    });
    expect(first.evaluators[0]?.digest).toHaveLength(64);
    expect(first.adapters[0]?.digest).toHaveLength(64);
    expect(first.profiles[0]?.digest).toHaveLength(64);
    expect(first.comparisonPolicyRef.digest).toHaveLength(64);
    expect(first.reportProfileRef.digest).toHaveLength(64);
    expect(first.humanProtocolRefs[0]?.digest).toHaveLength(64);

    const root = temporaryRoot("vellum-evaluation-manifest-");
    const store = new EvaluationStore({ rootDirectory: root });
    store.saveManifest(first);
    const bytesBefore = readFileSync(path.join(root, "manifests", `${first.id}.json`), "utf8");
    registry.definitions.find((definition) => definition.id === "evaluator.first-loop")!.payload = {
      changed: true,
    };
    const second = resolveEvaluationManifest({
      suiteRef: FIRST_LOOP_SUITE_REF,
      registry,
      executionIdentity,
    });
    expect(second.digest).not.toBe(first.digest);
    expect(readFileSync(path.join(root, "manifests", `${first.id}.json`), "utf8")).toBe(
      bytesBefore
    );
    expect(store.getManifest(first.id)).toEqual(first);
  });

  it("rejects a human protocol that omits reviewer authority or comparison safeguards", () => {
    const registry = createFirstLoopRegistry();
    registry.definitions.find(
      (definition) => definition.id === "protocol.first-loop-human"
    )!.payload = {
      requiredRolesByDimension: [],
      rubricAnchors: [],
      minimumJudgmentsForComparativeConclusion: 1,
    };
    expect(() =>
      resolveEvaluationManifest({
        suiteRef: FIRST_LOOP_SUITE_REF,
        registry,
        executionIdentity: {
          productVersion: "test",
          runtime: "node-test",
          platform: "test",
          architecture: "test",
          command: "eval:fast",
        },
      })
    ).toThrow();
  });

  it("keeps absolute outcomes free of comparative semantics and hard failures uncompensated", async () => {
    expect(() =>
      Value.Decode(AbsoluteDimensionResultSchema, {
        ...absoluteResult("source_authority", "pass", "hard_gate"),
        direction: "improved",
      })
    ).toThrow();
    expect(() =>
      validateAbsoluteResult({
        ...absoluteResult("not_applicable", "pass", "measured_evidence"),
        applicability: "not_applicable",
      })
    ).toThrow(/not-applicable/);
    expect(() =>
      validateAbsoluteResult({
        ...absoluteResult("failed_execution", "pass", "measured_evidence"),
        execution: "failed",
      })
    ).toThrow(/cannot claim/);
    const component = componentCase();
    const registry = componentRegistry(component);
    const root = temporaryRoot("vellum-evaluation-component-");
    const store = new EvaluationStore({ rootDirectory: root });
    let nextId = 0;
    const harness = new EvaluationHarness({
      store,
      registry,
      createId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      now: () => new Date("2026-07-12T13:00:00.000Z"),
      executeCase: async () => ({
        generatedRecordRefs: [],
        deliverableRefs: [],
        dimensionResults: [
          absoluteResult("source_authority", "fail", "hard_gate"),
          absoluteResult("notation", "pass", "measured_evidence"),
        ],
      }),
    });
    const result = await harness.run({ id: "suite.component", version: 1 }, executionIdentity());
    expect(result.run.executionStatus).toBe("completed");
    expect(result.cards[0]).toMatchObject({
      hardGateStatus: "fail",
      acceptanceStatus: "fail",
    });
    expect(store.getCaseRun(result.run.caseRunIds[0]!)).toMatchObject({
      blockedReason: "hard_gate_failed",
      acceptanceStatus: "fail",
      readiness: {
        status: "blocked",
        rationale: expect.stringMatching(/hard gate|blocking/i),
      },
    });
    expect(() => store.saveRun(result.run)).toThrow(/already terminal/);
  });

  it("persists every Run terminal state as an immutable transition after restart", () => {
    for (const terminal of ["cancelled", "infrastructure_failed"] as const) {
      const root = temporaryRoot(`vellum-evaluation-${terminal}-`);
      const run = {
        id: `evaluation-run.${terminal}`,
        manifestId: "evaluation-manifest.test",
        executionStatus: "running" as const,
        caseRunIds: [],
        startedAt: "2026-07-12T13:00:00.000Z",
      };
      new EvaluationStore({ rootDirectory: root }).saveRun(run);
      const restarted = new EvaluationStore({ rootDirectory: root });
      restarted.saveRun({
        ...run,
        executionStatus: terminal,
        completedAt: "2026-07-12T13:01:00.000Z",
      });
      expect(restarted.getRunHistory(run.id).map((snapshot) => snapshot.executionStatus)).toEqual([
        "running",
        terminal,
      ]);
    }
  });

  it("runs the first source-and-brief loop into a separate persistent Run and Card", async () => {
    const evaluationRoot = temporaryRoot("vellum-evaluation-first-loop-");
    let nextId = 0;
    const result = await runFirstLoopEvaluation({
      evaluationRoot,
      now: () => new Date("2026-07-12T13:00:00.000Z"),
      createId: () => `10000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    });
    expect(result).toMatchObject({
      executionStatus: "completed",
      manifestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      cards: [
        expect.objectContaining({
          hardGateStatus: "pass",
          acceptanceStatus: "incomplete",
        }),
      ],
    });
    expect(result.cards[0]?.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensionId: "source_authority",
          absoluteOutcome: "pass",
          permittedPresentation: "hard_gate",
        }),
        expect.objectContaining({
          dimensionId: "human_and_physical_evidence",
          absoluteOutcome: "unknown",
          execution: "not_evaluated",
          authority: "target_player",
          permittedPresentation: "unknown_only",
        }),
        expect.objectContaining({
          dimensionId: "mechanical_and_technique_evidence",
          absoluteOutcome: "pass",
          completeness: "partial",
          authority: "mechanical",
        }),
        expect.objectContaining({
          dimensionId: "historical_and_analytical_evidence",
          absoluteOutcome: "unknown",
          completeness: "partial",
          authority: "none",
          permittedPresentation: "observation_only",
        }),
        expect.objectContaining({
          dimensionId: "playback_and_performed_form",
          absoluteOutcome: "unknown",
        }),
        expect.objectContaining({
          dimensionId: "workflow_and_recovery",
          absoluteOutcome: "pass",
          completeness: "partial",
        }),
      ])
    );
    expect(
      new EvaluationStore({ rootDirectory: evaluationRoot }).getCaseRun(result.caseRunIds[0]!)
    ).toMatchObject({ readiness: { status: "incomplete" } });
    expect(existsSync(path.join(evaluationRoot, "runs", result.runId, "000002.json"))).toBe(true);
    expect(existsSync(path.join(evaluationRoot, "cards", `${result.cardIds[0]}.json`))).toBe(true);
    expect(
      new EvaluationStore({ rootDirectory: evaluationRoot }).getRunHistory(result.runId)
    ).toEqual([
      expect.objectContaining({ executionStatus: "running", caseRunIds: [] }),
      expect.objectContaining({ executionStatus: "completed" }),
    ]);
  });
});

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function componentCase(): ComponentEvaluationCase {
  return {
    mode: "component",
    id: "case.component",
    version: 1,
    componentUnderTest: "plan_realization",
    pinnedInputSnapshots: [
      { id: "snapshot.plan", digest: "a".repeat(64), mediaType: "application/json", byteLength: 2 },
    ],
    expectationRefs: [{ id: "expectation.component", version: 1 }],
    mutationRefs: [],
    provenance: {
      origin: "unit fixture",
      license: "CC0",
      datasetRole: "development",
      datasetVersion: 1,
    },
  };
}

function componentRegistry(component: ComponentEvaluationCase): EvaluationRegistry {
  return {
    cases: [component],
    suites: [
      {
        id: "suite.component",
        version: 1,
        caseRefs: [{ id: component.id, version: component.version }],
        evaluatorRefs: [{ id: "evaluator.component", version: 1 }],
        adapterRefs: [],
        profileRefs: [],
        comparisonPolicyRef: { id: "policy.component", version: 1 },
        reportProfileRef: { id: "report.component", version: 1 },
      },
    ],
    definitions: [
      { id: "expectation.component", version: 1, kind: "expectation", payload: {} },
      { id: "evaluator.component", version: 1, kind: "evaluator", payload: {} },
      { id: "policy.component", version: 1, kind: "comparison_policy", payload: {} },
      { id: "report.component", version: 1, kind: "report_profile", payload: {} },
    ],
  };
}

function absoluteResult(
  dimensionId: string,
  outcome: "pass" | "fail",
  presentation: "hard_gate" | "measured_evidence"
): AbsoluteDimensionResult {
  return {
    dimensionId,
    evaluatorRef: { id: "evaluator.component", version: 1, digest: digestValue({ evaluator: 1 }) },
    scope: { kind: "case", ids: ["case.component"] },
    applicability: "applicable",
    execution: "completed",
    absoluteOutcome: outcome,
    completeness: "complete",
    evidenceBasis: ["deterministic"],
    authority: "mechanical",
    permittedPresentation: presentation,
    observations: [],
  };
}

function executionIdentity() {
  return {
    productVersion: "test",
    runtime: "node-test",
    platform: "test",
    architecture: "test",
    command: "eval:fast",
  };
}
