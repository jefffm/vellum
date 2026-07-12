import { describe, expect, it } from "vitest";

import { createNodeGeneratedArtifactSecurity } from "./generated-artifact-security-node.js";

const SAFE_SVG = `<svg xmlns="http://www.w3.org/2000/svg"><g data-arrangement-event-id="event.1" data-measure-id="measure.1"><path d="M 0 0 L 1 1"/></g></svg>`;

describe("Node generated artifact security adapter", () => {
  it("sanitizes SVG and report profiles through an isolated jsdom window", () => {
    const security = createNodeGeneratedArtifactSecurity();
    try {
      const svg = security.sanitizeNotationSvg(SAFE_SVG);
      const report = security.sanitizeEvaluationReport(
        `<section><p>Safe</p><script>alert(1)</script></section>`
      );

      expect(svg.markup).toContain('data-arrangement-event-id="event.1"');
      expect(report.markup).toContain("<p>Safe</p>");
      expect(report.markup).not.toContain("script");
    } finally {
      security.dispose();
    }
  });

  it("keeps configuration isolated between adapters", () => {
    const constrained = createNodeGeneratedArtifactSecurity({ maxInputBytes: 32 });
    const normal = createNodeGeneratedArtifactSecurity();
    try {
      expect(() => constrained.sanitizeNotationSvg(SAFE_SVG)).toThrowError(
        expect.objectContaining({ code: "input_too_large" })
      );
      expect(normal.sanitizeNotationSvg(SAFE_SVG).markup).toContain("<path");
    } finally {
      constrained.dispose();
      normal.dispose();
    }
  });

  it("fails closed after disposal and permits idempotent disposal", () => {
    const security = createNodeGeneratedArtifactSecurity();
    security.dispose();
    security.dispose();

    expect(() => security.sanitizeNotationSvg(SAFE_SVG)).toThrowError(
      expect.objectContaining({ code: "unsupported_environment" })
    );
  });
});
