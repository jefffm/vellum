// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderKnowledgePublicationWorkbench,
  type KnowledgePublicationWorkbenchState,
} from "./knowledge-publication-workbench.js";

describe("knowledge publication Workbench", () => {
  beforeEach(() => document.body.replaceChildren());

  it("renders the exact stable generation and explicit record successors without payload leakage", () => {
    const container = document.createElement("div");
    const state = fixture();
    renderKnowledgePublicationWorkbench(container, state);

    expect(container.textContent).toContain("Current generation r2");
    expect(container.textContent).toContain("publication-generation.second");
    expect(container.textContent).toContain("Successor of publication-generation.first at r1");
    expect(container.textContent).toContain("Successor of Knowledge Pack Draft · draft.first");
    expect(container.textContent).not.toContain("PRIVATE-PAYLOAD-CANARY");
  });

  it("offers explicit reclamation only for bounded unreachable generation metadata", async () => {
    const container = document.createElement("div");
    const reclaim = vi.fn(async () => undefined);
    renderKnowledgePublicationWorkbench(container, fixture(true), reclaim);

    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button?.textContent).toBe("Reclaim unreachable generation");
    button?.click();
    await vi.waitFor(() =>
      expect(reclaim).toHaveBeenCalledWith("publication-generation.unreachable")
    );
  });

  it("fails closed for unknown fields and mixed head/generation state", () => {
    const container = document.createElement("div");
    const unknown = structuredClone(fixture()) as KnowledgePublicationWorkbenchState & {
      privatePath?: string;
    };
    unknown.privatePath = "/Users/owner/private.pdf";
    expect(() => renderKnowledgePublicationWorkbench(container, unknown)).toThrow(/closed-schema/);

    const payloadLeak = structuredClone(fixture()) as unknown as {
      current: { records: Array<Record<string, unknown>> };
    };
    payloadLeak.current.records[0]!.content = "PRIVATE-PAYLOAD-CANARY";
    expect(() => renderKnowledgePublicationWorkbench(container, payloadLeak)).toThrow(
      /closed-schema/
    );

    const mixed = structuredClone(fixture());
    mixed.current!.head.revision = 3;
    expect(() => renderKnowledgePublicationWorkbench(container, mixed)).toThrow(
      /head does not match/
    );
  });
});

function fixture(withOrphan = false): KnowledgePublicationWorkbenchState {
  const firstRef = {
    recordKind: "knowledge_pack_draft",
    id: "draft.first",
    digest: "1".repeat(64),
  };
  const secondRef = {
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
        recordRefs: [firstRef, secondRef],
        newRecordRefs: [secondRef],
        digest: "b".repeat(64),
      },
      records: [
        {
          schemaVersion: 1,
          ...firstRef,
          successorRefs: [],
        },
        {
          schemaVersion: 1,
          ...secondRef,
          successorRefs: [firstRef],
        },
      ],
    },
    orphans: withOrphan
      ? [
          {
            generationId: "publication-generation.unreachable",
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
