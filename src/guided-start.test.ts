import { describe, expect, it } from "vitest";
import {
  guidedStartMarkup,
  installLineageSummary,
  installProviderConnection,
  midiFrequency,
  sourceFocusUrl,
  targetConfiguration,
  sourceMimeType,
} from "./guided-start.js";

describe("audio preview synthesis", () => {
  it("maps MIDI pitches to equal-tempered oscillator frequencies", () => {
    expect(midiFrequency(69)).toBe(440);
    expect(midiFrequency(60)).toBeCloseTo(261.626, 3);
  });
});

describe("Guided Start output choices", () => {
  it("offers classical guitar standard notation as an independently selectable sibling", () => {
    const markup = guidedStartMarkup();
    expect(markup).toContain('value="target.classical-guitar"');
    expect(markup).toContain("Standard notation");
    expect(markup).toContain("standard EADGBE tuning");
    expect(markup).toContain("data-score-review");
    expect(markup).toContain("Source facsimile");
    expect(markup).toContain("data-review-source-image");
    expect(markup).toContain("data-review-source-highlight");
    expect(markup).toContain("Recognized notation");
    expect(markup).toContain("Cancel this run");
    expect(markup).toContain("data-model-action-recovery");
    expect(markup).toContain("Interrupted model work");
    expect(markup).toContain('name="preservationPolicy"');
    expect(markup).toContain('value="faithful_reduction" selected');
    expect(markup).toContain('value="idiomatic_adaptation"');
    expect(markup).toContain('value="free_paraphrase"');
    expect(targetConfiguration("target.classical-guitar")).toEqual({
      id: "target.classical-guitar",
      instrumentId: "classical-guitar-6",
      role: "solo",
      tuningId: "standard",
      notationLayouts: ["standard-notation"],
      deliverables: ["pdf", "audio-preview"],
    });
  });

  it("advertises optical and symbolic source formats and resolves missing browser MIME types", () => {
    const markup = guidedStartMarkup();
    expect(markup).toContain(".musicxml");
    expect(markup).toContain(".abc");
    expect(markup).toContain(".mei");
    expect(markup).toContain(".mscz");
    expect(markup).toContain("PDF and images use Audiveris review");
    expect(sourceMimeType({ name: "piece.ly", type: "" })).toBe("text/x-lilypond");
    expect(sourceMimeType({ name: "piece.mei", type: "" })).toBe("application/mei+xml");
  });

  it("exposes stale-lineage recovery and commitment release actions", () => {
    const implementation = installLineageSummary.toString();
    expect(implementation).toContain("Conservative regenerate");
    expect(implementation).toContain("Fresh Arrangement Search");
    expect(implementation).toContain("Keep preserved prior version");
    expect(implementation).toContain("Let Vellum reconsider");
    expect(implementation).toContain("approving a scoped Policy Exception");
  });

  it("uses an inline, recoverable ChatGPT callback flow instead of window.prompt", () => {
    const markup = guidedStartMarkup();
    const implementation = installProviderConnection.toString();
    expect(markup).toContain("data-provider-prompt-input");
    expect(markup).toContain("Finish connection");
    expect(markup).toContain("Cancel login");
    expect(implementation).toContain("Continue ChatGPT login");
    expect(implementation).not.toContain("window.prompt");
  });

  it("focuses the native PDF viewer on the exact uncertainty region", () => {
    expect(
      sourceFocusUrl("/api/source.pdf", {
        page: 1,
        x: 121.6,
        y: 151.2,
        width: 24,
        height: 28,
      })
    ).toBe("/api/source.pdf#page=1&zoom=180,122,151");
  });

  it("offers an explicitly profiled continuo realization for figured-bass sources", () => {
    const markup = guidedStartMarkup();
    expect(markup).toContain('value="target.piano-continuo"');
    expect(markup).toContain("For figured-bass sources");
    expect(targetConfiguration("target.piano-continuo")).toEqual({
      id: "target.piano-continuo",
      instrumentId: "piano",
      role: "ensemble",
      realizationProfileId: "continuo.italian-baroque",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    });
    expect(markup).toContain('value="target.baroque-guitar-continuo"');
    expect(markup).toContain("separate bass preserves the foundation");
    expect(targetConfiguration("target.baroque-guitar-continuo")).toEqual({
      id: "target.baroque-guitar-continuo",
      instrumentId: "baroque-guitar-5",
      role: "ensemble",
      stringing: "french",
      realizationProfileId: "continuo.italian-baroque",
      continuoTreatment: "separate_bass",
      continuoBassInstrumentId: "voice-bass",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    });
  });

  it("offers six-course Renaissance lute with French tablature", () => {
    expect(guidedStartMarkup()).toContain('value="target.renaissance-lute"');
    expect(targetConfiguration("target.renaissance-lute")).toEqual({
      id: "target.renaissance-lute",
      instrumentId: "renaissance-lute-6",
      role: "solo",
      tuningId: "renaissance-g",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    });
  });
});
