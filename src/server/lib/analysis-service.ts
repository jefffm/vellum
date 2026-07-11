import { randomUUID } from "node:crypto";
import type { AnalysisClaim, AnalysisRecord } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import type { WorkspaceStore } from "./workspace-store.js";

export type AnalysisClaimCorrection = {
  statement: string;
  subjectIds: string[];
  rationale: string;
  selectedAlternativeId?: string;
  semanticValue?: string;
};

type AnalysisServiceOptions = {
  store: WorkspaceStore;
  createId?: () => string;
  now?: () => Date;
};

export class AnalysisService {
  private readonly store: WorkspaceStore;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: AnalysisServiceOptions) {
    this.store = options.store;
    this.createId = options.createId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  correctClaim(
    workspaceId: string,
    analysisRecordId: string,
    claimId: string,
    correction: AnalysisClaimCorrection
  ): AnalysisRecord {
    const previous = this.store.getAnalysisRecord(workspaceId, analysisRecordId);
    const claim = previous.claims.find((candidate) => candidate.id === claimId);
    if (!claim) throw new ApiRouteError(`Analysis Claim not found: ${claimId}`, 404);
    const score = this.store.getNormalizedScore(workspaceId, previous.normalizedScoreId);
    for (const subjectId of correction.subjectIds) {
      if (
        !score.parts.some((part) => part.id === subjectId) &&
        !score.events.some((event) => event.id === subjectId)
      ) {
        throw new ApiRouteError(
          `Correction subject is not in the Normalized Score: ${subjectId}`,
          400
        );
      }
    }
    if (
      correction.selectedAlternativeId &&
      !claim.alternatives?.some(
        (alternative) => alternative.id === correction.selectedAlternativeId
      )
    ) {
      throw new ApiRouteError(
        `Analysis alternative is not available: ${correction.selectedAlternativeId}`,
        400
      );
    }
    const suffix = this.createId();
    const correctedClaim: AnalysisClaim = {
      id: `claim.${suffix}`,
      kind: claim.kind,
      subjectIds: correction.subjectIds,
      statement: correction.statement,
      basis: "user_correction",
      confidence: 1,
      scope: {
        measureIds: score.measures
          .filter((measure) =>
            score.events.some(
              (event) =>
                event.measureId === measure.id &&
                (correction.subjectIds.includes(event.id) ||
                  correction.subjectIds.includes(event.partId))
            )
          )
          .map((measure) => measure.id),
        eventIds: score.events
          .filter(
            (event) =>
              correction.subjectIds.includes(event.id) ||
              correction.subjectIds.includes(event.partId)
          )
          .map((event) => event.id),
      },
      evidence: [
        {
          kind: "owner_correction",
          sourceIds: correction.subjectIds,
          explanation: correction.rationale,
        },
      ],
      alternatives: [],
      correctedClaimId: claim.id,
    };
    const principalVoicePartId =
      claim.kind === "principal_voice"
        ? score.parts.find((part) => correction.subjectIds.includes(part.id))?.id
        : previous.principalVoicePartId;
    if (claim.kind === "principal_voice" && !principalVoicePartId) {
      throw new ApiRouteError("A Principal Voice correction must select a score part", 400);
    }
    const principalEvents = score.events.filter(
      (event) => event.partId === principalVoicePartId && event.type === "note"
    );
    const principalEventIds = principalEvents.map((event) => event.id);
    const phraseGroups = principalPhraseGroups(score, principalVoicePartId ?? "");
    let phraseIndex = 0;
    const preservationTargets = previous.preservationTargets.map((target) => {
      if (claim.kind !== "principal_voice") return target;
      if (target.kind === "principal_voice") {
        return { ...target, partId: principalVoicePartId, eventIds: principalEventIds };
      }
      if (target.relationshipType === "principal_sequence") {
        return { ...target, eventIds: principalEventIds, eventGroups: [principalEventIds] };
      }
      if (target.relationshipType === "cadential_goal") {
        const finalId = principalEventIds.at(-1);
        return finalId ? { ...target, eventIds: [finalId], eventGroups: [[finalId]] } : target;
      }
      if (target.relationshipType === "phrase_contour") {
        const replacement = phraseGroups[phraseIndex++] ?? principalEventIds;
        return { ...target, eventIds: replacement, eventGroups: [replacement] };
      }
      return target;
    });
    const ambiguityId = `ambiguity.${previous.id.slice("analysis.".length)}.principal-voice`;
    const next: AnalysisRecord = {
      ...previous,
      id: `analysis.${suffix}`,
      version: previous.version + 1,
      principalVoicePartId,
      texture:
        claim.kind === "texture" && correction.semanticValue
          ? correction.semanticValue
          : previous.texture,
      passages:
        claim.kind === "texture" && correction.semanticValue
          ? previous.passages?.map((passage) => ({
              ...passage,
              texture: correction.semanticValue!,
            }))
          : previous.passages,
      summary: `${previous.summary ?? "Musicological analysis updated."} Owner correction: ${correction.statement}`,
      claims: [...previous.claims, correctedClaim],
      preservationTargets,
      ambiguities: (previous.ambiguities ?? []).map((ambiguity) =>
        ambiguity.id === ambiguityId || ambiguity.claimId === claim.id
          ? { ...ambiguity, resolution: correction.statement }
          : ambiguity
      ),
      createdAt: this.now().toISOString(),
    };
    return this.store.saveAnalysisRecord(workspaceId, next);
  }
}

function principalPhraseGroups(
  score: ReturnType<WorkspaceStore["getNormalizedScore"]>,
  partId: string
): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const event of score.events.filter((candidate) => candidate.partId === partId)) {
    if (event.type === "rest") {
      if (current.length) groups.push(current);
      current = [];
    } else if (event.type === "note") {
      current.push(event.id);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}
