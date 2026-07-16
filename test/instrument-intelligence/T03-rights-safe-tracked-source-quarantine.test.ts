import { Value } from "@sinclair/typebox/value";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  TrackedSourceInventorySchema,
  authorizeBundledTrackedSourceOperation,
  authorizeTrackedSourceOperation,
  loadBundledTrackedSourceInventory,
  parseTrackedSourceInventory,
  resolveTrackedSourceOperation,
  type TrackedSourceInventory,
} from "../../src/lib/tracked-source-quarantine.js";
import { createIsolatedOwnerHttpServer } from "../lib/isolated-owner-runtime.js";

const TYLER_SHA = "f39bd77758f89ad075dd3225f94a9d06100c0a35bbaf07b5b12c676d0719e331";
const FOSCARINI_SHA = "9fb1d7b0179cb0008e1fac439f828d08b635a5c15b4c57d6f52022bc3b06008a";

describe("T03 rights-safe tracked-source quarantine", () => {
  it("loads a closed inventory with exact Tyler, Foscarini, Sanz, and fixture bytes", () => {
    const inventory = loadBundledTrackedSourceInventory();

    expect(Value.Check(TrackedSourceInventorySchema, inventory)).toBe(true);
    expect(Object.isFrozen(inventory)).toBe(true);
    expect(inventory.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tracked.alfabeto-tyler-universal",
          sha256: TYLER_SHA,
          byteLength: 3046,
          irreversiblePriorDisclosure: expect.objectContaining({ status: "disclosed" }),
        }),
        expect.objectContaining({
          id: "tracked.alfabeto-foscarini-overlay",
          sha256: FOSCARINI_SHA,
          byteLength: 1512,
        }),
        expect.objectContaining({ id: "tracked.knowledge-pack-core-baroque-guitar" }),
        expect.objectContaining({ id: "fixture.greensleeves-satb" }),
        expect.objectContaining({ id: "fixture.greensleeves-source-pdf" }),
        expect.objectContaining({ id: "fixture.baroque-guitar-transition" }),
        expect.objectContaining({ id: "fixture.baroque-lute-diapason" }),
        expect.objectContaining({ id: "fixture.classical-polyphony" }),
      ])
    );
  });

  it("re-hashes every inventory locator, including immutable historical Git bytes", () => {
    for (const artifact of loadBundledTrackedSourceInventory().artifacts) {
      const gitLocator = /^git:([^:]+):(.+)$/.exec(artifact.path);
      const bytes = gitLocator
        ? execFileSync("git", ["show", `${gitLocator[1]}:${gitLocator[2]}`])
        : readFileSync(path.resolve(artifact.path));
      expect(bytes.byteLength, artifact.id).toBe(artifact.byteLength);
      expect(createHash("sha256").update(bytes).digest("hex"), artifact.id).toBe(artifact.sha256);
    }
  });

  it("quarantines the legacy Tyler/Foscarini defaults and Sanz-derived pack", () => {
    expect(
      authorizeBundledTrackedSourceOperation({
        artifactId: "tracked.alfabeto-tyler-universal",
        operation: "default_generation",
      })
    ).toMatchObject({ outcome: "review_required", reasons: ["review_required"] });
    expect(
      authorizeTrackedSourceOperation({
        artifactId: "tracked.alfabeto-foscarini-overlay",
        sha256: FOSCARINI_SHA,
        operation: "default_generation",
      })
    ).toMatchObject({ outcome: "review_required", reasons: ["review_required"] });
    expect(
      authorizeBundledTrackedSourceOperation({
        artifactId: "tracked.knowledge-pack-core-baroque-guitar",
        operation: "knowledge_pack_load",
      })
    ).toMatchObject({ outcome: "review_required" });
  });

  it("removes legacy chart byte modules and cleans generated server output before every build", () => {
    expect(existsSync(path.resolve("src/lib/alfabeto/charts/tyler-universal.ts"))).toBe(false);
    expect(existsSync(path.resolve("src/lib/alfabeto/charts/foscarini.ts"))).toBe(false);
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["server:build"]).toMatch(
      /^node scripts\/clean-server-build\.mjs && tsc .* && node scripts\/verify-server-build\.mjs$/
    );
  });

  it("exposes the validated quarantine inventory through the Owner inspection boundary", async () => {
    const server = createIsolatedOwnerHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP server address");
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/owner/tracked-source-inventory`
      );
      const envelope = (await response.json()) as {
        ok: boolean;
        data: { inventoryId: string; artifacts: Array<{ id: string }> };
      };
      expect(response.status).toBe(200);
      expect(envelope).toMatchObject({
        ok: true,
        data: {
          inventoryId: "tracked-source-inventory.v1",
          artifacts: expect.arrayContaining([
            expect.objectContaining({ id: "tracked.alfabeto-tyler-universal" }),
          ]),
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("allows only exact rights-reviewed fixture bytes", () => {
    const allowed = authorizeTrackedSourceOperation({
      artifactId: "fixture.greensleeves-satb",
      sha256: "187caee2fa16c81d9ce8f71f47e928f2276ad81d98bb38ba2d06adfbeee45a4e",
      operation: "fixture",
    });
    const substitutedBytes = authorizeTrackedSourceOperation({
      artifactId: "fixture.greensleeves-satb",
      sha256: "0".repeat(64),
      operation: "fixture",
    });

    expect(allowed).toMatchObject({
      outcome: "allow",
      resolvedArtifactId: "fixture.greensleeves-satb",
      resolvedSha256: "187caee2fa16c81d9ce8f71f47e928f2276ad81d98bb38ba2d06adfbeee45a4e",
    });
    expect(allowed.provenanceEvidenceRefs).toContain("test/fixtures/greensleeves/PROVENANCE.md");
    expect(substitutedBytes).toMatchObject({
      outcome: "review_required",
      reasons: ["artifact_bytes_mismatch"],
    });
  });

  it("does not turn local-only authority into repository inclusion or redistribution", () => {
    const inventory = structuredClone(loadBundledTrackedSourceInventory());
    inventory.decisions.push({
      id: "decision.tyler.local.allow",
      outcome: "allow",
      binding: {
        artifactId: "tracked.alfabeto-tyler-universal",
        artifactSha256: TYLER_SHA,
        operation: "local_use",
        scope: { operation: "local_use", distribution: "local_only", purpose: "owner study" },
      },
      authority: {
        id: "authority.owner.local",
        kind: "owner",
        evidenceRefs: ["decision-record.owner.local-study"],
      },
      basisRefs: ["decision-record.owner.local-study"],
    });

    expect(
      resolveTrackedSourceOperation(inventory, {
        artifactId: "tracked.alfabeto-tyler-universal",
        sha256: TYLER_SHA,
        operation: "repository_inclusion",
      })
    ).toMatchObject({ outcome: "review_required", reasons: ["decision_missing"] });
    expect(
      resolveTrackedSourceOperation(inventory, {
        artifactId: "tracked.alfabeto-tyler-universal",
        sha256: TYLER_SHA,
        operation: "redistribution",
      })
    ).toMatchObject({ outcome: "review_required", reasons: ["decision_missing"] });
  });

  it("fails missing, conflicting, and unsourced decisions closed", () => {
    const missing = resolveTrackedSourceOperation(loadBundledTrackedSourceInventory(), {
      artifactId: "tracked.alfabeto-tyler-universal",
      sha256: TYLER_SHA,
      operation: "export",
    });
    expect(missing).toMatchObject({ outcome: "review_required", reasons: ["decision_missing"] });

    const conflicting = structuredClone(loadBundledTrackedSourceInventory());
    const existing = conflicting.decisions.find(
      (decision) => decision.id === "decision.tyler.default-generation.review"
    )!;
    conflicting.decisions.push({ ...existing, id: "decision.tyler.default-generation.other" });
    expect(
      resolveTrackedSourceOperation(conflicting, {
        artifactId: "tracked.alfabeto-tyler-universal",
        sha256: TYLER_SHA,
        operation: "default_generation",
      })
    ).toMatchObject({ outcome: "review_required", reasons: ["decision_conflict"] });

    const unsourced = structuredClone(loadBundledTrackedSourceInventory()) as unknown as {
      decisions: unknown[];
    };
    unsourced.decisions.push({
      id: "decision.unsourced",
      outcome: "allow",
      binding: {
        artifactId: "tracked.alfabeto-tyler-universal",
        artifactSha256: TYLER_SHA,
        operation: "export",
        scope: { operation: "export", distribution: "external", purpose: "unsourced" },
      },
      authority: { id: "self-asserted", kind: "owner", evidenceRefs: [] },
      basisRefs: [],
    });
    expect(Value.Check(TrackedSourceInventorySchema, unsourced)).toBe(false);
    expect(() => parseTrackedSourceInventory(unsourced)).toThrow();
  });

  it("allows provenance substitution only when bytes, scope, decision, and authority bind exactly", () => {
    const inventory = structuredClone(loadBundledTrackedSourceInventory());
    inventory.artifacts.push(replacementArtifact());
    inventory.decisions.push(replacementDecision());
    inventory.substitutions.push(replacementSubstitution());

    const allowed = resolveTrackedSourceOperation(inventory, {
      artifactId: "tracked.alfabeto-tyler-universal",
      sha256: TYLER_SHA,
      operation: "default_generation",
      substitutionId: "substitution.tyler-to-primary-release",
    });
    expect(allowed).toMatchObject({
      outcome: "allow",
      resolvedArtifactId: "release.alfabeto-primary-source.v1",
      resolvedSha256: "a".repeat(64),
      decisionId: "decision.primary-release.default-generation.allow",
      substitutionId: "substitution.tyler-to-primary-release",
    });

    const forged = structuredClone(inventory);
    forged.substitutions[0]!.binding.authorityId = "authority.caller-self-asserted";
    expect(
      resolveTrackedSourceOperation(forged, {
        artifactId: "tracked.alfabeto-tyler-universal",
        sha256: TYLER_SHA,
        operation: "default_generation",
        substitutionId: "substitution.tyler-to-primary-release",
      })
    ).toMatchObject({
      outcome: "review_required",
      reasons: ["substitution_binding_mismatch"],
    });
  });
});

function replacementArtifact(): TrackedSourceInventory["artifacts"][number] {
  return {
    id: "release.alfabeto-primary-source.v1",
    path: "knowledge-releases/alfabeto-primary-source.v1.json",
    sha256: "a".repeat(64),
    byteLength: 100,
    mediaType: "application/json",
    derivation: {
      kind: "direct_transcription",
      sourceRefs: ["reference.primary.alfabeto"],
      evidenceRefs: ["source-segment.primary.alfabeto"],
    },
    consumers: ["alfabeto release loader"],
    sourceIdentity: {
      underlyingWork: {
        status: "identified",
        identity: "Reviewed public-domain primary alfabeto source",
        rightsStatus: "public_domain",
        evidenceRefs: ["rights.work.primary.alfabeto"],
      },
      exemplar: {
        status: "identified",
        identity: "Library exemplar primary.alfabeto",
        rightsStatus: "public_domain",
        evidenceRefs: ["rights.exemplar.primary.alfabeto"],
      },
      scan: {
        status: "identified",
        identity: "Repository-approved scan primary.alfabeto",
        rightsStatus: "licensed",
        evidenceRefs: ["rights.scan.primary.alfabeto"],
      },
    },
    irreversiblePriorDisclosure: { status: "not_disclosed", evidenceRefs: [] },
  };
}

function replacementDecision(): TrackedSourceInventory["decisions"][number] {
  return {
    id: "decision.primary-release.default-generation.allow",
    outcome: "allow",
    binding: {
      artifactId: "release.alfabeto-primary-source.v1",
      artifactSha256: "a".repeat(64),
      operation: "default_generation",
      scope: {
        operation: "default_generation",
        distribution: "local_only",
        purpose: "production alfabeto default",
      },
    },
    authority: {
      id: "authority.rights-review.primary-release",
      kind: "rights_reviewer",
      evidenceRefs: ["rights-decision.primary-release"],
    },
    basisRefs: ["rights-decision.primary-release"],
  };
}

function replacementSubstitution(): TrackedSourceInventory["substitutions"][number] {
  return {
    id: "substitution.tyler-to-primary-release",
    fromArtifactId: "tracked.alfabeto-tyler-universal",
    toArtifactId: "release.alfabeto-primary-source.v1",
    binding: {
      fromSha256: TYLER_SHA,
      toSha256: "a".repeat(64),
      operation: "default_generation",
      scope: {
        operation: "default_generation",
        distribution: "local_only",
        purpose: "production alfabeto default",
      },
      decisionId: "decision.primary-release.default-generation.allow",
      authorityId: "authority.rights-review.primary-release",
    },
  };
}
