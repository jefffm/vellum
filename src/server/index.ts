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
import { createStreamRoute } from "./lib/stream-route.js";
import { createAnalyzeRoute, createChordifyRoute, createLintRoute } from "./lib/theory-route.js";
import { createValidateRoute } from "./lib/validate-route.js";
import { createTemplateGetRoute, createTemplateListRoute } from "./lib/template-route.js";
import {
  createArrangementCreateRoute,
  createArrangementDeleteRoute,
  createArrangementGetRoute,
  createArrangementListRoute,
} from "./lib/arrangement-route.js";

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
    response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
      message: error instanceof Error ? error.message : "Internal server error",
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
