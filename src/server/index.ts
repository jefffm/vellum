import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import express, { ErrorRequestHandler, RequestHandler, Router } from "express";
import { createServer, Server } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { InstrumentProfile } from "../types.js";
import { VELLUM_BROWSER_SECURITY_HEADERS } from "../lib/content-security-policy.js";
import { assertAuthorityPathRuntime } from "../lib/authority-path-runtime.js";
import { VELLUM_API_SCHEMA_VERSION, type RuntimeHealth } from "../lib/runtime-contract.js";
import { createApiRoute, ApiRouteError } from "./lib/create-route.js";
import { loadAllProfiles, loadProfile, ProfileLoadError } from "./profiles.js";
import { createCompileRoute } from "./lib/compile-route.js";
import type { SubprocessRunner } from "./lib/subprocess.js";
import { createEngraveRoute } from "./lib/engrave-route.js";
import { providerConnection } from "./lib/provider-runtime.js";
import {
  createProviderDisconnectRoute,
  createProviderLoginRoute,
  createProviderPromptRoute,
  createProviderReconnectRoute,
  createProviderStatusRoute,
} from "./lib/provider-connection-route.js";
import {
  createModelActionCancelRoute,
  createModelActionAuthorizationRoute,
  createModelActionCreateRoute,
  createModelActionGetRoute,
  createModelActionInterruptRoute,
  createModelActionListRoute,
  createModelActionPublicationGetRoute,
  createModelActionRunRoute,
  createModelActionRetryRoute,
} from "./lib/model-action-route.js";
import { redactSecretText } from "./lib/secret-redaction.js";
import {
  createArrangementCandidateBranchRoute,
  createArrangementCandidateGetRoute,
  createArrangementCandidatePreviewRoute,
  createArrangementSearchGetRoute,
  createPassageCandidateAdoptRoute,
  createPassageCandidateListRoute,
  createPassageCandidatePreviewRoute,
} from "./lib/arrangement-search-route.js";
import { createAnalyzeRoute, createChordifyRoute, createLintRoute } from "./lib/theory-route.js";
import { createValidateRoute } from "./lib/validate-route.js";
import {
  createGuidedWorkflowActiveRoute,
  createGuidedWorkflowCheckpointRoute,
  createGuidedWorkflowCreateRoute,
  createGuidedWorkflowInterruptRoute,
  createGuidedWorkflowRestartRoute,
  createGuidedWorkflowResumeRoute,
} from "./lib/guided-workflow-route.js";
import { createTemplateGetRoute, createTemplateListRoute } from "./lib/template-route.js";
import {
  createArrangementCreateRoute,
  createArrangementDeleteRoute,
  createArrangementGetRoute,
  createArrangementListRoute,
} from "./lib/arrangement-route.js";
import {
  createSourceContentRoute,
  createSourceUploadRoute,
  createWorkspaceCreateRoute,
  createWorkspaceGetRoute,
  createWorkspaceListRoute,
  createWorkspaceNavigationRoute,
  createWorkspaceRemoveRoute,
  createWorkspaceRenameRoute,
} from "./lib/workspace-route.js";
import { createOmrArtifactContentRoute, createOmrRunRoute } from "./lib/omr-route.js";
import { createSourceImportRoute } from "./lib/source-import-route.js";
import { WorkspaceStore } from "./lib/workspace-store.js";
import { createNarrowEvaluationCardRoute } from "./lib/narrow-evaluation-route.js";
import {
  createTranscriptionCorrectionRoute,
  createTranscriptionReviewRoute,
} from "./lib/transcription-route.js";
import { createFaithfulArrangementRoute } from "./lib/arrangement-workspace-route.js";
import {
  createArrangementCompileRoute,
  createArrangementPreviewRoute,
  createArrangementRestoreRoute,
  createArrangementScoreGetRoute,
} from "./lib/arrangement-deliverable-route.js";
import { createAnalysisCorrectionRoute, createAnalysisGetRoute } from "./lib/analysis-route.js";
import {
  createArrangementPlanCorrectionRoute,
  createArrangementPlanGetRoute,
} from "./lib/arrangement-plan-route.js";
import { createOwnerIntentClassificationRoute } from "./lib/owner-intent-route.js";
import { createPlanConflictResolutionRoute } from "./lib/plan-conflict-route.js";
import {
  createArrangementFamilyGetRoute,
  createDeliverableContentRoute,
  createDeliverableGetRoute,
} from "./lib/family-deliverable-route.js";
import {
  createArrangementLineageRoute,
  createArrangementSourceLineageRoute,
  createArrangementEventEditRoute,
  createArrangementEditBatchRoute,
  createArrangementEditBatchValidationRoute,
  createCommitmentReleaseRoute,
  createConservativeRegenerationRoute,
  createEditorialCommitmentRoute,
  createFamilyCommitmentPromotionRoute,
  createPlanDecisionFamilyCommitmentPromotionRoute,
  createPolicyExceptionRoute,
  createStaleAcknowledgementRoute,
} from "./lib/lineage-route.js";
import {
  createDefaultCandidateDecisionRoute,
  createDefaultCandidateCorrectionRoute,
  createDefaultCandidateProposalRoute,
  createDefaultReleaseRoute,
  createHistoricalClaimReleaseRoute,
  createKnowledgeCandidateRoute,
  createKnowledgeCorrectionRoute,
  createKnowledgePromotionRoute,
  createKnowledgeRejectionRoute,
  createLegacyOwnerReferenceQuarantineRoute,
  createOwnerChoiceRoute,
  createOwnerStateRoute,
} from "./lib/owner-route.js";
import {
  createPerformanceInterpretationCreateRoute,
  createPerformanceInterpretationListRoute,
  createPerformanceInterpretationPreviewRoute,
} from "./lib/performance-interpretation-route.js";
import {
  createArrangementReadinessRoute,
  createOwnerPlaytestCreateRoute,
} from "./lib/owner-playtest-route.js";
import { createTrackedSourceInventoryRoute } from "./lib/tracked-source-inventory-route.js";
import { createAuthorityPathInventoryRoute } from "./lib/authority-path-inventory-route.js";
import { OwnerStore } from "./lib/owner-store.js";
import { ReferenceSourceStagingStore } from "./lib/reference-source-staging-store.js";
import {
  createOwnerLocalExtractionStagingWriter,
  createOwnerPrivateStudyStagingWriter,
  createReferenceSourcePageAtlasStagingWriter,
  createReferenceSourceControlledUploadStagingWriter,
  ReferenceSourceStagingService,
} from "./lib/reference-source-staging-service.js";
import {
  ReferenceSourceLifecyclePlanningService,
  type ReferenceSourceAuthorityTrust,
  type ReferenceSourceLifecycleEvidenceProvider,
  type ReferenceSourceRetentionAuthorityTrust,
} from "./lib/reference-source-lifecycle-service.js";
import { createReferenceSourceLifecycleSecurityBundle } from "./lib/reference-source-lifecycle-security.js";
import { ReferenceSourceControlledArtifactStore } from "./lib/reference-source-controlled-artifact-store.js";
import { createReferenceSourceControlledAssetUploadRoute } from "./lib/reference-source-controlled-asset-route.js";
import { ReferenceSourceControlledAssetIngestionService } from "./lib/reference-source-controlled-asset-service.js";
import {
  createReferenceSourceCompilerInputRoute,
  createReferenceSourceOperationDefaultDecisionRoute,
  createReferenceSourceProtectedOperationRoute,
} from "./lib/reference-source-operation-route.js";
import { ReferenceSourceOperationGateway } from "./lib/reference-source-operation-gateway.js";
import {
  createFailClosedReferenceSourceProtectedOperationSinks,
  ReferenceSourceProtectedOperationAdapter,
  type ReferenceSourceProtectedOperationSinks,
} from "./lib/reference-source-protected-operation-adapter.js";
import type { ReferenceSourceControlledStoreInventoryAdapter } from "./lib/reference-source-inventory-provider.js";
import { createReferenceSourceLifecyclePlanRoute } from "./lib/reference-source-lifecycle-route.js";
import {
  createKnowledgePublicationCurrentRoute,
  createKnowledgePublicationGenerationRoute,
  createKnowledgePublicationOrphanReclaimRoute,
  createKnowledgePublicationOrphansRoute,
  createKnowledgePublicationPublishRoute,
} from "./lib/knowledge-publication-route.js";
import { KnowledgePublicationStore } from "./lib/knowledge-publication-store.js";
import { OwnerReferenceLegacyReader } from "./lib/owner-reference-legacy-reader.js";
import { OwnerReferenceMigrationService } from "./lib/owner-reference-migration-service.js";
import {
  createOwnerReferenceMigrationCommitRoute,
  createOwnerReferenceMigrationCompatibilityRoute,
  createOwnerReferenceMigrationDryRunRoute,
  createOwnerReferenceMigrationInterruptedRollbackRoute,
  createOwnerReferenceMigrationRollbackRoute,
} from "./lib/owner-reference-migration-route.js";
import {
  createOwnerReferenceWorkbenchLocalOperationReviewRoute,
  createOwnerReferenceWorkbenchLocalStudyRoute,
  createOwnerReferenceWorkbenchReadRoute,
  createOwnerReferenceWorkbenchUploadConfirmationRoute,
} from "./lib/owner-reference-workbench-route.js";
import {
  loadOrCreateOwnerReferenceWorkbenchOpaqueProjector,
  OwnerReferenceWorkbenchOpaqueProjector,
  OwnerReferenceWorkbenchService,
} from "./lib/owner-reference-workbench-service.js";
import { OwnerReferenceLocalStudyService } from "./lib/owner-reference-local-study-service.js";
import { OwnerReferencePageAtlasService } from "./lib/owner-reference-page-atlas-service.js";
import {
  createOwnerReferencePageAtlasOperationRoute,
  createOwnerReferencePageAtlasPreviewRoute,
} from "./lib/owner-reference-page-atlas-route.js";
import { createTypedKnowledgeReleaseRoute } from "./lib/typed-knowledge-release-route.js";
import {
  TypedKnowledgeReleaseService,
  type TypedKnowledgePackCitationAuthorityProvider,
  type TypedKnowledgeSystemIdentityProvider,
} from "./lib/typed-knowledge-release-service.js";
import { createReviewerAuthorityWorkbenchRoute } from "./lib/reviewer-authority-route.js";
import {
  ReviewerAuthorityService,
  type ExternalReviewerVerifier,
  type ReviewerVerifierReceiptVerifier,
} from "./lib/reviewer-authority-service.js";
import { createKnowledgeResolutionRoute } from "./lib/knowledge-resolution-route.js";
import { KnowledgeResolutionService } from "./lib/knowledge-resolution-service.js";
import { createKnowledgeResolverCutoverRoute } from "./lib/knowledge-resolver-cutover-route.js";
import { KnowledgeResolverCutoverService } from "./lib/knowledge-resolver-cutover-service.js";
import {
  PopplerReferencePageAtlasParser,
  type ReferencePageAtlasParser,
} from "./lib/reference-page-atlas-parser.js";
import type { ReferencePageAtlasSourceProfileResolver } from "./lib/reference-page-atlas-source-profile.js";
import {
  createReferenceSourceObservationHistoryMigrationRoute,
  createReferenceSourceStagingReadRoute,
  createReferenceSourceStagingSnapshotRoute,
  createReferenceSourceStagingTransactionRoute,
} from "./lib/reference-source-staging-route.js";
import {
  createApiBoundary,
  errorCodeForStatus,
  logApiError,
  normalizeApiErrorResponses,
  requestContext,
  resolveRuntimeSecurity,
  sendApiFailure,
  type RuntimeSecurity,
  validateRuntimeSecurity,
} from "./lib/api-boundary.js";

