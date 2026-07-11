import { describe, expect, it } from "vitest";
import { loadBuiltInKnowledgePacks } from "./knowledge-pack-loader.js";

describe("reviewed built-in Historical Knowledge Base", () => {
  it("loads only schema-valid packs whose cited claims are present", () => {
    const packs = loadBuiltInKnowledgePacks();
    expect(packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pack: expect.objectContaining({
            id: "pack.builtin-baroque-guitar",
            reviewed: true,
            version: 1,
          }),
          claims: [
            expect.objectContaining({
              authority: "documented_practice",
              referenceId: "reference.builtin-sanz-1674",
              citationLocator: expect.stringContaining("Sanz"),
            }),
          ],
        }),
      ])
    );
  });
});
