#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const builderPath = path.join(projectRoot, "scripts/build-authority-path-inventory.mjs");
const seedPath = path.join(projectRoot, "src/lib/data/authority-path-inventory-seed.v1.json");
const policyPath = path.join(
  projectRoot,
  "src/lib/data/authority-path-classification-policy.v1.json"
);
const writerContractPath = path.join(projectRoot, "src/lib/data/authority-writer-contract.v1.json");
const outputPath = path.join(projectRoot, "src/lib/data/authority-path-inventory.v1.json");
const writerContractRelativePath = path
  .relative(projectRoot, writerContractPath)
  .split(path.sep)
  .join("/");
const expectedWriterContractDigest =
  "d77b0c7f6fd92b062700a0310a939bf9b1e38b841e241768f6ec5094ce65d24d";
const locatorKinds = new Set(["cache", "file_region", "json_pointer", "symbol", "yaml_pointer"]);
const guardModes = new Set([
  "constructor_prologue",
  "function_prologue",
  "module_constant_prologue",
  "root_guard",
]);
const canonicalWriteOutputRootBindings = new Map([
  ...schemaBindings("src/lib/music-domain.ts", [
    "AnalysisRecord",
    "ArrangementBranch",
    "ArrangementCandidate",
    "ArrangementFamily",
    "ArrangementPlan",
    "ArrangementScore",
    "ArrangementSearch",
    "ArrangementWorkspace",
    "CommitmentConflict",
    "Deliverable",
    "EditorialCommitment",
    "FamilyCommitment",
    "GuidedWorkflow",
    "ModelAction",
    "ModelActionPublication",
    "NormalizedScore",
    "OmrRun",
    "OwnerPlaytest",
    "PerformanceBrief",
    "PerformanceInterpretation",
    "PlanConflict",
    "PolicyException",
    "ScoreTranscription",
    "SourceArtifact",
    "SourceTruthAssessment",
    "StaleDerivation",
  ]),
  ...schemaBindings("src/lib/evaluation-domain.ts", [
    "EvaluationBaseline",
    "EvaluationCard",
    "EvaluationCaseRun",
    "EvaluationComparison",
    "EvaluationPromotionReview",
    "EvaluationReport",
    "EvaluationRun",
    "EvaluatorDatasetManifest",
    "EvaluatorRevision",
    "ExternalEvaluationEvidence",
    "HumanComparisonConclusion",
    "HumanEvaluation",
    "ModelJudgeAction",
    "ResolvedEvaluationManifest",
    "ReviewedLearningDecision",
    "ReviewedLearningOutputCandidate",
    "ReviewedLearningProposal",
  ]),
  ...schemaBindings("src/server/lib/evaluation-artifact-store.ts", [
    "EvaluationArtifact",
    "EvaluationArtifactManifest",
  ]),
  ...schemaBindings("src/lib/owner-domain.ts", [
    "OwnerChoice",
    "OwnerReference",
    "PersonalDefault",
    "PersonalDefaultCandidate",
  ]),
  ...schemaBindings("src/lib/owner-reference-migration.ts", [
    "OwnerReferenceMigrationJournal",
    "OwnerReferenceMigrationMapping",
    "OwnerReferenceMigrationQuarantine",
  ]),
  ...schemaBindings("src/lib/reference-source-domain.ts", [
    "ReferenceAssetAcquisition",
    "ReferenceDigitalAsset",
    "ReferenceSourceStagingSnapshot",
  ]),
  ...schemaBindings("src/server/lib/knowledge-publication-store.ts", [
    "KnowledgePublicationGeneration",
    "KnowledgePublicationHead",
    "KnowledgePublicationRecord",
    "PublicationTransactionBinding",
  ]),
  [
    "Arrangement",
    {
      kind: "typebox_object",
      path: "src/types.ts",
      selector: "ArrangementSchema",
    },
  ],
  [
    "ControlledArtifactCatalog",
    {
      kind: "typebox_object",
      path: "src/server/lib/reference-source-controlled-artifact-store.ts",
      selector: "ControlledArtifactCatalogSchema",
    },
  ],
  [
    "OwnerStoreManifest",
    {
      kind: "type_literal",
      path: "src/server/lib/owner-store.ts",
      selector: "OwnerStoreManifest",
    },
  ],
  [
    "PassageSearch",
    {
      kind: "typebox_object",
      path: "src/lib/music-domain.ts",
      selector: "PassageSearchRecordSchema",
    },
  ],
  [
    "ReferenceSourceControlledArtifactBinding",
    {
      kind: "typebox_object",
      path: "src/lib/reference-source-inventory.ts",
      selector: "ReferenceSourceControlledArtifactBindingSchema",
    },
  ],
  [
    "ReferenceSourceStagingHead",
    {
      kind: "type_literal",
      path: "src/server/lib/reference-source-staging-store.ts",
      selector: "ReferenceSourceStagingHead",
    },
  ],
]);
const canonicalBinaryOutputBindings = new Map([
  [
    "EvaluationArtifactBlob.bytes",
    {
      path: "src/server/lib/evaluation-artifact-store.ts",
      selector: "EvaluationArtifactStore.put",
    },
  ],
  [
    "DeliverableArtifact.bytes",
    {
      path: "src/server/lib/workspace-store.ts",
      selector: "WorkspaceStore.saveDeliverable",
    },
  ],
  [
    "OmrArtifact.bytes",
    {
      path: "src/server/lib/workspace-store.ts",
      selector: "WorkspaceStore.writeOmrArtifact",
    },
  ],
  [
    "OwnerReferenceContent.bytes",
    {
      path: "src/server/lib/owner-store.ts",
      selector: "OwnerStore.addReference",
    },
  ],
  [
    "OwnerReferenceClaimRecoveryReceipt.bytes",
    {
      path: "src/server/lib/owner-reference-claim.ts",
      selector: "OwnerReferenceWriteClaim.writeRecoveryReceipt",
    },
  ],
  [
    "OwnerReferenceMigrationEvidence.bytes",
    {
      path: "src/server/lib/owner-reference-migration-service.ts",
      selector: "OwnerReferenceMigrationService.stageEvidenceBytes",
    },
  ],
  [
    "OwnerReferenceMigrationIntent.bytes",
    {
      path: "src/server/lib/owner-reference-migration-service.ts",
      selector: "writeImmutableIntent",
    },
  ],
  [
    "OwnerReferenceMigrationRecoveryReceipt.bytes",
    {
      path: "src/server/lib/owner-reference-migration-service.ts",
      selector: "OwnerReferenceMigrationService.recoverStaleMigrationClaim",
    },
  ],
  [
    "ReferenceSourceBlob.bytes",
    {
      path: "src/server/lib/reference-source-controlled-artifact-store.ts",
      selector: "ReferenceSourceControlledArtifactStore.putDigitalAsset",
    },
  ],
  [
    "SourceArtifactContent.bytes",
    {
      path: "src/server/lib/workspace-store.ts",
      selector: "WorkspaceStore.addSourceArtifactFromSpool",
    },
  ],
]);

function schemaBindings(sourcePath, roots) {
  return roots.map((root) => [
    root,
    { kind: "typebox_object", path: sourcePath, selector: `${root}Schema` },
  ]);
}

const seed = readJson(seedPath, "authority-path seed");
const policy = readJson(policyPath, "authority-path classification policy");
const writerContract = readJson(writerContractPath, "authority writer contract");
const actualClassificationPolicyDigest = sha256(readFileSync(policyPath));
const actualWriterContractDigest = sha256(readFileSync(writerContractPath));
if (actualWriterContractDigest !== expectedWriterContractDigest) {
  fail(
    `authority writer contract digest mismatch: expected ${expectedWriterContractDigest}, observed ${actualWriterContractDigest}`
  );
}
validatePolicy(policy);
validateSeed(seed, policy);

const ignoredPaths = new Set(policy.ignoredPaths);
const allowedExtensions = new Set(policy.allowedExtensions);
const rootScopes = new Map([
  ...policy.inventoryRoots.map((root) => [root, "production"]),
  ...policy.evaluatorRoots.map((root) => [root, "evaluation"]),
]);
const sourcePaths = [...rootScopes.keys()]
  .flatMap((root) => walk(path.join(projectRoot, root)))
  .sort();
validateWriteOutputFieldRegistry(policy.writeOutputFieldRegistry, sourcePaths);
const sourcePathSet = new Set(sourcePaths);
const entrySources = new Map();
const reviewedExclusions = new Map();

for (const entry of seed.entries) {
  for (const sourcePath of entry.sourcePaths) {
    if (!sourcePathSet.has(sourcePath)) {
      fail(`authority entry ${entry.id} names an uncovered source: ${sourcePath}`);
    }
    const ids = entrySources.get(sourcePath) ?? [];
    ids.push(entry.id);
    entrySources.set(sourcePath, ids);
  }
}

for (const exclusion of seed.noAuthorityEffect) {
  if (reviewedExclusions.has(exclusion.sourcePath)) {
    fail(`duplicate no-authority-effect review: ${exclusion.sourcePath}`);
  }
  if (!sourcePathSet.has(exclusion.sourcePath)) {
    fail(`orphan no-authority-effect review: ${exclusion.sourcePath}`);
  }
  if (entrySources.has(exclusion.sourcePath)) {
    fail(`source is both authority-bearing and excluded: ${exclusion.sourcePath}`);
  }
  reviewedExclusions.set(exclusion.sourcePath, exclusion);
}

for (const sourcePath of sourcePaths) {
  if (!entrySources.has(sourcePath) && !reviewedExclusions.has(sourcePath)) {
    fail(`unclassified production or evaluator source: ${sourcePath}`);
  }
}
validateFrozenSourceReviews(seed.sourceReviews, policy.noAuthorityDeclarationExceptions);
validateWriterContract(writerContract, seed, actualClassificationPolicyDigest);
validateWriterSinkClosure(policy.writerSinkRules, writerContract);
validateWriterOutputClosure(policy.writeOutputFieldRegistry, writerContract);
validateWriterImplementationBindings(writerContract);

const entries = [...seed.entries]
  .sort((left, right) => left.id.localeCompare(right.id))
  .map((entry) => normalizeEntry(entry));
const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
validateRuntimeGuardBindings(entries);
const coverage = sourcePaths.map((sourcePath) => {
  const authorityPathIds = [...(entrySources.get(sourcePath) ?? [])].sort();
  const exclusion = reviewedExclusions.get(sourcePath);
  return {
    sourcePath,
    sourceDigest: sha256(readFileSync(path.join(projectRoot, sourcePath))),
    surfaceScope: scopeFor(sourcePath, authorityPathIds, entriesById),
    disposition: authorityPathIds.length > 0 ? "authority_path" : "no_authority_effect",
    authorityPathIds,
    reviewRationale:
      authorityPathIds.length > 0
        ? "Field or symbol-level authority paths are classified by the referenced immutable entries."
        : exclusion.reason,
    reviewOwner: authorityPathIds.length > 0 ? "maintainers.vellum" : exclusion.owner,
  };
});
const declarationCoverage = seed.sourceReviews.flatMap((review) =>
  review.declarations.map((declaration) => ({
    sourcePath: review.sourcePath,
    selector: declaration.selector,
    disposition: declaration.disposition,
    authorityPathIds: [...declaration.authorityPathIds],
  }))
);

validateImportClosure(coverage);
validateBypassRules(policy, coverage, entriesById);

