import { Value } from "@sinclair/typebox/value";

import {
  buildT14AuthorityPathHandoff,
  bundledAuthorityPathInventory,
} from "../../lib/authority-path-inventory.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  AppliedKnowledgeManifestSchema,
  KnowledgeActivationDecisionSchema,
  KnowledgeCatalogSnapshotSchema,
  KnowledgeComponentRegistrySnapshotSchema,
  KnowledgeInventoryOutcomeSchema,
  KnowledgeLibraryInventorySnapshotSchema,
  KnowledgePredicateResultSchema,
  KnowledgeProvisionalConsequenceSchema,
  KnowledgeResolutionContextSchema,
  KnowledgeResolutionPolicySchema,
  KnowledgeResolutionProjectionSchema,
  buildKnowledgeExecutionIdentity,
  buildKnowledgeResolutionRecord,
  knowledgeResolutionRef,
  validateKnowledgeResolutionRecord,
  type AppliedKnowledgeEntry,
  type AppliedKnowledgeManifest,
  type KnowledgeActivationDecision,
  type KnowledgeAuthorityPathOutcome,
  type KnowledgeCatalogSnapshot,
  type KnowledgeComponentRegistryEntry,
  type KnowledgeComponentRegistrySnapshot,
  type KnowledgeExecutionIdentity,
  type KnowledgeInventoryOutcome,
  type KnowledgeLibraryInventorySnapshot,
  type KnowledgePredicateResult,
  type KnowledgeProvisionalConsequence,
  type KnowledgeResolutionContext,
  type KnowledgeResolutionMode,
  type KnowledgeResolutionPolicy,
  type KnowledgeResolutionProjection,
  type KnowledgeResolutionRef,
} from "../../lib/knowledge-resolution-contract.js";
import { referenceSourceDigest } from "../../lib/reference-source-domain.js";
import {
  validateKnowledgePackRelease,
  validateKnowledgePackDraft,
  validateKnowledgeSystemIdentitySnapshot,
  validateKnowledgeTestPolicy,
  validateSystemTestOnlyAttestation,
  validateSystemTestOnlyAttestationStructure,
  type KnowledgeApplicabilityPredicate,
  type KnowledgeComponentBinding,
  type KnowledgeComponentMapping,
  type KnowledgePackRelease,
  type KnowledgeProfile,
  type KnowledgeTestPolicy,
  type SystemTestOnlyAttestation,
} from "../../lib/reviewed-knowledge-contract.js";
import { validateTypedKnowledgeAuthorityVerification } from "../../lib/typed-knowledge-authority-verification.js";
import {
  validateAdvisoryVerification,
  validateScopedReleaseAdvisory,
  type AdvisoryVerification,
  type ScopedReleaseAdvisory,
} from "../../lib/reviewer-authority-contract.js";
import {
  KnowledgePublicationConflictError,
  knowledgePublicationRecordRefForWrite,
  type KnowledgePublicationGenerationRef,
  type KnowledgePublicationRecord,
  type KnowledgePublicationRecordKind,
  type KnowledgePublicationSnapshot,
  type KnowledgePublicationStore,
  type KnowledgePublicationWrite,
} from "./knowledge-publication-store.js";

export type KnowledgeResolutionRequest = Readonly<{
  mode: KnowledgeResolutionMode;
  expectedHead: KnowledgePublicationGenerationRef;
  sourceProfile: "mace-musicks-monument-1676" | null;
  instrumentFamily: "baroque_lute" | null;
  notationSystem: "french_tablature" | null;
  sourceCourseCount: 12 | null;
  historicalSignState: "unresolved" | null;
  passageRef: KnowledgeResolutionRef;
  sourceContextRefs: readonly KnowledgeResolutionRef[];
  analysisRef: KnowledgeResolutionRef;
  arrangementPlanRef: KnowledgeResolutionRef;
  arrangementBriefRef: KnowledgeResolutionRef;
  performanceBriefRef: KnowledgeResolutionRef;
  preservationPolicyRef: KnowledgeResolutionRef;
  instrumentInstanceRef: KnowledgeResolutionRef;
}>;

type ResolutionStore = Pick<KnowledgePublicationStore, "readCurrent" | "publish">;

export type KnowledgeResolutionServiceOptions = Readonly<{
  publicationStore: ResolutionStore;
  now?: () => Date;
}>;

type ReleaseClosure = Readonly<{
  release: KnowledgePackRelease;
  profiles: readonly KnowledgeProfile[];
  predicates: readonly KnowledgeApplicabilityPredicate[];
  componentBindings: readonly KnowledgeComponentBinding[];
  componentMappings: readonly KnowledgeComponentMapping[];
  rightsDecisions: readonly ReturnType<typeof validateTypedKnowledgeAuthorityVerification>[];
  attestations: readonly SystemTestOnlyAttestation[];
  testPolicies: readonly KnowledgeTestPolicy[];
  advisoryRefs: readonly KnowledgeResolutionRef[];
  advisoryVerificationRefs: readonly KnowledgeResolutionRef[];
  retracted: boolean;
  excluded: boolean;
}>;

const fixedRef = (id: string, contract: string): KnowledgeResolutionRef => ({
  id,
  digest: referenceSourceDigest({ id, contract }),
});

export const T14_KNOWLEDGE_RESOLUTION_POLICY =
  buildKnowledgeResolutionRecord<KnowledgeResolutionPolicy>(
    KnowledgeResolutionPolicySchema,
    "knowledge_resolution_policy",
    {
      recordKind: "knowledge_resolution_policy",
      schemaVersion: 1,
      id: "knowledge-resolution-policy.t14.v1",
      policyVersion: 1,
      inventoryBuilderRef: fixedRef(
        "inventory-builder.publication-store-release-enumeration.v1",
        "Enumerate every immutable knowledge_pack_release in the current publication generation"
      ),
      inventoryPolicyRef: fixedRef(
        "inventory-policy.complete-release-enumeration.v1",
        "No release subset or selected-pack view may certify completeness"
      ),
      catalogBuilderRef: fixedRef(
        "catalog-builder.complete-outcome-closure.v1",
        "One typed outcome for every inventoried release"
      ),
      resolverSpecRef: fixedRef(
        "resolver-spec.test-only-provisional-vertical.v1",
        "T14 provisional vertical without T15 production cutover"
      ),
      clockPolicyRef: fixedRef(
        "clock-policy.utc-current-generation.v1",
        "UTC resolution time with retained validity boundaries"
      ),
      trustPolicyRef: fixedRef(
        "trust-policy.test-only-no-human-authority.v1",
        "System test attestations convey no human, historical, or ordinary-default authority"
      ),
      configuredRegistryRefs: [
        fixedRef(
          "knowledge-registry.local-publication-store.v1",
          "Current committed local Knowledge Publication Store generation"
        ),
      ],
      allowedTestUses: ["isolated_evaluation", "provisional_research"],
      ordinaryTestOnlyDisposition: "deny",
      unknownDisposition: "review_required",
    }
  );

/** T14 complete snapshot resolver. T15 alone may cut this over as production authority. */
export class KnowledgeResolutionService {
  private readonly publicationStore: ResolutionStore;
  private readonly now: () => Date;

