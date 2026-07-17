import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import { buildNarrowEvaluationCard } from "../../lib/narrow-intelligence.js";
import { noteToMidi, transposeNote } from "../../lib/pitch.js";
import type { ApiResponse } from "../../lib/api-contract.js";
import { ArrangementService } from "./arrangement-service.js";
import { AnalysisService } from "./analysis-service.js";
import { createAnalysisCorrectionRoute } from "./analysis-route.js";
import { OmrService } from "./omr.js";
import type { OmrBackend } from "./omr.js";
import { WorkspaceStore } from "./workspace-store.js";
import { ApiRouteError } from "./create-route.js";
import { LineageService } from "./lineage-service.js";
import { ArrangementPlanService } from "./arrangement-plan-service.js";
import { OwnerIntentService } from "./owner-intent-service.js";
import { digestInstrumentInstance } from "../../lib/instrument-instance.js";
import {
  createArrangementCandidatePreviewRoute,
  createArrangementSearchGetRoute,
} from "./arrangement-search-route.js";
import { createWorkspaceNavigationRoute } from "./workspace-route.js";
import {
  createPerformanceInterpretationCreateRoute,
  createPerformanceInterpretationListRoute,
  createPerformanceInterpretationPreviewRoute,
} from "./performance-interpretation-route.js";
import {
  createArrangementReadinessRoute,
  createOwnerPlaytestCreateRoute,
  readiness,
} from "./owner-playtest-route.js";
import { createFirstLoopRegistry } from "./first-loop-evaluation.js";
import { digestValue } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { validateAndSaveHumanEvaluation } from "./human-comparison.js";
import type { HumanEvaluation } from "../../lib/evaluation-domain.js";

