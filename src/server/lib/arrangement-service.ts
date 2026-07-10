import { randomUUID } from "node:crypto";
import { arrangeFaithfulBaroqueGuitar } from "../../lib/baroque-guitar-arranger.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import type { ArrangementCandidate, ArrangementScore } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { loadProfile } from "../profiles.js";
import { WorkspaceStore } from "./workspace-store.js";

type ArrangementServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
  loadInstrument?: (instrumentId: string) => InstrumentModel;
};

export type CreateFaithfulArrangementInput = {
  normalizedScoreId: string;
  targetConfigurationId: string;
};

export type CreateFaithfulArrangementResult = {
  analysisRecordId: string;
  candidates: ArrangementCandidate[];
  arrangementScore: ArrangementScore;
};

export class ArrangementService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly loadInstrument: (instrumentId: string) => InstrumentModel;

  constructor(options: ArrangementServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.loadInstrument =
      options.loadInstrument ??
      ((instrumentId) => InstrumentModel.fromProfile(loadProfile(instrumentId)));
  }

  createFaithfulReduction(
    workspaceId: string,
    input: CreateFaithfulArrangementInput
  ): CreateFaithfulArrangementResult {
    const workspace = this.store.get(workspaceId);
    const targetConfiguration = workspace.brief.targetConfigurations.find(
      (target) => target.id === input.targetConfigurationId
    );
    if (!targetConfiguration) {
      throw new ApiRouteError(
        `Target Configuration not found in workspace: ${input.targetConfigurationId}`,
        404
      );
    }
    const score = this.store.getNormalizedScore(workspaceId, input.normalizedScoreId);
    const transcription = this.store.getScoreTranscription(workspaceId, score.scoreTranscriptionId);
    if (transcription.status === "needs_review") {
      const critical = transcription.uncertainties.filter(
        (uncertainty) => uncertainty.critical && !uncertainty.resolved
      );
      throw new ApiRouteError(
        `Score-Anchored Review is required before arrangement. Unresolved critical uncertainties: ${critical
          .map((uncertainty) => uncertainty.id)
          .join(", ")}`,
        409
      );
    }
    const timestamp = this.now().toISOString();
    const analysis = analyzeMusicologicalScore(score, {
      id: `analysis.${this.createId()}`,
      createdAt: timestamp,
    });
    this.store.saveAnalysisRecord(workspaceId, analysis);
    const search = arrangeFaithfulBaroqueGuitar(
      score,
      analysis,
      this.loadInstrument(targetConfiguration.instrumentId),
      {
        arrangementId: `arrangement.${this.createId()}`,
        createdAt: timestamp,
        targetConfiguration,
      }
    );
    this.store.saveArrangementScore(workspaceId, search.selected);
    return {
      analysisRecordId: analysis.id,
      candidates: search.candidates,
      arrangementScore: search.selected,
    };
  }
}
