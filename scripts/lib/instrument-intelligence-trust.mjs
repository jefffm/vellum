import { execFileSync as defaultExecFileSync } from "node:child_process";

export const INSTRUMENT_INTELLIGENCE_REMOTE_IDENTITY = "github.com/jefffm/vellum";
export const INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY = Object.freeze({
  host: "github.com",
  owner: "jefffm",
  name: "vellum",
  nameWithOwner: "jefffm/vellum",
  nodeId: "R_kgDOSNEx6w",
  databaseId: 1221669355,
  branch: "refs/heads/main",
});
export const INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF =
  "refs/vellum/instrument-intelligence/trusted-main";
export const INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF =
  "refs/vellum/instrument-intelligence/bootstrap-anchor";
export const INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF =
  "refs/vellum/instrument-intelligence/trust-policy";

export const INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST = Object.freeze({
  mode: "owner_local_monotonic_publication_v2",
  remote: "origin",
  remoteIdentity: INSTRUMENT_INTELLIGENCE_REMOTE_IDENTITY,
  branch: "refs/heads/main",
  independentHeadAttestation: Object.freeze({
    provider: "github_graphql_v4",
    host: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.host,
    repositoryNodeId: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.nodeId,
    repositoryDatabaseId: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.databaseId,
    repository: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.nameWithOwner,
    branch: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.branch,
  }),
  remoteProtectionAssumed: false,
  publisherCardinality: 1,
  publication: "serialized_fast_forward_only",
  mergeCommits: "forbidden_after_checkpoint",
  destructiveRemoteOperations: "forbidden",
  divergenceDisposition: "ready_for_human",
});

export function canonicalPublicationTrustBytes() {
  return Buffer.from(`${JSON.stringify(INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST)}\n`, "utf8");
}

export function normalizeGitRemoteIdentity(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new Error("origin remote URL is missing");
  }
  const value = rawUrl.trim();
  let host;
  let pathname;

  const scpLike = value.match(/^(?:[^@/]+@)?([^:/]+):(.+)$/);
  if (scpLike && !value.includes("://")) {
    [, host, pathname] = scpLike;
  } else {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("origin remote URL is not a supported Git URL");
    }
    if (!new Set(["https:", "ssh:", "git:"]).has(parsed.protocol)) {
      throw new Error(`origin remote protocol ${parsed.protocol} is not allowed`);
    }
    host = parsed.hostname;
    pathname = parsed.pathname;
  }

  const normalizedPath = pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  if (!host || !/^[A-Za-z0-9.-]+$/.test(host) || !/^[A-Za-z0-9._/-]+$/.test(normalizedPath)) {
    throw new Error("origin remote URL has an invalid repository identity");
  }
  return `${host.toLowerCase()}/${normalizedPath}`;
}

export function assertPinnedRemoteIdentity({ fetchUrl, fetchUrls, pushUrls = [] }) {
  const effectiveFetchUrls = fetchUrls?.length ? fetchUrls : [fetchUrl];
  for (const effectiveFetchUrl of effectiveFetchUrls) {
    const fetchIdentity = normalizeGitRemoteIdentity(effectiveFetchUrl);
    if (fetchIdentity !== INSTRUMENT_INTELLIGENCE_REMOTE_IDENTITY) {
      throw new Error(
        `origin fetch URL resolves to ${fetchIdentity}, expected ${INSTRUMENT_INTELLIGENCE_REMOTE_IDENTITY}`
      );
    }
  }
  for (const pushUrl of pushUrls) {
    const pushIdentity = normalizeGitRemoteIdentity(pushUrl);
    if (pushIdentity !== INSTRUMENT_INTELLIGENCE_REMOTE_IDENTITY) {
      throw new Error(
        `origin push URL resolves to ${pushIdentity}, expected ${INSTRUMENT_INTELLIGENCE_REMOTE_IDENTITY}`
      );
    }
  }
  return INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST;
}

