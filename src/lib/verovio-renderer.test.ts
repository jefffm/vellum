import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
  diapasonLabels,
  EXPECTED_DIAPASON_LABELS,
  FRENCH_TAB_MEI_FIXTURE,
  LUTE_DIAPASON_MEI_FIXTURE,
} from "./mei-edition-fixtures.js";
import { PINNED_VEROVIO_VERSION, renderMeiWithVerovio } from "./verovio-renderer.js";

describe("pinned Verovio MEI renderer", () => {
  it("renders stable French-tab identities and timing with the pinned runtime", async () => {
    const result = await renderMeiWithVerovio(FRENCH_TAB_MEI_FIXTURE, [
      "note-1",
      "note-4",
      "note-5",
    ]);

    expect(result.version).toMatch(new RegExp(`^${PINNED_VEROVIO_VERSION}(?:-|$)`));
    expect(result.svg).toContain('data-class="tabGrp"');
    expect(result.svg).toContain('data-id="event-1"');
    expect(result.svg).toContain('data-id="rhythm-1"');
    expect(result.events.map(({ id, timeMs }) => ({ id, timeMs }))).toEqual([
      { id: "note-1", timeMs: 0 },
      { id: "note-4", timeMs: 750 },
      { id: "note-5", timeMs: 1000 },
    ]);
    expect(result.midiBase64.length).toBeGreaterThan(100);
  });

  it("renders the verified 7–12 diapason sequence without fixing course 13 policy", async () => {
    const result = await renderMeiWithVerovio(
      LUTE_DIAPASON_MEI_FIXTURE,
      Object.keys(EXPECTED_DIAPASON_LABELS)
    );
    const document = new JSDOM(result.svg, { contentType: "image/svg+xml" }).window.document;
    const expectedGlyphs = ["EBCD", "EBCE", "EBCF", "EBD0", "EBE4", "EBE5"];

    for (const [index, id] of Object.keys(EXPECTED_DIAPASON_LABELS).entries()) {
      const href = document.querySelector(`[data-id="${id}"] use`)?.getAttribute("href");
      expect(href).toMatch(new RegExp(`^#${expectedGlyphs[index]}-`));
    }
    expect(diapasonLabels("6")["course-13"]).toBe("6");
    expect(diapasonLabels("////a")["course-13"]).toBe("////a");
  });
});
