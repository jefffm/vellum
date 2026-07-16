import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { canonicalReferenceJson } from "../../src/lib/reference-source-domain.js";
import {
  KnowledgePublicationConflictError,
  KnowledgePublicationIntegrityError,
  KnowledgePublicationStore,
  type KnowledgePublicationFault,
  type KnowledgePublicationTransaction,
} from "../../src/server/lib/knowledge-publication-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T07 transactional publication generations", () => {
  it("publishes one complete immutable generation through one CAS head", () => {
    const store = publicationStore();
    const result = store.publish(completeTransaction());

    expect(result.outcome).toBe("committed");
    expect(result.head).toMatchObject({
      generationId: result.generation.id,
      digest: result.generation.digest,
      revision: 1,
    });
    expect(result.records.map((record) => record.recordKind)).toEqual([
      "activation_decision",
      "authority_verification",
      "identity_verification",
      "knowledge_catalog_snapshot",
      "knowledge_library_inventory_snapshot",
      "knowledge_pack_draft",
      "knowledge_pack_release",
      "release_advisory",
      "release_attestation",
    ]);

    const reloaded = new KnowledgePublicationStore({ rootDirectory: store.rootDirectory });
    expect(reloaded.readCurrent()).toEqual({
      head: result.head,
      generation: result.generation,
      records: result.records,
    });
  });

  it("gives racing writers one deterministic winner and one stale-head orphan", () => {
    const root = publicationRoot();
    const seedStore = new KnowledgePublicationStore({ rootDirectory: root });
    const seed = seedStore.publish(singleRecordTransaction("transaction.seed", "upload", "draft"));
    const expectedHead = generationRef(seed);
    const reviewWriter = new KnowledgePublicationStore({ rootDirectory: root });
    const advisoryWriter = new KnowledgePublicationStore({ rootDirectory: root });

    const review = reviewWriter.publish({
      ...singleRecordTransaction("transaction.review", "review", "attestation"),
      expectedHead,
    });
    expect(() =>
      advisoryWriter.publish({
        ...singleRecordTransaction("transaction.advisory", "advisory", "advisory"),
        expectedHead,
      })
    ).toThrow(KnowledgePublicationConflictError);

    expect(seedStore.readCurrent()?.head).toEqual(review.head);
    expect(seedStore.listOrphans()).toEqual([
      expect.objectContaining({
        generationId: expect.stringMatching(/^publication-generation\./),
        state: "complete_staging",
        transactionId: "transaction.advisory",
      }),
    ]);
  });

  it("serializes overlapping cross-process writers and re-evaluates CAS after claim wait", async () => {
    const harnessRoot = publicationRoot();
    const root = path.join(harnessRoot, "store");
    const store = new KnowledgePublicationStore({ rootDirectory: root });
    const seed = store.publish(singleRecordTransaction("transaction.seed", "upload", "seed"));
    const expectedHead = generationRef(seed);
    const writerATransaction = {
      ...singleRecordTransaction("transaction.process-a", "review", "process-a"),
      expectedHead,
    };
    const writerBTransaction = {
      ...singleRecordTransaction("transaction.process-b", "advisory", "process-b"),
      expectedHead,
    };
    const paths = Object.fromEntries(
      [
        "transactionA",
        "transactionB",
        "resultA",
        "resultB",
        "startedA",
        "startedB",
        "readyA",
        "releaseA",
      ].map((name) => [name, path.join(harnessRoot, `${name}.json`)])
    ) as Record<string, string>;
    writeFileSync(paths.transactionA!, JSON.stringify(writerATransaction));
    writeFileSync(paths.transactionB!, JSON.stringify(writerBTransaction));

    const writerA = spawnWriter([
      root,
      paths.transactionA!,
      paths.resultA!,
      paths.startedA!,
      paths.readyA!,
      paths.releaseA!,
    ]);
    await waitForFile(paths.readyA!);
    const writerB = spawnWriter([root, paths.transactionB!, paths.resultB!, paths.startedB!]);
    await waitForFile(paths.startedB!);
    await new Promise((resolve) => setTimeout(resolve, 100));
    writeFileSync(paths.releaseA!, "release\n");

    await Promise.all([writerA.completed, writerB.completed]);
    const resultA = JSON.parse(readFileSync(paths.resultA!, "utf8"));
    const resultB = JSON.parse(readFileSync(paths.resultB!, "utf8"));
    expect(resultA).toMatchObject({ outcome: "committed", head: { revision: 2 } });
    expect(resultB).toMatchObject({
      outcome: "conflict",
      currentHead: resultA.head,
      orphanGenerationId: expect.stringMatching(/^publication-generation\./),
    });
    expect(store.listOrphans()).toEqual([
      expect.objectContaining({
        transactionId: "transaction.process-b",
        state: "complete_staging",
      }),
    ]);
  });

  it("publishes claim receipts atomically across both crash sides of the no-replace link", () => {
    const root = publicationRoot();
    const hostIdentity = "e".repeat(64);
    const abandonedTemporary = path.join(root, `.head-claim.${randomUUID()}.tmp`);
    writeFileSync(abandonedTemporary, '{"schemaVersion":1');
    const store = new KnowledgePublicationStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });

    const first = store.publish(
      singleRecordTransaction("transaction.claim-before-link", "upload", "claim-before-link")
    );
    expect(first.head.revision).toBe(1);
    expect(existsSync(path.join(root, ".head.claim"))).toBe(false);

    writeFileSync(
      path.join(root, ".head.claim"),
      `${canonicalReferenceJson({
        schemaVersion: 1,
        token: randomUUID(),
        pid: 2_147_483_647,
        hostIdentity,
        bootIdentity: null,
        processStartIdentity: null,
        claimedAt: "2026-07-15T12:00:00.000Z",
      })}\n`
    );
    const second = store.publish({
      ...singleRecordTransaction("transaction.claim-after-link", "review", "claim-after-link"),
      expectedHead: generationRef(first),
    });

    expect(second.head.revision).toBe(2);
    expect(existsSync(path.join(root, ".head.claim"))).toBe(false);
    expect(readdirSync(path.join(root, "recoveries"))).toHaveLength(1);
  });

  it("preserves a live unique recovery ticket when a second head reclaimer arrives", () => {
    const root = publicationRoot();
    const hostIdentity = "b".repeat(64);
    const claimReceipt = (pid: number) =>
      `${canonicalReferenceJson({
        schemaVersion: 1,
        token: randomUUID(),
        pid,
        hostIdentity,
        bootIdentity: null,
        processStartIdentity: null,
        claimedAt: "2026-07-15T12:00:00.000Z",
      })}\n`;
    writeFileSync(path.join(root, ".head.claim"), claimReceipt(2_147_483_647));
    const recoveryTicket = path.join(root, `.head.claim.recovery.${randomUUID()}`);
    const liveRecoveryReceipt = claimReceipt(process.pid);
    writeFileSync(recoveryTicket, liveRecoveryReceipt);
    const store = new KnowledgePublicationStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });

    expect(() =>
      store.publish(
        singleRecordTransaction("transaction.concurrent-reclaimer", "upload", "blocked")
      )
    ).toThrow(KnowledgePublicationConflictError);
    expect(readFileSync(recoveryTicket, "utf8")).toBe(liveRecoveryReceipt);
    expect(existsSync(path.join(root, ".head.claim"))).toBe(true);

    rmSync(recoveryTicket);
    expect(
      store.publish(
        singleRecordTransaction("transaction.concurrent-reclaimer", "upload", "blocked")
      ).outcome
    ).toBe("committed");
    expect(existsSync(path.join(root, ".head.claim"))).toBe(false);
  });

  it("fails closed on dangling primary and legacy-recovery claim symlinks", () => {
    for (const name of [".head.claim", ".head.claim.recovery"]) {
      const root = publicationRoot();
      symlinkSync(path.join(root, "missing-claim-target"), path.join(root, name));
      const store = new KnowledgePublicationStore({
        rootDirectory: root,
        hostIdentity: () => "f".repeat(64),
      });

      expect(() =>
        store.publish(singleRecordTransaction(`transaction.dangling.${name}`, "upload", "dangling"))
      ).toThrow(KnowledgePublicationIntegrityError);
      expect(
        readdirSync(root).filter((entry) => entry.startsWith(".head.claim.recovery."))
      ).toEqual([]);
    }
  });

  it("restores a stale head claim when its recovery destination is swapped after validation", () => {
    const root = publicationRoot();
    const outside = publicationRoot();
    const recoveryDirectory = path.join(root, "recoveries");
    const claimPath = path.join(root, ".head.claim");
    const hostIdentity = "9".repeat(64);
    const staleClaim = `${canonicalReferenceJson({
      schemaVersion: 1,
      token: randomUUID(),
      pid: 2_147_483_647,
      hostIdentity,
      bootIdentity: null,
      processStartIdentity: null,
      claimedAt: "2026-07-15T12:00:00.000Z",
    })}\n`;
    mkdirSync(recoveryDirectory);
    writeFileSync(claimPath, staleClaim);
    let swapArmed = false;
    let swapped = false;
    const store = new KnowledgePublicationStore({
      rootDirectory: root,
      hostIdentity: () => {
        if (
          existsSync(claimPath) &&
          readdirSync(root).some((name) => /^\.head\.claim\.recovery\.[0-9a-f-]{36}$/.test(name))
        ) {
          swapArmed = true;
        }
        return hostIdentity;
      },
      now: () => {
        if (swapArmed && !swapped) {
          rmSync(recoveryDirectory, { recursive: true, force: true });
          symlinkSync(outside, recoveryDirectory, "dir");
          swapped = true;
        }
        return new Date("2026-07-15T12:00:00.000Z");
      },
    });

    expect(() =>
      store.publish(
        singleRecordTransaction("transaction.recovery-destination-swap", "upload", "blocked")
      )
    ).toThrow(KnowledgePublicationIntegrityError);

    expect(swapped).toBe(true);
    expect(readFileSync(claimPath, "utf8")).toBe(staleClaim);
    expect(readdirSync(outside)).toEqual([]);
    expect(
      readdirSync(root).filter(
        (name) => name.includes(".orphan.") || /^\.head\.claim\.recovery\.[0-9a-f-]{36}$/.test(name)
      )
    ).toEqual([]);
  });

  it("recovers every staged-write and head-commit crash boundary without partial visibility", () => {
    const writes = completeTransaction().writes;
    for (let recordIndex = 0; recordIndex < writes.length; recordIndex += 1) {
      const root = publicationRoot();
      const transaction = {
        ...completeTransaction(),
        transactionId: `transaction.record-crash.${recordIndex}`,
      };
      const crashing = new KnowledgePublicationStore({
        rootDirectory: root,
        faultInjector: failAt("after_staged_record", recordIndex),
      });

      expect(() => crashing.publish(transaction)).toThrow(
        `fault:after_staged_record:${recordIndex}`
      );
      expect(crashing.readCurrent()).toBeNull();
      const [orphan] = crashing.listOrphans();
      expect(orphan).toMatchObject({
        state: "incomplete_staging",
        stagedRecordCount: recordIndex + 1,
      });
      expect(crashing.reclaimOrphan(orphan!.generationId)).toEqual({ reclaimed: true });
      expect(crashing.reclaimOrphan(orphan!.generationId)).toEqual({ reclaimed: false });

      expect(
        new KnowledgePublicationStore({ rootDirectory: root }).publish(transaction).head.revision
      ).toBe(1);
    }

    for (const point of ["after_staged_generation", "before_head_commit"] as const) {
      const root = publicationRoot();
      const transaction = {
        ...completeTransaction(),
        transactionId: `transaction.${point}`,
      };
      const crashing = new KnowledgePublicationStore({
        rootDirectory: root,
        faultInjector: failAt(point),
      });

      expect(() => crashing.publish(transaction)).toThrow(`fault:${point}`);
      expect(crashing.readCurrent()).toBeNull();
      expect(crashing.listOrphans()).toEqual([
        expect.objectContaining({
          state: point === "after_staged_generation" ? "complete_staging" : "complete_generation",
          transactionId: transaction.transactionId,
        }),
      ]);

      const resumed = new KnowledgePublicationStore({ rootDirectory: root }).publish(transaction);
      expect(resumed.outcome).toBe("committed");
      expect(resumed.head.revision).toBe(1);
    }

    const root = publicationRoot();
    const transaction = {
      ...completeTransaction(),
      transactionId: "transaction.after-head",
    };
    const crashing = new KnowledgePublicationStore({
      rootDirectory: root,
      faultInjector: failAt("after_head_commit"),
    });
    expect(() => crashing.publish(transaction)).toThrow("fault:after_head_commit");

    const recovered = new KnowledgePublicationStore({ rootDirectory: root });
    expect(recovered.readCurrent()?.head.revision).toBe(1);
    expect(recovered.publish(transaction).outcome).toBe("already_committed");
    expect(recovered.listOrphans()).toEqual([]);
  });

  it("keeps pinned snapshots stable and reclaims only unreachable generations", () => {
    const store = publicationStore();
    const first = store.publish(singleRecordTransaction("transaction.first", "upload", "draft"));
    const pinned = store.readGeneration(first.generation.id);
    const second = store.publish({
      ...singleRecordTransaction("transaction.second", "review", "attestation"),
      expectedHead: generationRef(first),
    });

    expect(store.readGeneration(first.generation.id)).toEqual(pinned);
    expect(store.readCurrent()?.records).toHaveLength(2);
    expect(() => store.reclaimOrphan(first.generation.id)).toThrow(
      KnowledgePublicationIntegrityError
    );

    const stale = {
      ...singleRecordTransaction("transaction.stale", "activation", "activation"),
      expectedHead: generationRef(first),
    };
    expect(() => store.publish(stale)).toThrow(KnowledgePublicationConflictError);
    const [orphan] = store.listOrphans();
    expect(orphan?.state).toBe("complete_staging");
    expect(store.reclaimOrphan(orphan!.generationId)).toEqual({ reclaimed: true });
    expect(store.readCurrent()?.head).toEqual(second.head);
    expect(store.readGeneration(first.generation.id)).toEqual(pinned);

    expect(() =>
      store.publish({
        ...singleRecordTransaction("transaction.stale", "activation", "reused"),
        expectedHead: generationRef(second),
      })
    ).toThrow(/transaction ID was reused with different bytes/);
  });

  it("rejects record mutation while retaining explicit successor relationships", () => {
    const store = publicationStore();
    const first = store.publish(singleRecordTransaction("transaction.first", "upload", "draft"));
    const draft = first.records[0]!;

    expect(() =>
      store.publish({
        schemaVersion: 1,
        transactionId: "transaction.illegal-mutation",
        writerKind: "upload",
        expectedHead: generationRef(first),
        writes: [
          {
            recordKind: draft.recordKind,
            id: draft.id,
            successorRefs: [],
            content: { title: "mutated in place" },
          },
        ],
      })
    ).toThrow(/immutable publication record ID/);

    const successor = store.publish({
      schemaVersion: 1,
      transactionId: "transaction.successor",
      writerKind: "upload",
      expectedHead: generationRef(first),
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "draft.successor",
          successorRefs: [{ id: draft.id, digest: draft.digest, recordKind: draft.recordKind }],
          content: { title: "corrected draft" },
        },
      ],
    });
    expect(
      successor.records.find((record) => record.id === "draft.successor")?.successorRefs
    ).toEqual([{ id: draft.id, digest: draft.digest, recordKind: draft.recordKind }]);
  });

  it("rejects noncanonical bytes, symlink roots, and a missing generation before head commit", () => {
    const canonicalRoot = publicationRoot();
    const canonicalStore = new KnowledgePublicationStore({ rootDirectory: canonicalRoot });
    const committed = canonicalStore.publish(
      singleRecordTransaction("transaction.canonical", "upload", "canonical")
    );
    const manifest = path.join(
      canonicalRoot,
      "generations",
      committed.generation.id,
      "generation.json"
    );
    writeFileSync(manifest, JSON.stringify(JSON.parse(readFileSync(manifest, "utf8")), null, 2));
    expect(() => canonicalStore.readCurrent()).toThrow(/not canonical JSON/);

    const symlinkParent = publicationRoot();
    const realRoot = path.join(symlinkParent, "real");
    const linkedRoot = path.join(symlinkParent, "linked");
    mkdirSync(realRoot);
    symlinkSync(realRoot, linkedRoot, "dir");
    expect(() =>
      new KnowledgePublicationStore({ rootDirectory: linkedRoot }).publish(
        singleRecordTransaction("transaction.symlink", "upload", "symlink")
      )
    ).toThrow(/real directory/);

    const revalidationRoot = publicationRoot();
    const revalidationStore = new KnowledgePublicationStore({
      rootDirectory: revalidationRoot,
      faultInjector: (fault) => {
        if (fault.point === "before_head_commit") {
          rmSync(path.join(revalidationRoot, "generations", fault.generationId), {
            recursive: true,
            force: true,
          });
        }
      },
    });
    expect(() =>
      revalidationStore.publish(
        singleRecordTransaction("transaction.revalidation", "upload", "revalidation")
      )
    ).toThrow(/Missing publication generation/);
    expect(revalidationStore.readHead()).toBeNull();
  });

  it("classifies a torn staging write as a bounded reclaimable partial orphan", () => {
    const root = publicationRoot();
    const generationId = "publication-generation.partial";
    const directory = path.join(root, "staging", generationId);
    mkdirSync(path.join(directory, "records"), { recursive: true });
    writeFileSync(path.join(directory, "intent.json"), '{"schemaVersion":1');

    const store = new KnowledgePublicationStore({ rootDirectory: root });
    expect(store.listOrphans()).toEqual([
      {
        generationId,
        state: "incomplete_staging",
        transactionId: null,
        revision: null,
        parentGenerationRef: null,
        stagedRecordCount: 0,
      },
    ]);
    expect(store.reclaimOrphan(generationId)).toEqual({ reclaimed: true });
  });
});

function publicationRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-publication-"));
  roots.push(root);
  return root;
}

function publicationStore(): KnowledgePublicationStore {
  return new KnowledgePublicationStore({ rootDirectory: publicationRoot() });
}

function generationRef(result: ReturnType<KnowledgePublicationStore["publish"]>) {
  return {
    id: result.generation.id,
    digest: result.generation.digest,
    revision: result.generation.revision,
  };
}

function singleRecordTransaction(
  transactionId: string,
  writerKind: KnowledgePublicationTransaction["writerKind"],
  suffix: string
): KnowledgePublicationTransaction {
  return {
    schemaVersion: 1,
    transactionId,
    writerKind,
    expectedHead: null,
    writes: [
      {
        recordKind: "knowledge_pack_draft",
        id: `draft.${suffix}`,
        successorRefs: [],
        content: { title: suffix },
      },
    ],
  };
}

function completeTransaction(): KnowledgePublicationTransaction {
  return {
    schemaVersion: 1,
    transactionId: "transaction.complete",
    writerKind: "system",
    expectedHead: null,
    writes: [
      record("knowledge_pack_draft", "draft.complete"),
      record("knowledge_pack_release", "release.complete"),
      record("release_attestation", "attestation.complete"),
      record("release_advisory", "advisory.complete"),
      record("activation_decision", "activation.complete"),
      record("identity_verification", "identity-verification.complete"),
      record("authority_verification", "authority-verification.complete"),
      record("knowledge_library_inventory_snapshot", "inventory.complete"),
      record("knowledge_catalog_snapshot", "catalog.complete"),
    ],
  };
}

function record(
  recordKind: KnowledgePublicationTransaction["writes"][number]["recordKind"],
  id: string
): KnowledgePublicationTransaction["writes"][number] {
  return { recordKind, id, successorRefs: [], content: { fixture: id } };
}

function failAt(
  point: KnowledgePublicationFault["point"],
  recordIndex?: number
): (fault: KnowledgePublicationFault) => void {
  return (fault) => {
    if (fault.point === point && (recordIndex === undefined || fault.recordIndex === recordIndex)) {
      throw new Error(`fault:${point}${recordIndex === undefined ? "" : `:${recordIndex}`}`);
    }
  };
}

function spawnWriter(arguments_: string[]): {
  child: ChildProcess;
  completed: Promise<void>;
} {
  const executable = path.join(process.cwd(), "node_modules", ".bin", "vite-node");
  const helper = path.join(
    process.cwd(),
    "test",
    "instrument-intelligence",
    "fixtures",
    "t07-publication-writer.ts"
  );
  const child = spawn(executable, [helper, ...arguments_], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  const completed = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`T07 writer exited ${code ?? signal}: ${output}`));
    });
  });
  return { child, completed };
}

async function waitForFile(file: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(file)) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
