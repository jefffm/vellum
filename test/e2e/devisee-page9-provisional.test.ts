import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildDiplomaticMei } from "../../scripts/lib/build-diplomatic-mei.mjs";
import { renderMeiWithVerovio } from "../../src/lib/verovio-renderer.js";

describe("de Visée page 9 provisional diplomatic extraction", () => {
  it("preserves historical strums as typed empty tablature gestures", async () => {
    const extraction = {
      title: "Historical strum proof",
      sourcePage: 1,
      meter: { count: 3, unit: 4 },
      tuning: [
        { course: 1, pname: "e", oct: 4 },
        { course: 2, pname: "b", oct: 3 },
        { course: 3, pname: "g", oct: 3 },
        { course: 4, pname: "d", oct: 3 },
        { course: 5, pname: "a", oct: 3 },
      ],
      sourceLayout: {
        systems: [
          {
            measureStart: 1,
            rhythmTop: 0.1,
            staffTop: 0.2,
            staffBottom: 0.3,
            measureBounds: [[0.1, 0.9]],
          },
        ],
      },
      measures: [
        [
          {
            kind: "strum",
            direction: "up",
            chordSource: "held",
            dur: 4,
            rhythmVisible: false,
            sourceBounds: [0.25, 0.45],
            notes: [],
            confidence: 0.98,
          },
        ],
      ],
    };

    const built = buildDiplomaticMei(extraction);
    expect(built.tokens).toContainEqual(
      expect.objectContaining({ id: "m1-strum-1", kind: "strum" })
    );
    expect(built.mei).toContain(
      '<tabGrp xml:id="m1-strum-1" dur="4" type="historical-strum-up chord-held"'
    );
    expect(built.mei).not.toContain('xml:id="m1-rhythm-1"');
    expect(built.mei).not.toContain("<note");

    const rendered = await renderMeiWithVerovio(built.mei, []);
    expect(rendered.svg).toContain('data-id="m1-strum-1"');
    expect(rendered.svg).toContain('class="dir mei-historical-strum-mark mei-historical-strum-up"');
    expect(rendered.svg).not.toContain("strum-render-anchor");
  });

  it("keeps source-written chord letters on an explicit strum", async () => {
    const extraction = {
      title: "Explicit historical strum proof",
      sourcePage: 1,
      meter: { count: 3, unit: 4 },
      tuning: [{ course: 1, pname: "e", oct: 4 }],
      sourceLayout: {
        systems: [
          {
            measureStart: 1,
            rhythmTop: 0.1,
            staffTop: 0.2,
            staffBottom: 0.3,
            measureBounds: [[0.1, 0.9]],
          },
        ],
      },
      measures: [
        [
          {
            kind: "strum",
            direction: "down",
            chordSource: "explicit",
            dur: 8,
            rhythmVisible: true,
            sourceBounds: [0.25, 0.45],
            notes: [[1, 3]],
            confidence: 0.98,
          },
        ],
      ],
    };

    const built = buildDiplomaticMei(extraction);
    expect(built.mei).toContain('type="historical-strum-down chord-explicit"');
    expect(built.mei).toContain('xml:id="m1-e1-n1"');
    expect(built.tokens).toContainEqual(
      expect.objectContaining({ id: "m1-strum-1", kind: "strum" })
    );
    expect(built.tokens).toContainEqual(
      expect.objectContaining({ id: "m1-e1-n1", kind: "tablature" })
    );
  });

  it("preserves the pickup, omitted repeated rhythm signs, and pincé simultaneity", async () => {
    const extraction = {
      title: "Diplomatic structure proof",
      sourcePage: 1,
      meter: { count: 3, unit: 4 },
      tuning: [{ course: 1, pname: "e", oct: 4 }],
      sourceLayout: {
        pickupBounds: [0.05, 0.2],
        systems: [
          {
            measureStart: 1,
            rhythmTop: 0.1,
            staffTop: 0.2,
            staffBottom: 0.3,
            measureBounds: [
              [0.2, 0.55],
              [0.55, 0.9],
            ],
          },
        ],
      },
      pickup: [
        {
          kind: "pluck",
          dur: 8,
          rhythmVisible: true,
          sourceBounds: [0.08, 0.18],
          notes: [[1, 1]],
          confidence: 0.98,
        },
      ],
      sectionPickups: [
        {
          beforeMeasure: 2,
          sourceBounds: [0.05, 0.18],
          events: [
            {
              kind: "pluck",
              dur: 8,
              rhythmVisible: true,
              sourceBounds: [0.1, 0.16],
              notes: [[1, 2]],
              confidence: 0.98,
            },
          ],
        },
      ],
      measures: [
        [
          {
            kind: "pluck",
            dur: 8,
            rhythmVisible: false,
            simultaneity: "pince",
            sourceBounds: [0.3, 0.5],
            notes: [[1, 3]],
            confidence: 0.98,
          },
        ],
        [
          {
            kind: "pluck",
            dur: 4,
            rhythmVisible: true,
            sourceBounds: [0.6, 0.8],
            notes: [[1, 3]],
            confidence: 0.98,
          },
        ],
      ],
    };

    const built = buildDiplomaticMei(extraction);
    expect(built.mei).toContain(
      '<measure xml:id="pickup-measure" facs="#zone-pickup-measure" n="0" metcon="false"'
    );
    expect(built.mei).toContain('<tabDurSym xml:id="pickup-rhythm-1"');
    expect(built.mei).toContain(
      '<measure xml:id="section-2-pickup-measure" facs="#zone-section-2-pickup-measure" n="1a" metcon="false"'
    );
    expect(built.mei).toContain('xml:id="section-2-pickup-e1-n1"');
    expect(built.mei).toContain(
      '<tabGrp xml:id="m1-event-1" dur="8" type="pince" facs="#zone-m1-event-1"><note'
    );
    expect(built.mei).not.toContain('xml:id="m1-rhythm-1"');
    expect(built.tokens).toContainEqual(
      expect.objectContaining({ id: "m1-event-1", kind: "pince" })
    );

    const rendered = await renderMeiWithVerovio(
      built.mei,
      built.tokens.filter(({ kind }) => kind === "tablature").map(({ id }) => id)
    );
    expect(rendered.svg).toContain('data-id="pickup-e1-n1"');
    expect(rendered.svg).toContain('data-id="section-2-pickup-e1-n1"');
    expect(rendered.svg).toContain('data-id="m1-e1-n1"');
  });

  it("keeps all provisional tokens source-linked and renderable without accepting them", async () => {
    const extraction = JSON.parse(
      readFileSync("resources/editions/devisee-page9-provisional.json", "utf8")
    );
    const built = buildDiplomaticMei(extraction);

    expect(extraction.measures).toHaveLength(15);
    expect(built.tokens).toHaveLength(184);
    expect(new Set(built.tokens.map((token) => token.id)).size).toBe(built.tokens.length);
    expect(built.tokens.every((token) => token.region.page === 9)).toBe(true);
    expect(built.tokens.some((token) => token.critical)).toBe(true);
    expect(built.tokens.some((token) => !token.critical)).toBe(true);
    const seventhMeasureCritical = built.tokens.find(({ id }) => id === "m7-e2-n1")!;
    expect(seventhMeasureCritical.region.x).toBeGreaterThan(0.7);
    expect(seventhMeasureCritical.region.y).toBeGreaterThan(0.3);
    expect(built.mei).toContain('<sb/><measure xml:id="measure-4"');
    expect(built.mei).toContain(
      '<sb/><measure xml:id="section-2-pickup-measure" facs="#zone-section-2-pickup-measure" n="7a" metcon="false"'
    );
    expect(built.mei).toContain('</measure><measure xml:id="measure-8"');
    expect(built.mei).toContain('<sb/><measure xml:id="measure-12"');
    expect(built.mei).toContain(
      '<measure xml:id="measure-7" facs="#zone-measure-7" n="7" right="rptend"'
    );
    expect(built.mei).toContain(
      '<measure xml:id="measure-15" facs="#zone-measure-15" n="15" right="rptend"'
    );
    for (const token of built.tokens) {
      expect(built.mei).toContain(`xml:id="${token.id}"`);
      expect(built.mei).toContain(`facs="#zone-${token.id}"`);
      expect(built.mei).toContain(`xml:id="zone-${token.id}"`);
    }

    const rendered = await renderMeiWithVerovio(
      built.mei,
      built.tokens.filter((token) => token.kind === "tablature").map((token) => token.id)
    );
    expect(rendered.svg).toContain('data-id="m1-strum-1"');
    expect(rendered.svg).toContain('data-id="m1-e3-n1"');
    expect(rendered.svg).toContain('data-id="m15-e3-n1"');
    expect(rendered.events).toHaveLength(
      built.tokens.filter((token) => token.kind === "tablature").length
    );
  });
});
