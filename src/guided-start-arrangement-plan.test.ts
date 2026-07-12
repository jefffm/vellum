// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installArrangementPlanSummary } from "./guided-start.js";

describe("plain-language Arrangement Plan", () => {
  afterEach(() => document.body.replaceChildren());

  it("stays concise for literal work and surfaces only consequential confirmations", () => {
    const panel = document.createElement("section");
    panel.innerHTML = '<header class="artifact-preview-header"></header>';
    document.body.append(panel);
    const base = {
      id: "plan.1111111111111111",
      kind: "minimal_projection",
      sectionalIntent: [{ passageId: "passage.1111111111111111" }],
      transpositionPlan: { status: "resolved", semitones: 0 },
      decisions: [
        {
          dimension: "preservation",
          selectedValue: "faithful_reduction",
          rationale: "Retain the analyzed musical structure.",
          confirmation: { requirement: "not_required", status: "not_required" },
        },
      ],
    };

    installArrangementPlanSummary(panel, { arrangementPlan: base } as never);
    expect(panel.querySelector("summary")?.textContent).toContain("ready without questions");
    expect(panel.textContent).toContain("1 passage intentions");
    expect(panel.textContent).toContain("preservation: faithful reduction");

    installArrangementPlanSummary(panel, {
      arrangementPlan: {
        ...base,
        id: "plan.2222222222222222",
        kind: "sectional_reduction",
        decisions: [
          {
            ...base.decisions[0],
            confirmation: { requirement: "owner", status: "proposed" },
          },
        ],
      },
    } as never);
    expect(panel.querySelectorAll(".arrangement-plan-summary")).toHaveLength(1);
    expect(panel.querySelector("summary")?.textContent).toContain("1 consequential choices");
    expect(panel.querySelector("button")?.textContent).toBe("Confirm consequential choice");
  });
});
