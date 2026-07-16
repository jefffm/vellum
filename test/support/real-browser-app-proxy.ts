import { createServer, request, type RequestListener, type Server } from "node:http";

export type RealBrowserAppProxy = Readonly<{
  origin: string;
  apiOrigin: string;
  close: () => Promise<void>;
}>;

/**
 * Serve Vite's real frontend and an isolated real API under one browser origin.
 * No Playwright route interception is involved: every `/api` request crosses
 * the production Express middleware and route stack.
 */
export async function startRealBrowserAppProxy(
  input: Readonly<{
    frontendOrigin: string;
    createApiApp: (browserOrigin: string) => RequestListener;
  }>
): Promise<RealBrowserAppProxy> {
  let apiOrigin: string | undefined;
  const proxy = createServer((incoming, outgoing) => {
    const target =
      incoming.url?.startsWith("/api") || incoming.url === "/health"
        ? apiOrigin
        : input.frontendOrigin;
    if (!target) {
      outgoing.statusCode = 503;
      outgoing.end("API not ready");
      return;
    }
    const url = new URL(incoming.url ?? "/", target);
    const upstream = request(
      url,
      {
        method: incoming.method,
        headers: { ...incoming.headers, host: url.host },
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      }
    );
    outgoing.once("close", () => {
      if (!outgoing.writableEnded) upstream.destroy();
    });
    upstream.on("error", () => {
      if (outgoing.destroyed) return;
      if (!outgoing.headersSent) outgoing.statusCode = 502;
      outgoing.end("Upstream unavailable");
    });
    incoming.pipe(upstream);
  });
  await listen(proxy);
  const origin = serverOrigin(proxy);
  const api = createServer(input.createApiApp(origin));
  try {
    await listen(api);
    apiOrigin = serverOrigin(api);
  } catch (error) {
    await close(proxy);
    throw error;
  }
  return Object.freeze({
    origin,
    apiOrigin,
    close: async () => {
      await Promise.all([close(proxy), close(api)]);
    },
  });
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections?.();
  });
}

function serverOrigin(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected an Internet server address");
  return `http://127.0.0.1:${address.port}`;
}
