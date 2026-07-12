import { randomUUID } from "node:crypto";
import type { PreservationPolicy } from "../../lib/preservation-policy.js";
import type {
  AnalysisRecord,
  NormalizedScore,
  ScoreTranscription,
  SourceArtifact,
  SourceTruthAssessment,
  SourceTruthConsequence,
  SourceTruthScope,
} from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

export type SourceTruthAssessmentInput = {
  source: SourceArtifact;
  transcription: ScoreTranscription;
  normalized: NormalizedScore;
  analysis: AnalysisRecord;
  purpose: "arrangement_planning";
  scope: SourceTruthScope;
  preservationPolicy: PreservationPolicy;
  performanceBriefId?: string;
  targetConfigurationIds: string[];
  priorAssessment?: SourceTruthAssessment;
  createdAt: string;
  createId?: () => string;
};

export function assessSourceTruth(input: SourceTruthAssessmentInput): SourceTruthAssessment {
  validateInputLineage(input);
  validateScope(input.scope, input.normalized);
  if (input.targetConfigurationIds.length === 0) {
    throw new ApiRouteError("Source Truth requires at least one target configuration", 400);
  }
  if (
    input.priorAssessment &&
    (input.priorAssessment.purpose !== input.purpose ||
      canonicalScope(input.priorAssessment.scope) !== canonicalScope(input.scope))
  ) {
    throw new ApiRouteError(
      "A superseded Source Truth Assessment must have the same purpose and scope",
      400
    );
  }

  const consequences = deriveConsequences(input.transcription, input.normalized, input.analysis);
  const applicable = consequences.filter(
    (consequence) =>
      consequenceAffectsScope(consequence, input.scope) &&
      (consequence.affectedTargetConfigurationIds.length === 0 ||
        overlaps(consequence.affectedTargetConfigurationIds, input.targetConfigurationIds))
  );
  const blocking = applicable.filter(
    (consequence) => consequence.unresolved && consequence.material && consequence.critical
  );
  const disclosed = applicable.filter((consequence) => consequence.unresolved);
  const blockedClaimIds = input.analysis.claims
    .filter((claim) => blocking.some((consequence) => consequenceAffectsClaim(consequence, claim)))
    .map((claim) => claim.id);
  const blockedClaims = new Set(blockedClaimIds);
  const authorizedClaimIds = input.analysis.claims
    .filter((claim) => claimAffectsScope(claim, input.scope))
    .filter((claim) => !blockedClaims.has(claim.id))
    .map((claim) => claim.id);
  const unresolvedUncertaintyIds = unique(
    disclosed.map((consequence) => consequence.uncertaintyId)
  );
  const blockingUncertaintyIds = unique(blocking.map((consequence) => consequence.uncertaintyId));
  const priorBlocking = new Set(input.priorAssessment?.blockingUncertaintyIds ?? []);
  const newMaterialUncertaintyIds = blockingUncertaintyIds.filter((id) => !priorBlocking.has(id));
  const createId = input.createId ?? randomUUID;
  return {
    id: `truth.${createId()}`,
    sourceArtifactId: input.source.id,
    scoreTranscriptionId: input.transcription.id,
    scoreTranscriptionVersion: input.transcription.version,
    normalizedScoreId: input.normalized.id,
    normalizedScoreVersion: input.normalized.version,
    analysisRecordId: input.analysis.id,
    analysisRecordVersion: input.analysis.version,
    purpose: input.purpose,
    scope: input.scope,
    preservationPolicy: input.preservationPolicy,
    ...(input.performanceBriefId ? { performanceBriefId: input.performanceBriefId } : {}),
    targetConfigurationIds: input.targetConfigurationIds,
    outcome:
      blocking.length > 0
        ? "review_required"
        : input.transcription.status === "best_effort"
          ? "best_effort_only"
          : disclosed.length > 0
            ? "authoritative_with_disclosed_uncertainty"
            : "authoritative_for_purpose",
    authorizedClaimIds,
    blockedClaimIds,
    consideredUncertaintyIds: unique(applicable.map((consequence) => consequence.uncertaintyId)),
    unresolvedUncertaintyIds,
    blockingUncertaintyIds,
    consequences: applicable,
    stability: {
      iteration: (input.priorAssessment?.stability.iteration ?? 0) + 1,
      newMaterialUncertaintyIds,
      stable: blocking.length === 0 && newMaterialUncertaintyIds.length === 0,
    },
    ...(input.priorAssessment ? { supersedesAssessmentId: input.priorAssessment.id } : {}),
    createdAt: input.createdAt,
  };
}

