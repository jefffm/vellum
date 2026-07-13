import { createHash, randomUUID } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import {
  EvaluationCaseSchema,
  EvaluationDefinitionSchema,
  EvaluationSuiteSchema,
  HumanComparisonProtocolSchema,
  type AbsoluteDimensionResult,
  type DigestedRef,
  type EvaluationCard,
  type EvaluationCase,
  type EvaluationCaseRun,
  type EvaluationDefinition,
  type EvaluationRun,
  type EvaluationSuite,
  type ResolvedEvaluationManifest,
  type VersionedRef,
  type HumanComparisonProtocol,
} from "../../lib/evaluation-domain.js";
import { canonicalJson, EvaluationStore } from "./evaluation-store.js";

export type EvaluationRegistry = {
  suites: EvaluationSuite[];
  cases: EvaluationCase[];
  definitions: EvaluationDefinition[];
};

export type EvaluationCaseExecution = {
  generatedRecordRefs: DigestedRef[];
  deliverableRefs: DigestedRef[];
  dimensionResults: AbsoluteDimensionResult[];
  diagnostics?: EvaluationCaseRun["diagnostics"];
  blockedReason?: EvaluationCaseRun["blockedReason"];
};

export type EvaluationCaseExecutor = (
  evaluationCase: EvaluationCase,
  manifest: ResolvedEvaluationManifest
) => Promise<EvaluationCaseExecution>;