  constructor(options: KnowledgeResolutionServiceOptions) {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    this.publicationStore = options.publicationStore;
    this.now = options.now ?? (() => new Date());
  }

  resolve(request: KnowledgeResolutionRequest): Readonly<{
    projection: KnowledgeResolutionProjection;
    snapshot: KnowledgePublicationSnapshot;
  }> {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const before = this.publicationStore.readCurrent();
    if (!before) throw new KnowledgeResolutionUnavailableError("No publication generation exists");
    if (!sameGeneration(before, request.expectedHead)) {
      throw new KnowledgePublicationConflictError(
        "Knowledge resolution expected a different publication head",
        before.head,
        null
      );
    }
    const projection = this.buildProjection(before, request);
    const writes = projectionWrites(projection);
    const transactionId = `knowledge-resolution.${projection.manifest.digest}`;
    const snapshot = this.publicationStore.publish({
      schemaVersion: 1,
      transactionId,
      writerKind: "activation",
      expectedHead: publicationGenerationRef(before),
      writes,
    });
    assertPublishedProjection(snapshot, projection, writes);
    return Object.freeze({ projection, snapshot });
  }

  preview(
    request: Omit<KnowledgeResolutionRequest, "expectedHead">
  ): KnowledgeResolutionProjection {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const snapshot = this.publicationStore.readCurrent();
    if (!snapshot)
      throw new KnowledgeResolutionUnavailableError("No publication generation exists");
    return this.buildProjection(snapshot, {
      ...request,
      expectedHead: publicationGenerationRef(snapshot),
    });
  }

  private buildProjection(
    snapshot: KnowledgePublicationSnapshot,
    request: KnowledgeResolutionRequest
  ): KnowledgeResolutionProjection {
    const resolutionTime = this.now().toISOString();
    const context = buildContext(request);
    const closures = rebuildAuthoritativeReleaseClosures(snapshot);
    assertAcyclicReleaseClosure(closures);
    const inventory = buildInventory(snapshot, closures);
    const outcomes = closures.map((closure) => buildOutcome(closure));
    assertCompleteOutcomes(inventory, outcomes);
    const catalog = buildCatalog(inventory, outcomes, resolutionTime);
    const componentRegistry = buildComponentRegistry(closures);
    const predicateResults: KnowledgePredicateResult[] = [];
    const activationDecisions: KnowledgeActivationDecision[] = [];
    const consequences: KnowledgeProvisionalConsequence[] = [];
    const entries: AppliedKnowledgeEntry[] = [];

    for (const closure of closures) {
      const outcome = outcomes.find((candidate) =>
        refsEqual(candidate.releaseRef, closure.release)
      )!;
      for (const profile of closure.profiles) {
        const results = profile.gatingPredicateRefs.map((predicateRef) => {
          const predicate = requireRef(closure.predicates, predicateRef, "applicability predicate");
          const result = buildPredicateResult(predicate, context);
          predicateResults.push(result);
          return result;
        });
        const predicateStatus = aggregatePredicates(results);
        const status = manifestStatus(outcome, predicateStatus);
        const testAttestation = closure.attestations.find((item) => item.kind === "test_only");
        const testPolicy = testAttestation
          ? closure.testPolicies.find((item) => refsEqual(testAttestation.testPolicyRef, item))
          : undefined;
        const mayUseTestAuthority =
          status === "applicable" &&
          Boolean(testAttestation && testPolicy) &&
          request.mode !== "ordinary_default" &&
          testAttestation!.permittedUses.includes(request.mode) &&
          testPolicy!.permittedUses.includes(request.mode);
        const decision = buildActivationDecision({
          closure,
          profile,
          outcome,
          context,
          resolutionTime,
          mayUseTestAuthority,
          testPolicy,
          status,
        });
        activationDecisions.push(decision);
        const profileConsequences = mayUseTestAuthority
          ? buildConsequences(closure, profile, request.mode)
          : [];
        consequences.push(...profileConsequences);
        entries.push({
          releaseRef: knowledgeResolutionRef(closure.release),
          profileRef: knowledgeResolutionRef(profile),
          status,
          predicateResultRefs: results.map(knowledgeResolutionRef),
          consequenceRefs: profileConsequences.map(knowledgeResolutionRef),
          evidenceRefs: closure.rightsDecisions.map(knowledgeResolutionRef),
          conflictRefs: [...outcome.conflictRefs],
          activationDecisionRef: knowledgeResolutionRef(decision),
          rationaleCode: entryRationale(status, request.mode, mayUseTestAuthority),
        });
      }
    }
    assertOneEntryPerProfile(closures, entries, activationDecisions);
    const manifest = buildManifest({
      context,
      inventory,
      catalog,
      componentRegistry,
      outcomes,
      entries,
      activationDecisions,
    });
    const executionIdentity = buildKnowledgeExecutionIdentity({
      inventorySnapshotRef: knowledgeResolutionRef(inventory),
      catalogSnapshotRef: knowledgeResolutionRef(catalog),
      activationDecisionRefs: activationDecisions.map(knowledgeResolutionRef),
      componentRegistrySnapshotRef: knowledgeResolutionRef(componentRegistry),
      resolutionPolicyRef: knowledgeResolutionRef(T14_KNOWLEDGE_RESOLUTION_POLICY),
      appliedKnowledgeManifestRef: knowledgeResolutionRef(manifest),
    });
    return validateKnowledgeResolutionProjection(
      {
        schemaVersion: 1,
        mode: request.mode,
        publicationGenerationRef: publicationGenerationRef(snapshot),
        context,
        policy: T14_KNOWLEDGE_RESOLUTION_POLICY,
        inventory,
        outcomes,
        catalog,
        componentRegistry,
        predicateResults,
        activationDecisions,
        consequences,
        manifest,
        executionIdentity,
        ordinaryActivation: false,
        readinessClaim: false,
      },
      snapshot
    );
  }
}

