import { createHash, createPublicKey, verify as verifySignatureBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import {
  assertCanonicalClauseLedgerJson,
  assertMarkerBijection,
  buildClauseLedger,
  canonicalClauseLedgerJson,
  loadClauseLedgerInputs,
} from "./lib/instrument-intelligence-clause-ledger.mjs";
import {
  AUTHORITY_SNAPSHOT_SCHEMA_ID,
  EVIDENCE_RECEIPT_SCHEMA_ID,
  HUMAN_REVIEW_ROLES,
  PUBLIC_COVERAGE_CLASSES,
  START_RECEIPT_SCHEMA_ID,
  compileCanonicalPredicateWitness,
  validateAuthoritySnapshot as validateAuthoritySnapshotV2,
  validateAuthorityArtifactPayload,
  validateEvidenceReceipt as validateEvidenceReceiptV2,
  validateStartReceipt as validateStartReceiptV1,
} from "./lib/instrument-intelligence-receipts.mjs";
import {
  REMEDIATION_LEDGER_SCHEMA_ID,
  TRACER_RESULT_CONTRACTS,
  validateRemediationObligationLedger,
  validateResultDisposition,
} from "./lib/instrument-intelligence-results.mjs";
import {
  INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF,
  INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY,
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
  canonicalPublicationTrustBytes,
  updatePublicationCheckpoint,
} from "./lib/instrument-intelligence-trust.mjs";

const root = process.cwd();
const waveRoot = path.join(root, ".scratch/instrument-intelligence");
const issueRoot = path.join(waveRoot, "issues");
const manifestPath = path.join(waveRoot, "completion-manifest.json");
const manifestRepoPath = ".scratch/instrument-intelligence/completion-manifest.json";
const clauseLedgerRepoPath = ".scratch/instrument-intelligence/clause-ledger.json";
const reviewAuthorityCatalogRepoPath =
  ".scratch/instrument-intelligence/review-authority-catalog.json";
const clauseLedgerSchemaRepoPath = "schemas/instrument-intelligence/clause-ledger.schema.json";
const evidenceSchemaRepoPath = "schemas/instrument-intelligence/evidence.v2.schema.json";
const startReceiptSchemaRepoPath = "schemas/instrument-intelligence/start-receipt.v1.schema.json";
const protocolSchemaPaths = [
  clauseLedgerSchemaRepoPath,
  evidenceSchemaRepoPath,
  startReceiptSchemaRepoPath,
];
const manifestLockPath = `${manifestPath}.lock`;
const BOOTSTRAP_MANIFEST_SCHEMA = 5;
const CURRENT_MANIFEST_SCHEMA = 6;
const writeManifest = process.argv.includes("--write-manifest");
const draftMode = writeManifest || process.argv.includes("--draft");
const verifyPendingEvidence = process.argv.includes("--verify-pending");
const observePublishedEvidence = process.argv.includes("--observe-published-evidence");
const recordPublishedEvidence = process.argv.includes("--record-published-evidence");
const trustBootstrap = process.argv.includes("--trust-bootstrap");
if (
  [
    draftMode,
    verifyPendingEvidence,
    observePublishedEvidence,
    recordPublishedEvidence,
    trustBootstrap,
  ].filter(Boolean).length > 1
) {
  fail("choose exactly one verifier mode");
}
const verificationAuthorityPaths = [
  ".prettierrc",
  reviewAuthorityCatalogRepoPath,
  "flake.nix",
  "flake.lock",
  "scripts/nix-podman",
  "scripts/lib/instrument-intelligence-trust.mjs",
  "scripts/lib/instrument-intelligence-clause-ledger.mjs",
  "scripts/lib/instrument-intelligence-receipts.mjs",
  "scripts/lib/instrument-intelligence-results.mjs",
  "scripts/generate-instrument-intelligence-clause-ledger.mjs",
  "scripts/verify-current-spec.mjs",
  "scripts/verify-instrument-intelligence-plan.mjs",
  clauseLedgerSchemaRepoPath,
  evidenceSchemaRepoPath,
  startReceiptSchemaRepoPath,
  "test/instrument-intelligence/bootstrap-trust-policy.test.ts",
  "test/instrument-intelligence/T01-governing-contract-baseline-guard.test.ts",
  "test/instrument-intelligence/T01-clause-ledger.test.ts",
  "test/instrument-intelligence/receipt-contract.test.ts",
  "test/instrument-intelligence/result-contract.test.ts",
];
const preTrustCorrectionAllowedPaths = Object.freeze([
  manifestRepoPath,
  "SPEC.md",
  "AGENTS.md",
  ".scratch/instrument-intelligence/PLAN.md",
  ".scratch/instrument-intelligence/README.md",
  ".scratch/instrument-intelligence/REQUIREMENTS.md",
  ".scratch/instrument-intelligence/issues/01-governing-contract-baseline-guard.md",
  "docs/agents/issue-tracker.md",
  "flake.nix",
  "scripts/nix-podman",
  "scripts/lib/instrument-intelligence-trust.mjs",
  "scripts/verify-instrument-intelligence-plan.mjs",
  "test/instrument-intelligence/bootstrap-trust-policy.test.ts",
]);
const requiredPreTrustCorrectionPaths = Object.freeze([
  manifestRepoPath,
  "scripts/nix-podman",
  "scripts/lib/instrument-intelligence-trust.mjs",
  "scripts/verify-instrument-intelligence-plan.mjs",
  "test/instrument-intelligence/bootstrap-trust-policy.test.ts",
]);
const t01PreregistrationAllowedPaths = Object.freeze([
  manifestRepoPath,
  "SPEC.md",
  ".scratch/instrument-intelligence/REQUIREMENTS.md",
  reviewAuthorityCatalogRepoPath,
  ".scratch/instrument-intelligence/issues/01-governing-contract-baseline-guard.md",
  ".scratch/instrument-intelligence/issues/02-server-minted-provider-boundary.md",
  ".scratch/instrument-intelligence/issues/03-rights-safe-tracked-source-quarantine.md",
  ".scratch/instrument-intelligence/issues/04-release-floor-profile-gate-matrix.md",
  ".scratch/instrument-intelligence/issues/100-transcription-extraction-review.md",
  ".scratch/instrument-intelligence/issues/101-historical-claim-pack-profile-review.md",
  ".scratch/instrument-intelligence/issues/104-source-structure-musical-fidelity-review.md",
  ".scratch/instrument-intelligence/issues/17-evaluation-status-comparison-migration.md",
  ".scratch/instrument-intelligence/issues/18-sealed-evaluator-process-boundary.md",
  ".scratch/instrument-intelligence/issues/19-encrypted-evaluation-vault-lifecycle.md",
  ".scratch/instrument-intelligence/issues/20-public-vault-split-leak-enforcement.md",
  ".scratch/instrument-intelligence/issues/21-split-manifest-attempt-ledger-inherited-regressions.md",
  ".scratch/instrument-intelligence/issues/22-qualification-scopes-roles-provider-policy.md",
  ".scratch/instrument-intelligence/issues/35-independent-observable-evaluator-contracts.md",
  ".scratch/instrument-intelligence/issues/57-reassessment-governed-learning-proposals.md",
  ".scratch/instrument-intelligence/issues/58-workbench-advisory-deletion-resume-regeneration.md",
  ".scratch/instrument-intelligence/issues/60-cross-domain-evaluator-parity-closure.md",
  ".scratch/instrument-intelligence/issues/63-pre-hitl-audit-curation-package-interlock.md",
  ".scratch/instrument-intelligence/issues/64-independent-curator-precommit.md",
  ".scratch/instrument-intelligence/issues/65-baroque-guitar-physical-player-review.md",
  ".scratch/instrument-intelligence/issues/66-baroque-lute-physical-player-review.md",
  ".scratch/instrument-intelligence/issues/67-classical-guitar-physical-player-review.md",
  ".scratch/instrument-intelligence/issues/68-metadata-rights-review.md",
  ".scratch/instrument-intelligence/issues/69-review-round-aggregation-remediation-routing.md",
  ".scratch/instrument-intelligence/issues/70-clean-baseline-release-floor-publication.md",
  ".scratch/instrument-intelligence/issues/71-early-evaluator-private-leak-canaries.md",
  ".scratch/instrument-intelligence/issues/72-search-measurement-selection-adoption-foundation.md",
  ".scratch/instrument-intelligence/issues/73-sanz-ingestion-cited-extraction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/74-corbetta-ingestion-cited-extraction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/75-gasparini-ingestion-cited-extraction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/76-baron-ingestion-cited-extraction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/77-perrine-ingestion-cited-extraction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/78-weiss-ingestion-cited-extraction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/79-sor-text-plates-ingestion-test-only-release.md",
  ".scratch/instrument-intelligence/issues/80-carulli-aligned-reduction-test-only-release.md",
  ".scratch/instrument-intelligence/issues/81-post-qualification-exact-artifact-package.md",
  ".scratch/instrument-intelligence/issues/82-independent-truth-commitments.md",
  ".scratch/instrument-intelligence/issues/83-automatic-sealed-qualification-run.md",
  ".scratch/instrument-intelligence/issues/84-qualification-adjudication-remediation-dispatch.md",
  ".scratch/instrument-intelligence/issues/85-machine-complete-aggregator.md",
  ".scratch/instrument-intelligence/issues/86-optional-provisional-stop-decision.md",
  ".scratch/instrument-intelligence/issues/87-release-complete-aggregator.md",
  ".scratch/instrument-intelligence/issues/88-baroque-guitar-idiom-historical-review.md",
  ".scratch/instrument-intelligence/issues/89-baroque-lute-idiom-historical-review.md",
  ".scratch/instrument-intelligence/issues/90-classical-guitar-idiom-review.md",
  ".scratch/instrument-intelligence/issues/91-continuo-exact-artifact-review.md",
  ".scratch/instrument-intelligence/issues/92-imitative-intabulation-exact-artifact-review.md",
  ".scratch/instrument-intelligence/issues/93-engraving-playback-editorial-review.md",
  ".scratch/instrument-intelligence/issues/94-conditional-lyric-underlay-review.md",
  ".scratch/instrument-intelligence/issues/95-owner-cross-target-usefulness-review.md",
  ".scratch/instrument-intelligence/issues/96-rights-deletion-derivative-purge.md",
  ".scratch/instrument-intelligence/issues/97-interruption-reload-resume.md",
  ".scratch/instrument-intelligence/issues/98-legacy-inspection-canonical-regeneration.md",
  ".scratch/instrument-intelligence/issues/99-interactive-selection-prompt-edit-versioning.md",
  clauseLedgerRepoPath,
  "scripts/lib/instrument-intelligence-clause-ledger.mjs",
  "scripts/lib/instrument-intelligence-receipts.mjs",
  "scripts/lib/instrument-intelligence-results.mjs",
  "scripts/generate-instrument-intelligence-clause-ledger.mjs",
  "scripts/verify-instrument-intelligence-plan.mjs",
  clauseLedgerSchemaRepoPath,
  evidenceSchemaRepoPath,
  startReceiptSchemaRepoPath,
  "test/instrument-intelligence/T01-clause-ledger.test.ts",
  "test/instrument-intelligence/T01-governing-contract-baseline-guard.test.ts",
  "test/instrument-intelligence/receipt-contract.test.ts",
  "test/instrument-intelligence/result-contract.test.ts",
]);
const domainAdrFiles = readdirSync(path.join(root, "docs/adr"))
  .filter((name) => name.endsWith(".md"))
  .sort();
const domainAuthorityPaths = [
  ".scratch/README.md",
  ".scratch/instrument-intelligence/README.md",
  "AGENTS.md",
  "CONTEXT.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
  ...domainAdrFiles.map((name) => `docs/adr/${name}`),
];
const localReadSnapshots = new Map();

function fail(message) {
  throw new Error(`Instrument Intelligence plan verification failed: ${message}`);
}

function readLocalBytes(file) {
  if (localReadSnapshots.has(file)) return localReadSnapshots.get(file).bytes;
  const absolute = path.join(root, file);
  if (!existsSync(absolute)) fail(`required local file is missing: ${file}`);
  const info = lstatSync(absolute);
  if (info.isSymbolicLink() || !info.isFile()) {
    fail(`governed local path must be a regular file: ${file}`);
  }
  const snapshot = {
    bytes: readFileSync(absolute),
    mode: info.mode & 0o777,
  };
  localReadSnapshots.set(file, snapshot);
  return snapshot.bytes;
}

function text(file) {
  return readLocalBytes(file).toString("utf8");
}

function assertLocalReadSetUnchanged(issueNames) {
  const currentIssueNames = readdirSync(issueRoot)
    .filter((file) => /^\d+-.*\.md$/.test(file))
    .sort((left, right) => Number(left.match(/^\d+/)[0]) - Number(right.match(/^\d+/)[0]));
  const currentAdrFiles = readdirSync(path.join(root, "docs/adr"))
    .filter((name) => name.endsWith(".md"))
    .sort();
  if (
    JSON.stringify(currentIssueNames) !== JSON.stringify(issueNames) ||
    JSON.stringify(currentAdrFiles) !== JSON.stringify(domainAdrFiles)
  ) {
    fail("the governed issue or ADR path set changed during verification");
  }
  for (const [file, snapshot] of localReadSnapshots) {
    const absolute = path.join(root, file);
    if (!existsSync(absolute)) fail(`${file} changed or disappeared during verification`);
    const info = lstatSync(absolute);
    if (
      info.isSymbolicLink() ||
      !info.isFile() ||
      (info.mode & 0o777) !== snapshot.mode ||
      !readFileSync(absolute).equals(snapshot.bytes)
    ) {
      fail(`${file} changed during verification; retry from a stable worktree`);
    }
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function authorityBundleDigest(paths, readBytes) {
  const hash = createHash("sha256");
  for (const governedPath of paths) {
    hash.update(governedPath);
    hash.update("\0");
    hash.update(readBytes(governedPath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function exactKeys(value, expectedKeys, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${context} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.join(",") !== expected.join(",")) {
    fail(`${context} must contain exactly: ${expected.join(", ")}`);
  }
}

function validDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function supportedManifest(value) {
  return (
    value?.schemaVersion === BOOTSTRAP_MANIFEST_SCHEMA ||
    value?.schemaVersion === CURRENT_MANIFEST_SCHEMA
  );
}

function planNarrativeDigestFor(markdown) {
  return digest(
    markdown
      .split("\n")
      .filter((line) => !/^\|\s*\d+\s*\|/.test(line))
      .join("\n")
      .trimEnd()
  );
}

function gateCommands(gateMatrix, label) {
  const value = gateMatrix.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"))?.[1] ?? "";
  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function gitBytesAt(ref, file, { required = true } = {}) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      cwd: root,
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    if (required) fail(`${ref} does not contain required committed path ${file}`);
    return null;
  }
}

function gitJsonAt(ref, file, options) {
  const bytes = gitBytesAt(ref, file, options);
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${ref}:${file} is not valid JSON`);
  }
}

function requireCommittedRegularFile(ref, file) {
  let output;
  try {
    output = execFileSync("git", ["ls-tree", ref, "--", file], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    fail(`cannot inspect committed mode for ${ref}:${file}`);
  }
  const mode = output.match(/^(\d+)\s+blob\s+/)?.[1];
  if (!new Set(["100644", "100755"]).has(mode)) {
    fail(`${ref}:${file} must be a regular committed blob, never a symlink`);
  }
}

function singleParent(commit, context) {
  try {
    const parts = execFileSync("git", ["rev-list", "--parents", "-n", "1", commit], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\s+/);
    if (parts.length !== 2) fail(`${context} must be one focused non-merge commit`);
    return parts[1];
  } catch (error) {
    if (error?.message?.startsWith("Instrument Intelligence plan verification failed:")) {
      throw error;
    }
    fail(`cannot inspect ${context} lineage`);
  }
}

function changedPaths(commit) {
  try {
    return execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", commit], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
  } catch {
    fail(`cannot inspect changed paths for ${commit}`);
  }
}

function gitFilesUnder(ref, directory) {
  try {
    return execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", ref, "--", directory], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    fail(`cannot inspect committed evidence directory ${ref}:${directory}`);
  }
}

function projectedProductTreeDigestAt(ref) {
  let output;
  try {
    output = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", ref], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    fail(`cannot inspect the projected product tree at ${ref}`);
  }
  const records = output
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const match = record.match(/^(\d+)\s+(\w+)\s+([a-f0-9]+)\t(.+)$/);
      if (!match) fail(`cannot parse projected product tree record at ${ref}`);
      return { mode: match[1], type: match[2], object: match[3], path: match[4] };
    })
    .filter(
      (entry) =>
        entry.path !== manifestRepoPath &&
        !entry.path.startsWith(".scratch/instrument-intelligence/evidence/")
    );
  return digest(JSON.stringify(records));
}

function recursiveFiles(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    const absolute = path.join(directory, name);
    const info = lstatSync(absolute);
    if (info.isSymbolicLink()) fail(`${path.relative(root, absolute)} must not be a symlink`);
    if (info.isDirectory()) output.push(...recursiveFiles(absolute));
    else if (info.isFile()) output.push(absolute);
    else fail(`${path.relative(root, absolute)} has an unsupported filesystem type`);
  }
  return output;
}

function manifestHasMutableProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Boolean(
    (value.executionGenerations ?? []).length ||
    (value.idPolicy?.tombstones ?? []).length ||
    Object.keys(value.requirementEvidence ?? {}).length ||
    Object.keys(value.clauseEvidence ?? {}).length ||
    (value.remediationObligations?.obligations ?? []).length ||
    (value.remediationObligations?.events ?? []).length ||
    value.closureState?.machineComplete === "pass" ||
    value.closureState?.releaseComplete === "pass" ||
    value.closureState?.provisionalStopped === true ||
    value.machineComplete === "pass" ||
    value.releaseComplete === "pass" ||
    (value.tracers ?? []).some(
      (tracer) =>
        tracer.implementationCommit ||
        tracer.remotePublicationReceipt ||
        tracer.evidenceGeneration > 0 ||
        tracer.currentExecutionGeneration != null ||
        tracer.issueCompletion === "complete" ||
        tracer.productAcceptance
    )
  );
}

function assertJsonPrefix(anchor, candidate, context) {
  if (!Array.isArray(anchor) || !Array.isArray(candidate) || candidate.length < anchor.length) {
    fail(`${context} must retain the origin/main array as an exact prefix`);
  }
  if (JSON.stringify(candidate.slice(0, anchor.length)) !== JSON.stringify(anchor)) {
    fail(`${context} rewrites origin/main history instead of appending`);
  }
}

function assertRequirementEvidenceExtension(anchor, candidate) {
  exactKeys(candidate, Object.keys(candidate), "requirementEvidence");
  for (const [requirementId, records] of Object.entries(anchor ?? {})) {
    if (!Object.hasOwn(candidate, requirementId)) {
      fail(`requirementEvidence removed anchored ${requirementId}`);
    }
    assertJsonPrefix(records, candidate[requirementId], `requirementEvidence.${requirementId}`);
  }
}

function originMainCommit() {
  try {
    return execFileSync("git", ["rev-parse", "origin/main"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    fail("origin/main is unavailable; fetch the trusted remote before verification");
  }
}

function optionalRefCommit(ref) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitObjectType(object) {
  if (!object) return null;
  try {
    return execFileSync("git", ["cat-file", "-t", object], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function hashGitObject(bytes) {
  try {
    return execFileSync("git", ["hash-object", "--stdin"], {
      cwd: root,
      input: bytes,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    fail("cannot compute the closed publication-policy object identity");
  }
}

function originRemoteUrls() {
  let fetchUrls;
  let pushUrls;
  try {
    fetchUrls = execFileSync("git", ["remote", "get-url", "--all", "origin"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    pushUrls = execFileSync("git", ["remote", "get-url", "--push", "--all", "origin"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    fail("origin effective fetch/push identity is unavailable");
  }
  try {
    return assertPinnedRemoteIdentity({ fetchUrls, pushUrls });
  } catch (error) {
    fail(error.message);
  }
}

function githubPublicationHead() {
  const forbiddenOverrides = [
    "GH_HTTP_UNIX_SOCKET",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ].filter((name) => process.env[name]);
  if (forbiddenOverrides.length) {
    fail(
      `GitHub head attestation refuses transport override ${forbiddenOverrides.sort().join(", ")}`
    );
  }
  const repository = INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY;
  let configuredSocket;
  try {
    configuredSocket = execFileSync(
      "gh",
      ["config", "get", "http_unix_socket", "--host", repository.host],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 10_000,
      }
    ).trim();
  } catch {
    fail("cannot inspect GitHub CLI transport configuration before head attestation");
  }
  if (configuredSocket) {
    fail("GitHub head attestation refuses configured http_unix_socket transport override");
  }
  const query = `query { repository(owner: \"${repository.owner}\", name: \"${repository.name}\") { id databaseId nameWithOwner ref(qualifiedName: \"${repository.branch}\") { name target { __typename oid } } } }`;
  let parsed;
  try {
    const output = execFileSync(
      "gh",
      ["api", "graphql", "--hostname", repository.host, "-f", `query=${query}`],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, GH_PROMPT_DISABLED: "1" },
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      }
    );
    parsed = JSON.parse(output);
  } catch {
    fail(
      "cannot independently attest github.com/jefffm/vellum main through authenticated GitHub GraphQL"
    );
  }
  const result = parsed?.data?.repository;
  try {
    return assertPinnedGitHubAttestation({
      nodeId: result?.id,
      databaseId: result?.databaseId,
      nameWithOwner: result?.nameWithOwner,
      refName: result?.ref?.name,
      targetType: result?.ref?.target?.__typename,
      oid: result?.ref?.target?.oid,
    });
  } catch (error) {
    fail(error.message);
  }
}

function firstParentRowsBetween(ancestor, descendant) {
  if (!ancestor || ancestor === descendant) return [];
  try {
    return execFileSync(
      "git",
      ["rev-list", "--first-parent", "--parents", `${ancestor}..${descendant}`],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split(/\s+/));
  } catch {
    fail("cannot inspect the first-parent publication range");
  }
}

function isFirstParentAncestor(ancestor, descendant) {
  try {
    return execFileSync("git", ["rev-list", "--first-parent", descendant], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .includes(ancestor);
  } catch {
    return false;
  }
}

function advanceTrustedPublicationCheckpoint({
  newCommit,
  oldCommit,
  bootstrapAnchor,
  policyObject,
}) {
  try {
    updatePublicationCheckpoint({
      cwd: root,
      newCommit,
      oldCommit,
      bootstrapAnchor,
      policyObject,
    });
  } catch {
    fail("could not atomically advance all Owner-local publication checkpoint refs");
  }
}

function refreshOriginMain() {
  try {
    execFileSync(
      "git",
      ["fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main"],
      {
        cwd: root,
        stdio: "ignore",
      }
    );
  } catch {
    fail("cannot refresh origin/main; refusing verification against a stale remote-tracking ref");
  }
}

function manifestChangingCommits(ref) {
  try {
    return execFileSync(
      "git",
      ["log", "--first-parent", "--format=%H", ref, "--", manifestRepoPath],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    fail(`cannot inspect ${ref} manifest history`);
  }
}

function manifestCommitAtOrBefore(commit) {
  if (!commit) return null;
  try {
    return (
      execFileSync("git", ["rev-list", "--first-parent", "-1", commit, "--", manifestRepoPath], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || null
    );
  } catch {
    fail(`cannot locate the governed manifest at or before ${commit}`);
  }
}

const publicationTrustAtRead = originRemoteUrls();
const expectedTrustPolicyObject = hashGitObject(canonicalPublicationTrustBytes());
const trustedOriginCommitAtRead = optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF);
const bootstrapAnchorAtRead = optionalRefCommit(INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF);
const trustPolicyObjectAtRead = optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF);
if (
  (trustedOriginCommitAtRead && gitObjectType(trustedOriginCommitAtRead) !== "commit") ||
  (bootstrapAnchorAtRead && gitObjectType(bootstrapAnchorAtRead) !== "commit") ||
  (trustPolicyObjectAtRead && gitObjectType(trustPolicyObjectAtRead) !== "blob")
) {
  fail("the Owner-local publication checkpoint refs target an invalid Git object type");
}
let checkpointEstablishedAtRead;
try {
  checkpointEstablishedAtRead = assertCheckpointState({
    trustedCommit: trustedOriginCommitAtRead,
    bootstrapAnchor: bootstrapAnchorAtRead,
    policyObject: trustPolicyObjectAtRead,
    expectedPolicyObject: expectedTrustPolicyObject,
    isFirstParentAncestor,
  });
} catch (error) {
  fail(error.message);
}
const originMainBeforeFetch = optionalRefCommit("refs/remotes/origin/main");
refreshOriginMain();
const originMainCommitAtRead = originMainCommit();
const attestedOriginMainAtRead = draftMode ? null : githubPublicationHead();
if (attestedOriginMainAtRead) {
  try {
    assertAttestedPublicationHead({
      fetchedCommit: originMainCommitAtRead,
      attestedCommit: attestedOriginMainAtRead,
    });
  } catch (error) {
    fail(error.message);
  }
}
try {
  assertMonotonicPublication({
    trustedCommit: trustedOriginCommitAtRead,
    checkpointEstablished: checkpointEstablishedAtRead,
    observedBeforeFetch: originMainBeforeFetch,
    fetchedCommit: originMainCommitAtRead,
    isFirstParentAncestor,
    firstParentRows: firstParentRowsBetween(trustedOriginCommitAtRead, originMainCommitAtRead),
  });
} catch (error) {
  fail(error.message);
}
const originManifestBytes = gitBytesAt("origin/main", manifestRepoPath, { required: false });
const originManifest = originManifestBytes
  ? gitJsonAt("origin/main", manifestRepoPath, { required: true })
  : null;
const compatibleOriginManifest = supportedManifest(originManifest) ? originManifest : null;
if (!compatibleOriginManifest && manifestHasMutableProgress(originManifest)) {
  fail("origin/main has mutable evidence in an unsupported manifest schema; migrate it explicitly");
}
const originManifestChangingCommits = manifestChangingCommits("origin/main");
const currentManifestChangingCommit = originManifestChangingCommits[0] ?? null;
const priorManifestChangingCommit = originManifestChangingCommits[1] ?? null;
if (
  currentManifestChangingCommit &&
  !gitBytesAt(currentManifestChangingCommit, manifestRepoPath, { required: false })
) {
  fail("the current manifest-changing revision deleted the governed manifest path");
}
const priorOriginManifest = priorManifestChangingCommit
  ? gitJsonAt(priorManifestChangingCommit, manifestRepoPath, { required: true })
  : null;
const checkpointSteadyAtRead = Boolean(
  checkpointEstablishedAtRead && trustedOriginCommitAtRead === originMainCommitAtRead
);
const trustedManifestCommitAtRead = checkpointEstablishedAtRead
  ? manifestCommitAtOrBefore(trustedOriginCommitAtRead)
  : null;
if (checkpointEstablishedAtRead && trustedManifestCommitAtRead !== trustedOriginCommitAtRead) {
  fail("trusted-main must identify the exact strictly verified manifest transaction");
}
const transitionAnchorCommit = draftMode
  ? originMainCommitAtRead
  : checkpointEstablishedAtRead
    ? trustedOriginCommitAtRead
    : priorManifestChangingCommit;
const rawTransitionAnchorManifest = transitionAnchorCommit
  ? gitJsonAt(transitionAnchorCommit, manifestRepoPath, { required: true })
  : null;
const compatibleTransitionAnchorManifest = supportedManifest(rawTransitionAnchorManifest)
  ? rawTransitionAnchorManifest
  : null;
if (
  rawTransitionAnchorManifest &&
  !compatibleTransitionAnchorManifest &&
  (rawTransitionAnchorManifest.schemaVersion !== 1 ||
    manifestHasMutableProgress(rawTransitionAnchorManifest))
) {
  fail(
    "the trusted transition anchor is neither a supported manifest nor an unprogressed schema-1 bootstrap"
  );
}

function scalar(markdown, label) {
  return markdown.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

function section(markdown, heading) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  let remainder = markdown.slice(start + marker.length);
  if (remainder.startsWith("\r\n")) remainder = remainder.slice(2);
  else if (remainder.startsWith("\n")) remainder = remainder.slice(1);
  const nextHeading = remainder.search(/\n## /);
  return (nextHeading < 0 ? remainder : remainder.slice(0, nextHeading)).trim();
}

function expandNumberTokens(value, context, { allowDynamic = false } = {}) {
  const output = new Set();
  let dynamic = false;
  const tokens = value.split(",").map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    fail(`${context} contains an empty tracer token`);
  }
  for (const token of tokens) {
    if (token === "dynamic-remediation" && allowDynamic) {
      dynamic = true;
      continue;
    }
    const match = token.match(/^(\d+)(?:[–-](\d+))?$/);
    if (!match) fail(`${context} contains malformed tracer token: ${token}`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start > end) fail(`${context} contains descending tracer range: ${token}`);
    for (let current = start; current <= end; current += 1) output.add(current);
  }
  return { ids: [...output], dynamic };
}

function expandRequirementIds(value, context) {
  const output = new Set();
  const tokens = value.split(",").map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    fail(`${context} contains an empty requirement token`);
  }
  for (const token of tokens) {
    const match = token.match(/^(II-[A-Z]+-)(\d+)([A-Z]?)(?:[–-](\d+)([A-Z]?))?$/);
    if (!match) fail(`${context} contains malformed requirement token: ${token}`);
    const [, prefix, startText, startSuffix, endText, endSuffix] = match;
    if (startSuffix || endSuffix) {
      if (endText && startText !== endText) {
        fail(`${context} cannot expand a suffixed numeric range: ${token}`);
      }
      output.add(`${prefix}${startText}${startSuffix}`);
      if (endText) output.add(`${prefix}${endText}${endSuffix}`);
      continue;
    }
    const start = Number(startText);
    const end = Number(endText ?? startText);
    if (start > end) fail(`${context} contains descending requirement range: ${token}`);
    for (let current = start; current <= end; current += 1) {
      output.add(`${prefix}${String(current).padStart(startText.length, "0")}`);
    }
  }
  return [...output];
}

const predicateFields = new Set([
  "issueCompletion",
  "productAcceptance",
  "applicability",
  "comparison",
  "freshness",
  "compatibility",
  "authorityValidity",
  "resultCode",
]);
const predicateOperators = new Set(["eq", "neq", "in", "not_in"]);
const predicateGenerations = new Set(["current", "latest_or_absent"]);

function validatePredicate(node, context, references) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    fail(`${context} predicate node must be an object`);
  }
  const keys = Object.keys(node);
  if (keys.length === 1 && (keys[0] === "all" || keys[0] === "any")) {
    const children = node[keys[0]];
    if (!Array.isArray(children) || children.length === 0) {
      fail(`${context} ${keys[0]} predicate must contain at least one child`);
    }
    for (const child of children) validatePredicate(child, context, references);
    return;
  }
  const expectedKeys = ["expected", "field", "generation", "operator", "sourceTracer"];
  if (keys.sort().join(",") !== expectedKeys.sort().join(",")) {
    fail(`${context} predicate leaf has unexpected fields: ${keys.join(", ")}`);
  }
  if (!Number.isInteger(node.sourceTracer) || node.sourceTracer < 1) {
    fail(`${context} predicate sourceTracer must be a positive integer`);
  }
  if (!predicateGenerations.has(node.generation)) {
    fail(`${context} predicate has invalid generation selector: ${node.generation}`);
  }
  if (!predicateFields.has(node.field)) {
    fail(`${context} predicate has invalid field: ${node.field}`);
  }
  if (!predicateOperators.has(node.operator)) {
    fail(`${context} predicate has invalid operator: ${node.operator}`);
  }
  if (["in", "not_in"].includes(node.operator)) {
    if (!Array.isArray(node.expected) || node.expected.length === 0) {
      fail(`${context} ${node.operator} predicate requires a nonempty expected array`);
    }
  } else if (Array.isArray(node.expected) || node.expected === undefined) {
    fail(`${context} ${node.operator} predicate requires one scalar expected value`);
  }
  references.push({ tracerId: node.sourceTracer, generation: node.generation });
}

const allowedStatuses = new Set([
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
  "in-progress",
  "complete",
]);
const allowedTypes = new Set(["AFK", "HITL"]);
const allowedInitialEligibility = new Set(["eligible", "blocked", "conditional"]);
const allowedCompletion = new Set([
  "implementation-pass",
  "attempt-finalized",
  "decision-recorded",
  "closure-pass-required",
]);

const issueFiles = readdirSync(issueRoot)
  .filter((file) => /^\d+-.*\.md$/.test(file))
  .sort((left, right) => Number(left.match(/^\d+/)[0]) - Number(right.match(/^\d+/)[0]));

const issues = issueFiles.map((file) => {
  const absoluteFile = path.join(issueRoot, file);
  const issueRepoPath = `.scratch/instrument-intelligence/issues/${file}`;
  const markdown = readLocalBytes(issueRepoPath).toString("utf8");
  const id = Number(file.match(/^\d+/)[0]);
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const status = scalar(markdown, "Status");
  const type = scalar(markdown, "Type");
  const initialEligibility = scalar(markdown, "Initial execution eligibility");
  if (!initialEligibility && scalar(markdown, "Execution eligibility")) {
    fail(`${file} uses legacy Execution eligibility; rename it to Initial execution eligibility`);
  }
  const completionSemantics = scalar(markdown, "Completion semantics");
  const stories = scalar(markdown, "User stories");
  const requirementValue =
    scalar(markdown, "Requirement families touched") ?? scalar(markdown, "Requirement IDs");
  const blockedSection = section(markdown, "Blocked by");
  const blockedLines = blockedSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let blockedBy = [];
  if (blockedLines.length === 1 && blockedLines[0] === "None - can start immediately.") {
    blockedBy = [];
  } else {
    blockedBy = blockedLines.map((line) => {
      const match = line.match(/^- (\d+)$/);
      if (!match) fail(`${file} has malformed blocker line: ${line}`);
      return Number(match[1]);
    });
  }
  if (new Set(blockedBy).size !== blockedBy.length) fail(`${file} repeats a blocker ID`);

  const resultSection = section(markdown, "Dependency result predicates");
  const resultPredicateText = resultSection.match(/^Result predicate:\s*`(.+)`$/m)?.[1];
  let resultPredicate = null;
  const predicateReferences = [];
  if (resultSection) {
    if (!resultPredicateText) fail(`${file} has prose result predicates without typed JSON`);
    try {
      resultPredicate = JSON.parse(resultPredicateText);
    } catch (error) {
      fail(`${file} has invalid Result predicate JSON: ${error.message}`);
    }
    validatePredicate(resultPredicate, file, predicateReferences);
  }
  const resultPredicateExplanation = [...resultSection.matchAll(/^\s*-\s+(.+)$/gm)].map((match) =>
    match[1].trim()
  );

  const gateMatrix = section(markdown, "Gate matrix");
  const evidencePath = markdown.match(/Evidence:\s*`([^`]+)`/)?.[1];
  if (!title) fail(`${file} lacks a title`);
  if (!allowedStatuses.has(status)) fail(`${file} has invalid Status: ${status}`);
  if (!allowedTypes.has(type)) fail(`${file} has invalid Type: ${type}`);
  if (!allowedInitialEligibility.has(initialEligibility)) {
    fail(`${file} has invalid or missing Initial execution eligibility: ${initialEligibility}`);
  }
  if (!allowedCompletion.has(completionSemantics)) {
    fail(`${file} has invalid or missing Completion semantics: ${completionSemantics}`);
  }
  if (type === "AFK" && status === "ready-for-human") fail(`${file} is AFK but ready-for-human`);
  if (type === "HITL" && status === "ready-for-agent") fail(`${file} is HITL but ready-for-agent`);
  if (!stories) fail(`${file} lacks User stories`);
  if (!requirementValue) fail(`${file} lacks Requirement families touched`);
  for (const requiredHeading of [
    "What to build",
    "Acceptance criteria",
    "Gate matrix",
    "Public/Vault boundary",
    "Blocked by",
  ]) {
    if (!section(markdown, requiredHeading)) fail(`${file} lacks nonempty ${requiredHeading}`);
  }
  if (!evidencePath) fail(`${file} lacks a backticked Evidence path`);
  const expectedEvidenceAbsolute = path.resolve(
    waveRoot,
    "evidence",
    `T${String(id).padStart(2, "0")}`,
    "verification.json"
  );
  const evidenceAbsolute = path.resolve(path.dirname(absoluteFile), evidencePath);
  if (evidenceAbsolute !== expectedEvidenceAbsolute) {
    fail(
      `${file} evidence path is noncanonical or traverses outside tracer T${id}: ${evidencePath}`
    );
  }
  if (blockedBy.length === 0 && initialEligibility === "blocked") {
    fail(`${file} is blocked without a dependency; use conditional for an optional branch`);
  }

  const dependencyPredicate = {
    all: blockedBy.map((sourceTracer) => ({
      sourceTracer,
      generation: "current",
      field: "issueCompletion",
      operator: "eq",
      expected: "complete",
    })),
  };

  return {
    id,
    file: issueRepoPath,
    title,
    status,
    type,
    initialEligibility,
    completionSemantics,
    stories,
    requirementIds: expandRequirementIds(requirementValue, file),
    blockedBy,
    dependencyPredicate,
    resultPredicate,
    resultPredicateExplanation,
    predicateReferences,
    evidencePath: path.relative(root, evidenceAbsolute).split(path.sep).join(path.posix.sep),
    gateMatrixDigest: digest(gateMatrix),
    expectedGateCommands: {
      focused: gateCommands(gateMatrix, "Focused"),
      base: gateCommands(gateMatrix, "Base"),
      conditional: gateCommands(gateMatrix, "Conditional"),
    },
    definitionDigest: digest(markdown),
  };
});

const strictGovernedPaths = new Set([
  "SPEC.md",
  ".scratch/instrument-intelligence/PLAN.md",
  ".scratch/instrument-intelligence/REQUIREMENTS.md",
  clauseLedgerRepoPath,
  ".scratch/instrument-intelligence/evidence/.gitkeep",
  manifestRepoPath,
  ...verificationAuthorityPaths,
  ...domainAuthorityPaths,
  ...issues.map((issue) => issue.file),
]);
const strictExpectedDigests = new Map();

const byId = new Map();
for (const issue of issues) {
  if (byId.has(issue.id)) fail(`duplicate tracer ID ${issue.id}`);
  byId.set(issue.id, issue);
}
if (byId.get(1)?.initialEligibility !== "eligible") {
  fail("T1 must be the sole initially eligible bootstrap tracer");
}
for (const issue of issues) {
  if (issue.id !== 1 && issue.initialEligibility === "eligible") {
    fail(`T${issue.id} cannot be initially eligible; runtime predicates must advance it`);
  }
}
for (const issue of issues) {
  for (const blocker of issue.blockedBy) {
    if (!byId.has(blocker)) fail(`T${issue.id} references missing blocker T${blocker}`);
    if (blocker === issue.id) fail(`T${issue.id} blocks itself`);
  }
  for (const reference of issue.predicateReferences) {
    if (!byId.has(reference.tracerId)) {
      fail(`T${issue.id} result predicate references missing T${reference.tracerId}`);
    }
    if (reference.tracerId === issue.id) fail(`T${issue.id} result predicate references itself`);
  }
}

const orderingDependencies = new Map(
  issues.map((issue) => [
    issue.id,
    [
      ...new Set([
        ...issue.blockedBy,
        ...issue.predicateReferences
          .filter((reference) => reference.generation === "current")
          .map((reference) => reference.tracerId),
      ]),
    ],
  ])
);
const visiting = new Set();
const visited = new Set();
function visit(id, pathIds = []) {
  if (visiting.has(id)) fail(`dependency/result cycle: ${[...pathIds, id].join(" -> ")}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const blocker of orderingDependencies.get(id)) visit(blocker, [...pathIds, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const id of byId.keys()) visit(id);

const requirementMarkdown = text(".scratch/instrument-intelligence/REQUIREMENTS.md");
const requirementRows = new Map();
for (const [index, line] of requirementMarkdown.split("\n").entries()) {
  if (!line.startsWith("|")) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (!/^II-[A-Z]+-\d+[A-Z]?$/.test(cells[0] ?? "")) continue;
  if (cells.length < 3) fail(`REQUIREMENTS.md:${index + 1} has no tracer mapping column`);
  if (requirementRows.has(cells[0])) fail(`REQUIREMENTS.md repeats ${cells[0]}`);
  const mapping = expandNumberTokens(cells[2], `REQUIREMENTS.md:${index + 1}`, {
    allowDynamic: true,
  });
  requirementRows.set(cells[0], mapping);
  for (const tracerId of mapping.ids) {
    if (!byId.has(tracerId)) fail(`${cells[0]} maps to missing tracer T${tracerId}`);
  }
}
for (const issue of issues) {
  for (const requirementId of issue.requirementIds) {
    if (!requirementRows.has(requirementId)) {
      fail(`${issue.file} references unknown requirement ${requirementId}`);
    }
  }
}

const clauseLedgerRaw = text(clauseLedgerRepoPath);
let clauseLedger;
try {
  clauseLedger = assertCanonicalClauseLedgerJson(clauseLedgerRaw);
  const regeneratedClauseLedger = buildClauseLedger({
    ...loadClauseLedgerInputs(root),
    previousLedger: clauseLedger,
    requireMarkers: true,
  });
  if (canonicalClauseLedgerJson(regeneratedClauseLedger) !== clauseLedgerRaw) {
    fail("the committed clause ledger is stale against SPEC, REQUIREMENTS, or issue mappings");
  }
  assertMarkerBijection(text("SPEC.md"), clauseLedger);
} catch (error) {
  if (error?.message?.startsWith("Instrument Intelligence plan verification failed:")) {
    throw error;
  }
  fail(`closed clause-ledger validation failed: ${error.message}`);
}
const clauseById = new Map(clauseLedger.clauses.map((clause) => [clause.id, clause]));
for (const clause of clauseLedger.clauses) {
  const family = requirementRows.get(clause.familyId);
  const roleTracerIds = [clause.implementationOwner, ...clause.evidenceContributors].map((tracer) =>
    Number(tracer.slice(1))
  );
  if (
    !family ||
    roleTracerIds.some((tracerId) => !family.ids.includes(tracerId)) ||
    !["T85", "T87"].includes(clause.closureVerifier) ||
    clause.evidenceContributors.includes(clause.closureVerifier) ||
    clause.implementationOwner === clause.closureVerifier
  ) {
    fail(`${clause.id} has a non-bidirectional or role-conflicted clause assignment`);
  }
  for (const dependencyId of clause.dependencies) {
    if (!clauseById.has(dependencyId) || dependencyId === clause.id) {
      fail(`${clause.id} has an unknown or self-referential clause dependency`);
    }
  }
}

const planMarkdown = text(".scratch/instrument-intelligence/PLAN.md");
const planRows = new Map();
for (const [index, line] of planMarkdown.split("\n").entries()) {
  if (!/^\|\s*\d+\s*\|/.test(line)) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 5) fail(`PLAN.md:${index + 1} must contain exactly five cells`);
  const id = Number(cells[0]);
  if (planRows.has(id)) fail(`PLAN.md repeats T${id}`);
  let blockers = [];
  if (cells[3] !== "—") {
    const tokens = cells[3].split(",").map((token) => token.trim());
    blockers = tokens.map((token) => {
      const match = token.match(/^T(\d+)$/);
      if (!match) fail(`PLAN.md:${index + 1} has malformed blocker token: ${token}`);
      return Number(match[1]);
    });
  }
  planRows.set(id, { title: cells[1], type: cells[2], blockers, stories: cells[4] });
}
for (const issue of issues) {
  const row = planRows.get(issue.id);
  if (!row) fail(`PLAN.md omits T${issue.id}`);
  if (row.title !== issue.title) fail(`PLAN.md title differs for T${issue.id}`);
  if (row.type !== issue.type) fail(`PLAN.md type differs for T${issue.id}`);
  if (row.blockers.join(",") !== issue.blockedBy.join(",")) {
    fail(`PLAN.md blockers differ for T${issue.id}`);
  }
  if (row.stories !== issue.stories) fail(`PLAN.md stories differ for T${issue.id}`);
}
for (const id of planRows.keys()) if (!byId.has(id)) fail(`PLAN.md references missing T${id}`);

if (!byId.has(87)) fail("Release Complete tracer T87 is missing");
const dependents = new Map(issues.map((issue) => [issue.id, []]));
for (const [id, dependencies] of orderingDependencies) {
  for (const dependency of dependencies) dependents.get(dependency).push(id);
}
function reachesRelease(start) {
  const queue = [start];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (current === 87) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...dependents.get(current));
  }
  return false;
}
const existingManifest = existsSync(manifestPath)
  ? JSON.parse(readLocalBytes(manifestRepoPath).toString("utf8"))
  : undefined;
const existingManifestDigestAtRead = existingManifest
  ? digest(JSON.stringify(existingManifest))
  : null;
const compatibleExistingManifest = supportedManifest(existingManifest)
  ? existingManifest
  : undefined;
const t01PreregistrationTransition = Boolean(
  !draftMode &&
  checkpointEstablishedAtRead &&
  !checkpointSteadyAtRead &&
  compatibleTransitionAnchorManifest?.schemaVersion === BOOTSTRAP_MANIFEST_SCHEMA &&
  compatibleExistingManifest?.schemaVersion === CURRENT_MANIFEST_SCHEMA
);
if (
  compatibleTransitionAnchorManifest?.schemaVersion === CURRENT_MANIFEST_SCHEMA &&
  compatibleExistingManifest?.schemaVersion !== CURRENT_MANIFEST_SCHEMA
) {
  fail("the Instrument Intelligence manifest cannot downgrade after T01 pre-registration");
}
if (
  !draftMode &&
  checkpointEstablishedAtRead &&
  !checkpointSteadyAtRead &&
  compatibleTransitionAnchorManifest?.schemaVersion === BOOTSTRAP_MANIFEST_SCHEMA &&
  compatibleExistingManifest?.schemaVersion !== CURRENT_MANIFEST_SCHEMA
) {
  fail("the sole post-bootstrap schema-5 transition must be T01 schema-6 pre-registration");
}
const staticBaseWaveHighestId =
  compatibleTransitionAnchorManifest?.idPolicy?.baseWaveHighestId ??
  Math.max(...issues.map((issue) => issue.id));
for (const issue of issues) {
  if (
    issue.id <= staticBaseWaveHighestId &&
    issue.initialEligibility !== "conditional" &&
    !reachesRelease(issue.id)
  ) {
    fail(`required T${issue.id} has no dependency/result path to Release Complete T87`);
  }
}
const rawExistingHasProgress = manifestHasMutableProgress(existingManifest);
const preTrustCorrectionCandidate = Boolean(
  !trustedOriginCommitAtRead &&
  !checkpointEstablishedAtRead &&
  compatibleTransitionAnchorManifest &&
  !manifestHasMutableProgress(compatibleTransitionAnchorManifest) &&
  !rawExistingHasProgress
);
if (
  compatibleExistingManifest &&
  !preTrustCorrectionCandidate &&
  JSON.stringify(compatibleExistingManifest.publicationTrust) !==
    JSON.stringify(INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST)
) {
  fail("completion manifest does not bind the closed Owner-local publication trust policy");
}
if (existingManifest && !compatibleExistingManifest && rawExistingHasProgress) {
  fail(
    "manifest schema migration would discard mutable evidence; T01 must perform a governed state migration"
  );
}
if (rawTransitionAnchorManifest?.schemaVersion === 1) {
  const transitionAnchorIndex = draftMode ? 0 : 1;
  for (const olderCommit of originManifestChangingCommits.slice(transitionAnchorIndex + 1)) {
    const olderManifest = gitJsonAt(olderCommit, manifestRepoPath, { required: true });
    if (olderManifest?.schemaVersion === 5) {
      fail("schema-1-to-5 bootstrap is one-time; earlier schema-5 history cannot be reset");
    }
  }
}
if (!compatibleTransitionAnchorManifest && rawExistingHasProgress) {
  fail("the schema-5 bootstrap commit cannot introduce mutable execution or closure progress");
}
if (compatibleTransitionAnchorManifest) {
  if (!compatibleExistingManifest) {
    fail("the working manifest cannot downgrade the schema anchored by the trusted transition");
  }
  if (!preTrustCorrectionCandidate) {
    assertJsonPrefix(
      compatibleTransitionAnchorManifest.idPolicy?.registryEvents ?? [],
      compatibleExistingManifest.idPolicy?.registryEvents ?? [],
      "idPolicy.registryEvents"
    );
  }
  assertJsonPrefix(
    compatibleTransitionAnchorManifest.executionGenerations ?? [],
    compatibleExistingManifest.executionGenerations ?? [],
    "executionGenerations"
  );
  assertJsonPrefix(
    compatibleTransitionAnchorManifest.stateEdges ?? [],
    compatibleExistingManifest.stateEdges ?? [],
    "stateEdges"
  );
  const candidateTombstones = new Map(
    (compatibleExistingManifest.idPolicy?.tombstones ?? []).map((record) => [record.id, record])
  );
  for (const tombstone of compatibleTransitionAnchorManifest.idPolicy?.tombstones ?? []) {
    if (JSON.stringify(candidateTombstones.get(tombstone.id)) !== JSON.stringify(tombstone)) {
      fail(`anchored tombstone T${tombstone.id} was removed or mutated`);
    }
  }
  assertRequirementEvidenceExtension(
    compatibleTransitionAnchorManifest.requirementEvidence ?? {},
    compatibleExistingManifest.requirementEvidence ?? {}
  );
  assertRequirementEvidenceExtension(
    compatibleTransitionAnchorManifest.clauseEvidence ?? {},
    compatibleExistingManifest.clauseEvidence ?? {}
  );
  assertJsonPrefix(
    compatibleTransitionAnchorManifest.authorityHistory?.authoritySets ?? [],
    compatibleExistingManifest.authorityHistory?.authoritySets ?? [],
    "authorityHistory.authoritySets"
  );
  assertJsonPrefix(
    compatibleTransitionAnchorManifest.authorityHistory?.migrations ?? [],
    compatibleExistingManifest.authorityHistory?.migrations ?? [],
    "authorityHistory.migrations"
  );
  assertJsonPrefix(
    compatibleTransitionAnchorManifest.remediationObligations?.obligations ?? [],
    compatibleExistingManifest.remediationObligations?.obligations ?? [],
    "remediationObligations.obligations"
  );
  assertJsonPrefix(
    compatibleTransitionAnchorManifest.remediationObligations?.events ?? [],
    compatibleExistingManifest.remediationObligations?.events ?? [],
    "remediationObligations.events"
  );
  if (
    compatibleExistingManifest.idPolicy?.baseWaveHighestId !==
    compatibleTransitionAnchorManifest.idPolicy?.baseWaveHighestId
  ) {
    fail("baseWaveHighestId cannot change after the schema-5 registry is anchored");
  }
}
const candidateRegisteredIdList = compatibleExistingManifest?.idPolicy?.registeredTracerIds ?? [];
const candidateRegisteredIds = new Set(candidateRegisteredIdList);
if (
  candidateRegisteredIds.size !== candidateRegisteredIdList.length ||
  [...candidateRegisteredIds].some((id) => !Number.isInteger(id) || id < 1)
) {
  fail("registeredTracerIds must contain unique positive integers");
}
const sortedCandidateRegisteredIds = [...candidateRegisteredIds].sort(
  (left, right) => left - right
);
if (
  candidateRegisteredIds.size &&
  sortedCandidateRegisteredIds.join(",") !== candidateRegisteredIdList.join(",")
) {
  fail("registeredTracerIds must be sorted in ascending order");
}
const maximumCandidateRegisteredId = candidateRegisteredIds.size
  ? Math.max(...candidateRegisteredIds)
  : 0;
if (
  candidateRegisteredIds.size &&
  (compatibleExistingManifest?.idPolicy?.highestAllocatedId !== maximumCandidateRegisteredId ||
    compatibleExistingManifest?.idPolicy?.nextDynamicTracerId !== maximumCandidateRegisteredId + 1)
) {
  fail("highestAllocatedId/nextDynamicTracerId disagree with registeredTracerIds");
}
const previousIdList = compatibleTransitionAnchorManifest
  ? (compatibleTransitionAnchorManifest.idPolicy?.registeredTracerIds ?? [])
  : candidateRegisteredIdList;
const previousIds = new Set(previousIdList);
if (
  previousIds.size !== previousIdList.length ||
  [...previousIds].some((id) => !Number.isInteger(id) || id < 1)
) {
  fail("trusted registeredTracerIds must contain unique positive integers");
}
const sortedPreviousIds = [...previousIds].sort((left, right) => left - right);
if (sortedPreviousIds.join(",") !== previousIdList.join(",")) {
  fail("trusted registeredTracerIds must be sorted in ascending order");
}
const maximumPreviousId = previousIds.size ? Math.max(...previousIds) : 0;

function registryEventPayload(event) {
  const payload = {
    generation: event.generation,
    previousHead: event.previousHead,
    addedDefinitions: event.addedDefinitions,
    tombstonesAdded: event.tombstonesAdded,
  };
  if (Object.hasOwn(event, "revisedDefinitions")) {
    payload.revisedDefinitions = event.revisedDefinitions;
  }
  return payload;
}

function replayRegistryEvents(events) {
  const definitions = new Map();
  const replayedTombstones = new Map();
  let head = null;
  let generation = 0;
  let highest = 0;
  for (const event of events) {
    const eventKeys = [
      "addedDefinitions",
      "generation",
      "head",
      "previousHead",
      "tombstonesAdded",
      ...(Object.hasOwn(event ?? {}, "revisedDefinitions") ? ["revisedDefinitions"] : []),
    ];
    exactKeys(event, eventKeys, `registry event ${event?.generation}`);
    if (
      !event ||
      typeof event !== "object" ||
      Array.isArray(event) ||
      event.generation !== generation + 1 ||
      event.previousHead !== head ||
      !Array.isArray(event.addedDefinitions) ||
      (Object.hasOwn(event, "revisedDefinitions") && !Array.isArray(event.revisedDefinitions)) ||
      !Array.isArray(event.tombstonesAdded) ||
      !/^[a-f0-9]{64}$/.test(event.head ?? "")
    ) {
      fail("registryEvents contains an invalid generation or head link");
    }
    const idsBeforeEvent = new Set(definitions.keys());
    for (const tombstone of event.tombstonesAdded) {
      exactKeys(
        tombstone,
        [
          "definitionDigest",
          "definitionSnapshot",
          "id",
          "reason",
          "tombstonedAtRegistryGeneration",
        ],
        `registry tombstone T${tombstone?.id}`
      );
      if (
        !idsBeforeEvent.has(tombstone?.id) ||
        replayedTombstones.has(tombstone.id) ||
        tombstone.definitionDigest !== definitions.get(tombstone.id) ||
        tombstone.definitionSnapshot?.id !== tombstone.id ||
        tombstone.definitionSnapshot?.definitionDigest !== tombstone.definitionDigest ||
        typeof tombstone.reason !== "string" ||
        tombstone.reason.trim().length === 0 ||
        tombstone.tombstonedAtRegistryGeneration !== event.generation
      ) {
        fail(`registry event has an invalid tombstone transition for T${tombstone?.id}`);
      }
      replayedTombstones.set(tombstone.id, tombstone);
    }
    const revisedIds = new Set();
    for (const revision of event.revisedDefinitions ?? []) {
      exactKeys(
        revision,
        ["definitionDigest", "id", "previousDefinitionDigest", "reason"],
        "registry definition revision"
      );
      if (
        !definitions.has(revision?.id) ||
        replayedTombstones.has(revision.id) ||
        revisedIds.has(revision.id) ||
        definitions.get(revision.id) !== revision.previousDefinitionDigest ||
        !validDigest(revision.definitionDigest) ||
        revision.definitionDigest === revision.previousDefinitionDigest ||
        revision.reason !== "t01_clause_role_preregistration"
      ) {
        fail(`registry event has an invalid T01 definition revision for T${revision?.id}`);
      }
      revisedIds.add(revision.id);
      definitions.set(revision.id, revision.definitionDigest);
    }
    for (const definition of event.addedDefinitions) {
      exactKeys(definition, ["definitionDigest", "id"], "registry definition append");
      const expectedId = highest + 1;
      if (
        definition?.id !== expectedId ||
        !/^[a-f0-9]{64}$/.test(definition.definitionDigest ?? "") ||
        definitions.has(definition.id)
      ) {
        fail(`registry event must append the exact next definition T${expectedId}`);
      }
      definitions.set(definition.id, definition.definitionDigest);
      highest = definition.id;
    }
    const expectedHead = digest(JSON.stringify(registryEventPayload(event)));
    if (event.head !== expectedHead) fail(`registry event ${event.generation} has an invalid head`);
    head = event.head;
    generation = event.generation;
  }
  return { definitions, replayedTombstones, head, generation, highest };
}

const declaredRegistryEvents = compatibleExistingManifest?.idPolicy?.registryEvents;
const registryHistoryMissing =
  !Array.isArray(declaredRegistryEvents) || !declaredRegistryEvents.length;
if (registryHistoryMissing && rawExistingHasProgress) {
  fail("a progressed manifest cannot migrate without append-only registryEvents history");
}
const replayedRegistry = registryHistoryMissing
  ? {
      definitions: new Map(),
      replayedTombstones: new Map(),
      head: null,
      generation: 0,
      highest: 0,
    }
  : replayRegistryEvents(declaredRegistryEvents);
if (!registryHistoryMissing) {
  if (
    replayedRegistry.head !== compatibleExistingManifest.idPolicy.registryHead ||
    replayedRegistry.generation !== compatibleExistingManifest.idPolicy.registryGeneration ||
    replayedRegistry.highest !== maximumCandidateRegisteredId ||
    [...replayedRegistry.definitions.keys()].join(",") !== sortedCandidateRegisteredIds.join(",")
  ) {
    fail("registryEvents replay disagrees with the registered ID policy");
  }
}

const existingTracerById = new Map(
  ((compatibleTransitionAnchorManifest ?? compatibleExistingManifest)?.tracers ?? []).map(
    (tracer) => [tracer.id, tracer]
  )
);
function immutableDefinitionSnapshot(tracer) {
  return {
    id: tracer.id,
    file: tracer.file,
    title: tracer.title,
    status: tracer.status,
    type: tracer.type,
    initialEligibility: tracer.initialEligibility,
    completionSemantics: tracer.completionSemantics,
    stories: tracer.stories,
    requirementIds: tracer.requirementIds,
    blockedBy: tracer.blockedBy,
    dependencyPredicate: tracer.dependencyPredicate,
    resultPredicate: tracer.resultPredicate,
    resultPredicateExplanation: tracer.resultPredicateExplanation,
    evidencePath: tracer.evidencePath,
    gateMatrixDigest: tracer.gateMatrixDigest,
    expectedGateCommands: tracer.expectedGateCommands,
    definitionDigest: tracer.definitionDigest,
  };
}
const declaredTombstones = existingManifest?.idPolicy?.tombstones ?? [];
if (!Array.isArray(declaredTombstones)) fail("idPolicy.tombstones must be an array");
const anchorTombstones = new Map(
  (compatibleTransitionAnchorManifest?.idPolicy?.tombstones ?? []).map((record) => [
    record.id,
    record,
  ])
);
const anchorTombstoneRecordDigests =
  compatibleTransitionAnchorManifest?.idPolicy?.tombstoneRecordDigests ?? {};
const nextRegistryGeneration =
  (compatibleTransitionAnchorManifest?.idPolicy?.registryGeneration ?? 0) + 1;
const tombstoneIds = new Set();
const tombstones = declaredTombstones.map((tombstone) => {
  if (
    !Number.isInteger(tombstone?.id) ||
    tombstone.id < 1 ||
    !/^[a-f0-9]{64}$/.test(tombstone.definitionDigest ?? "") ||
    typeof tombstone.reason !== "string" ||
    tombstone.reason.trim().length === 0
  ) {
    fail(
      "every ID tombstone requires a positive id, exact prior definitionDigest, and nonempty reason"
    );
  }
  if (tombstoneIds.has(tombstone.id)) fail(`duplicate tombstone for T${tombstone.id}`);
  tombstoneIds.add(tombstone.id);
  if (byId.has(tombstone.id)) fail(`tombstoned T${tombstone.id} cannot be reused by an issue`);
  if (!previousIds.has(tombstone.id)) {
    fail(`tombstoned T${tombstone.id} was never a registered tracer ID`);
  }

  const anchoredTombstone = anchorTombstones.get(tombstone.id);
  if (anchoredTombstone) {
    exactKeys(
      tombstone,
      ["definitionDigest", "definitionSnapshot", "id", "reason", "tombstonedAtRegistryGeneration"],
      `established tombstone T${tombstone.id}`
    );
    if (JSON.stringify(tombstone) !== JSON.stringify(anchoredTombstone)) {
      fail(`anchored tombstone T${tombstone.id} was mutated`);
    }
    if (
      anchorTombstoneRecordDigests[String(tombstone.id)] !==
      digest(JSON.stringify(anchoredTombstone))
    ) {
      fail(`anchored tombstone T${tombstone.id} lacks its trusted registry binding`);
    }
    return anchoredTombstone;
  }

  const previousTracer = existingTracerById.get(tombstone.id);
  if (!previousTracer || previousTracer.definitionDigest !== tombstone.definitionDigest) {
    fail(`new tombstone T${tombstone.id} must bind the exact prior live definition digest`);
  }
  const canonicalTombstone = {
    id: tombstone.id,
    definitionDigest: tombstone.definitionDigest,
    definitionSnapshot: immutableDefinitionSnapshot(previousTracer),
    reason: tombstone.reason,
    tombstonedAtRegistryGeneration: nextRegistryGeneration,
  };
  const proposalKeys = Object.keys(tombstone).sort().join(",");
  const shortProposalKeys = ["definitionDigest", "id", "reason"].sort().join(",");
  const canonicalKeys = Object.keys(canonicalTombstone).sort().join(",");
  if (
    proposalKeys !== shortProposalKeys &&
    (proposalKeys !== canonicalKeys ||
      JSON.stringify(tombstone) !== JSON.stringify(canonicalTombstone))
  ) {
    fail(`new tombstone T${tombstone.id} is neither a short proposal nor its canonical record`);
  }
  const candidateRecordDigest =
    compatibleExistingManifest?.idPolicy?.tombstoneRecordDigests?.[String(tombstone.id)];
  if (
    candidateRecordDigest !== undefined &&
    candidateRecordDigest !== digest(JSON.stringify(canonicalTombstone))
  ) {
    fail(`new tombstone T${tombstone.id} has a contradictory candidate record digest`);
  }
  return canonicalTombstone;
});
if (
  tombstones.map(({ id }) => id).join(",") !==
  tombstones
    .map(({ id }) => id)
    .sort((left, right) => left - right)
    .join(",")
) {
  fail("idPolicy.tombstones must be sorted by tracer ID");
}
const establishedTombstones = tombstones.filter(
  (tombstone) => tombstone.tombstonedAtRegistryGeneration <= replayedRegistry.generation
);
function canonicalTombstones(values) {
  return [...values].sort((left, right) => left.id - right.id);
}
if (
  !registryHistoryMissing &&
  JSON.stringify(canonicalTombstones(replayedRegistry.replayedTombstones.values())) !==
    JSON.stringify(canonicalTombstones(establishedTombstones))
) {
  fail("registryEvents tombstone history disagrees with idPolicy.tombstones");
}
const tombstoneRecordDigests = Object.fromEntries(
  tombstones.map((tombstone) => [String(tombstone.id), digest(JSON.stringify(tombstone))])
);
const tombstoneSetDigest = digest(JSON.stringify(tombstones));
for (const previousId of previousIds) {
  if (!byId.has(previousId) && !tombstoneIds.has(previousId)) {
    fail(
      `registered T${previousId} was deleted; retain an explicit tombstone and never reuse its ID`
    );
  }
}
const previousHighest = maximumPreviousId;
const addedIds = issues.map((issue) => issue.id).filter((id) => !previousIds.has(id));
if (previousIds.size) {
  const expectedAdded = Array.from(
    { length: addedIds.length },
    (_, index) => previousHighest + index + 1
  );
  if (addedIds.join(",") !== expectedAdded.join(",")) {
    fail(`new tracer IDs must append contiguously after T${previousHighest}`);
  }
}

const planNarrativeDigest = planNarrativeDigestFor(planMarkdown);
const authorityInputs = {
  specification: { path: "SPEC.md", digest: digest(text("SPEC.md")) },
  plan: {
    path: ".scratch/instrument-intelligence/PLAN.md",
    digest: digest(planMarkdown),
    narrativeDigest: planNarrativeDigest,
  },
  requirementFamilyIndex: {
    path: ".scratch/instrument-intelligence/REQUIREMENTS.md",
    digest: digest(requirementMarkdown),
    clauseLedgerStatus: existsSync(path.join(root, clauseLedgerRepoPath))
      ? "active_v1"
      : (compatibleTransitionAnchorManifest?.authorities?.requirementFamilyIndex
          ?.clauseLedgerStatus ?? "bootstrap_pending_T01"),
  },
  requirementClauseLedger: {
    path: clauseLedgerRepoPath,
    digest: digest(clauseLedgerRaw),
    schemaPath: clauseLedgerSchemaRepoPath,
    schemaDigest: digest(readLocalBytes(clauseLedgerSchemaRepoPath)),
    clauseCount: clauseLedger.clauses.length,
  },
  protocolSchemas: {
    paths: protocolSchemaPaths,
    digest: authorityBundleDigest(protocolSchemaPaths, readLocalBytes),
    evidenceSchemaId: EVIDENCE_RECEIPT_SCHEMA_ID,
    startReceiptSchemaId: START_RECEIPT_SCHEMA_ID,
    authoritySnapshotSchemaId: AUTHORITY_SNAPSHOT_SCHEMA_ID,
  },
  resultPolicy: {
    digest: digest(JSON.stringify(TRACER_RESULT_CONTRACTS)),
    remediationLedgerSchemaId: REMEDIATION_LEDGER_SCHEMA_ID,
  },
  verifier: {
    paths: verificationAuthorityPaths,
    digest: authorityBundleDigest(verificationAuthorityPaths, readLocalBytes),
  },
  domainModel: {
    paths: domainAuthorityPaths,
    digest: authorityBundleDigest(domainAuthorityPaths, readLocalBytes),
  },
};
const currentAuthorityPaths = [
  "SPEC.md",
  ".scratch/instrument-intelligence/PLAN.md",
  ".scratch/instrument-intelligence/REQUIREMENTS.md",
  clauseLedgerRepoPath,
  ...verificationAuthorityPaths,
  ...domainAuthorityPaths,
]
  .filter((value, index, values) => values.indexOf(value) === index)
  .sort();
const currentAuthorityPathDigests = currentAuthorityPaths.map((governedPath) => ({
  path: governedPath,
  sha256: digest(readLocalBytes(governedPath)),
}));
const currentAuthoritySetDigest = digest(JSON.stringify(currentAuthorityPathDigests));
const currentAuthoritySet = {
  schemaId: AUTHORITY_SNAPSHOT_SCHEMA_ID,
  authoritySetDigest: currentAuthoritySetDigest,
  pathDigests: currentAuthorityPathDigests,
};
try {
  validateAuthoritySnapshotV2(currentAuthoritySet, "current authority set");
} catch (error) {
  fail(error.message);
}
if (
  authorityInputs.requirementFamilyIndex.clauseLedgerStatus === "bootstrap_pending_T01" &&
  rawExistingHasProgress
) {
  fail(
    "schema-5 bootstrap is execution-locked: T01 must first land and strictly verify the governed schema/ledger pre-registration transaction"
  );
}
if (authorityInputs.requirementFamilyIndex.clauseLedgerStatus === "bootstrap_pending_T01") {
  const bootstrapEvidenceFiles = recursiveFiles(path.join(waveRoot, "evidence")).map((absolute) =>
    path.relative(root, absolute).split(path.sep).join(path.posix.sep)
  );
  if (
    bootstrapEvidenceFiles.length !== 1 ||
    bootstrapEvidenceFiles[0] !== ".scratch/instrument-intelligence/evidence/.gitkeep"
  ) {
    fail(
      "bootstrap evidence is locked: T01 must install pending-evidence validation before any public receipt/artifact is added"
    );
  }
}
const oldTracers = new Map(
  (compatibleTransitionAnchorManifest?.tracers ?? []).map((tracer) => [tracer.id, tracer])
);
const specificationChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  compatibleTransitionAnchorManifest.authorities?.specification?.digest !==
    authorityInputs.specification.digest
);
const planChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  compatibleTransitionAnchorManifest.authorities?.plan?.digest !== authorityInputs.plan.digest
);
const requirementIndexChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  compatibleTransitionAnchorManifest.authorities?.requirementFamilyIndex?.digest !==
    authorityInputs.requirementFamilyIndex.digest
);
const clauseLedgerChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  (compatibleTransitionAnchorManifest.authorities?.requirementClauseLedger?.digest !==
    authorityInputs.requirementClauseLedger.digest ||
    compatibleTransitionAnchorManifest.authorities?.requirementClauseLedger?.schemaDigest !==
      authorityInputs.requirementClauseLedger.schemaDigest)
);
const protocolSchemasChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  (compatibleTransitionAnchorManifest.authorities?.protocolSchemas?.digest !==
    authorityInputs.protocolSchemas.digest ||
    JSON.stringify(compatibleTransitionAnchorManifest.authorities?.protocolSchemas?.paths) !==
      JSON.stringify(authorityInputs.protocolSchemas.paths))
);
const resultPolicyChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  compatibleTransitionAnchorManifest.authorities?.resultPolicy?.digest !==
    authorityInputs.resultPolicy.digest
);
const verifierChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  (JSON.stringify(compatibleTransitionAnchorManifest.authorities?.verifier?.paths) !==
    JSON.stringify(authorityInputs.verifier.paths) ||
    compatibleTransitionAnchorManifest.authorities?.verifier?.digest !==
      authorityInputs.verifier.digest)
);
const domainModelChanged = Boolean(
  compatibleTransitionAnchorManifest &&
  (JSON.stringify(compatibleTransitionAnchorManifest.authorities?.domainModel?.paths) !==
    JSON.stringify(authorityInputs.domainModel.paths) ||
    compatibleTransitionAnchorManifest.authorities?.domainModel?.digest !==
      authorityInputs.domainModel.digest)
);
const authorityChanged =
  specificationChanged ||
  planChanged ||
  requirementIndexChanged ||
  clauseLedgerChanged ||
  protocolSchemasChanged ||
  resultPolicyChanged ||
  verifierChanged ||
  domainModelChanged;
