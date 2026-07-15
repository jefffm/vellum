import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  KnowledgePublicationConflictError,
  KnowledgePublicationStore,
  type KnowledgePublicationTransaction,
} from "../../../src/server/lib/knowledge-publication-store.js";

const [rootDirectory, transactionPath, resultPath, startedPath, readyPath, releasePath] =
  process.argv.slice(2);
if (!rootDirectory || !transactionPath || !resultPath || !startedPath) {
  throw new Error("T07 writer helper requires root, transaction, result, and started paths");
}

const transaction = JSON.parse(
  readFileSync(transactionPath, "utf8")
) as KnowledgePublicationTransaction;
const store = new KnowledgePublicationStore({
  rootDirectory,
  ...(readyPath && releasePath
    ? {
        faultInjector: (fault: { point: string }) => {
          if (fault.point !== "after_staged_generation") return;
          writeFileSync(readyPath, "ready\n");
          while (!existsSync(releasePath)) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
          }
        },
      }
    : {}),
});

writeFileSync(startedPath, "started\n");
try {
  const result = store.publish(transaction);
  writeFileSync(
    resultPath,
    JSON.stringify({
      outcome: result.outcome,
      head: result.head,
      generationId: result.generation.id,
    })
  );
} catch (error) {
  if (error instanceof KnowledgePublicationConflictError) {
    writeFileSync(
      resultPath,
      JSON.stringify({
        outcome: "conflict",
        currentHead: error.currentHead,
        orphanGenerationId: error.orphanGenerationId,
      })
    );
  } else {
    writeFileSync(
      resultPath,
      JSON.stringify({
        outcome: "error",
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    process.exitCode = 1;
  }
}