type HealthResponse = RuntimeHealth;

type InstrumentSummary = {
  id: string;
  name: string;
  type?: string;
  courses?: number;
  strings?: number;
};

const InstrumentParamsSchema = Type.Object({ id: Type.String({ minLength: 1 }) });

const packageVersion = process.env.npm_package_version ?? "0.1.0";
const runtimeInstanceId = `runtime.${process.pid}.${Date.now()}`;

const notFound: RequestHandler = (request, response) => {
  sendApiFailure(response, {
    status: 404,
    code: "not_found",
    message: `No route for ${request.method} ${request.path}`,
  });
};

const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const declared = error instanceof ApiRouteError;
  const status = declared ? error.status : requestParserStatus(error);
  const expected = declared && (status < 500 || error.code !== "internal_error");
  const code = expected ? error.code : errorCodeForStatus(status);
  if (!expected) logApiError(request, response, error, status, code);
  sendApiFailure(response, {
    status,
    code,
    message: expected
      ? redactSecretText(error.message)
      : status === 400
        ? "Invalid request body"
        : status === 413
          ? "Request body is too large"
          : "Internal server error",
    details: expected ? error.details : undefined,
  });
};

function requestParserStatus(error: unknown): number {
  if (typeof error !== "object" || error === null) return 500;
  const type = (error as { type?: unknown }).type;
  if (type === "entity.parse.failed") return 400;
  if (type === "entity.too.large") return 413;
  return 500;
}

