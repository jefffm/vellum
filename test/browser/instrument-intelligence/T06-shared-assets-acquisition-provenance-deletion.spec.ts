import { createHash } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

type PlanVariant = "ready" | "unknown_canary" | "bad_digest";

type LifecycleFixture = {
  snapshotId: string;
  snapshotDigest: string;
  acquisitionId: string;
  acquisitionDigest: string;
  lifecycleRequest?: unknown;
};

test("Workbench previews a sealed lifecycle plan without exposing private values or mutation", async ({
  page,
}) => {
  const fixture = await installLifecycleFixture(page, "ready");
  const staging = await openAndSubmitLifecyclePlanner(page);

  await expect
    .poll(() => fixture.lifecycleRequest)
    .toEqual({
      schemaVersion: 1,
      expectedHeadRef: { id: fixture.snapshotId, digest: fixture.snapshotDigest },
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: {
          id: fixture.acquisitionId,
          digest: fixture.acquisitionDigest,
        },
        reason: "Owner requested a dry-run preview",
      },
    });
  await expect(staging).toContainText("Sealed dry-run plan · Ready");
  await expect(staging).toContainText("all or nothing · staging-controlled store only");
  await expect(staging).toContainText("Accessible 2 · Restricted 2 · Tombstone 1 · Purged 1");
  await expect(staging).toContainText("an exact authorized provenance path remains available");
  await expect(staging).toContainText("matching bytes never transfer rights");
  await expect(staging).toContainText("minimum non-sensitive identity remains");
  await expect(staging).toContainText("staging-controlled bytes or derivatives are removed");
  await expect(staging).toContainText(
    "Legacy Workspace and Owner Reference copies are unchanged and are not claimed as purged"
  );
  await expect(staging).toContainText("external copies cannot be recalled");
  await expect(staging).toContainText("Dry-run plan ready. Nothing was changed.");
  await expect(staging.getByRole("button")).toHaveCount(1);
  await expect(staging.getByRole("button", { name: /execute|publish|canonical/i })).toHaveCount(0);
  await expect(staging).not.toContainText("PRIVATE-PATH-CANARY");
  await expect(staging).not.toContainText("PRIVATE-BYTES-CANARY");
  await expect(staging).not.toContainText("file://");
});

test("Workbench rejects a correctly sealed lifecycle response with an unknown private-field canary", async ({
  page,
}) => {
  await installLifecycleFixture(page, "unknown_canary");
  const staging = await openAndSubmitLifecyclePlanner(page);

  await expect(staging).toContainText("unsafe or unrecognized response");
  await expect(staging).not.toContainText("Sealed dry-run plan");
  await expect(staging).not.toContainText("Dry-run plan ready");
  await expect(staging).not.toContainText("PRIVATE-PATH-CANARY");
  await expect(staging).not.toContainText("file://");
  await expect(staging.getByRole("button")).toHaveCount(1);
});

test("Workbench rejects a valid-looking lifecycle response with a bad canonical digest", async ({
  page,
}) => {
  await installLifecycleFixture(page, "bad_digest");
  const staging = await openAndSubmitLifecyclePlanner(page);

  await expect(staging).toContainText("unsafe or unrecognized response");
  await expect(staging).not.toContainText("Sealed dry-run plan");
  await expect(staging).not.toContainText("Dry-run plan ready");
  await expect(staging.getByRole("button")).toHaveCount(1);
});

async function installLifecycleFixture(
  page: Page,
  variant: PlanVariant
): Promise<LifecycleFixture> {
  const fixture: LifecycleFixture = {
    snapshotId: "reference-source-snapshot.lifecycle-current",
    snapshotDigest: "1".repeat(64),
    acquisitionId: "asset-acquisition.owner-copy",
    acquisitionDigest: "2".repeat(64),
  };

  await page.route("**/api/owner", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: json({
        personalDefaultCandidates: [],
        personalDefaults: [],
        ownerReferences: [],
        knowledgeCandidates: [],
        historicalPracticeClaims: [],
      }),
    });
  });
  await page.route("**/api/owner/reference-source-staging", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: json({
        publicationState: "staging_only",
        view: { kind: "current" },
        head: {
          snapshotId: fixture.snapshotId,
          digest: fixture.snapshotDigest,
          revision: 7,
        },
        snapshot: {
          records: [
            {
              recordKind: "asset_acquisition",
              id: fixture.acquisitionId,
              digest: fixture.acquisitionDigest,
              storedPath: "/Users/owner/GET-PRIVATE-PATH-CANARY.pdf",
              bytes: "GET-PRIVATE-BYTES-CANARY",
            },
            {
              recordKind: "access_decision",
              id: "access-decision.owner-use",
              digest: "3".repeat(64),
            },
            {
              recordKind: "lifecycle_storage_policy",
              id: "lifecycle-storage-policy.owner-copy",
              digest: "4".repeat(64),
            },
            {
              recordKind: "lifecycle_use",
              id: "lifecycle-use.owner-copy",
              digest: "5".repeat(64),
            },
          ],
        },
        capabilities: { stagingTransactions: true, canonicalPublication: false },
      }),
    });
  });
  await page.route("**/api/owner/reference-source-staging/lifecycle/plan", async (route) => {
    fixture.lifecycleRequest = route.request().postDataJSON();
    const action = {
      kind: "delete_acquisition" as const,
      targetAcquisitionRef: {
        id: fixture.acquisitionId,
        digest: fixture.acquisitionDigest,
      },
      reason: "Owner requested a dry-run preview",
    };
    let plan = readyLifecyclePlan({
      snapshotId: fixture.snapshotId,
      snapshotDigest: fixture.snapshotDigest,
      acquisitionId: fixture.acquisitionId,
      acquisitionDigest: fixture.acquisitionDigest,
      action,
    });
    if (variant === "unknown_canary") plan = lifecyclePlanWithUnknownCanary(plan);
    if (variant === "bad_digest") plan = { ...plan, digest: "0".repeat(64) };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: json(plan),
    });
  });

  return fixture;
}

