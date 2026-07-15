import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  acquireResourceLease,
  type CleanRerunPassReceipt,
  type ResourceLeaseHandle,
  type ResourceLeaseOwnerReceipt,
} from "./resource-lease.js";

const roots: string[] = [];

async function leaseRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vellum-resource-lease-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function owner(resourceId: string, overrides: Partial<ResourceLeaseOwnerReceipt> = {}) {
  return {
    schemaId: "vellum.resource-lease-owner.v1" as const,
    resourceId,
    leaseId: "fixture-lease",
    host: hostname(),
    machineIdentity: null,
    bootIdentity: null,
    pid: 2_147_483_647,
    processStartIdentity: null,
    acquiredAt: new Date().toISOString(),
    ...overrides,
  } satisfies ResourceLeaseOwnerReceipt;
}

function cleanRerunPass(lease: ResourceLeaseHandle): CleanRerunPassReceipt {
  const earliest = Math.max(
    Date.parse(lease.owner.acquiredAt),
    ...lease.cleanRerunMarkers.map((marker) => Date.parse(marker.requiredSince))
  );
  const startedAt = new Date(earliest + 1).toISOString();
  return {
    schemaId: "vellum.clean-rerun-pass.v1",
    runId: "clean-rerun-1",
    leaseId: lease.owner.leaseId,
    cleanupReceiptIds: lease.cleanRerunMarkers.flatMap((marker) => marker.cleanupReceiptIds),
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 1).toISOString(),
    outcome: "pass",
    commandDigest: "a".repeat(64),
    profileDigest: "b".repeat(64),
    reportDigest: "c".repeat(64),
  };
}

async function writeOwner(root: string, receipt: ResourceLeaseOwnerReceipt): Promise<void> {
  const directory = join(root, "leases", `${receipt.resourceId}.lease`);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "owner.json"), `${JSON.stringify(receipt)}\n`, "utf8");
}

async function localIdentity(root: string): Promise<ResourceLeaseHandle["owner"]> {
  const probe = await acquireResourceLease({
    rootDirectory: root,
    resourceIds: ["identity-probe"],
  });
  if (probe.status !== "acquired") throw new Error("Cannot acquire identity probe");
  const identity = probe.lease.owner;
  await probe.lease.release();
  if (!identity.machineIdentity || !identity.bootIdentity) {
    throw new Error("This host cannot establish machine and boot identity");
  }
  return identity;
}

