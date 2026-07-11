import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OwnerStore } from "./owner-store.js";

describe("local Owner trust boundary", () => {
  let rootDirectory: string;
  let ids: string[];
  let store: OwnerStore;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-owner-"));
    ids = Array.from({ length: 24 }, (_, index) => String(index + 1));
    store = new OwnerStore({
      rootDirectory,
      createId: () => ids.shift()!,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    });
  });
  afterEach(() => rmSync(rootDirectory, { recursive: true, force: true }));

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

  it("requires a cited local reference and explicit review before historical promotion", () => {
    const reference = store.addReference({
      title: "Instruction pour toucher le théorbe",
      citation: "Paris, 17th century",
      mimeType: "text/plain",
      contentBase64: Buffer.from("A cited passage about accompaniment.").toString("base64"),
    });
    const candidate = store.proposeKnowledge({
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
    });
    expect(store.listClaims()).toEqual([]);
    const promoted = store.promoteKnowledge({
      candidateId: candidate.id,
      packId: "pack.owner-continuo",
      packName: "Owner-reviewed continuo claims",
      authority: "documented_practice",
    });
    expect(promoted.claim).toMatchObject({
      referenceId: reference.id,
      sourceCandidateId: candidate.id,
      confidence: 1,
      status: "active",
    });
    expect(promoted.pack).toMatchObject({
      reviewed: true,
      version: 1,
      claimIds: [promoted.claim.id],
    });
    expect(store.releaseClaim(promoted.claim.id)).toMatchObject({ status: "released" });
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
});
