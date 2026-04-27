import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RequestHandler } from "express";
import { createApiRoute, ApiRouteError } from "./create-route.js";

export type TemplateSummary = {
  name: string;
  description: string;
};

type TemplateRouteOptions = {
  directory?: string;
};

export function templatesDirectory(): string {
  return process.env.VELLUM_TEMPLATES_DIR ?? path.resolve(process.cwd(), "templates");
}

export function createTemplateListRoute(options: TemplateRouteOptions = {}): RequestHandler {
  const directory = options.directory ?? templatesDirectory();

  return createApiRoute<undefined, TemplateSummary[]>({
    validate: () => undefined,
    handler: async () => listTemplates(directory),
  });
}

export function createTemplateGetRoute(options: TemplateRouteOptions = {}): RequestHandler {
  const directory = options.directory ?? templatesDirectory();

  return (request, response, next) => {
    try {
      const source = getTemplateSource(String(request.params.name ?? ""), directory);
      response.type("text/plain").send(source);
    } catch (error) {
      if (error instanceof ApiRouteError) {
        response.status(error.status).json({ ok: false, error: error.message });
        return;
      }

      next(error);
    }
  };
}

export function listTemplates(directory = templatesDirectory()): TemplateSummary[] {
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".ly"))
    .map((fileName) => {
      const source = readFileSync(path.join(directory, fileName), "utf8");
      return {
        name: path.basename(fileName, ".ly"),
        description: extractDescription(source),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getTemplateSource(name: string, directory = templatesDirectory()): string {
  assertSafeTemplateName(name);
  const filePath = path.join(directory, `${name}.ly`);

  if (!existsSync(filePath)) {
    throw new ApiRouteError(`Template not found: ${name}`, 404);
  }

  return readFileSync(filePath, "utf8");
}

function assertSafeTemplateName(name: string): void {
  if (!/^[a-z0-9_-]+$/i.test(name) || name.includes("..")) {
    throw new ApiRouteError(`Invalid template name: ${name}`, 400);
  }
}

function extractDescription(source: string): string {
  const comment = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("%"))
    .map((line) => line.replace(/^%+\s*/, "").trim())
    .find((line) => line.length > 0 && !/^=+$/.test(line));

  return comment ?? "LilyPond template";
}
