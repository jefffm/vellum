import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EvaluationCard, EvaluationDefinition } from "../../lib/evaluation-domain.js";
import { arrangementToEngraveParams } from "../../lib/arrangement-engrave.js";
import { buildAudioPreview } from "../../lib/audio-preview.js";
import { buildNarrowEvaluationCard } from "../../lib/narrow-intelligence.js";
import { digestInstrumentInstance } from "../../lib/instrument-instance.js";
import type { HumanReviewerRole, ReviewRequest } from "../../lib/review-attestation.js";
import type { TargetConfiguration } from "../../lib/music-domain.js";
import { ArrangementService, type CreateFaithfulArrangementResult } from "./arrangement-service.js";
import { compileLilyPond } from "./compile-route.js";
import { persistDeliverable } from "./deliverable-service.js";
import { digestValue, EvaluationHarness, type EvaluationRegistry } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import {
  createFirstLoopRegistry,
  FIRST_LOOP_COMPARISON_POLICY,
  narrowDimensionToAbsoluteResult,
} from "./first-loop-evaluation.js";
import { engrave } from "./engrave.js";
import { SourceImportService } from "./source-import-service.js";
import { SubprocessRunner, type SubprocessRunner as SubprocessRunnerType } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

export const THREE_TARGET_PARITY_SUITE_REF = {
  id: "suite.three-target-parity",
  version: 1,
} as const;

const TARGETS: Array<{ caseId: string; target: TargetConfiguration }> = [
  {
    caseId: "case.greensleeves-parity.baroque-guitar",
    target: {
      id: "target.baroque-guitar",
      instrumentId: "baroque-guitar-5",
      role: "solo",
      stringing: "french",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    },
  },
  {
    caseId: "case.greensleeves-parity.baroque-lute",
    target: {
      id: "target.baroque-lute",
      instrumentId: "baroque-lute-13",
      role: "solo",
      tuningId: "d_minor",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    },
  },
  {
    caseId: "case.greensleeves-parity.classical-guitar",
    target: {
      id: "target.classical-guitar",
      instrumentId: "classical-guitar-6",
      role: "solo",
      tuningId: "standard",
      notationLayouts: ["standard-notation"],
      deliverables: ["pdf", "audio-preview"],
    },
  },
];

export function createThreeTargetParityRegistry(projectRoot = process.cwd()): EvaluationRegistry {
  const base = createFirstLoopRegistry(projectRoot);
  const baseCase = base.cases[0]!;
  if (baseCase.mode !== "end_to_end") throw new Error("First-loop fixture must be end-to-end");
  const definitions: EvaluationDefinition[] = base.definitions.map((definition) =>
    definition.id === "brief.arrangement.first-loop"
      ? {
          ...definition,
          payload: { targetConfigurations: TARGETS.map(({ target }) => target) },
        }
      : definition
  );
  for (const { target } of TARGETS) {
    definitions.push({
      id: `expectation.parity.${target.instrumentId}`,
      version: 1,
      kind: "expectation",
      payload: {
        targetConfigurationId: target.id,
        requireIndependentSearch: true,
        requireProjectionSet: ["notation", "playback"],
        requirePreservationAudit: true,
      },
    });
    definitions.push({
      id: `profile.parity.${target.instrumentId}`,
      version: 1,
      kind: "profile",
      payload: target,
    });
  }
  const cases = TARGETS.map(({ caseId, target }) => ({
    ...baseCase,
    id: caseId,
    targetExpectationRefs: [{ id: `expectation.parity.${target.instrumentId}`, version: 1 }],
  }));
  return {
    definitions,
    cases,
    suites: [
      {
        id: THREE_TARGET_PARITY_SUITE_REF.id,
        version: THREE_TARGET_PARITY_SUITE_REF.version,
        caseRefs: cases.map(({ id, version }) => ({ id, version })),
        evaluatorRefs: [{ id: "evaluator.first-loop", version: 1 }],
        adapterRefs: [{ id: "adapter.restricted-lilypond", version: 1 }],
        profileRefs: TARGETS.map(({ target }) => ({
          id: `profile.parity.${target.instrumentId}`,
          version: 1,
        })),
        comparisonPolicyRef: { id: "policy.first-loop-comparison", version: 1 },
        reportProfileRef: { id: "profile.first-loop-report", version: 1 },
      },
    ],
  };
}

