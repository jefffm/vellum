// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installEvaluationCard } from "./guided-start.js";

describe("narrow Evaluation Card", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("shows hard gates and refuses to turn missing human evidence into a pass", async () => {
    const panel = document.createElement("section");
    panel.innerHTML = '<header class="artifact-preview-header"></header>';
    document.body.append(panel);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              data: {
                hardGateStatus: "pass",
                sourceTruthAssessmentId: "truth.1111111111111111",
                arrangementPlanId: "plan.1111111111111111",
                performanceBriefId: "performance.1111111111111111",
                dimensions: [
                  {
                    id: "source_authority",
                    status: "pass",
                    hardGate: true,
                    evidenceIds: ["truth.1111111111111111"],
                    rationale: "Exact reviewed lineage.",
                  },
                  {
                    id: "human_and_physical_evidence",
                    status: "unknown",
                    hardGate: false,
                    evidenceIds: [],
                    rationale: "No playtest exists.",
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );

    await installEvaluationCard(panel, {
      workspaceId: "workspace.1111111111111111",
      arrangementScoreId: "arrangement.1111111111111111",
    } as never);

    const card = panel.querySelector<HTMLElement>(".evaluation-card")!;
    expect(card.textContent).toContain("hard gates pass");
    expect(card.textContent).toContain("1 explicitly unknown");
    expect(
      card.querySelector('[data-evaluation-dimension="source_authority"]')?.textContent
    ).toContain("pass (hard gate)");
    expect(
      card.querySelector<HTMLElement>('[data-evaluation-dimension="human_and_physical_evidence"]')
        ?.dataset.status
    ).toBe("unknown");
  });
});
