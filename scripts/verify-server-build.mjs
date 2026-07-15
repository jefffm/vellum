import { existsSync } from "node:fs";

const quarantine = await import("../dist-server/lib/tracked-source-quarantine.js");
const releaseFloor = await import("../dist-server/lib/release-floor-policy.js");

if (quarantine.loadBundledTrackedSourceInventory().inventoryId !== "tracked-source-inventory.v1") {
  throw new Error("Compiled server cannot load its tracked-source inventory");
}
if (releaseFloor.bundledReleaseFloorPolicy.policyId !== "release-floor-derivation-policy.v1") {
  throw new Error("Compiled server cannot load its release-floor policy");
}
for (const stalePath of [
  "dist-server/lib/alfabeto/charts/tyler-universal.js",
  "dist-server/lib/alfabeto/charts/foscarini.js",
]) {
  if (existsSync(stalePath))
    throw new Error(`Compiled server retained quarantined data: ${stalePath}`);
}
