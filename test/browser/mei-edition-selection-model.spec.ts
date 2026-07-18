import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { DiplomaticToken } from "../../src/lib/mei-edition-domain.js";
import { FRENCH_TAB_MEI_FIXTURE } from "../../src/lib/mei-edition-fixtures.js";

async function data<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { ok: true; data: T };
  return body.data;
}

test("versioned Passage Selection drives a bounded fake-provider proposal and reviewed batch", async ({
  page,
  request,
}) => {
  const workspace = await data<{ id: string }>(
    await request.post("/api/workspaces", { data: { title: "MEI selection browser test" } })
  );
  const pdf = readFileSync(path.resolve("test/fixtures/greensleeves/greensleeves-satb.pdf"));
  const source = await data<{ id: string }>(
    await request.post(`/api/workspaces/${workspace.id}/sources`, {
      data: pdf,
      headers: {
        "Content-Type": "application/pdf",
        "X-Source-Filename": "private-facsimile.pdf",
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
    confidence: 0.95,
    alternatives: [],
    critical: false,
  }));
  const created = await data<{
    edition: { editionId: string; version: number };
    svg: string;
    rendererVersion: string;
    sourceContentUrl: string;
  }>(
    await request.post(`/api/workspaces/${workspace.id}/mei-editions`, {
      data: {
        sourceArtifactId: source.id,
        sourcePage: 1,
        title: "Project-authored Sarabande",
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
  const captured: { intent?: string; correctionBodies: unknown[] } = { correctionBodies: [] };
  await installFakeModelAndCorrectionBoundary(page, workspace.id, created, captured);

  await page.goto(`/?workspace=${workspace.id}&meiEdition=${created.edition.editionId}`);
  const surface = page.locator(".diplomatic-edition-workspace");
  const selection = surface.locator(".mei-selection-workbench");
  await expect(selection).toBeVisible();

  await surface.locator('g[data-id="note-1"]').click();
  await surface.locator('g[data-id="note-4"]').click({ modifiers: ["Shift"] });
  await expect(selection.locator("[data-selection-status]")).toContainText("contiguous");
  await surface.locator('g[data-id="note-1"]').click();
  await surface.locator('g[data-id="note-6"]').click({ modifiers: ["Meta"] });
  await expect(selection.locator("[data-selection-status]")).toContainText("noncontiguous");
  await selection.locator("[data-role-filter]").selectOption("treble_courses");
  await expect(selection.locator("[data-selection-status]")).toContainText("1 canonical object");
  await selection.locator("[data-role-filter]").selectOption("all");
  await surface.locator('g[data-id="note-6"]').click({ modifiers: ["Meta"] });
  await surface.locator("[data-score-zoom-in]").click();
  await expect(surface.locator('g[data-id="note-1"]')).toHaveClass(/passage-selected/);
  await page.setViewportSize({ width: 780, height: 900 });
  await expect(surface.locator('g[data-id="note-1"]')).toHaveClass(/passage-selected/);

  const context = selection.locator("[data-context]");
  await expect(context).toContainText('"facsimileIncluded": false');
  await expect(context).toContainText('"editionVersion": 1');
  await selection.locator("[data-ask-model]").click();
  const dialog = page.locator("dialog.model-egress-disclosure");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Provider tools");
  await expect(dialog).toContainText("None");
  await dialog.getByRole("button", { name: "Authorize once" }).click();
  await expect(selection.locator("[data-model-status]")).toContainText(
    "Model Action Result Commit"
  );
  expect(captured.correctionBodies).toHaveLength(0);
  expect(captured.intent).toContain("Selection-Context-SHA256:");
  expect(captured.intent).toContain("Facsimile-Included: false");
  expect(captured.intent).not.toContain("private-facsimile.pdf");
  expect(captured.intent).not.toContain("%PDF");

  const row = selection.locator(".mei-proposal-row");
  await expect(row).toHaveCount(2);
  await row.first().locator("select").selectOption("approved");
  await selection.getByRole("button", { name: "Preview reviewed set" }).click();
  await expect(selection.locator("[data-proposal-preview]")).toContainText(
    "Complete staged preview"
  );
  await selection.getByRole("button", { name: "Commit reviewed Correction Batch" }).click();
  await expect(surface.locator(".artifact-preview-meta")).toContainText("canonical version 2");
  await expect(surface.locator("[data-selection-status]")).toContainText(
    "remapped unambiguously from v1"
  );

  expect(captured.correctionBodies).toHaveLength(2);
  const committed = captured.correctionBodies[1] as {
    changes: unknown[];
    modelProvenance: { decisions: Array<{ decision: string }>; selectionContext: unknown };
  };
  expect(committed.changes).toHaveLength(1);
  expect(committed.modelProvenance.decisions).toEqual([
    expect.objectContaining({ decision: "approved" }),
    expect.objectContaining({ decision: "rejected" }),
  ]);
  expect(JSON.stringify(committed.modelProvenance.selectionContext)).not.toContain("%PDF");
});

async function installFakeModelAndCorrectionBoundary(
  page: Page,
  workspaceId: string,
  projected: {
    edition: { editionId: string; version: number };
    svg: string;
    rendererVersion: string;
    sourceContentUrl: string;
  },
  captured: { intent?: string; correctionBodies: unknown[] }
) {
  const actionId = "model-action.22222222-2222-4222-8222-222222222222";
  const publicationId = "model-publication.33333333-3333-4333-8333-333333333333";
  const commitId = "result-commit.44444444-4444-4444-8444-444444444444";
  const disclosureDigest = "a".repeat(64);
  const envelopeDigest = "b".repeat(64);
  await page.route(`**/api/workspaces/${workspaceId}/model-actions**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/model-actions")) {
      captured.intent = (route.request().postDataJSON() as { intent: string }).intent;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: pending(captured.intent, actionId, disclosureDigest) }),
      });
      return;
    }
    if (pathname.endsWith("/authorization")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...pending(captured.intent!, actionId, disclosureDigest),
            status: "authorized",
            attempts: [
              {
                ...pending(captured.intent!, actionId, disclosureDigest).attempts[0],
                envelopeDigest,
              },
            ],
          },
        }),
      });
      return;
    }
    if (pathname.endsWith("/run")) {
      const content = JSON.stringify({
        summary: "One bounded fake-provider suggestion",
        layer: "transcription",
        suggestions: [
          {
            id: "suggestion.1",
            tokenId: "note-1",
            attribute: "tab.fret",
            replacementValue: "2",
            rationale: "Project-authored fake provider suggestion.",
          },
          {
            id: "suggestion.2",
            tokenId: "note-6",
            attribute: "tab.fret",
            replacementValue: "3",
            rationale: "A second fake suggestion that the Owner will reject.",
          },
        ],
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            action: {
              ...pending(captured.intent!, actionId, disclosureDigest),
              status: "completed",
              publicationReference: publicationId,
            },
            publication: {
              id: publicationId,
              result: { content },
              commit: { id: commitId },
            },
          },
        }),
      });
      return;
    }
    await route.abort();
  });
  await page.route(
    `**/api/workspaces/${workspaceId}/mei-editions/${projected.edition.editionId}/correction-*`,
    async (route) => {
      captured.correctionBodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            ...projected,
            edition: {
              ...projected.edition,
              version: 2,
              parentVersion: 1,
            },
          },
        }),
      });
    }
  );
}

function pending(intent: string, actionId: string, disclosureDigest: string) {
  return {
    id: actionId,
    status: "awaiting_authorization",
    attempts: [
      {
        disclosureDigest,
        disclosure: {
          id: "egress-disclosure.55555555-5555-4555-8555-555555555555",
          actionId,
          attemptId: "model-attempt.66666666-6666-4666-8666-666666666666",
          provider: "openai-codex",
          model: "gpt-5.3-codex",
          purpose: "interactive_musicological_guidance",
          policyDigest: "c".repeat(64),
          systemPromptDigest: "d".repeat(64),
          serializedRequestDigest: "e".repeat(64),
          ownerIntent: intent,
          ownerIntentDigest: "f".repeat(64),
          dataClasses: ["owner_intent"],
          sourceReferences: [],
          toolCapabilities: [],
          policyDecision: "allow",
          policyReason: "Only the bounded Selection Context is proposed for egress.",
          requiresOwnerAuthorization: true,
          createdAt: "2026-07-17T20:00:00.000Z",
        },
      },
    ],
  };
}
