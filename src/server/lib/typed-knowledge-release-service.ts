import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  evaluateReferenceSourceAuthority,
  type ReferenceAuthorityReceiptVerifier,
  type ReferenceAuthoritySubjectFacetRequirement,
  type ReferenceAuthorityVerificationReceipt,
} from "../../lib/reference-source-authority.js";
import {
  canonicalReferenceJson,
  referenceSourceDigest,
  type ReferenceAccessDecision,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
} from "../../lib/reference-source-domain.js";
import {
  buildKnowledgeApplicabilityPredicate,
  buildKnowledgeCandidate,
  buildKnowledgeComponentBinding,
  buildKnowledgeComponentMapping,
  buildKnowledgeConstraintDerivation,
  buildKnowledgeEvidenceEdge,
  buildKnowledgePackDraft,
  buildKnowledgePackRelease,
  buildKnowledgeProfile,
  buildKnowledgeTestPolicy,
  computeSystemTestOnlyAttestationDigest,
  knowledgeRef,
  validateKnowledgeApplicabilityPredicate,
  validateKnowledgeCandidate,
  validateKnowledgeComponentBinding,
  validateKnowledgeComponentMapping,
  validateKnowledgeConstraintDerivation,
  validateKnowledgeEvidenceEdge,
  validateKnowledgePackDraft,
  validateKnowledgePackRelease,
  validateKnowledgeProfile,
  validateKnowledgeDraftGraph,
  validateKnowledgeReleaseGraph,
  validateKnowledgeSystemIdentitySnapshot,
  validateKnowledgeTestPolicy,
  validateSystemTestOnlyAttestation,
  validateSystemTestOnlyAttestationStructure,
  type KnowledgeCandidate,
  type KnowledgeComponentBinding,
  type KnowledgeExternalEvidenceRef,
  type KnowledgePackDraft,
  type KnowledgePackRelease,
  type KnowledgeRecordRef,
  type KnowledgeReleaseGraphContext,
  type KnowledgeSystemIdentitySnapshot,
  type KnowledgeTestPolicy,
  type SystemTestOnlyAttestation,
} from "../../lib/reviewed-knowledge-contract.js";
import {
  buildTypedKnowledgeAuthorityVerification,
  validateTypedKnowledgeAuthorityVerification,
  verifyPersistedTypedKnowledgeAuthorityReceipt,
  type TypedKnowledgeAuthoritySourceRef,
  type TypedKnowledgeAuthorityVerification,
} from "../../lib/typed-knowledge-authority-verification.js";
import {
  TypedKnowledgeReleaseOperationRequestSchema,
  TypedKnowledgeReleasePreviewRequestSchema,
  TypedKnowledgeReleaseProjectionSchema,
  TypedKnowledgeReleasePublishRequestSchema,
  type TypedKnowledgePublicationGenerationRef,
  type TypedKnowledgeReleaseOperationRequest,
  type TypedKnowledgeReleasePreviewRequest,
  type TypedKnowledgeReleaseProjection,
  type TypedKnowledgeReleasePublishRequest,
  type TypedKnowledgeReleaseSelection,
} from "../../lib/typed-knowledge-release-contract.js";
import {
  KnowledgePublicationConflictError,
  KnowledgePublicationIntegrityError,
  KnowledgePublicationRecoveryRequiredError,
  knowledgePublicationRequestDigestForTransaction,
  knowledgePublicationRecordRefForWrite,
  type KnowledgePublicationRecord,
  type KnowledgePublicationRecordKind,
  type KnowledgePublicationRecordRef,
  type KnowledgePublicationSnapshot,
  type KnowledgePublicationStore,
  type KnowledgePublicationTransaction,
  type KnowledgePublicationWrite,
} from "./knowledge-publication-store.js";
import {
  OwnerReferencePageAtlasStaleError,
  OwnerReferencePageAtlasUnavailableError,
  type OwnerReferencePageAtlasKnowledgeReleaseSeed,
  type OwnerReferencePageAtlasResolvedContext,
  type OwnerReferencePageAtlasService,
} from "./owner-reference-page-atlas-service.js";

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");

const PACK_ID = "knowledge-pack.mace-twelve-course-diapason-notation";
const MAPPING_CANDIDATE_FAMILY_ID =
  "knowledge-candidate-family.mace-twelve-course-diapason-mapping";
const QUESTION_CANDIDATE_FAMILY_ID = "knowledge-candidate-family.mace-course-13-question";
const PACK_CITATION_REPOSITORY_ID = "vellum.reviewed-knowledge-library";
const PACK_CITATION_PURPOSE =
  "Publish the exact cited Mace extraction as an inactive typed Knowledge Pack release";

function fixedKnowledgeRef(id: string, contract: string): KnowledgeRecordRef {
  return Object.freeze({
    id,
    digest: referenceSourceDigest({
      digestDomain: "vellum.reviewed-knowledge.fixed-registry-ref.v1",
      id,
      contract,
    }),
  });
}

export const TYPED_KNOWLEDGE_TEST_POLICY = buildKnowledgeTestPolicy({
  recordKind: "knowledge_test_policy",
  schemaVersion: 1,
  id: "test-policy.instrument-intelligence.typed-release.v1",
  permittedUses: ["isolated_evaluation", "provisional_research"],
  activationAuthority: false,
  humanAuthority: false,
});
export const TYPED_KNOWLEDGE_TEST_POLICY_REF = knowledgeRef(TYPED_KNOWLEDGE_TEST_POLICY);
export const TYPED_KNOWLEDGE_PACK_CITATION_POLICY_REF = fixedKnowledgeRef(
  "rights-policy.vellum.typed-knowledge-pack-citation.v1",
  "Exact repository-scoped pack citation over the current T11 source and derivative closure"
);
export const TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_REF = fixedKnowledgeRef(
  "verifier.vellum.typed-knowledge-pack-citation.v1",
  "Server-authenticated reference-source authority receipt verifier"
);
export const TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_POLICY_REF = fixedKnowledgeRef(
  "verifier-policy.vellum.typed-knowledge-pack-citation.v1",
  "Pinned pack-citation receipt, scope, facet, and current-time verification policy"
);

/**
 * Server-owned registry entry. No field in the HTTP request can select or
 * widen this contract. T12 intentionally binds inspection-only replay until a
 * later component-registry tracer establishes executable semantics.
 */
export const TYPED_KNOWLEDGE_MACE_COMPONENT_REGISTRY_CONTRACT = Object.freeze({
  componentRef: fixedKnowledgeRef(
    "component.vellum.french-tablature-diapason-mapping.v1",
    "Declarative mapping of cited diapason signs to course identities"
  ),
  artifactRef: fixedKnowledgeRef(
    "artifact.vellum.french-tablature-diapason-mapping-contract.v1",
    "Inspection-only declarative registry artifact"
  ),
  interfaceRef: fixedKnowledgeRef(
    "interface.vellum.notation-component-mapping.v1",
    "Notation component mapping interface version 1"
  ),
  parameterSchemaRef: fixedKnowledgeRef(
    "parameter-schema.vellum.mace-diapason-signs.v1",
    "Twelve-course Mace sign parameters with unresolved course 13"
  ),
  unitSchemaRef: fixedKnowledgeRef(
    "unit-schema.vellum.course-and-tablature-sign.v1",
    "One-indexed course identity and exact French tablature sign"
  ),
  compatibility: Object.freeze({
    contractRef: fixedKnowledgeRef(
      "compatibility.vellum.notation-component-mapping.v1",
      "Exact interface version 1 compatibility contract"
    ),
    minimumInterfaceVersion: 1 as const,
    maximumInterfaceVersion: 1 as const,
  }),
  resourcePolicyRef: fixedKnowledgeRef(
    "resource-policy.vellum.declarative-inspection-only.v1",
    "No execution, network, filesystem, subprocess, or provider capability"
  ),
  replay: Object.freeze({
    state: "inspection_only" as const,
    reason: "executable_semantics_unavailable" as const,
  }),
  dependencyRefs: Object.freeze([]) as readonly KnowledgeRecordRef[],
});

export type TypedKnowledgePackCitationAuthorityRequest = Readonly<{
  observedSnapshotRef: ReferenceRecordRef;
  effectiveAt: string;
  operation: "pack_citation";
  sourceRefs: readonly ReferenceRecordRef[];
  derivativeRefs: readonly ReferenceRecordRef[];
  authoritySubjectRefs: readonly ReferenceRecordRef[];
  requiredSubjectFacets: readonly ReferenceAuthoritySubjectFacetRequirement[];
  destination: Readonly<{ kind: "repository"; id: typeof PACK_CITATION_REPOSITORY_ID }>;
  purpose: typeof PACK_CITATION_PURPOSE;
  accessPolicyRef: ReferenceRecordRef;
  verifierRef: ReferenceRecordRef;
  verifierPolicyRef: ReferenceRecordRef;
}>;

export type TypedKnowledgePackCitationAuthorityClosure = Readonly<{
  accessDecisions: readonly ReferenceAccessDecision[];
  rightsAssertions: readonly ReferenceRightsAssertion[];
  receipt: ReferenceAuthorityVerificationReceipt;
}>;

/** Trusted server integration; browser-supplied authority-shaped JSON is never accepted. */
export type TypedKnowledgePackCitationAuthorityProvider = Readonly<{
  resolvePackCitationAuthority: (
    request: TypedKnowledgePackCitationAuthorityRequest,
    signal?: AbortSignal
  ) => TypedKnowledgePackCitationAuthorityClosure;
  verifyPersistedReceipt: ReferenceAuthorityReceiptVerifier;
}>;

/** Trusted server integration; the HTTP request cannot select its issuer identity. */
export type TypedKnowledgeSystemIdentityProvider = Readonly<{
  resolveSystemIdentity: () => KnowledgeSystemIdentitySnapshot;
}>;

type PageAtlasSeedResolver = Pick<OwnerReferencePageAtlasService, "resolveKnowledgeReleaseSeed">;
type PublicationStore = Pick<
  KnowledgePublicationStore,
  "readCurrent" | "readGeneration" | "publish"
>;

export type TypedKnowledgeReleaseServiceOptions = Readonly<{
  pageAtlasService: PageAtlasSeedResolver;
  publicationStore: PublicationStore;
  packCitationAuthorityProvider?: TypedKnowledgePackCitationAuthorityProvider;
  systemIdentityProvider?: TypedKnowledgeSystemIdentityProvider;
  now?: () => Date;
}>;

type CompiledBundle = Readonly<{
  predicates: readonly ReturnType<typeof buildKnowledgeApplicabilityPredicate>[];
  candidates: readonly [KnowledgeCandidate, KnowledgeCandidate];
  evidenceEdges: readonly ReturnType<typeof buildKnowledgeEvidenceEdge>[];
  derivation: ReturnType<typeof buildKnowledgeConstraintDerivation>;
  componentBinding: KnowledgeComponentBinding;
  componentMapping: ReturnType<typeof buildKnowledgeComponentMapping>;
  profile: ReturnType<typeof buildKnowledgeProfile>;
  draft: KnowledgePackDraft;
  release: KnowledgePackRelease;
}>;

