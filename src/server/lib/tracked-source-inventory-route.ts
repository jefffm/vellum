import type { RequestHandler } from "express";
import { loadBundledTrackedSourceInventory } from "../../lib/tracked-source-quarantine.js";
import { createApiRoute } from "./create-route.js";

/** Read-only Owner inspection surface for the exact repository authority set. */
export function createTrackedSourceInventoryRoute(): RequestHandler {
  return createApiRoute<undefined, unknown>({
    validate: () => undefined,
    handler: async () => structuredClone(loadBundledTrackedSourceInventory()),
  });
}