describe("Greensleeves faithful arrangement service", () => {
  let rootDirectory: string;
  let store: WorkspaceStore;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-arrangement-service-"));
    store = new WorkspaceStore({ rootDirectory });
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("runs uploaded PDF truth through analysis, search, audit, and durable arrangement", async () => {
    const workspace = store.create({
      title: "Greensleeves",
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
            id: "target.baroque-lute",
            instrumentId: "baroque-lute-13",
            role: "solo",
            tuningId: "d_minor",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
          {
            id: "target.classical-guitar",
            instrumentId: "classical-guitar-6",
            role: "solo",
            tuningId: "standard",
            notationLayouts: ["standard-notation"],
            deliverables: ["pdf", "audio-preview"],
          },
        ],
      },
    });
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    const source = store.addSourceArtifact(workspace.id, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    const backend: OmrBackend = {
      id: "fixture",
      recognize: async () => ({
        backend: { id: "fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: {
          ...parsed,
          performedForm: {
            id: "performed-form.greensleeves-repeat",
            measureOccurrences: [
              {
                id: "occurrence.greensleeves.1a",
                measureId: parsed.measures[0]!.id,
                iteration: 1,
                repeatIteration: 1,
              },
              {
                id: "occurrence.greensleeves.1b",
                measureId: parsed.measures[0]!.id,
                iteration: 2,
                repeatIteration: 2,
              },
              ...parsed.measures.slice(1).map((measure, index) => ({
                id: `occurrence.greensleeves.${index + 2}`,
                measureId: measure.id,
                iteration: 1,
              })),
            ],
            traversalDecisions: ["Repeat the opening measure twice in this dependency fixture."],
          },
          events: parsed.events.map((event, index) => ({
            ...event,
            sourceRegion: {
              coordinateSpace: "source_document" as const,
              page: 1,
              x: 40 + index * 3,
              y: 80,
              width: 12,
              height: 16,
            },
          })),
          uncertainties: [],
        },
      }),
    };
    const omrIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    const omr = await new OmrService({ store, createId: () => omrIds.shift()! }).recognize(
      workspace.id,
      source.id,
      backend
    );
    const arrangementIds = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "88888888-8888-4888-8888-888888888888",
      "99999999-9999-4999-8999-999999999999",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    ];
    const service = new ArrangementService({
      store,
      now: () => new Date("2026-07-10T14:00:00.000Z"),
      createId: () => arrangementIds.shift()!,
    });
    const result = service.createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-guitar",
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.arrangementSearch).toMatchObject({
      id: "search.55555555-5555-4555-8555-555555555555",
      status: "completed",
      candidateIds: result.candidates.map((candidate) => candidate.id),
      selectedCandidateId: result.arrangementScore.selectedCandidateId,
    });
    expect(result.arrangementSearch.constraintSpecifications).not.toHaveLength(0);
    expect(result.arrangementSearch.executionIdentity).toMatchObject({
      arrangementPlanId: result.arrangementPlan.id,
      performanceBriefId: result.performanceBrief.id,
      targetConfigurationId: "target.baroque-guitar",
      constraintDigests: result.arrangementSearch.constraintSpecifications.map(() =>
        expect.stringMatching(/^[a-f0-9]{64}$/)
      ),
    });
    const exactGuitar = result.arrangementSearch.targetConfiguration.instrumentInstance!;
    expect(exactGuitar).toMatchObject({
      id: expect.stringMatching(/^instrument-instance\./),
      profileId: "baroque-guitar-5",
      tuningState: { variant: "french" },
      contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(exactGuitar.courses.map((course) => course.strings.length)).toEqual([1, 2, 2, 2, 2]);
    expect(result.arrangementSearch.executionIdentity.instrumentInstanceDigest).toBe(
      exactGuitar.contentDigest
    );
    expect(
      result.candidates.every(
        (candidate) =>
          candidate.phraseSearchEvidence?.arrangementPlanId === result.arrangementPlan.id &&
          candidate.phraseSearchEvidence.performanceBriefId === result.performanceBrief.id &&
          candidate.phraseSearchEvidence.instrumentInstanceDigest === exactGuitar.contentDigest &&
          candidate.phraseSearchEvidence.completeness === "bounded" &&
          candidate.phraseSearchEvidence.transitions.every(
            (transition) => !transition.violentCrossNeckJump
          )
      )
    ).toBe(true);
    expect(result.candidates[0]!.phraseSearchEvidence!.techniqueApplicability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ technique: "rasgueado", status: "applicable" }),
        expect.objectContaining({ technique: "punteado", status: "applicable" }),
        expect.objectContaining({ technique: "campanella", status: "applicable" }),
        expect.objectContaining({ technique: "damping", status: "applicable" }),
      ])
    );
    expect(result.performanceBrief.arrangementBriefSnapshot.targetConfigurations).toContainEqual(
      expect.objectContaining({
        id: "target.baroque-guitar",
        instrumentInstance: exactGuitar,
      })
    );
    expect(result.arrangementScore.targetConfiguration.instrumentInstance).toEqual(exactGuitar);
    expect(result.arrangementSearch.outcome).toEqual({
      kind: "candidate_found",
      executionIdentity: result.arrangementSearch.executionIdentity,
      diagnosticEvidenceIds: [result.arrangementScore.id],
      candidateIds: result.candidates.map((candidate) => candidate.id),
      selectedCandidateId: result.arrangementScore.selectedCandidateId,
    });
    expect(
      result.candidates.every(
        (candidate) => candidate.arrangementSearchId === result.arrangementSearch.id
      )
    ).toBe(true);
    expect(
      result.candidates
        .filter((candidate) => candidate.status !== "rejected")
        .map((candidate) => candidate.rank)
        .sort()
    ).toEqual([1, 2]);
    expect(result.candidates[0]?.evaluation).toMatchObject({
      hardConstraintResults: expect.arrayContaining([
        expect.objectContaining({ category: "preservation", status: "pass" }),
      ]),
      scores: {
        historicalProfile: expect.any(Number),
        idiom: expect.any(Number),
        playability: expect.any(Number),
        voiceLeading: expect.any(Number),
        notationClarity: expect.any(Number),
        softPreferences: expect.any(Number),
      },
      measurements: expect.arrayContaining([
        expect.objectContaining({
          metricId: "metric.adapter-preferred-strategy",
          applicability: "applicable",
        }),
        expect.objectContaining({
          metricId: "metric.source-pitch-class-coverage",
          applicability: "applicable",
        }),
      ]),
      selectionBasis: expect.objectContaining({ method: "policy_lexicographic" }),
    });
    const rankedCandidates = result.candidates
      .filter((candidate) => candidate.rank)
      .sort((left, right) => left.rank! - right.rank!);
    expect(result.arrangementSearch.comparisonPolicy).toMatchObject({
      method: "policy_lexicographic",
      automaticTieBreak: "none",
      priorityMetricIds: expect.arrayContaining([
        "metric.adapter-preferred-strategy",
        "metric.source-pitch-class-coverage",
      ]),
    });
    expect(rankedCandidates[0]?.status).toBe("selected");
    expect(result.arrangementScore.selectedCandidateId).toBe(rankedCandidates[0]?.id);
    expect(result.arrangementScore.events).toEqual(rankedCandidates[0]?.events);
    const reloadedStore = new WorkspaceStore({ rootDirectory });
    expect(reloadedStore.getArrangementSearch(workspace.id, result.arrangementSearch.id)).toEqual(
      result.arrangementSearch
    );
    expect(() =>
      reloadedStore.saveArrangementSearch(workspace.id, {
        ...result.arrangementSearch,
        outcome: {
          ...result.arrangementSearch.outcome!,
          executionIdentity: {
            ...result.arrangementSearch.executionIdentity,
            digest: "f".repeat(64),
          },
        },
      })
    ).toThrow(/exact execution identity/);
    expect(reloadedStore.getArrangementCandidate(workspace.id, result.candidates[0]!.id)).toEqual(
      result.candidates[0]
    );
    expect(result.arrangementScore).toMatchObject({
      id: "arrangement.55555555-5555-4555-8555-555555555555",
      preservationPolicy: "faithful_reduction",
      preservationAudit: { status: "pass", findings: [] },
      transpositionPlan: { sourceKey: "G major", targetKey: "F major", semitones: -2 },
    });
    expect(result.sourceTruthAssessment).toMatchObject({
      sourceArtifactId: source.id,
      scoreTranscriptionId: omr.scoreTranscription.id,
      normalizedScoreId: omr.normalizedScore.id,
      analysisRecordId: result.analysis.id,
      purpose: "arrangement_planning",
      outcome: "authoritative_for_purpose",
    });
    expect(result.performanceBrief).toMatchObject({
      targetConfigurationId: "target.baroque-guitar",
      arrangementBriefRevision: expect.any(Number),
      arrangementBriefDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      arrangementBriefSnapshot: workspace.brief,
      intendedUse: "study",
      performerProfile: { techniqueFamiliarity: [] },
      tempoContext: { status: "not_specified" },
      difficultyIntent: "intermediate",
      reliabilityGoal: "repeatable",
      techniqueContext: { status: "unspecified" },
      notationContext: {
        needs: ["french-letter-tablature"],
        ensembleRole: "solo",
      },
      difficultyContext: {
        targetConfigurationId: "target.baroque-guitar",
        definitionId: "difficulty.baroque-guitar-5.intermediate.v1",
        evidenceIds: ["profile.baroque-guitar-5"],
      },
    });
    expect(result.sourceTruthAssessment.performanceBriefId).toBe(result.performanceBrief.id);
    expect(result.arrangementSearch.performanceBriefId).toBe(result.performanceBrief.id);
    expect(result.arrangementPlan).toMatchObject({
      kind: "sectional_reduction",
      status: "ready",
      targetConfigurationId: "target.baroque-guitar",
      performanceBriefId: result.performanceBrief.id,
    });
    expect(result.arrangementPlan).toMatchObject({
      arrangementBriefRevision: result.performanceBrief.arrangementBriefRevision,
      arrangementBriefDigest: result.performanceBrief.arrangementBriefDigest,
      transpositionPlan: { status: "resolved", semitones: 0 },
    });
    expect(result.arrangementPlan.sectionalIntent).toHaveLength(
      store.getAnalysisRecord(workspace.id, result.analysisRecordId).passages?.length ?? 0
    );
    expect(result.arrangementPlan.materialDisposition.map((item) => item.disposition)).toEqual(
      expect.arrayContaining(["retained", "omitted"])
    );
    expect(result.arrangementPlan.phraseObligations?.[0]?.targetVoices).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "principal_voice" })])
    );
    expect(result.arrangementPlan.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alternatives: [],
          ambiguity: { status: "none" },
          confidence: 1,
          confirmation: { requirement: "not_required", status: "not_required" },
          policyConsequence: {
            preservationPolicy: "faithful_reduction",
            requiresPolicyException: false,
          },
        }),
      ])
    );
    expect(result.arrangementScore.arrangementPlanId).toBe(result.arrangementPlan.id);
    expect(result.arrangementScore.realizedPlanDecisionIds).toEqual(
      result.arrangementPlan.decisions.map((decision) => decision.id)
    );
    const selectedEvent = result.arrangementScore.events[0]!;
    const intentAnchor = {
      workspaceId: workspace.id,
      arrangementScoreId: result.arrangementScore.id,
      arrangementScoreVersion: result.arrangementScore.version ?? 1,
      arrangementFamilyId: result.arrangementScore.arrangementFamilyId!,
      arrangementSearchId: result.arrangementSearch.id,
      arrangementPlanId: result.arrangementPlan.id,
      analysisRecordId: result.analysis.id,
      targetConfigurationId: result.arrangementScore.targetConfiguration.id,
      preservationPolicy: result.arrangementScore.preservationPolicy,
      eventIds: [selectedEvent.id],
      measureIds: [selectedEvent.measureId],
      sourceEventIds: selectedEvent.sourceEventIds,
      findingIds: [],
    };
    const beforeIntentProposal = structuredClone(store.get(workspace.id));
    const intentService = new OwnerIntentService({
      store,
      createId: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    expect(intentService.classify(intentAnchor, "Why is this note here?")).toMatchObject({
      proposedLayer: "explanation",
      consequence: "none",
      confirmation: "not_required",
      mutationAuthorized: false,
    });
    expect(intentService.classify(intentAnchor, "The OCR misread this source note")).toMatchObject({
      proposedLayer: "score_transcription",
      consequence: "lineage",
      confirmation: "required",
      mutationAuthorized: false,
    });
    expect(store.get(workspace.id)).toEqual(beforeIntentProposal);
    expect(() =>
      intentService.classify(
        { ...intentAnchor, arrangementScoreVersion: intentAnchor.arrangementScoreVersion + 1 },
        "Change this note to G4"
      )
    ).toThrow("stale Arrangement Score version");
    const evaluationCard = buildNarrowEvaluationCard({
      score: result.arrangementScore,
      planning: {
        sourceTruthAssessment: result.sourceTruthAssessment,
        performanceBrief: result.performanceBrief,
        arrangementPlan: result.arrangementPlan,
      },
      deliverableIds: [],
    });
    expect(evaluationCard.performanceBriefId).toBe(result.performanceBrief.id);
    expect(evaluationCard.hardGateStatus).toBe("pass");
    expect(evaluationCard.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "source_authority", status: "pass", hardGate: true }),
        expect.objectContaining({
          id: "human_and_physical_evidence",
          status: "unknown",
          hardGate: false,
        }),
        expect.objectContaining({ id: "explicit_owner_usefulness", status: "not_evaluated" }),
      ])
    );
    const sourceMelody = omr.normalizedScore.events.filter(
      (event) => event.partId === "part.soprano" && event.type === "note"
    );
    const arrangedMelody = result.arrangementScore.events.filter(
      (event) => event.principalVoiceSourceEventId !== undefined
    );
    expect(arrangedMelody).toHaveLength(sourceMelody.length);
    for (const sourceEvent of sourceMelody) {
      if (sourceEvent.type !== "note") continue;
      const arranged = arrangedMelody.find(
        (event) => event.principalVoiceSourceEventId === sourceEvent.id
      )!;
      const expected = transposeNote(sourceEvent.pitch, -2);
      expect(arranged.pitches).toContain(expected);
      expect(Math.max(...arranged.pitches.map(noteToMidi))).toBe(noteToMidi(expected));
    }
    expect(store.getArrangementScore(workspace.id, result.arrangementScore.id)).toEqual(
      result.arrangementScore
    );
    expect(() =>
      store.saveArrangementScore(workspace.id, {
        ...result.arrangementScore,
        targetConfiguration: {
          ...result.arrangementScore.targetConfiguration,
          instrumentInstance: {
            ...result.arrangementScore.targetConfiguration.instrumentInstance!,
            contentDigest: "f".repeat(64),
          },
        },
      })
    ).toThrow(/target lineage is inconsistent/);
    expect(store.get(workspace.id).arrangementScoreIds).toEqual([result.arrangementScore.id]);

    const luteResult = service.createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-lute",
    });
    expect(luteResult.analysisRecordId).toBe(result.analysisRecordId);
    expect(luteResult.arrangementSearch.performanceBriefId).toBe(luteResult.performanceBrief.id);
    expect(luteResult.arrangementPlan.performanceBriefId).toBe(luteResult.performanceBrief.id);
    expect(luteResult.arrangementScore).toMatchObject({
      id: "arrangement.88888888-8888-4888-8888-888888888888",
      targetConfiguration: { instrumentId: "baroque-lute-13", tuningId: "d_minor" },
      preservationAudit: { status: "pass" },
    });
    const exactLute = luteResult.arrangementScore.targetConfiguration.instrumentInstance!;
    expect(exactLute).toMatchObject({
      profileId: "baroque-lute-13",
      tuningState: { variant: "d_minor" },
      contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(exactLute.courses[9]).toMatchObject({
      course: 10,
      stopped: false,
      notationIdentity: "///a",
      strings: [{ openPitch: "D2", fretsWithCourse: false }],
    });
    expect(luteResult.arrangementSearch.executionIdentity.instrumentInstanceDigest).toBe(
      exactLute.contentDigest
    );
    expect(
      luteResult.candidates.every(
        (candidate) =>
          candidate.phraseSearchEvidence?.arrangementPlanId === luteResult.arrangementPlan.id &&
          candidate.phraseSearchEvidence.performanceBriefId === luteResult.performanceBrief.id &&
          candidate.phraseSearchEvidence.instrumentInstanceDigest === exactLute.contentDigest &&
          candidate.phraseSearchEvidence.luteTechniqueEvidence?.voiceLineage === "represented" &&
          candidate.phraseSearchEvidence.luteTechniqueEvidence.styleBrise.status === "not_applied"
      )
    ).toBe(true);
    expect(
      luteResult.performanceBrief.arrangementBriefSnapshot.targetConfigurations
    ).toContainEqual(
      expect.objectContaining({ id: "target.baroque-lute", instrumentInstance: exactLute })
    );

    const classicalResult = service.createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.classical-guitar",
    });
    expect(
      new Set([
        result.arrangementScore.arrangementFamilyId,
        luteResult.arrangementScore.arrangementFamilyId,
        classicalResult.arrangementScore.arrangementFamilyId,
      ]).size
    ).toBe(1);
    expect(classicalResult.analysisRecordId).toBe(result.analysisRecordId);
    expect(classicalResult.arrangementSearch.performanceBriefId).toBe(
      classicalResult.performanceBrief.id
    );
    expect(classicalResult.arrangementPlan.performanceBriefId).toBe(
      classicalResult.performanceBrief.id
    );
    for (const arranged of [result, luteResult, classicalResult]) {
      for (const decision of arranged.arrangementPlan.decisions) {
        expect(decision.downstreamConstraintIds.length).toBeGreaterThan(0);
        expect(arranged.arrangementSearch.constraintSpecifications).toEqual(
          expect.arrayContaining(
            decision.downstreamConstraintIds.map((constraintId) =>
              expect.objectContaining({
                id: constraintId,
                scope: expect.objectContaining({
                  targetConfigurationId: arranged.arrangementScore.targetConfiguration.id,
                }),
                provenance: expect.objectContaining({
                  kind: "plan_decision",
                  sourceRecordId: decision.id,
                  evidenceIds: decision.evidenceIds,
                }),
              })
            )
          )
        );
      }
    }
    const portableFamilyKeys = [result, luteResult, classicalResult].map((arranged) =>
      arranged.arrangementPlan.decisions
        .filter((decision) => decision.portability === "target_portable")
        .map((decision) => decision.familyDecisionKey)
        .sort()
    );
    expect(portableFamilyKeys[1]).toEqual(portableFamilyKeys[0]);
    expect(portableFamilyKeys[2]).toEqual(portableFamilyKeys[0]);
    expect(
      new Set(
        [result, luteResult, classicalResult].flatMap((arranged) =>
          arranged.arrangementPlan.decisions.flatMap((decision) => decision.downstreamConstraintIds)
        )
      ).size
    ).toBeGreaterThan(portableFamilyKeys[0]!.length);
    const exactClassicalGuitar =
      classicalResult.arrangementScore.targetConfiguration.instrumentInstance!;
    expect(exactClassicalGuitar).toMatchObject({
      profileId: "classical-guitar-6",
      scaleLength: { value: 650, unit: "mm" },
      tuningState: { variant: "standard" },
      contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(exactClassicalGuitar.courses).toHaveLength(6);
    expect(exactClassicalGuitar.courses.every((course) => course.strings.length === 1)).toBe(true);
    expect(classicalResult.arrangementSearch.executionIdentity.instrumentInstanceDigest).toBe(
      exactClassicalGuitar.contentDigest
    );
    expect(
      classicalResult.performanceBrief.arrangementBriefSnapshot.targetConfigurations
    ).toContainEqual(
      expect.objectContaining({
        id: "target.classical-guitar",
        instrumentInstance: exactClassicalGuitar,
      })
    );
    expect(
      classicalResult.arrangementScore.events
        .flatMap((event) => event.positions)
        .filter((position) => position.fret > 0)
        .every((position) => position.leftHandFinger && position.handPosition)
    ).toBe(true);
    expect(
      classicalResult.candidates.every(
        (candidate) =>
          candidate.phraseSearchEvidence?.arrangementPlanId ===
            classicalResult.arrangementPlan.id &&
          candidate.phraseSearchEvidence.performanceBriefId ===
            classicalResult.performanceBrief.id &&
          candidate.phraseSearchEvidence.classicalTechniqueEvidence?.rightHandScope ===
            "represented" &&
          candidate.phraseSearchEvidence.classicalTechniqueEvidence.independentVoiceDuration ===
            "represented"
      )
    ).toBe(true);
    expect(
      classicalResult.arrangementScore.events
        .flatMap((event) => event.voiceConstituents ?? [])
        .every((constituent) => {
          const source = omr.normalizedScore.events.find(
            (event) => event.id === constituent.sourceEventId
          );
          return (
            source?.type === "note" &&
            source.partId === constituent.voiceId &&
            JSON.stringify(source.duration) === JSON.stringify(constituent.duration)
          );
        })
    ).toBe(true);
    expect(
      classicalResult.arrangementScore.events
        .filter((event) => event.type !== "rest")
        .every(
          (event) =>
            event.notationSemantics &&
            event.notationSemantics.soundingPitches.join("|") === event.pitches.join("|")
        )
    ).toBe(true);
    expect(store.getArrangementScore(workspace.id, classicalResult.arrangementScore.id)).toEqual(
      classicalResult.arrangementScore
    );
    expect(
      new Set([
        result.performanceBrief.id,
        luteResult.performanceBrief.id,
        classicalResult.performanceBrief.id,
      ]).size
    ).toBe(3);
    expect(classicalResult.arrangementScore).toMatchObject({
      id: "arrangement.99999999-9999-4999-8999-999999999999",
      targetConfiguration: {
        instrumentId: "classical-guitar-6",
        tuningId: "standard",
        notationLayouts: ["standard-notation"],
      },
      transpositionPlan: { sourceKey: "G major", targetKey: "G major", semitones: 0 },
      preservationAudit: { status: "pass", findings: [] },
    });
    expect(store.get(workspace.id)).toMatchObject({
      analysisRecordIds: [result.analysisRecordId],
      sourceTruthAssessmentIds: expect.arrayContaining([result.sourceTruthAssessment.id]),
      performanceBriefIds: expect.arrayContaining([result.performanceBrief.id]),
      arrangementPlanIds: expect.arrayContaining([result.arrangementPlan.id]),
      arrangementScoreIds: [
        result.arrangementScore.id,
        luteResult.arrangementScore.id,
        classicalResult.arrangementScore.id,
      ],
    });

    const lineageIds = [
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "12121212-1212-4212-8212-121212121212",
      "14141414-1414-4414-8414-141414141414",
      "15151515-1515-4515-8515-151515151515",
      "16161616-1616-4616-8616-161616161616",
      "17171717-1717-4717-8717-171717171717",
      "18181818-1818-4818-8818-181818181818",
      "19191919-1919-4919-8919-191919191919",
      "20202020-2020-4020-8020-202020202020",
      "21212121-2121-4121-8121-212121212121",
      "22222222-2222-4222-8222-222222222223",
      "25252525-2525-4525-8525-252525252525",
      "26262626-2626-4626-8626-262626262626",
      "27272727-2727-4727-8727-272727272727",
      "28282828-2828-4828-8828-282828282828",
      "29292929-2929-4929-8929-292929292929",
      "30303030-3030-4030-8030-303030303030",
      "31313131-3131-4131-8131-313131313131",
      "32323232-3232-4232-8232-323232323232",
    ];
    const lineage = new LineageService({
      store,
      arrangementService: service,
      now: () => new Date("2026-07-10T14:30:00.000Z"),
      createId: () => lineageIds.shift()!,
    });
    const protectedEvent = result.arrangementScore.events.find(
      (event) => event.principalVoiceSourceEventId
    )!;
    const sourceLineage = lineage.sourceLineage(workspace.id, result.arrangementScore.id, [
      protectedEvent.id,
    ]);
    expect(sourceLineage).toMatchObject({
      arrangementScore: { id: result.arrangementScore.id, version: 1 },
      normalizedScore: { id: omr.normalizedScore.id, version: 1 },
      scoreTranscription: { id: omr.scoreTranscription.id, version: 1 },
      sourceArtifact: {
        id: source.id,
        kind: "pdf",
        contentUrl: `/api/workspaces/${workspace.id}/sources/${source.id}/content`,
      },
      items: expect.arrayContaining([
        expect.objectContaining({
          arrangementEventId: protectedEvent.id,
          sourceEventId: protectedEvent.sourceEventIds[0],
          anchorStatus: "resolved",
          region: expect.objectContaining({ page: 1, coordinateSpace: "source_document" }),
        }),
      ]),
    });
    expect(
      new Set(sourceLineage.items.map((item) => `${item.arrangementEventId}:${item.sourceEventId}`))
        .size
    ).toBe(sourceLineage.items.length);
    const preservationDecision = result.arrangementPlan.decisions.find(
      (decision) => decision.dimension === "preservation"
    )!;
    const promotedPlanDecision = lineage.promotePlanDecisionToFamilyCommitment(
      workspace.id,
      result.arrangementPlan.id,
      preservationDecision.id,
      ["target.baroque-lute"]
    );
    expect(promotedPlanDecision).toMatchObject({
      version: 1,
      sourcePlanDecisionId: preservationDecision.id,
      sourceArrangementScoreId: result.arrangementScore.id,
      targetConfigurationIds: ["target.baroque-lute"],
      scope: { dimension: "texture" },
      value: {
        semanticBasis: "plan_decision",
        familyDecisionKey: preservationDecision.familyDecisionKey,
        selectedValue: "faithful_reduction",
      },
    });
    expect(lineage.releaseCommitment(workspace.id, promotedPlanDecision.id)).toMatchObject({
      version: 2,
      status: "released",
    });
    const commitment = lineage.createEditorialCommitment(workspace.id, {
      arrangementScoreId: result.arrangementScore.id,
      arrangementFamilyId: result.arrangementScore.arrangementFamilyId!,
      scope: {
        objectIds: [protectedEvent.id],
        dimension: "principal_voice_pitch",
      },
      value: protectedEvent.pitches,
      origin: "user_edit",
    });
    const correctedScore = {
      ...omr.normalizedScore,
      id: "score.13131313-1313-4313-8313-131313131313",
      version: 2,
      createdAt: "2026-07-10T14:30:00.000Z",
    };
    store.saveNormalizedScore(workspace.id, correctedScore);
    const immutableArrangement = JSON.stringify(
      store.getArrangementScore(workspace.id, result.arrangementScore.id)
    );
    const staleRecords = lineage.markArrangementsStale(
      workspace.id,
      omr.normalizedScore.id,
      correctedScore.id,
      "Corrected source pitch"
    );
    expect(staleRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordType: "arrangement_score",
          recordId: result.arrangementScore.id,
          acknowledged: false,
          priorInputVersions: [expect.objectContaining({ recordId: omr.normalizedScore.id })],
          currentInputVersions: [expect.objectContaining({ recordId: correctedScore.id })],
        }),
      ])
    );
    expect(
      lineage.sourceLineage(workspace.id, result.arrangementScore.id, [protectedEvent.id])
    ).toMatchObject({
      staleReason: "Corrected source pitch",
      items: expect.arrayContaining([expect.objectContaining({ anchorStatus: "stale" })]),
    });
    expect(
      JSON.stringify(store.getArrangementScore(workspace.id, result.arrangementScore.id))
    ).toBe(immutableArrangement);
    const changedSourceEventId = protectedEvent.principalVoiceSourceEventId!;
    expect(() =>
      lineage.conservativeRegenerate(workspace.id, {
        arrangementScoreId: result.arrangementScore.id,
        normalizedScoreId: correctedScore.id,
        changedSourceEventIds: [changedSourceEventId],
      })
    ).toThrow(/releasing the commitment, revising the source correction, or approving/);
    expect(store.get(workspace.id).commitmentConflictIds).toHaveLength(1);

    lineage.releaseEditorialCommitment(workspace.id, commitment.id);
    const createSpy = vi.spyOn(service, "createFaithfulReduction").mockReturnValue(result);
    lineage.conservativeRegenerate(workspace.id, {
      arrangementScoreId: result.arrangementScore.id,
      normalizedScoreId: correctedScore.id,
      changedSourceEventIds: [changedSourceEventId],
    });
    expect(createSpy).toHaveBeenCalledWith(
      workspace.id,
      expect.objectContaining({
        arrangementFamilyId: result.arrangementScore.arrangementFamilyId,
        parentArrangementScoreId: result.arrangementScore.id,
        version: 2,
        regenerationFrom: {
          arrangementScoreId: result.arrangementScore.id,
          changedSourceEventIds: [changedSourceEventId],
        },
      })
    );
    expect(store.get(workspace.id).arrangementBranchIds).toHaveLength(1);

    const directEdit = lineage.editArrangementEvent(
      workspace.id,
      result.arrangementScore.id,
      protectedEvent.id,
      { positions: protectedEvent.positions.slice().reverse() }
    );
    expect(directEdit.arrangementScore).toMatchObject({
      version: 2,
      parentArrangementScoreId: result.arrangementScore.id,
      branchId: expect.stringMatching(/^branch\./),
      editorialCommitmentIds: [],
    });
    expect(directEdit.editorialCommitment).toBeUndefined();
    const explainedBatch = lineage.editArrangementEvents(
      workspace.id,
      result.arrangementScore.id,
      [
        {
          eventId: protectedEvent.id,
          patch: { positions: protectedEvent.positions.slice().reverse() },
        },
      ],
      "Prefer this equivalent fingering because it reads in course order."
    );
    expect(store.getArrangementBranch(workspace.id, explainedBatch.branch.id)).toMatchObject({
      rationale: "Prefer this equivalent fingering because it reads in course order.",
    });
    const promotedEdit = lineage.createEditorialCommitment(workspace.id, {
      arrangementScoreId: directEdit.arrangementScore.id,
      arrangementFamilyId: directEdit.arrangementScore.arrangementFamilyId!,
      scope: {
        objectIds: [protectedEvent.id],
        dimension: "course_fingering",
      },
      value: protectedEvent.positions.slice().reverse(),
      origin: "user_edit",
    });
    expect(promotedEdit).toMatchObject({ origin: "user_edit", status: "active" });
    expect(() =>
      lineage.promoteFamilyCommitment(workspace.id, promotedEdit.id, ["target.classical-guitar"])
    ).toThrow(/target-local/i);

    const portableCommitment = lineage.createEditorialCommitment(workspace.id, {
      arrangementScoreId: directEdit.arrangementScore.id,
      arrangementFamilyId: directEdit.arrangementScore.arrangementFamilyId!,
      scope: {
        objectIds: [protectedEvent.id],
        dimension: "principal_voice_pitch",
      },
      value: protectedEvent.pitches,
      origin: "approved_model_choice",
    });
    const staleBeforeFamilyPromotion = store.get(workspace.id).staleDerivationIds.length;
    const familyCommitment = lineage.promoteFamilyCommitment(workspace.id, portableCommitment.id, [
      "target.classical-guitar",
      "target.baroque-lute",
    ]);
    expect(familyCommitment).toMatchObject({
      version: 1,
      sourceArrangementScoreId: directEdit.arrangementScore.id,
      targetConfigurationIds: ["target.baroque-lute", "target.classical-guitar"],
      scope: {
        objectIds: protectedEvent.sourceEventIds,
        dimension: "principal_voice_pitch",
      },
    });
    const familyPromotionStaleRecords = store
      .get(workspace.id)
      .staleDerivationIds.slice(staleBeforeFamilyPromotion)
      .map((id) => store.getStaleDerivation(workspace.id, id));
    expect(new Set(familyPromotionStaleRecords.map((record) => record.recordId))).toEqual(
      new Set([luteResult.arrangementScore.id, classicalResult.arrangementScore.id])
    );
    expect(() =>
      lineage.conservativeRegenerate(workspace.id, {
        arrangementScoreId: classicalResult.arrangementScore.id,
        normalizedScoreId: correctedScore.id,
        changedSourceEventIds: [changedSourceEventId],
      })
    ).toThrow(/Family Commitment|Commitment Conflicts/);
    expect(lineage.releaseCommitment(workspace.id, familyCommitment.id)).toMatchObject({
      version: 2,
      status: "released",
    });

    const alternative = result.candidates.find((candidate) => candidate.status === "survived")!;
    const principalClaim = result.analysis.claims.find(
      (claim) => claim.kind === "principal_voice"
    )!;
    const analysisService = new AnalysisService({
      store,
      createId: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      now: () => new Date("2026-07-10T15:00:00.000Z"),
    });
    const interpretationIds = [
      "23232323-2323-4323-8323-232323232323",
      "24242424-2424-4424-8424-242424242424",
    ];
    const playtestIds = [
      "25252525-2525-4525-8525-252525252525",
      "26262626-2626-4626-8626-262626262626",
      "27272727-2727-4727-8727-272727272727",
      "28282828-2828-4828-8828-282828282828",
    ];
    const deferredScoreStaleness = store
      .get(workspace.id)
      .staleDerivationIds.map((id) => store.getStaleDerivation(workspace.id, id))
      .filter(
        (record) =>
          record.recordType === "arrangement_score" &&
          record.recordId === result.arrangementScore.id &&
          !record.acknowledged
      );
    for (const record of deferredScoreStaleness) {
      lineage.acknowledgeStaleDerivation(workspace.id, record.id);
    }
    const app = express();
    app.use(express.json());
    app.get(
      "/api/workspaces/:workspaceId/arrangement-searches/:searchId",
      createArrangementSearchGetRoute({ store, service })
    );
    app.get("/api/workspaces/:workspaceId/navigation", createWorkspaceNavigationRoute(store));
    app.get(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/performance-interpretations",
      createPerformanceInterpretationListRoute({ store })
    );
    app.post(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/performance-interpretations",
      createPerformanceInterpretationCreateRoute({
        store,
        createId: () => interpretationIds.shift()!,
        now: () => new Date("2026-07-10T16:00:00.000Z"),
      })
    );
    app.get(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/readiness",
      createArrangementReadinessRoute({ store })
    );
    app.post(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/owner-playtests",
      createOwnerPlaytestCreateRoute({
        store,
        createId: () => playtestIds.shift()!,
        now: () => new Date("2026-07-10T16:30:00.000Z"),
      })
    );
    app.get(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/performance-interpretations/:interpretationId/audio-preview",
      createPerformanceInterpretationPreviewRoute({ store })
    );
    app.get(
      "/api/workspaces/:workspaceId/arrangement-searches/:searchId/candidates/:candidateId/audio-preview",
      createArrangementCandidatePreviewRoute({ store, service })
    );
    app.post(
      "/api/workspaces/:workspaceId/analyses/:analysisRecordId/claims/:claimId/corrections",
      createAnalysisCorrectionRoute(store, analysisService)
    );
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected test server address");
    const base = `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangement-searches/${result.arrangementSearch.id}`;
    const searchResponse = await fetch(base);
    expect((await searchResponse.json()) as unknown).toMatchObject({
      ok: true,
      data: { id: result.arrangementSearch.id },
    });
    const previewResponse = await fetch(`${base}/candidates/${alternative.id}/audio-preview`);
    const preview = (await previewResponse.json()) as {
      ok: boolean;
      data: { events: unknown[] };
    };
    expect(preview.ok).toBe(true);
    expect(preview.data.events.length).toBeGreaterThan(0);
    const playtestBase = `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangements/${result.arrangementScore.id}`;
    expect(await (await fetch(`${playtestBase}/readiness`)).json()).toMatchObject({
      ok: true,
      data: { status: "inspection_only", currentPlaytestIds: [], stalePlaytestIds: [] },
    });
    const occurrenceId = omr.normalizedScore.performedForm!.measureOccurrences[0]!.id;
    const sharedCandidateSourceId = result.candidates[0]!.events.flatMap(
      (event) => event.sourceEventIds
    ).find((sourceId) =>
      result.candidates.every((candidate) =>
        candidate.events.some((event) => event.sourceEventIds.includes(sourceId))
      )
    )!;
    const testedEventIds = result.arrangementScore.events
      .filter((event) => event.sourceEventIds.includes(sharedCandidateSourceId))
      .map(({ id }) => id);
    const playtestRecordCounts = {
      scores: store.get(workspace.id).arrangementScoreIds.length,
      commitments: store.get(workspace.id).editorialCommitmentIds.length,
      familyCommitments: store.get(workspace.id).familyCommitmentIds.length,
    };
    const submitPlaytest = async (body: Record<string, unknown>) => {
      const response = (await (
        await fetch(`${playtestBase}/owner-playtests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            arrangement_event_ids: testedEventIds,
            playback_occurrence_ids: [occurrenceId],
            practice_context: "First pass at a slow practice tempo",
            confidence: 0.8,
            observations: [],
            proposed_consequences: [],
            ...body,
          }),
        })
      ).json()) as ApiResponse<{
        playtest: { id: string; proposedConsequences: string[] };
        readiness: { status: string };
      }>;
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    };
    expect(
      await submitPlaytest({
        evidence_basis: ["notation", "listening"],
        outcome: "not_tested",
        rationale: "Inspected and listened, but did not yet put the passage under the fingers.",
      })
    ).toMatchObject({ readiness: { status: "playtest_available" } });
    expect(
      await submitPlaytest({
        tempo_bpm: 72,
        evidence_basis: ["physical_playing"],
        outcome: "practice_playable",
        observations: [
          {
            dimension: "technique",
            code: "shift_reliability",
            outcome: "concern",
            rationale: "The shift succeeds reliably after slow isolated practice.",
          },
          {
            dimension: "identity",
            code: "source_identity",
            outcome: "supports",
            rationale: "The principal voice remains immediately recognizable.",
          },
        ],
        rationale: "Physically playable in the declared practice context.",
      })
    ).toMatchObject({ readiness: { status: "owner_tested" } });
    const blockedPlaytest = await submitPlaytest({
      candidate_id: result.arrangementScore.selectedCandidateId,
      tempo_bpm: 72,
      evidence_basis: ["physical_playing"],
      outcome: "unplayable",
      observations: [
        {
          dimension: "mechanics",
          code: "reach",
          outcome: "blocks",
          rationale: "The required stopped-course span cannot be held in this context.",
        },
        {
          dimension: "notation",
          code: "notation",
          outcome: "concern",
          rationale: "The fingering display does not make the release point clear.",
        },
      ],
      proposed_consequences: ["correction", "ergonomic_profile", "fixture_nomination"],
      rationale: "This exact passage is not physically executable on the tested instrument.",
    });
    expect(blockedPlaytest).toMatchObject({
      playtest: {
        proposedConsequences: ["correction", "ergonomic_profile", "fixture_nomination"],
      },
      readiness: { status: "blocked" },
    });
    const alternativePlaytest = await submitPlaytest({
      candidate_id: alternative.id,
      tempo_bpm: 72,
      evidence_basis: ["physical_playing"],
      outcome: "practice_playable",
      observations: [
        {
          dimension: "mechanics",
          code: "reach",
          outcome: "supports",
          rationale: "This alternative avoids the blocking reach in the same context.",
        },
      ],
      rationale: "The comparison alternative was physically tested in the same context.",
    });
    const afterPlaytests = store.get(workspace.id);
    expect(afterPlaytests.arrangementScoreIds).toHaveLength(playtestRecordCounts.scores);
    expect(afterPlaytests.editorialCommitmentIds).toHaveLength(playtestRecordCounts.commitments);
    expect(afterPlaytests.familyCommitmentIds).toHaveLength(playtestRecordCounts.familyCommitments);
    expect(afterPlaytests.ownerPlaytestIds).toHaveLength(4);
    const protocolDefinition = createFirstLoopRegistry().definitions.find(
      (definition) => definition.id === "protocol.first-loop-human"
    )!;
    const comparisonSourceEventIds = [sharedCandidateSourceId];
    const candidateContext = (candidate: (typeof result.candidates)[number]) => ({
      candidateRef: { id: candidate.id, version: 1, digest: digestValue(candidate) },
      arrangementSearchRef: {
        id: result.arrangementSearch.id,
        version: 1,
        digest: digestValue(result.arrangementSearch),
      },
      performanceBriefRef: {
        id: result.performanceBrief.id,
        version: 1,
        digest: digestValue(result.performanceBrief),
      },
      instrumentInstanceDigest: digestInstrumentInstance(
        result.arrangementSearch.targetConfiguration.instrumentInstance!
      ),
      candidateEventIds: candidate.events
        .filter((event) => event.sourceEventIds.some((id) => comparisonSourceEventIds.includes(id)))
        .map(({ id }) => id),
      arrangementScoreEventIds: testedEventIds,
      sourceEventIds: comparisonSourceEventIds,
      playbackOccurrenceIds: [occurrenceId],
    });
    const humanEvaluation: HumanEvaluation = {
      id: "human-evaluation.29292929-2929-4929-8929-292929292929",
      protocolRef: {
        id: protocolDefinition.id,
        version: protocolDefinition.version,
        digest: digestValue(protocolDefinition),
      },
      reviewer: {
        pseudonymousId: "reviewer.target-player-1",
        role: "target_player",
        qualifications: ["Owner physically playing the declared five-course instrument"],
        confidence: 0.8,
        conflictsOfInterest: ["Owner requested and helped define the arrangement"],
        consented: true,
      },
      evidenceBasis: ["physical_playing"],
      ownerPlaytestIds: [blockedPlaytest.playtest.id, alternativePlaytest.playtest.id],
      pairwise: {
        left: candidateContext(
          result.candidates.find(
            (candidate) => candidate.id === result.arrangementScore.selectedCandidateId
          )!
        ),
        right: candidateContext(alternative),
        retainedRandomizationSeed: "seed.greensleeves.physical.1",
        presentedOrder: ["right", "left"],
        practicalBlindingApplied: true,
        blindingLimitations: "The tablature itself may reveal different fingering strategies.",
      },
      judgments: [
        {
          dimension: "physical_execution",
          rubricAnchorId: "rubric.physical-execution",
          preference: "right",
          rationale: "The right candidate removes the blocking reach under identical conditions.",
          citedEvidenceIds: [blockedPlaytest.playtest.id, alternativePlaytest.playtest.id],
        },
      ],
      conclusion: {
        status: "single_scoped_judgment",
        rationale: "One target-player preference is retained without an aggregate winner.",
      },
      learningDisposition: "scoped_judgment_only",
      regressionEligible: false,
      createdAt: "2026-07-10T16:40:00.000Z",
    };
    const evaluationStore = new EvaluationStore({
      rootDirectory: path.join(rootDirectory, "eval"),
    });
    expect(
      validateAndSaveHumanEvaluation({
        workspaceId: workspace.id,
        evaluation: humanEvaluation,
        protocolDefinition,
        workspaceStore: store,
        evaluationStore,
      })
    ).toEqual(humanEvaluation);
    expect(evaluationStore.getHumanEvaluation(humanEvaluation.id)).toEqual(humanEvaluation);
    expect(() =>
      validateAndSaveHumanEvaluation({
        workspaceId: workspace.id,
        evaluation: {
          ...humanEvaluation,
          id: "human-evaluation.30303030-3030-4030-8030-303030303030",
          reviewer: { ...humanEvaluation.reviewer, role: "owner_usability" },
        },
        protocolDefinition,
        workspaceStore: store,
        evaluationStore,
      })
    ).toThrow(/not authorized.*physical_execution/i);
    const staleTemplate = deferredScoreStaleness[0]!;
    store.saveStaleDerivation(workspace.id, {
      ...staleTemplate,
      id: "stale.77777777-7777-4777-8777-777777777777",
      acknowledged: false,
      createdAt: "2026-07-10T16:45:00.000Z",
    });
    expect(await (await fetch(`${playtestBase}/readiness`)).json()).toMatchObject({
      ok: true,
      data: {
        status: "stale",
        currentPlaytestIds: expect.arrayContaining(afterPlaytests.ownerPlaytestIds),
      },
    });
    const navigationResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/navigation`
    );
    const navigation = (await navigationResponse.json()) as ApiResponse<{
      families: Array<{ arrangements: Array<{ instrumentId: string }> }>;
    }>;
    if (!navigation.ok) throw new Error(navigation.error.message);
    expect(navigation.ok).toBe(true);
    expect(navigation.data.families).toHaveLength(1);
    expect(navigation.data.families[0]?.arrangements.map((item) => item.instrumentId)).toEqual(
      expect.arrayContaining(["baroque-guitar-5", "baroque-lute-13", "classical-guitar-6"])
    );
    const arrangementBeforeInterpretation = JSON.stringify(
      store.getArrangementScore(workspace.id, result.arrangementScore.id)
    );
    const interpretationBase = `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangements/${result.arrangementScore.id}/performance-interpretations`;
    const interpretationResponse = await fetch(interpretationBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        choices: {
          tempo: 84,
          arpeggiation_ms: 35,
          inequality: 0.12,
          articulation: 0.86,
          principal_voice_ornament: "upper_neighbor",
        },
        rationale: "A restrained dance-like reading for comparison with the literal preview.",
      }),
    });
    const interpretation = (await interpretationResponse.json()) as {
      ok: boolean;
      data: { id: string; version: number; arrangementScoreVersion: number };
    };
    expect(interpretation).toMatchObject({
      ok: true,
      data: { id: "interpretation.23232323-2323-4323-8323-232323232323", version: 1 },
    });
    const revisedInterpretationResponse = await fetch(interpretationBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_interpretation_id: interpretation.data.id,
        choices: {
          tempo: 88,
          arpeggiation_ms: 25,
          inequality: 0.08,
          articulation: 0.9,
          principal_voice_ornament: "none",
        },
        rationale: "A slightly more direct second reading.",
      }),
    });
    expect(await revisedInterpretationResponse.json()).toMatchObject({
      ok: true,
      data: {
        id: "interpretation.24242424-2424-4424-8424-242424242424",
        version: 2,
        parentInterpretationId: interpretation.data.id,
        arrangementScoreId: result.arrangementScore.id,
      },
    });
    const interpretationList = (await (await fetch(interpretationBase)).json()) as {
      ok: boolean;
      data: { literalIsDefault: boolean; staleReason?: string; interpretations: unknown[] };
    };
    expect(interpretationList).toMatchObject({
      ok: true,
      data: {
        literalIsDefault: true,
        staleReason: "Corrected source pitch",
        interpretations: expect.arrayContaining([
          expect.objectContaining({ id: interpretation.data.id }),
          expect.objectContaining({ version: 2, parentInterpretationId: interpretation.data.id }),
        ]),
      },
    });
    const interpretedPreview = (await (
      await fetch(`${interpretationBase}/${interpretation.data.id}/audio-preview`)
    ).json()) as { ok: boolean; data: { mode: string; interpretation: { id: string } } };
    expect(interpretedPreview).toMatchObject({
      ok: true,
      data: { mode: "interpreted", interpretation: { id: interpretation.data.id } },
    });
    expect(
      JSON.stringify(store.getArrangementScore(workspace.id, result.arrangementScore.id))
    ).toBe(arrangementBeforeInterpretation);
    const correctionResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/analyses/${result.analysis.id}/claims/${principalClaim.id}/corrections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: "The alto is the Owner-confirmed Principal Voice for this arrangement.",
          subjectIds: ["part.alto"],
          rationale: "The Owner identified the tune in the alto for this source.",
        }),
      }
    );
    const correctionEnvelope = (await correctionResponse.json()) as {
      ok: boolean;
      data: ReturnType<AnalysisService["correctClaim"]>;
    };
    expect(correctionEnvelope.ok).toBe(true);
    const correctedAnalysis = correctionEnvelope.data;
    expect(
      correctedAnalysis.passages
        ?.flatMap((passage) => passage.roles)
        .find((role) => role.partId === "part.alto")
    ).toMatchObject({ role: "principal_voice" });
    expect(
      correctedAnalysis.passages
        ?.flatMap((passage) => passage.roles)
        .find((role) => role.partId === "part.soprano")
    ).toMatchObject({ role: "accompaniment" });
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );

    const branched = service.branchFromCandidate(workspace.id, alternative.id);
    expect(branched.arrangementScore).toMatchObject({
      id: "arrangement.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      branchId: "branch.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      selectedCandidateId: alternative.id,
      events: alternative.events,
    });
    expect(store.getArrangementBranch(workspace.id, branched.branchId)).toMatchObject({
      createdFromCandidateId: alternative.id,
    });

    const commitmentContextEvent = result.arrangementScore.events.at(-1)!;
    const passageCommitment = lineage.createEditorialCommitment(workspace.id, {
      arrangementScoreId: result.arrangementScore.id,
      arrangementFamilyId: result.arrangementScore.arrangementFamilyId!,
      scope: { objectIds: [commitmentContextEvent.id], dimension: "notation" },
      value: { retain: "current notation semantics" },
      origin: "approved_model_choice",
    });
    const passageIds = result.arrangementScore.events.slice(0, 4).map((event) => event.id);
    const passageSearch = service.passageCandidates(
      workspace.id,
      result.arrangementScore.id,
      passageIds
    );
    expect(passageSearch.selectedEventIds).toEqual(passageIds);
    expect(passageSearch.passageSearch).toMatchObject({
      id: expect.stringMatching(/^passage-search\./),
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      arrangementScoreId: result.arrangementScore.id,
      arrangementScoreVersion: 1,
      arrangementPlanId: result.arrangementPlan.id,
      dependencyContext: {
        requestedEventIds: passageIds,
        expandedEventIds: passageSearch.expandedEventIds,
        incomingStateEventIds: [],
        outgoingStateEventIds: expect.not.arrayContaining(passageIds),
        harmonyEventIds: expect.any(Array),
        sustainedEventIds: expect.any(Array),
        phraseAndCadenceTargetIds: expect.any(Array),
        repeatMeasureIds: [result.arrangementScore.events[0]!.measureId],
        activeCommitmentIds: [passageCommitment.id],
        derivationEvidenceIds: expect.arrayContaining([result.analysis.id]),
      },
    });
    expect(passageSearch.expandedEventIds.length).toBeGreaterThan(passageIds.length);
    expect(passageSearch.expandedEventIds).toContain(commitmentContextEvent.id);
    expect(store.getPassageSearch(workspace.id, passageSearch.passageSearch.id)).toEqual(
      passageSearch.passageSearch
    );
    expect(
      new WorkspaceStore({ rootDirectory }).getPassageSearch(
        workspace.id,
        passageSearch.passageSearch.id
      )
    ).toEqual(passageSearch.passageSearch);
    expect(passageSearch.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceCandidateId: alternative.id,
          strategy: alternative.strategy,
          status: "survived",
          audit: expect.objectContaining({ status: "pass" }),
          passageSearchId: passageSearch.passageSearch.id,
          lineage: expect.objectContaining({
            requestedEventIds: passageIds,
            expandedEventIds: passageSearch.expandedEventIds,
            arrangementPlanId: result.arrangementPlan.id,
            sourceCandidateId: alternative.id,
          }),
        }),
      ])
    );
    const passageAlternative = passageSearch.candidates.find(
      (candidate) => candidate.sourceCandidateId === alternative.id
    )!;
    expect(passageAlternative.replacementEvents.map((event) => event.id)).toEqual(
      passageSearch.expandedEventIds
    );
    expect(() =>
      service.previewPassageCandidate(
        workspace.id,
        result.arrangementScore.id,
        passageIds,
        alternative.id,
        "passage-search.stale"
      )
    ).toThrow(/identity is stale or incompatible/);
    const beforePassagePreview = structuredClone(store.get(workspace.id));
    const passagePreview = service.previewPassageCandidate(
      workspace.id,
      result.arrangementScore.id,
      passageIds,
      alternative.id,
      passageSearch.passageSearch.id
    );
    expect(passagePreview.events.length).toBeGreaterThan(0);
    expect(store.get(workspace.id)).toEqual(beforePassagePreview);
    const priorScores = [...store.get(workspace.id).arrangementScoreIds];
    const adopted = service.adoptPassageCandidate(
      workspace.id,
      result.arrangementScore.id,
      passageIds,
      alternative.id,
      passageSearch.passageSearch.id
    );
    expect(adopted.arrangementScore).toMatchObject({
      id: "arrangement.eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      parentArrangementScoreId: result.arrangementScore.id,
      version: 2,
      selectedCandidateId: alternative.id,
    });
    expect(adopted.passageSearch).toEqual(passageSearch.passageSearch);
    expect(adopted.branchId).toBe("branch.dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(adopted.arrangementScore.preservationAudit.status).toBe("pass");
    expect(adopted.arrangementScore.transformationReport.length).toBeGreaterThan(0);
    expect(readiness(store, workspace.id, adopted.arrangementScore.id)).toMatchObject({
      status: "stale",
      currentPlaytestIds: [],
      stalePlaytestIds: expect.arrayContaining(afterPlaytests.ownerPlaytestIds),
    });
    expect(store.get(workspace.id).arrangementScoreIds).toEqual([
      ...priorScores,
      adopted.arrangementScore.id,
    ]);
    for (const originalEvent of result.arrangementScore.events.filter(
      (event) => !passageSearch.expandedEventIds.includes(event.id)
    )) {
      expect(
        adopted.arrangementScore.events.find((event) => event.id === originalEvent.id)
      ).toEqual(originalEvent);
    }

    expect(correctedAnalysis).toMatchObject({
      id: "analysis.cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      version: 2,
      principalVoicePartId: "part.alto",
      claims: expect.arrayContaining([
        expect.objectContaining({
          basis: "user_correction",
          correctedClaimId: principalClaim.id,
          confidence: 1,
        }),
      ]),
    });
    expect(
      correctedAnalysis.preservationTargets.find((target) => target.kind === "principal_voice")
    ).toMatchObject({ partId: "part.alto" });
    expect(store.getAnalysisRecord(workspace.id, result.analysis.id).version).toBe(1);

    const uncertainTranscription = {
      ...omr.scoreTranscription,
      id: "transcription.66666666-6666-4666-8666-666666666666",
      parentId: omr.scoreTranscription.id,
      version: 2,
      status: "needs_review" as const,
      uncertainties: [
        {
          id: "uncertainty.principal-pitch",
          eventIds: ["event.soprano.1"],
          critical: true,
          category: "pitch",
          message: "Principal Voice pitch is ambiguous",
          alternatives: ["B4", "Bb4"],
          resolved: false,
        },
      ],
    };
    store.saveScoreTranscription(workspace.id, uncertainTranscription);
    const uncertainScore = {
      ...omr.normalizedScore,
      id: "score.77777777-7777-4777-8777-777777777777",
      scoreTranscriptionId: uncertainTranscription.id,
      version: 2,
    };
    store.saveNormalizedScore(workspace.id, uncertainScore);
    expect(() =>
      new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
        normalizedScoreId: uncertainScore.id,
        targetConfigurationId: "target.baroque-guitar",
      })
    ).toThrowError(ApiRouteError);
    expect(() =>
      new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
        normalizedScoreId: uncertainScore.id,
        targetConfigurationId: "target.baroque-guitar",
      })
    ).toThrow("Score-Anchored Review is required");
    const blockedTruth = store
      .get(workspace.id)
      .sourceTruthAssessmentIds.map((id) => store.getSourceTruthAssessment(workspace.id, id))
      .find((assessment) => assessment.scoreTranscriptionId === uncertainTranscription.id);
    expect(blockedTruth).toMatchObject({
      outcome: "review_required",
      blockingUncertaintyIds: ["uncertainty.principal-pitch"],
      stability: { stable: false },
    });

    const priorScore = structuredClone(result.arrangementScore);
    const corrected = new ArrangementPlanService({
      store,
      createId: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      now: () => new Date("2026-07-12T18:00:00.000Z"),
    }).correct(
      workspace.id,
      result.arrangementPlan.id,
      {
        kind: "sectional_reduction",
        planningScope: result.arrangementPlan.planningScope,
        transpositionPlan: result.arrangementPlan.transpositionPlan,
        sectionalIntent: result.arrangementPlan.sectionalIntent.map((intent, index) =>
          index === 0 ? { ...intent, density: "reduce" as const } : intent
        ),
        materialDisposition: result.arrangementPlan.materialDisposition.map((item, index) =>
          index === 0 ? { ...item, disposition: "implied" as const } : item
        ),
        specialistIntent: { kind: "none" },
        decisions: result.arrangementPlan.decisions.map((decision, index) =>
          index === 0
            ? {
                ...decision,
                rationale: `${decision.rationale} Reduce the opening density.`,
                alternatives: [
                  {
                    value: "retain_source_structure",
                    consequence: "Keeps the full source density.",
                    viable: true,
                  },
                ],
                ambiguity: {
                  status: "material" as const,
                  description: "Either density is musically viable.",
                },
                confirmation: { requirement: "owner" as const, status: "proposed" as const },
              }
            : decision
        ),
        status: "confirmation_required",
      },
      "Owner corrected the Arrangement Plan"
    );
    expect(corrected.plan).toMatchObject({
      version: 2,
      supersedesPlanId: result.arrangementPlan.id,
      kind: "sectional_reduction",
      status: "confirmation_required",
    });
    expect(store.getArrangementPlan(workspace.id, result.arrangementPlan.id)).toEqual(
      result.arrangementPlan
    );
    expect(store.getArrangementScore(workspace.id, result.arrangementScore.id)).toEqual(priorScore);
    expect(
      corrected.staleDerivationIds
        .map((id) => store.getStaleDerivation(workspace.id, id))
        .some(
          (record) =>
            record.recordType === "arrangement_search" &&
            record.recordId === result.arrangementSearch.id
        )
    ).toBe(true);
  });
});
