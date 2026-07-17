import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { referenceSourceDigest } from "../../src/lib/reference-source-domain.js";
import {
  KnowledgeResolutionService,
  validateKnowledgeResolutionProjection,
} from "../../src/server/lib/knowledge-resolution-service.js";
import { runFirstLoopEvaluation } from "../../src/server/lib/first-loop-evaluation.js";
import { createT14KnowledgeResolutionFixture } from "../support/t14-knowledge-resolution-fixture.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T16 honest nonhistorical default test isolation", () => {
  it("keeps synthetic authority review-required for ordinary Guided Start", () => {
    const service = fixture();
    const ordinary = service.preview(request("ordinary_default"));

    expect(ordinary.activationDecisions).toEqual([
      expect.objectContaining({
        result: "review_required",
        rationaleCode: "maintainer_attestation_required_for_ordinary_default",
      }),
    ]);
    expect(ordinary.authorityReadiness).toEqual({
      schemaVersion: 1,
      authorityLane: "human_maintainer",
      authorityState: "review_required",
      activationState: "blocked",
      releaseState: "provisional",
      qualificationState: "ineligible",
      readinessState: "not_claimed",
      historicalPresentation: "unclaimed",
      syntheticEvidencePresent: true,
      reasonCode: "real_scope_limited_maintainer_attestation_required",
    });
    expect(ordinary.consequences).toEqual([]);
    expect(ordinary.ordinaryActivation).toBe(false);
    expect(ordinary.readinessClaim).toBe(false);
  });

  it.each(["provisional_research", "isolated_evaluation"] as const)(
    "permits one visibly test-only consequence in %s without qualification or readiness",
    (mode) => {
      const projection = fixture().preview(request(mode));
      expect(projection.activationDecisions).toEqual([
        expect.objectContaining({
          result: "allow",
          authority: expect.objectContaining({ kind: "test_only", permittedUse: mode }),
        }),
      ]);
      expect(projection.consequences).toHaveLength(1);
      expect(projection.consequences[0]).toMatchObject({
        presentation: "provisional_research_only",
        readinessClaim: false,
      });
      expect(projection.authorityReadiness).toMatchObject({
        authorityLane: "test_only",
        authorityState: "test_only_no_authority",
        activationState: mode === "provisional_research" ? "provisional_only" : "isolated_only",
        qualificationState: "ineligible",
        readinessState: "not_claimed",
        historicalPresentation: "unclaimed",
        syntheticEvidencePresent: true,
      });
    }
  );

  it("carries the same non-authority vocabulary into Evaluation Cards", async () => {
    const ordinary = fixture().preview(request("ordinary_default"));
    const evaluationRoot = mkdtempSync(path.join(tmpdir(), "vellum-t16-evaluation-"));
    roots.push(evaluationRoot);
    let nextId = 0;
    const evaluation = await runFirstLoopEvaluation({
      evaluationRoot,
      now: () => new Date("2026-07-16T21:00:00.000Z"),
      createId: () => `16000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      knowledgeAuthorityReadiness: ordinary.authorityReadiness,
    });
    expect(evaluation.cards[0]).toMatchObject({
      hardGateStatus: "pass",
      knowledgeAuthorityReadiness: {
        authorityState: "review_required",
        activationState: "blocked",
        qualificationState: "ineligible",
        readinessState: "not_claimed",
        historicalPresentation: "unclaimed",
      },
    });
  });

  it("rejects false readiness, qualification, or historical presentation in exports and debug data", () => {
    const projection = fixture().preview(request("provisional_research"));
    for (const forged of [
      { readinessState: "ready" },
      { qualificationState: "qualified" },
      { historicalPresentation: "specialist_reviewed" },
    ]) {
      expect(() =>
        validateKnowledgeResolutionProjection({
          ...projection,
          authorityReadiness: { ...projection.authorityReadiness, ...forged },
        })
      ).toThrow();
    }
  });
});

function fixture(): KnowledgeResolutionService {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t16-isolation-"));
  roots.push(root);
  const fixture = createT14KnowledgeResolutionFixture(root);
  return new KnowledgeResolutionService({
    publicationStore: fixture.store,
    now: () => new Date("2026-07-16T21:00:00.000Z"),
  });
}

function request(mode: "ordinary_default" | "provisional_research" | "isolated_evaluation") {
  const research = mode === "ordinary_default" ? null : true;
  return {
    mode,
    sourceProfile: research ? ("mace-musicks-monument-1676" as const) : null,
    instrumentFamily: research ? ("baroque_lute" as const) : null,
    notationSystem: research ? ("french_tablature" as const) : null,
    sourceCourseCount: research ? (12 as const) : null,
    historicalSignState: research ? ("unresolved" as const) : null,
    passageRef: ref("passage.synthetic-t16"),
    sourceContextRefs: [],
    analysisRef: ref("analysis.synthetic-t16"),
    arrangementPlanRef: ref("arrangement-plan.synthetic-t16"),
    arrangementBriefRef: ref("arrangement-brief.synthetic-t16"),
    performanceBriefRef: ref("performance-brief.synthetic-t16"),
    preservationPolicyRef: ref("preservation-policy.synthetic-t16"),
    instrumentInstanceRef: ref("instrument-instance.synthetic-t16"),
  };
}

function ref(id: string) {
  return { id, digest: referenceSourceDigest({ id }) };
}
