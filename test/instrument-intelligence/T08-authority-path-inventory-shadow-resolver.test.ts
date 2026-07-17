import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import * as alfabetoPublicApi from "../../src/lib/alfabeto/index.js";
import { alfabetoLookup } from "../../src/lib/alfabeto/index.js";
import {
  buildT14AuthorityPathHandoff,
  bundledAuthorityPathInventory,
  compareAuthorityPathShadow,
  getAuthorityPathInventoryView,
  inspectAuthorityPath,
  observeAuthorityPath,
  validateAuthorityPathInventory,
  verifyAuthorityPathInventoryFiles,
  withAuthorityPath,
} from "../../src/lib/authority-path-inventory.js";
import { assertAuthorityPathRuntime } from "../../src/lib/authority-path-runtime.js";
import { InstrumentModel } from "../../src/lib/instrument-model.js";
import { applyPreservationPolicy } from "../../src/lib/preservation-policy.js";
import { buildSystemPrompt } from "../../src/prompts.js";
import { eventsToLeaves } from "../../src/server/lib/engrave.js";
import {
  ARRANGEMENT_DELIVERABLE_DISPATCH_AUTHORITY_PATH_ID,
  createArrangementCompileRoute,
} from "../../src/server/lib/arrangement-deliverable-route.js";
import { INTERACTIVE_GUIDANCE_POLICY } from "../../src/server/lib/model-action-boundary.js";
import {
  listQuarantinedBuiltInKnowledgePacks,
  loadBuiltInKnowledgePacks,
} from "../../src/server/lib/knowledge-pack-loader.js";
import { loadProfile } from "../../src/server/profiles.js";
import {
  OWNER_PLAYTEST_READINESS_AUTHORITY_PATH_ID,
  readiness,
} from "../../src/server/lib/owner-playtest-route.js";
import type { WorkspaceStore } from "../../src/server/lib/workspace-store.js";
import { getChart, listChartIds } from "../../src/lib/alfabeto/charts/index.js";

const projectRoot = path.resolve(process.cwd());
// Each hostile case makes a complete authority-source copy, runs at least one
// full static inventory scan, and removes the copy. The full suite deliberately
// contends for CPU and filesystem bandwidth, so budget by isolated case count
// rather than using one fixed wall-clock deadline for every compound test.
const AUTHORITY_REPOSITORY_COPY_BUDGET_MS = 20_000;
const authorityRepositoryCopyTimeout = (copyCount: number): number =>
  copyCount * AUTHORITY_REPOSITORY_COPY_BUDGET_MS;