async function openAndSubmitLifecyclePlanner(page: Page): Promise<Locator> {
  await page.goto("/");
  const guidedStart = page.locator("#guided-start");
  if (await guidedStart.isVisible()) {
    await guidedStart.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Knowledge & defaults" }).click();
  const staging = page
    .locator("#vellum-owner-workbench")
    .locator(".reference-source-staging-section");

  await expect(
    staging.getByRole("heading", { name: "Source lifecycle — sealed dry run" })
  ).toBeVisible();
  await expect(staging).toContainText("Staging only");
  await expect(staging).toContainText("without changing bytes, permissions, publications");
  await expect(staging.getByLabel("Action", { exact: true })).toHaveValue("delete_acquisition");
  await expect(staging.getByLabel("Acquisition", { exact: true })).toContainText(
    "asset-acquisition.owner-copy"
  );
  await staging.getByLabel("Reason", { exact: true }).fill("Owner requested a dry-run preview");
  await staging.getByRole("button", { name: "Preview lifecycle plan" }).click();
  return staging;
}

function readyLifecyclePlan(input: {
  snapshotId: string;
  snapshotDigest: string;
  acquisitionId: string;
  acquisitionDigest: string;
  action: {
    kind: "delete_acquisition";
    targetAcquisitionRef: { id: string; digest: string };
    reason: string;
  };
}): Record<string, unknown> {
  const effectiveAt = "2026-07-15T16:00:00.000Z";
  return sealLifecyclePlan({
    schemaVersion: 1,
    mode: "dry_run",
    baseSnapshotRef: { id: input.snapshotId, digest: input.snapshotDigest },
    effectiveAt,
    action: input.action,
    atomicity: "all_or_nothing",
    status: "ready",
    verifiedEvidence: lifecycleVerifiedEvidence(effectiveAt),
    targetRef: { id: input.acquisitionId, digest: input.acquisitionDigest },
    targetDigitalAssetRef: { id: "digital-asset.owner-copy", digest: "7".repeat(64) },
    consequences: [
      consequence("accessible", "a", false),
      consequence("restricted", "b", false),
      consequence("tombstone", "c", false),
      consequence("purged", "d", true),
    ],
    permissions: [
      {
        useId: "use.alternate-provenance",
        subjectRef: { id: "digital-asset.owner-copy", digest: "7".repeat(64) },
        state: "accessible",
        authorization: "provenance_substitution",
        replayability: "complete",
        readinessImpact: "unchanged",
        sourceAvailability: "available",
        reason: "An authorized alternate provenance path remains.",
      },
      {
        useId: "use.removed-provenance",
        subjectRef: { id: "digital-asset.restricted-copy", digest: "8".repeat(64) },
        state: "restricted",
        authorization: "none",
        replayability: "unavailable",
        readinessImpact: "blocked",
        sourceAvailability: "source_unavailable",
        reason: "No applicable authorized provenance path remains.",
      },
    ],
    aggregate: {
      accessible: 2,
      restricted: 2,
      tombstone: 1,
      purged: 1,
      readinessBlocked: 1,
      irreversibleDisclosures: 1,
    },
  });
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
        accessDecisionRef: { id: "access-decision.owner-use", digest: "3".repeat(64) },
        receiptRef: { id: "authority-receipt.owner-use", digest: "6".repeat(64) },
        evaluationDigest: "5".repeat(64),
      },
    ],
    retentionEvaluations: [
      {
        roleBindingRef: { id: "owner-reference-binding.owner-copy", digest: "4".repeat(64) },
        receiptRef: { id: "retention-receipt.owner-copy", digest: "3".repeat(64) },
        outcome: "release",
        evaluationDigest: "2".repeat(64),
      },
    ],
  };
  const seed = referenceSourceDigest(core);
  const identified = {
    ...core,
    id: `reference-lifecycle-preflight.${seed.slice(0, 24)}`,
  };
  return { ...identified, digest: referenceSourceDigest(identified) };
}

function lifecyclePlanWithUnknownCanary(plan: Record<string, unknown>): Record<string, unknown> {
  const core = lifecyclePlanCore(plan);
  const consequences = Array.isArray(core.consequences) ? core.consequences : [];
  return sealLifecyclePlan({
    ...core,
    consequences: consequences.map((item, index) =>
      index === 0 && isRecord(item)
        ? {
            ...item,
            storedPath: "file:///Users/owner/POST-PRIVATE-PATH-CANARY.pdf",
          }
        : item
    ),
  });
}

function consequence(
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
    reason: `Proposed ${state} consequence.`,
  };
}

function sealLifecyclePlan(core: Record<string, unknown>): Record<string, unknown> {
  const seed = referenceSourceDigest(core);
  const identified = {
    ...core,
    id: `reference-lifecycle-plan.${seed.slice(0, 24)}`,
  };
  return { ...identified, digest: referenceSourceDigest(identified) };
}

function lifecyclePlanCore(plan: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, digest: _digest, ...core } = plan;
  return core;
}

function referenceSourceDigest(value: unknown): string {
  return createHash("sha256").update(canonicalReferenceJson(value)).digest("hex");
}

function canonicalReferenceJson(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) throw new TypeError("Expected a JSON value");
  return serialized;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Expected a finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) throw new TypeError("Expected a plain JSON object");
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}
