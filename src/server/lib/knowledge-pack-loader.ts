import { Value } from "@sinclair/typebox/value";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { HistoricalPracticeClaimSchema, KnowledgePackSchema } from "../../lib/owner-domain.js";
import type { HistoricalPracticeClaim, KnowledgePack } from "../../lib/owner-domain.js";

export function loadBuiltInKnowledgePacks(
  directory = path.resolve(process.cwd(), "knowledge-packs")
): Array<{ pack: KnowledgePack; claims: HistoricalPracticeClaim[] }> {
  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".json"))
    .sort()
    .map((filename) => {
      const parsed = JSON.parse(readFileSync(path.join(directory, filename), "utf8")) as {
        pack?: unknown;
        claims?: unknown;
      };
      const pack = Value.Decode(KnowledgePackSchema, parsed.pack);
      const claims = Array.isArray(parsed.claims)
        ? parsed.claims.map((claim) => Value.Decode(HistoricalPracticeClaimSchema, claim))
        : [];
      const actual = new Set(claims.map((claim) => claim.id));
      if (pack.claimIds.some((id) => !actual.has(id))) {
        throw new Error(`Knowledge Pack ${pack.id} references a missing claim`);
      }
      return { pack, claims };
    });
}
