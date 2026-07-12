import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import type { AnalysisRecord, ScoreTranscription } from "../../lib/music-domain.js";
import { ArrangementService } from "./arrangement-service.js";
import { persistDeliverable } from "./deliverable-service.js";
import { SourceTruthService } from "./source-truth-service.js";
import { TranscriptionService } from "./transcription-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("purpose-scoped Source Truth convergence", () => {
  it("blocks only the affected scope and records exact consequence and claim authority", () => {
    const fixture = createFixture({ critical: true, resolved: false });
    const service = new SourceTruthService({
      store: fixture.store,
      now: () => new Date("2026-07-12T15:00:00.000Z"),
      createId: sequenceId(),
    });
    const affected = service.assess(fixture.workspaceId, {
      ...fixture.assessmentInput,
      scope: {
        kind: "passage",
        partIds: [],
        measureIds: [],
        eventIds: ["event.soprano.1"],
      },
    });
    expect(affected).toMatchObject({
      purpose: "arrangement_planning",
      scoreTranscriptionId: fixture.transcription.id,
      scoreTranscriptionVersion: 1,
      normalizedScoreId: fixture.normalized.id,
      analysisRecordId: fixture.analysis.id,
      outcome: "review_required",
      unresolvedUncertaintyIds: ["uncertainty.opening"],
      stability: {
        iteration: 1,
        newMaterialUncertaintyIds: ["uncertainty.opening"],
        stable: false,
      },
      consequences: [
        expect.objectContaining({
          uncertaintyId: "uncertainty.opening",
          discoveredBy: "transcription",
          dimensions: ["pitch", "recognizable_identity"],
          critical: true,
          material: true,
          unresolved: true,
        }),
      ],
    });
    expect(affected.blockedClaimIds.length).toBeGreaterThan(0);
    expect(affected.blockedClaimIds.some((id) => affected.authorizedClaimIds.includes(id))).toBe(
      false
    );

    const unaffected = service.assess(fixture.workspaceId, {
      ...fixture.assessmentInput,
      scope: {
        kind: "passage",
        partIds: [],
        measureIds: [],
        eventIds: ["event.soprano.20"],
      },
    });
    expect(unaffected).toMatchObject({
      outcome: "authoritative_for_purpose",
      unresolvedUncertaintyIds: [],
      consideredUncertaintyIds: [],
      stability: { stable: true },
    });
  });

  it("lets Analysis reopen a resolved reading and converges only after its ambiguity resolves", () => {
    const fixture = createFixture({ critical: true, resolved: true });
    const service = new SourceTruthService({
      store: fixture.store,
      now: () => new Date("2026-07-12T15:00:00.000Z"),
      createId: sequenceId(),
    });
    const initial = service.assess(fixture.workspaceId, fixture.assessmentInput);
    expect(initial).toMatchObject({
      outcome: "authoritative_for_purpose",
      stability: { stable: true },
    });

    const reopenedAnalysis: AnalysisRecord = {
      ...fixture.analysis,
      id: "analysis.2222222222222222",
      version: 2,
      ambiguities: [
        {
          id: "ambiguity.reopened-principal",
          claimId: fixture.analysis.claims[0]!.id,
          critical: true,
          question: "Does the corrected opening change Principal Voice identity?",
          alternativeIds: ["part.soprano", "part.alto"],
          sourceUncertaintyIds: ["uncertainty.opening"],
          affectedEventIds: ["event.soprano.1"],
          affectedTargetConfigurationIds: [fixture.targetConfigurationId],
          consequenceDimensions: ["voice", "identity"],
        },
      ],
    };
    fixture.store.saveAnalysisRecord(fixture.workspaceId, reopenedAnalysis);
    const reopened = service.assess(fixture.workspaceId, {
      ...fixture.assessmentInput,
      analysisRecordId: reopenedAnalysis.id,
      priorAssessmentId: initial.id,
    });
    expect(reopened).toMatchObject({
      outcome: "review_required",
      supersedesAssessmentId: initial.id,
      stability: {
        iteration: 2,
        newMaterialUncertaintyIds: ["uncertainty.opening"],
        stable: false,
      },
      consequences: expect.arrayContaining([
        expect.objectContaining({
          uncertaintyId: "uncertainty.opening",
          discoveredBy: "analysis",
          unresolved: true,
        }),
      ]),
    });
    expect(
      new TranscriptionService({ store: fixture.store }).review(
        fixture.workspaceId,
        fixture.transcription.id
      ).items
    ).toEqual([
      expect.objectContaining({
        uncertainty: expect.objectContaining({
          id: "uncertainty.opening",
          resolved: false,
          message: expect.stringMatching(/Analysis introduced/i),
        }),
      }),
    ]);
    const unaffectedTarget = service.assess(fixture.workspaceId, {
      ...fixture.assessmentInput,
      analysisRecordId: reopenedAnalysis.id,
      targetConfigurationIds: ["target.classical-guitar"],
    });
    expect(unaffectedTarget).toMatchObject({
      outcome: "authoritative_for_purpose",
      consideredUncertaintyIds: ["uncertainty.opening"],
      blockingUncertaintyIds: [],
      stability: { stable: true },
    });
    expect(
      unaffectedTarget.consequences.some((consequence) => consequence.discoveredBy === "analysis")
    ).toBe(false);

    const resolvedAnalysis: AnalysisRecord = {
      ...reopenedAnalysis,
      id: "analysis.3333333333333333",
      version: 3,
      ambiguities: reopenedAnalysis.ambiguities?.map((ambiguity) => ({
        ...ambiguity,
        resolution: "The Soprano remains the Principal Voice.",
      })),
    };
    fixture.store.saveAnalysisRecord(fixture.workspaceId, resolvedAnalysis);
    const converged = service.assess(fixture.workspaceId, {
      ...fixture.assessmentInput,
      analysisRecordId: resolvedAnalysis.id,
      priorAssessmentId: reopened.id,
    });
    expect(converged).toMatchObject({
      outcome: "authoritative_for_purpose",
      supersedesAssessmentId: reopened.id,
      unresolvedUncertaintyIds: [],
      stability: { iteration: 3, newMaterialUncertaintyIds: [], stable: true },
    });
  });

  it("treats intrinsic Analysis ambiguity as deterministic Source Truth uncertainty", () => {
    const fixture = createFixture({ critical: false, resolved: true });
    const ambiguous: AnalysisRecord = {
      ...fixture.analysis,
      id: "analysis.3333333333333333",
      version: 2,
      ambiguities: [
        {
          id: "ambiguity.intrinsic-principal",
          claimId: fixture.analysis.claims[0]!.id,
          critical: true,
          question: "Which unlabeled line carries the Principal Voice?",
          alternativeIds: ["alternative.upper", "alternative.inner"],
          affectedEventIds: ["event.soprano.1"],
          consequenceDimensions: ["voice", "identity", "recognizable_identity"],
        },
      ],
    };
    fixture.store.saveAnalysisRecord(fixture.workspaceId, ambiguous);
    const assessment = new SourceTruthService({
      store: fixture.store,
      now: () => new Date("2026-07-12T15:00:00.000Z"),
      createId: sequenceId(),
    }).assess(fixture.workspaceId, {
      ...fixture.assessmentInput,
      analysisRecordId: ambiguous.id,
    });

    expect(assessment).toMatchObject({
      outcome: "review_required",
      consideredUncertaintyIds: expect.arrayContaining(["ambiguity.intrinsic-principal"]),
      blockingUncertaintyIds: ["ambiguity.intrinsic-principal"],
      stability: { stable: false },
      consequences: expect.arrayContaining([
        expect.objectContaining({
          uncertaintyId: "ambiguity.intrinsic-principal",
          discoveredBy: "analysis",
          affectedEventIds: ["event.soprano.1"],
        }),
      ]),
    });
  });

  it("correction creates a superseding assessment and stales every exact dependent kind", () => {
    const fixture = createFixture({ critical: false, resolved: false });
    const arranged = new ArrangementService({
      store: fixture.store,
      now: () => new Date("2026-07-12T15:00:00.000Z"),
      createId: sequenceId(),
    }).createFaithfulReduction(fixture.workspaceId, {
      normalizedScoreId: fixture.normalized.id,
      targetConfigurationId: fixture.targetConfigurationId,
    });
    expect(arranged.sourceTruthAssessment).toMatchObject({
      outcome: "authoritative_with_disclosed_uncertainty",
      stability: { stable: true },
    });
    persistDeliverable(fixture.store, fixture.workspaceId, arranged.arrangementScore, {
      kind: "lilypond",
      mimeType: "text/x-lilypond",
      content: Buffer.from("% retained stale fixture\n"),
      extension: "ly",
    });

    const corrected = new TranscriptionService({
      store: fixture.store,
      now: () => new Date("2026-07-12T15:01:00.000Z"),
      createId: sequenceId(),
    }).correct(fixture.workspaceId, fixture.transcription.id, {
      uncertaintyId: "uncertainty.opening",
      eventEdits: [{ eventId: "event.soprano.1", pitch: "E4" }],
      rationale: "Confirmed from the source.",
    });
    expect(corrected.sourceTruthAssessmentIds).toHaveLength(1);
    const nextTruth = fixture.store.getSourceTruthAssessment(
      fixture.workspaceId,
      corrected.sourceTruthAssessmentIds[0]!
    );
    expect(nextTruth).toMatchObject({
      supersedesAssessmentId: arranged.sourceTruthAssessment.id,
      scoreTranscriptionId: corrected.scoreTranscription.id,
      normalizedScoreId: corrected.normalizedScore.id,
      analysisRecordId: corrected.analysisRecord.id,
      outcome: "authoritative_for_purpose",
      stability: { iteration: 2, stable: true },
    });
    const stale = corrected.staleDerivationIds.map((id) =>
      fixture.store.getStaleDerivation(fixture.workspaceId, id)
    );
    expect(new Set(stale.map((record) => record.recordType))).toEqual(
      new Set([
        "arrangement_plan",
        "arrangement_search",
        "arrangement_candidate",
        "arrangement_score",
        "deliverable",
      ])
    );
    expect(stale.every((record) => record.changedObjectIds?.includes("event.soprano.1"))).toBe(
      true
    );
    expect(
      fixture.store.getArrangementPlan(fixture.workspaceId, arranged.arrangementPlan.id)
    ).toEqual(arranged.arrangementPlan);
    expect(
      fixture.store.getArrangementScore(fixture.workspaceId, arranged.arrangementScore.id)
    ).toEqual(arranged.arrangementScore);
  });
});

