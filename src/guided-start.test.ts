import { describe, expect, it } from "vitest";
import {
  guidedStartMarkup,
  buildScoreSelectionContext,
  describeArrangementEvent,
  installNotationSelection,
  installLineageSummary,
  installProviderConnection,
  midiFrequency,
  sourceFocusUrl,
  selectionPrompt,
  targetConfiguration,
  sourceMimeType,
} from "./guided-start.js";
import type { GuidedDeliverable } from "./guided-start.js";

describe("audio preview synthesis", () => {
  it("maps MIDI pitches to equal-tempered oscillator frequencies", () => {
    expect(midiFrequency(69)).toBe(440);
    expect(midiFrequency(60)).toBeCloseTo(261.626, 3);
  });
});

describe("interactive notation", () => {
  it("describes an Arrangement Event using stable musical facts", () => {
    expect(
      describeArrangementEvent({
        id: "arrangement-event.1",
        type: "note",
        measureId: "measure.2",
        onset: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 2 },
        pitches: ["F4"],
        positions: [{ course: 1, fret: 1, pitch: "F4", quality: "low_fret" }],
        sourceEventIds: ["source-event.1"],
        role: "principal_voice",
      })
    ).toBe("F4 · duration 1/2 · principal voice · measure.2 · course 1, fret 1");
  });

  it("binds notation identity to selection and playback seeking", () => {
    const implementation = installNotationSelection.toString();
    expect(implementation).toContain("data-arrangement-event-id");
    expect(implementation).toContain("score-selected");
    expect(implementation).toContain("vellum-seek-playback");
  });

  it("sends an exact ordered Greensleeves phrase and Principal Voice identity to chat", () => {
    const events = [
      {
        id: "arrangement.greensleeves.event.1",
        type: "note" as const,
        measureId: "measure.greensleeves.1",
        onset: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 2 },
        pitches: ["F4"],
        positions: [{ course: 1, fret: 1, pitch: "F4", quality: "low_fret" as const }],
        sourceEventIds: ["source.soprano.1"],
        role: "principal_voice" as const,
      },
      {
        id: "arrangement.greensleeves.event.2",
        type: "note" as const,
        measureId: "measure.greensleeves.1",
        onset: { numerator: 1, denominator: 2 },
        duration: { numerator: 1, denominator: 2 },
        pitches: ["G4"],
        positions: [{ course: 1, fret: 3, pitch: "G4", quality: "low_fret" as const }],
        sourceEventIds: ["source.soprano.2"],
        role: "principal_voice" as const,
      },
    ];
    const deliverable = {
      workspaceId: "workspace.greensleeves",
      arrangementScoreId: "arrangement.greensleeves",
      arrangementScoreVersion: 3,
      arrangementFamilyId: "family.greensleeves",
      arrangementSearchId: "search.greensleeves",
      targetConfigurationId: "target.baroque-guitar",
      targetConfiguration: {
        id: "target.baroque-guitar",
        instrumentId: "baroque-guitar-5",
        role: "solo",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf", "audio-preview"],
      },
      preservationPolicy: "faithful_reduction",
      arrangementEvents: events,
      transformationReport: [
        {
          id: "transformation.1",
          sourceEventId: "source.soprano.1",
          arrangementEventIds: [events[0].id],
          classification: "transposed",
          rationale: "Principal Voice retained in the target key.",
        },
      ],
      preservationAudit: { status: "pass", targetIds: [], findings: [] },
    } as unknown as GuidedDeliverable;
    const context = buildScoreSelectionContext(
      deliverable,
      events.map((event) => event.id)
    );
    const prompt = selectionPrompt(context, "Why is this phrase awkward?");

    expect(context).toMatchObject({
      arrangementScoreId: "arrangement.greensleeves",
      arrangementScoreVersion: 3,
      preservationPolicy: "faithful_reduction",
      eventIds: events.map((event) => event.id),
      sourceEventIds: ["source.soprano.1", "source.soprano.2"],
    });
    expect(context.events.every((event) => event.role === "principal_voice")).toBe(true);
    expect(prompt).toContain("Why is this phrase awkward?");
    expect(prompt).toContain(events[0].id);
    expect(prompt).toContain(events[1].id);
    expect(prompt).toContain('"role": "principal_voice"');
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
    expect(markup).toContain('data-provider-prompt-input autocomplete="off" disabled');
    expect(markup).toContain("Finish connection");
    expect(markup).toContain("Cancel login");
    expect(implementation).toContain("Continue ChatGPT login");
    expect(implementation).toContain("promptInput.disabled = !current.prompt");
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