const shadowFixtures = [...seed.shadowFixtures]
  .sort((left, right) => left.id.localeCompare(right.id))
  .map((definition) => {
    const fixturePath = path.join(projectRoot, definition.fixtureRef);
    if (!existsSync(fixturePath))
      fail(`missing authority shadow fixture: ${definition.fixtureRef}`);
    const fixture = readJson(fixturePath, `authority shadow fixture ${definition.id}`);
    assertExactKeys(
      fixture,
      ["expectedLegacyOutput", "id", "input", "schemaVersion"],
      `authority shadow fixture ${definition.id}`
    );
    if (fixture.id !== definition.id || fixture.schemaVersion !== 1) {
      fail(`authority shadow fixture identity mismatch: ${definition.fixtureRef}`);
    }
    const pathIds = sortedUniqueStrings(definition.pathIds, `${definition.id}.pathIds`);
    for (const pathId of pathIds) {
      if (!entriesById.has(pathId)) fail(`${definition.id} references unknown path ${pathId}`);
    }
    const legacyReaderLocators = normalizeLegacyReaderLocators(
      definition.legacyReaderLocators,
      `${definition.id}.legacyReaderLocators`
    );
    for (const binding of legacyReaderLocators) {
      const entry = entriesById.get(binding.authorityPathId);
      if (!entry || !pathIds.includes(binding.authorityPathId)) {
        fail(`${definition.id} binds a legacy reader outside its declared pathIds`);
      }
      if (!entry.reads.some((locator) => locatorKey(locator) === locatorKey(binding.locator))) {
        fail(
          `${definition.id} legacy reader is not an exact current read of ${binding.authorityPathId}`
        );
      }
    }
    for (const pathId of pathIds) {
      if (!legacyReaderLocators.some((binding) => binding.authorityPathId === pathId)) {
        fail(`${definition.id} lacks an exact legacy reader for ${pathId}`);
      }
    }
    const core = {
      id: definition.id,
      fixtureRef: definition.fixtureRef,
      pathIds,
      legacyReaderLocators,
      futureReaderBinding: definition.futureReaderBinding,
      fixtureDigest: sha256(readFileSync(fixturePath)),
      inputDigest: observationDigest(fixture.input),
      expectedLegacyOutputDigest: observationDigest(fixture.expectedLegacyOutput),
      comparison: "canonical_json_exact",
      futureReaderState: "not_implemented",
      productionEffect: "none",
    };
    return { ...core, digest: digest("shadow-fixture", core) };
  });

const shadowedPathIds = new Set(shadowFixtures.flatMap((fixture) => fixture.pathIds));
for (const entry of entries) {
  if (
    entry.compatibility.mode === "legacy_reader_shadow_required" &&
    !shadowedPathIds.has(entry.id)
  ) {
    fail(`${entry.id} requires a legacy-reader shadow fixture but none is registered`);
  }
}

const builderRef = {
  id: policy.builderId,
  version: 1,
  path: path.relative(projectRoot, builderPath).split(path.sep).join("/"),
  digest: sha256(readFileSync(builderPath)),
};
const classificationPolicyRef = {
  id: policy.policyId,
  version: policy.schemaVersion,
  path: path.relative(projectRoot, policyPath).split(path.sep).join("/"),
  digest: sha256(readFileSync(policyPath)),
};
const definitionRef = {
  id: `${seed.inventoryId}.seed`,
  version: seed.schemaVersion,
  path: path.relative(projectRoot, seedPath).split(path.sep).join("/"),
  digest: sha256(readFileSync(seedPath)),
};
const writerContractRef = {
  id: writerContract.contractId,
  version: writerContract.schemaVersion,
  path: writerContractRelativePath,
  digest: actualWriterContractDigest,
};
const core = {
  schemaVersion: 1,
  inventoryId: seed.inventoryId,
  snapshotRevision: seed.snapshotRevision,
  state: seed.state,
  builderRef,
  classificationPolicyRef,
  definitionRef,
  writerContractRef,
  manifestCompleteness: {
    status: "not_evaluated",
    componentRegistrySnapshot: "not_available",
    appliedKnowledgeManifest: "not_available",
    reasonCodes: ["classification_only", "resolver_disabled", "t14_reconciliation_pending"],
  },
  coverage,
  declarationCoverage,
  entries,
  shadowFixtures,
};
const inventory = { ...core, digest: digest("inventory", core) };
const rendered = `${JSON.stringify(inventory, null, 2)}\n`;
const writeRequested = process.argv.includes("--write");

if (writeRequested) {
  if (!process.argv.includes("--acknowledge-review")) {
    fail("--write requires the explicit --acknowledge-review receipt");
  }
  if (process.argv.some((argument) => argument.startsWith("--review-source"))) {
    fail(
      "ephemeral --review-source receipts are forbidden; update the digest-bound seed.sourceReviews classification record"
    );
  }
  writeFileSync(outputPath, rendered);
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} (${entries.length} paths).`);
} else {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== rendered) {
    fail(
      "authority-path inventory is stale or incomplete; review the changed coverage and run npm run authority-paths:refresh -- --acknowledge-review"
    );
  }
  console.log(
    `Authority-path inventory verified: ${entries.length} classified paths, ${coverage.length} exact source files, ${shadowFixtures.length} shadow fixtures.`
  );
}

function normalizeEntry(entry) {
  const sourcePaths = sortedUniqueStrings(entry.sourcePaths, `${entry.id}.sourcePaths`);
  const runtimeAccess = sortedUniqueStrings(entry.runtimeAccess, `${entry.id}.runtimeAccess`);
  const definitionSources = sourcePaths.map((sourcePath) => ({
    path: sourcePath,
    digest: sha256(readFileSync(path.join(projectRoot, sourcePath))),
  }));
  const reads = normalizeSeedLocators(entry.currentReadPaths, `${entry.id}.currentReadPaths`);
  const writes = normalizeSeedWrites(entry.currentWritePaths, `${entry.id}.currentWritePaths`);
  const deniedMutations = normalizeDeniedMutations(
    entry.deniedMutations,
    `${entry.id}.deniedMutations`
  );
  const runtimeGuardBindings = normalizeRuntimeGuardBindings(
    entry.runtimeGuardBindings,
    `${entry.id}.runtimeGuardBindings`
  );
  const futureBindingStatus = entry.futureBindingStatus ?? "planned";
  const core = {
    id: entry.id,
    category: entry.category,
    owner: entry.owner,
    definitionSources,
    reads,
    writes,
    deniedMutations,
    effect: {
      changesMusicalBehavior:
        entry.authorityEffect === "musical_behavior" || entry.authorityEffect === "both",
      changesAuthorityClaim:
        entry.authorityEffect === "authority_claim" || entry.authorityEffect === "both",
    },
    mechanicality: entry.mechanicality,
    classification: entry.classification,
    authorityLane: entry.authorityLane,
    mechanicalEvidenceRef: entry.mechanicalEvidenceRef ?? null,
    subjectDomains: sortedUniqueStrings(entry.subjectDomains, `${entry.id}.subjectDomains`),
    compatibility: {
      mode: entry.compatibilityRequirement,
      readerId: reads.length > 0 ? reads.map((locator) => locator.selector).join("|") : null,
    },
    quarantine: {
      state: entry.quarantineState,
      reasonCodes:
        entry.quarantineState === "not_quarantined"
          ? []
          : entry.classification === "forbidden_unregistered_bypass"
            ? ["unregistered_authority_bypass", "activation_forbidden"]
            : ["legacy_read_only_compatibility", "activation_forbidden"],
    },
    futureBinding: {
      status: futureBindingStatus,
      componentId: futureBindingStatus === "planned" ? entry.futureComponentBinding : null,
      componentKind:
        futureBindingStatus === "planned" ? entry.futureComponentBinding.split(".", 1)[0] : null,
    },
    runtimeAccess,
    runtimeGuardBindings,
    claimLimitations: sortedUniqueStrings(entry.claimLimitations, `${entry.id}.claimLimitations`),
  };
  return { ...core, digest: digest("entry", core) };
}

function normalizeSeedLocators(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  const locators = value.map((locator, index) => {
    assertObject(locator, `${label}[${index}]`);
    assertExactKeys(locator, ["kind", "path", "selector"], `${label}[${index}]`);
    if (
      !locatorKinds.has(locator.kind) ||
      typeof locator.path !== "string" ||
      locator.path.length === 0 ||
      typeof locator.selector !== "string" ||
      locator.selector.length === 0
    ) {
      fail(`${label}[${index}] is not an exact runtime locator`);
    }
    return { kind: locator.kind, path: locator.path, selector: locator.selector };
  });
  return sortedUniqueObjects(locators, label, locatorKey);
}

function normalizeSeedWrites(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  const writes = value.map((write, index) => {
    assertObject(write, `${label}[${index}]`);
    assertExactKeys(write, ["locator", "outputFields"], `${label}[${index}]`);
    const [locator] = normalizeSeedLocators([write.locator], `${label}[${index}].locator`);
    const outputFields = sortedUniqueStrings(write.outputFields, `${label}[${index}].outputFields`);
    if (outputFields.length === 0) fail(`${label}[${index}].outputFields must not be empty`);
    return { locator, outputFields };
  });
  return sortedUniqueObjects(writes, label, (write) => locatorKey(write.locator));
}

function normalizeDeniedMutations(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  const denied = value.map((item, index) => {
    assertObject(item, `${label}[${index}]`);
    assertExactKeys(item, ["disposition", "locator", "reasonCode"], `${label}[${index}]`);
    if (item.disposition !== "always_rejected" || typeof item.reasonCode !== "string") {
      fail(`${label}[${index}] is not an always-rejected mutation`);
    }
    const [locator] = normalizeSeedLocators([item.locator], `${label}[${index}].locator`);
    return { locator, disposition: item.disposition, reasonCode: item.reasonCode };
  });
  return sortedUniqueObjects(denied, label, (item) => locatorKey(item.locator));
}

function normalizeRuntimeGuardBindings(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  const bindings = value.map((binding, index) => {
    assertObject(binding, `${label}[${index}]`);
    assertExactKeys(binding, ["access", "guardScope", "locator"], `${label}[${index}]`);
    if (!new Set(["read", "write"]).has(binding.access)) {
      fail(`${label}[${index}] has an invalid access`);
    }
    const [locator] = normalizeSeedLocators([binding.locator], `${label}[${index}].locator`);
    assertObject(binding.guardScope, `${label}[${index}].guardScope`);
    assertExactKeys(
      binding.guardScope,
      ["mode", "path", "selector"],
      `${label}[${index}].guardScope`
    );
    if (
      !guardModes.has(binding.guardScope.mode) ||
      typeof binding.guardScope.path !== "string" ||
      binding.guardScope.path.length === 0 ||
      typeof binding.guardScope.selector !== "string" ||
      binding.guardScope.selector.length === 0
    ) {
      fail(`${label}[${index}] has an invalid exact guard scope`);
    }
    return {
      access: binding.access,
      locator,
      guardScope: {
        mode: binding.guardScope.mode,
        path: binding.guardScope.path,
        selector: binding.guardScope.selector,
      },
    };
  });
  return sortedUniqueObjects(bindings, label, guardBindingKey);
}

function normalizeLegacyReaderLocators(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a non-empty array`);
  const bindings = value.map((binding, index) => {
    assertObject(binding, `${label}[${index}]`);
    assertExactKeys(binding, ["authorityPathId", "locator"], `${label}[${index}]`);
    if (typeof binding.authorityPathId !== "string" || !binding.authorityPathId) {
      fail(`${label}[${index}] has an invalid authorityPathId`);
    }
    const [locator] = normalizeSeedLocators([binding.locator], `${label}[${index}].locator`);
    return { authorityPathId: binding.authorityPathId, locator };
  });
  return sortedUniqueObjects(
    bindings,
    label,
    (binding) => `${binding.authorityPathId}\0${locatorKey(binding.locator)}`
  );
}

function locatorKey(locator) {
  return `${locator.kind}\0${locator.path}\0${locator.selector}`;
}

function guardBindingKey(binding) {
  return `${binding.access}\0${locatorKey(binding.locator)}`;
}

