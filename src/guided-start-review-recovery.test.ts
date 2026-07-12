// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { guidedStartMarkup, resolveCriticalUncertainties } from "./guided-start.js";

describe("Score-Anchored Review correction recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("keeps the exact edit inline after a failed save and retries without repeating review", async () => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = guidedStartMarkup();
    document.body.append(dialog);
    const review = {
      transcriptionId: "transcription.1111111111111111",
      version: 1,
      status: "needs_review",
      sourceArtifactId: "source.1111111111111111",
      sourceFilename: "score.pdf",
      sourceContentUrl: "/source.pdf",
      acceptanceBatches: [],
      items: [
        {
          uncertainty: {
            id: "uncertainty.1111111111111111",
            eventIds: ["event.1111111111111111"],
            critical: true,
            category: "pitch_recognition",
            message: "Confirm the uncertain pitch.",
            alternatives: ["F#4", "F4"],
            resolved: false,
          },
          events: [
            {
              id: "event.1111111111111111",
              type: "note",
              partId: "part.1111111111111111",
              measureId: "measure.1111111111111111",
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 1 },
              pitch: "F4",
              confidence: 0.72,
            },
          ],
        },
      ],
    };
    let reviewReads = 0;
    let saves = 0;
    const saveBodies: Array<{ correctionId?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          saves += 1;
          saveBodies.push(JSON.parse(String(init.body)) as { correctionId?: string });
          if (saves === 1) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: { code: "internal_error", message: "Temporary persistence failure" },
              }),
              { status: 500, headers: { "content-type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                scoreTranscription: {
                  id: "transcription.2222222222222222",
                  status: "reviewed",
                },
                normalizedScore: { id: "score.2222222222222222" },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        reviewReads += 1;
        return new Response(
          JSON.stringify({ ok: true, data: reviewReads === 1 ? review : { ...review, items: [] } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );

    const completion = resolveCriticalUncertainties(
      dialog,
      "workspace.1111111111111111",
      "transcription.1111111111111111",
      "score.1111111111111111"
    );
    const panel = dialog.querySelector<HTMLElement>("[data-score-review]")!;
    await vi.waitFor(() => expect(panel.hidden).toBe(false));
    const pitch = panel.querySelector<HTMLInputElement>("[data-review-event-id]")!;
    const rationale = panel.querySelector<HTMLInputElement>("[data-review-rationale]")!;
    const apply = panel.querySelector<HTMLButtonElement>("[data-review-apply]")!;
    pitch.value = "F#4";
    rationale.value = "Confirmed sharp against the source.";
    apply.click();

    await vi.waitFor(() =>
      expect(panel.querySelector("[data-review-error]")?.textContent).toContain(
        "Your edits are still here"
      )
    );
    expect(panel.querySelector<HTMLInputElement>("[data-review-event-id]")?.value).toBe("F#4");
    expect(panel.querySelector<HTMLInputElement>("[data-review-rationale]")?.value).toBe(
      "Confirmed sharp against the source."
    );
    expect(apply.disabled).toBe(false);
    expect(apply.textContent).toContain("Retry");
    apply.click();

    await expect(completion).resolves.toEqual({
      transcriptionId: "transcription.2222222222222222",
      normalizedScoreId: "score.2222222222222222",
    });
    expect(saves).toBe(2);
    expect(saveBodies[0]?.correctionId).toMatch(/^correction\./);
    expect(saveBodies[1]?.correctionId).toBe(saveBodies[0]?.correctionId);
    expect(reviewReads).toBe(2);
    expect(panel.hidden).toBe(true);
  });
});
