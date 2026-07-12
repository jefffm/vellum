import { describe, expect, it } from "vitest";
import { classifyOwnerIntent, type OwnerIntentAnchor } from "./owner-intent.js";

const anchor: OwnerIntentAnchor = {
  workspaceId: "workspace.1111111111111111",
  arrangementScoreId: "arrangement.1111111111111111",
  arrangementScoreVersion: 3,
  arrangementFamilyId: "family.1111111111111111",
  arrangementSearchId: "search.1111111111111111",
  arrangementPlanId: "plan.1111111111111111",
  analysisRecordId: "analysis.1111111111111111",
  targetConfigurationId: "target.baroque-lute",
  preservationPolicy: "faithful_reduction",
  eventIds: ["arrangement-event.1"],
  measureIds: ["measure.1"],
  sourceEventIds: ["event.1"],
  findingIds: ["finding.1"],
};

describe("canonical Owner-intent classification", () => {
  it.each([
    ["The OCR misread this source note", "score_transcription"],
    ["The principal voice is wrong", "analysis_claim"],
    ["Preserve the bass in this section", "arrangement_plan"],
    ["Change this note to G4", "arrangement_score"],
    ["Play this slower with more rubato", "performance_interpretation"],
    ["Never change this cadence", "commitment"],
    ["Allow this despite the policy failure", "policy_exception"],
    ["Make this my default going forward", "personal_default_candidate"],
    ["Why is this note on the third course?", "explanation"],
  ] as const)("routes %s to %s", (request, proposedLayer) => {
    const proposal = classifyOwnerIntent({ id: "intent.1", request, anchor });
    expect(proposal.proposedLayer).toBe(proposedLayer);
    expect(proposal.mutationAuthorized).toBe(false);
    expect(proposal.confirmation).toBe(
      proposedLayer === "explanation" ? "not_required" : "required"
    );
  });

  it("keeps a consequential cross-layer request ambiguous and uncommitted", () => {
    const proposal = classifyOwnerIntent({
      id: "intent.2",
      request: "The OCR misread this note; change this note to G4",
      anchor,
      modelProposedLayer: "arrangement_score",
    });
    expect(proposal).toMatchObject({
      resolution: "ambiguous",
      confirmation: "required",
      mutationAuthorized: false,
      alternatives: expect.arrayContaining(["score_transcription", "arrangement_score"]),
    });
  });
});