export function validateKnowledgeResolutionProjection(
  value: unknown,
  authoritativeSnapshot?: KnowledgePublicationSnapshot
): KnowledgeResolutionProjection {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const projection = Value.Decode(KnowledgeResolutionProjectionSchema, value);
  validateKnowledgeResolutionRecord(KnowledgeResolutionContextSchema, projection.context);
  validateKnowledgeResolutionRecord(KnowledgeResolutionPolicySchema, projection.policy);
  validateKnowledgeResolutionRecord(KnowledgeLibraryInventorySnapshotSchema, projection.inventory);
  projection.outcomes.forEach((outcome) =>
    validateKnowledgeResolutionRecord(KnowledgeInventoryOutcomeSchema, outcome)
  );
  validateKnowledgeResolutionRecord(KnowledgeCatalogSnapshotSchema, projection.catalog);
  validateKnowledgeResolutionRecord(
    KnowledgeComponentRegistrySnapshotSchema,
    projection.componentRegistry
  );
  projection.predicateResults.forEach((result) =>
    validateKnowledgeResolutionRecord(KnowledgePredicateResultSchema, result)
  );
  projection.activationDecisions.forEach((decision) =>
    validateKnowledgeResolutionRecord(KnowledgeActivationDecisionSchema, decision)
  );
  projection.consequences.forEach((consequence) =>
    validateKnowledgeResolutionRecord(KnowledgeProvisionalConsequenceSchema, consequence)
  );
  validateKnowledgeResolutionRecord(AppliedKnowledgeManifestSchema, projection.manifest);

  assertCompleteOutcomes(projection.inventory, projection.outcomes);
  if (authoritativeSnapshot) {
    assertRefEqual(
      projection.inventory.authoritativePublicationGenerationRef,
      authoritativeSnapshot.generation,
      "Inventory authoritative publication generation"
    );
    const closures = rebuildAuthoritativeReleaseClosures(authoritativeSnapshot);
    assertExactRefSet(
      projection.inventory.allReleaseRefs,
      closures.map(({ release }) => release),
      "Inventory release enumeration"
    );
    for (const closure of closures) {
      const outcome = projection.outcomes.find(({ releaseRef }) =>
        refsEqual(releaseRef, closure.release)
      );
      if (!outcome) {
        throw new KnowledgeResolutionIntegrityError("Authoritative release lacks an outcome");
      }
      assertExactRefSet(outcome.profileRefs, closure.profiles, "Outcome profile closure");
      assertExactRefSet(
        outcome.componentRefs,
        closure.componentBindings.map(({ componentRef }) => componentRef),
        "Outcome component closure"
      );
      assertExactRefSet(
        outcome.dependencyRefs,
        closure.release.directDependencyRelations.map(({ targetRef }) => targetRef),
        "Outcome dependency closure"
      );
      assertExactRefSet(
        outcome.conflictRefs,
        closure.release.directDependencyRelations
          .filter(({ role }) => role === "conflict_context")
          .map(({ targetRef }) => targetRef),
        "Outcome conflict closure"
      );
      assertExactRefSet(
        outcome.rightsDecisionRefs,
        closure.rightsDecisions,
        "Outcome rights closure"
      );
      assertExactRefSet(
        outcome.attestationRefs,
        closure.attestations,
        "Outcome attestation closure"
      );
      assertExactRefSet(outcome.advisoryRefs, closure.advisoryRefs, "Outcome advisory closure");
      assertExactRefSet(
        outcome.advisoryVerificationRefs,
        closure.advisoryVerificationRefs,
        "Outcome advisory verification closure"
      );
    }
  }
  assertRefEqual(
    projection.catalog.inventorySnapshotRef,
    projection.inventory,
    "Catalog Inventory"
  );
  assertExactRefSet(
    projection.catalog.inventoryOutcomeRefs,
    projection.outcomes,
    "Catalog outcome closure"
  );
  assertExactRefSet(
    projection.catalog.eligibleReleaseRefs,
    projection.outcomes
      .filter(({ state }) => state === "eligible")
      .map(({ releaseRef }) => releaseRef),
    "Catalog eligible-release closure"
  );
  assertExactRefSet(
    projection.catalog.rightsDecisionRefs,
    projection.outcomes.flatMap(({ rightsDecisionRefs }) => rightsDecisionRefs),
    "Catalog rights closure"
  );
  assertExactRefSet(
    projection.catalog.attestationRefs,
    projection.outcomes.flatMap(({ attestationRefs }) => attestationRefs),
    "Catalog attestation closure"
  );
  assertExactRefSet(
    projection.catalog.verificationRefs,
    projection.outcomes.flatMap(({ verificationRefs }) => verificationRefs),
    "Catalog verification closure"
  );
  assertExactRefSet(
    projection.catalog.advisoryRefs,
    projection.outcomes.flatMap(({ advisoryRefs }) => advisoryRefs),
    "Catalog advisory closure"
  );
  assertExactRefSet(
    projection.catalog.advisoryVerificationRefs,
    projection.outcomes.flatMap(({ advisoryVerificationRefs }) => advisoryVerificationRefs),
    "Catalog advisory-verification closure"
  );

  assertAuthorityPathClosure(projection.componentRegistry.authorityPathOutcomes);
  assertUniqueIds(
    projection.componentRegistry.entries.map(({ componentRef }) => componentRef),
    "Component Registry"
  );
  const registeredComponents = new Set(
    projection.componentRegistry.entries.map(({ componentRef }) => refKey(componentRef))
  );
  if (
    projection.outcomes.some(({ componentRefs }) =>
      componentRefs.some((reference) => !registeredComponents.has(refKey(reference)))
    )
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Component Registry omits a component from an inventoried release"
    );
  }

  const manifest = projection.manifest;
  assertRefEqual(manifest.contextRef, projection.context, "Manifest context");
  assertRefEqual(manifest.inventorySnapshotRef, projection.inventory, "Manifest Inventory");
  assertRefEqual(manifest.catalogSnapshotRef, projection.catalog, "Manifest Catalog");
  assertRefEqual(manifest.resolutionPolicyRef, projection.policy, "Manifest Resolution Policy");
  assertRefEqual(
    manifest.componentRegistrySnapshotRef,
    projection.componentRegistry,
    "Manifest Component Registry"
  );
  assertExactRefSet(manifest.releaseOutcomeRefs, projection.outcomes, "Manifest release outcomes");
  assertExactRefSet(
    manifest.dependencyClosureRefs,
    projection.outcomes.flatMap(({ dependencyRefs }) => dependencyRefs),
    "Manifest dependency closure"
  );
  assertExactRefSet(
    manifest.conflictRefs,
    projection.outcomes.flatMap(({ conflictRefs }) => conflictRefs),
    "Manifest conflict closure"
  );
  assertExactRefSet(
    manifest.selectionDecisionRefs,
    projection.activationDecisions,
    "Manifest Activation Decisions"
  );
  assertExactRefSet(
    manifest.authorityPathOutcomeRefs,
    projection.componentRegistry.authorityPathOutcomes.map(
      ({ manifestOutcomeRef }) => manifestOutcomeRef
    ),
    "Manifest Authority Path outcomes"
  );
  assertManifestEntries(projection);

  const exactIdentity = buildKnowledgeExecutionIdentity({
    inventorySnapshotRef: knowledgeResolutionRef(projection.inventory),
    catalogSnapshotRef: knowledgeResolutionRef(projection.catalog),
    activationDecisionRefs: projection.activationDecisions.map(knowledgeResolutionRef),
    componentRegistrySnapshotRef: knowledgeResolutionRef(projection.componentRegistry),
    resolutionPolicyRef: knowledgeResolutionRef(projection.policy),
    appliedKnowledgeManifestRef: knowledgeResolutionRef(projection.manifest),
  });
  if (JSON.stringify(exactIdentity) !== JSON.stringify(projection.executionIdentity)) {
    throw new KnowledgeResolutionIntegrityError(
      "Execution identity is not the exact resolver closure"
    );
  }
  if (
    projection.mode === "ordinary_default" &&
    (projection.consequences.length > 0 ||
      projection.activationDecisions.some(({ result }) => result === "allow"))
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Ordinary Guided Start cannot activate test-only knowledge"
    );
  }
  if (
    projection.consequences.some(
      ({ presentation, readinessClaim }) =>
        presentation !== "provisional_research_only" || readinessClaim
    ) ||
    projection.ordinaryActivation ||
    projection.readinessClaim
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Provisional consequence attempted an authority or readiness claim"
    );
  }
  return Object.freeze(structuredClone(projection));
}

