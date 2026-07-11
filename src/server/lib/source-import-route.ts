import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { RecognizedScoreSchema } from "../../lib/music-domain.js";
import { createApiRoute } from "./create-route.js";
import { SourceImportService, type SourceImportResult } from "./source-import-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const Params = Type.Object({
  workspaceId: Type.String({ minLength: 1 }),
  sourceArtifactId: Type.String({ minLength: 1 }),
});
const Body = Type.Object(
  {
    voiceNames: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
    bestEffortScore: Type.Optional(RecognizedScoreSchema),
  },
  { additionalProperties: false }
);

export function createSourceImportRoute(
  options: {
    store?: WorkspaceStore;
    service?: SourceImportService;
  } = {}
): RequestHandler {
  const store = options.store ?? new WorkspaceStore();
  const service = options.service ?? new SourceImportService({ store });
  return createApiRoute<any, SourceImportResult>({
    validate: (body, request) => ({
      ...Value.Decode(Params, request.params),
      ...Value.Decode(Body, body ?? {}),
    }),
    handler: async ({ workspaceId, sourceArtifactId, ...input }) =>
      service.import(workspaceId, sourceArtifactId, input),
  });
}