function sortedUniqueObjects(values, label, keyFor) {
  const sorted = [...values].sort((left, right) => {
    const leftKey = keyFor(left);
    const rightKey = keyFor(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  for (let index = 1; index < sorted.length; index += 1) {
    if (keyFor(sorted[index - 1]) === keyFor(sorted[index])) {
      fail(`${label} must contain no duplicate exact locators`);
    }
  }
  return sorted;
}

function validatePolicy(value) {
  assertObject(value, "classification policy");
  assertExactKeys(
    value,
    [
      "allowedExtensions",
      "authorityLanes",
      "builderId",
      "bypassRules",
      "classifications",
      "compatibilityModes",
      "cutoverRule",
      "evaluatorRoots",
      "futureBindingStatuses",
      "ignoredDirectoryNames",
      "ignoredDirectoryPaths",
      "ignoredFileSuffixes",
      "ignoredPaths",
      "independentRebuildRule",
      "inventoryRoots",
      "noAuthorityDeclarationExceptions",
      "policyId",
      "quarantineStates",
      "requiredSurfaceCategories",
      "runtimeContexts",
      "schemaVersion",
      "writeOutputFieldRegistry",
      "writerSinkRules",
    ],
    "classification policy"
  );
  if (value.schemaVersion !== 1) fail("classification policy schemaVersion must be 1");
  for (const key of [
    "allowedExtensions",
    "authorityLanes",
    "classifications",
    "compatibilityModes",
    "evaluatorRoots",
    "futureBindingStatuses",
    "ignoredDirectoryNames",
    "ignoredDirectoryPaths",
    "ignoredFileSuffixes",
    "ignoredPaths",
    "inventoryRoots",
    "quarantineStates",
    "requiredSurfaceCategories",
    "runtimeContexts",
    "writeOutputFieldRegistry",
  ]) {
    sortedUniqueStrings(value[key], `classification policy.${key}`);
  }
  if (!Array.isArray(value.noAuthorityDeclarationExceptions)) {
    fail("classification policy.noAuthorityDeclarationExceptions must be an array");
  }
  let previousNoAuthorityDeclarationKey = "";
  for (const exception of value.noAuthorityDeclarationExceptions) {
    assertExactKeys(
      exception,
      ["declarationDigest", "reason", "selector", "sourcePath"],
      "no-authority declaration exception"
    );
    if (
      typeof exception.sourcePath !== "string" ||
      !exception.sourcePath.endsWith(".ts") ||
      exception.sourcePath !== exception.sourcePath.trim() ||
      path.posix.normalize(exception.sourcePath) !== exception.sourcePath ||
      typeof exception.selector !== "string" ||
      exception.selector.length === 0 ||
      exception.selector !== exception.selector.trim() ||
      typeof exception.declarationDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(exception.declarationDigest) ||
      typeof exception.reason !== "string" ||
      exception.reason.trim().length === 0
    ) {
      fail("no-authority declaration exception has an invalid exact locator or rationale");
    }
    const key = `${exception.sourcePath}\0${exception.selector}`;
    if (key <= previousNoAuthorityDeclarationKey) {
      fail(
        "classification policy.noAuthorityDeclarationExceptions must be uniquely sorted by sourcePath and selector"
      );
    }
    previousNoAuthorityDeclarationKey = key;
    const sourceFile = sourceFileFor(exception.sourcePath, new Map());
    const declarations = findReviewableDeclarations(sourceFile, exception.selector);
    if (declarations.length !== 1) {
      fail(
        `no-authority declaration exception must resolve exactly once: ${exception.sourcePath}::${exception.selector}`
      );
    }
    const actualDigest = sha256(declarations[0].getText(sourceFile));
    if (actualDigest !== exception.declarationDigest) {
      fail(
        `no-authority declaration exception implementation digest mismatch: ${exception.sourcePath}::${exception.selector}`
      );
    }
  }
  if (!Array.isArray(value.writerSinkRules) || value.writerSinkRules.length === 0) {
    fail("classification policy.writerSinkRules must be a non-empty array");
  }
  const writerSinkRuleIds = new Set();
  for (const rule of value.writerSinkRules) {
    assertExactKeys(
      rule,
      ["allowedRoots", "id", "sinkSelectors", "sourcePath"],
      "writer sink rule"
    );
    if (
      typeof rule.id !== "string" ||
      !rule.id ||
      typeof rule.sourcePath !== "string" ||
      !rule.sourcePath.endsWith(".ts")
    ) {
      fail("writer sink rule has an invalid id or TypeScript source path");
    }
    if (writerSinkRuleIds.has(rule.id)) fail(`duplicate writer sink rule ${rule.id}`);
    writerSinkRuleIds.add(rule.id);
    sortedUniqueStrings(rule.sinkSelectors, `${rule.id}.sinkSelectors`);
    if (!Array.isArray(rule.allowedRoots)) fail(`${rule.id}.allowedRoots must be an array`);
    let previousAllowedRoot = "";
    for (const allowed of rule.allowedRoots) {
      assertExactKeys(allowed, ["reason", "selector"], `${rule.id} allowed root`);
      if (
        typeof allowed.selector !== "string" ||
        !allowed.selector ||
        typeof allowed.reason !== "string" ||
        !allowed.reason
      ) {
        fail(`${rule.id} has an invalid allowed writer root`);
      }
      if (allowed.selector <= previousAllowedRoot) {
        fail(`${rule.id}.allowedRoots must be uniquely sorted by selector`);
      }
      previousAllowedRoot = allowed.selector;
    }
  }
  if (!Array.isArray(value.bypassRules)) fail("classification policy.bypassRules must be an array");
  const bypassIds = new Set();
  for (const rule of value.bypassRules) {
    assertExactKeys(rule, ["allowedOccurrences", "forbiddenPattern", "id"], `bypass rule`);
    if (bypassIds.has(rule.id)) fail(`duplicate bypass rule ${rule.id}`);
    bypassIds.add(rule.id);
    if (!Array.isArray(rule.allowedOccurrences)) {
      fail(`${rule.id}.allowedOccurrences must be an array`);
    }
    const occurrencePaths = new Set();
    for (const occurrence of rule.allowedOccurrences) {
      assertExactKeys(
        occurrence,
        ["authorityPathId", "expectedCount", "sourcePath"],
        `${rule.id} allowed occurrence`
      );
      if (
        typeof occurrence.authorityPathId !== "string" ||
        typeof occurrence.sourcePath !== "string" ||
        !Number.isInteger(occurrence.expectedCount) ||
        occurrence.expectedCount < 1
      ) {
        fail(`${rule.id} has an invalid allowed occurrence`);
      }
      if (occurrencePaths.has(occurrence.sourcePath)) {
        fail(`${rule.id} duplicates allowed source ${occurrence.sourcePath}`);
      }
      occurrencePaths.add(occurrence.sourcePath);
    }
  }
}

function validateSeed(value, classificationPolicy) {
  assertObject(value, "authority-path seed");
  assertExactKeys(
    value,
    [
      "entries",
      "inventoryId",
      "noAuthorityEffect",
      "schemaVersion",
      "shadowFixtures",
      "snapshotRevision",
      "sourceReviews",
      "state",
    ],
    "authority-path seed"
  );
  if (value.schemaVersion !== 1 || !Number.isInteger(value.snapshotRevision)) {
    fail("authority-path seed identity is invalid");
  }
  assertExactKeys(
    value.state,
    ["completenessClaim", "productionActivation", "purpose", "resolver"],
    "authority-path seed state"
  );
  if (
    value.state.resolver !== "disabled" ||
    value.state.productionActivation !== "unchanged" ||
    value.state.purpose !== "inventory_and_shadow_specification_only"
  ) {
    fail(
      "T08 seed must remain classification-only with resolver disabled and production unchanged"
    );
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0)
    fail("seed entries are required");
  const entryIds = new Set();
  const entriesById = new Map();
  const observedCategories = new Set();
  for (const entry of value.entries) {
    assertObject(entry, "authority entry");
    const optional = new Set(["futureBindingStatus", "mechanicalEvidenceRef"]);
    const expected = [
      "authorityEffect",
      "authorityLane",
      "category",
      "claimLimitations",
      "classification",
      "compatibilityRequirement",
      "currentReadPaths",
      "currentWritePaths",
      "deniedMutations",
      "futureComponentBinding",
      "id",
      "mechanicality",
      "owner",
      "quarantineState",
      "runtimeAccess",
      "runtimeGuardBindings",
      "selector",
      "sourcePaths",
      "subjectDomains",
    ];
    const actual = Object.keys(entry);
    for (const key of actual) {
      if (!expected.includes(key) && !optional.has(key))
        fail(`${entry.id} has unknown field ${key}`);
    }
    for (const key of expected) {
      if (!(key in entry)) fail(`${entry.id ?? "authority entry"} is missing ${key}`);
    }
    if (entryIds.has(entry.id)) fail(`duplicate authority entry id ${entry.id}`);
    entryIds.add(entry.id);
    entriesById.set(entry.id, entry);
    observedCategories.add(entry.category);
    for (const key of ["claimLimitations", "runtimeAccess", "sourcePaths", "subjectDomains"]) {
      sortedUniqueStrings(entry[key], `${entry.id}.${key}`);
    }
    const reads = normalizeSeedLocators(entry.currentReadPaths, `${entry.id}.currentReadPaths`);
    const writes = normalizeSeedWrites(entry.currentWritePaths, `${entry.id}.currentWritePaths`);
    const deniedMutations = normalizeDeniedMutations(
      entry.deniedMutations,
      `${entry.id}.deniedMutations`
    );
    const bindings = normalizeRuntimeGuardBindings(
      entry.runtimeGuardBindings,
      `${entry.id}.runtimeGuardBindings`
    );
    const definitionPaths = new Set(entry.sourcePaths);
    const registeredOutputFields = new Set(classificationPolicy.writeOutputFieldRegistry);
    for (const write of writes) {
      for (const outputField of write.outputFields) {
        if (outputField === "legacy_record" || !registeredOutputFields.has(outputField)) {
          fail(`${entry.id} write output is not schema-bound by policy: ${outputField}`);
        }
      }
    }
    for (const locator of [
      ...reads,
      ...writes.map((write) => write.locator),
      ...deniedMutations.map((item) => item.locator),
      ...bindings.flatMap((binding) => [binding.locator, binding.guardScope]),
    ]) {
      if (!definitionPaths.has(locator.path)) {
        fail(
          `${entry.id} exact runtime path is not one of its classified sources: ${locator.path}`
        );
      }
    }
    if (
      !classificationPolicy.requiredSurfaceCategories.includes(entry.category) &&
      entry.category !== "governance_metadata"
    ) {
      fail(`${entry.id} has unknown category ${entry.category}`);
    }
    if (!classificationPolicy.classifications.includes(entry.classification)) {
      fail(`${entry.id} has unknown classification ${entry.classification}`);
    }
    if (
      entry.authorityLane !== null &&
      !classificationPolicy.authorityLanes.includes(entry.authorityLane)
    ) {
      fail(`${entry.id} has unknown authority lane ${entry.authorityLane}`);
    }
    if (!classificationPolicy.compatibilityModes.includes(entry.compatibilityRequirement)) {
      fail(`${entry.id} has unknown compatibility requirement ${entry.compatibilityRequirement}`);
    }
    if (!classificationPolicy.quarantineStates.includes(entry.quarantineState)) {
      fail(`${entry.id} has unknown quarantine state ${entry.quarantineState}`);
    }
    for (const access of entry.runtimeAccess) {
      if (!classificationPolicy.runtimeContexts.includes(access)) {
        fail(`${entry.id} has unknown runtime context ${access}`);
      }
    }
    validateClassificationMatrix(entry, classificationPolicy);
  }
  validateMechanicalEvidenceGraph(entriesById);
  for (const category of classificationPolicy.requiredSurfaceCategories) {
    if (!observedCategories.has(category))
      fail(`required authority surface category missing: ${category}`);
  }
  if (!Array.isArray(value.noAuthorityEffect)) fail("noAuthorityEffect must be an array");
  for (const exclusion of value.noAuthorityEffect) {
    assertExactKeys(exclusion, ["owner", "reason", "sourcePath"], "no-authority review");
  }
  if (!Array.isArray(value.sourceReviews)) fail("sourceReviews must be an array");
  let previousSourcePath = "";
  for (const review of value.sourceReviews) {
    assertExactKeys(
      review,
      ["authorityPathIds", "declarations", "disposition", "sourceDigest", "sourcePath"],
      "frozen source review"
    );
    if (
      typeof review.sourcePath !== "string" ||
      review.sourcePath.length === 0 ||
      typeof review.sourceDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(review.sourceDigest) ||
      !["authority_path", "no_authority_effect"].includes(review.disposition)
    ) {
      fail("frozen source review has invalid identity or digest fields");
    }
    sortedUniqueStrings(review.authorityPathIds, `${review.sourcePath}.authorityPathIds`);
    if (!Array.isArray(review.declarations)) {
      fail(`${review.sourcePath}.declarations must be an array`);
    }
    let previousSelector = "";
    for (const declaration of review.declarations) {
      assertExactKeys(
        declaration,
        ["authorityPathIds", "disposition", "selector"],
        `${review.sourcePath} declaration review`
      );
      if (
        typeof declaration.selector !== "string" ||
        declaration.selector.length === 0 ||
        !["authority_path", "no_authority_effect"].includes(declaration.disposition)
      ) {
        fail(`${review.sourcePath} declaration review has invalid identity fields`);
      }
      sortedUniqueStrings(
        declaration.authorityPathIds,
        `${review.sourcePath}::${declaration.selector}.authorityPathIds`
      );
      if (
        (declaration.disposition === "authority_path") !==
        declaration.authorityPathIds.length > 0
      ) {
        fail(
          `${review.sourcePath}::${declaration.selector} declaration disposition does not match its authority paths`
        );
      }
      if (declaration.selector <= previousSelector) {
        fail(`${review.sourcePath}.declarations must be uniquely sorted by selector`);
      }
      previousSelector = declaration.selector;
    }
    if (review.sourcePath <= previousSourcePath) {
      fail("sourceReviews must be uniquely sorted by sourcePath");
    }
    previousSourcePath = review.sourcePath;
  }
  if (!Array.isArray(value.shadowFixtures)) fail("shadowFixtures must be an array");
  const fixtureIds = new Set();
  for (const fixture of value.shadowFixtures) {
    assertExactKeys(
      fixture,
      ["fixtureRef", "futureReaderBinding", "id", "legacyReaderLocators", "pathIds"],
      "shadow fixture definition"
    );
    if (fixtureIds.has(fixture.id)) fail(`duplicate shadow fixture ${fixture.id}`);
    fixtureIds.add(fixture.id);
    sortedUniqueStrings(fixture.pathIds, `${fixture.id}.pathIds`);
    normalizeLegacyReaderLocators(
      fixture.legacyReaderLocators,
      `${fixture.id}.legacyReaderLocators`
    );
    if (typeof fixture.futureReaderBinding !== "string" || !fixture.futureReaderBinding) {
      fail(`${fixture.id}.futureReaderBinding must be a non-empty planned binding`);
    }
  }
}

function validateWriterContract(value, seedValue, classificationPolicyDigest) {
  assertObject(value, "authority writer contract");
  assertExactKeys(
    value,
    ["classificationPolicyDigest", "contractId", "entries", "schemaVersion", "sourceDigests"],
    "authority writer contract"
  );
  if (value.schemaVersion !== 1 || value.contractId !== "authority-writer-contract.v1") {
    fail("authority writer contract identity is invalid");
  }
  if (value.classificationPolicyDigest !== classificationPolicyDigest) {
    fail("authority writer contract does not pin the exact classification policy");
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    fail("authority writer contract entries are required");
  }

  const contractByKey = new Map();
  let previousKey = "";
  for (const [index, entry] of value.entries.entries()) {
    assertObject(entry, `authority writer contract entry ${index}`);
    assertExactKeys(
      entry,
      ["authorityPathId", "implementationDigest", "locator", "outputFields"],
      `authority writer contract entry ${index}`
    );
    if (typeof entry.authorityPathId !== "string" || entry.authorityPathId.length === 0) {
      fail(`authority writer contract entry ${index} has an invalid authorityPathId`);
    }
    if (
      typeof entry.implementationDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.implementationDigest)
    ) {
      fail(`authority writer contract entry ${index} has an invalid implementationDigest`);
    }
    const [locator] = normalizeSeedLocators(
      [entry.locator],
      `authority writer contract entry ${index}.locator`
    );
    const outputFields = sortedUniqueStrings(
      entry.outputFields,
      `authority writer contract entry ${index}.outputFields`
    );
    if (canonical(entry.outputFields) !== canonical(outputFields)) {
      fail(`authority writer contract entry ${index}.outputFields must be canonically sorted`);
    }
    const key = writerAttributionKey(entry.authorityPathId, locator);
    if (key <= previousKey) {
      fail("authority writer contract entries must be uniquely sorted by exact attribution");
    }
    previousKey = key;
    contractByKey.set(key, { authorityPathId: entry.authorityPathId, locator, outputFields });
  }

  const seedByKey = new Map();
  for (const entry of seedValue.entries) {
    for (const write of normalizeSeedWrites(
      entry.currentWritePaths,
      `${entry.id}.currentWritePaths`
    )) {
      const key = writerAttributionKey(entry.id, write.locator);
      if (seedByKey.has(key)) {
        fail(`seed duplicates authority writer attribution: ${describeWriterAttribution(key)}`);
      }
      seedByKey.set(key, {
        authorityPathId: entry.id,
        locator: write.locator,
        outputFields: write.outputFields,
      });
    }
  }

  const contractOnly = [...contractByKey.keys()].filter((key) => !seedByKey.has(key));
  const seedOnly = [...seedByKey.keys()].filter((key) => !contractByKey.has(key));
  if (contractOnly.length > 0 || seedOnly.length > 0) {
    fail(
      `authority writer contract attribution set mismatch; contract-only: ${
        contractOnly.length > 0 ? describeWriterAttribution(contractOnly[0]) : "none"
      }; seed-only: ${seedOnly.length > 0 ? describeWriterAttribution(seedOnly[0]) : "none"}`
    );
  }

  for (const [key, contractEntry] of contractByKey) {
    const seedEntry = seedByKey.get(key);
    if (canonical(contractEntry.outputFields) !== canonical(seedEntry.outputFields)) {
      fail(
        `authority writer contract output mismatch at ${describeWriterAttribution(key)}; expected ${contractEntry.outputFields.join(", ")}; received ${seedEntry.outputFields.join(", ")}`
      );
    }
  }
}

function validateWriterImplementationBindings(contract) {
  const locatorPaths = [...new Set(contract.entries.map((entry) => entry.locator.path))].sort();
  if (!Array.isArray(contract.sourceDigests)) {
    fail("authority writer contract sourceDigests must be an array");
  }
  const contractSourcePaths = [];
  let previousSourcePath = "";
  for (const [index, binding] of contract.sourceDigests.entries()) {
    assertExactKeys(binding, ["digest", "path"], `authority writer source digest ${index}`);
    if (
      typeof binding.path !== "string" ||
      !binding.path.endsWith(".ts") ||
      typeof binding.digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(binding.digest)
    ) {
      fail(`authority writer source digest ${index} is invalid`);
    }
    if (binding.path <= previousSourcePath) {
      fail("authority writer source digests must be uniquely sorted by path");
    }
    previousSourcePath = binding.path;
    contractSourcePaths.push(binding.path);
    const absolute = path.join(projectRoot, binding.path);
    if (!existsSync(absolute)) fail(`authority writer source is missing: ${binding.path}`);
    const actualDigest = sha256(readFileSync(absolute));
    if (actualDigest !== binding.digest) {
      fail(`authority writer source digest mismatch: ${binding.path}`);
    }
  }
  if (canonical(contractSourcePaths) !== canonical(locatorPaths)) {
    fail("authority writer source digest paths do not match exact writer locator paths");
  }

  const sourceFileCache = new Map();
  for (const entry of contract.entries) {
    const sourceFile = sourceFileFor(entry.locator.path, sourceFileCache);
    const declarations = findExecutableDeclarations(sourceFile, entry.locator.selector, true);
    if (declarations.length !== 1) {
      fail(
        `authority writer implementation locator must resolve exactly once: ${entry.locator.path}::${entry.locator.selector}`
      );
    }
    const actualDigest = sha256(declarations[0].getText(sourceFile));
    if (actualDigest !== entry.implementationDigest) {
      fail(
        `authority writer implementation digest mismatch: ${entry.locator.path}::${entry.locator.selector}`
      );
    }
  }
}

function validateWriterSinkClosure(rules, contract) {
  const contractedSelectors = new Set(
    contract.entries.map((entry) => `${entry.locator.path}\0${entry.locator.selector}`)
  );
  for (const rule of rules) {
    const absolute = path.join(projectRoot, rule.sourcePath);
    if (!existsSync(absolute)) fail(`${rule.id} names a missing writer source: ${rule.sourcePath}`);
    const sourceFile = sourceFileFor(rule.sourcePath, new Map());
    const allowedRoots = new Set(rule.allowedRoots.map((item) => item.selector));
    const callersByCallee = new Map();
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const caller = enclosingReviewableSelector(node);
        const callee = calledSelector(node, caller);
        if (caller && callee) {
          const callers = callersByCallee.get(callee) ?? new Set();
          callers.add(caller);
          callersByCallee.set(callee, callers);
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    for (const sinkSelector of rule.sinkSelectors) {
      const directCallers = callersByCallee.get(sinkSelector);
      if (!directCallers || directCallers.size === 0) {
        fail(`${rule.id} writer sink is stale or unresolved: ${rule.sourcePath}::${sinkSelector}`);
      }
      for (const caller of directCallers) {
        assertContractedWriterReachability(
          rule,
          caller,
          callersByCallee,
          contractedSelectors,
          allowedRoots,
          new Set()
        );
      }
    }
  }
}

function validateWriterOutputClosure(outputFieldRegistry, contract) {
  const sourcePath = "src/server/lib/workspace-store.ts";
  const sourceFile = sourceFileFor(sourcePath, new Map());
  const registeredWorkspaceFields = new Set(
    outputFieldRegistry
      .filter((field) => field.startsWith("ArrangementWorkspace."))
      .map((field) => field.slice("ArrangementWorkspace.".length))
  );
  const claimedBySelector = new Map();
  for (const item of contract.entries.filter((entry) => entry.locator.path === sourcePath)) {
    const claimed = claimedBySelector.get(item.locator.selector) ?? new Set();
    for (const field of item.outputFields) claimed.add(field);
    claimedBySelector.set(item.locator.selector, claimed);
  }

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
      node.expression.name.text === "mutateWorkspace"
    ) {
      const selector = enclosingReviewableSelector(node);
      const claimed = selector ? claimedBySelector.get(selector) : undefined;
      if (selector && claimed) {
        const callback = node.arguments[2];
        if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) {
          fail(`${selector} passes an unresolved workspace mutation callback`);
        }
        const fields = workspaceMutationFields(callback, registeredWorkspaceFields, selector);
        fields.add("revision");
        for (const field of fields) {
          const outputField = `ArrangementWorkspace.${field}`;
          if (!claimed.has(outputField)) {
            fail(`${selector} mutates unclaimed authority writer output ${outputField}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  const createSelector = "WorkspaceStore.create";
  const createClaims = claimedBySelector.get(createSelector);
  const [createDeclaration] = findExecutableDeclarations(sourceFile, createSelector, false);
  if (!createClaims || !createDeclaration || !createDeclaration.body) {
    fail(`${createSelector} must have an exact authority writer contract and implementation`);
  }
  const workspaceInitializers = [];
  const findWorkspaceInitializer = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "workspace" &&
      node.initializer
    ) {
      workspaceInitializers.push(node.initializer);
    }
    ts.forEachChild(node, findWorkspaceInitializer);
  };
  findWorkspaceInitializer(createDeclaration.body);
  if (workspaceInitializers.length !== 1) {
    fail(`${createSelector} must build exactly one explicit workspace record`);
  }
  let workspaceInitializer = workspaceInitializers[0];
  while (
    ts.isParenthesizedExpression(workspaceInitializer) ||
    ts.isAsExpression(workspaceInitializer) ||
    ts.isTypeAssertionExpression(workspaceInitializer) ||
    ts.isSatisfiesExpression(workspaceInitializer)
  ) {
    workspaceInitializer = workspaceInitializer.expression;
  }
  if (!ts.isObjectLiteralExpression(workspaceInitializer)) {
    fail(`${createSelector} must build an explicit workspace object projection`);
  }
  for (const property of workspaceInitializer.properties) {
    if (
      (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
      ts.isComputedPropertyName(property.name)
    ) {
      fail(`${createSelector} contains an unresolved workspace output field`);
    }
    const field = property.name.getText(sourceFile).replace(/^['"]|['"]$/g, "");
    if (
      registeredWorkspaceFields.has(field) &&
      !createClaims.has(`ArrangementWorkspace.${field}`)
    ) {
      fail(
        `${createSelector} mutates unclaimed authority writer output ArrangementWorkspace.${field}`
      );
    }
  }
}

function workspaceMutationFields(callback, registeredFields, selector) {
  const fields = new Set();
  const parameter = callback.parameters[0];
  if (!parameter || !ts.isIdentifier(parameter.name)) {
    fail(`${selector} workspace mutation callback must use one explicit workspace identifier`);
  }
  const workspaceName = parameter.name.text;
  const inspectReturnedObject = (expression) => {
    while (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      expression = expression.expression;
    }
    if (!ts.isObjectLiteralExpression(expression)) {
      fail(`${selector} workspace mutation callback must return an explicit object projection`);
    }
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        if (!ts.isIdentifier(property.expression) || property.expression.text !== workspaceName) {
          fail(`${selector} workspace mutation callback contains an unresolved object spread`);
        }
        continue;
      }
      if (
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property) &&
        !ts.isMethodDeclaration(property)
      ) {
        fail(`${selector} workspace mutation callback contains an unresolved object member`);
      }
      if (ts.isComputedPropertyName(property.name)) {
        fail(`${selector} workspace mutation callback contains a computed output field`);
      }
      const name = property.name.getText(callback.getSourceFile()).replace(/^['"]|['"]$/g, "");
      if (registeredFields.has(name)) fields.add(name);
    }
  };

  if (ts.isBlock(callback.body)) {
    let returns = 0;
    const inspectReturn = (node) => {
      if (node !== callback.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node)) {
        if (!node.expression) fail(`${selector} workspace mutation callback has an empty return`);
        returns += 1;
        inspectReturnedObject(node.expression);
        return;
      }
      ts.forEachChild(node, inspectReturn);
    };
    inspectReturn(callback.body);
    if (returns === 0) fail(`${selector} workspace mutation callback has no explicit return`);
  } else {
    inspectReturnedObject(callback.body);
  }

  const inspectMutation = (node) => {
    if (node !== callback && ts.isFunctionLike(node)) return;
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === workspaceName &&
      registeredFields.has(node.name.text)
    ) {
      const parent = node.parent;
      if (
        (ts.isBinaryExpression(parent) && parent.left === node) ||
        (ts.isCallExpression(parent) &&
          ts.isPropertyAccessExpression(parent.expression) &&
          parent.expression.expression === node)
      ) {
        fields.add(node.name.text);
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === workspaceName
    ) {
      fail(`${selector} workspace mutation callback contains a computed workspace mutation`);
    }
    ts.forEachChild(node, inspectMutation);
  };
  inspectMutation(callback.body);
  return fields;
}

function assertContractedWriterReachability(
  rule,
  selector,
  callersByCallee,
  contractedSelectors,
  allowedRoots,
  trail
) {
  if (contractedSelectors.has(`${rule.sourcePath}\0${selector}`)) return;
  if (allowedRoots.has(selector)) return;
  if (trail.has(selector)) {
    fail(
      `${rule.id} writer sink reaches an uncontracted call cycle at ${rule.sourcePath}::${selector}`
    );
  }
  const callers = callersByCallee.get(selector);
  if (!callers || callers.size === 0) {
    fail(
      `${rule.id} writer sink reaches an uncontracted writer root: ${rule.sourcePath}::${selector}`
    );
  }
  const nextTrail = new Set(trail).add(selector);
  for (const caller of callers) {
    assertContractedWriterReachability(
      rule,
      caller,
      callersByCallee,
      contractedSelectors,
      allowedRoots,
      nextTrail
    );
  }
}

function enclosingReviewableSelector(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      ts.isMethodDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current) ||
      ts.isPropertyDeclaration(current)
    ) {
      const owner = current.parent;
      if (ts.isClassDeclaration(owner) && owner.name && current.name) {
        return `${owner.name.text}.${current.name.getText(current.getSourceFile())}`;
      }
    }
    if (ts.isConstructorDeclaration(current)) {
      const owner = current.parent;
      if (ts.isClassDeclaration(owner) && owner.name) return owner.name.text;
    }
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
  }
  return null;
}

function calledSelector(node, caller) {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) {
    const member = node.expression.name.text;
    if (node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && caller?.includes(".")) {
      return `${caller.split(".", 1)[0]}.${member}`;
    }
    return member;
  }
  if (
    ts.isElementAccessExpression(node.expression) &&
    ts.isStringLiteral(node.expression.argumentExpression)
  ) {
    const member = node.expression.argumentExpression.text;
    if (node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && caller?.includes(".")) {
      return `${caller.split(".", 1)[0]}.${member}`;
    }
    return member;
  }
  return null;
}

function writerAttributionKey(authorityPathId, locator) {
  return `${authorityPathId}\0${locatorKey(locator)}`;
}

function describeWriterAttribution(key) {
  return key.split("\0").join("::");
}

function validateFrozenSourceReviews(sourceReviews, noAuthorityDeclarationExceptions) {
  const reviewsByPath = new Map(sourceReviews.map((review) => [review.sourcePath, review]));
  const noAuthorityExceptionsByLocator = new Map(
    noAuthorityDeclarationExceptions.map((exception) => [
      `${exception.sourcePath}\0${exception.selector}`,
      exception,
    ])
  );
  const authoritySelectorsByPath = new Map();
  for (const entry of seed.entries) {
    const runtimeGuardBindings = normalizeRuntimeGuardBindings(
      entry.runtimeGuardBindings,
      `${entry.id}.runtimeGuardBindings`
    );
    const locators = [
      ...normalizeSeedLocators(entry.currentReadPaths, `${entry.id}.currentReadPaths`),
      ...normalizeSeedWrites(entry.currentWritePaths, `${entry.id}.currentWritePaths`).map(
        (write) => write.locator
      ),
      ...normalizeDeniedMutations(entry.deniedMutations, `${entry.id}.deniedMutations`).map(
        (mutation) => mutation.locator
      ),
      ...runtimeGuardBindings.flatMap((binding) => [binding.locator, binding.guardScope]),
    ];
    for (const locator of locators) {
      if (!locator.path.endsWith(".ts") || isPointerLocator(locator)) continue;
      const bySelector = authoritySelectorsByPath.get(locator.path) ?? new Map();
      const ids = bySelector.get(locator.selector) ?? new Set();
      ids.add(entry.id);
      bySelector.set(locator.selector, ids);
      authoritySelectorsByPath.set(locator.path, bySelector);
    }
  }
  for (const sourcePath of sourcePaths) {
    if (sourcePath === path.relative(projectRoot, seedPath).split(path.sep).join("/")) continue;
    const review = reviewsByPath.get(sourcePath);
    if (!review) fail(`source lacks a digest-bound classification review: ${sourcePath}`);
    const authorityPathIds = [...(entrySources.get(sourcePath) ?? [])].sort();
    const disposition = authorityPathIds.length > 0 ? "authority_path" : "no_authority_effect";
    const sourceDigest = sha256(readFileSync(path.join(projectRoot, sourcePath)));
    if (
      review.sourceDigest !== sourceDigest ||
      review.disposition !== disposition ||
      canonical(review.authorityPathIds) !== canonical(authorityPathIds)
    ) {
      fail(`digest-bound source classification review is stale or mismatched: ${sourcePath}`);
    }
    const expectedSelectors = sourcePath.endsWith(".ts")
      ? reviewableDeclarationSelectors(sourcePath)
      : [];
    const declarationReviews = new Map(
      review.declarations.map((declaration) => [declaration.selector, declaration])
    );
    const exactLocatorSelectors = authoritySelectorsByPath.get(sourcePath) ?? new Map();
    for (const selector of expectedSelectors) {
      const declaration = declarationReviews.get(selector);
      if (!declaration) {
        fail(`unreviewed declaration in classified source: ${sourcePath}::${selector}`);
      }
      const exceptionKey = `${sourcePath}\0${selector}`;
      const noAuthorityException = noAuthorityExceptionsByLocator.get(exceptionKey);
      if (noAuthorityException && authorityPathIds.length === 0) {
        fail(
          `no-authority declaration exception is unnecessary outside an authority-bearing source: ${sourcePath}::${selector}`
        );
      }
      if (noAuthorityException && exactLocatorSelectors.has(selector)) {
        fail(
          `no-authority declaration exception overlaps an exact authority locator: ${sourcePath}::${selector}`
        );
      }
      if (
        authorityPathIds.length > 0 &&
        declaration.disposition === "no_authority_effect" &&
        !noAuthorityException
      ) {
        fail(`unapproved no-authority declaration downgrade: ${sourcePath}::${selector}`);
      }
      const ids = noAuthorityException ? [] : authorityPathIds;
      const expectedDisposition = ids.length > 0 ? "authority_path" : "no_authority_effect";
      if (
        declaration.disposition !== expectedDisposition ||
        canonical(declaration.authorityPathIds) !== canonical(ids)
      ) {
        fail(`declaration classification is stale or mismatched: ${sourcePath}::${selector}`);
      }
      if (noAuthorityException) noAuthorityExceptionsByLocator.delete(exceptionKey);
      declarationReviews.delete(selector);
      exactLocatorSelectors.delete(selector);
    }
    if (exactLocatorSelectors.size > 0) {
      fail(
        `authority locator is not a reviewed runtime declaration: ${sourcePath}::${
          [...exactLocatorSelectors.keys()].sort()[0]
        }`
      );
    }
    if (declarationReviews.size > 0) {
      fail(`orphan declaration review: ${sourcePath}::${[...declarationReviews.keys()].sort()[0]}`);
    }
    reviewsByPath.delete(sourcePath);
  }
  if (reviewsByPath.size > 0) {
    fail(`orphan digest-bound source review: ${[...reviewsByPath.keys()].sort()[0]}`);
  }
  if (noAuthorityExceptionsByLocator.size > 0) {
    const exception = [...noAuthorityExceptionsByLocator.values()].sort((left, right) => {
      const leftKey = `${left.sourcePath}\0${left.selector}`;
      const rightKey = `${right.sourcePath}\0${right.selector}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    })[0];
    fail(
      `orphan no-authority declaration exception: ${exception.sourcePath}::${exception.selector}`
    );
  }
}

function validateWriteOutputFieldRegistry(registry, reviewedSourcePaths) {
  const sourceFileCache = new Map();
  const schemas = new Map();
  for (const sourcePath of reviewedSourcePaths.filter((candidate) => candidate.endsWith(".ts"))) {
    const sourceFile = sourceFileFor(sourcePath, sourceFileCache);
    for (const statement of sourceFile.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text.endsWith("Schema") &&
            declaration.initializer
          ) {
            schemas.set(declaration.name.text, {
              sourceFile,
              initializer: declaration.initializer,
            });
          }
        }
      }
      if (
        (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
        statement.name
      ) {
        // Exact canonical type bindings below resolve by path and selector. The
        // global schema map is retained only for nested TypeBox references.
      }
    }
  }
  for (const outputField of registry) {
    const binaryBinding = canonicalBinaryOutputBindings.get(outputField);
    if (binaryBinding) {
      validateCanonicalBinaryOutputBinding(binaryBinding, sourceFileCache);
      continue;
    }
    const [root, ...fieldPath] = outputField.split(".");
    if (!root || fieldPath.length === 0) {
      fail(`write output registry field is not schema-qualified: ${outputField}`);
    }
    const binding = canonicalWriteOutputRootBindings.get(root);
    if (!binding) {
      fail(`write output registry root has no fixed canonical binding: ${outputField}`);
    }
    if (!reviewedSourcePaths.includes(binding.path)) {
      fail(`canonical write output binding is outside reviewed sources: ${binding.path}`);
    }
    const sourceFile = sourceFileFor(binding.path, sourceFileCache);
    const declaration = findCanonicalOutputDeclaration(sourceFile, binding);
    if (fieldPath.length === 1 && fieldPath[0] === "record") {
      continue;
    }
    const exists =
      binding.kind === "typebox_object"
        ? expressionHasSchemaPath(
            schemas,
            sourceFile,
            declaration.initializer,
            fieldPath,
            new Set()
          )
        : declaredTypePathExists(sourceFile, declaration, fieldPath);
    if (!exists) {
      fail(`write output registry field is not backed by a declared schema path: ${outputField}`);
    }
  }
}

function findCanonicalOutputDeclaration(sourceFile, binding) {
  if (binding.kind === "typebox_object") {
    const matches = sourceFile.statements.flatMap((statement) =>
      ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.filter(
            (declaration) =>
              ts.isIdentifier(declaration.name) && declaration.name.text === binding.selector
          )
        : []
    );
    if (
      matches.length !== 1 ||
      !matches[0].initializer ||
      !isDirectTypeObject(matches[0].initializer)
    ) {
      fail(
        `canonical write output schema must be exactly one Type.Object declaration: ${binding.path}::${binding.selector}`
      );
    }
    return matches[0];
  }
  const matches = sourceFile.statements.filter(
    (statement) =>
      (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
      statement.name.text === binding.selector
  );
  if (
    matches.length !== 1 ||
    (ts.isTypeAliasDeclaration(matches[0]) && !ts.isTypeLiteralNode(matches[0].type))
  ) {
    fail(
      `canonical write output type must be exactly one object type declaration: ${binding.path}::${binding.selector}`
    );
  }
  return matches[0];
}

function isDirectTypeObject(expression) {
  return (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === "Type" &&
    expression.expression.name.text === "Object" &&
    expression.arguments[0] !== undefined &&
    ts.isObjectLiteralExpression(expression.arguments[0])
  );
}

function declaredTypePathExists(sourceFile, declaration, fieldPath) {
  const members = ts.isInterfaceDeclaration(declaration)
    ? declaration.members
    : declaration.type.members;
  if (fieldPath.length !== 1) return false;
  return members.some(
    (member) =>
      ts.isPropertySignature(member) &&
      member.name?.getText(sourceFile).replaceAll('"', "") === fieldPath[0]
  );
}

function validateCanonicalBinaryOutputBinding(binding, sourceFileCache) {
  const sourceFile = sourceFileFor(binding.path, sourceFileCache);
  const declarations = findExecutableDeclarations(sourceFile, binding.selector, true);
  if (declarations.length !== 1) {
    fail(
      `canonical binary output binding must resolve exactly once: ${binding.path}::${binding.selector}`
    );
  }
}

function expressionHasSchemaPath(schemas, sourceFile, expression, fieldPath, visited) {
  let current = expression;
  while (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    ["Optional", "Readonly"].includes(current.expression.name.text) &&
    current.arguments[0]
  ) {
    current = current.arguments[0];
  }
  if (ts.isIdentifier(current)) {
    const referenced = schemas.get(current.text);
    return referenced
      ? expressionHasSchemaPath(
          schemas,
          referenced.sourceFile,
          referenced.initializer,
          fieldPath,
          visited
        )
      : false;
  }
  if (
    !ts.isCallExpression(current) ||
    !ts.isPropertyAccessExpression(current.expression) ||
    current.expression.name.text !== "Object" ||
    !current.arguments[0] ||
    !ts.isObjectLiteralExpression(current.arguments[0])
  ) {
    return false;
  }
  const [field, ...rest] = fieldPath;
  const property = current.arguments[0].properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      candidate.name.getText(sourceFile).replaceAll('"', "") === field
  );
  if (!property || !ts.isPropertyAssignment(property)) return false;
  if (rest.length === 0) return true;
  return expressionHasSchemaPath(schemas, sourceFile, property.initializer, rest, visited);
}

function isPointerLocator(locator) {
  return ["file_region", "json_pointer", "yaml_pointer"].includes(locator.kind);
}

function reviewableDeclarationSelectors(sourcePath) {
  const sourceFile = sourceFileFor(sourcePath, new Map());
  const selectors = new Set();
  let moduleStatementIndex = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isModuleDeclaration(statement) && !isAmbientTypeModule(statement)) {
      fail(`runtime namespaces are forbidden in reviewed source: ${sourcePath}`);
    }
    if (ts.isImportDeclaration(statement) && !statement.importClause) {
      selectors.add(`<import:${statement.moduleSpecifier.getText(sourceFile)}>`);
      continue;
    }
    if (ts.isFunctionDeclaration(statement)) {
      if (!statement.name) {
        fail(
          `anonymous default function declarations are forbidden in reviewed source: ${sourcePath}`
        );
      }
      selectors.add(statement.name.text);
      continue;
    }
    if (ts.isClassDeclaration(statement)) {
      if (!statement.name) {
        fail(
          `anonymous default class declarations are forbidden in reviewed source: ${sourcePath}`
        );
      }
      const className = statement.name.text;
      if (statement.members.some(ts.isConstructorDeclaration)) selectors.add(className);
      for (const member of statement.members) {
        if (ts.isClassStaticBlockDeclaration(member)) {
          fail(`class static blocks are forbidden in reviewed source: ${sourcePath}::${className}`);
        }
        if (
          (ts.isMethodDeclaration(member) ||
            ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member) ||
            ts.isPropertyDeclaration(member)) &&
          member.name
        ) {
          if (ts.isComputedPropertyName(member.name)) {
            fail(
              `computed class member names are forbidden in reviewed source: ${sourcePath}::${className}`
            );
          }
          selectors.add(`${className}.${member.name.getText(sourceFile)}`);
        }
      }
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const name of bindingNames(declaration.name)) selectors.add(name);
      }
      continue;
    }
    if (ts.isEnumDeclaration(statement)) selectors.add(statement.name.text);
    if (
      ts.isImportDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isModuleDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    ) {
      continue;
    }
    if (
      !ts.isFunctionDeclaration(statement) &&
      !ts.isClassDeclaration(statement) &&
      !ts.isVariableStatement(statement) &&
      !ts.isEnumDeclaration(statement)
    ) {
      moduleStatementIndex += 1;
      selectors.add(`<module:${moduleStatementIndex}>`);
    }
  }
  return [...selectors].sort();
}

