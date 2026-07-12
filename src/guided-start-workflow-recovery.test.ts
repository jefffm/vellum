// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { guidedStartMarkup, refreshGuidedWorkflowRecovery } from "./guided-start.js";

describe("Guided Start workflow recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("restores an interrupted checkpoint beside provider recovery with explicit choices", async () => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = guidedStartMarkup();
    document.body.append(dialog);
    const modelRecovery = dialog.querySelector<HTMLElement>("[data-model-action-recovery]")!;
    modelRecovery.hidden = false;
    const workflow = {
      id: "workflow.11111111-1111-4111-8111-111111111111",
      workspaceId: "workspace.11111111-1111-4111-8111-111111111111",
      status: "interrupted",
      stage: "projection",
      sourceArtifactId: "source.11111111-1111-4111-8111-111111111111",
      optical: true,
      ocrAutoAcceptConfidence: 0.8,
      preservationPolicy: "faithful_reduction",
      targets: [
        {
          targetConfigurationId: "target.baroque-guitar",
          status: "complete",
          arrangementSearchId: "search.11111111-1111-4111-8111-111111111111",
          arrangementScoreId: "arrangement.11111111-1111-4111-8111-111111111111",
          arrangementScoreVersion: 1,
          deliverableIds: ["deliverable.11111111-1111-4111-8111-111111111111"],
        },
        {
          targetConfigurationId: "target.baroque-lute",
          status: "failed",
          errorCode: "compile_failed",
          deliverableIds: [],
        },
      ],
      resumeCount: 0,
      failureCode: "compile_failed",
      createdAt: "2026-07-12T12:00:00.000Z",
      updatedAt: "2026-07-12T12:01:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const data = url.endsWith("/active")
          ? { workflow }
          : {
              brief: {
                targetConfigurations: [
                  { id: "target.baroque-guitar", instrumentId: "baroque-guitar-5" },
                  { id: "target.baroque-lute", instrumentId: "baroque-lute-13" },
                ],
              },
            };
        return new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })
    );

    await refreshGuidedWorkflowRecovery(dialog, workflow.workspaceId, vi.fn());

    const panel = dialog.querySelector<HTMLElement>("[data-guided-workflow-recovery]")!;
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain("Stopped at projection (compile_failed)");
    expect(panel.querySelector("[data-guided-workflow-resume]")?.textContent).toContain("Resume");
    expect(panel.querySelector("[data-guided-workflow-restart]")?.textContent).toContain("Restart");
    expect(modelRecovery.hidden).toBe(false);
  });

  it("does not present recovery when no interrupted workflow exists", async () => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = guidedStartMarkup();
    document.body.append(dialog);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, data: {} }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    );

    await refreshGuidedWorkflowRecovery(
      dialog,
      "workspace.11111111-1111-4111-8111-111111111111",
      vi.fn()
    );
    expect(dialog.querySelector<HTMLElement>("[data-guided-workflow-recovery]")?.hidden).toBe(true);
  });
});
