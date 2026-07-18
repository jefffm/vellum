import type { WindowLike } from "dompurify";

import {
  createGeneratedArtifactSecurity,
  type GeneratedArtifactSecurity,
} from "./lib/generated-artifact-security.js";
import type { CompileResult } from "./types.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const browserSecurity = new WeakMap<object, GeneratedArtifactSecurity>();
const previewObjectUrls = new WeakMap<HTMLElement, string>();

function securityFor(document: Document): GeneratedArtifactSecurity {
  const view = document.defaultView;
  if (!view) throw new Error("Generated artifacts require a browser window");
  const existing = browserSecurity.get(view);
  if (existing) return existing;
  const security = createGeneratedArtifactSecurity(view as unknown as WindowLike);
  browserSecurity.set(view, security);
  return security;
}

function parserFor(document: Document): DOMParser {
  const Parser = document.defaultView?.DOMParser;
  if (!Parser) throw new Error("Generated artifacts require DOMParser support");
  return new Parser();
}

/**
 * Sanitize generated notation and import it into the consumer's document.
 *
 * Returning a DOM node, rather than trusted-looking markup, keeps the sole
 * string-to-DOM transition inside the generated-artifact boundary.
 */
export function createSafeNotationSvgElement(
  input: string,
  document: Document = globalThis.document
): SVGSVGElement {
  const sanitized = securityFor(document).sanitizeNotationSvg(input);
  const parsed = parserFor(document).parseFromString(sanitized.markup, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.localName.toLowerCase() !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new Error("Sanitized notation did not produce an SVG root");
  }
  return document.importNode(root, true) as unknown as SVGSVGElement;
}

export function mountSafeNotationSvg(container: HTMLElement, input: string): SVGSVGElement {
  const svg = createSafeNotationSvgElement(input, container.ownerDocument);
  container.replaceChildren(svg);
  container.dataset.artifactPolicyVersion = securityFor(container.ownerDocument).policyVersion;
  container.dataset.artifactProfile = "notation-svg";
  return svg;
}

export function createSafeVerovioSvgElement(
  input: string,
  document: Document = globalThis.document
): SVGSVGElement {
  const sanitized = securityFor(document).sanitizeVerovioSvg(input);
  const parsed = parserFor(document).parseFromString(sanitized.markup, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.localName.toLowerCase() !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new Error("Sanitized Verovio output did not produce an SVG root");
  }
  return document.importNode(root, true) as unknown as SVGSVGElement;
}

export function mountSafeVerovioSvg(container: HTMLElement, input: string): SVGSVGElement {
  const svg = createSafeVerovioSvgElement(input, container.ownerDocument);
  container.replaceChildren(svg);
  container.dataset.artifactPolicyVersion = securityFor(container.ownerDocument).policyVersion;
  container.dataset.artifactProfile = "verovio-svg";
  return svg;
}

/**
 * Minimal consumer for generated Evaluation Report fragments. T11 can build
 * richer host-owned report controls around this surface without adding a new
 * raw-HTML sink.
 */
export function renderEvaluationReportFragment(container: HTMLElement, input: string): boolean {
  try {
    const security = securityFor(container.ownerDocument);
    const sanitized = security.sanitizeEvaluationReport(input);
    const parsed = parserFor(container.ownerDocument).parseFromString(
      sanitized.markup,
      "text/html"
    );
    const nodes = Array.from(parsed.body.childNodes, (node) =>
      container.ownerDocument.importNode(node, true)
    );
    container.replaceChildren(...nodes);
    container.dataset.artifactPolicyVersion = sanitized.policyVersion;
    container.dataset.artifactProfile = sanitized.profile;
    return true;
  } catch {
    renderUnavailable(
      container,
      "Evaluation report unavailable because generated content did not pass Vellum's safety checks."
    );
    return false;
  }
}

