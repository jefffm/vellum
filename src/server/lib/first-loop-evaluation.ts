import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import type {
  AbsoluteDimensionResult,
  DigestedRef,
  EndToEndEvaluationCase,
  EvaluationCard,
  EvaluationDefinition,
  EvaluationSuite,
} from "../../lib/evaluation-domain.js";
import { ArrangementBriefSchema, PerformanceBriefInputSchema } from "../../lib/music-domain.js";
import { buildNarrowEvaluationCard } from "../../lib/narrow-intelligence.js";
import { ArrangementService } from "./arrangement-service.js";
import { digestValue, EvaluationHarness, type EvaluationRegistry } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { SourceImportService } from "./source-import-service.js";
import { WorkspaceStore } from "./workspace-store.js";

export const FIRST_LOOP_SUITE_REF = { id: "suite.first-loop-fast", version: 1 } as const;

export function createFirstLoopRegistry(projectRoot = process.cwd()): EvaluationRegistry {
  const sourcePath = path.join(projectRoot, "test/fixtures/greensleeves/greensleeves-satb.ly");
  const source = readFileSync(sourcePath);
  const sourceArtifact = {
    id: "fixture.greensleeves-satb-lilypond",
    digest: createHash("sha256").update(source).digest("hex"),
    mediaType: "text/x-lilypond",
    byteLength: source.byteLength,
  };
  const definitions: EvaluationDefinition[] = [
    definition("brief.arrangement.first-loop", "arrangement_brief", {
      targetConfigurations: [
        {
          id: "target.baroque-guitar",
          instrumentId: "baroque-guitar-5",
          role: "solo",
          stringing: "french",
          notationLayouts: ["french-letter-tablature"],
          deliverables: ["pdf", "audio-preview"],
        },
      ],
    }),
    definition("brief.performance.first-loop", "performance_brief", {
      intendedUse: "study",
      performerProfile: {
        proficiency: "intermediate",
        assumptionSource: "guided_start_default_pending_owner_review",
      },
      tempoContext: { status: "not_specified" },
      difficultyIntent: "intermediate",
      preparationExpectation: "practice_expected",
      reliabilityGoal: "repeatable",
    }),
    definition("expectation.source-authority", "expectation", {
      dimensionId: "source_authority",
      requiredOutcome: "pass",
      hardGate: true,
    }),
    definition("expectation.analysis", "expectation", {
      requiredPrincipalVoicePartId: "part.soprano",
    }),
    definition("expectation.minimal-plan", "expectation", {
      kind: "minimal_projection",
      requireEveryDecisionRealized: true,
    }),
    definition("expectation.baroque-guitar", "expectation", {
      targetConfigurationId: "target.baroque-guitar",
      requirePreservationAudit: true,
    }),
    definition("mutation.principal-voice-omission", "mutation", {
      status: "declared_for_t11",
      operation: "omit_principal_voice_event",
    }),
    definition("evaluator.first-loop", "evaluator", {
      implementation: "narrow-evaluation-card",
      datasetVersion: 1,
      limitations: ["no physical playtest", "no Owner usefulness review"],
    }),
    definition("adapter.restricted-lilypond", "adapter", {
      implementation: "SourceImportService/restricted-lilypond",
    }),
    definition("profile.baroque-guitar-5", "profile", {
      instrumentId: "baroque-guitar-5",
      stringing: "french",
    }),
    definition("policy.first-loop-comparison", "comparison_policy", {
      hardGatesCompensable: false,
      comparativeDirectionsExcludedFromAbsoluteResults: true,
    }),
    definition("profile.first-loop-report", "report_profile", {
      overallGrade: false,
      discloseUnknown: true,
    }),
    definition("protocol.first-loop-human", "human_protocol", {
      status: "deferred_to_hitl_tracers",
      requiredRoles: ["target_player", "owner"],
      missingEvidencePresentation: "unknown_only",
    }),
  ];
  const evaluationCase: EndToEndEvaluationCase = {
    mode: "end_to_end",
    id: "case.greensleeves-first-loop",
    version: 1,
    sourceArtifact,
    arrangementBriefRef: { id: "brief.arrangement.first-loop", version: 1 },
    performanceBriefRef: { id: "brief.performance.first-loop", version: 1 },
    expectedSourceTruthRef: { id: "expectation.source-authority", version: 1 },
    expectedAnalysisRef: { id: "expectation.analysis", version: 1 },
    expectedPlanRefs: [{ id: "expectation.minimal-plan", version: 1 }],
    targetExpectationRefs: [{ id: "expectation.baroque-guitar", version: 1 }],
    mutationRefs: [{ id: "mutation.principal-voice-omission", version: 1 }],
    humanProtocolRef: { id: "protocol.first-loop-human", version: 1 },
    provenance: {
      origin: "Vellum public-domain Greensleeves SATB fixture",
      license: "Public Domain",
      datasetRole: "development",
      datasetVersion: 1,
    },
  };
  const suite: EvaluationSuite = {
    ...FIRST_LOOP_SUITE_REF,
    caseRefs: [{ id: evaluationCase.id, version: evaluationCase.version }],
    evaluatorRefs: [{ id: "evaluator.first-loop", version: 1 }],
    adapterRefs: [{ id: "adapter.restricted-lilypond", version: 1 }],
    profileRefs: [{ id: "profile.baroque-guitar-5", version: 1 }],
    comparisonPolicyRef: { id: "policy.first-loop-comparison", version: 1 },
    reportProfileRef: { id: "profile.first-loop-report", version: 1 },
  };
  return { suites: [suite], cases: [evaluationCase], definitions };
}