export async function runThreeTargetParityEvaluation(options: {
  evaluationRoot: string;
  projectRoot?: string;
  now?: () => Date;
  createId?: () => string;
  runner?: Pick<SubprocessRunnerType, "run">;
  reviewArtifactRoot?: string;
}): Promise<{
  manifestId: string;
  runId: string;
  cards: EvaluationCard[];
  targets: Array<{
    caseId: string;
    targetId: string;
    instrumentId: string;
    arrangementId: string;
    arrangementFamilyId: string;
    sourceDigest: string;
    normalizedScoreId: string;
    analysisRecordId: string;
    sourceTruthAssessmentId: string;
    searchId: string;
    planId: string;
    portableFamilyDecisionKeys: string[];
    candidateCount: number;
    comparisonMethod: "policy_lexicographic";
    deliverableIds: string[];
    notationLayout: string;
    physicalEvidence: "awaiting_human";
    specialistEvidence: "awaiting_human";
    reviewArtifacts: Array<{ kind: string; path: string; sha256: string }>;
    reviewRequestPath?: string;
  }>;
}> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const registry = createThreeTargetParityRegistry(projectRoot);
  const evaluationStore = new EvaluationStore({ rootDirectory: options.evaluationRoot });
  const canonicalRoot = mkdtempSync(path.join(tmpdir(), "vellum-three-target-parity-"));
  const workspaceStore = new WorkspaceStore({ rootDirectory: canonicalRoot });
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const runner = options.runner ?? new SubprocessRunner();
  const targetEvidence = new Map<string, Awaited<ReturnType<typeof realizeTargets>>[number]>();
  try {
    const realized = await realizeTargets({
      projectRoot,
      workspaceStore,
      now,
      createId,
      runner,
      reviewArtifactRoot: options.reviewArtifactRoot,
    });
    realized.forEach((item) => targetEvidence.set(item.caseId, item));
    const harness = new EvaluationHarness({
      store: evaluationStore,
      registry,
      now,
      createId,
      executeCase: async (evaluationCase, manifest) => {
        const evidence = targetEvidence.get(evaluationCase.id);
        if (!evidence) throw new Error(`Missing realized parity target: ${evaluationCase.id}`);
        const evaluatorRef = manifest.evaluators[0]!;
        return {
          generatedRecordRefs: evidence.generatedRecords.map(recordRef),
          deliverableRefs: evidence.deliverables.map((deliverable) => ({
            id: deliverable.id,
            version: 1,
            digest: deliverable.sha256,
          })),
          dimensionResults: evidence.dimensions.map((dimension) =>
            narrowDimensionToAbsoluteResult(dimension, evaluatorRef, evaluationCase.id)
          ),
          diagnostics: [
            {
              code: "three_target.independent_search",
              message: `Independent bounded search ${evidence.arranged.arrangementSearch.id} selected a lexicographically evaluated candidate for ${evidence.instrumentId}.`,
              severity: "info" as const,
            },
          ],
        };
      },
    });
    const result = await harness.run(THREE_TARGET_PARITY_SUITE_REF, {
      productVersion: "0.1.0",
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      command: "eval:three-target-parity",
    });
    return {
      manifestId: result.manifest.id,
      runId: result.run.id,
      cards: result.cards,
      targets: realized.map((item) => ({
        caseId: item.caseId,
        targetId: item.targetId,
        instrumentId: item.instrumentId,
        arrangementId: item.arranged.arrangementScore.id,
        arrangementFamilyId: item.arranged.arrangementScore.arrangementFamilyId!,
        sourceDigest: createHash("sha256").update(sourceBytesFor(projectRoot)).digest("hex"),
        normalizedScoreId: item.arranged.arrangementSearch.normalizedScoreId,
        analysisRecordId: item.arranged.analysisRecordId,
        sourceTruthAssessmentId: item.arranged.sourceTruthAssessment.id,
        searchId: item.arranged.arrangementSearch.id,
        planId: item.arranged.arrangementPlan.id,
        portableFamilyDecisionKeys: item.arranged.arrangementPlan.decisions
          .filter(({ portability }) => portability === "target_portable")
          .map(({ familyDecisionKey }) => familyDecisionKey)
          .filter((key): key is string => key !== undefined)
          .sort(),
        candidateCount: item.arranged.candidates.length,
        comparisonMethod: item.arranged.arrangementSearch.comparisonPolicy!.method,
        deliverableIds: item.deliverables.map(({ id }) => id),
        notationLayout: item.arranged.arrangementScore.targetConfiguration.notationLayouts[0]!,
        physicalEvidence: "awaiting_human",
        specialistEvidence: "awaiting_human",
        reviewArtifacts: item.reviewArtifacts,
        ...(item.reviewRequestPath ? { reviewRequestPath: item.reviewRequestPath } : {}),
      })),
    };
  } finally {
    rmSync(canonicalRoot, { recursive: true, force: true });
  }
}

