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
      "engrave",
      "compile",
      "analyze",
      "lint",
      "theory",
      "transpose",
      "diapasons",
      "fretboard",
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

  it("includes engrave-first tablature workflow", () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt).toContain("structured musical data");
    expect(prompt).toContain("EngraveParams");
    expect(prompt).toContain("Never write raw LilyPond syntax for tab instruments");
    expect(prompt).toContain("solo-tab");
    expect(prompt).toContain("french-tab");
    expect(prompt).toContain("tab-and-staff");
    expect(prompt).toContain("voice-and-tab");
    expect(prompt).toContain("unsupported v2 templates");
    expect(prompt).toContain("grand-staff");
    expect(prompt).toContain("For edits to an existing LilyPond file");
  });

  it("includes mandatory compile and bounded retry policy", () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt).toContain("immediately call the `compile` tool with SVG output");
    expect(prompt).toContain("without asking the user for permission");
    expect(prompt).toContain('Do not send interim text like "I\'ll do that next"');
    expect(prompt).toContain("at most 3 compile attempts");
    expect(prompt).toContain('Never say variants of "proceed and I will compile/fix it"');
    expect(prompt).toContain("Only report success after `compile` returns an SVG or PDF artifact");
    expect(prompt).toContain("tab-first validated generation");
    expect(prompt).toContain("No string for pitch");
  });

  it("works with an empty instrument list", () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt).toContain("Vellum");
    expect(prompt).toContain("`compile`");
    expect(prompt).toContain("`engrave`");
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
