import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { createApp } from "../../../src/server/index.js";
import { KnowledgePublicationStore } from "../../../src/server/lib/knowledge-publication-store.js";
import type { ReviewerVerifierReceiptVerifier } from "../../../src/server/lib/reviewer-authority-service.js";
import {
  startRealBrowserAppProxy,
  type RealBrowserAppProxy,
} from "../../support/real-browser-app-proxy.js";
import { createT13BrowserAuthorityFixture } from "../../support/t13-reviewer-authority-fixture.js";

test.setTimeout(90_000);

test("the real Workbench discloses exact synthetic verification scope without claiming expertise", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The Playwright frontend origin is unavailable");
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t13-browser-"));
  const fixture = await createT13BrowserAuthorityFixture(root);
  const proxy = await startHarness(baseURL, root, fixture.store, fixture.verifyReceipt);
  const responses: unknown[] = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname === "/api/owner/reviewer-authority") {
      responses.push(await response.json());
    }
  });
  try {
    await page.goto(proxy.origin, { waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    const workbench = page.locator(".reviewer-authority-workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench).toContainText("Credentials and review claims do not grant authority");
    await expect(workbench).toContainText("Synthetic contract-test policy");
    await expect(workbench).toContainText("Historical practice specialist");
    await expect(workbench).toContainText("Verified authorized · Authorized");
    await expect(workbench).toContainText("Freshness");
    await expect(workbench).toContainText("Current");
    await expect(workbench).toContainText("Revocation");
    await expect(workbench).toContainText("Clear");
    await expect(workbench).toContainText("Historical practice, Instrument idiom");
    await expect(workbench).toContainText("Target playability, Continuo, Counterpoint");
    await expect(workbench).toContainText("Synthetic source disagreement remains unresolved");
    await expect(workbench).toContainText("None conferred");
    await expect(workbench).toContainText("Not present · owned by the later resolver slice");
    await expect(workbench).not.toContainText("PRIVATE-T13-IDENTITY-CANARY");
    await expect(workbench).not.toContainText("Private synthetic reviewer label");

    await expect.poll(() => responses.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(responses.at(-1));
    expect(serialized).not.toContain("PRIVATE-T13-IDENTITY-CANARY");
    expect(serialized).not.toContain("Private synthetic reviewer label");
    expect(serialized).not.toContain("signature");
    expect(serialized).not.toContain("assertedAttributes");
    expect(serialized).not.toContain("activation_decision");

    await page.reload({ waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    await expect(page.locator(".reviewer-authority-workbench")).toContainText(
      "Verified authorized · Authorized"
    );
  } finally {
    if (!page.isClosed()) await page.goto("about:blank");
    await proxy.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("the real Workbench fails closed when no reviewer Trust Policy is configured", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The Playwright frontend origin is unavailable");
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t13-browser-unconfigured-"));
  const store = new KnowledgePublicationStore({ rootDirectory: path.join(root, "publication") });
  const proxy = await startHarness(baseURL, root, store);
  try {
    await page.goto(proxy.origin, { waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    const workbench = page.locator(".reviewer-authority-workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench).toContainText("No reviewer Trust Policy is configured");
    await expect(workbench).toContainText(
      "Human, historical, specialist, and advisory authority remain unavailable"
    );
  } finally {
    if (!page.isClosed()) await page.goto("about:blank");
    await proxy.close();
    rmSync(root, { recursive: true, force: true });
  }
});

async function startHarness(
  frontendOrigin: string,
  root: string,
  publicationStore: KnowledgePublicationStore,
  reviewerAuthorityReceiptVerifier?: ReviewerVerifierReceiptVerifier
): Promise<RealBrowserAppProxy> {
  for (const directory of ["owner", "migration", "workbench"]) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  return startRealBrowserAppProxy({
    frontendOrigin,
    createApiApp: (browserOrigin) =>
      createApp({
        security: { host: "127.0.0.1", frontendOrigin: browserOrigin, mode: "local" },
        knowledgePublicationStore: publicationStore,
        reviewerAuthorityReceiptVerifier,
        ownerReferenceMigrationOwnerRootDirectory: path.join(root, "owner"),
        ownerReferenceMigrationPrivateRootDirectory: path.join(root, "migration"),
        ownerReferenceWorkbenchPrivateRootDirectory: path.join(root, "workbench"),
        ownerReferenceWorkbenchOpaqueKey: new Uint8Array(32).fill(0x13),
      }),
  });
}

async function openKnowledgeWorkbench(page: import("@playwright/test").Page): Promise<void> {
  const guidedStart = page.locator("#guided-start");
  if (await guidedStart.isVisible()) {
    await guidedStart.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Knowledge & defaults" }).click();
  await expect(page.locator("#vellum-owner-workbench")).toBeVisible();
}