async function realizeTargets(input: {
  projectRoot: string;
  workspaceStore: WorkspaceStore;
  now: () => Date;
  createId: () => string;
  runner: Pick<SubprocessRunnerType, "run">;
  reviewArtifactRoot?: string;
}) {
  const workspace = input.workspaceStore.create({
    title: "Greensleeves three-target parity",
    brief: { targetConfigurations: TARGETS.map(({ target }) => target) },
  });
  const sourceBytes = readFileSync(
    path.join(input.projectRoot, "test/fixtures/greensleeves/greensleeves-satb.ly")
  );
  const source = input.workspaceStore.addSourceArtifact(workspace.id, {
    filename: "greensleeves-satb.ly",
    mimeType: "text/x-lilypond",
    contentBase64: sourceBytes.toString("base64"),
    provenance: { license: "Public Domain" },
  });
  const imported = await new SourceImportService({ store: input.workspaceStore }).import(
    workspace.id,
    source.id,
    { voiceNames: ["Soprano", "Alto", "Tenor", "Bass"] }
  );
  const arrangementService = new ArrangementService({
    store: input.workspaceStore,
    now: input.now,
    createId: input.createId,
  });
  const results = [];
  for (const { caseId, target } of TARGETS) {
    const arranged = arrangementService.createFaithfulReduction(workspace.id, {
      normalizedScoreId: imported.normalizedScore.id,
      targetConfigurationId: target.id,
    });
    const lilypond = engrave(
      arrangementToEngraveParams(arranged.arrangementScore, imported.normalizedScore)
    ).source;
    const compiled = await compileLilyPond(
      { source: lilypond, format: "both" },
      input.runner,
      60_000
    );
    if (compiled.errors.length || !compiled.svg || !compiled.pdf || !compiled.midi) {
      throw new Error(
        `Parity projection failed for ${target.instrumentId}: ${compiled.errors.length ? JSON.stringify(compiled.errors) : "one or more required artifacts were absent"}`
      );
    }
    const preview = buildAudioPreview(arranged.arrangementScore, imported.normalizedScore);
    const reviewArtifacts = input.reviewArtifactRoot
      ? exportReviewArtifacts(input.reviewArtifactRoot, target.instrumentId, {
          lilypond: Buffer.from(lilypond),
          svg: Buffer.from(compiled.svg),
          pdf: Buffer.from(compiled.pdf, "base64"),
          midi: Buffer.from(compiled.midi, "base64"),
          audioPreview: Buffer.from(JSON.stringify(preview, null, 2)),
        })
      : [];
    const reviewRequestPath =
      input.reviewArtifactRoot && reviewArtifacts.length > 0
        ? exportReviewRequest({
            root: input.reviewArtifactRoot,
            tracerId: tracerIdFor(target.instrumentId),
            sourceDigest: createHash("sha256").update(sourceBytes).digest("hex"),
            arrangementScore: arranged.arrangementScore,
            performanceBrief: arranged.performanceBrief,
            reviewArtifacts,
            createdAt: input.now().toISOString(),
          })
        : undefined;
    const deliverables = [
      persistDeliverable(input.workspaceStore, workspace.id, arranged.arrangementScore, {
        kind: "lilypond",
        mimeType: "text/x-lilypond",
        extension: "ly",
        content: Buffer.from(lilypond),
      }),
      persistDeliverable(input.workspaceStore, workspace.id, arranged.arrangementScore, {
        kind: "browser_preview",
        mimeType: "image/svg+xml",
        extension: "svg",
        content: Buffer.from(compiled.svg),
        artifactPolicyVersion: compiled.artifactPolicyVersion,
      }),
      persistDeliverable(input.workspaceStore, workspace.id, arranged.arrangementScore, {
        kind: "pdf",
        mimeType: "application/pdf",
        extension: "pdf",
        content: Buffer.from(compiled.pdf, "base64"),
      }),
      persistDeliverable(input.workspaceStore, workspace.id, arranged.arrangementScore, {
        kind: "midi",
        mimeType: "audio/midi",
        extension: "midi",
        content: Buffer.from(compiled.midi, "base64"),
      }),
      persistDeliverable(input.workspaceStore, workspace.id, arranged.arrangementScore, {
        kind: "audio_preview",
        mimeType: "application/json",
        extension: "json",
        content: Buffer.from(JSON.stringify(preview)),
      }),
    ];
    const card = buildNarrowEvaluationCard({
      score: arranged.arrangementScore,
      planning: {
        sourceTruthAssessment: arranged.sourceTruthAssessment,
        performanceBrief: arranged.performanceBrief,
        arrangementPlan: arranged.arrangementPlan,
      },
      deliverableIds: deliverables.map(({ id }) => id),
    });
    const dimensions = card.dimensions.map((dimension) =>
      dimension.id === "playback_and_performed_form"
        ? {
            ...dimension,
            status: "pass" as const,
            evidenceIds: deliverables
              .filter(({ kind }) => kind === "midi" || kind === "audio_preview")
              .map(({ id }) => id),
            rationale:
              "Canonical MIDI and event-identity audio preview were projected; audible quality remains separate human evidence.",
          }
        : dimension.id === "workflow_and_recovery"
          ? {
              ...dimension,
              status: "pass" as const,
              evidenceIds: [arranged.arrangementScore.id, ...deliverables.map(({ id }) => id)],
              rationale:
                "The independent target search, durable score, and complete restorable projection set were produced.",
            }
          : dimension
    );
    results.push({
      caseId,
      targetId: target.id,
      instrumentId: target.instrumentId,
      arranged,
      deliverables,
      dimensions,
      reviewArtifacts,
      reviewRequestPath,
      generatedRecords: [
        imported.scoreTranscription,
        imported.normalizedScore,
        imported.analysisRecord,
        arranged.sourceTruthAssessment,
        arranged.performanceBrief,
        arranged.arrangementPlan,
        arranged.arrangementSearch,
        arranged.arrangementScore,
      ],
    });
  }
  return results;
}

