import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  CanonicalOwnerIntentLayerSchema,
  OwnerIntentAnchorSchema,
} from "../../lib/owner-intent.js";
import { createApiRoute } from "./create-route.js";
import { OwnerIntentService } from "./owner-intent-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const RequestSchema = Type.Object(
  {
    request: Type.String({ minLength: 1 }),
    anchor: OwnerIntentAnchorSchema,
    modelProposedLayer: Type.Optional(CanonicalOwnerIntentLayerSchema),
  },
  { additionalProperties: false }
);

export function createOwnerIntentClassificationRoute(
  store = new WorkspaceStore(),
  service = new OwnerIntentService({ store })
) {
  return createApiRoute({
    validate: (body) => Value.Decode(RequestSchema, body),
    handler: async ({ anchor, request, modelProposedLayer }) =>
      service.classify(anchor, request, modelProposedLayer),
  });
}
