import { expect, test } from "@playwright/test";
import path from "node:path";

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
