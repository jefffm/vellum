import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { digestValue } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { OwnerStore } from "./owner-store.js";
import { ReviewedLearningService } from "./reviewed-learning.js";
import { acceptReviewedOwnerDefault } from "./reviewed-owner-default-bridge.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("reviewed calibration and learning", () => {
  it("keeps proposals inert, routes acceptance through authority, and isolates evaluator datasets", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-reviewed-learning-"));
    roots.push(root);
    const evaluationStore = new EvaluationStore({ rootDirectory: path.join(root, "eval") });
    const ownerStore = new OwnerStore({
      rootDirectory: path.join(root, "owner"),
      now: () => new Date("2026-07-10T19:00:00.000Z"),
      createId: sequence(),
    });
    const service = new ReviewedLearningService({
      evaluationStore,
      ownerStore,
      now: () => new Date("2026-07-10T19:00:00.000Z"),
      createId: sequence(),
    });
    const defaultProposal = service.propose({
      kind: "personal_default",
      targetScope: ["target.baroque-guitar"],
      evidence: [evidence("choice.1", "recurring_choice", "supporting", "monitoring")],
      rationale: "The same explicit Owner choice recurred.",
      proposedValue: {
        dimension: "stringing",
        value: "french",
        scope: { instrument: "baroque-guitar-5" },
      },
      reviewBoundary: "owner_personal_default",
    });
    expect(ownerStore.listDefaultCandidates()).toEqual([]);
    const beforeReject = readFileSync(
      path.join(root, "eval", "reviewed-learning-proposals", `${defaultProposal.id}.json`),
      "utf8"
    );
    const rejection = service.reject({
      proposalId: defaultProposal.id,
      reviewerRole: "owner",
      rationale: "Do not generalize this choice.",
    });
    expect(rejection).toMatchObject({ decision: "rejected" });
    expect(rejection).not.toHaveProperty("outputRef");
    expect(ownerStore.listDefaultCandidates()).toEqual([]);
    expect(
      readFileSync(
        path.join(root, "eval", "reviewed-learning-proposals", `${defaultProposal.id}.json`),
        "utf8"
      )
    ).toBe(beforeReject);

    const acceptedDefault = service.propose({
      ...defaultProposal,
      evidence: [evidence("choice.2", "recurring_choice", "supporting", "monitoring")],
    });
    expect(() =>
      service.accept({
        proposalId: acceptedDefault.id,
        reviewerRole: "evaluation_maintainer",
        rationale: "Wrong authority.",
      })
    ).toThrow(/cannot accept/);
    const defaultAcceptance = service.accept({
      proposalId: acceptedDefault.id,
      reviewerRole: "owner",
      rationale: "Create a Personal Default Candidate for separate approval.",
    });
    expect(defaultAcceptance.output).toMatchObject({ status: "proposed" });
    expect(ownerStore.listDefaultCandidates()).toHaveLength(1);
    expect(ownerStore.listDefaults()).toEqual([]);

    expect(() =>
      acceptReviewedOwnerDefault(ownerStore, {
        proposalId: acceptedDefault.id,
        proposalKind: "personal_default",
        reviewBoundary: "owner_personal_default",
        reviewerRole: "evaluation_maintainer",
        dimension: "stringing",
        value: "french",
        scope: { instrument: "baroque-guitar-5" },
        evidenceChoiceIds: ["choice.2"],
      })
    ).toThrow(/explicit Owner review boundary/);
    expect(ownerStore.listDefaultCandidates()).toHaveLength(1);

    const reference = ownerStore.addReference({
      title: "Reviewed facsimile note",
      citation: "Public-domain source, folio 1",
      mimeType: "text/plain",
      contentBase64: Buffer.from("historical evidence").toString("base64"),
    });
    expect(reference).toMatchObject({
      authorityState: "raw_staged",
      activationAllowed: false,
    });
    const knowledge = service.propose({
      kind: "knowledge_candidate",
      targetScope: ["baroque-guitar-5"],
      evidence: [evidence("human.knowledge", "human_evaluation", "supporting", "development")],
      rationale: "A cited specialist judgment may warrant a Knowledge Candidate.",
      proposedValue: {
        statement: "The source uses the declared tablature convention.",
        referenceId: reference.id,
        citationLocator: "folio 1",
        scope: {
          period: "seventeenth century",
          region: "France",
          genre: "solo song arrangement",
          instrument: "baroque-guitar-5",
          ensembleRole: "solo",
        },
      },
      reviewBoundary: "historical_specialist_knowledge",
    });
    expect(() =>
      service.accept({
        proposalId: knowledge.id,
        reviewerRole: "historical_specialist",
        rationale: "Create a cited Knowledge Candidate; do not promote Historical Knowledge yet.",
      })
    ).toThrow(/quarantined for inspection only/i);
    expect(ownerStore.listKnowledgeCandidates()).toEqual([]);
    expect(ownerStore.listClaims()).toEqual([]);

    const ergonomic = service.propose({
      kind: "owner_ergonomic_profile",
      targetScope: ["owner", "baroque-guitar-5"],
      evidence: [evidence("playtest.ergonomic", "owner_playtest", "supporting", "monitoring")],
      rationale: "Recurring exact-context reaches suggest a personal profile candidate.",
      proposedValue: {
        payload: { maximumComfortableSpan: 3 },
        license: "Private Owner data",
        privateExportReviewed: false,
      },
      reviewBoundary: "owner_ergonomic_profile",
    });
    expect(
      service.accept({
        proposalId: ergonomic.id,
        reviewerRole: "owner",
        rationale: "Retain only as a personal ergonomic candidate.",
      }).output
    ).toMatchObject({ kind: "owner_ergonomic_profile", status: "candidate" });

    const fixture = service.propose({
      kind: "golden_fixture",
      targetScope: ["case.private"],
      evidence: [evidence("workspace.private", "owner_usefulness", "supporting", "held_out")],
      rationale: "Nominate private evidence without exporting it automatically.",
      proposedValue: {
        payload: { caseId: "case.private" },
        license: "Owner-controlled",
        privateExportReviewed: false,
      },
      reviewBoundary: "fixture_maintainer_export",
    });
    expect(() =>
      service.accept({
        proposalId: fixture.id,
        reviewerRole: "fixture_maintainer",
        rationale: "Attempt export without explicit private review.",
      })
    ).toThrow(/private workspace evidence/i);

    const calibration = service.propose({
      kind: "evaluator_calibration",
      targetScope: ["baroque-guitar-5"],
      evidence: [
        evidence("evaluation.1", "prediction_disagreement", "conflicting", "fitting"),
        evidence("evaluation.2", "human_evaluation", "supporting", "held_out"),
        evidence("evaluation.3", "owner_playtest", "supporting", "development"),
        evidence("evaluation.4", "owner_usefulness", "conflicting", "monitoring"),
      ],
      rationale: "Prediction and physical evidence disagree under the exact target scope.",
      proposedValue: { knownLimitations: ["No claim outside five-course baroque guitar"] },
      reviewBoundary: "evaluation_maintainer_calibration",
    });
    const oldEvidenceBytes = readFileSync(
      path.join(root, "eval", "reviewed-learning-proposals", `${calibration.id}.json`),
      "utf8"
    );
    const accepted = service.accept({
      proposalId: calibration.id,
      reviewerRole: "evaluation_maintainer",
      rationale: "Create a new evaluator revision without rewriting prior evidence.",
    });
    expect(accepted.output).toMatchObject({
      version: 2,
      fittingInputRefs: [expect.objectContaining({ id: "evaluation.1" })],
      heldOutInputRefs: [expect.objectContaining({ id: "evaluation.2" })],
      historicalDisagreementRefs: [expect.objectContaining({ id: "evaluation.1" })],
    });
    expect(
      readFileSync(
        path.join(root, "eval", "reviewed-learning-proposals", `${calibration.id}.json`),
        "utf8"
      )
    ).toBe(oldEvidenceBytes);
    const manifest = evaluationStore.getEvaluatorDatasetManifest(
      (accepted.output as { datasetManifestRef: { id: string } }).datasetManifestRef.id
    );
    expect(
      evaluationStore.getGeneratorVisibleCalibrationInputs(manifest.id).map((x) => x.role)
    ).toEqual(["fitting", "development"]);
    expect(evaluationStore.getGeneratorVisibleCalibrationInputs(manifest.id)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "held_out" })])
    );
    expect(() =>
      evaluationStore.saveEvaluatorDatasetManifest({
        ...manifest,
        id: "evaluator-dataset.moved-without-invalidation",
        version: 2,
        supersedesManifestRef: {
          id: manifest.id,
          version: manifest.version,
          digest: digestValue(manifest),
        },
        assignments: manifest.assignments.map((assignment, index) =>
          index === 0 ? { ...assignment, role: "held_out" as const } : assignment
        ),
      })
    ).toThrow(/invalidate incompatible comparisons/);
    expect(
      evaluationStore.saveEvaluatorDatasetManifest({
        ...manifest,
        id: "evaluator-dataset.moved-with-invalidation",
        version: 2,
        supersedesManifestRef: {
          id: manifest.id,
          version: manifest.version,
          digest: digestValue(manifest),
        },
        incompatibleComparisonIds: ["comparison.prior-evaluator"],
        assignments: manifest.assignments.map((assignment, index) =>
          index === 0 ? { ...assignment, role: "held_out" as const } : assignment
        ),
      })
    ).toMatchObject({ version: 2, incompatibleComparisonIds: ["comparison.prior-evaluator"] });
    expect(() =>
      evaluationStore.saveEvaluatorRevision({
        ...(accepted.output as any),
        id: "evaluator-revision.overlap",
        heldOutInputRefs: (accepted.output as any).fittingInputRefs,
      })
    ).toThrow(/disjoint/);
  });
});

function evidence(
  id: string,
  kind:
    | "prediction_disagreement"
    | "human_evaluation"
    | "owner_playtest"
    | "recurring_choice"
    | "owner_usefulness",
  relation: "supporting" | "conflicting",
  datasetRole: "fitting" | "development" | "held_out" | "monitoring"
) {
  const evaluator = { id: "evaluator.playability", version: 1 };
  return {
    ref: { id, version: 1, digest: digestValue({ id, version: 1 }) },
    kind,
    relation,
    datasetRole,
    evaluatorRef: { ...evaluator, digest: digestValue(evaluator) },
    privateWorkspaceEvidence: true,
  };
}

function sequence() {
  let next = 0;
  return () => `${String(++next).padStart(8, "0")}-0000-4000-8000-000000000000`;
}
