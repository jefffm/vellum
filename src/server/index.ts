import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import express, { ErrorRequestHandler, RequestHandler, Router } from "express";
import { createServer, Server } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { InstrumentProfile } from "../types.js";
import { VELLUM_BROWSER_SECURITY_HEADERS } from "../lib/content-security-policy.js";
import { VELLUM_API_SCHEMA_VERSION, type RuntimeHealth } from "../lib/runtime-contract.js";
import { createApiRoute, ApiRouteError } from "./lib/create-route.js";
import { loadAllProfiles, loadProfile, ProfileLoadError } from "./profiles.js";
import { createCompileRoute } from "./lib/compile-route.js";
import type { SubprocessRunner } from "./lib/subprocess.js";
import { createEngraveRoute } from "./lib/engrave-route.js";
import { createStreamRoute, providerConnection } from "./lib/stream-route.js";
import {
  createProviderDisconnectRoute,
  createProviderLoginRoute,
  createProviderPromptRoute,
  createProviderReconnectRoute,
  createProviderStatusRoute,
} from "./lib/provider-connection-route.js";
import {
  createModelActionCancelRoute,
  createModelActionCompleteRoute,
  createModelActionCreateRoute,
  createModelActionGetRoute,
  createModelActionInterruptRoute,
  createModelActionListRoute,
  createModelActionProgressRoute,
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
  createOwnerChoiceRoute,
  createOwnerReferenceRoute,
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
};

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({ status: "ok" });
  });

  router.post("/stream", createStreamRoute());
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
  router.get("/owner", createOwnerStateRoute());
  router.post("/owner/choices", createOwnerChoiceRoute());
  router.post(
    "/owner/personal-default-candidates/:id/approve",
    createDefaultCandidateDecisionRoute("approve")
  );
  router.post("/owner/personal-default-candidates", createDefaultCandidateProposalRoute());
  router.patch("/owner/personal-default-candidates/:id", createDefaultCandidateCorrectionRoute());
  router.post(
    "/owner/personal-default-candidates/:id/reject",
    createDefaultCandidateDecisionRoute("reject")
  );
  router.post("/owner/personal-defaults/:id/release", createDefaultReleaseRoute());
  router.post("/owner/references", createOwnerReferenceRoute());
  router.post("/owner/knowledge-candidates", createKnowledgeCandidateRoute());
  router.post("/owner/knowledge-promotions", createKnowledgePromotionRoute());
  router.post("/owner/intent-proposals", createOwnerIntentClassificationRoute());
  router.post(
    "/workspaces/:workspaceId/plan-conflicts/:conflictId/resolution",
    createPlanConflictResolutionRoute()
  );
  router.post("/owner/knowledge-candidates/:id/reject", createKnowledgeRejectionRoute());
  router.patch("/owner/knowledge-candidates/:id", createKnowledgeCorrectionRoute());
  router.post("/owner/historical-practice-claims/:id/release", createHistoricalClaimReleaseRoute());
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
  router.patch(
    "/workspaces/:workspaceId/model-actions/:modelActionId",
    createModelActionProgressRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/interrupt",
    createModelActionInterruptRoute()
  );
  router.post(
    "/workspaces/:workspaceId/model-actions/:modelActionId/complete",
    createModelActionCompleteRoute()
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
  router.post("/workspaces/:workspaceId/arrangements", createFaithfulArrangementRoute());
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
        return (
          !/^\/api\/workspaces\/[^/]+\/sources$/.test(requestPath) &&
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

  app.use("/api", createApiRouter({ compilerRunner: options.compilerRunner }));
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
  const app = createApp({ security });
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