function buildContext(request: KnowledgeResolutionRequest): KnowledgeResolutionContext {
  const { expectedHead: _expectedHead, ...contextRequest } = request;
  const core = {
    recordKind: "knowledge_resolution_context" as const,
    schemaVersion: 1 as const,
    id: `knowledge-resolution-context.${referenceSourceDigest(contextRequest).slice(0, 40)}`,
    mode: request.mode,
    sourceProfile: request.sourceProfile,
    instrumentFamily: request.instrumentFamily,
    notationSystem: request.notationSystem,
    sourceCourseCount: request.sourceCourseCount,
    historicalSignState: request.historicalSignState,
    passageRef: request.passageRef,
    sourceContextRefs: sortRefs(request.sourceContextRefs),
    analysisRef: request.analysisRef,
    arrangementPlanRef: request.arrangementPlanRef,
    arrangementBriefRef: request.arrangementBriefRef,
    performanceBriefRef: request.performanceBriefRef,
    preservationPolicyRef: request.preservationPolicyRef,
    instrumentInstanceRef: request.instrumentInstanceRef,
  };
  return buildKnowledgeResolutionRecord<KnowledgeResolutionContext>(
    KnowledgeResolutionContextSchema,
    "knowledge_resolution_context",
    core
  );
}

function rebuildAuthoritativeReleaseClosures(
  snapshot: KnowledgePublicationSnapshot
): ReleaseClosure[] {
  const releases = snapshot.records
    .filter(({ recordKind }) => recordKind === "knowledge_pack_release")
    .map(({ content }) => validateKnowledgePackRelease(content))
    .sort((a, b) => a.sequence - b.sequence || compareRefs(a, b));
  assertUniqueRefs(releases, "release enumeration");
  const drafts = snapshot.records
    .filter(({ recordKind }) => recordKind === "knowledge_pack_draft")
    .map(({ content }) => validateKnowledgePackDraft(content));
  const systemIdentities = snapshot.records
    .filter(({ recordKind }) => recordKind === "knowledge_system_identity_snapshot")
    .map(({ content }) => validateKnowledgeSystemIdentitySnapshot(content));
  return releases.map((release) => {
    const rightsDecisions = snapshot.records
      .filter(
        ({ recordKind, content }) =>
          recordKind === "authority_verification" &&
          isRecord(content) &&
          content.operation === "pack_citation"
      )
      .map(({ content }) => validateTypedKnowledgeAuthorityVerification(content))
      .filter((item) => refsEqual(item.releaseRef, release));
    const attestationStructures = snapshot.records
      .filter(
        ({ recordKind, content }) =>
          recordKind === "release_attestation" && isRecord(content) && content.kind === "test_only"
      )
      .map(({ content }) => validateSystemTestOnlyAttestationStructure(content))
      .filter((item) => refsEqual(item.releaseRef, release));
    const testPolicies = snapshot.records
      .filter(({ recordKind }) => recordKind === "knowledge_test_policy")
      .map(({ content }) => validateKnowledgeTestPolicy(content));
    const attestations = attestationStructures.map((attestation) => {
      const testPolicy = requireRef(testPolicies, attestation.testPolicyRef, "test policy");
      const systemIdentity = requireRef(
        systemIdentities,
        attestation.issuer.systemRef,
        "system identity"
      );
      const releaseGraphContext = graphContextForRelease(release, drafts, releases);
      return validateSystemTestOnlyAttestation(attestation, {
        release,
        releaseGraphContext,
        systemIdentity,
        testPolicy,
        expectedIssuedAt: attestation.issuedAt,
      });
    });
    const advisories: ScopedReleaseAdvisory[] = snapshot.records
      .filter(({ recordKind }) => recordKind === "release_advisory")
      .map(({ content }) => validateScopedReleaseAdvisory(content))
      .filter(({ subjectRef }) => refsEqual(subjectRef, release));
    const advisoryVerifications: AdvisoryVerification[] = snapshot.records
      .filter(({ recordKind }) => recordKind === "advisory_verification")
      .map(({ content }) => validateAdvisoryVerification(content))
      .filter(({ subjectRecordRef }) =>
        advisories.some((advisory) => refsEqual(subjectRecordRef, advisory))
      );
    const verifiedAdvisoryIds = new Set(
      advisoryVerifications
        .filter(({ result }) => result === "verified_authorized")
        .map(({ subjectRecordRef }) => refKey(subjectRecordRef))
    );
    const verifiedAdvisories = advisories.filter((advisory) =>
      verifiedAdvisoryIds.has(refKey(advisory))
    );
    return Object.freeze({
      release,
      profiles: release.profiles,
      predicates: release.applicabilityPredicates,
      componentBindings: release.componentClosure,
      componentMappings: release.componentMappings,
      rightsDecisions,
      attestations,
      testPolicies,
      advisoryRefs: advisories.map(knowledgeResolutionRef),
      advisoryVerificationRefs: advisoryVerifications.map(knowledgeResolutionRef),
      retracted: verifiedAdvisories.some(({ kind }) => kind === "retracted"),
      excluded: verifiedAdvisories.some(({ kind }) =>
        ["superseded", "attestation_revoked", "rights_restricted"].includes(kind)
      ),
    });
  });
}

function graphContextForRelease(
  release: KnowledgePackRelease,
  drafts: readonly ReturnType<typeof validateKnowledgePackDraft>[],
  releases: readonly KnowledgePackRelease[]
) {
  const dependencyRefs = release.dependencyClosure.map(({ releaseRef }) => releaseRef);
  const dependencyReleases = releases.filter((candidate) =>
    dependencyRefs.some((reference) => refsEqual(reference, candidate))
  );
  if (dependencyReleases.length !== dependencyRefs.length) {
    throw new KnowledgeResolutionIntegrityError(
      "Release dependency closure is unavailable from the authoritative publication generation"
    );
  }
  const requiredDraftRefs = [
    release.sourceDraftRef,
    ...dependencyReleases.map(({ sourceDraftRef }) => sourceDraftRef),
  ];
  const dependencyDrafts = drafts.filter((draft) =>
    requiredDraftRefs.some((reference) => refsEqual(reference, draft))
  );
  if (dependencyDrafts.length !== requiredDraftRefs.length) {
    throw new KnowledgeResolutionIntegrityError(
      "Release source-draft closure is unavailable from the authoritative publication generation"
    );
  }
  return {
    schemaVersion: 1 as const,
    drafts: dependencyDrafts,
    releases: dependencyReleases,
  };
}

function buildInventory(
  snapshot: KnowledgePublicationSnapshot,
  closures: readonly ReleaseClosure[]
): KnowledgeLibraryInventorySnapshot {
  return buildKnowledgeResolutionRecord<KnowledgeLibraryInventorySnapshot>(
    KnowledgeLibraryInventorySnapshotSchema,
    "knowledge_library_inventory_snapshot",
    {
      recordKind: "knowledge_library_inventory_snapshot",
      schemaVersion: 1,
      id: `knowledge-library-inventory.${snapshot.generation.digest}`,
      configuredRegistryRefs: T14_KNOWLEDGE_RESOLUTION_POLICY.configuredRegistryRefs,
      allReleaseRefs: closures.map(({ release }) => knowledgeResolutionRef(release)),
      inventoryBuilderRef: T14_KNOWLEDGE_RESOLUTION_POLICY.inventoryBuilderRef,
      inventoryPolicyRef: T14_KNOWLEDGE_RESOLUTION_POLICY.inventoryPolicyRef,
      authoritativePublicationGenerationRef: generationRef(snapshot),
    }
  );
}

