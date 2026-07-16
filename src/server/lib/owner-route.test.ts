import express from "express";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApiResponse } from "../../lib/api-contract.js";
import type { OwnerReference } from "../../lib/owner-domain.js";
import {
  createKnowledgeCandidateRoute,
  createKnowledgePromotionRoute,
  createLegacyOwnerReferenceQuarantineRoute,
  createOwnerReferenceRoute,
  createOwnerStateRoute,
} from "./owner-route.js";
import { OwnerStore } from "./owner-store.js";

describe("Owner Reference upload", () => {
  let rootDirectory: string;
  let store: OwnerStore;
  const servers: Server[] = [];

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-owner-route-"));
    store = new OwnerStore({
      rootDirectory,
      now: () => new Date("2026-07-13T12:00:00.000Z"),
    });
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("streams a book-sized reference without base64 JSON", async () => {
    const server = await listen(createOwnerReferenceRoute(store));
    const content = Buffer.from("%PDF-1.7\nA primary-source facsimile\n%%EOF");
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Reference-Title": encodeURIComponent("Méthode pour la guitare"),
        "X-Reference-Citation": encodeURIComponent("Paris, 1830, plate 1"),
      },
      body: content,
    });
    const json = (await response.json()) as ApiResponse<Omit<OwnerReference, "storedPath">>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.data).toMatchObject({
      title: "Méthode pour la guitare",
      citation: "Paris, 1830, plate 1",
      mimeType: "application/pdf",
      byteLength: content.byteLength,
      authorityState: "raw_staged",
      activationAllowed: false,
    });
    expect(json.data).not.toHaveProperty("storedPath");
    const stored = store.listReferences()[0];
    expect(readFileSync(path.join(rootDirectory, stored.storedPath))).toEqual(content);
  });

  it("retains the small legacy JSON boundary", async () => {
    const server = await listen(createOwnerReferenceRoute(store), true);
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Short note",
        citation: "Owner notebook, folio 1",
        mimeType: "text/plain",
        contentBase64: Buffer.from("A reviewed note").toString("base64"),
      }),
    });
    const json = (await response.json()) as ApiResponse<Omit<OwnerReference, "storedPath">>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.byteLength).toBe(15);
      expect(json.data).toMatchObject({
        authorityState: "raw_staged",
        activationAllowed: false,
      });
      expect(json.data).not.toHaveProperty("storedPath");
    }
  });

  it("quarantines the legacy writer at the production routing boundary", async () => {
    const server = await listen(createLegacyOwnerReferenceQuarantineRoute(), true);
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Must not enter the legacy store",
        citation: "Private citation",
        mimeType: "application/pdf",
        contentBase64: Buffer.from("private bytes").toString("base64"),
      }),
    });

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: {
        code: "conflict",
        details: {
          reason: "legacy_owner_reference_writer_quarantined",
          replacement: "/api/owner/reference-source-staging/assets",
        },
      },
    });
    expect(store.listReferences()).toEqual([]);
  });

  it("rejects a streamed reference beyond the configured limit", async () => {
    const server = await listen(createOwnerReferenceRoute(store, { maxBytes: 4 }));
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Reference-Title": "Oversized",
        "X-Reference-Citation": "Test fixture",
      },
      body: Buffer.from("12345"),
    });
    const json = (await response.json()) as { error?: { code?: string } };

    expect(response.status).toBe(413);
    expect(json.error?.code).toBe("request_too_large");
    expect(store.listReferences()).toEqual([]);
  });

  it("keeps local storage paths out of the Owner compatibility response", async () => {
    store.addReference({
      title: "Private facsimile",
      citation: "Owner library",
      mimeType: "application/pdf",
      contentBase64: Buffer.from("private source bytes").toString("base64"),
    });
    const server = await listen(createOwnerStateRoute(store));
    const response = await fetch(serverUrl(server));
    const json = (await response.json()) as ApiResponse<{
      ownerReferences: Array<Record<string, unknown>>;
    }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.data.ownerReferences).toHaveLength(1);
    expect(json.data.ownerReferences[0]).not.toHaveProperty("storedPath");
    expect(JSON.stringify(json.data)).not.toContain("references/reference.");
  });

  it("moves legacy knowledge into an explicit read-only quarantine envelope", async () => {
    seedLegacyKnowledge(rootDirectory);
    const server = await listen(createOwnerStateRoute(store));
    const response = await fetch(serverUrl(server));
    const json = (await response.json()) as ApiResponse<{
      knowledgeCandidates: unknown[];
      historicalPracticeClaims: unknown[];
      knowledgePacks: unknown[];
      quarantinedLegacyKnowledge: {
        authorityPathId: string;
        state: string;
        compatibilityMode: string;
        activationAllowed: boolean;
        knowledgeCandidates: Array<{ id: string }>;
        historicalPracticeClaims: Array<{ id: string; status?: string }>;
        knowledgePacks: Array<{ id: string; reviewed: boolean }>;
      };
    }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.data).toMatchObject({
      knowledgeCandidates: [],
      historicalPracticeClaims: [],
      knowledgePacks: [],
      quarantinedLegacyKnowledge: {
        authorityPathId: "authority.cache.owner-legacy-knowledge",
        state: "quarantined",
        compatibilityMode: "quarantined_inspection_only",
        activationAllowed: false,
        knowledgeCandidates: [{ id: "knowledge-candidate.legacy" }],
        historicalPracticeClaims: [{ id: "historical-claim.legacy", status: "active" }],
        knowledgePacks: [{ id: "pack.legacy", reviewed: true }],
      },
    });
  });

  it("returns a stable quarantine error from both legacy mutation endpoints", async () => {
    const candidateServer = await listen(createKnowledgeCandidateRoute(store), true);
    const promotionServer = await listen(createKnowledgePromotionRoute(store), true);
    const candidateResponse = await fetch(serverUrl(candidateServer), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statement: "A legacy assertion",
        scope: {
          period: "seventeenth century",
          region: "France",
          genre: "continuo",
          instrument: "theorbo",
          ensembleRole: "accompaniment",
        },
        referenceId: "reference.missing",
        citationLocator: "folio 1",
      }),
    });
    const promotionResponse = await fetch(serverUrl(promotionServer), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: "knowledge-candidate.missing",
        packId: "pack.missing",
        packName: "Legacy pack",
        authority: "documented_practice",
      }),
    });

    for (const response of [candidateResponse, promotionResponse]) {
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({
        ok: false,
        error: {
          code: "conflict",
          status: 410,
          details: {
            reason: "legacy_knowledge_quarantined",
            authorityPathId: "authority.cache.owner-legacy-knowledge",
          },
        },
      });
    }
    expect(
      JSON.parse(readFileSync(path.join(rootDirectory, "manifest.json"), "utf8"))
    ).toMatchObject({
      knowledgeCandidateIds: [],
      claimIds: [],
      packIds: [],
    });
  });

  async function listen(route: express.RequestHandler, parseJson = false): Promise<Server> {
    const app = express();
    if (parseJson) app.use(express.json());
    app.all("/", route);
    app.use(((error, _request, response, _next) => {
      response.status(error.status ?? 500).json({
        ok: false,
        error: { code: error.code ?? "internal_error", message: error.message },
      });
    }) as express.ErrorRequestHandler);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    servers.push(server);
    return server;
  }
});