function isAmbientTypeModule(statement) {
  return (
    Boolean(statement.flags & ts.NodeFlags.GlobalAugmentation) ||
    Boolean(statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword))
  );
}

function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name)
  );
}

function validateClassificationMatrix(entry, classificationPolicy) {
  const futureBindingStatus = entry.futureBindingStatus ?? "planned";
  if (!classificationPolicy.futureBindingStatuses.includes(futureBindingStatus)) {
    fail(`${entry.id} has unknown future binding status ${futureBindingStatus}`);
  }
  if (entry.classification === "mechanical_fact") {
    if (entry.mechanicality !== "mechanical" || entry.authorityLane !== null) {
      fail(`${entry.id} mechanical facts must be mechanical and authority-lane neutral`);
    }
    if (!entry.mechanicalEvidenceRef) {
      fail(`${entry.id} mechanical fact lacks Instrument Model/Instance evidence`);
    }
    if (!["profile_constant", "validator"].includes(entry.category)) {
      fail(`${entry.id} mechanical fact must be a profile constant or validator`);
    }
    if (!entry.subjectDomains.includes("mechanics")) {
      fail(`${entry.id} mechanical fact must bind the mechanics subject domain`);
    }
    if (entry.compatibilityRequirement !== "exact_current_reader") {
      fail(`${entry.id} mechanical fact must retain its exact current reader`);
    }
  } else if (entry.mechanicality !== "nonmechanical" || entry.mechanicalEvidenceRef) {
    fail(`${entry.id} only mechanical_fact may be mechanical or carry mechanical evidence`);
  }
  if (entry.classification === "evaluator_only_logic") {
    if (
      entry.runtimeAccess.includes("production") ||
      entry.compatibilityRequirement !== "evaluation_only_exact_identity" ||
      entry.authorityLane !== null
    ) {
      fail(`${entry.id} evaluator-only logic cannot be production reachable or carry a lane`);
    }
  }
  if (entry.classification === "forbidden_unregistered_bypass") {
    if (
      entry.quarantineState !== "quarantined" ||
      entry.runtimeAccess.includes("production") ||
      !["quarantined_inspection_only", "quarantined_no_read"].includes(
        entry.compatibilityRequirement
      )
    ) {
      fail(`${entry.id} forbidden bypass must be quarantined and unavailable to production`);
    }
  }
  if (entry.quarantineState === "quarantined" && entry.runtimeAccess.includes("production")) {
    fail(`${entry.id} quarantined path cannot be production reachable`);
  }
  if (
    entry.mechanicality === "nonmechanical" &&
    entry.runtimeAccess.includes("production") &&
    (!["exact_current_reader", "legacy_reader_shadow_required"].includes(
      entry.compatibilityRequirement
    ) ||
      futureBindingStatus !== "planned")
  ) {
    fail(`${entry.id} nonmechanical production path requires an exact reader and planned binding`);
  }
  if (
    entry.classification === "owner_local_preference" &&
    entry.authorityLane !== "owner_local_reviewed_guidance"
  ) {
    fail(`${entry.id} Owner preference must use only the Owner-local lane`);
  }
}

