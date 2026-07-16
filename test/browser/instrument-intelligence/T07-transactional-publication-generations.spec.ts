import { expect, test, type Page } from "@playwright/test";

test("Workbench reloads one exact generation and shows immutable successor relationships", async ({
  page,
}) => {
  const fixture = publicationFixture();
  await installOwnerWorkbenchFixture(page, () => fixture);

  await openWorkbench(page);
  const publication = page.locator(".knowledge-publication-section");
  await expect(publication).toContainText("Current generation r2");
  await expect(publication).toContainText("publication-generation.second");
  await expect(publication).toContainText("Successor of publication-generation.first at r1");
  await expect(publication).toContainText("Successor of Knowledge Pack Draft · draft.first");
  await expect(publication).not.toContainText("PRIVATE-PAYLOAD-CANARY");

  await page.reload();
  await openWorkbench(page);
  await expect(page.locator(".knowledge-publication-section")).toContainText(
    "publication-generation.second"
  );
});

test("Workbench reclaims only an unreachable generation and refreshes exact head state", async ({
  page,
}) => {
  let state = publicationFixture(true);
  let reclaimed: string | undefined;
  await installOwnerWorkbenchFixture(
    page,
    () => state,
    async (generationId) => {
      reclaimed = generationId;
      state = { ...state, orphans: [] };
    }
  );

  await openWorkbench(page);
  const publication = page.locator(".knowledge-publication-section");
  await expect(publication).toContainText("Recoverable unreachable generations (1)");
  await publication.getByText("Recoverable unreachable generations (1)", { exact: true }).click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "owner-reference-publication-orphan.111111111111111111111111"
    );
    await dialog.accept();
  });
  await publication
    .getByRole("button", {
      name: "Reclaim owner-reference-publication-orphan.111111111111111111111111",
    })
    .click();
  await expect.poll(() => reclaimed).toBe("publication-generation.unreachable");
  await expect(page.locator(".knowledge-publication-section")).toContainText(
    "Recoverable unreachable generations (0)"
  );
  await expect(page.locator(".knowledge-publication-section")).toContainText(
    "publication-generation.second"
  );
});

test("Workbench fails closed instead of rendering a mixed or unknown publication response", async ({
  page,
}) => {
  const state = publicationFixture() as Record<string, unknown>;
  state.privatePath = "/Users/owner/PRIVATE-PATH-CANARY.pdf";
  await installOwnerWorkbenchFixture(page, () => state);

  await openWorkbench(page);
  const publication = page.locator(".knowledge-publication-section");
  await expect(publication).toContainText("Publication generations unavailable");
  await expect(publication).not.toContainText("publication-generation.second");
  await expect(publication).not.toContainText("PRIVATE-PATH-CANARY");
});

async function installOwnerWorkbenchFixture(
  page: Page,
  state: () => unknown,
  reclaim?: (generationId: string) => Promise<void>
): Promise<void> {
  await page.route("**/api/owner", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success({
        personalDefaultCandidates: [],
        personalDefaults: [],
        ownerReferences: [],
        knowledgeCandidates: [],
        historicalPracticeClaims: [],
      }),
    });
  });
  await page.route("**/api/owner/reference-source-staging", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success({
        publicationState: "staging_only",
        view: { kind: "current" },
        head: null,
        snapshot: { records: [] },
        capabilities: { stagingTransactions: true, canonicalPublication: false },
      }),
    });
  });
  await page.route("**/api/owner/knowledge-publication**", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/orphans\/(publication-generation\.[A-Za-z0-9._-]+)$/);
    if (route.request().method() === "DELETE" && match) {
      await reclaim?.(match[1]!);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: success({ reclaimed: true }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: success(state()) });
  });
}

async function openWorkbench(page: Page): Promise<void> {
  await page.goto("/");
  const guidedStart = page.locator("#guided-start");
  if (await guidedStart.isVisible()) {
    await guidedStart.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Knowledge & defaults" }).click();
  await expect(page.locator("#vellum-owner-workbench")).toBeVisible();
  await expect(page.locator(".knowledge-publication-section")).toBeVisible();
}

function publicationFixture(withOrphan = false) {
  const first = {
    recordKind: "knowledge_pack_draft",
    id: "draft.first",
    digest: "1".repeat(64),
  };
  const second = {
    recordKind: "knowledge_pack_draft",
    id: "draft.second",
    digest: "2".repeat(64),
  };
  return {
    current: {
      head: {
        generationId: "publication-generation.second",
        digest: "b".repeat(64),
        revision: 2,
      },
      generation: {
        schemaVersion: 1,
        id: "publication-generation.second",
        revision: 2,
        parentGenerationRef: {
          id: "publication-generation.first",
          digest: "a".repeat(64),
          revision: 1,
        },
        transactionId: "transaction.second",
        writerKind: "upload",
        createdAt: "2026-07-15T12:00:00.000Z",
        requestDigest: "c".repeat(64),
        recordRefs: [first, second],
        newRecordRefs: [second],
        digest: "b".repeat(64),
      },
      records: [
        {
          schemaVersion: 1,
          ...first,
          successorRefs: [],
        },
        {
          schemaVersion: 1,
          ...second,
          successorRefs: [first],
        },
      ],
    },
    orphans: withOrphan
      ? [
          {
            generationId: "publication-generation.unreachable",
            displayRef: {
              id: "owner-reference-publication-orphan.111111111111111111111111",
              digest: "1".repeat(64),
            },
            state: "complete_staging",
            transactionId: "transaction.unreachable",
            revision: 3,
            parentGenerationRef: {
              id: "publication-generation.second",
              digest: "b".repeat(64),
              revision: 2,
            },
            stagedRecordCount: 1,
          },
        ]
      : [],
  };
}

function success(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}
