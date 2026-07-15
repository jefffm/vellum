import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF,
  INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST,
  INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF,
  INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF,
  assertAttestedPublicationHead,
  assertCheckpointState,
  assertMonotonicPublication,
  assertPinnedGitHubAttestation,
  assertPinnedRemoteIdentity,
  assertPreTrustCorrection,
  assertStablePublicationObservation,
  assertTrustBootstrapAllowed,
  normalizeGitRemoteIdentity,
  updatePublicationCheckpoint,
} from "../../scripts/lib/instrument-intelligence-trust.mjs";

const manifestPath = ".scratch/instrument-intelligence/completion-manifest.json";
const gitkeep = [".scratch/instrument-intelligence/evidence/.gitkeep"];

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

describe("Owner-local monotonic publication trust", () => {
  it("normalizes the permitted SSH and HTTPS spellings to one pinned identity", () => {
    expect(normalizeGitRemoteIdentity("git@github.com:jefffm/vellum.git")).toBe(
      "github.com/jefffm/vellum"
    );
    expect(normalizeGitRemoteIdentity("https://github.com/jefffm/vellum.git")).toBe(
      "github.com/jefffm/vellum"
    );
    expect(
      assertPinnedRemoteIdentity({
        fetchUrl: "git@github.com:jefffm/vellum.git",
        pushUrls: ["ssh://git@github.com/jefffm/vellum.git"],
      })
    ).toEqual(INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST);
  });

  it("rejects remote substitution and a mismatched push URL", () => {
    expect(() =>
      assertPinnedRemoteIdentity({ fetchUrl: "git@github.com:attacker/vellum.git" })
    ).toThrow(/expected github\.com\/jefffm\/vellum/);
    expect(() =>
      assertPinnedRemoteIdentity({
        fetchUrls: [
          "git@github.com:jefffm/vellum.git",
          "ssh://git@attacker.invalid/jefffm/vellum.git",
        ],
      })
    ).toThrow(/fetch URL/);
    expect(() =>
      assertPinnedRemoteIdentity({
        fetchUrl: "git@github.com:jefffm/vellum.git",
        pushUrls: ["git@github.com:attacker/vellum.git"],
      })
    ).toThrow(/push URL/);
  });

  it("rejects Git's effective pushInsteadOf destination", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "vellum-push-rewrite-"));
    try {
      git(cwd, ["init", "--quiet"]);
      git(cwd, ["remote", "add", "origin", "git@github.com:jefffm/vellum.git"]);
      git(cwd, ["config", "url.git@attacker.invalid:.pushInsteadOf", "git@github.com:"]);
      const fetchUrls = git(cwd, ["remote", "get-url", "--all", "origin"]).split("\n");
      const pushUrls = git(cwd, ["remote", "get-url", "--push", "--all", "origin"]).split("\n");
      expect(fetchUrls).toEqual(["git@github.com:jefffm/vellum.git"]);
      expect(pushUrls).toEqual(["git@attacker.invalid:jefffm/vellum.git"]);
      expect(() => assertPinnedRemoteIdentity({ fetchUrls, pushUrls })).toThrow(/push URL/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("pins the official GitHub repository identity and publication commit", () => {
    const oid = "a".repeat(40);
    expect(
      assertPinnedGitHubAttestation({
        nodeId: "R_kgDOSNEx6w",
        databaseId: 1221669355,
        nameWithOwner: "jefffm/vellum",
        refName: "main",
        targetType: "Commit",
        oid,
      })
    ).toBe(oid);
    expect(() =>
      assertPinnedGitHubAttestation({
        nodeId: "replacement-repository",
        databaseId: 1221669355,
        nameWithOwner: "jefffm/vellum",
        refName: "main",
        targetType: "Commit",
        oid,
      })
    ).toThrow(/pinned Vellum repository/);
    expect(() =>
      assertAttestedPublicationHead({ fetchedCommit: "fake", attestedCommit: oid })
    ).toThrow(/differs from GitHub/);
  });

  it("requires the complete immutable checkpoint tuple", () => {
    expect(
      assertCheckpointState({
        trustedCommit: null,
        bootstrapAnchor: null,
        policyObject: null,
        expectedPolicyObject: "policy",
        isFirstParentAncestor: () => true,
      })
    ).toBe(false);
    expect(() =>
      assertCheckpointState({
        trustedCommit: "trusted",
        bootstrapAnchor: null,
        policyObject: null,
        expectedPolicyObject: "policy",
        isFirstParentAncestor: () => true,
      })
    ).toThrow(/incomplete/);
    expect(
      assertCheckpointState({
        trustedCommit: "trusted",
        bootstrapAnchor: "anchor",
        policyObject: "policy",
        expectedPolicyObject: "policy",
        isFirstParentAncestor: () => true,
      })
    ).toBe(true);
  });

  it("accepts one fast-forward, single-parent publication sequence", () => {
    const ancestor = vi.fn(() => true);
    expect(() =>
      assertMonotonicPublication({
        trustedCommit: "trusted",
        checkpointEstablished: true,
        observedBeforeFetch: "observed",
        fetchedCommit: "tip",
        isFirstParentAncestor: ancestor,
        firstParentRows: [
          ["receipt", "implementation"],
          ["implementation", "trusted"],
        ],
      })
    ).not.toThrow();
    expect(ancestor).toHaveBeenCalledWith("observed", "tip");
    expect(ancestor).toHaveBeenCalledWith("trusted", "tip");
  });

  it.each([
    {
      name: "rewind",
      observedBeforeFetch: "old-tip",
      trustedCommit: null,
      ancestor: (candidate: string) => candidate !== "old-tip",
      rows: [] as string[][],
      message: /rewound or diverged/,
    },
    {
      name: "trusted divergence",
      observedBeforeFetch: null,
      trustedCommit: "trusted",
      ancestor: () => false,
      rows: [] as string[][],
      message: /does not descend/,
    },
    {
      name: "merge",
      observedBeforeFetch: null,
      trustedCommit: "trusted",
      ancestor: () => true,
      rows: [["merge", "parent-a", "parent-b"]],
      message: /merge commits are forbidden/,
    },
  ])(
    "rejects $name publication",
    ({ observedBeforeFetch, trustedCommit, ancestor, rows, message }) => {
      expect(() =>
        assertMonotonicPublication({
          trustedCommit,
          checkpointEstablished: Boolean(trustedCommit),
          observedBeforeFetch,
          fetchedCommit: "tip",
          isFirstParentAncestor: ancestor,
          firstParentRows: rows,
        })
      ).toThrow(message);
    }
  );

  it("halts instead of re-bootstrapping when the established checkpoint disappears", () => {
    expect(() =>
      assertMonotonicPublication({
        trustedCommit: null,
        checkpointEstablished: true,
        observedBeforeFetch: "tip",
        fetchedCommit: "tip",
        isFirstParentAncestor: () => true,
      })
    ).toThrow(/checkpoint is missing/);
    expect(() =>
      assertTrustBootstrapAllowed({
        requested: true,
        trustedCommit: null,
        checkpointEstablished: true,
        bootstrapTransition: false,
        preTrustCorrectionTransition: true,
        hasMutableProgress: false,
      })
    ).toThrow(/cannot replace or recreate/);
  });

  it("rejects a checkpoint without its immutable anchors", () => {
    expect(() =>
      assertMonotonicPublication({
        trustedCommit: "trusted",
        checkpointEstablished: false,
        observedBeforeFetch: "trusted",
        fetchedCommit: "trusted",
        isFirstParentAncestor: () => true,
      })
    ).toThrow(/lacks its immutable anchors/);
  });

  it("rejects concurrent remote movement during strict verification", () => {
    expect(() =>
      assertStablePublicationObservation({
        commitAtRead: "before",
        commitAtEnd: "after",
        attestedCommitAtRead: "before",
        attestedCommitAtEnd: "after",
        trustAtRead: INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST,
        trustAtEnd: INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST,
      })
    ).toThrow(/changed during strict verification/);
  });

  it("creates and advances all checkpoint refs transactionally", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "vellum-trust-"));
    try {
      git(cwd, ["init", "--quiet"]);
      git(cwd, ["config", "user.name", "Vellum Test"]);
      git(cwd, ["config", "user.email", "vellum-test@example.invalid"]);
      git(cwd, ["commit", "--quiet", "--allow-empty", "-m", "anchor"]);
      const anchor = git(cwd, ["rev-parse", "HEAD"]);
      const initial = updatePublicationCheckpoint({ cwd, newCommit: anchor });
      expect(git(cwd, ["rev-parse", INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF])).toBe(anchor);
      expect(git(cwd, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])).toBe(anchor);
      expect(git(cwd, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF])).toBe(
        initial.policyObject
      );

      git(cwd, ["commit", "--quiet", "--allow-empty", "-m", "next"]);
      const next = git(cwd, ["rev-parse", "HEAD"]);
      updatePublicationCheckpoint({
        cwd,
        newCommit: next,
        oldCommit: anchor,
        bootstrapAnchor: anchor,
        policyObject: initial.policyObject,
      });
      expect(git(cwd, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])).toBe(next);
      expect(git(cwd, ["rev-parse", INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF])).toBe(anchor);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not leave partial refs when checkpoint creation conflicts", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "vellum-trust-conflict-"));
    try {
      git(cwd, ["init", "--quiet"]);
      git(cwd, ["config", "user.name", "Vellum Test"]);
      git(cwd, ["config", "user.email", "vellum-test@example.invalid"]);
      git(cwd, ["commit", "--quiet", "--allow-empty", "-m", "anchor"]);
      const anchor = git(cwd, ["rev-parse", "HEAD"]);
      git(cwd, ["update-ref", INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF, anchor]);
      expect(() => updatePublicationCheckpoint({ cwd, newCommit: anchor })).toThrow();
      expect(git(cwd, ["rev-parse", INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF])).toBe(anchor);
      expect(() =>
        git(cwd, ["rev-parse", "--verify", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])
      ).toThrow();
      expect(() =>
        git(cwd, ["rev-parse", "--verify", INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF])
      ).toThrow();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("accepts exactly one evidence-empty, governance-only pre-trust correction", () => {
    expect(() =>
      assertPreTrustCorrection({
        trustedCommit: null,
        checkpointEstablished: false,
        schema5ManifestChangingCommitCount: 2,
        anchorHasProgress: false,
        candidateHasProgress: false,
        originalTransitionValid: true,
        currentEvidenceFiles: gitkeep,
        historicalEvidenceFiles: [gitkeep],
        changedPaths: [manifestPath, "SPEC.md"],
        allowedPaths: [manifestPath, "SPEC.md"],
        requiredPaths: ["SPEC.md"],
        manifestPath,
        publicationTrust: INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST,
      })
    ).not.toThrow();
  });

  it.each([
    {
      name: "mutable progress",
      changes: { candidateHasProgress: true },
      message: /mutable execution progress/,
    },
    {
      name: "historical evidence",
      changes: {
        historicalEvidenceFiles: [
          [
            ".scratch/instrument-intelligence/evidence/.gitkeep",
            ".scratch/instrument-intelligence/evidence/T01/verification.json",
          ],
        ],
      },
      message: /evidence-empty/,
    },
    {
      name: "product path",
      changes: { changedPaths: [manifestPath, "src/main.ts"] },
      message: /forbidden path/,
    },
    {
      name: "second correction",
      changes: { schema5ManifestChangingCommitCount: 3 },
      message: /directly follow the unique schema-5 bootstrap/,
    },
    {
      name: "missing verifier",
      changes: { requiredPaths: ["scripts/verify-instrument-intelligence-plan.mjs"] },
      message: /omitted required path/,
    },
  ])("rejects a pre-trust correction containing $name", ({ changes, message }) => {
    expect(() =>
      assertPreTrustCorrection({
        trustedCommit: null,
        checkpointEstablished: false,
        schema5ManifestChangingCommitCount: 2,
        anchorHasProgress: false,
        candidateHasProgress: false,
        originalTransitionValid: true,
        currentEvidenceFiles: gitkeep,
        historicalEvidenceFiles: [gitkeep],
        changedPaths: [manifestPath, "SPEC.md"],
        allowedPaths: [manifestPath, "SPEC.md"],
        manifestPath,
        publicationTrust: INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST,
        ...changes,
      })
    ).toThrow(message);
  });

  it("requires an explicit one-time Owner bootstrap over an unprogressed verified transition", () => {
    expect(() =>
      assertTrustBootstrapAllowed({
        requested: true,
        trustedCommit: null,
        checkpointEstablished: false,
        bootstrapTransition: false,
        preTrustCorrectionTransition: true,
        hasMutableProgress: false,
      })
    ).not.toThrow();
    expect(() =>
      assertTrustBootstrapAllowed({
        requested: false,
        trustedCommit: null,
        checkpointEstablished: false,
        bootstrapTransition: false,
        preTrustCorrectionTransition: true,
        hasMutableProgress: false,
      })
    ).toThrow(/explicitly requested/);
    expect(() =>
      assertTrustBootstrapAllowed({
        requested: true,
        trustedCommit: "already-trusted",
        checkpointEstablished: true,
        bootstrapTransition: false,
        preTrustCorrectionTransition: true,
        hasMutableProgress: false,
      })
    ).toThrow(/cannot replace or recreate/);
  });
});