export async function runFirstLoopEvaluation(options: {
  evaluationRoot: string;
  projectRoot?: string;
  now?: () => Date;
  createId?: () => string;
}): Promise<{
  manifestId: string;
  manifestDigest: string;
  runId: string;
  executionStatus: string;
  caseRunIds: string[];
  cardIds: string[];
  cards: EvaluationCard[];
}> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const registry = createFirstLoopRegistry(projectRoot);
  const store = new EvaluationStore({ rootDirectory: options.evaluationRoot });
  const harness = new EvaluationHarness({
    store,
    registry,
    now: options.now,
    createId: options.createId,
    executeCase: async (evaluationCase, manifest) => {
      if (evaluationCase.mode !== "end_to_end") {
        throw new Error("The first-loop command accepts only its end-to-end case");
      }
      const canonicalRoot = mkdtempSync(path.join(tmpdir(), "vellum-eval-canonical-"));
      try {
        const workspaceStore = new WorkspaceStore({ rootDirectory: canonicalRoot });
        const arrangementBrief = Value.Decode(
          ArrangementBriefSchema,
          definitionPayload(registry, evaluationCase.arrangementBriefRef)
        );
        const performanceBrief = Value.Decode(
          PerformanceBriefInputSchema,
          definitionPayload(registry, evaluationCase.performanceBriefRef)
        );
        const workspace = workspaceStore.create({
          title: "Greensleeves first-loop evaluation",
          brief: arrangementBrief,
        });
        const sourceBytes = readFileSync(
          path.join(projectRoot, "test/fixtures/greensleeves/greensleeves-satb.ly")
        );
        if (
          createHash("sha256").update(sourceBytes).digest("hex") !==
          evaluationCase.sourceArtifact.digest
        ) {
          throw new Error("First-loop fixture digest does not match the resolved case");
        }
        const source = workspaceStore.addSourceArtifact(workspace.id, {
          filename: "greensleeves-satb.ly",
          mimeType: evaluationCase.sourceArtifact.mediaType,
          contentBase64: sourceBytes.toString("base64"),
          provenance: { license: evaluationCase.provenance.license },
        });
        const imported = await new SourceImportService({ store: workspaceStore }).import(
          workspace.id,
          source.id,
          { voiceNames: ["Soprano", "Alto", "Tenor", "Bass"] }
        );
        const arranged = new ArrangementService({ store: workspaceStore }).createFaithfulReduction(
          workspace.id,
          {
            normalizedScoreId: imported.normalizedScore.id,
            targetConfigurationId: "target.baroque-guitar",
            performanceBrief,
          }
        );
        const narrowCard = buildNarrowEvaluationCard({
          score: arranged.arrangementScore,
          planning: {
            sourceTruthAssessment: arranged.sourceTruthAssessment,
            performanceBrief: arranged.performanceBrief,
            arrangementPlan: arranged.arrangementPlan,
          },
          deliverableIds: [],
        });
        const evaluatorRef = manifest.evaluators[0]!;
        const generated = [
          imported.scoreTranscription,
          imported.normalizedScore,
          imported.analysisRecord,
          arranged.sourceTruthAssessment,
          arranged.performanceBrief,
          arranged.arrangementPlan,
          arranged.arrangementSearch,
          arranged.arrangementScore,
        ];
        return {
          generatedRecordRefs: generated.map(recordRef),
          deliverableRefs: [],
          dimensionResults: narrowCard.dimensions.map((dimension) =>
            absoluteResult(dimension, evaluatorRef, evaluationCase.id)
          ),
        };
      } finally {
        rmSync(canonicalRoot, { recursive: true, force: true });
      }
    },
  });
  const result = await harness.run(FIRST_LOOP_SUITE_REF, {
    productVersion: "0.1.0",
    runtime: process.version,
    platform: process.platform,
    architecture: process.arch,
    command: "eval:fast",
  });
  return {
    manifestId: result.manifest.id,
    manifestDigest: result.manifest.digest,
    runId: result.run.id,
    executionStatus: result.run.executionStatus,
    caseRunIds: result.run.caseRunIds,
    cardIds: result.cards.map((card) => card.id),
    cards: result.cards,
  };
}

