import { describe, expect, it } from "vitest";
import { loadAllBrowserProfiles } from "./lib/browser-profiles.js";
import { buildSystemPrompt } from "./prompts.js";

describe("buildSystemPrompt", () => {
  it("includes all required sections with instrument profiles", () => {
    const profiles = loadAllBrowserProfiles();
    const prompt = buildSystemPrompt(profiles);

    // Role description
    expect(prompt).toContain("Vellum");
    expect(prompt).toContain("music arrangement specialist");

    // All tool names
    for (const tool of [
      "tabulate",
      "voicings",
      "check_playability",
      "compile",
      "analyze",
      "lint",
      "theory",
    ]) {
      expect(prompt).toContain(`\`${tool}\``);
    }

    // Instrument profiles
    expect(prompt).toContain("baroque-lute-13");
    expect(prompt).toContain("baroque-guitar-5");

    // Workflow steps
    expect(prompt).toContain("source file");
    expect(prompt).toContain("MusicXML");

    // Source-file-first warning
    expect(prompt).toContain("working from memory");
    expect(prompt).toContain("verify the pitches against a reference score");
  });

  it("works with an empty instrument list", () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt).toContain("Vellum");
    expect(prompt).toContain("`compile`");
    expect(prompt).toContain("`lint`");
    expect(prompt).not.toContain("## Instruments");
  });

  it("stays within rough token budget", () => {
    const profiles = loadAllBrowserProfiles();
    const prompt = buildSystemPrompt(profiles);
    const roughTokens = prompt.length / 4;

    expect(roughTokens).toBeLessThan(8000);
  });
});
