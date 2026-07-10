import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeMusicXml } from "./musicxml-normalizer.js";

describe("MusicXML normalizer", () => {
  it("normalizes a score into stable parts, measures, and rational events", async () => {
    const source = readFileSync(path.resolve(process.cwd(), "test/fixtures/hymn-simple.xml"));
    const score = await normalizeMusicXml(source, "hymn-simple.xml");

    expect(score.parts.length).toBeGreaterThan(0);
    expect(score.measures.length).toBeGreaterThan(0);
    expect(score.events.length).toBeGreaterThan(0);
    expect(score.events[0]).toMatchObject({
      id: expect.stringMatching(/^event\./),
      partId: expect.stringMatching(/^part\./),
      measureId: "measure.0",
      onset: { numerator: 0, denominator: 1 },
    });
    expect(score.events.every((event) => event.duration.denominator > 0)).toBe(true);
  });

  it("rejects non-MusicXML input with a structured error", async () => {
    await expect(normalizeMusicXml(Buffer.from("not xml"), "bad.xml")).rejects.toThrow(
      /normalization failed/i
    );
  });
});
