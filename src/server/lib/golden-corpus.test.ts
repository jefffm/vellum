import { describe, expect, it, vi } from "vitest";
import {
  goldenGeneratorVisibleInput,
  loadGoldenCorpus,
  validateGoldenCandidate,
  validateGoldenCorpus,
  validatePrivateFixtureExport,
} from "./golden-corpus.js";

vi.mock("../../lib/tracked-source-quarantine.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/tracked-source-quarantine.js")>();
  return {
    ...actual,
    authorizeTrackedSourceOperation: (
      request: Parameters<typeof actual.authorizeTrackedSourceOperation>[0]
    ) => {
      if (
        request.artifactId === "fixture.private-substitution-source" &&
        request.sha256 === "c".repeat(64) &&
        (request.operation === "export" || request.operation === "fixture") &&
        request.substitutionId === "substitution.private.exact"
      ) {
        return {
          outcome: "allow" as const,
          artifactId: request.artifactId,
          artifactSha256: request.sha256,
          resolvedArtifactId: "fixture.private-substitution-target",
          resolvedSha256: "d".repeat(64),
          operation: request.operation,
          decisionId: `decision.private.${request.operation}.substitution`,
          substitutionId: request.substitutionId,
          provenanceEvidenceRefs: ["provenance.private.substitution"],
          reasons: [],
        };
      }
      return actual.authorizeTrackedSourceOperation(request);
    },
  };
});

