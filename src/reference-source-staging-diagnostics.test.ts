// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  formatReferenceIdentityConfidence,
  renderReferenceSourceStagingDiagnostics,
} from "./reference-source-staging-diagnostics.js";

afterEach(() => document.body.replaceChildren());

describe("Reference source staging diagnostics", () => {
  it("is explicitly inert, renders unknown confidence honestly, and redacts hostile API fields", () => {
    const container = document.createElement("div");
    document.body.append(container);

    renderReferenceSourceStagingDiagnostics(container, {
      publicationState: "staging_only",
      head: {
        snapshotId: "reference-source-snapshot.1111111111111111",
        digest: "a".repeat(64),
        revision: 3,
      },
      snapshot: {
        records: {
          identityAssertions: [
            {
              id: "identity-assertion.1111111111111111",
              claimant: "legacy_import",
              identityConfidence: { kind: "unknown" },
              conflictState: "unresolved",
              storedPath: "/Users/owner/private/never-render-this.pdf",
              retrievalUri: "file:///Users/owner/private/never-render-this.pdf",
              bytes: "RAW-PRIVATE-BYTES-CANARY",
            },
          ],
        },
      },
      legacyProjection: {
        ownerReferences: [
          {
            id: "owner-reference.2222222222222222",
            title: "Unresolved lute source",
            citation: "Owner-supplied citation",
            mimeType: "application/pdf",
            sha256: "b".repeat(64),
            byteLength: 4096,
            storedPath: "/private/reference/content",
            retrievalUri: "file:///private/reference/content",
            bytes: "LEGACY-PRIVATE-BYTES-CANARY",
          },
        ],
      },
      capabilities: { stagingTransactions: true, canonicalPublication: false },
    });

    expect(container.textContent).toContain("Staging only · read-only compatibility view");
    expect(container.textContent).toContain("Canonical publication is disabled");
    expect(container.textContent).toContain("identity confidence unassessed");
    expect(container.textContent).toContain("Unresolved lute source");
    expect(container.querySelector(".reference-source-staging-legacy")?.textContent).toContain(
      "identity confidence unassessed"
    );
    expect(container.textContent).not.toContain("never-render-this");
    expect(container.textContent).not.toContain("file://");
    expect(container.textContent).not.toContain("PRIVATE-BYTES-CANARY");
    expect(container.textContent).not.toContain("storedPath");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
  });

  it("does not manufacture a percentage for absent or unknown confidence", () => {
    expect(formatReferenceIdentityConfidence(undefined)).toBe("unassessed");
    expect(formatReferenceIdentityConfidence({ kind: "unknown" })).toBe("unassessed");
    expect(formatReferenceIdentityConfidence({ kind: "assessed", value: 0.72 })).toBe("72%");
  });

  it("fails closed when the response does not prove that canonical publication is disabled", () => {
    const container = document.createElement("div");
    renderReferenceSourceStagingDiagnostics(container, {
      publicationState: "staging_only",
      head: null,
      snapshot: { works: [{ id: "work.should-not-render" }] },
      capabilities: { stagingTransactions: true, canonicalPublication: true },
    });

    expect(container.textContent).toBe("Staging diagnostics are not available in this build.");
    expect(container.textContent).not.toContain("work.should-not-render");
  });
});
