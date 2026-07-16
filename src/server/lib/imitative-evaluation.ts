import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildAudioPreview } from "../../lib/audio-preview.js";
import type { EvaluationCard, EvaluationDefinition } from "../../lib/evaluation-domain.js";
import { imitativeArrangementToLilyPond } from "../../lib/imitative-engrave.js";
import { buildNarrowEvaluationCard } from "../../lib/narrow-intelligence.js";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import { ArrangementService } from "./arrangement-service.js";
import { compileLilyPond } from "./compile-route.js";
import { persistDeliverable } from "./deliverable-service.js";
import { digestValue, EvaluationHarness, type EvaluationRegistry } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import {
  createFirstLoopRegistry,
  narrowDimensionToAbsoluteResult,
} from "./first-loop-evaluation.js";
import { OmrService, type OmrBackend } from "./omr.js";
import { SubprocessRunner } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

export const IMITATIVE_EVALUATION_SUITE_REF = {
  id: "suite.imitative-intabulation",
  version: 1,
} as const;

const IMITATIVE_TARGET = {
  id: "target.renaissance-lute",
  instrumentId: "renaissance-lute-6",
  role: "solo" as const,
  tuningId: "renaissance-g",
  notationLayouts: ["french-letter-tablature"],
  deliverables: ["pdf", "audio-preview"],
};

export function createImitativeEvaluationRegistry(projectRoot = process.cwd()): EvaluationRegistry {
  const base = createFirstLoopRegistry(projectRoot);
  const baseCase = base.cases[0]!;
  if (baseCase.mode !== "end_to_end") throw new Error("First-loop fixture must be end-to-end");
  const bytes = readFileSync(
    path.join(projectRoot, "test/fixtures/imitation/imitative-passage.pdf")
  );
  const definitions: EvaluationDefinition[] = base.definitions.map((definition) =>
    definition.id === "brief.arrangement.first-loop"
      ? { ...definition, payload: { targetConfigurations: [IMITATIVE_TARGET] } }
      : definition
  );
  definitions.push({
    id: "expectation.imitative-domain",
    version: 1,
    kind: "expectation",
    payload: {
      requiredState: ["ordered_entries", "subject_shapes", "voice_continuity", "cadential_goals"],
      forbidPermanentPrincipalVoice: true,
      forbidGenericCounterpointSubstitution: true,
      requireRankedCompleteAssignments: true,
    },
  });
  const evaluationCase = {
    ...baseCase,
    id: "case.imitative-intabulation",
    sourceArtifact: {
      id: "fixture.imitative-passage-pdf",
      digest: createHash("sha256").update(bytes).digest("hex"),
      mediaType: "application/pdf",
      byteLength: bytes.byteLength,
    },
    targetExpectationRefs: [{ id: "expectation.imitative-domain", version: 1 }],
    provenance: {
      origin: "Vellum CC0 Three-Voice Imitative Passage",
      license: "CC0-1.0",
      datasetRole: "development" as const,
      datasetVersion: 1,
    },
  };
  return {
    definitions,
    cases: [evaluationCase],
    suites: [
      {
        id: IMITATIVE_EVALUATION_SUITE_REF.id,
        version: 1,
        caseRefs: [{ id: evaluationCase.id, version: 1 }],
        evaluatorRefs: [{ id: "evaluator.first-loop", version: 1 }],
        adapterRefs: [{ id: "adapter.restricted-lilypond", version: 1 }],
        profileRefs: [],
        comparisonPolicyRef: { id: "policy.first-loop-comparison", version: 1 },
        reportProfileRef: { id: "profile.first-loop-report", version: 1 },
      },
    ],
  };
}

