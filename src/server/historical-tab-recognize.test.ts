import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("printed historical-tablature geometry", () => {
  it("keeps an extended event stem while attaching a strict barline to the event", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-tab-geometry-"));
    roots.push(root);
    const width = 600;
    const height = 280;
    const pixels = Array.from({ length: height }, () => Array(width).fill(255));
    for (const y of [100, 120, 140, 160, 180]) {
      for (let x = 50; x <= 550; x += 1) pixels[y]![x] = 0;
    }
    for (let y = 100; y <= 180; y += 1) {
      for (let x = 198; x <= 202; x += 1) pixels[y]![x] = 0;
    }
    for (let y = 55; y <= 160; y += 1) {
      for (let x = 318; x <= 322; x += 1) pixels[y]![x] = 0;
    }
    for (let y = 93; y <= 107; y += 1) {
      for (let x = 305; x <= 322; x += 1) pixels[y]![x] = 0;
    }
    const pagePath = path.join(root, "page.pgm");
    writeFileSync(
      pagePath,
      `P2\n${width} ${height}\n255\n${pixels.map((row) => row.join(" ")).join("\n")}\n`
    );

    const result = spawnSync(
      "python3",
      [path.resolve("src/server/historical_tab_recognize.py"), pagePath, "5"],
      { encoding: "utf8" }
    );
    expect(result.status, result.stderr).toBe(0);
    const recognized = JSON.parse(result.stdout) as {
      backend: { version: string };
      profile: { spatialRules: { shapeDistanceThreshold: number } };
      systems: Array<{
        barlines: Array<{ classification: string; region: { x: number; width: number } }>;
        events: Array<{
          anchorX: number;
          verticalCandidateIds: string[];
        }>;
      }>;
      diagnostics: string[];
    };
    const system = recognized.systems[0]!;
    const anchors = system.events.map((event) => Math.round(event.anchorX * width));

    expect(recognized.backend.version).toBe("3");
    expect(recognized.profile.spatialRules.shapeDistanceThreshold).toBe(20);
    expect(system.barlines.map((candidate) => candidate.classification)).toContain("barline-like");
    expect(anchors.some((anchor) => Math.abs(anchor - 320) <= 4)).toBe(true);
    expect(anchors.some((anchor) => Math.abs(anchor - 200) <= 4)).toBe(false);
    expect(system.events.some((event) => event.verticalCandidateIds.length > 0)).toBe(true);
    expect(recognized.diagnostics).toContain(
      "Excluded 1 clef or strict-barline anchors from musical event units."
    );
  });
});