function exportReviewRequest(input: {
  root: string;
  tracerId: "T41" | "T42" | "T43";
  sourceDigest: string;
  arrangementScore: CreateFaithfulArrangementResult["arrangementScore"];
  performanceBrief: CreateFaithfulArrangementResult["performanceBrief"];
  reviewArtifacts: Array<{ kind: string; path: string; sha256: string }>;
  createdAt: string;
}): string {
  const instrumentInstance = input.arrangementScore.targetConfiguration.instrumentInstance;
  if (!instrumentInstance) throw new Error("Review export requires an exact Instrument Instance");
  const profileId = input.arrangementScore.targetConfiguration.instrumentId;
  const policy = reviewPolicy(profileId);
  const request: ReviewRequest = {
    schemaVersion: 1,
    id: `review-request.${input.tracerId}.${profileId}`,
    tracerId: input.tracerId,
    protocol: {
      id: "T40.review",
      version: 1,
      digest: createHash("sha256").update("T40.review.v1").digest("hex"),
    },
    sourceDigest: input.sourceDigest,
    arrangementScoreRef: {
      id: input.arrangementScore.id,
      version: input.arrangementScore.version ?? 1,
      digest: digestValue(input.arrangementScore),
    },
    performanceBriefRef: {
      id: input.performanceBrief.id,
      digest: digestValue(input.performanceBrief),
    },
    instrument: {
      profileId,
      instanceDigest: digestInstrumentInstance(instrumentInstance),
      modeledDescription: policy.modeledDescription,
    },
    artifacts: input.reviewArtifacts.map(({ kind, path: artifactPath, sha256 }) => ({
      kind:
        kind === "audioPreview"
          ? "audio_preview"
          : (kind as ReviewRequest["artifacts"][number]["kind"]),
      relativePath: path.basename(artifactPath),
      sha256,
    })),
    requiredRoles: policy.requiredRoles,
    requiredDimensions: policy.requiredDimensions,
    roleAssignments: policy.roleAssignments,
    staleWhen: [
      "source digest changes",
      "Arrangement or Performance Brief changes",
      "Instrument Instance or actual physical setup changes",
      "arrangement or review artifact bytes change",
      "review protocol or evaluator semantics change",
      "Preservation Policy changes",
    ],
    createdAt: input.createdAt,
  };
  const filePath = path.join(input.root, profileId, "review-request.json");
  writeFileSync(filePath, `${JSON.stringify(request, null, 2)}\n`);
  return filePath;
}