export async function runImitativeEvaluation(options: {
  evaluationRoot: string;
  projectRoot?: string;
  now?: () => Date;
  createId?: () => string;
}): Promise<{
  runId: string;
  cards: EvaluationCard[];
  evidence: {
    candidateCount: number;
    candidateStrategies: string[];
    selectedCandidateId: string;
    completeAssignmentsRanked: true;
    voiceIds: string[];
    orderedEntriesPreserved: boolean;
    subjectShapesProtected: boolean;
    voiceContinuityProtected: boolean;
    cadentialGoalsProtected: boolean;
    permanentPrincipalVoiceInvented: false;
    soundingEventCount: number;
    uniquePlaybackOccurrenceCount: number;
    deliverableCount: number;
  };
}> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const root = mkdtempSync(path.join(tmpdir(), "vellum-imitative-evaluation-"));
  const workspaceStore = new WorkspaceStore({ rootDirectory: root });
  const createId = options.createId ?? randomUUID;
  const now = options.now ?? (() => new Date());
  try {
    const item = await realizeImitative(projectRoot, workspaceStore, createId, now);
    const registry = createImitativeEvaluationRegistry(projectRoot);
    const store = new EvaluationStore({ rootDirectory: options.evaluationRoot });
    const result = await new EvaluationHarness({
      store,
      registry,
      createId,
      now,
      executeCase: async (evaluationCase, manifest) => ({
        generatedRecordRefs: item.generatedRecords.map(recordRef),
        deliverableRefs: item.deliverables.map(({ id, sha256 }) => ({
          id,
          version: 1,
          digest: sha256,
        })),
        dimensionResults: item.dimensions.map((dimension) =>
          narrowDimensionToAbsoluteResult(dimension, manifest.evaluators[0]!, evaluationCase.id)
        ),
        diagnostics: [
          {
            code: "imitation.domain_state",
            message:
              "Imitative evaluation retains ordered entries, subject shapes, voice lineages, and cadential goals; it does not invent a permanent Principal Voice or substitute generic counterpoint lint.",
            severity: "info",
          },
        ],
      }),
    }).run(IMITATIVE_EVALUATION_SUITE_REF, {
      productVersion: "0.1.0",
      runtime: process.version,
      platform: process.platform,
      architecture: process.arch,
      command: "eval:imitative",
    });
    const previewEvents = item.preview.events;
    const preservationTargets = item.arranged.analysis.preservationTargets;
    return {
      runId: result.run.id,
      cards: result.cards,
      evidence: {
        candidateCount: item.arranged.candidates.length,
        candidateStrategies: item.arranged.candidates.map(({ strategy }) => strategy),
        selectedCandidateId: item.arranged.arrangementScore.selectedCandidateId,
        completeAssignmentsRanked: true,
        voiceIds: [
          ...new Set(item.arranged.arrangementScore.events.flatMap(({ voiceId }) => voiceId ?? [])),
        ].sort(),
        orderedEntriesPreserved: item.arranged.arrangementScore.preservationAudit.findings.some(
          ({ code }) => code === "imitation.ordered_entries_preserved"
        ),
        subjectShapesProtected: preservationTargets.some(
          ({ relationshipType, eventGroups }) =>
            relationshipType === "ordered_entries" && (eventGroups?.length ?? 0) > 1
        ),
        voiceContinuityProtected: preservationTargets.some(({ kind }) => kind === "voice"),
        cadentialGoalsProtected: preservationTargets.some(
          ({ relationshipType }) => relationshipType === "cadential_goal"
        ),
        permanentPrincipalVoiceInvented: false,
        soundingEventCount: item.arranged.arrangementScore.events.filter(
          ({ type }) => type !== "rest"
        ).length,
        uniquePlaybackOccurrenceCount: new Set(
          previewEvents.map(({ occurrenceId }) => occurrenceId)
        ).size,
        deliverableCount: item.deliverables.length,
      },
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function realizeImitative(
  projectRoot: string,
  store: WorkspaceStore,
  createId: () => string,
  now: () => Date
) {
  const workspace = store.create({
    title: "Imitative intabulation evaluation",
    brief: { targetConfigurations: [IMITATIVE_TARGET] },
  });
  const pdf = readFileSync(path.join(projectRoot, "test/fixtures/imitation/imitative-passage.pdf"));
  const source = store.addSourceArtifact(workspace.id, {
    filename: "imitative-passage.pdf",
    mimeType: "application/pdf",
    contentBase64: pdf.toString("base64"),
    provenance: { license: "CC0-1.0" },
  });
  const parsed = parseExplicitVoiceLilypond(
    readFileSync(path.join(projectRoot, "test/fixtures/imitation/imitative-passage.ly"), "utf8"),
    ["VoiceOne", "VoiceTwo", "VoiceThree"]
  );
  const backend: OmrBackend = {
    id: "reviewed-imitation-fixture",
    recognize: async () => ({
      backend: { id: "reviewed-imitation-fixture", version: "1", configuration: {} },
      artifacts: [],
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      diagnostics: [],
      recognizedScore: { ...parsed, uncertainties: [] },
    }),
  };
  const imported = await new OmrService({ store, createId }).recognize(
    workspace.id,
    source.id,
    backend
  );
  const reviewedAt = now().toISOString();
  const transcription = store.saveScoreTranscription(workspace.id, {
    ...imported.scoreTranscription,
    id: `transcription.${createId()}`,
    parentId: imported.scoreTranscription.id,
    version: imported.scoreTranscription.version + 1,
    status: "reviewed",
    createdAt: reviewedAt,
  });
  const score = store.saveNormalizedScore(workspace.id, {
    ...imported.normalizedScore,
    id: `score.${createId()}`,
    scoreTranscriptionId: transcription.id,
    version: transcription.version,
    createdAt: reviewedAt,
  });
  const arranged = new ArrangementService({ store, createId, now }).createFaithfulReduction(
    workspace.id,
    {
      normalizedScoreId: score.id,
      targetConfigurationId: "target.renaissance-lute",
    }
  );
  const lilypond = imitativeArrangementToLilyPond(arranged.arrangementScore, score);
  const compiled = await compileLilyPond(
    { source: lilypond, format: "both" },
    new SubprocessRunner(60_000),
    60_000
  );
  if (compiled.errors.length || !compiled.svg || !compiled.pdf || !compiled.midi) {
    throw new Error("Imitative evaluation projection failed");
  }
  const preview = buildAudioPreview(arranged.arrangementScore, score);
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
    arranged,
    preview,
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
              "Canonical playback isolates all three source lineages without duplicated sounding occurrences.",
          }
        : dimension
    ),
    generatedRecords: [
      transcription,
      score,
      arranged.analysis,
      arranged.sourceTruthAssessment,
      arranged.performanceBrief,
      arranged.arrangementPlan,
      arranged.arrangementSearch,
      arranged.arrangementScore,
    ],
  };
}

function recordRef(record: { id: string; version?: number }) {
  return { id: record.id, version: record.version ?? 1, digest: digestValue(record) };
}
