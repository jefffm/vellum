import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingNotFoundError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

describe("ReferenceSourceStagingStore", () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-reference-staging-"));
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("commits immutable full snapshots and retains reachable history", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    const first = snapshot({ id: "snapshot.first", revision: 1 });
    const firstHead = store.commit(first);
    const second = snapshot({
      id: "snapshot.second",
      revision: 2,
      parentSnapshotRef: { id: first.id, digest: first.digest },
    });
    const secondHead = store.commit(second, { id: first.id, digest: first.digest });

    expect(firstHead).toEqual({ snapshotId: first.id, digest: first.digest, revision: 1 });
    expect(secondHead).toEqual({ snapshotId: second.id, digest: second.digest, revision: 2 });
    expect(store.readCurrentSnapshot()).toEqual(second);
    expect(store.readSnapshot(first.id)).toEqual(first);
    expect(store.readSnapshotState(first.id)).toEqual({
      head: { snapshotId: second.id, digest: second.digest, revision: second.revision },
      snapshot: first,
    });
  });

  it("uses a real exclusive claim and lets exactly one writer advance an expected head", () => {
    const firstStore = new ReferenceSourceStagingStore({ rootDirectory });
    const secondStore = new ReferenceSourceStagingStore({ rootDirectory });
    const base = snapshot({ id: "snapshot.base", revision: 1 });
    firstStore.commit(base);
    const expected = { id: base.id, digest: base.digest };
    const candidates = [
      snapshot({
        id: "snapshot.writer-a",
        revision: 2,
        parentSnapshotRef: expected,
      }),
      snapshot({
        id: "snapshot.writer-b",
        revision: 2,
        parentSnapshotRef: expected,
      }),
    ];

    const outcomes = [
      () => firstStore.commit(candidates[0]!, expected),
      () => secondStore.commit(candidates[1]!, expected),
    ].map((write) => {
      try {
        write();
        return "committed";
      } catch (error) {
        expect(error).toBeInstanceOf(ReferenceSourceStagingConflictError);
        return "conflict";
      }
    });

    expect(outcomes.sort()).toEqual(["committed", "conflict"]);
    expect(firstStore.readHead()?.revision).toBe(2);
  });

  it("fails closed on a malformed exclusive head claim", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    writeFileSync(path.join(rootDirectory, ".head.claim"), '{"pid":999999}\n', {
      flag: "wx",
    });

    expect(() => store.commit(snapshot({ id: "snapshot.blocked", revision: 1 }))).toThrow(
      ReferenceSourceStagingIntegrityError
    );
    expect(store.readHead()).toBeNull();
  });

  it("fails closed while a live owner holds the exclusive head claim", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    writeClaim(path.join(rootDirectory, ".head.claim"), process.pid);

    expect(() => store.commit(snapshot({ id: "snapshot.blocked", revision: 1 }))).toThrow(
      ReferenceSourceStagingConflictError
    );
  });

  it("recovers a valid claim only after its same-machine owner is proven absent", () => {
    const store = new ReferenceSourceStagingStore({
      rootDirectory,
      hostIdentity: stableHostIdentity,
    });
    writeClaim(path.join(rootDirectory, ".head.claim"), 2_147_483_647);

    const committed = snapshot({ id: "snapshot.recovered", revision: 1 });
    expect(store.commit(committed)).toMatchObject({ snapshotId: committed.id });
    expect(readdirSync(path.join(rootDirectory, "recoveries"))).toHaveLength(1);
  });

  it("recovers an abandoned recovery guard instead of wedging all future writers", () => {
    const store = new ReferenceSourceStagingStore({
      rootDirectory,
      hostIdentity: stableHostIdentity,
    });
    writeClaim(path.join(rootDirectory, ".head.claim.recovery"), 2_147_483_647);

    const committed = snapshot({ id: "snapshot.recovery-guard", revision: 1 });
    expect(store.commit(committed)).toMatchObject({ snapshotId: committed.id });
    expect(readdirSync(path.join(rootDirectory, "recoveries"))).toHaveLength(1);
  });

  it("commits normally when the environment has no stable host identity", () => {
    const store = new ReferenceSourceStagingStore({
      rootDirectory,
      hostIdentity: () => null,
    });

    const committed = snapshot({ id: "snapshot.identity-less", revision: 1 });
    expect(store.commit(committed)).toMatchObject({ snapshotId: committed.id });
    expect(store.readCurrentSnapshot()).toEqual(committed);
  });

  it("fails closed instead of recovering a stale claim without stable same-host proof", () => {
    const store = new ReferenceSourceStagingStore({
      rootDirectory,
      hostIdentity: () => null,
    });
    writeClaim(path.join(rootDirectory, ".head.claim"), 2_147_483_647);

    expect(() => store.commit(snapshot({ id: "snapshot.no-recovery", revision: 1 }))).toThrow(
      ReferenceSourceStagingConflictError
    );
    expect(store.readHead()).toBeNull();
  });

  it("never treats an unrecoverable fallback marker as same-host recovery evidence", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    writeClaim(
      path.join(rootDirectory, ".head.claim"),
      2_147_483_647,
      "unrecoverable:00000000-0000-4000-8000-000000000000"
    );

    expect(() => store.commit(snapshot({ id: "snapshot.fallback-blocked", revision: 1 }))).toThrow(
      ReferenceSourceStagingConflictError
    );
    expect(store.readHead()).toBeNull();
  });

  it("keeps a losing writer's immutable orphan unreachable", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    const base = snapshot({ id: "snapshot.base", revision: 1 });
    store.commit(base);
    const winner = snapshot({
      id: "snapshot.winner",
      revision: 2,
      parentSnapshotRef: { id: base.id, digest: base.digest },
    });
    store.commit(winner, { id: base.id, digest: base.digest });
    const orphan = snapshot({
      id: "snapshot.orphan",
      revision: 2,
      parentSnapshotRef: { id: base.id, digest: base.digest },
    });

    expect(() => store.commit(orphan, { id: base.id, digest: base.digest })).toThrow(
      ReferenceSourceStagingConflictError
    );
    expect(() => store.readSnapshot(orphan.id)).toThrow(ReferenceSourceStagingNotFoundError);
    expect(store.readCurrentSnapshot()).toEqual(winner);
  });

  it("rejects a snapshot whose claimed digest does not match its bytes", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    const invalid = {
      ...snapshot({ id: "snapshot.invalid", revision: 1 }),
      digest: "a".repeat(64),
    };
    expect(() => store.commit(invalid)).toThrow(ReferenceSourceStagingIntegrityError);
  });

  it("rejects an outer-valid snapshot containing an invalid inner record digest", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    const valid = withReferenceRecordDigest({
      recordKind: "work",
      id: "work.inner-digest",
      version: 1,
      preferredTitle: "Inner digest",
      creatorIdentityRefs: [],
      identityAssertionRefs: [],
      identityState: "candidate",
    }) as ReferenceSourceStagingRecord;
    const invalidRecord = { ...valid, digest: "b".repeat(64) } as ReferenceSourceStagingRecord;
    const invalid = snapshot({
      id: "snapshot.invalid-inner",
      revision: 1,
      records: [invalidRecord],
    });
    expect(() => store.commit(invalid)).toThrow(ReferenceSourceStagingIntegrityError);
  });

  it("rejects unknown head fields rather than returning an ambient capability", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    const committed = snapshot({ id: "snapshot.closed-head", revision: 1 });
    store.commit(committed);
    writeFileSync(
      path.join(rootDirectory, "head.json"),
      `${JSON.stringify({ ...store.readHead(), canonicalPublication: true })}\n`
    );
    expect(() => store.readHead()).toThrow(ReferenceSourceStagingIntegrityError);
  });

  it("retries a moving head and returns one coherent generation", () => {
    const store = new ReferenceSourceStagingStore({ rootDirectory });
    const first = snapshot({ id: "snapshot.stable-first", revision: 1 });
    const firstHead = store.commit(first);
    const second = snapshot({
      id: "snapshot.stable-second",
      revision: 2,
      parentSnapshotRef: { id: first.id, digest: first.digest },
    });
    const secondHead = store.commit(second, { id: first.id, digest: first.digest });
    const actualReadHead = store.readHead.bind(store);
    vi.spyOn(store, "readHead")
      .mockImplementationOnce(() => firstHead)
      .mockImplementationOnce(() => secondHead)
      .mockImplementation(actualReadHead);

    expect(store.readCurrentState()).toEqual({ head: secondHead, snapshot: second });
  });
});

function snapshot(input: {
  id: string;
  revision: number;
  parentSnapshotRef?: { id: string; digest: string };
  records?: ReferenceSourceStagingRecord[];
}): ReferenceSourceStagingSnapshot {
  const core: Omit<ReferenceSourceStagingSnapshot, "digest"> = {
    schemaVersion: 1,
    id: input.id,
    revision: input.revision,
    ...(input.parentSnapshotRef ? { parentSnapshotRef: input.parentSnapshotRef } : {}),
    publicationState: "staging_only",
    createdAt: "2026-07-15T12:00:00.000Z",
    records: input.records ?? [],
  };
  return { ...core, digest: referenceSourceDigest(core) };
}

function writeClaim(file: string, pid: number, hostIdentity = stableHostIdentity()): void {
  writeFileSync(
    file,
    `${JSON.stringify({
      schemaVersion: 1,
      token: `claim-${pid}`,
      pid,
      hostIdentity,
      bootIdentity: null,
      processStartIdentity: null,
      claimedAt: "2026-07-15T12:00:00.000Z",
    })}\n`,
    { flag: "wx", mode: 0o600 }
  );
}

function stableHostIdentity(): string {
  return "a".repeat(64);
}