describe("T08 authority-path inventory and compatibility classification", () => {
  it("loads one closed, deeply frozen classification-only snapshot", () => {
    const inventory = bundledAuthorityPathInventory;

    expect(Object.isFrozen(inventory)).toBe(true);
    expect(Object.isFrozen(inventory.entries)).toBe(true);
    expect(Object.isFrozen(inventory.entries[0])).toBe(true);
    expect(inventory.state).toEqual({
      purpose: "inventory_and_shadow_specification_only",
      resolver: "disabled",
      productionActivation: "unchanged",
      completenessClaim: "frozen_repository_snapshot_not_future_manifest",
    });
    expect(inventory.manifestCompleteness).toEqual({
      status: "not_evaluated",
      componentRegistrySnapshot: "not_available",
      appliedKnowledgeManifest: "not_available",
      reasonCodes: ["classification_only", "resolver_disabled", "t14_reconciliation_pending"],
    });
    expect(inventory.writerContractRef).toEqual({
      id: "authority-writer-contract.v1",
      version: 1,
      path: "src/lib/data/authority-writer-contract.v1.json",
      digest: "d697314adee981d9186a21566640a0a38243f33a353d9e0b82d53bb911eea97d",
    });
    const writerContract = JSON.parse(
      readFileSync(path.join(projectRoot, inventory.writerContractRef.path), "utf8")
    ) as { entries: Array<{ locator: { path: string; selector: string } }> };
    expect(
      writerContract.entries
        .filter(({ locator }) => locator.path === "src/server/lib/reviewer-authority-service.ts")
        .map(({ locator }) => locator.selector)
        .sort()
    ).toEqual([
      "ReviewerAuthorityService.publishMaterials",
      "ReviewerAuthorityService.refreshCurrentStatus",
      "ReviewerAuthorityService.verify",
    ]);
    expect(new Set(inventory.entries.map((entry) => entry.id)).size).toBe(inventory.entries.length);
    expect(inventory.coverage.length).toBeGreaterThan(200);
    expect(inventory.shadowFixtures.length).toBeGreaterThanOrEqual(12);
    expect(() => validateAuthorityPathInventory(structuredClone(inventory))).not.toThrow();
  });

  it("covers every required authority surface and keeps the three plucked targets coequal", () => {
    const categories = new Set(
      bundledAuthorityPathInventory.entries.map((entry) => entry.category)
    );
    for (const category of [
      "prompt_instruction",
      "prompt_example",
      "tool_description_default",
      "builtin_lookup_table",
      "compiler_branch",
      "ranker",
      "validator",
      "parameter",
      "profile_constant",
      "presentation_label",
      "cache",
      "legacy_pack",
    ]) {
      expect(categories.has(category), category).toBe(true);
    }

    const mechanical = entry("authority.profile.mechanical-fields");
    const guidance = entry("authority.profile.guidance-fields");
    for (const instrumentId of ["baroque-guitar-5", "baroque-lute-13", "classical-guitar-6"]) {
      expect(
        mechanical.definitionSources.some((source) => source.path.endsWith(`${instrumentId}.yaml`))
      ).toBe(true);
      expect(
        guidance.definitionSources.some((source) => source.path.endsWith(`${instrumentId}.yaml`))
      ).toBe(true);
    }
    expect(mechanical.classification).toBe("mechanical_fact");
    expect(mechanical.mechanicalEvidenceRef).toMatchObject({
      resolverPathId: "authority.validator.instrument-mechanics",
    });
    expect(guidance).toMatchObject({
      mechanicality: "nonmechanical",
      classification: "maintainer_reviewed_software_heuristic",
      authorityLane: "software_heuristic",
    });
    expect(fixture("shadow.plucked-three-target-policy.v1").pathIds).toContain(
      "authority.ranker.plucked-string-arrangement"
    );
  });

  it("closes every T09 migration writer over its exact persisted outputs", () => {
    const referenceGovernance = entry("authority.validator.reference-source-governance");
    expect(referenceGovernance.reads.map(({ selector }) => selector)).toEqual(
      expect.arrayContaining([
        "createApiRouter",
        "OwnerStore.listReferences",
        "ReferenceSourceOperationGateway.execute",
        "createReferenceSourceOperationDefaultDecisionRoute",
      ])
    );
    const writes = new Map(
      referenceGovernance.writes.map((write) => [write.locator.selector, write.outputFields])
    );
    expect(writes.get("OwnerReferenceMigrationService.commit")).toEqual(
      expect.arrayContaining([
        "OwnerReferenceMigrationEvidence.bytes",
        "OwnerReferenceMigrationMapping.record",
        "OwnerReferenceMigrationQuarantine.record",
        "OwnerReferenceMigrationJournal.record",
        "KnowledgePublicationGeneration.record",
        "KnowledgePublicationHead.record",
        "PublicationTransactionBinding.record",
        "ReferenceSourceStagingSnapshot.record",
        "ControlledArtifactCatalog.record",
      ])
    );
    expect(writes.get("OwnerReferenceMigrationService.rollbackInterrupted")).toEqual(
      expect.arrayContaining([
        "OwnerReferenceMigrationIntent.bytes",
        "OwnerReferenceMigrationMapping.record",
        "OwnerReferenceMigrationQuarantine.record",
        "OwnerReferenceMigrationJournal.record",
        "KnowledgePublicationGeneration.record",
        "KnowledgePublicationHead.record",
        "PublicationTransactionBinding.record",
      ])
    );
    expect(writes.get("createOwnerReferenceMigrationInterruptedRollbackRoute")).toEqual(
      writes.get("OwnerReferenceMigrationService.rollbackInterrupted")
    );
    expect(writes.get("OwnerStore.addReference")).toEqual(
      expect.arrayContaining([
        "OwnerReference.record",
        "OwnerReferenceContent.bytes",
        "OwnerReferenceClaimRecoveryReceipt.bytes",
        "OwnerStoreManifest.referenceIds",
      ])
    );
    expect(writes.get("OwnerStore.addReferenceFromSpool")).toEqual(
      expect.arrayContaining([
        "OwnerReference.record",
        "OwnerReferenceContent.bytes",
        "OwnerReferenceClaimRecoveryReceipt.bytes",
        "OwnerStoreManifest.referenceIds",
      ])
    );
    expect(writes.get("ReferenceSourceControlledArtifactStore.withExclusiveTransaction")).toEqual(
      expect.arrayContaining([
        "ControlledArtifactCatalog.record",
        "ReferenceSourceBlob.bytes",
        "ReferenceSourceControlledArtifactBinding.record",
      ])
    );
    expect(writes.get("ReferenceSourceOperationGateway.execute")).toEqual([
      "ReferenceSourceOperationSink.bytes",
    ]);

    const publicationGovernance = entry("authority.validator.knowledge-publication-governance");
    expect(
      publicationGovernance.writes.find(
        (write) =>
          write.locator.selector === "KnowledgePublicationStore.reclaimExactTransactionOrphan"
      )?.outputFields
    ).toEqual([
      "KnowledgePublicationGeneration.record",
      "KnowledgePublicationRecord.record",
      "PublicationTransactionBinding.record",
    ]);

    const ownerDefaults = entry("authority.cache.owner-personal-defaults");
    for (const selector of [
      "OwnerStore.approveDefaultCandidate",
      "OwnerStore.proposeDefaultCandidate",
      "OwnerStore.recordChoice",
      "OwnerStore.rejectDefaultCandidate",
      "OwnerStore.releaseDefault",
      "OwnerStore.reviseDefaultCandidate",
      "acceptReviewedOwnerDefault",
    ]) {
      expect(
        ownerDefaults.writes.find((write) => write.locator.selector === selector)?.outputFields
      ).toContain("OwnerReferenceClaimRecoveryReceipt.bytes");
    }
  });

  it("independently re-hashes the builder, policy, seed, sources, and fixtures", () => {
    const receipt = verifyAuthorityPathInventoryFiles(projectRoot);
    expect(receipt).toMatchObject({
      status: "verified",
      builderDigest: bundledAuthorityPathInventory.builderRef.digest,
      classificationPolicyDigest: bundledAuthorityPathInventory.classificationPolicyRef.digest,
      definitionDigest: bundledAuthorityPathInventory.definitionRef.digest,
      writerContractDigest: bundledAuthorityPathInventory.writerContractRef.digest,
      inventoryRef: { digest: bundledAuthorityPathInventory.digest },
    });
    expect(receipt.coverageFileCount).toBe(bundledAuthorityPathInventory.coverage.length);
    expect(receipt.shadowFixtureCount).toBe(bundledAuthorityPathInventory.shadowFixtures.length);
    expect(() =>
      execFileSync("node", ["scripts/build-authority-path-inventory.mjs"], {
        cwd: projectRoot,
        stdio: "pipe",
      })
    ).not.toThrow();
  });

  it(
    "freezes exact writer attribution independently of the editable inventory seed",
    () => {
      const forgedInventory = structuredClone(bundledAuthorityPathInventory);
      forgedInventory.writerContractRef.digest = "0".repeat(64);
      expect(() => validateAuthorityPathInventory(forgedInventory)).toThrow(
        /writer-contract identity is invalid/i
      );

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = readWriterSeed(seedPath);
        const writes = writerEntry(seed, "authority.cache.owner-personal-defaults");
        writes.push({
          locator: {
            kind: "cache",
            path: "src/server/lib/owner-store.ts",
            selector: "OwnerStore.listDefaults",
          },
          outputFields: ["PersonalDefault.id"],
        });
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer contract attribution set mismatch.*OwnerStore\.listDefaults/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = readWriterSeed(seedPath);
        const writes = writerEntry(seed, "authority.cache.owner-personal-defaults");
        const removed = writes.findIndex(
          (write) => write.locator.selector === "OwnerStore.rejectDefaultCandidate"
        );
        expect(removed).toBeGreaterThanOrEqual(0);
        writes.splice(removed, 1);
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer contract attribution set mismatch.*rejectDefaultCandidate/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = readWriterSeed(seedPath);
        const writes = writerEntry(seed, "authority.cache.owner-personal-defaults");
        const approve = writes.find(
          (write) => write.locator.selector === "OwnerStore.approveDefaultCandidate"
        );
        const reject = writes.find(
          (write) => write.locator.selector === "OwnerStore.rejectDefaultCandidate"
        );
        expect(approve).toBeDefined();
        expect(reject).toBeDefined();
        [approve!.outputFields, reject!.outputFields] = [
          reject!.outputFields,
          approve!.outputFields,
        ];
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer contract output mismatch.*(?:approve|reject)DefaultCandidate/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const contractPath = path.join(root, "src/lib/data/authority-writer-contract.v1.json");
        const seed = readWriterSeed(seedPath);
        const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
          entries: WriterAttribution[];
        };
        const seedWrite = writerEntry(seed, "authority.cache.owner-personal-defaults").find(
          (write) => write.locator.selector === "OwnerStore.recordChoice"
        );
        const contractWrite = contract.entries.find(
          (write) =>
            write.authorityPathId === "authority.cache.owner-personal-defaults" &&
            write.locator.selector === "OwnerStore.recordChoice"
        );
        expect(seedWrite).toBeDefined();
        expect(contractWrite).toBeDefined();
        seedWrite!.outputFields.push("PersonalDefault.id");
        seedWrite!.outputFields.sort();
        contractWrite!.outputFields.push("PersonalDefault.id");
        contractWrite!.outputFields.sort();
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer contract digest mismatch/i
        );
      });
    },
    authorityRepositoryCopyTimeout(4)
  );

  it(
    "rejects uncontracted or output-insensitive persistence paths",
    () => {
      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/guided-workflow-service.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "\n  active(workspaceId: string): GuidedWorkflow | undefined {",
            `
  unregisteredWriter(workspaceId: string, workflow: GuidedWorkflow): GuidedWorkflow {
    return this.store.saveGuidedWorkflow(workspaceId, workflow);
  }

  active(workspaceId: string): GuidedWorkflow | undefined {`
          )
        );
        const authorityPathIds = bundledAuthorityPathInventory.coverage.find(
          (item) => item.sourcePath === sourcePath
        )!.authorityPathIds;
        refreshFrozenSourceReview(root, sourcePath, undefined, undefined, [
          {
            selector: "GuidedWorkflowService.unregisteredWriter",
            disposition: "authority_path",
            authorityPathIds: [...authorityPathIds],
          },
        ]);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /guided-workflow-persistence-closure.*uncontracted writer root/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/evaluation-artifact-store.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "\n  collect(now = this.now()): string[] {",
            `
  unregisteredArtifactDeletion(sha256: string): void {
    rmSync(path.join(this.rootDirectory, "blobs", sha256), { force: true });
  }

  collect(now = this.now()): string[] {`
          )
        );
        const authorityPathIds = bundledAuthorityPathInventory.coverage.find(
          (item) => item.sourcePath === sourcePath
        )!.authorityPathIds;
        refreshFrozenSourceReview(root, sourcePath, undefined, undefined, [
          {
            selector: "EvaluationArtifactStore.unregisteredArtifactDeletion",
            disposition: "authority_path",
            authorityPathIds: [...authorityPathIds],
          },
        ]);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /evaluation-artifact-persistence-closure.*uncontracted writer root/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/human-comparison.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          `${readFileSync(filePath, "utf8")}
export function unregisteredHumanEvaluationWriter(
  evaluationStore: EvaluationStore,
  evaluation: HumanEvaluation
): HumanEvaluation {
  return evaluationStore.saveHumanEvaluation(evaluation);
}
`
        );
        const authorityPathIds = bundledAuthorityPathInventory.coverage.find(
          (item) => item.sourcePath === sourcePath
        )!.authorityPathIds;
        refreshFrozenSourceReview(root, sourcePath, undefined, undefined, [
          {
            selector: "unregisteredHumanEvaluationWriter",
            disposition: "authority_path",
            authorityPathIds: [...authorityPathIds],
          },
        ]);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /human-evaluation-persistence-closure.*uncontracted writer root/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/workspace-store.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "      brief,\n      updatedAt: this.now().toISOString(),",
            "      brief,\n      guidedWorkflowIds: [],\n      updatedAt: this.now().toISOString(),"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /WorkspaceStore\.updateBrief mutates unclaimed authority writer output ArrangementWorkspace\.guidedWorkflowIds/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/evaluation-comparison.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "      return this.options.store.saveReport({",
            "      this.options.store.saveComparison(comparison);\n      return this.options.store.saveReport({"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer (source|implementation) digest mismatch.*evaluation-comparison/i
        );
      });
    },
    authorityRepositoryCopyTimeout(5)
  );

  it(
    "fails static source and declaration coverage",
    () => {
      withAuthorityRepositoryCopy((root) => {
        writeFileSync(
          path.join(root, "src/lib/unclassified-authority.ts"),
          'export const historicalDefault = "invented";\n'
        );
        expect(() => runInventoryBuilder(root)).toThrow(/unclassified production or evaluator/i);
      });

      withAuthorityRepositoryCopy((root) => {
        appendFileSync(
          path.join(root, "src/prompts.ts"),
          '\nexport const inventedHistoricalDefault = "unreviewed";\n'
        );
        expect(() =>
          runInventoryBuilder(root, [
            "--write",
            "--acknowledge-review",
            "--review-source=src/prompts.ts",
          ])
        ).toThrow(/digest-bound source classification review.*src\/prompts\.ts/i);
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/imitative-arranger.ts";
        appendFileSync(
          path.join(root, sourcePath),
          "\nexport function inventedUnregisteredHistoricalRanker(): number { return 1; }\n"
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /unreviewed declaration.*imitative-arranger\.ts::inventedUnregisteredHistoricalRanker/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          sourceReviews: Array<{
            sourcePath: string;
            declarations: Array<{
              selector: string;
              disposition: "authority_path" | "no_authority_effect";
              authorityPathIds: string[];
            }>;
          }>;
        };
        const ownerStoreReview = seed.sourceReviews.find(
          (review) => review.sourcePath === "src/server/lib/owner-store.ts"
        );
        const applyDefaultsReview = ownerStoreReview?.declarations.find(
          (declaration) => declaration.selector === "OwnerStore.applyDefaults"
        );
        expect(applyDefaultsReview).toBeDefined();
        applyDefaultsReview!.disposition = "no_authority_effect";
        applyDefaultsReview!.authorityPathIds = [];
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /unapproved no-authority declaration downgrade: src\/server\/lib\/owner-store\.ts::OwnerStore\.applyDefaults/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/owner-store.ts";
        const filePath = path.join(root, sourcePath);
        const source = readFileSync(filePath, "utf8");
        const mutated = source.replace(
          '          authorityState: "raw_staged",\n          activationAllowed: false,\n          createdAt,',
          '          authorityState: "raw_staged",\n          activationAllowed: true,\n          createdAt,'
        );
        expect(mutated).not.toBe(source);
        writeFileSync(filePath, mutated);
        refreshFrozenSourceReview(root, sourcePath);

        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer (?:source|implementation) digest mismatch.*(?:owner-store\.ts|OwnerStore\.addReference)/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        rmSync(path.join(root, "src/lib/musicological-analysis.ts"));
        expect(() => runInventoryBuilder(root)).toThrow(/names an uncovered source/i);
      });

      withAuthorityRepositoryCopy((root) => {
        symlinkSync(
          path.join(root, "src/prompts.ts"),
          path.join(root, "src/lib/symlinked-authority.ts")
        );
        expect(() => runInventoryBuilder(root)).toThrow(/symbolic links are forbidden/i);
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/imitative-arranger.ts";
        appendFileSync(
          path.join(root, sourcePath),
          "\nclass InventedAuthority { static { globalThis.console.log('authority'); } }\n"
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /class static blocks are forbidden/i
        );
      });
    },
    authorityRepositoryCopyTimeout(8)
  );

  it(
    "rejects denied-mutation, evaluator-import, and lookup bypasses",
    () => {
      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/owner-store.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            'assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "inspection");\n    throw legacyKnowledgeMutationError("proposal");',
            "return {} as never;"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer source digest mismatch: src\/server\/lib\/owner-store\.ts|denied mutation must begin.*unconditional throw/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const evaluatorPath = "test/fixtures/hostile-evaluator.ts";
        writeFileSync(path.join(root, evaluatorPath), "export const evaluatorSecret = 1;\n");
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          entries: Array<{ id: string; sourcePaths: string[] }>;
        };
        const evaluator = seed.entries.find(
          (item) => item.id === "authority.validator.evaluator-only"
        )!;
        evaluator.sourcePaths.push(evaluatorPath);
        evaluator.sourcePaths.sort();
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        refreshFrozenSourceReview(
          root,
          evaluatorPath,
          ["authority.validator.evaluator-only"],
          "authority_path",
          [
            {
              selector: "evaluatorSecret",
              disposition: "authority_path",
              authorityPathIds: ["authority.validator.evaluator-only"],
            },
          ]
        );
        const productionPath = "src/lib/imitative-arranger.ts";
        appendFileSync(
          path.join(root, productionPath),
          '\nimport { evaluatorSecret } from "../../test/fixtures/hostile-evaluator.js";\nvoid evaluatorSecret;\n'
        );
        const productionIds = bundledAuthorityPathInventory.coverage.find(
          (item) => item.sourcePath === productionPath
        )!.authorityPathIds;
        refreshFrozenSourceReview(root, productionPath, undefined, undefined, [
          {
            selector: "<module:1>",
            disposition: "authority_path",
            authorityPathIds: [...productionIds],
          },
        ]);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /production source imports evaluator-only code/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const bypassPath = "src/lib/unclassified-bypass.ts";
        writeFileSync(
          path.join(root, bypassPath),
          'const reader = () => import("./alfabeto/lookup.js").then((api) => api.lookupAlfabetoChart);\n'
        );
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          noAuthorityEffect: Array<{ sourcePath: string; owner: string; reason: string }>;
        };
        seed.noAuthorityEffect.push({
          sourcePath: bypassPath,
          owner: "hostile.fixture",
          reason: "Hostile attempt to launder a direct chart reader as transport.",
        });
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        refreshFrozenSourceReview(root, bypassPath, [], "no_authority_effect", [
          {
            selector: "reader",
            disposition: "no_authority_effect",
            authorityPathIds: [],
          },
        ]);
        expect(() => runInventoryBuilder(root)).toThrow(/raw-alfabeto-chart-api/i);
      });

      withAuthorityRepositoryCopy((root) => {
        const productionPath = "src/lib/imitative-arranger.ts";
        appendFileSync(
          path.join(root, productionPath),
          '\nimport { createRequire as makeLoader } from "node:module";\nvoid makeLoader(import.meta.url)("../server/lib/evaluation-harness.js");\n'
        );
        const productionIds = bundledAuthorityPathInventory.coverage.find(
          (item) => item.sourcePath === productionPath
        )!.authorityPathIds;
        refreshFrozenSourceReview(root, productionPath, undefined, undefined, [
          {
            selector: "<module:1>",
            disposition: "authority_path",
            authorityPathIds: [...productionIds],
          },
        ]);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /CommonJS module loaders are forbidden/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        appendFileSync(
          path.join(root, "src/lib/alfabeto/index.ts"),
          '\nexport { lookupAlfabetoChart } from "./lookup.js";\n'
        );
        refreshFrozenSourceReview(root, "src/lib/alfabeto/index.ts");
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /raw-alfabeto-chart-api|sibling-alfabeto-lookup-module/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        appendFileSync(
          path.join(root, "src/server/lib/engrave.ts"),
          '\nconst bypass = () => import("../../lib/alfabeto/lookup.js");\n'
        );
        const authorityPathIds = bundledAuthorityPathInventory.coverage.find(
          (item) => item.sourcePath === "src/server/lib/engrave.ts"
        )!.authorityPathIds;
        refreshFrozenSourceReview(root, "src/server/lib/engrave.ts", undefined, undefined, [
          {
            selector: "bypass",
            disposition: "authority_path",
            authorityPathIds: [...authorityPathIds],
          },
        ]);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /direct-alfabeto-lookup-module/i
        );
      });
    },
    authorityRepositoryCopyTimeout(6)
  );

  it(
    "rejects displaced guards and hostile parameter defaults",
    () => {
      withAuthorityRepositoryCopy((root) => {
        const promptPath = path.join(root, "src/prompts.ts");
        writeFileSync(
          promptPath,
          readFileSync(promptPath, "utf8").replace(
            'assertAuthorityPathRuntime("authority.prompt.instructions", "production");',
            ""
          )
        );
        refreshFrozenSourceReview(root, "src/prompts.ts");
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /prompt\.instructions.*lacks a direct production guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/imitative-arranger.ts";
        const filePath = path.join(root, sourcePath);
        const source = readFileSync(filePath, "utf8");
        const selectorStart = source.indexOf("export function rankImitativeAssignments");
        const guard =
          '  assertAuthorityPathRuntime("authority.ranker.imitative-intabulation", "production");\n';
        const guardStart = source.indexOf(guard, selectorStart);
        expect(selectorStart).toBeGreaterThanOrEqual(0);
        expect(guardStart).toBeGreaterThan(selectorStart);
        writeFileSync(
          filePath,
          `${source.slice(0, guardStart)}  const guardDecoy = ${JSON.stringify(guard.trim())};\n  if (false) {\n${guard}  }\n${source.slice(guardStart + guard.length)}`
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /rankImitativeAssignments.*lacks a direct production guard.*function_prologue/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/imitative-arranger.ts";
        const filePath = path.join(root, sourcePath);
        const source = readFileSync(filePath, "utf8");
        const selectorStart = source.indexOf("export function rankImitativeAssignments");
        const guard =
          '  assertAuthorityPathRuntime("authority.ranker.imitative-intabulation", "production");\n';
        const guardStart = source.indexOf(guard, selectorStart);
        expect(selectorStart).toBeGreaterThanOrEqual(0);
        expect(guardStart).toBeGreaterThan(selectorStart);
        writeFileSync(
          filePath,
          `${source.slice(0, guardStart)}  const workBeforeGuard = true;\n${guard}${source.slice(guardStart + guard.length)}`
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /rankImitativeAssignments.*lacks a direct production guard.*function_prologue/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/imitative-arranger.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "maximumCompleteAssignments = 128",
            "maximumCompleteAssignments = globalThis.hostileDefaults.value"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /ranker\.imitative-intabulation.*non-pure default parameter before its guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/imitative-arranger.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "score: NormalizedScore,\n  model: InstrumentModel,",
            "{ score = globalThis.hostileDefaults.value }: any,\n  model: InstrumentModel,"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /ranker\.imitative-intabulation.*destructuring parameter before its guard/i
        );
      });
    },
    authorityRepositoryCopyTimeout(5)
  );

  it(
    "rejects constructor and denied-mutation pre-guard effects",
    () => {
      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/instrument-model.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "constructor(profile: InstrumentProfile, instance?: InstrumentInstanceConfiguration)",
            "constructor(private readonly profile: InstrumentProfile, instance?: InstrumentInstanceConfiguration)"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /validator\.instrument-mechanics.*parameter property before its guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/instrument-model.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "private readonly profile: InstrumentProfile;",
            "private readonly profile: InstrumentProfile = globalThis.hostileDefaults.value;"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /validator\.instrument-mechanics.*non-pure field initializer before its guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/instrument-model.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "private currentDiapasonScheme?: string;",
            "private static currentDiapasonScheme = globalThis.hostileDefaults.value;"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /validator\.instrument-mechanics.*non-pure field initializer before its guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/instrument-model.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "export class InstrumentModel {",
            "export class InstrumentModel extends class {} {"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /validator\.instrument-mechanics.*cannot extend a base class before its guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/lib/instrument-model.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "private readonly profile: InstrumentProfile;",
            "private readonly [globalThis.hostileDefaults.key]: InstrumentProfile;"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /computed class member names are forbidden|validator\.instrument-mechanics.*computed member name before its guard/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const sourcePath = "src/server/lib/owner-store.ts";
        const filePath = path.join(root, sourcePath);
        writeFileSync(
          filePath,
          readFileSync(filePath, "utf8").replace(
            "releaseClaim(_id: string): HistoricalPracticeClaim",
            "releaseClaim(_id: string = globalThis.hostileDefaults.value): HistoricalPracticeClaim"
          )
        );
        refreshFrozenSourceReview(root, sourcePath);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority writer source digest mismatch: src\/server\/lib\/owner-store\.ts|cache\.owner-legacy-knowledge.*non-pure default parameter before its guard/i
        );
      });
    },
    authorityRepositoryCopyTimeout(6)
  );

  it(
    "rejects forged writer locators, guard scopes, and output schemas",
    () => {
      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          entries: Array<{
            id: string;
            currentWritePaths: Array<{
              locator: { path: string; selector: string };
              outputFields: string[];
            }>;
            runtimeGuardBindings: Array<{
              locator: { path: string; selector: string };
              guardScope: { mode: string; path: string; selector: string };
            }>;
          }>;
        };
        const ownerDefaults = seed.entries.find(
          (item) => item.id === "authority.cache.owner-personal-defaults"
        );
        const recordChoice = ownerDefaults?.currentWritePaths.find(
          (item) => item.locator.selector === "OwnerStore.recordChoice"
        );
        const recordChoiceGuard = ownerDefaults?.runtimeGuardBindings.find(
          (item) => item.locator.selector === "OwnerStore.recordChoice"
        );
        expect(recordChoice).toBeDefined();
        expect(recordChoiceGuard).toBeDefined();
        recordChoice!.locator.path = "src/server/lib/owner-route.ts";
        recordChoiceGuard!.locator.path = "src/server/lib/owner-route.ts";
        recordChoiceGuard!.guardScope = {
          mode: "function_prologue",
          path: "src/server/lib/owner-route.ts",
          selector: "createOwnerStateRoute",
        };
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /authority locator is not a reviewed runtime declaration: src\/server\/lib\/owner-route\.ts::OwnerStore\.recordChoice/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          entries: Array<{
            id: string;
            runtimeGuardBindings: Array<{
              locator: { selector: string };
              guardScope: { selector: string };
            }>;
          }>;
        };
        const ranker = seed.entries.find(
          (item) => item.id === "authority.ranker.imitative-intabulation"
        );
        const binding = ranker?.runtimeGuardBindings.find(
          (item) => item.locator.selector === "rankImitativeAssignments"
        );
        expect(binding).toBeDefined();
        binding!.guardScope.selector = "arrangeImitativeIntabulation";
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /ranker\.imitative-intabulation.*guard scope must be the exact locator declaration/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          entries: Array<{
            id: string;
            currentWritePaths: Array<{ outputFields: string[] }>;
          }>;
        };
        const ownerDefaults = seed.entries.find(
          (item) => item.id === "authority.cache.owner-personal-defaults"
        );
        expect(ownerDefaults).toBeDefined();
        ownerDefaults!.currentWritePaths[0]!.outputFields.push("Invented.record");
        ownerDefaults!.currentWritePaths[0]!.outputFields.sort();
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /write output is not schema-bound by policy: Invented\.record/i
        );
      });

      withAuthorityRepositoryCopy((root) => {
        const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
        const policyPath = path.join(
          root,
          "src/lib/data/authority-path-classification-policy.v1.json"
        );
        const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
          entries: Array<{
            id: string;
            currentWritePaths: Array<{ outputFields: string[] }>;
          }>;
        };
        const policy = JSON.parse(readFileSync(policyPath, "utf8")) as {
          writeOutputFieldRegistry: string[];
        };
        const ownerDefaults = seed.entries.find(
          (item) => item.id === "authority.cache.owner-personal-defaults"
        );
        expect(ownerDefaults).toBeDefined();
        ownerDefaults!.currentWritePaths[0]!.outputFields.push("Invented.record");
        ownerDefaults!.currentWritePaths[0]!.outputFields.sort();
        policy.writeOutputFieldRegistry.push("Invented.record");
        policy.writeOutputFieldRegistry.sort();
        writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
        writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
        refreshFrozenSourceReview(
          root,
          "src/lib/data/authority-path-classification-policy.v1.json"
        );
        expect(() => runInventoryBuilder(root, ["--write", "--acknowledge-review"])).toThrow(
          /write output registry root has no fixed canonical binding: Invented\.record/i
        );
      });
    },
    authorityRepositoryCopyTimeout(4)
  );

  it("makes legacy mutations denial-only and inventories legacy canonicality output exactly", () => {
    const legacy = entry("authority.cache.owner-legacy-knowledge");
    expect(legacy.writes).toEqual([]);
    expect(legacy.deniedMutations.map((mutation) => mutation.locator.selector)).toEqual([
      "OwnerStore.promoteKnowledge",
      "OwnerStore.proposeKnowledge",
      "OwnerStore.rejectKnowledge",
      "OwnerStore.releaseClaim",
      "OwnerStore.reviseKnowledge",
    ]);
    expect(
      legacy.deniedMutations.every(
        (mutation) =>
          mutation.disposition === "always_rejected" &&
          mutation.reasonCode === "legacy_knowledge_quarantined"
      )
    ).toBe(true);

    const ownerDefaults = entry("authority.cache.owner-personal-defaults");
    expect(ownerDefaults.writes).toContainEqual({
      locator: {
        kind: "symbol",
        path: "src/server/lib/reviewed-owner-default-bridge.ts",
        selector: "acceptReviewedOwnerDefault",
      },
      outputFields: [
        "OwnerReferenceClaimRecoveryReceipt.bytes",
        "OwnerStoreManifest.defaultCandidateIds",
        "PersonalDefaultCandidate.createdAt",
        "PersonalDefaultCandidate.dimension",
        "PersonalDefaultCandidate.evidenceChoiceIds",
        "PersonalDefaultCandidate.id",
        "PersonalDefaultCandidate.scope",
        "PersonalDefaultCandidate.status",
        "PersonalDefaultCandidate.value",
      ],
    });
    for (const selector of [
      "OwnerReferenceSchema",
      "createOwnerReferenceRoute",
      "decodeReferenceHeader",
      "ownerReferenceSummary",
    ]) {
      expect(
        bundledAuthorityPathInventory.declarationCoverage.find((item) => item.selector === selector)
      ).toMatchObject({ disposition: "no_authority_effect", authorityPathIds: [] });
    }
    for (const selector of [
      "OwnerStore.addReference",
      "OwnerStore.addReferenceFromSpool",
      "OwnerStore.listReferences",
    ]) {
      expect(
        bundledAuthorityPathInventory.declarationCoverage.find((item) => item.selector === selector)
      ).toMatchObject({
        disposition: "authority_path",
        authorityPathIds: expect.arrayContaining([
          "authority.validator.reference-source-governance",
        ]),
      });
    }

    const canonicality = entry("authority.validator.legacy-arrangement-canonicality");
    expect(canonicality.reads).toEqual([
      {
        kind: "symbol",
        path: "src/server/lib/arrangement-route.ts",
        selector: "createArrangement",
      },
      {
        kind: "symbol",
        path: "src/server/lib/arrangement-route.ts",
        selector: "legacyCanonicality",
      },
    ]);
    expect(canonicality.writes).toEqual([
      {
        locator: {
          kind: "symbol",
          path: "src/server/lib/arrangement-route.ts",
          selector: "createArrangement",
        },
        outputFields: [
          "Arrangement.canonicality.canonicalWorkspaceImportRequired",
          "Arrangement.canonicality.rationale",
          "Arrangement.canonicality.status",
        ],
      },
    ]);
  });

  it("rejects impossible classifications instead of laundering them through metadata", () => {
    const withoutMechanicalEvidence = cloneInventory();
    mutableEntry(
      withoutMechanicalEvidence,
      "authority.profile.mechanical-fields"
    ).mechanicalEvidenceRef = null;
    expect(() => validateAuthorityPathInventory(withoutMechanicalEvidence)).toThrow(
      /mechanical.*evidence/i
    );

    const nonMechanicalResolver = cloneInventory();
    (
      mutableEntry(nonMechanicalResolver, "authority.profile.mechanical-fields")
        .mechanicalEvidenceRef as {
        resolverPathId: string;
        resolverSelectors: string[];
      }
    ).resolverPathId = "authority.profile.guidance-fields";
    expect(() => validateAuthorityPathInventory(nonMechanicalResolver)).toThrow(
      /mechanical validator/i
    );

    const incompleteResolverSelectors = cloneInventory();
    (
      mutableEntry(incompleteResolverSelectors, "authority.profile.mechanical-fields")
        .mechanicalEvidenceRef as {
        resolverPathId: string;
        resolverSelectors: string[];
      }
    ).resolverSelectors = ["InstrumentModel"];
    expect(() => validateAuthorityPathInventory(incompleteResolverSelectors)).toThrow(
      /selectors.*resolver reads/i
    );

    const unboundMechanicalDomain = cloneInventory();
    mutableEntry(unboundMechanicalDomain, "authority.profile.mechanical-fields").subjectDomains = [
      "subjective_guidance",
    ];
    expect(() => validateAuthorityPathInventory(unboundMechanicalDomain)).toThrow(
      /mechanics|subject domain/i
    );

    const evaluatorInProduction = cloneInventory();
    mutableEntry(evaluatorInProduction, "authority.validator.evaluator-only").runtimeAccess.push(
      "production"
    );
    expect(() => validateAuthorityPathInventory(evaluatorInProduction)).toThrow(
      /evaluator|production/i
    );

    const bypassNotQuarantined = cloneInventory();
    mutableEntry(
      bypassNotQuarantined,
      "authority.legacy.built-in-knowledge-pack"
    ).quarantine.state = "not_quarantined";
    expect(() => validateAuthorityPathInventory(bypassNotQuarantined)).toThrow(
      /forbidden|quarantin/i
    );

    const selfResolved = cloneInventory();
    // `resolved` is deliberately outside the closed T08 future-binding vocabulary.
    (
      mutableEntry(selfResolved, "authority.ranker.plucked-string-arrangement").futureBinding as {
        status: string;
      }
    ).status = "resolved";
    expect(() => validateAuthorityPathInventory(selfResolved)).toThrow();
  });

  it("fails unknown, forbidden, quarantined, and evaluator-only production access before effects", () => {
    const effect = vi.fn(() => "should-not-run");
    expect(() => withAuthorityPath("authority.unknown", "production", effect)).toThrow(/unknown/i);
    expect(() =>
      withAuthorityPath("authority.legacy.built-in-knowledge-pack", "production", effect)
    ).toThrow(/quarantin|production/i);
    expect(() =>
      withAuthorityPath("authority.validator.evaluator-only", "production", effect)
    ).toThrow(/evaluation|production/i);
    expect(effect).not.toHaveBeenCalled();
    expect(() =>
      assertAuthorityPathRuntime("authority.unregistered.production-path", "production")
    ).toThrow(/unknown authority path/i);
    expect(() =>
      assertAuthorityPathRuntime("authority.legacy.built-in-knowledge-pack", "production")
    ).toThrow(/cannot execute|production/i);
    expect(() =>
      assertAuthorityPathRuntime("authority.prompt.instructions", "production")
    ).not.toThrow();

    let observed: ReturnType<typeof observeAuthorityPath> | undefined;
    const mechanical = withAuthorityPath(
      "authority.validator.instrument-mechanics",
      "production",
      (observation) => {
        observed = observation;
        return "observed";
      }
    );
    expect(mechanical).toBe("observed");
    expect(observed).toMatchObject({
      pathId: "authority.validator.instrument-mechanics",
      authorityGranted: false,
      resolver: "disabled",
      productionActivation: "unchanged",
    });
    expect(observeAuthorityPath("authority.validator.instrument-mechanics", "production")).toEqual(
      observed
    );
    expect(inspectAuthorityPath("authority.legacy.built-in-knowledge-pack")).toMatchObject({
      authorityGranted: false,
      access: "inspection",
    });
  });

  it("rejects a stale bundled runtime inventory before guarded code can load", () => {
    withAuthorityRepositoryCopy((root) => {
      const inventoryPath = path.join(root, "src/lib/data/authority-path-inventory.v1.json");
      const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
        entries: Array<{ runtimeAccess: string[] }>;
      };
      inventory.entries[0]!.runtimeAccess.push("production");
      writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
      const bundlePath = path.join(root, "runtime-check.mjs");
      execFileSync(
        path.join(projectRoot, "node_modules/.bin/esbuild"),
        [
          "src/lib/authority-path-runtime.ts",
          "--bundle",
          "--platform=node",
          "--format=esm",
          `--outfile=${bundlePath}`,
        ],
        { cwd: root, stdio: "pipe" }
      );
      expect(() => execFileSync("node", [bundlePath], { cwd: root, stdio: "pipe" })).toThrow(
        /runtime (?:entry|inventory) digest is stale or invalid/i
      );
    });
  });

  it("observes the real compiler-dispatch and readiness production paths and fails before effects", async () => {
    const observations: ReturnType<typeof observeAuthorityPath>[] = [];
    const observingGuard: typeof withAuthorityPath = (id, context, callback) =>
      withAuthorityPath(id, context, (observation) => {
        observations.push(observation);
        return callback(observation);
      });

    const afterGuard = new Error("compiler store reached after authority observation");
    const compilerStore = {
      getArrangementScore: vi.fn(() => {
        throw afterGuard;
      }),
    } as unknown as WorkspaceStore;
    const compilerNext = vi.fn();
    const compilerRoute = createArrangementCompileRoute(
      compilerStore,
      { run: vi.fn() },
      observingGuard
    );
    await compilerRoute(
      {
        params: {
          workspaceId: "workspace.1234567890abcdef",
          arrangementId: "arrangement.1234567890abcdef",
        },
      } as never,
      {} as never,
      compilerNext
    );
    expect(compilerNext).toHaveBeenCalledWith(afterGuard);

    const score = {
      id: "arrangement.1234567890abcdef",
      version: 1,
      parentArrangementScoreId: undefined,
    };
    const readinessStore = {
      getArrangementScore: vi.fn(() => score),
      listOwnerPlaytests: vi.fn(() => []),
      get: vi.fn(() => ({ staleDerivationIds: [] })),
      getStaleDerivation: vi.fn(),
    } as unknown as WorkspaceStore;
    expect(
      readiness(readinessStore, "workspace.1234567890abcdef", score.id, observingGuard)
    ).toMatchObject({ status: "inspection_only" });
    expect(observations).toEqual([
      expect.objectContaining({
        pathId: ARRANGEMENT_DELIVERABLE_DISPATCH_AUTHORITY_PATH_ID,
        context: "production",
        authorityGranted: false,
      }),
      expect.objectContaining({
        pathId: OWNER_PLAYTEST_READINESS_AUTHORITY_PATH_ID,
        context: "production",
        authorityGranted: false,
      }),
    ]);

    const failingGuard: typeof withAuthorityPath = (_id, context, callback) =>
      withAuthorityPath("authority.unregistered.production-path", context, callback);
    const untouchedCompilerStore = {
      getArrangementScore: vi.fn(),
    } as unknown as WorkspaceStore;
    const failingNext = vi.fn();
    await createArrangementCompileRoute(untouchedCompilerStore, { run: vi.fn() }, failingGuard)(
      {
        params: {
          workspaceId: "workspace.1234567890abcdef",
          arrangementId: "arrangement.1234567890abcdef",
        },
      } as never,
      {} as never,
      failingNext
    );
    expect(failingNext).toHaveBeenCalledWith(
      expect.objectContaining({ code: "unknown_authority_path" })
    );
    expect(untouchedCompilerStore.getArrangementScore).not.toHaveBeenCalled();

    const untouchedReadinessStore = {
      getArrangementScore: vi.fn(),
    } as unknown as WorkspaceStore;
    expect(() =>
      readiness(
        untouchedReadinessStore,
        "workspace.1234567890abcdef",
        "arrangement.1234567890abcdef",
        failingGuard
      )
    ).toThrow(/unknown authority path/i);
    expect(untouchedReadinessStore.getArrangementScore).not.toHaveBeenCalled();
  });

  it("preserves exact, different, unknown, and error shadow states without activation", () => {
    const expected = fixtureBody("preservation-policy.v1.json").expectedLegacyOutput;
    const exact = compareAuthorityPathShadow({
      fixtureId: "shadow.preservation-policy.v1",
      legacyOutput: expected,
      candidateOutput: expected,
    });
    const different = compareAuthorityPathShadow({
      fixtureId: "shadow.preservation-policy.v1",
      legacyOutput: expected,
      candidateOutput: { status: "fail" },
    });
    const unknown = compareAuthorityPathShadow({
      fixtureId: "shadow.preservation-policy.v1",
      legacyOutput: expected,
    });
    const error = compareAuthorityPathShadow({
      fixtureId: "shadow.preservation-policy.v1",
      legacyOutput: expected,
      candidateError: "candidate unavailable",
    });

    expect([exact.result, different.result, unknown.result, error.result]).toEqual([
      "exact_match",
      "different",
      "unknown",
      "error",
    ]);
    for (const receipt of [exact, different, unknown, error]) {
      expect(receipt).toMatchObject({
        candidateDisposition: "shadow_only",
        productionEffect: "none",
        productionActivation: "unchanged",
      });
    }
    expect(() =>
      compareAuthorityPathShadow({
        fixtureId: "shadow.preservation-policy.v1",
        legacyOutput: { tampered: true },
        candidateOutput: expected,
      })
    ).toThrow(/legacy|digest/i);
  });

  it("binds representative compatibility projections to exact legacy behavior", () => {
    const promptExpected = fixtureBody("prompt-empty-instrument-set.v1.json")
      .expectedLegacyOutput as { canonicalByteLength: number; canonicalSha256: string };
    expect(canonicalProjection(buildSystemPrompt([]))).toEqual(promptExpected);

    const profileExpected = fixtureBody("classical-profile.v1.json").expectedLegacyOutput as {
      canonicalByteLength: number;
      canonicalSha256: string;
    };
    expect(canonicalProjection(loadProfile("classical-guitar-6"))).toEqual(profileExpected);

    const preservation = fixtureBody("preservation-policy.v1.json");
    expect(
      applyPreservationPolicy(
        preservation.input.audit as Parameters<typeof applyPreservationPolicy>[0],
        preservation.input.policy as Parameters<typeof applyPreservationPolicy>[1]
      )
    ).toEqual(preservation.expectedLegacyOutput);

    expect(INTERACTIVE_GUIDANCE_POLICY).toMatchObject(
      fixtureBody("model-action-guidance.v1.json").expectedLegacyOutput
    );

    const engraving = fixtureBody("engraving-projection.v1.json");
    const params = engraving.input as Parameters<typeof eventsToLeaves>[1];
    const leaves = eventsToLeaves(
      params.bars,
      params,
      InstrumentModel.fromProfile(loadProfile("classical-guitar-6"))
    );
    expect({
      leafTypes: leaves.map((leaf) => leaf.type),
      lilyPondPitches: leaves.map((leaf) => (leaf.type === "note" ? leaf.pitch : null)),
    }).toEqual(engraving.expectedLegacyOutput);
  });

  it("keeps every legacy chart, pack, cache, and fallback denied", () => {
    expect(loadBuiltInKnowledgePacks()).toEqual([]);
    expect(listQuarantinedBuiltInKnowledgePacks()).not.toEqual([]);
    expect(listChartIds()).toEqual([]);
    expect(() => getChart("tyler-universal")).toThrow(/review_required|quarantined/i);
    expect(alfabetoLookup({ chordName: "G major" })).toMatchObject({
      status: "review_required",
      matches: [],
    });
    expect("lookupAlfabetoChart" in alfabetoPublicApi).toBe(false);
    expect("barreTranspose" in alfabetoPublicApi).toBe(false);
    expect(alfabetoLookup({ chordName: "G major" })).toMatchObject({
      status: "review_required",
      matches: [],
    });
  });

  it("produces a deterministic classification-only T14 reconciliation handoff", () => {
    expect(buildT14AuthorityPathHandoff()).toEqual(buildT14AuthorityPathHandoff());
    const handoff = buildT14AuthorityPathHandoff();
    expect(handoff).toMatchObject({
      inventoryRef: { digest: bundledAuthorityPathInventory.digest },
      manifestCompleteness: {
        status: "not_evaluated",
        componentRegistrySnapshot: "not_available",
        appliedKnowledgeManifest: "not_available",
      },
      productionActivation: "unchanged",
    });
    expect(handoff.entries).toHaveLength(bundledAuthorityPathInventory.entries.length);
    expect(new Set(handoff.entries.map((item) => item.inventoryPathId)).size).toBe(
      handoff.entries.length
    );
    expect(handoff.entries.every((item) => item.disposition === "unknown")).toBe(true);
    expect(
      handoff.entries.every(
        (item) =>
          item.componentRef === null &&
          item.manifestOutcomeRef === null &&
          item.reasonCodes.includes("component_registry_not_available")
      )
    ).toBe(true);
  });

  it("serves a read-only view that cannot claim resolution or activation", () => {
    expect(getAuthorityPathInventoryView()).toMatchObject({
      inventoryId: "authority-path-inventory.v1",
      digest: bundledAuthorityPathInventory.digest,
      state: { resolver: "disabled", productionActivation: "unchanged" },
      manifestCompleteness: { status: "not_evaluated" },
    });
  });
});

