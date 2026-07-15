import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { HistoricalPracticeClaim, KnowledgePack } from "../../lib/owner-domain.js";
import { authorizeTrackedSourceOperation } from "../../lib/tracked-source-quarantine.js";

export type QuarantinedBuiltInKnowledgePack = {
  artifactId: string | null;
  filename: string;
  sha256: string;
  outcome: "deny" | "review_required";
  reason: string;
};

const trackedBuiltInPackIds: Readonly<Record<string, string>> = Object.freeze({
  "core-baroque-guitar.json": "tracked.knowledge-pack-core-baroque-guitar",
});

/**
 * Legacy built-in packs are deliberately inactive. A self-declared `reviewed`
 * field is not an ADR-0022 Activation Decision and cannot authorize a
 * historical claim for production use.
 */
export function loadBuiltInKnowledgePacks(
  _directory = path.resolve(process.cwd(), "knowledge-packs")
): Array<{ pack: KnowledgePack; claims: HistoricalPracticeClaim[] }> {
  return [];
}

export function listQuarantinedBuiltInKnowledgePacks(
  directory = path.resolve(process.cwd(), "knowledge-packs")
): QuarantinedBuiltInKnowledgePack[] {
  return builtInPackFiles(directory).flatMap<QuarantinedBuiltInKnowledgePack>(
    ({ artifactId, filename, sha256 }) => {
      if (!artifactId) {
        return [
          {
            artifactId: null,
            filename,
            sha256,
            outcome: "review_required" as const,
            reason: "Unregistered built-in knowledge material is quarantined by default.",
          },
        ];
      }
      const authorization = authorizeTrackedSourceOperation({
        artifactId,
        sha256,
        operation: "knowledge_pack_load",
      });
      if (
        authorization.outcome === "allow" &&
        authorization.resolvedArtifactId === artifactId &&
        authorization.resolvedSha256 === sha256
      ) {
        return [];
      }
      return [
        {
          artifactId,
          filename,
          sha256,
          outcome:
            authorization.outcome === "deny" ? ("deny" as const) : ("review_required" as const),
          reason:
            authorization.outcome === "deny"
              ? "The exact built-in Knowledge Pack bytes are explicitly denied for activation."
              : "The exact built-in Knowledge Pack bytes have no operation-scoped Activation Decision.",
        },
      ];
    }
  );
}

function builtInPackFiles(directory: string): Array<{
  artifactId: string | null;
  bytes: Buffer;
  filename: string;
  sha256: string;
}> {
  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".json"))
    .sort()
    .map((filename) => {
      const bytes = readFileSync(path.join(directory, filename));
      return {
        artifactId: trackedBuiltInPackIds[filename] ?? null,
        bytes,
        filename,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
}
