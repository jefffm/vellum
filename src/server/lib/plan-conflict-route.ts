import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { createApiRoute } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";

const ParamsSchema = Type.Object({
  workspaceId: Type.String({ minLength: 1 }),
  conflictId: Type.String({ minLength: 1 }),
});
const ResolutionSchema = Type.Object(
  {
    selectedResolution: Type.Union([
      Type.Literal("revise_target_local_extension"),
      Type.Literal("revise_shared_plan"),
      Type.Literal("change_policy"),
      Type.Literal("request_policy_exception"),
      Type.Literal("block"),
    ]),
  },
  { additionalProperties: false }
);

export function createPlanConflictResolutionRoute(store?: WorkspaceStore) {
  assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
  store ??= new WorkspaceStore();
  return createApiRoute({
    validate: (body, request) => ({
      ...Value.Decode(ParamsSchema, request.params),
      ...Value.Decode(ResolutionSchema, body),
    }),
    handler: async ({ workspaceId, conflictId, selectedResolution }) =>
      store.selectPlanConflictResolution(workspaceId, conflictId, selectedResolution),
  });
}
