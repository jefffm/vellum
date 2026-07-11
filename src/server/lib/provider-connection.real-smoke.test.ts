import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { afterAll, describe, expect, it } from "vitest";
import { ProviderConnection } from "./provider-connection.js";

const enabled = process.env.VELLUM_REAL_CHATGPT_SMOKE === "1";
const execute = promisify(execFile);
let directory = "";

describe.runIf(enabled)("real ChatGPT Provider Connection smoke", () => {
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("connects, makes one minimal request, disconnects, and reconnects without reporting secrets", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "vellum-real-provider-"));
    const connection = new ProviderConnection({ authFile: path.join(directory, "auth.json") });

    await authorizeInBrowser(connection, false);
    expect(await connection.status()).toMatchObject({ state: "connected" });
    const apiKey = await connection.resolveApiKey();
    expect(apiKey).toBeTruthy();

    const stream = streamSimple(
      getModel("openai-codex", "gpt-5.3-codex"),
      { messages: [{ role: "user", content: "Reply with OK only", timestamp: Date.now() }] },
      { apiKey, maxTokens: 8 }
    );
    let completed = false;
    for await (const event of stream) {
      if (event.type === "done") completed = true;
      if (event.type === "error") throw new Error("Real provider returned a redacted error");
    }
    expect(completed).toBe(true);

    await connection.disconnect();
    expect(await connection.status()).toMatchObject({ state: "disconnected" });
    await authorizeInBrowser(connection, true);
    expect(await connection.status()).toMatchObject({ state: "connected" });
    await connection.disconnect();
  }, 300_000);
});

async function authorizeInBrowser(
  connection: ProviderConnection,
  reconnect: boolean
): Promise<void> {
  const status = reconnect ? await connection.reconnect() : await connection.beginLogin();
  if (status.authUrl) await openBrowser(status.authUrl);
  await expect
    .poll(async () => (await connection.status()).state, { timeout: 120_000 })
    .toBe("connected");
}

async function openBrowser(url: string): Promise<void> {
  const configured = process.env.VELLUM_REAL_CHATGPT_OPEN_COMMAND;
  if (configured) {
    await execute(configured, [url]);
    return;
  }
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  await execute(command, [url]);
}