function validateMechanicalEvidenceGraph(entriesById) {
  for (const entry of entriesById.values()) {
    if (entry.classification !== "mechanical_fact") continue;
    const evidence = entry.mechanicalEvidenceRef;
    assertObject(evidence, `${entry.id}.mechanicalEvidenceRef`);
    assertExactKeys(
      evidence,
      ["resolverPathId", "resolverSelectors"],
      `${entry.id}.mechanicalEvidenceRef`
    );
    const selectors = sortedUniqueStrings(
      evidence.resolverSelectors,
      `${entry.id}.mechanicalEvidenceRef.resolverSelectors`
    );
    const resolver = entriesById.get(evidence.resolverPathId);
    if (!resolver) {
      fail(`${entry.id} mechanical evidence references unknown path ${evidence.resolverPathId}`);
    }
    if (
      resolver.classification !== "mechanical_fact" ||
      resolver.mechanicality !== "mechanical" ||
      resolver.category !== "validator"
    ) {
      fail(`${entry.id} mechanical evidence resolver must be a mechanical validator`);
    }
    const resolverReads = normalizeSeedLocators(
      resolver.currentReadPaths,
      `${resolver.id}.currentReadPaths`
    )
      .map((locator) => locator.selector)
      .sort();
    if (canonical(selectors) !== canonical(resolverReads)) {
      fail(`${entry.id} mechanical evidence selectors must exactly match resolver reads`);
    }
    if (!entry.runtimeAccess.every((context) => resolver.runtimeAccess.includes(context))) {
      fail(`${entry.id} mechanical evidence resolver does not cover every runtime context`);
    }
    if (!entry.subjectDomains.some((domain) => resolver.subjectDomains.includes(domain))) {
      fail(`${entry.id} mechanical evidence resolver has no bound subject domain`);
    }
  }
}

