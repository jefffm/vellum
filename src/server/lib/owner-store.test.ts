import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OwnerReferenceClaimIntegrityError,
  OwnerReferenceWriteClaim,
} from "./owner-reference-claim.js";
import { OwnerReferenceLegacyReader } from "./owner-reference-legacy-reader.js";
import { OwnerStore } from "./owner-store.js";

describe("local Owner trust boundary", () => {
  let rootDirectory: string;
  let extraDirectories: string[];
  let ids: string[];
  let store: OwnerStore;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-owner-"));
    extraDirectories = [];
    ids = Array.from({ length: 24 }, (_, index) => String(index + 1));
    store = new OwnerStore({
      rootDirectory,
      createId: () => ids.shift()!,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    });
  });
  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
    for (const directory of extraDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("only proposes a Personal Default after equivalent choices in distinct workspaces", () => {
    const input = {
      dimension: "notation_layout",
      value: "french-letter-tablature",
      scope: { instrument: "baroque-lute-13" },
    };
    expect(
      store.recordChoice({ ...input, workspaceId: "workspace.one" }).candidate
    ).toBeUndefined();
    const second = store.recordChoice({ ...input, workspaceId: "workspace.two" });
    expect(second.candidate).toMatchObject({
      status: "proposed",
      evidenceChoiceIds: expect.any(Array),
    });
    expect(store.listDefaults()).toEqual([]);

    const approved = store.approveDefaultCandidate(second.candidate!.id);
    expect(approved).toMatchObject({ status: "active", dimension: "notation_layout" });
    expect(store.releaseDefault(approved.id).status).toBe("released");
  });

  it("fails closed before any legacy knowledge proposal or promotion write", () => {
    const reference = store.addReference({
      title: "Instruction pour toucher le théorbe",
      citation: "Paris, 17th century",
      mimeType: "text/plain",
      contentBase64: Buffer.from("A cited passage about accompaniment.").toString("base64"),
    });
    expect(reference).toMatchObject({
      authorityState: "raw_staged",
      activationAllowed: false,
    });
    expect(store.listReferences()).toEqual([
      expect.objectContaining({
        id: reference.id,
        authorityState: "raw_staged",
        activationAllowed: false,
      }),
    ]);
    const before = readFileSync(path.join(rootDirectory, "manifest.json"), "utf8");

    expect(() =>
      store.proposeKnowledge({
        statement: "A cadence may receive a fuller texture.",
        scope: {
          period: "seventeenth century",
          region: "France",
          genre: "continuo",
          instrument: "theorbo",
          ensembleRole: "accompaniment",
        },
        referenceId: reference.id,
        citationLocator: "chapter 2",
      })
    ).toThrowError(
      expect.objectContaining({
        status: 410,
        code: "conflict",
        details: expect.objectContaining({ reason: "legacy_knowledge_quarantined" }),
      })
    );
    expect(() =>
      store.promoteKnowledge({
        candidateId: "knowledge-candidate.missing",
        packId: "pack.owner-continuo",
        packName: "Owner-reviewed continuo claims",
        authority: "documented_practice",
      })
    ).toThrowError(
      expect.objectContaining({
        status: 410,
        code: "conflict",
        details: expect.objectContaining({ reason: "legacy_knowledge_quarantined" }),
      })
    );
    for (const mutate of [
      () => store.rejectKnowledge("knowledge-candidate.missing"),
      () =>
        store.reviseKnowledge("knowledge-candidate.missing", {
          statement: "A corrected legacy assertion.",
          scope: {
            period: "seventeenth century",
            region: "France",
            genre: "continuo",
            instrument: "theorbo",
            ensembleRole: "accompaniment",
          },
          citationLocator: "chapter 3",
        }),
      () => store.releaseClaim("historical-claim.missing"),
    ]) {
      expect(mutate).toThrowError(
        expect.objectContaining({
          status: 410,
          code: "conflict",
          details: expect.objectContaining({ reason: "legacy_knowledge_quarantined" }),
        })
      );
    }

    expect(readFileSync(path.join(rootDirectory, "manifest.json"), "utf8")).toBe(before);
    expect(store.listKnowledgeCandidates()).toEqual([]);
    expect(store.listClaims()).toEqual([]);
    expect(store.listPacks()).toEqual([]);
  });

  it("loads pre-boundary references as raw staging without rewriting their stored record", () => {
    const reference = store.addReference({
      title: "Existing local facsimile",
      citation: "Owner library",
      mimeType: "application/pdf",
      contentBase64: Buffer.from("legacy local source").toString("base64"),
    });
    const recordPath = path.join(rootDirectory, "references", `${reference.id}.json`);
    const legacy = JSON.parse(readFileSync(recordPath, "utf8")) as Record<string, unknown>;
    delete legacy.authorityState;
    delete legacy.activationAllowed;
    writeFileSync(recordPath, `${JSON.stringify(legacy, null, 2)}\n`);
    const before = readFileSync(recordPath, "utf8");

    expect(store.listReferences()).toContainEqual(
      expect.objectContaining({
        id: reference.id,
        authorityState: "raw_staged",
        activationAllowed: false,
      })
    );
    expect(readFileSync(recordPath, "utf8")).toBe(before);
  });

  it("validates an existing manifest without acquiring a write claim", () => {
    let claimAttempted = false;
    const failIfClaimed = {
      withClaim<T>(_operation: () => T): T {
        claimAttempted = true;
        throw new Error("read-only construction attempted a write claim");
      },
    };

    const reloaded = new OwnerStore({ rootDirectory, referenceWriteClaim: failIfClaimed });

    expect(claimAttempted).toBe(false);
    expect(reloaded.listReferences()).toEqual([]);
  });

  it("keeps explicit candidate correction and rejection separate from learning", () => {
    const proposed = store.proposeDefaultCandidate({
      dimension: "stringing",
      value: "italian",
      scope: { instrument: "baroque-guitar-5" },
      evidenceChoiceIds: ["choice.selection-context"],
    });
    expect(store.listDefaults()).toEqual([]);
    const corrected = store.reviseDefaultCandidate(proposed.id, {
      dimension: "stringing",
      value: "french",
      scope: { instrument: "baroque-guitar-5" },
    });
    expect(store.listDefaultCandidates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: proposed.id, status: "rejected" }),
        expect.objectContaining({ id: corrected.id, status: "proposed", value: "french" }),
      ])
    );
    const approved = store.approveDefaultCandidate(corrected.id);
    expect(
      store.applyDefaults({
        id: "target.guitar",
        instrumentId: "baroque-guitar-5",
        role: "solo",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf"],
      })
    ).toMatchObject({ target: { stringing: "french" } });
    store.releaseDefault(approved.id);
    expect(
      store.applyDefaults({
        id: "target.guitar.next",
        instrumentId: "baroque-guitar-5",
        role: "solo",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf"],
      }).target.stringing
    ).toBeUndefined();
    expect(store.listDefaults()).toContainEqual(
      expect.objectContaining({ id: approved.id, status: "released" })
    );
  });

  it("applies approved defaults softly and discloses when explicit target state wins", () => {
    const choice = {
      dimension: "tuning",
      value: "d_minor",
      scope: { instrument: "baroque-lute-13" },
    };
    store.recordChoice({ ...choice, workspaceId: "workspace.one" });
    const candidate = store.recordChoice({ ...choice, workspaceId: "workspace.two" }).candidate!;
    store.approveDefaultCandidate(candidate.id);
    const target = {
      id: "target.lute",
      instrumentId: "baroque-lute-13",
      role: "solo" as const,
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf"],
    };
    expect(store.applyDefaults(target)).toMatchObject({
      target: { tuningId: "d_minor" },
      applications: [{ status: "applied" }],
    });
    expect(store.applyDefaults({ ...target, tuningId: "d_major" })).toMatchObject({
      target: { tuningId: "d_major" },
      applications: [{ status: "yielded", reason: expect.stringContaining("takes precedence") }],
    });
  });

  it("recovers a provably stale same-host reference claim before publishing raw staging", () => {
    const hostIdentity = "c".repeat(64);
    const claimPath = path.join(rootDirectory, ".reference-write.claim");
    writeFileSync(
      claimPath,
      `${JSON.stringify({
        schemaVersion: 1,
        token: "00000000-0000-4000-8000-000000000001",
        pid: 999_999,
        hostIdentity,
        bootIdentity: "same-boot",
        processStartIdentity: "former-process-start",
        claimedAt: "2026-07-11T11:59:00.000Z",
      })}\n`
    );
    const referenceWriteClaim = new OwnerReferenceWriteClaim({
      rootDirectory,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
      hostIdentity: () => hostIdentity,
      bootIdentity: () => "same-boot",
      processStartIdentity: () => "current-process-start",
      processExists: () => false,
    });
    const recovered = new OwnerStore({
      rootDirectory,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
      referenceWriteClaim,
    });

    expect(
      recovered.addReference({
        title: "Recovered raw staging",
        citation: "Owner library",
        mimeType: "text/plain",
        contentBase64: Buffer.from("recoverable claim fixture").toString("base64"),
      })
    ).toMatchObject({ authorityState: "raw_staged", activationAllowed: false });
    expect(existsSync(claimPath)).toBe(false);
    const receipts = readdirSync(path.join(rootDirectory, ".reference-write-claim-recoveries"));
    expect(receipts).toHaveLength(1);
    expect(
      JSON.parse(
        readFileSync(
          path.join(rootDirectory, ".reference-write-claim-recoveries", receipts[0]!),
          "utf8"
        )
      )
    ).toMatchObject({
      kind: "write-claim",
      absentOwner: { pid: 999_999, hostIdentity },
    });
  });

  it("waits for a healthy cross-process writer and acquires after its claim is released", async () => {
    const hostIdentity = "9".repeat(64);
    const claimPath = path.join(rootDirectory, ".reference-write.claim");
    const childScript = String.raw`
      const { randomUUID } = require("node:crypto");
      const { unlinkSync, writeFileSync } = require("node:fs");
      const [claimPath, hostIdentity] = process.argv.slice(1);
      writeFileSync(claimPath, JSON.stringify({
        schemaVersion: 1,
        token: randomUUID(),
        pid: process.pid,
        hostIdentity,
        bootIdentity: "same-boot",
        processStartIdentity: "child-process-start",
        claimedAt: "2026-07-11T11:59:00.000Z"
      }) + "\n", { flag: "wx", mode: 0o600 });
      process.stdout.write("ready\n");
      setTimeout(() => {
        unlinkSync(claimPath);
        process.exit(0);
      }, 150);
    `;
    const child = spawn(process.execPath, ["-e", childScript, claimPath, hostIdentity], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    await once(child.stdout!, "data");
    const processExists = (pid: number): boolean => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const claim = new OwnerReferenceWriteClaim({
      rootDirectory,
      hostIdentity: () => hostIdentity,
      bootIdentity: () => "same-boot",
      processStartIdentity: (pid) =>
        pid === child.pid ? "child-process-start" : "parent-process-start",
      processExists,
      contentionRetryLimit: 100,
      contentionRetryDelayMs: 5,
    });

    expect(claim.withClaim(() => "acquired")).toBe("acquired");
    if (child.exitCode === null) await once(child, "exit");
    expect(existsSync(claimPath)).toBe(false);
  });

  it("never lets a second reclaimer remove a live unique recovery ticket", () => {
    const hostIdentity = "b".repeat(64);
    const claimPath = path.join(rootDirectory, ".reference-write.claim");
    const recoveryTicket = path.join(
      rootDirectory,
      `.reference-write.claim.recovery.${randomUUID()}`
    );
    const receipt = (pid: number, processStartIdentity: string) =>
      `${JSON.stringify({
        schemaVersion: 1,
        token: randomUUID(),
        pid,
        hostIdentity,
        bootIdentity: "same-boot",
        processStartIdentity,
        claimedAt: "2026-07-11T11:59:00.000Z",
      })}\n`;
    writeFileSync(claimPath, receipt(999_999, "former-process-start"));
    const liveRecoveryReceipt = receipt(process.pid, "current-process-start");
    writeFileSync(recoveryTicket, liveRecoveryReceipt);
    const writeClaim = new OwnerReferenceWriteClaim({
      rootDirectory,
      hostIdentity: () => hostIdentity,
      bootIdentity: () => "same-boot",
      processStartIdentity: (pid) =>
        pid === process.pid ? "current-process-start" : "former-process-start",
      processExists: (pid) => pid === process.pid,
      contentionRetryLimit: 0,
    });

    expect(() => writeClaim.withClaim(() => undefined)).toThrowError(
      expect.objectContaining({ status: 409, code: "conflict" })
    );
    expect(readFileSync(recoveryTicket, "utf8")).toBe(liveRecoveryReceipt);
    expect(existsSync(claimPath)).toBe(true);

    rmSync(recoveryTicket);
    expect(writeClaim.withClaim(() => "recovered")).toBe("recovered");
    expect(existsSync(claimPath)).toBe(false);
  });

  it("rejects a live same-writer claim and preserves malformed claim evidence", () => {
    const hostIdentity = "d".repeat(64);
    const referenceWriteClaim = new OwnerReferenceWriteClaim({
      rootDirectory,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
      hostIdentity: () => hostIdentity,
      bootIdentity: () => "same-boot",
      processStartIdentity: () => "current-process-start",
      processExists: () => true,
      contentionRetryLimit: 0,
    });
    const claimPath = path.join(rootDirectory, ".reference-write.claim");

    referenceWriteClaim.withClaim(() => {
      expect(() => referenceWriteClaim.withClaim(() => undefined)).toThrowError(
        expect.objectContaining({ status: 409, code: "conflict" })
      );
      expect(existsSync(claimPath)).toBe(true);
    });
    expect(existsSync(claimPath)).toBe(false);

    const malformed = '{"schemaVersion":1,"pid":999999}\n';
    writeFileSync(claimPath, malformed);
    expect(() => referenceWriteClaim.withClaim(() => undefined)).toThrow(
      OwnerReferenceClaimIntegrityError
    );
    expect(readFileSync(claimPath, "utf8")).toBe(malformed);
  });

  it("blocks manifest initialization while a stable legacy inventory claim is held", () => {
    const emptyRoot = mkdtempSync(path.join(tmpdir(), "vellum-owner-empty-"));
    extraDirectories.push(emptyRoot);
    const claimOptions = {
      rootDirectory: emptyRoot,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
      hostIdentity: () => "f".repeat(64),
      bootIdentity: () => "same-boot",
      processStartIdentity: () => "current-process-start",
      processExists: () => true,
      contentionRetryLimit: 0,
    };
    const stableInventoryClaim = new OwnerReferenceWriteClaim(claimOptions);

    stableInventoryClaim.withClaim(() => {
      expect(
        () =>
          new OwnerStore({
            rootDirectory: emptyRoot,
            referenceWriteClaim: new OwnerReferenceWriteClaim(claimOptions),
          })
      ).toThrowError(expect.objectContaining({ status: 409, code: "conflict" }));
      expect(existsSync(path.join(emptyRoot, "manifest.json"))).toBe(false);
    });

    new OwnerStore({
      rootDirectory: emptyRoot,
      referenceWriteClaim: new OwnerReferenceWriteClaim(claimOptions),
    });
    expect(existsSync(path.join(emptyRoot, "manifest.json"))).toBe(true);
  });

  it("serializes cross-instance choice, default, and reference IDs against stable migration reads", () => {
    const hostIdentity = "a".repeat(64);
    const claimOptions = {
      rootDirectory,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
      hostIdentity: () => hostIdentity,
      bootIdentity: () => "same-boot",
      processStartIdentity: () => "current-process-start",
      processExists: () => true,
      contentionRetryLimit: 0,
    };
    let firstSequence = 0;
    let secondSequence = 0;
    let interleaveOnFirstId: (() => void) | undefined;
    const first = new OwnerStore({
      rootDirectory,
      now: claimOptions.now,
      createId: () => {
        const interleave = interleaveOnFirstId;
        interleaveOnFirstId = undefined;
        interleave?.();
        return `first-${++firstSequence}`;
      },
      referenceWriteClaim: new OwnerReferenceWriteClaim(claimOptions),
    });
    const second = new OwnerStore({
      rootDirectory,
      now: claimOptions.now,
      createId: () => `second-${++secondSequence}`,
      referenceWriteClaim: new OwnerReferenceWriteClaim(claimOptions),
    });
    const before = readFileSync(path.join(rootDirectory, "manifest.json"), "utf8");
    const stableInventoryReader = new OwnerReferenceLegacyReader({ rootDirectory });

    stableInventoryReader.withStableInventory(() => {
      for (const mutate of [
        () =>
          first.recordChoice({
            workspaceId: "workspace.blocked-choice",
            dimension: "notation_layout",
            value: "french-letter-tablature",
            scope: { instrument: "baroque-lute-13" },
          }),
        () =>
          second.proposeDefaultCandidate({
            dimension: "stringing",
            value: "french",
            scope: { instrument: "baroque-guitar-5" },
            evidenceChoiceIds: ["choice.blocked"],
          }),
        () =>
          first.addReference({
            title: "Blocked reference",
            citation: "Owner library",
            mimeType: "text/plain",
            contentBase64: Buffer.from("blocked while inventory is stable").toString("base64"),
          }),
      ]) {
        expect(mutate).toThrowError(expect.objectContaining({ status: 409, code: "conflict" }));
      }
      expect(readFileSync(path.join(rootDirectory, "manifest.json"), "utf8")).toBe(before);
    });

    const firstChoiceInput = {
      workspaceId: "workspace.first",
      dimension: "notation_layout",
      value: "french-letter-tablature",
      scope: { instrument: "baroque-lute-13" },
    };
    const secondChoiceInput = {
      workspaceId: "workspace.second",
      dimension: "tuning",
      value: "d_minor",
      scope: { instrument: "baroque-lute-13" },
    };
    interleaveOnFirstId = () => {
      expect(() => second.recordChoice(secondChoiceInput)).toThrowError(
        expect.objectContaining({ status: 409, code: "conflict" })
      );
    };
    const firstChoice = first.recordChoice(firstChoiceInput).choice;
    const secondChoice = second.recordChoice(secondChoiceInput).choice;
    const firstCandidateInput = {
      dimension: "stringing",
      value: "french",
      scope: { instrument: "baroque-guitar-5" },
      evidenceChoiceIds: [firstChoice.id],
    };
    const secondCandidateInput = {
      dimension: "tuning",
      value: "d_minor",
      scope: { instrument: "baroque-lute-13" },
      evidenceChoiceIds: [secondChoice.id],
    };
    interleaveOnFirstId = () => {
      expect(() => second.proposeDefaultCandidate(secondCandidateInput)).toThrowError(
        expect.objectContaining({ status: 409, code: "conflict" })
      );
    };
    const firstCandidate = first.proposeDefaultCandidate(firstCandidateInput);
    const secondCandidate = second.proposeDefaultCandidate(secondCandidateInput);
    const firstDefault = first.approveDefaultCandidate(firstCandidate.id);
    const secondDefault = second.approveDefaultCandidate(secondCandidate.id);
    const secondReferenceInput = {
      title: "Second reference",
      citation: "Owner library, second",
      mimeType: "text/plain",
      contentBase64: Buffer.from("second cross-instance reference").toString("base64"),
    };
    let firstReferenceRead = false;
    const firstReference = first.addReference({
      title: "First reference",
      citation: "Owner library, first",
      mimeType: "text/plain",
      get contentBase64(): string {
        if (!firstReferenceRead) {
          firstReferenceRead = true;
          expect(() => second.addReference(secondReferenceInput)).toThrowError(
            expect.objectContaining({ status: 409, code: "conflict" })
          );
        }
        return Buffer.from("first cross-instance reference").toString("base64");
      },
    });
    const secondReference = second.addReference(secondReferenceInput);

    const manifest = JSON.parse(
      readFileSync(path.join(rootDirectory, "manifest.json"), "utf8")
    ) as {
      choiceIds: string[];
      defaultCandidateIds: string[];
      defaultIds: string[];
      referenceIds: string[];
    };
    expect(new Set(manifest.choiceIds)).toEqual(new Set([firstChoice.id, secondChoice.id]));
    expect(new Set(manifest.defaultCandidateIds)).toEqual(
      new Set([firstCandidate.id, secondCandidate.id])
    );
    expect(new Set(manifest.defaultIds)).toEqual(new Set([firstDefault.id, secondDefault.id]));
    expect(new Set(manifest.referenceIds)).toEqual(
      new Set([firstReference.id, secondReference.id])
    );
  });

  it("publishes the verified spool buffer even if the spool pathname changes afterward", () => {
    const spoolPath = path.join(rootDirectory, "reference.spool");
    const verified = Buffer.from("the bytes that passed verification");
    const replacement = Buffer.from("different bytes at the same spool pathname");
    const sha256 = createHash("sha256").update(verified).digest("hex");
    writeFileSync(spoolPath, verified);
    let digestReads = 0;
    const input = {
      title: "Verified spool snapshot",
      citation: "Owner library",
      mimeType: "application/pdf",
      spoolPath,
      byteLength: verified.byteLength,
      get sha256(): string {
        digestReads += 1;
        if (digestReads === 2) writeFileSync(spoolPath, replacement);
        return sha256;
      },
    };

    const reference = store.addReferenceFromSpool(input);

    expect(readFileSync(spoolPath).equals(replacement)).toBe(true);
    expect(readFileSync(path.join(rootDirectory, reference.storedPath)).equals(verified)).toBe(
      true
    );
    expect(reference).toMatchObject({
      sha256,
      byteLength: verified.byteLength,
      authorityState: "raw_staged",
      activationAllowed: false,
    });
  });

  it("rejects a symlinked reference ancestor without writing outside the Owner root", () => {
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-owner-outside-"));
    extraDirectories.push(outside);
    symlinkSync(outside, path.join(rootDirectory, "references"), "dir");

    expect(() =>
      store.addReference({
        title: "Unsafe ancestor",
        citation: "Owner library",
        mimeType: "text/plain",
        contentBase64: Buffer.from("must remain inside").toString("base64"),
      })
    ).toThrow(/symlink|non-directory ancestor/i);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("rejects a reference ancestor swapped before controlled path capture", () => {
    const outside = mkdtempSync(path.join(tmpdir(), "vellum-owner-swap-outside-"));
    extraDirectories.push(outside);
    const references = path.join(rootDirectory, "references");
    mkdirSync(references);
    const spoolPath = path.join(rootDirectory, "swapped-reference.spool");
    const bytes = Buffer.from("verified before ancestor swap");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(spoolPath, bytes);
    let digestReads = 0;

    expect(() =>
      store.addReferenceFromSpool({
        title: "Ancestor swap",
        citation: "Owner library",
        mimeType: "application/pdf",
        spoolPath,
        byteLength: bytes.byteLength,
        get sha256(): string {
          digestReads += 1;
          if (digestReads === 2) {
            rmSync(references, { recursive: true });
            symlinkSync(outside, references, "dir");
          }
          return sha256;
        },
      })
    ).toThrow(/symlink|non-directory ancestor/i);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("preserves published bytes and record across manifest failure, then repairs on exact retry", () => {
    const claimRoot = mkdtempSync(path.join(tmpdir(), "vellum-owner-claim-"));
    extraDirectories.push(claimRoot);
    const referenceWriteClaim = new OwnerReferenceWriteClaim({
      rootDirectory: claimRoot,
      hostIdentity: () => "e".repeat(64),
      bootIdentity: () => "same-boot",
      processStartIdentity: () => "current-process-start",
      processExists: () => true,
    });
    const retryableStore = new OwnerStore({
      rootDirectory,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
      referenceWriteClaim,
    });
    const bytes = Buffer.from("manifest retry fixture");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const id = `reference.${sha256.slice(0, 24)}`;
    const input = {
      title: "Manifest retry",
      citation: "Owner library",
      mimeType: "text/plain",
      contentBase64: bytes.toString("base64"),
    };
    mkdirSync(path.join(rootDirectory, "references"), { recursive: true });

    const manifestPath = path.join(rootDirectory, "manifest.json");
    const originalManifest = readFileSync(manifestPath);
    rmSync(manifestPath);
    mkdirSync(manifestPath);
    try {
      expect(() => retryableStore.addReference(input)).toThrow();
    } finally {
      rmSync(manifestPath, { recursive: true });
      writeFileSync(manifestPath, originalManifest, { mode: 0o600 });
    }

    const recordPath = path.join(rootDirectory, "references", `${id}.json`);
    const contentPath = path.join(rootDirectory, "references", id, "content");
    expect(existsSync(recordPath)).toBe(true);
    expect(readFileSync(contentPath).equals(bytes)).toBe(true);
    expect(
      (
        JSON.parse(readFileSync(manifestPath, "utf8")) as {
          referenceIds: string[];
        }
      ).referenceIds
    ).not.toContain(id);

    expect(retryableStore.addReference(input).id).toBe(id);
    expect(retryableStore.listReferences().map(({ id: referenceId }) => referenceId)).toContain(id);
    expect(readFileSync(contentPath).equals(bytes)).toBe(true);
  });
});
