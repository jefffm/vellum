import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { arrangementToEngraveParams } from "../../lib/arrangement-engrave.js";
import { buildAudioPreview } from "../../lib/audio-preview.js";
import { continuoArrangementToLilyPond } from "../../lib/continuo-engrave.js";
import { imitativeArrangementToLilyPond } from "../../lib/imitative-engrave.js";
import { compileLilyPond } from "./compile-route.js";
import { engrave } from "./engrave.js";
import { SubprocessRunner } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

const ParamsSchema = Type.Object({
  workspaceId: Type.String({ pattern: "^workspace\\.[a-f0-9-]{16,}$" }),
  arrangementId: Type.String({ pattern: "^arrangement\\.[a-f0-9-]{16,}$" }),
});

export function createArrangementPreviewRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const { workspaceId, arrangementId } = Value.Decode(ParamsSchema, request.params);
      const arrangement = store.getArrangementScore(workspaceId, arrangementId);
      const analysis = store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
      const score = store.getNormalizedScore(workspaceId, analysis.normalizedScoreId);
      response.json({ ok: true, data: buildAudioPreview(arrangement, score) });
    } catch (error) {
      next(error);
    }
  };
}

export function createArrangementCompileRoute(store = new WorkspaceStore()): RequestHandler {
  return async (request, response, next) => {
    try {
      const { workspaceId, arrangementId } = Value.Decode(ParamsSchema, request.params);
      const arrangement = store.getArrangementScore(workspaceId, arrangementId);
      const analysis = store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
      const score = store.getNormalizedScore(workspaceId, analysis.normalizedScoreId);
      const source = arrangement.targetConfiguration.notationLayouts.includes("continuo-score")
        ? continuoArrangementToLilyPond(arrangement, score)
        : arrangement.targetConfiguration.instrumentId === "renaissance-lute-6" &&
            arrangement.events.some((event) => event.role === "source_voice")
          ? imitativeArrangementToLilyPond(arrangement, score)
          : engrave(arrangementToEngraveParams(arrangement, score)).source;
      const compiled = await compileLilyPond(
        { source, format: "both" },
        new SubprocessRunner(60_000),
        60_000
      );
      response.json({ ok: true, data: { ...compiled, source } });
    } catch (error) {
      next(error);
    }
  };
}
