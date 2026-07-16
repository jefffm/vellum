import type { RequestHandler } from "express";

import { getAuthorityPathInventoryView } from "../../lib/authority-path-inventory.js";
import { createApiRoute } from "./create-route.js";

type AuthorityPathInventoryViewProvider = () => unknown | Promise<unknown>;

/** Read-only Owner inspection surface for the exact Authority Path Inventory. */
export function createAuthorityPathInventoryRoute(
  getView: AuthorityPathInventoryViewProvider = getAuthorityPathInventoryView
): RequestHandler {
  return createApiRoute<undefined, unknown>({
    validate: () => undefined,
    handler: async () => structuredClone(await getView()),
  });
}
