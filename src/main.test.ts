import { describe, expect, it, vi } from "vitest";

import { loadAllBrowserProfiles } from "./lib/browser-profiles.js";
import { buildSystemPrompt } from "./prompts.js";

function installBrowserUiStubs(): void {
  vi.stubGlobal("DOMMatrix", class DOMMatrix {});
}

describe("browser entry wiring", () => {
  it("loads browser profiles and builds a non-empty system prompt", () => {
    const prompt = buildSystemPrompt(loadAllBrowserProfiles());

    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(prompt).toContain("Vellum");
    expect(prompt).toContain("baroque-lute-13");
  });

  it("collects exactly 10 uniquely named tools", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("./main.js");

    expect(vellumTools).toHaveLength(10);

    const names = vellumTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "tabulate",
      "voicings",
      "check_playability",
      "theory",
      "compile",
      "analyze",
      "lint",
      "transpose",
      "diapasons",
      "fretboard",
    ]);
  });

  it("defines complete tool metadata and execute functions", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("./main.js");

    for (const tool of vellumTools) {
      expect(tool.name).toEqual(expect.any(String));
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description).toEqual(expect.any(String));
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toBeDefined();
      expect(tool.execute).toEqual(expect.any(Function));
    }
  });

  it("creates an Agent with the default model, prompt, and all tools", async () => {
    installBrowserUiStubs();
    const { createAgent, vellumTools } = await import("./main.js");

    const agent = createAgent();

    expect(agent.state.model.provider).toBe("openai-codex");
    expect(agent.state.model.id).toBe("gpt-5.3-codex");
    expect(agent.state.systemPrompt).toContain("Vellum");
    expect(agent.state.tools.map((tool) => tool.name)).toEqual(
      vellumTools.map((tool) => tool.name)
    );
  });
});
