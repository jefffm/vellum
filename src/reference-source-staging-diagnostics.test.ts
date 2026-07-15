// @vitest-environment jsdom

import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatReferenceIdentityConfidence,
  renderReferenceSourceLifecycleDryRun,
  renderReferenceSourceStagingDiagnostics,
  type ReferenceSourceLifecycleDryRunRequest,
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

  it("offers a sealed deletion dry run only for a current lifecycle inventory", async () => {
    const container = document.createElement("div");
    const submitDryRun = vi.fn(async () => readyLifecyclePlan());

    const panel = renderReferenceSourceLifecycleDryRun(
      container,
      lifecycleDiagnostics(),
      submitDryRun
    );

    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("Source lifecycle — sealed dry run");
    expect(panel?.textContent).toContain("Staging only");
    expect(panel?.textContent).toContain("without changing bytes, permissions, publications");
    panel!.querySelector<HTMLTextAreaElement>("textarea[name=lifecycleReason]")!.value =
      "Owner requested removal from controlled storage";
    panel!
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(submitDryRun).toHaveBeenCalledOnce());
    expect(submitDryRun).toHaveBeenCalledWith({
      schemaVersion: 1,
      expectedHeadRef: {
        id: "reference-source-snapshot.current",
        digest: "1".repeat(64),
      },
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: {
          id: "asset-acquisition.primary",
          digest: "2".repeat(64),
        },
        reason: "Owner requested removal from controlled storage",
      },
    });
    await vi.waitFor(() => expect(panel?.textContent).toContain("Sealed dry-run plan · Ready"));

    expect(panel?.textContent).toContain("Accessible 2 · Restricted 2 · Tombstone 1 · Purged 1");
    expect(panel?.textContent).toContain("an exact authorized provenance path remains available");
    expect(panel?.textContent).toContain("matching bytes never transfer rights");
    expect(panel?.textContent).toContain("minimum non-sensitive identity remains");
    expect(panel?.textContent).toContain("staging-controlled bytes or derivatives are removed");
    expect(panel?.textContent).toContain(
      "Legacy Workspace and Owner Reference copies are unchanged and are not claimed as purged"
    );
    expect(panel?.textContent).toContain("external copies cannot be recalled");
    expect(panel?.textContent).toContain("Nothing was changed");
    expect(panel?.textContent).not.toContain("file://");
    expect(panel?.querySelectorAll("button")).toHaveLength(1);
    expect(panel?.querySelector("button")?.textContent).toBe("Preview lifecycle plan");
    expect(panel?.textContent).not.toMatch(/\b(?:execute|publish)\b/i);
  });

  it("rejects a correctly sealed lifecycle plan containing an unknown private-field canary", async () => {
    const readyPlan = readyLifecyclePlan();
    const core = lifecyclePlanCore(readyPlan);
    const consequences = Array.isArray(core.consequences) ? core.consequences : [];
    const maliciousPlan = sealLifecyclePlan({
      ...core,
      consequences: consequences.map((consequence, index) =>
        index === 0 && isTestRecord(consequence)
          ? {
              ...consequence,
              storedPath: "file:///Users/owner/PRIVATE-LIFECYCLE-CANARY.pdf",
            }
          : consequence
      ),
    });

    const panel = await submitDeletionPlan(maliciousPlan);

    expect(panel.textContent).toContain("unsafe or unrecognized response");
    expect(panel.querySelector(".reference-source-lifecycle-plan")).toBeNull();
    expect(panel.textContent).not.toContain("PRIVATE-LIFECYCLE-CANARY");
    expect(panel.textContent).not.toContain("storedPath");
    expect(panel.textContent).not.toContain("file://");
  });

  it("binds a valid lifecycle-plan seal to the exact staging head and submitted action", async () => {
    const readyPlan = readyLifecyclePlan();
    const core = lifecyclePlanCore(readyPlan);
    const responses = [
      { ...readyPlan, digest: "0".repeat(64) },
      sealLifecyclePlan({
        ...core,
        baseSnapshotRef: {
          id: "reference-source-snapshot.other",
          digest: "f".repeat(64),
        },
      }),
      readyLifecyclePlan({
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: {
            id: "asset-acquisition.primary",
            digest: "2".repeat(64),
          },
          reason: "A different submitted reason",
        },
      }),
    ];

    for (const response of responses) {
      const panel = await submitDeletionPlan(response);
      expect(panel.textContent).toContain("unsafe or unrecognized response");
      expect(panel.querySelector(".reference-source-lifecycle-plan")).toBeNull();
    }
  });

  it("rejects sealed plans with an impossible canonical instant or dishonest aggregate", async () => {
    const responses = [
      readyLifecyclePlan({ effectiveAt: "2026-02-31T12:00:00.000Z" }),
      readyLifecyclePlan({
        aggregate: {
          accessible: 1,
          restricted: 2,
          tombstone: 1,
          purged: 1,
          readinessBlocked: 1,
          irreversibleDisclosures: 1,
        },
      }),
    ];

    for (const response of responses) {
      const panel = await submitDeletionPlan(response);
      expect(panel.textContent).toContain("unsafe or unrecognized response");
      expect(panel.querySelector(".reference-source-lifecycle-plan")).toBeNull();
    }
  });

  it("requires valid digest-bound verified evidence for ready lifecycle plans", async () => {
    const readyPlan = readyLifecyclePlan();
    const core = lifecyclePlanCore(readyPlan);
    const evidence = isTestRecord(core.verifiedEvidence) ? core.verifiedEvidence : {};
    const { verifiedEvidence: _verifiedEvidence, ...withoutEvidence } = core;
    const responses = [
      sealLifecyclePlan(withoutEvidence),
      sealLifecyclePlan({
        ...core,
        verifiedEvidence: { ...evidence, digest: "f".repeat(64) },
      }),
      sealLifecyclePlan({
        ...core,
        verifiedEvidence: { ...evidence, inventoryScope: "all_vellum_storage" },
      }),
    ];

    for (const response of responses) {
      const panel = await submitDeletionPlan(response);
      expect(panel.textContent).toContain("unsafe or unrecognized response");
      expect(panel.querySelector(".reference-source-lifecycle-plan")).toBeNull();
    }
  });

  it("can preview restriction of an exact Access Decision without exposing an executor", async () => {
    const container = document.createElement("div");
    const restrictionAction = {
      kind: "restrict_access" as const,
      targetAccessDecisionRef: {
        id: "access-decision.primary",
        digest: "3".repeat(64),
      },
      reason: "Withdraw this authorization",
    };
    const submitDryRun = vi.fn(async () =>
      readyLifecyclePlan({
        action: restrictionAction,
        consequences: [],
        permissions: [
          {
            useId: "use.restricted",
            subjectRef: { id: "asset.primary", digest: "b".repeat(64) },
            state: "restricted",
            authorization: "none",
            replayability: "unavailable",
            readinessImpact: "blocked",
            sourceAvailability: "source_unavailable",
            reason: "The selected decision is no longer applicable.",
          },
        ],
        aggregate: {
          accessible: 0,
          restricted: 1,
          tombstone: 0,
          purged: 0,
          readinessBlocked: 1,
          irreversibleDisclosures: 0,
        },
      })
    );

    const panel = renderReferenceSourceLifecycleDryRun(
      container,
      lifecycleDiagnostics(),
      submitDryRun
    )!;
    const action = panel.querySelector<HTMLSelectElement>("select[name=lifecycleAction]")!;
    action.value = "restrict_access";
    action.dispatchEvent(new Event("change", { bubbles: true }));
    panel.querySelector<HTMLTextAreaElement>("textarea")!.value = "Withdraw this authorization";
    panel
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(submitDryRun).toHaveBeenCalledOnce());
    expect(submitDryRun).toHaveBeenCalledWith(
      expect.objectContaining({
        action: {
          kind: "restrict_access",
          targetAccessDecisionRef: {
            id: "access-decision.primary",
            digest: "3".repeat(64),
          },
          reason: "Withdraw this authorization",
        },
      })
    );
    await vi.waitFor(() => expect(panel.textContent).toContain("Permission and use consequences"));
    expect(panel.querySelectorAll("button")).toHaveLength(1);
  });

  it("withholds lifecycle controls for non-lifecycle and historical snapshots", () => {
    const submitDryRun = vi.fn();
    const currentWithoutLifecycle = lifecycleDiagnostics();
    currentWithoutLifecycle.snapshot = {
      records: [
        {
          recordKind: "asset_acquisition",
          id: "asset-acquisition.primary",
          digest: "2".repeat(64),
        },
      ],
    };
    expect(
      renderReferenceSourceLifecycleDryRun(
        document.createElement("div"),
        currentWithoutLifecycle,
        submitDryRun
      )
    ).toBeNull();

    const historical = {
      ...lifecycleDiagnostics(),
      view: {
        kind: "historical",
        viewedSnapshotRef: { id: "snapshot.old", digest: "f".repeat(64) },
      },
    };
    expect(
      renderReferenceSourceLifecycleDryRun(document.createElement("div"), historical, submitDryRun)
    ).toBeNull();
    expect(submitDryRun).not.toHaveBeenCalled();
  });
});

