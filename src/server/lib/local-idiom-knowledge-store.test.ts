import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateBaroqueGuitarGesture } from "../../lib/baroque-guitar-arranger.js";
import { baroqueGuitarPunteadoPolicyForTarget } from "../../lib/local-idiom-knowledge.js";
import type { ArrangementEvent } from "../../lib/music-domain.js";
import { LocalIdiomKnowledgeStore } from "./local-idiom-knowledge-store.js";

describe("incremental source-backed idiom knowledge", () => {
  const roots: string[] = [];
  afterEach(() =>
    roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
  );

  it("keeps extraction inert, explicitly reviews v2, and reversibly changes only punteado", () => {
    const ownerRoot = mkdtempSync(path.join(tmpdir(), "vellum-local-idiom-"));
    roots.push(ownerRoot);
    const store = new LocalIdiomKnowledgeStore({
      ownerRoot,
      repositoryRoot: process.cwd(),
    });

    expect(store.snapshot().activeVersion).toBe(1);
    const extracted = store.extractBundledSource();
    expect(extracted.candidate).toMatchObject({ status: "proposed", activationAllowed: false });
    expect(extracted.candidate?.source).toMatchObject({
      sha256: "8991a09bce4a4a0011f29ac63a4033ad96a476bf70051db9be41a99b347c585c",
      byteLength: 48_655,
      bibliographicIdentity: { author: "Gaspar Sanz", publicationYear: 1697 },
      rightsBasis: { status: "public_domain" },
      citedSegment: { sourcePage: 17, excerptPage: 1 },
    });
    expect(extracted.activeVersion).toBe(1);

    const reviewed = store.review({
      reviewedAt: "2026-07-16T12:00:00.000Z",
      rationale: "The source explicitly permits a fourth finger for a necessary fourth voice.",
    });
    expect(reviewed.reviewed).toMatchObject({
      reviewState: "reviewed",
      reviewedBy: "owner",
      pack: {
        version: 2,
        authorityLane: "historical_practice",
        domain: "instrument_technique",
        applicability: {
          instrumentFamily: "five-course-baroque-guitar",
          technique: "punteado",
        },
      },
    });
    expect(reviewed.activeVersion).toBe(1);

    const fourVoicePunteado = gestureWithFourRightHandResources();
    expect(validateBaroqueGuitarGesture(fourVoicePunteado, reviewed.activePack)).toContain(
      "baroque_guitar.punteado_oversized_attack"
    );
    const activated = store.activate(2);
    expect(validateBaroqueGuitarGesture(fourVoicePunteado, activated.activePack)).toEqual([]);
    expect(
      baroqueGuitarPunteadoPolicyForTarget(activated.activePack, "baroque-lute-13")
    ).toBeUndefined();
    expect(
      baroqueGuitarPunteadoPolicyForTarget(activated.activePack, "classical-guitar-6")
    ).toBeUndefined();

    const reloaded = new LocalIdiomKnowledgeStore({ ownerRoot }).snapshot();
    expect(reloaded.activeVersion).toBe(2);
    expect(reloaded.activePack.citation.locator).toContain("fourth right-hand finger");
    expect(() =>
      store.review({
        reviewedAt: "2026-07-17T12:00:00.000Z",
        rationale: "An attempted rewrite of the already reviewed version.",
      })
    ).toThrow("immutable after review");
    expect(store.activate(1).activePack).toMatchObject({
      version: 1,
      authorityLane: "software_heuristic",
      consequence: { maximumSimultaneousAttacks: 3 },
    });
  });
});

function gestureWithFourRightHandResources(): NonNullable<
  ArrangementEvent["baroqueGuitarGesture"]
> {
  return {
    technique: "punteado",
    attackCourses: [1, 2, 3, 4],
    contiguousAttack: true,
    soundingPitches: ["G4", "D4", "B3", "G3"],
    rightHandFingers: [
      { course: 4, finger: "p" },
      { course: 3, finger: "i" },
      { course: 2, finger: "m" },
      { course: 1, finger: "a" },
    ],
    notationAttack: "simultaneous",
  };
}
