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

test("PDF input discloses OCR threshold and score review remains zoomable and unobscured", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.locator("#guided-start");
  const threshold = dialog.locator("[data-ocr-threshold-field]");
  await expect(threshold).toBeHidden();
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("test/fixtures/greensleeves/greensleeves-satb.pdf"));
  await expect(threshold).toBeVisible();
  await threshold.locator("input").fill("72");
  await expect(threshold.locator("[data-ocr-threshold-value]")).toHaveText("72%");

  await page.evaluate(async () => {
    const { presentScoreAnchoredReview } = await import("/src/guided-start.ts");
    const dialog = document.querySelector<HTMLDialogElement>("#guided-start")!;
    const image =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200"><rect width="100%" height="100%" fill="white"/><text x="300" y="400" font-size="80">♩</text></svg>'
      );
    void presentScoreAnchoredReview(
      dialog,
      {
        transcriptionId: "transcription.browser-review",
        version: 1,
        status: "needs_review",
        sourceArtifactId: "source.browser-review",
        sourceFilename: "greensleeves-satb.pdf",
        sourceContentUrl: image,
        acceptanceBatches: [],
        items: [],
      },
      {
        uncertainty: {
          id: "uncertainty.browser-review",
          eventIds: ["event.browser-review"],
          critical: true,
          category: "pitch_recognition",
          message: "Confirm this note against the retained source crop.",
          alternatives: ["G4"],
          resolved: false,
          region: {
            page: 1,
            x: 280,
            y: 320,
            width: 160,
            height: 140,
            coordinateSpace: "omr_raster",
          },
        },
        sourceImageUrl: image,
        events: [
          {
            id: "event.browser-review",
            type: "note",
            partId: "part.browser-review",
            measureId: "measure.browser-review",
            onset: { numerator: 0, denominator: 1 },
            duration: { numerator: 1, denominator: 1 },
            pitch: "G4",
            confidence: 0.72,
          },
        ],
      }
    ).catch(() => undefined);
  });

  const review = dialog.locator("[data-score-review]");
  await expect(review).toBeVisible();
  const highlight = review.locator("[data-review-source-highlight]");
  await expect(highlight).toBeVisible();
  await expect(highlight).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await review.locator("[data-review-zoom-in]").click();
  await expect(review.locator("[data-review-zoom-value]")).toHaveText("150%");
  expect(
    await review.locator("[data-review-source-canvas]").evaluate((node) => node.style.width)
  ).toBe("150%");
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds?.width).toBeGreaterThan(900);
});

