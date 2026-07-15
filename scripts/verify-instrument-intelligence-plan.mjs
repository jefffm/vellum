import { createHash } from "node:crypto";
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
const manifestLockPath = `${manifestPath}.lock`;
const writeManifest = process.argv.includes("--write-manifest");
const draftMode = writeManifest || process.argv.includes("--draft");
const trustBootstrap = process.argv.includes("--trust-bootstrap");
if (trustBootstrap && draftMode) {
  fail("--trust-bootstrap is a strict one-time Owner ceremony, not a draft/write option");
}
const verificationAuthorityPaths = [
  "package.json",
  "package-lock.json",
  ".prettierrc",
  "flake.nix",
  "flake.lock",
  "scripts/nix-podman",
  "scripts/lib/instrument-intelligence-trust.mjs",
  "scripts/verify-current-spec.mjs",
  "scripts/verify-instrument-intelligence-plan.mjs",
  "test/instrument-intelligence/bootstrap-trust-policy.test.ts",
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
    value.closureState?.machineComplete === "pass" ||
    value.closureState?.releaseComplete === "pass" ||
    value.closureState?.provisionalStopped === true ||
    value.machineComplete === "pass" ||
    value.releaseComplete === "pass" ||
    (value.tracers ?? []).some(
      (tracer) =>
        tracer.implementationCommit ||
        tracer.remoteReachabilityReceipt ||
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
const compatibleOriginManifest = originManifest?.schemaVersion === 5 ? originManifest : null;
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
const rawTransitionAnchorManifest = draftMode ? originManifest : priorOriginManifest;
const compatibleTransitionAnchorManifest =
  rawTransitionAnchorManifest?.schemaVersion === 5 ? rawTransitionAnchorManifest : null;
if (
  rawTransitionAnchorManifest &&
  !compatibleTransitionAnchorManifest &&
  (rawTransitionAnchorManifest.schemaVersion !== 1 ||
    manifestHasMutableProgress(rawTransitionAnchorManifest))
) {
  fail("the trusted transition anchor is neither schema 5 nor an unprogressed schema-1 bootstrap");
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
const compatibleExistingManifest =
  existingManifest?.schemaVersion === 5 ? existingManifest : undefined;
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
  return {
    generation: event.generation,
    previousHead: event.previousHead,
    addedDefinitions: event.addedDefinitions,
    tombstonesAdded: event.tombstonesAdded,
  };
}

function replayRegistryEvents(events) {
  const definitions = new Map();
  const replayedTombstones = new Map();
  let head = null;
  let generation = 0;
  let highest = 0;
  for (const event of events) {
    exactKeys(
      event,
      ["addedDefinitions", "generation", "head", "previousHead", "tombstonesAdded"],
      `registry event ${event?.generation}`
    );
    if (
      !event ||
      typeof event !== "object" ||
      Array.isArray(event) ||
      event.generation !== generation + 1 ||
      event.previousHead !== head ||
      !Array.isArray(event.addedDefinitions) ||
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
    clauseLedgerStatus:
      compatibleTransitionAnchorManifest?.authorities?.requirementFamilyIndex?.clauseLedgerStatus ??
      "bootstrap_pending_T01",
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
if (hasMutableProgress && (authorityChanged || definitionChanged) && !governedRegistryTailChange) {
  fail(
    "authority or existing tracer definitions changed after evidence existed; only one governed dynamic append or exact tombstone transaction may preserve history"
  );
}

const registryDefinitionsChanged =
  !registryHistoryMissing &&
  issues.some(
    (issue) =>
      previousIds.has(issue.id) &&
      replayedRegistry.definitions.get(issue.id) !== issue.definitionDigest
  );
const registryNeedsRebaseline = registryHistoryMissing || registryDefinitionsChanged;
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
  registryNeedsRebaseline || newlyAddedDefinitions.length > 0 || newlyAddedTombstones.length > 0;
let registryEvents = priorRegistryEvents;
if (registryChanged) {
  const eventPayload = {
    generation: priorRegistryGeneration + 1,
    previousHead: previousRegistryHead,
    addedDefinitions: newlyAddedDefinitions,
    tombstonesAdded: newlyAddedTombstones,
  };
  registryEvents = [
    ...priorRegistryEvents,
    { ...eventPayload, head: digest(JSON.stringify(eventPayload)) },
  ];
}
const finalRegistry = replayRegistryEvents(registryEvents);
const registryGeneration = finalRegistry.generation;
const registryHead = finalRegistry.head;
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
  ((!authorityChanged && !definitionChanged) || governedRegistryTailChange)
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

function validReachabilityReceipt(value, implementationCommit) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") ===
      ["branch", "checkedAt", "commit", "reachable", "remote"].sort().join(",") &&
    value.remote === "origin" &&
    value.branch === "main" &&
    value.commit === implementationCommit &&
    value.reachable === true &&
    validIsoInstant(value.checkedAt)
  );
}

const authoritySnapshotKeys = [
  "domainModelDigest",
  "planDigest",
  "planNarrativeDigest",
  "registryHead",
  "requirementFamilyIndexDigest",
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

function validatePublicArtifactPayload(artifact, bytes, context) {
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
      ["artifactId", "commandDigest", "outputDigest", "schemaId", "status"],
      context
    );
    if (!validDigest(payload.commandDigest) || !validDigest(payload.outputDigest)) {
      fail(`${context} gate-log digests are invalid`);
    }
  } else if (artifact.schemaId === "vellum.test-report.v1") {
    exactKeys(
      payload,
      ["artifactId", "failed", "outputDigest", "passed", "schemaId", "skipped", "status"],
      context
    );
    if (
      !validDigest(payload.outputDigest) ||
      ![payload.passed, payload.failed, payload.skipped].every(
        (count) => Number.isInteger(count) && count >= 0
      ) ||
      (payload.status === "pass" && (payload.failed !== 0 || payload.passed < 1)) ||
      (payload.status === "fail" && payload.failed < 1)
    ) {
      fail(`${context} test-report counts/status/digest are invalid`);
    }
  } else if (artifact.schemaId === "vellum.public-review-receipt.v1") {
    exactKeys(payload, ["artifactId", "outputDigest", "schemaId", "status"], context);
    if (!validDigest(payload.outputDigest)) fail(`${context} review output digest is invalid`);
  } else if (artifact.schemaId === "vellum.remediation-dispatch.v1") {
    exactKeys(
      payload,
      [
        "artifactId",
        "closureTargets",
        "findingId",
        "invalidations",
        "outputDigest",
        "rejoinAt",
        "repairTracerId",
        "schemaId",
        "status",
      ],
      context
    );
    if (
      !validDigest(payload.outputDigest) ||
      payload.status !== "pass" ||
      !/^finding_[a-f0-9]{16,64}$/.test(payload.findingId ?? "") ||
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

function validateEvidenceReceipt(evidenceBytes, generation, definition) {
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
    const payload = validatePublicArtifactPayload(artifact, committedArtifactBytes, artifact.path);
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
  const committedPaths = [
    definition.evidencePath,
    generation.definitionPath,
    "SPEC.md",
    ".scratch/instrument-intelligence/PLAN.md",
    ".scratch/instrument-intelligence/REQUIREMENTS.md",
    manifestRepoPath,
    ...verificationAuthorityPaths,
    ...domainAuthorityPaths,
  ];
  for (const committedPath of committedPaths) {
    requireCommittedRegularFile(generation.implementationCommit, committedPath);
  }
  for (const immutablePath of [
    generation.definitionPath,
    "SPEC.md",
    ".scratch/instrument-intelligence/PLAN.md",
    ".scratch/instrument-intelligence/REQUIREMENTS.md",
    manifestRepoPath,
    ...verificationAuthorityPaths,
    ...domainAuthorityPaths,
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
  const committedVerifierDigest = authorityBundleDigest(
    verificationAuthorityPaths,
    (governedPath) => gitBytesAt(generation.implementationCommit, governedPath)
  );
  const committedDomainModelDigest = authorityBundleDigest(domainAuthorityPaths, (governedPath) =>
    gitBytesAt(generation.implementationCommit, governedPath)
  );
  const snapshot = generation.authoritySnapshot;
  if (
    digest(committedSpec) !== snapshot.specificationDigest ||
    digest(committedPlan) !== snapshot.planDigest ||
    planNarrativeDigestFor(committedPlan.toString("utf8")) !== snapshot.planNarrativeDigest ||
    digest(committedRequirements) !== snapshot.requirementFamilyIndexDigest ||
    committedVerifierDigest !== snapshot.verifierDigest ||
    committedDomainModelDigest !== snapshot.domainModelDigest
  ) {
    fail(`${key} authoritySnapshot does not match its implementation commit`);
  }
  const committedManifest = gitJsonAt(generation.implementationCommit, manifestRepoPath, {
    required: true,
  });
  const committedTracer = committedManifest?.tracers?.find(
    (tracer) => tracer.id === generation.tracerId
  );
  if (
    committedManifest?.schemaVersion !== 5 ||
    committedManifest.authorities?.specification?.digest !== snapshot.specificationDigest ||
    committedManifest.authorities?.plan?.digest !== snapshot.planDigest ||
    committedManifest.authorities?.plan?.narrativeDigest !== snapshot.planNarrativeDigest ||
    committedManifest.authorities?.requirementFamilyIndex?.digest !==
      snapshot.requirementFamilyIndexDigest ||
    committedManifest.authorities?.verifier?.digest !== snapshot.verifierDigest ||
    JSON.stringify(committedManifest.authorities?.verifier?.paths) !==
      JSON.stringify(verificationAuthorityPaths) ||
    committedManifest.authorities?.domainModel?.digest !== snapshot.domainModelDigest ||
    JSON.stringify(committedManifest.authorities?.domainModel?.paths) !==
      JSON.stringify(domainAuthorityPaths) ||
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
    Date.parse(generation.remoteReachabilityReceipt.checkedAt) < committedAt ||
    Date.parse(generation.remoteReachabilityReceipt.checkedAt) > Date.now() + 5 * 60 * 1000
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
  "remoteReachabilityReceipt",
  "resultCode",
  "supersedes",
  "tracerId",
];
const dynamicExecutionGenerationKeys = [
  ...baseExecutionGenerationKeys,
  "closureTargets",
  "dispatch",
  "invalidatesMachineComplete",
  "invalidationScopes",
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
    !validReachabilityReceipt(generation.remoteReachabilityReceipt, generation.implementationCommit)
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
      invalidatedGenerationKeys.has(targetKey) ||
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

for (const definition of issues) {
  const currentGeneration = currentGenerationFor(definition.id);
  if (currentGeneration == null) continue;
  const currentKey = `${definition.id}:${currentGeneration}`;
  if (!generationIsActive(currentKey)) continue;
  const receipt = generationByKey.get(currentKey);
  if (
    receipt.authoritySnapshot.specificationDigest !== authorityInputs.specification.digest ||
    receipt.authoritySnapshot.planNarrativeDigest !== authorityInputs.plan.narrativeDigest ||
    receipt.authoritySnapshot.requirementFamilyIndexDigest !==
      authorityInputs.requirementFamilyIndex.digest ||
    receipt.authoritySnapshot.verifierDigest !== authorityInputs.verifier.digest ||
    receipt.authoritySnapshot.domainModelDigest !== authorityInputs.domainModel.digest ||
    !registryEvents.some((event) => event.head === receipt.authoritySnapshot.registryHead)
  ) {
    fail(`${currentKey} is active under a stale authority or non-ancestor registry snapshot`);
  }
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
    ["artifactDigest", "artifactId", "findingId", "source"],
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

const requirementEvidence = canPreserveGlobalState
  ? (compatibleExistingManifest.requirementEvidence ?? {})
  : {};
if (
  !requirementEvidence ||
  typeof requirementEvidence !== "object" ||
  Array.isArray(requirementEvidence)
) {
  fail("requirementEvidence must be an object of append-only record arrays");
}
for (const [requirementId, records] of Object.entries(requirementEvidence)) {
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

const manifest = {
  schemaVersion: 5,
  status: "bootstrap_pending",
  objective: "Release Complete Vellum Instrument Intelligence",
  authorities: authorityInputs,
  publicationTrust: publicationTrustAtRead,
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
      authorityInputs.requirementFamilyIndex.clauseLedgerStatus === "bootstrap_pending_T01"
        ? "bootstrap_locked_T01"
        : "governed_receipts_active",
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
      "active",
      "machine_complete",
      "release_complete",
      "provisional_stopped",
    ],
    goalSatisfiedOnlyBy: "release_complete",
  },
  privacyPolicy: {
    publicReceiptFields: {
      opaque_case_id: "random non-resolving identifier",
      coverage_class: "value from the public precommitted coverage taxonomy",
      vault_commitment:
        "keyed non-resolving commitment; never a direct hidden-source or truth digest",
      public_artifact_digest: "digest only of bytes already authorized for public disclosure",
      aggregate_status: "bounded enum with minimum aggregation cardinality",
      requirement_ids: "known public requirement-family identifiers only",
      typed_redaction_receipt: "schema-bounded fields; never free-form text or arbitrary nesting",
    },
    evidenceSchema: "vellum.instrument-intelligence-verification.v1-closed",
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
      remoteReachabilityReceipt: currentReceipt ? currentReceipt.remoteReachabilityReceipt : null,
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
    !validReachabilityReceipt(receipt.remoteReachabilityReceipt, receipt.implementationCommit) ||
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
const machinePass = Boolean(
  machineKey &&
  machineTracer?.computedEligibility === "eligible" &&
  machineReceipt &&
  closureHasCurrentRequirementCoverage("II-MC-", machineKey) &&
  closureRespectsInvalidations(machineKey, "machine_closure") &&
  dynamicMachineContractsSatisfied(machineKey)
);
const releasePass = Boolean(
  machinePass &&
  releaseKey &&
  releaseTracer?.computedEligibility === "eligible" &&
  releaseReceipt &&
  closureHasCurrentRequirementCoverage("II-RC-", releaseKey) &&
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
      `Wrote execution-locked schema-5 bootstrap ${path.relative(root, manifestPath)} with ${issues.length} registered tracers; commit and push it before strict verification.`
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
    `Instrument Intelligence bootstrap draft verified: ${issues.length} stable tracers, typed acyclic predicates, no mutable progress, and no public evidence.`
  );
} else {
  if (!compatibleOriginManifest) {
    fail(
      "strict verification requires the schema-5 bootstrap manifest on origin/main; write, commit, and push the draft first"
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
  if (bootstrapTransition) {
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
    if (governedRegistryTailChange) {
      const expectedRegistryPaths = new Set([
        manifestRepoPath,
        ".scratch/instrument-intelligence/PLAN.md",
      ]);
      for (const id of addedIds) expectedRegistryPaths.add(byId.get(id).file);
      for (const id of removedLiveIds) {
        expectedRegistryPaths.add(oldTracers.get(id).file);
      }
      if (JSON.stringify(strictCommitPaths) !== JSON.stringify([...expectedRegistryPaths].sort())) {
        fail("a registry transaction changed paths outside its manifest/PLAN/one-definition scope");
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
  advanceTrustedPublicationCheckpoint({
    newCommit: originMainCommitAtRead,
    oldCommit: trustedOriginCommitAtRead,
    bootstrapAnchor: bootstrapAnchorAtRead,
    policyObject: trustPolicyObjectAtRead,
  });
  if (
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF) !== originMainCommitAtRead ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF) !==
      (bootstrapAnchorAtRead ?? originMainCommitAtRead) ||
    optionalRefCommit(INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF) !== expectedTrustPolicyObject
  ) {
    fail("the atomic Owner-local publication checkpoint transaction did not persist exactly");
  }
  console.log(
    `Instrument Intelligence schema-5 bootstrap strictly verified at the pinned origin/main publication head: ${issues.length} stable tracers, execution locked pending T01, remote protection not assumed, and Owner-local trust checkpoint advanced.`
  );
}
