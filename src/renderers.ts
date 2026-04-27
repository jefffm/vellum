import { registerToolRenderer } from "@mariozechner/pi-web-ui";
import type { ToolRenderResult, ToolRenderer } from "@mariozechner/pi-web-ui";
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import type { CompileResult, PlayabilityResult } from "./types.js";
import type { FretboardResult } from "./fretboard.js";

function fallback(): ToolRenderResult {
  return { content: html``, isCustom: false };
}

const compileRenderer: ToolRenderer<unknown, CompileResult> = {
  render(_params, result, isStreaming) {
    if (isStreaming) {
      return { content: html`<div class="tool-status">Compiling…</div>`, isCustom: true };
    }

    if (!result?.details) {
      return fallback();
    }

    const details = result.details;
    const errors = details.errors ?? [];

    if (errors.length > 0) {
      return {
        content: html`
          <div class="compile-errors">
            <strong>${errors.length} error(s):</strong>
            <ul>
              ${errors.map((error) => html`<li>Line ${error.line}: ${error.message}</li>`)}
            </ul>
          </div>
        `,
        isCustom: true,
      };
    }

    if (details.svg || details.pdf) {
      const summary = [
        details.barCount ? `${details.barCount} bars` : undefined,
        details.voiceCount ? `${details.voiceCount} voices` : undefined,
        details.pdf ? "PDF available" : undefined,
      ].filter(Boolean);

      return {
        content: html`
          <div class="compile-summary" role="status">
            <span class="compile-summary-icon" aria-hidden="true">✓</span>
            <span>
              <strong>Compiled successfully</strong> — preview opened
              ${summary.length > 0 ? html`<small>${summary.join(" · ")}</small>` : ""}
            </span>
          </div>
        `,
        isCustom: true,
      };
    }

    return fallback();
  },
};

const fretboardRenderer: ToolRenderer<unknown, FretboardResult> = {
  render(_params, result, isStreaming) {
    if (isStreaming) {
      return { content: html`<div class="tool-status">Drawing fretboard…</div>`, isCustom: true };
    }

    const svg = result?.details?.svg;

    if (typeof svg === "string" && svg.length > 0) {
      return {
        content: html`
          <div
            class="fretboard-result"
            style="max-width:320px; padding:8px; border:1px solid #e0e0e0; border-radius:8px; background:#fff;"
          >
            ${unsafeHTML(svg)}
          </div>
        `,
        isCustom: true,
      };
    }

    return fallback();
  },
};

const checkPlayabilityRenderer: ToolRenderer<unknown, PlayabilityResult> = {
  render(_params, result, isStreaming) {
    if (isStreaming) {
      return {
        content: html`<div class="tool-status">Checking playability…</div>`,
        isCustom: true,
      };
    }

    if (!result?.details) {
      return fallback();
    }

    const details = result.details;
    const difficultyColors: Record<PlayabilityResult["difficulty"], string> = {
      beginner: "#4caf50",
      intermediate: "#ff9800",
      advanced: "#f44336",
    };
    const color = difficultyColors[details.difficulty] ?? "#999";
    const badge = html`
      <span
        style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.85em; color:#fff; background:${color}; margin-left:8px;"
      >
        ${details.difficulty}
      </span>
    `;

    if (details.violations.length === 0) {
      return {
        content: html`
          <div
            class="playability-result"
            style="padding:8px 12px; border:1px solid #e0e0e0; border-radius:8px;"
          >
            <span style="color:#4caf50; font-weight:600;">✓ Playable</span>
            ${badge}
          </div>
        `,
        isCustom: true,
      };
    }

    return {
      content: html`
        <div
          class="playability-result"
          style="padding:8px 12px; border:1px solid #e0e0e0; border-radius:8px;"
        >
          <div style="margin-bottom:6px;">
            <span style="color:#f44336; font-weight:600;"
              >⚠ ${details.violations.length} issue(s)</span
            >
            ${badge}
          </div>
          <ul style="margin:0; padding-left:20px; font-size:0.9em;">
            ${details.violations.map(
              (violation) => html`<li>Bar ${violation.bar}: ${violation.description}</li>`
            )}
          </ul>
        </div>
      `,
      isCustom: true,
    };
  },
};

export function registerRenderers(): void {
  registerToolRenderer("compile", compileRenderer);
  registerToolRenderer("fretboard", fretboardRenderer);
  registerToolRenderer("check_playability", checkPlayabilityRenderer);
}
