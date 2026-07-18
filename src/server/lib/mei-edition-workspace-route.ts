import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import {
  CorrectionBatchCommandSchema,
  CreateMeiEditionCommandSchema,
  type CorrectionBatchCommand,
  type CreateMeiEditionCommand,
  type MeiEditionVersion,
} from "../../lib/mei-edition-domain.js";
import { renderMeiWithVerovio } from "../../lib/verovio-renderer.js";
import { createApiRoute } from "./create-route.js";
import { createNodeGeneratedArtifactSecurity } from "./generated-artifact-security-node.js";
import { MeiEditionService } from "./mei-edition-service.js";
import { MeiEditionStore } from "./mei-edition-store.js";
import { SubprocessRunner } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

const WorkspaceParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});
const EditionParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  editionId: Type.String({ pattern: "^edition\\.[a-f0-9-]{16,}$" }),
});
const EditionQuerySchema = Type.Object({
  version: Type.Optional(Type.Integer({ minimum: 1 })),
});
const UndoSchema = Type.Object(
  { expectedVersion: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false }
);

type ProjectedEdition = Readonly<{
  edition: MeiEditionVersion;
  svg: string;
  rendererVersion: string;
  sourceContentUrl: string;
}>;

function service(): MeiEditionService {
  return new MeiEditionService({ store: new MeiEditionStore() });
}

async function project(workspaceId: string, edition: MeiEditionVersion): Promise<ProjectedEdition> {
  const rendered = await renderMeiWithVerovio(
    edition.mei,
    edition.tokens.filter((token) => token.kind === "tablature").map((token) => token.id)
  );
  const security = createNodeGeneratedArtifactSecurity();
  try {
    return {
      edition,
      svg: security.sanitizeVerovioSvg(rendered.svg).markup,
      rendererVersion: rendered.version,
      sourceContentUrl: `/api/workspaces/${workspaceId}/sources/${edition.sourceArtifactId}/content#page=${edition.sourcePage}`,
    };
  } finally {
    security.dispose();
  }
}

export function createMeiEditionCreateRoute(): RequestHandler {
  return createApiRoute<
    { workspaceId: string; command: CreateMeiEditionCommand },
    ProjectedEdition
  >({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceParamsSchema, request.params),
      command: Value.Decode(CreateMeiEditionCommandSchema, body),
    }),
    handler: async ({ workspaceId, command }) =>
      project(workspaceId, service().create(workspaceId, command)),
  });
}

export function createMeiEditionGetRoute(): RequestHandler {
  return createApiRoute<
    { workspaceId: string; editionId: string; version?: number },
    ProjectedEdition
  >({
    validate: (_body, request) => ({
      ...Value.Decode(EditionParamsSchema, request.params),
      ...Value.Decode(EditionQuerySchema, {
        ...(request.query.version ? { version: Number(request.query.version) } : {}),
      }),
    }),
    handler: async ({ workspaceId, editionId, version }) =>
      project(workspaceId, service().get(workspaceId, editionId, version)),
  });
}

function correctionRoute(mode: "preview" | "commit"): RequestHandler {
  return createApiRoute<
    { workspaceId: string; editionId: string; command: CorrectionBatchCommand },
    ProjectedEdition
  >({
    validate: (body, request) => ({
      ...Value.Decode(EditionParamsSchema, request.params),
      command: Value.Decode(CorrectionBatchCommandSchema, body),
    }),
    handler: async ({ workspaceId, editionId, command }) =>
      project(
        workspaceId,
        mode === "preview"
          ? service().preview(workspaceId, editionId, command)
          : service().commit(workspaceId, editionId, command)
      ),
  });
}

export const createMeiEditionCorrectionPreviewRoute = () => correctionRoute("preview");
export const createMeiEditionCorrectionCommitRoute = () => correctionRoute("commit");

export function createMeiEditionUndoRoute(): RequestHandler {
  return createApiRoute<
    { workspaceId: string; editionId: string; expectedVersion: number },
    ProjectedEdition
  >({
    validate: (body, request) => ({
      ...Value.Decode(EditionParamsSchema, request.params),
      ...Value.Decode(UndoSchema, body),
    }),
    handler: async ({ workspaceId, editionId, expectedVersion }) =>
      project(workspaceId, service().undo(workspaceId, editionId, expectedVersion)),
  });
}

export function createMeiEditionFacsimileRoute(): RequestHandler {
  return async (request, response, next) => {
    try {
      const { workspaceId, editionId } = Value.Decode(EditionParamsSchema, request.params);
      const edition = service().get(workspaceId, editionId);
      const bytes = new WorkspaceStore().readSourceContent(workspaceId, edition.sourceArtifactId);
      const result = await new SubprocessRunner(30_000).run({
        command: "pdftoppm",
        args: [
          "-f",
          String(edition.sourcePage),
          "-l",
          String(edition.sourcePage),
          "-singlefile",
          "-png",
          "-r",
          "180",
          "source.pdf",
          "page",
        ],
        inputFile: { name: "source.pdf", content: bytes },
        outputGlobs: ["page.png"],
        writableOutputFiles: ["page.png"],
        timeout: 30_000,
        maxInputBytes: 32 * 1024 * 1024,
        maxAddressSpaceBytes: 1_024 * 1024 * 1024,
        maxCpuSeconds: 32,
        maxOpenFiles: 64,
        maxFileWriteBytes: 16 * 1024 * 1024,
        maxOutputFiles: 1,
        maxOutputFileBytes: 16 * 1024 * 1024,
        maxOutputTotalBytes: 16 * 1024 * 1024,
        maxScannedEntries: 8,
        maxCaptureBytes: 64 * 1024,
        maxEmittedBytes: 64 * 1024,
        networkAccess: "deny",
        filesystemAccess: "workdir-only",
      });
      const png = result.files.get("page.png");
      if (result.exitCode !== 0 || !png)
        throw new Error("Poppler did not produce the facsimile page");
      response.setHeader("Content-Type", "image/png");
      response.setHeader("Cache-Control", "private, max-age=300");
      response.send(png);
    } catch (error) {
      next(error);
    }
  };
}