const definitionChanged = issues.some(
  (issue) =>
    oldTracers.has(issue.id) && oldTracers.get(issue.id).definitionDigest !== issue.definitionDigest
);
const tombstoneCountChanged =
  tombstones.length !== (compatibleTransitionAnchorManifest?.idPolicy?.tombstones ?? []).length;
const priorLiveIds = new Set(
  (compatibleTransitionAnchorManifest?.tracers ?? []).map((tracer) => tracer.id)
);
const removedLiveIds = [...priorLiveIds].filter((id) => !byId.has(id));
const priorTombstoneIds = new Set(
  (compatibleTransitionAnchorManifest?.idPolicy?.tombstones ?? []).map((record) => record.id)
);
const newlyTombstonedIds = tombstones
  .filter((record) => !priorTombstoneIds.has(record.id))
  .map((record) => record.id);
const dynamicAppendOnlyChange = Boolean(
  compatibleTransitionAnchorManifest &&
  addedIds.length === 1 &&
  addedIds.every((id) => id > staticBaseWaveHighestId) &&
  planChanged &&
  compatibleTransitionAnchorManifest.authorities?.plan?.narrativeDigest === planNarrativeDigest &&
  !specificationChanged &&
  !requirementIndexChanged &&
  !verifierChanged &&
  !domainModelChanged &&
  !definitionChanged &&
  !tombstoneCountChanged
);
const dynamicTombstoneOnlyChange = Boolean(
  compatibleTransitionAnchorManifest &&
  addedIds.length === 0 &&
  removedLiveIds.length === 1 &&
  newlyTombstonedIds.length === 1 &&
  removedLiveIds[0] === newlyTombstonedIds[0] &&
  removedLiveIds[0] > staticBaseWaveHighestId &&
  planChanged &&
  compatibleTransitionAnchorManifest.authorities?.plan?.narrativeDigest === planNarrativeDigest &&
  !specificationChanged &&
  !requirementIndexChanged &&
  !verifierChanged &&
  !domainModelChanged &&
  !definitionChanged &&
  tombstones.length === (compatibleTransitionAnchorManifest.idPolicy?.tombstones ?? []).length + 1
);
const governedRegistryTailChange = dynamicAppendOnlyChange || dynamicTombstoneOnlyChange;
const hasMutableProgress = manifestHasMutableProgress(compatibleTransitionAnchorManifest);
const anchoredAuthorityHistory = compatibleTransitionAnchorManifest?.authorityHistory;
const declaredAuthorityHistory = compatibleExistingManifest?.authorityHistory;
const anchoredAuthoritySetCount = anchoredAuthorityHistory?.authoritySets?.length ?? 0;
const anchoredAuthorityMigrationCount = anchoredAuthorityHistory?.migrations?.length ?? 0;
const appendedAuthoritySets = (declaredAuthorityHistory?.authoritySets ?? []).slice(
  anchoredAuthoritySetCount
);
const appendedAuthorityMigrations = (declaredAuthorityHistory?.migrations ?? []).slice(
  anchoredAuthorityMigrationCount
);
const declaredGovernedAuthorityMigration = Boolean(
  hasMutableProgress &&
  authorityChanged &&
  anchoredAuthorityHistory &&
  declaredAuthorityHistory &&
  appendedAuthoritySets.length === 1 &&
  appendedAuthorityMigrations.length === 1 &&
  appendedAuthorityMigrations[0]?.fromAuthoritySetDigest ===
    anchoredAuthorityHistory.currentAuthoritySetDigest &&
  appendedAuthorityMigrations[0]?.toAuthoritySetDigest === currentAuthoritySetDigest &&
  appendedAuthoritySets[0]?.authoritySetDigest === currentAuthoritySetDigest &&
  declaredAuthorityHistory.currentAuthoritySetDigest === currentAuthoritySetDigest
);
if (hasMutableProgress && authorityChanged && !declaredGovernedAuthorityMigration) {
  fail(
    "authority changed after evidence existed without exactly one adjacent typed authority migration from the trusted set to the current set"
  );
}
if (hasMutableProgress && definitionChanged) {
  fail("an existing registered tracer definition cannot change after execution begins");
}