function definition(
  id: string,
  kind: EvaluationDefinition["kind"],
  payload: unknown
): EvaluationDefinition {
  return { id, version: 1, kind, payload };
}

function definitionPayload(
  registry: EvaluationRegistry,
  ref: { id: string; version: number }
): unknown {
  const definition = registry.definitions.find(
    (candidate) => candidate.id === ref.id && candidate.version === ref.version
  );
  if (!definition) throw new Error(`Missing definition ${ref.id}@${ref.version}`);
  return definition.payload;
}

function recordRef(record: { id: string; version?: number }): DigestedRef {
  return { id: record.id, version: record.version ?? 1, digest: digestValue(record) };
}

function absoluteResult(
  dimension: ReturnType<typeof buildNarrowEvaluationCard>["dimensions"][number],
  evaluatorRef: DigestedRef,
  caseId: string
): AbsoluteDimensionResult {
  const unknown = dimension.status === "unknown" || dimension.status === "not_evaluated";
  const failed = dimension.status === "fail";
  const modeledMechanical = dimension.id === "mechanical_and_technique_evidence";
  const analytical = dimension.id === "historical_and_analytical_evidence";
  const workflow = dimension.id === "workflow_and_recovery";
  const executed = !unknown || modeledMechanical || analytical || workflow;
  const evidenceRefs = dimension.evidenceIds.map((id) => ({
    id,
    version: 1,
    digest: digestValue({ id }),
  }));
  return {
    dimensionId: dimension.id,
    evaluatorRef,
    scope: { kind: "case", ids: [caseId] },
    applicability: "applicable",
    execution: executed ? "completed" : "not_evaluated",
    absoluteOutcome:
      modeledMechanical || workflow ? "pass" : unknown ? "unknown" : failed ? "fail" : "pass",
    completeness:
      modeledMechanical || analytical || workflow ? "partial" : executed ? "complete" : "missing",
    evidenceBasis: executed ? ["deterministic"] : [],
    authority:
      dimension.id === "source_authority"
        ? "source_review"
        : analytical
          ? "none"
          : dimension.id === "human_and_physical_evidence"
            ? "target_player"
            : dimension.id === "explicit_owner_usefulness"
              ? "owner"
              : "mechanical",
    permittedPresentation: dimension.hardGate
      ? "hard_gate"
      : analytical
        ? "observation_only"
        : unknown && !modeledMechanical && !workflow
          ? "unknown_only"
          : "measured_evidence",
    observations: [
      {
        code: `first_loop.${dimension.id}`,
        message: dimension.rationale,
        evidenceRefs,
      },
    ],
  };
}
