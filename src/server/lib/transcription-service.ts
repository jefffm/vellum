import { randomUUID } from "node:crypto";
import type {
  NormalizedScore,
  ScoreEvent,
  ScoreTranscription,
  TranscriptionUncertainty,
  TranscriptionCorrection,
} from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

type TranscriptionServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
};

export type TranscriptionCorrectionResult = {
  scoreTranscription: ScoreTranscription;
  normalizedScore: NormalizedScore;
};

export type ScoreAnchoredReviewItem = {
  uncertainty: TranscriptionUncertainty;
  events: ScoreEvent[];
  sourceImageUrl?: string;
};

export type ScoreAnchoredReview = {
  transcriptionId: string;
  version: number;
  status: ScoreTranscription["status"];
  sourceArtifactId: string;
  sourceFilename: string;
  sourceContentUrl: string;
  items: ScoreAnchoredReviewItem[];
};

export class TranscriptionService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: TranscriptionServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  review(workspaceId: string, transcriptionId: string): ScoreAnchoredReview {
    const transcription = this.store.getScoreTranscription(workspaceId, transcriptionId);
    const source = this.store.getSourceArtifact(workspaceId, transcription.sourceArtifactId);
    const omrRun = this.store.getOmrRun(workspaceId, transcription.omrRunId);
    const items = transcription.uncertainties
      .filter((uncertainty) => uncertainty.critical && !uncertainty.resolved)
      .map((uncertainty) => {
        const page = uncertainty.region?.page;
        const imagePath =
          page && uncertainty.region?.coordinateSpace === "omr_raster"
            ? omrRun.nativeArtifactPaths.find((candidate) =>
                candidate.endsWith(`/audiveris-page-${page}.png`)
              )
            : undefined;
        return {
          uncertainty,
          sourceImageUrl: imagePath
            ? `/api/workspaces/${workspaceId}/omr-runs/${omrRun.id}/artifacts/${encodeURIComponent(`audiveris-page-${page}.png`)}`
            : undefined,
          events: uncertainty.eventIds.map((eventId) => {
            const event = transcription.events.find((candidate) => candidate.id === eventId);
            if (!event) {
              throw new ApiRouteError(
                `Transcription uncertainty ${uncertainty.id} references missing event ${eventId}`,
                500
              );
            }
            return event;
          }),
        };
      });

    return {
      transcriptionId: transcription.id,
      version: transcription.version,
      status: transcription.status,
      sourceArtifactId: source.id,
      sourceFilename: source.filename,
      sourceContentUrl: `/api/workspaces/${workspaceId}/sources/${source.id}/content`,
      items,
    };
  }

  correct(
    workspaceId: string,
    transcriptionId: string,
    correction: TranscriptionCorrection
  ): TranscriptionCorrectionResult {
    const current = this.store.getScoreTranscription(workspaceId, transcriptionId);
    const uncertainty = current.uncertainties.find(
      (candidate) => candidate.id === correction.uncertaintyId
    );
    if (!uncertainty) {
      throw new ApiRouteError(
        `Transcription uncertainty not found: ${correction.uncertaintyId}`,
        404
      );
    }
    if (uncertainty.resolved) {
      throw new ApiRouteError(
        `Transcription uncertainty is already resolved: ${uncertainty.id}`,
        409
      );
    }

    const edits = new Map(correction.eventEdits.map((edit) => [edit.eventId, edit]));
    if (edits.size !== correction.eventEdits.length) {
      throw new ApiRouteError("A transcription correction cannot edit the same event twice", 400);
    }
    for (const eventId of edits.keys()) {
      if (!uncertainty.eventIds.includes(eventId)) {
        throw new ApiRouteError(
          `Event ${eventId} is outside transcription uncertainty ${uncertainty.id}`,
          400
        );
      }
      if (!current.events.some((event) => event.id === eventId)) {
        throw new ApiRouteError(`Transcription event not found: ${eventId}`, 404);
      }
    }

    const events = current.events.map((event) => applyEventEdit(event, edits.get(event.id)));
    const uncertainties = current.uncertainties.map((candidate) =>
      candidate.id === uncertainty.id ? { ...candidate, resolved: true } : candidate
    );
    const timestamp = this.now().toISOString();
    const next: ScoreTranscription = {
      ...current,
      id: `transcription.${this.createId()}`,
      parentId: current.id,
      version: current.version + 1,
      status: uncertainties.some((candidate) => candidate.critical && !candidate.resolved)
        ? "needs_review"
        : "reviewed",
      events,
      uncertainties,
      corrections: [
        ...(current.corrections ?? []),
        {
          uncertaintyId: correction.uncertaintyId,
          eventIds: correction.eventEdits.map((edit) => edit.eventId),
          rationale: correction.rationale,
          createdAt: timestamp,
        },
      ],
      createdAt: timestamp,
    };
    this.store.saveScoreTranscription(workspaceId, next);

    const normalized: NormalizedScore = {
      id: `score.${this.createId()}`,
      scoreTranscriptionId: next.id,
      version: 1,
      title: next.title,
      key: next.key,
      timeSignature: next.timeSignature,
      parts: next.parts,
      measures: next.measures,
      events: next.events,
      createdAt: timestamp,
    };
    this.store.saveNormalizedScore(workspaceId, normalized);
    return { scoreTranscription: next, normalizedScore: normalized };
  }
}

function applyEventEdit(
  event: ScoreEvent,
  edit: TranscriptionCorrection["eventEdits"][number] | undefined
): ScoreEvent {
  if (!edit) return event;
  if (edit.pitch !== undefined) {
    if (event.type !== "note") {
      throw new ApiRouteError(`Cannot assign pitch to rest event: ${event.id}`, 400);
    }
    return { ...event, pitch: edit.pitch, confidence: 1 };
  }
  return event;
}
