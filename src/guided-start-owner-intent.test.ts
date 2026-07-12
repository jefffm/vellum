// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { proposeOwnerIntent, type ScoreSelectionContext } from "./guided-start.js";
import type { OwnerIntentProposal } from "./lib/owner-intent.js";

const context = {
  kind: "vellum_score_selection",
  workspaceId: "workspace.1111111111111111",
  arrangementScoreId: "arrangement.1111111111111111",
  arrangementScoreVersion: 2,
  arrangementFamilyId: "family.1111111111111111",
  arrangementSearchId: "search.1111111111111111",
  arrangementPlanId: "plan.1111111111111111",
  analysisRecordId: "analysis.1111111111111111",
  targetConfiguration: { id: "target.baroque-lute" },
  preservationPolicy: "faithful_reduction",
  eventIds: ["arrangement-event.1"],
  measureIds: ["measure.1"],
  sourceEventIds: ["event.1"],
  findingIds: [],
  events: [],
  lineage: [],
  findings: [],
} as unknown as ScoreSelectionContext;

function proposal(
  layer: OwnerIntentProposal["proposedLayer"],
  resolution: OwnerIntentProposal["resolution"] = "resolved"
): OwnerIntentProposal {
  return {
    id: "owner-intent.1111111111111111",
    request: "request",
    anchor: {
      workspaceId: context.workspaceId,
      arrangementScoreId: context.arrangementScoreId,
      arrangementScoreVersion: context.arrangementScoreVersion,
      arrangementFamilyId: context.arrangementFamilyId,
      arrangementSearchId: context.arrangementSearchId,
      arrangementPlanId: context.arrangementPlanId,
      analysisRecordId: context.analysisRecordId,
      targetConfigurationId: context.targetConfiguration.id,
      preservationPolicy: context.preservationPolicy,
      eventIds: context.eventIds,
      measureIds: context.measureIds,
      sourceEventIds: context.sourceEventIds,
      findingIds: [],
    },
    ...(layer ? { proposedLayer: layer } : {}),
    alternatives: resolution === "ambiguous" ? ["score_transcription", "arrangement_score"] : [],
    resolution,
    consequence: layer === "explanation" ? "none" : "lineage",
    consequenceSummary: "Exact consequence.",
    confirmation: layer === "explanation" ? "not_required" : "required",
    mutationAuthorized: false,
    rationale: "Evidence-bearing rationale.",
  };
}

describe("Owner-intent proposal UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("shows exact scope and sends a low-consequence explanation without another confirmation", async () => {
    const container = document.createElement("aside");
    document.body.append(container);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(proposal("explanation")))
    );
    const messages: unknown[] = [];
    document.addEventListener("vellum-ask-selection", (event) =>
      messages.push((event as CustomEvent).detail)
    );

    const canonical = await proposeOwnerIntent(container, context, "Why is this note here?");

    expect(container.textContent).toContain("Proposed layer: explanation");
    expect(container.textContent).toContain("Arrangement Score v2");
    expect(container.textContent).toContain("No mutation has occurred");
    expect(container.textContent).toContain(context.arrangementPlanId);
    expect(container.querySelector("button")).toBeNull();
    expect(messages).toHaveLength(1);
    const digestBeforeExpertDisclosure = JSON.stringify(canonical);
    container.querySelector("details")!.open = true;
    expect(JSON.stringify(canonical)).toBe(digestBeforeExpertDisclosure);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not forward a consequential request until explicit confirmation", async () => {
    const container = document.createElement("aside");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(proposal("score_transcription")))
    );
    const listener = vi.fn();
    document.addEventListener("vellum-ask-selection", listener);

    await proposeOwnerIntent(container, context, "The OCR misread this note");
    expect(listener).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Consequence: lineage");
    container.querySelector<HTMLButtonElement>("button")!.click();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps ambiguous consequential intent uncommitted until the Owner chooses a layer", async () => {
    const container = document.createElement("aside");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(proposal(undefined, "ambiguous")))
    );
    const listener = vi.fn();
    document.addEventListener("vellum-ask-selection", listener);

    await proposeOwnerIntent(container, context, "The source is wrong; change this note");
    expect(listener).not.toHaveBeenCalled();
    expect(container.querySelector("select")?.options).toHaveLength(2);
    expect(container.textContent).toContain("No mutation has occurred");
    container.querySelector<HTMLButtonElement>("button")!.click();
    expect(listener).toHaveBeenCalledOnce();
  });
});

function response(data: OwnerIntentProposal): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
