import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../src/server/index.js";

export type TestResponse<TData = unknown> = {
  status: number;
  data: TData;
  text?: string;
};

export class TestServer {
  private constructor(
    private readonly server: Server,
    private readonly port: number
  ) {}

  static async start(opts: { port?: number } = {}): Promise<TestServer> {
    const app = createApp();
    const requestedPort = opts.port ?? 0;

    return await new Promise<TestServer>((resolve, reject) => {
      const server = app.listen(requestedPort);

      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(new Error(`Failed to start test server on port ${requestedPort}: ${error.message}`));
      };

      const onListening = () => {
        server.off("error", onError);
        const address = server.address();

        if (!address || typeof address === "string") {
          server.close(() => reject(new Error("Test server started without a TCP address")));
          return;
        }

        resolve(new TestServer(server, (address as AddressInfo).port));
      };

      server.once("error", onError);
      server.once("listening", onListening);
    });
  }

  async post(path: string, body: object): Promise<TestResponse> {
    return await this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async get(path: string, opts: { raw?: boolean } = {}): Promise<TestResponse> {
    return await this.request(path, { method: "GET" }, opts.raw === true);
  }

  async delete(path: string): Promise<TestResponse> {
    return await this.request(path, { method: "DELETE" });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  private async request(path: string, init: RequestInit, raw = false): Promise<TestResponse> {
    const response = await fetch(new URL(path, this.baseUrl), init);

    if (raw) {
      const text = await response.text();
      return { status: response.status, data: text, text };
    }

    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const data =
      contentType.includes("application/json") && text.length > 0 ? JSON.parse(text) : text;

    return { status: response.status, data, text };
  }
}
