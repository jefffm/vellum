import { createServer as createHttpServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { startRealBrowserAppProxy } from "./real-browser-app-proxy.js";

describe("real browser app proxy", () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("sends API and frontend requests to real isolated listeners", async () => {
    const frontend = createHttpServer((_request, response) => response.end("frontend"));
    await new Promise<void>((resolve) => frontend.listen(0, "127.0.0.1", resolve));
    cleanups.push(
      () =>
        new Promise<void>((resolve, reject) =>
          frontend.close((error) => (error ? reject(error) : resolve()))
        )
    );
    const address = frontend.address();
    if (!address || typeof address === "string") throw new Error("Expected frontend address");
    const proxy = await startRealBrowserAppProxy({
      frontendOrigin: `http://127.0.0.1:${address.port}`,
      createApiApp: (browserOrigin) => (_request, response) => response.end(`api:${browserOrigin}`),
    });
    cleanups.push(proxy.close);

    await expect(
      fetch(`${proxy.origin}/index.html`).then((response) => response.text())
    ).resolves.toBe("frontend");
    await expect(
      fetch(`${proxy.origin}/api/example`).then((response) => response.text())
    ).resolves.toBe(`api:${proxy.origin}`);
  });
});
