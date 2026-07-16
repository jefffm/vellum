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

test("default Guided Start stays inactive while provisional research visibly applies the exact release", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The Playwright frontend origin is unavailable");
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t14-browser-"));
  const fixture = createT14KnowledgeResolutionFixture(root);
  const proxy = await startHarness(baseURL, root, fixture.store);
  const responses: unknown[] = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname === "/api/owner/knowledge-resolution") {
      responses.push(await response.json());
    }
  });
  try {
    await page.goto(proxy.origin, { waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    const workbench = page.locator(".knowledge-resolution-workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench).toContainText("Default Guided Start: test-only knowledge is inactive");
    await expect(workbench).toContainText("Target readiness");
    await expect(workbench).toContainText("Not claimed");
    await expect(workbench.locator(".knowledge-resolution-provisional")).toHaveCount(0);

    await workbench.getByLabel("Knowledge resolution mode").selectOption("provisional_research");
    await workbench.getByRole("button", { name: "Preview resolution" }).click();
    await expect(workbench.locator(".knowledge-resolution-provisional")).toContainText(
      "7: a · 8: /a · 9: //a · 10: ///a · 11: 4 · 12: 5"
    );
    await expect(workbench).toContainText("Course 13: unresolved — no mapping applied");
    await expect(workbench).toContainText("readiness not claimed");

    await workbench.getByRole("button", { name: "Publish inspected resolution" }).click();
    await expect(workbench).toContainText("Provisional research");
    await expect(workbench.locator(".knowledge-resolution-provisional")).toContainText(
      "7: a · 8: /a · 9: //a · 10: ///a · 11: 4 · 12: 5"
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await openKnowledgeWorkbench(page);
    await expect(page.locator(".knowledge-resolution-workbench")).toContainText(
      "Default Guided Start: test-only knowledge is inactive"
    );
    await expect(page.locator(".knowledge-resolution-provisional")).toHaveCount(0);

    await expect.poll(() => responses.length).toBeGreaterThan(2);
    const serialized = JSON.stringify(responses);
    expect(serialized).not.toContain("PRIVATE");
    expect(serialized).not.toContain("owner-reference-page-atlas");
    expect(serialized).not.toContain('readinessClaim":true');
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
        ownerReferenceWorkbenchOpaqueKey: new Uint8Array(32).fill(0x14),
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
