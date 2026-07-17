import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { createApp } from "../../../src/server/index.js";
import {
  startRealBrowserAppProxy,
  type RealBrowserAppProxy,
} from "../../support/real-browser-app-proxy.js";
import { createT14KnowledgeResolutionFixture } from "../../support/t14-knowledge-resolution-fixture.js";

test.setTimeout(90_000);

test("uses truthful authority and readiness vocabulary for ordinary and provisional modes", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The Playwright frontend origin is unavailable");
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t16-browser-"));
  const fixture = createT14KnowledgeResolutionFixture(root);
  const proxy = await startHarness(baseURL, root, fixture.store);
  try {
    await page.goto(proxy.origin, { waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    const workbench = page.locator(".knowledge-resolution-workbench");
    await expect(workbench).toContainText("Human maintainer");
    await expect(workbench).toContainText("Review required");
    await expect(workbench).toContainText("Qualification");
    await expect(workbench).toContainText("Ineligible");
    await expect(workbench).toContainText("Historical presentation");
    await expect(workbench).toContainText("Unclaimed");
    await expect(workbench).toContainText("Target readiness");
    await expect(workbench).toContainText("Not claimed");

    await workbench.getByLabel("Knowledge resolution mode").selectOption("provisional_research");
    await workbench.getByRole("button", { name: "Preview resolution" }).click();
    await expect(workbench).toContainText("Test only");
    await expect(workbench).toContainText("Test only no authority");
    await expect(workbench).toContainText("Provisional only");
    await expect(workbench.locator(".knowledge-resolution-provisional")).toBeVisible();
    await expect(workbench).not.toContainText("Target readiness Ready");
  } finally {
    if (!page.isClosed()) await page.goto("about:blank");
    await proxy.close();
    rmSync(root, { recursive: true, force: true });
  }
});

async function startHarness(
  frontendOrigin: string,
  root: string,
  publicationStore: ReturnType<typeof createT14KnowledgeResolutionFixture>["store"]
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
        ownerReferenceMigrationOwnerRootDirectory: path.join(root, "owner"),
        ownerReferenceMigrationPrivateRootDirectory: path.join(root, "migration"),
        ownerReferenceWorkbenchPrivateRootDirectory: path.join(root, "workbench"),
        ownerReferenceWorkbenchOpaqueKey: new Uint8Array(32).fill(0x16),
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
