import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeTool, compileTool, lintTool } from "./server-tools.js";

describe("server fetch wrapper tools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats successful compile responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          data: { svg: "<svg/>", errors: [], barCount: 4, voiceCount: 2 },
        })
      )
    );

    const result = await compileTool.execute("call-1", { source: "{ c'4 }" });

    expect(result.content[0]).toEqual({
      type: "text",
      text: "Compiled successfully. 4 bars. 2 voices. No errors.",
    });
    expect(result.details.svg).toBe("<svg/>");
  });

  it("formats compile responses with errors as failed compilations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          data: {
            errors: [{ bar: 0, beat: 0, line: 3, type: "lilypond", message: "syntax error" }],
          },
        })
      )
    );

    const result = await compileTool.execute("call-1", { source: "{ invalid }" });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Compilation failed with 1 error(s)");
      expect(result.content[0].text).toContain("Line 3: syntax error");
    }
  });

  it("formats analyze responses with key, voices, and chords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          data: {
            key: "D major",
            timeSignature: "4/4",
            voices: [{ name: "Soprano", lowest: "D4", highest: "E5" }],
            chords: [
              { bar: 1, beat: 1, pitches: ["D4", "F#4", "A4"], romanNumeral: "I" },
              { bar: 1, beat: 2, pitches: ["A3", "C#4", "E4"], romanNumeral: "V" },
            ],
          },
        })
      )
    );

    const result = await analyzeTool.execute("call-1", { source: "<score-partwise/>" });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Key: D major");
      expect(result.content[0].text).toContain("Soprano (D4–E5)");
      expect(result.content[0].text).toContain("Bar 1: I | V");
    }
    expect(result.details.key).toBe("D major");
  });

  it("formats lint responses with violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          data: {
            violations: [
              {
                bar: 4,
                beat: 1,
                type: "parallel_fifths",
                description: "Parallel fifths between soprano and bass",
                voices: ["Soprano", "Bass"],
              },
            ],
          },
        })
      )
    );

    const result = await lintTool.execute("call-1", { source: "<score-partwise/>" });

    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("1 violation(s) found");
      expect(result.content[0].text).toContain(
        "Bar 4, beat 1: Parallel fifths between soprano and bass [Soprano, Bass]"
      );
    }
    expect(result.details.violations).toHaveLength(1);
  });

  it("formats clean lint responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: true, data: { violations: [] } }))
    );

    const result = await lintTool.execute("call-1", { source: "<score-partwise/>" });

    expect(result.content[0]).toEqual({
      type: "text",
      text: "No voice leading violations found. Passage is clean.",
    });
    expect(result.details.violations).toEqual([]);
  });

  it("passes AbortSignal to all fetch wrapper tools", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (endpoint: string, _init?: RequestInit) => {
      if (endpoint === "/api/compile") {
        return jsonResponse({ ok: true, data: { errors: [] } });
      }
      if (endpoint === "/api/analyze") {
        return jsonResponse({
          ok: true,
          data: { key: "C major", timeSignature: "4/4", voices: [], chords: [] },
        });
      }
      return jsonResponse({ ok: true, data: { violations: [] } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await compileTool.execute("compile-call", { source: "{ c'4 }" }, controller.signal);
    await analyzeTool.execute("analyze-call", { source: "<score-partwise/>" }, controller.signal);
    await lintTool.execute("lint-call", { source: "<score-partwise/>" }, controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ signal: controller.signal }));
    }
  });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers: { "Content-Type": "application/json" },
  });
}