function buildOutcome(closure: ReleaseClosure): KnowledgeInventoryOutcome {
  const state = closure.retracted
    ? "retracted"
    : closure.excluded
      ? "excluded"
      : closure.rightsDecisions.length === 0
        ? "unavailable_source"
        : closure.attestations.length === 0
          ? "unknown"
          : closure.release.directDependencyRelations.some(
                ({ role }) => role === "conflict_context"
              )
            ? "conflicting"
            : "eligible";
  const exclusionReasonCodes =
    state === "eligible"
      ? []
      : state === "retracted"
        ? ["verified_retraction"]
        : state === "excluded"
          ? ["verified_release_exclusion"]
          : state === "unavailable_source"
            ? ["rights_decision_unavailable"]
            : state === "conflicting"
              ? ["unresolved_release_conflict"]
              : ["attestation_closure_unknown"];
  return buildKnowledgeResolutionRecord<KnowledgeInventoryOutcome>(
    KnowledgeInventoryOutcomeSchema,
    "knowledge_inventory_outcome",
    {
      recordKind: "knowledge_inventory_outcome",
      schemaVersion: 1,
      id: `knowledge-inventory-outcome.${closure.release.digest}`,
      releaseRef: knowledgeResolutionRef(closure.release),
      state,
      profileRefs: closure.profiles.map(knowledgeResolutionRef),
      componentRefs: closure.componentBindings.map(({ componentRef }) => componentRef),
      dependencyRefs: closure.release.directDependencyRelations.map(({ targetRef }) => targetRef),
      conflictRefs: closure.release.directDependencyRelations
        .filter(({ role }) => role === "conflict_context")
        .map(({ targetRef }) => targetRef),
      exclusionReasonCodes,
      rightsDecisionRefs: closure.rightsDecisions.map(knowledgeResolutionRef),
      attestationRefs: closure.attestations.map(knowledgeResolutionRef),
      verificationRefs: [],
      advisoryRefs: [...closure.advisoryRefs],
      advisoryVerificationRefs: [...closure.advisoryVerificationRefs],
    }
  );
}

function buildCatalog(
  inventory: KnowledgeLibraryInventorySnapshot,
  outcomes: readonly KnowledgeInventoryOutcome[],
  resolutionTime: string
): KnowledgeCatalogSnapshot {
  const eligible = outcomes.filter(({ state }) => state === "eligible");
  return buildKnowledgeResolutionRecord<KnowledgeCatalogSnapshot>(
    KnowledgeCatalogSnapshotSchema,
    "knowledge_catalog_snapshot",
    {
      recordKind: "knowledge_catalog_snapshot",
      schemaVersion: 1,
      id: `knowledge-catalog.${referenceSourceDigest({ inventory, outcomes, resolutionTime }).slice(0, 48)}`,
      inventorySnapshotRef: knowledgeResolutionRef(inventory),
      resolutionTime,
      clockPolicyRef: T14_KNOWLEDGE_RESOLUTION_POLICY.clockPolicyRef,
      eligibleReleaseRefs: eligible.map(({ releaseRef }) => releaseRef),
      inventoryOutcomeRefs: outcomes.map(knowledgeResolutionRef),
      attestationRefs: sortRefs(outcomes.flatMap(({ attestationRefs }) => attestationRefs)),
      verificationRefs: sortRefs(outcomes.flatMap(({ verificationRefs }) => verificationRefs)),
      advisoryRefs: sortRefs(outcomes.flatMap(({ advisoryRefs }) => advisoryRefs)),
      advisoryVerificationRefs: sortRefs(
        outcomes.flatMap(({ advisoryVerificationRefs }) => advisoryVerificationRefs)
      ),
      rightsDecisionRefs: sortRefs(
        outcomes.flatMap(({ rightsDecisionRefs }) => rightsDecisionRefs)
      ),
      trustPolicyRef: T14_KNOWLEDGE_RESOLUTION_POLICY.trustPolicyRef,
      catalogBuilderRef: T14_KNOWLEDGE_RESOLUTION_POLICY.catalogBuilderRef,
    }
  );
}

function buildComponentRegistry(
  closures: readonly ReleaseClosure[]
): KnowledgeComponentRegistrySnapshot {
  const handoff = buildT14AuthorityPathHandoff();
  const grouped = new Map<string, typeof handoff.entries>();
  for (const item of handoff.entries) {
    if (!item.futureComponentId) continue;
    const list = grouped.get(item.futureComponentId) ?? [];
    list.push(item);
    grouped.set(item.futureComponentId, list);
  }
  const entriesById = new Map<string, KnowledgeComponentRegistryEntry>(
    [...grouped]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, paths]) => [
        id,
        genericComponentEntry(
          id,
          paths.map(({ inventoryPathId }) => inventoryPathId)
        ),
      ])
  );
  for (const closure of closures) {
    for (const binding of closure.componentBindings) {
      const prior = entriesById.get(binding.componentRef.id);
      entriesById.set(binding.componentRef.id, {
        componentRef: binding.componentRef,
        artifactRef: binding.artifactRef,
        interfaceRef: binding.interfaceRef,
        parameterSchemaRef: binding.parameterSchemaRef,
        unitSchemaRef: binding.unitSchemaRef,
        compatibilityRef: binding.compatibility.contractRef,
        resourcePolicyRef: binding.resourcePolicyRef,
        replayState: binding.replay.state,
        authorityPathIds: [
          ...(prior?.authorityPathIds ?? []),
          "authority.parameter.diapason-selection-defaults",
        ]
          .filter((value, index, values) => values.indexOf(value) === index)
          .sort(),
      });
    }
  }
  const pathOutcomes = handoff.entries.map((item) => {
    const disposition: KnowledgeAuthorityPathOutcome["disposition"] =
      item.classification === "forbidden_unregistered_bypass" ||
      bundledAuthorityPathInventory.entries.find(({ id }) => id === item.inventoryPathId)!
        .quarantine.state === "quarantined"
        ? "disabled"
        : item.mechanicality === "mechanical"
          ? "mechanical_model"
          : item.classification === "evaluator_only_logic"
            ? "evaluator_only"
            : item.futureBindingStatus === "not_applicable"
              ? "not_applicable"
              : "registered_component";
    const componentRef =
      disposition === "registered_component" && item.futureComponentId
        ? fixedRef(item.futureComponentId, `Authority Path ${item.inventoryPathId}`)
        : null;
    const outcomeCore = {
      inventoryPathId: item.inventoryPathId,
      pathDigest: item.pathDigest,
      disposition,
      componentRef,
      reasonCodes: [
        disposition === "disabled"
          ? "quarantined_or_forbidden"
          : disposition === "mechanical_model"
            ? "instrument_model_authority"
            : disposition === "evaluator_only"
              ? "evaluation_context_only"
              : disposition === "not_applicable"
                ? "governance_metadata_no_component"
                : "registered_exact_component",
      ],
    };
    return {
      ...outcomeCore,
      manifestOutcomeRef: fixedRef(
        `authority-path-outcome.${item.inventoryPathId}`,
        JSON.stringify(outcomeCore)
      ),
    };
  });
  assertAuthorityPathClosure(pathOutcomes);
  return buildKnowledgeResolutionRecord<KnowledgeComponentRegistrySnapshot>(
    KnowledgeComponentRegistrySnapshotSchema,
    "knowledge_component_registry_snapshot",
    {
      recordKind: "knowledge_component_registry_snapshot",
      schemaVersion: 1,
      id: `knowledge-component-registry.${bundledAuthorityPathInventory.digest}`,
      authorityPathInventoryRef: {
        id: bundledAuthorityPathInventory.inventoryId,
        digest: bundledAuthorityPathInventory.digest,
      },
      entries: [...entriesById.values()].sort((a, b) =>
        compareRefs(a.componentRef, b.componentRef)
      ),
      authorityPathOutcomes: pathOutcomes,
    }
  );
}

