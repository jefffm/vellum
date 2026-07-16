import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalReferenceJson,
  referenceSourceDigest,
  type ReferenceRecordRef,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceControlledArtifactStore,
  ReferenceSourceControlledArtifactStoreConflictError,
  ReferenceSourceControlledArtifactStoreIntegrityError,
  type PutReferenceSourceControlledArtifactInput,
} from "./reference-source-controlled-artifact-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("reference-source controlled artifact store", () => {
  it("deduplicates identical bytes across exact refs and survives restart", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const first = artifactInput("asset.first", "a", "shared fixture bytes");
    const second = artifactInput("asset.second", "b", "shared fixture bytes");

    store.put(first);
    store.put(second);

    expect(readdirSync(path.join(root, "blobs"))).toEqual([first.sha256]);
    const beforeRestart = store.observe();
    expect(beforeRestart).toMatchObject({
      status: "complete",
      storeGeneration: 2,
      artifactBindings: [bindingFor(first), bindingFor(second)],
    });

    const restarted = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(restarted.observe()).toEqual(beforeRestart);
    expect(restarted.put(first)).toEqual({
      artifactRef: first.artifactRef,
      blobSha256: first.sha256,
      byteLength: first.byteLength,
    });
    expect(restarted.observe().storeGeneration).toBe(2);
  });

  it("fails inventory closed for tampered, missing, and orphan blobs", () => {
    const tamperedRoot = temporaryRoot();
    const tamperedStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: tamperedRoot,
    });
    const tampered = artifactInput("asset.tampered", "a", "original bytes");
    tamperedStore.put(tampered);
    writeFileSync(path.join(tamperedRoot, "blobs", tampered.sha256), "modified bytes");
    expect(tamperedStore.observe()).toMatchObject({
      status: "failed",
      failureCode: "state_digest_changed",
    });

    const missingRoot = temporaryRoot();
    const missingStore = new ReferenceSourceControlledArtifactStore({ rootDirectory: missingRoot });
    const missing = artifactInput("asset.missing", "b", "missing bytes");
    missingStore.put(missing);
    rmSync(path.join(missingRoot, "blobs", missing.sha256));
    expect(missingStore.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
    });

    const orphanRoot = temporaryRoot();
    const orphanStore = new ReferenceSourceControlledArtifactStore({ rootDirectory: orphanRoot });
    const orphanBytes = Buffer.from("unbound bytes");
    writeFileSync(path.join(orphanRoot, "blobs", digest(orphanBytes)), orphanBytes);
    expect(orphanStore.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
      artifactBindings: [],
    });
  });

  it("guards release and preserves a shared blob until its final binding", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const first = artifactInput("asset.release-first", "a", "shared release bytes");
    const second = artifactInput("asset.release-second", "b", "shared release bytes");
    store.put(first);
    store.put(second);
    const blobPath = path.join(root, "blobs", first.sha256);

    expect(() =>
      store.release({ artifactRef: first.artifactRef, expectedBlobSha256: "f".repeat(64) })
    ).toThrow(ReferenceSourceControlledArtifactStoreConflictError);
    expect(existsSync(blobPath)).toBe(true);

    expect(
      store.release({ artifactRef: first.artifactRef, expectedBlobSha256: first.sha256 })
    ).toMatchObject({ blobDeleted: false, generation: 3 });
    expect(existsSync(blobPath)).toBe(true);
    expect(store.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [bindingFor(second)],
    });

    expect(
      store.release({ artifactRef: second.artifactRef, expectedBlobSha256: second.sha256 })
    ).toMatchObject({ blobDeleted: true, generation: 4 });
    expect(existsSync(blobPath)).toBe(false);
    expect(store.observe()).toMatchObject({ status: "complete", artifactBindings: [] });
  });

  it("holds one cross-process catalog claim across a synchronous transaction boundary", () => {
    const root = temporaryRoot();
    const transactionOwner = new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
    });
    const contender = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const first = artifactInput("asset.transaction-first", "a", "transaction bytes");
    const second = artifactInput("asset.transaction-second", "b", "transaction bytes");
    transactionOwner.put(first);

    transactionOwner.withExclusiveTransaction(() => {
      expect(transactionOwner.observe()).toMatchObject({
        status: "complete",
        artifactBindings: [bindingFor(first)],
      });
      expect(() =>
        contender.release({
          artifactRef: first.artifactRef,
          expectedBlobSha256: first.sha256,
        })
      ).toThrow(ReferenceSourceControlledArtifactStoreConflictError);
      transactionOwner.put(second);
    });

    expect(transactionOwner.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [bindingFor(first), bindingFor(second)],
    });
    expect(
      contender.release({
        artifactRef: first.artifactRef,
        expectedBlobSha256: first.sha256,
      })
    ).toMatchObject({ blobDeleted: false });
  });

  it("durably completes an interrupted last-binding release without an external retry", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const input = artifactInput("asset.interrupted-release", "a", "release crash bytes");
    store.put(input);

    // Exact durable crash shape: the release intent reached disk and the last
    // blob was unlinked, but the catalog replacement did not happen.
    const catalog = readCatalog(root);
    const afterCore = {
      schemaVersion: 1 as const,
      generation: catalog.generation + 1,
      bindings: [],
    };
    const after = { ...afterCore, digest: referenceSourceDigest(afterCore) };
    const intentCore = {
      schemaVersion: 1 as const,
      kind: "last_binding_release" as const,
      artifactRef: input.artifactRef,
      blobSha256: input.sha256,
      byteLength: input.byteLength,
      catalogBeforeGeneration: catalog.generation,
      catalogBeforeDigest: catalog.digest,
      catalogAfterGeneration: after.generation,
      catalogAfterDigest: after.digest,
    };
    const intentPath = path.join(root, ".pending", `release.${randomUUID()}.intent.json`);
    writeFileSync(
      intentPath,
      `${canonicalReferenceJson({ ...intentCore, digest: referenceSourceDigest(intentCore) })}\n`
    );
    rmSync(path.join(root, "blobs", input.sha256));
    expect(store.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
    });

    const restarted = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(existsSync(intentPath)).toBe(false);
    expect(restarted.observe()).toMatchObject({
      status: "complete",
      storeGeneration: 2,
      artifactBindings: [],
    });
  });

  it("fails on pending source bytes and reconciles a verified interrupted put on restart", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const bytes = Buffer.from("interrupted pending source bytes");
    const sha256 = digest(bytes);
    const pendingPath = path.join(root, ".pending", `${sha256}.${randomUUID()}.pending`);
    writeFileSync(pendingPath, bytes);

    expect(store.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
    });

    const restarted = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(existsSync(pendingPath)).toBe(false);
    expect(restarted.observe()).toMatchObject({ status: "complete", artifactBindings: [] });
  });

  it("removes the exact orphan hard link from a put interrupted before catalog commit", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const bytes = Buffer.from("interrupted hard-linked source bytes");
    const sha256 = digest(bytes);
    const pendingPath = path.join(root, ".pending", `${sha256}.${randomUUID()}.pending`);
    const blobPath = path.join(root, "blobs", sha256);
    writeFileSync(pendingPath, bytes);
    linkSync(pendingPath, blobPath);
    expect(lstatSync(pendingPath).ino).toBe(lstatSync(blobPath).ino);

    expect(store.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
    });

    const restarted = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(existsSync(pendingPath)).toBe(false);
    expect(existsSync(blobPath)).toBe(false);
    expect(restarted.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [],
    });
  });

  it("fails on an interrupted catalog replacement and removes its private metadata on restart", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const residue = path.join(root, `.catalog.${randomUUID()}.tmp`);
    writeFileSync(residue, '{"privateArtifactRef":"asset.owner-private"}\n');

    expect(store.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
    });

    const restarted = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(existsSync(residue)).toBe(false);
    expect(restarted.observe()).toMatchObject({ status: "complete" });
  });

  it("recovers only a provably absent same-host claim and fails closed otherwise", () => {
    const recoverableRoot = temporaryRoot();
    const hostIdentity = "c".repeat(64);
    new ReferenceSourceControlledArtifactStore({
      rootDirectory: recoverableRoot,
      hostIdentity: () => hostIdentity,
    });
    writeClaim(recoverableRoot, hostIdentity);

    const recovered = new ReferenceSourceControlledArtifactStore({
      rootDirectory: recoverableRoot,
      hostIdentity: () => hostIdentity,
    });
    expect(recovered.observe()).toMatchObject({ status: "complete" });
    expect(existsSync(path.join(recoverableRoot, ".catalog.claim"))).toBe(false);
    expect(readdirSync(path.join(recoverableRoot, "recoveries"))).toHaveLength(1);

    const foreignRoot = temporaryRoot();
    new ReferenceSourceControlledArtifactStore({
      rootDirectory: foreignRoot,
      hostIdentity: () => hostIdentity,
    });
    writeClaim(foreignRoot, "d".repeat(64));
    const foreign = new ReferenceSourceControlledArtifactStore({
      rootDirectory: foreignRoot,
      hostIdentity: () => hostIdentity,
    });
    expect(foreign.observe()).toMatchObject({ status: "failed", failureCode: "read_error" });
    expect(existsSync(path.join(foreignRoot, ".catalog.claim"))).toBe(true);
  });

  it("restores a stale catalog claim when its recovery destination is swapped after validation", () => {
    const root = temporaryRoot();
    const outside = temporaryRoot();
    const recoveryDirectory = path.join(root, "recoveries");
    const claimPath = path.join(root, ".catalog.claim");
    const hostIdentity = "9".repeat(64);
    let swapArmed = false;
    let swapped = false;
    const store = new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => {
        if (
          existsSync(claimPath) &&
          readdirSync(root).some((name) => /^\.catalog\.claim\.recovery\.[0-9a-f-]{36}$/.test(name))
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
    writeClaim(root, hostIdentity);
    const staleClaim = readFileSync(claimPath, "utf8");

    expect(() =>
      store.put(artifactInput("asset.recovery-destination-swap", "a", "blocked recovery bytes"))
    ).toThrow(ReferenceSourceControlledArtifactStoreIntegrityError);

    expect(swapped).toBe(true);
    expect(readFileSync(claimPath, "utf8")).toBe(staleClaim);
    expect(readdirSync(outside)).toEqual([]);
    expect(
      readdirSync(root).filter(
        (name) =>
          name.includes(".orphan.") || /^\.catalog\.claim\.recovery\.[0-9a-f-]{36}$/.test(name)
      )
    ).toEqual([]);
  });

  it("preserves a live unique recovery ticket when a second reclaimer arrives", () => {
    const root = temporaryRoot();
    const hostIdentity = "b".repeat(64);
    new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });
    writeClaim(root, hostIdentity);
    const recoveryTicket = path.join(root, `.catalog.claim.recovery.${randomUUID()}`);
    const liveRecoveryReceipt = `${JSON.stringify({
      schemaVersion: 1,
      token: randomUUID(),
      pid: process.pid,
      hostIdentity,
      bootIdentity: null,
      processStartIdentity: null,
      claimedAt: "2026-07-15T12:00:00.000Z",
    })}\n`;
    writeFileSync(recoveryTicket, liveRecoveryReceipt);
    const contender = new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });
    const input = artifactInput("asset.after-recovery", "a", "recovery serialization bytes");

    expect(() => contender.put(input)).toThrow(ReferenceSourceControlledArtifactStoreConflictError);
    expect(readFileSync(recoveryTicket, "utf8")).toBe(liveRecoveryReceipt);
    expect(existsSync(path.join(root, ".catalog.claim"))).toBe(true);

    rmSync(recoveryTicket);
    expect(contender.put(input)).toEqual(bindingFor(input));
    expect(existsSync(path.join(root, ".catalog.claim"))).toBe(false);
  });

  it("does not mistake an abandoned pre-publication claim temporary for an owned claim", () => {
    const root = temporaryRoot();
    const hostIdentity = "e".repeat(64);
    new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });
    const abandonedTemporary = path.join(root, `.catalog-claim.${randomUUID()}.tmp`);
    writeFileSync(abandonedTemporary, '{"schemaVersion":1');

    const restarted = new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });

    expect(restarted.observe()).toMatchObject({ status: "complete" });
    expect(existsSync(path.join(root, ".catalog.claim"))).toBe(false);
  });

  it("enumerates recovery receipts and fails closed on unrecognized recovery bytes", () => {
    const root = temporaryRoot();
    const hostIdentity = "c".repeat(64);
    new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });
    writeClaim(root, hostIdentity);
    const recovered = new ReferenceSourceControlledArtifactStore({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    });
    const receipt = readdirSync(path.join(root, "recoveries"))[0]!;
    expect(recovered.observe()).toMatchObject({ status: "complete" });

    writeFileSync(path.join(root, "recoveries", receipt), "unrecognized recovery bytes");
    expect(recovered.observe()).toMatchObject({
      status: "failed",
      failureCode: "state_digest_changed",
    });
  });

  it("fails closed without following symlinked or wrong-type controlled entries", () => {
    for (const entryName of ["blobs", ".pending", "catalog.json", "recoveries"] as const) {
      const symlinkRoot = temporaryRoot();
      const symlinkStore = new ReferenceSourceControlledArtifactStore({
        rootDirectory: symlinkRoot,
      });
      const entryPath = path.join(symlinkRoot, entryName);
      const target = path.join(symlinkRoot, `external-${entryName.replaceAll(".", "dot")}`);
      const catalogBytes = readCatalogBytes(symlinkRoot);
      rmSync(entryPath, { recursive: true, force: true });
      if (entryName === "catalog.json") writeFileSync(target, catalogBytes);
      else mkdirSync(target);
      symlinkSync(target, entryPath);
      expect(symlinkStore.observe()).toMatchObject({
        status: "failed",
        failureCode: "read_error",
      });

      const wrongTypeRoot = temporaryRoot();
      const wrongTypeStore = new ReferenceSourceControlledArtifactStore({
        rootDirectory: wrongTypeRoot,
      });
      const wrongTypePath = path.join(wrongTypeRoot, entryName);
      rmSync(wrongTypePath, { recursive: true, force: true });
      if (entryName === "catalog.json") mkdirSync(wrongTypePath);
      else writeFileSync(wrongTypePath, "wrong entry type");
      expect(wrongTypeStore.observe()).toMatchObject({
        status: "failed",
        failureCode: "read_error",
      });
    }
  });

  it("rejects rebinding, invalid bytes, and unsafe exact refs", () => {
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: temporaryRoot() });
    const original = artifactInput("asset.guarded", "a", "original");
    store.put(original);

    const rebound = artifactInput("asset.guarded", "a", "different");
    expect(() => store.put(rebound)).toThrow(ReferenceSourceControlledArtifactStoreConflictError);
    expect(() => store.put({ ...original, byteLength: original.byteLength + 1 })).toThrow(
      /byte length/
    );
    expect(() => store.put({ ...original, sha256: "f".repeat(64) })).toThrow(/SHA-256/);
    expect(() =>
      store.put({
        ...original,
        artifactRef: { id: "../escape", digest: "a".repeat(64) },
      })
    ).toThrow(ReferenceSourceControlledArtifactStoreIntegrityError);
    expect(() =>
      store.release({
        artifactRef: { id: "../escape", digest: "a".repeat(64) },
        expectedBlobSha256: original.sha256,
      })
    ).toThrow(ReferenceSourceControlledArtifactStoreIntegrityError);
  });
});