const revisedDefinitions = registryHistoryMissing
  ? []
  : issues
      .filter(
        (issue) =>
          previousIds.has(issue.id) &&
          replayedRegistry.definitions.get(issue.id) !== issue.definitionDigest
      )
      .map((issue) => ({
        id: issue.id,
        previousDefinitionDigest: replayedRegistry.definitions.get(issue.id),
        definitionDigest: issue.definitionDigest,
        reason: "t01_clause_role_preregistration",
      }));
const t01PreregistrationWorktree = Boolean(
  checkpointEstablishedAtRead &&
  compatibleTransitionAnchorManifest?.schemaVersion === BOOTSTRAP_MANIFEST_SCHEMA &&
  existsSync(path.join(root, clauseLedgerRepoPath)) &&
  !manifestHasMutableProgress(compatibleTransitionAnchorManifest) &&
  !rawExistingHasProgress
);
if (revisedDefinitions.length && !t01PreregistrationWorktree) {
  fail("registered definition bytes can change only in the one-time T01 pre-registration");
}
const registryNeedsRebaseline = registryHistoryMissing;
if (compatibleTransitionAnchorManifest && registryNeedsRebaseline && !preTrustCorrectionCandidate) {
  fail("an origin-anchored registry genesis cannot be rebaselined");
}
if (registryNeedsRebaseline && hasMutableProgress) {
  fail("a progressed manifest cannot rewrite its append-only registry genesis");
}
if (registryNeedsRebaseline && tombstones.length) {
  fail("registry history cannot be rebaselined after a tombstone exists");
}
const priorRegistryEvents = registryNeedsRebaseline ? [] : declaredRegistryEvents;
const previousRegistryHead = registryNeedsRebaseline ? null : replayedRegistry.head;
const priorRegistryGeneration = registryNeedsRebaseline ? 0 : replayedRegistry.generation;
const newlyAddedDefinitions = (
  registryNeedsRebaseline
    ? issues
    : issues.filter((issue) => !replayedRegistry.definitions.has(issue.id))
).map((issue) => ({ id: issue.id, definitionDigest: issue.definitionDigest }));
const newlyAddedTombstones = registryNeedsRebaseline
  ? []
  : tombstones.filter((tombstone) => !replayedRegistry.replayedTombstones.has(tombstone.id));
const registryChanged =
  registryNeedsRebaseline ||
  newlyAddedDefinitions.length > 0 ||
  revisedDefinitions.length > 0 ||
  newlyAddedTombstones.length > 0;
let registryEvents = priorRegistryEvents;
if (registryChanged) {
  const eventPayload = {
    generation: priorRegistryGeneration + 1,
    previousHead: previousRegistryHead,
    addedDefinitions: newlyAddedDefinitions,
    tombstonesAdded: newlyAddedTombstones,
    ...(revisedDefinitions.length ? { revisedDefinitions } : {}),
  };
  registryEvents = [
    ...priorRegistryEvents,
    {
      ...eventPayload,
      head: digest(JSON.stringify(registryEventPayload(eventPayload))),
    },
  ];
}
const finalRegistry = replayRegistryEvents(registryEvents);
const registryGeneration = finalRegistry.generation;
const registryHead = finalRegistry.head;
const currentExecutionAuthoritySnapshot = {
  authoritySetDigest: currentAuthoritySetDigest,
  clauseLedgerDigest: authorityInputs.requirementClauseLedger.digest,
  domainModelDigest: authorityInputs.domainModel.digest,
  planDigest: authorityInputs.plan.digest,
  planNarrativeDigest: authorityInputs.plan.narrativeDigest,
  registryHead,
  requirementFamilyIndexDigest: authorityInputs.requirementFamilyIndex.digest,
  schemaRegistryDigest: authorityInputs.protocolSchemas.digest,
  specificationDigest: authorityInputs.specification.digest,
  tombstoneSetDigest,
  verifierDigest: authorityInputs.verifier.digest,
};
const highestAllocatedId = Math.max(previousHighest, ...issues.map((issue) => issue.id));
const registeredTracerIds = [
  ...new Set([...issues.map((issue) => issue.id), ...tombstoneIds]),
].sort((left, right) => left - right);
if (
  highestAllocatedId !== Math.max(...registeredTracerIds) ||
  registeredTracerIds.length !== issues.length + tombstones.length
) {
  fail("live/tombstoned registry membership disagrees with its highest allocated ID");
}
if (
  finalRegistry.highest !== highestAllocatedId ||
  [...finalRegistry.definitions.keys()].join(",") !== registeredTracerIds.join(",") ||
  JSON.stringify(canonicalTombstones(finalRegistry.replayedTombstones.values())) !==
    JSON.stringify(canonicalTombstones(tombstones))
) {
  fail("append-only registryEvents do not reconstruct the current ID/tombstone state");
}
const baseWaveHighestId =
  compatibleTransitionAnchorManifest?.idPolicy?.baseWaveHighestId ?? highestAllocatedId;
if (
  !Number.isInteger(baseWaveHighestId) ||
  baseWaveHighestId < 1 ||
  baseWaveHighestId > highestAllocatedId
) {
  fail("baseWaveHighestId must be a positive registered-ID boundary");
}

function defaultIssueCompletion(status) {
  void status;
  return "open";
}

const canPreserveGlobalState = Boolean(
  compatibleExistingManifest &&
  compatibleTransitionAnchorManifest &&
  ((!authorityChanged && !definitionChanged) || declaredGovernedAuthorityMigration)
);
const executionGenerations = canPreserveGlobalState
  ? (compatibleExistingManifest.executionGenerations ?? [])
  : [];
const anchoredExecutionGenerationCount =
  compatibleTransitionAnchorManifest?.executionGenerations?.length ?? 0;
const newlyAppendedExecutionGenerations = executionGenerations.slice(
  anchoredExecutionGenerationCount
);
if (compatibleTransitionAnchorManifest && newlyAppendedExecutionGenerations.length > 1) {
  fail("one receipt-manifest transaction may append exactly one execution generation");
}
const allowedIssueCompletionStates = new Set([
  "open",
  "in_progress",
  "complete",
  "invalidated",
  "superseded",
]);
const allowedProductAcceptanceStates = new Set(["pass", "fail", "blocked", "incomplete"]);
const allowedApplicabilityStates = new Set(["applicable", "not_applicable", "not_claimed"]);
const allowedComparisonStates = new Set(["comparable", "incomparable", "not_required", "unknown"]);
const allowedFreshnessStates = new Set(["current", "stale", "unknown"]);
const allowedCompatibilityStates = new Set(["compatible", "incompatible", "unknown"]);
const allowedAuthorityValidityStates = new Set(["valid", "invalid", "not_required", "unknown"]);
const exactAttemptResultCodes = new Map([
  [
    69,
    new Set([
      "review_round_passed",
      "review_round_failed",
      "review_round_blocked",
      "review_round_incomplete",
      "review_round_applicability_invalid",
    ]),
  ],
  [
    84,
    new Set([
      "qualification_passed_no_open_repairs",
      "qualification_failed_repair_dispatched",
      "qualification_blocked",
      "qualification_incomplete",
      "qualification_invalid_fixture_replacement_required",
    ]),
  ],
  [
    85,
    new Set([
      "machine_complete",
      "machine_closure_failed_repair_dispatched",
      "machine_closure_blocked",
      "machine_closure_incomplete",
    ]),
  ],
  [
    87,
    new Set([
      "release_complete",
      "release_closure_failed_repair_dispatched",
      "release_closure_blocked",
      "release_closure_incomplete",
    ]),
  ],
  [
    103,
    new Set([
      "freeze_complete",
      "truth_verification_failed_repair_dispatched",
      "truth_verification_blocked",
      "truth_verification_incomplete",
      "successor_truth_review_required",
    ]),
  ],
  [
    106,
    new Set([
      "precommit_ready",
      "precommit_failed_repair_dispatched",
      "precommit_blocked",
      "precommit_incomplete",
      "successor_decision_required",
    ]),
  ],
]);
const passingAttemptResultCodes = new Map([
  [69, "review_round_passed"],
  [84, "qualification_passed_no_open_repairs"],
  [85, "machine_complete"],
  [87, "release_complete"],
  [103, "freeze_complete"],
  [106, "precommit_ready"],
]);

function validCommit(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

function validPublicationReceipt(value, implementationCommit) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") ===
      [
        "bootstrapAnchor",
        "branch",
        "checkedAt",
        "commit",
        "fetchedHead",
        "graphQlHead",
        "remote",
        "remoteIdentity",
        "remoteProtectionAssumed",
        "repositoryDatabaseId",
        "repositoryNameWithOwner",
        "repositoryNodeId",
        "schemaId",
        "trustedMainAtStart",
        "trustPolicyObject",
      ]
        .sort()
        .join(",") &&
    value.schemaId === "vellum.instrument-intelligence.publication-receipt.v1" &&
    value.remote === "origin" &&
    value.remoteIdentity === INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST.remoteIdentity &&
    value.branch === INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.branch &&
    value.repositoryNodeId === INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.nodeId &&
    value.repositoryDatabaseId === INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.databaseId &&
    value.repositoryNameWithOwner === INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.nameWithOwner &&
    value.remoteProtectionAssumed === false &&
    value.commit === implementationCommit &&
    value.fetchedHead === implementationCommit &&
    value.graphQlHead === implementationCommit &&
    validCommit(value.bootstrapAnchor) &&
    validCommit(value.trustedMainAtStart) &&
    /^[a-f0-9]{40}$/.test(value.trustPolicyObject ?? "") &&
    validIsoInstant(value.checkedAt)
  );
}

const authoritySnapshotKeys = [
  "authoritySetDigest",
  "clauseLedgerDigest",
  "domainModelDigest",
  "planDigest",
  "planNarrativeDigest",
  "registryHead",
  "requirementFamilyIndexDigest",
  "schemaRegistryDigest",
  "specificationDigest",
  "tombstoneSetDigest",
  "verifierDigest",
];
const gateGroups = new Set(["focused", "base", "conditional"]);
const gateStatuses = new Set(["pass", "fail", "blocked", "incomplete"]);
const conditionalReasonCodes = new Set(["condition_met", "condition_not_met", "no_machine_gate"]);
const publicArtifactSchemas = new Set([
  "vellum.sanitized-gate-log.v1",
  "vellum.test-report.v1",
  "vellum.public-musical-artifact.v1",
  "vellum.public-review-receipt.v1",
  "vellum.review-role-package.v1",
  "vellum.remediation-dispatch.v1",
  "vellum.redaction-receipt.v1",
]);
const publicMediaTypes = new Set([
  "application/json",
  "application/pdf",
  "audio/midi",
  "audio/wav",
  "image/png",
  "image/svg+xml",
]);
const aggregateStatuses = new Set(["pass", "fail", "blocked", "incomplete"]);
const privateClasses = new Set([
  "heldout_identity_or_asset",
  "truth_or_expected_observation",
  "forbidden_outcome_or_mutation",
  "invalidation_or_reserve_state",
  "per_attempt_diagnostic",
  "owner_private_source_identity_path_metadata_or_content",
]);
const invalidationScopes = new Set([
  "issue",
  "evidence",
  "requirements",
  "machine_closure",
  "release_closure",
  "provisional_stop",
]);
const stateEdgeReasonCodes = new Set([
  "definition_changed",
  "evidence_stale",
  "qualification_failure",
  "review_finding",
  "rights_change",
  "repair_rerun",
  "decision_superseded",
  "governed_reassessment",
]);

function validateAuthoritySnapshot(value, context) {
  exactKeys(value, authoritySnapshotKeys, context);
  for (const key of authoritySnapshotKeys) {
    if (!validDigest(value[key])) fail(`${context}.${key} must be a SHA-256 digest`);
  }
}

function validIsoInstant(value) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

const reviewCredentialTypes = new Set([
  "institutional_registry",
  "openpgp",
  "owner_local",
  "specialist_registry",
  "ssh",
  "webauthn",
  "x509",
]);
const reviewAuthorityRoles = new Set([...HUMAN_REVIEW_ROLES, "owner", "authority_verifier"]);

function validateReviewAuthorityCatalog(value, context) {
  exactKeys(
    value,
    ["conflictPolicy", "credentials", "policy", "policyDigest", "revocations", "schemaId"],
    context
  );
  if (
    value.schemaId !== "vellum.instrument-intelligence.review-authority-catalog.v1" ||
    !Array.isArray(value.credentials) ||
    !Array.isArray(value.revocations)
  ) {
    fail(`${context} has an invalid closed root`);
  }
  exactKeys(value.conflictPolicy, ["policyId", "prohibitedRolePairs"], `${context}.conflictPolicy`);
  if (
    !/^[a-z][a-z0-9._-]{0,127}$/.test(value.conflictPolicy.policyId ?? "") ||
    !Array.isArray(value.conflictPolicy.prohibitedRolePairs) ||
    JSON.stringify(value.conflictPolicy.prohibitedRolePairs) !==
      JSON.stringify([...new Set(value.conflictPolicy.prohibitedRolePairs)].sort())
  ) {
    fail(`${context}.conflictPolicy is invalid or unsorted`);
  }
  const conflictPolicyDigest = digest(JSON.stringify(value.conflictPolicy));
  exactKeys(
    value.policy,
    ["algorithms", "clockSkewSeconds", "conflictPolicyDigest", "policyId"],
    `${context}.policy`
  );
  if (
    JSON.stringify(value.policy.algorithms) !== JSON.stringify(["ed25519"]) ||
    !Number.isInteger(value.policy.clockSkewSeconds) ||
    value.policy.clockSkewSeconds < 0 ||
    value.policy.clockSkewSeconds > 600 ||
    value.policy.conflictPolicyDigest !== conflictPolicyDigest ||
    !/^[a-z][a-z0-9._-]{0,127}$/.test(value.policy.policyId ?? "") ||
    value.policyDigest !== digest(JSON.stringify(value.policy))
  ) {
    fail(`${context}.policy does not bind its exact algorithm, clock, and conflict policy`);
  }
  const credentialIds = new Set();
  for (const [index, credential] of value.credentials.entries()) {
    const credentialContext = `${context}.credentials[${index}]`;
    exactKeys(
      credential,
      [
        "algorithm",
        "authorizedClaimScopeDigests",
        "credentialId",
        "credentialType",
        "expiresAt",
        "issuedAt",
        "publicKeySpki",
        "registration",
        "role",
        "subjectId",
      ],
      credentialContext
    );
    exactKeys(
      credential.registration,
      ["artifactDigest", "generation", "receiptCommit", "tracerId"],
      `${credentialContext}.registration`
    );
    if (
      !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(credential.credentialId ?? "") ||
      credentialIds.has(credential.credentialId) ||
      !reviewCredentialTypes.has(credential.credentialType) ||
      !reviewAuthorityRoles.has(credential.role) ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(credential.subjectId ?? "") ||
      credential.algorithm !== "ed25519" ||
      !/^[A-Za-z0-9_-]{40,1024}$/.test(credential.publicKeySpki ?? "") ||
      !validIsoInstant(credential.issuedAt) ||
      !validIsoInstant(credential.expiresAt) ||
      Date.parse(credential.expiresAt) <= Date.parse(credential.issuedAt) ||
      !Array.isArray(credential.authorizedClaimScopeDigests) ||
      JSON.stringify(credential.authorizedClaimScopeDigests) !==
        JSON.stringify([...new Set(credential.authorizedClaimScopeDigests)].sort()) ||
      credential.authorizedClaimScopeDigests.some((scopeDigest) => !validDigest(scopeDigest)) ||
      !Number.isInteger(credential.registration.tracerId) ||
      credential.registration.tracerId < 1 ||
      !Number.isInteger(credential.registration.generation) ||
      credential.registration.generation < 1 ||
      !validCommit(credential.registration.receiptCommit) ||
      !validDigest(credential.registration.artifactDigest)
    ) {
      fail(`${credentialContext} is invalid, duplicated, or not canonically ordered`);
    }
    credentialIds.add(credential.credentialId);
  }
  const sortedCredentialIds = value.credentials.map(({ credentialId }) => credentialId);
  if (JSON.stringify(sortedCredentialIds) !== JSON.stringify([...sortedCredentialIds].sort())) {
    fail(`${context}.credentials must be sorted by credentialId`);
  }
  const revocationKeys = new Set();
  for (const [index, revocation] of value.revocations.entries()) {
    const revocationContext = `${context}.revocations[${index}]`;
    exactKeys(
      revocation,
      ["credentialId", "reasonCode", "revocationDigest", "revokedAt", "source"],
      revocationContext
    );
    exactKeys(
      revocation.source,
      ["evidenceDigest", "generation", "receiptCommit", "tracerId"],
      `${revocationContext}.source`
    );
    const projection = {
      credentialId: revocation.credentialId,
      reasonCode: revocation.reasonCode,
      revokedAt: revocation.revokedAt,
      source: revocation.source,
    };
    const revocationKey = `${revocation.credentialId}:${revocation.revokedAt}`;
    if (
      !credentialIds.has(revocation.credentialId) ||
      revocationKeys.has(revocationKey) ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(revocation.reasonCode ?? "") ||
      !validIsoInstant(revocation.revokedAt) ||
      revocation.revocationDigest !== digest(JSON.stringify(projection)) ||
      !Number.isInteger(revocation.source.tracerId) ||
      revocation.source.tracerId < 1 ||
      !Number.isInteger(revocation.source.generation) ||
      revocation.source.generation < 1 ||
      !validCommit(revocation.source.receiptCommit) ||
      !validDigest(revocation.source.evidenceDigest)
    ) {
      fail(`${revocationContext} is invalid or duplicated`);
    }
    revocationKeys.add(revocationKey);
  }
  const sortedRevocationKeys = value.revocations.map(
    ({ credentialId, revokedAt }) => `${credentialId}:${revokedAt}`
  );
  if (JSON.stringify(sortedRevocationKeys) !== JSON.stringify([...sortedRevocationKeys].sort())) {
    fail(`${context}.revocations must be canonically sorted`);
  }
  return value;
}

const reviewAuthorityCatalogCache = new Map();
function reviewAuthorityCatalogAt(ref) {
  if (reviewAuthorityCatalogCache.has(ref)) return reviewAuthorityCatalogCache.get(ref);
  let value;
  try {
    const bytes =
      ref === "WORKTREE"
        ? readLocalBytes(reviewAuthorityCatalogRepoPath)
        : gitBytesAt(ref, reviewAuthorityCatalogRepoPath);
    value = validateReviewAuthorityCatalog(
      JSON.parse(bytes.toString("utf8")),
      `${ref}:${reviewAuthorityCatalogRepoPath}`
    );
  } catch (error) {
    if (error?.message?.startsWith("Instrument Intelligence plan verification failed:")) {
      throw error;
    }
    fail(`${ref}:${reviewAuthorityCatalogRepoPath} is not valid canonical JSON`);
  }
  reviewAuthorityCatalogCache.set(ref, value);
  return value;
}

reviewAuthorityCatalogAt("WORKTREE");

