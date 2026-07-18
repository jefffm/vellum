import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FRENCH_TAB_MEI_FIXTURE } from "../../lib/mei-edition-fixtures.js";
import type { DiplomaticToken, SelectionContextEnvelope } from "../../lib/mei-edition-domain.js";
import { canonicalJson } from "../../lib/canonical-json.js";
import { ApiRouteError } from "./create-route.js";
import { ModelActionService } from "./model-action-service.js";
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
  return {
    service,
    workspaces,
    createId: () => createIdForTest(++sequence),
    workspaceId: workspace.id,
    edition,
  };
}

function createIdForTest(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
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
    expect(undone.tokens.find((token) => token.id === "note-1")).toMatchObject({
      confidence: 0.72,
      alternatives: ["alternate reading"],
      critical: true,
    });
  });

  it("confirms a correct source reading without inventing an MEI attribute change", () => {
    const { service, workspaceId, edition } = harness();
    const token = edition.tokens.find(({ id }) => id === "note-1")!;
    const confirmed = service.commit(workspaceId, edition.editionId, {
      id: "correction-batch.00000000-0000-4000-8000-000000000103",
      name: "Confirm source reading",
      expectedVersion: 1,
      layer: "transcription",
      changes: [],
      reviewResolutions: [
        {
          tokenId: token.id,
          expectedState: {
            critical: token.critical,
            confidence: token.confidence,
            alternatives: [...token.alternatives],
          },
          replacementState: { critical: false, confidence: 1, alternatives: [] },
          rationale: "The visible source confirms the encoded letter and course.",
        },
      ],
    });

    expect(confirmed.mei).toBe(edition.mei);
    expect(confirmed.correctionBatch?.changes).toEqual([]);
    expect(confirmed.correctionBatch?.reviewResolutions).toHaveLength(1);
    expect(confirmed.tokens.find(({ id }) => id === token.id)).toMatchObject({
      critical: false,
      confidence: 1,
      alternatives: [],
    });

    const reopened = service.undo(workspaceId, edition.editionId, 2);
    expect(reopened.tokens.find(({ id }) => id === token.id)).toMatchObject({
      critical: true,
      confidence: 0.72,
      alternatives: ["alternate reading"],
    });
  });

  it("applies rhythm attributes to the enclosing tablature group", () => {
    const { service, workspaceId, edition } = harness();
    const corrected = service.commit(workspaceId, edition.editionId, {
      id: "correction-batch.00000000-0000-4000-8000-000000000104",
      name: "Correct rhythm",
      expectedVersion: 1,
      layer: "transcription",
      changes: [
        {
          tokenId: "rhythm-1",
          attribute: "dur",
          expectedValue: "4",
          replacementValue: "8",
          rationale: "The source shows an eighth-note rhythm sign.",
        },
      ],
    });

    expect(corrected.mei).toMatch(/<tabGrp[^>]*dur="8"[^>]*xml:id="event-1"/);
    expect(corrected.mei).not.toMatch(/<tabDurSym[^>]*dur=/);
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

  it("binds a reviewed model proposal and every individual decision to the canonical successor", async () => {
    const { service, workspaces, createId, workspaceId, edition } = harness();
    const context: SelectionContextEnvelope = {
      kind: "vellum_mei_selection_context_v1",
      selection: {
        id: "passage-selection.00000000-0000-4000-8000-000000000201",
        editionId: edition.editionId,
        editionVersion: 1,
        mode: "contiguous",
        roleFilter: "all",
        meiIds: ["note-1"],
      },
      sourcePage: 9,
      meter: { count: 3, unit: 4 },
      tuning: [
        { course: 1, pname: "e", octave: 4 },
        { course: 2, pname: "b", octave: 3 },
        { course: 3, pname: "g", octave: 3 },
        { course: 4, pname: "d", octave: 3 },
        { course: 5, pname: "a", octave: 3 },
      ],
      selectedObjects: [
        {
          id: "note-1",
          kind: "tablature",
          measureId: "measure-1",
          measureNumber: 1,
          course: 1,
          fret: 1,
        },
      ],
      neighborIds: ["rhythm-1", "note-2"],
      facsimileIncluded: false,
    };
    const contextDigest = createHash("sha256").update(canonicalJson(context)).digest("hex");
    const proposal = JSON.stringify({
      summary: "One bounded correction",
      layer: "transcription",
      suggestions: [
        {
          id: "suggestion.1",
          tokenId: "note-1",
          attribute: "tab.fret",
          replacementValue: "2",
          rationale: "Project-authored fake provider proposal.",
        },
      ],
    });
    const actions = new ModelActionService({
      store: workspaces,
      createId,
      now: () => new Date("2026-07-17T20:10:00.000Z"),
      executeProvider: async (envelope, envelopeDigest) => ({
        envelopeDigest,
        provider: envelope.provider,
        model: envelope.model,
        providerResponseId: "provider-response.fake",
        content: proposal,
      }),
    });
    const action = actions.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: `Review exact selection\nSelection-Context-SHA256: ${contextDigest}\n${JSON.stringify(context)}`,
    });
    const authorized = actions.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    const completed = await actions.run(
      workspaceId,
      action.id,
      authorized.attempts[0]!.envelopeDigest!
    );
    const finalChange = {
      tokenId: "note-1",
      attribute: "tab.fret" as const,
      expectedValue: "1",
      replacementValue: "2",
      rationale: "Project-authored fake provider proposal.",
    };
    const command = {
      id: "correction-batch.00000000-0000-4000-8000-000000000202",
      name: "Reviewed model proposal",
      expectedVersion: 1,
      layer: "transcription" as const,
      changes: [finalChange],
      modelProvenance: {
        modelActionId: action.id,
        publicationId: completed.publication.id,
        resultCommitId: completed.publication.commit.id,
        selectionContext: context,
        selectionContextDigest: contextDigest,
        proposalDigest: createHash("sha256").update(proposal).digest("hex"),
        proposalLayer: "transcription" as const,
        decisions: [
          {
            suggestionId: "suggestion.1",
            decision: "approved" as const,
            finalChange,
            rationale: "Included after individual review.",
          },
        ],
      },
    };

    expect(service.preview(workspaceId, edition.editionId, command).version).toBe(2);
    expect(() =>
      service.preview(workspaceId, edition.editionId, {
        ...command,
        modelProvenance: { ...command.modelProvenance, proposalDigest: "0".repeat(64) },
      })
    ).toThrowError(/proposal digest mismatch/);
    const committed = service.commit(workspaceId, edition.editionId, command);
    expect(committed.correctionBatch?.modelProvenance).toMatchObject({
      modelActionId: action.id,
      publicationId: completed.publication.id,
      resultCommitId: completed.publication.commit.id,
    });
  });
});