function validateImportClosure(coverageEntries) {
  const coverageByPath = new Map(coverageEntries.map((item) => [item.sourcePath, item]));
  const generatedInventoryPath = path.relative(projectRoot, outputPath).split(path.sep).join("/");
  for (const item of coverageEntries) {
    if (!item.sourcePath.endsWith(".ts")) continue;
    const sourceFile = sourceFileFor(item.sourcePath, new Map());
    const specifiers = [];
    for (const statement of sourceFile.statements) {
      if (ts.isImportEqualsDeclaration(statement)) {
        fail(`CommonJS module loaders are forbidden in reviewed source: ${item.sourcePath}`);
      }
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        if (["module", "node:module"].includes(statement.moduleSpecifier.text)) {
          fail(`CommonJS module loaders are forbidden in reviewed source: ${item.sourcePath}`);
        }
        specifiers.push(statement.moduleSpecifier.text);
      }
    }
    const visit = (node) => {
      if (isCommonJsLoaderNode(node)) {
        fail(`CommonJS module loaders are forbidden in reviewed source: ${item.sourcePath}`);
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        const specifier = resolveStaticImportSpecifier(sourceFile, node.arguments[0]);
        if (!specifier) {
          fail(`non-static dynamic import is forbidden in reviewed source: ${item.sourcePath}`);
        }
        specifiers.push(specifier);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) continue;
      const target = resolveRelativeImportTarget(item.sourcePath, specifier);
      if (target === generatedInventoryPath) continue;
      const targetCoverage = coverageByPath.get(target);
      if (!targetCoverage) {
        fail(`reviewed source imports an uncovered local module: ${item.sourcePath} -> ${target}`);
      }
      if (item.surfaceScope === "production" && targetCoverage.surfaceScope === "evaluation") {
        fail(`production source imports evaluator-only code: ${item.sourcePath} -> ${target}`);
      }
    }
  }
}

function isCommonJsLoaderNode(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    return ["require", "createRequire"].includes(node.expression.text);
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    ["require", "createRequire"].includes(node.name.text)
  ) {
    return true;
  }
  return (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteral(node.argumentExpression) &&
    ["require", "createRequire"].includes(node.argumentExpression.text)
  );
}

function resolveStaticImportSpecifier(sourceFile, expression) {
  if (ts.isStringLiteral(expression)) return expression.text;
  if (!ts.isIdentifier(expression)) return null;
  const declarations = [];
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
      ts.isIdentifier(node.name) &&
      node.name.text === expression.text &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return declarations.length === 1 ? declarations[0].initializer.text : null;
}