function tracerIdFor(instrumentId: string): "T41" | "T42" | "T43" {
  if (instrumentId === "baroque-guitar-5") return "T41";
  if (instrumentId === "baroque-lute-13") return "T42";
  if (instrumentId === "classical-guitar-6") return "T43";
  throw new Error(`No physical-review tracer for ${instrumentId}`);
}

function reviewPolicy(profileId: string): {
  modeledDescription: string;
  requiredRoles: HumanReviewerRole[];
  requiredDimensions: string[];
  roleAssignments: ReviewRequest["roleAssignments"];
} {
  if (profileId === "baroque-guitar-5") {
    return {
      modeledDescription:
        "Five-course baroque guitar with French stringing and French letter tablature",
      requiredRoles: [
        "target_player",
        "historical_specialist",
        "engraving_editor",
        "owner",
        "baseline_reviewer",
      ],
      requiredDimensions: [
        "physical_playability",
        "recognition",
        "historical_practice",
        "notation",
        "owner_usefulness",
        "baseline_tradeoff",
      ],
      roleAssignments: roleAssignments({
        physical_playability: ["target_player"],
        recognition: ["target_player", "owner"],
        historical_practice: ["historical_specialist"],
        notation: ["engraving_editor"],
        owner_usefulness: ["owner"],
        baseline_tradeoff: ["baseline_reviewer", "owner"],
      }),
    };
  }
  if (profileId === "baroque-lute-13") {
    return {
      modeledDescription:
        "Thirteen-course baroque lute in default D-minor Bass Tuning with French letter tablature",
      requiredRoles: [
        "target_player",
        "historical_specialist",
        "engraving_editor",
        "owner",
        "baseline_reviewer",
      ],
      requiredDimensions: [
        "stopped_course_and_diapason_playability",
        "right_hand_feasibility",
        "recognition",
        "historical_practice",
        "notation",
        "owner_usefulness",
        "baseline_tradeoff",
      ],
      roleAssignments: roleAssignments({
        stopped_course_and_diapason_playability: ["target_player"],
        right_hand_feasibility: ["target_player"],
        recognition: ["target_player", "owner"],
        historical_practice: ["historical_specialist"],
        notation: ["engraving_editor"],
        owner_usefulness: ["owner"],
        baseline_tradeoff: ["baseline_reviewer", "owner"],
      }),
    };
  }
  return {
    modeledDescription:
      "Six-string classical guitar in standard EADGBE tuning with standard notation",
    requiredRoles: ["target_player", "engraving_editor", "owner", "baseline_reviewer"],
    requiredDimensions: [
      "position_and_sustain_playability",
      "polyphonic_clarity",
      "recognition",
      "notation",
      "owner_usefulness",
      "baseline_tradeoff",
    ],
    roleAssignments: roleAssignments({
      position_and_sustain_playability: ["target_player"],
      polyphonic_clarity: ["target_player", "owner"],
      recognition: ["target_player", "owner"],
      notation: ["engraving_editor"],
      owner_usefulness: ["owner"],
      baseline_tradeoff: ["baseline_reviewer", "owner"],
    }),
  };
}

function roleAssignments(
  assignments: Record<string, HumanReviewerRole[]>
): ReviewRequest["roleAssignments"] {
  return Object.entries(assignments).map(([dimension, authorizedRoles]) => ({
    dimension,
    authorizedRoles,
  }));
}

function exportReviewArtifacts(
  root: string,
  instrumentId: string,
  artifacts: Record<string, Buffer>
): Array<{ kind: string; path: string; sha256: string }> {
  const directory = path.join(root, instrumentId);
  mkdirSync(directory, { recursive: true });
  const extensions: Record<string, string> = {
    lilypond: "ly",
    svg: "svg",
    pdf: "pdf",
    midi: "midi",
    audioPreview: "json",
  };
  return Object.entries(artifacts).map(([kind, bytes]) => {
    const filePath = path.join(directory, `${kind}.${extensions[kind]}`);
    writeFileSync(filePath, bytes);
    return {
      kind,
      path: filePath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}

function recordRef(record: { id: string; version?: number }) {
  return { id: record.id, version: record.version ?? 1, digest: digestValue(record) };
}

function sourceBytesFor(projectRoot: string): Buffer {
  return readFileSync(path.join(projectRoot, "test/fixtures/greensleeves/greensleeves-satb.ly"));
}

export const THREE_TARGET_COMPARISON_POLICY = FIRST_LOOP_COMPARISON_POLICY;
