import { expect, test } from "@playwright/test";

test("keyboard-first historical-tab review confirms, edits, navigates, and restores its draft", async ({
  page,
}) => {
  const workspaceId = "workspace.00000000-0000-4000-8000-000000000001";
  const runId = "tab-recognition.00000000-0000-4000-8000-000000000002";
  const region = { x: 0.08, y: 0.15, width: 0.18, height: 0.3 };
  const run = {
    id: runId,
    sourceArtifactId: "source.00000000-0000-4000-8000-000000000003",
    sourcePage: 1,
    schemaVersion: 1,
    backend: { id: "vellum.printed-tab-geometry", version: "2", configuration: {} },
    profile: {
      id: "profile.french-five-course.printed.unlabeled",
      version: 1,
      courseCount: 5,
      notationType: "tab.lute.french",
      vocabulary: [..."abcdefghiklmn"],
      spatialRules: {
        courseAlignmentToleranceGap: 0.65,
        minimumGlyphWidthGap: 0.4,
        maximumGlyphWidthGap: 1.35,
        minimumGlyphHeightGap: 0.4,
        maximumGlyphHeightGap: 1.45,
        shapeDistanceThreshold: 8,
      },
    },
    image: { width: 1000, height: 600, threshold: 158 },
    systems: [
      {
        id: "system-1",
        region,
        staffLines: [0.18, 0.21, 0.24, 0.27, 0.3],
        staffPixelLines: [108, 126, 144, 162, 180],
        barlines: [],
        events: [1, 2, 3].map((number) => ({
          id: `system-1-event-${number}`,
          region: { ...region, x: 0.08 + (number - 1) * 0.2 },
          anchorX: 0.17 + (number - 1) * 0.2,
          glyphIds: [`system-1-glyph-${number}`],
          verticalCandidateIds: [],
          reviewState: "unreviewed",
        })),
      },
    ],
    glyphs: [1, 2, 3].map((number) => ({
      id: `system-1-glyph-${number}`,
      region: { x: 0.1 + (number - 1) * 0.2, y: 0.18, width: 0.02, height: 0.03 },
      pixelBounds: {
        left: 100 + (number - 1) * 200,
        top: 108,
        right: 119 + (number - 1) * 200,
        bottom: 125,
      },
      area: 80,
      fingerprint: String(number).repeat(64),
      shapeFingerprint: "a".repeat(64),
      shapeCode: "01".repeat(18),
      clusterEligible: true,
      clusterId: number === 2 ? "cluster-2" : "cluster-1",
      courseCandidate: 1,
    })),
    clusters: [
      {
        id: "cluster-1",
        kind: "fret-letter",
        signature: `fret:${"a".repeat(64)}`,
        shapeCode: "01".repeat(18),
        glyphIds: ["system-1-glyph-1", "system-1-glyph-3"],
        label: null,
      },
      {
        id: "cluster-2",
        kind: "fret-letter",
        signature: `fret:${"b".repeat(64)}`,
        shapeCode: "02".repeat(18),
        glyphIds: ["system-1-glyph-2"],
        label: null,
      },
    ],
    hypotheses: [],
    diagnostics: ["Project-authored browser candidate."],
    pageImageSha256: "a".repeat(64),
    createdAt: "2026-07-19T12:00:00.000Z",
  };
  await page.route(
    `**/api/workspaces/${workspaceId}/historical-tab-recognition-runs/${runId}`,
    async (route) => {
      if (route.request().url().endsWith("/facsimile")) {
        await route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n+0AAAAASUVORK5CYII=",
            "base64"
          ),
        });
      } else {
        await route.fulfill({ json: { ok: true, data: run } });
      }
    }
  );

  const url = `/?workspace=${workspaceId}&tabRecognition=${runId}`;
  await page.goto(url);
  const surface = page.locator(".historical-tab-workspace");
  await expect(surface).toBeVisible();
  await expect(surface.locator("[data-location]")).toContainText("Event 1 of 3");
  await surface.press("S");
  await expect(surface.locator("[data-location]")).toContainText("Event 1 of 4");
  await surface.press("Meta+z");
  await expect(surface.locator("[data-location]")).toContainText("Event 1 of 3");
  await surface.press("1");
  await surface.press("c");
  await surface.press("1");
  await surface.press("Alt+0");
  const propagation = surface.locator("[data-propagate]");
  await expect(propagation).toContainText("1 matching glyph");
  await propagation.click();
  await surface.press("Enter");
  await expect(surface.locator("[data-location]")).toContainText("Event 2 of 3");
  await expect(surface.locator("[data-progress]")).toContainText("1 confirmed");
  await surface.press("R");
  await surface.press("?");
  await expect(surface.locator("[data-progress]")).toContainText("1 ambiguous");
  await expect(surface.getByLabel("Course 1 fret letter")).toHaveValue("c");

  await page.reload();
  await expect(surface).toBeVisible();
  await expect(surface.locator("[data-progress]")).toContainText("1 confirmed");
  await expect(surface.locator("[data-progress]")).toContainText("1 ambiguous");

  let publishedBody: Record<string, unknown> | undefined;
  await page.route(
    `**/api/workspaces/${workspaceId}/historical-tab-recognition-runs/${runId}/publish`,
    async (route) => {
      publishedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        json: {
          ok: true,
          data: {
            edition: { editionId: "edition.00000000-0000-4000-8000-000000000004" },
            recognitionProfile: {
              id: "tab-profile.00000000-0000-4000-8000-000000000005",
            },
          },
        },
      });
    }
  );
  await surface.press("R");
  await surface.press("Enter");
  const publish = surface.locator("[data-publish]");
  await expect(publish).toBeDisabled();
  await surface
    .getByLabel(
      "Did source placement and the keyboard workflow materially reduce locating, regrouping, and repetitive entry?"
    )
    .selectOption("yes");
  await surface
    .getByLabel(
      "Could every visible-evidence dimension be recorded without a missing or systematically slow interaction?"
    )
    .selectOption("yes");
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect.poll(() => publishedBody).toBeTruthy();
  expect(publishedBody).toMatchObject({
    title: "Source page 1 diplomatic transcription",
    reviewMetrics: {
      reviewed: 3,
      unresolved: 1,
      elapsedReviewSeconds: expect.any(Number),
      ownerJudgment: {
        materiallyReducedRepetitiveEntry: true,
        allEvidenceDimensionsEfficientlyRecordable: true,
      },
    },
  });
});