function validatePublicArtifactPayload(artifact, bytes, context, authorityOptions = null) {
  if (artifact.schemaId === "vellum.public-musical-artifact.v1") {
    if (artifact.mediaType === "application/json") {
      fail(`${context} musical artifacts cannot use an untyped JSON payload`);
    }
    return null;
  }
  if (artifact.mediaType !== "application/json") {
    fail(`${context} typed receipt artifacts must use application/json`);
  }
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${context} is not valid typed JSON`);
  }
  if (artifact.schemaId === "vellum.sanitized-gate-log.v1") {
    exactKeys(
      payload,
      [
        "artifactId",
        "blocked",
        "commandDigest",
        "failed",
        "incomplete",
        "passed",
        "schemaId",
        "skipped",
        "status",
      ],
      context
    );
    if (
      !validDigest(payload.commandDigest) ||
      ![payload.passed, payload.failed, payload.skipped, payload.blocked, payload.incomplete].every(
        (count) => Number.isInteger(count) && count >= 0
      )
    ) {
      fail(`${context} gate-log command/count proof is invalid`);
    }
  } else if (artifact.schemaId === "vellum.test-report.v1") {
    exactKeys(
      payload,
      [
        "artifactId",
        "blocked",
        "commandDigest",
        "failed",
        "incomplete",
        "passed",
        "schemaId",
        "skipped",
        "status",
      ],
      context
    );
    if (
      !validDigest(payload.commandDigest) ||
      ![payload.passed, payload.failed, payload.skipped, payload.blocked, payload.incomplete].every(
        (count) => Number.isInteger(count) && count >= 0
      ) ||
      (payload.status === "pass" &&
        (payload.failed !== 0 ||
          payload.blocked !== 0 ||
          payload.incomplete !== 0 ||
          payload.passed < 1)) ||
      (payload.status === "fail" && payload.failed < 1) ||
      (payload.status === "blocked" && payload.blocked < 1) ||
      (payload.status === "incomplete" && payload.incomplete < 1)
    ) {
      fail(`${context} test-report counts/status/digest are invalid`);
    }
  } else if (artifact.schemaId === "vellum.review-role-package.v1") {
    exactKeys(payload, ["artifactId", "consumers", "outputDigest", "schemaId", "status"], context);
    if (
      payload.status !== "pass" ||
      !Array.isArray(payload.consumers) ||
      !payload.consumers.length ||
      payload.outputDigest !== digest(JSON.stringify(payload.consumers))
    ) {
      fail(`${context} review-role package root is invalid`);
    }
    const consumerIds = new Set();
    const validateDigestRef = (reference, referenceContext) => {
      exactKeys(reference, ["digest", "id"], referenceContext);
      if (
        !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(reference.id ?? "") ||
        !validDigest(reference.digest)
      ) {
        fail(`${referenceContext} is invalid`);
      }
    };
    for (const [index, consumer] of payload.consumers.entries()) {
      const consumerContext = `${context}.consumers[${index}]`;
      exactKeys(
        consumer,
        [
          "disqualifiedReviewerSubjectIds",
          "outputs",
          "package",
          "system",
          "systemGeneration",
          "tracerId",
        ],
        consumerContext
      );
      if (
        !/^T(?:0[1-9]|[1-9][0-9]*)$/.test(consumer.tracerId ?? "") ||
        consumerIds.has(consumer.tracerId)
      ) {
        fail(`${consumerContext}.tracerId is invalid or duplicated`);
      }
      consumerIds.add(consumer.tracerId);
      if (
        !Array.isArray(consumer.disqualifiedReviewerSubjectIds) ||
        JSON.stringify(consumer.disqualifiedReviewerSubjectIds) !==
          JSON.stringify([...new Set(consumer.disqualifiedReviewerSubjectIds)].sort()) ||
        consumer.disqualifiedReviewerSubjectIds.some(
          (subjectId) => !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(subjectId)
        )
      ) {
        fail(`${consumerContext}.disqualifiedReviewerSubjectIds is invalid or unsorted`);
      }
      validateDigestRef(consumer.package, `${consumerContext}.package`);
      validateDigestRef(consumer.system, `${consumerContext}.system`);
      if (
        !Array.isArray(consumer.outputs) ||
        !consumer.outputs.length ||
        JSON.stringify(consumer.outputs.map(({ id }) => id)) !==
          JSON.stringify([...new Set(consumer.outputs.map(({ id }) => id))].sort())
      ) {
        fail(`${consumerContext}.outputs must be a sorted unique nonempty set`);
      }
      for (const [outputIndex, output] of consumer.outputs.entries()) {
        validateDigestRef(output, `${consumerContext}.outputs[${outputIndex}]`);
      }
      exactKeys(
        consumer.systemGeneration,
        ["artifactDigest", "generation", "receiptCommit", "tracerId"],
        `${consumerContext}.systemGeneration`
      );
      if (
        !/^T(?:0[1-9]|[1-9][0-9]*)$/.test(consumer.systemGeneration.tracerId ?? "") ||
        !Number.isInteger(consumer.systemGeneration.generation) ||
        consumer.systemGeneration.generation < 1 ||
        !validCommit(consumer.systemGeneration.receiptCommit) ||
        !validDigest(consumer.systemGeneration.artifactDigest)
      ) {
        fail(`${consumerContext}.systemGeneration is invalid`);
      }
    }
    if (
      JSON.stringify(payload.consumers.map(({ tracerId }) => tracerId)) !==
      JSON.stringify([...payload.consumers.map(({ tracerId }) => tracerId)].sort())
    ) {
      fail(`${context}.consumers must be sorted by tracerId`);
    }
  } else if (artifact.schemaId === "vellum.public-review-receipt.v1") {
    if (!authorityOptions) fail(`${context} lacks an exact-base authority verification context`);
    try {
      validateAuthorityArtifactPayload(payload, {
        context,
        expectedSubjects: authorityOptions.expectedSubjects,
        expectedVerifierPolicyDigest: authorityOptions.catalog.policyDigest,
        requireGrant: true,
        verifySignature: authorityOptions.verifySignature,
      });
      validateAuthorityReceiptAgainstCatalog(payload, authorityOptions, context);
    } catch (error) {
      fail(error.message);
    }
    const status =
      payload.receiptKind === "human_review"
        ? payload.statement.review.productAcceptance
        : payload.statement.decision.productAcceptance;
    if (payload.statement.authorityReceiptId !== artifact.artifactId) {
      fail(`${context} authority receipt identity differs from its artifact receipt`);
    }
    return {
      ...payload,
      artifactId: artifact.artifactId,
      outputDigest: artifact.sha256,
      status,
    };
  } else if (artifact.schemaId === "vellum.remediation-dispatch.v1") {
    exactKeys(
      payload,
      [
        "affectedClauseIds",
        "artifactId",
        "closureTargets",
        "expectedAllocation",
        "findingId",
        "inheritedCommitment",
        "invalidatesMachineComplete",
        "invalidationScopes",
        "invalidations",
        "obligationId",
        "outputDigest",
        "rejoinAt",
        "repairContract",
        "repairDefinitionDigest",
        "repairTracerId",
        "schemaId",
        "source",
        "status",
        "transfersFrom",
      ],
      context
    );
    if (
      !validDigest(payload.outputDigest) ||
      !validDigest(payload.repairDefinitionDigest) ||
      payload.status !== "pass" ||
      !/^[a-z][a-z0-9_]{0,127}$/.test(payload.findingId ?? "") ||
      !/^[a-z][a-z0-9_]{0,127}$/.test(payload.obligationId ?? "") ||
      (payload.transfersFrom !== null &&
        !/^[a-z][a-z0-9_]{0,127}$/.test(payload.transfersFrom ?? "")) ||
      !Number.isInteger(payload.repairTracerId) ||
      payload.repairTracerId < 1
    ) {
      fail(`${context} remediation dispatch identity/status is invalid`);
    }
    const validateTarget = (target, targetContext) => {
      exactKeys(target, ["generation", "tracerId"], targetContext);
      if (
        !Number.isInteger(target.tracerId) ||
        target.tracerId < 1 ||
        !Number.isInteger(target.generation) ||
        target.generation < 1
      ) {
        fail(`${targetContext} is invalid`);
      }
    };
    exactKeys(payload.source, ["generation", "resultCode", "tracerId"], `${context}.source`);
    if (
      !Number.isInteger(payload.source.tracerId) ||
      payload.source.tracerId < 1 ||
      !Number.isInteger(payload.source.generation) ||
      payload.source.generation < 1 ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(payload.source.resultCode ?? "")
    ) {
      fail(`${context}.source.resultCode is invalid`);
    }
    exactKeys(
      payload.expectedAllocation,
      ["registryHead", "tracerId"],
      `${context}.expectedAllocation`
    );
    if (
      payload.expectedAllocation.tracerId !== payload.repairTracerId ||
      !validDigest(payload.expectedAllocation.registryHead)
    ) {
      fail(`${context}.expectedAllocation does not bind the repair tracer and registry`);
    }
    exactKeys(payload.repairContract, ["completionSemantics", "type"], `${context}.repairContract`);
    if (
      payload.repairContract.type !== "AFK" ||
      payload.repairContract.completionSemantics !== "implementation-pass"
    ) {
      fail(`${context}.repairContract is invalid`);
    }
    if (
      !Array.isArray(payload.affectedClauseIds) ||
      !payload.affectedClauseIds.length ||
      JSON.stringify(payload.affectedClauseIds) !==
        JSON.stringify([...new Set(payload.affectedClauseIds)].sort()) ||
      payload.affectedClauseIds.some((clauseId) => !/^II-CLAUSE-\d{4}$/.test(clauseId))
    ) {
      fail(`${context}.affectedClauseIds is not a sorted nonempty clause set`);
    }
    exactKeys(
      payload.inheritedCommitment,
      ["regressionLedgerHead", "reserveCursorCommitment"],
      `${context}.inheritedCommitment`
    );
    if (
      !validDigest(payload.inheritedCommitment.regressionLedgerHead) ||
      !validDigest(payload.inheritedCommitment.reserveCursorCommitment)
    ) {
      fail(`${context}.inheritedCommitment is invalid`);
    }
    validateTarget(payload.rejoinAt, `${context}.rejoinAt`);
    if (!Array.isArray(payload.invalidations) || !payload.invalidations.length) {
      fail(`${context}.invalidations must be nonempty`);
    }
    const invalidationTargets = new Set();
    for (const invalidation of payload.invalidations) {
      exactKeys(invalidation, ["reasonCode", "scopes", "target"], `${context} invalidation`);
      validateTarget(invalidation.target, `${context} invalidation target`);
      const targetKey = `${invalidation.target.tracerId}:${invalidation.target.generation}`;
      if (
        invalidationTargets.has(targetKey) ||
        !stateEdgeReasonCodes.has(invalidation.reasonCode) ||
        !Array.isArray(invalidation.scopes) ||
        !invalidation.scopes.length ||
        new Set(invalidation.scopes).size !== invalidation.scopes.length ||
        invalidation.scopes.some((scope) => !invalidationScopes.has(scope))
      ) {
        fail(`${context} contains an invalid or duplicate invalidation`);
      }
      invalidationTargets.add(targetKey);
    }
    const derivedInvalidationScopes = [
      ...new Set(payload.invalidations.flatMap(({ scopes }) => scopes)),
    ].sort();
    if (
      !Array.isArray(payload.invalidationScopes) ||
      JSON.stringify(payload.invalidationScopes) !== JSON.stringify(derivedInvalidationScopes) ||
      payload.invalidatesMachineComplete !== derivedInvalidationScopes.includes("machine_closure")
    ) {
      fail(`${context} invalidation summary contradicts its exact edges`);
    }
    if (!Array.isArray(payload.closureTargets) || !payload.closureTargets.length) {
      fail(`${context}.closureTargets must be nonempty`);
    }
    const closureTargetIds = new Set();
    for (const target of payload.closureTargets) {
      validateTarget(target, `${context} closure target`);
      if (![85, 87].includes(target.tracerId) || closureTargetIds.has(target.tracerId)) {
        fail(`${context} contains an invalid or duplicate closure target`);
      }
      closureTargetIds.add(target.tracerId);
    }
    if (
      !closureTargetIds.has(87) ||
      closureTargetIds.has(85) !== payload.invalidatesMachineComplete
    ) {
      fail(`${context}.closureTargets contradict the derived Machine impact`);
    }
  } else if (artifact.schemaId === "vellum.redaction-receipt.v1") {
    exactKeys(
      payload,
      ["artifactId", "outputDigest", "redactedClasses", "schemaId", "status"],
      context
    );
    if (
      !validDigest(payload.outputDigest) ||
      !Array.isArray(payload.redactedClasses) ||
      payload.redactedClasses.some((fieldClass) => !privateClasses.has(fieldClass))
    ) {
      fail(`${context} redaction payload is invalid`);
    }
  }
  if (
    payload.schemaId !== artifact.schemaId ||
    payload.artifactId !== artifact.artifactId ||
    !aggregateStatuses.has(payload.status)
  ) {
    fail(`${context} payload identity/status differs from its artifact receipt`);
  }
  return payload;
}

function validateLegacyEvidenceReceipt(evidenceBytes, generation, definition) {
  let evidence;
  try {
    evidence = JSON.parse(evidenceBytes.toString("utf8"));
  } catch {
    fail(`${definition.evidencePath} must contain canonical typed JSON`);
  }
  exactKeys(
    evidence,
    [
      "authoritySnapshot",
      "completionSemantics",
      "conditionalDisposition",
      "definitionDigest",
      "executionGeneration",
      "finishedAt",
      "gateMatrixDigest",
      "gateReceipts",
      "outcome",
      "predecessors",
      "publicArtifacts",
      "redactions",
      "schemaVersion",
      "startedAt",
      "toolchains",
      "tracerId",
      "vaultCommitments",
    ],
    `${definition.evidencePath} root`
  );
  if (
    evidence.schemaVersion !== 1 ||
    evidence.tracerId !== generation.tracerId ||
    evidence.executionGeneration !== generation.generation ||
    evidence.definitionDigest !== generation.definitionDigest ||
    evidence.completionSemantics !== definition.completionSemantics ||
    evidence.gateMatrixDigest !== definition.gateMatrixDigest ||
    JSON.stringify(evidence.predecessors) !== JSON.stringify(generation.predecessors)
  ) {
    fail(`${definition.evidencePath} identity fields do not match its execution generation`);
  }
  validateAuthoritySnapshot(
    evidence.authoritySnapshot,
    `${definition.evidencePath}.authoritySnapshot`
  );
  if (JSON.stringify(evidence.authoritySnapshot) !== JSON.stringify(generation.authoritySnapshot)) {
    fail(`${definition.evidencePath} authority snapshot differs from its execution generation`);
  }
  if (
    !validIsoInstant(evidence.startedAt) ||
    !validIsoInstant(evidence.finishedAt) ||
    Date.parse(evidence.finishedAt) < Date.parse(evidence.startedAt)
  ) {
    fail(`${definition.evidencePath} has invalid execution timestamps`);
  }
  exactKeys(
    evidence.outcome,
    [
      "applicability",
      "authorityValidity",
      "comparison",
      "compatibility",
      "freshness",
      "productAcceptance",
      "resultCode",
    ],
    `${definition.evidencePath}.outcome`
  );
  for (const field of [
    "productAcceptance",
    "applicability",
    "comparison",
    "freshness",
    "compatibility",
    "authorityValidity",
    "resultCode",
  ]) {
    if (evidence.outcome[field] !== generation[field]) {
      fail(`${definition.evidencePath}.outcome.${field} differs from its execution generation`);
    }
  }
  exactKeys(
    evidence.conditionalDisposition,
    ["applicability", "reasonCode"],
    `${definition.evidencePath}.conditionalDisposition`
  );
  if (
    !new Set(["applicable", "not_applicable"]).has(evidence.conditionalDisposition.applicability) ||
    !conditionalReasonCodes.has(evidence.conditionalDisposition.reasonCode)
  ) {
    fail(`${definition.evidencePath} has an invalid conditional gate disposition`);
  }

  if (!Array.isArray(evidence.gateReceipts)) {
    fail(`${definition.evidencePath}.gateReceipts must be an array`);
  }
  const receivedCommands = { focused: [], base: [], conditional: [] };
  const referencedArtifactIds = new Set();
  const seenGates = new Set();
  for (const gate of evidence.gateReceipts) {
    exactKeys(
      gate,
      ["artifactIds", "checkedAt", "command", "group", "publicResultDigest", "status"],
      `${definition.evidencePath} gate receipt`
    );
    if (
      !gateGroups.has(gate.group) ||
      typeof gate.command !== "string" ||
      !gateStatuses.has(gate.status) ||
      !validIsoInstant(gate.checkedAt) ||
      !validDigest(gate.publicResultDigest) ||
      !Array.isArray(gate.artifactIds) ||
      new Set(gate.artifactIds).size !== gate.artifactIds.length
    ) {
      fail(`${definition.evidencePath} contains an invalid gate receipt`);
    }
    const gateKey = `${gate.group}\u0000${gate.command}`;
    if (seenGates.has(gateKey)) fail(`${definition.evidencePath} repeats gate ${gate.command}`);
    seenGates.add(gateKey);
    receivedCommands[gate.group].push(gate.command);
    for (const artifactId of gate.artifactIds) {
      if (typeof artifactId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(artifactId)) {
        fail(`${definition.evidencePath} gate references an invalid artifact ID`);
      }
      referencedArtifactIds.add(artifactId);
    }
  }
  const requiredGateGroups = ["focused", "base"];
  for (const group of requiredGateGroups) {
    if (
      generation.issueCompletion === "complete" &&
      JSON.stringify(receivedCommands[group]) !==
        JSON.stringify(definition.expectedGateCommands[group])
    ) {
      fail(`${definition.evidencePath} lacks exact ${group} gate coverage`);
    }
  }
  const conditionalApplicable = evidence.conditionalDisposition.applicability === "applicable";
  if (
    (conditionalApplicable && evidence.conditionalDisposition.reasonCode !== "condition_met") ||
    (!conditionalApplicable &&
      !["condition_not_met", "no_machine_gate"].includes(
        evidence.conditionalDisposition.reasonCode
      ))
  ) {
    fail(`${definition.evidencePath} conditional disposition contradicts its reason code`);
  }
  if (
    conditionalApplicable &&
    generation.issueCompletion === "complete" &&
    JSON.stringify(receivedCommands.conditional) !==
      JSON.stringify(definition.expectedGateCommands.conditional)
  ) {
    fail(`${definition.evidencePath} lacks exact applicable conditional gate coverage`);
  }
  if (!conditionalApplicable && receivedCommands.conditional.length) {
    fail(`${definition.evidencePath} cannot execute conditional gates marked not_applicable`);
  }
  if (generation.issueCompletion === "complete") {
    if (
      evidence.gateReceipts.some((gate) => gate.status !== "pass" || gate.artifactIds.length === 0)
    ) {
      fail(`${definition.evidencePath} cannot complete with a nonpassing or artifact-free gate`);
    }
    if (
      ["implementation-pass", "closure-pass-required"].includes(definition.completionSemantics) &&
      generation.productAcceptance !== "pass"
    ) {
      fail(`${definition.file} completion semantics require productAcceptance pass`);
    }
    if (
      ["attempt-finalized", "decision-recorded"].includes(definition.completionSemantics) &&
      (typeof generation.resultCode !== "string" || !generation.resultCode.length)
    ) {
      fail(`${definition.file} finalized attempt/decision requires a typed resultCode`);
    }
    if (
      generation.freshness !== "current" ||
      generation.compatibility !== "compatible" ||
      !["valid", "not_required"].includes(generation.authorityValidity)
    ) {
      fail(`${definition.file} cannot complete with stale, incompatible, or invalid authority`);
    }
    const closureCode = new Map([
      [85, "machine_complete"],
      [87, "release_complete"],
    ]).get(generation.tracerId);
    if (
      definition.completionSemantics === "closure-pass-required" &&
      generation.resultCode !== closureCode
    ) {
      fail(`${definition.file} has the wrong closure resultCode`);
    }
  }

  if (!Array.isArray(evidence.toolchains) || !evidence.toolchains.length) {
    fail(`${definition.evidencePath}.toolchains must identify the execution environment`);
  }
  for (const toolchain of evidence.toolchains) {
    exactKeys(toolchain, ["component", "version"], `${definition.evidencePath} toolchain`);
    if (
      !/^[a-z][a-z0-9._-]{0,63}$/.test(toolchain.component ?? "") ||
      !/^[A-Za-z0-9][A-Za-z0-9._+:-]{0,127}$/.test(toolchain.version ?? "")
    ) {
      fail(`${definition.evidencePath} toolchain fields are not bounded public identifiers`);
    }
  }

  if (!Array.isArray(evidence.publicArtifacts)) {
    fail(`${definition.evidencePath}.publicArtifacts must be an array`);
  }
  const artifactIds = new Set();
  const artifactPayloads = new Map();
  const artifactReceipts = new Map();
  const evidenceDirectory = path.posix.dirname(definition.evidencePath);
  const allowedCommittedFiles = new Set([definition.evidencePath]);
  for (const artifact of evidence.publicArtifacts) {
    exactKeys(
      artifact,
      ["artifactId", "mediaType", "path", "requirementIds", "schemaId", "sha256"],
      `${definition.evidencePath} public artifact`
    );
    if (
      typeof artifact.artifactId !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(artifact.artifactId) ||
      artifactIds.has(artifact.artifactId) ||
      !publicArtifactSchemas.has(artifact.schemaId) ||
      !publicMediaTypes.has(artifact.mediaType) ||
      !validDigest(artifact.sha256) ||
      !Array.isArray(artifact.requirementIds) ||
      new Set(artifact.requirementIds).size !== artifact.requirementIds.length ||
      artifact.requirementIds.some((requirementId) => !requirementRows.has(requirementId))
    ) {
      fail(`${definition.evidencePath} contains an invalid public artifact receipt`);
    }
    if (
      artifact.schemaId === "vellum.public-musical-artifact.v1" &&
      !artifact.requirementIds.includes("II-SRC-002")
    ) {
      fail(`${definition.evidencePath} musical artifact lacks explicit public-rights scope`);
    }
    artifactIds.add(artifact.artifactId);
    if (
      artifact.path !== path.posix.normalize(artifact.path) ||
      !artifact.path.startsWith(`${path.dirname(definition.evidencePath)}/`) ||
      artifact.path === definition.evidencePath ||
      path.posix.relative(evidenceDirectory, artifact.path).startsWith("../")
    ) {
      fail(`${definition.evidencePath} public artifact path/digest is invalid`);
    }
    requireCommittedRegularFile(generation.implementationCommit, artifact.path);
    const committedArtifactBytes = gitBytesAt(generation.implementationCommit, artifact.path);
    if (digest(committedArtifactBytes) !== artifact.sha256) {
      fail(`${artifact.path} differs from its implementation commit`);
    }
    const payload = validatePublicArtifactPayload(
      artifact,
      committedArtifactBytes,
      artifact.path,
      artifact.schemaId === "vellum.public-review-receipt.v1"
        ? reviewAuthorityOptionsFor(generation)
        : null
    );
    artifactPayloads.set(artifact.artifactId, payload);
    artifactReceipts.set(artifact.artifactId, { artifact, payload });
    allowedCommittedFiles.add(artifact.path);
  }
  for (const artifactId of referencedArtifactIds) {
    if (!artifactIds.has(artifactId)) {
      fail(`${definition.evidencePath} gate references missing public artifact ${artifactId}`);
    }
  }
  for (const gate of evidence.gateReceipts) {
    const provesGate = gate.artifactIds.some((artifactId) => {
      const payload = artifactPayloads.get(artifactId);
      return Boolean(
        payload &&
        payload.outputDigest === gate.publicResultDigest &&
        payload.status === gate.status &&
        (!payload.commandDigest || payload.commandDigest === digest(gate.command))
      );
    });
    if (generation.issueCompletion === "complete" && !provesGate) {
      fail(`${definition.evidencePath} gate ${gate.command} lacks a matching typed artifact`);
    }
  }
  for (const artifactId of artifactIds) {
    if (!referencedArtifactIds.has(artifactId)) {
      fail(`${definition.evidencePath} lists unreferenced artifact ${artifactId}`);
    }
  }
  for (const committedPath of gitFilesUnder(generation.implementationCommit, evidenceDirectory)) {
    requireCommittedRegularFile(generation.implementationCommit, committedPath);
    if (!allowedCommittedFiles.has(committedPath)) {
      fail(`${committedPath} is unlisted public evidence and may leak private data`);
    }
  }

  if (!Array.isArray(evidence.vaultCommitments)) {
    fail(`${definition.evidencePath}.vaultCommitments must be an array`);
  }
  for (const commitment of evidence.vaultCommitments) {
    exactKeys(
      commitment,
      ["aggregateStatus", "caseId", "coverageClass", "requirementIds", "vaultCommitment"],
      `${definition.evidencePath} Vault commitment`
    );
    if (
      !/^case_[a-f0-9]{32,64}$/.test(commitment.caseId ?? "") ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(commitment.coverageClass ?? "") ||
      !/^hmac-sha256:v1:[a-z0-9_-]{1,32}:[A-Za-z0-9_-]{43,86}$/.test(
        commitment.vaultCommitment ?? ""
      ) ||
      !aggregateStatuses.has(commitment.aggregateStatus) ||
      !Array.isArray(commitment.requirementIds) ||
      commitment.requirementIds.some((requirementId) => !requirementRows.has(requirementId))
    ) {
      fail(`${definition.evidencePath} contains an invalid bounded Vault commitment`);
    }
  }

  if (!Array.isArray(evidence.redactions)) {
    fail(`${definition.evidencePath}.redactions must be an array`);
  }
  for (const redaction of evidence.redactions) {
    exactKeys(redaction, ["fieldClass", "status"], `${definition.evidencePath} redaction`);
    if (!privateClasses.has(redaction.fieldClass) || redaction.status !== "withheld") {
      fail(`${definition.evidencePath} contains an invalid redaction receipt`);
    }
  }
  return { evidence, artifactReceipts };
}

function validateEvidenceReceipt(evidenceBytes, generation, definition) {
  let evidence;
  try {
    evidence = JSON.parse(evidenceBytes.toString("utf8"));
  } catch {
    fail(`${definition.evidencePath} must contain canonical typed JSON`);
  }
  try {
    validateEvidenceReceiptV2(evidence, definition.evidencePath);
  } catch (error) {
    fail(error.message);
  }

  const tracerTag = `T${String(generation.tracerId).padStart(2, "0")}`;
  if (
    evidence.schemaId !== EVIDENCE_RECEIPT_SCHEMA_ID ||
    evidence.startReceipt.start.tracerId !== tracerTag ||
    evidence.startReceipt.start.generation !== generation.generation ||
    evidence.startReceipt.definition.path !== generation.definitionPath ||
    evidence.startReceipt.definition.sha256 !== generation.definitionDigest ||
    evidence.startReceipt.definition.gateMatrixDigest !== definition.gateMatrixDigest ||
    evidence.startReceipt.definition.completionSemantics !== definition.completionSemantics ||
    JSON.stringify(evidence.startReceipt) !== JSON.stringify(generation.startReceipt)
  ) {
    fail(`${definition.evidencePath} start receipt differs from its immutable generation binding`);
  }

  const disposition = generation.resultDisposition;
  const expectedDispatchArtifactIds =
    disposition.disposition === "repair_dispatch"
      ? evidence.outcome.resultDisposition.dispatchArtifactIds
      : [];
  if (
    evidence.outcome.issueCompletion !== generation.issueCompletion ||
    evidence.outcome.productAcceptance !== generation.productAcceptance ||
    evidence.outcome.applicability !== generation.applicability ||
    evidence.outcome.comparison !== generation.comparison ||
    evidence.outcome.freshness !== generation.freshness ||
    evidence.outcome.compatibility !== generation.compatibility ||
    evidence.outcome.authorityValidity !== generation.authorityValidity ||
    JSON.stringify(evidence.outcome.supersedes) !== JSON.stringify(generation.supersedes) ||
    JSON.stringify(evidence.outcome.invalidates) !== JSON.stringify(generation.invalidates) ||
    evidence.outcome.resultDisposition.code !== generation.resultCode ||
    evidence.outcome.resultDisposition.disposition !== disposition.disposition ||
    (disposition.disposition !== "repair_dispatch" &&
      evidence.outcome.resultDisposition.dispatchArtifactIds.length !== 0) ||
    disposition.dispatchCount !== expectedDispatchArtifactIds.length
  ) {
    fail(`${definition.evidencePath} outcome differs from its typed generation disposition`);
  }

  const receivedCommands = { focused: [], base: [], conditional: [] };
  const gateByArtifactId = new Map();
  for (const gate of evidence.gates) {
    receivedCommands[gate.group].push(gate.command);
    if (gateByArtifactId.has(gate.reportArtifactId)) {
      fail(`${definition.evidencePath} reuses one gate artifact across multiple commands`);
    }
    gateByArtifactId.set(gate.reportArtifactId, gate);
  }
  for (const group of ["focused", "base"]) {
    if (
      JSON.stringify(receivedCommands[group]) !==
      JSON.stringify(definition.expectedGateCommands[group])
    ) {
      fail(`${definition.evidencePath} lacks exact ordered ${group} gate coverage`);
    }
  }
  const conditionalApplicable = generation.applicability === "applicable";
  const expectedConditionalCommands = conditionalApplicable
    ? definition.expectedGateCommands.conditional
    : [];
  if (
    JSON.stringify(receivedCommands.conditional) !== JSON.stringify(expectedConditionalCommands)
  ) {
    fail(`${definition.evidencePath} conditional gate coverage contradicts applicability`);
  }
  if (
    generation.issueCompletion === "complete" &&
    evidence.gates.some((gate) => gate.status !== "pass")
  ) {
    fail(`${definition.evidencePath} cannot complete with a nonpassing gate`);
  }

  const artifactReceipts = new Map();
  const allowedCommittedFiles = new Set([definition.evidencePath]);
  const evidenceDirectory = path.posix.dirname(definition.evidencePath);
  for (const artifact of evidence.artifacts) {
    if (artifact.requirementIds.some((requirementId) => !requirementRows.has(requirementId))) {
      fail(`${artifact.publicPath} names an unknown requirement family`);
    }
    requireCommittedRegularFile(generation.implementationCommit, artifact.publicPath);
    const artifactBytes = gitBytesAt(generation.implementationCommit, artifact.publicPath);
    if (digest(artifactBytes) !== artifact.sha256) {
      fail(`${artifact.publicPath} differs from its implementation commit receipt`);
    }
    const compatibilityArtifact = { ...artifact, path: artifact.publicPath };
    const payload = validatePublicArtifactPayload(
      compatibilityArtifact,
      artifactBytes,
      artifact.publicPath,
      artifact.schemaId === "vellum.public-review-receipt.v1"
        ? reviewAuthorityOptionsFor(generation)
        : null
    );
    artifactReceipts.set(artifact.artifactId, {
      artifact: compatibilityArtifact,
      payload,
    });
    allowedCommittedFiles.add(artifact.publicPath);
  }

  for (const [artifactId, gate] of gateByArtifactId) {
    const receipt = artifactReceipts.get(artifactId);
    const payload = receipt?.payload;
    if (
      !receipt ||
      !new Set(["vellum.test-report.v1", "vellum.sanitized-gate-log.v1"]).has(
        receipt.artifact.schemaId
      ) ||
      payload?.status !== gate.status ||
      payload?.commandDigest !== gate.commandDigest ||
      payload?.passed !== gate.counts.passed ||
      payload?.failed !== gate.counts.failed ||
      payload?.skipped !== gate.counts.skipped ||
      payload?.blocked !== gate.counts.blocked ||
      payload?.incomplete !== gate.counts.incomplete
    ) {
      fail(`${definition.evidencePath} gate ${gate.gateId} lacks an exact typed report artifact`);
    }
  }

  if (JSON.stringify(evidence.claims) !== JSON.stringify(generation.clauseClaims)) {
    fail(`${definition.evidencePath} clause claims differ from the generation receipt`);
  }
  let historicalClauseLedger;
  try {
    historicalClauseLedger = assertCanonicalClauseLedgerJson(
      gitBytesAt(generation.implementationCommit, clauseLedgerRepoPath).toString("utf8")
    );
  } catch (error) {
    fail(`${definition.evidencePath} historical clause ledger is invalid: ${error.message}`);
  }
  const clausesById = new Map(historicalClauseLedger.clauses.map((clause) => [clause.id, clause]));
  const clauseRecords = [];
  for (const claim of evidence.claims) {
    const clause = clausesById.get(claim.clauseId);
    if (
      !clause ||
      clause.contentDigest !== claim.clauseDigest ||
      clause.familyId !== claim.requirementId ||
      claim.contributor.subjectId !== tracerTag ||
      claim.contributor.role !== "evidence_contributor" ||
      !clause.evidenceContributors.includes(tracerTag) ||
      clause.implementationOwner === tracerTag ||
      clause.closureVerifier === tracerTag
    ) {
      fail(`${definition.evidencePath} contains an unauthorized or role-conflicted clause claim`);
    }
    clauseRecords.push({ clauseId: clause.id, claim });
  }

  const referencedArtifacts = new Set();
  for (const gate of evidence.gates) referencedArtifacts.add(gate.reportArtifactId);
  for (const claim of evidence.claims) {
    for (const artifactId of claim.evidenceArtifactIds) referencedArtifacts.add(artifactId);
  }
  for (const redaction of evidence.privacy.redactions) {
    referencedArtifacts.add(redaction.receiptArtifactId);
  }
  for (const receipt of evidence.mediaSanitization) referencedArtifacts.add(receipt.artifactId);
  for (const artifactId of expectedDispatchArtifactIds) referencedArtifacts.add(artifactId);
  for (const artifact of evidence.artifacts) {
    if (!referencedArtifacts.has(artifact.artifactId)) {
      fail(`${definition.evidencePath} lists unreferenced artifact ${artifact.artifactId}`);
    }
  }
  for (const expectedDispatchArtifactId of expectedDispatchArtifactIds) {
    const dispatch = artifactReceipts.get(expectedDispatchArtifactId);
    if (dispatch?.artifact.schemaId !== "vellum.remediation-dispatch.v1") {
      fail(`${definition.evidencePath} repair disposition lacks its typed dispatch artifact`);
    }
  }

  for (const committedPath of gitFilesUnder(generation.implementationCommit, evidenceDirectory)) {
    requireCommittedRegularFile(generation.implementationCommit, committedPath);
    if (!allowedCommittedFiles.has(committedPath)) {
      fail(`${committedPath} is unlisted public evidence and may leak private data`);
    }
  }
  return { evidence, artifactReceipts, clauseRecords };
}

const validatedEvidenceByGeneration = new Map();
function validateCommittedExecutionBinding(generation, definition) {
  const key = `${generation.tracerId}:${generation.generation}`;
  let parentCommit;
  try {
    const lineage = execFileSync(
      "git",
      ["rev-list", "--parents", "-n", "1", generation.implementationCommit],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    )
      .trim()
      .split(/\s+/);
    if (lineage.length !== 2) {
      fail(`${key} implementation/evidence commit must be one focused non-merge commit`);
    }
    parentCommit = lineage[1];
  } catch (error) {
    if (error?.message?.startsWith("Instrument Intelligence plan verification failed:")) {
      throw error;
    }
    fail(`${key} implementation commit lineage is unavailable`);
  }
  const startReceipt = generation.startReceipt;
  const historicalAuthorityPaths = startReceipt.authoritySnapshot.pathDigests.map(
    (entry) => entry.path
  );
  const historicalAuthorityDigestByPath = new Map(
    startReceipt.authoritySnapshot.pathDigests.map((entry) => [entry.path, entry.sha256])
  );
  if (
    startReceipt.publication.checkpoint.bootstrapAnchor.object !== bootstrapAnchorAtRead ||
    startReceipt.publication.checkpoint.trustPolicy.object !== trustPolicyObjectAtRead ||
    startReceipt.publication.checkpoint.trustedMain.object !== parentCommit ||
    startReceipt.publication.fetchedHead !== parentCommit ||
    startReceipt.publication.graphQlHead !== parentCommit ||
    startReceipt.execution.baseCommit !== parentCommit ||
    startReceipt.execution.productTreeDigest !== projectedProductTreeDigestAt(parentCommit)
  ) {
    fail(`${key} start receipt does not bind the exact trusted base and projected product tree`);
  }
  if (
    generation.remotePublicationReceipt.bootstrapAnchor !==
      startReceipt.publication.checkpoint.bootstrapAnchor.object ||
    generation.remotePublicationReceipt.trustPolicyObject !==
      startReceipt.publication.checkpoint.trustPolicy.object ||
    generation.remotePublicationReceipt.trustedMainAtStart !== parentCommit ||
    generation.remotePublicationReceipt.fetchedHead !== generation.implementationCommit ||
    generation.remotePublicationReceipt.graphQlHead !== generation.implementationCommit
  ) {
    fail(`${key} publication receipt does not close the exact start checkpoint and pushed commit`);
  }
  const committedPaths = [
    definition.evidencePath,
    generation.definitionPath,
    manifestRepoPath,
    ...historicalAuthorityPaths,
  ];
  for (const committedPath of committedPaths) {
    requireCommittedRegularFile(generation.implementationCommit, committedPath);
  }
  for (const immutablePath of [
    generation.definitionPath,
    manifestRepoPath,
    ...historicalAuthorityPaths,
  ]) {
    requireCommittedRegularFile(parentCommit, immutablePath);
    if (
      !gitBytesAt(parentCommit, immutablePath).equals(
        gitBytesAt(generation.implementationCommit, immutablePath)
      )
    ) {
      fail(`${key} changed ${immutablePath} during implementation instead of pre-registering it`);
    }
  }
  for (const [governedPath, expectedDigest] of historicalAuthorityDigestByPath) {
    if (
      digest(gitBytesAt(generation.implementationCommit, governedPath)) !== expectedDigest ||
      digest(gitBytesAt(parentCommit, governedPath)) !== expectedDigest
    ) {
      fail(`${key} historical authority path ${governedPath} differs from its start receipt`);
    }
  }
  const committedEvidenceBytes = gitBytesAt(
    generation.implementationCommit,
    definition.evidencePath
  );
  if (digest(committedEvidenceBytes) !== generation.evidenceDigest) {
    fail(`${key} evidence is not the exact blob in its implementation commit`);
  }
  if (
    digest(gitBytesAt(generation.implementationCommit, generation.definitionPath)) !==
    generation.definitionDigest
  ) {
    fail(`${key} definition bytes do not exist in its implementation commit`);
  }
  const committedSpec = gitBytesAt(generation.implementationCommit, "SPEC.md");
  const committedPlan = gitBytesAt(
    generation.implementationCommit,
    ".scratch/instrument-intelligence/PLAN.md"
  );
  const committedRequirements = gitBytesAt(
    generation.implementationCommit,
    ".scratch/instrument-intelligence/REQUIREMENTS.md"
  );
  const committedManifest = gitJsonAt(generation.implementationCommit, manifestRepoPath, {
    required: true,
  });
  const committedVerifierPaths = committedManifest.authorities?.verifier?.paths ?? [];
  const committedDomainModelPaths = committedManifest.authorities?.domainModel?.paths ?? [];
  const committedVerifierDigest = authorityBundleDigest(committedVerifierPaths, (governedPath) =>
    gitBytesAt(generation.implementationCommit, governedPath)
  );
  const committedDomainModelDigest = authorityBundleDigest(
    committedDomainModelPaths,
    (governedPath) => gitBytesAt(generation.implementationCommit, governedPath)
  );
  const snapshot = generation.authoritySnapshot;
  if (
    digest(committedSpec) !== snapshot.specificationDigest ||
    digest(committedPlan) !== snapshot.planDigest ||
    planNarrativeDigestFor(committedPlan.toString("utf8")) !== snapshot.planNarrativeDigest ||
    digest(committedRequirements) !== snapshot.requirementFamilyIndexDigest ||
    digest(gitBytesAt(generation.implementationCommit, clauseLedgerRepoPath)) !==
      snapshot.clauseLedgerDigest ||
    committedManifest.authorities?.protocolSchemas?.digest !== snapshot.schemaRegistryDigest ||
    committedVerifierDigest !== snapshot.verifierDigest ||
    committedDomainModelDigest !== snapshot.domainModelDigest ||
    startReceipt.authoritySnapshot.authoritySetDigest !== snapshot.authoritySetDigest
  ) {
    fail(`${key} authoritySnapshot does not match its implementation commit`);
  }
  const committedTracer = committedManifest?.tracers?.find(
    (tracer) => tracer.id === generation.tracerId
  );
  if (
    !supportedManifest(committedManifest) ||
    committedManifest.authorities?.specification?.digest !== snapshot.specificationDigest ||
    committedManifest.authorities?.plan?.digest !== snapshot.planDigest ||
    committedManifest.authorities?.plan?.narrativeDigest !== snapshot.planNarrativeDigest ||
    committedManifest.authorities?.requirementFamilyIndex?.digest !==
      snapshot.requirementFamilyIndexDigest ||
    committedManifest.authorities?.requirementClauseLedger?.digest !==
      snapshot.clauseLedgerDigest ||
    committedManifest.authorities?.protocolSchemas?.digest !== snapshot.schemaRegistryDigest ||
    committedManifest.authorities?.verifier?.digest !== snapshot.verifierDigest ||
    committedManifest.authorities?.domainModel?.digest !== snapshot.domainModelDigest ||
    committedManifest.authorityHistory?.currentAuthoritySetDigest !== snapshot.authoritySetDigest ||
    !committedManifest.authorityHistory?.authoritySets?.some(
      (authoritySet) =>
        authoritySet.authoritySetDigest === snapshot.authoritySetDigest &&
        JSON.stringify(authoritySet.pathDigests) ===
          JSON.stringify(startReceipt.authoritySnapshot.pathDigests)
    ) ||
    committedManifest.idPolicy?.registryHead !== snapshot.registryHead ||
    committedManifest.idPolicy?.tombstoneSetDigest !== snapshot.tombstoneSetDigest ||
    committedTracer?.definitionDigest !== generation.definitionDigest ||
    committedTracer?.file !== generation.definitionPath
  ) {
    fail(`${key} is not bound to its committed authority and registry state`);
  }
  const committedGenerationKeys = new Set(
    (committedManifest.executionGenerations ?? []).map(
      (receipt) => `${receipt.tracerId}:${receipt.generation}`
    )
  );
  for (const predecessor of generation.predecessors) {
    if (!committedGenerationKeys.has(`${predecessor.tracerId}:${predecessor.generation}`)) {
      fail(`${key} predecessor was not anchored before its implementation commit`);
    }
  }
  for (const predecessor of startReceipt.predecessors) {
    const predecessorManifest = gitJsonAt(predecessor.receiptCommit, manifestRepoPath, {
      required: true,
    });
    const predecessorKey = `${Number(predecessor.tracerId.slice(1))}:${predecessor.generation}`;
    if (
      !isFirstParentAncestor(predecessor.receiptCommit, parentCommit) ||
      !(predecessorManifest.executionGenerations ?? []).some(
        (receipt) => `${receipt.tracerId}:${receipt.generation}` === predecessorKey
      )
    ) {
      fail(`${key} predecessor start witness is not an exact pushed ancestor receipt commit`);
    }
  }
  if (!registryEvents.some((event) => event.head === snapshot.registryHead)) {
    fail(`${key} authoritySnapshot registry head is not an ancestor of the current registry`);
  }
  const validatedEvidence = validateEvidenceReceipt(committedEvidenceBytes, generation, definition);
  validatedEvidenceByGeneration.set(key, validatedEvidence);
  const committedAt = Date.parse(
    execFileSync("git", ["show", "-s", "--format=%cI", generation.implementationCommit], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  );
  if (
    Date.parse(validatedEvidence.evidence.finishedAt) > committedAt ||
    Date.parse(generation.remotePublicationReceipt.checkedAt) < committedAt ||
    Date.parse(generation.remotePublicationReceipt.checkedAt) > Date.now() + 5 * 60 * 1000
  ) {
    fail(`${key} evidence/remote timestamps contradict commit and reachability order`);
  }
}

const originMainReachability = new Map();
function commitIsReachableFromOriginMain(commit) {
  if (originMainReachability.has(commit)) return originMainReachability.get(commit);
  let reachable = false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "origin/main"], {
      cwd: root,
      stdio: "ignore",
    });
    reachable = true;
  } catch {
    reachable = false;
  }
  originMainReachability.set(commit, reachable);
  return reachable;
}

const tombstoneById = new Map(tombstones.map((tombstone) => [tombstone.id, tombstone]));
function registeredDefinition(tracerId) {
  return byId.get(tracerId) ?? tombstoneById.get(tracerId)?.definitionSnapshot;
}

const generationKeys = new Set();
const generationsByTracer = new Map();
const baseExecutionGenerationKeys = [
  "applicability",
  "authoritySnapshot",
  "authorityValidity",
  "comparison",
  "compatibility",
  "clauseClaims",
  "definitionDigest",
  "definitionPath",
  "evidenceDigest",
  "evidenceGeneration",
  "freshness",
  "generation",
  "implementationCommit",
  "invalidates",
  "issueCompletion",
  "predecessors",
  "productAcceptance",
  "remotePublicationReceipt",
  "resultCode",
  "resultDisposition",
  "startReceipt",
  "supersedes",
  "tracerId",
];
const dynamicExecutionGenerationKeys = [
  ...baseExecutionGenerationKeys,
  "closureTargets",
  "dispatch",
  "invalidatesMachineComplete",
  "invalidationScopes",
  "remediationObligationId",
  "rejoinAt",
];
for (const generation of executionGenerations) {
  const dynamicGeneration = generation?.tracerId > baseWaveHighestId;
  exactKeys(
    generation,
    dynamicGeneration ? dynamicExecutionGenerationKeys : baseExecutionGenerationKeys,
    `execution generation T${generation?.tracerId}:${generation?.generation}`
  );
  if (
    !registeredDefinition(generation.tracerId) ||
    !Number.isInteger(generation.generation) ||
    generation.generation < 1 ||
    typeof generation.definitionDigest !== "string" ||
    !Array.isArray(generation.predecessors)
  ) {
    fail("executionGenerations contains an invalid tracer/generation identity");
  }
  const key = `${generation.tracerId}:${generation.generation}`;
  if (generationKeys.has(key)) fail(`duplicate execution generation ${key}`);
  generationKeys.add(key);
  const tracerDefinition = registeredDefinition(generation.tracerId);
  try {
    validateStartReceiptV1(generation.startReceipt, `execution generation ${key}.startReceipt`);
  } catch (error) {
    fail(error.message);
  }
  const boundRegistryEvent = registryEvents.find(
    (event) => event.head === generation.authoritySnapshot?.registryHead
  );
  if (
    generation.startReceipt.start.tracerId !== `T${String(generation.tracerId).padStart(2, "0")}` ||
    generation.startReceipt.start.generation !== generation.generation ||
    generation.startReceipt.definition.path !== generation.definitionPath ||
    generation.startReceipt.definition.sha256 !== generation.definitionDigest ||
    generation.startReceipt.definition.gateMatrixDigest !== tracerDefinition?.gateMatrixDigest ||
    generation.startReceipt.authoritySnapshot.authoritySetDigest !==
      generation.authoritySnapshot.authoritySetDigest ||
    generation.startReceipt.registry.generation !== boundRegistryEvent?.generation ||
    generation.startReceipt.registry.registryHead !== generation.authoritySnapshot.registryHead ||
    generation.startReceipt.registry.tombstoneSetDigest !==
      generation.authoritySnapshot.tombstoneSetDigest ||
    generation.startReceipt.registry.baseWaveHighestId !== baseWaveHighestId
  ) {
    fail(`execution generation ${key} start receipt differs from its immutable generation binding`);
  }
  const startPredecessors = generation.startReceipt.predecessors.map((predecessor) => ({
    tracerId: Number(predecessor.tracerId.slice(1)),
    generation: predecessor.generation,
  }));
  if (JSON.stringify(startPredecessors) !== JSON.stringify(generation.predecessors)) {
    fail(`execution generation ${key} predecessor list differs from its start receipt`);
  }
  exactKeys(
    generation.resultDisposition,
    [
      "applicability",
      "dispatchCount",
      "disposition",
      "productAcceptance",
      "resultCode",
      "tracerId",
    ],
    `execution generation ${key}.resultDisposition`
  );
  if (
    generation.resultDisposition.tracerId !== generation.tracerId ||
    generation.resultDisposition.resultCode !== generation.resultCode ||
    generation.resultDisposition.productAcceptance !== generation.productAcceptance ||
    generation.resultDisposition.applicability !== generation.applicability
  ) {
    fail(`execution generation ${key} result disposition contradicts its outcome axes`);
  }
  if (TRACER_RESULT_CONTRACTS[generation.tracerId]) {
    try {
      validateResultDisposition(generation.resultDisposition);
    } catch (error) {
      fail(error.message);
    }
  } else if (
    generation.resultCode !== "implementation_passed" ||
    generation.productAcceptance !== "pass" ||
    generation.resultDisposition.disposition !== "unlock" ||
    generation.resultDisposition.dispatchCount !== 0
  ) {
    fail(`execution generation ${key} lacks the exact ordinary implementation-pass disposition`);
  }
  if (!Array.isArray(generation.clauseClaims)) {
    fail(`execution generation ${key}.clauseClaims must be an array`);
  }
  if (generation.definitionDigest !== tracerDefinition.definitionDigest) {
    fail(`execution generation ${key} does not bind its current immutable definition`);
  }
  if (
    generation.definitionPath !== tracerDefinition.file ||
    !new RegExp(
      `^\\.scratch/instrument-intelligence/issues/${String(generation.tracerId).padStart(2, "0")}-[^/]+\\.md$`
    ).test(generation.definitionPath)
  ) {
    fail(`execution generation ${key} has a noncanonical definitionPath`);
  }
  validateAuthoritySnapshot(generation.authoritySnapshot, `execution generation ${key}`);
  if (
    !Number.isInteger(generation.evidenceGeneration) ||
    generation.evidenceGeneration < 1 ||
    !/^[a-f0-9]{64}$/.test(generation.evidenceDigest ?? "")
  ) {
    fail(`execution generation ${key} lacks a positive evidence generation and digest`);
  }
  if (!validCommit(generation.implementationCommit)) {
    fail(`execution generation ${key} lacks a full implementation commit`);
  }
  if (
    !validPublicationReceipt(generation.remotePublicationReceipt, generation.implementationCommit)
  ) {
    fail(`execution generation ${key} lacks an origin/main reachability receipt`);
  }
  if (!commitIsReachableFromOriginMain(generation.implementationCommit)) {
    fail(`execution generation ${key} implementation commit is not reachable from origin/main`);
  }
  if (!allowedIssueCompletionStates.has(generation.issueCompletion)) {
    fail(`execution generation ${key} has invalid issueCompletion`);
  }
  if (!allowedProductAcceptanceStates.has(generation.productAcceptance)) {
    fail(`execution generation ${key} has invalid productAcceptance`);
  }
  if (!allowedApplicabilityStates.has(generation.applicability)) {
    fail(`execution generation ${key} has invalid applicability`);
  }
  if (!allowedComparisonStates.has(generation.comparison)) {
    fail(`execution generation ${key} has invalid comparison`);
  }
  if (!allowedFreshnessStates.has(generation.freshness)) {
    fail(`execution generation ${key} has invalid freshness`);
  }
  if (!allowedCompatibilityStates.has(generation.compatibility)) {
    fail(`execution generation ${key} has invalid compatibility`);
  }
  if (!allowedAuthorityValidityStates.has(generation.authorityValidity)) {
    fail(`execution generation ${key} has invalid authorityValidity`);
  }
  if (
    generation.resultCode !== null &&
    (typeof generation.resultCode !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(generation.resultCode))
  ) {
    fail(`execution generation ${key} has an invalid resultCode`);
  }
  if (
    generation.tracerId === 86 &&
    !new Set(["provisional_stop_current", "provisional_stop_resumed"]).has(generation.resultCode)
  ) {
    fail(`${key} Owner decision has an unrecognized resultCode`);
  }
  const exactResultCodes = exactAttemptResultCodes.get(generation.tracerId);
  if (exactResultCodes && !exactResultCodes.has(generation.resultCode)) {
    fail(`${key} adjudication has an unrecognized resultCode`);
  }
  const passingAttemptCode = passingAttemptResultCodes.get(generation.tracerId);
  if (
    passingAttemptCode &&
    (generation.resultCode === passingAttemptCode) !== (generation.productAcceptance === "pass")
  ) {
    fail(`${key} adjudication resultCode contradicts productAcceptance`);
  }
  if (!Array.isArray(generation.supersedes) || !Array.isArray(generation.invalidates)) {
    fail(`execution generation ${key} requires typed supersedes and invalidates arrays`);
  }
  const seenPredecessors = new Set();
  for (const predecessor of generation.predecessors) {
    exactKeys(predecessor, ["generation", "tracerId"], `${key} predecessor`);
    if (
      !Number.isInteger(predecessor?.tracerId) ||
      predecessor.tracerId < 1 ||
      !Number.isInteger(predecessor?.generation) ||
      predecessor.generation < 1
    ) {
      fail(`execution generation ${key} has an invalid predecessor reference`);
    }
    const predecessorKey = `${predecessor.tracerId}:${predecessor.generation}`;
    if (predecessorKey === key || seenPredecessors.has(predecessorKey)) {
      fail(`execution generation ${key} has a self or duplicate predecessor`);
    }
    seenPredecessors.add(predecessorKey);
  }
  if (
    generation.generation > 1 &&
    !seenPredecessors.has(`${generation.tracerId}:${generation.generation - 1}`)
  ) {
    fail(`execution generation ${key} must descend directly from its prior tracer generation`);
  }
  validateCommittedExecutionBinding(generation, tracerDefinition);
  const tracerGenerations = generationsByTracer.get(generation.tracerId) ?? [];
  tracerGenerations.push(generation.generation);
  generationsByTracer.set(generation.tracerId, tracerGenerations);
}
for (const [tracerId, tracerGenerations] of generationsByTracer) {
  tracerGenerations.sort((left, right) => left - right);
  const expected = Array.from({ length: tracerGenerations.length }, (_, index) => index + 1);
  if (tracerGenerations.join(",") !== expected.join(",")) {
    fail(`T${tracerId} execution generations must be contiguous from generation 1`);
  }
}
if (newlyAppendedExecutionGenerations.length === 1) {
  const generation = newlyAppendedExecutionGenerations[0];
  const expectedImplementationCommit = draftMode
    ? originMainCommitAtRead
    : singleParent(originMainCommitAtRead, "receipt-manifest commit");
  const expectedAnchorCommit = draftMode
    ? currentManifestChangingCommit
    : priorManifestChangingCommit;
  const implementationParent = singleParent(
    generation.implementationCommit,
    `T${generation.tracerId}:${generation.generation} implementation/evidence commit`
  );
  if (
    generation.implementationCommit !== expectedImplementationCommit ||
    !expectedAnchorCommit ||
    implementationParent !== expectedAnchorCommit ||
    !gitBytesAt(implementationParent, manifestRepoPath).equals(
      gitBytesAt(expectedAnchorCommit, manifestRepoPath)
    )
  ) {
    fail(
      `T${generation.tracerId}:${generation.generation} was not implemented directly from the exact trusted manifest tip`
    );
  }
}
for (const generation of executionGenerations) {
  for (const predecessor of generation.predecessors ?? []) {
    if (!generationKeys.has(`${predecessor.tracerId}:${predecessor.generation}`)) {
      fail(
        `execution generation T${generation.tracerId}:${generation.generation} has missing predecessor`
      );
    }
  }
}
const generationByKey = new Map(
  executionGenerations.map((generation) => [
    `${generation.tracerId}:${generation.generation}`,
    generation,
  ])
);
const generationVisiting = new Set();
const generationVisited = new Set();
function visitGeneration(key, trail = []) {
  if (generationVisiting.has(key)) {
    fail(`temporal execution-generation cycle: ${[...trail, key].join(" -> ")}`);
  }
  if (generationVisited.has(key)) return;
  generationVisiting.add(key);
  for (const predecessor of generationByKey.get(key)?.predecessors ?? []) {
    visitGeneration(`${predecessor.tracerId}:${predecessor.generation}`, [...trail, key]);
  }
  generationVisiting.delete(key);
  generationVisited.add(key);
}
for (const key of generationByKey.keys()) visitGeneration(key);

function isStrictTemporalDescendant(descendantKey, ancestorKey) {
  if (descendantKey === ancestorKey) return false;
  const queue = [descendantKey];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const predecessor of generationByKey.get(current)?.predecessors ?? []) {
      const predecessorKey = `${predecessor.tracerId}:${predecessor.generation}`;
      if (predecessorKey === ancestorKey) return true;
      queue.push(predecessorKey);
    }
  }
  return false;
}

const supersededGenerationKeys = new Set();
const invalidatedGenerationKeys = new Set();
const invalidatedByGeneration = new Map();
const stateEdges = [];
let stateEdgeHead = null;
function appendStateEdge(kind, source, target, scopes, reasonCode) {
  const payload = {
    sequence: stateEdges.length + 1,
    previousHead: stateEdgeHead,
    kind,
    source,
    target,
    scopes,
    reasonCode,
  };
  const edge = { ...payload, head: digest(JSON.stringify(payload)) };
  stateEdges.push(edge);
  stateEdgeHead = edge.head;
}
for (const generation of executionGenerations) {
  const source = { tracerId: generation.tracerId, generation: generation.generation };
  const sourceKey = `${source.tracerId}:${source.generation}`;
  const seenTargets = new Set();
  for (const supersession of generation.supersedes) {
    exactKeys(supersession, ["reasonCode", "target"], `${sourceKey} supersession edge`);
    exactKeys(supersession.target, ["generation", "tracerId"], `${sourceKey} supersession target`);
    const targetKey = `${supersession.target.tracerId}:${supersession.target.generation}`;
    if (
      supersession.target.tracerId !== generation.tracerId ||
      !generationByKey.has(targetKey) ||
      !isStrictTemporalDescendant(sourceKey, targetKey) ||
      supersededGenerationKeys.has(targetKey) ||
      seenTargets.has(targetKey) ||
      !stateEdgeReasonCodes.has(supersession.reasonCode)
    ) {
      fail(`${sourceKey} has an invalid or duplicate supersession edge`);
    }
    seenTargets.add(targetKey);
    supersededGenerationKeys.add(targetKey);
    appendStateEdge(
      "supersedes",
      source,
      supersession.target,
      ["issue", "evidence"],
      supersession.reasonCode
    );
  }
  for (const invalidation of generation.invalidates) {
    exactKeys(invalidation, ["reasonCode", "scopes", "target"], `${sourceKey} invalidation edge`);
    exactKeys(invalidation.target, ["generation", "tracerId"], `${sourceKey} invalidation target`);
    const targetKey = `${invalidation.target.tracerId}:${invalidation.target.generation}`;
    if (
      !generationByKey.has(targetKey) ||
      !isStrictTemporalDescendant(sourceKey, targetKey) ||
      seenTargets.has(targetKey) ||
      invalidation.target.tracerId > baseWaveHighestId ||
      !Array.isArray(invalidation.scopes) ||
      !invalidation.scopes.length ||
      new Set(invalidation.scopes).size !== invalidation.scopes.length ||
      invalidation.scopes.some((scope) => !invalidationScopes.has(scope)) ||
      !stateEdgeReasonCodes.has(invalidation.reasonCode)
    ) {
      fail(`${sourceKey} has an invalid or duplicate invalidation edge`);
    }
    seenTargets.add(targetKey);
    invalidatedGenerationKeys.add(targetKey);
    const incoming = invalidatedByGeneration.get(targetKey) ?? [];
    incoming.push(source);
    invalidatedByGeneration.set(targetKey, incoming);
    appendStateEdge(
      "invalidates",
      source,
      invalidation.target,
      invalidation.scopes,
      invalidation.reasonCode
    );
  }
}

function generationIsActive(key) {
  return !supersededGenerationKeys.has(key) && !invalidatedGenerationKeys.has(key);
}

for (const [tracerId, tracerGenerations] of generationsByTracer) {
  if (!byId.has(tracerId)) {
    if (!tombstoneById.has(tracerId)) fail(`unregistered historical generation for T${tracerId}`);
  }
}

function currentGenerationFor(tracerId) {
  return generationsByTracer.get(tracerId)?.at(-1) ?? null;
}

const manifestAtCommitCache = new Map();
const receiptCommitIndexCache = new Map();

function manifestAtCommit(commit) {
  if (!manifestAtCommitCache.has(commit)) {
    manifestAtCommitCache.set(commit, gitJsonAt(commit, manifestRepoPath, { required: true }));
  }
  return manifestAtCommitCache.get(commit);
}

function receiptCommitIndexAt(baseCommit) {
  if (receiptCommitIndexCache.has(baseCommit)) return receiptCommitIndexCache.get(baseCommit);
  const index = new Map();
  for (const receiptCommit of [...manifestChangingCommits(baseCommit)].reverse()) {
    const historicalManifest = manifestAtCommit(receiptCommit);
    for (const generation of historicalManifest?.executionGenerations ?? []) {
      const key = `${generation.tracerId}:${generation.generation}`;
      if (index.has(key)) continue;
      const receiptParent = singleParent(receiptCommit, `${key} receipt-manifest commit`);
      if (
        generation.implementationCommit !== receiptParent ||
        JSON.stringify(changedPaths(receiptCommit)) !== JSON.stringify([manifestRepoPath])
      ) {
        fail(`${key} was not first recorded by one manifest-only receipt commit`);
      }
      index.set(key, receiptCommit);
    }
  }
  receiptCommitIndexCache.set(baseCommit, index);
  return index;
}

function usableGenerationAtBase(baseManifest, tracerId) {
  const tracer = baseManifest?.tracers?.find((candidate) => candidate.id === tracerId);
  const generationNumber = tracer?.currentExecutionGeneration;
  if (!Number.isInteger(generationNumber) || generationNumber < 1) return null;
  const generation = (baseManifest.executionGenerations ?? []).find(
    (candidate) => candidate.tracerId === tracerId && candidate.generation === generationNumber
  );
  if (
    !generation ||
    tracer.issueCompletion !== "complete" ||
    generation.issueCompletion !== "complete" ||
    generation.freshness !== "current" ||
    generation.compatibility !== "compatible" ||
    !["valid", "not_required"].includes(generation.authorityValidity)
  ) {
    return null;
  }
  return generation;
}

function exactStartPredecessorMap(startReceipt, context) {
  return new Map(
    startReceipt.predecessors.map((predecessor) => [
      `${Number(predecessor.tracerId.slice(1))}:${predecessor.generation}`,
      predecessor.receiptCommit,
    ])
  );
}

function validateExactStartWitnesses(generation, definition) {
  const key = `${generation.tracerId}:${generation.generation}`;
  const baseCommit = generation.startReceipt.execution.baseCommit;
  const baseManifest = manifestAtCommit(baseCommit);
  const receiptCommits = receiptCommitIndexAt(baseCommit);
  const predecessors = exactStartPredecessorMap(generation.startReceipt, `${key} start receipt`);
  const baseGenerationByKey = new Map(
    (baseManifest.executionGenerations ?? []).map((candidate) => [
      `${candidate.tracerId}:${candidate.generation}`,
      candidate,
    ])
  );
  const startDescendsFrom = (targetKey) => {
    const queue = [...predecessors.keys()];
    const seen = new Set();
    while (queue.length) {
      const candidateKey = queue.shift();
      if (candidateKey === targetKey) return true;
      if (seen.has(candidateKey)) continue;
      seen.add(candidateKey);
      for (const predecessor of baseGenerationByKey.get(candidateKey)?.predecessors ?? []) {
        queue.push(`${predecessor.tracerId}:${predecessor.generation}`);
      }
    }
    return false;
  };

  const requirePredecessor = (sourceGeneration, reason) => {
    const sourceKey = `${sourceGeneration.tracerId}:${sourceGeneration.generation}`;
    const receiptCommit = receiptCommits.get(sourceKey);
    if (!receiptCommit || predecessors.get(sourceKey) !== receiptCommit) {
      fail(`${key} lacks the exact first receipt commit for ${reason} ${sourceKey}`);
    }
  };

  for (const dependencyId of definition.blockedBy ?? []) {
    const dependency = usableGenerationAtBase(baseManifest, dependencyId);
    if (!dependency) fail(`${key} started before dependency T${dependencyId} was usable`);
    requirePredecessor(dependency, "dependency");
  }
  if (generation.generation > 1) {
    const prior = (baseManifest.executionGenerations ?? []).find(
      (candidate) =>
        candidate.tracerId === generation.tracerId &&
        candidate.generation === generation.generation - 1
    );
    if (!prior) fail(`${key} started without its prior tracer generation at the base`);
    requirePredecessor(prior, "prior tracer generation");
    if (
      !generation.supersedes.some(
        ({ target }) =>
          target.tracerId === generation.tracerId && target.generation === generation.generation - 1
      )
    ) {
      fail(`${key} rerun does not supersede its immediately prior tracer generation`);
    }
  } else if (generation.supersedes.length !== 0) {
    fail(`${key} first generation cannot supersede a prior run`);
  }

  for (const edge of [...generation.supersedes, ...generation.invalidates]) {
    const targetKey = `${edge.target.tracerId}:${edge.target.generation}`;
    if (!baseGenerationByKey.has(targetKey) || !startDescendsFrom(targetKey)) {
      fail(`${key} state edge does not descend from base generation ${targetKey}`);
    }
  }

  const expectedPredicateWitnesses = [];
  if (definition.resultPredicate) {
    expectedPredicateWitnesses.push(
      compileCanonicalPredicateWitness(
        definition.resultPredicate,
        ({ sourceTracer, generation: selector, field }) => {
          const source = baseManifest.tracers?.find((candidate) => candidate.id === sourceTracer);
          const sourceGenerationNumber = source?.currentExecutionGeneration;
          if (!Number.isInteger(sourceGenerationNumber) || sourceGenerationNumber < 1) {
            return {
              observed: undefined,
              sourceGeneration: null,
              sourceReceiptCommit: null,
              usable: selector === "latest_or_absent",
            };
          }
          const sourceGeneration = (baseManifest.executionGenerations ?? []).find(
            (candidate) =>
              candidate.tracerId === sourceTracer && candidate.generation === sourceGenerationNumber
          );
          const sourceKey = `${sourceTracer}:${sourceGenerationNumber}`;
          const sourceReceiptCommit = receiptCommits.get(sourceKey);
          if (!sourceGeneration || !sourceReceiptCommit) {
            fail(`${key} cannot resolve predicate source ${sourceKey} at its exact base`);
          }
          const usable = Boolean(
            source?.issueCompletion === "complete" &&
            sourceGeneration.issueCompletion === "complete" &&
            (field === "freshness" || sourceGeneration.freshness === "current") &&
            (field === "compatibility" || sourceGeneration.compatibility === "compatible") &&
            (field === "authorityValidity" ||
              ["valid", "not_required"].includes(sourceGeneration.authorityValidity))
          );
          return {
            observed: sourceGeneration[field],
            sourceGeneration: sourceGenerationNumber,
            sourceReceiptCommit,
            usable,
          };
        },
        `${key} resultPredicate`
      )
    );
  }
  if (
    JSON.stringify(generation.startReceipt.predicateWitnesses) !==
    JSON.stringify(expectedPredicateWitnesses)
  ) {
    fail(`${key} start receipt does not contain the one canonical exact-base predicate witness`);
  }

  for (const claim of generation.clauseClaims) {
    const clause = clauseById.get(claim.clauseId);
    if (!clause) fail(`${key} claims unknown clause ${claim.clauseId}`);
    const ownerId = Number(clause.implementationOwner.slice(1));
    const owner = usableGenerationAtBase(baseManifest, ownerId);
    if (!owner) {
      fail(`${key} claims ${claim.clauseId} before owner ${clause.implementationOwner} is usable`);
    }
    requirePredecessor(owner, `${claim.clauseId} implementation owner`);
  }
}

function reviewAuthorityOptionsFor(generation) {
  const key = `${generation.tracerId}:${generation.generation}`;
  const baseCommit = generation.startReceipt.execution.baseCommit;
  const baseManifest = manifestAtCommit(baseCommit);
  const receiptCommits = receiptCommitIndexAt(baseCommit);
  const predecessors = exactStartPredecessorMap(generation.startReceipt, `${key} start receipt`);
  const catalog = reviewAuthorityCatalogAt(baseCommit);
  const catalogBytes = gitBytesAt(baseCommit, reviewAuthorityCatalogRepoPath);
  const catalogPathDigest = generation.startReceipt.authoritySnapshot.pathDigests.find(
    ({ path: governedPath }) => governedPath === reviewAuthorityCatalogRepoPath
  )?.sha256;
  if (catalogPathDigest !== digest(catalogBytes)) {
    fail(`${key} authority catalog differs from its exact start authority snapshot`);
  }
  const validateCatalogSource = (source, expectedEvidenceDigest, sourceContext) => {
    const sourceKey = `${source.tracerId}:${source.generation}`;
    const sourceGeneration = (baseManifest.executionGenerations ?? []).find(
      (candidate) => `${candidate.tracerId}:${candidate.generation}` === sourceKey
    );
    if (
      !sourceGeneration ||
      sourceGeneration.evidenceDigest !== expectedEvidenceDigest ||
      receiptCommits.get(sourceKey) !== source.receiptCommit
    ) {
      fail(`${sourceContext} is not an exact historical receipt generation`);
    }
  };
  for (const credential of catalog.credentials) {
    validateCatalogSource(
      credential.registration,
      credential.registration.artifactDigest,
      `${key} credential ${credential.credentialId} registration`
    );
  }
  for (const revocation of catalog.revocations) {
    validateCatalogSource(
      revocation.source,
      revocation.source.evidenceDigest,
      `${key} credential ${revocation.credentialId} revocation`
    );
  }

  const consumerTag = `T${String(generation.tracerId).padStart(2, "0")}`;
  const matchingConsumers = [];
  for (const [predecessorKey] of predecessors) {
    const predecessor = (baseManifest.executionGenerations ?? []).find(
      (candidate) => `${candidate.tracerId}:${candidate.generation}` === predecessorKey
    );
    const predecessorTracer = baseManifest.tracers?.find(
      (candidate) => candidate.id === predecessor?.tracerId
    );
    const usablePredecessor = predecessor
      ? usableGenerationAtBase(baseManifest, predecessor.tracerId)
      : null;
    if (
      !predecessor ||
      usablePredecessor?.generation !== predecessor.generation ||
      predecessorTracer?.currentExecutionGeneration !== predecessor.generation
    ) {
      continue;
    }
    let predecessorEvidence;
    try {
      predecessorEvidence = JSON.parse(
        gitBytesAt(predecessor.implementationCommit, predecessorTracer.evidencePath).toString(
          "utf8"
        )
      );
      validateEvidenceReceiptV2(
        predecessorEvidence,
        `${predecessorKey} predecessor review-package evidence`
      );
    } catch (error) {
      if (error?.message?.startsWith("Instrument Intelligence plan verification failed:")) {
        throw error;
      }
      fail(`${predecessorKey} predecessor evidence cannot supply review subjects`);
    }
    for (const descriptor of predecessorEvidence.artifacts.filter(
      ({ schemaId }) => schemaId === "vellum.review-role-package.v1"
    )) {
      const rolePackageBytes = gitBytesAt(predecessor.implementationCommit, descriptor.publicPath);
      if (digest(rolePackageBytes) !== descriptor.sha256) {
        fail(`${descriptor.publicPath} role-package bytes differ from their descriptor`);
      }
      const rolePackage = validatePublicArtifactPayload(
        { ...descriptor, path: descriptor.publicPath },
        rolePackageBytes,
        descriptor.publicPath
      );
      for (const consumer of rolePackage.consumers.filter(
        ({ tracerId }) => tracerId === consumerTag
      )) {
        matchingConsumers.push({ consumer, predecessor, predecessorEvidence, predecessorKey });
      }
    }
  }
  if (matchingConsumers.length !== 1) {
    fail(`${key} requires exactly one predecessor-authored role package for ${consumerTag}`);
  }
  const {
    consumer,
    predecessor: packageProducer,
    predecessorEvidence: packageProducerEvidence,
  } = matchingConsumers[0];
  if (
    (generation.tracerId === 64 && packageProducer.tracerId !== 63) ||
    (generation.tracerId !== 64 && packageProducer.tracerId !== 81)
  ) {
    fail(`${key} role package comes from the wrong governed package producer`);
  }
  const producerArtifactById = new Map(
    packageProducerEvidence.artifacts.map((descriptor) => [descriptor.artifactId, descriptor])
  );
  for (const reference of [consumer.package, ...consumer.outputs]) {
    const descriptor = producerArtifactById.get(reference.id);
    if (
      !descriptor ||
      descriptor.sha256 !== reference.digest ||
      digest(gitBytesAt(packageProducer.implementationCommit, descriptor.publicPath)) !==
        reference.digest
    ) {
      fail(`${key} role package references uncommitted or mismatched artifact ${reference.id}`);
    }
  }
  if (consumer.outputs.some(({ id }) => id === consumer.package.id)) {
    fail(`${key} role package cannot reuse its package receipt as a reviewed output`);
  }
  const systemTracerId = Number(consumer.systemGeneration.tracerId.slice(1));
  const systemKey = `${systemTracerId}:${consumer.systemGeneration.generation}`;
  const systemGeneration = (baseManifest.executionGenerations ?? []).find(
    (candidate) => `${candidate.tracerId}:${candidate.generation}` === systemKey
  );
  const currentSystemGeneration = usableGenerationAtBase(baseManifest, systemTracerId);
  if (
    !systemGeneration ||
    currentSystemGeneration?.generation !== systemGeneration.generation ||
    receiptCommits.get(systemKey) !== consumer.systemGeneration.receiptCommit ||
    predecessors.get(systemKey) !== consumer.systemGeneration.receiptCommit ||
    systemGeneration.evidenceDigest !== consumer.systemGeneration.artifactDigest ||
    (generation.tracerId !== 64 && systemTracerId !== 85)
  ) {
    fail(`${key} role package does not bind its exact current system generation`);
  }
  const systemSubject = systemGeneration.startReceipt.execution.subjects.find(
    ({ kind, id }) => kind === "system" && id === consumer.system.id
  );
  if (systemSubject?.digest !== consumer.system.digest) {
    fail(`${key} role package system subject differs from its exact system generation`);
  }

  const credentialById = new Map(
    catalog.credentials.map((credential) => [credential.credentialId, credential])
  );
  return {
    catalog,
    baseManifest,
    baseCommit,
    executionStartedAt: generation.startReceipt.start.startedAt,
    receiptCommits,
    expectedSubjects: {
      outputs: consumer.outputs,
      package: consumer.package,
      system: consumer.system,
    },
    packageProducerBinding: {
      artifactDigest: packageProducer.evidenceDigest,
      generation: packageProducer.generation,
      receiptCommit: receiptCommits.get(
        `${packageProducer.tracerId}:${packageProducer.generation}`
      ),
      tracerId: `T${String(packageProducer.tracerId).padStart(2, "0")}`,
    },
    systemGenerationBinding: consumer.systemGeneration,
    disqualifiedReviewerSubjectIds: consumer.disqualifiedReviewerSubjectIds,
    verifySignature: ({
      algorithm,
      credentialId,
      credentialType,
      signature,
      signedPayloadDigest,
      signerKind,
      subjectId,
      verifierPolicyDigest,
    }) => {
      const credential = credentialById.get(credentialId);
      if (
        !credential ||
        algorithm !== credential.algorithm ||
        credentialType !== credential.credentialType ||
        subjectId !== credential.subjectId ||
        (signerKind === "authority_verifier") !== (credential.role === "authority_verifier") ||
        (signerKind === "authority_verifier" && verifierPolicyDigest !== catalog.policyDigest)
      ) {
        return false;
      }
      try {
        const publicKey = createPublicKey({
          key: Buffer.from(credential.publicKeySpki, "base64url"),
          format: "der",
          type: "spki",
        });
        return verifySignatureBytes(
          null,
          Buffer.from(signedPayloadDigest, "hex"),
          publicKey,
          Buffer.from(signature, "base64url")
        );
      } catch {
        return false;
      }
    },
  };
}

function validateAuthorityReceiptAgainstCatalog(payload, options, context) {
  const {
    catalog,
    baseManifest,
    disqualifiedReviewerSubjectIds,
    executionStartedAt,
    packageProducerBinding,
    receiptCommits,
    systemGenerationBinding,
  } = options;
  const credentialById = new Map(
    catalog.credentials.map((credential) => [credential.credentialId, credential])
  );
  const reviewer = payload.statement.reviewer;
  const reviewerCredential = credentialById.get(reviewer.credential.credentialId);
  const verifier = payload.authorityVerification.verifier;
  const verifierCredential = credentialById.get(verifier.credentialId);
  const verifyRegistration = (credential, credentialContext) => {
    const registration = (baseManifest.executionGenerations ?? []).find(
      (candidate) =>
        candidate.tracerId === credential?.registration.tracerId &&
        candidate.generation === credential?.registration.generation
    );
    if (
      !registration ||
      registration.evidenceDigest !== credential.registration.artifactDigest ||
      receiptCommits.get(
        `${credential.registration.tracerId}:${credential.registration.generation}`
      ) !== credential.registration.receiptCommit
    ) {
      fail(`${credentialContext} lacks its exact historical registration generation`);
    }
  };
  if (
    !reviewerCredential ||
    reviewerCredential.subjectId !== reviewer.subjectId ||
    reviewerCredential.credentialType !== reviewer.credential.credentialType ||
    reviewerCredential.role !== reviewer.role
  ) {
    fail(`${context} reviewer identity, role, and credential are not catalog-authorized`);
  }
  if (
    !verifierCredential ||
    verifierCredential.subjectId !== verifier.subjectId ||
    verifierCredential.credentialType !== verifier.credentialType ||
    verifierCredential.role !== "authority_verifier"
  ) {
    fail(`${context} authority verifier is not the exact catalog-authorized verifier`);
  }
  verifyRegistration(reviewerCredential, `${context} reviewer credential`);
  verifyRegistration(verifierCredential, `${context} verifier credential`);
  const evaluatedScopeDigests = payload.statement.claimScopes
    .map(({ digest: scopeDigest }) => scopeDigest)
    .sort();
  if (
    evaluatedScopeDigests.some(
      (scopeDigest) => !reviewerCredential.authorizedClaimScopeDigests.includes(scopeDigest)
    ) ||
    payload.authorityVerification.validity.credentialIssuedAt !== reviewerCredential.issuedAt ||
    payload.authorityVerification.validity.credentialExpiresAt !== reviewerCredential.expiresAt ||
    payload.authorityVerification.independence.conflictPolicyDigest !==
      catalog.policy.conflictPolicyDigest
  ) {
    fail(`${context} authority scope, validity, or conflict policy is self-asserted`);
  }
  const evaluatedAt = Date.parse(payload.authorityVerification.validity.evaluatedAt);
  const startedAt = Date.parse(payload.statement.issuedAt);
  const executionStartedAtValue = Date.parse(executionStartedAt);
  if (
    evaluatedAt < startedAt ||
    evaluatedAt > executionStartedAtValue + catalog.policy.clockSkewSeconds * 1000
  ) {
    fail(`${context} authority evaluation violates the catalog clock policy`);
  }
  const revocations = catalog.revocations.filter(
    ({ credentialId }) => credentialId === reviewerCredential.credentialId
  );
  const revoked = revocations.some(({ revokedAt }) => Date.parse(revokedAt) <= evaluatedAt);
  const verifierRevoked = catalog.revocations.some(
    ({ credentialId, revokedAt }) =>
      credentialId === verifierCredential.credentialId && Date.parse(revokedAt) <= evaluatedAt
  );
  const revocationReceipt = payload.authorityVerification.validity.revocation;
  if (
    revocationReceipt.sourceDigest !== digest(JSON.stringify(catalog.revocations)) ||
    revocationReceipt.status !== (revoked ? "revoked" : "clear") ||
    evaluatedAt < Date.parse(verifierCredential.issuedAt) ||
    evaluatedAt >= Date.parse(verifierCredential.expiresAt) ||
    verifierRevoked
  ) {
    fail(`${context} reviewer/verifier validity is not derived from the exact base catalog`);
  }
  const expectedIndependence = disqualifiedReviewerSubjectIds.includes(reviewer.subjectId)
    ? "conflicted"
    : "independent";
  if (payload.authorityVerification.independence.status !== expectedIndependence) {
    fail(`${context} reviewer conflict status differs from the predecessor role package`);
  }
  if (
    payload.receiptKind === "owner_provisional_decision" &&
    (JSON.stringify(payload.statement.decision.machineClosure) !==
      JSON.stringify(systemGenerationBinding) ||
      JSON.stringify(payload.statement.decision.reviewPackage) !==
        JSON.stringify(packageProducerBinding))
  ) {
    fail(`${context} Owner decision does not bind the exact T85 and T81 role-package generations`);
  }
}

for (const generation of executionGenerations) {
  validateExactStartWitnesses(generation, registeredDefinition(generation.tracerId));
}

for (const generation of executionGenerations.filter((receipt) => receipt.tracerId === 86)) {
  const key = `86:${generation.generation}`;
  const priorStop = generationByKey.get(`86:${generation.generation - 1}`);
  const supersededTargets = generation.supersedes.map(
    (edge) => `${edge.target.tracerId}:${edge.target.generation}`
  );
  if (generation.generation > 1 && !supersededTargets.includes(`86:${generation.generation - 1}`)) {
    fail(`${key} must supersede the immediately prior Owner decision generation`);
  }
  if (generation.resultCode !== "provisional_stop_resumed") continue;
  if (
    generation.generation < 2 ||
    priorStop?.resultCode !== "provisional_stop_current" ||
    generation.issueCompletion !== "complete" ||
    generation.productAcceptance !== "pass" ||
    generation.authorityValidity !== "valid" ||
    !generationIsActive(key)
  ) {
    fail(`${key} does not validly resume and supersede the exact current Owner stop decision`);
  }
}

function temporalPredicateWitnesses(node) {
  if (node.all) {
    let accumulated = [new Set()];
    for (const child of node.all) {
      const childWitnesses = temporalPredicateWitnesses(child);
      const combined = [];
      for (const existing of accumulated) {
        for (const childWitness of childWitnesses) {
          combined.push(new Set([...existing, ...childWitness]));
        }
      }
      accumulated = combined;
    }
    return accumulated;
  }
  if (node.any) return node.any.flatMap(temporalPredicateWitnesses);
  const sourceGeneration = currentGenerationFor(node.sourceTracer);
  if (!sourceGeneration) {
    return node.generation === "latest_or_absent" &&
      compare(undefined, node.operator, node.expected)
      ? [new Set()]
      : [];
  }
  const sourceKey = `${node.sourceTracer}:${sourceGeneration}`;
  const receipt = generationByKey.get(sourceKey);
  if (
    !receipt ||
    !generationIsActive(sourceKey) ||
    (node.field !== "freshness" && receipt.freshness !== "current") ||
    (node.field !== "compatibility" && receipt.compatibility !== "compatible") ||
    (node.field !== "authorityValidity" &&
      !["valid", "not_required"].includes(receipt.authorityValidity)) ||
    !compare(receipt[node.field], node.operator, node.expected)
  ) {
    return [];
  }
  return [new Set([node.sourceTracer])];
}

function descendsFromCurrentSource(currentKey, sourceId) {
  const sourceGeneration = currentGenerationFor(sourceId);
  return Boolean(
    sourceGeneration &&
    generationIsActive(`${sourceId}:${sourceGeneration}`) &&
    isStrictTemporalDescendant(currentKey, `${sourceId}:${sourceGeneration}`)
  );
}

for (const definition of issues) {
  const currentGeneration = currentGenerationFor(definition.id);
  if (currentGeneration == null) continue;
  const currentKey = `${definition.id}:${currentGeneration}`;
  if (!generationIsActive(currentKey)) continue;
  for (const dependencyId of definition?.blockedBy ?? []) {
    if (!descendsFromCurrentSource(currentKey, dependencyId)) {
      fail(`${currentKey} must temporally descend from current dependency T${dependencyId}`);
    }
  }
  if (definition?.resultPredicate) {
    const hasTemporalWitness = temporalPredicateWitnesses(definition.resultPredicate).some(
      (witness) => [...witness].every((sourceId) => descendsFromCurrentSource(currentKey, sourceId))
    );
    if (!hasTemporalWitness) {
      fail(`${currentKey} lacks a satisfied temporal witness for its result predicate`);
    }
  }
}

const dynamicDefinitionIds = registeredTracerIds.filter((id) => id > baseWaveHighestId);
const dynamicRemediationContracts = new Map();
function nextExecutionGeneration(tracerId) {
  return (generationsByTracer.get(tracerId)?.length ?? 0) + 1;
}

const remediationDispatchResultCodes = new Map([
  [69, new Set(["review_round_failed", "review_round_applicability_invalid"])],
  [84, new Set(["qualification_failed_repair_dispatched"])],
  [85, new Set(["machine_closure_failed_repair_dispatched"])],
  [87, new Set(["release_closure_failed_repair_dispatched"])],
  [103, new Set(["truth_verification_failed_repair_dispatched"])],
  [106, new Set(["precommit_failed_repair_dispatched"])],
]);

for (const repairReceipt of executionGenerations.filter(
  (generation) => generation.tracerId > baseWaveHighestId
)) {
  const repairKey = `${repairReceipt.tracerId}:${repairReceipt.generation}`;
  exactKeys(
    repairReceipt.dispatch,
    ["artifactDigest", "artifactId", "findingId", "obligationId", "source"],
    `${repairKey} dispatch`
  );
  exactKeys(
    repairReceipt.dispatch.source,
    ["generation", "tracerId"],
    `${repairKey} dispatch source`
  );
  const dispatchSource = repairReceipt.dispatch.source;
  const dispatchSourceKey = `${dispatchSource.tracerId}:${dispatchSource.generation}`;
  const dispatchSourceReceipt = generationByKey.get(dispatchSourceKey);
  const dispatchEvidence = validatedEvidenceByGeneration.get(dispatchSourceKey);
  const dispatchArtifact = dispatchEvidence?.artifactReceipts.get(
    repairReceipt.dispatch.artifactId
  );
  const dispatchPayload = dispatchArtifact?.payload;
  const authorizedDispatchResults = remediationDispatchResultCodes.get(dispatchSource.tracerId);
  if (
    !authorizedDispatchResults?.has(dispatchSourceReceipt?.resultCode) ||
    !dispatchSourceReceipt ||
    !isStrictTemporalDescendant(repairKey, dispatchSourceKey) ||
    dispatchSourceReceipt.issueCompletion !== "complete" ||
    dispatchSourceReceipt.productAcceptance === "pass" ||
    dispatchArtifact?.artifact.schemaId !== "vellum.remediation-dispatch.v1" ||
    dispatchArtifact.artifact.sha256 !== repairReceipt.dispatch.artifactDigest ||
    dispatchPayload?.findingId !== repairReceipt.dispatch.findingId ||
    dispatchPayload?.obligationId !== repairReceipt.dispatch.obligationId ||
    repairReceipt.dispatch.obligationId !== repairReceipt.remediationObligationId ||
    dispatchPayload?.repairTracerId !== repairReceipt.tracerId
  ) {
    fail(`${repairKey} is not bound to an exact nonpassing dispatcher finding receipt`);
  }
  const rejoinAt = repairReceipt?.rejoinAt;
  exactKeys(rejoinAt, ["generation", "tracerId"], `${repairKey} rejoinAt`);
  if (
    !rejoinAt ||
    !Number.isInteger(rejoinAt.tracerId) ||
    rejoinAt.tracerId < 1 ||
    !Number.isInteger(rejoinAt.generation) ||
    rejoinAt.generation < 1
  ) {
    fail(`${repairKey} dynamic remediation lacks a typed rejoinAt target`);
  }
  if (
    !byId.has(rejoinAt.tracerId) ||
    rejoinAt.tracerId === repairReceipt.tracerId ||
    [85, 87].includes(rejoinAt.tracerId)
  ) {
    fail(`${repairKey} rejoinAt must reserve a different live tracer definition`);
  }
  const rejoinKey = `${rejoinAt.tracerId}:${rejoinAt.generation}`;
  const rejoinReceipt = generationByKey.get(rejoinKey);
  if (rejoinReceipt && !isStrictTemporalDescendant(rejoinKey, repairKey)) {
    fail(`${repairKey} materialized rejoinAt must be a strict temporal descendant`);
  }
  if (!rejoinReceipt && rejoinAt.generation !== nextExecutionGeneration(rejoinAt.tracerId)) {
    fail(`${repairKey} unresolved rejoinAt must reserve the exact next execution generation`);
  }
  if (typeof repairReceipt.invalidatesMachineComplete !== "boolean") {
    fail(`${repairKey} dynamic remediation must declare invalidatesMachineComplete`);
  }
  if (
    !Array.isArray(repairReceipt.invalidationScopes) ||
    !repairReceipt.invalidationScopes.length ||
    new Set(repairReceipt.invalidationScopes).size !== repairReceipt.invalidationScopes.length ||
    repairReceipt.invalidationScopes.some((scope) => !invalidationScopes.has(scope)) ||
    !repairReceipt.invalidationScopes.includes("release_closure") ||
    repairReceipt.invalidatesMachineComplete !==
      repairReceipt.invalidationScopes.includes("machine_closure")
  ) {
    fail(`${repairKey} has invalid or contradictory typed invalidation scopes`);
  }
  const derivedInvalidationScopes = [
    ...new Set(repairReceipt.invalidates.flatMap((edge) => edge.scopes)),
  ].sort();
  if (
    repairReceipt.invalidates.length === 0 ||
    JSON.stringify([...repairReceipt.invalidationScopes].sort()) !==
      JSON.stringify(derivedInvalidationScopes) ||
    JSON.stringify(dispatchPayload.invalidations) !== JSON.stringify(repairReceipt.invalidates) ||
    JSON.stringify(dispatchPayload.rejoinAt) !== JSON.stringify(rejoinAt)
  ) {
    fail(`${repairKey} typed repair scope/rejoin differs from its actual edges or dispatcher`);
  }
  if (!Array.isArray(repairReceipt.closureTargets) || !repairReceipt.closureTargets.length) {
    fail(`${repairKey} dynamic remediation lacks typed closureTargets`);
  }
  const closureTargetIds = new Set();
  const targetReservations = new Map();
  for (const target of repairReceipt.closureTargets) {
    exactKeys(target, ["generation", "tracerId"], `${repairKey} closure target`);
    if (
      ![85, 87].includes(target?.tracerId) ||
      !Number.isInteger(target?.generation) ||
      target.generation < 1 ||
      closureTargetIds.has(target.tracerId)
    ) {
      fail(`${repairKey} has an invalid or duplicate closure target`);
    }
    closureTargetIds.add(target.tracerId);
    const targetKey = `${target.tracerId}:${target.generation}`;
    const targetReceipt = generationByKey.get(targetKey);
    if (targetReceipt && !rejoinReceipt) {
      fail(`${repairKey} cannot materialize closure target ${targetKey} before rejoinAt`);
    }
    if (targetReceipt && !isStrictTemporalDescendant(targetKey, rejoinKey)) {
      fail(`${repairKey} materialized closure target ${targetKey} must descend from rejoinAt`);
    }
    if (!targetReceipt && target.generation !== nextExecutionGeneration(target.tracerId)) {
      fail(
        `${repairKey} unresolved closure target ${targetKey} must reserve the exact next generation`
      );
    }
    targetReservations.set(target.tracerId, {
      key: targetKey,
      generation: target.generation,
      materialized: Boolean(targetReceipt),
    });
  }
  if (!closureTargetIds.has(87)) {
    fail(`${repairKey} dynamic remediation must rejoin the current T87 generation`);
  }
  if (closureTargetIds.has(85) !== repairReceipt.invalidatesMachineComplete) {
    fail(`${repairKey} must include T85 exactly when it invalidates Machine Complete evidence`);
  }
  if (
    JSON.stringify(dispatchPayload.closureTargets) !== JSON.stringify(repairReceipt.closureTargets)
  ) {
    fail(`${repairKey} closure targets differ from the dispatcher-prescribed contract`);
  }
  dynamicRemediationContracts.set(repairKey, {
    dispatchSourceKey,
    repairKey,
    receipt: repairReceipt,
    rejoinKey,
    rejoinMaterialized: Boolean(rejoinReceipt),
    targetReservations,
  });
}

for (const [repairKey, contract] of dynamicRemediationContracts) {
  if (
    (supersededGenerationKeys.has(repairKey) || tombstoneById.has(contract.receipt.tracerId)) &&
    (!contract.rejoinMaterialized ||
      [...contract.targetReservations.values()].some((target) => !target.materialized))
  ) {
    fail(`${repairKey} cannot be superseded or tombstoned before all closure obligations exist`);
  }
}

const declaredRequirementEvidence = canPreserveGlobalState
  ? (compatibleExistingManifest.requirementEvidence ?? {})
  : {};
if (
  !declaredRequirementEvidence ||
  typeof declaredRequirementEvidence !== "object" ||
  Array.isArray(declaredRequirementEvidence)
) {
  fail("requirementEvidence must be an object of append-only record arrays");
}
for (const [requirementId, records] of Object.entries(declaredRequirementEvidence)) {
  if (!requirementRows.has(requirementId) || !Array.isArray(records)) {
    fail(`requirementEvidence.${requirementId} is unknown or not an array`);
  }
  for (const [index, record] of records.entries()) {
    exactKeys(
      record,
      ["evidenceDigest", "executionGeneration", "generation", "previousRecordDigest", "tracerId"],
      `requirementEvidence.${requirementId}[${index}]`
    );
    const receipt = generationByKey.get(`${record.tracerId}:${record.executionGeneration}`);
    const mapping = requirementRows.get(requirementId);
    const permittedContributor =
      mapping.ids.includes(record.tracerId) ||
      (mapping.dynamic && record.tracerId > baseWaveHighestId);
    const expectedPreviousDigest = index === 0 ? null : digest(JSON.stringify(records[index - 1]));
    if (
      record.generation !== index + 1 ||
      record.previousRecordDigest !== expectedPreviousDigest ||
      !receipt ||
      !permittedContributor ||
      record.evidenceDigest !== receipt.evidenceDigest
    ) {
      fail(`requirementEvidence.${requirementId}[${index}] has invalid lineage or ownership`);
    }
  }
}
const requirementEvidence = {};
for (const generation of executionGenerations) {
  const generationKey = `${generation.tracerId}:${generation.generation}`;
  const validated = validatedEvidenceByGeneration.get(generationKey);
  if (!validated) fail(`${generationKey} lacks validated requirement evidence`);
  const claimedFamilies = [
    ...new Set(validated.evidence.claims.map((claim) => claim.requirementId)),
  ].sort();
  for (const requirementId of claimedFamilies) {
    const records = requirementEvidence[requirementId] ?? [];
    records.push({
      generation: records.length + 1,
      previousRecordDigest: records.length === 0 ? null : digest(JSON.stringify(records.at(-1))),
      tracerId: generation.tracerId,
      executionGeneration: generation.generation,
      evidenceDigest: generation.evidenceDigest,
    });
    requirementEvidence[requirementId] = records;
  }
}
for (const [requirementId, anchoredRecords] of Object.entries(
  compatibleTransitionAnchorManifest?.requirementEvidence ?? {}
)) {
  if (!Object.hasOwn(requirementEvidence, requirementId)) {
    fail(`requirementEvidence removed anchored ${requirementId}`);
  }
  assertJsonPrefix(
    anchoredRecords,
    requirementEvidence[requirementId],
    `requirementEvidence.${requirementId}`
  );
}

function currentRequirementWitnesses(requirementId) {
  return (requirementEvidence[requirementId] ?? []).filter((record) => {
    const key = `${record.tracerId}:${record.executionGeneration}`;
    const receipt = generationByKey.get(key);
    return Boolean(
      receipt &&
      generationIsActive(key) &&
      currentGenerationFor(record.tracerId) === record.executionGeneration &&
      receipt.evidenceDigest === record.evidenceDigest &&
      receipt.issueCompletion === "complete" &&
      receipt.freshness === "current" &&
      receipt.compatibility === "compatible" &&
      ["valid", "not_required"].includes(receipt.authorityValidity)
    );
  });
}

function currentClauseWitnesses(clauseId) {
  const clause = clauseById.get(clauseId);
  if (!clause) return [];
  return (clauseEvidence[clauseId] ?? []).filter((record) => {
    const key = `${record.tracerId}:${record.executionGeneration}`;
    const receipt = generationByKey.get(key);
    return Boolean(
      receipt &&
      generationHasCurrentClauseEvidence(key, clauseId) &&
      currentGenerationFor(record.tracerId) === record.executionGeneration &&
      receipt.evidenceDigest === record.evidenceDigest &&
      receipt.authoritySnapshot.authoritySetDigest === record.authoritySetDigest &&
      authoritySetCompatibleForClause(record.authoritySetDigest, clauseId) &&
      record.clauseDigest === clause.contentDigest &&
      record.contributor?.role === "evidence_contributor" &&
      record.contributor?.subjectId === `T${String(record.tracerId).padStart(2, "0")}` &&
      clause.evidenceContributors.includes(record.contributor.subjectId) &&
      receipt.issueCompletion === "complete" &&
      receipt.freshness === "current" &&
      receipt.compatibility === "compatible" &&
      ["valid", "not_required"].includes(receipt.authorityValidity)
    );
  });
}

function clauseWitnessDependenciesHold(clause, witnessRecord, visitingClauses = new Set()) {
  if (visitingClauses.has(clause.id)) return false;
  const nextVisiting = new Set([...visitingClauses, clause.id]);
  const witnessKey = `${witnessRecord.tracerId}:${witnessRecord.executionGeneration}`;
  for (const dependencyId of clause.dependencies) {
    const dependency = clauseById.get(dependencyId);
    const satisfied = currentClauseWitnesses(dependencyId).some((dependencyRecord) => {
      const dependencyKey = `${dependencyRecord.tracerId}:${dependencyRecord.executionGeneration}`;
      return (
        (dependencyKey === witnessKey || isStrictTemporalDescendant(witnessKey, dependencyKey)) &&
        clauseWitnessDependenciesHold(dependency, dependencyRecord, nextVisiting)
      );
    });
    if (!satisfied) return false;
  }
  return true;
}

function closureHasCurrentClauseCoverage(closureVerifier, closureKey) {
  for (const clause of clauseLedger.clauses.filter(
    (candidate) => candidate.closureVerifier === closureVerifier
  )) {
    const covered = currentClauseWitnesses(clause.id).some((record) => {
      const witnessKey = `${record.tracerId}:${record.executionGeneration}`;
      return (
        isStrictTemporalDescendant(closureKey, witnessKey) &&
        clauseWitnessDependenciesHold(clause, record)
      );
    });
    if (!covered) return false;
  }
  return true;
}

function closureHasCurrentRequirementCoverage(prefix, closureKey) {
  for (const requirementId of [...requirementRows.keys()].filter((id) => id.startsWith(prefix))) {
    const covered = currentRequirementWitnesses(requirementId).some((record) => {
      const witnessKey = `${record.tracerId}:${record.executionGeneration}`;
      return witnessKey === closureKey || isStrictTemporalDescendant(closureKey, witnessKey);
    });
    if (!covered) return false;
  }
  return true;
}

function closureRespectsInvalidations(closureKey, closureScope) {
  for (const edge of stateEdges.filter((candidate) => candidate.kind === "invalidates")) {
    const sourceKey = `${edge.source.tracerId}:${edge.source.generation}`;
    const targetKey = `${edge.target.tracerId}:${edge.target.generation}`;
    const semanticReplacementScope = edge.scopes.some((scope) =>
      ["issue", "evidence", "requirements"].includes(scope)
    );
    const relevant = edge.scopes.includes(closureScope);
    if (!relevant) continue;
    if (edge.scopes.includes(closureScope) && !isStrictTemporalDescendant(closureKey, sourceKey)) {
      return false;
    }
    if (semanticReplacementScope) {
      const replacementGeneration = currentGenerationFor(edge.target.tracerId);
      const replacementKey = replacementGeneration
        ? `${edge.target.tracerId}:${replacementGeneration}`
        : null;
      if (
        !replacementKey ||
        replacementKey === targetKey ||
        !generationIsActive(replacementKey) ||
        !isStrictTemporalDescendant(replacementKey, sourceKey) ||
        !closureCovers(closureKey, replacementKey)
      ) {
        return false;
      }
      if (edge.scopes.includes("requirements")) {
        const targetDefinition = registeredDefinition(edge.target.tracerId);
        for (const requirementId of targetDefinition?.requirementIds ?? []) {
          const replaced = currentRequirementWitnesses(requirementId).some((record) => {
            const witnessKey = `${record.tracerId}:${record.executionGeneration}`;
            return (
              isStrictTemporalDescendant(witnessKey, sourceKey) &&
              closureCovers(closureKey, witnessKey)
            );
          });
          if (!replaced) return false;
        }
      }
    }
  }
  return true;
}

const specificationPolicyAuthorityPaths = new Set([
  "SPEC.md",
  ".scratch/instrument-intelligence/PLAN.md",
  ".scratch/instrument-intelligence/REQUIREMENTS.md",
  clauseLedgerRepoPath,
]);
const knownVerifierAuthorityPaths = new Set([
  ...verificationAuthorityPaths,
  ...(compatibleTransitionAnchorManifest?.authorities?.verifier?.paths ?? []),
  ...(compatibleExistingManifest?.authorities?.verifier?.paths ?? []),
]);
const knownDomainAuthorityPaths = new Set([
  ...domainAuthorityPaths,
  ...(compatibleTransitionAnchorManifest?.authorities?.domainModel?.paths ?? []),
  ...(compatibleExistingManifest?.authorities?.domainModel?.paths ?? []),
]);

function changedAuthorityPathsBetween(fromAuthoritySet, toAuthoritySet) {
  const fromPaths = new Map(
    fromAuthoritySet.pathDigests.map(({ path: governedPath, sha256 }) => [governedPath, sha256])
  );
  const toPaths = new Map(
    toAuthoritySet.pathDigests.map(({ path: governedPath, sha256 }) => [governedPath, sha256])
  );
  return [...new Set([...fromPaths.keys(), ...toPaths.keys()])]
    .filter((governedPath) => fromPaths.get(governedPath) !== toPaths.get(governedPath))
    .sort();
}

function authorityPathCategory(governedPath) {
  if (specificationPolicyAuthorityPaths.has(governedPath)) return "specification_policy";
  if (knownVerifierAuthorityPaths.has(governedPath)) return "verifier";
  if (knownDomainAuthorityPaths.has(governedPath)) return "domain";
  fail(`authority migration changes unclassified historical authority path ${governedPath}`);
}

const authorityMigrationReasonCodes = new Set([
  "compatible_registry_tail_change",
  "governed_specification_change",
  "governed_verifier_change",
  "governed_domain_authority_change",
  "rights_or_policy_change",
]);

function validateAuthorityMigrationReason(migration, changedPaths, context, { historical }) {
  if (changedPaths.length === 0) {
    fail(`${context} does not change any authority path bytes`);
  }
  if (!authorityMigrationReasonCodes.has(migration.reasonCode)) {
    fail(`${context}.reasonCode is not in the closed authority-migration vocabulary`);
  }
  if (migration.reasonCode === "compatible_registry_tail_change") {
    if (
      JSON.stringify(changedPaths) !==
        JSON.stringify([".scratch/instrument-intelligence/PLAN.md"]) ||
      migration.affectedClauseIds.length !== 0
    ) {
      fail(`${context} registry-tail compatibility must change only the PLAN table tail`);
    }
    return;
  }
  if (historical) return;
  const categories = [...new Set(changedPaths.map(authorityPathCategory))].sort();
  if (categories.length !== 1) {
    fail(`${context} mixes authority categories; migrate each category in its own transaction`);
  }
  const expectedReason =
    categories[0] === "verifier"
      ? "governed_verifier_change"
      : categories[0] === "domain"
        ? "governed_domain_authority_change"
        : changedPaths.includes("SPEC.md")
          ? "governed_specification_change"
          : "rights_or_policy_change";
  if (migration.reasonCode !== expectedReason) {
    fail(`${context}.reasonCode does not match its actual ${categories[0]} path change`);
  }
}

function validateAuthorityHistory(value, previousValue) {
  exactKeys(
    value,
    ["authoritySets", "currentAuthoritySetDigest", "migrations", "schemaId"],
    "authorityHistory"
  );
  if (
    value.schemaId !== "vellum.instrument-intelligence.authority-history.v1" ||
    !Array.isArray(value.authoritySets) ||
    value.authoritySets.length === 0 ||
    !Array.isArray(value.migrations)
  ) {
    fail("authorityHistory has an invalid closed root");
  }
  if (previousValue) {
    assertJsonPrefix(
      previousValue.authoritySets,
      value.authoritySets,
      "authorityHistory.authoritySets"
    );
    assertJsonPrefix(previousValue.migrations, value.migrations, "authorityHistory.migrations");
    const appendedSetCount = value.authoritySets.length - previousValue.authoritySets.length;
    const appendedMigrationCount = value.migrations.length - previousValue.migrations.length;
    const currentChanged =
      value.currentAuthoritySetDigest !== previousValue.currentAuthoritySetDigest;
    if (
      (currentChanged && (appendedSetCount !== 1 || appendedMigrationCount !== 1)) ||
      (!currentChanged && (appendedSetCount !== 0 || appendedMigrationCount !== 0))
    ) {
      fail("authorityHistory must append exactly one set and migration per authority transition");
    }
  }
  const seen = new Set();
  for (const [index, authoritySet] of value.authoritySets.entries()) {
    try {
      validateAuthoritySnapshotV2(authoritySet, `authorityHistory.authoritySets[${index}]`);
    } catch (error) {
      fail(error.message);
    }
    if (seen.has(authoritySet.authoritySetDigest)) {
      fail("authorityHistory repeats an authority set");
    }
    seen.add(authoritySet.authoritySetDigest);
  }
  if (
    value.currentAuthoritySetDigest !== value.authoritySets.at(-1).authoritySetDigest ||
    !seen.has(value.currentAuthoritySetDigest)
  ) {
    fail("authorityHistory currentAuthoritySetDigest is not its append-only tail");
  }
  for (const [index, migration] of value.migrations.entries()) {
    const fromAuthoritySet = value.authoritySets[index];
    const toAuthoritySet = value.authoritySets[index + 1];
    exactKeys(
      migration,
      [
        "affectedClauseIds",
        "fromAuthoritySetDigest",
        "invalidationGeneration",
        "reasonCode",
        "sequence",
        "toAuthoritySetDigest",
      ],
      `authorityHistory.migrations[${index}]`
    );
    const context = `authorityHistory.migrations[${index}]`;
    const affectedClauseIds = migration.affectedClauseIds;
    if (
      migration.sequence !== index + 1 ||
      migration.fromAuthoritySetDigest !== fromAuthoritySet?.authoritySetDigest ||
      migration.toAuthoritySetDigest !== toAuthoritySet?.authoritySetDigest ||
      !Array.isArray(affectedClauseIds) ||
      JSON.stringify(affectedClauseIds) !==
        JSON.stringify([...new Set(affectedClauseIds)].sort()) ||
      affectedClauseIds.some((id) => !/^II-CLAUSE-\d{4}$/.test(id)) ||
      !migration.invalidationGeneration ||
      !Number.isInteger(migration.invalidationGeneration.tracerId) ||
      migration.invalidationGeneration.tracerId < 1 ||
      !Number.isInteger(migration.invalidationGeneration.generation) ||
      migration.invalidationGeneration.generation < 1
    ) {
      fail(`authorityHistory.migrations[${index}] is invalid or not append-only`);
    }
    if (
      migration.reasonCode !== "compatible_registry_tail_change" &&
      affectedClauseIds.length === 0
    ) {
      fail(`${context}.affectedClauseIds must be nonempty for a semantic authority change`);
    }
    validateAuthorityMigrationReason(
      migration,
      changedAuthorityPathsBetween(fromAuthoritySet, toAuthoritySet),
      context,
      { historical: index < (previousValue?.migrations?.length ?? 0) }
    );
    const sourceKey = `${migration.invalidationGeneration.tracerId}:${migration.invalidationGeneration.generation}`;
    const sourceGeneration = generationByKey.get(sourceKey);
    const sourceAuthoritySetIndex = value.authoritySets.findIndex(
      (authoritySet) =>
        authoritySet.authoritySetDigest === sourceGeneration?.authoritySnapshot.authoritySetDigest
    );
    const interveningAuthoritySetDigests = new Set(
      value.authoritySets
        .slice(sourceAuthoritySetIndex + 1, index + 1)
        .map((authoritySet) => authoritySet.authoritySetDigest)
    );
    const interveningSetHasClauseEvidence = Object.values(
      compatibleExistingManifest?.clauseEvidence ?? {}
    ).some((records) =>
      records.some((record) => interveningAuthoritySetDigests.has(record.authoritySetDigest))
    );
    const sourceAuthorityIsEligible =
      sourceAuthoritySetIndex === index ||
      (sourceAuthoritySetIndex >= 0 &&
        sourceAuthoritySetIndex < index &&
        !interveningSetHasClauseEvidence);
    if (
      !sourceGeneration ||
      !sourceAuthorityIsEligible ||
      sourceGeneration.issueCompletion !== "complete" ||
      sourceGeneration.freshness !== "current" ||
      sourceGeneration.compatibility !== "compatible" ||
      !["valid", "not_required"].includes(sourceGeneration.authorityValidity)
    ) {
      fail(`${context}.invalidationGeneration is not a valid generation under its from-set`);
    }
  }
  if (value.migrations.length !== value.authoritySets.length - 1) {
    fail("every successor authority set requires exactly one typed migration");
  }
  return {
    authoritySetIndexByDigest: new Map(
      value.authoritySets.map((authoritySet, index) => [authoritySet.authoritySetDigest, index])
    ),
  };
}

let authorityHistory = compatibleExistingManifest?.authorityHistory;
if (!authorityHistory) {
  authorityHistory = {
    schemaId: "vellum.instrument-intelligence.authority-history.v1",
    currentAuthoritySetDigest,
    authoritySets: [currentAuthoritySet],
    migrations: [],
  };
}
const authorityHistoryState = validateAuthorityHistory(
  authorityHistory,
  compatibleTransitionAnchorManifest?.authorityHistory
);
if (authorityHistory.currentAuthoritySetDigest !== currentAuthoritySetDigest) {
  fail("current authority bytes require a typed authority migration before execution can continue");
}

function authoritySetReaches(fromAuthoritySetDigest, toAuthoritySetDigest) {
  const fromIndex = authorityHistoryState.authoritySetIndexByDigest.get(fromAuthoritySetDigest);
  const toIndex = authorityHistoryState.authoritySetIndexByDigest.get(toAuthoritySetDigest);
  return Number.isInteger(fromIndex) && Number.isInteger(toIndex) && fromIndex <= toIndex;
}

function authoritySetCompatibleForClause(
  fromAuthoritySetDigest,
  clauseId,
  toAuthoritySetDigest = currentAuthoritySetDigest
) {
  const fromIndex = authorityHistoryState.authoritySetIndexByDigest.get(fromAuthoritySetDigest);
  const toIndex = authorityHistoryState.authoritySetIndexByDigest.get(toAuthoritySetDigest);
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex > toIndex) {
    return false;
  }
  return authorityHistory.migrations
    .slice(fromIndex, toIndex)
    .every((migration) => !migration.affectedClauseIds.includes(clauseId));
}

const semanticAuthorityMigrationBySourceKey = new Map();
for (const migration of authorityHistory.migrations) {
  if (migration.reasonCode === "compatible_registry_tail_change") continue;
  const sourceKey = `${migration.invalidationGeneration.tracerId}:${migration.invalidationGeneration.generation}`;
  const hasAnyClauseEvidence = Object.values(
    compatibleExistingManifest?.clauseEvidence ?? {}
  ).some((records) => records.length > 0);
  if (semanticAuthorityMigrationBySourceKey.has(sourceKey) && hasAnyClauseEvidence) {
    fail(`authority migrations reuse invalidation source ${sourceKey}`);
  }
  semanticAuthorityMigrationBySourceKey.set(sourceKey, migration);
}

function generationHasCurrentClauseEvidence(key, clauseId) {
  if (supersededGenerationKeys.has(key)) return false;
  for (const source of invalidatedByGeneration.get(key) ?? []) {
    const sourceKey = `${source.tracerId}:${source.generation}`;
    const migration = semanticAuthorityMigrationBySourceKey.get(sourceKey);
    if (!migration || migration.affectedClauseIds.includes(clauseId)) return false;
  }
  return true;
}

for (const definition of issues) {
  const currentGeneration = currentGenerationFor(definition.id);
  if (currentGeneration == null) continue;
  const currentKey = `${definition.id}:${currentGeneration}`;
  if (!generationIsActive(currentKey)) continue;
  const receipt = generationByKey.get(currentKey);
  if (
    !authoritySetReaches(receipt.authoritySnapshot.authoritySetDigest, currentAuthoritySetDigest) ||
    !registryEvents.some((event) => event.head === receipt.authoritySnapshot.registryHead)
  ) {
    fail(`${currentKey} is active under an unregistered authority or non-ancestor registry`);
  }
}
const remediationObligations = compatibleExistingManifest?.remediationObligations ?? {
  schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
  obligations: [],
  events: [],
};
const firstDynamicRegistryEventIndex = registryEvents.findIndex((event) =>
  event.addedDefinitions.some((definition) => definition.id > baseWaveHighestId)
);
const baseWaveRegistryEvents =
  firstDynamicRegistryEventIndex === -1
    ? registryEvents
    : registryEvents.slice(0, firstDynamicRegistryEventIndex);
const baseWaveRegistryHead = baseWaveRegistryEvents.at(-1)?.head ?? null;
if (!validDigest(baseWaveRegistryHead)) {
  fail("the base-wave registry head is unavailable for remediation allocation");
}
let remediationLedgerState;
try {
  remediationLedgerState = validateRemediationObligationLedger(remediationObligations, {
    previousLedger: compatibleTransitionAnchorManifest?.remediationObligations,
    initialNextTracerId: baseWaveHighestId + 1,
    initialRegistryHead: baseWaveRegistryHead,
  });
} catch (error) {
  fail(`remediation obligation ledger is invalid: ${error.message}`);
}
const remediationObligationById = new Map(
  remediationObligations.obligations.map((obligation) => [obligation.obligationId, obligation])
);
const remediationObligationsBySource = new Map();
for (const obligation of remediationObligations.obligations) {
  if (!clauseById.has(obligation.affectedClauseIds[0])) {
    fail(`${obligation.obligationId} does not bind known affected clauses`);
  }
  for (const clauseId of obligation.affectedClauseIds) {
    if (!clauseById.has(clauseId)) fail(`${obligation.obligationId} names unknown ${clauseId}`);
  }
  const sourceKey = `${obligation.source.tracerId}:${obligation.source.generation}`;
  const sources = remediationObligationsBySource.get(sourceKey) ?? [];
  sources.push(obligation);
  remediationObligationsBySource.set(sourceKey, sources);
}

function remediationDispatchContract(obligation) {
  return {
    affectedClauseIds: obligation.affectedClauseIds,
    closureTargets: obligation.closureTargets,
    expectedAllocation: obligation.expectedAllocation,
    findingId: obligation.findingId,
    inheritedCommitment: obligation.inheritedCommitment,
    invalidatesMachineComplete: obligation.invalidatesMachineComplete,
    invalidationScopes: obligation.invalidationScopes,
    invalidations: obligation.invalidations.map(({ reasonCode, scopes, target }) => ({
      reasonCode,
      scopes,
      target,
    })),
    obligationId: obligation.obligationId,
    rejoinAt: obligation.rejoinAt,
    repairContract: obligation.repairContract,
    repairDefinitionDigest: obligation.repairDefinitionDigest,
    repairTracerId: obligation.expectedAllocation.tracerId,
    source: obligation.source,
    transfersFrom: obligation.transfersFrom,
  };
}

for (const generation of executionGenerations) {
  const key = `${generation.tracerId}:${generation.generation}`;
  const obligations = remediationObligationsBySource.get(key) ?? [];
  const requiresDispatch = generation.resultDisposition.disposition === "repair_dispatch";
  const validatedGenerationEvidence = validatedEvidenceByGeneration.get(key);
  const dispatchArtifactIds =
    validatedGenerationEvidence?.evidence.outcome.resultDisposition.dispatchArtifactIds ?? [];
  const dispatchPayloads = dispatchArtifactIds.map(
    (artifactId) => validatedGenerationEvidence.artifactReceipts.get(artifactId)?.payload
  );
  if (
    (requiresDispatch && obligations.length !== generation.resultDisposition.dispatchCount) ||
    (!requiresDispatch && obligations.length !== 0) ||
    dispatchPayloads.some((payload) => !payload) ||
    new Set(dispatchPayloads.map((payload) => payload.obligationId)).size !==
      dispatchPayloads.length
  ) {
    fail(`${key} result disposition and remediation obligations are not one-to-one`);
  }
  const dispatchPayloadByObligation = new Map(
    dispatchPayloads.map((payload) => [payload.obligationId, payload])
  );
  for (const obligation of obligations) {
    const obligationGenerationInvalidations = obligation.invalidations.map(
      ({ reasonCode, source, target, scopes }) => {
        if (
          source.tracerId !== generation.tracerId ||
          source.generation !== generation.generation
        ) {
          fail(`${obligation.obligationId} invalidation source differs from its dispatcher`);
        }
        return { reasonCode, scopes, target };
      }
    );
    const expectedDispatchContract = remediationDispatchContract(obligation);
    const dispatchPayload = dispatchPayloadByObligation.get(obligation.obligationId);
    const receivedDispatchContract = dispatchPayload
      ? Object.fromEntries(
          Object.keys(expectedDispatchContract).map((field) => [field, dispatchPayload[field]])
        )
      : null;
    if (
      obligation.source.resultCode !== generation.resultCode ||
      JSON.stringify(obligationGenerationInvalidations) !==
        JSON.stringify(generation.invalidates) ||
      JSON.stringify(receivedDispatchContract) !== JSON.stringify(expectedDispatchContract) ||
      dispatchPayload.outputDigest !== digest(JSON.stringify(expectedDispatchContract))
    ) {
      fail(`${obligation.obligationId} contradicts its exact dispatcher result or invalidations`);
    }
  }
  if (generation.tracerId > baseWaveHighestId) {
    const obligation = remediationObligationById.get(generation.remediationObligationId);
    const registration = remediationObligations.events.find(
      (event) =>
        event.type === "registered" && event.obligationId === generation.remediationObligationId
    );
    if (
      !obligation ||
      obligation.expectedAllocation.tracerId !== generation.tracerId ||
      registration?.tracerId !== generation.tracerId ||
      registration.definitionDigest !== generation.definitionDigest
    ) {
      fail(`${key} does not consume exactly one registered remediation obligation`);
    }
  }
}
const declaredClauseEvidence = compatibleExistingManifest?.clauseEvidence ?? {};
if (
  !declaredClauseEvidence ||
  typeof declaredClauseEvidence !== "object" ||
  Array.isArray(declaredClauseEvidence)
) {
  fail("clauseEvidence must be a closed append-only object");
}
for (const [clauseId, records] of Object.entries(declaredClauseEvidence)) {
  if (!clauseById.has(clauseId) || !Array.isArray(records)) {
    fail(`clauseEvidence.${clauseId} is unknown or not an array`);
  }
}
const clauseEvidence = {};
for (const generation of executionGenerations) {
  const generationKey = `${generation.tracerId}:${generation.generation}`;
  const validated = validatedEvidenceByGeneration.get(generationKey);
  if (!validated) fail(`${generationKey} lacks validated clause-claim evidence`);
  for (const { clauseId, claim } of validated.clauseRecords) {
    const records = clauseEvidence[clauseId] ?? [];
    const record = {
      generation: records.length + 1,
      previousRecordDigest: records.length === 0 ? null : digest(JSON.stringify(records.at(-1))),
      tracerId: generation.tracerId,
      executionGeneration: generation.generation,
      evidenceDigest: generation.evidenceDigest,
      authoritySetDigest: generation.authoritySnapshot.authoritySetDigest,
      clauseDigest: claim.clauseDigest,
      contributor: claim.contributor,
      evidenceArtifactIds: claim.evidenceArtifactIds,
    };
    records.push(record);
    clauseEvidence[clauseId] = records;
  }
}
for (const [clauseId, anchoredRecords] of Object.entries(
  compatibleTransitionAnchorManifest?.clauseEvidence ?? {}
)) {
  if (!Object.hasOwn(clauseEvidence, clauseId)) {
    fail(`clauseEvidence removed anchored ${clauseId}`);
  }
  assertJsonPrefix(anchoredRecords, clauseEvidence[clauseId], `clauseEvidence.${clauseId}`);
}

function semanticClauseProjection(clause) {
  if (!clause) return null;
  return {
    id: clause.id,
    contentDigest: clause.contentDigest,
    familyId: clause.familyId,
    implementationOwner: clause.implementationOwner,
    evidenceContributors: clause.evidenceContributors,
    closureVerifier: clause.closureVerifier,
    dependencies: clause.dependencies,
  };
}

function generationPublishedNoLaterThan(candidate, source) {
  return (
    candidate.implementationCommit === source.implementationCommit ||
    isFirstParentAncestor(candidate.implementationCommit, source.implementationCommit)
  );
}

function generationWasStaleBeforeSource(targetKey, sourceKey) {
  for (const generation of executionGenerations) {
    const candidateSourceKey = `${generation.tracerId}:${generation.generation}`;
    if (candidateSourceKey === sourceKey) continue;
    const sourceGeneration = generationByKey.get(sourceKey);
    if (!sourceGeneration || !generationPublishedNoLaterThan(generation, sourceGeneration)) {
      continue;
    }
    const superseded = generation.supersedes.some(
      ({ target }) => `${target.tracerId}:${target.generation}` === targetKey
    );
    const invalidated = generation.invalidates.some(
      ({ target }) => `${target.tracerId}:${target.generation}` === targetKey
    );
    if (superseded || invalidated) return true;
  }
  return false;
}

function clauseWitnessesImmediatelyBeforeMigration(clauseId, migration, historicalClause) {
  const sourceKey = `${migration.invalidationGeneration.tracerId}:${migration.invalidationGeneration.generation}`;
  const sourceGeneration = generationByKey.get(sourceKey);
  if (!sourceGeneration) return [];
  return (clauseEvidence[clauseId] ?? []).filter((record) => {
    const key = `${record.tracerId}:${record.executionGeneration}`;
    const receipt = generationByKey.get(key);
    if (
      !receipt ||
      key === sourceKey ||
      !generationPublishedNoLaterThan(receipt, sourceGeneration) ||
      !isStrictTemporalDescendant(sourceKey, key) ||
      generationWasStaleBeforeSource(key, sourceKey) ||
      receipt.evidenceDigest !== record.evidenceDigest ||
      receipt.authoritySnapshot.authoritySetDigest !== record.authoritySetDigest ||
      !authoritySetCompatibleForClause(
        record.authoritySetDigest,
        clauseId,
        migration.fromAuthoritySetDigest
      ) ||
      record.clauseDigest !== historicalClause?.contentDigest ||
      receipt.issueCompletion !== "complete" ||
      receipt.freshness !== "current" ||
      receipt.compatibility !== "compatible" ||
      !["valid", "not_required"].includes(receipt.authorityValidity)
    ) {
      return false;
    }
    const laterGenerationBeforeSource = (generationsByTracer.get(record.tracerId) ?? []).some(
      (generationNumber) => {
        if (generationNumber <= record.executionGeneration) return false;
        const candidate = generationByKey.get(`${record.tracerId}:${generationNumber}`);
        return candidate && generationPublishedNoLaterThan(candidate, sourceGeneration);
      }
    );
    return !laterGenerationBeforeSource;
  });
}

if (declaredGovernedAuthorityMigration) {
  const migration = appendedAuthorityMigrations[0];
  const fromAuthoritySet = anchoredAuthorityHistory.authoritySets.find(
    (authoritySet) =>
      authoritySet.authoritySetDigest === anchoredAuthorityHistory.currentAuthoritySetDigest
  );
  const sourceKey = `${migration.invalidationGeneration.tracerId}:${migration.invalidationGeneration.generation}`;
  const sourceGeneration = generationByKey.get(sourceKey);
  const anchoredSourceGeneration = (
    compatibleTransitionAnchorManifest.executionGenerations ?? []
  ).find(
    (generation) =>
      generation.tracerId === migration.invalidationGeneration.tracerId &&
      generation.generation === migration.invalidationGeneration.generation
  );
  if (
    JSON.stringify(fromAuthoritySet) !== JSON.stringify(authorityHistory.authoritySets.at(-2)) ||
    JSON.stringify(appendedAuthoritySets[0]) !== JSON.stringify(currentAuthoritySet) ||
    !sourceGeneration ||
    !anchoredSourceGeneration ||
    currentGenerationFor(sourceGeneration.tracerId) !== sourceGeneration.generation ||
    !generationIsActive(sourceKey)
  ) {
    fail(
      "the appended authority migration is not bound to the exact trusted/current sets and active anchored source generation"
    );
  }
  if (
    sourceGeneration.clauseClaims.some((claim) =>
      migration.affectedClauseIds.includes(claim.clauseId)
    )
  ) {
    fail("an authority-migration source cannot self-certify a clause that its migration stales");
  }
  if (
    (governedRegistryTailChange && migration.reasonCode !== "compatible_registry_tail_change") ||
    (!governedRegistryTailChange && migration.reasonCode === "compatible_registry_tail_change")
  ) {
    fail(
      "registry-tail compatibility is available only for the exact append-only PLAN-table transaction"
    );
  }

  let historicalClauseLedger;
  try {
    historicalClauseLedger = assertCanonicalClauseLedgerJson(
      gitBytesAt(transitionAnchorCommit, clauseLedgerRepoPath).toString("utf8")
    );
  } catch (error) {
    fail(`cannot validate the migration's historical clause ledger: ${error.message}`);
  }
  const historicalClausesById = new Map(
    historicalClauseLedger.clauses.map((clause) => [clause.id, clause])
  );
  const allClauseIds = [...new Set([...historicalClausesById.keys(), ...clauseById.keys()])].sort();
  const changedClauseIds = allClauseIds.filter(
    (clauseId) =>
      JSON.stringify(semanticClauseProjection(historicalClausesById.get(clauseId))) !==
      JSON.stringify(semanticClauseProjection(clauseById.get(clauseId)))
  );
  const affectedClauseIds = new Set(migration.affectedClauseIds);
  const fromSetHasClauseEvidence = Object.values(clauseEvidence).some((records) =>
    records.some((record) => record.authoritySetDigest === migration.fromAuthoritySetDigest)
  );
  for (const clauseId of changedClauseIds) {
    if (!affectedClauseIds.has(clauseId)) {
      fail(`authority migration omits semantically changed ${clauseId}`);
    }
  }

  const requiredInvalidationTargets = new Set();
  for (const clauseId of migration.affectedClauseIds) {
    const historicalClause = historicalClausesById.get(clauseId);
    if (!historicalClause && !clauseById.has(clauseId)) {
      fail(`authority migration names unknown ${clauseId}`);
    }
    const witnesses = clauseWitnessesImmediatelyBeforeMigration(
      clauseId,
      migration,
      historicalClause
    );
    if (
      !changedClauseIds.includes(clauseId) &&
      witnesses.length === 0 &&
      fromSetHasClauseEvidence
    ) {
      fail(`authority migration cannot justify unaffected, unwitnessed ${clauseId}`);
    }
    for (const witness of witnesses) {
      requiredInvalidationTargets.add(`${witness.tracerId}:${witness.executionGeneration}`);
    }
  }
  const actualInvalidationTargets = new Set(
    sourceGeneration.invalidates
      .filter((invalidation) => invalidation.scopes.includes("evidence"))
      .map(({ target }) => `${target.tracerId}:${target.generation}`)
  );
  for (const targetKey of requiredInvalidationTargets) {
    if (!actualInvalidationTargets.has(targetKey)) {
      fail(`authority migration source ${sourceKey} does not stale affected evidence ${targetKey}`);
    }
  }
  if (
    migration.reasonCode !== "compatible_registry_tail_change" &&
    JSON.stringify([...actualInvalidationTargets].sort()) !==
      JSON.stringify([...requiredInvalidationTargets].sort())
  ) {
    fail(
      `authority migration source ${sourceKey} mixes clause migration with unrelated evidence invalidations`
    );
  }
}

