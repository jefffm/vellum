// @vitest-environment jsdom

import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { ToolRenderer } from "@mariozechner/pi-web-ui";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FretboardResult } from "./fretboard.js";
import type { CompileResult, PlayabilityResult } from "./types.js";

function installBrowserUiStubs(): void {
  vi.stubGlobal("DOMMatrix", class DOMMatrix {});
}

afterEach(() => {
  document.body.replaceChildren();
});

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

  it("renders successful compile SVGs as a compact preview-opened summary", async () => {
    const compile = await getRegisteredRenderer<unknown, CompileResult>("compile");

    const result = compile.render(
      undefined,
      toolResult("compile", { svg: "<svg><text>ok</text></svg>", errors: [] }),
      false
    );

    expect(result.isCustom).toBe(true);
    expect(templateText(result.content)).toContain("preview opened");
    expect(templateText(result.content)).not.toContain("<svg");
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
      toolResult("fretboard", {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        coursesShown: 6,
        fretsShown: 4,
      }),
      false
    );

    expect(result.isCustom).toBe(true);
    const container = document.createElement("div");
    render(result.content, container);
    expect(container.querySelector(".fretboard-result > svg")).not.toBeNull();
  });

  it("mounts fretboard SVG as sanitized DOM rather than executable raw markup", async () => {
    const fretboard = await getRegisteredRenderer<unknown, FretboardResult>("fretboard");
    const result = fretboard.render(
      undefined,
      toolResult("fretboard", {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="globalThis.__vellumFretboardExecuted=true">
          <script>globalThis.__vellumFretboardExecuted=true</script>
          <a href="javascript:alert(1)"><text>Course 1</text></a>
          <circle cx="5" cy="5" r="2" onclick="globalThis.__vellumFretboardExecuted=true"/>
        </svg>`,
        coursesShown: 6,
        fretsShown: 4,
      }),
      false
    );
    const container = document.createElement("div");

    render(result.content, container);

    expect(container.querySelector(".fretboard-result > svg")).not.toBeNull();
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.querySelector("script, a, [onload], [onclick], [href]")).toBeNull();
    expect(container.textContent).toContain("Course 1");
    expect((globalThis as { __vellumFretboardExecuted?: boolean }).__vellumFretboardExecuted).toBe(
      undefined
    );
  });

  it("shows a closed failure state for malformed fretboard markup", async () => {
    const fretboard = await getRegisteredRenderer<unknown, FretboardResult>("fretboard");
    const result = fretboard.render(
      undefined,
      toolResult("fretboard", {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><g></svg>',
        coursesShown: 6,
        fretsShown: 4,
      }),
      false
    );
    const container = document.createElement("div");

    render(result.content, container);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Fretboard preview unavailable"
    );
    expect(container.querySelector("svg")).toBeNull();
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