export function assertPinnedGitHubAttestation(attestation) {
  const expected = INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY;
  if (
    !attestation ||
    attestation.nodeId !== expected.nodeId ||
    attestation.databaseId !== expected.databaseId ||
    attestation.nameWithOwner !== expected.nameWithOwner ||
    attestation.refName !== "main" ||
    attestation.targetType !== "Commit" ||
    !/^[0-9a-f]{40}$/.test(attestation.oid ?? "")
  ) {
    throw new Error("GitHub did not attest the pinned Vellum repository main commit");
  }
  return attestation.oid;
}

export function assertAttestedPublicationHead({ fetchedCommit, attestedCommit }) {
  if (fetchedCommit !== attestedCommit) {
    throw new Error(
      "fetched origin/main differs from GitHub's independently attested publication head"
    );
  }
}

export function assertCheckpointState({
  trustedCommit,
  bootstrapAnchor,
  policyObject,
  expectedPolicyObject,
  isFirstParentAncestor,
}) {
  const values = [trustedCommit, bootstrapAnchor, policyObject];
  const present = values.filter(Boolean).length;
  if (present === 0) return false;
  if (present !== values.length) {
    throw new Error(
      "the Owner-local trust checkpoint is incomplete; recovery requires human adjudication"
    );
  }
  if (policyObject !== expectedPolicyObject) {
    throw new Error(
      "the Owner-local trust-policy anchor differs from the closed publication policy"
    );
  }
  if (!isFirstParentAncestor(bootstrapAnchor, trustedCommit)) {
    throw new Error(
      "the Owner-local trusted head does not descend from its immutable bootstrap anchor"
    );
  }
  return true;
}

export function assertMonotonicPublication({
  trustedCommit,
  checkpointEstablished,
  observedBeforeFetch,
  fetchedCommit,
  isFirstParentAncestor,
  firstParentRows = [],
}) {
  if (checkpointEstablished && !trustedCommit) {
    throw new Error(
      "the Owner-local trust checkpoint is missing after bootstrap; recovery requires human adjudication"
    );
  }
  if (trustedCommit && !checkpointEstablished) {
    throw new Error(
      "the Owner-local trust checkpoint lacks its immutable anchors; recovery requires human adjudication"
    );
  }
  if (observedBeforeFetch && !isFirstParentAncestor(observedBeforeFetch, fetchedCommit)) {
    throw new Error(
      "origin/main rewound or diverged from the previously observed publication head"
    );
  }
  if (trustedCommit && !isFirstParentAncestor(trustedCommit, fetchedCommit)) {
    throw new Error("origin/main does not descend from the Owner-local trust checkpoint");
  }
  if (trustedCommit) {
    for (const row of firstParentRows) {
      if (!Array.isArray(row) || row.length !== 2) {
        throw new Error("merge commits are forbidden after the Owner-local trust checkpoint");
      }
    }
  }
}

export function assertStablePublicationObservation({
  commitAtRead,
  commitAtEnd,
  attestedCommitAtRead,
  attestedCommitAtEnd,
  trustAtRead,
  trustAtEnd,
}) {
  if (commitAtRead !== commitAtEnd) {
    throw new Error("origin/main changed during strict verification");
  }
  if (JSON.stringify(trustAtRead) !== JSON.stringify(trustAtEnd)) {
    throw new Error("origin remote identity changed during strict verification");
  }
  assertAttestedPublicationHead({
    fetchedCommit: commitAtRead,
    attestedCommit: attestedCommitAtRead,
  });
  assertAttestedPublicationHead({
    fetchedCommit: commitAtEnd,
    attestedCommit: attestedCommitAtEnd,
  });
  if (attestedCommitAtRead !== attestedCommitAtEnd) {
    throw new Error("GitHub's attested publication head changed during strict verification");
  }
}

