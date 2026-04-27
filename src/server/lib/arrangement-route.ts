import { Value } from "@sinclair/typebox/value";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { CreateArrangementSchema } from "../../types.js";
import type { Arrangement, ArrangementSummary, CreateArrangement } from "../../types.js";
import { createApiRoute, ApiRouteError } from "./create-route.js";

type ArrangementRouteOptions = {
  directory?: string;
};

type ArrangementIdParams = {
  id: string;
};

type ArrangementCreateResponse = {
  id: string;
  title: string;
  createdAt: string;
};

type ArrangementDeleteResponse = {
  id: string;
  deleted: true;
};

export function arrangementsDirectory(): string {
  return process.env.VELLUM_ARRANGEMENTS_DIR ?? path.resolve(process.cwd(), "arrangements");
}

export function createArrangementListRoute(options: ArrangementRouteOptions = {}): RequestHandler {
  const directory = options.directory ?? arrangementsDirectory();

  return createApiRoute<undefined, ArrangementSummary[]>({
    validate: () => undefined,
    handler: async () => listArrangements(directory),
  });
}

export function createArrangementGetRoute(options: ArrangementRouteOptions = {}): RequestHandler {
  const directory = options.directory ?? arrangementsDirectory();

  return createApiRoute<ArrangementIdParams, Arrangement>({
    validate: (_body, request) => ({ id: validateArrangementId(String(request.params.id ?? "")) }),
    handler: async ({ id }) => readArrangement(id, directory),
  });
}

export function createArrangementCreateRoute(
  options: ArrangementRouteOptions = {}
): RequestHandler {
  const directory = options.directory ?? arrangementsDirectory();

  return createApiRoute<CreateArrangement, ArrangementCreateResponse>({
    validate: (body) => Value.Decode(CreateArrangementSchema, body),
    handler: async (input) => createArrangement(input, directory),
  });
}

export function createArrangementDeleteRoute(
  options: ArrangementRouteOptions = {}
): RequestHandler {
  const directory = options.directory ?? arrangementsDirectory();

  return createApiRoute<ArrangementIdParams, ArrangementDeleteResponse>({
    validate: (_body, request) => ({ id: validateArrangementId(String(request.params.id ?? "")) }),
    handler: async ({ id }) => deleteArrangement(id, directory),
  });
}

export function createArrangement(
  input: CreateArrangement,
  directory = arrangementsDirectory()
): ArrangementCreateResponse {
  mkdirSync(directory, { recursive: true });
  const id = randomUUID();
  const now = new Date().toISOString();
  const arrangement: Arrangement = {
    id,
    title: input.title,
    instrument: input.instrument,
    lySource: input.lySource,
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    createdAt: now,
    updatedAt: now,
  };

  writeFileSync(
    arrangementPath(id, directory),
    `${JSON.stringify(arrangement, null, 2)}\n`,
    "utf8"
  );

  return { id, title: arrangement.title, createdAt: arrangement.createdAt };
}

export function listArrangements(directory = arrangementsDirectory()): ArrangementSummary[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readArrangement(path.basename(fileName, ".json"), directory))
    .map(({ id, title, instrument, createdAt }) => ({ id, title, instrument, createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title));
}

export function readArrangement(id: string, directory = arrangementsDirectory()): Arrangement {
  validateArrangementId(id);
  const filePath = arrangementPath(id, directory);

  if (!existsSync(filePath)) {
    throw new ApiRouteError(`Arrangement not found: ${id}`, 404);
  }

  const document = JSON.parse(readFileSync(filePath, "utf8")) as Arrangement;
  return document;
}

export function deleteArrangement(
  id: string,
  directory = arrangementsDirectory()
): ArrangementDeleteResponse {
  validateArrangementId(id);
  const filePath = arrangementPath(id, directory);

  if (!existsSync(filePath)) {
    throw new ApiRouteError(`Arrangement not found: ${id}`, 404);
  }

  rmSync(filePath);
  return { id, deleted: true };
}

function validateArrangementId(id: string): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) {
    throw new ApiRouteError(`Invalid arrangement id: ${id}`, 400);
  }

  return id;
}

function arrangementPath(id: string, directory: string): string {
  return path.join(directory, `${validateArrangementId(id)}.json`);
}
