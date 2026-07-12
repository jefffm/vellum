import { JSDOM } from "jsdom";
import type { WindowLike } from "dompurify";

import {
  createGeneratedArtifactSecurity,
  GeneratedArtifactSecurityError,
  type GeneratedArtifactSecurity,
  type GeneratedArtifactSecurityOptions,
  type SanitizedGeneratedMarkup,
} from "../../lib/generated-artifact-security.js";

export type NodeGeneratedArtifactSecurity = Readonly<
  GeneratedArtifactSecurity & {
    dispose(): void;
  }
>;

/**
 * Creates an isolated jsdom-backed sanitizer for Node services.
 *
 * No window, DOMPurify instance, hooks, or configuration are shared between
 * adapters. Callers that retain an adapter must dispose it with their service.
 */
export function createNodeGeneratedArtifactSecurity(
  options: GeneratedArtifactSecurityOptions = {}
): NodeGeneratedArtifactSecurity {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://generated-artifact.invalid/",
  });
  const security = createGeneratedArtifactSecurity(dom.window as unknown as WindowLike, options);
  let disposed = false;

  const ensureActive = (profile: "notation-svg" | "evaluation-report") => {
    if (disposed) {
      throw new GeneratedArtifactSecurityError(
        "unsupported_environment",
        profile,
        "Generated artifact security adapter has been disposed"
      );
    }
  };

  return Object.freeze({
    policyVersion: security.policyVersion,
    maxInputBytes: security.maxInputBytes,
    limits: security.limits,
    sanitizeNotationSvg(input: string): SanitizedGeneratedMarkup<"notation-svg"> {
      ensureActive("notation-svg");
      return security.sanitizeNotationSvg(input);
    },
    sanitizeEvaluationReport(input: string): SanitizedGeneratedMarkup<"evaluation-report"> {
      ensureActive("evaluation-report");
      return security.sanitizeEvaluationReport(input);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      dom.window.close();
    },
  });
}
