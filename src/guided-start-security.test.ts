// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { AudioPreview } from "./lib/audio-preview.js";
import { mountSafeNotationSvg } from "./artifact-preview.js";
import {
  guidedStartMarkup,
  installAudioPreviewControls,
  installNotationSelection,
  isolateArtifactFrame,
  type GuidedDeliverable,
} from "./guided-start.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("Guided Start active-content boundaries", () => {
  it("renders imported audio-part labels as text rather than executable markup", () => {
    const panel = document.createElement("section");
    panel.innerHTML = '<header class="artifact-preview-header"></header>';
    document.body.append(panel);
    const hostileLabel =
      '</span><img src="missing" onerror="globalThis.__vellumPartLabelExecuted = true">';
    const preview: AudioPreview = {
      tempo: 70,
      durationSeconds: 1,
      synthesis: "basic-oscillator",
      mode: "literal",
      performedForm: {
        measureOccurrences: [],
        traversalDecisions: [],
        skipRepeats: false,
      },
      parts: [
        { id: "full", label: "Full arrangement" },
        { id: "voice:hostile", label: hostileLabel },
      ],
      events: [],
    };

    installAudioPreviewControls(panel, preview);

    const row = panel.querySelector<HTMLElement>(".playback-part-row");
    expect(row?.querySelector("span")?.textContent).toBe(hostileLabel);
    expect(row?.querySelector("img")).toBeNull();
    expect(row?.querySelectorAll("input")).toHaveLength(3);
    expect((globalThis as { __vellumPartLabelExecuted?: boolean }).__vellumPartLabelExecuted).toBe(
      undefined
    );
  });

  it("applies maximum iframe sandboxing and suppresses referrer disclosure", () => {
    const frame = document.createElement("iframe");
    isolateArtifactFrame(frame);

    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("ships the score-review source frame with the isolation boundary already present", () => {
    const container = document.createElement("div");
    container.innerHTML = guidedStartMarkup();
    const frames = container.querySelectorAll("iframe");

    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.getAttribute("sandbox")).toBe("");
      expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    }
  });

  it("trusts sanitized score identities only when the canonical deliverable resolves them", () => {
    const panel = document.createElement("section");
    panel.innerHTML =
      '<header class="artifact-preview-header"></header><div class="artifact-preview-content"></div>';
    document.body.append(panel);
    const content = panel.querySelector<HTMLElement>(".artifact-preview-content")!;
    mountSafeNotationSvg(
      content,
      `<svg xmlns="http://www.w3.org/2000/svg"><g data-arrangement-event-id="event.valid" data-measure-id="measure.1"><path d="M0 0 L1 1"/></g><g data-arrangement-event-id="event.forged" data-measure-id="measure.1"><rect x="0" y="0" width="10" height="10"/></g></svg>`
    );
    const deliverable = {
      arrangementEvents: [
        {
          id: "event.valid",
          type: "note",
          pitches: ["G4"],
          duration: { numerator: 1, denominator: 1 },
          role: "principal_voice",
          measureId: "measure.1",
          positions: [{ course: 1, fret: 3, quality: "low_fret" }],
          sourceEventIds: ["source-event.1"],
        },
      ],
    } as unknown as GuidedDeliverable;

    installNotationSelection(panel, deliverable);

    const valid = panel.querySelector<SVGGElement>('[data-arrangement-event-id="event.valid"]')!;
    const forged = panel.querySelector<SVGGElement>('[data-arrangement-event-id="event.forged"]')!;
    expect(valid.getAttribute("role")).toBe("button");
    expect(valid.getAttribute("tabindex")).toBe("0");
    expect(forged.getAttribute("role")).toBeNull();
    expect(forged.getAttribute("tabindex")).toBeNull();

    forged.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.querySelector<HTMLElement>(".score-selection-summary")?.hidden).toBe(true);
    valid.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.querySelector<HTMLElement>(".score-selection-summary")?.hidden).toBe(false);
  });
});