export function assertPreTrustCorrection({
  trustedCommit,
  checkpointEstablished,
  schema5ManifestChangingCommitCount,
  anchorHasProgress,
  candidateHasProgress,
  originalTransitionValid,
  currentEvidenceFiles,
  historicalEvidenceFiles,
  changedPaths,
  allowedPaths,
  requiredPaths = [],
  manifestPath,
  publicationTrust,
}) {
  if (trustedCommit || checkpointEstablished) {
    throw new Error("pre-trust correction is permanently disabled after trust is established");
  }
  if (schema5ManifestChangingCommitCount !== 2 || !originalTransitionValid) {
    throw new Error("pre-trust correction must directly follow the unique schema-5 bootstrap");
  }
  if (anchorHasProgress || candidateHasProgress) {
    throw new Error("pre-trust correction cannot retain or rewrite mutable execution progress");
  }
  for (const evidenceFiles of [currentEvidenceFiles, ...historicalEvidenceFiles]) {
    if (
      !Array.isArray(evidenceFiles) ||
      evidenceFiles.length !== 1 ||
      evidenceFiles[0] !== ".scratch/instrument-intelligence/evidence/.gitkeep"
    ) {
      throw new Error("pre-trust correction requires evidence-empty current and historical states");
    }
  }
  const allowed = new Set(allowedPaths);
  const offendingPath = changedPaths.find((file) => !allowed.has(file));
  if (offendingPath) {
    throw new Error(`pre-trust correction changed forbidden path ${offendingPath}`);
  }
  const missingPath = [manifestPath, ...requiredPaths].find((file) => !changedPaths.includes(file));
  if (missingPath) {
    throw new Error(`pre-trust correction omitted required path ${missingPath}`);
  }
  if (
    JSON.stringify(publicationTrust) !== JSON.stringify(INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST)
  ) {
    throw new Error("pre-trust correction does not bind the closed publication trust policy");
  }
}

export function updatePublicationCheckpoint({
  cwd,
  newCommit,
  oldCommit = null,
  bootstrapAnchor = null,
  policyObject = null,
  execFileSync = defaultExecFileSync,
}) {
  const policyBytes = canonicalPublicationTrustBytes();
  const expectedPolicyObject = execFileSync("git", ["hash-object", "--stdin"], {
    cwd,
    input: policyBytes,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  let commands;
  if (!oldCommit) {
    const writtenPolicyObject = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd,
      input: policyBytes,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (writtenPolicyObject !== expectedPolicyObject) {
      throw new Error("Git wrote an unexpected publication-policy object");
    }
    commands = [
      "start",
      `create ${INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF} ${newCommit}`,
      `create ${INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF} ${expectedPolicyObject}`,
      `create ${INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF} ${newCommit}`,
      "prepare",
      "commit",
      "",
    ];
  } else {
    if (!bootstrapAnchor || !policyObject || policyObject !== expectedPolicyObject) {
      throw new Error("cannot advance an incomplete or changed publication checkpoint");
    }
    commands = [
      "start",
      `verify ${INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF} ${bootstrapAnchor}`,
      `verify ${INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF} ${expectedPolicyObject}`,
      `update ${INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF} ${newCommit} ${oldCommit}`,
      "prepare",
      "commit",
      "",
    ];
  }

  execFileSync("git", ["update-ref", "--create-reflog", "--stdin"], {
    cwd,
    input: commands.join("\n"),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    bootstrapAnchor: bootstrapAnchor ?? newCommit,
    policyObject: expectedPolicyObject,
    trustedCommit: newCommit,
  };
}

export function assertTrustBootstrapAllowed({
  requested,
  trustedCommit,
  checkpointEstablished,
  bootstrapTransition,
  preTrustCorrectionTransition,
  hasMutableProgress,
}) {
  if (trustedCommit || checkpointEstablished) {
    throw new Error("trust bootstrap cannot replace or recreate an established checkpoint");
  }
  if (!requested) {
    throw new Error("the one-time Owner trust bootstrap was not explicitly requested");
  }
  if (hasMutableProgress) {
    throw new Error("trust bootstrap is forbidden after mutable execution progress exists");
  }
  if (!bootstrapTransition && !preTrustCorrectionTransition) {
    throw new Error("trust bootstrap is allowed only at the verified bootstrap transition");
  }
}
