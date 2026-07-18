import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FRENCH_TAB_MEI_FIXTURE } from "../../lib/mei-edition-fixtures.js";
import type { DiplomaticToken } from "../../lib/mei-edition-domain.js";
import { ApiRouteError } from "./create-route.js";
import { MeiEditionService } from "./mei-edition-service.js";
import { MeiEditionStore } from "./mei-edition-store.js";
import { WorkspaceStore } from "./workspace-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function harness() {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-mei-edition-"));
  roots.push(root);
  let sequence = 0;
  const workspaces = new WorkspaceStore({
    rootDirectory: root,
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    now: () => new Date("2026-07-17T20:00:00.000Z"),
  });
  const workspace = workspaces.create({ title: "MEI edition test" });
  const source = workspaces.addSourceArtifact(workspace.id, {
    filename: "facsimile.pdf",
    mimeType: "application/pdf",
    contentBase64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"),
    provenance: { license: "project-authored test fixture" },
  });
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
    region: { page: 9, x: 0.05 + index * 0.08, y: 0.1, width: 0.04, height: 0.08 },
    confidence: index % 2 ? 0.72 : 0.95,
    alternatives: index % 2 ? ["alternate reading"] : [],
    critical: index % 2 === 1,
  }));
  const service = new MeiEditionService({
    store: new MeiEditionStore({ rootDirectory: root, workspaces }),
    now: () => new Date("2026-07-17T20:00:00.000Z"),
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });
  const edition = service.create(workspace.id, {
    sourceArtifactId: source.id,
    sourcePage: 9,
    title: "Sarabande",
    mei: FRENCH_TAB_MEI_FIXTURE,
    tokens,
    extraction: {
      backendId: "fixture.structured-extraction",
      backendVersion: "1",
      diagnostics: ["Project-authored deterministic fixture"],
    },
  });
  return { service, workspaceId: workspace.id, edition };
}

describe("diplomatic MEI Edition Correction Batches", () => {
  it("previews without persistence, commits atomically, rejects stale parents, and undoes by successor", () => {
    const { service, workspaceId, edition } = harness();
    const batch = {
      id: "correction-batch.00000000-0000-4000-8000-000000000101",
      name: "Confirm opening tablature",
      expectedVersion: 1,
      layer: "transcription" as const,
      changes: [
        {
          tokenId: "note-1",
          attribute: "tab.fret" as const,
          expectedValue: "1",
          replacementValue: "2",
          rationale: "The facsimile shows c, not b.",
        },
        {
          tokenId: "note-4",
          attribute: "tab.course" as const,
          expectedValue: "1",
          replacementValue: "2",
          rationale: "The letter lies on the second course.",
        },
      ],
    };

    const preview = service.preview(workspaceId, edition.editionId, batch);
    expect(preview.version).toBe(2);
    expect(preview.mei).toMatch(/<note[^>]*tab\.course="1"[^>]*tab\.fret="2"[^>]*xml:id="note-1"/);
    expect(service.get(workspaceId, edition.editionId).version).toBe(1);

    const committed = service.commit(workspaceId, edition.editionId, batch);
    expect(committed.version).toBe(2);
    expect(committed.correctionBatch?.changes).toHaveLength(2);
    expect(committed.tokens.find((token) => token.id === "note-1")).toMatchObject({
      confidence: 1,
      alternatives: [],
      critical: false,
    });
    expect(() => service.commit(workspaceId, edition.editionId, batch)).toThrowError(
      expect.objectContaining({ status: 409 })
    );

    const undone = service.undo(workspaceId, edition.editionId, 2);
    expect(undone.version).toBe(3);
    expect(undone.parentVersion).toBe(2);
    expect(undone.correctionBatch?.inverseOfBatchId).toBe(batch.id);
    expect(undone.mei).toMatch(/<note[^>]*tab\.course="1"[^>]*tab\.fret="1"[^>]*xml:id="note-1"/);
  });

  it("fails closed for incomplete facsimile linkage and mixed or invalid patches", () => {
    const { service, workspaceId, edition } = harness();
    expect(() =>
      service.preview(workspaceId, edition.editionId, {
        id: "correction-batch.00000000-0000-4000-8000-000000000102",
        name: "Bad batch",
        expectedVersion: 1,
        layer: "transcription",
        changes: [
          {
            tokenId: "note-1",
            attribute: "tab.course",
            expectedValue: "9",
            replacementValue: "20",
            rationale: "Invalid precondition and course.",
          },
        ],
      })
    ).toThrowError(ApiRouteError);
  });
});