type ApiRouterOptions = {
  compilerRunner?: Pick<SubprocessRunner, "run">;
  referenceSourceStagingService?: ReferenceSourceStagingService;
  referenceSourceLifecycleEvidenceProvider?: ReferenceSourceLifecycleEvidenceProvider;
  referenceSourceAuthorityTrust?: ReferenceSourceAuthorityTrust;
  referenceSourceRetentionAuthorityTrust?: ReferenceSourceRetentionAuthorityTrust;
  referenceSourceControlledArtifactStore?: ReferenceSourceControlledArtifactStore;
  referenceSourceControlledStoreInventoryAdapters?: readonly ReferenceSourceControlledStoreInventoryAdapter[];
  knowledgePublicationStore?: KnowledgePublicationStore;
  /** Installed only by a later typed canonical writer or an explicit test harness. */
  knowledgePublicationWriter?: Pick<KnowledgePublicationStore, "publish">;
  ownerReferenceMigrationService?: OwnerReferenceMigrationService;
  ownerReferenceMigrationOwnerRootDirectory?: string;
  ownerReferenceMigrationPrivateRootDirectory?: string;
  ownerReferenceWorkbenchPrivateRootDirectory?: string;
  ownerReferenceWorkbenchOpaqueKey?: Uint8Array;
  referencePageAtlasParser?: ReferencePageAtlasParser;
  referencePageAtlasSourceProfileResolver?: ReferencePageAtlasSourceProfileResolver;
  typedKnowledgePackCitationAuthorityProvider?: TypedKnowledgePackCitationAuthorityProvider;
  typedKnowledgeSystemIdentityProvider?: TypedKnowledgeSystemIdentityProvider;
  reviewerAuthorityVerifier?: ExternalReviewerVerifier;
  reviewerAuthorityReceiptVerifier?: ReviewerVerifierReceiptVerifier;
  /**
   * Trusted server-bootstrap seam for future source-bearing workflows. HTTP
   * callers never select, replace, or receive these sinks.
   */
  referenceSourceProtectedOperationSinks?: ReferenceSourceProtectedOperationSinks;
};

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const router = Router();
  const ownerStore = new OwnerStore({
    rootDirectory: options.ownerReferenceMigrationOwnerRootDirectory,
  });
  const knowledgePublicationStore =
    options.knowledgePublicationStore ?? new KnowledgePublicationStore();
  let referenceSourceControlledArtifactStore =
    options.referenceSourceControlledArtifactStore ??
    options.referenceSourceControlledStoreInventoryAdapters?.find(
      (adapter): adapter is ReferenceSourceControlledArtifactStore =>
        adapter instanceof ReferenceSourceControlledArtifactStore
    );
  const getReferenceSourceControlledArtifactStore = () =>
    (referenceSourceControlledArtifactStore ??= new ReferenceSourceControlledArtifactStore());
  const getReferenceSourceInventoryAdapters = () =>
    options.referenceSourceControlledStoreInventoryAdapters
      ? referenceSourceControlledArtifactStore
        ? options.referenceSourceControlledStoreInventoryAdapters.includes(
            referenceSourceControlledArtifactStore
          )
          ? options.referenceSourceControlledStoreInventoryAdapters
          : [
              referenceSourceControlledArtifactStore,
              ...options.referenceSourceControlledStoreInventoryAdapters,
            ]
        : [
            getReferenceSourceControlledArtifactStore(),
            ...options.referenceSourceControlledStoreInventoryAdapters,
          ]
      : [getReferenceSourceControlledArtifactStore()];
  const referenceSourceLifecycleSecurity =
    options.referenceSourceLifecycleEvidenceProvider &&
    options.referenceSourceAuthorityTrust &&
    options.referenceSourceRetentionAuthorityTrust
      ? undefined
      : createReferenceSourceLifecycleSecurityBundle({
          inventoryAdapters: getReferenceSourceInventoryAdapters(),
        });
  const referenceSourceStagingService =
    options.referenceSourceStagingService ??
    new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore(),
      listLegacyOwnerReferences: () => ownerStore.listReferences(),
    });
  let ownerReferenceMigrationService = options.ownerReferenceMigrationService;
  const getOwnerReferenceMigrationService = () =>
    (ownerReferenceMigrationService ??= new OwnerReferenceMigrationService({
      journalStore: knowledgePublicationStore,
      controlledStore: getReferenceSourceControlledArtifactStore(),
      migrationGraphService: referenceSourceStagingService,
      ...(options.ownerReferenceMigrationPrivateRootDirectory
        ? { migrationRootDirectory: options.ownerReferenceMigrationPrivateRootDirectory }
        : {}),
      ...(options.ownerReferenceMigrationOwnerRootDirectory
        ? {
            legacySource: new OwnerReferenceLegacyReader({
              rootDirectory: options.ownerReferenceMigrationOwnerRootDirectory,
            }),
          }
        : {}),
    }));
  const ownerReferenceWorkbenchOpaqueProjector = options.ownerReferenceWorkbenchOpaqueKey
    ? new OwnerReferenceWorkbenchOpaqueProjector(options.ownerReferenceWorkbenchOpaqueKey)
    : loadOrCreateOwnerReferenceWorkbenchOpaqueProjector(
        options.ownerReferenceWorkbenchPrivateRootDirectory ??
          path.join(
            options.ownerReferenceMigrationPrivateRootDirectory ??
              options.ownerReferenceMigrationOwnerRootDirectory ??
              path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner"),
            "owner-reference-workbench"
          )
      );
  const ownerReferenceLocalStudyService = new OwnerReferenceLocalStudyService({
    stagingWriter: createOwnerPrivateStudyStagingWriter(referenceSourceStagingService),
    stagingStore: referenceSourceStagingService.store,
    controlledArtifacts: getReferenceSourceControlledArtifactStore(),
    opaqueProjector: ownerReferenceWorkbenchOpaqueProjector,
  });
  const ownerReferencePageAtlasService = new OwnerReferencePageAtlasService({
    localExtractionWriter: createOwnerLocalExtractionStagingWriter(referenceSourceStagingService),
    pageAtlasWriter: createReferenceSourcePageAtlasStagingWriter(referenceSourceStagingService),
    stagingStore: referenceSourceStagingService.store,
    controlledArtifacts: getReferenceSourceControlledArtifactStore(),
    parser: options.referencePageAtlasParser ?? new PopplerReferencePageAtlasParser(),
    sourceProfileResolver: options.referencePageAtlasSourceProfileResolver,
    opaqueProjector: ownerReferenceWorkbenchOpaqueProjector,
  });
  const typedKnowledgeReleaseService = new TypedKnowledgeReleaseService({
    pageAtlasService: ownerReferencePageAtlasService,
    publicationStore: knowledgePublicationStore,
    packCitationAuthorityProvider: options.typedKnowledgePackCitationAuthorityProvider,
    systemIdentityProvider: options.typedKnowledgeSystemIdentityProvider,
  });
  const reviewerAuthorityService = new ReviewerAuthorityService({
    publicationStore: knowledgePublicationStore,
    verifier: options.reviewerAuthorityVerifier,
    verifyReceipt: options.reviewerAuthorityReceiptVerifier,
  });
  const knowledgeResolutionService = new KnowledgeResolutionService({
    publicationStore: knowledgePublicationStore,
  });
  const knowledgeResolverCutoverService = new KnowledgeResolverCutoverService({
    publicationStore: knowledgePublicationStore,
  });
  const ownerReferenceWorkbenchService = new OwnerReferenceWorkbenchService({
    staging: referenceSourceStagingService,
    migration: {
      readCompatibility: () => getOwnerReferenceMigrationService().readCompatibility(),
    },
    controlledArtifacts: getReferenceSourceControlledArtifactStore(),
    opaqueProjector: ownerReferenceWorkbenchOpaqueProjector,
    operationGateway: new ReferenceSourceOperationGateway({
      stagingStore: referenceSourceStagingService.store,
    }),
    localStudyService: ownerReferenceLocalStudyService,
    pageAtlasService: ownerReferencePageAtlasService,
    typedKnowledgeReleaseService,
  });
  const referenceSourceProtectedOperationAdapter = new ReferenceSourceProtectedOperationAdapter({
    gateway: new ReferenceSourceOperationGateway({
      stagingStore: referenceSourceStagingService.store,
    }),
    readControlledBytes: (digitalAssetRef) =>
      getReferenceSourceControlledArtifactStore().readDigitalAssetBytes(digitalAssetRef),
    sinks:
      options.referenceSourceProtectedOperationSinks ??
      createFailClosedReferenceSourceProtectedOperationSinks(),
  });
  let referenceSourceControlledAssetIngestionService:
    | ReferenceSourceControlledAssetIngestionService
    | undefined;
  const getReferenceSourceControlledAssetIngestionService = () =>
    (referenceSourceControlledAssetIngestionService ??=
      new ReferenceSourceControlledAssetIngestionService({
        stagingService: createReferenceSourceControlledUploadStagingWriter(
          referenceSourceStagingService
        ),
        controlledStore: getReferenceSourceControlledArtifactStore(),
      }));
  // Constructor recovery reconciles any metadata/byte publication interrupted
  // before restart. Complete it before the first Workbench read can observe the
  // shared stores; the upload route still reuses this single service instance.
  getReferenceSourceControlledAssetIngestionService();
  const referenceSourceLifecyclePlanningService = new ReferenceSourceLifecyclePlanningService({
    store: referenceSourceStagingService.store,
    evidenceProvider:
      options.referenceSourceLifecycleEvidenceProvider ??
      referenceSourceLifecycleSecurity!.evidenceProvider,
    authorityTrust:
      options.referenceSourceAuthorityTrust ?? referenceSourceLifecycleSecurity!.authorityTrust,
    retentionAuthorityTrust:
      options.referenceSourceRetentionAuthorityTrust ??
      referenceSourceLifecycleSecurity!.retentionAuthorityTrust,
  });

  router.get("/", (_request, response) => {
    response.json({ status: "ok" });
  });

  router.get("/provider-connection", createProviderStatusRoute(providerConnection));
  router.post("/provider-connection/login", createProviderLoginRoute(providerConnection));
  router.post("/provider-connection/prompt", createProviderPromptRoute(providerConnection));
  router.post("/provider-connection/reconnect", createProviderReconnectRoute(providerConnection));
  router.delete("/provider-connection", createProviderDisconnectRoute(providerConnection));
  router.post("/compile", createCompileRoute({ runner: options.compilerRunner }));
  router.post("/engrave", createEngraveRoute());
  router.post("/validate", createValidateRoute({ runner: options.compilerRunner }));
  router.post("/chordify", createChordifyRoute());
  router.post("/analyze", createAnalyzeRoute());
  router.post("/lint", createLintRoute());

  router.get("/templates", createTemplateListRoute());
  router.get("/templates/:name", createTemplateGetRoute());

  router.get("/arrangements", createArrangementListRoute());
  router.get("/arrangements/:id", createArrangementGetRoute());
  router.post("/arrangements", createArrangementCreateRoute());
  router.delete("/arrangements/:id", createArrangementDeleteRoute());

  router.get("/workspaces", createWorkspaceListRoute());
  router.get("/owner", createOwnerStateRoute(ownerStore));
  router.get("/owner/authority-path-inventory", createAuthorityPathInventoryRoute());
  router.get("/owner/tracked-source-inventory", createTrackedSourceInventoryRoute());
  router.get(
    "/owner/reference-source-staging",
    createReferenceSourceStagingReadRoute(referenceSourceStagingService)
  );
  router.get(
    "/owner/reference-source-workbench",
    createOwnerReferenceWorkbenchReadRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-workbench/upload-confirmation",
    createOwnerReferenceWorkbenchUploadConfirmationRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-workbench/local-operation-review",
    createOwnerReferenceWorkbenchLocalOperationReviewRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-workbench/local-study",
    createOwnerReferenceWorkbenchLocalStudyRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-workbench/page-atlas",
    createOwnerReferencePageAtlasOperationRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-workbench/page-atlas/preview",
    createOwnerReferencePageAtlasPreviewRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-workbench/typed-knowledge-release",
    createTypedKnowledgeReleaseRoute(ownerReferenceWorkbenchService)
  );
  router.post(
    "/owner/reference-source-operations/default-decision",
    createReferenceSourceOperationDefaultDecisionRoute(referenceSourceStagingService.store)
  );
  router.post(
    "/owner/reference-source-operations/execute",
    createReferenceSourceProtectedOperationRoute(referenceSourceProtectedOperationAdapter)
  );
  router.post(
    "/owner/reference-source-operations/compiler-input",
    createReferenceSourceCompilerInputRoute(referenceSourceProtectedOperationAdapter)
  );
  router.get(
    "/owner/reference-migrations/owner-references",
    createOwnerReferenceMigrationCompatibilityRoute(getOwnerReferenceMigrationService())
  );
  router.post(
    "/owner/reference-migrations/owner-references/dry-run",
    createOwnerReferenceMigrationDryRunRoute(getOwnerReferenceMigrationService())
  );
  router.post(
    "/owner/reference-migrations/owner-references/commit",
    createOwnerReferenceMigrationCommitRoute(getOwnerReferenceMigrationService())
  );
  router.post(
    "/owner/reference-migrations/owner-references/rollback",
    createOwnerReferenceMigrationRollbackRoute(getOwnerReferenceMigrationService())
  );
  router.post(
    "/owner/reference-migrations/owner-references/rollback-interrupted",
    createOwnerReferenceMigrationInterruptedRollbackRoute(getOwnerReferenceMigrationService())
  );
  router.get(
    "/owner/reference-source-staging/snapshots/:snapshotId",
    createReferenceSourceStagingSnapshotRoute(referenceSourceStagingService)
  );
  router.post(
    "/owner/reference-source-staging/assets",
    createReferenceSourceControlledAssetUploadRoute(
      getReferenceSourceControlledAssetIngestionService
    )
  );
  router.post(
    "/owner/reference-source-staging/transactions",
    createReferenceSourceStagingTransactionRoute(referenceSourceStagingService)
  );
  router.post(
    "/owner/reference-source-staging/observation-history-migration",
    createReferenceSourceObservationHistoryMigrationRoute(referenceSourceStagingService)
  );
  router.post(
    "/owner/reference-source-staging/lifecycle/plan",
    createReferenceSourceLifecyclePlanRoute(referenceSourceLifecyclePlanningService)
  );
  router.get(
    "/owner/knowledge-publication",
    createKnowledgePublicationCurrentRoute(
      knowledgePublicationStore,
      ownerReferenceWorkbenchOpaqueProjector
    )
  );
  router.get(
    "/owner/reviewer-authority",
    createReviewerAuthorityWorkbenchRoute(reviewerAuthorityService)
  );
  const knowledgeResolutionRoute = createKnowledgeResolutionRoute(knowledgeResolutionService);
  router.get("/owner/knowledge-resolution", knowledgeResolutionRoute);
  router.post("/owner/knowledge-resolution", knowledgeResolutionRoute);
  const knowledgeResolverCutoverRoute = createKnowledgeResolverCutoverRoute(
    knowledgeResolverCutoverService
  );
  router.get("/owner/knowledge-resolver-cutover", knowledgeResolverCutoverRoute);
  router.post("/owner/knowledge-resolver-cutover", knowledgeResolverCutoverRoute);
  if (options.knowledgePublicationWriter) {
    router.post(
      "/owner/knowledge-publication/generations",
      createKnowledgePublicationPublishRoute(options.knowledgePublicationWriter)
    );
  }
  router.get(
    "/owner/knowledge-publication/generations/:generationId",
    createKnowledgePublicationGenerationRoute(knowledgePublicationStore)
  );
  router.get(
    "/owner/knowledge-publication/orphans",
    createKnowledgePublicationOrphansRoute(knowledgePublicationStore)
  );
  router.delete(
    "/owner/knowledge-publication/orphans/:generationId",
    createKnowledgePublicationOrphanReclaimRoute(knowledgePublicationStore)
  );
  router.post("/owner/choices", createOwnerChoiceRoute(ownerStore));
  router.post(
    "/owner/personal-default-candidates/:id/approve",
    createDefaultCandidateDecisionRoute("approve", ownerStore)
  );
  router.post(
    "/owner/personal-default-candidates",
    createDefaultCandidateProposalRoute(ownerStore)
  );
  router.patch(
    "/owner/personal-default-candidates/:id",
    createDefaultCandidateCorrectionRoute(ownerStore)
  );
  router.post(
    "/owner/personal-default-candidates/:id/reject",
    createDefaultCandidateDecisionRoute("reject", ownerStore)
  );
  router.post("/owner/personal-defaults/:id/release", createDefaultReleaseRoute(ownerStore));
  router.post("/owner/references", createLegacyOwnerReferenceQuarantineRoute());
  router.post("/owner/knowledge-candidates", createKnowledgeCandidateRoute(ownerStore));
  router.post("/owner/knowledge-promotions", createKnowledgePromotionRoute(ownerStore));
  router.post("/owner/intent-proposals", createOwnerIntentClassificationRoute());
  router.post(
    "/workspaces/:workspaceId/plan-conflicts/:conflictId/resolution",
    createPlanConflictResolutionRoute()
  );
  router.post("/owner/knowledge-candidates/:id/reject", createKnowledgeRejectionRoute(ownerStore));
  router.patch("/owner/knowledge-candidates/:id", createKnowledgeCorrectionRoute(ownerStore));
  router.post(
    "/owner/historical-practice-claims/:id/release",
    createHistoricalClaimReleaseRoute(ownerStore)
  );
  router.post("/workspaces", createWorkspaceCreateRoute());
  router.get("/workspaces/:workspaceId", createWorkspaceGetRoute());
  router.get("/workspaces/:workspaceId/navigation", createWorkspaceNavigationRoute());
  router.patch("/workspaces/:workspaceId", createWorkspaceRenameRoute());
  router.delete("/workspaces/:workspaceId", createWorkspaceRemoveRoute());
  router.get(
    "/workspaces/:workspaceId/arrangement-families/:familyId",
    createArrangementFamilyGetRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/events/:eventId/edits",
    createArrangementEventEditRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/edit-batches",
    createArrangementEditBatchRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/edit-batches/validate",
    createArrangementEditBatchValidationRoute()
  );
  router.get("/workspaces/:workspaceId/deliverables/:deliverableId", createDeliverableGetRoute());
  router.get(
    "/workspaces/:workspaceId/deliverables/:deliverableId/content",
    createDeliverableContentRoute()
  );
  router.get("/workspaces/:workspaceId/analyses/:analysisRecordId", createAnalysisGetRoute());
  router.post(
    "/workspaces/:workspaceId/analyses/:analysisRecordId/claims/:claimId/corrections",
    createAnalysisCorrectionRoute()
  );
  router.get("/workspaces/:workspaceId/arrangement-plans/:planId", createArrangementPlanGetRoute());
  router.post(
    "/workspaces/:workspaceId/arrangement-plans/:planId/corrections",
    createArrangementPlanCorrectionRoute()
  );
  router.get("/workspaces/:workspaceId/model-actions", createModelActionListRoute());
  router.post("/workspaces/:workspaceId/model-actions", createModelActionCreateRoute());
  router.get("/workspaces/:workspaceId/model-actions/:modelActionId", createModelActionGetRoute());
  router.get(
    "/workspaces/:workspaceId/model-actions/:modelActionId/publication",
    createModelActionPublicationGetRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/authorization",
    createModelActionAuthorizationRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/interrupt",
    createModelActionInterruptRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/run",
    createModelActionRunRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/retry",
    createModelActionRetryRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/cancel",
    createModelActionCancelRoute()
  );
  router.post("/workspaces/:workspaceId/sources", createSourceUploadRoute());
  router.get(
    "/workspaces/:workspaceId/sources/:sourceArtifactId/content",
    createSourceContentRoute()
  );
  router.post(
    "/workspaces/:workspaceId/sources/:sourceArtifactId/import",
    createSourceImportRoute()
  );
  router.post("/workspaces/:workspaceId/omr-runs", createOmrRunRoute());
  router.post("/workspaces/:workspaceId/guided-workflows", createGuidedWorkflowCreateRoute());
  router.get("/workspaces/:workspaceId/guided-workflows/active", createGuidedWorkflowActiveRoute());
  router.patch(
    "/workspaces/:workspaceId/guided-workflows/:workflowId",
    createGuidedWorkflowCheckpointRoute()
  );
  router.post(
    "/workspaces/:workspaceId/guided-workflows/:workflowId/interrupt",
    createGuidedWorkflowInterruptRoute()
  );
  router.post(
    "/workspaces/:workspaceId/guided-workflows/:workflowId/resume",
    createGuidedWorkflowResumeRoute()
  );
  router.post(
    "/workspaces/:workspaceId/guided-workflows/:workflowId/restart",
    createGuidedWorkflowRestartRoute()
  );
  router.get(
    "/workspaces/:workspaceId/omr-runs/:omrRunId/artifacts/:filename",
    createOmrArtifactContentRoute()
  );
  router.post(
    "/workspaces/:workspaceId/transcriptions/:transcriptionId/corrections",
    createTranscriptionCorrectionRoute()
  );
  router.get(
    "/workspaces/:workspaceId/transcriptions/:transcriptionId/review",
    createTranscriptionReviewRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements",
    createFaithfulArrangementRoute({ ownerStore })
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/evaluation-card",
    createNarrowEvaluationCardRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangement-searches/:searchId",
    createArrangementSearchGetRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangement-searches/:searchId/candidates/:candidateId",
    createArrangementCandidateGetRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangement-searches/:searchId/candidates/:candidateId/audio-preview",
    createArrangementCandidatePreviewRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangement-searches/:searchId/candidates/:candidateId/branch",
    createArrangementCandidateBranchRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/passage-candidates",
    createPassageCandidateListRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/passage-candidates/audio-preview",
    createPassageCandidatePreviewRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/passage-candidates/adopt",
    createPassageCandidateAdoptRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId",
    createArrangementScoreGetRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/restore",
    createArrangementRestoreRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/performance-interpretations",
    createPerformanceInterpretationListRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/performance-interpretations",
    createPerformanceInterpretationCreateRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/readiness",
    createArrangementReadinessRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/owner-playtests",
    createOwnerPlaytestCreateRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/performance-interpretations/:interpretationId/audio-preview",
    createPerformanceInterpretationPreviewRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/lineage",
    createArrangementLineageRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/source-lineage",
    createArrangementSourceLineageRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/commitments",
    createEditorialCommitmentRoute()
  );
  router.post(
    "/workspaces/:workspaceId/commitments/:commitmentId/release",
    createCommitmentReleaseRoute()
  );
  router.post(
    "/workspaces/:workspaceId/commitments/:commitmentId/promote-to-family",
    createFamilyCommitmentPromotionRoute()
  );
  router.post(
    "/workspaces/:workspaceId/plans/:planId/decisions/:decisionId/promote-to-family",
    createPlanDecisionFamilyCommitmentPromotionRoute()
  );
  router.post(
    "/workspaces/:workspaceId/stale-derivations/:staleDerivationId/acknowledge",
    createStaleAcknowledgementRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/conservative-regeneration",
    createConservativeRegenerationRoute()
  );
  router.post(
    "/workspaces/:workspaceId/commitment-conflicts/:conflictId/exceptions",
    createPolicyExceptionRoute()
  );
  router.get(
    "/workspaces/:workspaceId/arrangements/:arrangementId/audio-preview",
    createArrangementPreviewRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/compile",
    createArrangementCompileRoute(undefined, options.compilerRunner)
  );

  router.get(
    "/instruments",
    createApiRoute<undefined, InstrumentSummary[]>({
      validate: () => undefined,
      handler: async () => loadAllProfiles().map(instrumentSummary),
    })
  );

  router.get(
    "/instruments/:id",
    createApiRoute<{ id: string }, InstrumentProfile>({
      validate: (_body, request) => Value.Decode(InstrumentParamsSchema, request.params),
      handler: async ({ id }) => {
        try {
          return loadProfile(id);
        } catch (error) {
          if (error instanceof ProfileLoadError) {
            throw new ApiRouteError(`Instrument profile not found: ${id}`, 404);
          }

          throw error;
        }
      },
    })
  );

  return router;
}

