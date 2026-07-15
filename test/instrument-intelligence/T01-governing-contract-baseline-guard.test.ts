import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  accessSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF,
  INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF,
  INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF,
  canonicalPublicationTrustBytes,
} from "../../scripts/lib/instrument-intelligence-trust.mjs";

const root = resolve(".");
const manifestPath = ".scratch/instrument-intelligence/completion-manifest.json";
const verifierPath = "scripts/verify-instrument-intelligence-plan.mjs";
const pinnedRemote = "git@github.com:jefffm/vellum.git";

// This list is deliberately independent of the verifier's own allowlist. A change to the
// governance transaction therefore requires an explicit review of both production policy and
// its canary instead of letting the verifier silently broaden the transaction it approves.
const exactPreregistrationPaths = [
  ".scratch/instrument-intelligence/REQUIREMENTS.md",
  ".scratch/instrument-intelligence/clause-ledger.json",
  ".scratch/instrument-intelligence/completion-manifest.json",
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
  ".scratch/instrument-intelligence/review-authority-catalog.json",
  "SPEC.md",
  "schemas/instrument-intelligence/clause-ledger.schema.json",
  "schemas/instrument-intelligence/evidence.v2.schema.json",
  "schemas/instrument-intelligence/start-receipt.v1.schema.json",
  "scripts/generate-instrument-intelligence-clause-ledger.mjs",
  "scripts/lib/instrument-intelligence-clause-ledger.mjs",
  "scripts/lib/instrument-intelligence-receipts.mjs",
  "scripts/lib/instrument-intelligence-results.mjs",
  "scripts/verify-instrument-intelligence-plan.mjs",
  "test/instrument-intelligence/T01-clause-ledger.test.ts",
  "test/instrument-intelligence/T01-governing-contract-baseline-guard.test.ts",
  "test/instrument-intelligence/receipt-contract.test.ts",
  "test/instrument-intelligence/result-contract.test.ts",
].sort();

type JsonObject = Record<string, any>;

interface Fixture {
  anchor: string;
  candidate: string;
  directory: string;
  environment: NodeJS.ProcessEnv;
  policyObject: string;
  repo: string;
}

function executableOnPath(name: string): string {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return realpathSync(candidate);
    } catch {
      // Keep looking for the executable selected by the unmodified test environment.
    }
  }
  throw new Error(`${name} is unavailable on PATH`);
}

const realGit = executableOnPath("git");

