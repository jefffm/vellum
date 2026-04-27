import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { ToolRenderer } from "@mariozechner/pi-web-ui";
import { describe, expect, it, vi } from "vitest";

import type { FretboardResult } from "./fretboard.js";
import type { CompileResult, PlayabilityResult } from "./types.js";

function installBrowserUiStubs(): void {
  vi.stubGlobal("DOMMatrix", class DOMMatrix {});
}

function toolResult<TDetails>(toolName: string, details?: TDetails): ToolResultMessage<TDetails> {
  return {
    role: "toolResult",
    toolCallId: "call-1",
    toolName,
    content: [],
    details,
    isError: false,
    timestamp: Date.now(),
  };
}

function templateText(content: unknown): string {
  const template = content as { strings?: readonly string[] };
  return template.strings?.join("") ?? "";
}

describe("tool renderers", () => {
  it("registerRenderers can be called and registers all custom renderers", async () => {
    installBrowserUiStubs();
    const [{ registerRenderers }, { getToolRenderer }] = await Promise.all([
      import("./renderers.js"),
      import("@mariozechner/pi-web-ui"),
    ]);

    expect(() => registerRenderers()).not.toThrow();
    expect(getToolRenderer("compile")).toBeDefined();
    expect(getToolRenderer("fretboard")).toBeDefined();
    expect(getToolRenderer("check_playability")).toBeDefined();
  });

  it("renders successful compile SVGs as custom content", async () => {
    const compile = await getRegisteredRenderer<unknown, CompileResult>("compile");

    const result = compile.render(
      undefined,
      toolResult("compile", { svg: "<svg><text>ok</text></svg>", errors: [] }),
      false
    );

    expect(result.isCustom).toBe(true);
  });

  it("falls back for compile results with no details", async () => {
    const compile = await getRegisteredRenderer<unknown, CompileResult>("compile");

    const result = compile.render(undefined, undefined, false);

    expect(result.isCustom).toBe(false);
  });

  it("renders compile errors as custom content", async () => {
    const compile = await getRegisteredRenderer<unknown, CompileResult>("compile");

    const result = compile.render(
      undefined,
      toolResult("compile", {
        errors: [{ bar: 1, beat: 1, line: 12, type: "lilypond", message: "syntax error" }],
      }),
      false
    );

    expect(result.isCustom).toBe(true);
    expect(templateText(result.content)).toContain("error(s)");
  });

  it("renders fretboard SVGs as custom content", async () => {
    const fretboard = await getRegisteredRenderer<unknown, FretboardResult>("fretboard");

    const result = fretboard.render(
      undefined,
      toolResult("fretboard", { svg: "<svg></svg>", coursesShown: 6, fretsShown: 4 }),
      false
    );

    expect(result.isCustom).toBe(true);
  });

  it("renders clean playability results with Playable text", async () => {
    const checkPlayability = await getRegisteredRenderer<unknown, PlayabilityResult>(
      "check_playability"
    );

    const result = checkPlayability.render(
      undefined,
      toolResult("check_playability", {
        violations: [],
        difficulty: "beginner",
        flagged_bars: [],
      }),
      false
    );

    expect(result.isCustom).toBe(true);
    expect(templateText(result.content)).toContain("Playable");
  });

  it("falls back for playability results with no details", async () => {
    const checkPlayability = await getRegisteredRenderer<unknown, PlayabilityResult>(
      "check_playability"
    );

    const result = checkPlayability.render(undefined, undefined, false);

    expect(result.isCustom).toBe(false);
  });

  it("renders streaming placeholders as custom content", async () => {
    const compile = await getRegisteredRenderer<unknown, CompileResult>("compile");
    const fretboard = await getRegisteredRenderer<unknown, FretboardResult>("fretboard");
    const checkPlayability = await getRegisteredRenderer<unknown, PlayabilityResult>(
      "check_playability"
    );

    expect(compile.render(undefined, undefined, true).isCustom).toBe(true);
    expect(fretboard.render(undefined, undefined, true).isCustom).toBe(true);
    expect(checkPlayability.render(undefined, undefined, true).isCustom).toBe(true);
  });
});

async function getRegisteredRenderer<TParams, TDetails>(
  name: string
): Promise<ToolRenderer<TParams, TDetails>> {
  installBrowserUiStubs();
  const [{ registerRenderers }, { getToolRenderer }] = await Promise.all([
    import("./renderers.js"),
    import("@mariozechner/pi-web-ui"),
  ]);
  registerRenderers();

  const renderer = getToolRenderer(name) as ToolRenderer<TParams, TDetails> | undefined;
  if (!renderer) {
    throw new Error(`Renderer not registered: ${name}`);
  }

  return renderer;
}
