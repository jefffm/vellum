import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import type { OmrBackend } from "./omr.js";
import { AudiverisBackend, OmrService } from "./omr.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";

const OmrRequestSchema = Type.Object(
  {
    sourceArtifactId: Type.String({ pattern: "^source\\.[a-f0-9]{16,}$" }),
    backend: Type.Optional(Type.Literal("audiveris", { default: "audiveris" })),
    autoAcceptConfidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  },
  { additionalProperties: false }
);

const WorkspaceParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});

type OmrRouteInput = {
  workspaceId: string;
  sourceArtifactId: string;
  backend?: "audiveris";
  autoAcceptConfidence?: number;
};

type OmrRouteOptions = {
  store?: WorkspaceStore;
  backendFactory?: (id: "audiveris") => OmrBackend;
  service?: OmrService;
};

export function createOmrRunRoute(options: OmrRouteOptions = {}): RequestHandler {
  assertAuthorityPathRuntime("authority.validator.source-interpretation", "production");
  const store = options.store ?? new WorkspaceStore();
  const service = options.service ?? new OmrService({ store });
  const backendFactory = options.backendFactory ?? (() => new AudiverisBackend());

  return createApiRoute<OmrRouteInput, Awaited<ReturnType<OmrService["recognize"]>>>({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceParamsSchema, request.params),
      ...Value.Decode(OmrRequestSchema, body),
    }),
    handler: async ({
      workspaceId,
      sourceArtifactId,
      backend = "audiveris",
      autoAcceptConfidence,
    }) =>
      service.recognize(workspaceId, sourceArtifactId, backendFactory(backend), {
        autoAcceptConfidence,
      }),
  });
}

export function createOmrArtifactContentRoute(
  options: Pick<OmrRouteOptions, "store"> = {}
): RequestHandler {
  const store = options.store ?? new WorkspaceStore();
  return (request, response, next) => {
    try {
      const workspaceId = String(request.params.workspaceId ?? "");
      const omrRunId = String(request.params.omrRunId ?? "");
      const filename = String(request.params.filename ?? "");
      if (
        !workspaceId?.match(/^workspace\.[a-f0-9-]{16,}$/) ||
        !omrRunId?.match(/^omr\.[a-f0-9-]{16,}$/) ||
        !filename?.match(/^[A-Za-z0-9._-]+$/)
      ) {
        throw new ApiRouteError("Invalid OMR artifact request", 400);
      }
      const content = store.readOmrArtifact(workspaceId, omrRunId, filename);
      response.type(filename.endsWith(".png") ? "image/png" : "application/octet-stream");
      response.send(content);
    } catch (error) {
      next(error);
    }
  };
}