const outputManifestSchema =
  compatibleExistingManifest?.schemaVersion === CURRENT_MANIFEST_SCHEMA ||
  existsSync(path.join(root, clauseLedgerRepoPath))
    ? CURRENT_MANIFEST_SCHEMA
    : BOOTSTRAP_MANIFEST_SCHEMA;
const manifest = {
  schemaVersion: outputManifestSchema,
  status: "bootstrap_pending",
  objective: "Release Complete Vellum Instrument Intelligence",
  authorities: authorityInputs,
  authorityHistory,
  publicationTrust: publicationTrustAtRead,
  protocolCatalog: {
    resultContracts: TRACER_RESULT_CONTRACTS,
    unresolvedRemediationObligationIds: remediationLedgerState.unresolvedObligationIds,
  },
  idPolicy: {
    kind: "append_only_stable_numeric_locators",
    registeredTracerIds,
    highestAllocatedId,
    baseWaveHighestId,
    nextDynamicTracerId: highestAllocatedId + 1,
    registryGeneration,
    previousRegistryHead: registryEvents.at(-1)?.previousHead ?? null,
    registryHead,
    registryEvents,
    tombstones,
    tombstoneSetDigest,
    tombstoneRecordDigests,
    executionOrderSource: "typed_dependency_result_and_temporal_generation_graphs",
  },
  stateModel: {
    executionProtocol:
      outputManifestSchema === BOOTSTRAP_MANIFEST_SCHEMA
        ? "bootstrap_locked_T01"
        : "governed_receipts_v2",
    issueCompletion: ["open", "in_progress", "complete", "invalidated", "superseded"],
    productAcceptance: ["pass", "fail", "blocked", "incomplete"],
    applicability: ["applicable", "not_applicable", "not_claimed"],
    comparison: ["comparable", "incomparable", "not_required", "unknown"],
    freshness: ["current", "stale", "unknown"],
    compatibility: ["compatible", "incompatible", "unknown"],
    authorityValidity: ["valid", "invalid", "not_required", "unknown"],
    closureEvidence: ["pending", "pass", "invalidated"],
    waveClosure: [
      "bootstrap_pending",
      "preregistered",
      "active",
      "machine_complete",
      "release_complete",
      "provisional_stopped",
    ],
    goalSatisfiedOnlyBy: "release_complete",
  },
  privacyPolicy: {
    caseCommitmentFields: {
      opaque_case_id: "random non-resolving identifier",
      coverage_class: "allowlisted precommitted coverage class",
      vault_commitment:
        "keyed non-resolving commitment; never a direct hidden-source or truth digest",
      stable_case_outcome: "forbidden",
    },
    aggregateFields: {
      aggregate_status: "bounded enum with minimum aggregation cardinality",
      minimum_cardinality: 3,
      case_ids: "forbidden",
    },
    publicArtifactFields: {
      public_artifact_digest: "digest only of bytes already authorized for public disclosure",
      requirement_ids: "known public requirement-family identifiers only",
      typed_redaction_receipt: "schema-bounded fields; never free-form text or arbitrary nesting",
    },
    coverageClasses: PUBLIC_COVERAGE_CLASSES,
    evidenceSchema: EVIDENCE_RECEIPT_SCHEMA_ID,
    unknownFields: "rejected recursively",
    unlistedEvidenceFiles: "rejected",
    privateClasses: [
      "heldout_identity_or_asset",
      "truth_or_expected_observation",
      "forbidden_outcome_or_mutation",
      "invalidation_or_reserve_state",
      "per_attempt_diagnostic",
      "owner_private_source_identity_path_metadata_or_content",
    ],
  },
  closureState: {
    machineComplete: "pending",
    releaseComplete: "pending",
    provisionalStopped: false,
  },
  tracers: issues.map((issue) => {
    const currentGeneration = currentGenerationFor(issue.id);
    const currentReceipt = currentGeneration
      ? generationByKey.get(`${issue.id}:${currentGeneration}`)
      : undefined;
    const currentKey = currentReceipt ? `${issue.id}:${currentReceipt.generation}` : null;
    return {
      ...issue,
      predicateReferences: undefined,
      eligibilityPredicate: {
        all: [
          ...(issue.dependencyPredicate.all.length ? [issue.dependencyPredicate] : []),
          ...(issue.resultPredicate ? [issue.resultPredicate] : []),
        ],
      },
      implementationCommit: currentReceipt ? currentReceipt.implementationCommit : null,
      remotePublicationReceipt: currentReceipt ? currentReceipt.remotePublicationReceipt : null,
      issueCompletion: currentReceipt
        ? supersededGenerationKeys.has(currentKey)
          ? "superseded"
          : invalidatedGenerationKeys.has(currentKey)
            ? "invalidated"
            : currentReceipt.issueCompletion
        : defaultIssueCompletion(issue.status),
      productAcceptance: currentReceipt ? currentReceipt.productAcceptance : null,
      applicability: currentReceipt ? currentReceipt.applicability : "not_claimed",
      comparison: currentReceipt ? currentReceipt.comparison : "unknown",
      freshness: currentReceipt ? currentReceipt.freshness : "unknown",
      compatibility: currentReceipt ? currentReceipt.compatibility : "unknown",
      authorityValidity: currentReceipt ? currentReceipt.authorityValidity : "unknown",
      resultCode: currentReceipt ? currentReceipt.resultCode : null,
      currentExecutionGeneration: currentGeneration,
      evidenceGeneration: currentReceipt ? currentReceipt.evidenceGeneration : 0,
      evidenceDigest: currentReceipt ? currentReceipt.evidenceDigest : null,
      supersedes: currentReceipt ? currentReceipt.supersedes.map((edge) => edge.target) : [],
      invalidatedBy: currentReceipt ? (invalidatedByGeneration.get(currentKey) ?? []) : [],
    };
  }),
  executionGenerations,
  stateEdges,
  requirementEvidence,
  clauseEvidence,
  remediationObligations,
};

