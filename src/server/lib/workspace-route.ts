import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { CreateWorkspaceSchema, UploadSourceArtifactSchema } from "../../lib/music-domain.js";
import type {
  ArrangementWorkspace,
  CreateWorkspace,
  SourceArtifact,
  UploadSourceArtifact,
} from "../../lib/music-domain.js";
import { createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

const WorkspaceParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});

const SourceParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  sourceArtifactId: Type.String({ pattern: "^source\\.[a-f0-9]{16,}$" }),
});

type WorkspaceParams = { workspaceId: string };
type SourceParams = WorkspaceParams & { sourceArtifactId: string };
type SourceUploadInput = WorkspaceParams & UploadSourceArtifact;

export function createWorkspaceListRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute<undefined, ArrangementWorkspace[]>({
    validate: () => undefined,
    handler: async () => store.list(),
  });
}

export function createWorkspaceGetRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute<WorkspaceParams, ArrangementWorkspace>({
    validate: (_body, request) => Value.Decode(WorkspaceParamsSchema, request.params),
    handler: async ({ workspaceId }) => store.get(workspaceId),
  });
}

export function createWorkspaceCreateRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute<CreateWorkspace, ArrangementWorkspace>({
    validate: (body) => Value.Decode(CreateWorkspaceSchema, body),
    handler: async (input) => store.create(input),
  });
}

export function createSourceUploadRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute<SourceUploadInput, SourceArtifact>({
    validate: (body, request) => {
      const upload = Buffer.isBuffer(body)
        ? {
            filename: decodeFilename(request.header("X-Source-Filename")),
            mimeType: "application/pdf",
            contentBase64: body.toString("base64"),
            provenance: {
              license:
                request.header("X-Source-License") ??
                "User supplied; rights not asserted by Vellum",
            },
          }
        : Value.Decode(UploadSourceArtifactSchema, body);
      return {
        ...Value.Decode(WorkspaceParamsSchema, request.params),
        ...upload,
      };
    },
    handler: async ({ workspaceId, ...input }) => store.addSourceArtifact(workspaceId, input),
  });
}

function decodeFilename(value: string | undefined): string {
  if (!value) throw new Error("X-Source-Filename is required for PDF uploads");
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("X-Source-Filename is not valid URI-encoded text");
  }
}

export function createSourceContentRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const { workspaceId, sourceArtifactId } = Value.Decode(SourceParamsSchema, request.params);
      const artifact = store.getSourceArtifact(workspaceId, sourceArtifactId);
      const content = store.readSourceContent(workspaceId, sourceArtifactId);

      response.setHeader("Content-Type", artifact.mimeType);
      response.setHeader("Content-Length", content.byteLength);
      response.setHeader("Content-Disposition", `inline; filename="${artifact.filename}"`);
      response.setHeader("ETag", `"sha256-${artifact.sha256}"`);
      response.send(content);
    } catch (error) {
      next(error);
    }
  };
}
