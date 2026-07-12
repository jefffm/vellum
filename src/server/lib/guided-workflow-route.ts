import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { GuidedWorkflowTargetSchema } from "../../lib/music-domain.js";
import { createApiRoute } from "./create-route.js";
import { GuidedWorkflowService, type GuidedWorkflowCheckpoint } from "./guided-workflow-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const WorkspaceParams = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
});
const WorkflowParams = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  workflowId: Type.String({ pattern: "^workflow\\.[a-f0-9-]{16,}$" }),
});
const CreateBody = Type.Object(
  {
    sourceArtifactId: Type.String({ pattern: "^source\\.[a-f0-9-]{16,}$" }),
    optical: Type.Boolean(),
    ocrAutoAcceptConfidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
  },
  { additionalProperties: false }
);
const CheckpointBody = Type.Partial(
  Type.Object(
    {
      stage: Type.Union([
        Type.Literal("source_saved"),
        Type.Literal("recognizing"),
        Type.Literal("transcription_review"),
        Type.Literal("analysis_review"),
        Type.Literal("target_search"),
        Type.Literal("projection"),
        Type.Literal("complete"),
      ]),
      omrRunId: Type.String(),
      scoreTranscriptionId: Type.String(),
      scoreTranscriptionVersion: Type.Integer({ minimum: 1 }),
      normalizedScoreId: Type.String(),
      normalizedScoreVersion: Type.Integer({ minimum: 1 }),
      analysisRecordId: Type.String(),
      analysisRecordVersion: Type.Integer({ minimum: 1 }),
      targets: Type.Array(GuidedWorkflowTargetSchema, { minItems: 1 }),
    },
    { additionalProperties: false }
  ),
  { minProperties: 1 }
);
const InterruptBody = Type.Object(
  { code: Type.String({ minLength: 1 }) },
  { additionalProperties: false }
);

type Options = { store?: WorkspaceStore; service?: GuidedWorkflowService };
function service(options: Options) {
  const store = options.store ?? new WorkspaceStore();
  return options.service ?? new GuidedWorkflowService({ store });
}

export function createGuidedWorkflowCreateRoute(options: Options = {}): RequestHandler {
  const workflow = service(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkspaceParams, request.params),
      input: Value.Decode(CreateBody, body),
    }),
    handler: async ({ workspaceId, input }) => workflow.create(workspaceId, input),
  });
}

export function createGuidedWorkflowActiveRoute(options: Options = {}): RequestHandler {
  const workflow = service(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(WorkspaceParams, request.params),
    handler: async ({ workspaceId }) => ({ workflow: workflow.active(workspaceId) }),
  });
}

export function createGuidedWorkflowCheckpointRoute(options: Options = {}): RequestHandler {
  const workflow = service(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkflowParams, request.params),
      update: Value.Decode(CheckpointBody, body) as GuidedWorkflowCheckpoint,
    }),
    handler: async ({ workspaceId, workflowId, update }) =>
      workflow.checkpoint(workspaceId, workflowId, update),
  });
}

export function createGuidedWorkflowInterruptRoute(options: Options = {}): RequestHandler {
  const workflow = service(options);
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(WorkflowParams, request.params),
      ...Value.Decode(InterruptBody, body),
    }),
    handler: async ({ workspaceId, workflowId, code }) =>
      workflow.interrupt(workspaceId, workflowId, code),
  });
}

export function createGuidedWorkflowResumeRoute(options: Options = {}): RequestHandler {
  const workflow = service(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(WorkflowParams, request.params),
    handler: async ({ workspaceId, workflowId }) => workflow.resume(workspaceId, workflowId),
  });
}

export function createGuidedWorkflowRestartRoute(options: Options = {}): RequestHandler {
  const workflow = service(options);
  return createApiRoute({
    validate: (_body, request) => Value.Decode(WorkflowParams, request.params),
    handler: async ({ workspaceId, workflowId }) => workflow.restart(workspaceId, workflowId),
  });
}
