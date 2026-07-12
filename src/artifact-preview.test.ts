// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSafeNotationSvgElement,
  disposeArtifactPreview,
  mountSafeNotationSvg,
  renderCompilePreview,
  renderEvaluationReportFragment,
} from "./artifact-preview.js";

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(window.URL, "createObjectURL");
  Reflect.deleteProperty(window.URL, "revokeObjectURL");
  vi.restoreAllMocks();
});

function panel(): HTMLElement {
  const element = document.createElement("section");
  document.body.append(element);
  return element;
}

const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10">
  <g class="vellum-score-event" data-arrangement-event-id="arrangement-event.1" data-measure-id="measure.1">
    <path d="M 0 0 L 2 2"/><text><tspan>G</tspan></text>
  </g>
</svg>`;

function installObjectUrlStubs() {
  const createObjectURL = vi.fn<(blob: Blob) => string>(
    () => "blob:https://vellum.invalid/generated-pdf"
  );
  const revokeObjectURL = vi.fn<(url: string) => void>();
  Object.defineProperties(window.URL, {
    createObjectURL: { configurable: true, value: createObjectURL },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  return { createObjectURL, revokeObjectURL };
}

describe("generated artifact browser consumers", () => {
  it("mounts sanitized notation as imported DOM while preserving score identities", () => {
    const container = panel();
    const hostile = safeSvg.replace(
      "<path",
      '<script>globalThis.__vellumExecuted = true</script><path onclick="globalThis.__vellumExecuted = true"'
    );

    const svg = mountSafeNotationSvg(container, hostile);

    expect(container.firstElementChild).toBe(svg);
    expect(svg.ownerDocument).toBe(document);
    expect(svg.querySelector("script")).toBeNull();
    expect(svg.querySelector("[onclick]")).toBeNull();
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M 0 0 L 2 2");
    const event = svg.querySelector<SVGGElement>("[data-arrangement-event-id]");
    expect(event?.dataset.arrangementEventId).toBe("arrangement-event.1");
    expect(event?.dataset.measureId).toBe("measure.1");
    expect(container.dataset.artifactProfile).toBe("notation-svg");
    expect((globalThis as { __vellumExecuted?: boolean }).__vellumExecuted).toBeUndefined();
  });

  it("creates a detached safe SVG element for Lit and other DOM consumers", () => {
    const element = createSafeNotationSvgElement(safeSvg);

    expect(element.localName).toBe("svg");
    expect(element.isConnected).toBe(false);
    expect(element.querySelector("[data-arrangement-event-id]")).not.toBeNull();
  });

  it("fails a hostile or malformed score preview closed with a visible state", () => {
    const target = panel();

    expect(
      renderCompilePreview(target, {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><g></svg>',
        errors: [],
      })
    ).toBe(false);
    expect(target.dataset.preview).toBe("unavailable");
    expect(target.querySelector("svg")).toBeNull();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      "did not pass Vellum's safety checks"
    );
  });

  it("renders a sanitized compile preview and keeps zoom controls functional", () => {
    const target = panel();

    expect(
      renderCompilePreview(target, {
        svg: safeSvg,
        errors: [],
        barCount: 2,
        voiceCount: 1,
      })
    ).toBe(true);
    const content = target.querySelector<HTMLElement>(".artifact-preview-content")!;
    expect(content.querySelector("svg")).not.toBeNull();
    expect(target.querySelector(".artifact-preview-meta")?.textContent).toBe("2 bars · 1 voices");
    target.querySelector<HTMLButtonElement>("[data-artifact-zoom-in]")!.click();
    expect(content.dataset.zoomMode).toBe("zoom");
    expect(content.style.width).toBe("125%");
    target.querySelector<HTMLButtonElement>("[data-artifact-fit]")!.click();
    expect(content.dataset.zoomMode).toBe("fit");
    expect(content.style.width).toBe("100%");
  });

  it("isolates PDF previews in a sandboxed no-referrer Blob frame and revokes URLs", () => {
    const { createObjectURL, revokeObjectURL } = installObjectUrlStubs();
    const target = panel();
    const pdf = window.btoa("%PDF-1.7\n%%EOF");

    expect(renderCompilePreview(target, { pdf, errors: [] })).toBe(true);
    const frame = target.querySelector<HTMLIFrameElement>("iframe")!;
    expect(frame.src).toBe("blob:https://vellum.invalid/generated-pdf");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe("application/pdf");

    expect(renderCompilePreview(target, { svg: safeSvg, errors: [] })).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:https://vellum.invalid/generated-pdf");

    renderCompilePreview(target, { pdf, errors: [] });
    disposeArtifactPreview(target);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("fails invalid PDF data closed without creating an object URL", () => {
    const { createObjectURL } = installObjectUrlStubs();
    const target = panel();

    expect(renderCompilePreview(target, { pdf: window.btoa("not a pdf"), errors: [] })).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(target.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("renders Evaluation Report fragments through the same inert-content policy", () => {
    const target = panel();
    const report = `<section class="evaluation-card" data-arrangement-event-id="arrangement-event.1" data-measure-id="measure.1">
      <h2>Evaluation <strong>Card</strong></h2>
      <p onclick="globalThis.__vellumReportExecuted = true">Useful <a href="javascript:alert(1)">detail</a></p>
      <script>globalThis.__vellumReportExecuted = true</script>
      <img src="https://attacker.invalid/pixel" onerror="globalThis.__vellumReportExecuted = true">
      <table><tbody><tr><th scope="row">Trust gate</th><td>Pass</td></tr></tbody></table>
    </section>`;

    expect(renderEvaluationReportFragment(target, report)).toBe(true);
    expect(target.querySelector("h2")?.textContent).toBe("Evaluation Card");
    expect(target.querySelector("table")?.textContent).toContain("Trust gate");
    expect(target.querySelector("script, img, a, [onclick], [href]")).toBeNull();
    const section = target.querySelector<HTMLElement>("section")!;
    expect(section.dataset.arrangementEventId).toBe("arrangement-event.1");
    expect(section.dataset.measureId).toBe("measure.1");
    expect(target.dataset.artifactProfile).toBe("evaluation-report");
    expect(
      (globalThis as { __vellumReportExecuted?: boolean }).__vellumReportExecuted
    ).toBeUndefined();
  });

  it("fails rejected Evaluation Report markup closed with a visible state", () => {
    const target = panel();

    expect(renderEvaluationReportFragment(target, "<!DOCTYPE html><p>unsafe declaration</p>")).toBe(
      false
    );
    expect(target.dataset.artifactProfile).toBe("unavailable");
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      "Evaluation report unavailable"
    );
  });
});