function instrumentSummary(profile: InstrumentProfile): InstrumentSummary {
  return {
    id: profile.id,
    name: profile.name,
    type: profile.type,
    courses: profile.courses,
    strings: profile.strings,
  };
}

type CreateAppOptions = {
  security?: RuntimeSecurity;
  compilerRunner?: Pick<SubprocessRunner, "run">;
  referenceSourceStagingService?: ReferenceSourceStagingService;
  referenceSourceLifecycleEvidenceProvider?: ReferenceSourceLifecycleEvidenceProvider;
  referenceSourceAuthorityTrust?: ReferenceSourceAuthorityTrust;
  referenceSourceRetentionAuthorityTrust?: ReferenceSourceRetentionAuthorityTrust;
  referenceSourceControlledArtifactStore?: ReferenceSourceControlledArtifactStore;
  referenceSourceControlledStoreInventoryAdapters?: readonly ReferenceSourceControlledStoreInventoryAdapter[];
  knowledgePublicationStore?: KnowledgePublicationStore;
  knowledgePublicationWriter?: Pick<KnowledgePublicationStore, "publish">;
  ownerReferenceMigrationService?: OwnerReferenceMigrationService;
  ownerReferenceMigrationOwnerRootDirectory?: string;
  ownerReferenceMigrationPrivateRootDirectory?: string;
  ownerReferenceWorkbenchPrivateRootDirectory?: string;
  ownerReferenceWorkbenchOpaqueKey?: Uint8Array;
  referencePageAtlasParser?: ReferencePageAtlasParser;
  referencePageAtlasSourceProfileResolver?: ReferencePageAtlasSourceProfileResolver;
  typedKnowledgePackCitationAuthorityProvider?: TypedKnowledgePackCitationAuthorityProvider;
  typedKnowledgeSystemIdentityProvider?: TypedKnowledgeSystemIdentityProvider;
  reviewerAuthorityVerifier?: ExternalReviewerVerifier;
  reviewerAuthorityReceiptVerifier?: ReviewerVerifierReceiptVerifier;
  referenceSourceProtectedOperationSinks?: ReferenceSourceProtectedOperationSinks;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const distPath = path.resolve(process.cwd(), "dist");
  const security = validateRuntimeSecurity(options.security ?? resolveRuntimeSecurity());

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    for (const [name, value] of Object.entries(VELLUM_BROWSER_SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }
    next();
  });
  app.use(requestContext);
  app.use(normalizeApiErrorResponses);
  app.use("/api", createApiBoundary(security));
  app.use(
    express.json({
      limit: "4mb",
      type: (request) => {
        const requestPath = request.url?.split("?", 1)[0] ?? "";
        const isRawUpload =
          /^\/api\/workspaces\/[^/]+\/sources$/.test(requestPath) ||
          requestPath === "/api/owner/reference-source-staging/assets";
        return (
          !isRawUpload &&
          /^application\/json(?:;|$)/i.test(String(request.headers["content-type"] ?? ""))
        );
      },
    })
  );

  app.get("/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      version: packageVersion,
      apiSchemaVersion: VELLUM_API_SCHEMA_VERSION,
      runtimeInstanceId,
    };
    response.json(body);
  });

  app.use(
    "/api",
    createApiRouter({
      compilerRunner: options.compilerRunner,
      referenceSourceStagingService: options.referenceSourceStagingService,
      referenceSourceLifecycleEvidenceProvider: options.referenceSourceLifecycleEvidenceProvider,
      referenceSourceAuthorityTrust: options.referenceSourceAuthorityTrust,
      referenceSourceRetentionAuthorityTrust: options.referenceSourceRetentionAuthorityTrust,
      referenceSourceControlledArtifactStore: options.referenceSourceControlledArtifactStore,
      referenceSourceControlledStoreInventoryAdapters:
        options.referenceSourceControlledStoreInventoryAdapters,
      knowledgePublicationStore: options.knowledgePublicationStore,
      knowledgePublicationWriter: options.knowledgePublicationWriter,
      ownerReferenceMigrationService: options.ownerReferenceMigrationService,
      ownerReferenceMigrationOwnerRootDirectory: options.ownerReferenceMigrationOwnerRootDirectory,
      ownerReferenceMigrationPrivateRootDirectory:
        options.ownerReferenceMigrationPrivateRootDirectory,
      ownerReferenceWorkbenchPrivateRootDirectory:
        options.ownerReferenceWorkbenchPrivateRootDirectory,
      ownerReferenceWorkbenchOpaqueKey: options.ownerReferenceWorkbenchOpaqueKey,
      referencePageAtlasParser: options.referencePageAtlasParser,
      referencePageAtlasSourceProfileResolver: options.referencePageAtlasSourceProfileResolver,
      typedKnowledgePackCitationAuthorityProvider:
        options.typedKnowledgePackCitationAuthorityProvider,
      typedKnowledgeSystemIdentityProvider: options.typedKnowledgeSystemIdentityProvider,
      reviewerAuthorityVerifier: options.reviewerAuthorityVerifier,
      reviewerAuthorityReceiptVerifier: options.reviewerAuthorityReceiptVerifier,
      referenceSourceProtectedOperationSinks: options.referenceSourceProtectedOperationSinks,
    })
  );
  app.use(express.static(distPath));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