export class SourceTruthService {
  constructor(
    private readonly options: {
      store: WorkspaceStore;
      now?: () => Date;
      createId?: () => string;
    }
  ) {}

  assess(
    workspaceId: string,
    input: {
      sourceArtifactId: string;
      scoreTranscriptionId: string;
      normalizedScoreId: string;
      analysisRecordId: string;
      scope: SourceTruthScope;
      preservationPolicy: PreservationPolicy;
      performanceBriefId?: string;
      targetConfigurationIds: string[];
      priorAssessmentId?: string;
    }
  ): SourceTruthAssessment {
    const assessment = assessSourceTruth({
      source: this.options.store.getSourceArtifact(workspaceId, input.sourceArtifactId),
      transcription: this.options.store.getScoreTranscription(
        workspaceId,
        input.scoreTranscriptionId
      ),
      normalized: this.options.store.getNormalizedScore(workspaceId, input.normalizedScoreId),
      analysis: this.options.store.getAnalysisRecord(workspaceId, input.analysisRecordId),
      purpose: "arrangement_planning",
      scope: input.scope,
      preservationPolicy: input.preservationPolicy,
      ...(input.performanceBriefId ? { performanceBriefId: input.performanceBriefId } : {}),
      targetConfigurationIds: input.targetConfigurationIds,
      ...(input.priorAssessmentId
        ? {
            priorAssessment: this.options.store.getSourceTruthAssessment(
              workspaceId,
              input.priorAssessmentId
            ),
          }
        : {}),
      createdAt: (this.options.now ?? (() => new Date()))().toISOString(),
      createId: this.options.createId,
    });
    if (this.options.store.get(workspaceId).sourceTruthAssessmentIds.includes(assessment.id)) {
      const existing = this.options.store.getSourceTruthAssessment(workspaceId, assessment.id);
      if (JSON.stringify(existing) !== JSON.stringify(assessment)) {
        throw new ApiRouteError(
          `Source Truth Assessment identity collision: ${assessment.id}`,
          409
        );
      }
      return existing;
    }
    return this.options.store.saveSourceTruthAssessment(workspaceId, assessment);
  }
}

function deriveConsequences(
  transcription: ScoreTranscription,
  normalized: NormalizedScore,
  analysis: AnalysisRecord
): SourceTruthConsequence[] {
  const eventById = new Map(normalized.events.map((event) => [event.id, event]));
  const transcriptionConsequences = transcription.uncertainties.map((uncertainty) => {
    const events = uncertainty.eventIds.flatMap((id) => {
      const event = eventById.get(id);
      return event ? [event] : [];
    });
    return {
      uncertaintyId: uncertainty.id,
      discoveredBy: "transcription" as const,
      dimensions: dimensionsForCategory(uncertainty.category),
      affectedPartIds: unique(events.map((event) => event.partId)),
      affectedMeasureIds: unique(events.map((event) => event.measureId)),
      affectedEventIds: uncertainty.eventIds,
      affectedTargetConfigurationIds: [],
      critical: uncertainty.critical,
      material: isMaterialCategory(uncertainty.category),
      unresolved: !uncertainty.resolved,
      rationale: uncertainty.message,
    };
  });
  const analysisConsequences = (analysis.ambiguities ?? []).flatMap((ambiguity) =>
    (ambiguity.sourceUncertaintyIds ?? []).map((uncertaintyId) => {
      const events = (ambiguity.affectedEventIds ?? []).flatMap((id) => {
        const event = eventById.get(id);
        return event ? [event] : [];
      });
      return {
        uncertaintyId,
        discoveredBy: "analysis" as const,
        dimensions: ambiguity.consequenceDimensions ?? (["relationship"] as const),
        affectedPartIds: unique(events.map((event) => event.partId)),
        affectedMeasureIds: unique(events.map((event) => event.measureId)),
        affectedEventIds: ambiguity.affectedEventIds ?? [],
        affectedTargetConfigurationIds: ambiguity.affectedTargetConfigurationIds ?? [],
        critical: ambiguity.critical,
        material: true,
        unresolved: ambiguity.resolution === undefined,
        rationale: ambiguity.question,
      };
    })
  );
  return [...transcriptionConsequences, ...analysisConsequences];
}