test("selected notes drive anchored feedback, a reasoned child version, and note-level seeking", async ({
  page,
}) => {
  await page.goto("/");
  const guided = page.locator("#guided-start");
  await guided
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("test/fixtures/imitation/imitative-passage.ly"));
  await guided.locator('input[name="title"]').fill("Interactive revision browser proof");
  await guided.locator('input[value="target.baroque-guitar"]').uncheck();
  await guided.locator('input[value="target.renaissance-lute"]').check();
  await guided.locator('button[type="submit"]').click();
  const status = guided.locator("[data-guided-status]");
  const analysisChoices = guided.locator("[data-analysis-choices] button");
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    if (await analysisChoices.first().isVisible()) await analysisChoices.first().click();
    const message = (await status.textContent()) ?? "";
    if (message.includes("Arrangement ready")) break;
    if ((await status.getAttribute("data-error")) === "true") throw new Error(message);
    await page.waitForTimeout(500);
  }
  await expect(status).toContainText("Arrangement ready", { timeout: 300_000 });

  const panel = page.locator("#artifacts-panel");
  const notes = panel.locator("svg [data-arrangement-event-id]");
  await expect(notes.first()).toBeVisible();
  const firstId = await notes.nth(0).getAttribute("data-arrangement-event-id");
  const secondId = await notes.nth(1).getAttribute("data-arrangement-event-id");
  expect(firstId).toBeTruthy();
  expect(secondId).toBeTruthy();
  await notes.nth(0).click();
  const firstPlayheadX = await panel.locator(".score-playhead").getAttribute("x1");
  await notes.nth(1).click({ modifiers: ["Shift"] });

  const selection = panel.locator(".score-selection-summary");
  await expect(selection).toContainText("2 musical objects selected");
  await expect(selection).toHaveAttribute("data-arrangement-event-ids", `${firstId} ${secondId}`);
  await selection.locator("summary", { hasText: "Exact selection identity" }).click();
  await expect(selection.locator("code")).toContainText(firstId!);
  await expect(selection.locator("code")).toContainText(secondId!);
  await expect(notes.nth(0)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const secondPlayheadX = await panel.locator(".score-playhead").getAttribute("x1");
  expect(secondPlayheadX).not.toBe(firstPlayheadX);
  const playbackPosition = panel.getByLabel("Playback position");
  const startedAt = Number(await playbackPosition.inputValue());
  await panel.getByRole("button", { name: "▶ Play" }).click();
  await expect(panel.getByRole("button", { name: "Ⅱ Pause" })).toBeEnabled();
  await expect
    .poll(async () => Number(await playbackPosition.inputValue()))
    .toBeGreaterThan(startedAt);
  await panel.getByRole("button", { name: "Ⅱ Pause" }).click();
  const pausedAt = Number(await playbackPosition.inputValue());
  await page.waitForTimeout(250);
  expect(Number(await playbackPosition.inputValue())).toBe(pausedAt);
  await panel.getByRole("button", { name: "▶ Play" }).click();
  await expect
    .poll(async () => Number(await playbackPosition.inputValue()))
    .toBeGreaterThan(pausedAt);
  await panel.getByRole("button", { name: "Ⅱ Pause" }).click();

  await page.evaluate(() => {
    (window as Window & { capturedSelectionPrompt?: unknown }).capturedSelectionPrompt = undefined;
    document.addEventListener(
      "vellum-ask-selection",
      (event) => {
        (window as Window & { capturedSelectionPrompt?: unknown }).capturedSelectionPrompt = (
          event as CustomEvent
        ).detail;
      },
      { once: true }
    );
  });
  await selection
    .getByLabel("Question about selected score events")
    .fill("Why is this passage awkward?");
  await selection.getByRole("button", { name: "Ask Vellum" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.stringify(
          (window as Window & { capturedSelectionPrompt?: unknown }).capturedSelectionPrompt
        )
      )
    )
    .toContain(firstId!);
  expect(
    await page.evaluate(() =>
      JSON.stringify(
        (window as Window & { capturedSelectionPrompt?: unknown }).capturedSelectionPrompt
      )
    )
  ).toContain(secondId!);
  const disclosure = page.getByRole("dialog", { name: "Authorize this one-time ChatGPT request?" });
  await expect(disclosure).toBeVisible();
  await disclosure.getByRole("button", { name: "Don't send" }).click();

  await selection.getByRole("button", { name: "Clear" }).click();
  await notes.nth(0).click();
  const parentId = new URL(page.url()).searchParams.get("arrangement");
  await panel.getByRole("button", { name: "Edit selection" }).click();
  await panel.getByRole("button", { name: "Continue with arrangement score" }).click();

  const edit = page.locator("#vellum-edit-batch");
  await expect(edit).toBeVisible();
  const positions = edit.locator('textarea[name="positions"]');
  await positions.fill(
    JSON.stringify([{ course: 6, fret: 7, quality: "high_fret", pitch: "D3" }], null, 2)
  );
  await edit
    .getByLabel("Edit batch rationale")
    .fill("Use the equivalent sixth-course position for this D.");
  await expect(edit.getByRole("button", { name: "Save as new version" })).toBeEnabled({
    timeout: 30_000,
  });
  await edit.getByRole("button", { name: "Save as new version" }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("arrangement"), { timeout: 120_000 })
    .not.toBe(parentId);
  await expect(panel.locator(".arrangement-version-navigator summary")).toContainText(
    "Arrangement Score v2"
  );
  await panel.locator(".arrangement-version-navigator summary").click();
  await panel.getByRole("button", { name: "Open parent v1" }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("arrangement"), { timeout: 120_000 })
    .toBe(parentId);
  await expect(panel.locator(".arrangement-version-navigator")).toContainText(
    /positions|course fingering/
  );
});
