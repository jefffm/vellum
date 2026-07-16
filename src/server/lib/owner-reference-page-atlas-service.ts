import { createHash } from "node:crypto";

import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  REFERENCE_PAGE_ATLAS_CITED_SEGMENT_LINEAGE_MAX_VERSIONS,
  ReferencePageAtlasCancelRequestSchema,
  ReferencePageAtlasCorrectMappingRequestSchema,
  ReferencePageAtlasPreviewRequestSchema,
  ReferencePageAtlasProjectionSchema,
  ReferencePageAtlasReadRequestSchema,
  ReferencePageAtlasStartRequestSchema,
  ReferencePageAtlasResumeRequestSchema,
  type ReferencePageAtlasCancelRequest,
  type ReferencePageAtlasCorrectMappingRequest,
  type ReferencePageAtlasOpaqueHmacRef,
  type ReferencePageAtlasPreviewRequest,
  type ReferencePageAtlasProfile,
  type ReferencePageAtlasProjection,
  type ReferencePageAtlasReadRequest,
  type ReferencePageAtlasResumeRequest,
  type ReferencePageAtlasStartRequest,
} from "../../lib/reference-page-atlas-contract.js";
import {
  TypedKnowledgeReleaseSelectionSchema,
  type TypedKnowledgeReleaseSelection,
} from "../../lib/typed-knowledge-release-contract.js";
import {
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceAssetIdentityResolution,
  type ReferenceCitedExtractionVersion,
  type ReferenceCitationSuccessor,
  type ReferenceDigitalAsset,
  type ReferenceExtractionProposal,
  type ReferencePageAtlasAttempt,
  type ReferencePageAtlasCanvas,
  type ReferencePageAtlasCorrection,
  type ReferencePageAtlasVersion,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceIdentityAssertion,
  type ReferenceSourceManifestation,
  type ReferenceSourceSegmentVersion,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingTransaction,
  type ReferenceWork,
  type ReferenceExemplar,
  type VersionedReferenceRecordRef,
} from "../../lib/reference-source-domain.js";
import type { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import {
  ReferenceSourceOperationGateway,
  referenceSourceAcquisitionIsCurrentAndApplicable,
  type ReferenceSourceOperationEffects,
  type ReferenceSourceOperationScope,
} from "./reference-source-operation-gateway.js";
import {
  ReferencePageAtlasParserError,
  type ReferencePageAtlasInspection,
  type ReferencePageAtlasParser,
  type ReferencePageAtlasParserFailureCode,
  type ReferencePageAtlasRenderedPage,
  type ReferencePageAtlasRuntimeIdentity,
} from "./reference-page-atlas-parser.js";
import {
  ExactAssetReferencePageAtlasSourceProfileResolver,
  type MacePageAtlasSourceProfile,
  type ReferencePageAtlasSourceProfileResolver,
} from "./reference-page-atlas-source-profile.js";
import {
  assertReferenceSourceStagingSnapshotIntegrity,
  OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF,
  OWNER_LOCAL_EXTRACTION_POLICY_REF,
  OWNER_LOCAL_EXTRACTION_RATIONALE,
  type OwnerLocalExtractionStagingWriter,
  type ReferenceSourcePageAtlasStagingWriter,
} from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingConflictError,
  type ReferenceSourceStagingState,
  type ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

type OpaqueProjector = Readonly<{
  project: (kind: string, value: unknown) => ReferenceRecordRef;
}>;

export type OwnerReferencePageAtlasResolvedContext = Readonly<{
  currentWorkbenchSnapshotRef: ReferenceRecordRef;
  currentWorkbenchCardRef: ReferenceRecordRef;
  currentStagingSnapshotRef: ReferenceRecordRef;
  acquisition: ReferenceAssetAcquisition;
  digitalAsset: ReferenceDigitalAsset;
}>;

export type OwnerReferencePageAtlasMutationReceipt = Readonly<{
  status: "accepted";
  operationRef: ReferencePageAtlasOpaqueHmacRef;
  replayed: boolean;
}>;

export type OwnerReferencePageAtlasPreview = Readonly<{
  mediaType: "image/png";
  bytes: Uint8Array;
  widthPixels: number;
  heightPixels: number;
}>;

/**
 * Exact process-private source material for the typed release compiler.
 *
 * This value must never cross the HTTP boundary. The browser supplies only
 * keyed Page Atlas commitments; this service resolves them again against the
 * current staging snapshot and returns the complete rights-scoped source
 * closure to the server-side publisher.
 */
export type OwnerReferencePageAtlasKnowledgeReleaseSeed = Readonly<{
  stagingSnapshotRef: ReferenceRecordRef;
  work: ReferenceWork;
  manifestation: ReferenceSourceManifestation;
  exemplar: ReferenceExemplar;
  digitalAsset: ReferenceDigitalAsset;
  acquisition: ReferenceAssetAcquisition;
  segment: ReferenceSourceSegmentVersion;
  extraction: ReferenceCitedExtractionVersion;
  mapping: ReferenceExtractionProposal & {
    proposal: Extract<
      ReferenceExtractionProposal["proposal"],
      { kind: "twelve_course_diapason_mapping" }
    >;
  };
  question: ReferenceExtractionProposal & {
    proposal: Extract<
      ReferenceExtractionProposal["proposal"],
      { kind: "course_thirteen_notation_question" }
    >;
  };
}>;

export type OwnerReferencePageAtlasServiceOptions = Readonly<{
  localExtractionWriter: OwnerLocalExtractionStagingWriter;
  pageAtlasWriter: ReferenceSourcePageAtlasStagingWriter;
  stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">;
  controlledArtifacts: Pick<ReferenceSourceControlledArtifactStore, "readDigitalAssetBytes">;
  parser: ReferencePageAtlasParser;
  sourceProfileResolver?: ReferencePageAtlasSourceProfileResolver;
  opaqueProjector: OpaqueProjector;
  now?: () => Date;
  resumeBatchPages?: number;
}>;

type AuthorizationIdentity = Readonly<{
  suffix: string;
  rightsId: string;
  decisionId: string;
  scopeEvidenceRef: ReferenceRecordRef;
  operationRef: ReferenceRecordRef;
  purpose: string;
}>;

type AuthorizationPair = Readonly<{
  rights: ReferenceRightsAssertion;
  decision: ReferenceAccessDecision;
}>;

type LocalExtractionCapability = Readonly<{
  snapshotRef: ReferenceRecordRef;
  acquisitionRef: ReferenceRecordRef;
  digitalAssetRef: ReferenceRecordRef;
  rightsAssertionRef: ReferenceRecordRef;
  accessDecisionRef: ReferenceRecordRef;
  purpose: string;
}>;

type OperationGraph = Readonly<{
  suffix: string;
  profile: ReferencePageAtlasProfile;
  attempts: readonly ReferencePageAtlasAttempt[];
  atlases: readonly ReferencePageAtlasVersion[];
  corrections: readonly ReferencePageAtlasCorrection[];
  segments: readonly ReferenceSourceSegmentVersion[];
  extractions: readonly ReferenceCitedExtractionVersion[];
  proposals: readonly ReferenceExtractionProposal[];
  citationSuccessors: readonly ReferenceCitationSuccessor[];
}>;

type ReferenceSourceAppendableRecord = Exclude<
  ReferenceSourceStagingRecord,
  { recordKind: "invalidation" }
>;

type ProjectionRequestScope = Readonly<{
  workbenchSnapshotRef: ReferenceRecordRef;
  workbenchCardRef: ReferenceRecordRef;
  operationRef: ReferenceRecordRef;
}>;

type PageAtlasExecutionIdentity = Readonly<{
  componentRef: ReferenceRecordRef;
  configurationDigest: string;
  resourcePolicyRef: ReferenceRecordRef;
}>;

type ActivePageAtlasRun = Readonly<{
  controller: AbortController;
  signal: AbortSignal;
  detachUpstream: () => void;
}>;

const DEFAULT_RESUME_BATCH_PAGES = 8;
const MAX_RESUME_BATCH_PAGES = 64;
const OPERATION_ID = /^page-atlas\.owner\.(generic|mace)\.([a-f0-9]{32})$/u;
const ATTEMPT_ID = /^page-atlas-attempt\.owner\.(generic|mace)\.([a-f0-9]{32})\.([0-9]+)$/u;
const SAFE_PDF_MEDIA_TYPE = "application/pdf";

const PAGE_ATLAS_RESOURCE_POLICY_REF: ReferenceRecordRef = Object.freeze({
  id: "resource-policy.page-atlas.bounded-local.v1",
  digest: referenceSourceDigest({
    schemaVersion: 1,
    id: "resource-policy.page-atlas.bounded-local.v1",
    processing: "local_only",
    network: "disabled",
    subprocess: "bounded",
    sourceDiagnostics: "redacted",
  }),
});
const PAGE_ATLAS_OWNER_REF = externalRef("owner.local-reference-reviewer.v1");

/**
 * Owner-attested local Page Atlas and cited-extraction workflow.
 *
 * The only byte-bearing edge is the process-private gateway capability. The
 * durable graph stores exact source refs and immutable geometry, while every
 * value returned to the browser is a keyed, non-resolving projection.
 */
export class OwnerReferencePageAtlasService {
  private readonly localExtractionWriter: OwnerLocalExtractionStagingWriter;
  private readonly pageAtlasWriter: ReferenceSourcePageAtlasStagingWriter;
  private readonly stagingStore: Pick<ReferenceSourceStagingStore, "readCurrentState">;
  private readonly controlledArtifacts: Pick<
    ReferenceSourceControlledArtifactStore,
    "readDigitalAssetBytes"
  >;
  private readonly parser: ReferencePageAtlasParser;
  private readonly sourceProfileResolver: ReferencePageAtlasSourceProfileResolver;
  private readonly opaqueProjector: OpaqueProjector;
  private readonly now: () => Date;
  private readonly resumeBatchPages: number;
  private readonly issuedCapabilities = new WeakSet<object>();
  private readonly activeRuns = new Map<string, Set<AbortController>>();
  private readonly gateway: ReferenceSourceOperationGateway;

  constructor(options: OwnerReferencePageAtlasServiceOptions) {
    this.localExtractionWriter = options.localExtractionWriter;
    this.pageAtlasWriter = options.pageAtlasWriter;
    this.stagingStore = options.stagingStore;
    this.controlledArtifacts = options.controlledArtifacts;
    this.parser = options.parser;
    this.sourceProfileResolver =
      options.sourceProfileResolver ?? new ExactAssetReferencePageAtlasSourceProfileResolver();
    this.opaqueProjector = options.opaqueProjector;
    this.now = options.now ?? (() => new Date());
    this.resumeBatchPages = decodeResumeBatchPages(
      options.resumeBatchPages ?? DEFAULT_RESUME_BATCH_PAGES
    );
    this.gateway = new ReferenceSourceOperationGateway({
      stagingStore: this.stagingStore,
      verifyAllowCapability: (input) => this.verifyCapability(input),
      now: this.now,
    });
  }

  async start(
    input: Readonly<{
      request: ReferencePageAtlasStartRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ): Promise<OwnerReferencePageAtlasMutationReceipt> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(ReferencePageAtlasStartRequestSchema, input.request);
    assertWorkbenchCard(request, input.context);
    assertPdfContext(input.context);
    const identity = this.authorizationIdentity(request, input.context);
    let state = this.readCurrentState();
    const existingGraph = locateOperationBySuffix(
      state.snapshot.records,
      identity.suffix,
      request.profile
    );
    if (existingGraph && existingGraph.atlases.length > 0) {
      assertCurrentSource(state, input.context, this.now().toISOString());
      this.assertStartAuthorization(state, identity, input.context);
      return receipt(identity.operationRef, true);
    }

    let pair = locateAuthorizationPair(state.snapshot.records, identity);
    if (
      !existingGraph &&
      !pair &&
      !refsEqual(request.workbenchSnapshotRef, input.context.currentWorkbenchSnapshotRef)
    ) {
      throw new OwnerReferencePageAtlasStaleError();
    }
    if (pair) {
      assertExactAuthorizationPair(pair, identity, input.context.acquisition);
    } else {
      if (!refsEqual(refFor(state.snapshot), input.context.currentStagingSnapshotRef)) {
        throw new OwnerReferencePageAtlasStaleError();
      }
      assertCurrentSource(state, input.context, this.now().toISOString());
      pair = this.commitAuthorization(identity, input.context.acquisition, state);
      state = this.readCurrentState();
      const committed = locateAuthorizationPair(state.snapshot.records, identity);
      if (!committed) throw new OwnerReferencePageAtlasUnavailableError();
      assertExactAuthorizationPair(committed, identity, input.context.acquisition);
      pair = committed;
    }

    assertCurrentSource(state, input.context, this.now().toISOString());
    const run = this.beginActiveRun(identity.suffix, input.signal);
    try {
      let inspection: ReferencePageAtlasInspection | undefined;
      let targetRender: ReferencePageAtlasRenderedPage | undefined;
      let execution: PageAtlasExecutionIdentity | undefined;
      let sourceProfile: MacePageAtlasSourceProfile | undefined;
      try {
        await this.withControlledBytes(input.context, pair, async (bytes) => {
          inspection = await this.parser.inspect({ bytes, signal: run.signal });
          sourceProfile = this.resolveSourceProfile(
            request.profile,
            input.context.digitalAsset,
            inspection
          );
          const runtime = await this.parser.describeRuntime();
          assertInspectionRuntime(inspection, runtime);
          execution = pageAtlasExecutionIdentity(
            request.profile,
            runtime,
            this.resumeBatchPages,
            sourceProfile
          );
          targetRender = await this.parser.renderPage({
            bytes,
            scanOrdinal: sourceProfile?.atlas.targetScanPage ?? 1,
            signal: run.signal,
          });
          assertRenderRuntime(targetRender, runtime);
        });
      } catch (error) {
        if (run.signal.aborted) error = new OwnerReferencePageAtlasInterruptionError();
        if (error instanceof OwnerReferencePageAtlasSourceProfileError) throw error;
        return this.commitParserFailure({
          identity,
          context: input.context,
          profile: request.profile,
          expectedState: state,
          basisAtlas: undefined,
          attemptKind: "initial",
          execution,
          error,
        });
      }
      if (run.signal.aborted) {
        return this.commitParserFailure({
          identity,
          context: input.context,
          profile: request.profile,
          expectedState: state,
          basisAtlas: undefined,
          attemptKind: "initial",
          execution,
          error: new OwnerReferencePageAtlasInterruptionError(),
        });
      }
      if (!inspection || !execution) throw new OwnerReferencePageAtlasUnavailableError();

      const createdAt = this.now().toISOString();
      const atlas = buildInitialAtlas({
        identity,
        context: input.context,
        profile: request.profile,
        inspection,
        accessDecision: pair.decision,
        execution,
        sourceProfile,
        createdAt,
      });
      const records: ReferenceSourceAppendableRecord[] = [];
      if (request.profile === "mace-musicks-monument-1676") {
        if (!targetRender || !sourceProfile) throw new OwnerReferencePageAtlasUnavailableError();
        records.push(...buildMaceIdentityBundle(identity, input.context, sourceProfile, createdAt));
      }
      records.push(atlas);
      const attempt = buildAtlasAttempt({
        identity,
        profile: request.profile,
        sequence: existingGraph ? nextAttemptSequence(existingGraph) : 1,
        context: input.context,
        accessDecision: pair.decision,
        attemptKind: "initial",
        outputAtlas: atlas,
        startedAt: createdAt,
        endedAt: createdAt,
      });
      records.push(attempt);
      if (request.profile === "mace-musicks-monument-1676") {
        records.push(
          ...buildMaceExtractionGraph({
            identity,
            context: input.context,
            accessDecision: pair.decision,
            atlas,
            targetRender: targetRender!,
            sourceProfile: sourceProfile!,
            createdAt,
          })
        );
      } else {
        if (!targetRender) throw new OwnerReferencePageAtlasUnavailableError();
        records.push(
          buildGenericSegment({
            identity,
            context: input.context,
            atlas,
            targetRender,
            version: 1,
          })
        );
      }
      return this.commitProtectedRecords({
        identity,
        profile: request.profile,
        expectedState: state,
        records,
      });
    } finally {
      this.finishActiveRun(identity.suffix, run);
    }
  }

  read(
    input: Readonly<{
      request: ReferencePageAtlasReadRequest;
      context: OwnerReferencePageAtlasResolvedContext;
    }>
  ): ReferencePageAtlasProjection {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(ReferencePageAtlasReadRequestSchema, input.request);
    assertWorkbenchScope(request, input.context);
    const state = this.readCurrentState();
    assertCurrentSource(state, input.context, this.now().toISOString());
    const graph = this.resolveOperation(state, request.operationRef, input.context);
    return this.project(graph, state, request, input.context);
  }

  /** Resolve an exact current Mace candidate without reversing opaque refs. */
  resolveKnowledgeReleaseSeed(
    input: Readonly<{
      selection: TypedKnowledgeReleaseSelection;
      context: OwnerReferencePageAtlasResolvedContext;
    }>
  ): OwnerReferencePageAtlasKnowledgeReleaseSeed {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const selection = Value.Decode(TypedKnowledgeReleaseSelectionSchema, input.selection);
    assertWorkbenchScope(selection, input.context);
    const state = this.readCurrentState();
    assertCurrentSource(state, input.context, this.now().toISOString());
    const graph = this.resolveOperation(state, selection.operationRef, input.context);
    if (graph.profile !== "mace-musicks-monument-1676") {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    const projection = this.project(graph, state, selection, input.context);
    if (!refsEqual(projection.projectionRef, selection.expectedProjectionRef)) {
      throw new OwnerReferencePageAtlasStaleError();
    }
    if (
      projection.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation" ||
      !refsEqual(projection.stagedKnowledge.candidateRef, selection.candidateRef)
    ) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    const segment = deriveCitationLineage(graph).current;
    const extraction = segment ? latestExtractionForSegment(graph, segment) : undefined;
    const mapping = extraction
      ? latestProposalForExtraction(graph, extraction, "twelve_course_diapason_mapping")
      : undefined;
    const question = extraction
      ? latestProposalForExtraction(graph, extraction, "course_thirteen_notation_question")
      : undefined;
    if (
      !segment ||
      !extraction ||
      !mapping ||
      mapping.proposal.kind !== "twelve_course_diapason_mapping" ||
      !question ||
      question.proposal.kind !== "course_thirteen_notation_question" ||
      mapping.reviewState !== "proposed" ||
      mapping.authorityState !== "nonauthoritative" ||
      mapping.activationAllowed ||
      question.reviewState !== "proposed" ||
      question.authorityState !== "nonauthoritative" ||
      question.activationAllowed
    ) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    const typedMapping: OwnerReferencePageAtlasKnowledgeReleaseSeed["mapping"] = {
      ...mapping,
      proposal: mapping.proposal,
    };
    const typedQuestion: OwnerReferencePageAtlasKnowledgeReleaseSeed["question"] = {
      ...question,
      proposal: question.proposal,
    };

    const records = state.snapshot.records;
    const resolution = records.find(
      (record): record is ReferenceAssetIdentityResolution =>
        record.recordKind === "asset_identity_resolution" &&
        record.id === `asset-identity-resolution.owner-page-atlas.${graph.suffix}`
    );
    if (
      !resolution ||
      !verifyReferenceRecordDigest(resolution) ||
      !refsEqual(resolution.digitalAssetRef, input.context.digitalAsset) ||
      resolution.acquisitionRefs.length !== 1 ||
      !refsEqual(resolution.acquisitionRefs[0]!, input.context.acquisition) ||
      resolution.exemplarRefs.length !== 1
    ) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    const work = records.find(
      (record): record is ReferenceWork =>
        record.recordKind === "work" && refsEqual(record, resolution.workRef)
    );
    const manifestation = records.find(
      (record): record is ReferenceSourceManifestation =>
        record.recordKind === "source_manifestation" &&
        refsEqual(record, resolution.manifestationRef)
    );
    const exemplar = records.find(
      (record): record is ReferenceExemplar =>
        record.recordKind === "exemplar" && refsEqual(record, resolution.exemplarRefs[0]!)
    );
    if (
      !work ||
      !manifestation ||
      !exemplar ||
      !verifyReferenceRecordDigest(work) ||
      !verifyReferenceRecordDigest(manifestation) ||
      !verifyReferenceRecordDigest(exemplar)
    ) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }

    return Object.freeze({
      stagingSnapshotRef: refFor(state.snapshot),
      work: structuredClone(work),
      manifestation: structuredClone(manifestation),
      exemplar: structuredClone(exemplar),
      digitalAsset: structuredClone(input.context.digitalAsset),
      acquisition: structuredClone(input.context.acquisition),
      segment: structuredClone(segment),
      extraction: structuredClone(extraction),
      mapping: structuredClone(typedMapping),
      question: structuredClone(typedQuestion),
    });
  }

  async resume(
    input: Readonly<{
      request: ReferencePageAtlasResumeRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ): Promise<OwnerReferencePageAtlasMutationReceipt> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(ReferencePageAtlasResumeRequestSchema, input.request);
    assertWorkbenchScope(request, input.context);
    const state = this.readCurrentState();
    assertCurrentSource(state, input.context, this.now().toISOString());
    const graph = this.resolveOperation(state, request.operationRef, input.context);
    this.assertExpectedProjection(
      graph,
      state,
      request,
      input.context,
      request.expectedProjectionRef
    );
    const run = this.beginActiveRun(graph.suffix, input.signal);
    try {
      const basis = latestAtlas(graph);
      if (!basis) {
        return await this.resumeFailedInitial(graph, state, input.context, run.signal);
      }
      if (basis.coverage !== "partial" || latestAttempt(graph)?.status === "cancelled") {
        throw new OwnerReferencePageAtlasConflictError();
      }
      const pair = requireAuthorizationPair(state.snapshot.records, graph.suffix);
      let inspection: ReferencePageAtlasInspection | undefined;
      let execution: PageAtlasExecutionIdentity = executionIdentityFromAtlas(basis);
      let sourceProfile: MacePageAtlasSourceProfile | undefined;
      try {
        const runtime = await this.parser.describeRuntime();
        if (graph.profile === "generic_paged_source") {
          execution = pageAtlasExecutionIdentity(graph.profile, runtime, this.resumeBatchPages);
          assertAtlasExecutionCompatible(basis, execution);
        }
        await this.withControlledBytes(input.context, pair, async (bytes) => {
          inspection = await this.parser.inspect({ bytes, signal: run.signal });
          assertInspectionRuntime(inspection, runtime);
          sourceProfile = this.resolveSourceProfile(
            graph.profile,
            input.context.digitalAsset,
            inspection
          );
          if (graph.profile === "mace-musicks-monument-1676") {
            execution = pageAtlasExecutionIdentity(
              graph.profile,
              runtime,
              this.resumeBatchPages,
              sourceProfile
            );
            assertAtlasExecutionCompatible(basis, execution);
          }
        });
      } catch (error) {
        if (run.signal.aborted) {
          return this.commitInterruptedUnlessCancelled({
            graph,
            context: input.context,
            expectedState: state,
            basisAtlas: basis,
            attemptKind: "resume",
            execution,
          });
        }
        if (error instanceof OwnerReferencePageAtlasSourceProfileError) throw error;
        if (error instanceof OwnerReferencePageAtlasRegenerationUnavailableError) {
          throw new OwnerReferencePageAtlasRegenerationUnavailableError();
        }
        return this.commitParserFailure({
          identity: operationIdentity(graph.suffix, this.opaqueProjector),
          context: input.context,
          profile: graph.profile,
          expectedState: state,
          basisAtlas: basis,
          attemptKind: "resume",
          execution,
          error,
        });
      }
      if (run.signal.aborted) {
        return this.commitInterruptedUnlessCancelled({
          graph,
          context: input.context,
          expectedState: state,
          basisAtlas: basis,
          attemptKind: "resume",
          execution,
        });
      }
      if (!inspection || inspection.pageCount !== basis.canvasCount) {
        return this.commitParserFailure({
          identity: operationIdentity(graph.suffix, this.opaqueProjector),
          context: input.context,
          profile: graph.profile,
          expectedState: state,
          basisAtlas: basis,
          attemptKind: "resume",
          error: new ReferencePageAtlasParserError("parser_output_invalid"),
        });
      }
      const createdAt = this.now().toISOString();
      const successor = buildResumedAtlas({
        basis,
        inspection,
        batchPages: this.resumeBatchPages,
        profile: graph.profile,
        sourceProfile,
        createdAt,
      });
      const sequence = nextAttemptSequence(graph);
      const attempt = buildAtlasAttempt({
        identity: operationIdentity(graph.suffix, this.opaqueProjector),
        profile: graph.profile,
        sequence,
        context: input.context,
        accessDecision: pair.decision,
        attemptKind: "resume",
        basisAtlas: basis,
        outputAtlas: successor,
        startedAt: createdAt,
        endedAt: createdAt,
      });
      return this.commitProtectedRecords({
        identity: operationIdentity(graph.suffix, this.opaqueProjector),
        profile: graph.profile,
        expectedState: state,
        records: [successor, attempt],
      });
    } finally {
      this.finishActiveRun(graph.suffix, run);
    }
  }

  private async resumeFailedInitial(
    graph: OperationGraph,
    state: ReferenceSourceStagingState,
    context: OwnerReferencePageAtlasResolvedContext,
    signal: AbortSignal
  ): Promise<OwnerReferencePageAtlasMutationReceipt> {
    const latest = latestAttempt(graph);
    if (!latest || !["failed", "resource_exhausted", "interrupted"].includes(latest.status)) {
      throw new OwnerReferencePageAtlasConflictError();
    }
    const pair = requireAuthorizationPair(state.snapshot.records, graph.suffix);
    const identity = operationIdentity(graph.suffix, this.opaqueProjector, {
      purpose: pair.decision.purpose,
      scopeEvidenceRef: pair.rights.evidenceRefs[0],
    });
    let inspection: ReferencePageAtlasInspection | undefined;
    let targetRender: ReferencePageAtlasRenderedPage | undefined;
    let execution: PageAtlasExecutionIdentity | undefined;
    let sourceProfile: MacePageAtlasSourceProfile | undefined;
    try {
      await this.withControlledBytes(context, pair, async (bytes) => {
        inspection = await this.parser.inspect({ bytes, signal });
        sourceProfile = this.resolveSourceProfile(graph.profile, context.digitalAsset, inspection);
        const runtime = await this.parser.describeRuntime();
        assertInspectionRuntime(inspection, runtime);
        execution = pageAtlasExecutionIdentity(
          graph.profile,
          runtime,
          this.resumeBatchPages,
          sourceProfile
        );
        targetRender = await this.parser.renderPage({
          bytes,
          scanOrdinal: sourceProfile?.atlas.targetScanPage ?? 1,
          signal,
        });
        assertRenderRuntime(targetRender, runtime);
      });
    } catch (error) {
      if (signal.aborted) {
        return this.commitInterruptedUnlessCancelled({
          graph,
          context,
          expectedState: state,
          basisAtlas: undefined,
          attemptKind: "initial",
          execution,
        });
      }
      if (error instanceof OwnerReferencePageAtlasSourceProfileError) throw error;
      return this.commitParserFailure({
        identity,
        context,
        profile: graph.profile,
        expectedState: state,
        basisAtlas: undefined,
        attemptKind: "initial",
        execution,
        error,
      });
    }
    if (signal.aborted) {
      return this.commitInterruptedUnlessCancelled({
        graph,
        context,
        expectedState: state,
        basisAtlas: undefined,
        attemptKind: "initial",
        execution,
      });
    }
    if (!inspection || !targetRender || !execution) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    const createdAt = this.now().toISOString();
    const atlas = buildInitialAtlas({
      identity,
      context,
      profile: graph.profile,
      inspection,
      accessDecision: pair.decision,
      execution,
      sourceProfile,
      createdAt,
    });
    const records: ReferenceSourceAppendableRecord[] = [];
    if (graph.profile === "mace-musicks-monument-1676") {
      if (!sourceProfile) throw new OwnerReferencePageAtlasUnavailableError();
      records.push(...buildMaceIdentityBundle(identity, context, sourceProfile, createdAt));
    }
    records.push(
      atlas,
      buildAtlasAttempt({
        identity,
        profile: graph.profile,
        sequence: nextAttemptSequence(graph),
        context,
        accessDecision: pair.decision,
        attemptKind: "initial",
        outputAtlas: atlas,
        startedAt: createdAt,
        endedAt: createdAt,
      })
    );
    if (graph.profile === "mace-musicks-monument-1676") {
      records.push(
        ...buildMaceExtractionGraph({
          identity,
          context,
          accessDecision: pair.decision,
          atlas,
          targetRender,
          sourceProfile: sourceProfile!,
          createdAt,
        })
      );
    } else {
      records.push(buildGenericSegment({ identity, context, atlas, targetRender, version: 1 }));
    }
    return this.commitProtectedRecords({
      identity,
      profile: graph.profile,
      expectedState: state,
      records,
    });
  }

  cancel(
    input: Readonly<{
      request: ReferencePageAtlasCancelRequest;
      context: OwnerReferencePageAtlasResolvedContext;
    }>
  ): OwnerReferencePageAtlasMutationReceipt {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(ReferencePageAtlasCancelRequestSchema, input.request);
    assertWorkbenchScope(request, input.context);
    const state = this.readCurrentState();
    assertCurrentSource(state, input.context, this.now().toISOString());
    const graph = this.resolveOperation(state, request.operationRef, input.context);
    this.assertExpectedProjection(
      graph,
      state,
      request,
      input.context,
      request.expectedProjectionRef
    );
    const latest = latestAttempt(graph);
    const identity = operationIdentity(graph.suffix, this.opaqueProjector);
    if (latest?.status === "cancelled") return receipt(identity.operationRef, true);
    const basis = latestAtlas(graph);
    if (!basis || basis.coverage !== "partial") throw new OwnerReferencePageAtlasConflictError();
    const pair = requireAuthorizationPair(state.snapshot.records, graph.suffix);
    const at = this.now().toISOString();
    const attempt = withReferenceRecordDigest({
      recordKind: "page_atlas_attempt" as const,
      id: attemptId(graph.profile, graph.suffix, nextAttemptSequence(graph)),
      attemptKind: "resume" as const,
      digitalAssetRef: basis.digitalAssetRef,
      acquisitionRefs: basis.acquisitionRefs,
      accessDecisionRef: refFor(pair.decision),
      componentRef: basis.componentRef,
      configurationDigest: basis.configurationDigest,
      resourcePolicyRef: basis.resourcePolicyRef,
      basisAtlasRef: refFor(basis),
      status: "cancelled" as const,
      failureCode: "cancelled" as const,
      redactedDiagnosticRefs: [],
      startedAt: at,
      endedAt: at,
    }) as ReferencePageAtlasAttempt;
    const committed = this.commitProtectedRecords({
      identity,
      profile: graph.profile,
      expectedState: state,
      records: [attempt],
    });
    for (const controller of this.activeRuns.get(graph.suffix) ?? []) controller.abort();
    return committed;
  }

  async correctMapping(
    input: Readonly<{
      request: ReferencePageAtlasCorrectMappingRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ): Promise<OwnerReferencePageAtlasMutationReceipt> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(ReferencePageAtlasCorrectMappingRequestSchema, input.request);
    assertWorkbenchScope(request, input.context);
    const state = this.readCurrentState();
    assertCurrentSource(state, input.context, this.now().toISOString());
    const graph = this.resolveOperation(state, request.operationRef, input.context);
    this.assertExpectedProjection(
      graph,
      state,
      request,
      input.context,
      request.expectedProjectionRef
    );
    const basis = latestAtlas(graph);
    if (!basis || latestAttempt(graph)?.status === "cancelled") {
      throw new OwnerReferencePageAtlasConflictError();
    }
    const citationLineage = deriveCitationLineage(graph);
    if (citationLineage.ordered.length >= REFERENCE_PAGE_ATLAS_CITED_SEGMENT_LINEAGE_MAX_VERSIONS) {
      throw new OwnerReferencePageAtlasLineageLimitError();
    }
    const priorSegment = citationLineage.current;
    if (!priorSegment) throw new OwnerReferencePageAtlasUnavailableError();
    if (
      request.correction.scanPageNumber > basis.canvasCount ||
      !basis.canvases.some(({ scanOrder }) => scanOrder === request.correction.scanPageNumber)
    ) {
      throw new OwnerReferencePageAtlasMappingError();
    }
    const startedAt = this.now().toISOString();
    const run = this.beginActiveRun(graph.suffix, input.signal);
    try {
      const pair = requireAuthorizationPair(state.snapshot.records, graph.suffix);
      let rendered: ReferencePageAtlasRenderedPage | undefined;
      let execution: PageAtlasExecutionIdentity = executionIdentityFromAtlas(basis);
      let sourceProfile: MacePageAtlasSourceProfile | undefined;
      try {
        const runtime = await this.parser.describeRuntime();
        await this.withControlledBytes(input.context, pair, async (bytes) => {
          const inspection = await this.parser.inspect({ bytes, signal: run.signal });
          assertInspectionRuntime(inspection, runtime);
          sourceProfile = this.resolveSourceProfile(
            graph.profile,
            input.context.digitalAsset,
            inspection
          );
          execution = pageAtlasExecutionIdentity(
            graph.profile,
            runtime,
            this.resumeBatchPages,
            sourceProfile
          );
          assertAtlasExecutionCompatible(basis, execution);
          rendered = await this.parser.renderPage({
            bytes,
            scanOrdinal: request.correction.scanPageNumber,
            signal: run.signal,
          });
          assertRenderRuntime(rendered, runtime);
        });
      } catch (error) {
        if (run.signal.aborted) {
          return this.commitInterruptedUnlessCancelled({
            graph,
            context: input.context,
            expectedState: state,
            basisAtlas: basis,
            attemptKind: "correction",
            execution,
          });
        }
        if (error instanceof OwnerReferencePageAtlasSourceProfileError) throw error;
        if (error instanceof OwnerReferencePageAtlasRegenerationUnavailableError) {
          throw new OwnerReferencePageAtlasRegenerationUnavailableError();
        }
        return this.commitParserFailure({
          identity: operationIdentity(graph.suffix, this.opaqueProjector),
          context: input.context,
          profile: graph.profile,
          expectedState: state,
          basisAtlas: basis,
          attemptKind: "correction",
          execution,
          error,
        });
      }
      if (run.signal.aborted) {
        return this.commitInterruptedUnlessCancelled({
          graph,
          context: input.context,
          expectedState: state,
          basisAtlas: basis,
          attemptKind: "correction",
          execution,
        });
      }
      if (!rendered) {
        throw new OwnerReferencePageAtlasUnavailableError();
      }
      const createdAt = this.now().toISOString();
      const identity = operationIdentity(graph.suffix, this.opaqueProjector);
      const corrected = buildCorrectedAtlas({
        basis,
        profile: graph.profile,
        scanPageNumber: request.correction.scanPageNumber,
        printedLocator: request.correction.printedLocator,
        currentTargetCanvasId: priorSegment.canvasId,
        sourceProfile,
        createdAt,
      });
      const changedCanvasIds = changedCanvasIdsBetween(basis, corrected);
      if (changedCanvasIds.length === 0) throw new OwnerReferencePageAtlasMappingError();
      const correction = withReferenceRecordDigest({
        recordKind: "page_atlas_correction" as const,
        id: `${operationId(graph.profile, graph.suffix)}.correction.${corrected.version}`,
        priorAtlasRef: refFor(basis),
        successorAtlasRef: refFor(corrected),
        changedCanvasIds,
        evidenceRefs: [scopeEvidenceForSuffix(graph.suffix, this.opaqueProjector)],
        correctedByRef: PAGE_ATLAS_OWNER_REF,
        rationale: request.correction.reason,
        correctedAt: createdAt,
      }) as ReferencePageAtlasCorrection;
      const correctionAttempt = buildAtlasAttempt({
        identity,
        profile: graph.profile,
        sequence: nextAttemptSequence(graph),
        context: input.context,
        accessDecision: pair.decision,
        attemptKind: "correction",
        basisAtlas: basis,
        outputAtlas: corrected,
        startedAt,
        endedAt: createdAt,
      });
      const records: ReferenceSourceAppendableRecord[] = [corrected, correction, correctionAttempt];
      if (graph.profile === "mace-musicks-monument-1676") {
        if (!sourceProfile) throw new OwnerReferencePageAtlasUnavailableError();
        const priorExtractions = extractionsForSegment(graph, priorSegment);
        const remainsOnProfileTarget =
          request.correction.scanPageNumber === sourceProfile.atlas.targetScanPage;
        let successors: ReferenceSourceAppendableRecord[];
        let successorSegment: ReferenceSourceSegmentVersion;
        let successorExtractions: ReferenceCitedExtractionVersion[];
        let extractionTransition: ReferenceCitationSuccessor["extractionTransition"];
        if (remainsOnProfileTarget) {
          const priorExtraction = latestExtraction(graph);
          const priorMapping = latestProposal(graph, "twelve_course_diapason_mapping");
          const priorQuestion = latestProposal(graph, "course_thirteen_notation_question");
          if (!priorExtraction || !priorMapping || !priorQuestion) {
            throw new OwnerReferencePageAtlasUnavailableError();
          }
          successors = buildMaceExtractionGraph({
            identity,
            context: input.context,
            accessDecision: pair.decision,
            atlas: corrected,
            targetRender: rendered,
            sourceProfile,
            createdAt,
            parents: {
              segment: priorSegment,
              extraction: priorExtraction,
              mapping: priorMapping,
              question: priorQuestion,
            },
          });
          successorSegment = requireSegmentRecord(successors);
          successorExtractions = [requireExtractionRecord(successors)];
          extractionTransition = priorExtractions.length === 0 ? "reextracted" : "mapped_successor";
        } else {
          successorSegment = buildGenericSegment({
            identity,
            context: input.context,
            atlas: corrected,
            targetRender: rendered,
            version: priorSegment.version + 1,
            parent: priorSegment,
          });
          successors = [successorSegment];
          successorExtractions = [];
          extractionTransition =
            priorExtractions.length === 0 ? "not_applicable" : "reextraction_required";
        }
        const citationSuccessor = withReferenceRecordDigest({
          recordKind: "citation_successor" as const,
          id: `${operationId(graph.profile, graph.suffix)}.citation-successor.${successorSegment.version}`,
          atlasCorrectionRef: refFor(correction),
          priorSegmentRef: refFor(priorSegment),
          successorSegmentRef: refFor(successorSegment),
          extractionTransition,
          priorCitedExtractionRefs: priorExtractions.map(refFor),
          successorCitedExtractionRefs: successorExtractions.map(refFor),
          createdAt,
        }) as ReferenceCitationSuccessor;
        records.push(...successors, citationSuccessor);
      } else {
        const successorSegment = buildGenericSegment({
          identity,
          context: input.context,
          atlas: corrected,
          targetRender: rendered,
          version: priorSegment.version + 1,
          parent: priorSegment,
        });
        const citationSuccessor = withReferenceRecordDigest({
          recordKind: "citation_successor" as const,
          id: `${operationId(graph.profile, graph.suffix)}.citation-successor.${successorSegment.version}`,
          atlasCorrectionRef: refFor(correction),
          priorSegmentRef: refFor(priorSegment),
          successorSegmentRef: refFor(successorSegment),
          extractionTransition: "not_applicable" as const,
          priorCitedExtractionRefs: [],
          successorCitedExtractionRefs: [],
          createdAt,
        }) as ReferenceCitationSuccessor;
        records.push(successorSegment, citationSuccessor);
      }
      return this.commitProtectedRecords({
        identity,
        profile: graph.profile,
        expectedState: state,
        records,
      });
    } finally {
      this.finishActiveRun(graph.suffix, run);
    }
  }

  async preview(
    input: Readonly<{
      request: ReferencePageAtlasPreviewRequest;
      context: OwnerReferencePageAtlasResolvedContext;
    }>
  ): Promise<OwnerReferencePageAtlasPreview> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const request = Value.Decode(ReferencePageAtlasPreviewRequestSchema, input.request);
    assertWorkbenchScope(request, input.context);
    const state = this.readCurrentState();
    assertCurrentSource(state, input.context, this.now().toISOString());
    const graph = this.resolveOperation(state, request.operationRef, input.context);
    const projection = this.project(graph, state, request, input.context);
    if (!refsEqual(projection.projectionRef, request.projectionRef)) {
      throw new OwnerReferencePageAtlasStaleError();
    }
    const segment = graph.segments.find((candidate) =>
      refsEqual(
        this.opaqueProjector.project("page-atlas-segment", refFor(candidate)),
        request.segmentRef
      )
    );
    if (!segment) throw new OwnerReferencePageAtlasUnavailableError();
    const canvas = graph.atlases
      .find((atlas) => refsEqual(atlas, segment.pageAtlasRef))
      ?.canvases.find(({ canvasId }) => canvasId === segment.canvasId);
    if (!canvas) throw new OwnerReferencePageAtlasUnavailableError();
    // This segment currently cites the original PDF rather than a protected,
    // lifecycle-governed image derivative. Rerendering with the current
    // executable would create a new observation, not replay immutable bytes.
    // Until a derivative store transaction can bind those exact bytes, fail
    // closed and leave the citation metadata reviewable.
    throw new OwnerReferencePageAtlasRegenerationUnavailableError();
  }

  private resolveSourceProfile(
    profile: ReferencePageAtlasProfile,
    digitalAsset: ReferenceDigitalAsset,
    inspection: ReferencePageAtlasInspection
  ): MacePageAtlasSourceProfile | undefined {
    if (profile === "generic_paged_source") return undefined;
    const resolved = this.sourceProfileResolver.resolveMaceProfile({
      digitalAsset,
      inspection,
    });
    if (!resolved || !maceSourceProfileMatchesAsset(resolved, digitalAsset, inspection)) {
      throw new OwnerReferencePageAtlasSourceProfileError();
    }
    return resolved;
  }

  private beginActiveRun(suffix: string, upstream?: AbortSignal): ActivePageAtlasRun {
    const controller = new AbortController();
    const runs = this.activeRuns.get(suffix) ?? new Set<AbortController>();
    runs.add(controller);
    this.activeRuns.set(suffix, runs);
    const abortFromUpstream = () => controller.abort();
    if (upstream?.aborted) abortFromUpstream();
    else upstream?.addEventListener("abort", abortFromUpstream, { once: true });
    return {
      controller,
      signal: controller.signal,
      detachUpstream: () => upstream?.removeEventListener("abort", abortFromUpstream),
    };
  }

  private finishActiveRun(suffix: string, run: ActivePageAtlasRun): void {
    run.detachUpstream();
    const runs = this.activeRuns.get(suffix);
    if (!runs) return;
    runs.delete(run.controller);
    if (runs.size === 0) this.activeRuns.delete(suffix);
  }

  private commitInterruptedUnlessCancelled(input: {
    graph: OperationGraph;
    context: OwnerReferencePageAtlasResolvedContext;
    expectedState: ReferenceSourceStagingState;
    basisAtlas: ReferencePageAtlasVersion | undefined;
    attemptKind: ReferencePageAtlasAttempt["attemptKind"];
    execution?: PageAtlasExecutionIdentity;
  }): OwnerReferencePageAtlasMutationReceipt {
    const current = this.readCurrentState();
    assertCurrentSource(current, input.context, this.now().toISOString());
    const currentGraph = locateOperationBySuffix(
      current.snapshot.records,
      input.graph.suffix,
      input.graph.profile
    );
    if (currentGraph && latestAttempt(currentGraph)?.status === "cancelled") {
      return receipt(
        operationIdentity(input.graph.suffix, this.opaqueProjector).operationRef,
        true
      );
    }
    return this.commitParserFailure({
      identity: operationIdentity(input.graph.suffix, this.opaqueProjector),
      context: input.context,
      profile: input.graph.profile,
      expectedState: input.expectedState,
      basisAtlas: input.basisAtlas,
      attemptKind: input.attemptKind,
      execution: input.execution,
      error: new OwnerReferencePageAtlasInterruptionError(),
    });
  }

  private commitAuthorization(
    identity: AuthorizationIdentity,
    acquisition: ReferenceAssetAcquisition,
    state: ReferenceSourceStagingState
  ): AuthorizationPair {
    const at = this.now().toISOString();
    const rights = withReferenceRecordDigest({
      recordKind: "rights_assertion" as const,
      id: identity.rightsId,
      version: 1,
      subjectRef: refFor(acquisition),
      subjectKind: "asset_acquisition" as const,
      rightsKind: "local_extraction" as const,
      status: "permitted" as const,
      claimant: {
        kind: "owner" as const,
        claimantRef: OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF,
      },
      evidenceRefs: [identity.scopeEvidenceRef],
      assertedAt: at,
    }) as ReferenceRightsAssertion;
    const decision = withReferenceRecordDigest({
      recordKind: "access_decision" as const,
      id: identity.decisionId,
      version: 1,
      outcome: "allow" as const,
      operation: "local_extraction" as const,
      sourceRefs: [refFor(acquisition)],
      derivativeRefs: [],
      destination: { kind: "local_runtime" as const },
      purpose: identity.purpose,
      policyRef: OWNER_LOCAL_EXTRACTION_POLICY_REF,
      rightsAssertionRefs: [refFor(rights)],
      authorityRefs: [OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF],
      rationale: OWNER_LOCAL_EXTRACTION_RATIONALE,
      decidedAt: at,
    }) as ReferenceAccessDecision;
    const transaction: ReferenceSourceStagingTransaction = {
      schemaVersion: 1,
      id: `transaction.owner-local-extraction.${identity.suffix}`,
      expectedHeadRef: refFor(state.snapshot),
      operations: [rights, decision].map((record) => ({ type: "append_record", record })),
      submittedAt: at,
    };
    try {
      this.localExtractionWriter.applyTransaction(transaction);
      return { rights, decision };
    } catch (error) {
      if (!(error instanceof ReferenceSourceStagingConflictError)) throw error;
      const raced = this.readCurrentState();
      const existing = locateAuthorizationPair(raced.snapshot.records, identity);
      if (existing) {
        assertExactAuthorizationPair(existing, identity, acquisition);
        return existing;
      }
      throw new OwnerReferencePageAtlasStaleError();
    }
  }

  private async withControlledBytes(
    context: OwnerReferencePageAtlasResolvedContext,
    pair: AuthorizationPair,
    sink: (bytes: Uint8Array) => void | Promise<void>
  ): Promise<void> {
    const state = this.readCurrentState();
    assertCurrentSource(state, context, this.now().toISOString());
    assertAuthorizationPair(pair, context.acquisition);
    const capability: LocalExtractionCapability = Object.freeze({
      snapshotRef: refFor(state.snapshot),
      acquisitionRef: refFor(context.acquisition),
      digitalAssetRef: refFor(context.digitalAsset),
      rightsAssertionRef: refFor(pair.rights),
      accessDecisionRef: refFor(pair.decision),
      purpose: pair.decision.purpose,
    });
    this.issuedCapabilities.add(capability);
    let invoked = false;
    const effects: ReferenceSourceOperationEffects = Object.freeze({
      readControlledBytes: (digitalAssetRef) =>
        this.controlledArtifacts.readDigitalAssetBytes(digitalAssetRef),
      writeSink: async ({ bytes, operation, destination, purpose }) => {
        if (
          invoked ||
          operation !== "local_extraction" ||
          destination.kind !== "local_runtime" ||
          destination.id !== undefined ||
          purpose !== pair.decision.purpose
        ) {
          throw new OwnerReferencePageAtlasUnavailableError();
        }
        invoked = true;
        await sink(new Uint8Array(bytes));
      },
    });
    try {
      const result = await this.gateway.execute(
        {
          schemaVersion: 1,
          acquisitionRef: refFor(context.acquisition),
          operation: "local_extraction",
          destination: { kind: "local_runtime" },
          purpose: pair.decision.purpose,
        },
        effects,
        capability
      );
      if (result.status !== "allow" || !invoked) {
        throw new OwnerReferencePageAtlasUnavailableError();
      }
    } finally {
      this.issuedCapabilities.delete(capability);
    }
  }

  private verifyCapability(input: {
    scope: ReferenceSourceOperationScope;
    capability: unknown;
  }): boolean {
    if (
      typeof input.capability !== "object" ||
      input.capability === null ||
      !this.issuedCapabilities.has(input.capability)
    ) {
      return false;
    }
    const capability = input.capability as LocalExtractionCapability;
    if (
      !refsEqual(input.scope.snapshotRef, capability.snapshotRef) ||
      !refsEqual(input.scope.acquisitionRef, capability.acquisitionRef) ||
      !refsEqual(input.scope.digitalAssetRef, capability.digitalAssetRef) ||
      input.scope.operation !== "local_extraction" ||
      input.scope.destination.kind !== "local_runtime" ||
      input.scope.destination.id !== undefined ||
      input.scope.purpose !== capability.purpose
    ) {
      return false;
    }
    let state: ReferenceSourceStagingState;
    try {
      state = this.readCurrentState();
    } catch {
      return false;
    }
    if (!refsEqual(refFor(state.snapshot), capability.snapshotRef)) return false;
    const rights = state.snapshot.records.find(
      (record): record is ReferenceRightsAssertion =>
        record.recordKind === "rights_assertion" && refsEqual(record, capability.rightsAssertionRef)
    );
    const decision = state.snapshot.records.find(
      (record): record is ReferenceAccessDecision =>
        record.recordKind === "access_decision" && refsEqual(record, capability.accessDecisionRef)
    );
    return (
      rights !== undefined &&
      decision !== undefined &&
      verifyReferenceRecordDigest(rights) &&
      verifyReferenceRecordDigest(decision) &&
      refsEqual(rights.subjectRef, capability.acquisitionRef) &&
      rights.rightsKind === "local_extraction" &&
      rights.status === "permitted" &&
      decision.operation === "local_extraction" &&
      decision.outcome === "allow" &&
      decision.destination.kind === "local_runtime" &&
      decision.destination.id === undefined &&
      decision.purpose === capability.purpose &&
      decision.rightsAssertionRefs.length === 1 &&
      refsEqual(decision.rightsAssertionRefs[0]!, rights)
    );
  }

  private commitParserFailure(
    input: Readonly<{
      identity: AuthorizationIdentity;
      context: OwnerReferencePageAtlasResolvedContext;
      profile: ReferencePageAtlasProfile;
      expectedState: ReferenceSourceStagingState;
      basisAtlas: ReferencePageAtlasVersion | undefined;
      attemptKind: ReferencePageAtlasAttempt["attemptKind"];
      execution?: PageAtlasExecutionIdentity;
      error: unknown;
    }>
  ): OwnerReferencePageAtlasMutationReceipt {
    const graph = locateOperationBySuffix(
      input.expectedState.snapshot.records,
      input.identity.suffix,
      input.profile
    );
    const sequence = graph ? nextAttemptSequence(graph) : 1;
    const classified = classifyParserFailure(input.error);
    const at = this.now().toISOString();
    const pair = requireAuthorizationPair(
      input.expectedState.snapshot.records,
      input.identity.suffix
    );
    const checkpoint =
      classified.status === "interrupted" && input.basisAtlas
        ? cloneInterruptedCheckpoint(input.basisAtlas, at)
        : undefined;
    const execution = input.basisAtlas
      ? executionIdentityFromAtlas(input.basisAtlas)
      : (input.execution ?? unresolvedExecutionIdentity(input.profile, this.resumeBatchPages));
    const attempt = withReferenceRecordDigest({
      recordKind: "page_atlas_attempt" as const,
      id: attemptId(input.profile, input.identity.suffix, sequence),
      attemptKind: input.attemptKind,
      digitalAssetRef: refFor(input.context.digitalAsset),
      acquisitionRefs: [refFor(input.context.acquisition)],
      accessDecisionRef: refFor(pair.decision),
      componentRef: execution.componentRef,
      configurationDigest: execution.configurationDigest,
      resourcePolicyRef: execution.resourcePolicyRef,
      ...(input.basisAtlas ? { basisAtlasRef: refFor(input.basisAtlas) } : {}),
      ...(checkpoint ? { outputAtlasRef: refFor(checkpoint) } : {}),
      status: classified.status,
      failureCode: classified.failureCode,
      redactedDiagnosticRefs: [
        this.opaqueProjector.project("page-atlas-redacted-diagnostic", {
          code: classified.publicCode,
          sequence,
        }),
      ],
      startedAt: at,
      endedAt: at,
    }) as ReferencePageAtlasAttempt;
    return this.commitProtectedRecords({
      identity: input.identity,
      profile: input.profile,
      expectedState: input.expectedState,
      records: checkpoint ? [checkpoint, attempt] : [attempt],
    });
  }

  private commitProtectedRecords(
    input: Readonly<{
      identity: AuthorizationIdentity;
      profile: ReferencePageAtlasProfile;
      expectedState: ReferenceSourceStagingState;
      records: readonly ReferenceSourceAppendableRecord[];
    }>
  ): OwnerReferencePageAtlasMutationReceipt {
    const submittedAt = this.now().toISOString();
    const transaction: ReferenceSourceStagingTransaction = {
      schemaVersion: 1,
      id: `transaction.${operationId(input.profile, input.identity.suffix)}.${referenceSourceDigest(
        input.records.map(({ id, digest }) => ({ id, digest }))
      ).slice(0, 24)}`,
      expectedHeadRef: refFor(input.expectedState.snapshot),
      operations: input.records.map((record) => ({ type: "append_record" as const, record })),
      submittedAt,
    };
    const current = this.readCurrentState();
    if (!refsEqual(current.snapshot, input.expectedState.snapshot)) {
      return this.resolveProtectedRecordRace(input, current);
    }
    try {
      this.pageAtlasWriter.applyTransaction(transaction);
      return receipt(input.identity.operationRef, false);
    } catch (error) {
      if (!(error instanceof ReferenceSourceStagingConflictError)) throw error;
      const raced = this.readCurrentState();
      return this.resolveProtectedRecordRace(input, raced);
    }
  }

  private resolveProtectedRecordRace(
    input: Readonly<{
      identity: AuthorizationIdentity;
      records: readonly ReferenceSourceAppendableRecord[];
    }>,
    raced: ReferenceSourceStagingState
  ): OwnerReferencePageAtlasMutationReceipt {
    const exactReplay = input.records.every(
      (expected) =>
        verifyReferenceRecordDigest(expected) &&
        raced.snapshot.records.some(
          (record) =>
            record.recordKind === expected.recordKind &&
            refsEqual(record, expected) &&
            verifyReferenceRecordDigest(record)
        )
    );
    if (exactReplay) return receipt(input.identity.operationRef, true);
    throw new OwnerReferencePageAtlasStaleError();
  }

  private resolveOperation(
    state: ReferenceSourceStagingState,
    operationRef: ReferenceRecordRef,
    context: OwnerReferencePageAtlasResolvedContext
  ): OperationGraph {
    for (const profile of ["generic_paged_source", "mace-musicks-monument-1676"] as const) {
      const candidates = operationSuffixes(state.snapshot.records, profile);
      for (const suffix of candidates) {
        const identity = operationIdentity(suffix, this.opaqueProjector);
        if (!refsEqual(identity.operationRef, operationRef)) continue;
        const graph = locateOperationBySuffix(state.snapshot.records, suffix, profile);
        if (!graph || !graph.attempts.length) break;
        const assetRef = graph.atlases[0]?.digitalAssetRef ?? graph.attempts[0]?.digitalAssetRef;
        const acquisitionRefs =
          graph.atlases[0]?.acquisitionRefs ?? graph.attempts[0]?.acquisitionRefs ?? [];
        if (
          !assetRef ||
          !refsEqual(assetRef, context.digitalAsset) ||
          acquisitionRefs.length !== 1 ||
          !refsEqual(acquisitionRefs[0]!, context.acquisition)
        ) {
          throw new OwnerReferencePageAtlasUnavailableError();
        }
        return graph;
      }
    }
    throw new OwnerReferencePageAtlasUnavailableError();
  }

  private assertExpectedProjection(
    graph: OperationGraph,
    state: ReferenceSourceStagingState,
    request: ProjectionRequestScope,
    context: OwnerReferencePageAtlasResolvedContext,
    expected: ReferenceRecordRef
  ): void {
    const projection = this.project(graph, state, request, context);
    if (!refsEqual(projection.projectionRef, expected)) {
      throw new OwnerReferencePageAtlasStaleError();
    }
  }

  private project(
    graph: OperationGraph,
    state: ReferenceSourceStagingState,
    request: ProjectionRequestScope,
    context: OwnerReferencePageAtlasResolvedContext
  ): ReferencePageAtlasProjection {
    const atlas = latestAtlas(graph);
    const attempt = latestAttempt(graph);
    const operationRef = operationIdentity(graph.suffix, this.opaqueProjector).operationRef;
    const projectionRef = this.opaqueProjector.project("page-atlas-projection", {
      operationRef,
      stagingSnapshotRef: refFor(state.snapshot),
      workbenchSnapshotRef: request.workbenchSnapshotRef,
      workbenchCardRef: request.workbenchCardRef,
      atlasRef: atlas ? refFor(atlas) : null,
      attemptRef: attempt ? refFor(attempt) : null,
    });
    const atlasRef = this.opaqueProjector.project(
      "page-atlas-version",
      atlas ? refFor(atlas) : { operationRef, state: "failed" }
    );
    const parentAtlasRef = atlas?.parentVersionRef
      ? this.opaqueProjector.project("page-atlas-version", refFor(atlas.parentVersionRef))
      : null;
    const enumeratedPages = atlas?.canvases.length ?? 0;
    const totalPages = atlas?.canvasCount ?? null;
    const remainingPages = totalPages === null ? null : totalPages - enumeratedPages;
    const complete = atlas?.coverage === "complete";
    const cancelled = attempt?.status === "cancelled";
    const failed = attempt?.status === "failed" || attempt?.status === "resource_exhausted";
    const stateName = cancelled
      ? "cancelled"
      : failed
        ? "failed"
        : complete
          ? "complete"
          : atlas
            ? "paused"
            : "failed";
    const stop = cancelled
      ? { reason: "owner_cancelled" as const, diagnostics: "redacted" as const }
      : failed
        ? {
            reason:
              attempt?.status === "resource_exhausted"
                ? ("resource_limit" as const)
                : ("parser_failure" as const),
            diagnostics: "redacted" as const,
          }
        : attempt?.status === "interrupted"
          ? { reason: "interrupted" as const, diagnostics: "redacted" as const }
          : null;
    const citationLineage = deriveCitationLineage(graph);
    const currentSegment = citationLineage.current;
    const targetCanvas = currentSegment
      ? atlasForRef(graph, currentSegment.pageAtlasRef)?.canvases.find(
          ({ canvasId }) => canvasId === currentSegment.canvasId
        )
      : undefined;
    const targetScan = targetCanvas?.scanOrder ?? 1;
    const targetPrinted = currentSegment?.printedLocator;
    const lineageVersions = citationLineage.ordered.map((segment) => {
      const incoming = citationLineage.incoming.get(refKey(segment));
      const outgoing = citationLineage.outgoing.get(refKey(segment));
      return {
        segmentRef: this.opaqueProjector.project("page-atlas-segment", refFor(segment)),
        version: segment.version,
        parentSegmentRef: incoming
          ? this.opaqueProjector.project("page-atlas-segment", incoming.priorSegmentRef)
          : null,
        successorSegmentRef: outgoing
          ? this.opaqueProjector.project("page-atlas-segment", outgoing.successorSegmentRef)
          : null,
        pageAtlasRef: this.opaqueProjector.project("page-atlas-version", segment.pageAtlasRef),
        scanPageNumber:
          atlasForRef(graph, segment.pageAtlasRef)?.canvases.find(
            ({ canvasId }) => canvasId === segment.canvasId
          )?.scanOrder ?? 1,
        printedLocator: segment.printedLocator
          ? ({ state: "known" as const, value: segment.printedLocator } as const)
          : ({ state: "unresolved" as const } as const),
        mappingState: segmentMappingState(graph.profile, segment, incoming !== undefined),
        citationState: "immutable" as const,
        authorityState: "non_authoritative" as const,
        previewState: "regeneration_unavailable" as const,
        anchors: segment.regions.map((region) => ({
          anchorRef: this.opaqueProjector.project("page-atlas-anchor", {
            segmentRef: refFor(segment),
            regionId: region.id,
          }),
          kind: region.id.endsWith(".image")
            ? ("image" as const)
            : region.id.endsWith(".text")
              ? ("text" as const)
              : ("notation" as const),
          region: {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
          },
          reviewState: "candidate" as const,
          contentState: "withheld_local_only" as const,
        })),
      };
    });
    const rasterObservedPages = distinctSegmentScanPages(graph, graph.segments).size;
    const contentCandidatePages = distinctSegmentScanPages(
      graph,
      graph.extractions.flatMap(({ sourceSegmentRefs }) =>
        sourceSegmentRefs.flatMap((segmentRef) => {
          const segment = graph.segments.find((candidate) => refsEqual(candidate, segmentRef));
          return segment ? [segment] : [];
        })
      )
    ).size;
    const mappingReviewedPages = distinctSegmentScanPages(
      graph,
      [...citationLineage.incoming.values()].flatMap((edge) => {
        const segment = graph.segments.find((candidate) =>
          refsEqual(candidate, edge.successorSegmentRef)
        );
        return segment ? [segment] : [];
      })
    ).size;
    const currentExtraction = currentSegment
      ? latestExtractionForSegment(graph, currentSegment)
      : undefined;
    const mapping = currentExtraction
      ? latestProposalForExtraction(graph, currentExtraction, "twelve_course_diapason_mapping")
      : undefined;
    const question = currentExtraction
      ? latestProposalForExtraction(graph, currentExtraction, "course_thirteen_notation_question")
      : undefined;
    const mappingProposal =
      mapping?.proposal.kind === "twelve_course_diapason_mapping" ? mapping.proposal : undefined;
    const questionProposal =
      question?.proposal.kind === "course_thirteen_notation_question"
        ? question.proposal
        : undefined;
    const stagedKnowledge =
      mapping && question && mappingProposal && questionProposal
        ? {
            kind: "mace_twelve_course_diapason_notation" as const,
            candidateRef: this.opaqueProjector.project("page-atlas-candidate", refFor(mapping)),
            reviewState: "staged" as const,
            authorityState: "non_authoritative" as const,
            profileScope: "mace-musicks-monument-1676" as const,
            courseMappings: mappingProposal.courses.map((course, index) => ({
              course,
              sign: mappingProposal.symbols[index]!,
            })) as [
              { course: 7; sign: "a" },
              { course: 8; sign: "/a" },
              { course: 9; sign: "//a" },
              { course: 10; sign: "///a" },
              { course: 11; sign: "4" },
              { course: 12; sign: "5" },
            ],
            course13Question: {
              questionRef: this.opaqueProjector.project("page-atlas-question", refFor(question)),
              course: 13 as const,
              status: "open" as const,
              historicalSignState: "unresolved" as const,
              proposedSign: null,
              authorityState: "non_authoritative" as const,
              question:
                "Which directly applicable historical source establishes the thirteenth-course sign?" as const,
            },
          }
        : {
            kind: "none" as const,
            reason: failed
              ? ("source_unavailable" as const)
              : graph.profile === "generic_paged_source"
                ? ("generic_profile_has_no_seed" as const)
                : currentSegment &&
                    citationLineage.incoming.get(refKey(currentSegment))?.extractionTransition ===
                      "reextraction_required"
                  ? ("reextraction_required" as const)
                  : ("not_extracted" as const),
          };
    const unknown = { state: "unknown" as const, reason: "not_assessed" as const };
    const projection: ReferencePageAtlasProjection = {
      schemaVersion: 1,
      projectionRef,
      workbenchSnapshotRef: request.workbenchSnapshotRef,
      workbenchCardRef: request.workbenchCardRef,
      operationRef,
      profile: graph.profile,
      profileSelection: "owner_selected",
      publicationState: "staging_only",
      authorityState: "non_authoritative",
      boundary: {
        processing: "local_only",
        authorization: "owner_attested_local_extraction",
        network: "disabled",
        providerEgress: "deny",
        fixtureInclusion: "deny",
        repositoryInclusion: "deny",
        export: "deny",
        redistribution: "deny",
      },
      atlas: {
        atlasRef,
        version: atlas?.version ?? 1,
        parentAtlasRef,
        state: stateName,
        coverage: {
          enumeratedPages,
          rasterObservedPages,
          contentCandidatePages,
          mappingReviewedPages,
          totalPages,
          remainingPages,
          percentComplete:
            totalPages === null ? null : Math.round((enumeratedPages / totalPages) * 10_000) / 100,
          completeness: complete ? "complete" : "partial",
        },
        checkpointRef:
          atlas?.coverage === "partial"
            ? this.opaqueProjector.project("page-atlas-checkpoint", refFor(atlas))
            : null,
        stop,
      },
      target: {
        targetRef: this.opaqueProjector.project("page-atlas-target", {
          operationRef,
          scanPageNumber: targetScan,
          printedLocator: targetPrinted ?? null,
        }),
        scanPageNumber: targetScan,
        printedLocator: targetPrinted
          ? { state: "known", value: targetPrinted }
          : { state: "unresolved" },
        mappingState: currentSegment
          ? segmentMappingState(
              graph.profile,
              currentSegment,
              citationLineage.incoming.has(refKey(currentSegment))
            )
          : "unresolved",
        canvas: targetCanvas
          ? {
              coordinateSystem: "normalized-top-left.v1",
              widthPixels: targetCanvas.widthPixels,
              heightPixels: targetCanvas.heightPixels,
              rotationDegrees: targetCanvas.rotationDegrees,
            }
          : null,
        pageState: {
          enumeration: targetCanvas ? "enumerated" : "not_enumerated",
          rasterization: currentSegment ? "observed_not_persisted" : "not_rasterized",
          contentExtraction: currentExtraction ? "candidate_extracted" : "not_extracted",
          mappingReview:
            currentSegment && citationLineage.incoming.has(refKey(currentSegment))
              ? "owner_corrected"
              : "not_reviewed",
        },
      },
      citedSegmentLineage: {
        currentSegmentRef: currentSegment
          ? this.opaqueProjector.project("page-atlas-segment", refFor(currentSegment))
          : null,
        versions: lineageVersions,
      },
      confidence:
        graph.profile === "mace-musicks-monument-1676" && currentSegment
          ? {
              sourceIdentity: unknown,
              pageMapping: unknown,
              extraction: unknown,
              interpretation: unknown,
              applicability: unknown,
            }
          : {
              sourceIdentity: unknown,
              pageMapping: unknown,
              extraction: unknown,
              interpretation: unknown,
              applicability: unknown,
            },
      stagedKnowledge,
    };
    return Value.Decode(ReferencePageAtlasProjectionSchema, projection);
  }

  private assertStartAuthorization(
    state: ReferenceSourceStagingState,
    identity: AuthorizationIdentity,
    context: OwnerReferencePageAtlasResolvedContext
  ): void {
    const pair = locateAuthorizationPair(state.snapshot.records, identity);
    if (!pair) throw new OwnerReferencePageAtlasConflictError();
    assertExactAuthorizationPair(pair, identity, context.acquisition);
  }

  private authorizationIdentity(
    request: ReferencePageAtlasStartRequest,
    context: OwnerReferencePageAtlasResolvedContext
  ): AuthorizationIdentity {
    const operationCommitment = this.opaqueProjector.project(
      "page-atlas-operation-key",
      request.operationKey
    );
    const suffix = operationCommitment.digest.slice(0, 32);
    return {
      ...operationIdentity(suffix, this.opaqueProjector),
      rightsId: `rights-assertion.owner-local-extraction.${suffix}`,
      decisionId: `access-decision.owner-local-extraction.${suffix}`,
      scopeEvidenceRef: this.opaqueProjector.project("local-extraction-scope", {
        operationCommitment,
        workbenchCardRef: request.workbenchCardRef,
        acquisitionRef: refFor(context.acquisition),
        digitalAssetRef: refFor(context.digitalAsset),
        purpose: request.purpose,
        authorization: request.authorization,
        profile: request.profile,
        profileSelection: request.profileSelection,
      }),
      purpose: request.purpose,
    };
  }

  private readCurrentState(): ReferenceSourceStagingState {
    try {
      const state = this.stagingStore.readCurrentState();
      if (!state) throw new Error("missing staging state");
      assertReferenceSourceStagingSnapshotIntegrity(state.snapshot);
      if (
        state.head.snapshotId !== state.snapshot.id ||
        state.head.digest !== state.snapshot.digest ||
        state.head.revision !== state.snapshot.revision
      ) {
        throw new Error("incoherent staging state");
      }
      return state;
    } catch {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
  }
}

function buildInitialAtlas(
  input: Readonly<{
    identity: AuthorizationIdentity;
    context: OwnerReferencePageAtlasResolvedContext;
    profile: ReferencePageAtlasProfile;
    inspection: ReferencePageAtlasInspection;
    accessDecision: ReferenceAccessDecision;
    execution: PageAtlasExecutionIdentity;
    sourceProfile?: MacePageAtlasSourceProfile;
    createdAt: string;
  }>
): ReferencePageAtlasVersion {
  const requested = input.sourceProfile?.atlas.initialScanPages ?? [1];
  if (requested.some((ordinal) => ordinal > input.inspection.pageCount)) {
    throw new ReferencePageAtlasParserError("page_ordinal_out_of_range");
  }
  const processed = new Set(requested);
  const canvases = input.inspection.pages
    .filter(({ scanOrdinal }) => processed.has(scanOrdinal))
    .map((page) => buildCanvas(input.identity.suffix, input.profile, page, input.sourceProfile));
  return withReferenceRecordDigest({
    recordKind: "page_atlas_version" as const,
    id: operationId(input.profile, input.identity.suffix),
    version: 1,
    digitalAssetRef: refFor(input.context.digitalAsset),
    acquisitionRefs: [refFor(input.context.acquisition)],
    accessDecisionRef: refFor(input.accessDecision),
    componentRef: input.execution.componentRef,
    configurationDigest: input.execution.configurationDigest,
    resourcePolicyRef: input.execution.resourcePolicyRef,
    coverage:
      processed.size === input.inspection.pageCount ? ("complete" as const) : ("partial" as const),
    canvasCount: input.inspection.pageCount,
    processedScanRanges: rangesFromOrdinals(processed, input.inspection.pageCount),
    unprocessedScanRanges: rangesFromOrdinals(
      complementOrdinals(processed, input.inspection.pageCount),
      input.inspection.pageCount
    ),
    canvases,
    createdAt: input.createdAt,
  }) as ReferencePageAtlasVersion;
}

function buildResumedAtlas(
  input: Readonly<{
    basis: ReferencePageAtlasVersion;
    inspection: ReferencePageAtlasInspection;
    batchPages: number;
    profile: ReferencePageAtlasProfile;
    sourceProfile?: MacePageAtlasSourceProfile;
    createdAt: string;
  }>
): ReferencePageAtlasVersion {
  const processed = new Set(expandRanges(input.basis.processedScanRanges));
  const next = expandRanges(input.basis.unprocessedScanRanges).slice(0, input.batchPages);
  for (const ordinal of next) processed.add(ordinal);
  const existing = new Map(input.basis.canvases.map((canvas) => [canvas.scanOrder, canvas]));
  const canvases = [...processed]
    .sort((left, right) => left - right)
    .map((ordinal) => {
      const retained = existing.get(ordinal);
      if (retained) return retained;
      const page = input.inspection.pages[ordinal - 1];
      if (!page || page.scanOrdinal !== ordinal) {
        throw new ReferencePageAtlasParserError("parser_output_invalid");
      }
      return buildCanvas(operationSuffix(input.basis.id), input.profile, page, input.sourceProfile);
    });
  const coverage =
    processed.size === input.basis.canvasCount ? ("complete" as const) : ("partial" as const);
  return withReferenceRecordDigest({
    recordKind: "page_atlas_version" as const,
    id: input.basis.id,
    version: input.basis.version + 1,
    parentVersionRef: versionedRefFor(input.basis),
    digitalAssetRef: input.basis.digitalAssetRef,
    acquisitionRefs: input.basis.acquisitionRefs,
    accessDecisionRef: input.basis.accessDecisionRef,
    componentRef: input.basis.componentRef,
    configurationDigest: input.basis.configurationDigest,
    resourcePolicyRef: input.basis.resourcePolicyRef,
    coverage,
    canvasCount: input.basis.canvasCount,
    processedScanRanges: rangesFromOrdinals(processed, input.basis.canvasCount),
    unprocessedScanRanges: rangesFromOrdinals(
      complementOrdinals(processed, input.basis.canvasCount),
      input.basis.canvasCount
    ),
    canvases,
    createdAt: input.createdAt,
  }) as ReferencePageAtlasVersion;
}

function buildCorrectedAtlas(
  input: Readonly<{
    basis: ReferencePageAtlasVersion;
    profile: ReferencePageAtlasProfile;
    scanPageNumber: number;
    printedLocator: string;
    currentTargetCanvasId: string;
    sourceProfile?: MacePageAtlasSourceProfile;
    createdAt: string;
  }>
): ReferencePageAtlasVersion {
  const suffix = operationSuffix(input.basis.id);
  const currentTargetCanvas = input.basis.canvases.find(
    ({ canvasId }) => canvasId === input.currentTargetCanvasId
  );
  if (!currentTargetCanvas) throw new OwnerReferencePageAtlasMappingError();
  const canvases = input.basis.canvases.map((canvas) => {
    const ownsRequestedLocator = canvas.locators.some(
      (locator) => locator.kind === "printed_page" && locator.label === input.printedLocator
    );
    if (
      canvas.scanOrder !== input.scanPageNumber &&
      canvas.canvasId !== currentTargetCanvas.canvasId &&
      !ownsRequestedLocator
    ) {
      return canvas;
    }
    const withoutPrinted = canvas.locators.filter((locator) => locator.kind !== "printed_page");
    const isTarget = canvas.scanOrder === input.scanPageNumber;
    return {
      ...canvas,
      locators: isTarget
        ? [
            ...withoutPrinted,
            {
              kind: "printed_page" as const,
              sequenceId: `${operationId(input.profile, suffix)}.printed`,
              label: input.printedLocator,
              ...(numericPrintedOrdinal(input.printedLocator) === undefined
                ? {}
                : { ordinal: numericPrintedOrdinal(input.printedLocator) }),
            },
          ]
        : withoutPrinted,
      regions: input.sourceProfile
        ? isTarget && canvas.scanOrder === input.sourceProfile.atlas.targetScanPage
          ? maceRegions(canvas.canvasId, input.sourceProfile)
          : imageOnlyRegions(canvas.canvasId)
        : canvas.regions,
    };
  });
  return withReferenceRecordDigest({
    recordKind: "page_atlas_version" as const,
    id: input.basis.id,
    version: input.basis.version + 1,
    parentVersionRef: versionedRefFor(input.basis),
    digitalAssetRef: input.basis.digitalAssetRef,
    acquisitionRefs: input.basis.acquisitionRefs,
    accessDecisionRef: input.basis.accessDecisionRef,
    componentRef: input.basis.componentRef,
    configurationDigest: input.basis.configurationDigest,
    resourcePolicyRef: input.basis.resourcePolicyRef,
    coverage: input.basis.coverage,
    canvasCount: input.basis.canvasCount,
    processedScanRanges: input.basis.processedScanRanges,
    unprocessedScanRanges: input.basis.unprocessedScanRanges,
    canvases,
    createdAt: input.createdAt,
  }) as ReferencePageAtlasVersion;
}

function buildCanvas(
  suffix: string,
  profile: ReferencePageAtlasProfile,
  page: ReferencePageAtlasInspection["pages"][number],
  sourceProfile?: MacePageAtlasSourceProfile
): ReferencePageAtlasCanvas {
  const canvasId = `canvas.owner-page-atlas.${suffix}.scan-${page.scanOrdinal}`;
  const locators: ReferencePageAtlasCanvas["locators"] = [
    {
      kind: "internal_sequence",
      sequenceId: `${operationId(profile, suffix)}.scan`,
      label: `scan:${page.scanOrdinal}`,
      ordinal: page.scanOrdinal,
    },
  ];
  if (sourceProfile) {
    const printed = page.scanOrdinal - sourceProfile.atlas.printedPageOffset;
    if (sourceProfile.atlas.initialScanPages.includes(page.scanOrdinal)) {
      locators.push({
        kind: "printed_page",
        sequenceId: `${operationId(profile, suffix)}.printed`,
        label: String(printed),
        ordinal: printed,
      });
    }
  }
  const target = sourceProfile?.atlas.targetScanPage === page.scanOrdinal;
  const rotated = page.rotationDegrees === 90 || page.rotationDegrees === 270;
  const displayWidthPoints = rotated ? page.heightPoints : page.widthPoints;
  const displayHeightPoints = rotated ? page.widthPoints : page.heightPoints;
  return {
    canvasId,
    scanOrder: page.scanOrdinal,
    scanLocator: `scan:${page.scanOrdinal}`,
    coordinateSystem: "normalized-top-left.v1",
    widthPixels: Math.max(1, Math.ceil(displayWidthPoints * 2)),
    heightPixels: Math.max(1, Math.ceil(displayHeightPoints * 2)),
    rotationDegrees: page.rotationDegrees,
    conditions: [],
    locators,
    regions:
      target && sourceProfile ? maceRegions(canvasId, sourceProfile) : imageOnlyRegions(canvasId),
  };
}

function imageOnlyRegions(canvasId: string): ReferencePageAtlasCanvas["regions"] {
  return [
    {
      id: `${canvasId}.image`,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      unit: "normalized",
      modality: "image",
    },
  ];
}

function maceRegions(
  canvasId: string,
  sourceProfile: MacePageAtlasSourceProfile
): ReferencePageAtlasCanvas["regions"] {
  const { text, notation } = sourceProfile.extraction.regions;
  return [
    ...imageOnlyRegions(canvasId),
    {
      id: `${canvasId}.text`,
      ...text,
      unit: "normalized",
      modality: "text",
    },
    {
      id: `${canvasId}.notation`,
      ...notation,
      unit: "normalized",
      modality: "notation",
    },
  ];
}

function buildAtlasAttempt(
  input: Readonly<{
    identity: AuthorizationIdentity;
    profile: ReferencePageAtlasProfile;
    sequence: number;
    context: OwnerReferencePageAtlasResolvedContext;
    accessDecision: ReferenceAccessDecision;
    attemptKind: ReferencePageAtlasAttempt["attemptKind"];
    basisAtlas?: ReferencePageAtlasVersion;
    outputAtlas: ReferencePageAtlasVersion;
    startedAt: string;
    endedAt: string;
  }>
): ReferencePageAtlasAttempt {
  return withReferenceRecordDigest({
    recordKind: "page_atlas_attempt" as const,
    id: attemptId(input.profile, input.identity.suffix, input.sequence),
    attemptKind: input.attemptKind,
    digitalAssetRef: refFor(input.context.digitalAsset),
    acquisitionRefs: [refFor(input.context.acquisition)],
    accessDecisionRef: refFor(input.accessDecision),
    componentRef: input.outputAtlas.componentRef,
    configurationDigest: input.outputAtlas.configurationDigest,
    resourcePolicyRef: input.outputAtlas.resourcePolicyRef,
    ...(input.basisAtlas ? { basisAtlasRef: refFor(input.basisAtlas) } : {}),
    outputAtlasRef: refFor(input.outputAtlas),
    status: "completed" as const,
    redactedDiagnosticRefs: [],
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  }) as ReferencePageAtlasAttempt;
}

function buildMaceIdentityBundle(
  identity: AuthorizationIdentity,
  context: OwnerReferencePageAtlasResolvedContext,
  sourceProfile: MacePageAtlasSourceProfile,
  createdAt: string
): ReferenceSourceAppendableRecord[] {
  const work = withReferenceRecordDigest({
    recordKind: "work" as const,
    id: `work.owner-page-atlas.${identity.suffix}`,
    version: 1,
    preferredTitle: sourceProfile.identity.preferredTitle,
    creatorIdentityRefs: [],
    workDate: {
      start: sourceProfile.identity.workDate,
      end: sourceProfile.identity.workDate,
      display: sourceProfile.identity.workDate,
    },
    identityAssertionRefs: [],
    identityState: "candidate" as const,
  }) as ReferenceWork;
  const manifestation = withReferenceRecordDigest({
    recordKind: "source_manifestation" as const,
    id: `manifestation.owner-page-atlas.${identity.suffix}`,
    version: 1,
    manifestationKind: "edition" as const,
    workRelations: [{ workRef: refFor(work), role: "edition_of" as const }],
    parentRelations: [],
    publicationDate: {
      start: sourceProfile.identity.workDate,
      end: sourceProfile.identity.workDate,
      display: sourceProfile.identity.workDate,
    },
    languages: [sourceProfile.identity.language],
    editorIdentityRefs: [],
    translatorIdentityRefs: [],
    declaredChanges: [],
    identityAssertionRefs: [],
    identityState: "candidate" as const,
  }) as ReferenceSourceManifestation;
  const exemplar = withReferenceRecordDigest({
    recordKind: "exemplar" as const,
    id: `exemplar.owner-page-atlas.${identity.suffix}`,
    version: 1,
    manifestationRefs: [refFor(manifestation)],
    completeness: "unknown" as const,
    exemplarNotes: ["Exact public source-profile match; exemplar details require review."],
    identityAssertionRefs: [],
    identityState: "candidate" as const,
  }) as ReferenceExemplar;
  const assertion = withReferenceRecordDigest({
    recordKind: "identity_assertion" as const,
    id: `identity-assertion.owner-page-atlas.${identity.suffix}`,
    version: 1,
    subjectRef: refFor(work),
    subjectKind: "work" as const,
    property: "preferred_title",
    assertedValue: {
      kind: "text" as const,
      value: sourceProfile.identity.preferredTitle,
    },
    claimant: {
      kind: sourceProfile.identity.claimantKind,
      claimantRef: sourceProfile.registryRef,
    },
    evidenceRefs: [sourceProfile.evidenceRef],
    confidence: { kind: "unknown" as const },
    completeness: "complete" as const,
    composition: "atomic" as const,
    componentAssertionRefs: [],
    assertionState: "candidate" as const,
    predecessorAssertionRefs: [],
    successorRelationship: "initial" as const,
    conflictAssertionRefs: [],
    assertedAt: createdAt,
  }) as ReferenceSourceIdentityAssertion;
  const resolution = withReferenceRecordDigest({
    recordKind: "asset_identity_resolution" as const,
    id: `asset-identity-resolution.owner-page-atlas.${identity.suffix}`,
    version: 1,
    digitalAssetRef: refFor(context.digitalAsset),
    acquisitionRefs: [refFor(context.acquisition)],
    workRef: refFor(work),
    manifestationRef: refFor(manifestation),
    exemplarRefs: [refFor(exemplar)],
    identityAssertionRefs: [refFor(assertion)],
    resolutionState: "candidate" as const,
    reviewState: "candidate" as const,
    resolverRef: sourceProfile.registryRef,
    evidenceRefs: [sourceProfile.evidenceRef],
    recordedAt: createdAt,
  }) as ReferenceAssetIdentityResolution;
  return [work, manifestation, exemplar, assertion, resolution];
}

function buildMaceExtractionGraph(
  input: Readonly<{
    identity: AuthorizationIdentity;
    context: OwnerReferencePageAtlasResolvedContext;
    accessDecision: ReferenceAccessDecision;
    atlas: ReferencePageAtlasVersion;
    targetRender: ReferencePageAtlasRenderedPage;
    sourceProfile: MacePageAtlasSourceProfile;
    createdAt: string;
    parents?: Readonly<{
      segment: ReferenceSourceSegmentVersion;
      extraction: ReferenceCitedExtractionVersion;
      mapping: ReferenceExtractionProposal;
      question: ReferenceExtractionProposal;
    }>;
  }>
): ReferenceSourceAppendableRecord[] {
  if (input.targetRender.scanOrdinal !== input.sourceProfile.atlas.targetScanPage) {
    throw new OwnerReferencePageAtlasSourceProfileError();
  }
  const targetCanvas = input.atlas.canvases.find(
    ({ scanOrder }) => scanOrder === input.targetRender.scanOrdinal
  );
  if (!targetCanvas) throw new OwnerReferencePageAtlasMappingError();
  assertRenderedCanvasGeometry(input.targetRender, targetCanvas);
  const regions = targetCanvas.regions.filter(({ id }) =>
    [".image", ".text", ".notation"].some((suffix) => id.endsWith(suffix))
  );
  if (regions.length !== 3) throw new OwnerReferencePageAtlasMappingError();
  const segmentVersion = input.parents ? input.parents.segment.version + 1 : 1;
  const extractionVersion = input.parents ? input.parents.extraction.version + 1 : 1;
  const mappingVersion = input.parents ? input.parents.mapping.version + 1 : 1;
  const questionVersion = input.parents ? input.parents.question.version + 1 : 1;
  const segmentId = `source-segment.owner-page-atlas.${input.identity.suffix}`;
  const segment = withReferenceRecordDigest({
    recordKind: "source_segment_version" as const,
    id: segmentId,
    version: segmentVersion,
    ...(input.parents ? { parentVersionRef: versionedRefFor(input.parents.segment) } : {}),
    digitalAssetRef: refFor(input.context.digitalAsset),
    acquisitionRefs: [refFor(input.context.acquisition)],
    provenancePathRefs: [refFor(input.context.acquisition)],
    pageAtlasRef: refFor(input.atlas),
    canvasId: targetCanvas.canvasId,
    printedLocator:
      targetCanvas.locators.find(({ kind }) => kind === "printed_page")?.label ??
      input.sourceProfile.atlas.targetPrintedPage,
    scanLocator: targetCanvas.scanLocator,
    coordinateSystem: targetCanvas.coordinateSystem,
    regionTransforms: regions.map(() => ({
      kind: "identity" as const,
      matrix: [1, 0, 0, 1, 0, 0],
    })),
    regions: regions.map(({ id, x, y, width, height, unit }) => ({
      id,
      x,
      y,
      width,
      height,
      unit,
    })),
    musicalRange: "Courses 7-12; course 13 deliberately unresolved",
    modality: "mixed" as const,
    sourceImageRef: refFor(input.context.digitalAsset),
    cropDigest: referenceSourceDigest({
      schemaVersion: 1,
      renderedPageSha256: createHash("sha256").update(input.targetRender.bytes).digest("hex"),
      canvasId: targetCanvas.canvasId,
      regions: regions.map(({ id, x, y, width, height, unit }) => ({
        id,
        x,
        y,
        width,
        height,
        unit,
      })),
    }),
  }) as ReferenceSourceSegmentVersion;
  const notationRegion = regions.find(({ id }) => id.endsWith(".notation"))!;
  const textRegion = regions.find(({ id }) => id.endsWith(".text"))!;
  const imageRegion = regions.find(({ id }) => id.endsWith(".image"))!;
  const tokens = input.sourceProfile.extraction.mappings.map(({ symbol, course }, index) => ({
    id: `notation-token.owner-page-atlas.${input.identity.suffix}.${index + 1}.v${extractionVersion}`,
    value: symbol,
    course,
    regionId: notationRegion.id,
  }));
  const extraction = withReferenceRecordDigest({
    recordKind: "cited_extraction_version" as const,
    id: `cited-extraction.owner-page-atlas.${input.identity.suffix}`,
    version: extractionVersion,
    ...(input.parents ? { parentVersionRef: versionedRefFor(input.parents.extraction) } : {}),
    sourceSegmentRefs: [refFor(segment)],
    accessDecisionRefs: [refFor(input.accessDecision)],
    componentRef: externalRef("component.typed-source-profile-extraction.v1"),
    configurationDigest: referenceSourceDigest({
      schemaVersion: 1,
      profile: "mace-musicks-monument-1676",
      extraction: "typed-exact-sequence",
      sourceProfileConfigurationDigest: input.sourceProfile.configurationDigest,
      sourceProfileRegistryRef: input.sourceProfile.registryRef,
    }),
    anchors: [
      {
        id: `citation-anchor.owner-page-atlas.${input.identity.suffix}.image.v${extractionVersion}`,
        sourceSegmentRef: refFor(segment),
        regionIds: [imageRegion.id],
        kind: "image" as const,
      },
      {
        id: `citation-anchor.owner-page-atlas.${input.identity.suffix}.text.v${extractionVersion}`,
        sourceSegmentRef: refFor(segment),
        regionIds: [textRegion.id],
        kind: "text" as const,
        characterRange: {
          start: 0,
          end: input.sourceProfile.extraction.originalTranscription.length,
        },
      },
      {
        id: `citation-anchor.owner-page-atlas.${input.identity.suffix}.notation.v${extractionVersion}`,
        sourceSegmentRef: refFor(segment),
        regionIds: [notationRegion.id],
        kind: "notation" as const,
        tokenIds: tokens.map(({ id }) => id),
      },
    ],
    originalTranscription: input.sourceProfile.extraction.originalTranscription,
    normalizedTranscription: input.sourceProfile.extraction.normalizedTranscription,
    notationTokens: tokens,
    confidence: {
      extraction: { kind: "unknown" as const },
      sourceIdentity: { kind: "unknown" as const },
      interpretation: { kind: "unknown" as const },
      applicability: { kind: "unknown" as const },
    },
    unresolvedAlternatives: [
      "The thirteenth-course historical sign is not established by this twelve-course source.",
    ],
    reviewState: "proposed" as const,
    createdAt: input.createdAt,
  }) as ReferenceCitedExtractionVersion;
  const proposalBase = {
    recordKind: "extraction_proposal" as const,
    citedExtractionRef: refFor(extraction),
    scope: {
      instrument: "baroque_lute" as const,
      notationSystem: "french_tablature" as const,
      sourceCourseCount: 12 as const,
    },
    reviewState: "proposed" as const,
    authorityState: "nonauthoritative" as const,
    activationAllowed: false as const,
    releaseRefs: [],
    attestationRefs: [],
    createdAt: input.createdAt,
  };
  const mapping = withReferenceRecordDigest({
    ...proposalBase,
    id: `extraction-proposal.owner-page-atlas.${input.identity.suffix}.mapping`,
    version: mappingVersion,
    ...(input.parents ? { parentVersionRef: versionedRefFor(input.parents.mapping) } : {}),
    proposal: {
      kind: "twelve_course_diapason_mapping" as const,
      courses: input.sourceProfile.extraction.mappings.map(({ course }) => course) as [
        7,
        8,
        9,
        10,
        11,
        12,
      ],
      symbols: input.sourceProfile.extraction.mappings.map(({ symbol }) => symbol) as [
        "a",
        "/a",
        "//a",
        "///a",
        "4",
        "5",
      ],
      numericSymbolsHaveSlashes: false as const,
    },
  }) as ReferenceExtractionProposal;
  const question = withReferenceRecordDigest({
    ...proposalBase,
    id: `extraction-proposal.owner-page-atlas.${input.identity.suffix}.course-13-question`,
    version: questionVersion,
    ...(input.parents ? { parentVersionRef: versionedRefFor(input.parents.question) } : {}),
    proposal: {
      kind: "course_thirteen_notation_question" as const,
      course: 13 as const,
      state: "unresolved" as const,
      forbiddenInference: "sequence_extrapolation" as const,
    },
  }) as ReferenceExtractionProposal;
  return [segment, extraction, mapping, question];
}

function buildGenericSegment(
  input: Readonly<{
    identity: AuthorizationIdentity;
    context: OwnerReferencePageAtlasResolvedContext;
    atlas: ReferencePageAtlasVersion;
    targetRender: ReferencePageAtlasRenderedPage;
    version: number;
    parent?: ReferenceSourceSegmentVersion;
  }>
): ReferenceSourceSegmentVersion {
  const targetCanvas = input.atlas.canvases.find(
    ({ scanOrder }) => scanOrder === input.targetRender.scanOrdinal
  );
  if (!targetCanvas) throw new OwnerReferencePageAtlasMappingError();
  assertRenderedCanvasGeometry(input.targetRender, targetCanvas);
  const image = targetCanvas.regions.find(({ id }) => id.endsWith(".image"));
  const printedLocator = targetCanvas.locators.find(({ kind }) => kind === "printed_page")?.label;
  if (!image) throw new OwnerReferencePageAtlasMappingError();
  const imageRegion = {
    id: image.id,
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
    unit: image.unit,
  };
  return withReferenceRecordDigest({
    recordKind: "source_segment_version" as const,
    id: `source-segment.owner-page-atlas.${input.identity.suffix}`,
    version: input.version,
    ...(input.parent ? { parentVersionRef: versionedRefFor(input.parent) } : {}),
    digitalAssetRef: refFor(input.context.digitalAsset),
    acquisitionRefs: [refFor(input.context.acquisition)],
    provenancePathRefs: [refFor(input.context.acquisition)],
    pageAtlasRef: refFor(input.atlas),
    canvasId: targetCanvas.canvasId,
    ...(printedLocator ? { printedLocator } : {}),
    scanLocator: targetCanvas.scanLocator,
    coordinateSystem: targetCanvas.coordinateSystem,
    regionTransforms: [{ kind: "identity" as const, matrix: [1, 0, 0, 1, 0, 0] }],
    regions: [imageRegion],
    modality: "image" as const,
    sourceImageRef: refFor(input.context.digitalAsset),
    cropDigest: renderedGeometryDigest(input.targetRender, targetCanvas.canvasId, [imageRegion]),
  }) as ReferenceSourceSegmentVersion;
}

function locateOperationBySuffix(
  records: readonly ReferenceSourceStagingRecord[],
  suffix: string,
  profile: ReferencePageAtlasProfile
): OperationGraph | null {
  const id = operationId(profile, suffix);
  const attempts = records.filter(
    (record): record is ReferencePageAtlasAttempt =>
      record.recordKind === "page_atlas_attempt" &&
      ATTEMPT_ID.exec(record.id)?.[2] === suffix &&
      profileForTag(ATTEMPT_ID.exec(record.id)?.[1]) === profile
  );
  const atlases = records.filter(
    (record): record is ReferencePageAtlasVersion =>
      record.recordKind === "page_atlas_version" && record.id === id
  );
  if (attempts.length === 0 && atlases.length === 0) return null;
  const belongsToOperation = (recordId: string) =>
    recordId.includes(`owner-page-atlas.${suffix}`) || recordId.startsWith(`${id}.`);
  return {
    suffix,
    profile,
    attempts,
    atlases,
    corrections: records.filter(
      (record): record is ReferencePageAtlasCorrection =>
        record.recordKind === "page_atlas_correction" && record.id.startsWith(`${id}.correction.`)
    ),
    segments: records.filter(
      (record): record is ReferenceSourceSegmentVersion =>
        record.recordKind === "source_segment_version" && belongsToOperation(record.id)
    ),
    extractions: records.filter(
      (record): record is ReferenceCitedExtractionVersion =>
        record.recordKind === "cited_extraction_version" && belongsToOperation(record.id)
    ),
    proposals: records.filter(
      (record): record is ReferenceExtractionProposal =>
        record.recordKind === "extraction_proposal" && belongsToOperation(record.id)
    ),
    citationSuccessors: records.filter(
      (record): record is ReferenceCitationSuccessor =>
        record.recordKind === "citation_successor" &&
        record.id.startsWith(`${id}.citation-successor.`)
    ),
  };
}

type DerivedCitationLineage = Readonly<{
  ordered: readonly ReferenceSourceSegmentVersion[];
  current: ReferenceSourceSegmentVersion | undefined;
  incoming: ReadonlyMap<string, ReferenceCitationSuccessor>;
  outgoing: ReadonlyMap<string, ReferenceCitationSuccessor>;
}>;

function deriveCitationLineage(graph: OperationGraph): DerivedCitationLineage {
  if (graph.segments.length === 0) {
    if (graph.citationSuccessors.length !== 0) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    return { ordered: [], current: undefined, incoming: new Map(), outgoing: new Map() };
  }
  const segments = new Map<string, ReferenceSourceSegmentVersion>();
  for (const segment of graph.segments) {
    const key = refKey(segment);
    if (segments.has(key)) throw new OwnerReferencePageAtlasUnavailableError();
    segments.set(key, segment);
  }
  if (graph.citationSuccessors.length !== graph.segments.length - 1) {
    throw new OwnerReferencePageAtlasUnavailableError();
  }
  const incoming = new Map<string, ReferenceCitationSuccessor>();
  const outgoing = new Map<string, ReferenceCitationSuccessor>();
  for (const edge of graph.citationSuccessors) {
    const priorKey = refKey(edge.priorSegmentRef);
    const successorKey = refKey(edge.successorSegmentRef);
    if (
      priorKey === successorKey ||
      !segments.has(priorKey) ||
      !segments.has(successorKey) ||
      outgoing.has(priorKey) ||
      incoming.has(successorKey)
    ) {
      throw new OwnerReferencePageAtlasUnavailableError();
    }
    outgoing.set(priorKey, edge);
    incoming.set(successorKey, edge);
  }
  const roots = [...segments.values()].filter((segment) => !incoming.has(refKey(segment)));
  if (roots.length !== 1) throw new OwnerReferencePageAtlasUnavailableError();
  const ordered: ReferenceSourceSegmentVersion[] = [];
  const seen = new Set<string>();
  let cursor: ReferenceSourceSegmentVersion | undefined = roots[0];
  while (cursor) {
    const key = refKey(cursor);
    if (seen.has(key)) throw new OwnerReferencePageAtlasUnavailableError();
    seen.add(key);
    ordered.push(cursor);
    const edge = outgoing.get(key);
    cursor = edge ? segments.get(refKey(edge.successorSegmentRef)) : undefined;
  }
  if (
    ordered.length !== graph.segments.length ||
    ordered.some((segment, index) => segment.version !== index + 1)
  ) {
    throw new OwnerReferencePageAtlasUnavailableError();
  }
  return { ordered, current: ordered.at(-1), incoming, outgoing };
}

function segmentMappingState(
  profile: ReferencePageAtlasProfile,
  segment: ReferenceSourceSegmentVersion,
  hasIncomingCorrection: boolean
): "unresolved" | "candidate" | "corrected" {
  if (hasIncomingCorrection) return "corrected";
  if (profile === "mace-musicks-monument-1676") return "candidate";
  return segment.printedLocator ? "candidate" : "unresolved";
}

function distinctSegmentScanPages(
  graph: OperationGraph,
  segments: readonly ReferenceSourceSegmentVersion[]
): Set<number> {
  const result = new Set<number>();
  for (const segment of segments) {
    const canvas = atlasForRef(graph, segment.pageAtlasRef)?.canvases.find(
      ({ canvasId }) => canvasId === segment.canvasId
    );
    if (!canvas) throw new OwnerReferencePageAtlasUnavailableError();
    result.add(canvas.scanOrder);
  }
  return result;
}

function operationSuffixes(
  records: readonly ReferenceSourceStagingRecord[],
  profile: ReferencePageAtlasProfile
): string[] {
  const tag = profileTag(profile);
  const values = new Set<string>();
  for (const record of records) {
    if (record.recordKind === "page_atlas_version") {
      const match = OPERATION_ID.exec(record.id);
      if (match?.[1] === tag && match[2]) values.add(match[2]);
    } else if (record.recordKind === "page_atlas_attempt") {
      const match = ATTEMPT_ID.exec(record.id);
      if (match?.[1] === tag && match[2]) values.add(match[2]);
    }
  }
  return [...values].sort();
}

function latestAtlas(graph: OperationGraph): ReferencePageAtlasVersion | undefined {
  return graph.atlases.slice().sort((left, right) => right.version - left.version)[0];
}

function latestAttempt(graph: OperationGraph): ReferencePageAtlasAttempt | undefined {
  return graph.attempts
    .slice()
    .sort(
      (left, right) =>
        attemptSequence(right.id) - attemptSequence(left.id) ||
        right.endedAt.localeCompare(left.endedAt)
    )[0];
}

function latestExtraction(graph: OperationGraph): ReferenceCitedExtractionVersion | undefined {
  return graph.extractions.slice().sort((left, right) => right.version - left.version)[0];
}

function extractionsForSegment(
  graph: OperationGraph,
  segment: ReferenceSourceSegmentVersion
): ReferenceCitedExtractionVersion[] {
  return graph.extractions
    .filter(({ sourceSegmentRefs }) =>
      sourceSegmentRefs.some((segmentRef) => refsEqual(segmentRef, segment))
    )
    .sort((left, right) => left.version - right.version);
}

function latestExtractionForSegment(
  graph: OperationGraph,
  segment: ReferenceSourceSegmentVersion
): ReferenceCitedExtractionVersion | undefined {
  return extractionsForSegment(graph, segment).at(-1);
}

function latestProposal(
  graph: OperationGraph,
  kind: "twelve_course_diapason_mapping" | "course_thirteen_notation_question"
): ReferenceExtractionProposal | undefined {
  return graph.proposals
    .filter(({ proposal }) => proposal.kind === kind)
    .sort((left, right) => right.version - left.version)[0];
}

function latestProposalForExtraction(
  graph: OperationGraph,
  extraction: ReferenceCitedExtractionVersion,
  kind: "twelve_course_diapason_mapping" | "course_thirteen_notation_question"
): ReferenceExtractionProposal | undefined {
  return graph.proposals
    .filter(
      ({ proposal, citedExtractionRef }) =>
        proposal.kind === kind && refsEqual(citedExtractionRef, extraction)
    )
    .sort((left, right) => right.version - left.version)[0];
}

function requireSegmentRecord(
  records: readonly ReferenceSourceAppendableRecord[]
): ReferenceSourceSegmentVersion {
  const segment = records.find(
    (record): record is ReferenceSourceSegmentVersion =>
      record.recordKind === "source_segment_version"
  );
  if (!segment) throw new OwnerReferencePageAtlasUnavailableError();
  return segment;
}

function requireExtractionRecord(
  records: readonly ReferenceSourceAppendableRecord[]
): ReferenceCitedExtractionVersion {
  const extraction = records.find(
    (record): record is ReferenceCitedExtractionVersion =>
      record.recordKind === "cited_extraction_version"
  );
  if (!extraction) throw new OwnerReferencePageAtlasUnavailableError();
  return extraction;
}

function atlasForRef(
  graph: OperationGraph,
  ref: ReferenceRecordRef
): ReferencePageAtlasVersion | undefined {
  return graph.atlases.find((atlas) => refsEqual(atlas, ref));
}

function nextAttemptSequence(graph: OperationGraph): number {
  return Math.max(0, ...graph.attempts.map(({ id }) => attemptSequence(id))) + 1;
}

function attemptSequence(id: string): number {
  const value = Number(ATTEMPT_ID.exec(id)?.[3] ?? 0);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function locateAuthorizationPair(
  records: readonly ReferenceSourceStagingRecord[],
  identity: Pick<AuthorizationIdentity, "rightsId" | "decisionId">
): AuthorizationPair | null {
  const rights = records.find(({ id }) => id === identity.rightsId);
  const decision = records.find(({ id }) => id === identity.decisionId);
  if (!rights && !decision) return null;
  if (rights?.recordKind !== "rights_assertion" || decision?.recordKind !== "access_decision") {
    throw new OwnerReferencePageAtlasConflictError();
  }
  return { rights, decision };
}

function requireAuthorizationPair(
  records: readonly ReferenceSourceStagingRecord[],
  suffix: string
): AuthorizationPair {
  const pair = locateAuthorizationPair(records, {
    rightsId: `rights-assertion.owner-local-extraction.${suffix}`,
    decisionId: `access-decision.owner-local-extraction.${suffix}`,
  });
  if (!pair) throw new OwnerReferencePageAtlasUnavailableError();
  return pair;
}

function assertExactAuthorizationPair(
  pair: AuthorizationPair,
  identity: AuthorizationIdentity,
  acquisition: ReferenceAssetAcquisition
): void {
  const exact =
    verifyReferenceRecordDigest(pair.rights) &&
    verifyReferenceRecordDigest(pair.decision) &&
    pair.rights.id === identity.rightsId &&
    pair.rights.version === 1 &&
    pair.rights.parentVersionRef === undefined &&
    pair.rights.subjectKind === "asset_acquisition" &&
    refsEqual(pair.rights.subjectRef, acquisition) &&
    pair.rights.rightsKind === "local_extraction" &&
    pair.rights.status === "permitted" &&
    pair.rights.claimant.kind === "owner" &&
    refsEqual(pair.rights.claimant.claimantRef, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF) &&
    pair.rights.evidenceRefs.length === 1 &&
    refsEqual(pair.rights.evidenceRefs[0]!, identity.scopeEvidenceRef) &&
    pair.decision.id === identity.decisionId &&
    pair.decision.version === 1 &&
    pair.decision.parentVersionRef === undefined &&
    pair.decision.outcome === "allow" &&
    pair.decision.operation === "local_extraction" &&
    pair.decision.sourceRefs.length === 1 &&
    refsEqual(pair.decision.sourceRefs[0]!, acquisition) &&
    pair.decision.derivativeRefs.length === 0 &&
    pair.decision.destination.kind === "local_runtime" &&
    pair.decision.destination.id === undefined &&
    pair.decision.purpose === identity.purpose &&
    pair.decision.assetRole === undefined &&
    refsEqual(pair.decision.policyRef, OWNER_LOCAL_EXTRACTION_POLICY_REF) &&
    pair.decision.rightsAssertionRefs.length === 1 &&
    refsEqual(pair.decision.rightsAssertionRefs[0]!, pair.rights) &&
    pair.decision.authorityRefs.length === 1 &&
    refsEqual(pair.decision.authorityRefs[0]!, OWNER_LOCAL_EXTRACTION_ATTESTATION_AUTHORITY_REF) &&
    pair.decision.rationale === OWNER_LOCAL_EXTRACTION_RATIONALE &&
    pair.decision.decidedAt === pair.rights.assertedAt;
  if (!exact) throw new OwnerReferencePageAtlasConflictError();
}

function assertAuthorizationPair(
  pair: AuthorizationPair,
  acquisition: ReferenceAssetAcquisition
): void {
  if (
    !verifyReferenceRecordDigest(pair.rights) ||
    !verifyReferenceRecordDigest(pair.decision) ||
    !refsEqual(pair.rights.subjectRef, acquisition) ||
    pair.rights.rightsKind !== "local_extraction" ||
    pair.rights.status !== "permitted" ||
    pair.decision.operation !== "local_extraction" ||
    pair.decision.outcome !== "allow" ||
    pair.decision.sourceRefs.length !== 1 ||
    !refsEqual(pair.decision.sourceRefs[0]!, acquisition) ||
    pair.decision.rightsAssertionRefs.length !== 1 ||
    !refsEqual(pair.decision.rightsAssertionRefs[0]!, pair.rights)
  ) {
    throw new OwnerReferencePageAtlasUnavailableError();
  }
}

function assertCurrentSource(
  state: ReferenceSourceStagingState,
  context: OwnerReferencePageAtlasResolvedContext,
  effectiveAt: string
): void {
  if (
    !referenceSourceAcquisitionIsCurrentAndApplicable(
      state.snapshot.records,
      context.acquisition,
      context.digitalAsset,
      effectiveAt
    )
  ) {
    throw new OwnerReferencePageAtlasUnavailableError();
  }
}

function assertWorkbenchScope(
  request: Readonly<{
    workbenchSnapshotRef: ReferenceRecordRef;
    workbenchCardRef: ReferenceRecordRef;
  }>,
  context: OwnerReferencePageAtlasResolvedContext
): void {
  if (
    !refsEqual(request.workbenchSnapshotRef, context.currentWorkbenchSnapshotRef) ||
    !refsEqual(request.workbenchCardRef, context.currentWorkbenchCardRef)
  ) {
    throw new OwnerReferencePageAtlasStaleError();
  }
}

function assertWorkbenchCard(
  request: Readonly<{ workbenchCardRef: ReferenceRecordRef }>,
  context: OwnerReferencePageAtlasResolvedContext
): void {
  if (!refsEqual(request.workbenchCardRef, context.currentWorkbenchCardRef)) {
    throw new OwnerReferencePageAtlasStaleError();
  }
}

function assertPdfContext(context: OwnerReferencePageAtlasResolvedContext): void {
  if (
    context.digitalAsset.mediaType.split(";", 1)[0]!.trim().toLowerCase() !== SAFE_PDF_MEDIA_TYPE
  ) {
    throw new OwnerReferencePageAtlasUnsupportedMediaError();
  }
  if (!refsEqual(context.acquisition.digitalAssetRef, context.digitalAsset)) {
    throw new OwnerReferencePageAtlasUnavailableError();
  }
}

function classifyParserFailure(error: unknown): Readonly<{
  status: "failed" | "resource_exhausted" | "interrupted";
  failureCode:
    | "parser_failure"
    | "resource_limit"
    | "malformed_asset"
    | "unsupported_asset"
    | "interrupted";
  publicCode: string;
}> {
  if (error instanceof OwnerReferencePageAtlasInterruptionError) {
    return { status: "interrupted", failureCode: "interrupted", publicCode: error.code };
  }
  const code: ReferencePageAtlasParserFailureCode =
    error instanceof ReferencePageAtlasParserError ? error.code : "parser_failed";
  if (
    [
      "input_byte_limit_exceeded",
      "parser_timeout",
      "parser_output_limit_exceeded",
      "page_count_limit_exceeded",
      "page_dimension_limit_exceeded",
      "renderer_timeout",
      "renderer_output_limit_exceeded",
      "render_pixel_limit_exceeded",
    ].includes(code)
  ) {
    return { status: "resource_exhausted", failureCode: "resource_limit", publicCode: code };
  }
  if (code === "invalid_pdf_signature" || code === "parser_output_invalid") {
    return { status: "failed", failureCode: "malformed_asset", publicCode: code };
  }
  if (code === "page_ordinal_out_of_range") {
    return { status: "failed", failureCode: "unsupported_asset", publicCode: code };
  }
  return { status: "failed", failureCode: "parser_failure", publicCode: code };
}

function cloneInterruptedCheckpoint(
  basis: ReferencePageAtlasVersion,
  createdAt: string
): ReferencePageAtlasVersion {
  return withReferenceRecordDigest({
    recordKind: "page_atlas_version" as const,
    id: basis.id,
    version: basis.version + 1,
    parentVersionRef: versionedRefFor(basis),
    digitalAssetRef: basis.digitalAssetRef,
    acquisitionRefs: basis.acquisitionRefs,
    accessDecisionRef: basis.accessDecisionRef,
    componentRef: basis.componentRef,
    configurationDigest: basis.configurationDigest,
    resourcePolicyRef: basis.resourcePolicyRef,
    coverage: basis.coverage,
    canvasCount: basis.canvasCount,
    processedScanRanges: basis.processedScanRanges,
    unprocessedScanRanges: basis.unprocessedScanRanges,
    canvases: basis.canvases,
    createdAt,
  }) as ReferencePageAtlasVersion;
}

function changedCanvasIdsBetween(
  prior: ReferencePageAtlasVersion,
  successor: ReferencePageAtlasVersion
): string[] {
  const before = new Map(prior.canvases.map((canvas) => [canvas.canvasId, canvas]));
  const after = new Map(successor.canvases.map((canvas) => [canvas.canvasId, canvas]));
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter(
      (id) =>
        !before.has(id) ||
        !after.has(id) ||
        referenceSourceDigest(before.get(id)) !== referenceSourceDigest(after.get(id))
    )
    .sort();
}

function rangesFromOrdinals(
  values: ReadonlySet<number>,
  maximum: number
): Array<{ start: number; end: number }> {
  const sorted = [...values]
    .filter((value) => value >= 1 && value <= maximum)
    .sort((a, b) => a - b);
  const result: Array<{ start: number; end: number }> = [];
  for (const value of sorted) {
    const last = result[result.length - 1];
    if (last && last.end + 1 === value) last.end = value;
    else result.push({ start: value, end: value });
  }
  return result;
}

function complementOrdinals(values: ReadonlySet<number>, maximum: number): Set<number> {
  const result = new Set<number>();
  for (let value = 1; value <= maximum; value += 1) {
    if (!values.has(value)) result.add(value);
  }
  return result;
}

function expandRanges(ranges: readonly { start: number; end: number }[]): number[] {
  const values: number[] = [];
  for (const { start, end } of ranges) {
    for (let value = start; value <= end; value += 1) values.push(value);
  }
  return values;
}

function renderedGeometryDigest(
  rendered: ReferencePageAtlasRenderedPage,
  canvasId: string,
  regions: readonly {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    unit: string;
  }[]
): string {
  return referenceSourceDigest({
    schemaVersion: 1,
    renderedPageSha256: createHash("sha256").update(rendered.bytes).digest("hex"),
    canvasId,
    regions,
  });
}

function pageAtlasExecutionIdentity(
  profile: ReferencePageAtlasProfile,
  runtime: ReferencePageAtlasRuntimeIdentity,
  resumeBatchPages: number,
  sourceProfile?: MacePageAtlasSourceProfile
): PageAtlasExecutionIdentity {
  const { configuration, ...component } = runtime;
  const componentRef: ReferenceRecordRef = {
    id: "component.page-atlas.poppler.v1",
    digest: referenceSourceDigest(component),
  };
  return Object.freeze({
    componentRef,
    configurationDigest: referenceSourceDigest({
      schemaVersion: 1,
      componentRef,
      parserConfiguration: configuration,
      profile,
      resumeBatchPages,
      processing: "local_only",
      network: "disabled",
      coordinateSystem: "normalized-top-left.v1",
      sourceProfile:
        sourceProfile === undefined
          ? null
          : {
              registryRef: sourceProfile.registryRef,
              configurationDigest: sourceProfile.configurationDigest,
            },
      initialProfilePages: {
        generic_paged_source: [1],
        "mace-musicks-monument-1676": sourceProfile?.atlas.initialScanPages ?? [],
      },
      regions: {
        image: { x: 0, y: 0, width: 1, height: 1, unit: "normalized" },
        maceText: sourceProfile?.extraction.regions.text ?? null,
        maceNotation: sourceProfile?.extraction.regions.notation ?? null,
      },
      implementation: {
        atlasBuilder: "vellum.owner-reference-page-atlas-builder.v1",
        citationProjector: "vellum.owner-reference-citation-lineage-projector.v1",
      },
    }),
    resourcePolicyRef: PAGE_ATLAS_RESOURCE_POLICY_REF,
  });
}

function unresolvedExecutionIdentity(
  profile: ReferencePageAtlasProfile,
  resumeBatchPages: number
): PageAtlasExecutionIdentity {
  const componentRef: ReferenceRecordRef = {
    id: "component.page-atlas.runtime-unresolved.v1",
    digest: referenceSourceDigest({
      schemaVersion: 1,
      state: "unresolved",
      reason: "parser_failed_before_runtime_identity",
    }),
  };
  return Object.freeze({
    componentRef,
    configurationDigest: referenceSourceDigest({
      schemaVersion: 1,
      state: "unresolved",
      profile,
      resumeBatchPages,
      processing: "local_only",
      network: "disabled",
    }),
    resourcePolicyRef: PAGE_ATLAS_RESOURCE_POLICY_REF,
  });
}

function executionIdentityFromAtlas(atlas: ReferencePageAtlasVersion): PageAtlasExecutionIdentity {
  return Object.freeze({
    componentRef: atlas.componentRef,
    configurationDigest: atlas.configurationDigest,
    resourcePolicyRef: atlas.resourcePolicyRef,
  });
}

function assertAtlasExecutionCompatible(
  atlas: ReferencePageAtlasVersion,
  execution: PageAtlasExecutionIdentity
): void {
  if (
    !refsEqual(atlas.componentRef, execution.componentRef) ||
    atlas.configurationDigest !== execution.configurationDigest ||
    !refsEqual(atlas.resourcePolicyRef, execution.resourcePolicyRef)
  ) {
    throw new OwnerReferencePageAtlasRegenerationUnavailableError();
  }
}

function assertInspectionRuntime(
  inspection: ReferencePageAtlasInspection | undefined,
  runtime: ReferencePageAtlasRuntimeIdentity
): asserts inspection is ReferencePageAtlasInspection {
  if (!inspection || inspection.parserId !== runtime.parser.id) {
    throw new ReferencePageAtlasParserError("parser_output_invalid");
  }
}

function assertRenderRuntime(
  rendered: ReferencePageAtlasRenderedPage | undefined,
  runtime: ReferencePageAtlasRuntimeIdentity
): asserts rendered is ReferencePageAtlasRenderedPage {
  if (!rendered || rendered.rendererId !== runtime.renderer.id) {
    throw new ReferencePageAtlasParserError("renderer_output_invalid");
  }
}

function assertRenderedCanvasGeometry(
  rendered: ReferencePageAtlasRenderedPage,
  canvas: ReferencePageAtlasCanvas
): void {
  if (
    rendered.scanOrdinal !== canvas.scanOrder ||
    rendered.widthPixels !== canvas.widthPixels ||
    rendered.heightPixels !== canvas.heightPixels
  ) {
    throw new OwnerReferencePageAtlasMappingError();
  }
}

function numericPrintedOrdinal(value: string): number | undefined {
  const ordinal = Number(value);
  return Number.isSafeInteger(ordinal) && ordinal >= 0 ? ordinal : undefined;
}

function decodeResumeBatchPages(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_RESUME_BATCH_PAGES) {
    throw new TypeError("Page Atlas resume batch size is invalid");
  }
  return value;
}

function profileTag(profile: ReferencePageAtlasProfile): "generic" | "mace" {
  return profile === "generic_paged_source" ? "generic" : "mace";
}

function profileForTag(value: string | undefined): ReferencePageAtlasProfile | null {
  return value === "generic"
    ? "generic_paged_source"
    : value === "mace"
      ? "mace-musicks-monument-1676"
      : null;
}

function operationId(profile: ReferencePageAtlasProfile, suffix: string): string {
  return `page-atlas.owner.${profileTag(profile)}.${suffix}`;
}

function operationSuffix(id: string): string {
  const suffix = OPERATION_ID.exec(id)?.[2];
  if (!suffix) throw new OwnerReferencePageAtlasUnavailableError();
  return suffix;
}

function attemptId(profile: ReferencePageAtlasProfile, suffix: string, sequence: number): string {
  return `page-atlas-attempt.owner.${profileTag(profile)}.${suffix}.${sequence}`;
}

function operationIdentity(
  suffix: string,
  projector: OpaqueProjector,
  exact: Readonly<{ purpose: string; scopeEvidenceRef?: ReferenceRecordRef }> = { purpose: "" }
): AuthorizationIdentity {
  return {
    suffix,
    rightsId: `rights-assertion.owner-local-extraction.${suffix}`,
    decisionId: `access-decision.owner-local-extraction.${suffix}`,
    scopeEvidenceRef: exact.scopeEvidenceRef ?? scopeEvidenceForSuffix(suffix, projector),
    operationRef: projector.project("page-atlas-operation", { suffix }),
    purpose: exact.purpose,
  };
}

function scopeEvidenceForSuffix(suffix: string, projector: OpaqueProjector): ReferenceRecordRef {
  return projector.project("page-atlas-lineage-evidence", { suffix });
}

function receipt(
  operationRef: ReferenceRecordRef,
  replayed: boolean
): OwnerReferencePageAtlasMutationReceipt {
  return Object.freeze({ status: "accepted", operationRef, replayed });
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function refFor(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refKey(value: { id: string; digest: string }): string {
  return `${value.id}\u0000${value.digest}`;
}

function versionedRefFor(value: {
  id: string;
  version: number;
  digest: string;
}): VersionedReferenceRecordRef {
  return { id: value.id, version: value.version, digest: value.digest };
}

function refsEqual(
  left: { id: string; digest: string },
  right: { id: string; digest: string }
): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function maceSourceProfileMatchesAsset(
  profile: MacePageAtlasSourceProfile,
  asset: ReferenceDigitalAsset,
  inspection: ReferencePageAtlasInspection
): boolean {
  const { configurationDigest, ...configuration } = profile;
  const expectedSymbols = ["a", "/a", "//a", "///a", "4", "5"] as const;
  return (
    profile.schemaVersion === 1 &&
    /^[a-f0-9]{64}$/u.test(configurationDigest) &&
    referenceSourceDigest(configuration) === configurationDigest &&
    profile.registryRef.id.length > 0 &&
    /^[a-f0-9]{64}$/u.test(profile.registryRef.digest) &&
    profile.evidenceRef.id.length > 0 &&
    /^[a-f0-9]{64}$/u.test(profile.evidenceRef.digest) &&
    profile.exactAsset.sha256 === asset.sha256 &&
    profile.exactAsset.byteLength === asset.byteLength &&
    profile.exactAsset.mediaType === asset.mediaType &&
    profile.exactAsset.pageCount === inspection.pageCount &&
    inspection.pages.length === inspection.pageCount &&
    profile.atlas.targetScanPage >= 1 &&
    profile.atlas.targetScanPage <= inspection.pageCount &&
    profile.atlas.initialScanPages.includes(profile.atlas.targetScanPage) &&
    profile.extraction.originalTranscription === expectedSymbols.join(" ") &&
    profile.extraction.normalizedTranscription === expectedSymbols.join(" ") &&
    profile.extraction.mappings.length === expectedSymbols.length &&
    profile.extraction.mappings.every(
      ({ course, symbol }, index) => course === index + 7 && symbol === expectedSymbols[index]
    )
  );
}

export class OwnerReferencePageAtlasConflictError extends Error {
  readonly code = "owner_reference_page_atlas_operation_conflict" as const;

  constructor() {
    super("The Page Atlas operation is already bound to a different exact request");
    this.name = "OwnerReferencePageAtlasConflictError";
  }
}

export class OwnerReferencePageAtlasLineageLimitError extends Error {
  readonly code = "owner_reference_page_atlas_lineage_limit_conflict" as const;

  constructor() {
    super("The cited-segment lineage reached the bounded Page Atlas projection limit");
    this.name = "OwnerReferencePageAtlasLineageLimitError";
  }
}

export class OwnerReferencePageAtlasStaleError extends Error {
  readonly code = "owner_reference_page_atlas_snapshot_stale" as const;

  constructor() {
    super("The Owner-reference Workbench changed before the Page Atlas operation committed");
    this.name = "OwnerReferencePageAtlasStaleError";
  }
}

export class OwnerReferencePageAtlasUnsupportedMediaError extends Error {
  readonly code = "owner_reference_page_atlas_media_unsupported" as const;

  constructor() {
    super("The selected Owner reference is not a supported PDF");
    this.name = "OwnerReferencePageAtlasUnsupportedMediaError";
  }
}

export class OwnerReferencePageAtlasSourceProfileError extends Error {
  readonly code = "owner_reference_page_atlas_source_profile_unavailable" as const;

  constructor() {
    super("The selected source-specific Page Atlas profile does not match these exact bytes");
    this.name = "OwnerReferencePageAtlasSourceProfileError";
  }
}

export class OwnerReferencePageAtlasMappingError extends Error {
  readonly code = "owner_reference_page_atlas_mapping_invalid" as const;

  constructor() {
    super("The requested Page Atlas mapping cannot be applied to the exact bounded source");
    this.name = "OwnerReferencePageAtlasMappingError";
  }
}

export class OwnerReferencePageAtlasUnavailableError extends Error {
  readonly code = "owner_reference_page_atlas_unavailable" as const;

  constructor() {
    super("The local Page Atlas workflow is unavailable");
    this.name = "OwnerReferencePageAtlasUnavailableError";
  }
}

export class OwnerReferencePageAtlasRegenerationUnavailableError extends Error {
  readonly code = "owner_reference_page_atlas_regeneration_unavailable" as const;

  constructor() {
    super(
      "Immutable Page Atlas preview bytes are unavailable; regeneration with a current renderer is not replay"
    );
    this.name = "OwnerReferencePageAtlasRegenerationUnavailableError";
  }
}

/** Closed cancellation/interruption signal for a bounded local parser seam. */
export class OwnerReferencePageAtlasInterruptionError extends Error {
  readonly code = "owner_reference_page_atlas_interrupted" as const;

  constructor() {
    super("The bounded local Page Atlas operation was interrupted");
    this.name = "OwnerReferencePageAtlasInterruptionError";
  }
}
