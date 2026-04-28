import { describe, expect, it, vi } from "vitest";

function installBrowserUiStubs(): void {
  vi.stubGlobal("DOMMatrix", class DOMMatrix {});
}

describe("agent conversation (mocked)", () => {
  it("agent has 11 tools with correct names", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("../../src/main.js");

    expect(vellumTools).toHaveLength(11);
    expect(vellumTools.map((t) => t.name)).toEqual([
      "tabulate",
      "voicings",
      "check_playability",
      "theory",
      "compile",
      "engrave",
      "analyze",
      "lint",
      "transpose",
      "diapasons",
      "fretboard",
    ]);
  });

  it("system prompt contains instrument guidance", async () => {
    installBrowserUiStubs();
    const { createAgent } = await import("../../src/main.js");

    const agent = createAgent();

    expect(agent.state.systemPrompt).toContain("Vellum");
    expect(agent.state.systemPrompt).toContain("baroque-lute-13");
  });

  it("tabulate tool executes and returns positions", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("../../src/main.js");

    const tabulate = vellumTools.find((t) => t.name === "tabulate")!;
    const result = await tabulate.execute("call-tab", {
      pitch: "D4",
      instrument: "baroque-lute-13",
    });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("D4");
    }
    expect(result.details).toHaveProperty("positions");
    expect(Array.isArray(result.details.positions)).toBe(true);
    expect(result.details.positions.length).toBeGreaterThan(0);
  });

  it("voicings tool executes and returns voicings", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("../../src/main.js");

    const voicings = vellumTools.find((t) => t.name === "voicings")!;
    const result = await voicings.execute("call-voicings", {
      notes: ["D3", "A3", "D4", "F4"],
      instrument: "baroque-lute-13",
    });

    expect(result.content[0]?.type).toBe("text");
    expect(result.details).toHaveProperty("voicings");
    expect(Array.isArray(result.details.voicings)).toBe(true);
    expect(result.details.voicings.length).toBeGreaterThan(0);
  });

  it("theory tool executes interval computation", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("../../src/main.js");

    const theory = vellumTools.find((t) => t.name === "theory")!;
    const result = await theory.execute("call-theory", {
      operation: "interval",
      args: { from: "C4", to: "G4" },
    });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("5");
    }
  });

  it("compile tool formatContent handles success", async () => {
    installBrowserUiStubs();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              data: { svg: "<svg/>", errors: [], barCount: 8, voiceCount: 3 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    const { vellumTools } = await import("../../src/main.js");
    const compile = vellumTools.find((t) => t.name === "compile")!;
    const result = await compile.execute("call-compile", { source: "{ c'4 }" });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Compiled successfully");
      expect(result.content[0].text).toContain("8 bars");
      expect(result.content[0].text).toContain("3 voices");
    }

    vi.unstubAllGlobals();
  });

  it("compile tool formatContent handles errors", async () => {
    installBrowserUiStubs();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              data: {
                errors: [{ bar: 1, beat: 0, line: 5, type: "lilypond", message: "syntax error" }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    const { vellumTools } = await import("../../src/main.js");
    const compile = vellumTools.find((t) => t.name === "compile")!;
    const result = await compile.execute("call-compile-err", { source: "bad" });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Compilation failed");
      expect(result.content[0].text).toContain("syntax error");
    }

    vi.unstubAllGlobals();
  });

  it("fretboard tool executes with valid positions", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("../../src/main.js");

    const fretboard = vellumTools.find((t) => t.name === "fretboard")!;
    const result = await fretboard.execute("call-fretboard", {
      positions: [
        { course: 1, fret: 0, quality: "open" },
        { course: 3, fret: 2, quality: "low_fret" },
      ],
      instrument: "baroque-lute-13",
    });

    expect(result.content[0]?.type).toBe("text");
    expect(result.details).toBeDefined();
  });

  it("diapasons tool executes with a key", async () => {
    installBrowserUiStubs();
    const { vellumTools } = await import("../../src/main.js");

    const diapasons = vellumTools.find((t) => t.name === "diapasons")!;
    const result = await diapasons.execute("call-diapasons", {
      key: "D minor",
      instrument: "baroque-lute-13",
    });

    expect(result.content[0]?.type).toBe("text");
    expect(result.details).toBeDefined();
  });
});
