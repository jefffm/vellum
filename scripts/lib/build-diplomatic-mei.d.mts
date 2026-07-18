import type { DiplomaticToken } from "../../src/lib/mei-edition-domain.js";

export function buildDiplomaticMei(extraction: unknown): {
  mei: string;
  tokens: DiplomaticToken[];
};
