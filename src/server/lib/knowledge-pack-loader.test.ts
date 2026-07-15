import { describe, expect, it } from "vitest";
import {
  listQuarantinedBuiltInKnowledgePacks,
  loadBuiltInKnowledgePacks,
} from "./knowledge-pack-loader.js";

describe("reviewed built-in Historical Knowledge Base", () => {
  it("quarantines self-declared reviewed packs instead of activating their claims", () => {
    expect(loadBuiltInKnowledgePacks()).toEqual([]);
    expect(listQuarantinedBuiltInKnowledgePacks()).toEqual([
      expect.objectContaining({
        artifactId: "tracked.knowledge-pack-core-baroque-guitar",
        filename: "core-baroque-guitar.json",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        outcome: "review_required",
        reason: expect.stringContaining("Activation Decision"),
      }),
    ]);
  });
});
