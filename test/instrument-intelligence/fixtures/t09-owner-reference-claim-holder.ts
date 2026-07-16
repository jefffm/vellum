import { writeFileSync } from "node:fs";

import { OwnerReferenceWriteClaim } from "../../../src/server/lib/owner-reference-claim.js";

const [rootDirectory, startedPath, hostIdentity, holdMillisecondsValue] = process.argv.slice(2);
if (!rootDirectory || !startedPath || !hostIdentity || !holdMillisecondsValue) {
  throw new Error("Expected root, started path, host identity, and hold milliseconds");
}
const holdMilliseconds = Number(holdMillisecondsValue);
if (!Number.isSafeInteger(holdMilliseconds) || holdMilliseconds < 1) {
  throw new Error("Hold milliseconds must be a positive safe integer");
}

new OwnerReferenceWriteClaim({
  rootDirectory,
  hostIdentity: () => hostIdentity,
}).withClaim(() => {
  writeFileSync(startedPath, "started\n", { flag: "wx" });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMilliseconds);
});