interface WriterPath {
  locator: { kind: string; path: string; selector: string };
  outputFields: string[];
}

interface WriterAttribution extends WriterPath {
  authorityPathId: string;
}

interface WriterSeed {
  entries: Array<{ id: string; currentWritePaths: WriterPath[] }>;
}

function readWriterSeed(seedPath: string): WriterSeed {
  return JSON.parse(readFileSync(seedPath, "utf8")) as WriterSeed;
}

function writerEntry(seed: WriterSeed, authorityPathId: string): WriterPath[] {
  const entry = seed.entries.find((candidate) => candidate.id === authorityPathId);
  if (!entry) throw new Error(`Missing authority writer ${authorityPathId}`);
  return entry.currentWritePaths;
}

function entry(id: string) {
  const result = bundledAuthorityPathInventory.entries.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing authority path ${id}`);
  return result;
}

function fixture(id: string) {
  const result = bundledAuthorityPathInventory.shadowFixtures.find(
    (candidate) => candidate.id === id
  );
  if (!result) throw new Error(`Missing shadow fixture ${id}`);
  return result;
}

function fixtureBody(fileName: string): {
  input: Record<string, unknown>;
  expectedLegacyOutput: Record<string, unknown>;
} {
  return JSON.parse(
    readFileSync(
      path.join(projectRoot, "test/instrument-intelligence/fixtures/t08", fileName),
      "utf8"
    )
  );
}

function canonicalProjection(value: unknown): {
  canonicalByteLength: number;
  canonicalSha256: string;
} {
  const canonical = canonicalJson(value);
  return {
    canonicalByteLength: Buffer.byteLength(canonical),
    canonicalSha256: createHash("sha256").update(canonical).digest("hex"),
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function withAuthorityRepositoryCopy(callback: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t08-static-"));
  try {
    for (const directory of ["src", "instruments", "templates", "knowledge-packs"]) {
      cpSync(path.join(projectRoot, directory), path.join(root, directory), { recursive: true });
    }
    mkdirSync(path.join(root, "scripts"), { recursive: true });
    cpSync(
      path.join(projectRoot, "scripts/build-authority-path-inventory.mjs"),
      path.join(root, "scripts/build-authority-path-inventory.mjs")
    );
    cpSync(path.join(projectRoot, "test/fixtures"), path.join(root, "test/fixtures"), {
      recursive: true,
    });
    mkdirSync(path.join(root, "test/instrument-intelligence/fixtures"), { recursive: true });
    cpSync(
      path.join(projectRoot, "test/instrument-intelligence/fixtures/t08"),
      path.join(root, "test/instrument-intelligence/fixtures/t08"),
      { recursive: true }
    );
    symlinkSync(path.join(projectRoot, "node_modules"), path.join(root, "node_modules"), "dir");
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runInventoryBuilder(root: string, args: string[] = []): void {
  execFileSync("node", ["scripts/build-authority-path-inventory.mjs", ...args], {
    cwd: root,
    stdio: "pipe",
  });
}

function refreshFrozenSourceReview(
  root: string,
  sourcePath: string,
  authorityPathIds?: string[],
  disposition?: "authority_path" | "no_authority_effect",
  declarations?: Array<{
    selector: string;
    disposition: "authority_path" | "no_authority_effect";
    authorityPathIds: string[];
  }>
): void {
  const seedPath = path.join(root, "src/lib/data/authority-path-inventory-seed.v1.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
    sourceReviews: Array<{
      sourcePath: string;
      sourceDigest: string;
      disposition: "authority_path" | "no_authority_effect";
      authorityPathIds: string[];
      declarations: Array<{
        selector: string;
        disposition: "authority_path" | "no_authority_effect";
        authorityPathIds: string[];
      }>;
    }>;
  };
  const existing = seed.sourceReviews.find((review) => review.sourcePath === sourcePath);
  const review = {
    sourcePath,
    sourceDigest: createHash("sha256")
      .update(readFileSync(path.join(root, sourcePath)))
      .digest("hex"),
    disposition: disposition ?? existing?.disposition ?? ("authority_path" as const),
    authorityPathIds: [...(authorityPathIds ?? existing?.authorityPathIds ?? [])].sort(),
    declarations: [...(existing?.declarations ?? []), ...(declarations ?? [])].sort(
      (left, right) =>
        left.selector < right.selector ? -1 : left.selector > right.selector ? 1 : 0
    ),
  };
  if (existing) Object.assign(existing, review);
  else seed.sourceReviews.push(review);
  seed.sourceReviews.sort((left, right) =>
    left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0
  );
  writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
}

type MutableInventory = ReturnType<typeof cloneInventory>;

function cloneInventory() {
  return structuredClone(bundledAuthorityPathInventory) as unknown as {
    entries: Array<{
      id: string;
      mechanicalEvidenceRef: unknown;
      subjectDomains: string[];
      runtimeAccess: string[];
      quarantine: { state: string };
      futureBinding: { status: string };
    }>;
    [key: string]: unknown;
  };
}

function mutableEntry(inventory: MutableInventory, id: string) {
  const result = inventory.entries.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing mutable authority path ${id}`);
  return result;
}
