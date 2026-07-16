import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
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
  OwnerReferenceClaimIntegrityError,
  OwnerReferenceWriteClaim,
} from "./owner-reference-claim.js";

const roots: string[] = [];
const children: Array<Promise<void>> = [];

afterEach(async () => {
  await Promise.all(children.splice(0));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("OwnerReferenceWriteClaim healthy contention", () => {
  it("waits for a short live owner and then acquires without overlap", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-contention-"));
    roots.push(root);
    const started = path.join(root, "holder.started");
    const hostIdentity = "a".repeat(64);
    const holder = spawnClaimHolder(root, started, hostIdentity, 200);
    children.push(holder.completed);
    await waitForFile(started);

    let acquired = false;
    new OwnerReferenceWriteClaim({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
    }).withClaim(() => {
      acquired = true;
    });

    expect(acquired).toBe(true);
    await holder.completed;
    expect(existsSync(path.join(root, ".reference-write.claim"))).toBe(false);
  });

  it("rejects a symlinked Owner root before creating claim bytes outside it", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-parent-"));
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-outside-"));
    roots.push(parent, outside);
    const root = path.join(parent, "owner");
    symlinkSync(outside, root, "dir");

    expect(
      () =>
        new OwnerReferenceWriteClaim({
          rootDirectory: root,
          hostIdentity: () => "b".repeat(64),
        })
    ).toThrow(OwnerReferenceClaimIntegrityError);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("rejects dangling primary and legacy-recovery claim symlinks without retrying", () => {
    for (const name of [".reference-write.claim", ".reference-write.claim.recovery"]) {
      const root = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-dangling-"));
      roots.push(root);
      symlinkSync(path.join(root, "missing-target"), path.join(root, name));
      const claim = new OwnerReferenceWriteClaim({
        rootDirectory: root,
        hostIdentity: () => "c".repeat(64),
        contentionRetryLimit: 0,
      });

      expect(() => claim.withClaim(() => undefined)).toThrow(OwnerReferenceClaimIntegrityError);
      expect(
        readdirSync(root).filter((entry) => entry.startsWith(".reference-write.claim.recovery."))
      ).toEqual([]);
    }
  });

  it("rejects a symlinked recovery directory before consuming the stale claim", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-recovery-root-"));
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-recovery-outside-"));
    roots.push(root, outside);
    symlinkSync(outside, path.join(root, ".reference-write-claim-recoveries"), "dir");
    const claimPath = path.join(root, ".reference-write.claim");
    const hostIdentity = "d".repeat(64);
    const staleClaim = `${JSON.stringify({
      schemaVersion: 1,
      token: "00000000-0000-4000-8000-000000000001",
      pid: 999_999,
      hostIdentity,
      bootIdentity: "same-boot",
      processStartIdentity: "former-process-start",
      claimedAt: "2026-07-11T11:59:00.000Z",
    })}\n`;
    writeFileSync(claimPath, staleClaim, { mode: 0o600 });
    const claim = new OwnerReferenceWriteClaim({
      rootDirectory: root,
      hostIdentity: () => hostIdentity,
      bootIdentity: () => "same-boot",
      processStartIdentity: () => "current-process-start",
      processExists: () => false,
      contentionRetryLimit: 0,
    });

    expect(() => claim.withClaim(() => undefined)).toThrow(OwnerReferenceClaimIntegrityError);
    expect(readFileSync(claimPath, "utf8")).toBe(staleClaim);
    expect(readdirSync(outside)).toEqual([]);
  });
});

function spawnClaimHolder(
  root: string,
  started: string,
  hostIdentity: string,
  holdMilliseconds: number
): { child: ChildProcess; completed: Promise<void> } {
  const executable = path.join(process.cwd(), "node_modules", ".bin", "vite-node");
  const helper = path.join(
    process.cwd(),
    "test",
    "instrument-intelligence",
    "fixtures",
    "t09-owner-reference-claim-holder.ts"
  );
  const child = spawn(executable, [helper, root, started, hostIdentity, String(holdMilliseconds)], {
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
      else reject(new Error(`Claim holder exited ${code ?? signal}: ${output}`));
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
