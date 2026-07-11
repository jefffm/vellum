import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { TranscriptionCorrectionSchema } from "../../lib/music-domain.js";
import type { TranscriptionCorrection } from "../../lib/music-domain.js";
import { createApiRoute } from "./create-route.js";
import { TranscriptionService } from "./transcription-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const ParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  transcriptionId: Type.String({ pattern: "^transcription\\.[a-f0-9-]{16,}$" }),
});

type RouteInput = {
  workspaceId: string;
  transcriptionId: string;
  correction: TranscriptionCorrection;
};

type RouteOptions = {
  store?: WorkspaceStore;
  service?: TranscriptionService;
};

export function createTranscriptionCorrectionRoute(options: RouteOptions = {}): RequestHandler {
  const store = options.store ?? new WorkspaceStore();
  const service = options.service ?? new TranscriptionService({ store });

  return createApiRoute<RouteInput, ReturnType<TranscriptionService["correct"]>>({
    validate: (body, request) => ({
      ...Value.Decode(ParamsSchema, request.params),
      correction: Value.Decode(TranscriptionCorrectionSchema, body),
    }),
    handler: async ({ workspaceId, transcriptionId, correction }) =>
      service.correct(workspaceId, transcriptionId, correction),
  });
}

export function createTranscriptionReviewRoute(options: RouteOptions = {}): RequestHandler {
  const store = options.store ?? new WorkspaceStore();
  const service = options.service ?? new TranscriptionService({ store });

  return createApiRoute<
    { workspaceId: string; transcriptionId: string },
    ReturnType<TranscriptionService["review"]>
  >({
    validate: (_body, request) => Value.Decode(ParamsSchema, request.params),
    handler: async ({ workspaceId, transcriptionId }) =>
      service.review(workspaceId, transcriptionId),
  });
}
