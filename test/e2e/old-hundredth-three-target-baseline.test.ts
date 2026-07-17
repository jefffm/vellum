import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditFaithfulPrincipalVoice } from "../../src/lib/baroque-guitar-arranger.js";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { OmrService, type OmrBackend } from "../../src/server/lib/omr.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

const roots: string[] = [];

describe("Old 100th non-Greensleeves three-target baseline", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("runs the exact public SATB source through three independent target searches", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "vellum-old-hundredth-"));
    roots.push(rootDirectory);
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Old 100th three-target baseline",
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
    const fixtureRoot = path.resolve(process.cwd(), "test/fixtures/old-hundredth");
    const pdf = readFileSync(path.join(fixtureRoot, "old-hundredth-satb.pdf"));
    const source = store.addSourceArtifact(workspace.id, {
      filename: "old-hundredth-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: {
        license: "Public Domain",
        catalogUrl: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=194",
      },
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(path.join(fixtureRoot, "old-hundredth-satb.ly"), "utf8"),
      ["sop", "alt", "ten", "bass"]
    );
    const backend: OmrBackend = {
      id: "reviewed-old-hundredth",
      recognize: async () => ({
        backend: { id: "reviewed-old-hundredth", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: { ...parsed, uncertainties: [] },
      }),
    };
    const recognized = await new OmrService({ store }).recognize(workspace.id, source.id, backend);
    const service = new ArrangementService({ store });
    const results = workspace.brief.targetConfigurations.map((target) =>
      service.createFaithfulReduction(workspace.id, {
        normalizedScoreId: recognized.normalizedScore.id,
        targetConfigurationId: target.id,
      })
    );

    expect(results).toHaveLength(3);
    expect(new Set(results.map(({ analysisRecordId }) => analysisRecordId)).size).toBe(1);
    for (const result of results) {
      expect(result.arrangementScore.preservationAudit.status).toBe("pass");
      expect(
        result.arrangementScore.events.some(
          ({ principalVoiceSourceEventId }) => principalVoiceSourceEventId
        )
      ).toBe(true);
      expect(result.arrangementSearch.normalizedScoreId).toBe(recognized.normalizedScore.id);

      const firstPrincipal = result.arrangementScore.events.find(
        ({ principalVoiceSourceEventId }) => principalVoiceSourceEventId
      )!;
      const mutationAudit = auditFaithfulPrincipalVoice(
        recognized.normalizedScore,
        store.getAnalysisRecord(workspace.id, result.analysisRecordId),
        result.arrangementScore.events.filter(({ id }) => id !== firstPrincipal.id),
        result.arrangementScore.transpositionPlan.semitones
      );
      expect(mutationAudit.status).toBe("fail");
      expect(mutationAudit.findings.some(({ code }) => code === "principal.omitted")).toBe(true);
    }

    const observations = results.map((result) => {
      const instrumentId = result.arrangementScore.targetConfiguration.instrumentId;
      const voiceIds = [
        ...new Set(
          result.arrangementScore.events.flatMap((event) =>
            (event.voiceConstituents ?? []).map(({ voiceId }) => voiceId)
          )
        ),
      ];
      const techniques = [
        ...new Set(
          result.candidates.flatMap(
            ({ phraseSearchEvidence }) =>
              phraseSearchEvidence?.transitions.map(({ technique }) => technique) ?? []
          )
        ),
      ];
      const maxStoppedCourseFretDelta = Math.max(
        ...result.candidates.flatMap(
          ({ phraseSearchEvidence }) =>
            phraseSearchEvidence?.transitions.map(
              ({ stoppedCourseFretDelta }) => stoppedCourseFretDelta ?? 0
            ) ?? []
        )
      );
      const knownDefects = [
        ...(instrumentId === "baroque-guitar-5" &&
        techniques.length === 1 &&
        techniques[0] === "punteado"
          ? ["baroque_guitar.single_generic_punteado_technique"]
          : []),
        ...(instrumentId === "baroque-guitar-5" && voiceIds.length === 0
          ? ["baroque_guitar.no_explicit_subordinate_voice_lineage"]
          : []),
        ...(instrumentId === "baroque-lute-13" && maxStoppedCourseFretDelta >= 5
          ? ["baroque_lute.five_fret_stopped_course_delta"]
          : []),
        ...(instrumentId === "baroque-lute-13" && voiceIds.length === 0
          ? ["baroque_lute.no_explicit_subordinate_voice_lineage"]
          : []),
        ...(instrumentId === "classical-guitar-6" &&
        result.candidates.some(
          ({ phraseSearchEvidence }) =>
            phraseSearchEvidence?.classicalTechniqueEvidence?.rightHandScope === "unknown"
        )
          ? ["classical_guitar.right_hand_unmodeled"]
          : []),
        ...(instrumentId === "classical-guitar-6"
          ? ["classical_guitar.bass_phrase_coherence_unevaluated"]
          : []),
      ];
      return {
        instrumentId,
        events: result.arrangementScore.events.length,
        voiceIds,
        techniques,
        maxStoppedCourseFretDelta,
        knownDefects,
      };
    });
    expect(observations.flatMap(({ knownDefects }) => knownDefects).sort()).toEqual([
      "baroque_guitar.no_explicit_subordinate_voice_lineage",
      "baroque_guitar.single_generic_punteado_technique",
      "baroque_lute.five_fret_stopped_course_delta",
      "baroque_lute.no_explicit_subordinate_voice_lineage",
      "classical_guitar.bass_phrase_coherence_unevaluated",
      "classical_guitar.right_hand_unmodeled",
    ]);

    if (process.env.VELLUM_PRINT_MUSICAL_PROOF_BASELINE === "1") {
      process.stderr.write(
        `${JSON.stringify({ fixture: "old-hundredth", observations }, null, 2)}\n`
      );
    }
  });
});