function compare(actual, operator, expected) {
  if (operator === "eq") return actual === expected;
  if (operator === "neq") return actual !== expected;
  if (operator === "in") return expected.includes(actual);
  if (operator === "not_in") return !expected.includes(actual);
  return false;
}

function evaluatePredicate(node) {
  if (node.all) return node.all.every(evaluatePredicate);
  if (node.any) return node.any.some(evaluatePredicate);
  const source = manifest.tracers.find((tracer) => tracer.id === node.sourceTracer);
  if (!hasMutableProgress) {
    if (node.generation === "latest_or_absent") {
      return compare(undefined, node.operator, node.expected);
    }
    return false;
  }
  if (node.generation === "latest_or_absent" && !source?.currentExecutionGeneration) {
    return compare(undefined, node.operator, node.expected);
  }
  if (!source?.currentExecutionGeneration) return false;
  const receipt = generationByKey.get(`${source.id}:${source.currentExecutionGeneration}`);
  if (
    !receipt ||
    !generationIsActive(`${source.id}:${source.currentExecutionGeneration}`) ||
    (node.field !== "freshness" && receipt.freshness !== "current") ||
    (node.field !== "compatibility" && receipt.compatibility !== "compatible") ||
    (node.field !== "authorityValidity" &&
      !["valid", "not_required"].includes(receipt.authorityValidity))
  ) {
    return false;
  }
  return compare(receipt[node.field], node.operator, node.expected);
}