function resolveRelativeImportTarget(sourcePath, specifier) {
  const sourceDirectory = path.dirname(path.join(projectRoot, sourcePath));
  const requested = path.resolve(sourceDirectory, specifier.split(/[?#]/, 1)[0]);
  const candidates = [];
  if (/\.(?:c|m)?js$/.test(requested)) {
    candidates.push(requested.replace(/\.(?:c|m)?js$/, ".ts"));
  }
  candidates.push(requested, `${requested}.ts`, path.join(requested, "index.ts"));
  const target = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile()
  );
  if (!target) fail(`relative import target does not exist: ${sourcePath} -> ${specifier}`);
  const realTarget = realpathSync(target);
  if (realTarget !== target || !realTarget.startsWith(`${projectRoot}${path.sep}`)) {
    fail(
      `relative import escapes through a symlink or repository boundary: ${sourcePath} -> ${specifier}`
    );
  }
  return path.relative(projectRoot, target).split(path.sep).join("/");
}

function validateBypassRules(classificationPolicy, coverageEntries, inventoryEntries) {
  const productionPaths = coverageEntries.filter((item) => item.surfaceScope === "production");
  const skippedDefinitions = new Set(
    [policyPath, seedPath].map((filePath) =>
      path.relative(projectRoot, filePath).split(path.sep).join("/")
    )
  );
  for (const rule of classificationPolicy.bypassRules) {
    const allowedOccurrences = new Map();
    for (const occurrence of rule.allowedOccurrences) {
      const entry = inventoryEntries.get(occurrence.authorityPathId);
      if (!entry) {
        fail(`bypass rule ${rule.id} references unknown path ${occurrence.authorityPathId}`);
      }
      if (!entry.definitionSources.some((source) => source.path === occurrence.sourcePath)) {
        fail(
          `${rule.id}: ${occurrence.sourcePath} is not defined by ${occurrence.authorityPathId}`
        );
      }
      allowedOccurrences.set(occurrence.sourcePath, occurrence.expectedCount);
    }
    for (const item of productionPaths) {
      if (skippedDefinitions.has(item.sourcePath)) continue;
      const bytes = readFileSync(path.join(projectRoot, item.sourcePath), "utf8");
      const count = bytes.split(rule.forbiddenPattern).length - 1;
      const expectedCount = allowedOccurrences.get(item.sourcePath);
      if (count > 0 && expectedCount === undefined) {
        fail(`${rule.id}: forbidden authority bypass in ${item.sourcePath}`);
      }
      if (expectedCount !== undefined && count !== expectedCount) {
        fail(
          `${rule.id}: expected exactly ${expectedCount} reviewed occurrence(s) in ${item.sourcePath}, found ${count}`
        );
      }
      allowedOccurrences.delete(item.sourcePath);
    }
    if (allowedOccurrences.size > 0) {
      fail(
        `${rule.id}: allowed occurrence names non-production source(s): ${[
          ...allowedOccurrences.keys(),
        ].join(", ")}`
      );
    }
  }
}

function validateRuntimeGuardBindings(inventoryEntries) {
  const sourceFileCache = new Map();
  const consumedGuardCalls = new Set();
  for (const entry of inventoryEntries) {
    for (const locator of entry.reads) {
      const binding = entry.runtimeGuardBindings.find(
        (candidate) =>
          candidate.access === "read" && locatorKey(candidate.locator) === locatorKey(locator)
      );
      validateExactRuntimeLocator(entry, binding ?? { access: "read", locator }, sourceFileCache);
    }
    for (const write of entry.writes) {
      const binding = entry.runtimeGuardBindings.find(
        (candidate) =>
          candidate.access === "write" &&
          locatorKey(candidate.locator) === locatorKey(write.locator)
      );
      validateExactRuntimeLocator(
        entry,
        binding ?? { access: "write", locator: write.locator },
        sourceFileCache
      );
    }
    for (const denied of entry.deniedMutations) {
      if (
        entry.runtimeAccess.includes("production") ||
        entry.quarantine.state === "not_quarantined"
      ) {
        fail(`${entry.id} denied mutation must belong to a non-production quarantine`);
      }
      validateExactRuntimeLocator(
        entry,
        { access: "denied", locator: denied.locator },
        sourceFileCache
      );
      validateDeniedMutationClosure(entry, denied, sourceFileCache);
    }
    const expected = [
      ...entry.reads.map((locator) => `read\0${locatorKey(locator)}`),
      ...entry.writes.map((write) => `write\0${locatorKey(write.locator)}`),
    ].sort();
    const actual = entry.runtimeGuardBindings.map(guardBindingKey).sort();
    if (!entry.runtimeAccess.includes("production")) {
      if (actual.length > 0) {
        fail(`${entry.id} is not production reachable but declares production guard bindings`);
      }
      continue;
    }
    if (canonical(actual) !== canonical(expected)) {
      const missing = expected.filter((key) => !actual.includes(key));
      const extra = actual.filter((key) => !expected.includes(key));
      fail(
        `${entry.id} runtime guard binding set is not exact; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`
      );
    }
    for (const binding of entry.runtimeGuardBindings) {
      if (
        binding.guardScope.path !== binding.locator.path ||
        binding.guardScope.selector !== binding.locator.selector
      ) {
        fail(
          `${entry.id} ${binding.access} guard scope must be the exact locator declaration: ${binding.locator.path}::${binding.locator.selector}`
        );
      }
      validateExactRuntimeLocator(entry, binding, sourceFileCache);
      validateGuardScope(entry, binding, sourceFileCache, consumedGuardCalls);
    }
  }
}

function validateDeniedMutationClosure(entry, denied, sourceFileCache) {
  const locator = denied.locator;
  const sourceFile = sourceFileFor(locator.path, sourceFileCache);
  assertCanonicalRuntimeGuardImport(entry, locator.path, sourceFile);
  const declarations = findExecutableDeclarations(sourceFile, locator.selector, false);
  const declaration = declarations[0];
  const body = declaration && executableBody(declaration);
  if (declaration) {
    assertGuardDefaultParametersEffectFree(
      entry,
      {
        mode: "function_prologue",
        path: locator.path,
        selector: locator.selector,
      },
      declaration
    );
  }
  const first = body?.statements[0];
  const second = body?.statements[1];
  const guard = first && directGuardCall(first);
  if (
    declarations.length !== 1 ||
    !body ||
    guard?.id !== entry.id ||
    guard.context !== "inspection" ||
    !second ||
    !ts.isThrowStatement(second)
  ) {
    fail(
      `${entry.id} denied mutation must begin with its direct inspection guard and an unconditional throw: ${locator.path}::${locator.selector}`
    );
  }
}

function validateExactRuntimeLocator(entry, binding, sourceFileCache) {
  const locator = binding.locator;
  const absolute = path.join(projectRoot, locator.path);
  if (!existsSync(absolute)) {
    fail(`${entry.id} ${binding.access} locator references a missing path: ${locator.path}`);
  }
  if (locator.kind === "json_pointer") {
    const document = readJson(absolute, `${entry.id} JSON locator`);
    if (!jsonPointerExists(document, locator.selector)) {
      fail(
        `${entry.id} ${binding.access} JSON pointer does not resolve: ${locator.path}::${locator.selector}`
      );
    }
    return;
  }
  if (["file_region", "yaml_pointer"].includes(locator.kind)) {
    fail(`${entry.id} ${binding.access} uses an unresolved locator kind: ${locator.kind}`);
  }
  if (!locator.path.endsWith(".ts")) {
    fail(`${entry.id} executable locator must name a TypeScript source: ${locator.path}`);
  }
  const sourceFile = sourceFileFor(locator.path, sourceFileCache);
  if (
    binding.guardScope?.mode === "module_constant_prologue" &&
    findTopLevelConstant(sourceFile, locator.selector)
  ) {
    return;
  }
  const declarations = findExecutableDeclarations(sourceFile, locator.selector, true);
  if (declarations.length !== 1) {
    fail(
      `${entry.id} ${binding.access} locator ${locator.path}::${locator.selector} must resolve to exactly one executable declaration, found ${declarations.length}`
    );
  }
}

function jsonPointerExists(document, pointer) {
  if (pointer === "") return true;
  if (!pointer.startsWith("/")) return false;
  let current = document;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = rawToken.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token) || Number(token) >= current.length) return false;
      current = current[Number(token)];
      continue;
    }
    if (!current || typeof current !== "object" || !Object.hasOwn(current, token)) return false;
    current = current[token];
  }
  return true;
}

function validateGuardScope(entry, binding, sourceFileCache, consumedGuardCalls) {
  const scope = binding.guardScope;
  if (scope.mode === "root_guard") {
    if (
      entry.id !== "authority.governance.runtime-guard" ||
      scope.path !== "src/lib/authority-path-runtime.ts" ||
      scope.selector !== "assertAuthorityPathRuntime"
    ) {
      fail(`${entry.id} uses the reserved root_guard outside the runtime guard root`);
    }
    const sourceFile = sourceFileFor(scope.path, sourceFileCache);
    const declarations = findExecutableDeclarations(sourceFile, scope.selector, true);
    if (declarations.length !== 1 || !isExported(declarations[0])) {
      fail(`${entry.id} root guard must bind the one exported runtime guard implementation`);
    }
    if (containsLiteralGuardCall(sourceFile, entry.id, "production")) {
      fail(`${entry.id} root guard cannot certify itself through a circular runtime call`);
    }
    return;
  }

  const sourceFile = sourceFileFor(scope.path, sourceFileCache);
  assertCanonicalRuntimeGuardImport(entry, scope.path, sourceFile);
  if (scope.mode === "module_constant_prologue") {
    const constant = findTopLevelConstant(sourceFile, scope.selector);
    if (!constant) {
      fail(`${entry.id} guard scope cannot find constant ${scope.path}::${scope.selector}`);
    }
    const index = sourceFile.statements.indexOf(constant);
    const guards = [];
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const call = directGuardCall(sourceFile.statements[cursor]);
      if (!call) break;
      guards.push({ call, statement: sourceFile.statements[cursor] });
    }
    const matched = guards.find(
      ({ call }) => call.id === entry.id && call.context === "production"
    );
    if (!matched) {
      fail(
        `${entry.id} ${binding.access} locator ${binding.locator.path}::${binding.locator.selector} lacks an immediate module constant production guard at ${scope.path}::${scope.selector}`
      );
    }
    consumedGuardCalls.add(guardCallKey(scope.path, matched.statement, matched.call));
    return;
  }

  let body;
  let declaration;
  if (scope.mode === "constructor_prologue") {
    const classes = findClassDeclarations(sourceFile, scope.selector);
    if (classes.length !== 1) {
      fail(`${entry.id} guard scope must resolve one class ${scope.path}::${scope.selector}`);
    }
    if (
      classes[0].heritageClauses?.some((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
    ) {
      fail(
        `${entry.id} guarded constructor cannot extend a base class before its guard: ${scope.path}::${scope.selector}`
      );
    }
    assertGuardClassInitializersEffectFree(entry, scope, classes[0]);
    declaration = classes[0].members.find(ts.isConstructorDeclaration);
    body = declaration?.body;
  } else {
    const declarations = findExecutableDeclarations(sourceFile, scope.selector, false);
    if (declarations.length !== 1) {
      fail(
        `${entry.id} guard scope must resolve one function ${scope.path}::${scope.selector}, found ${declarations.length}`
      );
    }
    declaration = declarations[0];
    body = executableBody(declaration);
  }
  if (!declaration || !body) {
    fail(`${entry.id} guard scope has no executable body: ${scope.path}::${scope.selector}`);
  }
  assertGuardDefaultParametersEffectFree(entry, scope, declaration);
  if (locallyShadowsRuntimeGuard(declaration)) {
    fail(
      `${entry.id} guard scope shadows assertAuthorityPathRuntime: ${scope.path}::${scope.selector}`
    );
  }
  const statements = body.statements;
  let cursor = 0;
  const guards = [];
  for (; cursor < statements.length; cursor += 1) {
    const call = directGuardCall(statements[cursor]);
    if (!call) break;
    guards.push({ call, statement: statements[cursor] });
  }
  const matched = guards.find(({ call }) => call.id === entry.id && call.context === "production");
  if (!matched) {
    fail(
      `${entry.id} ${binding.access} locator ${binding.locator.path}::${binding.locator.selector} lacks a direct production guard in the initial ${scope.mode} at ${scope.path}::${scope.selector}`
    );
  }
  consumedGuardCalls.add(guardCallKey(scope.path, matched.statement, matched.call));
}

function assertGuardDefaultParametersEffectFree(entry, scope, declaration) {
  const executable = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  const parameters = executable && "parameters" in executable ? executable.parameters : [];
  for (const parameter of parameters ?? []) {
    if (hasRuntimeDecorators(parameter)) {
      fail(
        `${entry.id} guard scope has a decorated parameter before its guard: ${scope.path}::${scope.selector}`
      );
    }
    if (
      ts.isConstructorDeclaration(executable) &&
      parameter.modifiers?.some((modifier) =>
        [
          ts.SyntaxKind.PublicKeyword,
          ts.SyntaxKind.PrivateKeyword,
          ts.SyntaxKind.ProtectedKeyword,
          ts.SyntaxKind.ReadonlyKeyword,
        ].includes(modifier.kind)
      )
    ) {
      fail(
        `${entry.id} guarded constructor has a parameter property before its guard: ${scope.path}::${scope.selector}`
      );
    }
    const bindingInitializers = [];
    collectBindingInitializers(parameter.name, bindingInitializers);
    if (!ts.isIdentifier(parameter.name) || bindingInitializers.length > 0) {
      fail(
        `${entry.id} guard scope has a destructuring parameter before its guard: ${scope.path}::${scope.selector}`
      );
    }
    if (parameter.initializer && !isPurePreGuardDefault(parameter.initializer)) {
      fail(
        `${entry.id} guard scope has a non-pure default parameter before its guard: ${scope.path}::${scope.selector}`
      );
    }
  }
}

function assertGuardClassInitializersEffectFree(entry, scope, declaration) {
  if (hasRuntimeDecorators(declaration)) {
    fail(
      `${entry.id} guarded class has a decorator before its guard: ${scope.path}::${scope.selector}`
    );
  }
  for (const member of declaration.members) {
    if (hasRuntimeDecorators(member)) {
      fail(
        `${entry.id} guarded class has a decorated member before its guard: ${scope.path}::${scope.selector}`
      );
    }
    if (member.name && ts.isComputedPropertyName(member.name)) {
      fail(
        `${entry.id} guarded class has a computed member name before its guard: ${scope.path}::${scope.selector}`
      );
    }
    if (ts.isClassStaticBlockDeclaration(member)) {
      fail(
        `${entry.id} guarded class has a static block before its guard: ${scope.path}::${scope.selector}`
      );
    }
    if (
      ts.isPropertyDeclaration(member) &&
      member.initializer &&
      !isPurePreGuardDefault(member.initializer)
    ) {
      fail(
        `${entry.id} guarded class has a non-pure field initializer before its guard: ${scope.path}::${scope.selector}`
      );
    }
  }
}

function hasRuntimeDecorators(node) {
  return ts.canHaveDecorators(node) && (ts.getDecorators(node)?.length ?? 0) > 0;
}

function collectBindingInitializers(name, result) {
  if (ts.isIdentifier(name)) return;
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (element.initializer) result.push(element.initializer);
    collectBindingInitializers(element.name, result);
  }
}

