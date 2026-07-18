import { describe, expect, it } from "vitest";
import {
  VELLUM_APP_CONTENT_SECURITY_POLICY,
  VELLUM_BROWSER_SECURITY_HEADERS,
} from "./content-security-policy.js";

describe("Vellum browser content-security policy", () => {
  it("permits the local app transport without granting script or object fallbacks", () => {
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).toContain("'wasm-unsafe-eval'");
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).toContain("ws://127.0.0.1:*");
    expect(VELLUM_APP_CONTENT_SECURITY_POLICY).not.toMatch(
      /script-src[^;]*(?:'unsafe-inline'|'unsafe-eval'|\*)/
    );
  });

  it("ships CSP with nosniff and a no-referrer policy as one header set", () => {
    expect(VELLUM_BROWSER_SECURITY_HEADERS).toMatchObject({
      "Content-Security-Policy": VELLUM_APP_CONTENT_SECURITY_POLICY,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
  });
});