function lifecycleDiagnostics() {
  return {
    publicationState: "staging_only" as const,
    view: { kind: "current" as const },
    head: {
      snapshotId: "reference-source-snapshot.current",
      digest: "1".repeat(64),
      revision: 6,
    },
    snapshot: {
      records: [
        {
          recordKind: "asset_acquisition",
          id: "asset-acquisition.primary",
          digest: "2".repeat(64),
        },
        {
          recordKind: "access_decision",
          id: "access-decision.primary",
          digest: "3".repeat(64),
        },
        {
          recordKind: "lifecycle_storage_policy",
          id: "lifecycle-storage-policy.primary",
          digest: "4".repeat(64),
        },
        {
          recordKind: "lifecycle_use",
          id: "lifecycle-use.primary",
          digest: "5".repeat(64),
        },
      ],
    },
    capabilities: { stagingTransactions: true, canonicalPublication: false as const },
  };
}

function readyLifecyclePlan(
  options: {
    action?: ReferenceSourceLifecycleDryRunRequest["action"];
    baseSnapshotRef?: { id: string; digest: string };
    effectiveAt?: string;
    verifiedEvidence?: unknown;
    consequences?: unknown[];
    permissions?: unknown[];
    aggregate?: Record<string, number>;
  } = {}
): Record<string, unknown> {
  const effectiveAt = options.effectiveAt ?? "2026-07-15T12:00:00.000Z";
  const action =
    options.action ??
    ({
      kind: "delete_acquisition",
      targetAcquisitionRef: {
        id: "asset-acquisition.primary",
        digest: "2".repeat(64),
      },
      reason: "Owner requested removal from controlled storage",
    } satisfies ReferenceSourceLifecycleDryRunRequest["action"]);
  const targetRef =
    action.kind === "delete_acquisition"
      ? action.targetAcquisitionRef
      : action.targetAccessDecisionRef;
  return sealLifecyclePlan({
    schemaVersion: 1,
    mode: "dry_run",
    baseSnapshotRef: options.baseSnapshotRef ?? {
      id: "reference-source-snapshot.current",
      digest: "1".repeat(64),
    },
    effectiveAt,
    action,
    atomicity: "all_or_nothing",
    status: "ready",
    verifiedEvidence: options.verifiedEvidence ?? lifecycleVerifiedEvidence(effectiveAt),
    targetRef,
    ...(action.kind === "delete_acquisition"
      ? { targetDigitalAssetRef: { id: "asset.primary", digest: "b".repeat(64) } }
      : {}),
    consequences: options.consequences ?? [
      lifecycleConsequence("accessible", "a", false),
      lifecycleConsequence("restricted", "b", false),
      lifecycleConsequence("tombstone", "c", false),
      lifecycleConsequence("purged", "d", true),
    ],
    permissions: options.permissions ?? [
      {
        useId: "use.accessible",
        subjectRef: { id: "asset.primary", digest: "b".repeat(64) },
        state: "accessible",
        authorization: "provenance_substitution",
        replayability: "complete",
        readinessImpact: "unchanged",
        sourceAvailability: "available",
        reason: "An authorized alternate provenance path remains.",
      },
      {
        useId: "use.restricted",
        subjectRef: { id: "asset.secondary", digest: "c".repeat(64) },
        state: "restricted",
        authorization: "none",
        replayability: "unavailable",
        readinessImpact: "blocked",
        sourceAvailability: "source_unavailable",
        reason: "No authorized provenance path remains.",
      },
    ],
    aggregate: options.aggregate ?? {
      accessible: 2,
      restricted: 2,
      tombstone: 1,
      purged: 1,
      readinessBlocked: 1,
      irreversibleDisclosures: 1,
    },
  });
}

