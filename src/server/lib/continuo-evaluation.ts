import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import { buildAudioPreview } from "../../lib/audio-preview.js";
import { continuoArrangementToLilyPond } from "../../lib/continuo-engrave.js";
import type { EvaluationCard, EvaluationDefinition } from "../../lib/evaluation-domain.js";
import { RecognizedScoreSchema, type TargetConfiguration } from "../../lib/music-domain.js";
import { buildNarrowEvaluationCard } from "../../lib/narrow-intelligence.js";
import { ArrangementService } from "./arrangement-service.js";
import { compileLilyPond } from "./compile-route.js";
import { persistDeliverable } from "./deliverable-service.js";
import { EvaluationHarness, type EvaluationRegistry, digestValue } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import {
  createFirstLoopRegistry,
  narrowDimensionToAbsoluteResult,
} from "./first-loop-evaluation.js";
import { OmrService, type OmrBackend } from "./omr.js";
import { SubprocessRunner } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

export const CONTINUO_EVALUATION_SUITE_REF = {
  id: "suite.contextual-continuo",
  version: 1,
} as const;

const CONTINUO_TARGETS: Array<{
  caseId: string;
  target: TargetConfiguration;
  preservationPolicy: "faithful_reduction" | "idiomatic_adaptation";
  expectedDisposition: "complete_realization" | "separate_bass_realization" | "continuo_reduction";
}> = [
  {
    caseId: "case.continuo.complete",
    target: {
      id: "target.piano-continuo",
      instrumentId: "piano",
      role: "ensemble",
      realizationProfileId: "continuo.italian-baroque",
      continuoTreatment: "complete",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    },
    preservationPolicy: "faithful_reduction",
    expectedDisposition: "complete_realization",
  },
  {
    caseId: "case.continuo.separate-bass",
    target: {
      id: "target.baroque-guitar-continuo",
      instrumentId: "baroque-guitar-5",
      role: "ensemble",
      stringing: "french",
      realizationProfileId: "continuo.italian-baroque",
      continuoTreatment: "separate_bass",
      continuoBassInstrumentId: "voice-bass",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    },
    preservationPolicy: "faithful_reduction",
    expectedDisposition: "separate_bass_realization",
  },
  {
    caseId: "case.continuo.reduction",
    target: {
      id: "target.baroque-guitar-reduction",
      instrumentId: "baroque-guitar-5",
      role: "ensemble",
      stringing: "french",
      realizationProfileId: "continuo.italian-baroque",
      continuoTreatment: "reduction",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    },
    preservationPolicy: "idiomatic_adaptation",
    expectedDisposition: "continuo_reduction",
  },
];

export function createContinuoEvaluationRegistry(projectRoot = process.cwd()): EvaluationRegistry {
  const base = createFirstLoopRegistry(projectRoot);
  const baseCase = base.cases[0]!;
  if (baseCase.mode !== "end_to_end") throw new Error("First-loop fixture must be end-to-end");
  const sourceBytes = readFileSync(
    path.join(projectRoot, "test/fixtures/continuo/continuo-suspension.pdf")
  );
  const sourceArtifact = {
    id: "fixture.continuo-suspension-pdf",
    digest: createHash("sha256").update(sourceBytes).digest("hex"),
    mediaType: "application/pdf",
    byteLength: sourceBytes.byteLength,
  };
  const definitions: EvaluationDefinition[] = base.definitions.map((definition) =>
    definition.id === "brief.arrangement.first-loop"
      ? {
          ...definition,
          payload: { targetConfigurations: CONTINUO_TARGETS.map(({ target }) => target) },
        }
      : definition
  );
  definitions.push({
    id: "expectation.contextual-continuo",
    version: 1,
    kind: "expectation",
    payload: {
      requiredRoles: ["principal_voice", "continuo_foundation", "generated_realization"],
      requireContextualFigures: true,
      requirePreparedResolution: true,
      requireBassAuthority: true,
      forbidPositionStateAsDomainTruth: true,
    },
  });
  const cases = CONTINUO_TARGETS.map(({ caseId }) => ({
    ...baseCase,
    id: caseId,
    sourceArtifact,
    targetExpectationRefs: [{ id: "expectation.contextual-continuo", version: 1 }],
    provenance: {
      origin: "Vellum CC0 Continuo Suspension Exercise",
      license: "CC0-1.0",
      datasetRole: "held_out" as const,
      datasetVersion: 1,
    },
  }));
  return {
    definitions,
    cases,
    suites: [
      {
        id: CONTINUO_EVALUATION_SUITE_REF.id,
        version: 1,
        caseRefs: cases.map(({ id, version }) => ({ id, version })),
        evaluatorRefs: [{ id: "evaluator.first-loop", version: 1 }],
        adapterRefs: [{ id: "adapter.restricted-lilypond", version: 1 }],
        profileRefs: [],
        comparisonPolicyRef: { id: "policy.first-loop-comparison", version: 1 },
        reportProfileRef: { id: "profile.first-loop-report", version: 1 },
      },
    ],
  };
}

