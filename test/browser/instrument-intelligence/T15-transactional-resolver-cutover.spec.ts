import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { createApp } from "../../../src/server/index.js";
import type { KnowledgePublicationStore } from "../../../src/server/lib/knowledge-publication-store.js";
import {
  startRealBrowserAppProxy,
  type RealBrowserAppProxy,
} from "../../support/real-browser-app-proxy.js";
import { createT14KnowledgeResolutionFixture } from "../../support/t14-knowledge-resolution-fixture.js";

test.setTimeout(90_000);

test("preflights, atomically cuts over, and rolls back the resolver authority", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The Playwright frontend origin is unavailable");
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t15-browser-"));
  const fixture = createT14KnowledgeResolutionFixture(root);
  const proxy = await startHarness(baseURL, root, fixture.store);
  const responses: unknown[] = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname === "/api/owner/knowledge-resolver-cutover") {
      responses.push(await response.json());
    }
  });
  try {
    await page.goto(proxy.origin, { waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    const workbench = page.locator(".knowledge-resolver-cutover-workbench");
    await expect(workbench).toContainText("Legacy authority is active");
    await expect(workbench).toContainText("legacy on · complete manifest off");

    await workbench.getByRole("button", { name: "Run cutover preflight" }).click();
    await expect(workbench.locator(".knowledge-resolver-preflight-checks")).toContainText(
      "Shadow comparison: pass"
    );
    await expect(workbench.locator(".knowledge-resolver-preflight-checks li")).toHaveCount(6);

    await workbench.getByRole("button", { name: "Activate complete-manifest resolver" }).click();
    await expect(workbench).toContainText("Complete-manifest authority is active");
    await expect(workbench).toContainText("legacy off · complete manifest on");

    await workbench.getByRole("button", { name: "Roll back to exact prior authority" }).click();
    await expect(workbench).toContainText("Legacy authority is active");
    await expect(workbench).toContainText("legacy on · complete manifest off");

    expect(JSON.stringify(responses)).not.toMatch(/PRIVATE|owner-reference-page-atlas/);
  } finally {
    if (!page.isClosed()) await page.goto("about:blank");
    await proxy.close();
    rmSync(root, { recursive: true, force: true });
  }
});

async function startHarness(
  frontendOrigin: string,
  root: string,
  publicationStore: KnowledgePublicationStore
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
        ownerReferenceWorkbenchOpaqueKey: new Uint8Array(32).fill(0x15),
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