function buildPredicateResult(
  predicate: KnowledgeApplicabilityPredicate,
  context: KnowledgeResolutionContext
): KnowledgePredicateResult {
  let result: KnowledgePredicateResult["result"] = "unknown";
  let rationaleCode = "required_context_unknown";
  if (predicate.expression.kind === "mace_twelve_course_notation_scope") {
    const fields = [
      context.sourceProfile,
      context.instrumentFamily,
      context.notationSystem,
      context.sourceCourseCount,
    ];
    if (fields.every((value) => value !== null)) {
      result =
        context.sourceProfile === predicate.expression.sourceProfile &&
        context.instrumentFamily === predicate.expression.instrumentFamily &&
        context.notationSystem === predicate.expression.notationSystem &&
        context.sourceCourseCount === predicate.expression.sourceCourseCount
          ? "true"
          : "false";
      rationaleCode = result === "true" ? "exact_scope_match" : "exact_scope_mismatch";
    }
  } else {
    const fields = [context.instrumentFamily, context.notationSystem, context.historicalSignState];
    if (fields.every((value) => value !== null)) {
      result =
        context.instrumentFamily === predicate.expression.instrumentFamily &&
        context.notationSystem === predicate.expression.notationSystem &&
        context.historicalSignState === predicate.expression.historicalSignState
          ? "true"
          : "false";
      rationaleCode = result === "true" ? "exact_research_scope_match" : "exact_scope_mismatch";
    }
  }
  return buildKnowledgeResolutionRecord<KnowledgePredicateResult>(
    KnowledgePredicateResultSchema,
    "knowledge_predicate_result",
    {
      recordKind: "knowledge_predicate_result",
      schemaVersion: 1,
      id: `knowledge-predicate-result.${predicate.digest}.${context.digest}`,
      predicateRef: knowledgeResolutionRef(predicate),
      evaluatedContextRef: knowledgeResolutionRef(context),
      evaluatorComponentRef: fixedRef(
        "component.knowledge-applicability-evaluator.v1",
        "Exact T14 retained predicate evaluator"
      ),
      result,
      evidenceRefs: [],
      rationaleCode,
    }
  );
}

function buildActivationDecision(input: {
  closure: ReleaseClosure;
  profile: KnowledgeProfile;
  outcome: KnowledgeInventoryOutcome;
  context: KnowledgeResolutionContext;
  resolutionTime: string;
  mayUseTestAuthority: boolean;
  testPolicy: KnowledgeTestPolicy | undefined;
  status: AppliedKnowledgeEntry["status"];
}): KnowledgeActivationDecision {
  const base = {
    recordKind: "activation_decision" as const,
    schemaVersion: 1 as const,
    id: `activation-decision.${input.profile.digest}.${input.context.digest}`,
    releaseRef: knowledgeResolutionRef(input.closure.release),
    profileRef: knowledgeResolutionRef(input.profile),
    attestationRefs: input.outcome.attestationRefs,
    verificationRefs: input.outcome.verificationRefs,
    rightsDecisionRefs: input.outcome.rightsDecisionRefs,
    applicableAdvisoryRefs: input.outcome.advisoryRefs,
    advisoryVerificationRefs: input.outcome.advisoryVerificationRefs,
    requestedScopeRef: knowledgeResolutionRef(input.context),
    resolutionPolicyRef: knowledgeResolutionRef(T14_KNOWLEDGE_RESOLUTION_POLICY),
    resolutionTime: input.resolutionTime,
    clockPolicyRef: T14_KNOWLEDGE_RESOLUTION_POLICY.clockPolicyRef,
  };
  if (input.mayUseTestAuthority && input.testPolicy) {
    return buildKnowledgeResolutionRecord<
      Extract<KnowledgeActivationDecision, { result: "allow" }>
    >(KnowledgeActivationDecisionSchema, "activation_decision", {
      ...base,
      result: "allow",
      authority: {
        kind: "test_only",
        testPolicyRef: knowledgeResolutionRef(input.testPolicy),
        permittedUse: input.context.mode as "isolated_evaluation" | "provisional_research",
      },
      rationaleCode: "test_only_exact_provisional_scope",
    });
  }
  const result =
    input.status === "unknown" || input.status === "conflicting" ? "review_required" : "deny";
  return buildKnowledgeResolutionRecord<KnowledgeActivationDecision>(
    KnowledgeActivationDecisionSchema,
    "activation_decision",
    {
      ...base,
      result,
      rationaleCode:
        input.context.mode === "ordinary_default"
          ? "test_only_forbidden_for_ordinary_default"
          : `manifest_${input.status}`,
    }
  );
}

function buildConsequences(
  closure: ReleaseClosure,
  profile: KnowledgeProfile,
  mode: Exclude<KnowledgeResolutionMode, "ordinary_default">
): KnowledgeProvisionalConsequence[] {
  const mapping = closure.componentMappings.find(
    (candidate) => candidate.parameters.values.course13Policy === "unresolved_no_mapping"
  );
  if (!mapping) return [];
  const values = mapping.parameters.values.courseMappings;
  if (
    JSON.stringify(values) !==
    JSON.stringify([
      { course: 7, sign: "a" },
      { course: 8, sign: "/a" },
      { course: 9, sign: "//a" },
      { course: 10, sign: "///a" },
      { course: 11, sign: "4" },
      { course: 12, sign: "5" },
    ])
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Mace mapping does not match its exact cited closure"
    );
  }
  return [
    buildKnowledgeResolutionRecord<KnowledgeProvisionalConsequence>(
      KnowledgeProvisionalConsequenceSchema,
      "knowledge_provisional_consequence",
      {
        recordKind: "knowledge_provisional_consequence",
        schemaVersion: 1,
        id: `knowledge-provisional-consequence.${profile.digest}.${mode}`,
        releaseRef: knowledgeResolutionRef(closure.release),
        profileRef: knowledgeResolutionRef(profile),
        componentRef: mapping.componentBindingRef,
        kind: "mace_diapason_course_signs",
        courseMappings: values,
        course13Disposition: "unresolved_no_mapping",
        presentation: "provisional_research_only",
        readinessClaim: false,
      }
    ),
  ];
}

