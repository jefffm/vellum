import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadFixture, loadLyFixture } from "./fixtures.js";
import { tableTest } from "./table-test.js";
import { TestServer } from "./test-server.js";

const tempRoots: string[] = [];

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vellum-test-server-"));
  tempRoots.push(dir);
  process.env.VELLUM_ARRANGEMENTS_DIR = dir;
});

afterAll(() => {
  delete process.env.VELLUM_ARRANGEMENTS_DIR;

  for (const dir of tempRoots) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("TestServer", () => {
  it("starts on a random port and responds to GET /health", async () => {
    const server = await TestServer.start();

    try {
      expect(server.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const response = await server.get("/health");

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({ status: "ok" });
    } finally {
      await server.stop();
    }
  });

  it("post sends JSON and parses the response", async () => {
    const server = await TestServer.start();

    try {
      const response = await server.post("/api/arrangements", {
        title: "Infra Smoke",
        instrument: "baroque-lute-13",
        lySource: '\\version "2.24.0"\n{ c4 }',
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({ ok: true });
      expect(response.data).toHaveProperty("data.id");
    } finally {
      await server.stop();
    }
  });

  it("stop shuts down cleanly", async () => {
    const server = await TestServer.start();
    const url = `${server.baseUrl}/health`;

    await server.stop();
    await expect(fetch(url)).rejects.toThrow();
  });

  it("get with raw:true returns text", async () => {
    const server = await TestServer.start();

    try {
      const response = await server.get("/api/templates/french-tab", { raw: true });

      expect(response.status).toBe(200);
      expect(response.text).toContain("French Letter Tablature Template");
      expect(response.data).toBe(response.text);
    } finally {
      await server.stop();
    }
  });
});

const observedTableCases: string[] = [];

tableTest(
  "tableTest",
  [
    { name: "uses the first case name", value: 1 },
    { name: "uses the second case name", value: 2 },
  ],
  (tc) => {
    observedTableCases.push(tc.name);
    expect(tc.name).toMatch(/^uses the/);
    expect(tc.value).toBeGreaterThan(0);
  }
);

describe("tableTest self-check", () => {
  it("generates one named test per case", () => {
    expect(observedTableCases).toEqual(["uses the first case name", "uses the second case name"]);
  });
});

describe("fixture loader", () => {
  it("loadFixture reads a file from test/fixtures", () => {
    expect(loadFixture("README.md")).toContain("# Test Fixtures");
  });

  it("loadFixture throws for missing files", () => {
    expect(() => loadFixture("missing.fixture")).toThrow(/Fixture not found/);
  });

  it("loadLyFixture reads .ly files", () => {
    expect(loadLyFixture("d-minor-scale-lute")).toContain("D minor scale");
  });
});
