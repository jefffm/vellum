import { expect, test } from "@playwright/test";

test("Workbench previews a sealed lifecycle plan without exposing private values or mutation", async ({
  page,
}) => {
  const snapshotId = "reference-source-snapshot.lifecycle-current";
  const snapshotDigest = "1".repeat(64);
  const acquisitionId = "asset-acquisition.owner-copy";
  const acquisitionDigest = "2".repeat(64);
  let lifecycleRequest: unknown;

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
        head: { snapshotId, digest: snapshotDigest, revision: 7 },
        snapshot: {
          records: [
            {
              recordKind: "asset_acquisition",
              id: acquisitionId,
              digest: acquisitionDigest,
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
    lifecycleRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: json({
        schemaVersion: 1,
        id: "reference-lifecycle-plan.owner-copy",
        digest: "6".repeat(64),
        mode: "dry_run",
        baseSnapshotRef: { id: snapshotId, digest: snapshotDigest },
        effectiveAt: "2026-07-15T16:00:00.000Z",
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: { id: acquisitionId, digest: acquisitionDigest },
          reason: "Owner requested a dry-run preview",
        },
        atomicity: "all_or_nothing",
        status: "ready",
        targetRef: { id: acquisitionId, digest: acquisitionDigest },
        targetDigitalAssetRef: { id: "digital-asset.owner-copy", digest: "7".repeat(64) },
        consequences: [
          consequence("accessible", "a", false),
          consequence("restricted", "b", false),
          consequence("tombstone", "c", false),
          {
            ...consequence("purged", "d", true),
            storedPath: "file:///Users/owner/POST-PRIVATE-PATH-CANARY.pdf",
            bytes: "POST-PRIVATE-BYTES-CANARY",
            reason: "file:///Users/owner/POST-PRIVATE-REASON-CANARY.pdf",
          },
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
            retrievalUri: "file:///Users/owner/POST-PRIVATE-PERMISSION-CANARY.pdf",
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
          accessible: 1,
          restricted: 1,
          tombstone: 1,
          purged: 1,
          readinessBlocked: 1,
          irreversibleDisclosures: 1,
        },
      }),
    });
  });

  await page.goto("/");
  const guidedStart = page.locator("#guided-start");
  if (await guidedStart.isVisible()) {
    await guidedStart.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Knowledge & defaults" }).click();
  const dialog = page.locator("#vellum-owner-workbench");
  const staging = dialog.locator(".reference-source-staging-section");

  await expect(
    staging.getByRole("heading", { name: "Source lifecycle — sealed dry run" })
  ).toBeVisible();
  await expect(staging).toContainText("Staging only");
  await expect(staging).toContainText("without changing bytes, permissions, publications");
  await expect(staging.getByLabel("Action", { exact: true })).toHaveValue("delete_acquisition");
  await expect(staging.getByLabel("Acquisition", { exact: true })).toContainText(acquisitionId);
  await staging.getByLabel("Reason", { exact: true }).fill("Owner requested a dry-run preview");
  await staging.getByRole("button", { name: "Preview lifecycle plan" }).click();

  await expect
    .poll(() => lifecycleRequest)
    .toEqual({
      schemaVersion: 1,
      expectedHeadRef: { id: snapshotId, digest: snapshotDigest },
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: { id: acquisitionId, digest: acquisitionDigest },
        reason: "Owner requested a dry-run preview",
      },
    });
  await expect(staging).toContainText("Sealed dry-run plan · Ready");
  await expect(staging).toContainText("all or nothing · staging only");
  await expect(staging).toContainText("Accessible 1 · Restricted 1 · Tombstone 1 · Purged 1");
  await expect(staging).toContainText("an exact authorized provenance path remains available");
  await expect(staging).toContainText("matching bytes never transfer rights");
  await expect(staging).toContainText("minimum non-sensitive identity remains");
  await expect(staging).toContainText("Vellum-controlled bytes or derivatives are removed");
  await expect(staging).toContainText("external copies cannot be recalled");
  await expect(staging).toContainText("Dry-run plan ready. Nothing was changed.");
  await expect(staging.getByRole("button")).toHaveCount(1);
  await expect(staging.getByRole("button", { name: /execute|publish|canonical/i })).toHaveCount(0);
  await expect(staging).not.toContainText("PRIVATE-PATH-CANARY");
  await expect(staging).not.toContainText("PRIVATE-BYTES-CANARY");
  await expect(staging).not.toContainText("PRIVATE-REASON-CANARY");
  await expect(staging).not.toContainText("PRIVATE-PERMISSION-CANARY");
  await expect(staging).not.toContainText("file://");
});

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

function json(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}