// Parameter defaults execute before a function-body guard. This deliberately
// permits only syntax whose evaluation cannot invoke user code; property reads,
// coercive operators, spreads, calls, constructors, and computed names all fail
// closed because getters, proxies, iterators, or conversion hooks can run there.
function isPurePreGuardDefault(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isBigIntLiteral(node) ||
    ts.isRegularExpressionLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isIdentifier(node) ||
    [
      ts.SyntaxKind.TrueKeyword,
      ts.SyntaxKind.FalseKeyword,
      ts.SyntaxKind.NullKeyword,
      ts.SyntaxKind.ThisKeyword,
    ].includes(node.kind)
  ) {
    return true;
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return isPurePreGuardDefault(node.expression);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true;
  if (ts.isTypeOfExpression(node) || ts.isVoidExpression(node)) {
    return isPurePreGuardDefault(node.expression);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.ExclamationToken) {
      return isPurePreGuardDefault(node.operand);
    }
    return (
      [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(node.operator) &&
      (ts.isNumericLiteral(node.operand) || ts.isBigIntLiteral(node.operand))
    );
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every(
      (element) => !ts.isSpreadElement(element) && isPurePreGuardDefault(element)
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every((property) => {
      if (ts.isShorthandPropertyAssignment(property)) {
        return property.objectAssignmentInitializer === undefined;
      }
      return (
        ts.isPropertyAssignment(property) &&
        !ts.isComputedPropertyName(property.name) &&
        isPurePreGuardDefault(property.initializer)
      );
    });
  }
  return false;
}

function guardCallKey(sourcePath, statement, call) {
  return `${sourcePath}\0${statement.pos}\0${call.id}\0${call.context}`;
}

function sourceFileFor(sourcePath, cache) {
  let sourceFile = cache.get(sourcePath);
  if (sourceFile) return sourceFile;
  sourceFile = ts.createSourceFile(
    sourcePath,
    readFileSync(path.join(projectRoot, sourcePath), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  cache.set(sourcePath, sourceFile);
  return sourceFile;
}

function findReviewableDeclarations(sourceFile, selector) {
  const [className, memberName, ...rest] = selector.split(".");
  if (memberName && rest.length === 0) {
    return findClassDeclarations(sourceFile, className).flatMap((declaration) =>
      declaration.members.filter(
        (member) => member.name && member.name.getText(sourceFile) === memberName
      )
    );
  }
  if (memberName) return [];
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === selector
    ) {
      matches.push(statement);
    }
    if (ts.isVariableStatement(statement)) {
      matches.push(
        ...statement.declarationList.declarations.filter(
          (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === selector
        )
      );
    }
  }
  return matches;
}

function findExecutableDeclarations(sourceFile, selector, includeClasses) {
  const [className, memberName, ...rest] = selector.split(".");
  if (memberName && rest.length === 0) {
    return findClassDeclarations(sourceFile, className).flatMap((declaration) =>
      declaration.members.filter(
        (member) =>
          (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member)) &&
          member.name &&
          member.name.getText(sourceFile) === memberName
      )
    );
  }
  if (memberName) return [];
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === selector) {
      matches.push(statement);
    }
    if (includeClasses && ts.isClassDeclaration(statement) && statement.name?.text === selector) {
      matches.push(statement);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === selector &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer) ||
            (includeClasses && ts.isClassExpression(declaration.initializer)))
        ) {
          matches.push(declaration);
        }
      }
    }
  }
  return matches;
}

function findClassDeclarations(sourceFile, selector) {
  return sourceFile.statements.filter(
    (statement) => ts.isClassDeclaration(statement) && statement.name?.text === selector
  );
}

function findTopLevelConstant(sourceFile, selector) {
  const matches = sourceFile.statements.filter(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === selector
      )
  );
  return matches.length === 1 ? matches[0] : null;
}

function executableBody(declaration) {
  if (ts.isVariableDeclaration(declaration)) return declaration.initializer?.body;
  if (ts.isClassDeclaration(declaration)) {
    return declaration.members.find(ts.isConstructorDeclaration)?.body;
  }
  return declaration.body;
}

function directGuardCall(statement) {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
    return null;
  }
  const call = statement.expression;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "assertAuthorityPathRuntime") {
    return null;
  }
  if (
    call.arguments.length !== 2 ||
    !ts.isStringLiteral(call.arguments[0]) ||
    !ts.isStringLiteral(call.arguments[1])
  ) {
    return null;
  }
  return { id: call.arguments[0].text, context: call.arguments[1].text };
}

function assertCanonicalRuntimeGuardImport(entry, sourcePath, sourceFile) {
  const expected = path.resolve(projectRoot, "src/lib/authority-path-runtime.ts");
  const imports = sourceFile.statements.filter(ts.isImportDeclaration).filter((declaration) => {
    if (!ts.isStringLiteral(declaration.moduleSpecifier)) return false;
    const specifier = declaration.moduleSpecifier.text;
    const resolved = path
      .resolve(path.dirname(path.join(projectRoot, sourcePath)), specifier)
      .replace(/\.js$/, ".ts");
    if (resolved !== expected) return false;
    const bindings = declaration.importClause?.namedBindings;
    return (
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) => !element.propertyName && element.name.text === "assertAuthorityPathRuntime"
      )
    );
  });
  if (imports.length !== 1) {
    fail(
      `${entry.id} guard scope ${sourcePath} lacks one canonical unaliased runtime guard import`
    );
  }
}

function locallyShadowsRuntimeGuard(declaration) {
  let shadowed = false;
  const visit = (node) => {
    if (node !== declaration && isNamedDeclaration(node, "assertAuthorityPathRuntime")) {
      shadowed = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  if ("parameters" in declaration) {
    for (const parameter of declaration.parameters ?? []) {
      if (ts.isIdentifier(parameter.name) && parameter.name.text === "assertAuthorityPathRuntime") {
        return true;
      }
    }
  }
  ts.forEachChild(declaration, visit);
  return shadowed;
}

function isNamedDeclaration(node, name) {
  return (
    (ts.isVariableDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isParameter(node)) &&
    node.name &&
    ts.isIdentifier(node.name) &&
    node.name.text === name
  );
}

function isExported(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function containsLiteralGuardCall(node, id, context) {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (ts.isCallExpression(child)) {
      const statement = child.parent;
      const call = ts.isExpressionStatement(statement) ? directGuardCall(statement) : null;
      if (call?.id === id && call.context === context) {
        found = true;
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

function scopeFor(sourcePath, authorityPathIds, inventoryEntries) {
  const matchingRoots = [...rootScopes]
    .filter(([root]) => sourcePath === root || sourcePath.startsWith(`${root}/`))
    .sort(([left], [right]) => right.length - left.length);
  if (matchingRoots.length === 0) {
    fail(`source has no inventory scope: ${sourcePath}`);
  }
  const baseScope = matchingRoots[0][1];
  const classifiedEntries = authorityPathIds.map((id) => inventoryEntries.get(id));
  if (classifiedEntries.some((entry) => entry?.classification === "evaluator_only_logic")) {
    const productionEntries = classifiedEntries.filter((entry) =>
      entry?.runtimeAccess.includes("production")
    );
    if (productionEntries.length > 0) {
      fail(
        `source mixes evaluator-only and production classifications: ${sourcePath} -> ${productionEntries.map((entry) => entry.id).join(", ")}`
      );
    }
    return "evaluation";
  }
  return baseScope;
}

function walk(directory) {
  if (!existsSync(directory)) fail(`authority inventory root does not exist: ${directory}`);
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(projectRoot, absolute).split(path.sep).join("/");
    if (entry.isSymbolicLink()) {
      fail(`symbolic links are forbidden inside authority inventory roots: ${relative}`);
    }
    if (entry.isDirectory()) {
      if (
        policy.ignoredDirectoryNames.includes(entry.name) ||
        policy.ignoredDirectoryPaths.includes(relative)
      ) {
        continue;
      }
      result.push(...walk(absolute));
      continue;
    }
    if (!entry.isFile() || ignoredPaths.has(relative)) continue;
    if (policy.ignoredFileSuffixes.some((suffix) => entry.name.endsWith(suffix))) continue;
    if (!allowedExtensions.has(path.extname(entry.name))) {
      fail(`unclassified file extension inside authority inventory roots: ${relative}`);
    }
    if (!statSync(absolute).isFile()) fail(`authority coverage target is not a file: ${relative}`);
    result.push(relative);
  }
  return result;
}

function digest(domain, value) {
  return createHash("sha256")
    .update("vellum.authority-path-inventory.v1\0")
    .update(domain)
    .update("\0")
    .update(canonical(value))
    .digest("hex");
}

function observationDigest(value) {
  return digest("shadow-observation", value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(",")}}`;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`);
}

function assertExactKeys(value, expected, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonical(actual) !== canonical(wanted)) {
    fail(`${label} keys mismatch: expected ${wanted.join(", ")}; received ${actual.join(", ")}`);
  }
}

function sortedUniqueStrings(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    fail(`${label} must be an array of non-empty strings`);
  }
  const sorted = [...value].sort();
  if (new Set(sorted).size !== sorted.length) fail(`${label} contains duplicates`);
  return sorted;
}

function fail(message) {
  console.error(`Authority-path inventory verification failed: ${message}`);
  process.exit(1);
}