function seedLegacyKnowledge(rootDirectory: string): void {
  const scope = {
    period: "seventeenth century",
    region: "France",
    genre: "continuo",
    instrument: "theorbo",
    ensembleRole: "accompaniment",
  };
  const records = [
    [
      "knowledge-candidates/knowledge-candidate.legacy.json",
      {
        id: "knowledge-candidate.legacy",
        statement: "A cadence may receive a fuller texture.",
        scope,
        referenceId: "reference.legacy",
        citationLocator: "chapter 2",
        status: "promoted",
        createdAt: "2026-07-11T12:00:00.000Z",
        reviewedAt: "2026-07-11T12:00:00.000Z",
      },
    ],
    [
      "claims/historical-claim.legacy.json",
      {
        id: "historical-claim.legacy",
        statement: "A cadence may receive a fuller texture.",
        scope,
        authority: "documented_practice",
        referenceId: "reference.legacy",
        citationLocator: "chapter 2",
        sourceCandidateId: "knowledge-candidate.legacy",
        status: "active",
        reviewedAt: "2026-07-11T12:00:00.000Z",
      },
    ],
    [
      "packs/pack.legacy.json",
      {
        id: "pack.legacy",
        name: "Legacy reviewed pack",
        version: 1,
        reviewed: true,
        claimIds: ["historical-claim.legacy"],
        createdAt: "2026-07-11T12:00:00.000Z",
        updatedAt: "2026-07-11T12:00:00.000Z",
      },
    ],
  ] as const;
  for (const [relativePath, record] of records) {
    const file = path.join(rootDirectory, relativePath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  }
  writeFileSync(
    path.join(rootDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        choiceIds: [],
        defaultCandidateIds: [],
        defaultIds: [],
        referenceIds: [],
        knowledgeCandidateIds: ["knowledge-candidate.legacy"],
        claimIds: ["historical-claim.legacy"],
        packIds: ["pack.legacy"],
      },
      null,
      2
    )}\n`
  );
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${address.port}`;
}
