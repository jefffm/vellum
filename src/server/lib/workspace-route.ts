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
const WorkspaceRenameSchema = Type.Object(
  { title: Type.String({ minLength: 1 }) },
  { additionalProperties: false }
);
const WorkspaceRemoveSchema = Type.Object(
  { confirmation: Type.String({ minLength: 1 }) },
  { additionalProperties: false }
);

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

export function createWorkspaceNavigationRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute({
    validate: (_body, request) => Value.Decode(WorkspaceParamsSchema, request.params),
    handler: async ({ workspaceId }) => {
      const workspace = store.get(workspaceId);
      const stale = workspace.staleDerivationIds
        .map((id) => store.getStaleDerivation(workspaceId, id))
        .filter((record) => !record.acknowledged);
      return {
        workspace: {
          id: workspace.id,
          title: workspace.title,
          updatedAt: workspace.updatedAt,
          createdAt: workspace.createdAt,
        },
        families: workspace.arrangementFamilyIds.map((familyId) => {
          const family = store.getArrangementFamily(workspaceId, familyId);
          return {
            id: family.id,
            updatedAt: family.updatedAt,
            arrangements: family.arrangementScoreIds.map((arrangementId) => {
              const arrangement = store.getArrangementScore(workspaceId, arrangementId);
              const branch = arrangement.branchId
                ? store.getArrangementBranch(workspaceId, arrangement.branchId)
                : undefined;
              return {
                id: arrangement.id,
                version: arrangement.version ?? 1,
                parentArrangementScoreId: arrangement.parentArrangementScoreId,
                instrumentId: arrangement.targetConfiguration.instrumentId,
                targetConfigurationId: arrangement.targetConfiguration.id,
                branch: branch ? { id: branch.id, label: branch.label } : undefined,
                auditStatus: arrangement.preservationAudit.status,
                staleReason: stale.find(
                  (record) =>
                    record.recordType === "arrangement_score" && record.recordId === arrangement.id
                )?.reason,
                deliverables: workspace.deliverableIds
                  .map((id) => store.getDeliverable(workspaceId, id))
                  .filter((deliverable) => deliverable.arrangementScoreId === arrangement.id)
                  .map((deliverable) => ({
                    id: deliverable.id,
                    kind: deliverable.kind,
                    notationLayout: deliverable.notationLayout,
                    sha256: deliverable.sha256,
                  })),
                createdAt: arrangement.createdAt,
              };
            }),
          };
        }),
      };
    },
  });
}

export function createWorkspaceRenameRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceParamsSchema, request.params),
      ...Value.Decode(WorkspaceRenameSchema, body),
    }),
    handler: async ({ workspaceId, title }) => store.rename(workspaceId, title),
  });
}

export function createWorkspaceRemoveRoute(store = new WorkspaceStore()): RequestHandler {
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceParamsSchema, request.params),
      ...Value.Decode(WorkspaceRemoveSchema, body),
    }),
    handler: async ({ workspaceId, confirmation }) => {
      store.remove(workspaceId, confirmation);
      return { removed: true, workspaceId };
    },
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
            mimeType: request.header("Content-Type")?.split(";", 1)[0] ?? "application/pdf",
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
  if (!value) throw new Error("X-Source-Filename is required for source uploads");
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
