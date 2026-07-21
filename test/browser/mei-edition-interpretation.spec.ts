import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { DiplomaticToken } from "../../src/lib/mei-edition-domain.js";
import { FRENCH_TAB_MEI_FIXTURE } from "../../src/lib/mei-edition-fixtures.js";

async function data<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { ok: true; data: T };
  return body.data;
}

test("exact interpretation drives provisional playback and separate acceptance", async ({
  page,
  request,
}) => {
  const meiWithGenericGesture = FRENCH_TAB_MEI_FIXTURE.replace(
    '</tabGrp>\n      <tabGrp dur="8" xml:id="event-2">',
    '</tabGrp><annot xml:id="gesture-1" facs="#zone-event-1" type="visible-vertical-gesture" startid="#event-1">vertical-stroke</annot>\n      <tabGrp dur="8" xml:id="event-2">'
  );
  const workspace = await data<{ id: string }>(
    await request.post("/api/workspaces", { data: { title: "MEI interpretation browser test" } })
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
    "gesture-1",
  ];
  const tokens: DiplomaticToken[] = ids.map((id, index) => ({
    id,
    kind: id.startsWith("rhythm") ? "rhythm" : id === "gesture-1" ? "other" : "tablature",
    region: { page: 1, x: 0.06 + index * 0.08, y: 0.12, width: 0.045, height: 0.08 },
    confidence: 0.95,
    alternatives: [],
    critical: false,
  }));
  const created = await data<{ edition: { editionId: string } }>(
    await request.post(`/api/workspaces/${workspace.id}/mei-editions`, {
      data: {
        sourceArtifactId: source.id,
        sourcePage: 1,
        title: "Project-authored Sarabande",
        mei: meiWithGenericGesture,
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
  const workbench = surface.locator(".mei-interpretation-workbench");
  await expect(workbench).toBeVisible();
  await expect(workbench.locator("[data-gesture-readings]")).toBeVisible();
  await expect(workbench.locator('[data-gesture-event-id="event-1"]')).toHaveValue("pince");
  await workbench.locator("[data-tempo]").fill("60");
  await workbench.locator("[data-tunings]").fill("1:64; 2:59; 3:55; 4:50; 5:45,57");
  await workbench.locator("[data-passes]").fill("2");
  await workbench.locator("[data-interpretation-form] button[type=submit]").click();

  const select = workbench.locator("[data-interpretation-select]");
  await expect(select).toHaveValue(/tab-interpretation\./);
  await expect(workbench.locator("[data-playback-status]")).toContainText(
    "Provisional audition only"
  );
  await expect(workbench.locator("[data-authority]")).toContainText("cannot authorize analysis");

  const position = workbench.locator("[data-position]");
  await workbench.locator("[data-play]").click();
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0.08);
  await workbench.locator("[data-pause]").click();
  const pausedAt = Number(await position.inputValue());
  await page.waitForTimeout(120);
  expect(Number(await position.inputValue())).toBeCloseTo(pausedAt, 2);
  await position.evaluate((input: HTMLInputElement) => {
    input.value = "0.1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(surface.locator('g[data-id="note-1"]')).toHaveClass(/mei-playback-active/);
  await workbench.locator("[data-score-zoom-in]").click();
  await expect(surface.locator('g[data-id="note-1"]')).toHaveClass(/mei-playback-active/);
  await workbench.locator("[data-stop]").click();
  await expect(position).toHaveValue("0");
  await expect(surface.locator(".mei-playback-active")).toHaveCount(0);

  await expect(workbench.locator("[data-accept-interpretation]")).toBeDisabled();
  await workbench.locator("[data-accept-transcription]").click();
  await expect(workbench.locator("[data-transcription-status]")).toContainText(
    "Transcription v1 accepted"
  );
  await workbench.locator("[data-accept-interpretation]").click();
  await expect(workbench.locator("[data-playback-status]")).toContainText(
    "Accepted interpretation"
  );
  await expect(workbench.locator("[data-playback-status]")).toContainText(
    "literal_playback, analysis"
  );

  const stateResponse = await request.get(
    `/api/workspaces/${workspace.id}/mei-editions/${created.edition.editionId}/interpretation-state`
  );
  expect(stateResponse.ok()).toBe(true);
  const state = (await stateResponse.json()) as {
    data: {
      interpretations: Array<{ pinceRealizations?: Array<{ eventId: string }> }>;
      decisions: unknown[];
    };
  };
  expect(state.data.interpretations).toHaveLength(1);
  expect(state.data.interpretations[0]?.pinceRealizations).toEqual([{ eventId: "event-1" }]);
  expect(state.data.decisions).toHaveLength(2);
});