function lifecycleConsequence(
  state: "accessible" | "restricted" | "tombstone" | "purged",
  digestSeed: string,
  irreversibleDisclosure: boolean
) {
  return {
    subjectRef: { id: `storage.${state}`, digest: digestSeed.repeat(64) },
    subjectKind: "asset_bytes",
    state,
    affectedByRefs: [],
    replayability: state === "accessible" ? "complete" : "partial",
    readinessImpact: state === "restricted" ? "advisory" : "unchanged",
    irreversibleDisclosure,
    reason: `Proposed ${state} storage consequence.`,
  };
}

function lifecycleVerifiedEvidence(validatedAt: string): Record<string, unknown> {
  const core = {
    schemaVersion: 1,
    inventoryScope: "reference_source_staging_only",
    validatedAt,
    requiredStoreRegistryRef: {
      id: "controlled-store-registry.primary",
      digest: "9".repeat(64),
    },
    inventoryWitnessRef: {
      id: "controlled-store-inventory.primary",
      digest: "e".repeat(64),
    },
    stores: [
      {
        storeId: "controlled-artifact-store.primary",
        storeGeneration: 4,
        storeStateDigest: "8".repeat(64),
        enumerationDigest: "7".repeat(64),
      },
    ],
    authorityEvaluations: [
      {
        accessDecisionRef: {
          id: "access-decision.primary",
          digest: "3".repeat(64),
        },
        receiptRef: {
          id: "authority-receipt.primary",
          digest: "6".repeat(64),
        },
        evaluationDigest: "5".repeat(64),
      },
    ],
    retentionEvaluations: [
      {
        roleBindingRef: {
          id: "owner-reference-binding.primary",
          digest: "4".repeat(64),
        },
        receiptRef: {
          id: "retention-receipt.primary",
          digest: "3".repeat(64),
        },
        outcome: "release",
        evaluationDigest: "2".repeat(64),
      },
    ],
  };
  const seed = testReferenceSourceDigest(core);
  const identified = {
    ...core,
    id: `reference-lifecycle-preflight.${seed.slice(0, 24)}`,
  };
  return { ...identified, digest: testReferenceSourceDigest(identified) };
}