function buildManifest(input: {
  context: KnowledgeResolutionContext;
  inventory: KnowledgeLibraryInventorySnapshot;
  catalog: KnowledgeCatalogSnapshot;
  componentRegistry: KnowledgeComponentRegistrySnapshot;
  outcomes: readonly KnowledgeInventoryOutcome[];
  entries: readonly AppliedKnowledgeEntry[];
  activationDecisions: readonly KnowledgeActivationDecision[];
}): AppliedKnowledgeManifest {
  const pathOutcomeRefs = input.componentRegistry.authorityPathOutcomes.map(
    ({ manifestOutcomeRef }) => manifestOutcomeRef
  );
  return buildKnowledgeResolutionRecord<AppliedKnowledgeManifest>(
    AppliedKnowledgeManifestSchema,
    "applied_knowledge_manifest",
    {
      recordKind: "applied_knowledge_manifest",
      schemaVersion: 1,
      id: `applied-knowledge-manifest.${referenceSourceDigest(input).slice(0, 48)}`,
      contextRef: knowledgeResolutionRef(input.context),
      inventorySnapshotRef: knowledgeResolutionRef(input.inventory),
      catalogSnapshotRef: knowledgeResolutionRef(input.catalog),
      resolverSpecRef: T14_KNOWLEDGE_RESOLUTION_POLICY.resolverSpecRef,
      resolutionPolicyRef: knowledgeResolutionRef(T14_KNOWLEDGE_RESOLUTION_POLICY),
      componentRegistrySnapshotRef: knowledgeResolutionRef(input.componentRegistry),
      dependencyClosureRefs: sortRefs(
        input.outcomes.flatMap(({ dependencyRefs }) => dependencyRefs)
      ),
      releaseOutcomeRefs: input.outcomes.map(knowledgeResolutionRef),
      entries: [...input.entries],
      conflictRefs: sortRefs(input.outcomes.flatMap(({ conflictRefs }) => conflictRefs)),
      selectionDecisionRefs: input.activationDecisions.map(knowledgeResolutionRef),
      compiledConstraintRefs: [],
      authorityPathOutcomeRefs: pathOutcomeRefs,
      completeness: "complete",
    }
  );
}

function projectionWrites(projection: KnowledgeResolutionProjection): KnowledgePublicationWrite[] {
  const content = [
    projection.context,
    projection.policy,
    ...projection.outcomes,
    projection.inventory,
    projection.catalog,
    ...projection.predicateResults,
    ...projection.activationDecisions,
    projection.componentRegistry,
    ...projection.consequences,
    projection.manifest,
  ];
  return content.map((item) => ({
    recordKind: item.recordKind as KnowledgePublicationRecordKind,
    id: `published.${item.recordKind}.${item.digest}`,
    successorRefs: [],
    content: item,
  }));
}

function assertPublishedProjection(
  snapshot: KnowledgePublicationSnapshot,
  projection: KnowledgeResolutionProjection,
  writes: readonly KnowledgePublicationWrite[]
): void {
  const expected = writes.map(knowledgePublicationRecordRefForWrite).sort(comparePublicationRefs);
  const actual = snapshot.generation.newRecordRefs.slice().sort(comparePublicationRefs);
  const expectedKeys = expected.map(
    ({ recordKind, id, digest }) => `${recordKind}:${id}:${digest}`
  );
  const actualKeys = actual.map(({ recordKind, id, digest }) => `${recordKind}:${id}:${digest}`);
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    throw new KnowledgeResolutionIntegrityError(
      `Resolution generation omitted or added records: expected ${JSON.stringify(expectedKeys)}, received ${JSON.stringify(actualKeys)}`
    );
  }
  const manifest = snapshot.records.find(
    ({ recordKind, content }) =>
      recordKind === "applied_knowledge_manifest" &&
      isRecord(content) &&
      content.digest === projection.manifest.digest
  );
  if (!manifest) throw new KnowledgeResolutionIntegrityError("Published manifest is unavailable");
}

function assertCompleteOutcomes(
  inventory: KnowledgeLibraryInventorySnapshot,
  outcomes: readonly KnowledgeInventoryOutcome[]
): void {
  const releases = inventory.allReleaseRefs.map(refKey).sort();
  const covered = outcomes.map(({ releaseRef }) => refKey(releaseRef)).sort();
  if (
    new Set(covered).size !== covered.length ||
    JSON.stringify(releases) !== JSON.stringify(covered)
  ) {
    throw new KnowledgeResolutionIntegrityError("Catalog outcomes do not cover exact inventory");
  }
}

function assertOneEntryPerProfile(
  closures: readonly ReleaseClosure[],
  entries: readonly AppliedKnowledgeEntry[],
  decisions: readonly KnowledgeActivationDecision[]
): void {
  const profiles = closures
    .flatMap(({ profiles }) => profiles.map((profile) => refKey(profile)))
    .sort();
  const covered = entries.map(({ profileRef }) => refKey(profileRef)).sort();
  if (
    new Set(covered).size !== covered.length ||
    JSON.stringify(profiles) !== JSON.stringify(covered)
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Manifest does not contain every reachable profile"
    );
  }
  const decisionRefs = new Set(decisions.map((decision) => refKey(decision)));
  if (
    entries.some(({ activationDecisionRef }) => !decisionRefs.has(refKey(activationDecisionRef)))
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Manifest entry lacks an exact Activation Decision"
    );
  }
}

function assertManifestEntries(projection: KnowledgeResolutionProjection): void {
  const expectedProfiles = projection.outcomes.flatMap((outcome) =>
    outcome.profileRefs.map((profileRef) => ({ releaseRef: outcome.releaseRef, profileRef }))
  );
  const actual = projection.manifest.entries.map(({ releaseRef, profileRef }) => ({
    releaseRef,
    profileRef,
  }));
  const pairKey = ({ releaseRef, profileRef }: (typeof expectedProfiles)[number]) =>
    `${refKey(releaseRef)}\0${refKey(profileRef)}`;
  const expectedKeys = expectedProfiles.map(pairKey).sort();
  const actualKeys = actual.map(pairKey).sort();
  if (
    new Set(actualKeys).size !== actualKeys.length ||
    JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)
  ) {
    throw new KnowledgeResolutionIntegrityError(
      "Manifest entries do not cover every release/profile pair"
    );
  }
  const decisions = new Map(
    projection.activationDecisions.map((decision) => [refKey(decision), decision])
  );
  const predicates = new Set(projection.predicateResults.map(refKey));
  const consequences = new Set(projection.consequences.map(refKey));
  for (const entry of projection.manifest.entries) {
    const decision = decisions.get(refKey(entry.activationDecisionRef));
    if (
      !decision ||
      !refsEqual(decision.releaseRef, entry.releaseRef) ||
      !refsEqual(decision.profileRef, entry.profileRef)
    ) {
      throw new KnowledgeResolutionIntegrityError(
        "Manifest entry does not bind its exact Activation Decision"
      );
    }
    if (entry.predicateResultRefs.some((reference) => !predicates.has(refKey(reference)))) {
      throw new KnowledgeResolutionIntegrityError(
        "Manifest entry omits a retained predicate result"
      );
    }
    if (entry.consequenceRefs.some((reference) => !consequences.has(refKey(reference)))) {
      throw new KnowledgeResolutionIntegrityError(
        "Manifest entry references an absent consequence"
      );
    }
    if (entry.consequenceRefs.length > 0 && decision.result !== "allow") {
      throw new KnowledgeResolutionIntegrityError(
        "Manifest consequence lacks an allowing Activation Decision"
      );
    }
  }
  assertExactRefSet(
    projection.manifest.entries.flatMap(({ consequenceRefs }) => consequenceRefs),
    projection.consequences,
    "Manifest consequence closure"
  );
}

