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
      weightedTotal: expect.any(Number),
    });
    const rankedCandidates = result.candidates
      .filter((candidate) => candidate.rank)
      .sort((left, right) => left.rank! - right.rank!);
    expect(rankedCandidates[0]?.evaluation?.weightedTotal).toBeGreaterThanOrEqual(
      rankedCandidates[1]?.evaluation?.weightedTotal ?? 0
    );
    expect(rankedCandidates[0]?.status).toBe("selected");
    expect(result.arrangementScore.selectedCandidateId).toBe(rankedCandidates[0]?.id);
    expect(result.arrangementScore.events).toEqual(rankedCandidates[0]?.events);
    const reloadedStore = new WorkspaceStore({ rootDirectory });
    expect(reloadedStore.getArrangementSearch(workspace.id, result.arrangementSearch.id)).toEqual(
      result.arrangementSearch
    );
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
      intendedUse: "study",
      tempoContext: { status: "not_specified" },
      difficultyIntent: "intermediate",
      reliabilityGoal: "repeatable",
    });
    expect(result.arrangementPlan).toMatchObject({
      kind: "minimal_projection",
      status: "applicable_without_consequential_choice",
      targetConfigurationId: "target.baroque-guitar",
    });
    expect(result.arrangementScore.arrangementPlanId).toBe(result.arrangementPlan.id);
    expect(result.arrangementScore.realizedPlanDecisionIds).toEqual(
      result.arrangementPlan.decisions.map((decision) => decision.id)
    );
    const evaluationCard = buildNarrowEvaluationCard({
      score: result.arrangementScore,
      planning: {
        sourceTruthAssessment: result.sourceTruthAssessment,
        performanceBrief: result.performanceBrief,
        arrangementPlan: result.arrangementPlan,
      },
      deliverableIds: [],
    });
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
    expect(store.get(workspace.id).arrangementScoreIds).toEqual([result.arrangementScore.id]);

    const luteResult = service.createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-lute",
    });
    expect(luteResult.analysisRecordId).toBe(result.analysisRecordId);
    expect(luteResult.arrangementScore).toMatchObject({
      id: "arrangement.88888888-8888-4888-8888-888888888888",
      targetConfiguration: { instrumentId: "baroque-lute-13", tuningId: "d_minor" },
      preservationAudit: { status: "pass" },
    });

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
      editorialCommitmentIds: [directEdit.editorialCommitment.id],
    });
    expect(directEdit.editorialCommitment).toMatchObject({
      origin: "user_edit",
      status: "active",
      scope: {
        objectIds: [protectedEvent.id],
        dimension: "course_fingering",
      },
    });

    const editableChords = result.arrangementScore.events
      .filter((event) => event.positions.length > 1)
      .slice(0, 2);
    expect(editableChords).toHaveLength(2);
    const beforeBatch = store.get(workspace.id);
    const branchCount = beforeBatch.arrangementBranchIds.length;
    const arrangementCount = beforeBatch.arrangementScoreIds.length;
    const commitmentCount = beforeBatch.editorialCommitmentIds.length;
    const batch = lineage.editArrangementEvents(
      workspace.id,
      result.arrangementScore.id,
      editableChords.map((event) => ({
        eventId: event.id,
        patch: { positions: event.positions.slice().reverse() },
      }))
    );
    expect(batch.arrangementScore).toMatchObject({
      version: 2,
      parentArrangementScoreId: result.arrangementScore.id,
      branchId: batch.branch.id,
      preservationAudit: { status: "pass" },
    });
    expect(batch.editorialCommitments).toHaveLength(2);
    expect(new Set(batch.editorialCommitments.map((item) => item.scope.objectIds[0]))).toEqual(
      new Set(editableChords.map((event) => event.id))
    );
    const afterBatch = store.get(workspace.id);
    expect(afterBatch.arrangementBranchIds).toHaveLength(branchCount + 1);
    expect(afterBatch.arrangementScoreIds).toHaveLength(arrangementCount + 1);
    expect(afterBatch.editorialCommitmentIds).toHaveLength(commitmentCount + 2);
    expect(
      store.getArrangementFamily(workspace.id, result.arrangementScore.arrangementFamilyId!)
        .arrangementScoreIds
    ).toEqual(expect.arrayContaining([result.arrangementScore.id, batch.arrangementScore.id]));
    expect(store.getArrangementScore(workspace.id, result.arrangementScore.id)).toEqual(
      result.arrangementScore
    );

    const beforeStretchPreview = store.get(workspace.id);
    const stretchPreview = lineage.validateArrangementEvents(
      workspace.id,
      result.arrangementScore.id,
      [
        {
          eventId: editableChords[0]!.id,
          patch: {
            positions: [
              { course: 1, fret: 1, pitch: "F4", quality: "low_fret" },
              { course: 5, fret: 6, pitch: "D#4", quality: "high_fret" },
            ],
          },
        },
      ]
    );
    expect(stretchPreview).toMatchObject({
      valid: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          eventIds: [editableChords[0]!.id],
          severity: "hard",
          category: "instrument",
          code: "instrument.stretch",
          message: "Fret span 5 exceeds maximum stretch 3",
        }),
      ]),
    });
    expect(store.get(workspace.id)).toMatchObject({
      arrangementBranchIds: beforeStretchPreview.arrangementBranchIds,
      arrangementScoreIds: beforeStretchPreview.arrangementScoreIds,
      editorialCommitmentIds: beforeStretchPreview.editorialCommitmentIds,
    });

    const beforeRejectedBatch = store.get(workspace.id);
    expect(() =>
      lineage.editArrangementEvents(workspace.id, result.arrangementScore.id, [
        {
          eventId: editableChords[0]!.id,
          patch: { positions: editableChords[0]!.positions.slice().reverse() },
        },
        {
          eventId: editableChords[0]!.id,
          patch: { positions: editableChords[0]!.positions },
        },
      ])
    ).toThrow(/same event dimension/i);
    expect(store.get(workspace.id)).toMatchObject({
      arrangementBranchIds: beforeRejectedBatch.arrangementBranchIds,
      arrangementScoreIds: beforeRejectedBatch.arrangementScoreIds,
      editorialCommitmentIds: beforeRejectedBatch.editorialCommitmentIds,
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

    const passageIds = result.arrangementScore.events.slice(0, 4).map((event) => event.id);
    const passageSearch = service.passageCandidates(
      workspace.id,
      result.arrangementScore.id,
      passageIds
    );
    expect(passageSearch.selectedEventIds).toEqual(passageIds);
    expect(passageSearch.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceCandidateId: alternative.id,
          strategy: alternative.strategy,
          status: "survived",
          audit: expect.objectContaining({ status: "pass" }),
        }),
      ])
    );
    const passageAlternative = passageSearch.candidates.find(
      (candidate) => candidate.sourceCandidateId === alternative.id
    )!;
    expect(passageAlternative.replacementEvents.map((event) => event.id)).toEqual(passageIds);
    const passagePreview = service.previewPassageCandidate(
      workspace.id,
      result.arrangementScore.id,
      passageIds,
      alternative.id
    );
    expect(passagePreview.events.length).toBeGreaterThan(0);
    const priorScores = [...store.get(workspace.id).arrangementScoreIds];
    const adopted = service.adoptPassageCandidate(
      workspace.id,
      result.arrangementScore.id,
      passageIds,
      alternative.id
    );
    expect(adopted.arrangementScore).toMatchObject({
      id: "arrangement.eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      parentArrangementScoreId: result.arrangementScore.id,
      version: 2,
      selectedCandidateId: alternative.id,
    });
    expect(adopted.branchId).toBe("branch.dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(store.get(workspace.id).arrangementScoreIds).toEqual([
      ...priorScores,
      adopted.arrangementScore.id,
    ]);
    for (const originalEvent of result.arrangementScore.events.slice(4)) {
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
  });
});
