import express, { ErrorRequestHandler, RequestHandler, Router } from "express";
import { createServer, Server } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type HealthResponse = {
  status: "ok";
  version: string;
};

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
      status: 404
    }
  });
};

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = typeof error.status === "number" ? error.status : 500;

  response.status(status).json({
    error: {
      message: error instanceof Error ? error.message : "Internal server error",
      status
    }
  });
};

export function createApiRouter(): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({ status: "ok" });
  });

  return router;
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