function assertAuthorityPathClosure(
  outcomes: readonly { inventoryPathId: string; manifestOutcomeRef: KnowledgeResolutionRef }[]
): void {
  const expected = bundledAuthorityPathInventory.entries.map(({ id }) => id).sort();
  const actual = outcomes.map(({ inventoryPathId }) => inventoryPathId).sort();
  if (
    new Set(actual).size !== actual.length ||
    JSON.stringify(expected) !== JSON.stringify(actual)
  ) {
    throw new KnowledgeResolutionIntegrityError("Component Registry omits an Authority Path");
  }
}

function assertAcyclicReleaseClosure(closures: readonly ReleaseClosure[]): void {
  const releases = new Map(closures.map(({ release }) => [refKey(release), release]));
  for (const { release } of closures) {
    for (const { targetRef } of release.directDependencyRelations) {
      const dependency = releases.get(refKey(targetRef));
      if (!dependency || dependency.sequence >= release.sequence) {
        throw new KnowledgeResolutionIntegrityError(
          "Release dependency closure is missing or cyclic"
        );
      }
    }
  }
}

function genericComponentEntry(id: string, pathIds: string[]): KnowledgeComponentRegistryEntry {
  return {
    componentRef: fixedRef(id, `Registered component ${id}`),
    artifactRef: fixedRef(`artifact.${id}`, `Pinned artifact for ${id}`),
    interfaceRef: fixedRef(`interface.${id}`, `Pinned interface for ${id}`),
    parameterSchemaRef: fixedRef(`parameter-schema.${id}`, `Pinned parameters for ${id}`),
    unitSchemaRef: fixedRef(`unit-schema.${id}`, `Pinned units for ${id}`),
    compatibilityRef: fixedRef(`compatibility.${id}`, `Exact compatibility for ${id}`),
    resourcePolicyRef: fixedRef(`resource-policy.${id}`, `Pinned resource policy for ${id}`),
    replayState: "inspection_only",
    authorityPathIds: [...pathIds].sort(),
  };
}

function manifestStatus(
  outcome: KnowledgeInventoryOutcome,
  predicates: "true" | "false" | "unknown" | "error"
): AppliedKnowledgeEntry["status"] {
  if (outcome.state === "conflicting") return "conflicting";
  if (outcome.state === "retracted") return "retracted";
  if (outcome.state === "unavailable_source") return "unavailable_source";
  if (outcome.state === "excluded") return "excluded";
  if (outcome.state !== "eligible") return "unknown";
  if (predicates === "true") return "applicable";
  if (predicates === "false") return "inapplicable";
  return "unknown";
}

function aggregatePredicates(
  values: readonly KnowledgePredicateResult[]
): "true" | "false" | "unknown" | "error" {
  if (values.some(({ result }) => result === "error")) return "error";
  if (values.some(({ result }) => result === "false")) return "false";
  if (values.some(({ result }) => result === "unknown")) return "unknown";
  return "true";
}

function entryRationale(
  status: AppliedKnowledgeEntry["status"],
  mode: KnowledgeResolutionMode,
  allowed: boolean
): string {
  if (allowed) return `${mode}_test_only_consequence`;
  if (mode === "ordinary_default") return "ordinary_default_denies_test_only";
  return `manifest_${status}`;
}

function requireRef<T extends { id: string; digest: string }>(
  values: readonly T[],
  reference: KnowledgeResolutionRef,
  label: string
): T {
  const result = values.find((value) => refsEqual(value, reference));
  if (!result) throw new KnowledgeResolutionIntegrityError(`Missing ${label} ${reference.id}`);
  return result;
}

function generationRef(snapshot: KnowledgePublicationSnapshot) {
  return { id: snapshot.generation.id, digest: snapshot.generation.digest };
}

function publicationGenerationRef(
  snapshot: KnowledgePublicationSnapshot
): KnowledgePublicationGenerationRef {
  return {
    id: snapshot.generation.id,
    digest: snapshot.generation.digest,
    revision: snapshot.generation.revision,
  };
}

function sameGeneration(
  snapshot: KnowledgePublicationSnapshot,
  expected: KnowledgePublicationGenerationRef
): boolean {
  return (
    snapshot.head.generationId === expected.id &&
    snapshot.head.digest === expected.digest &&
    snapshot.head.revision === expected.revision
  );
}

function recordContentRef(record: KnowledgePublicationRecord): KnowledgeResolutionRef {
  if (
    !isRecord(record.content) ||
    typeof record.content.id !== "string" ||
    typeof record.content.digest !== "string"
  ) {
    throw new KnowledgeResolutionIntegrityError("Publication content lacks a digested identity");
  }
  return { id: record.content.id, digest: record.content.digest };
}

function refsEqual(left: unknown, right: unknown): boolean {
  return isRecord(left) && isRecord(right) && left.id === right.id && left.digest === right.digest;
}

function refKey(value: { id: string; digest: string }): string {
  return `${value.id}\0${value.digest}`;
}

function sortRefs<T extends KnowledgeResolutionRef>(values: readonly T[]): T[] {
  const sorted = [...values].sort(compareRefs);
  assertUniqueRefs(sorted, "reference closure");
  return sorted;
}

function compareRefs(
  left: { id: string; digest: string },
  right: { id: string; digest: string }
): number {
  return refKey(left).localeCompare(refKey(right));
}

function comparePublicationRefs(
  left: { recordKind: string; id: string; digest: string },
  right: { recordKind: string; id: string; digest: string }
): number {
  return `${left.recordKind}\0${refKey(left)}`.localeCompare(
    `${right.recordKind}\0${refKey(right)}`
  );
}

function assertUniqueRefs(values: readonly { id: string; digest: string }[], label: string): void {
  const keys = values.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new KnowledgeResolutionIntegrityError(`${label} contains duplicate refs`);
  }
}

function assertUniqueIds(values: readonly { id: string }[], label: string): void {
  const ids = values.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new KnowledgeResolutionIntegrityError(`${label} contains duplicate component IDs`);
  }
}

function assertRefEqual(
  actual: KnowledgeResolutionRef,
  expected: { id: string; digest: string },
  label: string
): void {
  if (!refsEqual(actual, expected)) {
    throw new KnowledgeResolutionIntegrityError(`${label} identity is not exact`);
  }
}

function assertExactRefSet(
  actual: readonly { id: string; digest: string }[],
  expected: readonly { id: string; digest: string }[],
  label: string
): void {
  const actualKeys = actual.map(refKey).sort();
  const expectedKeys = expected.map(refKey).sort();
  if (
    new Set(actualKeys).size !== actualKeys.length ||
    new Set(expectedKeys).size !== expectedKeys.length ||
    JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
  ) {
    throw new KnowledgeResolutionIntegrityError(`${label} is incomplete or contains extras`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class KnowledgeResolutionIntegrityError extends Error {}
export class KnowledgeResolutionUnavailableError extends Error {}
