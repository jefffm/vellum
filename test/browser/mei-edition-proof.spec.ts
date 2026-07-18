import { expect, test } from "@playwright/test";

test("pinned MEI edition proof renders, selects, highlights, and exports", async ({ page }) => {
  await page.goto("/?editionProof=1");

  const surface = page.locator(".mei-edition-surface");
  await expect(surface).toBeVisible();
  await expect(surface.locator(".artifact-preview-meta")).toContainText("Verovio 6.2.0", {
    timeout: 60_000,
  });
  await expect(
    surface.locator('[data-notation][data-artifact-profile="verovio-svg"]')
  ).toBeVisible();
  await expect(surface.locator('g[data-id="note-1"]')).toBeVisible();
  await expect(surface.locator('g[data-id="rhythm-1"]')).toBeVisible();

  await surface.locator('g[data-id="note-1"]').click();
  await expect(surface.locator("[data-selection]")).toContainText(
    "edition.visee-proof.1 v1 · note-1"
  );
  await expect(surface.locator('g[data-id="note-1"]')).toHaveClass(/score-selected/);

  await surface.locator("[data-play]").click();
  await expect(surface.locator('g[data-id="note-1"]')).toHaveClass(/mei-playback-active/);

  const download = page.waitForEvent("download");
  await surface.locator("[data-export]").click();
  expect((await download).suggestedFilename()).toBe("vellum-mei-edition-proof.pdf");
});
