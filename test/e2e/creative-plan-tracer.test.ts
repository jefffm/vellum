import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { ArrangementPlanService } from "../../src/server/lib/arrangement-plan-service.js";
import { OmrService, type OmrBackend } from "../../src/server/lib/omr.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

describe("creative proportional Plan tracer", () => {
  let rootDirectory: string;

  afterEach(() => rmSync(rootDirectory, { recursive: true, force: true }));

  it("turns explicit free paraphrase into confirmed creative design and distinct candidates", async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-creative-plan-"));
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Creative Greensleeves",
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
        ],
      },
    });
    const source = store.addSourceArtifact(workspace.id, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
      ).toString("base64"),
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
      id: "creative-fixture",
      recognize: async () => ({
        backend: { id: "creative-fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: { ...parsed, uncertainties: [] },
      }),
    };
    const omr = await new OmrService({ store }).recognize(workspace.id, source.id, backend);

    const arranged = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-guitar",
      preservationPolicy: "free_paraphrase",
    });

    expect(arranged.arrangementPlan).toMatchObject({
      kind: "creative_arrangement",
      preservationPolicy: "free_paraphrase",
      specialistIntent: {
        kind: "creative_arrangement",
        candidateStrategies: ["ornamented-paraphrase", "idiomatic-revoicing"],
      },
      status: "ready",
    });
    const decision = arranged.arrangementPlan.decisions.find(
      (candidate) => candidate.dimension === "creative_design"
    );
    expect(decision).toMatchObject({
      alternatives: [expect.objectContaining({ value: "idiomatic_revoicing", viable: true })],
      confirmation: { requirement: "owner", status: "confirmed" },
      policyConsequence: { preservationPolicy: "free_paraphrase" },
    });
    expect(arranged.arrangementPlan.materialDisposition).toContainEqual(
      expect.objectContaining({ disposition: "generated" })
    );
    expect(arranged.candidates.map((candidate) => candidate.strategy).sort()).toEqual([
      "idiomatic-revoicing",
      "ornamented-paraphrase",
    ]);
    expect(arranged.candidates[0]!.events).not.toEqual(arranged.candidates[1]!.events);
    expect(arranged.arrangementScore.arrangementPlanId).toBe(arranged.arrangementPlan.id);
    expect(arranged.arrangementScore.preservationPolicy).toBe("free_paraphrase");

    const intent = arranged.arrangementPlan.specialistIntent;
    if (intent.kind !== "creative_arrangement") throw new Error("Expected creative intent");
    const corrected = new ArrangementPlanService({
      store,
      createId: () => "11111111-1111-4111-8111-111111111111",
    }).correct(
      workspace.id,
      arranged.arrangementPlan.id,
      {
        kind: "creative_arrangement",
        planningScope: arranged.arrangementPlan.planningScope,
        transpositionPlan: arranged.arrangementPlan.transpositionPlan,
        sectionalIntent: arranged.arrangementPlan.sectionalIntent,
        materialDisposition: arranged.arrangementPlan.materialDisposition,
        specialistIntent: {
          ...intent,
          candidateStrategies: ["idiomatic-revoicing"],
        },
        decisions: arranged.arrangementPlan.decisions.map((candidate) =>
          candidate.dimension === "creative_design"
            ? { ...candidate, selectedValue: "idiomatic_revoicing" }
            : candidate
        ),
        status: "ready",
      },
      "Owner selected the materially different idiomatic-revoicing Plan"
    );
    const replanned = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-guitar",
      preservationPolicy: "free_paraphrase",
      arrangementPlanId: corrected.plan.id,
    });
    expect(replanned.arrangementPlan.id).toBe(corrected.plan.id);
    expect(replanned.candidates).toHaveLength(1);
    expect(replanned.candidates[0]!.strategy).toBe("idiomatic-revoicing");
    expect(replanned.arrangementScore.events).not.toEqual(arranged.arrangementScore.events);
  });
});
