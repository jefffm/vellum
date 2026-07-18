import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildDiplomaticMei } from "../../scripts/lib/build-diplomatic-mei.mjs";
import { renderMeiWithVerovio } from "../../src/lib/verovio-renderer.js";

describe("de Visée page 9 provisional diplomatic extraction", () => {
  it("keeps all provisional tokens source-linked and renderable without accepting them", async () => {
    const extraction = JSON.parse(
      readFileSync("resources/editions/devisee-page9-provisional.json", "utf8")
    );
    const built = buildDiplomaticMei(extraction);

    expect(extraction.measures).toHaveLength(16);
    expect(built.tokens).toHaveLength(191);
    expect(new Set(built.tokens.map((token) => token.id)).size).toBe(built.tokens.length);
    expect(built.tokens.every((token) => token.region.page === 9)).toBe(true);
    expect(built.tokens.some((token) => token.critical)).toBe(true);
    expect(built.tokens.some((token) => !token.critical)).toBe(true);
    const seventhMeasureCritical = built.tokens.find(({ id }) => id === "m7-rhythm-1")!;
    expect(seventhMeasureCritical.region.x).toBeGreaterThan(0.7);
    expect(seventhMeasureCritical.region.y).toBeGreaterThan(0.3);
    expect(built.mei).toContain('<sb/><measure xml:id="measure-4"');
    expect(built.mei).toContain('<sb/><measure xml:id="measure-8"');
    expect(built.mei).toContain('<sb/><measure xml:id="measure-13"');
    for (const token of built.tokens) {
      expect(built.mei).toContain(`xml:id="${token.id}"`);
      expect(built.mei).toContain(`facs="#zone-${token.id}"`);
      expect(built.mei).toContain(`xml:id="zone-${token.id}"`);
    }

    const rendered = await renderMeiWithVerovio(
      built.mei,
      built.tokens.filter((token) => token.kind === "tablature").map((token) => token.id)
    );
    expect(rendered.svg).toContain('data-id="m1-e1-n1"');
    expect(rendered.svg).toContain('data-id="m16-e3-n1"');
    expect(rendered.events).toHaveLength(
      built.tokens.filter((token) => token.kind === "tablature").length
    );
  });
});