function sealLifecyclePlan(core: Record<string, unknown>): Record<string, unknown> {
  const seed = testReferenceSourceDigest(core);
  const identified = {
    ...core,
    id: `reference-lifecycle-plan.${seed.slice(0, 24)}`,
  };
  return { ...identified, digest: testReferenceSourceDigest(identified) };
}

function lifecyclePlanCore(plan: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, digest: _digest, ...core } = plan;
  return core;
}

async function submitDeletionPlan(plan: unknown): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const panel = renderReferenceSourceLifecycleDryRun(
    container,
    lifecycleDiagnostics(),
    vi.fn(async () => plan)
  )!;
  panel.querySelector<HTMLTextAreaElement>("textarea[name=lifecycleReason]")!.value =
    "Owner requested removal from controlled storage";
  panel
    .querySelector<HTMLFormElement>("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(panel.textContent).toContain("unsafe or unrecognized response"));
  return panel;
}

function testReferenceSourceDigest(value: unknown): string {
  return createHash("sha256").update(testCanonicalReferenceJson(value)).digest("hex");
}

function testCanonicalReferenceJson(value: unknown): string {
  const serialized = JSON.stringify(testCanonicalize(value));
  if (serialized === undefined) throw new TypeError("Expected a JSON value");
  return serialized;
}

function testCanonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Expected a finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(testCanonicalize);
  if (!isTestRecord(value)) throw new TypeError("Expected a plain JSON object");
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, testCanonicalize(value[key])])
  );
}

function isTestRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
