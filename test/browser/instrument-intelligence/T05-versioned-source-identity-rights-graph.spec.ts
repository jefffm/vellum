import { expect, test } from "@playwright/test";

test("Workbench exposes a redacted, read-only staging view without inventing confidence", async ({
  page,
}) => {
  await page.route("**/api/owner", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: json({
        personalDefaultCandidates: [],
        personalDefaults: [],
        ownerReferences: [
          {
            id: "owner-reference.1111111111111111",
            title: "Legacy source",
            citation: "Owner citation",
            sha256: "a".repeat(64),
            storedPath: "/Users/owner/PRIVATE-PATH-CANARY",
          },
        ],
        knowledgeCandidates: [],
        historicalPracticeClaims: [
          {
            id: "historical-claim.1111111111111111",
            statement: "A legacy documentary classification",
            scope: { instrument: "baroque_lute" },
            authority: "documented_practice",
            referenceId: "owner-reference.1111111111111111",
            citationLocator: "p. 1",
            status: "active",
          },
        ],
      }),
    });
  });
  await page.route("**/api/owner/reference-source-staging", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: json({
        publicationState: "staging_only",
        head: {
          snapshotId: "reference-source-snapshot.1111111111111111",
          digest: "b".repeat(64),
          revision: 1,
        },
        snapshot: {
          records: {
            identityAssertions: [
              {
                id: "identity-assertion.1111111111111111",
                identityConfidence: { kind: "unknown" },
                conflictState: "unresolved",
                storedPath: "/Users/owner/STAGED-PRIVATE-PATH-CANARY",
                retrievalUri: "file:///Users/owner/STAGED-PRIVATE-PATH-CANARY",
                bytes: "STAGED-PRIVATE-BYTES-CANARY",
              },
            ],
          },
        },
        legacyProjection: {
          ownerReferences: [
            {
              id: "owner-reference.1111111111111111",
              title: "Legacy source",
              citation: "Owner citation",
              mimeType: "application/pdf",
              sha256: "a".repeat(64),
              byteLength: 1234,
              identityConfidence: { kind: "unknown" },
              retrievalUri: "file:///Users/owner/LEGACY-PRIVATE-PATH-CANARY",
            },
          ],
        },
        capabilities: { stagingTransactions: true, canonicalPublication: false },
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
  await expect(dialog).toBeVisible();
  const staging = dialog.locator(".reference-source-staging-section");
  await expect(staging).toContainText("Reference sources — staging diagnostics");
  await expect(staging).toContainText("Staging only · read-only compatibility view");
  await expect(staging).toContainText("Canonical publication is disabled");
  await expect(staging).toContainText("identity confidence unassessed");
  await expect(dialog).toContainText("confidence unassessed");
  await expect(staging.locator("button, input, select, textarea")).toHaveCount(0);
  await expect(dialog).not.toContainText("75%");
  await expect(dialog).not.toContainText("PRIVATE-PATH-CANARY");
  await expect(dialog).not.toContainText("PRIVATE-BYTES-CANARY");
  await expect(dialog).not.toContainText("file://");
});

function json(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}
