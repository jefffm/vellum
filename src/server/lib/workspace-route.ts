import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CreateWorkspaceSchema } from "../../lib/music-domain.js";
import type {
  ArrangementWorkspace,
  CreateWorkspace,
  SourceArtifact,
  UploadSourceArtifact,
} from "../../lib/music-domain.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import {
  setSourceArtifactResponseHeaders,
  validateSourceArtifactForServing,
} from "./artifact-response.js";
import { WorkspaceStore } from "./workspace-store.js";

const WorkspaceParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});
const WorkspaceRenameSchema = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    expectedRevision: Type.Optional(Type.Integer({ minimum: 1 })),
  },
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
    handler: async ({ workspaceId, title, expectedRevision }) =>
      store.rename(workspaceId, title, expectedRevision),
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

export function createSourceUploadRoute(
  store = new WorkspaceStore(),
  options: { maxBytes?: number } = {}
): RequestHandler {
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  return async (request, response, next) => {
    let spoolDirectory: string | undefined;
    try {
      const { workspaceId } = Value.Decode(WorkspaceParamsSchema, request.params);
      const declaredLength = Number(request.header("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new ApiRouteError(
          `Source upload exceeds byte limit ${maxBytes}`,
          413,
          "request_too_large",
          { limitBytes: maxBytes }
        );
      }
      spoolDirectory = await mkdtemp(path.join(tmpdir(), "vellum-source-upload-"));
      const spoolPath = path.join(spoolDirectory, "source.upload");
      const hash = createHash("sha256");
      let byteLength = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          byteLength += chunk.byteLength;
          if (byteLength > maxBytes) {
            callback(
              new ApiRouteError(
                `Source upload exceeds byte limit ${maxBytes}`,
                413,
                "request_too_large",
                { limitBytes: maxBytes }
              )
            );
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(request, meter, createWriteStream(spoolPath, { mode: 0o600 }));
      const artifact = store.addSourceArtifactFromSpool(workspaceId, {
        filename: decodeFilename(request.header("X-Source-Filename")),
        mimeType: request.header("Content-Type")?.split(";", 1)[0] ?? "application/pdf",
        provenance: {
          license:
            request.header("X-Source-License") ?? "User supplied; rights not asserted by Vellum",
        },
        spoolPath,
        sha256: hash.digest("hex"),
        byteLength,
      });
      response.status(200).json({ ok: true, data: artifact });
    } catch (error) {
      next(error);
    } finally {
      if (spoolDirectory) await rm(spoolDirectory, { recursive: true, force: true });
    }
  };
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

      validateSourceArtifactForServing(artifact, content);
      setSourceArtifactResponseHeaders(response, artifact);
      response.send(content);
    } catch (error) {
      next(error);
    }
  };
}