function formatCompileMeta(details: CompileResult): string {
  const parts = [
    details.barCount ? `${details.barCount} bars` : undefined,
    details.voiceCount ? `${details.voiceCount} voices` : undefined,
    details.pdf ? "PDF available" : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Compiled successfully";
}

function createPreviewShell(document: Document, details: CompileResult): HTMLElement {
  const shell = document.createElement("section");
  shell.className = "artifact-preview-shell";

  const header = document.createElement("header");
  header.className = "artifact-preview-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "artifact-preview-eyebrow";
  eyebrow.textContent = "Compile output";
  const title = document.createElement("h1");
  title.textContent = "Score preview";
  const meta = document.createElement("p");
  meta.className = "artifact-preview-meta";
  meta.textContent = formatCompileMeta(details);
  heading.append(eyebrow, title, meta);

  const controls = document.createElement("div");
  controls.className = "artifact-preview-controls";
  controls.setAttribute("aria-label", "Preview zoom controls");
  const fit = document.createElement("button");
  fit.type = "button";
  fit.dataset.artifactFit = "";
  fit.textContent = "Fit width";
  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.dataset.artifactZoomOut = "";
  zoomOut.setAttribute("aria-label", "Zoom out");
  zoomOut.textContent = "−";
  const zoomLabel = document.createElement("span");
  zoomLabel.dataset.artifactZoomLabel = "";
  zoomLabel.textContent = "Fit width";
  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.dataset.artifactZoomIn = "";
  zoomIn.setAttribute("aria-label", "Zoom in");
  zoomIn.textContent = "+";
  controls.append(fit, zoomOut, zoomLabel, zoomIn);
  header.append(heading, controls);

  const viewport = document.createElement("div");
  viewport.className = "artifact-preview-viewport";
  const content = document.createElement("div");
  content.className = "artifact-preview-content";
  content.dataset.zoomMode = "fit";
  viewport.append(content);
  shell.append(header, viewport);
  return shell;
}

function setPreviewZoom(panel: HTMLElement, mode: "fit" | "zoom", zoomPercent: number): void {
  const content = panel.querySelector<HTMLElement>(".artifact-preview-content");
  if (!content) return;
  const nextZoom = Math.min(300, Math.max(50, zoomPercent));
  content.dataset.zoomMode = mode;
  content.style.width = mode === "fit" ? "100%" : `${nextZoom}%`;
  const zoomLabel = panel.querySelector<HTMLElement>("[data-artifact-zoom-label]");
  if (zoomLabel) zoomLabel.textContent = mode === "fit" ? "Fit width" : `${nextZoom}%`;
}

function pdfBlob(document: Document, encoded: string): Blob {
  const view = document.defaultView;
  if (!view) throw new Error("PDF preview requires a browser window");
  const binary = view.atob(encoded.replace(/\s+/g, ""));
  if (!binary.startsWith("%PDF-")) throw new Error("Generated PDF has an invalid signature");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new view.Blob([bytes], { type: "application/pdf" });
}

function mountIsolatedPdf(container: HTMLElement, encoded: string, panel: HTMLElement): void {
  const view = container.ownerDocument.defaultView;
  if (!view?.URL || typeof view.URL.createObjectURL !== "function") {
    throw new Error("PDF preview requires object URL support");
  }
  const objectUrl = view.URL.createObjectURL(pdfBlob(container.ownerDocument, encoded));
  const frame = container.ownerDocument.createElement("iframe");
  frame.className = "artifact-preview-pdf";
  frame.title = "Compiled PDF preview";
  frame.loading = "lazy";
  frame.setAttribute("sandbox", "");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.src = objectUrl;
  try {
    container.replaceChildren(frame);
    previewObjectUrls.set(panel, objectUrl);
  } catch (error) {
    view.URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function disposeArtifactPreview(panel: HTMLElement): void {
  const objectUrl = previewObjectUrls.get(panel);
  if (!objectUrl) return;
  panel.ownerDocument.defaultView?.URL.revokeObjectURL(objectUrl);
  previewObjectUrls.delete(panel);
}

function renderUnavailable(container: HTMLElement, message: string): void {
  container.replaceChildren();
  const unavailable = container.ownerDocument.createElement("p");
  unavailable.className = "artifact-preview-unavailable";
  unavailable.setAttribute("role", "alert");
  unavailable.textContent = message;
  container.append(unavailable);
  container.dataset.artifactProfile = "unavailable";
}

export function renderCompilePreview(panel: HTMLElement, details: CompileResult): boolean {
  if (details.errors.length > 0 || (!details.svg && !details.pdf)) return false;

  disposeArtifactPreview(panel);
  panel.replaceChildren();
  panel.dataset.preview = "compile";
  const shell = createPreviewShell(panel.ownerDocument, details);
  panel.append(shell);
  const content = shell.querySelector<HTMLElement>(".artifact-preview-content");
  if (!content) {
    renderUnavailable(panel, "Score preview unavailable.");
    panel.dataset.preview = "unavailable";
    return false;
  }

  try {
    if (details.svg) mountSafeNotationSvg(content, details.svg);
    else mountIsolatedPdf(content, details.pdf!, panel);
  } catch {
    renderUnavailable(
      content,
      "Score preview unavailable because the generated artifact did not pass Vellum's safety checks."
    );
    panel.dataset.preview = "unavailable";
    return false;
  }

  let zoomPercent = 100;
  shell.querySelector<HTMLButtonElement>("[data-artifact-fit]")?.addEventListener("click", () => {
    zoomPercent = 100;
    setPreviewZoom(panel, "fit", zoomPercent);
  });
  shell
    .querySelector<HTMLButtonElement>("[data-artifact-zoom-out]")
    ?.addEventListener("click", () => {
      zoomPercent -= 25;
      setPreviewZoom(panel, "zoom", zoomPercent);
    });
  shell
    .querySelector<HTMLButtonElement>("[data-artifact-zoom-in]")
    ?.addEventListener("click", () => {
      zoomPercent += 25;
      setPreviewZoom(panel, "zoom", zoomPercent);
    });
  setPreviewZoom(panel, "fit", zoomPercent);
  return true;
}
