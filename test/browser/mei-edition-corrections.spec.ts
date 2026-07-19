import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { FRENCH_TAB_MEI_FIXTURE } from "../../src/lib/mei-edition-fixtures.js";
import type { DiplomaticToken } from "../../src/lib/mei-edition-domain.js";

async function data<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { ok: true; data: T };
  return body.data;
}

test("facsimile-linked MEI corrections preview, cancel, commit, reload, and undo", async ({
  page,
  request,
}) => {
  const workspace = await data<{ id: string }>(
    await request.post("/api/workspaces", { data: { title: "MEI browser edition" } })
  );
  const pdf = readFileSync(path.resolve("test/fixtures/greensleeves/greensleeves-satb.pdf"));
  const source = await data<{ id: string }>(
    await request.post(`/api/workspaces/${workspace.id}/sources`, {
      data: pdf,
      headers: {
        "Content-Type": "application/pdf",
        "X-Source-Filename": "facsimile.pdf",
        "X-Source-License": "project-authored browser fixture",
      },
    })
  );
  const ids = [
    "rhythm-1",
    "note-1",
    "note-2",
    "note-3",
    "rhythm-2",
    "note-4",
    "rhythm-3",
    "note-5",
    "note-6",
  ];
  const tokens: DiplomaticToken[] = ids.map((id, index) => ({
    id,
    kind: id.startsWith("rhythm") ? "rhythm" : "tablature",
    region: { page: 1, x: 0.06 + index * 0.08, y: 0.12, width: 0.045, height: 0.08 },
    confidence: index % 2 ? 0.72 : 0.94,
    alternatives: index % 2 ? ["alternate reading"] : [],
    critical: index % 2 === 1,
  }));
  tokens.push({
    id: "measure-1",
    kind: "barline",
    region: { page: 1, x: 0.02, y: 0.1, width: 0.02, height: 0.1 },
    confidence: 0.99,
    alternatives: [],
    critical: false,
  });
  tokens.push({
    id: "event-1",
    kind: "pince",
    region: { page: 1, x: 0.08, y: 0.08, width: 0.16, height: 0.12 },
    confidence: 0.72,
    alternatives: ["simultaneity uncertain"],
    critical: true,
  });
  const created = await data<{ edition: { editionId: string } }>(
    await request.post(`/api/workspaces/${workspace.id}/mei-editions`, {
      data: {
        sourceArtifactId: source.id,
        sourcePage: 1,
        title: "Sarabande proof",
        mei: FRENCH_TAB_MEI_FIXTURE,
        tokens,
        extraction: {
          backendId: "fixture.browser-structured-extraction",
          backendVersion: "1",
          diagnostics: ["Project-authored browser fixture"],
        },
      },
    })
  );

  await page.goto(`/?workspace=${workspace.id}&meiEdition=${created.edition.editionId}`);
  const surface = page.locator(".diplomatic-edition-workspace");
  await expect(surface).toBeVisible();
  await expect(surface.locator(".artifact-preview-meta")).toContainText("canonical version 1");
  await expect(surface.locator(".mei-facsimile-canvas img")).toHaveJSProperty("complete", true);
  await surface.locator("[data-source-zoom-in]").click();
  await expect(surface.locator("[data-source-zoom-reset]")).toHaveText("150%");

  await surface.locator('g[data-id="rhythm-1"]').press("Enter");
  await expect(surface.locator("[data-current]")).toHaveValue("4");

  await expect(surface.locator("[data-critical-review]")).toContainText(
    "5 unresolved critical readings"
  );
  const pluckTogether = surface.locator('[data-critical-token-id="event-1"]');
  await expect(pluckTogether).toContainText("pluck together · source vertical stroke");
  await expect(pluckTogether).not.toContainText("pince");
  await pluckTogether.click();
  await expect(surface.locator("[data-token-detail]")).toContainText(
    "event-1 · pluck together · source vertical stroke"
  );
  await surface.locator('g[data-id="note-1"]').press("Enter");
  await expect(surface.locator("[data-token-detail]")).toContainText("note-1");
  await expect(surface.locator("[data-token-detail]")).toContainText("Critical Uncertainty");
  await expect(surface.locator(".mei-facsimile-highlight")).toBeVisible();
  await surface.locator("[data-confirm-reading]").click();
  await expect(surface.locator("[data-staged]")).toContainText("note-1 · source reading confirmed");
  await surface.locator("[data-cancel]").click();
  await surface.locator('[data-critical-token-id="note-1"]').click();
  await expect(surface.locator("[data-token-detail]")).toContainText("note-1");
  await surface.locator("[data-replacement]").fill("2");
  await surface.locator("[data-change-form] button[type=submit]").click();
  await expect(surface.locator("[data-staged]")).toContainText("note-1 · tab.course: 1 → 2");
  await surface.locator("[data-cancel]").click();
  await expect(surface.locator("[data-staged]")).toBeEmpty();

  for (const [id, replacement] of [
    ["note-1", "2"],
    ["note-4", "2"],
  ] as const) {
    await surface.locator(`g[data-id="${id}"]`).click();
    await surface.locator("[data-replacement]").fill(replacement);
    await surface.locator("[data-change-form] button[type=submit]").click();
  }
  await surface.locator("[data-preview]").click();
  await expect(surface.locator(".mei-notation-pane header")).toContainText("Correction preview");
  await expect(surface.locator("[data-staged]")).toContainText("note-1");
  await expect(surface.locator("[data-staged]")).toContainText("note-4");
  await surface.locator("[data-commit]").click();
  await expect(surface.locator(".artifact-preview-meta")).toContainText("canonical version 2");

  await page.reload();
  await expect(surface.locator(".artifact-preview-meta")).toContainText("canonical version 2");
  await expect(surface).toHaveAttribute("data-ready", "true");
  const undoResponse = page.waitForResponse((response) => response.url().endsWith("/undo"));
  await surface.locator("[data-undo]").click();
  const undoResult = await undoResponse;
  const undoBody = await undoResult.json();
  expect(undoResult.ok(), JSON.stringify(undoBody)).toBe(true);
  await expect(surface.locator(".artifact-preview-meta")).toContainText("canonical version 3");
});