function createFixture(options: { critical: boolean; resolved: boolean }) {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-source-truth-"));
  roots.push(root);
  const store = new WorkspaceStore({ rootDirectory: root });
  const workspace = store.create({
    title: "Greensleeves Source Truth",
    brief: {
      targetConfigurations: [
        {
          id: "target.baroque-guitar",
          instrumentId: "baroque-guitar-5",
          role: "solo",
          stringing: "french",
          notationLayouts: ["french-letter-tablature"],
          deliverables: ["pdf", "audio-preview"],
        },
        {
          id: "target.classical-guitar",
          instrumentId: "classical-guitar-6",
          role: "solo",
          notationLayouts: ["standard-notation"],
          deliverables: ["pdf", "audio-preview"],
        },
      ],
    },
  });
  const sourceBytes = readFileSync(
    path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
  );
  const source = store.addSourceArtifact(workspace.id, {
    filename: "greensleeves.pdf",
    mimeType: "application/pdf",
    contentBase64: sourceBytes.toString("base64"),
    provenance: { license: "Public Domain" },
  });
  const parsed = parseExplicitVoiceLilypond(
    readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
      "utf8"
    ),
    ["Soprano", "Alto", "Tenor", "Bass"]
  );
  store.saveOmrRun(workspace.id, {
    id: "omr.1111111111111111",
    sourceArtifactId: source.id,
    backend: { id: "fixture", version: "1", configuration: {} },
    status: "completed",
    nativeArtifactPaths: [],
    interchangeArtifactPaths: [],
    pageMappings: [],
    diagnostics: [],
    createdAt: "2026-07-12T14:00:00.000Z",
    completedAt: "2026-07-12T14:00:00.000Z",
  });
  const transcription: ScoreTranscription = store.saveScoreTranscription(workspace.id, {
    id: "transcription.1111111111111111",
    sourceArtifactId: source.id,
    omrRunId: "omr.1111111111111111",
    version: 1,
    status: options.resolved ? "reviewed" : "needs_review",
    title: parsed.title,
    key: parsed.key,
    timeSignature: parsed.timeSignature,
    parts: parsed.parts,
    measures: parsed.measures,
    events: parsed.events,
    uncertainties: [
      {
        id: "uncertainty.opening",
        eventIds: ["event.soprano.1"],
        critical: options.critical,
        category: "pitch",
        message: "The opening pitch can change recognizable identity.",
        alternatives: ["E4", "F#4"],
        resolved: options.resolved,
      },
    ],
    createdAt: "2026-07-12T14:00:00.000Z",
  });
  const normalized = store.saveNormalizedScore(workspace.id, {
    id: "score.1111111111111111",
    scoreTranscriptionId: transcription.id,
    version: transcription.version,
    title: transcription.title,
    key: transcription.key,
    timeSignature: transcription.timeSignature,
    parts: transcription.parts,
    measures: transcription.measures,
    events: transcription.events,
    createdAt: transcription.createdAt,
  });
  const analysis = store.saveAnalysisRecord(
    workspace.id,
    analyzeMusicologicalScore(normalized, {
      id: "analysis.1111111111111111",
      createdAt: transcription.createdAt,
    })
  );
  const targetConfigurationId = workspace.brief.targetConfigurations[0]!.id;
  return {
    store,
    workspaceId: workspace.id,
    transcription,
    normalized,
    analysis,
    targetConfigurationId,
    assessmentInput: {
      sourceArtifactId: source.id,
      scoreTranscriptionId: transcription.id,
      normalizedScoreId: normalized.id,
      analysisRecordId: analysis.id,
      scope: { kind: "whole_score" as const, partIds: [], measureIds: [], eventIds: [] },
      preservationPolicy: "faithful_reduction" as const,
      targetConfigurationIds: [targetConfigurationId],
    },
  };
}

function sequenceId(): () => string {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(value++).padStart(12, "0")}`;
}