type StartServerOptions = CreateAppOptions & {
  installSignalHandlers?: boolean;
};

export function startServer(
  port = Number(process.env.PORT ?? 3000),
  options: StartServerOptions = {}
): Server {
  const security = validateRuntimeSecurity(options.security ?? resolveRuntimeSecurity());
  new WorkspaceStore({ recoverOnStart: true });
  const app = createApp({
    security,
    compilerRunner: options.compilerRunner,
    referenceSourceStagingService: options.referenceSourceStagingService,
    referenceSourceLifecycleEvidenceProvider: options.referenceSourceLifecycleEvidenceProvider,
    referenceSourceAuthorityTrust: options.referenceSourceAuthorityTrust,
    referenceSourceRetentionAuthorityTrust: options.referenceSourceRetentionAuthorityTrust,
    referenceSourceControlledArtifactStore: options.referenceSourceControlledArtifactStore,
    referenceSourceControlledStoreInventoryAdapters:
      options.referenceSourceControlledStoreInventoryAdapters,
    knowledgePublicationStore: options.knowledgePublicationStore,
    knowledgePublicationWriter: options.knowledgePublicationWriter,
    ownerReferenceMigrationService: options.ownerReferenceMigrationService,
    ownerReferenceMigrationOwnerRootDirectory: options.ownerReferenceMigrationOwnerRootDirectory,
    ownerReferenceMigrationPrivateRootDirectory:
      options.ownerReferenceMigrationPrivateRootDirectory,
    ownerReferenceWorkbenchPrivateRootDirectory:
      options.ownerReferenceWorkbenchPrivateRootDirectory,
    ownerReferenceWorkbenchOpaqueKey: options.ownerReferenceWorkbenchOpaqueKey,
    referencePageAtlasParser: options.referencePageAtlasParser,
    referencePageAtlasSourceProfileResolver: options.referencePageAtlasSourceProfileResolver,
    typedKnowledgePackCitationAuthorityProvider:
      options.typedKnowledgePackCitationAuthorityProvider,
    typedKnowledgeSystemIdentityProvider: options.typedKnowledgeSystemIdentityProvider,
    reviewerAuthorityVerifier: options.reviewerAuthorityVerifier,
    reviewerAuthorityReceiptVerifier: options.reviewerAuthorityReceiptVerifier,
    referenceSourceProtectedOperationSinks: options.referenceSourceProtectedOperationSinks,
  });
  const server = createServer(app);

  server.listen(port, security.host, () => {
    const address = server.address();
    const actualPort = address && typeof address !== "string" ? address.port : port;
    console.log(`Vellum server listening on http://${formatHost(security.host)}:${actualPort}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}; shutting down Vellum server`);
    server.close((error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  };

  if (options.installSignalHandlers !== false) {
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }

  return server;
}

function formatHost(host: string): string {
  return host.includes(":") ? `[${host}]` : host;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  startServer();
}