function dimensionsForCategory(category: string): SourceTruthConsequence["dimensions"] {
  const normalized = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("pitch")) return ["pitch", "recognizable_identity"];
  if (normalized.includes("rhythm") || normalized.includes("duration")) return ["rhythm", "order"];
  if (normalized.includes("voice") || normalized.includes("part")) return ["voice", "identity"];
  if (normalized.includes("figure")) return ["figure", "relationship"];
  if (normalized.includes("text") || normalized.includes("lyric")) return ["text"];
  if (normalized.includes("key") || normalized.includes("meter") || normalized.includes("repeat")) {
    return ["key_meter_form"];
  }
  if (normalized.includes("texture") || normalized.includes("counterpoint")) {
    return ["texture_technique_profile"];
  }
  if (normalized.includes("range") || normalized.includes("target")) return ["target_feasibility"];
  return ["relationship"];
}

function isMaterialCategory(category: string): boolean {
  const normalized = category.toLowerCase();
  return !normalized.includes("cosmetic") && !normalized.includes("layout_only");
}

function consequenceAffectsScope(
  consequence: SourceTruthConsequence,
  scope: SourceTruthScope
): boolean {
  if (scope.kind === "whole_score") return true;
  if (
    consequence.affectedPartIds.length === 0 &&
    consequence.affectedMeasureIds.length === 0 &&
    consequence.affectedEventIds.length === 0
  )
    return true;
  return (
    overlaps(consequence.affectedPartIds, scope.partIds) ||
    overlaps(consequence.affectedMeasureIds, scope.measureIds) ||
    overlaps(consequence.affectedEventIds, scope.eventIds)
  );
}

function consequenceAffectsClaim(
  consequence: SourceTruthConsequence,
  claim: AnalysisRecord["claims"][number]
): boolean {
  if (
    consequence.affectedPartIds.length === 0 &&
    consequence.affectedMeasureIds.length === 0 &&
    consequence.affectedEventIds.length === 0
  )
    return true;
  return (
    overlaps(consequence.affectedPartIds, claim.subjectIds) ||
    overlaps(consequence.affectedMeasureIds, claim.subjectIds) ||
    overlaps(consequence.affectedEventIds, claim.subjectIds) ||
    overlaps(consequence.affectedMeasureIds, claim.scope?.measureIds ?? []) ||
    overlaps(consequence.affectedEventIds, claim.scope?.eventIds ?? [])
  );
}

function claimAffectsScope(
  claim: AnalysisRecord["claims"][number],
  scope: SourceTruthScope
): boolean {
  if (scope.kind === "whole_score") return true;
  return (
    overlaps(claim.subjectIds, scope.partIds) ||
    overlaps(claim.subjectIds, scope.measureIds) ||
    overlaps(claim.subjectIds, scope.eventIds) ||
    overlaps(claim.scope?.measureIds ?? [], scope.measureIds) ||
    overlaps(claim.scope?.eventIds ?? [], scope.eventIds)
  );
}

function validateInputLineage(input: SourceTruthAssessmentInput): void {
  if (
    input.transcription.sourceArtifactId !== input.source.id ||
    input.normalized.scoreTranscriptionId !== input.transcription.id ||
    input.normalized.version !== input.transcription.version ||
    input.analysis.normalizedScoreId !== input.normalized.id
  ) {
    throw new ApiRouteError("Source Truth input lineage is inconsistent", 400);
  }
}

function validateScope(scope: SourceTruthScope, score: NormalizedScore): void {
  const valid = new Set([
    ...score.parts.map((part) => part.id),
    ...score.measures.map((measure) => measure.id),
    ...score.events.map((event) => event.id),
  ]);
  const invalid = [...scope.partIds, ...scope.measureIds, ...scope.eventIds].filter(
    (id) => !valid.has(id)
  );
  if (invalid.length > 0)
    throw new ApiRouteError(`Source Truth scope contains unknown IDs: ${invalid.join(", ")}`, 400);
  if (
    scope.kind === "passage" &&
    scope.partIds.length === 0 &&
    scope.measureIds.length === 0 &&
    scope.eventIds.length === 0
  ) {
    throw new ApiRouteError("A passage Source Truth scope cannot be empty", 400);
  }
}

function canonicalScope(scope: SourceTruthScope): string {
  return JSON.stringify({
    kind: scope.kind,
    partIds: [...scope.partIds].sort(),
    measureIds: [...scope.measureIds].sort(),
    eventIds: [...scope.eventIds].sort(),
  });
}

function overlaps(left: string[], right: string[]): boolean {
  const candidates = new Set(right);
  return left.some((value) => candidates.has(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