type PublishedBundle = CompiledBundle &
  Readonly<{
    rightsVerification: TypedKnowledgeAuthorityVerification;
    systemIdentity: KnowledgeSystemIdentitySnapshot;
    testPolicy: KnowledgeTestPolicy;
    attestation: SystemTestOnlyAttestation;
  }>;

type PublicationGraph = Readonly<{
  context: KnowledgeReleaseGraphContext;
  drafts: readonly KnowledgePackDraft[];
  releases: readonly KnowledgePackRelease[];
}>;

type PublicationCapability = TypedKnowledgeReleaseProjection["publicationCapability"];

export const MAX_ATTESTATION_PUBLICATION_SKEW_MS = 5 * 60 * 1_000;

export class TypedKnowledgeReleaseService {
  private readonly pageAtlasService: PageAtlasSeedResolver;
  private readonly publicationStore: PublicationStore;
  private readonly packCitationAuthorityProvider?: TypedKnowledgePackCitationAuthorityProvider;
  private readonly systemIdentityProvider?: TypedKnowledgeSystemIdentityProvider;
  private readonly now: () => Date;

  constructor(options: TypedKnowledgeReleaseServiceOptions) {
    this.pageAtlasService = options.pageAtlasService;
    this.publicationStore = options.publicationStore;
    this.packCitationAuthorityProvider = options.packCitationAuthorityProvider;
    this.systemIdentityProvider = options.systemIdentityProvider;
    this.now = options.now ?? (() => new Date());
  }