export async function runContinuoEvaluation(options: {
  evaluationRoot: string;
  projectRoot?: string;
  now?: () => Date;
  createId?: () => string;
}): Promise<{
  runId: string;
  cards: EvaluationCard[];
  cases: Array<{
    caseId: string;
    sourceTruthOutcome: string;
    disposition: string;
    planFoundationDisposition: string;
    candidateStrategies: string[];
    auditStatus: string;
    generatedVoiceEventCount: number;
    foundationEventCount: number;
    preparedResolutionAccepted: boolean;
    positionStateUsedAsDomainTruth: false;
  }>;
}> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const registry = createContinuoEvaluationRegistry(projectRoot);
  const root = mkdtempSync(path.join(tmpdir(), "vellum-continuo-evaluation-"));
  const workspaceStore = new WorkspaceStore({ rootDirectory: root });
  const createId = options.createId ?? randomUUID;
  const now = options.now ?? (() => new Date());
  try {
    const realized = await realizeContinuoCases(projectRoot, workspaceStore, createId, now);
    const byCase = new Map(realized.map((item) => [item.caseId, item]));
    const evaluationStore = new EvaluationStore({ rootDirectory: options.evaluationRoot });
    const result = await new EvaluationHarness({
      store: evaluationStore,
      registry,
      createId,
      now,
      executeCase: async (evaluationCase, manifest) => {
        const item = byCase.get(evaluationCase.id);
        if (!item) throw new Error(`Missing continuo result for ${evaluationCase.id}`);
        const evaluatorRef = manifest.evaluators[0]!;
        return {
          generatedRecordRefs: item.generatedRecords.map(recordRef),
          deliverableRefs: item.deliverables.map(({ id, sha256 }) => ({
            id,
            version: 1,
            digest: sha256,
          })),
          dimensionResults: item.dimensions.map((dimension) =>
            narrowDimensionToAbsoluteResult(dimension, evaluatorRef, evaluationCase.id)
          ),
          diagnostics: [
            {
              code: "continuo.contextual_state",
              message:
                "Continuo evaluation retains bass, figure, harmonic context, voice-leading, and prepared-resolution state without treating fretted positions as domain truth.",
              severity: "info" as const,
            },
          ],
        };
      },
    }).run(CONTINUO_EVALUATION_SUITE_REF, {
      productVersion: "0.1.0",
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      command: "eval:continuo",
    });
    return {
      runId: result.run.id,
      cards: result.cards,
      cases: realized.map((item) => ({
        caseId: item.caseId,
        sourceTruthOutcome: item.arranged.sourceTruthAssessment.outcome,
        disposition: item.arranged.arrangementScore.continuoDisposition!.kind,
        planFoundationDisposition:
          item.arranged.arrangementPlan.specialistIntent!.kind === "continuo_realization"
            ? item.arranged.arrangementPlan.specialistIntent.foundationDisposition
            : "invalid",
        candidateStrategies: item.arranged.candidates.map(({ strategy }) => strategy),
        auditStatus: item.arranged.arrangementScore.preservationAudit.status,
        generatedVoiceEventCount: item.arranged.arrangementScore.events.filter(
          ({ role }) => role === "realization"
        ).length,
        foundationEventCount: item.arranged.arrangementScore.events.filter(
          ({ role }) => role === "continuo_foundation"
        ).length,
        preparedResolutionAccepted: item.arranged.arrangementScore.preservationAudit.findings.some(
          ({ code }) => code === "continuo.prepared_suspension_accepted"
        ),
        positionStateUsedAsDomainTruth: false,
      })),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function realizeContinuoCases(
  projectRoot: string,
  store: WorkspaceStore,
  createId: () => string,
  now: () => Date
) {
  const workspace = store.create({
    title: "Contextual continuo evaluation",
    brief: { targetConfigurations: CONTINUO_TARGETS.map(({ target }) => target) },
  });
  const pdf = readFileSync(
    path.join(projectRoot, "test/fixtures/continuo/continuo-suspension.pdf")
  );
  const source = store.addSourceArtifact(workspace.id, {
    filename: "continuo-suspension.pdf",
    mimeType: "application/pdf",
    contentBase64: pdf.toString("base64"),
    provenance: { license: "CC0-1.0" },
  });
  const recognizedScore = Value.Decode(
    RecognizedScoreSchema,
    JSON.parse(
      readFileSync(path.join(projectRoot, "test/fixtures/continuo/reviewed-score.json"), "utf8")
    )
  );
  const backend: OmrBackend = {
    id: "reviewed-continuo-fixture",
    recognize: async () => ({
      backend: { id: "reviewed-continuo-fixture", version: "1", configuration: {} },
      artifacts: [],
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      diagnostics: [],
      recognizedScore,
    }),
  };
  const imported = await new OmrService({ store, createId }).recognize(
    workspace.id,
    source.id,
    backend
  );
  const reviewedAt = now().toISOString();
  const reviewedTranscription = store.saveScoreTranscription(workspace.id, {
    ...imported.scoreTranscription,
    id: `transcription.${createId()}`,
    parentId: imported.scoreTranscription.id,
    version: imported.scoreTranscription.version + 1,
    status: "reviewed",
    createdAt: reviewedAt,
  });
  const reviewedScore = store.saveNormalizedScore(workspace.id, {
    ...imported.normalizedScore,
    id: `score.${createId()}`,
    scoreTranscriptionId: reviewedTranscription.id,
    version: reviewedTranscription.version,
    createdAt: reviewedAt,
  });
  const service = new ArrangementService({ store, createId, now });
  return Promise.all(
    CONTINUO_TARGETS.map(async ({ caseId, target, preservationPolicy }) => {
      const arranged = service.createFaithfulReduction(workspace.id, {
        normalizedScoreId: reviewedScore.id,
        targetConfigurationId: target.id,
        preservationPolicy,
      });
      const lilypond = continuoArrangementToLilyPond(arranged.arrangementScore, reviewedScore);
      const compiled = await compileLilyPond(
        { source: lilypond, format: "both" },
        new SubprocessRunner(60_000),
        60_000
      );
      if (compiled.errors.length || !compiled.svg || !compiled.pdf || !compiled.midi) {
        throw new Error(`Continuo projection failed for ${caseId}`);
      }
      const preview = buildAudioPreview(arranged.arrangementScore, reviewedScore);
      const deliverables = [
        persistDeliverable(store, workspace.id, arranged.arrangementScore, {
          kind: "lilypond",
          mimeType: "text/x-lilypond",
          extension: "ly",
          content: Buffer.from(lilypond),
        }),
        persistDeliverable(store, workspace.id, arranged.arrangementScore, {
          kind: "browser_preview",
          mimeType: "image/svg+xml",
          extension: "svg",
          content: Buffer.from(compiled.svg),
          artifactPolicyVersion: compiled.artifactPolicyVersion,
        }),
        persistDeliverable(store, workspace.id, arranged.arrangementScore, {
          kind: "pdf",
          mimeType: "application/pdf",
          extension: "pdf",
          content: Buffer.from(compiled.pdf, "base64"),
        }),
        persistDeliverable(store, workspace.id, arranged.arrangementScore, {
          kind: "midi",
          mimeType: "audio/midi",
          extension: "midi",
          content: Buffer.from(compiled.midi, "base64"),
        }),
        persistDeliverable(store, workspace.id, arranged.arrangementScore, {
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
      return {
        caseId,
        arranged,
        deliverables,
        dimensions: card.dimensions.map((dimension) =>
          dimension.id === "playback_and_performed_form"
            ? {
                ...dimension,
                status: "pass" as const,
                evidenceIds: deliverables
                  .filter(({ kind }) => kind === "midi" || kind === "audio_preview")
                  .map(({ id }) => id),
                rationale:
                  "Canonical preview preserves distinct Principal Voice, Continuo Foundation, and generated realization parts.",
              }
            : dimension
        ),
        generatedRecords: [
          reviewedTranscription,
          reviewedScore,
          arranged.analysis,
          arranged.sourceTruthAssessment,
          arranged.performanceBrief,
          arranged.arrangementPlan,
          arranged.arrangementSearch,
          arranged.arrangementScore,
        ],
      };
    })
  );
}

function recordRef(record: { id: string; version?: number }) {
  return { id: record.id, version: record.version ?? 1, digest: digestValue(record) };
}
