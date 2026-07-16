import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { OwnerReferenceLegacyReader } from "./owner-reference-legacy-reader.js";
import { OwnerStore } from "./owner-store.js";

const NOW = "2026-07-16T12:00:00.000Z";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("OwnerReferenceLegacyReader forensic evidence", () => {
  it("quarantines a duplicate manifest entry while preserving its sole immutable disk contender", () => {
    const { ownerRoot, store } = createOwnerRoot();
    const content = Buffer.from("duplicate manifest reference bytes");
    const reference = store.addReference({
      title: "Duplicate manifest reference",
      citation: "Owner shelf, duplicate manifest fixture",
      mimeType: "text/plain",
      contentBase64: content.toString("base64"),
    });
    const recordPath = path.join(ownerRoot, "references", `${reference.id}.json`);
    const recordBytes = readFileSync(recordPath);
    const manifestPath = path.join(ownerRoot, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      referenceIds: string[];
      [key: string]: unknown;
    };
    writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, referenceIds: [reference.id, reference.id] }, null, 2)}\n`
    );

    const reader = new OwnerReferenceLegacyReader({ rootDirectory: ownerRoot });
    const first = reader.capture();
    const second = reader.capture();

    expect(first.inventoryDigest).toBe(second.inventoryDigest);
    expect(first.observations).toHaveLength(1);
    expect(first.observations[0]).toMatchObject({
      legacyId: reference.id,
      rawLegacyId: reference.id,
      rawRecordSha256: sha256(recordBytes),
      rawRecordByteLength: recordBytes.byteLength,
      reference: {
        id: reference.id,
        citation: reference.citation,
        sha256: reference.sha256,
        byteLength: reference.byteLength,
      },
      failure: {
        reason: "legacy_id_collision",
        action: "resolve_legacy_id_collision",
        declaredSha256: reference.sha256,
        observedSha256: reference.sha256,
        declaredByteLength: content.byteLength,
        observedByteLength: content.byteLength,
      },
    });
    expect(first.observations[0]!.rawRecordBytes).toEqual(recordBytes);
    expect(first.observations[0]!.content).toEqual(content);
    expect(second.observations[0]!.rawRecordBytes).toEqual(recordBytes);
    expect(second.observations[0]!.content).toEqual(content);
  });

  it("fails an unlisted orphan closed without discarding its exact record, content, or citation", () => {
    const { ownerRoot, store } = createOwnerRoot();
    const content = Buffer.from("unlisted orphan reference bytes");
    const reference = store.addReference({
      title: "Unlisted orphan reference",
      citation: "Owner shelf, orphan fixture",
      mimeType: "text/plain",
      contentBase64: content.toString("base64"),
    });
    const recordBytes = readFileSync(path.join(ownerRoot, "references", `${reference.id}.json`));
    replaceManifestReferenceIds(ownerRoot, []);

    const inventory = new OwnerReferenceLegacyReader({ rootDirectory: ownerRoot }).capture();

    expect(inventory.observations).toHaveLength(1);
    expect(inventory.observations[0]).toMatchObject({
      legacyId: reference.id,
      rawLegacyId: reference.id,
      rawRecordSha256: sha256(recordBytes),
      rawRecordByteLength: recordBytes.byteLength,
      reference: {
        id: reference.id,
        citation: reference.citation,
        sha256: reference.sha256,
        byteLength: reference.byteLength,
      },
      failure: {
        reason: "invalid_legacy_record",
        action: "review_legacy_record",
        declaredSha256: reference.sha256,
        observedSha256: reference.sha256,
        declaredByteLength: content.byteLength,
        observedByteLength: content.byteLength,
      },
    });
    expect(inventory.observations[0]!.rawRecordBytes).toEqual(recordBytes);
    expect(inventory.observations[0]!.content).toEqual(content);
  });

  it("keeps invalid raw IDs private, captures contained orphan evidence, and never follows traversal IDs", () => {
    const parentRoot = mkdtempSync(path.join(tmpdir(), "vellum-legacy-reader-invalid-"));
    roots.push(parentRoot);
    const ownerRoot = path.join(parentRoot, "owner");
    const store = new OwnerStore({
      rootDirectory: ownerRoot,
      now: () => new Date(NOW),
    });
    const traversalId = "../../outside-secret";
    const outsideSecret = "OUTSIDE_OWNER_ROOT_MUST_NOT_BE_READ";
    writeFileSync(path.join(parentRoot, "outside-secret.json"), outsideSecret);
    replaceManifestReferenceIds(ownerRoot, [traversalId]);

    const orphanRawId = "invalid orphan id";
    const orphanContent = Buffer.from("contained invalid-ID orphan bytes");
    const orphanRecord = {
      id: orphanRawId,
      title: "Contained invalid-ID orphan",
      citation: "Owner shelf, contained invalid-ID fixture",
      mimeType: "text/plain",
      sha256: sha256(orphanContent),
      byteLength: orphanContent.byteLength,
      storedPath: `references/${orphanRawId}/content`,
      authorityState: "raw_staged",
      activationAllowed: false,
      createdAt: NOW,
    };
    const orphanRecordBytes = Buffer.from(`${JSON.stringify(orphanRecord, null, 2)}\n`);
    const referencesRoot = path.join(ownerRoot, "references");
    mkdirSync(path.join(referencesRoot, orphanRawId), { recursive: true });
    writeFileSync(path.join(referencesRoot, `${orphanRawId}.json`), orphanRecordBytes);
    writeFileSync(path.join(referencesRoot, orphanRawId, "content"), orphanContent);

    const reader = new OwnerReferenceLegacyReader({ rootDirectory: ownerRoot });
    const first = reader.capture();
    const second = reader.capture();
    const traversal = first.observations.find(
      (observation) => observation.rawLegacyId === traversalId
    );
    const containedOrphan = first.observations.find(
      (observation) => observation.rawLegacyId === orphanRawId
    );

    expect(first.inventoryDigest).toBe(second.inventoryDigest);
    expect(first.observations).toHaveLength(2);
    expect(traversal).toMatchObject({
      rawLegacyId: traversalId,
      rawRecordSha256: null,
      rawRecordByteLength: null,
      rawRecordBytes: null,
      reference: null,
      content: null,
      failure: {
        reason: "invalid_legacy_record",
        action: "review_legacy_record",
      },
    });
    expect(traversal!.legacyId).not.toBe(traversalId);
    expect(traversal!.legacyId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/);

    expect(containedOrphan).toMatchObject({
      rawLegacyId: orphanRawId,
      rawRecordSha256: sha256(orphanRecordBytes),
      rawRecordByteLength: orphanRecordBytes.byteLength,
      reference: {
        id: orphanRawId,
        citation: orphanRecord.citation,
        sha256: orphanRecord.sha256,
        byteLength: orphanContent.byteLength,
      },
      failure: {
        reason: "invalid_legacy_record",
        action: "review_legacy_record",
        declaredSha256: orphanRecord.sha256,
        observedSha256: orphanRecord.sha256,
        declaredByteLength: orphanContent.byteLength,
        observedByteLength: orphanContent.byteLength,
      },
    });
    expect(containedOrphan!.legacyId).not.toBe(orphanRawId);
    expect(containedOrphan!.legacyId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/);
    expect(containedOrphan!.rawRecordBytes).toEqual(orphanRecordBytes);
    expect(containedOrphan!.content).toEqual(orphanContent);
    expect(JSON.stringify(first)).not.toContain(outsideSecret);
  });

  it("fails closed when a legacy content path is swapped to a symlink immediately before open", () => {
    const { ownerRoot, store } = createOwnerRoot();
    const reference = store.addReference({
      title: "Pre-open swap reference",
      citation: "Owner shelf, pre-open swap fixture",
      mimeType: "text/plain",
      contentBase64: Buffer.from("trusted legacy content").toString("base64"),
    });
    const outsideRoot = mkdtempSync(path.join(tmpdir(), "vellum-legacy-reader-outside-file-"));
    roots.push(outsideRoot);
    const outside = path.join(outsideRoot, "outside-secret");
    const outsideSecret = "OUTSIDE_CONTENT_MUST_NOT_BE_READ_DURING_PREOPEN_SWAP";
    writeFileSync(outside, outsideSecret, { mode: 0o600 });
    const contentPath = path.join(ownerRoot, "references", reference.id, "content");
    const displaced = path.join(ownerRoot, "references", reference.id, "content.displaced");
    let swapped = false;
    const reader = new OwnerReferenceLegacyReader({
      rootDirectory: ownerRoot,
      faultInjector: (fault) => {
        if (
          fault.point !== "before_legacy_file_open" ||
          fault.label !== "legacy content" ||
          swapped
        )
          return;
        swapped = true;
        renameSync(contentPath, displaced);
        symlinkSync(outside, contentPath);
      },
    });

    const inventory = reader.withStableInventory((captured) => captured);

    expect(swapped).toBe(true);
    expect(inventory.observations).toEqual([
      expect.objectContaining({
        legacyId: reference.id,
        content: null,
        failure: expect.objectContaining({ reason: "unsafe_legacy_path" }),
      }),
    ]);
    expect(JSON.stringify(inventory)).not.toContain(outsideSecret);
  });

  it("rejects a references-directory symlink swap before enumerating orphan names", () => {
    const { ownerRoot, store } = createOwnerRoot();
    store.addReference({
      title: "Directory swap reference",
      citation: "Owner shelf, directory swap fixture",
      mimeType: "text/plain",
      contentBase64: Buffer.from("directory swap content").toString("base64"),
    });
    const references = path.join(ownerRoot, "references");
    const displaced = path.join(ownerRoot, "references.displaced");
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-legacy-reader-outside-directory-"));
    roots.push(outside);
    const outsideSecret = "OUTSIDE_ORPHAN_NAME_MUST_NOT_BE_ENUMERATED";
    writeFileSync(path.join(outside, `${outsideSecret}.json`), "{}\n", { mode: 0o600 });
    let swapped = false;
    const reader = new OwnerReferenceLegacyReader({
      rootDirectory: ownerRoot,
      faultInjector: (fault) => {
        if (fault.point !== "before_legacy_references_enumeration" || swapped) return;
        swapped = true;
        renameSync(references, displaced);
        symlinkSync(outside, references, "dir");
      },
    });

    expect(() => reader.withStableInventory((captured) => captured)).toThrow(
      /symlink|ancestor changed|unsafe/i
    );
    expect(swapped).toBe(true);
  });
});

function createOwnerRoot(): { ownerRoot: string; store: OwnerStore } {
  const ownerRoot = mkdtempSync(path.join(tmpdir(), "vellum-legacy-reader-"));
  roots.push(ownerRoot);
  return {
    ownerRoot,
    store: new OwnerStore({
      rootDirectory: ownerRoot,
      now: () => new Date(NOW),
    }),
  };
}

function replaceManifestReferenceIds(ownerRoot: string, referenceIds: string[]): void {
  const manifestPath = path.join(ownerRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    referenceIds: string[];
    [key: string]: unknown;
  };
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, referenceIds }, null, 2)}\n`);
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