function run(
  executable: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: Buffer | string;
    timeout?: number;
  } = {}
): string {
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} exited ${String(result.status)}\n${output}`.trim()
    );
  }
  return output.trim();
}

function git(cwd: string, args: string[], input?: Buffer | string): string {
  return run(realGit, args, { cwd, input });
}

function manifestAt(cwd: string, commit: string): JsonObject {
  return JSON.parse(git(cwd, ["show", `${commit}:${manifestPath}`])) as JsonObject;
}

function manifestHistory(cwd: string): string[] {
  return git(cwd, ["log", "--first-parent", "--format=%H", "HEAD", "--", manifestPath])
    .split("\n")
    .filter(Boolean);
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function projectedProductTreeDigest(cwd: string, commit: string): string {
  const records = git(cwd, ["ls-tree", "-r", "-z", "--full-tree", commit])
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const match = record.match(/^(\d+)\s+(\w+)\s+([a-f0-9]+)\t(.+)$/);
      if (!match) throw new Error(`cannot parse projected product tree record: ${record}`);
      return { mode: match[1], type: match[2], object: match[3], path: match[4] };
    })
    .filter(
      (entry) =>
        entry.path !== manifestPath &&
        !entry.path.startsWith(".scratch/instrument-intelligence/evidence/")
    );
  return sha256(JSON.stringify(records));
}

function findSchema5Anchor(): string {
  const anchor = manifestHistory(root).find(
    (commit) => manifestAt(root, commit).schemaVersion === 5
  );
  if (!anchor) throw new Error("the repository has no schema-5 bootstrap anchor");
  return anchor;
}

function findCommittedPreregistration(anchor: string): string | null {
  for (const commit of manifestHistory(root)) {
    if (manifestAt(root, commit).schemaVersion !== 6) continue;
    if (git(root, ["rev-parse", `${commit}^`]) === anchor) return commit;
  }
  return null;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function writeObservationWrappers(directory: string): NodeJS.ProcessEnv {
  const bin = join(directory, "fake-bin");
  mkdirSync(bin, { recursive: true });
  const quotedGit = shellQuote(realGit);
  const gitWrapper = join(bin, "git");
  writeFileSync(
    gitWrapper,
    [
      "#!/bin/sh",
      'if [ "$1" = "fetch" ]; then',
      "  exit 0",
      "fi",
      `exec ${quotedGit} "$@"`,
      "",
    ].join("\n")
  );
  chmodSync(gitWrapper, 0o755);

  const ghWrapper = join(bin, "gh");
  writeFileSync(
    ghWrapper,
    [
      "#!/bin/sh",
      'if [ "$1" = "config" ] && [ "$2" = "get" ]; then',
      "  exit 0",
      "fi",
      'if [ "$1" = "api" ] && [ "$2" = "graphql" ]; then',
      `  oid=$(${quotedGit} rev-parse refs/remotes/origin/main) || exit 1`,
      `  printf '%s\\n' '{"data":{"repository":{"id":"R_kgDOSNEx6w","databaseId":1221669355,"nameWithOwner":"jefffm/vellum","ref":{"name":"main","target":{"__typename":"Commit","oid":"'"$oid"'"}}}}}'`,
      "  exit 0",
      "fi",
      "exit 64",
      "",
    ].join("\n")
  );
  chmodSync(ghWrapper, 0o755);

  const environment: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  for (const name of [
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
  ]) {
    delete environment[name];
  }
  return environment;
}

function runVerifier(fixture: Fixture, args: string[] = []): string {
  return run(process.execPath, [verifierPath, ...args], {
    cwd: fixture.repo,
    env: fixture.environment,
    timeout: 180_000,
  });
}

function initializeTrust(fixture: Omit<Fixture, "candidate">, trustedCommit: string): void {
  git(fixture.repo, ["update-ref", INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF, fixture.anchor]);
  git(fixture.repo, ["update-ref", INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF, fixture.policyObject]);
  git(fixture.repo, ["update-ref", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF, trustedCommit]);
}

function copyProspectiveTransaction(repo: string): void {
  for (const relativePath of exactPreregistrationPaths) {
    if (relativePath === manifestPath) continue;
    const source = join(root, relativePath);
    if (!existsSync(source)) {
      throw new Error(`prospective T01 path is missing from the worktree: ${relativePath}`);
    }
    const destination = join(repo, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}

function buildFixture(): Fixture {
  const directory = join(tmpdir(), `vellum-t01-canary-${process.pid}-${Date.now()}`);
  const repo = join(directory, "repo");
  mkdirSync(directory, { recursive: true });
  git(root, ["clone", "--quiet", "--no-hardlinks", root, repo]);
  git(repo, ["config", "user.name", "Vellum T01 Canary"]);
  git(repo, ["config", "user.email", "vellum-t01-canary@example.invalid"]);
  git(repo, ["remote", "set-url", "origin", pinnedRemote]);
  // Keep the fixture worktree clean: an actual ignored node_modules directory containing only
  // the one package imported by the verifier avoids turning a root-level directory symlink into
  // an untracked or staged governance path.
  mkdirSync(join(repo, "node_modules"));
  symlinkSync(join(root, "node_modules/prettier"), join(repo, "node_modules/prettier"), "dir");

  const anchor = findSchema5Anchor();
  const committedCandidate = findCommittedPreregistration(anchor);
  git(repo, ["checkout", "--quiet", "-B", "main", committedCandidate ?? anchor]);
  const environment = writeObservationWrappers(directory);
  const policyObject = git(
    repo,
    ["hash-object", "-w", "--stdin"],
    canonicalPublicationTrustBytes()
  );
  const partialFixture = { anchor, directory, environment, policyObject, repo };

  let candidate = committedCandidate;
  if (!candidate) {
    git(repo, ["update-ref", "refs/remotes/origin/main", anchor]);
    initializeTrust(partialFixture, anchor);
    copyProspectiveTransaction(repo);
    run(process.execPath, [verifierPath, "--write-manifest"], {
      cwd: repo,
      env: environment,
      timeout: 180_000,
    });
    git(repo, ["add", "--all"]);
    git(repo, ["commit", "--quiet", "-m", "test: prospective T01 preregistration"]);
    candidate = git(repo, ["rev-parse", "HEAD"]);
  }

  const fixture = { ...partialFixture, candidate };
  git(repo, ["update-ref", "refs/remotes/origin/main", candidate]);
  initializeTrust(fixture, anchor);
  return fixture;
}

function resetPublication(fixture: Fixture, commit: string): void {
  git(fixture.repo, ["reset", "--quiet", "--hard", commit]);
  git(fixture.repo, ["update-ref", "refs/remotes/origin/main", commit]);
  git(fixture.repo, ["update-ref", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF, fixture.anchor]);
}

function writeT01Evidence(fixture: Fixture): void {
  const manifest = manifestAt(fixture.repo, fixture.candidate);
  const tracer = manifest.tracers.find((candidate: JsonObject) => candidate.id === 1);
  const authoritySet = manifest.authorityHistory.authoritySets.find(
    (candidate: JsonObject) =>
      candidate.authoritySetDigest === manifest.authorityHistory.currentAuthoritySetDigest
  );
  if (!tracer || !authoritySet) throw new Error("prospective schema-6 T01 authority is incomplete");

  const evidenceDirectory = join(fixture.repo, ".scratch/instrument-intelligence/evidence/T01");
  mkdirSync(evidenceDirectory, { recursive: true });
  const requirementId = [...tracer.requirementIds].sort()[0];
  const artifacts: JsonObject[] = [];
  const gates: JsonObject[] = [];
  const gateDefinitions = [
    ...tracer.expectedGateCommands.focused.map((command: string) => ({
      command,
      group: "focused",
    })),
    ...tracer.expectedGateCommands.base.map((command: string) => ({
      command,
      group: "base",
    })),
  ];
  for (const [index, gate] of gateDefinitions.entries()) {
    const suffix = String(index + 1).padStart(2, "0");
    const artifactId = `t01_gate_${suffix}`;
    const commandDigest = sha256(gate.command);
    const artifactPath = `.scratch/instrument-intelligence/evidence/T01/${artifactId}.json`;
    const artifactBytes = Buffer.from(
      `${JSON.stringify({
        artifactId,
        blocked: 0,
        commandDigest,
        failed: 0,
        incomplete: 0,
        passed: 1,
        schemaId: "vellum.test-report.v1",
        skipped: 0,
        status: "pass",
      })}\n`
    );
    writeFileSync(join(fixture.repo, artifactPath), artifactBytes);
    artifacts.push({
      artifactId,
      schemaId: "vellum.test-report.v1",
      mediaType: "application/json",
      publicPath: artifactPath,
      sha256: sha256(artifactBytes),
      classification: "rights_approved_public",
      requirementIds: [requirementId],
      sanitizationId: null,
    });
    gates.push({
      gateId: `t01_gate_${suffix}`,
      group: gate.group,
      command: gate.command,
      commandDigest,
      profile: "host",
      status: "pass",
      counts: { passed: 1, failed: 0, skipped: 0, blocked: 0, incomplete: 0 },
      reportArtifactId: artifactId,
    });
  }

  const observedAt = new Date(Date.now() - 90_000).toISOString();
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  const finishedAt = new Date(Date.now() - 30_000).toISOString();
  const evidence = {
    schemaId: "vellum.instrument-intelligence.evidence.v2",
    startReceipt: {
      schemaId: "vellum.instrument-intelligence.start-receipt.v1",
      start: { tracerId: "T01", generation: 1, startedAt },
      definition: {
        path: tracer.file,
        sha256: tracer.definitionDigest,
        gateMatrixDigest: tracer.gateMatrixDigest,
        completionSemantics: tracer.completionSemantics,
      },
      authoritySnapshot: authoritySet,
      registry: {
        generation: manifest.idPolicy.registryGeneration,
        registryHead: manifest.idPolicy.registryHead,
        tombstoneSetDigest: manifest.idPolicy.tombstoneSetDigest,
        baseWaveHighestId: manifest.idPolicy.baseWaveHighestId,
      },
      predecessors: [],
      predicateWitnesses: [],
      publication: {
        remote: "origin",
        remoteIdentity: "github.com/jefffm/vellum",
        branch: "refs/heads/main",
        repository: {
          nodeId: "R_kgDOSNEx6w",
          databaseId: 1221669355,
          nameWithOwner: "jefffm/vellum",
        },
        remoteProtectionAssumed: false,
        checkpoint: {
          bootstrapAnchor: {
            ref: INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF,
            object: fixture.anchor,
          },
          trustPolicy: {
            ref: INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF,
            object: fixture.policyObject,
          },
          trustedMain: {
            ref: INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF,
            object: fixture.candidate,
          },
        },
        fetchedHead: fixture.candidate,
        graphQlHead: fixture.candidate,
        observedAt,
      },
      execution: {
        baseCommit: fixture.candidate,
        productTreeDigest: projectedProductTreeDigest(fixture.repo, fixture.candidate),
        generationSystem: {
          id: "vellum_t01_canary",
          version: "v1",
          digest: sha256("vellum-t01-canary-v1"),
        },
        subjects: [
          { kind: "system", id: "vellum", version: "v1", digest: sha256("system:vellum") },
          { kind: "package", id: "t01", version: "v1", digest: sha256("package:t01") },
          {
            kind: "component",
            id: "governance_verifier",
            version: "v1",
            digest: sha256("component:governance-verifier"),
          },
        ],
      },
    },
    finishedAt,
    outcome: {
      issueCompletion: "complete",
      productAcceptance: "pass",
      applicability: "applicable",
      comparison: "not_required",
      freshness: "current",
      compatibility: "compatible",
      authorityValidity: "valid",
      supersedes: [],
      invalidates: [],
      resultDisposition: {
        code: "implementation_passed",
        disposition: "unlock",
        dispatchArtifactIds: [],
      },
    },
    gates,
    toolchains: [
      {
        component: "node",
        applicability: "present",
        version: process.version,
        executableDigest: sha256(readFileSync(process.execPath)),
      },
    ],
    artifacts,
    claims: [],
    privacy: { caseCommitments: [], aggregates: [], redactions: [] },
    mediaSanitization: [],
  };
  writeFileSync(join(evidenceDirectory, "verification.json"), `${JSON.stringify(evidence)}\n`);
}

function commitPendingEvidence(fixture: Fixture, mutate?: (repo: string) => void): string {
  git(fixture.repo, ["reset", "--quiet", "--hard", fixture.candidate]);
  git(fixture.repo, ["update-ref", "refs/remotes/origin/main", fixture.candidate]);
  initializeTrust(fixture, fixture.candidate);
  writeT01Evidence(fixture);
  mutate?.(fixture.repo);
  git(fixture.repo, ["add", "--all"]);
  git(fixture.repo, ["commit", "--quiet", "-m", "test: pending T01 evidence"]);
  return git(fixture.repo, ["rev-parse", "HEAD"]);
}

function commitCandidateTree(
  fixture: Fixture,
  mutate: (repo: string) => void,
  message: string
): string {
  git(fixture.repo, ["reset", "--quiet", "--hard", fixture.candidate]);
  mutate(fixture.repo);
  git(fixture.repo, ["add", "--all"]);
  const tree = git(fixture.repo, ["write-tree"]);
  return git(fixture.repo, ["commit-tree", tree, "-p", fixture.anchor], `${message}\n`);
}

function forgeSourcelessAuthorityMigration(fixture: Fixture): void {
  git(fixture.repo, ["reset", "--quiet", "--hard", fixture.candidate]);
  git(fixture.repo, ["update-ref", "refs/remotes/origin/main", fixture.candidate]);
  initializeTrust(fixture, fixture.candidate);
  const manifest = manifestAt(fixture.repo, fixture.candidate);
  const fromAuthoritySet = manifest.authorityHistory.authoritySets.at(-1);
  const pathDigests = fromAuthoritySet.pathDigests.map((entry: JsonObject) =>
    entry.path === ".prettierrc" ? { ...entry, sha256: sha256("forged authority") } : entry
  );
  const toAuthoritySet = {
    ...fromAuthoritySet,
    authoritySetDigest: sha256(JSON.stringify(pathDigests)),
    pathDigests,
  };
  manifest.authorityHistory.authoritySets.push(toAuthoritySet);
  manifest.authorityHistory.migrations.push({
    sequence: 1,
    fromAuthoritySetDigest: fromAuthoritySet.authoritySetDigest,
    toAuthoritySetDigest: toAuthoritySet.authoritySetDigest,
    reasonCode: "governed_verifier_change",
    affectedClauseIds: ["II-CLAUSE-0001"],
    invalidationGeneration: { tracerId: 1, generation: 1 },
  });
  manifest.authorityHistory.currentAuthoritySetDigest = toAuthoritySet.authoritySetDigest;
  writeFileSync(join(fixture.repo, manifestPath), `${JSON.stringify(manifest)}\n`);
}

let fixture: Fixture;

describe.sequential("T01 schema-6 governance pre-registration canary", () => {
  beforeAll(() => {
    fixture = buildFixture();
  }, 180_000);

  afterAll(() => {
    if (fixture?.directory && process.env.VELLUM_KEEP_T01_CANARY !== "1") {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it("is exactly one evidence-empty schema-5 to schema-6 governance transaction", () => {
    const changedPaths = git(fixture.repo, [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      fixture.candidate,
    ])
      .split("\n")
      .filter(Boolean)
      .sort();
    const anchorManifest = manifestAt(fixture.repo, fixture.anchor);
    const candidateManifest = manifestAt(fixture.repo, fixture.candidate);

    expect(git(fixture.repo, ["rev-parse", `${fixture.candidate}^`])).toBe(fixture.anchor);
    expect(changedPaths).toEqual(exactPreregistrationPaths);
    expect(anchorManifest.schemaVersion).toBe(5);
    expect(candidateManifest.schemaVersion).toBe(6);
    expect(candidateManifest.status).toBe("preregistered");
    expect(candidateManifest.executionGenerations).toEqual([]);
    expect(candidateManifest.stateEdges).toEqual([]);
    expect(candidateManifest.requirementEvidence).toEqual({});
    expect(candidateManifest.clauseEvidence).toEqual({});
    expect(candidateManifest.remediationObligations).toEqual({
      schemaId: "vellum.remediation-obligation-ledger.v1",
      obligations: [],
      events: [],
    });
    const authorityCatalog = JSON.parse(
      readFileSync(
        join(fixture.repo, ".scratch/instrument-intelligence/review-authority-catalog.json"),
        "utf8"
      )
    );
    expect(candidateManifest.authorities.verifier.paths).toContain(
      ".scratch/instrument-intelligence/review-authority-catalog.json"
    );
    expect(authorityCatalog).toMatchObject({
      schemaId: "vellum.instrument-intelligence.review-authority-catalog.v1",
      credentials: [],
      revocations: [],
    });
    expect(
      git(fixture.repo, [
        "ls-tree",
        "-r",
        "--name-only",
        fixture.candidate,
        "--",
        ".scratch/instrument-intelligence/evidence",
      ])
        .split("\n")
        .filter(Boolean)
    ).toEqual([".scratch/instrument-intelligence/evidence/.gitkeep"]);
  });

  it(
    "strictly verifies once, advances the checkpoint, and is idempotent at the verified tip",
    { timeout: 180_000 },
    () => {
      const first = runVerifier(fixture);
      expect(first).toContain("strictly verified");
      expect(git(fixture.repo, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])).toBe(
        fixture.candidate
      );

      const anchorBeforeRerun = git(fixture.repo, [
        "rev-parse",
        INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF,
      ]);
      const policyBeforeRerun = git(fixture.repo, [
        "rev-parse",
        INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF,
      ]);
      const second = runVerifier(fixture);
      expect(second).toContain("strictly verified");
      expect(git(fixture.repo, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])).toBe(
        fixture.candidate
      );
      expect(git(fixture.repo, ["rev-parse", INSTRUMENT_INTELLIGENCE_BOOTSTRAP_ANCHOR_REF])).toBe(
        anchorBeforeRerun
      );
      expect(git(fixture.repo, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUST_POLICY_REF])).toBe(
        policyBeforeRerun
      );
    }
  );

  it(
    "prevalidates one clean direct-child evidence generation and records its pushed receipt without advancing trust",
    { timeout: 180_000 },
    () => {
      const implementationCommit = commitPendingEvidence(fixture);
      const pendingOutput = runVerifier(fixture, ["--verify-pending"]);
      expect(pendingOutput).toContain("Pending evidence verified before first push");
      expect(pendingOutput).toContain(`T01:1 is reserved by ${implementationCommit}`);
      expect(git(fixture.repo, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])).toBe(
        fixture.candidate
      );
      expect(git(fixture.repo, ["rev-parse", "refs/remotes/origin/main"])).toBe(fixture.candidate);

      git(fixture.repo, ["update-ref", "refs/remotes/origin/main", implementationCommit]);
      const recordedOutput = runVerifier(fixture, ["--record-published-evidence"]);
      expect(recordedOutput).toContain("Recorded T01:1 in the canonical manifest");
      const recordedManifest = JSON.parse(readFileSync(join(fixture.repo, manifestPath), "utf8"));
      expect(recordedManifest.executionGenerations).toHaveLength(1);
      expect(recordedManifest.executionGenerations[0]).toMatchObject({
        tracerId: 1,
        generation: 1,
        implementationCommit,
        remotePublicationReceipt: {
          schemaId: "vellum.instrument-intelligence.publication-receipt.v1",
          trustedMainAtStart: fixture.candidate,
          commit: implementationCommit,
          fetchedHead: implementationCommit,
          graphQlHead: implementationCommit,
        },
      });
      expect(git(fixture.repo, ["rev-parse", INSTRUMENT_INTELLIGENCE_TRUSTED_MAIN_REF])).toBe(
        fixture.candidate
      );
    }
  );

  it("rejects multiple evidence directories before push", { timeout: 180_000 }, () => {
    commitPendingEvidence(fixture, (repo) => {
      const secondDirectory = join(repo, ".scratch/instrument-intelligence/evidence/T02");
      mkdirSync(secondDirectory, { recursive: true });
      writeFileSync(join(secondDirectory, "orphan.json"), "{}\n");
    });
    expect(() => runVerifier(fixture, ["--verify-pending"])).toThrow(
      /exactly one changed evidence\/TNN directory/
    );
  });

  it("fails closed for an extra transaction path", { timeout: 180_000 }, () => {
    const extraPathCommit = commitCandidateTree(
      fixture,
      (repo) => writeFileSync(join(repo, "t01-unlisted-product-path.txt"), "forbidden\n"),
      "test: inject an unlisted T01 path"
    );
    resetPublication(fixture, extraPathCommit);
    expect(() => runVerifier(fixture)).toThrow(
      /T01 schema-6 pre-registration|governance transaction/
    );
  });

  it("rejects a typed authority migration without an anchored source generation", () => {
    forgeSourcelessAuthorityMigration(fixture);
    expect(() => runVerifier(fixture, ["--draft"])).toThrow(
      /invalidationGeneration is not a valid generation under its from-set/
    );
  });
});