  execute(
    input: Readonly<{
      request: TypedKnowledgeReleaseOperationRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ): TypedKnowledgeReleaseProjection {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    assertNotCancelled(input.signal);
    const request = Value.Decode(TypedKnowledgeReleaseOperationRequestSchema, input.request);
    return request.action === "preview"
      ? this.preview({ request, context: input.context, signal: input.signal })
      : this.publish({ request, context: input.context, signal: input.signal });
  }

  preview(
    input: Readonly<{
      request: TypedKnowledgeReleasePreviewRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ): TypedKnowledgeReleaseProjection {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    assertNotCancelled(input.signal);
    const request = Value.Decode(TypedKnowledgeReleasePreviewRequestSchema, input.request);
    const seed = this.resolveSeed(request.selection, input.context);
    assertNotCancelled(input.signal);
    const snapshot = this.readPublicationSnapshot();
    const graph = withTypedKnowledgeIntegrityBoundary(() => publicationGraph(snapshot));
    withTypedKnowledgeIntegrityBoundary(() =>
      assertPublishedGraph(
        snapshot,
        graph,
        (generationId) => this.readPublicationGeneration(generationId),
        this.packCitationAuthorityProvider?.verifyPersistedReceipt
      )
    );
    const published = withTypedKnowledgeIntegrityBoundary(() =>
      findPublishedBundle(
        snapshot,
        seed,
        graph,
        (generationId) => this.readPublicationGeneration(generationId),
        this.packCitationAuthorityProvider?.verifyPersistedReceipt
      )
    );
    if (published) {
      return projectBundle({
        selection: request.selection,
        snapshot,
        bundle: published,
        publicationOutcome: "preview_existing",
        publicationCapability: this.publicationCapability(),
      });
    }
    const prior = latestPackRelease(graph);
    if (prior && snapshot) {
      const priorBundle = withTypedKnowledgeIntegrityBoundary(() =>
        loadPublishedBundle(
          snapshot,
          graph,
          prior,
          (generationId) => this.readPublicationGeneration(generationId),
          this.packCitationAuthorityProvider?.verifyPersistedReceipt
        )
      );
      assertSourceClosureContinuation(priorBundle.rightsVerification, seed);
    }
    const bundle = withTypedKnowledgeIntegrityBoundary(() =>
      compileBundle(seed, prior, graph.context)
    );
    return projectBundle({
      selection: request.selection,
      snapshot,
      bundle,
      publicationOutcome: "preview_candidate",
      publicationCapability: this.publicationCapability(),
    });
  }

  publish(
    input: Readonly<{
      request: TypedKnowledgeReleasePublishRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ): TypedKnowledgeReleaseProjection {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    assertAuthorityPathRuntime(
      "authority.validator.knowledge-publication-governance",
      "production"
    );
    assertNotCancelled(input.signal);
    const request = Value.Decode(TypedKnowledgeReleasePublishRequestSchema, input.request);
    this.assertPublicationPrerequisites();
    const seed = this.resolveSeed(request.selection, input.context);
    assertNotCancelled(input.signal);
    const snapshot = this.readPublicationSnapshot();
    const graph = withTypedKnowledgeIntegrityBoundary(() => publicationGraph(snapshot));
    withTypedKnowledgeIntegrityBoundary(() =>
      assertPublishedGraph(
        snapshot,
        graph,
        (generationId) => this.readPublicationGeneration(generationId),
        this.packCitationAuthorityProvider?.verifyPersistedReceipt
      )
    );
    const existing = withTypedKnowledgeIntegrityBoundary(() =>
      findPublishedBundle(
        snapshot,
        seed,
        graph,
        (generationId) => this.readPublicationGeneration(generationId),
        this.packCitationAuthorityProvider?.verifyPersistedReceipt
      )
    );
    if (existing) {
      return projectBundle({
        selection: request.selection,
        snapshot,
        bundle: existing,
        publicationOutcome: "publish_idempotent",
        publicationCapability: this.publicationCapability(),
      });
    }
    const currentHead = generationRef(snapshot);
    if (!sameNullableGenerationRef(request.expectedPublicationHead, currentHead)) {
      throw new TypedKnowledgeReleaseConflictError();
    }

    const prior = latestPackRelease(graph);
    if (prior && snapshot) {
      const priorBundle = withTypedKnowledgeIntegrityBoundary(() =>
        loadPublishedBundle(
          snapshot,
          graph,
          prior,
          (generationId) => this.readPublicationGeneration(generationId),
          this.packCitationAuthorityProvider?.verifyPersistedReceipt
        )
      );
      assertSourceClosureContinuation(priorBundle.rightsVerification, seed);
    }
    const bundle = withTypedKnowledgeIntegrityBoundary(() =>
      compileBundle(seed, prior, graph.context)
    );
    const rightsVerification = this.verifyPackCitationAuthority(seed, bundle.release, input.signal);
    assertNotCancelled(input.signal);
    const systemIdentity = this.resolveSystemIdentity();
    assertNotCancelled(input.signal);
    const attestationIssuedAt = this.now().toISOString();
    const attestation = withTypedKnowledgeIntegrityBoundary(() =>
      buildTestAttestation(
        bundle,
        graphContextWithBundle(graph, bundle),
        systemIdentity,
        TYPED_KNOWLEDGE_TEST_POLICY,
        attestationIssuedAt
      )
    );
    const publishedBundle: PublishedBundle = {
      ...bundle,
      rightsVerification,
      systemIdentity,
      testPolicy: TYPED_KNOWLEDGE_TEST_POLICY,
      attestation,
    };
    const writes = withTypedKnowledgeIntegrityBoundary(() =>
      publicationWrites(publishedBundle, snapshot, prior)
    );
    const transaction = publicationTransaction(publishedBundle, currentHead, writes);

    let result;
    try {
      assertNotCancelled(input.signal);
      result = this.publicationStore.publish(transaction);
    } catch (error) {
      if (error instanceof KnowledgePublicationConflictError) {
        throw new TypedKnowledgeReleaseConflictError({ cause: error });
      }
      if (
        error instanceof KnowledgePublicationIntegrityError ||
        error instanceof KnowledgePublicationRecoveryRequiredError
      ) {
        throw new TypedKnowledgeReleaseUnavailableError({ cause: error });
      }
      throw error;
    }

    const reread = this.readPublicationSnapshot();
    if (!reread || !sameGenerationRef(generationRef(reread)!, generationRef(result)!)) {
      throw new TypedKnowledgeReleaseUnavailableError();
    }
    const rereadGraph = withTypedKnowledgeIntegrityBoundary(() => publicationGraph(reread));
    withTypedKnowledgeIntegrityBoundary(() =>
      assertAttestationMintEnvelope(reread, publishedBundle, prior, (generationId) =>
        this.readPublicationGeneration(generationId)
      )
    );
    withTypedKnowledgeIntegrityBoundary(() =>
      assertPublishedWrites(
        reread,
        writes,
        publishedBundle,
        graphContextForRelease(rereadGraph, bundle.release)
      )
    );
    return projectBundle({
      selection: request.selection,
      snapshot: reread,
      bundle: publishedBundle,
      publicationOutcome:
        result.outcome === "already_committed" ? "publish_idempotent" : "publish_committed",
      publicationCapability: this.publicationCapability(),
    });
  }

  private resolveSeed(
    selection: TypedKnowledgeReleaseSelection,
    context: OwnerReferencePageAtlasResolvedContext
  ): OwnerReferencePageAtlasKnowledgeReleaseSeed {
    try {
      return this.pageAtlasService.resolveKnowledgeReleaseSeed({ selection, context });
    } catch (error) {
      if (error instanceof OwnerReferencePageAtlasStaleError) {
        throw new TypedKnowledgeReleaseStaleError({ cause: error });
      }
      if (error instanceof OwnerReferencePageAtlasUnavailableError) {
        throw new TypedKnowledgeReleaseUnavailableError({ cause: error });
      }
      throw error;
    }
  }

  private readPublicationSnapshot(): KnowledgePublicationSnapshot | null {
    try {
      return this.publicationStore.readCurrent();
    } catch (error) {
      throw new TypedKnowledgeReleaseUnavailableError({ cause: error });
    }
  }

  private readPublicationGeneration(generationId: string): KnowledgePublicationSnapshot {
    try {
      return this.publicationStore.readGeneration(generationId);
    } catch (error) {
      throw new TypedKnowledgeReleaseUnavailableError({ cause: error });
    }
  }

  private resolveSystemIdentity(): KnowledgeSystemIdentitySnapshot {
    if (!this.systemIdentityProvider) {
      throw new TypedKnowledgeReleaseUnavailableError();
    }
    try {
      return validateKnowledgeSystemIdentitySnapshot(
        structuredClone(this.systemIdentityProvider.resolveSystemIdentity())
      );
    } catch (error) {
      throw new TypedKnowledgeReleaseUnavailableError({ cause: error });
    }
  }

  private verifyPackCitationAuthority(
    seed: OwnerReferencePageAtlasKnowledgeReleaseSeed,
    release: KnowledgePackRelease,
    signal?: AbortSignal
  ): TypedKnowledgeAuthorityVerification {
    assertNotCancelled(signal);
    if (!this.packCitationAuthorityProvider) {
      throw new TypedKnowledgeReleaseAuthorityError();
    }
    const effectiveAt = this.now().toISOString();
    const typedSourceRefs = sortTypedSourceRefs([
      typedSourceRef(seed.work),
      typedSourceRef(seed.manifestation),
      typedSourceRef(seed.exemplar),
      typedSourceRef(seed.digitalAsset),
      typedSourceRef(seed.acquisition),
    ]);
    const typedDerivativeRefs = sortExternalEvidenceRefs(release.citedEvidenceRefs);
    const sourceRefs = typedSourceRefs.map(sourceRef);
    const derivativeRefs = typedDerivativeRefs.map(sourceRef);
    const authoritySubjectRefs = sortSourceRefs([...sourceRefs, ...derivativeRefs]);
    const requiredSubjectFacets = sortSubjectFacets([
      { subjectRef: sourceRef(seed.work), facet: "underlying_work_status" },
      { subjectRef: sourceRef(seed.manifestation), facet: "manifestation_editorial" },
      { subjectRef: sourceRef(seed.exemplar), facet: "exemplar_restriction" },
      { subjectRef: sourceRef(seed.digitalAsset), facet: "scan_provider_terms" },
      { subjectRef: sourceRef(seed.acquisition), facet: "attribution" },
      ...typedDerivativeRefs.map((reference) => ({
        subjectRef: sourceRef(reference),
        facet: "pack_citation_excerpt" as const,
      })),
    ]);
    const authorityRequest: TypedKnowledgePackCitationAuthorityRequest = Object.freeze({
      observedSnapshotRef: sourceRef(seed.stagingSnapshotRef),
      effectiveAt,
      operation: "pack_citation",
      sourceRefs: Object.freeze(sortSourceRefs(sourceRefs)),
      derivativeRefs: Object.freeze(sortSourceRefs(derivativeRefs)),
      authoritySubjectRefs: Object.freeze(authoritySubjectRefs),
      requiredSubjectFacets: Object.freeze(requiredSubjectFacets),
      destination: Object.freeze({
        kind: "repository" as const,
        id: PACK_CITATION_REPOSITORY_ID,
      }),
      purpose: PACK_CITATION_PURPOSE,
      accessPolicyRef: TYPED_KNOWLEDGE_PACK_CITATION_POLICY_REF,
      verifierRef: TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_REF,
      verifierPolicyRef: TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_POLICY_REF,
    });

    let closure: TypedKnowledgePackCitationAuthorityClosure;
    try {
      closure = this.packCitationAuthorityProvider.resolvePackCitationAuthority(
        authorityRequest,
        signal
      );
    } catch (error) {
      if (signal?.aborted) throw new TypedKnowledgeReleaseCancelledError({ cause: error });
      throw new TypedKnowledgeReleaseAuthorityError({ cause: error });
    }
    assertNotCancelled(signal);
    const accessDecisions = structuredClone([...closure.accessDecisions]);
    const rightsAssertions = structuredClone([...closure.rightsAssertions]);
    const receipt = structuredClone(closure.receipt);
    const decision = accessDecisions.find((candidate) =>
      sourceRefsEqual(sourceRef(candidate), receipt.accessDecisionRef)
    );
    if (
      !decision ||
      decision.operation !== "pack_citation" ||
      decision.outcome !== "allow" ||
      decision.destination.kind !== "repository" ||
      decision.destination.id !== PACK_CITATION_REPOSITORY_ID ||
      decision.purpose !== PACK_CITATION_PURPOSE ||
      !sourceRefsEqual(decision.policyRef, TYPED_KNOWLEDGE_PACK_CITATION_POLICY_REF) ||
      !sameSourceRefSet(decision.sourceRefs, authorityRequest.sourceRefs) ||
      !sameSourceRefSet(decision.derivativeRefs, authorityRequest.derivativeRefs) ||
      !sourceRefsEqual(receipt.observedSnapshotRef, seed.stagingSnapshotRef) ||
      !sameSourceRefSet(receipt.authoritySubjectRefs, authoritySubjectRefs) ||
      !sourceRefsEqual(receipt.verifierRef, TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_REF) ||
      !sourceRefsEqual(
        receipt.verifierPolicyRef,
        TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_POLICY_REF
      ) ||
      !sameSubjectFacetSet(receipt.requiredSubjectFacets, requiredSubjectFacets) ||
      !sameStringSet(
        receipt.requiredFacets,
        REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation
      )
    ) {
      throw new TypedKnowledgeReleaseAuthorityError();
    }

    let evaluation;
    try {
      evaluation = evaluateReferenceSourceAuthority({
        schemaVersion: 1,
        effectiveAt,
        accessDecisionRef: sourceRef(decision),
        authoritySubjectRefs,
        requiredSubjectFacets,
        accessDecisions,
        rightsAssertions,
        receipt,
        verifyServerReceipt: this.packCitationAuthorityProvider.verifyPersistedReceipt,
      });
    } catch (error) {
      throw new TypedKnowledgeReleaseAuthorityError({ cause: error });
    }
    if (
      evaluation.status !== "allow" ||
      evaluation.operation !== "pack_citation" ||
      !sourceRefsEqual(evaluation.accessDecisionRef, decision) ||
      !sameSourceRefSet(
        evaluation.currentRightsAssertionRefs,
        receipt.currentRightsAssertionRefs
      ) ||
      !sameSourceRefSet(decision.rightsAssertionRefs, receipt.currentRightsAssertionRefs) ||
      !sameSourceRefSet(decision.authorityRefs, receipt.verifiedAuthorityRefs)
    ) {
      throw new TypedKnowledgeReleaseAuthorityError();
    }
    try {
      return buildTypedKnowledgeAuthorityVerification({
        releaseRef: knowledgeRef(release),
        operation: "pack_citation",
        evaluatedAt: effectiveAt,
        observedSnapshotRef: sourceRef(seed.stagingSnapshotRef),
        sourceRefs: typedSourceRefs,
        derivativeRefs: typedDerivativeRefs,
        authoritySubjectRefs: sortSourceRefs(authoritySubjectRefs),
        requiredFacets: [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation].sort(
          compareCodePoints
        ),
        requiredSubjectFacets: sortSubjectFacets(requiredSubjectFacets),
        destination: authorityRequest.destination,
        purpose: authorityRequest.purpose,
        accessPolicyRef: authorityRequest.accessPolicyRef,
        verifierRef: authorityRequest.verifierRef,
        verifierPolicyRef: authorityRequest.verifierPolicyRef,
        decisionCommitment: {
          accessDecisionRef: sourceRef(decision),
          outcome: "allow",
          rightsAssertionRefs: sortSourceRefs(decision.rightsAssertionRefs),
          authorityRefs: sortSourceRefs(decision.authorityRefs),
          decidedAt: decision.decidedAt,
          rationaleCode: "exact_pack_citation_scope_verified",
        },
        receipt,
      });
    } catch (error) {
      throw new TypedKnowledgeReleaseAuthorityError({ cause: error });
    }
  }

  private publicationCapability(): PublicationCapability {
    const missingPrerequisites: Array<"pack_citation_authority" | "system_identity"> = [];
    if (
      !this.packCitationAuthorityProvider ||
      typeof this.packCitationAuthorityProvider.resolvePackCitationAuthority !== "function" ||
      typeof this.packCitationAuthorityProvider.verifyPersistedReceipt !== "function"
    ) {
      missingPrerequisites.push("pack_citation_authority");
    }
    if (
      !this.systemIdentityProvider ||
      typeof this.systemIdentityProvider.resolveSystemIdentity !== "function"
    ) {
      missingPrerequisites.push("system_identity");
    }
    return missingPrerequisites.length === 0
      ? { state: "configured", authorityCheck: "required_on_publish" }
      : {
          state: "unavailable",
          missingPrerequisites: missingPrerequisites as
            | ["pack_citation_authority"]
            | ["system_identity"]
            | ["pack_citation_authority", "system_identity"],
        };
  }

  private assertPublicationPrerequisites(): void {
    const capability = this.publicationCapability();
    if (capability.state === "configured") return;
    if (
      (capability.missingPrerequisites as readonly string[]).includes("pack_citation_authority")
    ) {
      throw new TypedKnowledgeReleaseAuthorityError();
    }
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function compileBundle(
  seed: OwnerReferencePageAtlasKnowledgeReleaseSeed,
  prior: KnowledgePackRelease | null,
  graphContext: KnowledgeReleaseGraphContext
): CompiledBundle {
  const sequence = (prior?.sequence ?? 0) + 1;
  const mappingPredicate = buildKnowledgeApplicabilityPredicate({
    recordKind: "knowledge_applicability_predicate",
    schemaVersion: 1,
    id: "knowledge-predicate.mace-twelve-course-french-tablature",
    authorityLane: "historical_practice",
    expression: {
      kind: "mace_twelve_course_notation_scope",
      sourceProfile: "mace-musicks-monument-1676",
      instrumentFamily: "baroque_lute",
      notationSystem: "french_tablature",
      sourceCourseCount: 12,
      firstCoveredCourse: 7,
      lastCoveredCourse: 12,
      course13Disposition: "excluded_unresolved",
    },
    requiredContextFields: [
      "source_profile",
      "instrument_family",
      "notation_system",
      "source_course_count",
    ],
    unknownPolicy: "preserve_unknown",
  });
  const questionPredicate = buildKnowledgeApplicabilityPredicate({
    recordKind: "knowledge_applicability_predicate",
    schemaVersion: 1,
    id: "knowledge-predicate.mace-course-13-research-only",
    authorityLane: "historical_practice",
    expression: {
      kind: "course_thirteen_notation_research_scope",
      instrumentFamily: "baroque_lute",
      notationSystem: "french_tablature",
      course: 13,
      historicalSignState: "unresolved",
      inferencePolicy: "no_sequence_extrapolation",
      activationDisposition: "research_only",
    },
    requiredContextFields: ["historical_sign_state", "instrument_family", "notation_system"],
    unknownPolicy: "review_required",
  });
  const priorMapping = prior ? requireCandidate(prior, MAPPING_CANDIDATE_FAMILY_ID) : null;
  const priorQuestion = prior ? requireCandidate(prior, QUESTION_CANDIDATE_FAMILY_ID) : null;
  const courseMappings = [
    { course: seed.mapping.proposal.courses[0], sign: seed.mapping.proposal.symbols[0] },
    { course: seed.mapping.proposal.courses[1], sign: seed.mapping.proposal.symbols[1] },
    { course: seed.mapping.proposal.courses[2], sign: seed.mapping.proposal.symbols[2] },
    { course: seed.mapping.proposal.courses[3], sign: seed.mapping.proposal.symbols[3] },
    { course: seed.mapping.proposal.courses[4], sign: seed.mapping.proposal.symbols[4] },
    { course: seed.mapping.proposal.courses[5], sign: seed.mapping.proposal.symbols[5] },
  ] as const;
  const mappingVersion = (priorMapping?.version ?? 0) + 1;
  const mappingCandidate = buildKnowledgeCandidate({
    recordKind: "knowledge_candidate",
    schemaVersion: 1,
    id: `knowledge-candidate.mace-twelve-course-diapason-mapping.v${mappingVersion}`,
    familyId: MAPPING_CANDIDATE_FAMILY_ID,
    version: mappingVersion,
    parentVersionRef: priorMapping
      ? {
          id: priorMapping.id,
          familyId: priorMapping.familyId,
          version: priorMapping.version,
          digest: priorMapping.digest,
        }
      : null,
    nodeKind: "assertion",
    authorityLane: "historical_practice",
    domains: ["instrument_technique", "notation"],
    epistemicForm: "descriptive_observation",
    sourceSegmentRefs: [knowledgeExternalEvidenceRef(seed.segment)],
    citedExtractionRefs: [knowledgeExternalEvidenceRef(seed.extraction)],
    sourceProposalRefs: [knowledgeExternalEvidenceRef(seed.mapping)],
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    informationalPredicateRefs: [],
    proposition: {
      kind: "mace_twelve_course_diapason_mapping",
      sourceProfile: "mace-musicks-monument-1676",
      sourceCourseCount: 12,
      courseMappings,
      numericSymbolsHaveSlashes: false,
      course13Inference: "forbidden",
    },
    reviewState: "proposed",
    activationAllowed: false,
  });
  const questionVersion = (priorQuestion?.version ?? 0) + 1;
  const questionCandidate = buildKnowledgeCandidate({
    recordKind: "knowledge_candidate",
    schemaVersion: 1,
    id: `knowledge-candidate.mace-course-13-question.v${questionVersion}`,
    familyId: QUESTION_CANDIDATE_FAMILY_ID,
    version: questionVersion,
    parentVersionRef: priorQuestion
      ? {
          id: priorQuestion.id,
          familyId: priorQuestion.familyId,
          version: priorQuestion.version,
          digest: priorQuestion.digest,
        }
      : null,
    nodeKind: "research_question",
    authorityLane: "historical_practice",
    domains: ["notation"],
    epistemicForm: "unresolved_question",
    sourceSegmentRefs: [knowledgeExternalEvidenceRef(seed.segment)],
    citedExtractionRefs: [knowledgeExternalEvidenceRef(seed.extraction)],
    sourceProposalRefs: [knowledgeExternalEvidenceRef(seed.question)],
    gatingPredicateRefs: [],
    informationalPredicateRefs: [knowledgeRef(questionPredicate)],
    proposition: {
      kind: "course_thirteen_notation_question",
      course: seed.question.proposal.course,
      state: seed.question.proposal.state,
      proposedSign: null,
      forbiddenInference: seed.question.proposal.forbiddenInference,
      activationDisposition: "research_only",
    },
    reviewState: "proposed",
    activationAllowed: false,
  });

  const citedSource = {
    ref: knowledgeExternalEvidenceRef(seed.extraction),
    kind: "cited_extraction" as const,
    authorityLane: "historical_practice" as const,
  };
  const mappingTarget = {
    ref: knowledgeRef(mappingCandidate),
    nodeKind: "assertion" as const,
    authorityLane: "historical_practice" as const,
  };
  const questionTarget = {
    ref: knowledgeRef(questionCandidate),
    nodeKind: "research_question" as const,
    authorityLane: "historical_practice" as const,
  };
  const evidence = (
    suffix: string,
    role: "support" | "qualification" | "example" | "unresolved_ambiguity",
    target: typeof mappingTarget | typeof questionTarget,
    predicateRef: KnowledgeRecordRef,
    predicateUse: "gating" | "informational",
    rationaleCode:
      | "source_directly_supports_mapping"
      | "scope_limited_to_twelve_courses"
      | "source_exemplifies_mapping"
      | "source_does_not_establish_course_13"
  ) =>
    buildKnowledgeEvidenceEdge({
      recordKind: "knowledge_evidence_edge",
      schemaVersion: 1,
      id: `knowledge-evidence.mace.r${sequence}.${suffix}`,
      authorityLane: "historical_practice",
      source: citedSource,
      target,
      role,
      predicateBinding: { predicateRef, use: predicateUse },
      rationaleCode,
    });
  const support = evidence(
    "support",
    "support",
    mappingTarget,
    knowledgeRef(mappingPredicate),
    "gating",
    "source_directly_supports_mapping"
  );
  const qualification = evidence(
    "qualification",
    "qualification",
    mappingTarget,
    knowledgeRef(mappingPredicate),
    "gating",
    "scope_limited_to_twelve_courses"
  );
  const example = evidence(
    "example",
    "example",
    mappingTarget,
    knowledgeRef(mappingPredicate),
    "gating",
    "source_exemplifies_mapping"
  );
  const unresolved = evidence(
    "course-13-unresolved",
    "unresolved_ambiguity",
    questionTarget,
    knowledgeRef(questionPredicate),
    "informational",
    "source_does_not_establish_course_13"
  );
  const derivation = buildKnowledgeConstraintDerivation({
    recordKind: "knowledge_constraint_derivation",
    schemaVersion: 1,
    id: `knowledge-derivation.mace.r${sequence}`,
    authorityLane: "historical_practice",
    inputs: [
      {
        ref: knowledgeRef(mappingCandidate),
        kind: "candidate",
        authorityLane: "historical_practice",
      },
      {
        ref: knowledgeRef(support),
        kind: "evidence_edge",
        authorityLane: "historical_practice",
      },
      {
        ref: knowledgeRef(qualification),
        kind: "evidence_edge",
        authorityLane: "historical_practice",
      },
    ],
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    inferenceRule: "preserve_exact_cited_mapping_without_extrapolation",
    force: "descriptive",
    consequence: {
      kind: "twelve_course_notation_mapping",
      courseMappings,
      course13Consequence: "none_unresolved",
    },
    limitations: ["twelve_course_source_only", "course_13_unresolved"],
    reviewState: "proposed",
  });
  const derivationEdge = buildKnowledgeEvidenceEdge({
    recordKind: "knowledge_evidence_edge",
    schemaVersion: 1,
    id: `knowledge-evidence.mace.r${sequence}.derivation`,
    authorityLane: "historical_practice",
    source: {
      ref: knowledgeRef(derivation),
      kind: "constraint_derivation",
      authorityLane: "historical_practice",
    },
    target: mappingTarget,
    role: "derivation",
    predicateBinding: {
      predicateRef: knowledgeRef(mappingPredicate),
      use: "gating",
    },
    rationaleCode: "constraint_derived_from_evidence",
  });
  const supersessionEdges =
    priorMapping && priorQuestion
      ? [
          buildKnowledgeEvidenceEdge({
            recordKind: "knowledge_evidence_edge",
            schemaVersion: 1,
            id: `knowledge-evidence.mace.r${sequence}.mapping-supersession`,
            authorityLane: "historical_practice",
            source: {
              ref: knowledgeRef(mappingCandidate),
              kind: "candidate",
              authorityLane: "historical_practice",
            },
            target: {
              ref: knowledgeRef(priorMapping),
              nodeKind: priorMapping.nodeKind,
              authorityLane: priorMapping.authorityLane,
            },
            role: "supersession",
            predicateBinding: {
              predicateRef: knowledgeRef(mappingPredicate),
              use: "gating",
            },
            rationaleCode: "later_candidate_supersedes_prior",
          }),
          buildKnowledgeEvidenceEdge({
            recordKind: "knowledge_evidence_edge",
            schemaVersion: 1,
            id: `knowledge-evidence.mace.r${sequence}.question-supersession`,
            authorityLane: "historical_practice",
            source: {
              ref: knowledgeRef(questionCandidate),
              kind: "candidate",
              authorityLane: "historical_practice",
            },
            target: {
              ref: knowledgeRef(priorQuestion),
              nodeKind: priorQuestion.nodeKind,
              authorityLane: priorQuestion.authorityLane,
            },
            role: "supersession",
            predicateBinding: {
              predicateRef: knowledgeRef(questionPredicate),
              use: "informational",
            },
            rationaleCode: "later_candidate_supersedes_prior",
          }),
        ]
      : [];
  const retainedSupersessionEdges =
    prior?.evidenceEdges.filter(({ role }) => role === "supersession") ?? [];
  const evidenceEdges = [
    support,
    qualification,
    example,
    unresolved,
    derivationEdge,
    ...retainedSupersessionEdges,
    ...supersessionEdges,
  ];
  const retainedCandidates = prior
    ? [...prior.candidates, mappingCandidate, questionCandidate]
    : [mappingCandidate, questionCandidate];
  const citedEvidenceRefs = uniqueExternalEvidenceRefs(
    retainedCandidates.flatMap((candidate) => [
      ...candidate.sourceSegmentRefs,
      ...candidate.citedExtractionRefs,
      ...candidate.sourceProposalRefs,
    ])
  );

  const componentBinding = buildKnowledgeComponentBinding({
    recordKind: "knowledge_component_binding",
    schemaVersion: 1,
    id: "knowledge-component-binding.mace-diapason-signs.v1",
    authorityLane: "historical_practice",
    ...TYPED_KNOWLEDGE_MACE_COMPONENT_REGISTRY_CONTRACT,
  });
  assertTrustedComponentBinding(componentBinding);
  const componentMapping = buildKnowledgeComponentMapping({
    recordKind: "knowledge_component_mapping",
    schemaVersion: 1,
    id: `knowledge-component-mapping.mace.r${sequence}`,
    authorityLane: "historical_practice",
    mappingKind: "notation_component_mapping",
    componentBindingRef: knowledgeRef(componentBinding),
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    derivationRefs: [knowledgeRef(derivation)],
    parameters: {
      parameterSchemaRef: TYPED_KNOWLEDGE_MACE_COMPONENT_REGISTRY_CONTRACT.parameterSchemaRef,
      unitSchemaRef: TYPED_KNOWLEDGE_MACE_COMPONENT_REGISTRY_CONTRACT.unitSchemaRef,
      values: {
        sourceCourseCount: 12,
        courseMappings,
        numericSymbolsHaveSlashes: false,
        course13Policy: "unresolved_no_mapping",
      },
    },
    expectedObservable: "courses_7_12_render_with_cited_signs",
    executionDisposition: "declarative_registry_binding",
  });
  const profile = buildKnowledgeProfile({
    recordKind: "knowledge_profile",
    schemaVersion: 1,
    id: `knowledge-profile.mace-twelve-course.r${sequence}`,
    authorityLane: "historical_practice",
    domains: ["instrument_technique", "notation"],
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    informationalPredicateRefs: [knowledgeRef(questionPredicate)],
    assertionRefs: [knowledgeRef(mappingCandidate)],
    openQuestionRefs: [knowledgeRef(questionCandidate)],
    evidenceEdgeRefs: evidenceEdges.map(knowledgeRef),
    evidenceRoleIndex: {
      support: [knowledgeRef(support)],
      qualification: [knowledgeRef(qualification)],
      contradiction: [],
      supersession: [...retainedSupersessionEdges, ...supersessionEdges].map(knowledgeRef),
      example: [knowledgeRef(example)],
      counterexample: [],
      derivation: [knowledgeRef(derivationEdge)],
      unresolved_ambiguity: [knowledgeRef(unresolved)],
    },
    derivationRefs: [knowledgeRef(derivation)],
    componentMappingRefs: [knowledgeRef(componentMapping)],
    outcomes: {
      permitted: ["render_cited_courses_7_12"],
      preferred: ["preserve_source_sign_identity"],
      discouraged: ["present_editorial_course_13_as_historical"],
      prohibited: ["infer_course_13_sign_by_sequence"],
    },
    expectedObservables: ["courses_7_12_render_with_cited_signs"],
    limitations: ["twelve_course_source_only"],
    unevaluatedDimensions: ["course_13_historical_sign"],
    observedAbsences: [
      {
        role: "counterexample",
        observation: "none_observed",
        scope: "cited_mace_segment_only",
      },
    ],
    coverageLimitations: ["single_cited_segment", "absence_does_not_establish_nonexistence"],
    defaultActivation: "inactive",
  });
  const predecessorRef = prior ? knowledgeRef(prior) : null;
  const draft = buildKnowledgePackDraft(
    {
      recordKind: "knowledge_pack_draft",
      schemaVersion: 1,
      id: `knowledge-pack-draft.mace-diapason-signs.r${sequence}`,
      packId: PACK_ID,
      revision: sequence,
      authorityLane: "historical_practice",
      domains: ["instrument_technique", "notation"],
      citedEvidenceRefs,
      candidates: retainedCandidates,
      applicabilityPredicates: [mappingPredicate, questionPredicate],
      evidenceEdges,
      constraintDerivations: [derivation],
      componentClosure: [componentBinding],
      componentMappings: [componentMapping],
      profiles: [profile],
      predecessorRef,
      directDependencyRelations: predecessorRef
        ? [{ targetRef: predecessorRef, role: "same_lane_authority" }]
        : [],
    },
    graphContext
  );
  const release = buildKnowledgePackRelease(
    {
      recordKind: "knowledge_pack_release",
      schemaVersion: 1,
      id: `knowledge-pack-release.mace-diapason-signs.r${sequence}`,
      sequence,
      draft,
    },
    graphContext
  );
  const result: CompiledBundle = {
    predicates: [mappingPredicate, questionPredicate],
    candidates: [mappingCandidate, questionCandidate],
    evidenceEdges,
    derivation,
    componentBinding,
    componentMapping,
    profile,
    draft,
    release,
  };
  assertCompiledBundle(result, graphContextWithBundleContext(graphContext, result));
  return Object.freeze(result);
}

function buildTestAttestation(
  bundle: CompiledBundle,
  releaseGraphContext: KnowledgeReleaseGraphContext,
  systemIdentity: KnowledgeSystemIdentitySnapshot,
  testPolicy: KnowledgeTestPolicy,
  issuedAt: string
): SystemTestOnlyAttestation {
  const core = {
    recordKind: "release_attestation",
    schemaVersion: 1 as const,
    id: `release-attestation.test-only.mace-diapason-signs.r${bundle.release.sequence}`,
    kind: "test_only" as const,
    releaseRef: knowledgeRef(bundle.release),
    issuer: {
      kind: "vellum_system" as const,
      systemRef: knowledgeRef(systemIdentity),
    },
    testPolicyRef: knowledgeRef(testPolicy),
    permittedUses: ["isolated_evaluation", "provisional_research"] as const,
    authorityDisposition: "test_only_no_authority" as const,
    authorityClaims: {
      activation: false as const,
      human: false as const,
      historical: false as const,
      modernPedagogy: false as const,
      editorial: false as const,
      software: false as const,
      ownerLocal: false as const,
      ergonomic: false as const,
      performer: false as const,
      specialist: false as const,
    },
    evidenceRefs: [knowledgeRef(bundle.draft)],
    issuedAt,
  };
  const attestation = validateSystemTestOnlyAttestationStructure({
    ...core,
    digest: computeSystemTestOnlyAttestationDigest(core),
  });
  return validateSystemTestOnlyAttestation(attestation, {
    release: bundle.release,
    releaseGraphContext,
    systemIdentity,
    testPolicy,
    expectedIssuedAt: issuedAt,
  });
}

type PublishableContent =
  | CompiledBundle["predicates"][number]
  | KnowledgeCandidate
  | CompiledBundle["evidenceEdges"][number]
  | CompiledBundle["derivation"]
  | KnowledgeComponentBinding
  | CompiledBundle["componentMapping"]
  | CompiledBundle["profile"]
  | KnowledgePackDraft
  | KnowledgePackRelease
  | TypedKnowledgeAuthorityVerification
  | KnowledgeSystemIdentitySnapshot
  | KnowledgeTestPolicy
  | SystemTestOnlyAttestation;

function publicationWrites(
  bundle: PublishedBundle,
  snapshot: KnowledgePublicationSnapshot | null,
  prior: KnowledgePackRelease | null
): KnowledgePublicationWrite[] {
  const priorMapping = prior ? requireCandidate(prior, MAPPING_CANDIDATE_FAMILY_ID) : null;
  const priorQuestion = prior ? requireCandidate(prior, QUESTION_CANDIDATE_FAMILY_ID) : null;
  const entries: Array<
    Readonly<{ content: PublishableContent; predecessor?: PublishableContent }>
  > = [
    ...bundle.predicates.map((content) => ({ content })),
    { content: bundle.candidates[0], ...(priorMapping ? { predecessor: priorMapping } : {}) },
    { content: bundle.candidates[1], ...(priorQuestion ? { predecessor: priorQuestion } : {}) },
    ...bundle.evidenceEdges.map((content) => ({ content })),
    { content: bundle.derivation },
    { content: bundle.componentBinding },
    { content: bundle.componentMapping },
    { content: bundle.profile },
    { content: bundle.draft },
    { content: bundle.release, ...(prior ? { predecessor: prior } : {}) },
    { content: bundle.rightsVerification },
    { content: bundle.systemIdentity },
    { content: bundle.testPolicy },
    { content: bundle.attestation },
  ];
  return entries.map(({ content, predecessor }) => ({
    recordKind: publicationKind(content),
    id: publicationId(content),
    successorRefs: predecessor ? [requirePublicationRecordRef(snapshot, predecessor)] : [],
    content,
  }));
}

function publicationTransaction(
  bundle: PublishedBundle,
  expectedHead: TypedKnowledgePublicationGenerationRef | null,
  writes: readonly KnowledgePublicationWrite[]
): KnowledgePublicationTransaction {
  const transactionId = `typed-knowledge-release.${referenceSourceDigest({
    digestDomain: "vellum.typed-knowledge-release-transaction.v1",
    releaseRef: knowledgeRef(bundle.release),
    rightsVerificationRef: knowledgeRef(bundle.rightsVerification),
    attestationRef: knowledgeRef(bundle.attestation),
    expectedHead,
  }).slice(0, 40)}`;
  return {
    schemaVersion: 1,
    transactionId,
    writerKind: "system",
    expectedHead,
    writes: structuredClone([...writes]),
  };
}

function expectedNewRefs(
  writes: readonly KnowledgePublicationWrite[],
  parent: KnowledgePublicationSnapshot | null
): KnowledgePublicationRecordRef[] {
  const existingIds = new Set((parent?.records ?? []).map(({ id }) => id));
  return sortPublicationRefs(
    writes.filter((write) => !existingIds.has(write.id)).map(knowledgePublicationRecordRefForWrite)
  );
}

function readAndValidateParentGeneration(
  snapshot: KnowledgePublicationSnapshot,
  readGeneration: (generationId: string) => KnowledgePublicationSnapshot
): KnowledgePublicationSnapshot | null {
  const parentRef = snapshot.generation.parentGenerationRef;
  if (!parentRef) {
    if (snapshot.generation.revision !== 1) {
      throw new TypedKnowledgeReleaseUnavailableError();
    }
    return null;
  }
  if (parentRef.revision !== snapshot.generation.revision - 1) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  const parent = readGeneration(parentRef.id);
  if (!sameGenerationRef(generationRef(parent)!, parentRef)) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  return parent;
}

function publicationKind(content: PublishableContent): KnowledgePublicationRecordKind {
  return content.recordKind;
}

function publicationId(content: PublishableContent): string {
  return `published.${content.recordKind}.${content.digest}`;
}

function requirePublicationRecordRef(
  snapshot: KnowledgePublicationSnapshot | null,
  content: PublishableContent
): KnowledgePublicationRecordRef {
  const matches = (snapshot?.records ?? []).filter(
    (record) =>
      record.recordKind === publicationKind(content) &&
      record.id === publicationId(content) &&
      isKnowledgeContent(record.content) &&
      record.content.id === content.id &&
      record.content.digest === content.digest
  );
  if (matches.length !== 1) throw new TypedKnowledgeReleaseUnavailableError();
  const [record] = matches;
  return { recordKind: record!.recordKind, id: record!.id, digest: record!.digest };
}

function assertPublishedWrites(
  snapshot: KnowledgePublicationSnapshot,
  writes: readonly KnowledgePublicationWrite[],
  expected: PublishedBundle,
  releaseGraphContext: KnowledgeReleaseGraphContext
): void {
  for (const write of writes) {
    const expectedRef = knowledgePublicationRecordRefForWrite(write);
    const matches = snapshot.records.filter(
      (record) =>
        record.recordKind === expectedRef.recordKind &&
        record.id === expectedRef.id &&
        record.digest === expectedRef.digest
    );
    if (
      matches.length !== 1 ||
      canonicalReferenceJson(matches[0]!.content) !== canonicalReferenceJson(write.content)
    ) {
      throw new TypedKnowledgeReleaseUnavailableError();
    }
  }
  assertPublishedBundle(expected, releaseGraphContext, expected.attestation.issuedAt);
}

/**
 * T07's immutable generation is the durable time-mint envelope. The attestation
 * time is trusted only when its exact record and exact release were introduced
 * together by the deterministic system transaction, on the reachable lineage,
 * within the narrow server publication interval.
 */
function assertAttestationMintEnvelope(
  current: KnowledgePublicationSnapshot,
  bundle: PublishedBundle,
  prior: KnowledgePackRelease | null,
  readGeneration: (generationId: string) => KnowledgePublicationSnapshot
): Readonly<{ issuedAt: string; writes: readonly KnowledgePublicationWrite[] }> {
  const { release, attestation, rightsVerification } = bundle;
  const expectedAttestationRef = knowledgePublicationRecordRefForWrite({
    recordKind: "release_attestation",
    id: publicationId(attestation),
    successorRefs: [],
    content: attestation,
  });
  const expectedRightsVerificationRef = knowledgePublicationRecordRefForWrite({
    recordKind: "authority_verification",
    id: publicationId(rightsVerification),
    successorRefs: [],
    content: rightsVerification,
  });
  const visited = new Set<string>();
  let cursor = current;
  const lineageBound = current.generation.revision;
  for (let depth = 0; depth < lineageBound; depth += 1) {
    if (visited.has(cursor.generation.id)) {
      throw new TypedKnowledgeReleaseUnavailableError();
    }
    visited.add(cursor.generation.id);
    if (
      cursor.generation.newRecordRefs.some((reference) =>
        publicationRefsEqual(reference, expectedAttestationRef)
      )
    ) {
      const parent = readAndValidateParentGeneration(cursor, readGeneration);
      const expectedWrites = publicationWrites(bundle, parent, prior);
      const expectedTransaction = publicationTransaction(
        bundle,
        cursor.generation.parentGenerationRef ?? null,
        expectedWrites
      );
      const expectedNewRecordRefs = expectedNewRefs(expectedWrites, parent);
      const expectedReleaseWrite = expectedWrites.find(
        (write) =>
          write.recordKind === "knowledge_pack_release" && write.id === publicationId(release)
      );
      if (!expectedReleaseWrite) throw new TypedKnowledgeReleaseUnavailableError();
      const expectedReleaseRef = knowledgePublicationRecordRefForWrite(expectedReleaseWrite);
      const issuedAt = Date.parse(attestation.issuedAt);
      const evaluatedAt = Date.parse(rightsVerification.evaluatedAt);
      const createdAt = Date.parse(cursor.generation.createdAt);
      if (
        cursor.generation.transactionId !== expectedTransaction.transactionId ||
        cursor.generation.writerKind !== expectedTransaction.writerKind ||
        !sameNullableGenerationRef(
          cursor.generation.parentGenerationRef ?? null,
          expectedTransaction.expectedHead
        ) ||
        cursor.generation.requestDigest !==
          knowledgePublicationRequestDigestForTransaction(expectedTransaction) ||
        !samePublicationRefList(cursor.generation.newRecordRefs, expectedNewRecordRefs) ||
        !cursor.generation.newRecordRefs.some((reference) =>
          publicationRefsEqual(reference, expectedReleaseRef)
        ) ||
        !cursor.generation.newRecordRefs.some((reference) =>
          publicationRefsEqual(reference, expectedRightsVerificationRef)
        ) ||
        !cursor.generation.newRecordRefs.some((reference) =>
          publicationRefsEqual(reference, expectedAttestationRef)
        ) ||
        !Number.isFinite(issuedAt) ||
        !Number.isFinite(evaluatedAt) ||
        !Number.isFinite(createdAt) ||
        Math.abs(createdAt - issuedAt) > MAX_ATTESTATION_PUBLICATION_SKEW_MS ||
        Math.abs(createdAt - evaluatedAt) > MAX_ATTESTATION_PUBLICATION_SKEW_MS
      ) {
        throw new TypedKnowledgeReleaseUnavailableError();
      }
      return { issuedAt: attestation.issuedAt, writes: expectedWrites };
    }
    const parent = readAndValidateParentGeneration(cursor, readGeneration);
    if (!parent) break;
    cursor = parent;
  }
  throw new TypedKnowledgeReleaseUnavailableError();
}

function findPublishedBundle(
  snapshot: KnowledgePublicationSnapshot | null,
  seed: OwnerReferencePageAtlasKnowledgeReleaseSeed,
  graph: PublicationGraph,
  readGeneration: (generationId: string) => KnowledgePublicationSnapshot,
  verifyPersistedReceipt: ReferenceAuthorityReceiptVerifier | undefined
): PublishedBundle | null {
  if (!snapshot) return null;
  const segmentRef = knowledgeExternalEvidenceRef(seed.segment);
  const extractionRef = knowledgeExternalEvidenceRef(seed.extraction);
  const mappingProposalRef = knowledgeExternalEvidenceRef(seed.mapping);
  const questionProposalRef = knowledgeExternalEvidenceRef(seed.question);
  const matches = graph.releases.filter((release) => {
    const mapping = requireCandidate(release, MAPPING_CANDIDATE_FAMILY_ID);
    const question = requireCandidate(release, QUESTION_CANDIDATE_FAMILY_ID);
    return (
      sameSourceRefSet(mapping.sourceSegmentRefs, [segmentRef]) &&
      sameSourceRefSet(mapping.citedExtractionRefs, [extractionRef]) &&
      sameSourceRefSet(mapping.sourceProposalRefs, [mappingProposalRef]) &&
      sameSourceRefSet(question.sourceSegmentRefs, [segmentRef]) &&
      sameSourceRefSet(question.citedExtractionRefs, [extractionRef]) &&
      sameSourceRefSet(question.sourceProposalRefs, [questionProposalRef])
    );
  });
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new TypedKnowledgeReleaseUnavailableError();
  const bundle = loadPublishedBundle(
    snapshot,
    graph,
    matches[0]!,
    readGeneration,
    verifyPersistedReceipt
  );
  assertSourceClosureContinuation(bundle.rightsVerification, seed);
  return bundle;
}

function assertPublishedGraph(
  snapshot: KnowledgePublicationSnapshot | null,
  graph: PublicationGraph,
  readGeneration: (generationId: string) => KnowledgePublicationSnapshot,
  verifyPersistedReceipt: ReferenceAuthorityReceiptVerifier | undefined
): void {
  if (!snapshot && graph.releases.length === 0) return;
  if (!snapshot) throw new TypedKnowledgeReleaseUnavailableError();
  for (const release of graph.releases) {
    loadPublishedBundle(snapshot, graph, release, readGeneration, verifyPersistedReceipt);
  }
}

function loadPublishedBundle(
  snapshot: KnowledgePublicationSnapshot,
  graph: PublicationGraph,
  release: KnowledgePackRelease,
  readGeneration: (generationId: string) => KnowledgePublicationSnapshot,
  verifyPersistedReceipt: ReferenceAuthorityReceiptVerifier | undefined
): PublishedBundle {
  const draft = requirePublicationContent(
    snapshot,
    "knowledge_pack_draft",
    release.sourceDraftRef,
    validateKnowledgePackDraft
  );
  const attestations = snapshot.records
    .filter(
      (record) =>
        record.recordKind === "release_attestation" &&
        isTestOnlyAttestationForRelease(record.content, release)
    )
    .map((record) => validateSystemTestOnlyAttestationStructure(record.content));
  if (attestations.length !== 1) throw new TypedKnowledgeReleaseUnavailableError();
  const attestation = attestations[0]!;
  const systemIdentity = requirePublicationContent(
    snapshot,
    "knowledge_system_identity_snapshot",
    attestation.issuer.systemRef,
    validateKnowledgeSystemIdentitySnapshot
  );
  const testPolicy = requirePublicationContent(
    snapshot,
    "knowledge_test_policy",
    attestation.testPolicyRef,
    validateKnowledgeTestPolicy
  );
  if (canonicalReferenceJson(testPolicy) !== canonicalReferenceJson(TYPED_KNOWLEDGE_TEST_POLICY)) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  const authorityVerifications = snapshot.records
    .filter(
      (record) =>
        record.recordKind === "authority_verification" &&
        isAuthorityVerificationForRelease(record.content, release)
    )
    .map((record) => validateTypedKnowledgeAuthorityVerification(record.content));
  if (authorityVerifications.length !== 1 || !verifyPersistedReceipt) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  const rightsVerification = authorityVerifications[0]!;
  if (!verifyPersistedTypedKnowledgeAuthorityReceipt(rightsVerification, verifyPersistedReceipt)) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  assertRightsVerificationMatchesRelease(rightsVerification, release);
  const releaseGraphContext = graphContextForRelease(graph, release);
  const bundle = bundleFromRelease(
    release,
    draft,
    rightsVerification,
    systemIdentity,
    testPolicy,
    attestation,
    releaseGraphContext
  );
  const prior =
    release.sequence === 1
      ? null
      : (graph.releases.find(({ sequence }) => sequence === release.sequence - 1) ?? null);
  const mint = assertAttestationMintEnvelope(snapshot, bundle, prior, readGeneration);
  validateSystemTestOnlyAttestation(attestation, {
    release,
    releaseGraphContext,
    systemIdentity,
    testPolicy,
    expectedIssuedAt: mint.issuedAt,
  });
  assertPublishedBundle(bundle, releaseGraphContext, mint.issuedAt);
  assertPublishedWrites(snapshot, mint.writes, bundle, releaseGraphContext);
  return bundle;
}

function bundleFromRelease(
  release: KnowledgePackRelease,
  draft: KnowledgePackDraft,
  rightsVerification: TypedKnowledgeAuthorityVerification,
  systemIdentity: KnowledgeSystemIdentitySnapshot,
  testPolicy: KnowledgeTestPolicy,
  attestation: SystemTestOnlyAttestation,
  releaseGraphContext: KnowledgeReleaseGraphContext
): PublishedBundle {
  validateKnowledgeReleaseGraph(release, releaseGraphContext);
  if (!sourceRefsEqual(release.sourceDraftRef, draft)) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  const mapping = requireCandidate(release, MAPPING_CANDIDATE_FAMILY_ID);
  const question = requireCandidate(release, QUESTION_CANDIDATE_FAMILY_ID);
  if (
    release.applicabilityPredicates.length !== 2 ||
    release.constraintDerivations.length !== 1 ||
    release.componentClosure.length !== 1 ||
    release.componentMappings.length !== 1 ||
    release.profiles.length !== 1
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  return {
    predicates: release.applicabilityPredicates,
    candidates: [mapping, question],
    evidenceEdges: release.evidenceEdges,
    derivation: release.constraintDerivations[0]!,
    componentBinding: release.componentClosure[0]!,
    componentMapping: release.componentMappings[0]!,
    profile: release.profiles[0]!,
    draft,
    release,
    rightsVerification,
    systemIdentity,
    testPolicy,
    attestation,
  };
}

function publicationGraph(snapshot: KnowledgePublicationSnapshot | null): PublicationGraph {
  if (!snapshot) {
    return {
      context: { schemaVersion: 1, drafts: [], releases: [] },
      drafts: [],
      releases: [],
    };
  }
  const drafts = snapshot.records
    .filter(
      (record) =>
        record.recordKind === "knowledge_pack_draft" &&
        isPlainRecord(record.content) &&
        record.content.packId === PACK_ID
    )
    .map((record) => {
      const draft = validateKnowledgePackDraft(record.content);
      if (record.id !== publicationId(draft)) {
        throw new TypedKnowledgeReleaseUnavailableError();
      }
      return draft;
    })
    .sort((left, right) => left.revision - right.revision);
  const releases = snapshot.records
    .filter(
      (record) =>
        record.recordKind === "knowledge_pack_release" &&
        isPlainRecord(record.content) &&
        record.content.packId === PACK_ID
    )
    .map((record) => {
      const release = validateKnowledgePackRelease(record.content);
      if (record.id !== publicationId(release)) {
        throw new TypedKnowledgeReleaseUnavailableError();
      }
      return release;
    })
    .sort((left, right) => left.sequence - right.sequence);
  const context: KnowledgeReleaseGraphContext = {
    schemaVersion: 1,
    drafts,
    releases,
  };
  if (drafts.length !== releases.length) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  releases.forEach((release, index) => {
    const expectedSequence = index + 1;
    const predecessor = releases[index - 1] ?? null;
    if (
      release.sequence !== expectedSequence ||
      (predecessor === null) !== (release.predecessorRef === null) ||
      (predecessor && !sourceRefsEqual(release.predecessorRef!, predecessor))
    ) {
      throw new TypedKnowledgeReleaseUnavailableError();
    }
    const releaseContext = graphContextForRelease({ context, drafts, releases }, release);
    validateKnowledgeReleaseGraph(release, releaseContext);
    assertReleaseShape(release);
  });
  const referencedDrafts = releases.map(({ sourceDraftRef }) => sourceDraftRef);
  if (
    drafts.some(
      (draft) =>
        referencedDrafts.filter((reference) => sourceRefsEqual(reference, draft)).length !== 1
    )
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  return { context, drafts, releases };
}

function latestPackRelease(graph: PublicationGraph): KnowledgePackRelease | null {
  return graph.releases.at(-1) ?? null;
}

function graphContextForRelease(
  graph: PublicationGraph,
  release: KnowledgePackRelease
): KnowledgeReleaseGraphContext {
  const dependencyRefs = release.dependencyClosure.map(({ releaseRef }) => releaseRef);
  const dependencyReleases = graph.releases.filter((candidate) =>
    dependencyRefs.some((reference) => sourceRefsEqual(reference, candidate))
  );
  if (dependencyReleases.length !== dependencyRefs.length) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  const requiredDraftRefs = [
    release.sourceDraftRef,
    ...dependencyReleases.map(({ sourceDraftRef }) => sourceDraftRef),
  ];
  const drafts = graph.drafts.filter((draft) =>
    requiredDraftRefs.some((reference) => sourceRefsEqual(reference, draft))
  );
  if (drafts.length !== requiredDraftRefs.length) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  return { schemaVersion: 1, drafts, releases: dependencyReleases };
}

function graphContextWithBundle(
  graph: PublicationGraph,
  bundle: CompiledBundle
): KnowledgeReleaseGraphContext {
  return graphContextWithBundleContext(graph.context, bundle);
}

function graphContextWithBundleContext(
  dependencyContext: KnowledgeReleaseGraphContext,
  bundle: CompiledBundle
): KnowledgeReleaseGraphContext {
  return {
    schemaVersion: 1,
    drafts: [...dependencyContext.drafts, bundle.draft],
    releases: [...dependencyContext.releases],
  };
}

function dependencyContextForRelease(
  releaseGraphContext: KnowledgeReleaseGraphContext,
  release: KnowledgePackRelease
): KnowledgeReleaseGraphContext {
  return {
    schemaVersion: 1,
    drafts: releaseGraphContext.drafts.filter(
      (draft) => !sourceRefsEqual(draft, release.sourceDraftRef)
    ),
    releases: [...releaseGraphContext.releases],
  };
}

function requireCandidate(release: KnowledgePackRelease, familyId: string): KnowledgeCandidate {
  const matches = release.candidates
    .filter((candidate) => candidate.familyId === familyId)
    .sort((left, right) => right.version - left.version);
  if (matches.length === 0 || matches[0]!.version !== release.sequence) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  return validateKnowledgeCandidate(matches[0]);
}

function assertCompiledBundle(
  bundle: CompiledBundle,
  releaseGraphContext: KnowledgeReleaseGraphContext
): void {
  bundle.predicates.forEach(validateKnowledgeApplicabilityPredicate);
  bundle.candidates.forEach(validateKnowledgeCandidate);
  bundle.evidenceEdges.forEach(validateKnowledgeEvidenceEdge);
  validateKnowledgeConstraintDerivation(bundle.derivation);
  assertTrustedComponentBinding(validateKnowledgeComponentBinding(bundle.componentBinding));
  validateKnowledgeComponentMapping(bundle.componentMapping);
  validateKnowledgeProfile(bundle.profile);
  const dependencyContext = dependencyContextForRelease(releaseGraphContext, bundle.release);
  validateKnowledgeDraftGraph(bundle.draft, dependencyContext);
  validateKnowledgeReleaseGraph(bundle.release, releaseGraphContext);
  assertReleaseMatchesDraft(bundle.release, bundle.draft, releaseGraphContext);
  assertReleaseShape(bundle.release);
}

function assertReleaseMatchesDraft(
  release: KnowledgePackRelease,
  draft: KnowledgePackDraft,
  releaseGraphContext: KnowledgeReleaseGraphContext
): void {
  const validated = validateKnowledgeReleaseGraph(release, releaseGraphContext);
  if (
    !sourceRefsEqual(validated.sourceDraftRef, draft) ||
    !releaseGraphContext.drafts.some(
      (candidate) =>
        sourceRefsEqual(candidate, draft) &&
        canonicalReferenceJson(candidate) === canonicalReferenceJson(draft)
    )
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function assertPublishedBundle(
  bundle: PublishedBundle,
  releaseGraphContext: KnowledgeReleaseGraphContext,
  expectedIssuedAt: string
): void {
  assertCompiledBundle(bundle, releaseGraphContext);
  const rightsVerification = validateTypedKnowledgeAuthorityVerification(bundle.rightsVerification);
  assertRightsVerificationMatchesRelease(rightsVerification, bundle.release);
  const systemIdentity = validateKnowledgeSystemIdentitySnapshot(bundle.systemIdentity);
  const testPolicy = validateKnowledgeTestPolicy(bundle.testPolicy);
  const attestation = validateSystemTestOnlyAttestation(bundle.attestation, {
    release: bundle.release,
    releaseGraphContext,
    systemIdentity,
    testPolicy,
    expectedIssuedAt,
  });
  if (
    !sourceRefsEqual(attestation.releaseRef, bundle.release) ||
    canonicalReferenceJson(testPolicy) !== canonicalReferenceJson(TYPED_KNOWLEDGE_TEST_POLICY) ||
    attestation.authorityDisposition !== "test_only_no_authority" ||
    Object.values(attestation.authorityClaims).some((claim) => claim !== false)
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function assertRightsVerificationMatchesRelease(
  authorityVerification: TypedKnowledgeAuthorityVerification,
  release: KnowledgePackRelease
): void {
  const validated = validateTypedKnowledgeAuthorityVerification(authorityVerification);
  if (
    !sourceRefsEqual(validated.releaseRef, release) ||
    !sameTypedRefSet(validated.derivativeRefs, release.citedEvidenceRefs) ||
    validated.operation !== "pack_citation" ||
    validated.destination.kind !== "repository" ||
    validated.destination.id !== PACK_CITATION_REPOSITORY_ID ||
    validated.purpose !== PACK_CITATION_PURPOSE ||
    !sourceRefsEqual(validated.accessPolicyRef, TYPED_KNOWLEDGE_PACK_CITATION_POLICY_REF) ||
    !sourceRefsEqual(validated.verifierRef, TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_REF) ||
    !sourceRefsEqual(validated.verifierPolicyRef, TYPED_KNOWLEDGE_PACK_CITATION_VERIFIER_POLICY_REF)
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function assertSourceClosureContinuation(
  priorVerification: TypedKnowledgeAuthorityVerification,
  seed: OwnerReferencePageAtlasKnowledgeReleaseSeed
): void {
  const currentSourceRefs = sortTypedSourceRefs([
    typedSourceRef(seed.work),
    typedSourceRef(seed.manifestation),
    typedSourceRef(seed.exemplar),
    typedSourceRef(seed.digitalAsset),
    typedSourceRef(seed.acquisition),
  ]);
  if (!sameTypedRefSet(priorVerification.sourceRefs, currentSourceRefs)) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function assertReleaseShape(release: KnowledgePackRelease): void {
  if (
    release.packId !== PACK_ID ||
    release.authorityLane !== "historical_practice" ||
    release.profiles.some((profile) => profile.defaultActivation !== "inactive") ||
    release.componentClosure.length !== 1
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
  assertTrustedComponentBinding(release.componentClosure[0]!);
  requireCandidate(release, MAPPING_CANDIDATE_FAMILY_ID);
  const question = requireCandidate(release, QUESTION_CANDIDATE_FAMILY_ID);
  if (
    question.proposition.kind !== "course_thirteen_notation_question" ||
    question.proposition.state !== "unresolved" ||
    question.activationAllowed
  ) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function assertTrustedComponentBinding(binding: KnowledgeComponentBinding): void {
  const expected = {
    recordKind: "knowledge_component_binding",
    schemaVersion: 1,
    id: "knowledge-component-binding.mace-diapason-signs.v1",
    authorityLane: "historical_practice",
    ...TYPED_KNOWLEDGE_MACE_COMPONENT_REGISTRY_CONTRACT,
  };
  const rebuilt = buildKnowledgeComponentBinding(expected);
  if (canonicalReferenceJson(binding) !== canonicalReferenceJson(rebuilt)) {
    throw new TypedKnowledgeReleaseUnavailableError();
  }
}

function requirePublicationContent<T>(
  snapshot: KnowledgePublicationSnapshot,
  kind: KnowledgePublicationRecordKind,
  ref: KnowledgeRecordRef,
  validate: (value: unknown) => T
): T {
  const matches = snapshot.records
    .filter(
      (record) =>
        record.recordKind === kind &&
        isPlainRecord(record.content) &&
        record.content.id === ref.id &&
        record.content.digest === ref.digest &&
        record.id === `published.${kind}.${ref.digest}`
    )
    .map((record) => ({ record, content: validate(record.content) }))
    .filter(({ content }) => isKnowledgeContent(content) && sourceRefsEqual(content, ref));
  if (matches.length !== 1) throw new TypedKnowledgeReleaseUnavailableError();
  return matches[0]!.content;
}

function projectBundle(
  input: Readonly<{
    selection: TypedKnowledgeReleaseSelection;
    snapshot: KnowledgePublicationSnapshot | null;
    bundle: CompiledBundle | PublishedBundle;
    publicationOutcome:
      | "preview_candidate"
      | "preview_existing"
      | "publish_committed"
      | "publish_idempotent";
    publicationCapability: PublicationCapability;
  }>
): TypedKnowledgeReleaseProjection {
  const attestation = "attestation" in input.bundle ? input.bundle.attestation : null;
  const shared = {
    schemaVersion: 1 as const,
    selection: structuredClone(input.selection),
    candidate: {
      mappingCandidateRef: knowledgeRef(input.bundle.candidates[0]),
      course13QuestionCandidateRef: knowledgeRef(input.bundle.candidates[1]),
      authorityLane: "historical_practice" as const,
      activationAllowed: false as const,
    },
    draft: {
      draftRef: knowledgeRef(input.bundle.draft),
      contentMerkleRoot: input.bundle.draft.contentMerkleRoot,
      closureMerkleRoot: input.bundle.draft.closureMerkleRoot,
    },
    release: {
      releaseRef: knowledgeRef(input.bundle.release),
      sequence: input.bundle.release.sequence,
      sourceDraftRef: input.bundle.release.sourceDraftRef,
      contentMerkleRoot: input.bundle.release.contentMerkleRoot,
      merkleRoot: input.bundle.release.merkleRoot,
      predecessorReleaseRef: input.bundle.release.predecessorRef,
      successorState: input.bundle.release.predecessorRef
        ? ("successor" as const)
        : ("initial" as const),
    },
    ordinaryActivation: {
      state: "not_evaluated" as const,
      defaultActivation: "deny" as const,
    },
  };
  const publicationHead = generationRef(input.snapshot);
  const projection =
    input.publicationOutcome === "preview_candidate"
      ? {
          ...shared,
          publicationState: "candidate" as const,
          publicationOutcome: "preview_candidate" as const,
          publicationHead,
          publicationCapability: input.publicationCapability,
          packCitationAuthority: "not_evaluated" as const,
          testAttestation: { state: "not_issued" as const },
        }
      : (() => {
          if (!attestation || !publicationHead) {
            throw new TypedKnowledgeReleaseUnavailableError();
          }
          return {
            ...shared,
            publicationState: "published" as const,
            publicationOutcome: input.publicationOutcome,
            publicationHead,
            publicationCapability: input.publicationCapability,
            packCitationAuthority: "verified_for_publication" as const,
            testAttestation: {
              state: "issued_test_only" as const,
              attestationRef: knowledgeRef(attestation),
              testPolicyRef: attestation.testPolicyRef,
              humanAuthority: false as const,
              historicalAuthority: false as const,
              activationAuthority: false as const,
            },
          };
        })();
  return Value.Decode(TypedKnowledgeReleaseProjectionSchema, projection);
}

function generationRef(
  snapshot: KnowledgePublicationSnapshot | null
): TypedKnowledgePublicationGenerationRef | null {
  if (!snapshot) return null;
  return {
    id: snapshot.generation.id,
    digest: snapshot.generation.digest,
    revision: snapshot.generation.revision,
  };
}

function sourceRef(value: { readonly id: string; readonly digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function typedSourceRef(value: TypedKnowledgeAuthoritySourceRef): TypedKnowledgeAuthoritySourceRef {
  return { recordKind: value.recordKind, id: value.id, digest: value.digest };
}

function knowledgeExternalEvidenceRef(
  value: KnowledgeExternalEvidenceRef
): KnowledgeExternalEvidenceRef {
  return { recordKind: value.recordKind, id: value.id, digest: value.digest };
}

function sortSourceRefs<T extends ReferenceRecordRef>(refs: readonly T[]): T[] {
  return [...refs].sort(
    (left, right) =>
      compareCodePoints(left.id, right.id) || compareCodePoints(left.digest, right.digest)
  );
}

function sortTypedSourceRefs(
  refs: readonly TypedKnowledgeAuthoritySourceRef[]
): TypedKnowledgeAuthoritySourceRef[] {
  return [...refs].sort(
    (left, right) =>
      compareCodePoints(left.recordKind, right.recordKind) ||
      compareCodePoints(left.id, right.id) ||
      compareCodePoints(left.digest, right.digest)
  );
}

function sortExternalEvidenceRefs(
  refs: readonly KnowledgeExternalEvidenceRef[]
): KnowledgeExternalEvidenceRef[] {
  return [...refs].sort(
    (left, right) =>
      compareCodePoints(left.recordKind, right.recordKind) ||
      compareCodePoints(left.id, right.id) ||
      compareCodePoints(left.digest, right.digest)
  );
}

function uniqueExternalEvidenceRefs(
  refs: readonly KnowledgeExternalEvidenceRef[]
): KnowledgeExternalEvidenceRef[] {
  return [
    ...new Map(
      refs.map((reference) => [
        `${reference.recordKind}\u0000${reference.id}\u0000${reference.digest}`,
        reference,
      ])
    ).values(),
  ];
}

function sortSubjectFacets(
  values: readonly ReferenceAuthoritySubjectFacetRequirement[]
): ReferenceAuthoritySubjectFacetRequirement[] {
  return [...values].sort(
    (left, right) =>
      compareCodePoints(left.subjectRef.id, right.subjectRef.id) ||
      compareCodePoints(left.subjectRef.digest, right.subjectRef.digest) ||
      compareCodePoints(left.facet, right.facet)
  );
}

function sourceRefsEqual(
  left: { readonly id: string; readonly digest: string },
  right: { readonly id: string; readonly digest: string }
): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function sameSourceRefSet(
  left: readonly ReferenceRecordRef[],
  right: readonly ReferenceRecordRef[]
): boolean {
  return (
    canonicalReferenceJson(sortSourceRefs(left)) === canonicalReferenceJson(sortSourceRefs(right))
  );
}

function sameSubjectFacetSet(
  left: readonly ReferenceAuthoritySubjectFacetRequirement[],
  right: readonly ReferenceAuthoritySubjectFacetRequirement[]
): boolean {
  return (
    canonicalReferenceJson(sortSubjectFacets(left)) ===
    canonicalReferenceJson(sortSubjectFacets(right))
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    canonicalReferenceJson([...left].sort(compareCodePoints)) ===
    canonicalReferenceJson([...right].sort(compareCodePoints))
  );
}

function sameTypedRefSet(
  left: ReadonlyArray<ReferenceRecordRef & { recordKind: string }>,
  right: ReadonlyArray<ReferenceRecordRef & { recordKind: string }>
): boolean {
  const keys = (values: ReadonlyArray<ReferenceRecordRef & { recordKind: string }>) =>
    values
      .map(({ recordKind, id, digest }) => `${recordKind}\u0000${id}\u0000${digest}`)
      .sort(compareCodePoints);
  return canonicalReferenceJson(keys(left)) === canonicalReferenceJson(keys(right));
}

function sameGenerationRef(
  left: TypedKnowledgePublicationGenerationRef,
  right: TypedKnowledgePublicationGenerationRef
): boolean {
  return left.id === right.id && left.digest === right.digest && left.revision === right.revision;
}

function sameNullableGenerationRef(
  left: TypedKnowledgePublicationGenerationRef | null,
  right: TypedKnowledgePublicationGenerationRef | null
): boolean {
  return left === null || right === null ? left === right : sameGenerationRef(left, right);
}

function publicationRefsEqual(
  left: KnowledgePublicationRecordRef,
  right: KnowledgePublicationRecordRef
): boolean {
  return (
    left.recordKind === right.recordKind && left.id === right.id && left.digest === right.digest
  );
}

function sortPublicationRefs(
  refs: readonly KnowledgePublicationRecordRef[]
): KnowledgePublicationRecordRef[] {
  return [...refs].sort(
    (left, right) =>
      compareCodePoints(left.recordKind, right.recordKind) ||
      compareCodePoints(left.id, right.id) ||
      compareCodePoints(left.digest, right.digest)
  );
}

function samePublicationRefList(
  left: readonly KnowledgePublicationRecordRef[],
  right: readonly KnowledgePublicationRecordRef[]
): boolean {
  return (
    canonicalReferenceJson(sortPublicationRefs(left)) ===
    canonicalReferenceJson(sortPublicationRefs(right))
  );
}

function isKnowledgeContent(value: unknown): value is { id: string; digest: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "digest" in value &&
    typeof value.digest === "string"
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTestOnlyAttestationForRelease(value: unknown, release: KnowledgePackRelease): boolean {
  if (!isPlainRecord(value) || value.kind !== "test_only") return false;
  const releaseRef = value.releaseRef;
  return (
    isPlainRecord(releaseRef) &&
    releaseRef.id === release.id &&
    releaseRef.digest === release.digest
  );
}

function isAuthorityVerificationForRelease(value: unknown, release: KnowledgePackRelease): boolean {
  if (!isPlainRecord(value) || value.recordKind !== "authority_verification") return false;
  const releaseRef = value.releaseRef;
  return (
    isPlainRecord(releaseRef) &&
    releaseRef.id === release.id &&
    releaseRef.digest === release.digest
  );
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertNotCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new TypedKnowledgeReleaseCancelledError();
}

function withTypedKnowledgeIntegrityBoundary<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof TypedKnowledgeReleaseError) throw error;
    throw new TypedKnowledgeReleaseUnavailableError({ cause: error });
  }
}

export type TypedKnowledgeReleaseErrorCode =
  | "typed_knowledge_release_stale"
  | "typed_knowledge_release_cancelled"
  | "typed_knowledge_release_pack_citation_authority_required"
  | "typed_knowledge_release_conflict"
  | "typed_knowledge_release_unavailable";

export class TypedKnowledgeReleaseError extends Error {
  constructor(
    readonly code: TypedKnowledgeReleaseErrorCode,
    readonly status: 403 | 409 | 503,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "TypedKnowledgeReleaseError";
  }
}

export class TypedKnowledgeReleaseStaleError extends TypedKnowledgeReleaseError {
  constructor(options?: ErrorOptions) {
    super(
      "typed_knowledge_release_stale",
      409,
      "The typed Knowledge release selection is no longer current",
      options
    );
    this.name = "TypedKnowledgeReleaseStaleError";
  }
}

export class TypedKnowledgeReleaseCancelledError extends TypedKnowledgeReleaseError {
  constructor(options?: ErrorOptions) {
    super(
      "typed_knowledge_release_cancelled",
      409,
      "The typed Knowledge release operation was cancelled before publication",
      options
    );
    this.name = "TypedKnowledgeReleaseCancelledError";
  }
}

export class TypedKnowledgeReleaseAuthorityError extends TypedKnowledgeReleaseError {
  constructor(options?: ErrorOptions) {
    super(
      "typed_knowledge_release_pack_citation_authority_required",
      403,
      "Exact current pack-citation authority is required",
      options
    );
    this.name = "TypedKnowledgeReleaseAuthorityError";
  }
}

export class TypedKnowledgeReleaseConflictError extends TypedKnowledgeReleaseError {
  constructor(options?: ErrorOptions) {
    super(
      "typed_knowledge_release_conflict",
      409,
      "The Knowledge publication head changed before release",
      options
    );
    this.name = "TypedKnowledgeReleaseConflictError";
  }
}

export class TypedKnowledgeReleaseUnavailableError extends TypedKnowledgeReleaseError {
  constructor(options?: ErrorOptions) {
    super(
      "typed_knowledge_release_unavailable",
      503,
      "The typed Knowledge release is unavailable",
      options
    );
    this.name = "TypedKnowledgeReleaseUnavailableError";
  }
}
