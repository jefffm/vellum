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
import { persistDeliverable } from "./deliverable-service.js";
import type { Deliverable } from "../../lib/music-domain.js";

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
      const preview = buildAudioPreview(arrangement, score);
      const deliverable = persistDeliverable(store, workspaceId, arrangement, {
        kind: "audio_preview",
        mimeType: "application/json",
        extension: "json",
        content: Buffer.from(JSON.stringify(preview)),
      });
      response.json({ ok: true, data: { ...preview, deliverable } });
    } catch (error) {
      next(error);
    }
  };
}

export function createArrangementScoreGetRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const { workspaceId, arrangementId } = Value.Decode(ParamsSchema, request.params);
      response.json({ ok: true, data: store.getArrangementScore(workspaceId, arrangementId) });
    } catch (error) {
      next(error);
    }
  };
}

export function createArrangementRestoreRoute(store = new WorkspaceStore()): RequestHandler {
  return (request, response, next) => {
    try {
      const { workspaceId, arrangementId } = Value.Decode(ParamsSchema, request.params);
      const workspace = store.get(workspaceId);
      const deliverables = workspace.deliverableIds
        .map((id) => store.getDeliverable(workspaceId, id))
        .filter((item) => item.arrangementScoreId === arrangementId);
      const byKind = new Map(deliverables.map((item) => [item.kind, item]));
      const required = ["lilypond", "browser_preview", "audio_preview"] as const;
      if (required.some((kind) => !byKind.has(kind))) {
        response.status(409).json({
          ok: false,
          error: "This Arrangement Score version does not yet have a complete saved projection set",
        });
        return;
      }
      const text = (kind: Deliverable["kind"]) =>
        store.readDeliverableContent(workspaceId, byKind.get(kind)!.id).toString("utf8");
      const base64 = (kind: Deliverable["kind"]) =>
        byKind.has(kind)
          ? store.readDeliverableContent(workspaceId, byKind.get(kind)!.id).toString("base64")
          : undefined;
      response.json({
        ok: true,
        data: {
          compiled: {
            source: text("lilypond"),
            svg: text("browser_preview"),
            pdf: base64("pdf"),
            midi: base64("midi"),
            errors: [],
            deliverables: deliverables.filter((item) => item.kind !== "audio_preview"),
          },
          preview: {
            ...(JSON.parse(text("audio_preview")) as object),
            deliverable: byKind.get("audio_preview")!,
          },
        },
      });
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
      const deliverables = [
        persistDeliverable(store, workspaceId, arrangement, {
          kind: "lilypond",
          mimeType: "text/x-lilypond",
          extension: "ly",
          content: Buffer.from(source),
        }),
        ...(compiled.svg
          ? [
              persistDeliverable(store, workspaceId, arrangement, {
                kind: "browser_preview" as const,
                mimeType: "image/svg+xml",
                extension: "svg",
                content: Buffer.from(compiled.svg),
              }),
            ]
          : []),
        ...(compiled.pdf
          ? [
              persistDeliverable(store, workspaceId, arrangement, {
                kind: "pdf" as const,
                mimeType: "application/pdf",
                extension: "pdf",
                content: Buffer.from(compiled.pdf, "base64"),
              }),
            ]
          : []),
        ...(compiled.midi
          ? [
              persistDeliverable(store, workspaceId, arrangement, {
                kind: "midi" as const,
                mimeType: "audio/midi",
                extension: "midi",
                content: Buffer.from(compiled.midi, "base64"),
              }),
            ]
          : []),
      ];
      response.json({ ok: true, data: { ...compiled, source, deliverables } });
    } catch (error) {
      next(error);
    }
  };
}