for (const tracer of manifest.tracers) {
  const predicatesHold = evaluatePredicate(tracer.eligibilityPredicate);
  tracer.computedEligibility =
    tracer.initialEligibility === "conditional"
      ? predicatesHold
        ? "conditional_ready"
        : "conditional_blocked"
      : predicatesHold
        ? "eligible"
        : "blocked";
  if (
    !hasMutableProgress &&
    tracer.initialEligibility !== "conditional" &&
    tracer.initialEligibility !== tracer.computedEligibility
  ) {
    fail(
      `T${tracer.id} initial declaration is ${tracer.initialEligibility} but bootstrap predicates compute ${tracer.computedEligibility}`
    );
  }
  if (
    tracer.currentExecutionGeneration !== null &&
    !generationKeys.has(`${tracer.id}:${tracer.currentExecutionGeneration}`)
  ) {
    fail(`T${tracer.id} points to a missing current execution generation`);
  }
}

function currentClosureReceipt(tracerId, expectedResultCode, { requirePass = true } = {}) {
  const tracer = manifest.tracers.find((candidate) => candidate.id === tracerId);
  if (!tracer || !Number.isInteger(tracer.currentExecutionGeneration)) return null;
  const receipt = generationByKey.get(`${tracerId}:${tracer.currentExecutionGeneration}`);
  if (
    !receipt ||
    !generationIsActive(`${tracerId}:${tracer.currentExecutionGeneration}`) ||
    receipt.definitionDigest !== tracer.definitionDigest ||
    receipt.issueCompletion !== "complete" ||
    receipt.freshness !== "current" ||
    receipt.compatibility !== "compatible" ||
    receipt.authorityValidity !== "valid" ||
    receipt.resultCode !== expectedResultCode ||
    !Number.isInteger(receipt.evidenceGeneration) ||
    receipt.evidenceGeneration < 1 ||
    !/^[a-f0-9]{64}$/.test(receipt.evidenceDigest ?? "") ||
    !validCommit(receipt.implementationCommit) ||
    !validPublicationReceipt(receipt.remotePublicationReceipt, receipt.implementationCommit) ||
    !existsSync(path.join(root, tracer.evidencePath)) ||
    digest(readLocalBytes(tracer.evidencePath)) !== receipt.evidenceDigest ||
    (requirePass && receipt.productAcceptance !== "pass")
  ) {
    return null;
  }
  return receipt;
}

function passingRepairReceipt(receipt, key) {
  return (
    receipt?.issueCompletion === "complete" &&
    !invalidatedGenerationKeys.has(key) &&
    receipt.productAcceptance === "pass" &&
    receipt.freshness === "current" &&
    receipt.compatibility === "compatible" &&
    ["valid", "not_required"].includes(receipt.authorityValidity)
  );
}

function contractRejoinSatisfied(contract, closureKey) {
  const rejoinReceipt = generationByKey.get(contract.rejoinKey);
  const rejoinTracerId = Number(contract.rejoinKey.split(":")[0]);
  const currentRejoinGeneration = currentGenerationFor(rejoinTracerId);
  const currentRejoinKey = currentRejoinGeneration
    ? `${rejoinTracerId}:${currentRejoinGeneration}`
    : null;
  const currentRejoinReceipt = currentRejoinKey ? generationByKey.get(currentRejoinKey) : null;
  return Boolean(
    rejoinReceipt &&
    !invalidatedGenerationKeys.has(contract.rejoinKey) &&
    rejoinReceipt.issueCompletion === "complete" &&
    rejoinReceipt.productAcceptance === "pass" &&
    currentRejoinKey &&
    generationIsActive(currentRejoinKey) &&
    (currentRejoinKey === contract.rejoinKey ||
      isStrictTemporalDescendant(currentRejoinKey, contract.rejoinKey)) &&
    currentRejoinReceipt?.issueCompletion === "complete" &&
    currentRejoinReceipt.productAcceptance === "pass" &&
    currentRejoinReceipt.freshness === "current" &&
    currentRejoinReceipt.compatibility === "compatible" &&
    ["valid", "not_required"].includes(currentRejoinReceipt.authorityValidity) &&
    closureCovers(closureKey, currentRejoinKey)
  );
}

function closureCovers(currentKey, targetKey) {
  return currentKey === targetKey || isStrictTemporalDescendant(currentKey, targetKey);
}

function allDynamicReceipts(tracerId) {
  return executionGenerations.filter((receipt) => receipt.tracerId === tracerId);
}

function dynamicMachineContractsSatisfied(machineKey) {
  for (const tracerId of dynamicDefinitionIds) {
    const receipts = allDynamicReceipts(tracerId);
    if (!receipts.length) return false;
    for (const receipt of receipts) {
      if (!receipt.invalidatesMachineComplete) continue;
      const repairKey = `${receipt.tracerId}:${receipt.generation}`;
      const contract = dynamicRemediationContracts.get(repairKey);
      const target = contract?.targetReservations.get(85);
      if (
        !contract ||
        !passingRepairReceipt(receipt, repairKey) ||
        !contractRejoinSatisfied(contract, machineKey) ||
        !target?.materialized ||
        !closureCovers(machineKey, target.key)
      ) {
        return false;
      }
    }
  }
  return true;
}

function dynamicReleaseContractsSatisfied(releaseKey) {
  for (const tracerId of dynamicDefinitionIds) {
    const receipts = allDynamicReceipts(tracerId);
    if (!receipts.length) return false;
    for (const receipt of receipts) {
      const repairKey = `${receipt.tracerId}:${receipt.generation}`;
      const contract = dynamicRemediationContracts.get(repairKey);
      const target = contract?.targetReservations.get(87);
      if (
        !contract ||
        !passingRepairReceipt(receipt, repairKey) ||
        !contractRejoinSatisfied(contract, releaseKey) ||
        !target?.materialized ||
        !closureCovers(releaseKey, target.key)
      ) {
        return false;
      }
    }
  }
  return true;
}

const machineTracer = manifest.tracers.find((tracer) => tracer.id === 85);
const releaseTracer = manifest.tracers.find((tracer) => tracer.id === 87);
const stopTracer = manifest.tracers.find((tracer) => tracer.id === 86);
const machineReceipt = currentClosureReceipt(85, "machine_complete");
const releaseReceipt = currentClosureReceipt(87, "release_complete");
const machineKey = Number.isInteger(machineTracer?.currentExecutionGeneration)
  ? `85:${machineTracer.currentExecutionGeneration}`
  : null;
const releaseKey = Number.isInteger(releaseTracer?.currentExecutionGeneration)
  ? `87:${releaseTracer.currentExecutionGeneration}`
  : null;
const stopKey = Number.isInteger(stopTracer?.currentExecutionGeneration)
  ? `86:${stopTracer.currentExecutionGeneration}`
  : null;
const unresolvedRemediationObligationIds = new Set(remediationLedgerState.unresolvedObligationIds);
const unresolvedMachineRemediation = [...unresolvedRemediationObligationIds].some(
  (obligationId) => remediationObligationById.get(obligationId)?.invalidatesMachineComplete
);
const machinePass = Boolean(
  machineKey &&
  machineTracer?.computedEligibility === "eligible" &&
  machineReceipt &&
  closureHasCurrentClauseCoverage("T85", machineKey) &&
  closureHasCurrentRequirementCoverage("II-MC-", machineKey) &&
  !unresolvedMachineRemediation &&
  closureRespectsInvalidations(machineKey, "machine_closure") &&
  dynamicMachineContractsSatisfied(machineKey)
);
const releasePass = Boolean(
  machinePass &&
  releaseKey &&
  releaseTracer?.computedEligibility === "eligible" &&
  releaseReceipt &&
  closureHasCurrentClauseCoverage("T87", releaseKey) &&
  closureHasCurrentRequirementCoverage("II-RC-", releaseKey) &&
  unresolvedRemediationObligationIds.size === 0 &&
  closureRespectsInvalidations(releaseKey, "release_closure") &&
  dynamicReleaseContractsSatisfied(releaseKey) &&
  isStrictTemporalDescendant(releaseKey, machineKey)
);
const stopReceipt = currentClosureReceipt(86, "provisional_stop_current");
const provisionalStopped = Boolean(
  machinePass &&
  !releasePass &&
  stopKey &&
  stopTracer?.computedEligibility === "conditional_ready" &&
  stopReceipt &&
  closureRespectsInvalidations(stopKey, "provisional_stop")
);
const everPassedMachine = executionGenerations.some(
  (receipt) =>
    receipt.tracerId === 85 &&
    receipt.issueCompletion === "complete" &&
    receipt.productAcceptance === "pass" &&
    receipt.resultCode === "machine_complete"
);
const everPassedRelease = executionGenerations.some(
  (receipt) =>
    receipt.tracerId === 87 &&
    receipt.issueCompletion === "complete" &&
    receipt.productAcceptance === "pass" &&
    receipt.resultCode === "release_complete"
);
manifest.closureState = {
  machineComplete: machinePass ? "pass" : everPassedMachine ? "invalidated" : "pending",
  releaseComplete: releasePass ? "pass" : everPassedRelease ? "invalidated" : "pending",
  provisionalStopped,
};
manifest.status = releasePass
  ? "release_complete"
  : provisionalStopped
    ? "provisional_stopped"
    : machinePass
      ? "machine_complete"
      : executionGenerations.length
        ? "active"
        : outputManifestSchema === CURRENT_MANIFEST_SCHEMA
          ? "preregistered"
          : "bootstrap_pending";

for (const [tracerId, generations] of generationsByTracer) {
  const currentGeneration = generations.at(-1);
  const definition = registeredDefinition(tracerId);
  const validated = validatedEvidenceByGeneration.get(`${tracerId}:${currentGeneration}`);
  if (!definition || !validated) continue;
  strictGovernedPaths.add(definition.evidencePath);
  readLocalBytes(definition.evidencePath);
  strictExpectedDigests.set(
    definition.evidencePath,
    generationByKey.get(`${tracerId}:${currentGeneration}`).evidenceDigest
  );
  for (const { artifact } of validated.artifactReceipts.values()) {
    strictGovernedPaths.add(artifact.path);
    readLocalBytes(artifact.path);
    strictExpectedDigests.set(artifact.path, artifact.sha256);
  }
}

const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
const serialized = await format(JSON.stringify(manifest), {
  ...prettierConfig,
  filepath: manifestPath,
  parser: "json",
});

const publicEvidenceRoot = ".scratch/instrument-intelligence/evidence";

function cleanWorktreeStatus(context) {
  try {
    return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    fail(`cannot inspect the ${context} worktree`);
  }
}

function changedPathRows(commit) {
  try {
    return execFileSync(
      "git",
      ["diff-tree", "--no-commit-id", "--name-status", "--no-renames", "-r", commit],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((row) => {
        const separator = row.indexOf("\t");
        if (separator < 1) fail(`cannot parse changed path row for ${commit}`);
        return { status: row.slice(0, separator), path: row.slice(separator + 1) };
      });
  } catch (error) {
    if (error?.message?.startsWith("Instrument Intelligence plan verification failed:")) {
      throw error;
    }
    fail(`cannot inspect changed paths for ${commit}`);
  }
}

function assertModePublicationStable(expectedRemoteCommit) {
  refreshOriginMain();
  const fetchedAtEnd = originMainCommit();
  const attestedAtEnd = githubPublicationHead();
  try {
    assertStablePublicationObservation({
      commitAtRead: expectedRemoteCommit,
      commitAtEnd: fetchedAtEnd,
      attestedCommitAtRead: attestedOriginMainAtRead,
      attestedCommitAtEnd: attestedAtEnd,
      trustAtRead: publicationTrustAtRead,
      trustAtEnd: originRemoteUrls(),
    });
  } catch (error) {
    fail(error.message);
  }
  if (
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF) !== trustedOriginCommitAtRead ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF) !== bootstrapAnchorAtRead ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF) !== trustPolicyObjectAtRead
  ) {
    fail("the Owner-local publication checkpoint changed during evidence validation");
  }
}

