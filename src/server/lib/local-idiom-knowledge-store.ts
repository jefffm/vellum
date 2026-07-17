import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BASELINE_PUNTEADO_POLICY,
  extractSanzPunteadoCandidate,
  resolveBaroqueGuitarPunteadoPolicy,
  reviewSanzPunteadoCandidate,
  SANZ_PUNTEADO_EXCERPT,
  type ReviewedSanzPunteadoKnowledge,
  type SanzPunteadoKnowledgeCandidate,
} from "../../lib/local-idiom-knowledge.js";

type StoredState = {
  schemaVersion: 1;
  activeVersion: 1 | 2;
  candidate?: SanzPunteadoKnowledgeCandidate;
  reviewed?: ReviewedSanzPunteadoKnowledge;
};

export type LocalIdiomKnowledgeSnapshot = Readonly<{
  schemaVersion: 1;
  activeVersion: 1 | 2;
  activePack: ReturnType<typeof resolveBaroqueGuitarPunteadoPolicy>;
  priorVersionAvailable: boolean;
  candidate?: SanzPunteadoKnowledgeCandidate;
  reviewed?: ReviewedSanzPunteadoKnowledge;
  bundledSource: typeof SANZ_PUNTEADO_EXCERPT;
}>;

export class LocalIdiomKnowledgeStore {
  private readonly directory: string;
  private readonly statePath: string;
  private readonly sourcePath: string;

  constructor(options: { ownerRoot: string; repositoryRoot?: string }) {
    this.directory = path.join(options.ownerRoot, "local-idiom-knowledge");
    this.statePath = path.join(this.directory, "state.json");
    this.sourcePath = path.join(
      options.repositoryRoot ?? process.cwd(),
      SANZ_PUNTEADO_EXCERPT.repositoryPath
    );
  }

  snapshot(): LocalIdiomKnowledgeSnapshot {
    const state = this.read();
    return Object.freeze({
      schemaVersion: 1,
      activeVersion: state.activeVersion,
      activePack: resolveBaroqueGuitarPunteadoPolicy(state.activeVersion, state.reviewed),
      priorVersionAvailable: state.activeVersion > 1,
      ...(state.candidate ? { candidate: state.candidate } : {}),
      ...(state.reviewed ? { reviewed: state.reviewed } : {}),
      bundledSource: SANZ_PUNTEADO_EXCERPT,
    });
  }

  extractBundledSource(): LocalIdiomKnowledgeSnapshot {
    const state = this.read();
    if (!existsSync(this.sourcePath)) throw new Error("Bundled Sanz source excerpt is unavailable");
    const candidate = extractSanzPunteadoCandidate({
      sourceId: "reference.bundled-sanz-1697-punteado-page-17",
      bytes: readFileSync(this.sourcePath),
    });
    this.write({ ...state, candidate });
    return this.snapshot();
  }

  review(input: { rationale: string; reviewedAt?: string }): LocalIdiomKnowledgeSnapshot {
    const state = this.read();
    if (!state.candidate) throw new Error("Extract the cited source segment before review");
    if (state.reviewed) {
      throw new Error("Knowledge Pack v2 is immutable after review; create a successor version");
    }
    const reviewed = reviewSanzPunteadoCandidate(state.candidate, {
      reviewedAt: input.reviewedAt ?? new Date().toISOString(),
      rationale: input.rationale,
    });
    this.write({ ...state, reviewed });
    return this.snapshot();
  }

  activate(version: 1 | 2): LocalIdiomKnowledgeSnapshot {
    const state = this.read();
    resolveBaroqueGuitarPunteadoPolicy(version, state.reviewed);
    this.write({ ...state, activeVersion: version });
    return this.snapshot();
  }

  private read(): StoredState {
    if (!existsSync(this.statePath)) return { schemaVersion: 1, activeVersion: 1 };
    const value = JSON.parse(readFileSync(this.statePath, "utf8")) as Partial<StoredState>;
    if (value.schemaVersion !== 1 || (value.activeVersion !== 1 && value.activeVersion !== 2)) {
      throw new Error("Local idiom knowledge state is invalid");
    }
    const state = value as StoredState;
    resolveBaroqueGuitarPunteadoPolicy(state.activeVersion, state.reviewed);
    return state;
  }

  private write(state: StoredState): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.statePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, this.statePath);
  }
}

export const DEFAULT_BAROQUE_GUITAR_PUNTEADO_POLICY = BASELINE_PUNTEADO_POLICY;
