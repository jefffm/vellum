import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import express, { ErrorRequestHandler, RequestHandler, Router } from "express";
import { createServer, Server } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { InstrumentProfile } from "../types.js";
import { createApiRoute, ApiRouteError } from "./lib/create-route.js";
import { loadAllProfiles, loadProfile, ProfileLoadError } from "./profiles.js";
import { createCompileRoute } from "./lib/compile-route.js";
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
import { createAnalyzeRoute, createChordifyRoute, createLintRoute } from "./lib/theory-route.js";
import { createValidateRoute } from "./lib/validate-route.js";
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
} from "./lib/workspace-route.js";
import { createOmrArtifactContentRoute, createOmrRunRoute } from "./lib/omr-route.js";
import {
  createTranscriptionCorrectionRoute,
  createTranscriptionReviewRoute,
} from "./lib/transcription-route.js";
import { createFaithfulArrangementRoute } from "./lib/arrangement-workspace-route.js";
import {
  createArrangementCompileRoute,
  createArrangementPreviewRoute,
} from "./lib/arrangement-deliverable-route.js";

type HealthResponse = {
  status: "ok";
  version: string;
};

type InstrumentSummary = {
  id: string;
  name: string;
  type?: string;
  courses?: number;
  strings?: number;
};

const InstrumentParamsSchema = Type.Object({ id: Type.String({ minLength: 1 }) });

const packageVersion = process.env.npm_package_version ?? "0.1.0";

const devCors: RequestHandler = (request, response, next) => {
  if (process.env.NODE_ENV !== "production") {
    response.header("Access-Control-Allow-Origin", request.header("Origin") ?? "*");
    response.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Source-Filename, X-Source-License"
    );
    response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
};

const notFound: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      message: `No route for ${request.method} ${request.path}`,
      status: 404,
    },
  });
};

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = typeof error.status === "number" ? error.status : 500;

  response.status(status).json({
    error: {
      message: error instanceof Error ? redactSecretText(error.message) : "Internal server error",
      status,
    },
  });
};

export function createApiRouter(): Router {
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
  router.post("/compile", createCompileRoute());
  router.post("/engrave", createEngraveRoute());
  router.post("/validate", createValidateRoute());
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
  router.post("/workspaces", createWorkspaceCreateRoute());
  router.get("/workspaces/:workspaceId", createWorkspaceGetRoute());
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
  router.post(
    "/workspaces/:workspaceId/sources",
    express.raw({ type: "application/pdf", limit: "128mb" }),
    createSourceUploadRoute()
  );
  router.get(
    "/workspaces/:workspaceId/sources/:sourceArtifactId/content",
    createSourceContentRoute()
  );
  router.post("/workspaces/:workspaceId/omr-runs", createOmrRunRoute());
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
    "/workspaces/:workspaceId/arrangements/:arrangementId/audio-preview",
    createArrangementPreviewRoute()
  );
  router.post(
    "/workspaces/:workspaceId/arrangements/:arrangementId/compile",
    createArrangementCompileRoute()
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

export function createApp() {
  const app = express();
  const distPath = path.resolve(process.cwd(), "dist");

  app.disable("x-powered-by");
  app.use(devCors);
  app.use(express.json({ limit: "4mb" }));

  app.get("/health", (_request, response) => {
    const body: HealthResponse = { status: "ok", version: packageVersion };
    response.json(body);
  });

  app.use("/api", createApiRouter());
  app.use(express.static(distPath));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export function startServer(port = Number(process.env.PORT ?? 3000)): Server {
  const app = createApp();
  const server = createServer(app);

  server.listen(port, () => {
    console.log(`Vellum server listening on http://localhost:${port}`);
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

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return server;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  startServer();
}
