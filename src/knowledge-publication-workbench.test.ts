// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderKnowledgePublicationWorkbench,
  type KnowledgePublicationRecord,
  type KnowledgePublicationWorkbenchState,
} from "./knowledge-publication-workbench.js";

describe("knowledge publication Workbench", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

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
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderKnowledgePublicationWorkbench(container, fixture(true), reclaim);

    const orphan = container.querySelector<HTMLElement>(".knowledge-publication-orphan")!;
    expect(orphan.textContent).toContain(
      "Unreachable private generation owner-reference-publication-orphan.111111111111111111111111 · complete staging"
    );
    expect(orphan.textContent).toContain("1 staged records");
    expect(orphan.textContent).not.toContain("publication-generation.unreachable");
    expect(orphan.textContent).not.toContain("transaction.unreachable");
    expect(orphan.textContent).not.toContain("publication-generation.second");
    expect(orphan.textContent).not.toContain("b".repeat(64));
    const button = orphan.querySelector<HTMLButtonElement>("button");
    expect(button?.textContent).toBe("Reclaim unreachable generation");
    button?.click();
    await vi.waitFor(() =>
      expect(reclaim).toHaveBeenCalledWith("publication-generation.unreachable")
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("owner-reference-publication-orphan.111111111111111111111111")
    );
    expect(orphan.textContent).toContain(
      "Reclaimed owner-reference-publication-orphan.111111111111111111111111."
    );
  });

  it("distinguishes identical-looking orphans with stable opaque labels and honors cancellation", () => {
    const container = document.createElement("div");
    const state = fixture(true);
    state.orphans.push({
      ...state.orphans[0]!,
      generationId: "publication-generation.unreachable-two",
      transactionId: "transaction.unreachable-two",
      displayRef: {
        id: "owner-reference-publication-orphan.222222222222222222222222",
        digest: "2".repeat(64),
      },
    });
    const reclaim = vi.fn(async () => undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderKnowledgePublicationWorkbench(container, state, reclaim);

    const rows = [...container.querySelectorAll<HTMLElement>(".knowledge-publication-orphan")];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain(
      "owner-reference-publication-orphan.111111111111111111111111"
    );
    expect(rows[1]!.textContent).toContain(
      "owner-reference-publication-orphan.222222222222222222222222"
    );
    rows[1]!.querySelector<HTMLButtonElement>("button")!.click();
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("owner-reference-publication-orphan.222222222222222222222222")
    );
    expect(reclaim).not.toHaveBeenCalled();
  });

  it("reenables a failed destructive action without leaking the private failure", async () => {
    const container = document.createElement("div");
    const reclaim = vi.fn(async () => {
      throw new Error("PRIVATE-BACKEND-ORPHAN-ID");
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderKnowledgePublicationWorkbench(container, fixture(true), reclaim);

    const button = container.querySelector<HTMLButtonElement>(
      ".knowledge-publication-orphan button"
    )!;
    button.click();
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(container.textContent).toContain("Could not reclaim owner-reference-publication-orphan");
    expect(container.textContent).not.toContain("PRIVATE-BACKEND-ORPHAN-ID");
  });

  it("caps private orphan counts instead of exposing their exact magnitude", () => {
    const container = document.createElement("div");
    const state = fixture(true);
    state.orphans[0]!.stagedRecordCount = 10_000;

    renderKnowledgePublicationWorkbench(container, state);

    const orphan = container.querySelector<HTMLElement>(".knowledge-publication-orphan")!;
    expect(orphan.textContent).toContain("999+ staged records");
    expect(orphan.textContent).not.toContain("10000");
  });

  it("caps rendered private orphan rows and fails closed for ambiguous display labels", () => {
    const container = document.createElement("div");
    const seed = fixture(true).orphans[0]!;
    const state = fixture();
    state.orphans = Array.from({ length: 1_001 }, (_, index) => {
      const suffix = index.toString(16).padStart(24, "0");
      return {
        ...seed,
        generationId: `publication-generation.unreachable-${index}`,
        transactionId: `transaction.unreachable-${index}`,
        displayRef: {
          id: `owner-reference-publication-orphan.${suffix}`,
          digest: index.toString(16).padStart(64, "0"),
        },
      };
    });

    renderKnowledgePublicationWorkbench(container, state);
    expect(container.querySelectorAll(".knowledge-publication-orphan")).toHaveLength(999);
    expect(container.textContent).toContain("Recoverable unreachable generations (999+)");
    expect(container.textContent).toContain(
      "Additional private orphan rows are withheld from this view."
    );

    const ambiguous = fixture(true);
    ambiguous.orphans.push({
      ...ambiguous.orphans[0]!,
      generationId: "publication-generation.unreachable-two",
    });
    expect(() => renderKnowledgePublicationWorkbench(container, ambiguous)).toThrow(
      /duplicate identities/
    );
  });

  it.each(["migration", "upload"])(
    "redacts production-shaped private migration publication under the %s writer",
    (writerKind) => {
      const container = document.createElement("div");
      const state = migrationFixture(writerKind);

      renderKnowledgePublicationWorkbench(container, state);

      expect(container.textContent).toContain("Current private migration publication");
      expect(container.textContent).toContain(
        "3 visible immutable records · 3 introduced here · migration staging only"
      );
      expect(container.textContent).toContain("Successor publication · private lineage withheld");
      for (const canary of migrationPrivateCanaries(state)) {
        expect(container.textContent).not.toContain(canary);
        expect(container.innerHTML).not.toContain(canary);
      }
    }
  );

  it("redacts every identity when the writer is migration even without migration record kinds", () => {
    const container = document.createElement("div");
    const state = fixture();
    state.current!.generation.writerKind = "migration";

    renderKnowledgePublicationWorkbench(container, state);

    expect(container.textContent).toContain("Current private migration publication");
    for (const canary of migrationPrivateCanaries(state)) {
      expect(container.textContent).not.toContain(canary);
      expect(container.innerHTML).not.toContain(canary);
    }
  });

  it("still fails closed for an unknown publication record kind", () => {
    const container = document.createElement("div");
    const state = fixture();
    state.current!.generation.recordRefs[0]!.recordKind = "owner_reference_migration_unknown";

    expect(() => renderKnowledgePublicationWorkbench(container, state)).toThrow(
      /Unknown publication record kind/
    );
  });

  it("labels system identity and test policy records as non-authoritative test metadata", () => {
    const container = document.createElement("div");
    const state = fixture();
    const generation = state.current!.generation;
    const metadataRecords: KnowledgePublicationRecord[] = [
      {
        schemaVersion: 1,
        recordKind: "knowledge_system_identity_snapshot",
        id: "published.knowledge_system_identity_snapshot.test",
        digest: "7".repeat(64),
        successorRefs: [],
      },
      {
        schemaVersion: 1,
        recordKind: "knowledge_test_policy",
        id: "published.knowledge_test_policy.test",
        digest: "8".repeat(64),
        successorRefs: [],
      },
    ];
    state.current!.records.push(...metadataRecords);
    generation.recordRefs.push(
      ...metadataRecords.map(({ recordKind, id, digest }) => ({ recordKind, id, digest }))
    );
    generation.newRecordRefs.push(
      ...metadataRecords.map(({ recordKind, id, digest }) => ({ recordKind, id, digest }))
    );

    renderKnowledgePublicationWorkbench(container, state);

    expect(container.textContent).toContain(
      "System Test Metadata · Identity Snapshot (No Authority)"
    );
    expect(container.textContent).toContain("System Test Metadata · Test Policy (No Activation)");
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
            displayRef: {
              id: "owner-reference-publication-orphan.111111111111111111111111",
              digest: "1".repeat(64),
            },
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

function migrationFixture(writerKind: string): KnowledgePublicationWorkbenchState {
  const migrationRefs = [
    {
      recordKind: "owner_reference_migration_mapping",
      id: "owner-reference-migration-mapping.PRIVATE-MAPPING-ID-CANARY",
      digest: "3".repeat(64),
    },
    {
      recordKind: "owner_reference_migration_quarantine",
      id: "owner-reference-migration-quarantine.PRIVATE-QUARANTINE-ID-CANARY",
      digest: "4".repeat(64),
    },
    {
      recordKind: "owner_reference_migration_journal",
      id: "owner-reference-migration-journal.PRIVATE-JOURNAL-ID-CANARY",
      digest: "5".repeat(64),
    },
  ];
  return {
    current: {
      head: {
        generationId: "publication-generation.PRIVATE-GENERATION-ID-CANARY",
        digest: "b".repeat(64),
        revision: 8,
      },
      generation: {
        schemaVersion: 1,
        id: "publication-generation.PRIVATE-GENERATION-ID-CANARY",
        revision: 8,
        parentGenerationRef: {
          id: "publication-generation.PRIVATE-PARENT-ID-CANARY",
          digest: "a".repeat(64),
          revision: 7,
        },
        transactionId: "transaction.PRIVATE-MIGRATION-TRANSACTION-CANARY",
        writerKind,
        createdAt: "2026-07-16T12:00:00.000Z",
        requestDigest: "c".repeat(64),
        recordRefs: migrationRefs,
        newRecordRefs: migrationRefs,
        digest: "b".repeat(64),
      },
      records: migrationRefs.map((ref, index) => ({
        schemaVersion: 1 as const,
        ...ref,
        successorRefs: index === 0 ? [] : [migrationRefs[index - 1]!],
      })),
    },
    orphans: [],
  };
}

function migrationPrivateCanaries(state: KnowledgePublicationWorkbenchState): string[] {
  const current = state.current!;
  return [
    current.head.generationId,
    current.head.digest,
    current.generation.parentGenerationRef!.id,
    current.generation.parentGenerationRef!.digest,
    current.generation.transactionId,
    current.generation.requestDigest,
    ...current.records.flatMap((record) => [
      record.id,
      record.digest,
      ...record.successorRefs.flatMap((successor) => [successor.id, successor.digest]),
    ]),
  ];
}