describe("cross-process resource leases", () => {
  it("acquires resources in deterministic order and excludes a second holder", async () => {
    const root = await leaseRoot();
    const first = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["podman-vm", "audiveris"],
    });
    expect(first.status).toBe("acquired");
    if (first.status !== "acquired") return;
    expect(first.lease.resourceIds).toEqual(["audiveris", "podman-vm"]);
    expect(first.lease.owner).toMatchObject({ host: hostname(), pid: process.pid });
    expect(first.lease.ownerReceipts).toHaveLength(2);

    const second = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["audiveris", "podman-vm"],
      timeoutMs: 15,
      pollIntervalMs: 2,
    });
    expect(second).toMatchObject({
      status: "blocked",
      reason: "timeout",
      resourceId: "audiveris",
      blockerState: "live_owner",
    });

    await first.lease.release();
    const third = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["podman-vm", "audiveris"],
    });
    expect(third.status).toBe("acquired");
    if (third.status === "acquired") await third.lease.release();
  });

  it("rolls back an ordered partial acquisition when a later resource blocks", async () => {
    const root = await leaseRoot();
    const blocker = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["mutable-store"],
    });
    expect(blocker.status).toBe("acquired");
    if (blocker.status !== "acquired") return;

    const blocked = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["fixed-port", "mutable-store"],
    });
    expect(blocked).toMatchObject({ status: "blocked", resourceId: "mutable-store" });

    const fixedPort = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["fixed-port"],
    });
    expect(fixedPort.status).toBe("acquired");
    if (fixedPort.status === "acquired") await fixedPort.lease.release();
    await blocker.lease.release();
  });

  it("cleans only a proven same-host absent PID and requires an acknowledged clean rerun", async () => {
    const root = await leaseRoot();
    const identityProbe = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["identity-probe"],
    });
    expect(identityProbe.status).toBe("acquired");
    if (identityProbe.status !== "acquired") return;
    expect(identityProbe.lease.owner.machineIdentity).not.toBeNull();
    expect(identityProbe.lease.owner.bootIdentity).not.toBeNull();
    const localIdentity = identityProbe.lease.owner;
    await identityProbe.lease.release();
    await writeOwner(
      root,
      owner("audiveris", {
        machineIdentity: localIdentity.machineIdentity,
        bootIdentity: localIdentity.bootIdentity,
      })
    );

    const acquired = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["audiveris"],
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") return;
    expect(acquired.lease.orphanCleanupReceipts).toEqual([
      expect.objectContaining({
        resourceId: "audiveris",
        proof: expect.objectContaining({
          kind: "same_host_pid_absent",
          checkedHost: hostname(),
          checkedPid: 2_147_483_647,
        }),
      }),
    ]);
    expect(acquired.lease.cleanRerunRequired).toBe(true);
    expect(acquired.lease.cleanRerunMarkers).toEqual([
      expect.objectContaining({ resourceId: "audiveris" }),
    ]);
    expect(Object.isFrozen(acquired.lease.orphanCleanupReceipts[0]?.proof)).toBe(true);

    const validPass = cleanRerunPass(acquired.lease);
    await expect(
      acquired.lease.acknowledgeCleanRerunRequirement({
        ...validPass,
        leaseId: "different-lease",
      })
    ).rejects.toThrow(/does not bind/);
    await expect(
      acquired.lease.acknowledgeCleanRerunRequirement({
        ...validPass,
        startedAt: new Date(Date.parse(acquired.lease.owner.acquiredAt) - 1).toISOString(),
      })
    ).rejects.toThrow(/does not bind/);
    await expect(
      acquired.lease.acknowledgeCleanRerunRequirement({
        ...validPass,
        outcome: "fail" as never,
      })
    ).rejects.toThrow(/does not bind/);

    const acknowledgment = await acquired.lease.acknowledgeCleanRerunRequirement(validPass);
    expect(acknowledgment).toMatchObject({
      leaseId: acquired.lease.owner.leaseId,
      resourceIds: ["audiveris"],
    });
    expect(acquired.lease.cleanRerunRequired).toBe(false);
    await acquired.lease.release();

    const next = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["audiveris"],
    });
    expect(next.status).toBe("acquired");
    if (next.status === "acquired") {
      expect(next.lease.cleanRerunRequired).toBe(false);
      await next.lease.release();
    }
  });

  it("fails closed for remote, malformed, and live owner receipts", async () => {
    const remoteRoot = await leaseRoot();
    await writeOwner(remoteRoot, owner("podman-vm", { host: "remote.example.invalid" }));
    await expect(
      acquireResourceLease({ rootDirectory: remoteRoot, resourceIds: ["podman-vm"] })
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "remote_owner",
      blockerState: "remote_owner",
    });

    const malformedRoot = await leaseRoot();
    const malformedDirectory = join(malformedRoot, "leases", "audiveris.lease");
    await mkdir(malformedDirectory, { recursive: true });
    await writeFile(join(malformedDirectory, "owner.json"), "{}\n", "utf8");
    await expect(
      acquireResourceLease({ rootDirectory: malformedRoot, resourceIds: ["audiveris"] })
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "unknown_owner",
      blockerState: "unknown_owner",
      owner: null,
    });

    const liveRoot = await leaseRoot();
    const live = await acquireResourceLease({
      rootDirectory: liveRoot,
      resourceIds: ["mutable-store"],
    });
    expect(live.status).toBe("acquired");
    if (live.status !== "acquired") return;
    const receipt = JSON.parse(
      await readFile(join(liveRoot, "leases", "mutable-store.lease", "owner.json"), "utf8")
    ) as ResourceLeaseOwnerReceipt;
    expect(receipt.processStartIdentity === null || receipt.processStartIdentity.length > 0).toBe(
      true
    );
    const blocked = await acquireResourceLease({
      rootDirectory: liveRoot,
      resourceIds: ["mutable-store"],
    });
    expect(blocked).toMatchObject({ status: "blocked", blockerState: "live_owner" });
    await live.lease.release();
  });

  it("keeps recovery crash windows guarded until durable cleanup evidence exists", async () => {
    const root = await leaseRoot();
    const identity = await localIdentity(root);
    await writeOwner(
      root,
      owner("podman-vm", {
        machineIdentity: identity.machineIdentity,
        bootIdentity: identity.bootIdentity,
      })
    );
    const guard = join(root, "recovery-guards", "podman-vm.recovery");
    await mkdir(guard, { recursive: true });

    await expect(
      acquireResourceLease({ rootDirectory: root, resourceIds: ["podman-vm"] })
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "unknown_owner",
    });
    await expect(
      readFile(join(root, "leases", "podman-vm.lease", "owner.json"), "utf8")
    ).resolves.toContain("fixture-lease");

    await rm(guard, { recursive: true, force: true });
    const recovered = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["podman-vm"],
    });
    expect(recovered.status).toBe("acquired");
    if (recovered.status === "acquired") {
      expect(recovered.lease.cleanRerunRequired).toBe(true);
      await recovered.lease.release();
    }
  });

  it("unwinds earlier resources when later recovery throws", async () => {
    const root = await leaseRoot();
    const identity = await localIdentity(root);
    await writeOwner(
      root,
      owner("zz-second", {
        machineIdentity: identity.machineIdentity,
        bootIdentity: identity.bootIdentity,
      })
    );
    const markerDirectory = join(root, "clean-rerun-required");
    await mkdir(markerDirectory, { recursive: true });
    await writeFile(join(markerDirectory, "zz-second.json"), "{}\n", "utf8");

    await expect(
      acquireResourceLease({
        rootDirectory: root,
        resourceIds: ["aa-first", "zz-second"],
      })
    ).rejects.toThrow(/Invalid clean-rerun marker/);

    const first = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["aa-first"],
    });
    expect(first.status).toBe("acquired");
    if (first.status === "acquired") await first.lease.release();
  });

  it("fails closed when a clean-rerun marker changes before acknowledgment", async () => {
    const root = await leaseRoot();
    const identity = await localIdentity(root);
    await writeOwner(
      root,
      owner("audiveris", {
        machineIdentity: identity.machineIdentity,
        bootIdentity: identity.bootIdentity,
      })
    );
    const acquired = await acquireResourceLease({
      rootDirectory: root,
      resourceIds: ["audiveris"],
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") return;
    const validPass = cleanRerunPass(acquired.lease);
    await writeFile(join(root, "clean-rerun-required", "audiveris.json"), "{}\n", "utf8");

    await expect(acquired.lease.acknowledgeCleanRerunRequirement(validPass)).rejects.toThrow(
      /marker changed/
    );
    expect(acquired.lease.cleanRerunRequired).toBe(true);
    await acquired.lease.release();
  });

  it("rejects ambiguous or path-like resource declarations", async () => {
    const root = await leaseRoot();
    await expect(
      acquireResourceLease({ rootDirectory: root, resourceIds: ["audiveris", "audiveris"] })
    ).rejects.toThrow(/unique/);
    await expect(
      acquireResourceLease({ rootDirectory: root, resourceIds: ["../audiveris"] })
    ).rejects.toThrow(/Invalid resource ID/);
  });
});
