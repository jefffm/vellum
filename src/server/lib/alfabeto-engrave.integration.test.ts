import { describe, expect, it } from "vitest";
import type { EngraveParams } from "../../lib/engrave-schema.js";
import { engrave, EngraveValidationError } from "./engrave.js";

function params(event: EngraveParams["bars"][number]["events"][number]): EngraveParams {
  return {
    instrument: "baroque-guitar-5",
    template: "french-tab",
    bars: [{ events: [event] }],
  };
}

describe("alfabeto engrave production quarantine", () => {
  it.each([
    [
      "legacy default",
      { type: "alfabeto_chord", chord_name: "G major", duration: "4" } as const,
      "tracked.alfabeto-tyler-universal",
    ],
    [
      "explicit Tyler locator",
      {
        type: "alfabeto_chord",
        chord_name: "G major",
        chart_id: "tyler-universal",
        duration: "4",
      } as const,
      "tracked.alfabeto-tyler-universal",
    ],
    [
      "explicit Foscarini locator",
      {
        type: "alfabeto_chord",
        chord_name: "G major",
        chart_id: "foscarini",
        duration: "4",
      } as const,
      "tracked.alfabeto-foscarini-overlay",
    ],
  ])("returns structured review_required for %s", (_name, event, artifactId) => {
    try {
      engrave(params(event));
      throw new Error("expected quarantine failure");
    } catch (error) {
      expect(error).toBeInstanceOf(EngraveValidationError);
      expect((error as EngraveValidationError).details).toContainEqual(
        expect.objectContaining({
          field: "alfabeto",
          status: "review_required",
          code: "tracked_source_review_required",
          artifactId,
        })
      );
    }
  });

  it("does not let a preferred symbol bypass the authority decision", () => {
    expect(() =>
      engrave(
        params({
          type: "alfabeto_chord",
          chord_name: "G major",
          prefer: "invented-preference",
          duration: "4",
        })
      )
    ).toThrow(/review_required/);
  });

  it("does not let a direct-letter legacy event bypass the authority decision", () => {
    expect(() =>
      engrave(params({ type: "alfabeto", letter: "invented-letter", duration: "4" }))
    ).toThrow(/review_required/);
  });

  it("continues to reject alfabeto event types on other instruments before chart use", () => {
    expect(() =>
      engrave({
        ...params({ type: "alfabeto_chord", chord_name: "G major", duration: "4" }),
        instrument: "classical-guitar-6",
        template: "solo-tab",
      })
    ).toThrow(/require a 5-course fully fretted instrument/);
  });
});