function temporaryRoot(): string {
  const root = path.join(tmpdir(), `vellum-controlled-artifacts-${process.pid}-${roots.length}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  roots.push(root);
  return root;
}

function artifactInput(
  id: string,
  refFill: string,
  text: string
): PutReferenceSourceControlledArtifactInput {
  const bytes = Buffer.from(text);
  return {
    artifactRef: ref(id, refFill),
    sha256: digest(bytes),
    byteLength: bytes.byteLength,
    bytes,
  };
}

function bindingFor(input: PutReferenceSourceControlledArtifactInput) {
  return {
    artifactRef: input.artifactRef,
    blobSha256: input.sha256,
    byteLength: input.byteLength,
  };
}

function readCatalog(root: string): {
  generation: number;
  digest: string;
  bindings: unknown[];
} {
  return JSON.parse(readCatalogBytes(root)) as {
    generation: number;
    digest: string;
    bindings: unknown[];
  };
}

function readCatalogBytes(root: string): string {
  return readFileSync(path.join(root, "catalog.json"), "utf8");
}

function ref(id: string, fill: string): ReferenceRecordRef {
  return { id, digest: fill.repeat(64) };
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeClaim(root: string, hostIdentity: string): void {
  writeFileSync(
    path.join(root, ".catalog.claim"),
    `${JSON.stringify({
      schemaVersion: 1,
      token: randomUUID(),
      pid: 2_147_483_647,
      hostIdentity,
      bootIdentity: null,
      processStartIdentity: null,
      claimedAt: "2026-07-15T12:00:00.000Z",
    })}\n`
  );
}
