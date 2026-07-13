import { expect, test } from "@playwright/test";
import path from "node:path";

test("tablature preview remains legible and global navigation stays out of the score", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("#artifacts-panel")!;
    panel.innerHTML = `<section class="artifact-preview-shell"><div class="artifact-preview-viewport"><div class="artifact-preview-content"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><g class="vellum-score-event playback-active playback-principal-active"><g><g><rect x="1" y="1" width="2" height="2" fill="currentColor"/></g></g><g><text><tspan>b</tspan></text></g></g></svg></div></div></section>`;
  });

  const playbackEvent = page.locator("#artifacts-panel .vellum-score-event.playback-active");
  await expect(playbackEvent.locator("g:has(+ g text) rect")).toHaveCSS(
    "fill",
    "rgb(255, 255, 255)"
  );
  await expect(playbackEvent).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(playbackEvent).toHaveCSS("outline-style", "none");
  await expect(playbackEvent).toHaveCSS("color", "rgb(24, 95, 143)");
  const artifactBounds = await page.locator("#artifacts-panel").boundingBox();
  expect(artifactBounds).not.toBeNull();
  for (const id of ["#workspace-navigator-launcher", "#owner-workbench-launcher"]) {
    const bounds = await page.locator(id).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(artifactBounds!.x);
  }
});

test("source upload reaches reviewed completion and opens the exact artifact", async ({ page }) => {
  await page.goto("/");
  const dialog = page.locator("#guided-start");
  await expect(dialog).toBeVisible();
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("test/fixtures/imitation/imitative-passage.ly"));
  await dialog.locator('input[name="title"]').fill("Browser gate imitative study");
  await dialog.locator('input[value="target.baroque-guitar"]').uncheck();
  await dialog.locator('input[value="target.renaissance-lute"]').check();
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog.locator("[data-guided-status]")).not.toContainText(/not allowed|could not/i);

  const analysisChoices = dialog.locator("[data-analysis-choices] button");
  const ready = dialog.locator("[data-guided-status]");
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    if (await analysisChoices.first().isVisible()) await analysisChoices.first().click();
    const status = (await ready.textContent()) ?? "";
    if (status.includes("Arrangement ready")) break;
    if ((await ready.getAttribute("data-error")) === "true") throw new Error(status);
    await page.waitForTimeout(500);
  }

  await expect(ready).toContainText("Arrangement ready", { timeout: 300_000 });
  await expect(page.locator("#artifacts-panel")).toContainText("Renaissance lute");
  await expect(page.locator("#artifacts-panel")).toContainText(/Preservation Audit/i);
  await expect(page.locator("#artifacts-panel")).toContainText(/Audio Preview/i);
  await expect(page.locator("#artifacts-panel")).toHaveAttribute(
    "data-arrangement-id",
    /^arrangement\./
  );
});
