import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import type { WindowLike } from "dompurify";

import {
  createGeneratedArtifactSecurity,
  DEFAULT_GENERATED_ARTIFACT_MAX_INPUT_BYTES,
  type GeneratedArtifactSecurityOptions,
  GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY,
  GENERATED_ARTIFACT_POLICY_VERSION,
  GeneratedArtifactSecurityError,
} from "./generated-artifact-security.js";

const windows: JSDOM[] = [];

function createSecurity(options: GeneratedArtifactSecurityOptions = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  windows.push(dom);
  return createGeneratedArtifactSecurity(dom.window as unknown as WindowLike, options);
}

afterEach(() => {
  for (const dom of windows.splice(0)) dom.window.close();
});

describe("generated artifact security", () => {
  it("exposes one immutable versioned policy and a deny-all artifact CSP", () => {
    const security = createSecurity();

    expect(security.policyVersion).toBe(GENERATED_ARTIFACT_POLICY_VERSION);
    expect(security.maxInputBytes).toBe(DEFAULT_GENERATED_ARTIFACT_MAX_INPUT_BYTES);
    expect(Object.isFrozen(security)).toBe(true);
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).toContain("script-src 'none'");
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).toContain("style-src 'none'");
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).toContain("form-action 'none'");
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).toContain("sandbox");
    expect(GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY).not.toContain("unsafe-inline");
  });

  it("preserves LilyPond geometry, text, transforms, classes, and selection identities", () => {
    const security = createSecurity();
    const input = `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" width="210mm" height="297mm" viewBox="0 0 119.5 169">
      <g class="vellum-score-event note" data-arrangement-event-id="arrangement-event.1234" data-measure-id="measure.1" transform="translate(17.1, 22.3)">
        <line stroke-linejoin="round" stroke-linecap="round" stroke-width="0.1" stroke="currentColor" x1="0.05" y1="0" x2="93.84" y2="0"/>
        <path d="M 0 0 C 1 2 3 4 5 6" fill="currentColor"/>
        <text font-family="serif" font-weight="bold" font-size="3.49" text-anchor="start" fill="currentColor"><tspan>Greensleeves</tspan></text>
      </g>
    </svg>`;

    const result = security.sanitizeNotationSvg(input);

    expect(result).toEqual({
      policyVersion: GENERATED_ARTIFACT_POLICY_VERSION,
      profile: "notation-svg",
      markup: expect.any(String),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.markup).toContain('class="vellum-score-event note"');
    expect(result.markup).toContain('data-arrangement-event-id="arrangement-event.1234"');
    expect(result.markup).toContain('data-measure-id="measure.1"');
    expect(result.markup).toContain('transform="translate(17.1, 22.3)"');
    expect(result.markup).toContain('d="M 0 0 C 1 2 3 4 5 6"');
    expect(result.markup).toContain("Greensleeves");
  });

  it("removes LilyPond point-and-click links and style while retaining their notation", () => {
    const security = createSecurity();
    const input = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">
      <style type="text/css"><![CDATA[tspan { white-space: pre; }]]></style>
      <a style="color:inherit" xlink:href="textedit:///tmp/source.ly:1:2:3">
        <g transform="translate(1, 2)"><text><tspan>G</tspan></text><path d="M 0 0 L 1 1"/></g>
      </a>
    </svg>`;

    const result = security.sanitizeNotationSvg(input).markup;

    expect(result).not.toMatch(/<(?:a|style)\b/i);
    expect(result).not.toMatch(/(?:href|textedit:|white-space)/i);
    expect(result).toContain("<tspan>G</tspan>");
    expect(result).toContain('transform="translate(1, 2)"');
    expect(result).toContain('d="M 0 0 L 1 1"');
  });

  it("strips hostile SVG elements, handlers, resources, URLs, and CSS", () => {
    const security = createSecurity();
    const input = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" onload="globalThis.pwned=1">
      <script>globalThis.pwned=2</script>
      <style>@import url(https://attacker.invalid/a.css); path { fill: url(javascript:alert(1)); }</style>
      <foreignObject><iframe src="https://attacker.invalid/"></iframe></foreignObject>
      <animate attributeName="href" values="javascript:alert(1)" onbegin="alert(1)"/>
      <set attributeName="onload" to="alert(1)"/>
      <a href="javascript:alert(1)" xlink:href="https://attacker.invalid/"><text>Visible label</text></a>
      <image href="data:image/svg+xml,&lt;svg onload='alert(1)'/&gt;" onerror="alert(1)"/>
      <use href="https://attacker.invalid/sprite.svg#pwn"/>
      <object data="https://attacker.invalid/"></object>
      <embed src="https://attacker.invalid/"/>
      <form action="https://attacker.invalid/"><input name="secret"/></form>
      <path class="safe" style="fill:url(https://attacker.invalid/pixel)" fill="url(data:image/svg+xml,pwn)" onclick="alert(1)" d="M 0 0 L 2 2"/>
    </svg>`;

    const result = security.sanitizeNotationSvg(input).markup;

    expect(result).toContain("Visible label");
    expect(result).toContain('class="safe"');
    expect(result).toContain('d="M 0 0 L 2 2"');
    expect(result).not.toContain("attacker.invalid");
    expect(result).not.toMatch(
      /script|style=|<style|foreignobject|animate|<set\b|onload|onerror|onclick|<a\b|href=|xlink|<image|<use|<object|<embed|<form|<input|javascript:|vbscript:|data:|url\s*\(|@import/i
    );
  });

  it("sanitizes report fragments with a separate default-deny HTML profile", () => {
    const security = createSecurity();
    const input = `<section class="evaluation-card" data-arrangement-event-id="event.1" data-measure-id="measure.1" aria-label="Evaluation">
      <h2>Evaluation <strong>Card</strong></h2>
      <p style="background:url(https://attacker.invalid/pixel)" onclick="alert(1)">Preserved text <a href="javascript:alert(1)">linked explanation</a></p>
      <script>alert(1)</script><style>@import "https://attacker.invalid"</style>
      <iframe src="data:text/html,pwn"></iframe><object data="/pwn"></object><embed src="/pwn"/>
      <form action="/pwn"><input name="x"/></form><img src="https://attacker.invalid/pixel" onerror="alert(1)"/>
      <table><tbody><tr><th scope="row">Gate</th><td>Pass</td></tr></tbody></table>
    </section>`;

    const result = security.sanitizeEvaluationReport(input);

    expect(result.profile).toBe("evaluation-report");
    expect(result.markup).toContain('class="evaluation-card"');
    expect(result.markup).toContain('data-arrangement-event-id="event.1"');
    expect(result.markup).toContain('data-measure-id="measure.1"');
    expect(result.markup).toContain("linked explanation");
    expect(result.markup).toContain('<th scope="row">Gate</th>');
    expect(result.markup).not.toMatch(
      /script|style=|<style|onclick|<a\b|href=|<iframe|<object|<embed|<form|<input|<img|javascript:|data:|https?:|url\s*\(|@import/i
    );
  });

  it.each([
    ["malformed_markup", `<svg xmlns="http://www.w3.org/2000/svg"><g></svg>`],
    ["invalid_svg_root", `<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>`],
    ["prohibited_declaration", `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>`],
    ["prohibited_declaration", `<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>`],
    [
      "prohibited_declaration",
      `<!ENTITY xxe SYSTEM "file:///etc/passwd"><svg xmlns="http://www.w3.org/2000/svg"/>`,
    ],
  ])("fails closed with %s for rejected SVG input", (code, input) => {
    const security = createSecurity();

    expect(() => security.sanitizeNotationSvg(input)).toThrowError(
      expect.objectContaining({ code, profile: "notation-svg" })
    );
  });

  it("rejects empty and oversized input before sanitation", () => {
    const security = createSecurity({ maxInputBytes: 120 });

    expect(() => security.sanitizeNotationSvg(" ")).toThrowError(
      expect.objectContaining({ code: "invalid_input" })
    );
    expect(() =>
      security.sanitizeNotationSvg(
        `<svg xmlns="http://www.w3.org/2000/svg"><text>${"é".repeat(80)}</text></svg>`
      )
    ).toThrowError(expect.objectContaining({ code: "input_too_large" }));
  });

  it.each([
    [
      "node count",
      { maxNodes: 2 },
      `<svg xmlns="http://www.w3.org/2000/svg"><g><path d="M0 0"/></g></svg>`,
    ],
    [
      "tree depth",
      { maxTreeDepth: 3 },
      `<svg xmlns="http://www.w3.org/2000/svg"><g><g><path d="M0 0"/></g></g></svg>`,
    ],
    [
      "attributes per element",
      { maxAttributesPerElement: 2 },
      `<svg xmlns="http://www.w3.org/2000/svg"><g class="x" role="img" aria-label="score"/></svg>`,
    ],
    [
      "attribute value",
      { maxAttributeValueBytes: 40 },
      `<svg xmlns="http://www.w3.org/2000/svg"><g class="${"x".repeat(41)}"/></svg>`,
    ],
    [
      "path data",
      { maxPathDataBytes: 8 },
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 10 10"/></svg>`,
    ],
    [
      "text node",
      { maxTextNodeBytes: 4 },
      `<svg xmlns="http://www.w3.org/2000/svg"><text>Greensleeves</text></svg>`,
    ],
  ] satisfies Array<[string, GeneratedArtifactSecurityOptions, string]>)(
    "rejects a parsed tree that exceeds the %s budget",
    (_name, options, input) => {
      const security = createSecurity(options);

      expect(() => security.sanitizeNotationSvg(input)).toThrowError(
        expect.objectContaining({
          code: "complexity_limit_exceeded",
          profile: "notation-svg",
        })
      );
    }
  );

  it("applies complexity budgets to report input before sanitation", () => {
    const security = createSecurity({ maxTreeDepth: 3 });

    expect(() =>
      security.sanitizeEvaluationReport(
        `<section><div><p><strong>deep</strong></p></div></section>`
      )
    ).toThrowError(
      expect.objectContaining({
        code: "complexity_limit_exceeded",
        profile: "evaluation-report",
      })
    );
  });

  it("produces deterministic output without shared mutable purifier state", async () => {
    const first = createSecurity();
    const second = createSecurity();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g class="x"><path d="M 0 0 L 1 1"/></g></svg>`;
    const report = `<section class="x"><p>Same</p></section>`;

    const [a, b, c, d] = await Promise.all([
      Promise.resolve().then(() => first.sanitizeNotationSvg(svg).markup),
      Promise.resolve().then(() => second.sanitizeNotationSvg(svg).markup),
      Promise.resolve().then(() => first.sanitizeEvaluationReport(report).markup),
      Promise.resolve().then(() => second.sanitizeEvaluationReport(report).markup),
    ]);

    expect(a).toBe(b);
    expect(c).toBe(d);
    expect(first.sanitizeNotationSvg(svg).markup).toBe(a);
    expect(first.sanitizeNotationSvg(a).markup).toBe(a);
    expect(first.sanitizeEvaluationReport(c).markup).toBe(c);
  });

  it("fails construction without a DOMParser-capable WindowLike", () => {
    expect(() => createGeneratedArtifactSecurity({} as WindowLike)).toThrowError(
      expect.objectContaining({
        code: "unsupported_environment",
        profile: "notation-svg",
      } satisfies Partial<GeneratedArtifactSecurityError>)
    );
  });
});