function validateUnreceiptedImplementationCommit({ expectedRemoteCommit, mode }) {
  if (!checkpointEstablishedAtRead || !trustedOriginCommitAtRead) {
    fail(`${mode} requires the complete Owner-local publication checkpoint`);
  }
  const implementationCommit = optionalRefCommit("HEAD");
  if (!implementationCommit || cleanWorktreeStatus(`${mode} evidence`)) {
    fail(`${mode} requires a committed HEAD and completely clean worktree`);
  }
  if (
    singleParent(implementationCommit, `${mode} implementation/evidence commit`) !==
    trustedOriginCommitAtRead
  ) {
    fail(`${mode} HEAD must be one non-merge direct child of trusted-main`);
  }
  if (
    originMainCommitAtRead !== expectedRemoteCommit ||
    attestedOriginMainAtRead !== expectedRemoteCommit
  ) {
    fail(`${mode} fetched and GraphQL publication heads do not match the required phase`);
  }

  const baseManifest = gitJsonAt(trustedOriginCommitAtRead, manifestRepoPath, { required: true });
  if (
    baseManifest?.schemaVersion !== CURRENT_MANIFEST_SCHEMA ||
    baseManifest.stateModel?.executionProtocol !== "governed_receipts_v2" ||
    manifestCommitAtOrBefore(trustedOriginCommitAtRead) !== trustedOriginCommitAtRead ||
    !gitBytesAt(trustedOriginCommitAtRead, manifestRepoPath).equals(
      gitBytesAt(implementationCommit, manifestRepoPath)
    ) ||
    !gitBytesAt(implementationCommit, manifestRepoPath).equals(Buffer.from(serialized))
  ) {
    fail(`${mode} requires the unchanged canonical next-schema manifest from trusted-main`);
  }

  const baseAuthoritySet = baseManifest.authorityHistory?.authoritySets?.find(
    (authoritySet) =>
      authoritySet.authoritySetDigest === baseManifest.authorityHistory?.currentAuthoritySetDigest
  );
  if (JSON.stringify(baseAuthoritySet) !== JSON.stringify(currentAuthoritySet)) {
    fail(`${mode} current authority set differs from the exact trusted-main authority set`);
  }
  const immutableRunPaths = [
    manifestRepoPath,
    ...currentAuthorityPaths,
    ...issues.map((issue) => issue.file),
  ].filter((value, index, values) => values.indexOf(value) === index);
  for (const governedPath of immutableRunPaths) {
    requireCommittedRegularFile(trustedOriginCommitAtRead, governedPath);
    requireCommittedRegularFile(implementationCommit, governedPath);
    if (
      !gitBytesAt(trustedOriginCommitAtRead, governedPath).equals(
        gitBytesAt(implementationCommit, governedPath)
      )
    ) {
      fail(`${mode} implementation/evidence commit changed governed path ${governedPath}`);
    }
  }

  const evidenceChanges = changedPathRows(implementationCommit).filter(({ path: changedPath }) =>
    changedPath.startsWith(`${publicEvidenceRoot}/`)
  );
  if (!evidenceChanges.length) {
    fail(`${mode} implementation/evidence commit contains no public evidence`);
  }
  if (evidenceChanges.some(({ status }) => status !== "A")) {
    fail(`${mode} public evidence is append-only; every changed evidence file must be new`);
  }
  const changedEvidenceDirectories = new Set();
  for (const { path: changedPath } of evidenceChanges) {
    const match = changedPath.match(
      /^\.scratch\/instrument-intelligence\/evidence\/(T(?:0[1-9]|[1-9][0-9]*))\/(.+)$/
    );
    if (!match) fail(`${mode} found a noncanonical changed evidence path ${changedPath}`);
    changedEvidenceDirectories.add(`${publicEvidenceRoot}/${match[1]}`);
  }
  if (changedEvidenceDirectories.size !== 1) {
    fail(`${mode} requires exactly one changed evidence/TNN directory`);
  }
  const evidenceDirectory = [...changedEvidenceDirectories][0];
  const tracerTag = path.posix.basename(evidenceDirectory);
  const tracerId = Number(tracerTag.slice(1));
  const verificationPath = `${evidenceDirectory}/verification.json`;
  if (!evidenceChanges.some(({ path: changedPath }) => changedPath === verificationPath)) {
    fail(`${mode} changed evidence directory lacks its one verification.json receipt`);
  }

  const definition = byId.get(tracerId);
  if (!definition || definition.evidencePath !== verificationPath) {
    fail(`${mode} evidence directory does not match one registered tracer definition`);
  }
  const evidenceBytes = gitBytesAt(implementationCommit, verificationPath);
  let evidence;
  try {
    evidence = JSON.parse(evidenceBytes.toString("utf8"));
    validateEvidenceReceiptV2(evidence, verificationPath);
  } catch (error) {
    fail(error.message);
  }
  const startReceipt = evidence.startReceipt;
  const priorTracerGenerations = (baseManifest.executionGenerations ?? [])
    .filter((generation) => generation.tracerId === tracerId)
    .sort((left, right) => left.generation - right.generation);
  const expectedGeneration = (priorTracerGenerations.at(-1)?.generation ?? 0) + 1;
  const expectedEvidenceGeneration = (priorTracerGenerations.at(-1)?.evidenceGeneration ?? 0) + 1;
  const baseTracer = manifest.tracers.find((tracer) => tracer.id === tracerId);
  if (
    startReceipt.start.tracerId !== tracerTag ||
    startReceipt.start.generation !== expectedGeneration ||
    startReceipt.definition.path !== definition.file ||
    startReceipt.definition.sha256 !== definition.definitionDigest ||
    startReceipt.definition.gateMatrixDigest !== definition.gateMatrixDigest ||
    startReceipt.definition.completionSemantics !== definition.completionSemantics ||
    !new Set(["eligible", "conditional_ready"]).has(baseTracer?.computedEligibility) ||
    (baseManifest.executionGenerations ?? []).some(
      (generation) => generation.implementationCommit === implementationCommit
    )
  ) {
    fail(`${mode} evidence does not reserve one fresh eligible tracer/generation identity`);
  }
  if (
    JSON.stringify(startReceipt.authoritySnapshot) !== JSON.stringify(currentAuthoritySet) ||
    startReceipt.registry.generation !== baseManifest.idPolicy?.registryGeneration ||
    startReceipt.registry.registryHead !== baseManifest.idPolicy?.registryHead ||
    startReceipt.registry.tombstoneSetDigest !== baseManifest.idPolicy?.tombstoneSetDigest ||
    startReceipt.registry.baseWaveHighestId !== baseManifest.idPolicy?.baseWaveHighestId
  ) {
    fail(`${mode} start receipt does not bind the exact trusted authority and registry state`);
  }
  if (
    startReceipt.publication.checkpoint.bootstrapAnchor.object !== bootstrapAnchorAtRead ||
    startReceipt.publication.checkpoint.trustPolicy.object !== trustPolicyObjectAtRead ||
    startReceipt.publication.checkpoint.trustedMain.object !== trustedOriginCommitAtRead ||
    startReceipt.publication.fetchedHead !== trustedOriginCommitAtRead ||
    startReceipt.publication.graphQlHead !== trustedOriginCommitAtRead ||
    startReceipt.execution.baseCommit !== trustedOriginCommitAtRead ||
    startReceipt.execution.productTreeDigest !==
      projectedProductTreeDigestAt(trustedOriginCommitAtRead)
  ) {
    fail(`${mode} start receipt does not bind the exact dual-observed trusted execution base`);
  }
  for (const predecessor of startReceipt.predecessors) {
    const predecessorTracerId = Number(predecessor.tracerId.slice(1));
    const predecessorManifest = gitJsonAt(predecessor.receiptCommit, manifestRepoPath, {
      required: true,
    });
    if (
      !isFirstParentAncestor(predecessor.receiptCommit, trustedOriginCommitAtRead) ||
      !(predecessorManifest.executionGenerations ?? []).some(
        (generation) =>
          generation.tracerId === predecessorTracerId &&
          generation.generation === predecessor.generation
      )
    ) {
      fail(`${mode} start predecessor is not an exact pushed ancestor receipt generation`);
    }
  }

  const evidenceDisposition = evidence.outcome.resultDisposition;
  const resultDisposition = {
    tracerId,
    resultCode: evidenceDisposition.code,
    productAcceptance: evidence.outcome.productAcceptance,
    applicability: evidence.outcome.applicability,
    disposition: evidenceDisposition.disposition,
    dispatchCount: evidenceDisposition.dispatchArtifactIds.length,
  };
  if (TRACER_RESULT_CONTRACTS[tracerId]) {
    try {
      validateResultDisposition(resultDisposition);
    } catch (error) {
      fail(error.message);
    }
  } else if (
    resultDisposition.resultCode !== "implementation_passed" ||
    resultDisposition.productAcceptance !== "pass" ||
    resultDisposition.disposition !== "unlock" ||
    resultDisposition.dispatchCount !== 0
  ) {
    fail(`${mode} ordinary tracer lacks its exact implementation-pass disposition`);
  }
  if (
    evidence.outcome.issueCompletion !== "complete" ||
    evidence.outcome.freshness !== "current" ||
    evidence.outcome.compatibility !== "compatible" ||
    !new Set(["valid", "not_required"]).has(evidence.outcome.authorityValidity) ||
    (["implementation-pass", "closure-pass-required"].includes(definition.completionSemantics) &&
      evidence.outcome.productAcceptance !== "pass")
  ) {
    fail(`${mode} evidence does not close its declared completion semantics`);
  }

  const generation = {
    tracerId,
    generation: expectedGeneration,
    evidenceGeneration: expectedEvidenceGeneration,
    definitionPath: definition.file,
    definitionDigest: definition.definitionDigest,
    startReceipt,
    authoritySnapshot: currentExecutionAuthoritySnapshot,
    implementationCommit,
    evidenceDigest: digest(evidenceBytes),
    predecessors: startReceipt.predecessors.map((predecessor) => ({
      tracerId: Number(predecessor.tracerId.slice(1)),
      generation: predecessor.generation,
    })),
    clauseClaims: evidence.claims,
    issueCompletion: evidence.outcome.issueCompletion,
    productAcceptance: evidence.outcome.productAcceptance,
    applicability: evidence.outcome.applicability,
    comparison: evidence.outcome.comparison,
    freshness: evidence.outcome.freshness,
    compatibility: evidence.outcome.compatibility,
    authorityValidity: evidence.outcome.authorityValidity,
    resultCode: evidenceDisposition.code,
    resultDisposition,
    supersedes: evidence.outcome.supersedes,
    invalidates: evidence.outcome.invalidates,
  };
  validateExactStartWitnesses(generation, definition);
  const validated = validateEvidenceReceipt(evidenceBytes, generation, definition);
  const committedAt = Date.parse(
    execFileSync("git", ["show", "-s", "--format=%cI", implementationCommit], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  );
  if (Date.parse(validated.evidence.finishedAt) > committedAt) {
    fail(`${mode} evidence finished after its implementation/evidence commit`);
  }
  assertLocalReadSetUnchanged(issueFiles);
  if (optionalRefCommit("HEAD") !== implementationCommit || cleanWorktreeStatus(`${mode} end`)) {
    fail(`${mode} worktree changed during validation`);
  }
  return { evidence, generation, implementationCommit, tracerTag, validatedEvidence: validated };
}

function canonicalRemotePublicationReceipt(implementationCommit) {
  const receipt = {
    schemaId: "vellum.instrument-intelligence.publication-receipt.v1",
    remote: "origin",
    remoteIdentity: INSTRUMENT_INTELLIGENCE_PUBLICATION_TRUST.remoteIdentity,
    branch: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.branch,
    repositoryNodeId: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.nodeId,
    repositoryDatabaseId: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.databaseId,
    repositoryNameWithOwner: INSTRUMENT_INTELLIGENCE_GITHUB_REPOSITORY.nameWithOwner,
    remoteProtectionAssumed: false,
    bootstrapAnchor: bootstrapAnchorAtRead,
    trustPolicyObject: trustPolicyObjectAtRead,
    trustedMainAtStart: trustedOriginCommitAtRead,
    commit: implementationCommit,
    fetchedHead: implementationCommit,
    graphQlHead: implementationCommit,
    checkedAt: new Date().toISOString(),
  };
  if (!validPublicationReceipt(receipt, implementationCommit)) {
    fail("cannot construct the closed canonical remote publication receipt");
  }
  return receipt;
}

function remediationObligationFromDispatchPayload(payload) {
  return {
    schemaId: "vellum.remediation-obligation.v1",
    obligationId: payload.obligationId,
    findingId: payload.findingId,
    transfersFrom: payload.transfersFrom,
    source: payload.source,
    expectedAllocation: payload.expectedAllocation,
    repairDefinitionDigest: payload.repairDefinitionDigest,
    repairContract: payload.repairContract,
    affectedClauseIds: payload.affectedClauseIds,
    inheritedCommitment: payload.inheritedCommitment,
    invalidations: payload.invalidations.map((edge) => ({
      source: { tracerId: payload.source.tracerId, generation: payload.source.generation },
      ...edge,
    })),
    invalidationScopes: payload.invalidationScopes,
    invalidatesMachineComplete: payload.invalidatesMachineComplete,
    rejoinAt: payload.rejoinAt,
    closureTargets: payload.closureTargets,
  };
}

function writePublishedEvidenceReceiptManifest(validated) {
  if (validated.generation.tracerId > baseWaveHighestId) {
    fail("dynamic remediation receipt recording requires its registered obligation transaction");
  }
  const publicationReceipt = canonicalRemotePublicationReceipt(validated.implementationCommit);
  const completedGeneration = {
    ...validated.generation,
    remotePublicationReceipt: publicationReceipt,
  };
  const baseManifest = manifestAtCommit(trustedOriginCommitAtRead);
  const candidateManifest = structuredClone(baseManifest);
  candidateManifest.executionGenerations = [
    ...(candidateManifest.executionGenerations ?? []),
    completedGeneration,
  ];
  const dispatchIds = validated.evidence.outcome.resultDisposition.dispatchArtifactIds;
  const dispatchedObligations = dispatchIds.map((artifactId) => {
    const payload = validated.validatedEvidence.artifactReceipts.get(artifactId)?.payload;
    if (!payload || payload.schemaId !== "vellum.remediation-dispatch.v1") {
      fail(`cannot materialize remediation obligation from dispatch artifact ${artifactId}`);
    }
    return remediationObligationFromDispatchPayload(payload);
  });
  candidateManifest.remediationObligations = {
    ...(candidateManifest.remediationObligations ?? {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      events: [],
      obligations: [],
    }),
    obligations: [
      ...(candidateManifest.remediationObligations?.obligations ?? []),
      ...dispatchedObligations,
    ],
  };

  const originalBytes = readFileSync(manifestPath);
  try {
    writeFileSync(manifestPath, `${JSON.stringify(candidateManifest, null, 2)}\n`);
    execFileSync(process.execPath, [process.argv[1], "--write-manifest"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    writeFileSync(manifestPath, originalBytes);
    const details = error?.stderr?.trim() || error?.stdout?.trim() || error?.message;
    fail(`could not write the canonical published-evidence receipt manifest: ${details}`);
  }
  return { completedGeneration, publicationReceipt };
}

let lockFd;
let temporaryManifestPath;
function cleanup() {
  if (temporaryManifestPath && existsSync(temporaryManifestPath)) unlinkSync(temporaryManifestPath);
  if (lockFd !== undefined) {
    closeSync(lockFd);
    lockFd = undefined;
  }
  if (writeManifest && existsSync(manifestLockPath)) unlinkSync(manifestLockPath);
}

if (writeManifest) {
  try {
    lockFd = openSync(manifestLockPath, "wx");
  } catch {
    fail(
      `manifest allocation lock exists at ${path.relative(root, manifestLockPath)}; prove no writer is active before removing an orphaned lock`
    );
  }
  try {
    const currentManifestDigest = existsSync(manifestPath)
      ? digest(JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8"))))
      : null;
    if (currentManifestDigest !== existingManifestDigestAtRead) {
      fail("completion manifest changed after read; refusing a stale compare-and-swap write");
    }
    refreshOriginMain();
    if (originMainCommit() !== originMainCommitAtRead) {
      fail("origin/main changed after read; refusing a stale registry transaction");
    }
    assertLocalReadSetUnchanged(issueFiles);
    temporaryManifestPath = `${manifestPath}.tmp-${process.pid}`;
    writeFileSync(temporaryManifestPath, serialized, { flag: "wx" });
    renameSync(temporaryManifestPath, manifestPath);
    temporaryManifestPath = undefined;
    console.log(
      `Wrote canonical schema-${outputManifestSchema} ${path.relative(root, manifestPath)} with ${issues.length} registered tracers; commit and push it before strict verification.`
    );
  } finally {
    cleanup();
  }
} else if (draftMode) {
  if (!existingManifest) fail("completion manifest is missing");
  if (readFileSync(manifestPath, "utf8") !== serialized) {
    fail("completion manifest is stale; run npm run plan:instrument-intelligence:manifest");
  }
  assertLocalReadSetUnchanged(issueFiles);
  console.log(
    `Instrument Intelligence schema-${outputManifestSchema} draft verified: ${issues.length} stable tracers and a canonical governed execution state.`
  );
} else if (verifyPendingEvidence) {
  const validated = validateUnreceiptedImplementationCommit({
    expectedRemoteCommit: trustedOriginCommitAtRead,
    mode: "pending-evidence validation",
  });
  assertModePublicationStable(trustedOriginCommitAtRead);
  console.log(
    `Pending evidence verified before first push: ${validated.tracerTag}:${validated.generation.generation} is reserved by ${validated.implementationCommit}; trusted-main was not advanced.`
  );
} else if (observePublishedEvidence) {
  const localHead = optionalRefCommit("HEAD");
  const validated = validateUnreceiptedImplementationCommit({
    expectedRemoteCommit: localHead,
    mode: "published-evidence observation",
  });
  assertModePublicationStable(validated.implementationCommit);
  console.log(JSON.stringify(canonicalRemotePublicationReceipt(validated.implementationCommit)));
} else if (recordPublishedEvidence) {
  const localHead = optionalRefCommit("HEAD");
  const validated = validateUnreceiptedImplementationCommit({
    expectedRemoteCommit: localHead,
    mode: "published-evidence receipt recording",
  });
  assertModePublicationStable(validated.implementationCommit);
  const recorded = writePublishedEvidenceReceiptManifest(validated);
  console.log(
    `Recorded ${validated.tracerTag}:${recorded.completedGeneration.generation} in the canonical manifest; commit only ${manifestRepoPath} as the receipt transaction.`
  );
} else {
  if (!compatibleOriginManifest) {
    fail(
      "strict verification requires a supported governed manifest on origin/main; write, commit, and push the draft first"
    );
  }
  if (currentManifestChangingCommit !== originMainCommitAtRead) {
    fail(
      "strict verification requires origin/main HEAD itself to be the latest receipt/registry manifest transaction"
    );
  }
  const strictCommitPaths = changedPaths(originMainCommitAtRead);
  const bootstrapTransition = Boolean(
    !compatibleTransitionAnchorManifest &&
    rawTransitionAnchorManifest?.schemaVersion === 1 &&
    !manifestHasMutableProgress(rawTransitionAnchorManifest) &&
    !rawExistingHasProgress
  );
  const authorityMigrationAllowedPaths = new Set([
    manifestRepoPath,
    "SPEC.md",
    ".scratch/instrument-intelligence/PLAN.md",
    ".scratch/instrument-intelligence/REQUIREMENTS.md",
    ...verificationAuthorityPaths,
    ...domainAuthorityPaths,
    ...issues.map((issue) => issue.file),
    ...(compatibleTransitionAnchorManifest?.tracers ?? []).map((tracer) => tracer.file),
  ]);
  let preTrustCorrectionTransition = false;
  const possiblePreTrustCorrection = Boolean(
    preTrustCorrectionCandidate &&
    compatibleOriginManifest &&
    priorOriginManifest?.schemaVersion === 5 &&
    originManifestChangingCommits[2]
  );
  if (possiblePreTrustCorrection) {
    const originalSchema5Commit = priorManifestChangingCommit;
    const originalSchema1Commit = originManifestChangingCommits[2];
    const originalSchema1Manifest = gitJsonAt(originalSchema1Commit, manifestRepoPath, {
      required: true,
    });
    const schema5CommitCount = originManifestChangingCommits
      .map((commit) => gitJsonAt(commit, manifestRepoPath, { required: true }))
      .filter((candidate) => candidate?.schemaVersion === 5).length;
    const originalBootstrapParentIssuePaths = gitFilesUnder(
      originalSchema1Commit,
      ".scratch/instrument-intelligence/issues"
    ).filter((file) => /^\.scratch\/instrument-intelligence\/issues\/\d+-.*\.md$/.test(file));
    const originalBootstrapAllowedPaths = new Set([
      manifestRepoPath,
      "SPEC.md",
      ".scratch/instrument-intelligence/PLAN.md",
      ".scratch/instrument-intelligence/REQUIREMENTS.md",
      ...verificationAuthorityPaths,
      ...domainAuthorityPaths,
      ...issues.map((issue) => issue.file),
      ...originalBootstrapParentIssuePaths,
      ...(originalSchema1Manifest?.tracers ?? []).map((tracer) => tracer.file),
    ]);
    const originalBootstrapPaths = changedPaths(originalSchema5Commit);
    const originalTransitionValid = Boolean(
      singleParent(originMainCommitAtRead, "pre-trust policy correction") ===
        originalSchema5Commit &&
      singleParent(originalSchema5Commit, "original schema-5 bootstrap") ===
        originalSchema1Commit &&
      originalSchema1Manifest?.schemaVersion === 1 &&
      !manifestHasMutableProgress(originalSchema1Manifest) &&
      strictCommitPaths.includes(manifestRepoPath) &&
      originalBootstrapPaths.includes(manifestRepoPath) &&
      originalBootstrapPaths.every((file) => originalBootstrapAllowedPaths.has(file))
    );
    try {
      assertPreTrustCorrection({
        trustedCommit: trustedOriginCommitAtRead,
        checkpointEstablished: checkpointEstablishedAtRead,
        schema5ManifestChangingCommitCount: schema5CommitCount,
        anchorHasProgress: manifestHasMutableProgress(priorOriginManifest),
        candidateHasProgress: rawExistingHasProgress,
        originalTransitionValid,
        currentEvidenceFiles: gitFilesUnder(
          originMainCommitAtRead,
          ".scratch/instrument-intelligence/evidence"
        ).sort(),
        historicalEvidenceFiles: [
          gitFilesUnder(originalSchema5Commit, ".scratch/instrument-intelligence/evidence").sort(),
          gitFilesUnder(originalSchema1Commit, ".scratch/instrument-intelligence/evidence").sort(),
        ],
        changedPaths: strictCommitPaths,
        allowedPaths: [...preTrustCorrectionAllowedPaths],
        requiredPaths: [...requiredPreTrustCorrectionPaths],
        manifestPath: manifestRepoPath,
        publicationTrust: compatibleOriginManifest.publicationTrust,
      });
      preTrustCorrectionTransition = true;
    } catch (error) {
      fail(error.message);
    }
  }
  if (preTrustCorrectionCandidate && !preTrustCorrectionTransition) {
    fail("the sole pre-trust correction does not satisfy its closed path and lineage contract");
  }
  if (checkpointSteadyAtRead) {
    if (trustBootstrap) {
      fail("--trust-bootstrap cannot replace an existing Owner-local trust checkpoint");
    }
  } else if (bootstrapTransition) {
    const bootstrapParent = singleParent(originMainCommitAtRead, "schema-5 bootstrap commit");
    const bootstrapParentIssuePaths = gitFilesUnder(
      bootstrapParent,
      ".scratch/instrument-intelligence/issues"
    ).filter((file) => /^\.scratch\/instrument-intelligence\/issues\/\d+-.*\.md$/.test(file));
    const allowedBootstrapPaths = new Set([
      manifestRepoPath,
      "SPEC.md",
      ".scratch/instrument-intelligence/PLAN.md",
      ".scratch/instrument-intelligence/REQUIREMENTS.md",
      ...verificationAuthorityPaths,
      ...domainAuthorityPaths,
      ...issues.map((issue) => issue.file),
      ...bootstrapParentIssuePaths,
      ...(rawTransitionAnchorManifest?.tracers ?? []).map((tracer) => tracer.file),
    ]);
    if (
      !priorManifestChangingCommit ||
      !gitBytesAt(bootstrapParent, manifestRepoPath).equals(
        gitBytesAt(priorManifestChangingCommit, manifestRepoPath)
      ) ||
      !strictCommitPaths.includes(manifestRepoPath) ||
      strictCommitPaths.some((file) => !allowedBootstrapPaths.has(file))
    ) {
      fail(
        "the one-time schema-5 bootstrap must be one governance-only commit over the exact prior schema-1 manifest"
      );
    }
  } else if (!preTrustCorrectionTransition) {
    if (t01PreregistrationTransition) {
      const expectedPaths = [...t01PreregistrationAllowedPaths].sort();
      const schema6HistoryCount = originManifestChangingCommits
        .map((commit) => gitJsonAt(commit, manifestRepoPath, { required: true }))
        .filter((candidate) => candidate?.schemaVersion === CURRENT_MANIFEST_SCHEMA).length;
      const publicEvidenceFiles = gitFilesUnder(
        originMainCommitAtRead,
        ".scratch/instrument-intelligence/evidence"
      ).sort();
      const anchor = compatibleTransitionAnchorManifest;
      const candidate = compatibleExistingManifest;
      const anchorRegistryEvents = anchor.idPolicy?.registryEvents ?? [];
      const candidateRegistryEvents = candidate.idPolicy?.registryEvents ?? [];
      const revisionEvent = candidateRegistryEvents.at(-1);
      const revisions = revisionEvent?.revisedDefinitions ?? [];
      const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
      const expectedRevisionIds = t01PreregistrationAllowedPaths
        .filter((governedPath) =>
          governedPath.startsWith(".scratch/instrument-intelligence/issues/")
        )
        .map((governedPath) => Number(path.posix.basename(governedPath).match(/^\d+/)?.[0]))
        .sort((left, right) => left - right);
      const anchorTracerById = new Map((anchor.tracers ?? []).map((tracer) => [tracer.id, tracer]));
      const candidateTracerById = new Map(
        (candidate.tracers ?? []).map((tracer) => [tracer.id, tracer])
      );
      const normalizeT01TracerSchema = (tracer) => {
        if (!tracer) return tracer;
        const { remoteReachabilityReceipt, remotePublicationReceipt, ...stable } = tracer;
        return {
          ...stable,
          remotePublicationReceipt:
            remotePublicationReceipt !== undefined
              ? remotePublicationReceipt
              : remoteReachabilityReceipt,
        };
      };
      const tracerRevisionIsExact = [...candidateTracerById].every(([id, tracer]) => {
        const previous = anchorTracerById.get(id);
        const revision = revisionById.get(id);
        if (!revision) {
          return (
            JSON.stringify(normalizeT01TracerSchema(tracer)) ===
            JSON.stringify(normalizeT01TracerSchema(previous))
          );
        }
        if (
          !previous ||
          revision.previousDefinitionDigest !== previous.definitionDigest ||
          revision.definitionDigest !== tracer.definitionDigest
        ) {
          return false;
        }
        const previousStable = {
          ...normalizeT01TracerSchema(previous),
          requirementIds: undefined,
          definitionDigest: undefined,
        };
        const candidateStable = {
          ...normalizeT01TracerSchema(tracer),
          requirementIds: undefined,
          definitionDigest: undefined,
        };
        return JSON.stringify(previousStable) === JSON.stringify(candidateStable);
      });
      const anchorStaticIdPolicy = {
        ...anchor.idPolicy,
        registryGeneration: undefined,
        previousRegistryHead: undefined,
        registryHead: undefined,
        registryEvents: undefined,
      };
      const candidateStaticIdPolicy = {
        ...candidate.idPolicy,
        registryGeneration: undefined,
        previousRegistryHead: undefined,
        registryHead: undefined,
        registryEvents: undefined,
      };
      if (
        singleParent(originMainCommitAtRead, "T01 governance pre-registration") !==
          trustedOriginCommitAtRead ||
        JSON.stringify(strictCommitPaths) !== JSON.stringify(expectedPaths) ||
        schema6HistoryCount !== 1 ||
        manifestHasMutableProgress(anchor) ||
        manifestHasMutableProgress(candidate) ||
        JSON.stringify(candidateStaticIdPolicy) !== JSON.stringify(anchorStaticIdPolicy) ||
        candidateRegistryEvents.length !== anchorRegistryEvents.length + 1 ||
        JSON.stringify(candidateRegistryEvents.slice(0, -1)) !==
          JSON.stringify(anchorRegistryEvents) ||
        revisionEvent?.generation !== (anchor.idPolicy?.registryGeneration ?? 0) + 1 ||
        revisionEvent?.previousHead !== anchor.idPolicy?.registryHead ||
        revisionEvent?.head !== candidate.idPolicy?.registryHead ||
        candidate.idPolicy?.registryGeneration !== revisionEvent?.generation ||
        candidate.idPolicy?.previousRegistryHead !== revisionEvent?.previousHead ||
        (revisionEvent?.addedDefinitions ?? []).length !== 0 ||
        (revisionEvent?.tombstonesAdded ?? []).length !== 0 ||
        revisions.length === 0 ||
        revisionById.size !== revisions.length ||
        JSON.stringify([...revisionById.keys()].sort((left, right) => left - right)) !==
          JSON.stringify(expectedRevisionIds) ||
        candidateTracerById.size !== anchorTracerById.size ||
        !tracerRevisionIsExact ||
        (candidate.executionGenerations ?? []).length !== 0 ||
        (candidate.stateEdges ?? []).length !== 0 ||
        Object.keys(candidate.requirementEvidence ?? {}).length !== 0 ||
        Object.keys(candidate.clauseEvidence ?? {}).length !== 0 ||
        (candidate.remediationObligations?.obligations ?? []).length !== 0 ||
        (candidate.remediationObligations?.events ?? []).length !== 0 ||
        candidate.authorityHistory?.authoritySets?.length !== 1 ||
        candidate.authorityHistory?.migrations?.length !== 0 ||
        (candidate.idPolicy?.tombstones ?? []).length !== 0 ||
        candidate.closureState?.machineComplete !== "pending" ||
        candidate.closureState?.releaseComplete !== "pending" ||
        candidate.closureState?.provisionalStopped !== false ||
        candidate.status !== "preregistered" ||
        JSON.stringify(candidate.publicationTrust) !== JSON.stringify(anchor.publicationTrust) ||
        JSON.stringify(publicEvidenceFiles) !==
          JSON.stringify([".scratch/instrument-intelligence/evidence/.gitkeep"])
      ) {
        fail(
          "T01 schema-6 pre-registration must be the sole direct, evidence-empty, immutable-registry governance transaction"
        );
      }
    } else if (governedRegistryTailChange) {
      const expectedRegistryPaths = new Set([
        manifestRepoPath,
        ".scratch/instrument-intelligence/PLAN.md",
      ]);
      for (const id of addedIds) expectedRegistryPaths.add(byId.get(id).file);
      for (const id of removedLiveIds) {
        expectedRegistryPaths.add(oldTracers.get(id).file);
      }
      if (
        !declaredGovernedAuthorityMigration ||
        singleParent(originMainCommitAtRead, "governed registry-tail migration") !==
          trustedOriginCommitAtRead ||
        newlyAppendedExecutionGenerations.length !== 0 ||
        JSON.stringify(strictCommitPaths) !== JSON.stringify([...expectedRegistryPaths].sort())
      ) {
        fail("a registry transaction changed paths outside its manifest/PLAN/one-definition scope");
      }
    } else if (declaredGovernedAuthorityMigration) {
      const migration = appendedAuthorityMigrations[0];
      const fromAuthoritySet = authorityHistory.authoritySets.find(
        (authoritySet) => authoritySet.authoritySetDigest === migration.fromAuthoritySetDigest
      );
      const toAuthoritySet = authorityHistory.authoritySets.find(
        (authoritySet) => authoritySet.authoritySetDigest === migration.toAuthoritySetDigest
      );
      const expectedMigrationPaths = [
        manifestRepoPath,
        ...changedAuthorityPathsBetween(fromAuthoritySet, toAuthoritySet),
      ].sort();
      if (
        singleParent(originMainCommitAtRead, "governed authority migration") !==
          trustedOriginCommitAtRead ||
        newlyAppendedExecutionGenerations.length !== 0 ||
        JSON.stringify(strictCommitPaths) !== JSON.stringify(expectedMigrationPaths)
      ) {
        fail(
          "a governed authority migration must be one direct manifest/changed-authority transaction with no appended execution generation"
        );
      }
    } else if (!hasMutableProgress && (authorityChanged || definitionChanged)) {
      if (!checkpointEstablishedAtRead) {
        fail("an untrusted authority migration is not an authorized pre-trust correction");
      }
      const allowedMigrationPaths = authorityMigrationAllowedPaths;
      if (
        !strictCommitPaths.includes(manifestRepoPath) ||
        strictCommitPaths.some((file) => !allowedMigrationPaths.has(file))
      ) {
        fail("a pre-execution authority migration changed non-governance/product paths");
      }
    } else if (
      newlyAppendedExecutionGenerations.length !== 1 ||
      JSON.stringify(strictCommitPaths) !== JSON.stringify([manifestRepoPath])
    ) {
      fail(
        "a progressed receipt transaction must append one generation and change only the manifest"
      );
    }
  }
  const localManifestBytes = readFileSync(manifestPath);
  if (localManifestBytes.toString("utf8") !== serialized) {
    fail("completion manifest is stale; regenerate and push it before strict verification");
  }
  if (!originManifestBytes || !localManifestBytes.equals(originManifestBytes)) {
    fail("strict verification requires canonical manifest bytes to equal origin/main exactly");
  }
  const originAdrFiles = gitFilesUnder("origin/main", "docs/adr")
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.posix.basename(file))
    .sort();
  if (JSON.stringify(originAdrFiles) !== JSON.stringify(domainAdrFiles)) {
    fail("the local and origin/main accepted-ADR authority path sets differ");
  }
  for (const governedPath of strictGovernedPaths) {
    const localPath = path.join(root, governedPath);
    if (
      !existsSync(localPath) ||
      lstatSync(localPath).isSymbolicLink() ||
      !lstatSync(localPath).isFile()
    ) {
      fail(`strict verification requires a regular local governed file: ${governedPath}`);
    }
    requireCommittedRegularFile("origin/main", governedPath);
    const localBytes = readLocalBytes(governedPath);
    if (!localBytes.equals(gitBytesAt("origin/main", governedPath))) {
      fail(`${governedPath} differs between the worktree and current origin/main`);
    }
    const expectedDigest = strictExpectedDigests.get(governedPath);
    if (expectedDigest && digest(localBytes) !== expectedDigest) {
      fail(`${governedPath} differs from its latest execution-generation receipt`);
    }
  }
  assertLocalReadSetUnchanged(issueFiles);
  const localHead = optionalRefCommit("HEAD");
  let worktreeStatus;
  try {
    worktreeStatus = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    fail("cannot verify the strict post-push worktree state");
  }
  if (localHead !== originMainCommitAtRead || worktreeStatus) {
    fail("strict verification requires local HEAD == origin/main and a completely clean worktree");
  }
  refreshOriginMain();
  const originMainCommitAtEnd = originMainCommit();
  const attestedOriginMainAtEnd = githubPublicationHead();
  try {
    assertStablePublicationObservation({
      commitAtRead: originMainCommitAtRead,
      commitAtEnd: originMainCommitAtEnd,
      attestedCommitAtRead: attestedOriginMainAtRead,
      attestedCommitAtEnd: attestedOriginMainAtEnd,
      trustAtRead: publicationTrustAtRead,
      trustAtEnd: originRemoteUrls(),
    });
  } catch (error) {
    fail(error.message);
  }
  if (
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF) !== trustedOriginCommitAtRead ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF) !== bootstrapAnchorAtRead ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF) !== trustPolicyObjectAtRead
  ) {
    fail("the Owner-local publication checkpoint changed during strict verification");
  }
  if (!trustedOriginCommitAtRead) {
    try {
      assertTrustBootstrapAllowed({
        requested: trustBootstrap,
        trustedCommit: trustedOriginCommitAtRead,
        checkpointEstablished: checkpointEstablishedAtRead,
        bootstrapTransition,
        preTrustCorrectionTransition,
        hasMutableProgress: rawExistingHasProgress,
      });
    } catch (error) {
      fail(error.message);
    }
  } else if (trustBootstrap) {
    fail("--trust-bootstrap cannot replace an existing Owner-local trust checkpoint");
  }
  if (!checkpointSteadyAtRead) {
    advanceTrustedPublicationCheckpoint({
      newCommit: originMainCommitAtRead,
      oldCommit: trustedOriginCommitAtRead,
      bootstrapAnchor: bootstrapAnchorAtRead,
      policyObject: trustPolicyObjectAtRead,
    });
  }
  if (
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF) !== originMainCommitAtRead ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF) !==
      (bootstrapAnchorAtRead ?? originMainCommitAtRead) ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF) !== expectedTrustPolicyObject
  ) {
    fail("the atomic Owner-local publication checkpoint transaction did not persist exactly");
  }
  console.log(
    `Instrument Intelligence schema-${outputManifestSchema} strictly verified at the pinned origin/main publication head: ${issues.length} stable tracers, remote protection not assumed, and the Owner-local trust checkpoint is current.`
  );
}