describe("three-target Golden corpus", () => {
  it("retains licensed sources, reviewed truth, Analysis, Plans, invariants, and mutations", () => {
    const corpus = loadGoldenCorpus();
    expect(corpus.dataset).toMatchObject({ role: "held_out", privateWorkspaceExports: [] });
    expect(corpus.cases).toHaveLength(4);
    for (const evaluationCase of corpus.cases) {
      expect(evaluationCase.source).toMatchObject({
        license: expect.stringMatching(/Public Domain|CC0/),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        rightsArtifactId: expect.stringMatching(/^fixture\./),
      });
      expect(evaluationCase.reviewedTruth.facts.length).toBeGreaterThan(0);
      expect(evaluationCase.analysis.concepts.length).toBeGreaterThan(0);
      expect(evaluationCase.plans.length).toBeGreaterThan(0);
      expect(evaluationCase.invariants.length).toBeGreaterThan(0);
      expect(evaluationCase.mutations.length).toBeGreaterThan(0);
      expect(evaluationCase.acceptableAlternatives).toHaveLength(2);
    }
  });

  it("uses Greensleeves across all targets plus distinct target-specific cases", () => {
    const corpus = loadGoldenCorpus();
    const greensleeves = corpus.cases.find(({ id }) => id === "golden.greensleeves-cross-target")!;
    expect(greensleeves.plans.map(({ targetId }) => targetId).sort()).toEqual([
      "baroque-guitar-5",
      "baroque-lute-13",
      "classical-guitar-6",
    ]);
    expect(
      corpus.cases.find(({ id }) => id === "golden.baroque-lute-stopped-diapason")!.analysis
        .concepts
    ).toEqual(expect.arrayContaining(["stopped_course", "diapason", "course_identity"]));
    expect(
      corpus.cases.find(({ id }) => id === "golden.classical-guitar-polyphony")!.analysis.concepts
    ).toEqual(
      expect.arrayContaining([
        "counterpoint",
        "voice_duration",
        "left_hand_fingering",
        "standard_notation",
      ])
    );
  });

  it("accepts non-identical alternatives by invariant boundaries and rejects omissions", () => {
    const evaluationCase = loadGoldenCorpus().cases.find(
      ({ id }) => id === "golden.classical-guitar-polyphony"
    )!;
    const invariantIds = evaluationCase.invariants.map(({ id }) => id);
    expect(
      validateGoldenCandidate(evaluationCase, {
        satisfiedInvariantIds: invariantIds,
        referenceAlternativeId: "alternative.classical.open-position",
      })
    ).toMatchObject({ status: "pass", missingInvariantIds: [] });
    expect(
      validateGoldenCandidate(evaluationCase, {
        satisfiedInvariantIds: invariantIds,
        referenceAlternativeId: "alternative.classical.shifted-position",
      })
    ).toMatchObject({ status: "pass", missingInvariantIds: [] });
    expect(
      validateGoldenCandidate(evaluationCase, {
        satisfiedInvariantIds: ["classical.fingering-boundary"],
      })
    ).toMatchObject({
      status: "fail",
      missingInvariantIds: ["classical.polyphonic-duration"],
    });
  });

  it("rejects role leakage, missing target Plans, dangling mutations, and source drift", () => {
    const corpus = loadGoldenCorpus();
    const missingPlan = structuredClone(corpus);
    missingPlan.cases[0]!.plans = missingPlan.cases[0]!.plans.slice(0, 2);
    expect(() => validateGoldenCorpus(missingPlan)).toThrow(/all three targets|Plan/i);

    const danglingMutation = structuredClone(corpus);
    danglingMutation.cases[1]!.mutations[0]!.expectedInvariantIds = ["invariant.missing"];
    expect(() => validateGoldenCorpus(danglingMutation)).toThrow(/unknown invariant/i);

    const sourceDrift = structuredClone(corpus);
    sourceDrift.cases[2]!.source.sha256 = "a".repeat(64);
    expect(() => validateGoldenCorpus(sourceDrift)).toThrow(/digest mismatch/i);

    const unauthorized = structuredClone(corpus);
    unauthorized.cases[3]!.source.license = "Public Domain";
    unauthorized.cases[3]!.source.rightsArtifactId = "fixture.unknown-license-string-bypass";
    expect(() => validateGoldenCorpus(unauthorized)).toThrow(/not authorized for fixture/i);
    expect(() =>
      (
        validateGoldenCorpus as unknown as (
          corpus: typeof unauthorized,
          projectRoot: string,
          ignoredOptions: { authorize: () => { outcome: "allow" } }
        ) => void
      )(unauthorized, process.cwd(), { authorize: () => ({ outcome: "allow" }) })
    ).toThrow(/not authorized for fixture/i);
  });

  it("keeps held-out truth, Plans, invariants, mutations, and alternatives evaluator-side", () => {
    const visible = JSON.stringify(goldenGeneratorVisibleInput(loadGoldenCorpus().cases[0]!));
    for (const canary of [
      "reviewedTruth",
      "cadenceGoals",
      "decisions",
      "allowedTransformations",
      "mutation.greensleeves",
      "alternative.greensleeves",
    ]) {
      expect(visible).not.toContain(canary);
    }
  });

  it("requires deliberate licensed privacy-reviewed export before private evidence can enter", () => {
    expect(() =>
      validatePrivateFixtureExport({
        workspaceId: "workspace.private",
        contentSha256: "c".repeat(64),
        license: "CC0-1.0",
        reviewRef: "review.owner-export.1",
        deliberatelySelected: true,
      })
    ).toThrow();
    expect(
      validatePrivateFixtureExport({
        workspaceId: "workspace.private",
        contentSha256: "c".repeat(64),
        license: "CC0-1.0",
        reviewRef: "review.owner-export.1",
        deliberatelySelected: true,
        privacyReviewed: true,
        rightsArtifactId: "fixture.private-substitution-source",
        rightsSubstitutionId: "substitution.private.exact",
      })
    ).toMatchObject({
      deliberatelySelected: true,
      privacyReviewed: true,
      rightsSubstitutionId: "substitution.private.exact",
    });
    expect(() =>
      validatePrivateFixtureExport({
        workspaceId: "workspace.private",
        contentSha256: "c".repeat(64),
        license: "CC0-1.0",
        reviewRef: "review.owner-export.1",
        deliberatelySelected: true,
        privacyReviewed: true,
        rightsArtifactId: "fixture.private-substitution-source",
        rightsSubstitutionId: "substitution.private.forged",
      })
    ).toThrow(/not authorized for export/);

    const corpus = loadGoldenCorpus();
    corpus.cases[0]!.source.origin = "Owner workspace private export";
    expect(() => validateGoldenCorpus(corpus)).toThrow(/deliberate licensed export/i);
  });
});
