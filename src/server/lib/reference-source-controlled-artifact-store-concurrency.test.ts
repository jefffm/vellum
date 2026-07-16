import { existsSync, lstatSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const directoryRace = vi.hoisted(() => ({
  target: "",
  root: "",
  winner: null as "directory" | "file" | "symlink" | null,
  catalogInitOpenCount: 0,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mkdirSync = ((directory: string, options?: object) => {
    if (directory === directoryRace.target && directoryRace.winner !== null) {
      const winner = directoryRace.winner;
      directoryRace.winner = null;
      if (winner === "directory") actual.mkdirSync(directory, options);
      else if (winner === "file") actual.writeFileSync(directory, "competing file");
      else actual.symlinkSync(directoryRace.root, directory, "dir");
      const error = new Error(
        `EEXIST: competing creator won ${directory}`
      ) as NodeJS.ErrnoException;
      error.code = "EEXIST";
      throw error;
    }
    return actual.mkdirSync(directory, options);
  }) as typeof actual.mkdirSync;
  const openSync = ((file: import("node:fs").PathLike, ...args: unknown[]) => {
    if (/\.catalog-init\.[0-9a-f-]{36}\.tmp$/.test(String(file))) {
      directoryRace.catalogInitOpenCount += 1;
    }
    return (actual.openSync as (...values: unknown[]) => number)(file, ...args);
  }) as typeof actual.openSync;
  return { ...actual, mkdirSync, openSync };
});

import {
  ReferenceSourceControlledArtifactStore,
  ReferenceSourceControlledArtifactStoreIntegrityError,
} from "./reference-source-controlled-artifact-store.js";

const roots: string[] = [];

afterEach(() => {
  directoryRace.target = "";
  directoryRace.root = "";
  directoryRace.winner = null;
  directoryRace.catalogInitOpenCount = 0;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("reference-source controlled artifact startup races", () => {
  it("accepts EEXIST only when a competing process created the required directory", () => {
    const root = temporaryRoot();
    directoryRace.target = path.join(root, "blobs");
    directoryRace.root = root;
    directoryRace.winner = "directory";

    expect(() => new ReferenceSourceControlledArtifactStore({ rootDirectory: root })).not.toThrow();
    expect(lstatSync(directoryRace.target).isDirectory()).toBe(true);
  });

  it.each(["file", "symlink"] as const)(
    "rejects EEXIST when a competing process substituted a %s",
    (winner) => {
      const root = temporaryRoot();
      directoryRace.target = path.join(root, "blobs");
      directoryRace.root = root;
      directoryRace.winner = winner;

      expect(() => new ReferenceSourceControlledArtifactStore({ rootDirectory: root })).toThrow(
        ReferenceSourceControlledArtifactStoreIntegrityError
      );
    }
  );

  it("does not create catalog-publication temporaries after an atomic catalog exists", () => {
    const root = temporaryRoot();
    new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(directoryRace.catalogInitOpenCount).toBe(1);

    directoryRace.catalogInitOpenCount = 0;
    new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(directoryRace.catalogInitOpenCount).toBe(0);
  });

  it("fails closed on arbitrary first-publication bytes and reconciles them on restart", () => {
    const root = temporaryRoot();
    const store = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    const temporary = path.join(root, ".catalog-init.00000000-0000-4000-8000-000000000000.tmp");
    writeFileSync(temporary, "arbitrary untracked bytes");

    expect(store.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
    });
    const restarted = new ReferenceSourceControlledArtifactStore({ rootDirectory: root });
    expect(existsSync(temporary)).toBe(false);
    expect(restarted.observe()).toMatchObject({ status: "complete" });
  });
});

function temporaryRoot(): string {
  const parent = mkdtempSync(path.join(tmpdir(), "vellum-controlled-startup-race-"));
  roots.push(parent);
  return path.join(parent, "store");
}
