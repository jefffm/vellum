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
      view: { kind: "current" },
      head: {
        snapshotId: "reference-source-snapshot.1111111111111111",
        digest: "a".repeat(64),
        revision: 3,
      },
      snapshot: {
        records: [
          {
            recordKind: "identity_assertion",
            id: "file:///Users/owner/ALLOWED-ID-PRIVATE-PATH-CANARY.pdf",
            title: "ALLOWED-TITLE-PRIVATE-BYTES-CANARY",
            claimant: "legacy_import",
            identityConfidence: { kind: "unknown" },
            confidence: {
              kind: "assessed",
              value: 0.72,
              basis: "file:///Users/owner/ALLOWED-BASIS-PRIVATE-PATH-CANARY.pdf",
            },
            conflictState: "unresolved",
            reason: "/Users/owner/ALLOWED-REASON-PRIVATE-PATH-CANARY.pdf",
            statement: "/single-component-private.pdf",
            rationale: "ALLOWED-RATIONALE-PRIVATE-BYTES-CANARY",
            sha256: "ALLOWED-DIGEST-PRIVATE-BYTES-CANARY",
            storedPath: "/Users/owner/private/never-render-this.pdf",
            retrievalUri: "file:///Users/owner/private/never-render-this.pdf",
            bytes: "RAW-PRIVATE-BYTES-CANARY",
          },
        ],
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
          {
            id: "/Users/owner/ALLOWED-LEGACY-ID-PRIVATE-PATH-CANARY.pdf",
            title: "ALLOWED-LEGACY-TITLE-PRIVATE-BYTES-CANARY",
            citation: "file:///Users/owner/ALLOWED-LEGACY-CITATION-PRIVATE-PATH-CANARY.pdf",
            mimeType: "application/pdf",
            sha256: "c".repeat(64),
            byteLength: 8192,
            identityConfidence: {
              kind: "assessed",
              value: 0.91,
              basis: "/Users/owner/ALLOWED-LEGACY-BASIS-PRIVATE-PATH-CANARY.pdf",
            },
          },
        ],
      },
      capabilities: { stagingTransactions: true, canonicalPublication: false },
    });

    expect(container.textContent).toContain("Staging only · read-only compatibility view");
    expect(container.textContent).toContain("Canonical publication is disabled");
    expect(container.textContent).toContain("Current CAS head");
    expect(container.textContent).toContain("identity confidence unassessed");
    expect(container.textContent).toContain("identity assertion records 1");
    expect(container.textContent).toContain("Unresolved lute source");
    expect(container.querySelector(".reference-source-staging-legacy")?.textContent).toContain(
      "identity confidence unassessed"
    );
    expect(container.textContent).not.toContain("never-render-this");
    expect(container.textContent).not.toContain("file://");
    expect(container.textContent).not.toContain("PRIVATE-BYTES-CANARY");
    expect(container.textContent).not.toContain("ALLOWED-ID-");
    expect(container.textContent).not.toContain("ALLOWED-TITLE-");
    expect(container.textContent).not.toContain("ALLOWED-REASON-");
    expect(container.textContent).not.toContain("single-component-private");
    expect(container.textContent).not.toContain("ALLOWED-RATIONALE-");
    expect(container.textContent).not.toContain("ALLOWED-DIGEST-");
    expect(container.textContent).not.toContain("ALLOWED-LEGACY-");
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
      view: { kind: "current" },
      head: null,
      snapshot: { works: [{ id: "work.should-not-render" }] },
      capabilities: { stagingTransactions: true, canonicalPublication: true },
    });

    expect(container.textContent).toBe("Staging diagnostics are not available in this build.");
    expect(container.textContent).not.toContain("work.should-not-render");
  });

  it("labels a historical snapshot separately from the live CAS head", () => {
    const container = document.createElement("div");
    renderReferenceSourceStagingDiagnostics(container, {
      publicationState: "staging_only",
      view: {
        kind: "historical",
        viewedSnapshotRef: { id: "snapshot.historical", digest: "b".repeat(64) },
      },
      head: { snapshotId: "snapshot.current", digest: "a".repeat(64), revision: 4 },
      snapshot: { records: [] },
      capabilities: { stagingTransactions: true, canonicalPublication: false },
    });

    expect(container.textContent).toContain("Current CAS head snapshot.current · revision 4");
    expect(container.textContent).toContain("Viewed historical snapshot snapshot.historical");
    expect(container.textContent).not.toContain("Current CAS head snapshot.historical");
  });
});
