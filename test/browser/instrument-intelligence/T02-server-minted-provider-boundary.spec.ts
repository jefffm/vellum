import { expect, test, type Page } from "@playwright/test";

const workspaceId = "workspace.1111111111111111";
const actionId = "model-action.2222222222222222";
const disclosureDigest = "a".repeat(64);
const envelopeDigest = "b".repeat(64);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (id) => localStorage.setItem("vellum.active-workspace", id),
    workspaceId
  );
});

test("shows the exact egress disclosure and denial never reaches run", async ({ page }) => {
  const calls: string[] = [];
  await installFakeBoundary(page, calls, false);
  await page.goto(`/?workspace=${workspaceId}`);
  await sendChatMessage(page, "Explain this cadence");

  const dialog = page.locator("dialog.model-egress-disclosure");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("openai-codex · gpt-5.3-codex");
  await expect(dialog).toContainText("interactive musicological guidance");
  await expect(dialog).toContainText("owner_intent");
  await expect(dialog).toContainText("Exact Owner text");
  await expect(dialog).toContainText("Explain this cadence");
  await expect(dialog).toContainText("Source references");
  await expect(dialog).toContainText("None");
  await expect(dialog).toContainText("Provider tools");
  await dialog.getByRole("button", { name: "Don't send" }).click();

  await expect(page.getByText(/Nothing was sent.*declined/s)).toBeVisible();
  expect(calls).toEqual(["create", "deny"]);
});

test("authorizes once and renders only the atomically published fake-provider result", async ({
  page,
}) => {
  const calls: string[] = [];
  await installFakeBoundary(page, calls, true);
  await page.goto(`/?workspace=${workspaceId}`);
  await sendChatMessage(page, "Explain this cadence");

  const dialog = page.locator("dialog.model-egress-disclosure");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Authorize once" }).click();
  await expect(page.getByText("Fake provider success from the atomic publication.")).toBeVisible();
  expect(calls).toEqual(["create", "authorize", "run"]);
});

async function sendChatMessage(page: Page, message: string): Promise<void> {
  await expect(page.locator("pi-chat-panel")).toBeAttached();
  await page.waitForFunction(() =>
    Boolean((document.querySelector("pi-chat-panel") as any)?.agentInterface?.sendMessage)
  );
  await page.evaluate((input) => {
    void (document.querySelector("pi-chat-panel") as any).agentInterface.sendMessage(input);
  }, message);
}

async function installFakeBoundary(page: Page, calls: string[], authorize: boolean): Promise<void> {
  await page.route(`**/api/workspaces/${workspaceId}/model-actions**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/model-actions")) {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: json([]) });
        return;
      }
      calls.push("create");
      await route.fulfill({ status: 200, contentType: "application/json", body: json(pending()) });
      return;
    }
    if (url.pathname.endsWith("/authorization")) {
      calls.push(authorize ? "authorize" : "deny");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: json(authorize ? authorized() : { ...pending(), status: "denied" }),
      });
      return;
    }
    if (url.pathname.endsWith("/run")) {
      calls.push("run");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: json({
          action: {
            ...authorized(),
            status: "completed",
            publicationReference: "model-publication.1",
          },
          publication: {
            id: "model-publication.1",
            result: { content: "Fake provider success from the atomic publication." },
          },
        }),
      });
      return;
    }
    await route.abort();
  });
}

function json(data: unknown): string {
  return JSON.stringify({ data });
}

function pending() {
  return {
    id: actionId,
    status: "awaiting_authorization",
    attempts: [
      {
        disclosureDigest,
        disclosure: {
          id: "egress-disclosure.3333333333333333",
          actionId,
          attemptId: "model-attempt.4444444444444444",
          provider: "openai-codex",
          model: "gpt-5.3-codex",
          purpose: "interactive_musicological_guidance",
          policyDigest: "d".repeat(64),
          systemPromptDigest: "e".repeat(64),
          serializedRequestDigest: "f".repeat(64),
          ownerIntent: "Explain this cadence",
          ownerIntentDigest: "c".repeat(64),
          dataClasses: ["owner_intent"],
          sourceReferences: [],
          toolCapabilities: [],
          policyDecision: "allow",
          policyReason: "Only the bounded Owner intent is proposed for egress.",
          requiresOwnerAuthorization: true,
          createdAt: "2026-07-15T12:00:00.000Z",
        },
      },
    ],
  };
}

function authorized() {
  return {
    ...pending(),
    status: "authorized",
    attempts: [{ ...pending().attempts[0], envelopeDigest }],
  };
}