export function digestValue(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function digestedRef(value: { id: string; version: number }): DigestedRef {
  return { id: value.id, version: value.version, digest: digestValue(value) };
}

export function resolveEvaluationManifest(input: {
  suiteRef: VersionedRef;
  registry: EvaluationRegistry;
  executionIdentity: ResolvedEvaluationManifest["executionIdentity"];
}): ResolvedEvaluationManifest {
  const suite = Value.Decode(
    EvaluationSuiteSchema,
    requireVersioned(input.registry.suites, input.suiteRef, "suite")
  );
  const definitions = input.registry.definitions.map((definition) =>
    Value.Decode(EvaluationDefinitionSchema, definition)
  );
  const resolveDefinition = (ref: VersionedRef, kinds?: EvaluationDefinition["kind"][]) => {
    const definition = requireVersioned(definitions, ref, "definition");
    if (kinds && !kinds.includes(definition.kind)) {
      throw new Error(`${ref.id}@${ref.version} has kind ${definition.kind}, expected ${kinds}`);
    }
    if (definition.kind === "human_protocol") {
      validateHumanComparisonProtocol(
        Value.Decode(HumanComparisonProtocolSchema, definition.payload)
      );
    }
    return { ...ref, digest: digestValue(definition) };
  };
  const cases = suite.caseRefs.map((caseRef) => {
    const evaluationCase = Value.Decode(
      EvaluationCaseSchema,
      requireVersioned(input.registry.cases, caseRef, "case")
    );
    const expectationRefs =
      evaluationCase.mode === "end_to_end"
        ? [
            evaluationCase.expectedSourceTruthRef,
            evaluationCase.expectedAnalysisRef,
            ...evaluationCase.expectedPlanRefs,
            ...evaluationCase.targetExpectationRefs,
          ]
        : evaluationCase.expectationRefs;
    const briefRefs =
      evaluationCase.mode === "end_to_end"
        ? [
            resolveDefinition(evaluationCase.arrangementBriefRef, ["arrangement_brief"]),
            resolveDefinition(evaluationCase.performanceBriefRef, ["performance_brief"]),
          ]
        : [];
    return {
      caseRef: { ...caseRef, digest: digestValue(evaluationCase) },
      expectationRefs: expectationRefs.map((ref) => resolveDefinition(ref, ["expectation"])),
      mutationRefs: evaluationCase.mutationRefs.map((ref) => resolveDefinition(ref, ["mutation"])),
      fixtureRefs:
        evaluationCase.mode === "end_to_end"
          ? [evaluationCase.sourceArtifact]
          : evaluationCase.pinnedInputSnapshots,
      briefRefs,
    };
  });
  const humanProtocolRefs = input.registry.cases
    .filter((evaluationCase) =>
      suite.caseRefs.some(
        (ref) => ref.id === evaluationCase.id && ref.version === evaluationCase.version
      )
    )
    .flatMap((evaluationCase) =>
      evaluationCase.mode === "end_to_end" && evaluationCase.humanProtocolRef
        ? [resolveDefinition(evaluationCase.humanProtocolRef, ["human_protocol"])]
        : []
    );
  const resolved = {
    suiteRef: { ...input.suiteRef, digest: digestValue(suite) },
    cases,
    evaluators: suite.evaluatorRefs.map((ref) => resolveDefinition(ref, ["evaluator"])),
    adapters: suite.adapterRefs.map((ref) => resolveDefinition(ref, ["adapter"])),
    profiles: suite.profileRefs.map((ref) => resolveDefinition(ref, ["profile"])),
    comparisonPolicyRef: resolveDefinition(suite.comparisonPolicyRef, ["comparison_policy"]),
    reportProfileRef: resolveDefinition(suite.reportProfileRef, ["report_profile"]),
    humanProtocolRefs,
    executionIdentity: input.executionIdentity,
  };
  const digest = digestValue(resolved);
  return { id: `evaluation-manifest.${digest.slice(0, 24)}`, digest, ...resolved };
}

export function validateHumanComparisonProtocol(protocol: HumanComparisonProtocol): void {
  const requiredDimensions = [
    "personal_adoption",
    "personal_calibration",
    "physical_execution",
    "historical_practice",
    "engraving_notation",
    "musical_identity",
    "listening_clarity",
  ] as const;
  const declared = protocol.requiredRolesByDimension.map(({ dimension }) => dimension);
  if (
    new Set(declared).size !== declared.length ||
    requiredDimensions.some((dimension) => !declared.includes(dimension))
  ) {
    throw new Error("Human protocol must declare reviewer authority once for every dimension");
  }
  if (
    requiredDimensions.some(
      (dimension) => !protocol.rubricAnchors.some((anchor) => anchor.dimension === dimension)
    )
  ) {
    throw new Error("Human protocol must anchor every human evidence dimension");
  }
  const exclusiveAuthority: Partial<Record<(typeof requiredDimensions)[number], string>> = {
    personal_adoption: "owner_usability",
    personal_calibration: "owner_usability",
    physical_execution: "target_player",
    historical_practice: "historical_specialist",
    engraving_notation: "editor_engraver",
    musical_identity: "independent_listener",
    listening_clarity: "independent_listener",
  };
  for (const entry of protocol.requiredRolesByDimension) {
    const exclusive = exclusiveAuthority[entry.dimension];
    if (
      exclusive &&
      (entry.authorizedRoles.length !== 1 || entry.authorizedRoles[0] !== exclusive)
    ) {
      throw new Error(`${entry.dimension} has a distinct non-substitutable reviewer authority`);
    }
  }
  if (
    protocol.duplicates.required !== protocol.duplicates.minimumCount > 0 ||
    !protocol.blinding.limitations.toLowerCase().includes("reveal")
  ) {
    throw new Error("Human protocol duplicate or practical-blinding disclosure is inconsistent");
  }
}

export function generatorVisibleInput(evaluationCase: EvaluationCase): unknown {
  if (evaluationCase.mode === "component") {
    return {
      mode: evaluationCase.mode,
      componentUnderTest: evaluationCase.componentUnderTest,
      pinnedInputSnapshots: evaluationCase.pinnedInputSnapshots,
    };
  }
  return {
    mode: evaluationCase.mode,
    sourceArtifact: evaluationCase.sourceArtifact,
    arrangementBriefRef: evaluationCase.arrangementBriefRef,
    performanceBriefRef: evaluationCase.performanceBriefRef,
  };
}

export function validateAbsoluteResult(result: AbsoluteDimensionResult): void {
  if (result.applicability === "not_applicable") {
    if (
      result.execution !== "not_evaluated" ||
      result.absoluteOutcome !== "unknown" ||
      result.completeness !== "complete"
    ) {
      throw new Error(
        `${result.dimensionId}: not-applicable results must be complete, not evaluated, and unknown`
      );
    }
    return;
  }
  if (result.execution !== "completed" && result.absoluteOutcome !== "unknown") {
    throw new Error(`${result.dimensionId}: incomplete execution cannot claim an absolute outcome`);
  }
  if (result.execution === "completed" && result.completeness === "missing") {
    throw new Error(`${result.dimensionId}: completed execution cannot have missing evidence`);
  }
  if (result.units && result.value === undefined) {
    throw new Error(`${result.dimensionId}: units require a value`);
  }
}

export class EvaluationHarness {
  constructor(
    private readonly options: {
      store: EvaluationStore;
      registry: EvaluationRegistry;
      executeCase: EvaluationCaseExecutor;
      now?: () => Date;
      createId?: () => string;
    }
  ) {}

  async run(
    suiteRef: VersionedRef,
    executionIdentity: ResolvedEvaluationManifest["executionIdentity"]
  ): Promise<{
    manifest: ResolvedEvaluationManifest;
    run: EvaluationRun;
    cards: EvaluationCard[];
  }> {
    const now = this.options.now ?? (() => new Date());
    const createId = this.options.createId ?? randomUUID;
    const startedAt = now().toISOString();
    const manifest = this.options.store.saveManifest(
      resolveEvaluationManifest({ suiteRef, registry: this.options.registry, executionIdentity })
    );
    const suite = requireVersioned(this.options.registry.suites, suiteRef, "suite");
    const runId = `evaluation-run.${createId()}`;
    this.options.store.saveRun({
      id: runId,
      manifestId: manifest.id,
      executionStatus: "running",
      caseRunIds: [],
      startedAt,
    });
    const caseRuns: EvaluationCaseRun[] = [];
    const cards: EvaluationCard[] = [];
    for (const caseRef of suite.caseRefs) {
      const evaluationCase = Value.Decode(
        EvaluationCaseSchema,
        requireVersioned(this.options.registry.cases, caseRef, "case")
      );
      const execution = await this.options.executeCase(evaluationCase, manifest);
      execution.dimensionResults.forEach(validateAbsoluteResult);
      const hardFailure = execution.dimensionResults.some(
        (result) =>
          result.permittedPresentation === "hard_gate" &&
          result.applicability === "applicable" &&
          ["fail", "outside_range"].includes(result.absoluteOutcome)
      );
      const incomplete = execution.dimensionResults.some(
        (result) =>
          result.applicability === "applicable" &&
          (result.execution !== "completed" ||
            result.absoluteOutcome === "unknown" ||
            result.completeness !== "complete")
      );
      const blockedReason =
        execution.blockedReason ??
        (hardFailure ? "hard_gate_failed" : incomplete ? "required_evidence_missing" : undefined);
      const acceptanceStatus = blockedReason
        ? blockedReason === "hard_gate_failed"
          ? "fail"
          : blockedReason === "required_evidence_missing"
            ? "incomplete"
            : "blocked"
        : "pass";
      const readiness = {
        status:
          acceptanceStatus === "pass"
            ? ("ready" as const)
            : acceptanceStatus === "incomplete"
              ? ("incomplete" as const)
              : ("blocked" as const),
        evidenceRefs: [...execution.generatedRecordRefs, ...execution.deliverableRefs],
        rationale:
          acceptanceStatus === "pass"
            ? "All applicable evaluation dimensions completed without a failed hard gate."
            : acceptanceStatus === "incomplete"
              ? "Required evaluation evidence is missing, partial, or not yet evaluated."
              : "A failed hard gate or blocking condition prevents arrangement readiness.",
      };
      const caseRun: EvaluationCaseRun = {
        id: `evaluation-case-run.${createId()}`,
        evaluationRunId: runId,
        caseRef: manifest.cases.find(
          (entry) => entry.caseRef.id === caseRef.id && entry.caseRef.version === caseRef.version
        )!.caseRef,
        generatedRecordRefs: execution.generatedRecordRefs,
        deliverableRefs: execution.deliverableRefs,
        dimensionResults: execution.dimensionResults,
        readiness,
        acceptanceStatus,
        ...(blockedReason ? { blockedReason } : {}),
        diagnostics: execution.diagnostics ?? [],
      };
      this.options.store.saveCaseRun(caseRun);
      caseRuns.push(caseRun);
      const card: EvaluationCard = {
        id: `evaluation-card.${createId()}`,
        evaluationRunId: runId,
        caseRunId: caseRun.id,
        hardGateStatus: hardFailure ? "fail" : "pass",
        acceptanceStatus,
        dimensions: caseRun.dimensionResults,
        generatedAt: now().toISOString(),
      };
      this.options.store.saveCard(card);
      cards.push(card);
    }
    const run: EvaluationRun = {
      id: runId,
      manifestId: manifest.id,
      executionStatus: caseRuns.some((caseRun) => caseRun.blockedReason === "infrastructure_failed")
        ? "infrastructure_failed"
        : "completed",
      caseRunIds: caseRuns.map((caseRun) => caseRun.id),
      startedAt,
      completedAt: now().toISOString(),
    };
    this.options.store.saveRun(run);
    return { manifest, run, cards };
  }
}

function requireVersioned<T extends { id: string; version: number }>(
  values: T[],
  ref: VersionedRef,
  label: string
): T {
  const value = values.find((item) => item.id === ref.id && item.version === ref.version);
  if (!value) throw new Error(`Missing ${label} ${ref.id}@${ref.version}`);
  return value;
}
