import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  skipRepeatedOccurrences,
  type AudioPreview,
  type PlaybackEvent,
  type PlaybackPart,
} from "./lib/audio-preview.js";
import type {
  ArrangementEvent,
  ArrangementPlan,
  ArrangementScore,
  GuidedWorkflow,
  PerformanceBriefInput,
  ScoreEvent,
  ScoreTranscription,
  TargetConfiguration,
  TranscriptionCorrection,
  TranscriptionUncertainty,
} from "./lib/music-domain.js";
import type {
  CanonicalOwnerIntentLayer,
  OwnerIntentAnchor,
  OwnerIntentProposal,
} from "./lib/owner-intent.js";
import type { CompileResult } from "./types.js";
import { noteToMidi } from "./lib/pitch.js";
import {
  apiErrorFromResponse,
  isApiSuccess,
  VellumApiError,
  type ApiResponse,
} from "./lib/api-contract.js";
import {
  formatReferenceIdentityConfidence,
  renderReferenceSourceLifecycleDryRun,
  type ReferenceSourceStagingDiagnostics,
} from "./reference-source-staging-diagnostics.js";
import {
  renderKnowledgePublicationWorkbench,
  type KnowledgePublicationWorkbenchState,
} from "./knowledge-publication-workbench.js";
import { renderReviewerAuthorityWorkbench } from "./reviewer-authority-workbench.js";
import { renderKnowledgeResolutionWorkbench } from "./knowledge-resolution-workbench.js";
import { renderKnowledgeResolverCutoverWorkbench } from "./knowledge-resolver-cutover-workbench.js";
import {
  OwnerReferenceWorkbenchLocalStudyError,
  OwnerReferenceWorkbenchUploadError,
  renderOwnerReferenceWorkbench,
  type OwnerReferenceWorkbenchLocalStudyRequest as OwnerReferenceWorkbenchLocalStudyInput,
  type OwnerReferenceWorkbenchLocalStudyResult,
} from "./owner-reference-workbench.js";
import {
  openOwnerReferencePageAtlasWorkbench,
  type OwnerReferencePageAtlasPreviewResult,
} from "./owner-reference-page-atlas-workbench.js";
import type {
  OwnerReferenceWorkbenchLocalOperationReviewRequest,
  OwnerReferenceWorkbenchLocalOperationReviewResult,
  OwnerReferenceWorkbenchLocalStudyRequest,
  OwnerReferenceWorkbenchSnapshot,
  OwnerReferenceWorkbenchUploadConfirmationResult,
} from "./lib/owner-reference-workbench-contract.js";
import {
  OwnerReferenceWorkbenchLocalStudyRequestSchema,
  OwnerReferenceWorkbenchSnapshotSchema,
  OwnerReferenceWorkbenchUploadConfirmationResultSchema,
} from "./lib/owner-reference-workbench-contract.js";
import {
  OwnerReferenceMigrationQuarantineActionSchema,
  OwnerReferenceMigrationQuarantineReasonSchema,
} from "./lib/owner-reference-migration-reason.js";
import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";

type GuidedStartOptions = {
  onComplete: (deliverables: GuidedDeliverable[]) => void;
};

const audioSeekHandlers = new WeakMap<HTMLElement, EventListener>();
const audioPlaybackCleanups = new WeakMap<HTMLElement, () => void>();
const followedMeasureOccurrences = new WeakMap<HTMLElement, string>();
const OWNER_REFERENCE_UPLOAD_HMAC_KEY_STORAGE = "vellum.owner-reference-upload-hmac-key.v1";
const OWNER_REFERENCE_UPLOAD_PENDING_STORAGE = "vellum.owner-reference-upload-pending.v1";
const OWNER_REFERENCE_UPLOAD_LOCK = "vellum.owner-reference-upload-intent.v1";
const OWNER_REFERENCE_UPLOAD_HMAC_KEY_BYTES = 32;
const OWNER_REFERENCE_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;
const OWNER_REFERENCE_UPLOAD_MAX_PENDING = 32;
const OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_STORAGE =
  "vellum.owner-reference-local-study-hmac-key.v1";
const OWNER_REFERENCE_LOCAL_STUDY_PENDING_STORAGE = "vellum.owner-reference-local-study-pending.v1";
const OWNER_REFERENCE_LOCAL_STUDY_LOCK = "vellum.owner-reference-local-study-intent.v1";
const OWNER_REFERENCE_LOCAL_STUDY_KEY_BYTES = 16;
const OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_BYTES = 32;
const OWNER_REFERENCE_LOCAL_STUDY_MAX_PENDING = 64;
const OWNER_REFERENCE_STAGING_SUMMARY_LIMIT = 999;
const OWNER_REFERENCE_PAGE_ATLAS_PREVIEW_MAX_BYTES = 16 * 1024 * 1024;

export type GuidedDeliverable = {
  workspaceId: string;
  arrangementScoreId: string;
  arrangementScoreVersion: number;
  parentArrangementScoreId?: string;
  branchId?: string;
  editorialCommitmentIds: string[];
  arrangementFamilyId: string;
  arrangementSearchId: string;
  arrangementPlan?: ArrangementPlan;
  targetConfigurationId: string;
  targetConfiguration: TargetConfiguration;
  preservationPolicy: ArrangementScore["preservationPolicy"];
  label: string;
  arrangementEvents: ArrangementEvent[];
  analysis: {
    id: string;
    summary?: string;
    passages?: Array<{ texture: string; contrapuntalTechniques: string[] }>;
    claims: Array<{
      id: string;
      statement: string;
      subjectIds?: string[];
      basis: string;
      confidence: number;
      alternatives?: Array<{
        id: string;
        statement: string;
        subjectIds?: string[];
        arrangementConsequence: string;
      }>;
    }>;
    profiles?: Array<{ id: string; label: string; status: string; arrangementConsequence: string }>;
    ambiguities?: Array<{
      id: string;
      claimId: string;
      critical: boolean;
      question: string;
      alternativeIds: string[];
      resolution?: string;
    }>;
  };
  transformationReport: Array<{
    id?: string;
    entryType?: "event" | "relationship";
    sourceEventId?: string;
    sourceRelationshipId?: string;
    arrangementEventIds: string[];
    classification: string;
    rationale: string;
  }>;
  preservationAudit: {
    status: "pass" | "pass_with_exceptions" | "fail";
    targetIds: string[];
    findings: Array<{ targetId: string; code: string; message: string; severity: string }>;
  };
  continuoDisposition?: {
    kind: "complete_realization" | "separate_bass_realization" | "continuo_reduction";
    label: string;
    soundedFoundationEventIds: string[];
    unsoundedFoundationEventIds: string[];
    bassInstrumentId?: string;
  };
  compiled: CompileResult;
  preview: AudioPreview;
  candidates: Array<{
    id: string;
    strategy: string;
    status: "rejected" | "survived" | "selected";
    rank?: number;
    rejectionReason?: string;
    evaluation?: {
      weightedTotal: number;
      rationale: string;
    };
  }>;
  deliverables: Array<{
    id: string;
    kind: string;
    notationLayout: string;
    arrangementScoreVersion: number;
    sha256: string;
  }>;
  personalDefaultApplications?: Array<{
    defaultId: string;
    targetConfigurationId: string;
    status: "applied" | "yielded";
    reason: string;
  }>;
};

export function installPersonalDefaultSummary(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header || !deliverable.arrangementPlan) return;
  header.querySelector(".personal-default-summary")?.remove();
  const applications = (deliverable.personalDefaultApplications ?? []).filter(
    (item) => item.targetConfigurationId === deliverable.targetConfigurationId
  );
  if (!applications.length) return;
  const details = document.createElement("details");
  details.className = "personal-default-summary";
  const summary = document.createElement("summary");
  summary.textContent = `${applications.filter((item) => item.status === "applied").length} Personal Default${applications.length === 1 ? "" : "s"} applied or considered`;
  const list = document.createElement("ul");
  for (const application of applications) {
    const item = document.createElement("li");
    item.textContent = `${application.defaultId} · ${application.status} · ${application.reason}`;
    list.append(item);
  }
  details.append(summary, list);
  header.append(details);
}

export async function installPerformanceInterpretationControls(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): Promise<void> {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".performance-interpretation-controls")?.remove();
  const result = await api<{
    literalIsDefault: true;
    staleReason?: string;
    interpretations: Array<{
      id: string;
      version: number;
      parentInterpretationId?: string;
      rationale: string;
      choices: {
        tempo: number;
        arpeggiationMs: number;
        inequality: number;
        articulation: number;
        principalVoiceOrnament: string;
      };
    }>;
  }>(
    `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/performance-interpretations`
  );
  const controls = document.createElement("div");
  controls.className = "performance-interpretation-controls";
  const label = document.createElement("label");
  label.textContent = "Playback interpretation";
  const select = document.createElement("select");
  const literal = document.createElement("option");
  literal.value = "literal";
  literal.textContent = "Literal Audio Preview · default reference";
  select.append(literal);
  for (const interpretation of [...result.interpretations].sort(
    (left, right) => right.version - left.version
  )) {
    const option = document.createElement("option");
    option.value = interpretation.id;
    option.textContent = `Interpretation v${interpretation.version} · ${interpretation.rationale}`;
    select.append(option);
  }
  const evidence = document.createElement("p");
  evidence.textContent = result.staleReason
    ? `STALE: parent Arrangement Score evidence changed · ${result.staleReason}. The interpretation is preserved but not current.`
    : "Literal playback reproduces canonical events. Interpretation is an optional playback-only projection.";
  const create = document.createElement("button");
  create.type = "button";
  create.textContent = "New interpretation version";
  create.addEventListener("click", async () => {
    const parent = result.interpretations.find((item) => item.id === select.value);
    const tempo = Number(
      window.prompt("Tempo (quarter notes per minute)", String(parent?.choices.tempo ?? 70))
    );
    const arpeggiationMs = Number(
      window.prompt(
        "Chord arpeggiation in milliseconds",
        String(parent?.choices.arpeggiationMs ?? 35)
      )
    );
    const inequality = Number(
      window.prompt("Rhythmic inequality (0 to 0.4)", String(parent?.choices.inequality ?? 0))
    );
    const articulation = Number(
      window.prompt("Articulation length (0.1 to 1)", String(parent?.choices.articulation ?? 0.9))
    );
    const ornament =
      window.prompt(
        "Principal Voice ornament: none or upper_neighbor",
        parent?.choices.principalVoiceOrnament ?? "none"
      ) ?? "none";
    const rationale = window.prompt("Why is this interpretation appropriate?")?.trim();
    if (!rationale) return;
    await api(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/performance-interpretations`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(parent ? { parent_interpretation_id: parent.id } : {}),
          choices: {
            tempo,
            arpeggiation_ms: arpeggiationMs,
            inequality,
            articulation,
            principal_voice_ornament: ornament,
          },
          rationale,
        }),
      }
    );
    await installPerformanceInterpretationControls(panel, deliverable);
  });
  select.addEventListener("change", async () => {
    if (select.value === "literal") {
      installAudioPreviewControls(panel, deliverable.preview);
      evidence.textContent = result.staleReason
        ? `Literal reference restored. Arrangement evidence is stale: ${result.staleReason}`
        : "Literal reference restored; no interpretive timing or ornament choices are active.";
      return;
    }
    const interpretation = result.interpretations.find((item) => item.id === select.value)!;
    const preview = await api<AudioPreview>(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/performance-interpretations/${interpretation.id}/audio-preview`
    );
    installAudioPreviewControls(panel, preview);
    evidence.textContent = `Playback only · ${JSON.stringify(interpretation.choices)} · ${interpretation.rationale}${result.staleReason ? ` · STALE: ${result.staleReason}` : ""}`;
  });
  label.append(select);
  controls.append(label, create, evidence);
  header.append(controls);
}

export type ArrangementVersionChange = {
  eventId: string;
  dimensions: Array<"pitch" | "rhythm" | "course_fingering">;
};

export function compareArrangementVersions(
  parent: GuidedDeliverable,
  current: GuidedDeliverable
): ArrangementVersionChange[] {
  const parentById = new Map(parent.arrangementEvents.map((event) => [event.id, event]));
  return current.arrangementEvents.flatMap((event) => {
    const before = parentById.get(event.id);
    if (!before) return [{ eventId: event.id, dimensions: ["pitch"] }];
    const dimensions: ArrangementVersionChange["dimensions"] = [];
    if (JSON.stringify(before.pitches) !== JSON.stringify(event.pitches)) dimensions.push("pitch");
    if (JSON.stringify(before.duration) !== JSON.stringify(event.duration))
      dimensions.push("rhythm");
    if (JSON.stringify(before.positions) !== JSON.stringify(event.positions))
      dimensions.push("course_fingering");
    return dimensions.length ? [{ eventId: event.id, dimensions }] : [];
  });
}

export function installVersionNavigator(
  panel: HTMLElement,
  current: GuidedDeliverable,
  comparison?: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".arrangement-version-navigator")?.remove();
  const details = document.createElement("details");
  details.className = "arrangement-version-navigator";
  const summary = document.createElement("summary");
  summary.textContent = `Arrangement Score v${current.arrangementScoreVersion} · ${current.preservationAudit.status.replaceAll("_", " ")}`;
  const lineage = document.createElement("p");
  lineage.textContent = [
    current.parentArrangementScoreId
      ? `Parent ${current.parentArrangementScoreId}`
      : "Root version",
    current.branchId ? `Branch ${current.branchId}` : undefined,
    `${current.editorialCommitmentIds.length} Editorial Commitment${current.editorialCommitmentIds.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  details.append(summary, lineage);
  if (comparison) {
    const parent =
      current.parentArrangementScoreId === comparison.arrangementScoreId ? comparison : current;
    const child = parent === current ? comparison : current;
    const changes = compareArrangementVersions(parent, child);
    const changed = document.createElement("ul");
    for (const change of changes) {
      const item = document.createElement("li");
      item.textContent = `${change.eventId}: ${change.dimensions.map((dimension) => dimension.replaceAll("_", " ")).join(", ")}`;
      changed.append(item);
    }
    if (changes.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No event-level changes.";
      changed.append(item);
    }
    const comparisonButton = document.createElement("button");
    comparisonButton.type = "button";
    comparisonButton.textContent = `Open ${comparison === parent ? "parent" : "child"} v${comparison.arrangementScoreVersion}`;
    comparisonButton.addEventListener("click", () =>
      document.dispatchEvent(
        new CustomEvent("vellum-open-arrangement-version", {
          detail: {
            arrangementScoreId: comparison.arrangementScoreId,
            comparisonArrangementScoreId: current.arrangementScoreId,
          },
        })
      )
    );
    const currentButton = document.createElement("button");
    currentButton.type = "button";
    currentButton.textContent = `Open current v${current.arrangementScoreVersion}`;
    currentButton.disabled = true;
    details.append(changed, comparisonButton, currentButton);
  }
  header.append(details);
}

export type ScoreSelectionContext = {
  kind: "vellum_score_selection";
  workspaceId: string;
  arrangementScoreId: string;
  arrangementScoreVersion: number;
  arrangementFamilyId: string;
  arrangementSearchId: string;
  arrangementPlanId: string;
  analysisRecordId: string;
  targetConfiguration: TargetConfiguration;
  preservationPolicy: ArrangementScore["preservationPolicy"];
  eventIds: string[];
  measureIds: string[];
  sourceEventIds: string[];
  events: ArrangementEvent[];
  lineage: GuidedDeliverable["transformationReport"];
  findings: GuidedDeliverable["preservationAudit"]["findings"];
  findingIds: string[];
};

export function buildScoreSelectionContext(
  deliverable: GuidedDeliverable,
  selectedEventIds: readonly string[]
): ScoreSelectionContext {
  assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
  const chosen = new Set(selectedEventIds);
  const events = deliverable.arrangementEvents.filter((event) => chosen.has(event.id));
  const lineage = deliverable.transformationReport.filter((entry) =>
    entry.arrangementEventIds.some((id) => chosen.has(id))
  );
  const targetIds = new Set(
    lineage.flatMap((entry) => [entry.sourceRelationshipId, entry.sourceEventId]).filter(Boolean)
  );
  return {
    kind: "vellum_score_selection",
    workspaceId: deliverable.workspaceId,
    arrangementScoreId: deliverable.arrangementScoreId,
    arrangementScoreVersion: deliverable.arrangementScoreVersion,
    arrangementFamilyId: deliverable.arrangementFamilyId,
    arrangementSearchId: deliverable.arrangementSearchId,
    arrangementPlanId: deliverable.arrangementPlan?.id ?? "plan.unavailable",
    analysisRecordId: deliverable.analysis.id,
    targetConfiguration: deliverable.targetConfiguration,
    preservationPolicy: deliverable.preservationPolicy,
    eventIds: events.map((event) => event.id),
    measureIds: Array.from(new Set(events.map((event) => event.measureId))),
    sourceEventIds: Array.from(new Set(events.flatMap((event) => event.sourceEventIds))),
    events,
    lineage,
    findings: deliverable.preservationAudit.findings.filter((finding) =>
      targetIds.has(finding.targetId)
    ),
    findingIds: deliverable.preservationAudit.findings
      .filter((finding) => targetIds.has(finding.targetId))
      .map((finding) => `${finding.targetId}:${finding.code}`),
  };
}

export function ownerIntentAnchorFromContext(context: ScoreSelectionContext): OwnerIntentAnchor {
  assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
  return {
    workspaceId: context.workspaceId,
    arrangementScoreId: context.arrangementScoreId,
    arrangementScoreVersion: context.arrangementScoreVersion,
    arrangementFamilyId: context.arrangementFamilyId,
    arrangementSearchId: context.arrangementSearchId,
    arrangementPlanId: context.arrangementPlanId,
    analysisRecordId: context.analysisRecordId,
    targetConfigurationId: context.targetConfiguration.id,
    preservationPolicy: context.preservationPolicy,
    eventIds: context.eventIds,
    measureIds: context.measureIds,
    sourceEventIds: context.sourceEventIds,
    findingIds: context.findingIds,
  };
}

export function selectionPrompt(context: ScoreSelectionContext, request: string): string {
  assertAuthorityPathRuntime("authority.prompt.model-action-guidance", "production");
  assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
  const conciseRequest =
    request.trim() || "Give me interactive musical feedback on this selection.";
  return `${conciseRequest}\n\nUse this exact Vellum Selection Context; do not infer a different passage or score version:\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
}

export async function proposeOwnerIntent(
  container: HTMLElement,
  context: ScoreSelectionContext,
  request: string,
  onProceed?: (layer: CanonicalOwnerIntentLayer) => void
): Promise<OwnerIntentProposal> {
  assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
  container.querySelector(".owner-intent-proposal")?.remove();
  const effectiveRequest =
    request.trim() || "Give me interactive musical feedback on this selection.";
  const proposal = await api<OwnerIntentProposal>("/api/owner/intent-proposals", {
    method: "POST",
    body: JSON.stringify({
      request: effectiveRequest,
      anchor: ownerIntentAnchorFromContext(context),
    }),
  });
  const section = document.createElement("section");
  section.className = "owner-intent-proposal";
  section.dataset.resolution = proposal.resolution;
  const heading = document.createElement("strong");
  heading.textContent = proposal.proposedLayer
    ? `Proposed layer: ${proposal.proposedLayer.replaceAll("_", " ")}`
    : "Choose the intended canonical layer";
  const scope = document.createElement("p");
  scope.textContent = `Scope: Arrangement Score v${context.arrangementScoreVersion}, ${context.eventIds.length} selected object${context.eventIds.length === 1 ? "" : "s"}, ${context.measureIds.length} measure${context.measureIds.length === 1 ? "" : "s"}.`;
  const consequence = document.createElement("p");
  consequence.textContent = `Consequence: ${proposal.consequence}. ${proposal.consequenceSummary}`;
  const confirmation = document.createElement("p");
  confirmation.textContent = `Confirmation: ${proposal.confirmation.replaceAll("_", " ")}. No mutation has occurred.`;
  const evidence = document.createElement("details");
  const evidenceSummary = document.createElement("summary");
  evidenceSummary.textContent = "Why this route?";
  const rationale = document.createElement("p");
  rationale.textContent = proposal.rationale;
  const identities = document.createElement("code");
  identities.textContent = `${proposal.anchor.arrangementScoreId}@${proposal.anchor.arrangementScoreVersion} · ${proposal.anchor.arrangementPlanId} · ${proposal.anchor.analysisRecordId}`;
  evidence.append(evidenceSummary, rationale, identities);
  section.append(heading, scope, consequence, confirmation, evidence);

  const continueRequest = (layer: CanonicalOwnerIntentLayer) => {
    if (onProceed) {
      onProceed(layer);
      return;
    }
    document.dispatchEvent(
      new CustomEvent("vellum-ask-selection", {
        detail: {
          message: `${selectionPrompt(context, effectiveRequest)}\n\nCanonical Owner-intent classification: ${layer}. The classification is confirmed, but no mutation is authorized merely by this message. Use the existing canonical ${layer.replaceAll("_", " ")} boundary and preserve its confirmation and lineage rules.`,
          context,
          canonicalLayer: layer,
        },
      })
    );
  };
  if (proposal.proposedLayer === "explanation" && proposal.confirmation === "not_required") {
    continueRequest("explanation");
  } else if (proposal.resolution === "resolved" && proposal.proposedLayer) {
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = `Continue with ${proposal.proposedLayer.replaceAll("_", " ")}`;
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      continueRequest(proposal.proposedLayer!);
    });
    section.append(confirm);
  } else {
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Canonical Owner-intent layer");
    for (const layer of proposal.alternatives) {
      const option = document.createElement("option");
      option.value = layer;
      option.textContent = layer.replaceAll("_", " ");
      select.append(option);
    }
    const resolve = document.createElement("button");
    resolve.type = "button";
    resolve.textContent = "Resolve and continue";
    resolve.disabled = select.options.length === 0;
    resolve.addEventListener("click", () => {
      resolve.disabled = true;
      continueRequest(select.value as CanonicalOwnerIntentLayer);
    });
    section.append(select, resolve);
  }
  container.append(section);
  return proposal;
}

type EditBatchResult = {
  arrangementScore: ArrangementScore;
  editorialCommitments: Array<{ id: string }>;
  branch: { id: string };
};

type PassageCandidate = {
  id: string;
  passageSearchId: string;
  sourceCandidateId: string;
  strategy: string;
  status: "survived" | "selected" | "rejected";
  rank?: number;
  replacementEvents: ArrangementEvent[];
  changedArrangementEventIds: string[];
  evaluation?: {
    weightedTotal?: number;
    rationale: string;
    selectionBasis?: { method: "policy_lexicographic"; decisiveMetricId?: string; status: string };
  };
  audit: GuidedDeliverable["preservationAudit"];
  rejectionReason?: string;
};

export async function openPassageCandidatesDialog(
  panel: HTMLElement,
  deliverable: GuidedDeliverable,
  selectedEvents: ArrangementEvent[]
): Promise<HTMLDialogElement> {
  document.querySelector("#vellum-passage-candidates")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "vellum-passage-candidates";
  dialog.className = "passage-candidates-dialog";
  const heading = document.createElement("h2");
  heading.textContent = `Alternatives for ${selectedEvents.length} selected musical object${selectedEvents.length === 1 ? "" : "s"}`;
  const explanation = document.createElement("p");
  explanation.textContent =
    "Alternatives use the selected source lineage and current historical context. Audition is temporary; Adopt creates one new audited version and leaves every unselected object unchanged.";
  const status = document.createElement("p");
  status.textContent = "Searching persisted arrangement candidates…";
  const list = document.createElement("div");
  list.className = "passage-candidate-list";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  dialog.append(heading, explanation, status, list, close);
  document.body.append(dialog);
  dialog.showModal();
  const eventIds = selectedEvents.map((event) => event.id);
  try {
    const result = await api<{
      passageSearch: { id: string; dependencyContext: { expandedEventIds: string[] } };
      candidates: PassageCandidate[];
    }>(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/passage-candidates`,
      { method: "POST", body: JSON.stringify({ arrangement_event_ids: eventIds }) }
    );
    status.textContent = `${result.candidates.filter((candidate) => candidate.status !== "rejected").length} viable plan-aware alternatives across ${result.passageSearch.dependencyContext.expandedEventIds.length} dependency-expanded objects; rejected options retain their audit evidence.`;
    for (const candidate of result.candidates) {
      const card = document.createElement("article");
      card.className = `passage-candidate ${candidate.status}`;
      const title = document.createElement("h3");
      title.textContent = `${candidate.rank ? `#${candidate.rank} ` : ""}${candidate.strategy}`;
      const evidence = document.createElement("p");
      evidence.textContent =
        candidate.status === "rejected"
          ? `Rejected · ${candidate.rejectionReason ?? "A hard constraint failed."}`
          : `${candidate.changedArrangementEventIds.length} dependency-scoped object${candidate.changedArrangementEventIds.length === 1 ? "" : "s"} differ · ${candidate.evaluation ? `${candidate.evaluation.selectionBasis?.decisiveMetricId?.replaceAll("metric.", "") ?? "policy survivor"} · ${candidate.evaluation.rationale}` : `Audit ${candidate.audit.status}`}`;
      const comparison = document.createElement("ol");
      for (const replacement of candidate.replacementEvents) {
        const current = selectedEvents.find((event) => event.id === replacement.id)!;
        const item = document.createElement("li");
        item.textContent = `${describeArrangementEvent(current)} → ${describeArrangementEvent(replacement)}`;
        comparison.append(item);
      }
      const audition = document.createElement("button");
      audition.type = "button";
      audition.textContent = "Audition passage alternative";
      audition.disabled = candidate.status === "rejected";
      audition.addEventListener("click", async () => {
        audition.disabled = true;
        try {
          const preview = await api<AudioPreview>(
            `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/passage-candidates/audio-preview`,
            {
              method: "POST",
              body: JSON.stringify({
                arrangement_event_ids: eventIds,
                source_candidate_id: candidate.sourceCandidateId,
                passage_search_id: result.passageSearch.id,
              }),
            }
          );
          installAudioPreviewControls(panel, preview);
          panel.dispatchEvent(
            new CustomEvent("vellum-loop-selection", {
              detail: { arrangementEventIds: eventIds },
            })
          );
          status.textContent = `Auditioning ${candidate.strategy}; the score remains unchanged.`;
        } finally {
          audition.disabled = false;
        }
      });
      const adopt = document.createElement("button");
      adopt.type = "button";
      adopt.textContent = "Adopt as new version";
      adopt.disabled =
        candidate.status === "rejected" || candidate.changedArrangementEventIds.length === 0;
      adopt.addEventListener("click", async () => {
        adopt.disabled = true;
        try {
          const adoptedResult = await api<
            EditBatchResult & { changedArrangementEventIds: string[] }
          >(
            `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/passage-candidates/adopt`,
            {
              method: "POST",
              body: JSON.stringify({
                arrangement_event_ids: eventIds,
                source_candidate_id: candidate.sourceCandidateId,
                passage_search_id: result.passageSearch.id,
              }),
            }
          );
          document.dispatchEvent(
            new CustomEvent("vellum-arrangement-version-created", {
              detail: { result: adoptedResult, deliverable },
            })
          );
          dialog.close();
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : "Adoption failed.";
          adopt.disabled = false;
        }
      });
      card.append(title, evidence, comparison, audition, adopt);
      list.append(card);
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Alternative search failed.";
  }
  return dialog;
}

type EditBatchValidation = {
  valid: boolean;
  arrangementScoreId: string;
  arrangementScoreVersion: number;
  findings: Array<{
    id: string;
    eventIds: string[];
    severity: "hard" | "soft" | "observation";
    category: string;
    code: string;
    message: string;
    repairs: Array<{
      label: string;
      rationale: string;
      edits: Array<{ eventId: string; patch: Record<string, unknown> }>;
    }>;
  }>;
};

export function openEditBatchDialog(
  deliverable: GuidedDeliverable,
  selectedEvents: ArrangementEvent[]
): HTMLDialogElement {
  document.querySelector("#vellum-edit-batch")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "vellum-edit-batch";
  dialog.className = "edit-batch-dialog";
  const heading = document.createElement("h2");
  heading.textContent = `Edit ${selectedEvents.length} selected musical object${selectedEvents.length === 1 ? "" : "s"}`;
  const explanation = document.createElement("p");
  explanation.textContent =
    "Changes remain staged until you save. One save creates one new Arrangement Score version and reruns the complete Preservation Audit.";
  const form = document.createElement("form");
  form.method = "dialog";
  for (const event of selectedEvents) {
    const fieldset = document.createElement("fieldset");
    fieldset.dataset.editEventId = event.id;
    const legend = document.createElement("legend");
    legend.textContent = describeArrangementEvent(event);
    const pitches = document.createElement("input");
    pitches.name = "pitches";
    pitches.value = event.pitches.join(", ");
    pitches.setAttribute("aria-label", `Pitches for ${event.id}`);
    const durationNumerator = document.createElement("input");
    durationNumerator.name = "durationNumerator";
    durationNumerator.type = "number";
    durationNumerator.value = String(event.duration.numerator);
    durationNumerator.setAttribute("aria-label", `Duration numerator for ${event.id}`);
    const durationDenominator = document.createElement("input");
    durationDenominator.name = "durationDenominator";
    durationDenominator.type = "number";
    durationDenominator.min = "1";
    durationDenominator.value = String(event.duration.denominator);
    durationDenominator.setAttribute("aria-label", `Duration denominator for ${event.id}`);
    const positions = document.createElement("textarea");
    positions.name = "positions";
    positions.rows = Math.max(2, event.positions.length + 1);
    positions.value = JSON.stringify(event.positions, null, 2);
    positions.setAttribute("aria-label", `Course and fingering positions for ${event.id}`);
    fieldset.append(
      legend,
      labeledControl("Pitches (comma-separated)", pitches),
      labeledControl("Duration numerator", durationNumerator),
      labeledControl("Duration denominator", durationDenominator),
      labeledControl("Course/fret positions", positions)
    );
    form.append(fieldset);
  }
  const rationale = document.createElement("textarea");
  rationale.name = "rationale";
  rationale.required = true;
  rationale.rows = 2;
  rationale.placeholder = "Why should this version differ from its parent?";
  rationale.setAttribute("aria-label", "Edit batch rationale");
  form.append(labeledControl("Rationale for this new version", rationale));
  const status = document.createElement("p");
  status.className = "edit-batch-status";
  const findings = document.createElement("section");
  findings.className = "edit-validation-findings";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Discard staged edits";
  cancel.addEventListener("click", () => dialog.close());
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save as new version";
  save.disabled = true;
  form.append(findings, status, cancel, save);
  let validationTimer: number | undefined;
  const validate = async () => {
    const edits = stagedEventEdits(form, selectedEvents);
    clearEditValidationHighlights();
    findings.replaceChildren();
    if (edits.length === 0) {
      status.textContent = "No staged changes.";
      save.disabled = true;
      return undefined;
    }
    status.textContent = "Checking playability and Preservation Policy…";
    const result = await api<EditBatchValidation>(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/edit-batches/validate`,
      { method: "POST", body: JSON.stringify({ edits }) }
    );
    renderEditValidationFindings(findings, form, result, requestValidation);
    save.disabled = !result.valid;
    status.textContent = result.valid
      ? "Validation passed. Saving will create one new audited version."
      : "Hard findings must be repaired before commit; Policy Drift cannot be bulk-approved.";
    return result;
  };
  const requestValidation = () => {
    void validate().catch((error: unknown) => {
      save.disabled = true;
      status.textContent = error instanceof Error ? error.message : "Validation failed.";
    });
  };
  form.addEventListener("input", () => {
    if (validationTimer !== undefined) window.clearTimeout(validationTimer);
    validationTimer = window.setTimeout(requestValidation, 250);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      const edits = stagedEventEdits(form, selectedEvents);
      if (edits.length === 0) throw new Error("No staged changes to save.");
      const validation = await validate();
      if (!validation?.valid) throw new Error("Repair hard Validation Findings before saving.");
      status.textContent = "Validating the complete Edit Batch…";
      const result = await api<EditBatchResult>(
        `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/edit-batches`,
        {
          method: "POST",
          body: JSON.stringify({ edits, rationale: rationale.value.trim() }),
        }
      );
      document.dispatchEvent(
        new CustomEvent("vellum-arrangement-version-created", { detail: { result, deliverable } })
      );
      status.textContent = `Saved Arrangement Score v${result.arrangementScore.version}.`;
      dialog.close();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The Edit Batch failed.";
      save.disabled = false;
    }
  });
  dialog.append(heading, explanation, form);
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener("close", clearEditValidationHighlights, { once: true });
  return dialog;
}

function clearEditValidationHighlights(): void {
  document
    .querySelectorAll(".edit-validation-hard, .edit-validation-soft, .edit-validation-observation")
    .forEach((element) =>
      element.classList.remove(
        "edit-validation-hard",
        "edit-validation-soft",
        "edit-validation-observation"
      )
    );
}

function renderEditValidationFindings(
  container: HTMLElement,
  form: HTMLFormElement,
  validation: EditBatchValidation,
  revalidate: () => void
): void {
  for (const finding of validation.findings) {
    const item = document.createElement("article");
    item.className = `edit-validation-finding ${finding.severity}`;
    const message = document.createElement("p");
    message.textContent = `${finding.category.replaceAll("_", " ")} · ${finding.code}: ${finding.message}`;
    item.append(message);
    for (const eventId of finding.eventIds) {
      document
        .querySelectorAll(`[data-arrangement-event-id="${CSS.escape(eventId)}"]`)
        .forEach((element) => element.classList.add(`edit-validation-${finding.severity}`));
    }
    for (const repair of finding.repairs) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = repair.label;
      button.title = repair.rationale;
      button.addEventListener("click", () => {
        applyRepairEdits(form, repair.edits);
        revalidate();
      });
      item.append(button);
    }
    container.append(item);
  }
  if (validation.findings.length === 0) {
    const clean = document.createElement("p");
    clean.textContent = "No Validation Findings.";
    container.append(clean);
  }
}

function applyRepairEdits(
  form: HTMLFormElement,
  edits: Array<{ eventId: string; patch: Record<string, unknown> }>
): void {
  for (const edit of edits) {
    const fieldset = form.querySelector<HTMLFieldSetElement>(
      `[data-edit-event-id="${CSS.escape(edit.eventId)}"]`
    );
    if (!fieldset) continue;
    if (Array.isArray(edit.patch.pitches)) {
      fieldset.querySelector<HTMLInputElement>('[name="pitches"]')!.value =
        edit.patch.pitches.join(", ");
    }
    if (edit.patch.duration && typeof edit.patch.duration === "object") {
      const duration = edit.patch.duration as { numerator: number; denominator: number };
      fieldset.querySelector<HTMLInputElement>('[name="durationNumerator"]')!.value = String(
        duration.numerator
      );
      fieldset.querySelector<HTMLInputElement>('[name="durationDenominator"]')!.value = String(
        duration.denominator
      );
    }
    if (Array.isArray(edit.patch.positions)) {
      fieldset.querySelector<HTMLTextAreaElement>('[name="positions"]')!.value = JSON.stringify(
        edit.patch.positions,
        null,
        2
      );
    }
  }
}

function labeledControl(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.append(label, control);
  return wrapper;
}

function stagedEventEdits(form: HTMLFormElement, originals: ArrangementEvent[]) {
  const edits: Array<{ eventId: string; patch: Record<string, unknown> }> = [];
  for (const fieldset of form.querySelectorAll<HTMLFieldSetElement>("[data-edit-event-id]")) {
    const eventId = fieldset.dataset.editEventId!;
    const original = originals.find((event) => event.id === eventId)!;
    const pitches = fieldset
      .querySelector<HTMLInputElement>('[name="pitches"]')!
      .value.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const duration = {
      numerator: Number(
        fieldset.querySelector<HTMLInputElement>('[name="durationNumerator"]')!.value
      ),
      denominator: Number(
        fieldset.querySelector<HTMLInputElement>('[name="durationDenominator"]')!.value
      ),
    };
    const positions = JSON.parse(
      fieldset.querySelector<HTMLTextAreaElement>('[name="positions"]')!.value
    ) as ArrangementEvent["positions"];
    if (JSON.stringify(pitches) !== JSON.stringify(original.pitches))
      edits.push({ eventId, patch: { pitches } });
    if (JSON.stringify(duration) !== JSON.stringify(original.duration))
      edits.push({ eventId, patch: { duration } });
    if (JSON.stringify(positions) !== JSON.stringify(original.positions))
      edits.push({ eventId, patch: { positions } });
  }
  return edits;
}

export function describeArrangementEvent(event: ArrangementEvent): string {
  const duration = `${event.duration.numerator}/${event.duration.denominator}`;
  const role = (event.role ?? "accompaniment").replaceAll("_", " ");
  const position = event.positions.length
    ? ` · ${event.positions.map((item) => `course ${item.course}, fret ${item.fret}`).join("; ")}`
    : "";
  const pitches = event.type === "rest" ? "Rest" : event.pitches.join(" + ");
  return `${pitches} · duration ${duration} · ${role} · ${event.measureId}${position}`;
}

export function openOwnerPlaytestDialog(
  panel: HTMLElement,
  deliverable: GuidedDeliverable,
  selectedEvents: ArrangementEvent[]
): HTMLDialogElement {
  assertAuthorityPathRuntime("authority.validator.owner-playtest-readiness", "production");
  document.querySelector("#vellum-owner-playtest")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "vellum-owner-playtest";
  const occurrenceId = followedMeasureOccurrences.get(panel);
  const heading = document.createElement("h2");
  heading.textContent = `Record playtest for ${selectedEvents.length} selected object${selectedEvents.length === 1 ? "" : "s"}`;
  const readiness = document.createElement("p");
  readiness.setAttribute("aria-live", "polite");
  readiness.textContent = "Loading exact-score readiness…";
  void api<{ status: string; rationale: string }>(
    `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/readiness`
  )
    .then((view) => {
      readiness.textContent = `Current readiness: ${view.status.replaceAll("_", " ")} — ${view.rationale}`;
    })
    .catch((error) => {
      readiness.textContent = error instanceof Error ? error.message : "Readiness unavailable.";
    });
  const form = document.createElement("form");
  form.method = "dialog";
  const field = (label: string, control: HTMLElement) => {
    const wrapper = document.createElement("label");
    wrapper.append(document.createTextNode(label), control);
    return wrapper;
  };
  const select = (label: string, values: string[], required = false) => {
    const control = document.createElement("select");
    control.setAttribute("aria-label", label);
    const placeholder = new Option("Choose…", "", true, true);
    placeholder.disabled = true;
    control.add(placeholder);
    values.forEach((value) => control.add(new Option(value.replaceAll("_", " "), value)));
    control.required = required;
    return control;
  };
  const outcome = select(
    "Playtest outcome",
    [
      "comfortable",
      "practice_playable",
      "marginal",
      "unplayable",
      "unclear_unmusical",
      "historically_questionable",
      "notation_problem",
      "not_tested",
    ],
    true
  );
  const basis = select("Evidence basis", ["physical_playing", "notation", "listening"], true);
  const tempo = document.createElement("input");
  tempo.type = "number";
  tempo.min = "1";
  tempo.placeholder = "Actual BPM (optional)";
  const practice = document.createElement("input");
  practice.required = true;
  practice.placeholder = "Instrument, posture, warm-up, practice conditions…";
  const confidence = document.createElement("input");
  confidence.type = "number";
  confidence.min = "0";
  confidence.max = "1";
  confidence.step = "0.05";
  confidence.required = true;
  confidence.placeholder = "0–1 confidence";
  const dimension = select("Finding dimension", [
    "mechanics",
    "technique",
    "clarity",
    "identity",
    "history",
    "notation",
  ]);
  const findingCode = select("Finding type", [
    "reach",
    "shift_reliability",
    "held_note_conflict",
    "right_hand_difficulty",
    "damping",
    "voice_clarity",
    "cadence",
    "source_identity",
    "historical_practice",
    "notation",
  ]);
  const findingOutcome = select("Finding outcome", [
    "supports",
    "concern",
    "blocks",
    "not_applicable",
  ]);
  const findingRationale = document.createElement("input");
  findingRationale.placeholder = "Optional structured finding detail";
  const rationale = document.createElement("textarea");
  rationale.required = true;
  rationale.placeholder = "What happened in this exact context?";
  const proposal = select("Optional proposed next action", [
    "none",
    "adoption",
    "rejection",
    "correction",
    "commitment",
    "ergonomic_profile",
    "calibration_candidate",
    "fixture_nomination",
  ]);
  proposal.value = "none";
  const warning = document.createElement("p");
  warning.textContent = occurrenceId
    ? `Anchored to playback occurrence ${occurrenceId}. Proposed consequences remain proposals until explicitly adopted.`
    : "Start or seek playback for this passage first so the playtest can be anchored to an exact Playback Occurrence.";
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save scoped playtest";
  save.disabled = !occurrenceId;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Cancel";
  close.addEventListener("click", () => dialog.close());
  form.append(
    warning,
    field("Outcome", outcome),
    field("Evidence came from", basis),
    field("Actual tempo", tempo),
    field("Practice context", practice),
    field("Confidence", confidence),
    field("Finding dimension", dimension),
    field("Finding type", findingCode),
    field("Finding outcome", findingOutcome),
    field("Finding detail", findingRationale),
    field("Overall rationale", rationale),
    field("Proposed next action", proposal),
    save,
    close
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!occurrenceId) return;
    const hasFinding = findingRationale.value.trim().length > 0;
    for (const control of [dimension, findingCode, findingOutcome]) {
      control.setCustomValidity(
        hasFinding && !control.value ? "Choose a value for this finding." : ""
      );
    }
    if (!form.reportValidity()) return;
    save.disabled = true;
    const observation = hasFinding
      ? [
          {
            dimension: dimension.value,
            code: findingCode.value,
            outcome: findingOutcome.value,
            rationale: findingRationale.value.trim(),
          },
        ]
      : [];
    void api<{ playtest: { id: string }; readiness: { status: string; rationale: string } }>(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/owner-playtests`,
      {
        method: "POST",
        body: JSON.stringify({
          arrangement_event_ids: selectedEvents.map(({ id }) => id),
          playback_occurrence_ids: [occurrenceId],
          ...(tempo.value ? { tempo_bpm: Number(tempo.value) } : {}),
          practice_context: practice.value,
          evidence_basis: [basis.value],
          outcome: outcome.value,
          confidence: Number(confidence.value),
          observations: observation,
          rationale: rationale.value,
          proposed_consequences: proposal.value === "none" ? [] : [proposal.value],
        }),
      }
    )
      .then((result) => {
        readiness.textContent = `Saved ${result.playtest.id}. Readiness: ${result.readiness.status.replaceAll("_", " ")} — ${result.readiness.rationale}`;
        form.hidden = true;
      })
      .catch((error) => {
        readiness.textContent = error instanceof Error ? error.message : "Playtest save failed.";
        save.disabled = false;
      });
  });
  dialog.append(heading, readiness, form);
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function installNotationSelection(panel: HTMLElement, deliverable: GuidedDeliverable): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  const notation = panel.querySelector<HTMLElement>(".artifact-preview-content > svg");
  if (!header || !notation) return;
  header.querySelector(".score-selection-summary")?.remove();
  const summary = document.createElement("aside");
  summary.className = "score-selection-summary";
  summary.hidden = true;
  const eventById = new Map(deliverable.arrangementEvents.map((event) => [event.id, event]));
  const eventOrder = deliverable.arrangementEvents.map((event) => event.id);
  const selected = new Set<string>();
  let anchorId: string | undefined;
  let dragging = false;
  let suppressClick = false;
  const groups = notation.querySelectorAll<SVGGElement>("[data-arrangement-event-id]");
  for (const group of groups) {
    const eventId = group.dataset.arrangementEventId;
    if (!eventId || !eventById.has(eventId)) continue;
    group.classList.add("vellum-selectable-event");
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-pressed", "false");
    group.setAttribute("aria-label", describeArrangementEvent(eventById.get(eventId)!));
  }
  const renderSelection = (seekEventId?: string) => {
    const selectedEvents = deliverable.arrangementEvents.filter((event) => selected.has(event.id));
    summary.dataset.arrangementEventIds = selectedEvents.map((event) => event.id).join(" ");
    notation.querySelectorAll<SVGGElement>("[data-arrangement-event-id]").forEach((group) => {
      const active = selected.has(group.dataset.arrangementEventId ?? "");
      group.classList.toggle("score-selected", active);
      group.setAttribute("aria-pressed", String(active));
    });
    if (selectedEvents.length === 0) {
      summary.hidden = true;
      summary.replaceChildren();
      panel.dispatchEvent(
        new CustomEvent("vellum-score-selection-changed", {
          detail: { arrangementEventIds: [] },
        })
      );
      return;
    }
    const title = document.createElement("strong");
    title.textContent = `${selectedEvents.length} musical object${selectedEvents.length === 1 ? "" : "s"} selected`;
    const facts = document.createElement("span");
    facts.textContent = selectedEvents.map(describeArrangementEvent).join(" | ");
    const identities = document.createElement("details");
    const identitiesSummary = document.createElement("summary");
    identitiesSummary.textContent = "Exact selection identity";
    const identityList = document.createElement("code");
    identityList.textContent = selectedEvents.map((event) => event.id).join("\n");
    identities.append(identitiesSummary, identityList);
    const request = document.createElement("input");
    request.type = "text";
    request.placeholder = "Ask about this passage…";
    request.setAttribute("aria-label", "Question about selected score events");
    const ask = document.createElement("button");
    ask.type = "button";
    ask.textContent = "Ask Vellum";
    ask.addEventListener("click", async () => {
      const context = buildScoreSelectionContext(
        deliverable,
        selectedEvents.map((event) => event.id)
      );
      ask.disabled = true;
      try {
        await proposeOwnerIntent(summary, context, request.value);
      } catch (error) {
        summary.querySelector(".owner-intent-error")?.remove();
        const failure = document.createElement("p");
        failure.className = "owner-intent-error";
        failure.textContent = `${error instanceof Error ? error.message : "Intent classification failed"} Your selection and request are still here; retry when ready.`;
        summary.append(failure);
      } finally {
        ask.disabled = false;
      }
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      selected.clear();
      anchorId = undefined;
      renderSelection();
    });
    const routeDirectAction = (
      directRequest: string,
      proceed: (layer: CanonicalOwnerIntentLayer) => void
    ) => {
      const context = buildScoreSelectionContext(
        deliverable,
        selectedEvents.map((event) => event.id)
      );
      void proposeOwnerIntent(summary, context, directRequest, proceed).catch((error) => {
        summary.querySelector(".owner-intent-error")?.remove();
        const failure = document.createElement("p");
        failure.className = "owner-intent-error";
        failure.textContent = `${error instanceof Error ? error.message : "Intent classification failed"} No action was applied; retry when ready.`;
        summary.append(failure);
      });
    };
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit selection";
    edit.addEventListener("click", () => {
      routeDirectAction("Change these notes", (layer) => {
        if (layer === "arrangement_score") openEditBatchDialog(deliverable, selectedEvents);
      });
    });
    const alternatives = document.createElement("button");
    alternatives.type = "button";
    alternatives.textContent = "Try alternatives";
    alternatives.addEventListener("click", () => {
      routeDirectAction("Change these notes by trying alternative score realizations", (layer) => {
        if (layer === "arrangement_score")
          void openPassageCandidatesDialog(panel, deliverable, selectedEvents);
      });
    });
    const proposeDefault = document.createElement("button");
    proposeDefault.type = "button";
    proposeDefault.textContent = "Propose default";
    proposeDefault.addEventListener("click", () => {
      routeDirectAction("Make this my default going forward", (layer) => {
        if (layer === "personal_default_candidate")
          void proposeSelectionDefault(deliverable, selectedEvents);
      });
    });
    const loop = document.createElement("button");
    loop.type = "button";
    loop.textContent = "Loop selection";
    loop.addEventListener("click", () =>
      panel.dispatchEvent(
        new CustomEvent("vellum-loop-selection", {
          detail: { arrangementEventIds: selectedEvents.map((event) => event.id) },
        })
      )
    );
    const playtest = document.createElement("button");
    playtest.type = "button";
    playtest.textContent = "Record playtest";
    playtest.addEventListener("click", () =>
      openOwnerPlaytestDialog(panel, deliverable, selectedEvents)
    );
    const actions = document.createElement("span");
    actions.className = "score-selection-actions";
    actions.append(request, ask, edit, alternatives, proposeDefault, loop, playtest, clear);
    summary.replaceChildren(title, facts, identities, actions);
    summary.hidden = false;
    panel.dispatchEvent(
      new CustomEvent("vellum-score-selection-changed", {
        detail: { arrangementEventIds: selectedEvents.map((event) => event.id) },
      })
    );
    if (seekEventId) {
      panel.dispatchEvent(
        new CustomEvent("vellum-seek-playback", {
          detail: { arrangementEventId: seekEventId },
        })
      );
    }
  };
  const selectRange = (fromId: string, toId: string, replace: boolean) => {
    const left = eventOrder.indexOf(fromId);
    const right = eventOrder.indexOf(toId);
    if (left < 0 || right < 0) return;
    if (replace) selected.clear();
    for (let index = Math.min(left, right); index <= Math.max(left, right); index += 1) {
      selected.add(eventOrder[index]!);
    }
    renderSelection(toId);
  };
  const select = (eventId: string, extend: boolean) => {
    const arrangementEvent = eventById.get(eventId);
    if (!arrangementEvent) return;
    if (extend && anchorId) {
      selectRange(anchorId, eventId, false);
      return;
    }
    selected.clear();
    selected.add(eventId);
    anchorId = eventId;
    renderSelection(eventId);
  };
  notation.addEventListener("click", (browserEvent) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const target = (browserEvent.target as Element | null)?.closest<SVGGElement>(
      "[data-arrangement-event-id]"
    );
    if (target?.dataset.arrangementEventId)
      select(target.dataset.arrangementEventId, browserEvent.shiftKey);
  });
  notation.addEventListener("keydown", (browserEvent) => {
    if (browserEvent.key !== "Enter" && browserEvent.key !== " ") return;
    const target = (browserEvent.target as Element | null)?.closest<SVGGElement>(
      "[data-arrangement-event-id]"
    );
    if (target?.dataset.arrangementEventId) {
      browserEvent.preventDefault();
      select(target.dataset.arrangementEventId, browserEvent.shiftKey);
    }
  });
  notation.addEventListener("pointerdown", (browserEvent) => {
    const target = (browserEvent.target as Element | null)?.closest<SVGGElement>(
      "[data-arrangement-event-id]"
    );
    const eventId = target?.dataset.arrangementEventId;
    if (!eventId) return;
    dragging = true;
    suppressClick = false;
    if (!browserEvent.shiftKey || !anchorId) anchorId = eventId;
  });
  notation.addEventListener("pointerover", (browserEvent) => {
    if (!dragging || !anchorId) return;
    const target = (browserEvent.target as Element | null)?.closest<SVGGElement>(
      "[data-arrangement-event-id]"
    );
    if (target?.dataset.arrangementEventId) {
      if (target.dataset.arrangementEventId !== anchorId) suppressClick = true;
      selectRange(anchorId, target.dataset.arrangementEventId, true);
    }
  });
  notation.addEventListener("pointerup", () => {
    dragging = false;
  });
  notation.addEventListener("pointerleave", () => {
    dragging = false;
  });
  header.append(summary);
}

type SourceLineageResult = {
  arrangementScore: { id: string; version: number };
  normalizedScore: { id: string; version: number };
  scoreTranscription: { id: string; version: number; status: string };
  sourceArtifact: {
    id: string;
    filename: string;
    kind: string;
    mimeType: string;
    contentUrl: string;
  };
  staleReason?: string;
  items: Array<{
    arrangementEventId: string;
    sourceEventId: string;
    anchorStatus: "resolved" | "missing" | "stale";
    transcriptionEvent?: ScoreEvent;
    region?: TranscriptionUncertainty["region"];
    sourceImageUrl?: string;
    uncertaintyIds: string[];
    transformationEntries: GuidedDeliverable["transformationReport"];
    auditFindings: GuidedDeliverable["preservationAudit"]["findings"];
  }>;
};

export function installSourceLineageWorkspace(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".source-lineage-workspace")?.remove();
  const details = document.createElement("details");
  details.className = "source-lineage-workspace";
  details.hidden = true;
  const summary = document.createElement("summary");
  summary.textContent = "Source Lineage";
  const body = document.createElement("div");
  body.className = "source-lineage-body";
  details.append(summary, body);
  header.append(details);
  panel.addEventListener("vellum-score-selection-changed", (event) => {
    const arrangementEventIds = (event as CustomEvent<{ arrangementEventIds?: string[] }>).detail
      ?.arrangementEventIds;
    if (!arrangementEventIds?.length) {
      details.hidden = true;
      body.replaceChildren();
      return;
    }
    void api<SourceLineageResult>(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/source-lineage`,
      { method: "POST", body: JSON.stringify({ arrangementEventIds }) }
    )
      .then((lineage) => renderSourceLineage(panel, details, body, lineage))
      .catch((error: unknown) => {
        details.hidden = false;
        details.open = true;
        body.textContent =
          error instanceof Error ? error.message : "Source Lineage is unavailable.";
      });
  });
}

function renderSourceLineage(
  panel: HTMLElement,
  details: HTMLDetailsElement,
  body: HTMLElement,
  lineage: SourceLineageResult
): void {
  details.hidden = false;
  details.open = true;
  const layers = document.createElement("p");
  layers.className = "source-lineage-layers";
  layers.textContent = `Source Artifact: ${lineage.sourceArtifact.filename} → Score Transcription v${lineage.scoreTranscription.version} (${lineage.scoreTranscription.status}) → Normalized Score v${lineage.normalizedScore.version} → Arrangement Score v${lineage.arrangementScore.version}`;
  body.replaceChildren(layers);
  if (lineage.staleReason) {
    const stale = document.createElement("p");
    stale.className = "source-lineage-warning";
    stale.textContent = `Stale anchor: ${lineage.staleReason} Open Score-Anchored Review or regenerate before treating this mapping as current.`;
    body.append(stale);
  }
  const firstAnchored = lineage.items.find((item) => item.region);
  if (firstAnchored) body.append(sourceFacsimile(lineage.sourceArtifact, firstAnchored));
  const list = document.createElement("ol");
  const seen = new Set<string>();
  for (const item of lineage.items) {
    const key = `${item.arrangementEventId}:${item.sourceEventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = document.createElement("li");
    row.dataset.arrangementEventIds = item.arrangementEventId;
    row.dataset.sourceEventIds = item.sourceEventId;
    const eventFact = item.transcriptionEvent
      ? item.transcriptionEvent.type === "note"
        ? `${item.transcriptionEvent.pitch}, confidence ${Math.round((item.transcriptionEvent.confidence ?? 1) * 100)}%`
        : "rest"
      : "transcription object missing";
    row.textContent = `${item.sourceEventId}: ${eventFact} · ${item.anchorStatus}${item.uncertaintyIds.length ? ` · uncertainties ${item.uncertaintyIds.join(", ")}` : ""}`;
    if (item.anchorStatus === "missing") {
      row.append(" — Review the Score Transcription; Vellum will not guess this anchor.");
    }
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.textContent = "Reveal in arrangement and playback";
    reveal.addEventListener("click", () => {
      panel
        .querySelectorAll(".source-lineage-selected")
        .forEach((element) => element.classList.remove("source-lineage-selected"));
      panel
        .querySelectorAll(`[data-arrangement-event-id="${CSS.escape(item.arrangementEventId)}"]`)
        .forEach((element) => element.classList.add("source-lineage-selected"));
      panel.dispatchEvent(
        new CustomEvent("vellum-seek-playback", {
          detail: { sourceEventId: item.sourceEventId },
        })
      );
    });
    row.append(" ", reveal);
    list.append(row);
  }
  body.append(list);
}

function sourceFacsimile(
  source: SourceLineageResult["sourceArtifact"],
  item: SourceLineageResult["items"][number]
): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "source-lineage-facsimile";
  const caption = document.createElement("figcaption");
  caption.textContent = `Immutable Source Artifact · page ${item.region!.page}`;
  if (item.sourceImageUrl || source.kind === "image") {
    const image = document.createElement("img");
    image.src = item.sourceImageUrl ?? source.contentUrl;
    image.alt = `${source.filename}, page ${item.region!.page}`;
    figure.append(caption, image);
  } else {
    const frame = document.createElement("iframe");
    isolateArtifactFrame(frame);
    frame.title = `${source.filename}, source page ${item.region!.page}`;
    frame.src = sourceFocusUrl(source.contentUrl, item.region!);
    figure.append(caption, frame);
  }
  return figure;
}

type ScoreAnchoredReview = {
  transcriptionId: string;
  version: number;
  status: "needs_review" | "reviewed" | "best_effort";
  sourceArtifactId: string;
  sourceFilename: string;
  sourceContentUrl: string;
  acceptanceBatches: NonNullable<ScoreTranscription["acceptanceBatches"]>;
  items: Array<{
    uncertainty: TranscriptionUncertainty;
    events: ScoreEvent[];
    sourceImageUrl?: string;
  }>;
};

type CorrectionResult = {
  scoreTranscription: { id: string; version: number; status: ScoreAnchoredReview["status"] };
  normalizedScore: { id: string; version: number };
};

async function checkpointGuidedWorkflow(
  workflow: GuidedWorkflow,
  update: Record<string, unknown>
): Promise<GuidedWorkflow> {
  return await api<GuidedWorkflow>(
    `/api/workspaces/${workflow.workspaceId}/guided-workflows/${workflow.id}`,
    { method: "PATCH", body: JSON.stringify(update) }
  );
}

async function continueGuidedWorkflow(
  dialog: HTMLDialogElement,
  initial: GuidedWorkflow,
  targetConfigurations: TargetConfiguration[],
  onComplete: GuidedStartOptions["onComplete"]
): Promise<GuidedWorkflow> {
  const status = dialog.querySelector<HTMLElement>("[data-guided-status]")!;
  let workflow = initial;
  if (!workflow.normalizedScoreId) {
    workflow = await checkpointGuidedWorkflow(workflow, { stage: "recognizing" });
    status.textContent = workflow.optical
      ? "Reading the score with optical music recognition…"
      : "Parsing and normalizing the musical source…";
    const recognized = await api<{
      omrRun?: { id: string };
      scoreTranscription: {
        id: string;
        version: number;
        status: ScoreAnchoredReview["status"];
      };
      normalizedScore: { id: string; version: number };
    }>(
      workflow.optical
        ? `/api/workspaces/${workflow.workspaceId}/omr-runs`
        : `/api/workspaces/${workflow.workspaceId}/sources/${workflow.sourceArtifactId}/import`,
      {
        method: "POST",
        body: JSON.stringify(
          workflow.optical
            ? {
                sourceArtifactId: workflow.sourceArtifactId,
                backend: "audiveris",
                autoAcceptConfidence: workflow.ocrAutoAcceptConfidence,
              }
            : {}
        ),
      }
    );
    workflow = await checkpointGuidedWorkflow(workflow, {
      stage:
        workflow.optical && recognized.scoreTranscription.status === "needs_review"
          ? "transcription_review"
          : "target_search",
      ...(recognized.omrRun ? { omrRunId: recognized.omrRun.id } : {}),
      scoreTranscriptionId: recognized.scoreTranscription.id,
      scoreTranscriptionVersion: recognized.scoreTranscription.version,
      normalizedScoreId: recognized.normalizedScore.id,
      normalizedScoreVersion: recognized.normalizedScore.version,
    });
  }
  if (
    workflow.optical &&
    workflow.stage === "transcription_review" &&
    workflow.scoreTranscriptionId &&
    workflow.scoreTranscriptionVersion &&
    workflow.normalizedScoreId &&
    workflow.normalizedScoreVersion
  ) {
    const reviewed = await resolveCriticalUncertainties(
      dialog,
      workflow.workspaceId,
      workflow.scoreTranscriptionId,
      workflow.normalizedScoreId,
      workflow.scoreTranscriptionVersion,
      workflow.normalizedScoreVersion
    );
    workflow = await checkpointGuidedWorkflow(workflow, {
      stage: "target_search",
      scoreTranscriptionId: reviewed.transcriptionId,
      scoreTranscriptionVersion: reviewed.transcriptionVersion,
      normalizedScoreId: reviewed.normalizedScoreId,
      normalizedScoreVersion: reviewed.normalizedScoreVersion,
    });
  }
  return await runGuidedWorkflowTargets(dialog, workflow, targetConfigurations, onComplete);
}

async function runGuidedWorkflowTargets(
  dialog: HTMLDialogElement,
  initial: GuidedWorkflow,
  targetConfigurations: TargetConfiguration[],
  onComplete: GuidedStartOptions["onComplete"]
): Promise<GuidedWorkflow> {
  const status = dialog.querySelector<HTMLElement>("[data-guided-status]")!;
  let workflow = initial;
  const deliverables: GuidedDeliverable[] = [];
  for (const target of targetConfigurations) {
    const performanceBrief = workflow.performanceBrief ?? defaultGuidedPerformanceBrief();
    const progress = workflow.targets.find(
      (candidate) => candidate.targetConfigurationId === target.id
    );
    if (progress?.status === "complete") continue;
    workflow = await checkpointGuidedWorkflow(workflow, {
      ...(workflow.stage === "source_saved" ||
      workflow.stage === "recognizing" ||
      workflow.stage === "transcription_review" ||
      workflow.stage === "analysis_review"
        ? { stage: "target_search" }
        : {}),
      targets: [
        {
          targetConfigurationId: target.id,
          status: "searching",
          deliverableIds: [],
        },
      ],
    });
    status.textContent = `Searching and auditing the ${targetLabel(target.id)} reduction…`;
    const arranged = await arrangeWithAnalysisReview<{
      analysis: GuidedDeliverable["analysis"] & { version: number };
      arrangementSearch: { id: string };
      arrangementPlan: ArrangementPlan;
      candidates: GuidedDeliverable["candidates"];
      arrangementScore: {
        id: string;
        version: number;
        parentArrangementScoreId?: string;
        branchId?: string;
        editorialCommitmentIds?: string[];
        arrangementFamilyId: string;
        targetConfiguration: TargetConfiguration;
        preservationPolicy: ArrangementScore["preservationPolicy"];
        events: ArrangementEvent[];
        transformationReport: GuidedDeliverable["transformationReport"];
        preservationAudit: GuidedDeliverable["preservationAudit"];
        continuoDisposition?: GuidedDeliverable["continuoDisposition"];
      };
    }>(dialog, workflow.workspaceId, `/api/workspaces/${workflow.workspaceId}/arrangements`, {
      method: "POST",
      body: JSON.stringify({
        normalizedScoreId: workflow.normalizedScoreId,
        targetConfigurationId: target.id,
        preservationPolicy: workflow.preservationPolicy,
        performanceBrief: {
          ...performanceBrief,
          notationContext: {
            ...performanceBrief.notationContext,
            needs: [
              ...new Set([...performanceBrief.notationContext.needs, ...target.notationLayouts]),
            ],
          },
        },
      }),
    });
    workflow = await checkpointGuidedWorkflow(workflow, {
      stage: "projection",
      analysisRecordId: arranged.analysis.id,
      analysisRecordVersion: arranged.analysis.version,
      targets: [
        {
          targetConfigurationId: target.id,
          status: "projecting",
          arrangementSearchId: arranged.arrangementSearch.id,
          arrangementScoreId: arranged.arrangementScore.id,
          arrangementScoreVersion: arranged.arrangementScore.version,
          deliverableIds: [],
        },
      ],
    });
    status.textContent = `Engraving ${targetLabel(target.id)} and preparing literal playback…`;
    const [compiled, preview] = await Promise.all([
      api<CompileResult & { deliverables: GuidedDeliverable["deliverables"] }>(
        `/api/workspaces/${workflow.workspaceId}/arrangements/${arranged.arrangementScore.id}/compile`,
        { method: "POST" }
      ),
      api<AudioPreview & { deliverable: GuidedDeliverable["deliverables"][number] }>(
        `/api/workspaces/${workflow.workspaceId}/arrangements/${arranged.arrangementScore.id}/audio-preview`
      ),
    ]);
    const persisted = [...compiled.deliverables, preview.deliverable];
    workflow = await checkpointGuidedWorkflow(workflow, {
      targets: [
        {
          targetConfigurationId: target.id,
          status: "complete",
          arrangementSearchId: arranged.arrangementSearch.id,
          arrangementScoreId: arranged.arrangementScore.id,
          arrangementScoreVersion: arranged.arrangementScore.version,
          deliverableIds: persisted.map((item) => item.id),
        },
      ],
    });
    deliverables.push({
      workspaceId: workflow.workspaceId,
      arrangementScoreId: arranged.arrangementScore.id,
      arrangementScoreVersion: arranged.arrangementScore.version,
      parentArrangementScoreId: arranged.arrangementScore.parentArrangementScoreId,
      branchId: arranged.arrangementScore.branchId,
      editorialCommitmentIds: arranged.arrangementScore.editorialCommitmentIds ?? [],
      arrangementFamilyId: arranged.arrangementScore.arrangementFamilyId,
      arrangementSearchId: arranged.arrangementSearch.id,
      arrangementPlan: arranged.arrangementPlan,
      targetConfigurationId: target.id,
      targetConfiguration: arranged.arrangementScore.targetConfiguration,
      preservationPolicy: arranged.arrangementScore.preservationPolicy,
      label: targetLabel(target.id),
      arrangementEvents: arranged.arrangementScore.events,
      analysis: arranged.analysis,
      transformationReport: arranged.arrangementScore.transformationReport,
      preservationAudit: arranged.arrangementScore.preservationAudit,
      continuoDisposition: arranged.arrangementScore.continuoDisposition,
      compiled,
      preview,
      deliverables: persisted,
      candidates: arranged.candidates,
    });
  }
  workflow = await checkpointGuidedWorkflow(workflow, { stage: "complete" });
  if (deliverables.length) {
    const completedWorkspace = await api<{
      brief: { personalDefaultApplications?: GuidedDeliverable["personalDefaultApplications"] };
    }>(`/api/workspaces/${workflow.workspaceId}`);
    for (const deliverable of deliverables)
      deliverable.personalDefaultApplications =
        completedWorkspace.brief.personalDefaultApplications;
    onComplete(deliverables);
  } else {
    const selected = workflow.targets.find((target) => target.arrangementScoreId);
    if (selected?.arrangementScoreId) {
      document.dispatchEvent(
        new CustomEvent("vellum-open-arrangement-version", {
          detail: {
            workspaceId: workflow.workspaceId,
            arrangementScoreId: selected.arrangementScoreId,
          },
        })
      );
    }
  }
  return workflow;
}

export async function refreshGuidedWorkflowRecovery(
  dialog: HTMLDialogElement,
  workspaceId: string,
  onComplete: GuidedStartOptions["onComplete"]
): Promise<void> {
  const panel = dialog.querySelector<HTMLElement>("[data-guided-workflow-recovery]")!;
  const message = panel.querySelector<HTMLElement>("[data-guided-workflow-message]")!;
  const resume = panel.querySelector<HTMLButtonElement>("[data-guided-workflow-resume]")!;
  const restart = panel.querySelector<HTMLButtonElement>("[data-guided-workflow-restart]")!;
  const result = await api<{ workflow?: GuidedWorkflow }>(
    `/api/workspaces/${workspaceId}/guided-workflows/active`
  );
  const workflow = result.workflow;
  if (!workflow || (workflow.status !== "active" && workflow.status !== "interrupted")) {
    panel.hidden = true;
    return;
  }
  const thresholdField = dialog.querySelector<HTMLElement>("[data-ocr-threshold-field]");
  const threshold = dialog.querySelector<HTMLInputElement>('[name="ocrAutoAcceptConfidence"]');
  const thresholdWasHidden = thresholdField?.hidden ?? true;
  if (thresholdField) thresholdField.hidden = !workflow.optical;
  if (
    workflow.optical &&
    thresholdWasHidden &&
    threshold &&
    workflow.ocrAutoAcceptConfidence !== undefined
  ) {
    threshold.value = String(Math.round(workflow.ocrAutoAcceptConfidence * 100));
    const thresholdValue = dialog.querySelector<HTMLElement>("[data-ocr-threshold-value]");
    if (thresholdValue) thresholdValue.textContent = `${threshold.value}%`;
  }
  panel.hidden = false;
  message.textContent =
    workflow.status === "interrupted"
      ? `Stopped at ${workflow.stage.replaceAll("_", " ")} (${workflow.failureCode ?? "workflow_interrupted"}). Completed outputs are retained.`
      : `Retained at ${workflow.stage.replaceAll("_", " ")} after the page closed or reloaded. Completed outputs will not be repeated.`;
  const targetConfigurations = (
    await api<{ brief: { targetConfigurations: TargetConfiguration[] } }>(
      `/api/workspaces/${workspaceId}`
    )
  ).brief.targetConfigurations;
  const run = async (action: "resume" | "restart") => {
    resume.disabled = true;
    restart.disabled = true;
    let continuingWorkflow: GuidedWorkflow | undefined;
    try {
      const restartInput =
        action === "restart" && workflow.optical && thresholdField && !thresholdField.hidden
          ? { ocrAutoAcceptConfidence: Number(threshold?.value ?? "80") / 100 }
          : undefined;
      continuingWorkflow = await api<GuidedWorkflow>(
        `/api/workspaces/${workspaceId}/guided-workflows/${workflow.id}/${action}`,
        {
          method: "POST",
          ...(restartInput ? { body: JSON.stringify(restartInput) } : {}),
        }
      );
      panel.hidden = true;
      continuingWorkflow = await continueGuidedWorkflow(
        dialog,
        continuingWorkflow,
        targetConfigurations,
        onComplete
      );
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Recovery failed.";
      if (
        continuingWorkflow &&
        continuingWorkflow.status !== "complete" &&
        continuingWorkflow.status !== "cancelled"
      ) {
        const code = error instanceof VellumApiError ? error.code : "workflow_interrupted";
        try {
          continuingWorkflow = await api<GuidedWorkflow>(
            `/api/workspaces/${workspaceId}/guided-workflows/${continuingWorkflow.id}/interrupt`,
            { method: "POST", body: JSON.stringify({ code }) }
          );
          await refreshGuidedWorkflowRecovery(dialog, workspaceId, onComplete);
          return;
        } catch {
          // Keep the original failure visible if persistence or recovery discovery also fails.
        }
      }
      message.textContent = failureMessage;
      panel.hidden = false;
    } finally {
      resume.disabled = false;
      restart.disabled = false;
    }
  };
  resume.onclick = () => void run("resume");
  restart.onclick = () => void run("restart");
}

function globalLauncherBar(): HTMLElement {
  const existing = document.querySelector<HTMLElement>("#vellum-launcher-bar");
  if (existing) return existing;
  const bar = document.createElement("nav");
  bar.id = "vellum-launcher-bar";
  bar.setAttribute("aria-label", "Vellum actions");
  document.body.append(bar);
  return bar;
}

export function installGuidedStart(options: GuidedStartOptions): void {
  assertAuthorityPathRuntime("authority.parameter.arrangement-defaults", "production");
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  assertAuthorityPathRuntime("authority.validator.source-interpretation", "production");
  const linkedWorkspace = new URL(window.location.href).searchParams.get("workspace");
  let activeWorkspaceId =
    linkedWorkspace?.match(/^workspace\.[a-f0-9-]{16,}$/)?.[0] ??
    localStorage.getItem("vellum.active-workspace") ??
    undefined;
  if (linkedWorkspace && activeWorkspaceId === linkedWorkspace) {
    localStorage.setItem("vellum.active-workspace", linkedWorkspace);
  }
  const launcher = document.createElement("button");
  launcher.id = "guided-start-launcher";
  launcher.type = "button";
  launcher.textContent = "New arrangement";
  globalLauncherBar().append(launcher);
  installWorkspaceNavigator();
  installOwnerKnowledgeWorkbench();

  const dialog = document.createElement("dialog");
  dialog.id = "guided-start";
  dialog.innerHTML = guidedStartMarkup();
  document.body.append(dialog);
  const sourceInput = dialog.querySelector<HTMLInputElement>('input[type="file"]');
  const ocrThresholdField = dialog.querySelector<HTMLElement>("[data-ocr-threshold-field]");
  const ocrThreshold = dialog.querySelector<HTMLInputElement>('[name="ocrAutoAcceptConfidence"]');
  const ocrThresholdValue = dialog.querySelector<HTMLElement>("[data-ocr-threshold-value]");
  const updateOcrThresholdVisibility = () => {
    const file = sourceInput?.files?.[0];
    if (!ocrThresholdField) return;
    ocrThresholdField.hidden = !file || !isOpticalSource(file);
  };
  sourceInput?.addEventListener("change", updateOcrThresholdVisibility);
  ocrThreshold?.addEventListener("input", () => {
    if (ocrThresholdValue) ocrThresholdValue.textContent = `${ocrThreshold.value}%`;
  });
  launcher.addEventListener("click", () => {
    dialog.showModal();
    if (activeWorkspaceId) {
      void refreshModelActionRecovery(dialog, activeWorkspaceId);
      void refreshGuidedWorkflowRecovery(dialog, activeWorkspaceId, options.onComplete);
    }
  });
  for (const skip of dialog.querySelectorAll<HTMLElement>("[data-guided-skip]")) {
    skip.addEventListener("click", () => dialog.close());
  }
  dialog.addEventListener("cancel", (event) => {
    if (!dialog.querySelector<HTMLElement>("[data-score-review]")?.hidden) {
      event.preventDefault();
    }
  });
  installProviderConnection(dialog);

  const form = dialog.querySelector<HTMLFormElement>("form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = dialog.querySelector<HTMLElement>("[data-guided-status]");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const file = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
    if (!file || !status || !submit) return;
    submit.disabled = true;
    let activeWorkflow: GuidedWorkflow | undefined;
    try {
      delete status.dataset.error;
      status.textContent = "Saving a local workspace…";
      const title =
        form.querySelector<HTMLInputElement>('[name="title"]')?.value.trim() ||
        file.name.replace(/\.[^.]+$/i, "");
      const instruction = form
        .querySelector<HTMLTextAreaElement>('[name="instruction"]')
        ?.value.trim();
      const selectedTargets = Array.from(
        form.querySelectorAll<HTMLInputElement>('[name="targets"]:checked')
      ).map((input) => input.value);
      if (selectedTargets.length === 0) throw new Error("Choose at least one output format");
      const preservationPolicy =
        form.querySelector<HTMLSelectElement>('[name="preservationPolicy"]')?.value ??
        "faithful_reduction";
      const performanceBrief = performanceBriefFromForm(form);
      const ocrAutoAcceptConfidence = Number(
        form.querySelector<HTMLInputElement>('[name="ocrAutoAcceptConfidence"]')?.value ?? "80"
      );
      const targetConfigurations = selectedTargets.map(targetConfiguration);
      const workspace = await api<{ id: string }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          title,
          brief: {
            targetConfigurations,
            ...(instruction ? { instruction } : {}),
          },
        }),
      });
      activeWorkspaceId = workspace.id;
      localStorage.setItem("vellum.active-workspace", workspace.id);
      await refreshModelActionRecovery(dialog, workspace.id);
      status.textContent = "Uploading the source…";
      const mimeType = sourceMimeType(file);
      const source = await api<{ id: string }>(`/api/workspaces/${workspace.id}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": mimeType,
          "X-Source-Filename": encodeURIComponent(file.name),
          "X-Source-License": "User supplied; rights not asserted by Vellum",
        },
        body: file,
      });
      const optical = isOpticalSource(file);
      const workflow = await api<GuidedWorkflow>(
        `/api/workspaces/${workspace.id}/guided-workflows`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceArtifactId: source.id,
            optical,
            ...(optical ? { ocrAutoAcceptConfidence: ocrAutoAcceptConfidence / 100 } : {}),
            preservationPolicy,
            performanceBrief,
          }),
        }
      );
      activeWorkflow = workflow;
      activeWorkflow = await continueGuidedWorkflow(
        dialog,
        workflow,
        targetConfigurations,
        options.onComplete
      );
      status.textContent =
        "Arrangement ready. The source, analysis, candidates, audit, and deliverables are saved locally.";
      window.setTimeout(() => dialog.close(), 900);
    } catch (error) {
      if (activeWorkflow && activeWorkflow.status !== "complete") {
        const code = error instanceof VellumApiError ? error.code : "workflow_interrupted";
        try {
          activeWorkflow = await api<GuidedWorkflow>(
            `/api/workspaces/${activeWorkflow.workspaceId}/guided-workflows/${activeWorkflow.id}/interrupt`,
            { method: "POST", body: JSON.stringify({ code }) }
          );
        } catch {
          // Preserve the original failure; recovery discovery will query persisted state.
        }
      }
      status.textContent =
        error instanceof Error ? error.message : "The arrangement could not be started.";
      status.dataset.error = "true";
      if (activeWorkspaceId) {
        await refreshModelActionRecovery(dialog, activeWorkspaceId);
        await refreshGuidedWorkflowRecovery(dialog, activeWorkspaceId, options.onComplete);
      }
    } finally {
      submit.disabled = false;
    }
  });

  if (!localStorage.getItem("vellum.guided-start.seen")) {
    localStorage.setItem("vellum.guided-start.seen", "true");
    dialog.showModal();
  }
}

export async function arrangeWithAnalysisReview<T>(
  dialog: HTMLDialogElement,
  workspaceId: string,
  url: string,
  init: RequestInit
): Promise<T> {
  while (true) {
    try {
      return await api<T>(url, init);
    } catch (error) {
      if (!(error instanceof VellumApiError) || error.code !== "analysis_review_required") {
        throw error;
      }
      const analysisId = error.details?.analysisRecordId;
      if (typeof analysisId !== "string") throw error;
      const analysis = await api<GuidedDeliverable["analysis"]>(
        `/api/workspaces/${workspaceId}/analyses/${analysisId}`
      );
      await presentAnalysisReview(dialog, workspaceId, analysis);
    }
  }
}

function presentAnalysisReview(
  dialog: HTMLDialogElement,
  workspaceId: string,
  analysis: GuidedDeliverable["analysis"]
): Promise<void> {
  const panel = dialog.querySelector<HTMLElement>("[data-analysis-review]")!;
  const question = panel.querySelector<HTMLElement>("[data-analysis-question]")!;
  const choices = panel.querySelector<HTMLElement>("[data-analysis-choices]")!;
  const cancel = panel.querySelector<HTMLButtonElement>("[data-analysis-cancel]")!;
  const ambiguity = analysis.ambiguities?.find((item) => item.critical && !item.resolution);
  const claim = analysis.claims.find((item) => item.id === ambiguity?.claimId);
  const alternatives = claim?.alternatives?.filter((item) => item.subjectIds?.length) ?? [];
  const recommendedSubjectIds = claim?.subjectIds ?? [];
  if (!ambiguity || !claim || recommendedSubjectIds.length === 0 || alternatives.length === 0) {
    throw new Error("Musicological review has no selectable analysis alternatives.");
  }
  panel.hidden = false;
  dialog.classList.add("review-active");
  setGuidedNavigationDisabled(dialog, true);
  question.textContent = ambiguity.question;
  choices.replaceChildren();
  return new Promise((resolve, reject) => {
    const finish = () => {
      panel.hidden = true;
      dialog.classList.remove("review-active");
      setGuidedNavigationDisabled(dialog, false);
      cancel.onclick = null;
    };
    cancel.onclick = () => {
      finish();
      reject(new Error("Arrangement stopped before musicological review was completed."));
    };
    const choicesToRender = [
      {
        statement: `Use recommended Principal Voice: ${claim.statement}`,
        subjectIds: recommendedSubjectIds,
        arrangementConsequence: "Accept Vellum's highest-ranked musicological inference.",
      },
      ...alternatives,
    ];
    for (const alternative of choicesToRender) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = alternative.statement;
      button.title = alternative.arrangementConsequence;
      button.addEventListener("click", async () => {
        choices.querySelectorAll("button").forEach((candidate) => {
          (candidate as HTMLButtonElement).disabled = true;
        });
        try {
          await api(
            `/api/workspaces/${workspaceId}/analyses/${analysis.id}/claims/${claim.id}/corrections`,
            {
              method: "POST",
              body: JSON.stringify({
                statement: alternative.statement,
                subjectIds: alternative.subjectIds,
                ...("id" in alternative ? { selectedAlternativeId: alternative.id } : {}),
                rationale: "Selected during Guided Start musicological review.",
              }),
            }
          );
          finish();
          resolve();
        } catch (error) {
          choices.querySelectorAll("button").forEach((candidate) => {
            (candidate as HTMLButtonElement).disabled = false;
          });
          reject(error);
        }
      });
      choices.append(button);
    }
  });
}

type WorkspaceNavigation = {
  workspace: { id: string; title: string; createdAt: string; updatedAt: string };
  families: Array<{
    id: string;
    updatedAt: string;
    arrangements: Array<{
      id: string;
      version: number;
      parentArrangementScoreId?: string;
      instrumentId: string;
      targetConfigurationId: string;
      branch?: { id: string; label: string };
      auditStatus: string;
      staleReason?: string;
      deliverables: Array<{ id: string; kind: string; notationLayout: string; sha256: string }>;
      createdAt: string;
    }>;
  }>;
};

export function installWorkspaceNavigator(): HTMLDialogElement {
  document.querySelector("#vellum-workspace-navigator")?.remove();
  document.querySelector("#workspace-navigator-launcher")?.remove();
  const launcher = document.createElement("button");
  launcher.id = "workspace-navigator-launcher";
  launcher.type = "button";
  launcher.textContent = "Projects";
  const dialog = document.createElement("dialog");
  dialog.id = "vellum-workspace-navigator";
  dialog.className = "workspace-navigator";
  const heading = document.createElement("h2");
  heading.textContent = "Arrangement Workspaces";
  const explanation = document.createElement("p");
  explanation.textContent =
    "Open an exact immutable score version with its saved deliverables, literal preview, audit, and lineage.";
  const status = document.createElement("p");
  const content = document.createElement("div");
  content.className = "workspace-navigation-list";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  dialog.append(heading, explanation, status, content, close);
  globalLauncherBar().append(launcher);
  document.body.append(dialog);

  const refresh = async () => {
    status.textContent = "Loading local projects…";
    content.replaceChildren();
    const workspaces =
      await api<Array<{ id: string; title: string; updatedAt: string }>>("/api/workspaces");
    const navigation = await Promise.all(
      [...workspaces]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((workspace) => api<WorkspaceNavigation>(`/api/workspaces/${workspace.id}/navigation`))
    );
    status.textContent = navigation.length
      ? `${navigation.length} local workspace${navigation.length === 1 ? "" : "s"}`
      : "No saved workspaces yet.";
    for (const item of navigation) {
      const workspace = document.createElement("section");
      workspace.className = "workspace-navigation-item";
      const title = document.createElement("h3");
      title.textContent = item.workspace.title;
      const meta = document.createElement("p");
      meta.textContent = `${item.workspace.id} · updated ${new Date(item.workspace.updatedAt).toLocaleString()}`;
      const rename = document.createElement("button");
      rename.type = "button";
      rename.textContent = "Rename";
      rename.addEventListener("click", async () => {
        const next = window.prompt("Workspace title", item.workspace.title)?.trim();
        if (!next || next === item.workspace.title) return;
        await api(`/api/workspaces/${item.workspace.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: next }),
        });
        await refresh();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove local workspace";
      remove.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Permanently remove “${item.workspace.title}” and every local version and deliverable?`
          )
        )
          return;
        await api(`/api/workspaces/${item.workspace.id}`, {
          method: "DELETE",
          body: JSON.stringify({ confirmation: item.workspace.id }),
        });
        if (localStorage.getItem("vellum.active-workspace") === item.workspace.id)
          localStorage.removeItem("vellum.active-workspace");
        await refresh();
      });
      workspace.append(title, meta, rename, remove);
      for (const family of item.families) {
        const familyDetails = document.createElement("details");
        familyDetails.open = true;
        const familySummary = document.createElement("summary");
        const targets = new Set(family.arrangements.map((arrangement) => arrangement.instrumentId));
        familySummary.textContent = `Arrangement Family · ${targets.size} target${targets.size === 1 ? "" : "s"} · ${family.arrangements.length} version${family.arrangements.length === 1 ? "" : "s"}`;
        familyDetails.append(familySummary);
        const arrangements = [...family.arrangements].sort(
          (left, right) =>
            left.instrumentId.localeCompare(right.instrumentId) || right.version - left.version
        );
        for (const arrangement of arrangements) {
          const row = document.createElement("article");
          row.className = "workspace-arrangement-version";
          if (!arrangement.parentArrangementScoreId) row.classList.add("root-version");
          const label = document.createElement("strong");
          label.textContent = `${arrangement.instrumentId} · v${arrangement.version}${arrangement.branch ? ` · ${arrangement.branch.label}` : " · main line"}`;
          const evidence = document.createElement("span");
          evidence.textContent = [
            `audit ${arrangement.auditStatus}`,
            arrangement.staleReason ? `STALE: ${arrangement.staleReason}` : "current evidence",
            `${arrangement.deliverables.length} saved deliverables`,
            ...arrangement.deliverables.map(
              (deliverable) => `${deliverable.kind} ${deliverable.sha256.slice(0, 10)}`
            ),
          ].join(" · ");
          const open = document.createElement("button");
          open.type = "button";
          open.textContent = `Open exact v${arrangement.version}`;
          open.addEventListener("click", () => {
            localStorage.setItem("vellum.active-workspace", item.workspace.id);
            document.dispatchEvent(
              new CustomEvent("vellum-open-arrangement-version", {
                detail: {
                  workspaceId: item.workspace.id,
                  arrangementScoreId: arrangement.id,
                  comparisonArrangementScoreId: arrangement.parentArrangementScoreId,
                },
              })
            );
            dialog.close();
          });
          row.append(label, evidence, open);
          familyDetails.append(row);
        }
        workspace.append(familyDetails);
      }
      content.append(workspace);
    }
  };
  launcher.addEventListener("click", () => {
    dialog.showModal();
    void refresh().catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : "Could not load projects.";
    });
  });
  return dialog;
}

export async function proposeSelectionDefault(
  deliverable: GuidedDeliverable,
  selectedEvents: ArrangementEvent[]
): Promise<void> {
  const dimension = window
    .prompt("Default dimension (for example tuning, stringing, or fingering_style)")
    ?.trim();
  if (!dimension) return;
  const rawValue = window.prompt("Proposed default value")?.trim();
  if (!rawValue) return;
  const value = parseOwnerValue(rawValue);
  const scope = {
    instrument: deliverable.targetConfiguration.instrumentId,
    arrangementFamilyId: deliverable.arrangementFamilyId,
    measureIds: Array.from(new Set(selectedEvents.map((event) => event.measureId))).join(","),
  };
  const choice = await api<{ choice: { id: string } }>("/api/owner/choices", {
    method: "POST",
    body: JSON.stringify({
      workspaceId: deliverable.workspaceId,
      dimension,
      value,
      scope,
    }),
  });
  await api("/api/owner/personal-default-candidates", {
    method: "POST",
    body: JSON.stringify({
      dimension,
      value,
      scope,
      evidenceChoiceIds: [choice.choice.id],
    }),
  });
  window.alert("Proposed for review. Nothing was learned or applied automatically.");
}

type OwnerState = {
  personalDefaultCandidates: Array<{
    id: string;
    dimension: string;
    value: unknown;
    scope: Record<string, string>;
    evidenceChoiceIds: string[];
    status: string;
  }>;
  personalDefaults: Array<{
    id: string;
    dimension: string;
    value: unknown;
    scope: Record<string, string>;
    status: string;
  }>;
  ownerReferences: Array<{ id: string; title: string; citation: string; sha256: string }>;
  knowledgeCandidates: Array<{
    id: string;
    statement: string;
    scope: Record<string, string>;
    referenceId: string;
    citationLocator: string;
    status: string;
  }>;
  historicalPracticeClaims: Array<{
    id: string;
    statement: string;
    scope: Record<string, string>;
    authority: string;
    referenceId: string;
    citationLocator: string;
    confidence?: number;
    status?: string;
  }>;
};

const OWNER_REFERENCE_MIGRATION_STRICT = { additionalProperties: false } as const;
const OwnerReferenceMigrationSafeIdSchema = Type.String({
  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$",
});
const OwnerReferenceMigrationDigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const OwnerReferenceMigrationRevisionSchema = Type.Integer({ minimum: 1 });
const OwnerReferenceUploadRecordRefSchema = Type.Object(
  {
    id: OwnerReferenceMigrationSafeIdSchema,
    digest: OwnerReferenceMigrationDigestSchema,
  },
  OWNER_REFERENCE_MIGRATION_STRICT
);
const OwnerReferenceUploadIngestResultSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    publicationState: Type.Literal("staging_only"),
    replayed: Type.Boolean(),
    digitalAsset: Type.Object(
      {
        recordKind: Type.Literal("digital_asset"),
        id: OwnerReferenceMigrationSafeIdSchema,
        sha256: OwnerReferenceMigrationDigestSchema,
        mediaType: Type.String({ minLength: 1 }),
        byteLength: Type.Integer({ minimum: 1 }),
        digest: OwnerReferenceMigrationDigestSchema,
      },
      OWNER_REFERENCE_MIGRATION_STRICT
    ),
    acquisition: Type.Object(
      {
        recordKind: Type.Literal("asset_acquisition"),
        id: OwnerReferenceMigrationSafeIdSchema,
        digitalAssetRef: OwnerReferenceUploadRecordRefSchema,
        representedExemplarRefs: Type.Array(OwnerReferenceUploadRecordRefSchema, {
          maxItems: 0,
        }),
        origin: Type.Object(
          {
            sourceKind: Type.Literal("upload"),
            ownerActionRef: OwnerReferenceUploadRecordRefSchema,
          },
          OWNER_REFERENCE_MIGRATION_STRICT
        ),
        acquiredAt: Type.String({
          pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
        }),
        rightsAssertionRefs: Type.Array(OwnerReferenceUploadRecordRefSchema, { maxItems: 0 }),
        processingPolicyRef: OwnerReferenceUploadRecordRefSchema,
        digest: OwnerReferenceMigrationDigestSchema,
      },
      OWNER_REFERENCE_MIGRATION_STRICT
    ),
    head: Type.Object(
      {
        snapshotId: OwnerReferenceMigrationSafeIdSchema,
        digest: OwnerReferenceMigrationDigestSchema,
        revision: Type.Integer({ minimum: 1 }),
      },
      OWNER_REFERENCE_MIGRATION_STRICT
    ),
  },
  OWNER_REFERENCE_MIGRATION_STRICT
);
const OwnerReferenceMigrationCapabilitiesSchema = Type.Object(
  {
    compatibilityReads: Type.Literal(true),
    canonicalWriter: Type.Literal(false),
    activation: Type.Literal(false),
  },
  OWNER_REFERENCE_MIGRATION_STRICT
);
const OwnerReferenceMigrationExpectedHeadSchema = Type.Union([
  Type.Object(
    {
      id: OwnerReferenceMigrationSafeIdSchema,
      digest: OwnerReferenceMigrationDigestSchema,
      revision: OwnerReferenceMigrationRevisionSchema,
    },
    OWNER_REFERENCE_MIGRATION_STRICT
  ),
  Type.Null(),
]);
const OwnerReferenceMigrationGraphHeadSchema = Type.Union([
  Type.Object(
    {
      snapshotId: OwnerReferenceMigrationSafeIdSchema,
      digest: OwnerReferenceMigrationDigestSchema,
      revision: Type.Integer({ minimum: 0 }),
    },
    OWNER_REFERENCE_MIGRATION_STRICT
  ),
  Type.Null(),
]);
const OwnerReferenceMigrationCompatibilityHeadSchema = Type.Union([
  Type.Object(
    {
      generationId: OwnerReferenceMigrationSafeIdSchema,
      digest: OwnerReferenceMigrationDigestSchema,
      revision: OwnerReferenceMigrationRevisionSchema,
    },
    OWNER_REFERENCE_MIGRATION_STRICT
  ),
  Type.Null(),
]);
const OwnerReferenceMigrationLegacySourceStateSchema = Type.Union([
  Type.Literal("verified"),
  Type.Literal("missing"),
  Type.Literal("diverged"),
  Type.Literal("unavailable"),
]);
const OwnerReferenceMigrationCompatibilitySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    publicationState: Type.Literal("migration_only"),
    head: OwnerReferenceMigrationCompatibilityHeadSchema,
    legacySourceState: OwnerReferenceMigrationLegacySourceStateSchema,
    ownerReferences: Type.Array(
      Type.Object(
        {
          legacyId: OwnerReferenceMigrationSafeIdSchema,
          state: Type.Union([
            Type.Literal("pending"),
            Type.Literal("mapped"),
            Type.Literal("quarantined"),
            Type.Literal("rolled_back"),
          ]),
          legacySourceState: OwnerReferenceMigrationLegacySourceStateSchema,
          mappingId: Type.Optional(OwnerReferenceMigrationSafeIdSchema),
          quarantineReason: Type.Optional(OwnerReferenceMigrationQuarantineReasonSchema),
        },
        OWNER_REFERENCE_MIGRATION_STRICT
      )
    ),
    capabilities: OwnerReferenceMigrationCapabilitiesSchema,
  },
  OWNER_REFERENCE_MIGRATION_STRICT
);
const OwnerReferenceMigrationPlanSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    mode: Type.Literal("dry_run"),
    planDigest: OwnerReferenceMigrationDigestSchema,
    expectedHead: OwnerReferenceMigrationExpectedHeadSchema,
    expectedGraphHead: OwnerReferenceMigrationGraphHeadSchema,
    writesPerformed: Type.Literal(false),
    mappings: Type.Array(
      Type.Object(
        {
          legacyId: OwnerReferenceMigrationSafeIdSchema,
          bibliographicIdentity: Type.Literal("not_asserted"),
          alreadyMapped: Type.Boolean(),
        },
        OWNER_REFERENCE_MIGRATION_STRICT
      )
    ),
    quarantines: Type.Array(
      Type.Object(
        {
          legacyId: OwnerReferenceMigrationSafeIdSchema,
          reason: OwnerReferenceMigrationQuarantineReasonSchema,
          action: OwnerReferenceMigrationQuarantineActionSchema,
        },
        OWNER_REFERENCE_MIGRATION_STRICT
      )
    ),
    capabilities: OwnerReferenceMigrationCapabilitiesSchema,
  },
  OWNER_REFERENCE_MIGRATION_STRICT
);

type OwnerReferenceMigrationCompatibility = Static<
  typeof OwnerReferenceMigrationCompatibilitySchema
>;
type OwnerReferenceMigrationPlan = Static<typeof OwnerReferenceMigrationPlanSchema>;
type OwnerReferenceMigrationExpectedHead = Static<typeof OwnerReferenceMigrationExpectedHeadSchema>;
type OwnerReferenceUploadIngestResult = Static<typeof OwnerReferenceUploadIngestResultSchema>;

type OwnerKnowledgeRefreshResult = {
  ownerReferenceSnapshot?: OwnerReferenceWorkbenchSnapshot;
};

type LocalIdiomKnowledgeSnapshot = {
  schemaVersion: 1;
  activeVersion: 1 | 2;
  activePack: {
    packId: string;
    version: number;
    authorityLane: string;
    domain: string;
    applicability: { instrumentFamily: string; technique: string };
    citation: { sourceId: string; locator: string; publicUrl?: string };
    consequence: {
      maximumSimultaneousAttacks: number;
      rightHandFingers: string[];
    };
  };
  candidate?: { status: string; proposition: string; activationAllowed: false };
  reviewed?: { reviewState: string; reviewedAt: string; rationale: string };
  bundledSource: {
    sha256: string;
    byteLength: number;
    repositoryPath: string;
    publicUrl: string;
  };
};

export function installOwnerKnowledgeWorkbench(): HTMLDialogElement {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");

  document.querySelector("#vellum-owner-workbench")?.remove();
  document.querySelector("#owner-workbench-launcher")?.remove();
  const launcher = document.createElement("button");
  launcher.id = "owner-workbench-launcher";
  launcher.type = "button";
  launcher.textContent = "Knowledge & defaults";
  const dialog = document.createElement("dialog");
  dialog.id = "vellum-owner-workbench";
  dialog.className = "owner-workbench";
  const heading = document.createElement("h2");
  heading.textContent = "Owner Knowledge and Personal Defaults";
  const intro = document.createElement("p");
  intro.textContent =
    "Candidates remain inert until approved. Every claim retains its source and scope; released records remain reproducible history but stop affecting future work.";
  const status = document.createElement("p");
  const content = document.createElement("div");
  content.className = "owner-workbench-content";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  dialog.append(heading, intro, status, content, close);
  globalLauncherBar().append(launcher);
  document.body.append(dialog);

  const mutate = async (url: string, method = "POST", body?: unknown) => {
    await api(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    await refresh();
  };
  const uploadPrivateReference = async (file: File) => {
    let mediaType: string;
    try {
      mediaType = privateReferenceMimeType(file);
      assertPrivateReferenceFileSize(file);
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("invalid_file");
    }
    let diagnostics: ReferenceSourceStagingDiagnostics;
    try {
      diagnostics = await api<ReferenceSourceStagingDiagnostics>(
        "/api/owner/reference-source-staging"
      );
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("preflight_unavailable");
    }
    const intent = await privateReferenceUploadIntent(file, mediaType);
    const headers: Record<string, string> = {
      "Content-Type": mediaType,
      "X-Reference-Acquisition-Key": intent.acquisitionKey,
    };
    if (diagnostics.head) {
      headers["X-Reference-Expected-Head-Id"] = diagnostics.head.snapshotId;
      headers["X-Reference-Expected-Head-Digest"] = diagnostics.head.digest;
    }
    let ingestInput: unknown;
    try {
      ingestInput = await api<unknown>("/api/owner/reference-source-staging/assets", {
        method: "POST",
        headers,
        body: file,
      });
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    }
    let confirmation: OwnerReferenceWorkbenchUploadConfirmationResult;
    try {
      await decodeOwnerReferenceUploadIngestResult(ingestInput, file, mediaType, intent);
      confirmation = Value.Decode(
        OwnerReferenceWorkbenchUploadConfirmationResultSchema,
        await api<unknown>("/api/owner/reference-source-workbench/upload-confirmation", {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: 1,
            acquisitionKey: intent.acquisitionKey,
          }),
        })
      );
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    }
    if (confirmation.status !== "present") {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    }
    let confirmedSnapshot: OwnerReferenceWorkbenchSnapshot;
    try {
      confirmedSnapshot = Value.Decode(
        OwnerReferenceWorkbenchSnapshotSchema,
        await api<unknown>("/api/owner/reference-source-workbench")
      );
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    }
    const confirmedCard = confirmedSnapshot.references.find(
      ({ cardRef }) =>
        cardRef.id === confirmation.cardRef.id && cardRef.digest === confirmation.cardRef.digest
    );
    if (
      confirmedSnapshot.snapshotRef.id !== confirmation.snapshotRef.id ||
      confirmedSnapshot.snapshotRef.digest !== confirmation.snapshotRef.digest ||
      !confirmedCard ||
      confirmedCard.origin !== "upload"
    ) {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    }
    try {
      await refresh(confirmedSnapshot);
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("outcome_uncertain");
    }
    await retirePrivateReferenceUploadIntent(intent);
  };
  const reviewPrivateReferenceLocalOperation = (
    request: OwnerReferenceWorkbenchLocalOperationReviewRequest
  ) =>
    api<OwnerReferenceWorkbenchLocalOperationReviewResult>(
      "/api/owner/reference-source-workbench/local-operation-review",
      { method: "POST", body: JSON.stringify(request) }
    );
  const studyPrivateReference = async (
    input: OwnerReferenceWorkbenchLocalStudyInput
  ): Promise<OwnerReferenceWorkbenchLocalStudyResult> => {
    const intent = await privateReferenceLocalStudyIntent(input);
    const request = Value.Decode(OwnerReferenceWorkbenchLocalStudyRequestSchema, {
      schemaVersion: 1,
      snapshotRef: intent.snapshotRef,
      cardRef: intent.cardRef,
      operation: "owner_private_study",
      purpose: input.purpose,
      authorization: "owner_attested_local_study",
      operationKey: intent.operationKey,
    } satisfies OwnerReferenceWorkbenchLocalStudyRequest);
    let result: Omit<OwnerReferenceWorkbenchLocalStudyResult, "workbenchRefresh">;
    try {
      result = await fetchPrivateReferenceLocalStudy(request);
    } catch (error) {
      if (
        error instanceof OwnerReferenceWorkbenchLocalStudyError &&
        error.kind === "stale_before_commit"
      ) {
        try {
          const refreshed = await refresh();
          const currentSnapshot = refreshed.ownerReferenceSnapshot;
          const currentCard = currentSnapshot?.references.find(
            ({ cardRef }) =>
              cardRef.id === input.cardRef.id && cardRef.digest === input.cardRef.digest
          );
          if (currentSnapshot && currentCard) {
            await rebindPrivateReferenceLocalStudyIntent(
              intent,
              currentSnapshot.snapshotRef,
              currentCard.cardRef,
              input.purpose
            );
            status.textContent =
              "Private reference state refreshed after a proven pre-commit stale response. Review the current card before retrying; its operation key was retained.";
          }
        } catch {
          status.textContent =
            "Private reference state changed before local study and could not be refreshed. No preview was opened; reload before retrying.";
        }
      }
      throw error;
    }
    await retirePrivateReferenceLocalStudyIntent(intent);
    try {
      const refreshed = await refresh();
      if (!refreshed.ownerReferenceSnapshot) throw new Error("Workbench refresh unavailable");
      return { ...result, workbenchRefresh: "current" };
    } catch {
      status.textContent =
        "Local study authorization succeeded, but the Owner Reference Library could not refresh. The operation key was retired; refresh before another operation.";
      return { ...result, workbenchRefresh: "failed" };
    }
  };
  const extractPrivateReference = (input: OwnerReferenceWorkbenchLocalStudyInput): void => {
    const operate = (request: unknown, signal?: AbortSignal) =>
      api<unknown>("/api/owner/reference-source-workbench/page-atlas", {
        method: "POST",
        body: JSON.stringify(request),
        ...(signal ? { signal } : {}),
      });
    openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: input.snapshotRef,
        workbenchCardRef: input.cardRef,
        initialPurpose: input.purpose,
      },
      {
        start: operate,
        read: operate,
        resume: operate,
        cancel: operate,
        correctMapping: operate,
        preview: fetchPrivateReferencePageAtlasPreview,
        typedKnowledgeRelease: {
          operate: (request, signal) =>
            api<unknown>("/api/owner/reference-source-workbench/typed-knowledge-release", {
              method: "POST",
              body: JSON.stringify(request),
              ...(signal ? { signal } : {}),
            }),
        },
      }
    );
  };
  const refresh = async (
    confirmedOwnerReferenceSnapshot?: OwnerReferenceWorkbenchSnapshot
  ): Promise<OwnerKnowledgeRefreshResult> => {
    const state = await api<OwnerState>("/api/owner");
    const idiomKnowledge = await api<LocalIdiomKnowledgeSnapshot>("/api/owner/idiom-knowledge");
    const result: OwnerKnowledgeRefreshResult = {};
    content.replaceChildren();
    status.textContent = `${state.historicalPracticeClaims.length} reviewed claims · ${state.personalDefaults.filter((item) => item.status === "active").length} active defaults`;
    const section = (title: string) => {
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = title;
      details.append(summary);
      content.append(details);
      return details;
    };
    const claims = section("Reviewed Historical Practice Claims");
    for (const claim of state.historicalPracticeClaims) {
      const reference = state.ownerReferences.find((item) => item.id === claim.referenceId);
      const row = ownerRecord(
        claim.statement,
        `${claim.authority} · confidence ${formatReferenceIdentityConfidence(claim.confidence)} · ${claim.status ?? "active"} · scope ${JSON.stringify(claim.scope)} · ${reference?.title ?? claim.referenceId}, ${claim.citationLocator} · ${reference?.citation ?? "citation unavailable"}`
      );
      if ((claim.status ?? "active") === "active")
        row.append(
          ownerButton("Release claim", () =>
            mutate(`/api/owner/historical-practice-claims/${claim.id}/release`)
          )
        );
      claims.append(row);
    }
    const idioms = section("Instrument idioms");
    const applied = idiomKnowledge.activePack;
    const summary = ownerRecord(
      `Five-course baroque guitar · punteado · Knowledge Pack v${applied.version} active`,
      `Allows ${applied.consequence.maximumSimultaneousAttacks} simultaneous attacks with ${applied.consequence.rightHandFingers.join("-")} · ${applied.authorityLane} · ${applied.citation.locator}`
    );
    const expert = document.createElement("details");
    const expertSummary = document.createElement("summary");
    expertSummary.textContent = "Citation and expert details";
    const expertText = document.createElement("p");
    expertText.textContent = `${applied.citation.sourceId} · scope ${JSON.stringify(applied.applicability)} · domain ${applied.domain} · source ${idiomKnowledge.bundledSource.repositoryPath} · SHA-256 ${idiomKnowledge.bundledSource.sha256}`;
    expert.append(expertSummary, expertText);
    const sourceUrl = applied.citation.publicUrl ?? idiomKnowledge.bundledSource.publicUrl;
    if (sourceUrl) {
      const sourceLink = document.createElement("a");
      sourceLink.href = sourceUrl;
      sourceLink.target = "_blank";
      sourceLink.rel = "noreferrer";
      sourceLink.textContent = "Open bundled public source record";
      expert.append(sourceLink);
    }
    summary.append(expert);
    idioms.append(summary);
    if (!idiomKnowledge.candidate) {
      idioms.append(
        ownerButton("Extract bundled Sanz excerpt", () =>
          mutate("/api/owner/idiom-knowledge/extract-bundled-sanz")
        )
      );
    } else if (!idiomKnowledge.reviewed) {
      idioms.append(
        ownerRecord(
          idiomKnowledge.candidate.proposition,
          "Proposed only · cannot affect arrangements before explicit Owner review"
        ),
        ownerButton("Review candidate", async () => {
          const rationale = window
            .prompt(
              "Why should this cited rule affect Vellum's five-course-guitar compiler?",
              "The cited primary source explicitly permits a fourth right-hand finger when a fourth voice requires it."
            )
            ?.trim();
          if (!rationale) return;
          await mutate("/api/owner/idiom-knowledge/review", "POST", { rationale });
        })
      );
    } else {
      const alternate = idiomKnowledge.activeVersion === 1 ? 2 : 1;
      idioms.append(
        ownerButton(`Use Knowledge Pack v${alternate}`, () =>
          mutate("/api/owner/idiom-knowledge/activate", "POST", { version: alternate })
        )
      );
    }
    const knowledge = section("Knowledge Candidates");
    for (const candidate of state.knowledgeCandidates) {
      const reference = state.ownerReferences.find((item) => item.id === candidate.referenceId);
      const row = ownerRecord(
        candidate.statement,
        `${candidate.status} · scope ${JSON.stringify(candidate.scope)} · ${reference?.title ?? candidate.referenceId}, ${candidate.citationLocator}`
      );
      if (candidate.status === "proposed") {
        row.append(
          ownerButton("Approve", async () => {
            const authority =
              window.prompt(
                "Authority: documented_practice, modern_editorial_convention, or vellum_heuristic",
                "documented_practice"
              ) ?? "documented_practice";
            await mutate("/api/owner/knowledge-promotions", "POST", {
              candidateId: candidate.id,
              packId: "knowledge-pack.owner-reviewed",
              packName: "Owner-reviewed practice",
              authority,
            });
          }),
          ownerButton("Correct", async () => {
            const statement = window.prompt("Corrected claim", candidate.statement)?.trim();
            if (!statement) return;
            await mutate(`/api/owner/knowledge-candidates/${candidate.id}`, "PATCH", {
              statement,
              scope: candidate.scope,
              citationLocator: candidate.citationLocator,
            });
          }),
          ownerButton("Reject", () =>
            mutate(`/api/owner/knowledge-candidates/${candidate.id}/reject`)
          )
        );
      }
      knowledge.append(row);
    }
    const defaults = section("Personal Default Candidates and Applications");
    for (const candidate of state.personalDefaultCandidates) {
      const row = ownerRecord(
        `${candidate.dimension} = ${JSON.stringify(candidate.value)}`,
        `${candidate.status} · scope ${JSON.stringify(candidate.scope)} · evidence ${candidate.evidenceChoiceIds.join(", ")}`
      );
      if (candidate.status === "proposed") {
        row.append(
          ownerButton("Approve", () =>
            mutate(`/api/owner/personal-default-candidates/${candidate.id}/approve`)
          ),
          ownerButton("Correct", async () => {
            const value = window.prompt("Corrected value", JSON.stringify(candidate.value));
            if (value === null) return;
            await mutate(`/api/owner/personal-default-candidates/${candidate.id}`, "PATCH", {
              dimension: candidate.dimension,
              value: parseOwnerValue(value),
              scope: candidate.scope,
            });
          }),
          ownerButton("Reject", () =>
            mutate(`/api/owner/personal-default-candidates/${candidate.id}/reject`)
          )
        );
      }
      defaults.append(row);
    }
    for (const record of state.personalDefaults) {
      const row = ownerRecord(
        `${record.dimension} = ${JSON.stringify(record.value)}`,
        `${record.status} · scope ${JSON.stringify(record.scope)}`
      );
      if (record.status === "active")
        row.append(
          ownerButton("Release default", () =>
            mutate(`/api/owner/personal-defaults/${record.id}/release`)
          )
        );
      defaults.append(row);
    }
    const referenceLibrary = section("Owner Reference Library — private staging");
    referenceLibrary.className = "owner-reference-library-section";
    const referenceLibraryWorkbench = document.createElement("div");
    referenceLibrary.append(referenceLibraryWorkbench);
    try {
      const [snapshot, compatibility] = await Promise.all([
        confirmedOwnerReferenceSnapshot ??
          api<OwnerReferenceWorkbenchSnapshot>("/api/owner/reference-source-workbench"),
        api<unknown>("/api/owner/reference-migrations/owner-references").then(
          decodeOwnerReferenceMigrationCompatibility
        ),
      ]);
      result.ownerReferenceSnapshot = snapshot;
      renderOwnerReferenceWorkbench(
        referenceLibraryWorkbench,
        snapshot,
        uploadPrivateReference,
        reviewPrivateReferenceLocalOperation,
        resetPrivateReferenceUploadRetryState,
        studyPrivateReference,
        extractPrivateReference
      );
      const libraryRoot = referenceLibraryWorkbench.querySelector<HTMLElement>(
        ".owner-reference-library-workbench"
      );
      libraryRoot?.append(renderOwnerReferenceMigrationControls(compatibility, refresh));
    } catch {
      referenceLibraryWorkbench.textContent =
        "Private reference library unavailable. Private diagnostics are withheld; refresh and retry.";
    }
    const referenceSources = section("Reference sources — staging diagnostics");
    referenceSources.className = "reference-source-staging-section";
    const referenceSourceDiagnostics = document.createElement("div");
    referenceSources.append(referenceSourceDiagnostics);
    try {
      const diagnostics = await api<ReferenceSourceStagingDiagnostics>(
        "/api/owner/reference-source-staging"
      );
      renderPrivateReferenceStagingSummary(referenceSourceDiagnostics, diagnostics);
      renderReferenceSourceLifecycleDryRun(referenceSourceDiagnostics, diagnostics, (request) =>
        api("/api/owner/reference-source-staging/lifecycle/plan", {
          method: "POST",
          body: JSON.stringify(request),
        })
      );
    } catch {
      renderPrivateReferenceStagingSummary(referenceSourceDiagnostics, undefined);
    }
    const publicationGenerations = section("Knowledge library — transactional publications");
    publicationGenerations.className = "knowledge-publication-section";
    const publicationWorkbench = document.createElement("div");
    publicationGenerations.append(publicationWorkbench);
    try {
      const publicationState = await api<KnowledgePublicationWorkbenchState>(
        "/api/owner/knowledge-publication"
      );
      renderKnowledgePublicationWorkbench(
        publicationWorkbench,
        publicationState,
        async (generationId) => {
          await api(`/api/owner/knowledge-publication/orphans/${generationId}`, {
            method: "DELETE",
          });
          await refresh();
        }
      );
    } catch (error) {
      publicationWorkbench.textContent =
        error instanceof Error
          ? `Publication generations unavailable: ${error.message}`
          : "Publication generations unavailable.";
    }
    const reviewerAuthority = section("Reviewer authority — external verification");
    reviewerAuthority.className = "reviewer-authority-section";
    const reviewerAuthorityWorkbench = document.createElement("div");
    reviewerAuthority.append(reviewerAuthorityWorkbench);
    try {
      const reviewerAuthorityState = await api<unknown>("/api/owner/reviewer-authority");
      renderReviewerAuthorityWorkbench(reviewerAuthorityWorkbench, reviewerAuthorityState);
    } catch (error) {
      reviewerAuthorityWorkbench.textContent =
        error instanceof Error
          ? `Reviewer authority unavailable: ${error.message}`
          : "Reviewer authority unavailable.";
    }
    const knowledgeResolution = section("Applied knowledge — exact resolution");
    knowledgeResolution.className = "knowledge-resolution-section";
    const knowledgeResolutionWorkbench = document.createElement("div");
    knowledgeResolution.append(knowledgeResolutionWorkbench);
    const renderResolution = (projection: unknown) => {
      renderKnowledgeResolutionWorkbench(
        knowledgeResolutionWorkbench,
        projection,
        async (selectedMode, expectedHead) => {
          const updated = await api<unknown>("/api/owner/knowledge-resolution", {
            method: "POST",
            body: JSON.stringify({
              schemaVersion: 1,
              mode: selectedMode,
              ...(expectedHead ? { expectedHead } : {}),
            }),
          });
          if (expectedHead) {
            const refreshed = await api<unknown>("/api/owner/knowledge-resolution", {
              method: "POST",
              body: JSON.stringify({ schemaVersion: 1, mode: selectedMode }),
            });
            renderResolution(refreshed);
          } else {
            renderResolution(updated);
          }
        }
      );
    };
    const loadKnowledgeResolution = async (mode = "ordinary_default") => {
      const request =
        mode === "ordinary_default"
          ? api<unknown>("/api/owner/knowledge-resolution")
          : api<unknown>("/api/owner/knowledge-resolution", {
              method: "POST",
              body: JSON.stringify({ schemaVersion: 1, mode }),
            });
      const projection = await request;
      renderResolution(projection);
    };
    try {
      await loadKnowledgeResolution();
    } catch (error) {
      knowledgeResolutionWorkbench.textContent =
        error instanceof Error
          ? `Knowledge resolution unavailable: ${error.message}`
          : "Knowledge resolution unavailable.";
    }
    const resolverCutover = section("Resolver authority — transactional cutover");
    resolverCutover.className = "knowledge-resolver-cutover-section";
    const resolverCutoverWorkbench = document.createElement("div");
    resolverCutover.append(resolverCutoverWorkbench);
    const renderResolverCutover = (state: unknown) =>
      renderKnowledgeResolverCutoverWorkbench(resolverCutoverWorkbench, state, async (operation) =>
        api<unknown>("/api/owner/knowledge-resolver-cutover", {
          method: "POST",
          body: JSON.stringify({ schemaVersion: 1, ...operation }),
        })
      );
    try {
      renderResolverCutover(await api<unknown>("/api/owner/knowledge-resolver-cutover"));
    } catch (error) {
      resolverCutoverWorkbench.textContent =
        error instanceof Error
          ? `Resolver cutover unavailable: ${error.message}`
          : "Resolver cutover unavailable.";
    }
    return result;
  };
  launcher.addEventListener("click", () => {
    dialog.showModal();
    void refresh().catch((error: unknown) => {
      status.textContent = error instanceof Error ? error.message : "Could not load owner records.";
    });
  });
  return dialog;
}

type PrivateReferenceUploadIntent = Readonly<{
  fingerprint: string;
  acquisitionKey: string;
}>;

type PrivateReferenceUploadPendingState = {
  schemaVersion: 1;
  intents: PrivateReferenceUploadIntent[];
};

type PrivateReferenceLocalStudyIntent = Readonly<{
  fingerprint: string;
  operationKey: string;
  snapshotRef: OwnerReferenceWorkbenchSnapshot["snapshotRef"];
  cardRef: OwnerReferenceWorkbenchLocalStudyInput["cardRef"];
}>;

type PrivateReferenceLocalStudyPendingState = {
  schemaVersion: 1;
  intents: PrivateReferenceLocalStudyIntent[];
};

const PRIVATE_REFERENCE_LOCAL_STUDY_MEDIA_TYPES = new Set<
  OwnerReferenceWorkbenchLocalStudyResult["mediaType"]
>([
  "application/pdf",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

async function privateReferenceLocalStudyIntent(
  input: OwnerReferenceWorkbenchLocalStudyInput
): Promise<PrivateReferenceLocalStudyIntent> {
  return withPrivateReferenceLocalStudyLock(async () => {
    const fingerprint = await privateReferenceLocalStudyFingerprint(input.cardRef, input.purpose);
    const pending = readPrivateReferenceLocalStudyPendingState();
    const existing = pending.intents.find((intent) => intent.fingerprint === fingerprint);
    if (existing) return existing;
    if (pending.intents.length >= OWNER_REFERENCE_LOCAL_STUDY_MAX_PENDING) {
      throw new OwnerReferenceWorkbenchLocalStudyError("pending_limit");
    }
    const intent = Object.freeze({
      fingerprint,
      operationKey: `owner-local-study.v1.${base64UrlEncode(
        window.crypto.getRandomValues(new Uint8Array(OWNER_REFERENCE_LOCAL_STUDY_KEY_BYTES))
      )}`,
      snapshotRef: Object.freeze({ ...input.snapshotRef }),
      cardRef: Object.freeze({ ...input.cardRef }),
    });
    writePrivateReferenceLocalStudyPendingState({
      schemaVersion: 1,
      intents: [...pending.intents, intent],
    });
    return intent;
  });
}

async function rebindPrivateReferenceLocalStudyIntent(
  previous: PrivateReferenceLocalStudyIntent,
  snapshotRef: OwnerReferenceWorkbenchSnapshot["snapshotRef"],
  cardRef: OwnerReferenceWorkbenchLocalStudyInput["cardRef"],
  purpose: string
): Promise<void> {
  const fingerprint = await privateReferenceLocalStudyFingerprint(cardRef, purpose);
  await withPrivateReferenceLocalStudyLock(() => {
    const pending = readPrivateReferenceLocalStudyPendingState();
    const index = pending.intents.findIndex(
      (intent) =>
        intent.fingerprint === previous.fingerprint &&
        intent.operationKey === previous.operationKey &&
        refsEqualInBrowser(intent.snapshotRef, previous.snapshotRef) &&
        refsEqualInBrowser(intent.cardRef, previous.cardRef)
    );
    if (index < 0) {
      throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
    }
    if (
      pending.intents.some(
        (intent, candidateIndex) =>
          candidateIndex !== index &&
          (intent.fingerprint === fingerprint || intent.operationKey === previous.operationKey)
      )
    ) {
      throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
    }
    const rebound = Object.freeze({
      fingerprint,
      operationKey: previous.operationKey,
      snapshotRef: Object.freeze({ ...snapshotRef }),
      cardRef: Object.freeze({ ...cardRef }),
    });
    const intents = [...pending.intents];
    intents[index] = rebound;
    writePrivateReferenceLocalStudyPendingState({ schemaVersion: 1, intents });
  });
}

async function retirePrivateReferenceLocalStudyIntent(
  completed: PrivateReferenceLocalStudyIntent
): Promise<void> {
  await withPrivateReferenceLocalStudyLock(() => {
    const pending = readPrivateReferenceLocalStudyPendingState();
    const exact = pending.intents.filter(
      (intent) =>
        intent.fingerprint === completed.fingerprint &&
        intent.operationKey === completed.operationKey &&
        refsEqualInBrowser(intent.snapshotRef, completed.snapshotRef) &&
        refsEqualInBrowser(intent.cardRef, completed.cardRef)
    );
    if (exact.length === 0) {
      const conflicting = pending.intents.some(
        (intent) =>
          intent.fingerprint === completed.fingerprint ||
          intent.operationKey === completed.operationKey
      );
      if (!conflicting) return;
    }
    if (exact.length !== 1) {
      throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
    }
    writePrivateReferenceLocalStudyPendingState({
      schemaVersion: 1,
      intents: pending.intents.filter((intent) => intent !== exact[0]),
    });
  });
}

async function privateReferenceLocalStudyFingerprint(
  cardRef: OwnerReferenceWorkbenchLocalStudyInput["cardRef"],
  purpose: string
): Promise<string> {
  const rawKey = privateReferenceLocalStudyHmacKey();
  const key = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const message = new TextEncoder().encode(
    JSON.stringify([
      "vellum.owner-reference-local-study-fingerprint.v1",
      cardRef.id,
      cardRef.digest,
      purpose,
    ])
  );
  const commitment = new Uint8Array(await window.crypto.subtle.sign("HMAC", key, message));
  return `local-study-scope.v1.${base64UrlEncode(commitment)}`;
}

async function withPrivateReferenceLocalStudyLock<T>(operation: () => T | Promise<T>): Promise<T> {
  const locks = window.navigator.locks;
  if (!locks) {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_protection_unavailable");
  }
  return locks.request(OWNER_REFERENCE_LOCAL_STUDY_LOCK, { mode: "exclusive" }, operation);
}

function readPrivateReferenceLocalStudyPendingState(): PrivateReferenceLocalStudyPendingState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(OWNER_REFERENCE_LOCAL_STUDY_PENDING_STORAGE);
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_protection_unavailable");
  }
  if (raw === null) return { schemaVersion: 1, intents: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
  }
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "intents"])) {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
  }
  if (value.schemaVersion !== 1 || !Array.isArray(value.intents)) {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
  }
  const intents = value.intents.map((entry) => {
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ["fingerprint", "operationKey", "snapshotRef", "cardRef"]) ||
      typeof entry.fingerprint !== "string" ||
      !/^local-study-scope\.v1\.[A-Za-z0-9_-]{43}$/u.test(entry.fingerprint) ||
      typeof entry.operationKey !== "string" ||
      !/^owner-local-study\.v1\.[A-Za-z0-9_-]{21}[AQgw]$/u.test(entry.operationKey) ||
      !isOpaqueBrowserRef(entry.snapshotRef) ||
      !isOpaqueBrowserRef(entry.cardRef)
    ) {
      throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
    }
    return Object.freeze({
      fingerprint: entry.fingerprint,
      operationKey: entry.operationKey,
      snapshotRef: Object.freeze({ ...entry.snapshotRef }),
      cardRef: Object.freeze({ ...entry.cardRef }),
    });
  });
  if (
    intents.length > OWNER_REFERENCE_LOCAL_STUDY_MAX_PENDING ||
    new Set(intents.map(({ fingerprint }) => fingerprint)).size !== intents.length ||
    new Set(intents.map(({ operationKey }) => operationKey)).size !== intents.length
  ) {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
  }
  return { schemaVersion: 1, intents };
}

function writePrivateReferenceLocalStudyPendingState(
  state: PrivateReferenceLocalStudyPendingState
): void {
  const encoded = JSON.stringify(state);
  try {
    window.localStorage.setItem(OWNER_REFERENCE_LOCAL_STUDY_PENDING_STORAGE, encoded);
    if (window.localStorage.getItem(OWNER_REFERENCE_LOCAL_STUDY_PENDING_STORAGE) !== encoded) {
      throw new Error("Browser-local study retry state did not persist");
    }
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_protection_unavailable");
  }
}

function privateReferenceLocalStudyHmacKey(): Uint8Array<ArrayBuffer> {
  let stored: string | null;
  let pending: string | null;
  try {
    stored = window.localStorage.getItem(OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_STORAGE);
    pending = window.localStorage.getItem(OWNER_REFERENCE_LOCAL_STUDY_PENDING_STORAGE);
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_protection_unavailable");
  }
  if (stored !== null) {
    const decoded = base64UrlDecode(stored);
    if (decoded?.byteLength !== OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_BYTES) {
      throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
    }
    return decoded;
  }
  if (pending !== null && pending !== '{"schemaVersion":1,"intents":[]}') {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_state_invalid");
  }
  const generated = window.crypto.getRandomValues(
    new Uint8Array(OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_BYTES)
  );
  const encoded = base64UrlEncode(generated);
  try {
    window.localStorage.setItem(OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_STORAGE, encoded);
    const persisted = window.localStorage.getItem(OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_STORAGE);
    const decoded = persisted ? base64UrlDecode(persisted) : null;
    if (decoded?.byteLength !== OWNER_REFERENCE_LOCAL_STUDY_HMAC_KEY_BYTES) {
      throw new Error("Browser-local local-study retry key did not persist");
    }
    return decoded;
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("retry_protection_unavailable");
  }
}

function isOpaqueBrowserRef(value: unknown): value is { id: string; digest: string } {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "digest"]) &&
    typeof value.id === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(value.id) &&
    typeof value.digest === "string" &&
    /^[a-f0-9]{64}$/u.test(value.digest)
  );
}

function refsEqualInBrowser(
  left: { id: string; digest: string },
  right: { id: string; digest: string }
): boolean {
  return left.id === right.id && left.digest === right.digest;
}

async function fetchPrivateReferenceLocalStudy(
  request: OwnerReferenceWorkbenchLocalStudyRequest
): Promise<Omit<OwnerReferenceWorkbenchLocalStudyResult, "workbenchRefresh">> {
  let response: Response;
  try {
    response = await window.fetch("/api/owner/reference-source-workbench/local-study", {
      method: "POST",
      headers: {
        Accept: [...PRIVATE_REFERENCE_LOCAL_STUDY_MEDIA_TYPES].join(", "),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
  }
  if (!response.ok) {
    if (response.status === 409) {
      throw await classifyPrivateReferenceLocalStudyConflict(response);
    }
    if (response.status === 422) {
      throw new OwnerReferenceWorkbenchLocalStudyError("unavailable");
    }
    throw new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
  }

  const mediaType = response.headers.get("content-type")?.trim().toLowerCase();
  const contentLength = response.headers.get("content-length")?.trim();
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  const disposition = response.headers.get("content-disposition")?.trim().toLowerCase();
  if (
    !mediaType ||
    !PRIVATE_REFERENCE_LOCAL_STUDY_MEDIA_TYPES.has(
      mediaType as OwnerReferenceWorkbenchLocalStudyResult["mediaType"]
    ) ||
    !contentLength ||
    !/^[1-9][0-9]{0,7}$/u.test(contentLength) ||
    Number(contentLength) > OWNER_REFERENCE_UPLOAD_MAX_BYTES ||
    !cacheControl.split(",").some((directive) => directive.trim() === "no-store") ||
    response.headers.get("x-content-type-options")?.trim().toLowerCase() !== "nosniff" ||
    disposition !== "inline" ||
    response.headers.has("etag")
  ) {
    throw new OwnerReferenceWorkbenchLocalStudyError("invalid_response");
  }

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
  }
  if (
    bytes.byteLength !== Number(contentLength) ||
    bytes.byteLength < 1 ||
    bytes.byteLength > OWNER_REFERENCE_UPLOAD_MAX_BYTES ||
    !hasPrivateReferenceMediaSignature(mediaType, bytes)
  ) {
    throw new OwnerReferenceWorkbenchLocalStudyError("invalid_response");
  }
  return {
    mediaType: mediaType as OwnerReferenceWorkbenchLocalStudyResult["mediaType"],
    blob: new Blob([bytes], { type: mediaType }),
  };
}

async function fetchPrivateReferencePageAtlasPreview(
  request: unknown
): Promise<OwnerReferencePageAtlasPreviewResult> {
  let response: Response;
  try {
    response = await window.fetch("/api/owner/reference-source-workbench/page-atlas/preview", {
      method: "POST",
      headers: { Accept: "image/png", "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("Private Page Atlas preview outcome is uncertain");
  }
  if (!response.ok) throw new Error("Private Page Atlas preview is unavailable");
  const contentLength = response.headers.get("content-length")?.trim();
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (
    response.headers.get("content-type")?.trim().toLowerCase() !== "image/png" ||
    !contentLength ||
    !/^[1-9][0-9]{0,7}$/u.test(contentLength) ||
    Number(contentLength) > OWNER_REFERENCE_PAGE_ATLAS_PREVIEW_MAX_BYTES ||
    !cacheControl.split(",").some((directive) => directive.trim() === "no-store") ||
    response.headers.get("x-content-type-options")?.trim().toLowerCase() !== "nosniff" ||
    response.headers.get("content-disposition")?.trim().toLowerCase() !== "inline" ||
    response.headers.get("cross-origin-resource-policy")?.trim().toLowerCase() !== "same-origin" ||
    response.headers.has("content-encoding") ||
    response.headers.has("etag")
  ) {
    throw new Error("Private Page Atlas preview response is invalid");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.byteLength !== Number(contentLength) ||
    bytes.byteLength > OWNER_REFERENCE_PAGE_ATLAS_PREVIEW_MAX_BYTES ||
    pngSignature.some((value, index) => bytes[index] !== value)
  ) {
    throw new Error("Private Page Atlas preview bytes are invalid");
  }
  return {
    mediaType: "image/png",
    blob: new Blob([bytes], { type: "image/png" }),
  };
}

async function classifyPrivateReferenceLocalStudyConflict(
  response: Response
): Promise<OwnerReferenceWorkbenchLocalStudyError> {
  let value: unknown;
  try {
    const text = await response.text();
    if (text.length > 4096) {
      return new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
    }
    value = JSON.parse(text) as unknown;
  } catch {
    return new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["ok", "error"]) ||
    value.ok !== false ||
    !isRecord(value.error) ||
    !hasExactKeys(value.error, ["code", "message", "status", "correlationId", "details"]) ||
    value.error.code !== "conflict" ||
    value.error.status !== 409 ||
    typeof value.error.message !== "string" ||
    value.error.message.length < 1 ||
    value.error.message.length > 512 ||
    typeof value.error.correlationId !== "string" ||
    value.error.correlationId.length < 1 ||
    value.error.correlationId.length > 128 ||
    !isRecord(value.error.details) ||
    !hasExactKeys(value.error.details, ["reason", "retrySafety"])
  ) {
    return new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
  }
  if (
    value.error.details.reason === "operation_key_bound_to_different_scope" &&
    value.error.details.retrySafety === "reuse_exact_request"
  ) {
    return new OwnerReferenceWorkbenchLocalStudyError("operation_key_conflict");
  }
  if (
    value.error.details.reason === "workbench_snapshot_stale_before_commit" &&
    value.error.details.retrySafety === "refresh_and_rebind_same_operation_key"
  ) {
    return new OwnerReferenceWorkbenchLocalStudyError("stale_before_commit");
  }
  return new OwnerReferenceWorkbenchLocalStudyError("outcome_uncertain");
}

function hasPrivateReferenceMediaSignature(mediaType: string, bytes: Uint8Array): boolean {
  const startsWith = (...expected: number[]) =>
    bytes.byteLength >= expected.length && expected.every((byte, index) => bytes[index] === byte);
  switch (mediaType) {
    case "application/pdf":
      return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/gif":
      return (
        startsWith(0x47, 0x49, 0x46, 0x38, 0x37, 0x61) ||
        startsWith(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)
      );
    case "image/bmp":
      return startsWith(0x42, 0x4d);
    case "image/tiff":
      return startsWith(0x49, 0x49, 0x2a, 0x00) || startsWith(0x4d, 0x4d, 0x00, 0x2a);
    case "image/webp":
      return (
        bytes.byteLength >= 12 &&
        startsWith(0x52, 0x49, 0x46, 0x46) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

async function privateReferenceUploadIntent(
  file: File,
  mediaType: string
): Promise<PrivateReferenceUploadIntent> {
  assertPrivateReferenceFileSize(file);
  return withPrivateReferenceUploadLock(async () => {
    const fingerprint = await privateReferenceFileFingerprint(file, mediaType);
    const pending = readPrivateReferenceUploadPendingState();
    const existing = pending.intents.find((intent) => intent.fingerprint === fingerprint);
    if (existing) return existing;
    if (pending.intents.length >= OWNER_REFERENCE_UPLOAD_MAX_PENDING) {
      throw new OwnerReferenceWorkbenchUploadError("pending_limit");
    }
    const intent = Object.freeze({
      fingerprint,
      acquisitionKey: `owner-upload.v2.${base64UrlEncode(
        window.crypto.getRandomValues(new Uint8Array(OWNER_REFERENCE_UPLOAD_HMAC_KEY_BYTES))
      )}`,
    });
    writePrivateReferenceUploadPendingState({
      schemaVersion: 1,
      intents: [...pending.intents, intent],
    });
    return intent;
  });
}

function assertPrivateReferenceFileSize(file: Pick<File, "size">): void {
  if (file.size === 0 || file.size > OWNER_REFERENCE_UPLOAD_MAX_BYTES) {
    throw new Error("Private references must be between 1 byte and 32 MiB.");
  }
}

async function retirePrivateReferenceUploadIntent(
  completed: PrivateReferenceUploadIntent
): Promise<void> {
  await withPrivateReferenceUploadLock(() => {
    const pending = readPrivateReferenceUploadPendingState();
    const exact = pending.intents.filter(
      (intent) =>
        intent.fingerprint === completed.fingerprint &&
        intent.acquisitionKey === completed.acquisitionKey
    );
    if (exact.length === 0) {
      const conflicting = pending.intents.some(
        (intent) =>
          intent.fingerprint === completed.fingerprint ||
          intent.acquisitionKey === completed.acquisitionKey
      );
      if (!conflicting) return;
    }
    if (exact.length !== 1) {
      throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
    }
    writePrivateReferenceUploadPendingState({
      schemaVersion: 1,
      intents: pending.intents.filter((intent) => intent !== exact[0]),
    });
  });
}

async function privateReferenceFileFingerprint(file: File, mediaType: string): Promise<string> {
  const rawKey = privateReferenceUploadHmacKey();
  const key = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const domain = new TextEncoder().encode(
    `vellum.owner-reference-upload-file-fingerprint.v1\0${mediaType}\0${file.size}\0`
  );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const message = new Uint8Array(domain.byteLength + bytes.byteLength);
  message.set(domain);
  message.set(bytes, domain.byteLength);
  const commitment = new Uint8Array(await window.crypto.subtle.sign("HMAC", key, message));
  return `private-file.v1.${base64UrlEncode(commitment)}`;
}

async function withPrivateReferenceUploadLock<T>(operation: () => T | Promise<T>): Promise<T> {
  const locks = window.navigator.locks;
  if (!locks) {
    throw new OwnerReferenceWorkbenchUploadError("retry_protection_unavailable");
  }
  return locks.request(OWNER_REFERENCE_UPLOAD_LOCK, { mode: "exclusive" }, operation);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function readPrivateReferenceUploadPendingState(): PrivateReferenceUploadPendingState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_PENDING_STORAGE);
  } catch {
    throw new OwnerReferenceWorkbenchUploadError("retry_protection_unavailable");
  }
  if (raw === null) return { schemaVersion: 1, intents: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
  }
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "intents"])) {
    throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
  }
  if (value.schemaVersion !== 1 || !Array.isArray(value.intents)) {
    throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
  }
  const intents = value.intents.map((entry) => {
    if (!isRecord(entry) || !hasExactKeys(entry, ["fingerprint", "acquisitionKey"])) {
      throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
    }
    if (
      typeof entry.fingerprint !== "string" ||
      !/^private-file\.v1\.[A-Za-z0-9_-]{43}$/u.test(entry.fingerprint) ||
      typeof entry.acquisitionKey !== "string" ||
      !/^owner-upload\.v2\.[A-Za-z0-9_-]{43}$/u.test(entry.acquisitionKey)
    ) {
      throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
    }
    return Object.freeze({
      fingerprint: entry.fingerprint,
      acquisitionKey: entry.acquisitionKey,
    });
  });
  if (
    intents.length > OWNER_REFERENCE_UPLOAD_MAX_PENDING ||
    new Set(intents.map(({ fingerprint }) => fingerprint)).size !== intents.length ||
    new Set(intents.map(({ acquisitionKey }) => acquisitionKey)).size !== intents.length
  ) {
    throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
  }
  return { schemaVersion: 1, intents };
}

function writePrivateReferenceUploadPendingState(state: PrivateReferenceUploadPendingState): void {
  const encoded = JSON.stringify(state);
  try {
    window.localStorage.setItem(OWNER_REFERENCE_UPLOAD_PENDING_STORAGE, encoded);
    if (window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_PENDING_STORAGE) !== encoded) {
      throw new Error("Browser-local upload retry state did not persist");
    }
  } catch {
    throw new OwnerReferenceWorkbenchUploadError("retry_protection_unavailable");
  }
}

function privateReferenceUploadHmacKey(): Uint8Array<ArrayBuffer> {
  let stored: string | null;
  let pending: string | null;
  try {
    stored = window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_HMAC_KEY_STORAGE);
    pending = window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_PENDING_STORAGE);
  } catch {
    throw new OwnerReferenceWorkbenchUploadError("retry_protection_unavailable");
  }
  if (stored !== null) {
    const decoded = base64UrlDecode(stored);
    if (decoded?.byteLength !== OWNER_REFERENCE_UPLOAD_HMAC_KEY_BYTES) {
      throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
    }
    return decoded;
  }
  if (pending !== null && pending !== '{"schemaVersion":1,"intents":[]}') {
    throw new OwnerReferenceWorkbenchUploadError("retry_state_invalid");
  }

  const generated = window.crypto.getRandomValues(
    new Uint8Array(OWNER_REFERENCE_UPLOAD_HMAC_KEY_BYTES)
  );
  const encoded = base64UrlEncode(generated);
  try {
    window.localStorage.setItem(OWNER_REFERENCE_UPLOAD_HMAC_KEY_STORAGE, encoded);
    const persisted = window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_HMAC_KEY_STORAGE);
    const persistedBytes = persisted ? base64UrlDecode(persisted) : null;
    if (persistedBytes?.byteLength !== OWNER_REFERENCE_UPLOAD_HMAC_KEY_BYTES) {
      throw new Error("Browser-local upload retry key did not persist");
    }
    return persistedBytes;
  } catch {
    throw new OwnerReferenceWorkbenchUploadError("retry_protection_unavailable");
  }
}

async function resetPrivateReferenceUploadRetryState(): Promise<void> {
  await withPrivateReferenceUploadLock(() => {
    try {
      window.localStorage.removeItem(OWNER_REFERENCE_UPLOAD_PENDING_STORAGE);
      if (window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_PENDING_STORAGE) !== null) {
        throw new Error("pending retry state did not clear");
      }
      window.localStorage.removeItem(OWNER_REFERENCE_UPLOAD_HMAC_KEY_STORAGE);
      if (window.localStorage.getItem(OWNER_REFERENCE_UPLOAD_HMAC_KEY_STORAGE) !== null) {
        throw new Error("retry key did not clear");
      }
    } catch {
      throw new OwnerReferenceWorkbenchUploadError("retry_protection_unavailable");
    }
  });
}

async function decodeOwnerReferenceUploadIngestResult(
  input: unknown,
  file: File,
  mediaType: string,
  intent: PrivateReferenceUploadIntent
): Promise<OwnerReferenceUploadIngestResult> {
  const result = Value.Decode(OwnerReferenceUploadIngestResultSchema, input);
  const [fileSha256, keySha256] = await Promise.all([
    browserSha256Hex(new Uint8Array(await file.arrayBuffer())),
    browserSha256Hex(new TextEncoder().encode(intent.acquisitionKey)),
  ]);
  const expectedAcquisitionId = `acquisition.owner-upload.${keySha256.slice(0, 32)}`;
  const expectedOwnerActionId = `owner-action.reference-upload.${keySha256.slice(0, 32)}`;
  if (
    result.digitalAsset.sha256 !== fileSha256 ||
    result.digitalAsset.id !== `digital-asset.sha256.${fileSha256}` ||
    result.digitalAsset.mediaType !== mediaType ||
    result.digitalAsset.byteLength !== file.size ||
    result.acquisition.id !== expectedAcquisitionId ||
    result.acquisition.digitalAssetRef.id !== result.digitalAsset.id ||
    result.acquisition.digitalAssetRef.digest !== result.digitalAsset.digest ||
    result.acquisition.origin.ownerActionRef.id !== expectedOwnerActionId ||
    result.acquisition.processingPolicyRef.id !==
      "processing-policy.owner-local-reference-upload.v1"
  ) {
    throw new Error("The private upload confirmation does not match the submitted acquisition");
  }
  return result;
}

async function browserSha256Hex(value: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await window.crypto.subtle.digest("SHA-256", value));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) return null;
  try {
    const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}=`;
    return Uint8Array.from(window.atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function renderPrivateReferenceStagingSummary(container: HTMLElement, input: unknown): void {
  container.replaceChildren();
  container.className = "reference-source-staging-private-summary";
  if (!isPrivateReferenceStagingDiagnostics(input)) {
    const unavailable = document.createElement("p");
    unavailable.textContent = "Private staging summary is unavailable.";
    container.append(unavailable);
    return;
  }

  const boundary = document.createElement("strong");
  boundary.textContent = "Staging only · read-only compatibility view";
  const publication = document.createElement("p");
  publication.textContent =
    "Canonical publication is disabled. This private summary cannot affect arranging or reviewed knowledge.";
  const counts = document.createElement("p");
  const stagedRecords = privateArrayLength(input.snapshot, "records");
  const legacyRecords = Math.max(
    privateNestedArrayLength(input, "legacyProjection", "ownerReferences"),
    privateNestedArrayLength(input, "legacyProjections", "ownerReferences")
  );
  counts.textContent = `${boundedPrivateCount(stagedRecords)} staged record${stagedRecords === 1 ? "" : "s"} · ${boundedPrivateCount(legacyRecords)} legacy compatibility record${legacyRecords === 1 ? "" : "s"}`;
  const explanation = document.createElement("p");
  explanation.textContent = input.head
    ? "A current private staging snapshot is available. Bibliographic identity confidence unassessed until reviewed. Record identities, source metadata, paths, and direct digests are hidden; use the redacted reference cards above for review."
    : "No current private staging snapshot exists. Bibliographic identity confidence unassessed. Record identities, source metadata, paths, and direct digests remain hidden.";
  container.append(boundary, publication, counts, explanation);
}

function isPrivateReferenceStagingDiagnostics(
  value: unknown
): value is ReferenceSourceStagingDiagnostics {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { publicationState?: unknown }).publicationState === "staging_only" &&
    typeof (value as { capabilities?: unknown }).capabilities === "object" &&
    (value as { capabilities?: unknown }).capabilities !== null &&
    (value as { capabilities: { canonicalPublication?: unknown } }).capabilities
      .canonicalPublication === false
  );
}

function privateArrayLength(value: unknown, key: string): number {
  if (typeof value !== "object" || value === null) return 0;
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate.length : 0;
}

function privateNestedArrayLength(value: unknown, outerKey: string, innerKey: string): number {
  if (typeof value !== "object" || value === null) return 0;
  return privateArrayLength((value as Record<string, unknown>)[outerKey], innerKey);
}

function boundedPrivateCount(value: number): string {
  return value > OWNER_REFERENCE_STAGING_SUMMARY_LIMIT
    ? `${OWNER_REFERENCE_STAGING_SUMMARY_LIMIT}+`
    : String(value);
}

function privateReferenceMimeType(file: Pick<File, "name" | "type">): string {
  const declared = file.type.split(";", 1)[0]?.trim().toLowerCase();
  if (
    declared &&
    ["application/pdf", "image/png", "image/jpeg", "image/tiff", "image/webp"].includes(declared)
  ) {
    return declared;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  const inferred = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    tif: "image/tiff",
    tiff: "image/tiff",
    webp: "image/webp",
  }[extension ?? ""];
  if (!inferred) throw new Error("Choose a supported private PDF or image.");
  return inferred;
}

function renderOwnerReferenceMigrationControls(
  compatibility: OwnerReferenceMigrationCompatibility,
  refresh: () => Promise<unknown>
): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "owner-reference-library-migration-controls";
  panel.dataset.ownerReferenceMigrationControls = "";
  const heading = document.createElement("strong");
  heading.textContent = "Legacy private references";
  const explanation = document.createElement("p");
  const pending = compatibility.ownerReferences.filter(({ state }) => state === "pending").length;
  explanation.textContent = pending
    ? `${pending} legacy private reference${pending === 1 ? " is" : "s are"} waiting for a transactional byte-level migration. No title, citation, filename, or historical identity will be inferred.`
    : compatibility.ownerReferences.length
      ? "Legacy private references have a migration disposition. Quarantined records remain visible for review but cannot become arranging or specialist authority."
      : compatibility.legacySourceState === "unavailable"
        ? "The legacy private store is unavailable. No migration or authority claim was inferred."
        : "No legacy private references are waiting for migration.";
  panel.append(heading, explanation);
  if (pending === 0) return panel;

  const review = document.createElement("button");
  review.type = "button";
  review.textContent = "Review migration plan";
  const authorize = document.createElement("button");
  authorize.type = "button";
  authorize.textContent = "Authorize private staging migration";
  authorize.hidden = true;
  const planItems = document.createElement("ol");
  planItems.className = "owner-reference-library-migration-plan";
  planItems.dataset.ownerReferenceMigrationPlan = "";
  planItems.hidden = true;
  const status = document.createElement("p");
  status.className = "owner-reference-library-migration-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  panel.append(review, status, planItems, authorize);

  let reviewedPlan: OwnerReferenceMigrationPlan | undefined;
  let migrationStateInvalidated = false;
  const expectedHead = ownerReferenceMigrationExpectedHead(compatibility.head);
  const invalidateAndRefresh = async (message: string): Promise<void> => {
    migrationStateInvalidated = true;
    reviewedPlan = undefined;
    authorize.hidden = true;
    authorize.disabled = true;
    review.disabled = true;
    planItems.hidden = true;
    planItems.replaceChildren();
    status.textContent = "Refreshing private migration state…";
    try {
      await refresh();
      const freshStatus = panel.ownerDocument.querySelector<HTMLElement>(
        "#vellum-owner-workbench .owner-reference-library-migration-status"
      );
      if (freshStatus) freshStatus.textContent = message;
    } catch {
      status.textContent = `${message} Automatic refresh failed. Close and reopen Knowledge & defaults before reviewing another plan.`;
    }
  };
  review.addEventListener("click", async () => {
    review.disabled = true;
    authorize.hidden = true;
    planItems.hidden = true;
    planItems.replaceChildren();
    status.textContent = "Preparing a read-only migration plan…";
    try {
      const input = await api<unknown>("/api/owner/reference-migrations/owner-references/dry-run", {
        method: "POST",
        body: JSON.stringify({ expectedHead }),
      });
      reviewedPlan = decodeOwnerReferenceMigrationPlan(input, expectedHead);
      const changes = reviewedPlan.mappings.length + reviewedPlan.quarantines.length;
      status.textContent = changes
        ? `Plan reviewed without writes: ${reviewedPlan.mappings.length} byte mapping${reviewedPlan.mappings.length === 1 ? "" : "s"} and ${reviewedPlan.quarantines.length} quarantine decision${reviewedPlan.quarantines.length === 1 ? "" : "s"}. Authorization migrates bytes into private staging only; activation remains disabled.`
        : "Plan reviewed without writes. There are no migration changes to authorize.";
      if (changes > 0) {
        const expectedReviewItems = new Set([
          ...reviewedPlan.mappings.map(({ legacyId }) => legacyId),
          ...reviewedPlan.quarantines.map(({ legacyId }) => legacyId),
        ]).size;
        const renderedReviewItems = renderRedactedOwnerReferenceMigrationPlan(
          planItems,
          reviewedPlan
        );
        if (
          renderedReviewItems !== expectedReviewItems ||
          planItems.childElementCount !== expectedReviewItems
        ) {
          throw new Error("The redacted migration review is incomplete");
        }
        planItems.hidden = false;
      }
      authorize.hidden = changes === 0;
    } catch {
      await invalidateAndRefresh(
        "The migration plan could not be validated. No migration change was made; review a fresh plan."
      );
    } finally {
      if (panel.isConnected && !migrationStateInvalidated) review.disabled = false;
    }
  });
  authorize.addEventListener("click", async () => {
    if (!reviewedPlan) return;
    review.disabled = true;
    authorize.disabled = true;
    status.textContent = "Committing the reviewed private staging migration…";
    try {
      await api("/api/owner/reference-migrations/owner-references/commit", {
        method: "POST",
        body: JSON.stringify({
          expectedHead,
          planDigest: reviewedPlan.planDigest,
        }),
      });
      await refresh();
    } catch {
      await invalidateAndRefresh(
        "The reviewed private migration outcome could not be confirmed. No authority was activated; review the refreshed state before any retry."
      );
    }
  });
  return panel;
}

function decodeOwnerReferenceMigrationCompatibility(
  input: unknown
): OwnerReferenceMigrationCompatibility {
  const compatibility = Value.Decode(OwnerReferenceMigrationCompatibilitySchema, input);
  assertUniquePrivateMigrationIds(
    compatibility.ownerReferences.map(({ legacyId }) => legacyId),
    "compatibility rows"
  );
  return compatibility;
}

function decodeOwnerReferenceMigrationPlan(
  input: unknown,
  requestedHead: OwnerReferenceMigrationExpectedHead
): OwnerReferenceMigrationPlan {
  const plan = Value.Decode(OwnerReferenceMigrationPlanSchema, input);
  if (!sameOwnerReferenceMigrationHead(plan.expectedHead, requestedHead)) {
    throw new Error("The private migration plan is bound to a different publication head");
  }
  assertUniquePrivateMigrationIds(
    plan.mappings.map(({ legacyId }) => legacyId),
    "migration mappings"
  );
  assertUniquePrivateMigrationIds(
    plan.quarantines.map(({ legacyId }) => legacyId),
    "migration quarantines"
  );
  return plan;
}

function assertUniquePrivateMigrationIds(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`The private ${label} contain duplicate identities`);
  }
}

function sameOwnerReferenceMigrationHead(
  left: OwnerReferenceMigrationExpectedHead,
  right: OwnerReferenceMigrationExpectedHead
): boolean {
  if (left === null || right === null) return left === right;
  return left.id === right.id && left.digest === right.digest && left.revision === right.revision;
}

function renderRedactedOwnerReferenceMigrationPlan(
  list: HTMLOListElement,
  plan: OwnerReferenceMigrationPlan
): number {
  type ReviewItem = {
    mapping?: OwnerReferenceMigrationPlan["mappings"][number];
    quarantine?: OwnerReferenceMigrationPlan["quarantines"][number];
  };
  const items = new Map<string, ReviewItem>();
  for (const mapping of plan.mappings) {
    items.set(mapping.legacyId, { ...items.get(mapping.legacyId), mapping });
  }
  for (const quarantine of plan.quarantines) {
    items.set(quarantine.legacyId, { ...items.get(quarantine.legacyId), quarantine });
  }
  let ordinal = 0;
  for (const item of items.values()) {
    ordinal += 1;
    const row = list.ownerDocument.createElement("li");
    const parts = [`Private reference ${ordinal}`];
    if (item.mapping) {
      parts.push(
        item.mapping.alreadyMapped
          ? "exact byte mapping already exists"
          : "exact bytes will be mapped into private staging",
        "bibliographic identity will not be asserted"
      );
    }
    if (item.quarantine) {
      parts.push(
        `authority remains quarantined: ${humanizePrivateEnum(item.quarantine.reason)}`,
        `required action: ${humanizePrivateEnum(item.quarantine.action)}`
      );
    } else {
      parts.push("required action: review source identity before any authority-bearing use");
    }
    row.textContent = `${parts.join(" · ")}.`;
    list.append(row);
  }
  return ordinal;
}

function humanizePrivateEnum(value: string): string {
  return value.replaceAll("_", " ");
}

function ownerReferenceMigrationExpectedHead(
  head: OwnerReferenceMigrationCompatibility["head"]
): OwnerReferenceMigrationExpectedHead {
  return head ? { id: head.generationId, digest: head.digest, revision: head.revision } : null;
}

function ownerRecord(title: string, evidence: string): HTMLElement {
  const row = document.createElement("article");
  row.className = "owner-record";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = evidence;
  row.append(heading, detail);
  return row;
}

function parseOwnerValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function ownerButton(label: string, action: () => void | Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => void action());
  return button;
}

type RecoverableModelAction = {
  id: string;
  kind: string;
  intent: string;
  status: "interrupted" | "denied";
  originalInputVersions: Array<{ recordId: string; version: number }>;
  attempts: Array<{
    completedLocalToolResults: Array<{ toolName: string; resultReference: string }>;
    partialProgressSummary?: string;
    interruptionReason?: string;
    lastConfirmedBoundary: string;
    inputDifferenceSummary?: string;
  }>;
};

async function refreshModelActionRecovery(root: HTMLElement, workspaceId: string): Promise<void> {
  const panel = root.querySelector<HTMLElement>("[data-model-action-recovery]");
  const items = panel?.querySelector<HTMLElement>("[data-model-action-items]");
  if (!panel || !items) return;
  const actions = await api<RecoverableModelAction[]>(
    `/api/workspaces/${workspaceId}/model-actions`
  );
  const recoverable = actions.filter(
    (action) => action.status === "interrupted" || action.status === "denied"
  );
  panel.hidden = recoverable.length === 0;
  items.replaceChildren();
  for (const action of recoverable) {
    const attempt = action.attempts.at(-1)!;
    const item = document.createElement("article");
    item.className = "model-action-recovery-item";
    const heading = document.createElement("strong");
    heading.textContent = `${action.kind.replaceAll("_", " ")}: ${action.intent}`;
    const detail = document.createElement("p");
    detail.textContent = [
      attempt.interruptionReason ??
        (action.status === "denied"
          ? "No data was sent; egress was denied or withdrawn."
          : "Provider work was interrupted."),
      `Last confirmed boundary: ${attempt.lastConfirmedBoundary}`,
      attempt.partialProgressSummary,
      `${action.originalInputVersions.length} exact input version(s) retained; ${attempt.completedLocalToolResults.length} local tool result(s) retained.`,
    ]
      .filter(Boolean)
      .join(" ");
    const controls = document.createElement("div");
    controls.className = "model-action-recovery-controls";
    const retryCurrent = recoveryButton("Retry on current version", async () => {
      await mutate("retry", { mode: "current_version" });
    });
    const retryBranch = recoveryButton("Retry original snapshot as a branch", async () => {
      await mutate("retry", { mode: "original_snapshot_branch" });
    });
    retryBranch.disabled = action.originalInputVersions.length === 0;
    const cancel = recoveryButton("Cancel", async () => {
      await mutate("cancel", {});
    });
    controls.append(retryCurrent, retryBranch, cancel);
    item.append(heading, detail, controls);
    items.append(item);

    async function mutate(operation: "retry" | "cancel", body: object): Promise<void> {
      for (const button of controls.querySelectorAll<HTMLButtonElement>("button")) {
        button.disabled = true;
      }
      try {
        await api(`/api/workspaces/${workspaceId}/model-actions/${action.id}/${operation}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        await refreshModelActionRecovery(root, workspaceId);
      } catch (error) {
        detail.textContent = `${detail.textContent} ${error instanceof Error ? error.message : "The recovery action failed."}`;
        for (const button of controls.querySelectorAll<HTMLButtonElement>("button")) {
          button.disabled = false;
        }
      }
    }
  }
}

function recoveryButton(label: string, action: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => void action());
  return button;
}

export function installAudioPreviewControls(panel: HTMLElement, preview: AudioPreview): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  audioPlaybackCleanups.get(panel)?.();
  audioPlaybackCleanups.delete(panel);
  header.querySelector(".audio-preview-controls")?.remove();
  const controls = document.createElement("div");
  controls.className = "audio-preview-controls";
  controls.innerHTML = `
    <div class="audio-transport">
      <strong>Audio Preview</strong>
      <button type="button" data-audio-play>▶ Play</button>
      <button type="button" data-audio-pause disabled>Ⅱ Pause</button>
      <button type="button" data-audio-stop disabled>■ Stop</button>
      <output data-audio-time>0:00 / ${formatTime(preview.durationSeconds)}</output>
      <output data-audio-occurrence aria-live="polite"></output>
    </div>
    <input data-audio-progress aria-label="Playback position" type="range" min="0" max="${preview.durationSeconds}" value="0" step="0.01">
    <div class="audio-practice-controls">
      <label>Speed <select data-audio-speed><option value="0.5">50%</option><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label>
      <label>Volume <input data-audio-volume type="range" min="0" max="1" value="0.35" step="0.01"></label>
      <label><input data-audio-skip-repeats type="checkbox"> Skip repeats</label>
      <label>Loop <input data-loop-start aria-label="Loop start" type="number" min="0" max="${preview.durationSeconds}" value="0" step="0.1">–<input data-loop-end aria-label="Loop end" type="number" min="0" max="${preview.durationSeconds}" value="${preview.durationSeconds.toFixed(1)}" step="0.1"> s</label>
      <button type="button" data-practice-reset>Reset practice controls</button>
    </div>
    <div class="playback-part-mixer" aria-label="Playback parts"></div>
  `;
  header.append(controls);
  let activePreview = preview;
  let playback: PreviewPlayback | undefined;
  let position = 0;
  const play = controls.querySelector<HTMLButtonElement>("[data-audio-play]")!;
  const pause = controls.querySelector<HTMLButtonElement>("[data-audio-pause]")!;
  const stop = controls.querySelector<HTMLButtonElement>("[data-audio-stop]")!;
  const progress = controls.querySelector<HTMLInputElement>("[data-audio-progress]")!;
  const time = controls.querySelector<HTMLOutputElement>("[data-audio-time]")!;
  const occurrence = controls.querySelector<HTMLOutputElement>("[data-audio-occurrence]")!;
  const speed = controls.querySelector<HTMLSelectElement>("[data-audio-speed]")!;
  const volume = controls.querySelector<HTMLInputElement>("[data-audio-volume]")!;
  const skipRepeats = controls.querySelector<HTMLInputElement>("[data-audio-skip-repeats]")!;
  const loopStart = controls.querySelector<HTMLInputElement>("[data-loop-start]")!;
  const loopEnd = controls.querySelector<HTMLInputElement>("[data-loop-end]")!;
  const mixer = controls.querySelector<HTMLElement>(".playback-part-mixer")!;
  const partState = new Map<
    Exclude<PlaybackPart, "full">,
    { mute: boolean; solo: boolean; level: number }
  >();
  for (const part of preview.parts.filter((item) => item.id !== "full")) {
    const id = part.id as Exclude<PlaybackPart, "full">;
    partState.set(id, { mute: false, solo: false, level: 1 });
    const row = document.createElement("div");
    row.className = "playback-part-row";
    const partLabel = document.createElement("span");
    partLabel.textContent = part.label;
    const muteLabel = document.createElement("label");
    const mute = document.createElement("input");
    mute.type = "checkbox";
    mute.dataset.partMute = "";
    muteLabel.append(mute, " Mute");
    const soloLabel = document.createElement("label");
    const solo = document.createElement("input");
    solo.type = "checkbox";
    solo.dataset.partSolo = "";
    soloLabel.append(solo, " Solo");
    const levelLabel = document.createElement("label");
    const level = document.createElement("input");
    level.type = "range";
    level.min = "0";
    level.max = "1";
    level.value = "1";
    level.step = "0.01";
    level.dataset.partLevel = "";
    levelLabel.append("Level ", level);
    row.append(partLabel, muteLabel, soloLabel, levelLabel);
    mute.addEventListener("change", (event) => {
      partState.get(id)!.mute = (event.currentTarget as HTMLInputElement).checked;
    });
    solo.addEventListener("change", (event) => {
      partState.get(id)!.solo = (event.currentTarget as HTMLInputElement).checked;
    });
    level.addEventListener("input", (event) => {
      partState.get(id)!.level = Number((event.currentTarget as HTMLInputElement).value);
    });
    mixer.append(row);
  }
  const updatePosition = (next: number, suppliedEvents?: PlaybackEvent[]) => {
    const activeEvents =
      suppliedEvents ??
      activePreview.events.filter(
        (event) => event.startSeconds <= next && next < event.startSeconds + event.durationSeconds
      );
    position = next;
    progress.value = String(next);
    time.value = `${formatTime(next)} / ${formatTime(activePreview.durationSeconds)}`;
    const activeOccurrence = activeEvents[0];
    occurrence.value = activeOccurrence
      ? `${activeOccurrence.measureOccurrenceId} · iteration ${activeOccurrence.iteration}`
      : "";
    highlightLineage(panel, activeEvents, activePreview);
  };
  play.addEventListener("click", () => {
    playback?.stop(false);
    playback = playPreview(activePreview, {
      fromSeconds: position,
      speed: Number(speed.value),
      volume: Number(volume.value),
      loopStart: Number(loopStart.value),
      loopEnd: Number(loopEnd.value),
      partState,
      onProgress: updatePosition,
      onEnded: () => {
        audioPlaybackCleanups.delete(panel);
        if (Number(loopEnd.value) < activePreview.durationSeconds) {
          updatePosition(Number(loopStart.value));
          playback = undefined;
          play.disabled = false;
          pause.disabled = true;
          stop.disabled = false;
          play.click();
          return;
        }
        updatePosition(0);
        playback = undefined;
        play.disabled = false;
        pause.disabled = true;
        stop.disabled = true;
      },
    });
    audioPlaybackCleanups.set(panel, () => playback?.stop(false));
    play.disabled = true;
    pause.disabled = false;
    stop.disabled = false;
  });
  pause.addEventListener("click", () => {
    playback?.stop(true);
    playback = undefined;
    audioPlaybackCleanups.delete(panel);
    play.disabled = false;
    pause.disabled = true;
  });
  stop.addEventListener("click", () => {
    playback?.stop(false);
    playback = undefined;
    audioPlaybackCleanups.delete(panel);
    updatePosition(0, []);
    play.disabled = false;
    pause.disabled = true;
    stop.disabled = true;
  });
  progress.addEventListener("input", () => {
    playback?.stop(true);
    playback = undefined;
    audioPlaybackCleanups.delete(panel);
    updatePosition(Number(progress.value));
    play.disabled = false;
    pause.disabled = true;
  });
  skipRepeats.addEventListener("change", () => {
    playback?.stop(false);
    playback = undefined;
    audioPlaybackCleanups.delete(panel);
    activePreview = skipRepeats.checked ? skipRepeatedOccurrences(preview) : preview;
    progress.max = String(activePreview.durationSeconds);
    loopEnd.max = String(activePreview.durationSeconds);
    loopEnd.value = activePreview.durationSeconds.toFixed(1);
    updatePosition(0);
  });
  controls
    .querySelector<HTMLButtonElement>("[data-practice-reset]")!
    .addEventListener("click", () => {
      speed.value = "1";
      skipRepeats.checked = false;
      activePreview = preview;
      loopStart.value = "0";
      loopEnd.value = preview.durationSeconds.toFixed(1);
      progress.max = String(preview.durationSeconds);
      updatePosition(0);
    });
  controls
    .querySelectorAll<HTMLInputElement>("[data-loop-start], [data-loop-end]")
    .forEach((input) =>
      input.addEventListener("change", () => {
        if (Number(loopEnd.value) <= Number(loopStart.value))
          loopEnd.value = String(activePreview.durationSeconds);
      })
    );
  const previousSeekHandler = audioSeekHandlers.get(panel);
  if (previousSeekHandler) panel.removeEventListener("vellum-seek-playback", previousSeekHandler);
  const seekHandler: EventListener = (event) => {
    const detail = (
      event as CustomEvent<{
        arrangementEventId?: string;
        sourceEventId?: string;
        auditTargetId?: string;
      }>
    ).detail;
    const occurrence = activePreview.events.find(
      (candidate) =>
        candidate.arrangementEventId === detail.arrangementEventId ||
        (detail.sourceEventId ? candidate.sourceEventIds.includes(detail.sourceEventId) : false) ||
        (detail.auditTargetId ? candidate.auditTargetIds.includes(detail.auditTargetId) : false)
    );
    if (!occurrence) return;
    playback?.stop(true);
    playback = undefined;
    updatePosition(occurrence.startSeconds, [occurrence]);
    play.disabled = false;
    pause.disabled = true;
  };
  panel.addEventListener("vellum-seek-playback", seekHandler);
  audioSeekHandlers.set(panel, seekHandler);
  panel.addEventListener("vellum-loop-selection", (event) => {
    const ids = new Set(
      (event as CustomEvent<{ arrangementEventIds?: string[] }>).detail?.arrangementEventIds ?? []
    );
    const selectedOccurrences = activePreview.events.filter((candidate) =>
      ids.has(candidate.arrangementEventId)
    );
    if (selectedOccurrences.length === 0) return;
    loopStart.value = String(
      Math.min(...selectedOccurrences.map((candidate) => candidate.startSeconds))
    );
    loopEnd.value = String(
      Math.max(
        ...selectedOccurrences.map(
          (candidate) => candidate.startSeconds + candidate.durationSeconds
        )
      )
    );
    updatePosition(Number(loopStart.value));
  });
}

export function installCandidateComparisonControls(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header || deliverable.candidates.length < 2) return;
  header.querySelector(".candidate-comparison-controls")?.remove();
  const controls = document.createElement("div");
  controls.className = "candidate-comparison-controls";
  const label = document.createElement("label");
  label.textContent = "Arrangement candidate";
  const select = document.createElement("select");
  for (const candidate of [...deliverable.candidates].sort(
    (left, right) =>
      (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
  )) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = `${candidate.rank ? `#${candidate.rank} ` : ""}${candidate.strategy}${candidate.status === "selected" ? " · selected" : ""}`;
    option.selected = candidate.status === "selected";
    select.append(option);
  }
  const evidence = document.createElement("span");
  evidence.className = "candidate-ranking-evidence";
  const branch = document.createElement("button");
  branch.type = "button";
  branch.textContent = "Branch from candidate";
  const update = async () => {
    const candidate = deliverable.candidates.find((item) => item.id === select.value)!;
    evidence.textContent =
      candidate.status === "rejected"
        ? `Rejected · ${candidate.rejectionReason ?? "A hard constraint failed."}${candidate.evaluation ? ` · weighted score ${(candidate.evaluation.weightedTotal * 100).toFixed(1)}%` : ""}`
        : candidate.evaluation
          ? `Rank ${candidate.rank ?? "—"} · ${(candidate.evaluation.weightedTotal * 100).toFixed(1)}% · ${candidate.evaluation.rationale}`
          : "Ranking evidence unavailable";
    branch.disabled = candidate.status === "selected" || candidate.status === "rejected";
    if (candidate.status === "selected") {
      installAudioPreviewControls(panel, deliverable.preview);
      return;
    }
    if (candidate.status === "rejected") {
      return;
    }
    select.disabled = true;
    try {
      const preview = await api<AudioPreview>(
        `/api/workspaces/${deliverable.workspaceId}/arrangement-searches/${deliverable.arrangementSearchId}/candidates/${candidate.id}/audio-preview`
      );
      installAudioPreviewControls(panel, preview);
    } finally {
      select.disabled = false;
    }
  };
  select.addEventListener("change", () => void update());
  branch.addEventListener("click", async () => {
    branch.disabled = true;
    const result = await api<{ branchId: string }>(
      `/api/workspaces/${deliverable.workspaceId}/arrangement-searches/${deliverable.arrangementSearchId}/candidates/${select.value}/branch`,
      { method: "POST", body: "{}" }
    );
    branch.textContent = `Created ${result.branchId}`;
  });
  label.append(select);
  controls.append(label, branch, evidence);
  header.append(controls);
  void update();
}

export function installAnalysisSummary(panel: HTMLElement, deliverable: GuidedDeliverable): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".analysis-summary")?.remove();
  const details = document.createElement("details");
  details.className = "analysis-summary";
  const summary = document.createElement("summary");
  summary.textContent = deliverable.analysis.summary ?? "Musicological analysis";
  const body = document.createElement("div");
  const passages = document.createElement("p");
  passages.textContent = `Passages: ${(deliverable.analysis.passages ?? [])
    .map(
      (passage) =>
        `${passage.texture}${passage.contrapuntalTechniques.length ? ` (${passage.contrapuntalTechniques.join(", ")})` : ""}`
    )
    .join("; ")}`;
  const claims = document.createElement("ul");
  for (const claim of deliverable.analysis.claims) {
    const item = document.createElement("li");
    item.dataset.sourceEventIds = (claim.subjectIds ?? []).join(" ");
    item.textContent = `${claim.statement} [${claim.basis}, ${(claim.confidence * 100).toFixed(0)}%]`;
    claims.append(item);
    item.addEventListener("click", () => {
      const sourceEventId = claim.subjectIds?.[0];
      if (sourceEventId) {
        panel.dispatchEvent(new CustomEvent("vellum-seek-playback", { detail: { sourceEventId } }));
      }
    });
  }
  const profiles = document.createElement("p");
  profiles.textContent = (deliverable.analysis.profiles ?? [])
    .map((profile) => `${profile.label} (${profile.status}): ${profile.arrangementConsequence}`)
    .join(" ");
  body.append(passages, claims);
  if (profiles.textContent) body.append(profiles);
  for (const ambiguity of deliverable.analysis.ambiguities ?? []) {
    const ambiguityPanel = document.createElement("section");
    ambiguityPanel.className = `analysis-ambiguity${ambiguity.critical ? " critical" : ""}`;
    const question = document.createElement("p");
    question.textContent = `${ambiguity.critical ? "Review required: " : "Alternative: "}${ambiguity.question}${ambiguity.resolution ? ` Resolved: ${ambiguity.resolution}` : ""}`;
    ambiguityPanel.append(question);
    const claim = deliverable.analysis.claims.find((item) => item.id === ambiguity.claimId);
    if (!ambiguity.resolution) {
      for (const alternative of claim?.alternatives ?? []) {
        if (!alternative.subjectIds?.length) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = alternative.statement;
        button.title = alternative.arrangementConsequence;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            deliverable.analysis = await api<GuidedDeliverable["analysis"]>(
              `/api/workspaces/${deliverable.workspaceId}/analyses/${deliverable.analysis.id}/claims/${claim!.id}/corrections`,
              {
                method: "POST",
                body: JSON.stringify({
                  statement: alternative.statement,
                  subjectIds: alternative.subjectIds,
                  selectedAlternativeId: alternative.id,
                  rationale: "The Owner selected this ranked analysis alternative.",
                }),
              }
            );
            installAnalysisSummary(panel, deliverable);
            panel.querySelector<HTMLDetailsElement>(".analysis-summary")!.open = true;
          } finally {
            button.disabled = false;
          }
        });
        ambiguityPanel.append(button);
      }
    }
    body.append(ambiguityPanel);
  }
  details.append(summary, body);
  header.append(details);
}

export function installTransformationReport(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".transformation-report")?.remove();
  const details = document.createElement("details");
  details.className = "transformation-report";
  const summary = document.createElement("summary");
  const counts = new Map<string, number>();
  for (const entry of deliverable.transformationReport) {
    counts.set(entry.classification, (counts.get(entry.classification) ?? 0) + 1);
  }
  summary.textContent = `Provenance · ${[...counts]
    .map(([classification, count]) => `${count} ${classification.replaceAll("_", " ")}`)
    .join(" · ")}`;
  const list = document.createElement("ol");
  for (const entry of deliverable.transformationReport) {
    const item = document.createElement("li");
    item.dataset.transformationId = entry.id ?? "";
    item.dataset.arrangementEventIds = entry.arrangementEventIds.join(" ");
    item.dataset.sourceEventIds = entry.sourceEventId ?? "";
    item.dataset.auditTargetIds = entry.sourceRelationshipId ?? "";
    const source = entry.sourceRelationshipId ?? entry.sourceEventId ?? "new material";
    item.textContent = `${source} → ${entry.arrangementEventIds.join(", ") || "omitted"}: ${entry.classification.replaceAll("_", " ")}. ${entry.rationale}`;
    if (entry.arrangementEventIds[0]) {
      item.tabIndex = 0;
      item.title = "Seek Audio Preview to this lineage mapping";
      item.addEventListener("click", () =>
        panel.dispatchEvent(
          new CustomEvent("vellum-seek-playback", {
            detail: { arrangementEventId: entry.arrangementEventIds[0] },
          })
        )
      );
    }
    list.append(item);
  }
  details.append(summary, list);
  header.append(details);
}

export function installAuditSummary(panel: HTMLElement, deliverable: GuidedDeliverable): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".preservation-audit-summary")?.remove();
  const details = document.createElement("details");
  details.className = "preservation-audit-summary";
  const summary = document.createElement("summary");
  summary.textContent = `Preservation Audit · ${deliverable.preservationAudit.status.replaceAll("_", " ")} · ${deliverable.preservationAudit.targetIds.length} targets`;
  const list = document.createElement("ul");
  if (deliverable.continuoDisposition) {
    const disposition = document.createElement("p");
    disposition.className = "continuo-disposition";
    disposition.textContent = `${deliverable.continuoDisposition.label}. ${deliverable.continuoDisposition.soundedFoundationEventIds.length} foundation events sounded; ${deliverable.continuoDisposition.unsoundedFoundationEventIds.length} unsounded.`;
    details.append(summary, disposition);
  }
  for (const targetId of deliverable.preservationAudit.targetIds) {
    const item = document.createElement("li");
    item.dataset.auditTargetIds = targetId;
    const findings = deliverable.preservationAudit.findings.filter(
      (finding) => finding.targetId === targetId
    );
    item.textContent = findings.length
      ? `${targetId}: ${findings.map((finding) => `${finding.code} — ${finding.message}`).join("; ")}`
      : `${targetId}: passed`;
    item.tabIndex = 0;
    item.addEventListener("click", () =>
      panel.dispatchEvent(
        new CustomEvent("vellum-seek-playback", { detail: { auditTargetId: targetId } })
      )
    );
    list.append(item);
  }
  if (!details.contains(summary)) details.append(summary);
  details.append(list);
  header.append(details);
}

export function installArrangementPlanSummary(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  const plan = deliverable.arrangementPlan;
  if (!header || !plan) return;
  header.querySelector(".arrangement-plan-summary")?.remove();
  const details = document.createElement("details");
  details.className = "arrangement-plan-summary";
  details.dataset.planId = plan.id;
  const summary = document.createElement("summary");
  const confirmations = plan.decisions.filter(
    (decision) =>
      decision.confirmation.requirement === "owner" && decision.confirmation.status === "proposed"
  );
  summary.textContent = `Arrangement Plan · ${plan.kind.replaceAll("_", " ")} · ${confirmations.length ? `${confirmations.length} consequential choices` : "ready without questions"}`;
  const scope = document.createElement("p");
  scope.textContent = `${plan.sectionalIntent.length} passage intentions; transposition ${plan.transpositionPlan.status === "resolved" ? `${plan.transpositionPlan.semitones} semitones` : "unresolved"}.`;
  const list = document.createElement("ul");
  for (const decision of plan.decisions) {
    const item = document.createElement("li");
    item.textContent = `${decision.dimension.replaceAll("_", " ")}: ${decision.selectedValue.replaceAll("_", " ")}. ${decision.rationale}`;
    if (
      decision.confirmation.requirement === "owner" &&
      decision.confirmation.status === "proposed"
    ) {
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.textContent = "Confirm consequential choice";
      confirm.addEventListener("click", async () => {
        confirm.disabled = true;
        const decisions = plan.decisions.map((candidate) =>
          candidate.id === decision.id
            ? {
                ...candidate,
                confirmation: {
                  requirement: "owner" as const,
                  status: "confirmed" as const,
                  confirmedAt: new Date().toISOString(),
                },
              }
            : candidate
        );
        try {
          const result = await api<{ plan: ArrangementPlan }>(
            `/api/workspaces/${deliverable.workspaceId}/arrangement-plans/${plan.id}/corrections`,
            {
              method: "POST",
              body: JSON.stringify({
                reason: `Owner confirmed Plan Decision ${decision.id}`,
                correction: {
                  kind: plan.kind,
                  planningScope: plan.planningScope,
                  transpositionPlan: plan.transpositionPlan,
                  sectionalIntent: plan.sectionalIntent,
                  materialDisposition: plan.materialDisposition,
                  specialistIntent: plan.specialistIntent,
                  decisions,
                  status: decisions.some(
                    (candidate) =>
                      candidate.confirmation.requirement === "owner" &&
                      candidate.confirmation.status === "proposed"
                  )
                    ? "confirmation_required"
                    : "ready",
                },
              }),
            }
          );
          deliverable.arrangementPlan = result.plan;
          installArrangementPlanSummary(panel, deliverable);
        } catch (error) {
          confirm.disabled = false;
          confirm.title = error instanceof Error ? error.message : "Confirmation failed";
        }
      });
      item.append(" ", confirm);
    }
    list.append(item);
  }
  details.append(summary, scope, list);
  header.append(details);
}

export function installDeliverableSummary(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".deliverable-summary")?.remove();
  const details = document.createElement("details");
  details.className = "deliverable-summary";
  const summary = document.createElement("summary");
  summary.textContent = `Arrangement Family · ${deliverable.arrangementFamilyId} · ${deliverable.deliverables.length} versioned deliverables`;
  const list = document.createElement("ul");
  for (const item of deliverable.deliverables) {
    const row = document.createElement("li");
    row.textContent = `${item.kind.replaceAll("_", " ")} · ${item.notationLayout} · Arrangement Score v${item.arrangementScoreVersion} · ${item.sha256.slice(0, 10)}`;
    list.append(row);
  }
  details.append(summary, list);
  header.append(details);
}

export async function installEvaluationCard(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): Promise<void> {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".evaluation-card")?.remove();
  const card = await api<{
    hardGateStatus: "pass" | "fail";
    sourceTruthAssessmentId: string;
    arrangementPlanId: string;
    performanceBriefId: string;
    dimensions: Array<{
      id: string;
      status: "pass" | "fail" | "unknown" | "not_evaluated";
      hardGate: boolean;
      evidenceIds: string[];
      rationale: string;
    }>;
  }>(
    `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/evaluation-card`
  );
  const details = document.createElement("details");
  details.className = "evaluation-card";
  details.dataset.arrangementPlanId = card.arrangementPlanId;
  details.dataset.sourceTruthAssessmentId = card.sourceTruthAssessmentId;
  details.dataset.performanceBriefId = card.performanceBriefId;
  const summary = document.createElement("summary");
  const unknown = card.dimensions.filter(
    (dimension) => dimension.status === "unknown" || dimension.status === "not_evaluated"
  ).length;
  summary.textContent = `Evaluation Card · hard gates ${card.hardGateStatus} · ${unknown} explicitly unknown`;
  const list = document.createElement("ul");
  for (const dimension of card.dimensions) {
    const item = document.createElement("li");
    item.dataset.evaluationDimension = dimension.id;
    item.dataset.status = dimension.status;
    item.textContent = `${dimension.id.replaceAll("_", " ")} — ${dimension.status.replaceAll("_", " ")}${dimension.hardGate ? " (hard gate)" : ""}. ${dimension.rationale}`;
    list.append(item);
  }
  details.append(summary, list);
  header.append(details);
}

type ArrangementLineage = {
  staleDerivations: Array<{
    id: string;
    reason: string;
    acknowledged: boolean;
    changedObjectIds?: string[];
    currentInputVersions: Array<{ recordType: string; recordId: string; version: number }>;
  }>;
  editorialCommitments: Array<{
    id: string;
    status: "active" | "released";
    scope: { dimension: string; objectIds: string[] };
  }>;
  familyCommitments: Array<{ id: string; status: string; scope: { dimension: string } }>;
  conflicts: Array<{ id: string; status: string; consequence: string }>;
  policyExceptions: Array<{ id: string; musicalConsequence: string; rationale: string }>;
};

export async function installLineageSummary(
  panel: HTMLElement,
  deliverable: GuidedDeliverable
): Promise<void> {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  header.querySelector(".lineage-summary")?.remove();
  const lineage = await api<ArrangementLineage>(
    `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/lineage`
  );
  const details = document.createElement("details");
  details.className = "lineage-summary";
  const summary = document.createElement("summary");
  const activeCommitments = lineage.editorialCommitments.filter(
    (record) => record.status === "active"
  );
  summary.textContent = `${lineage.staleDerivations.some((record) => !record.acknowledged) ? "Stale derivation" : "Current lineage"} · ${activeCommitments.length} editorial commitments`;
  details.append(summary);
  for (const stale of lineage.staleDerivations.filter((record) => !record.acknowledged)) {
    const section = document.createElement("section");
    section.className = "stale-derivation";
    const explanation = document.createElement("p");
    explanation.textContent = stale.reason;
    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.textContent = "Conservative regenerate";
    const currentScore = stale.currentInputVersions.find(
      (record) => record.recordType === "normalized_score"
    );
    regenerate.disabled = !currentScore || !stale.changedObjectIds?.length;
    regenerate.addEventListener("click", async () => {
      await api(
        `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/conservative-regeneration`,
        {
          method: "POST",
          body: JSON.stringify({
            normalizedScoreId: currentScore!.recordId,
            changedSourceEventIds: stale.changedObjectIds,
          }),
        }
      );
      window.location.reload();
    });
    const fresh = document.createElement("button");
    fresh.type = "button";
    fresh.textContent = "Fresh Arrangement Search";
    fresh.addEventListener("click", () =>
      document.querySelector<HTMLButtonElement>("#guided-start-launcher")?.click()
    );
    const acknowledge = document.createElement("button");
    acknowledge.type = "button";
    acknowledge.textContent = "Keep preserved prior version";
    acknowledge.addEventListener("click", async () => {
      await api(
        `/api/workspaces/${deliverable.workspaceId}/stale-derivations/${stale.id}/acknowledge`,
        { method: "POST" }
      );
      await installLineageSummary(panel, deliverable);
    });
    section.append(explanation, regenerate, fresh, acknowledge);
    details.append(section);
  }
  for (const commitment of activeCommitments) {
    const row = document.createElement("p");
    row.textContent = `${commitment.scope.dimension.replaceAll("_", " ")} · ${commitment.scope.objectIds.length} objects`;
    const release = document.createElement("button");
    release.type = "button";
    release.textContent = "Let Vellum reconsider";
    release.addEventListener("click", async () => {
      await api(`/api/workspaces/${deliverable.workspaceId}/commitments/${commitment.id}/release`, {
        method: "POST",
      });
      await installLineageSummary(panel, deliverable);
    });
    row.append(" ", release);
    details.append(row);
  }
  for (const conflict of lineage.conflicts.filter((record) => record.status === "unresolved")) {
    const row = document.createElement("p");
    row.textContent = `${conflict.consequence} Resolve by releasing the commitment, revising the Score Transcription, or approving a scoped Policy Exception.`;
    details.append(row);
  }
  header.append(details);
}

export function midiFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function sourceFocusUrl(
  sourceContentUrl: string,
  region: TranscriptionUncertainty["region"]
): string {
  if (!region) return sourceContentUrl;
  const x = Math.max(0, Math.round(region.x));
  const y = Math.max(0, Math.round(region.y));
  return `${sourceContentUrl}#page=${region.page}&zoom=180,${x},${y}`;
}

export function isolateArtifactFrame(frame: HTMLIFrameElement): void {
  frame.setAttribute("sandbox", "");
  frame.setAttribute("referrerpolicy", "no-referrer");
}

export async function resolveCriticalUncertainties(
  dialog: HTMLDialogElement,
  workspaceId: string,
  initialTranscriptionId: string,
  initialNormalizedScoreId: string,
  initialTranscriptionVersion = 1,
  initialNormalizedScoreVersion = 1
): Promise<{
  transcriptionId: string;
  transcriptionVersion: number;
  normalizedScoreId: string;
  normalizedScoreVersion: number;
}> {
  let transcriptionId = initialTranscriptionId;
  let normalizedScoreId = initialNormalizedScoreId;
  let transcriptionVersion = initialTranscriptionVersion;
  let normalizedScoreVersion = initialNormalizedScoreVersion;

  while (true) {
    const review = await api<ScoreAnchoredReview>(
      `/api/workspaces/${workspaceId}/transcriptions/${transcriptionId}/review`
    );
    const item = review.items[0];
    if (!item) {
      hideScoreAnchoredReview(dialog);
      return {
        transcriptionId,
        transcriptionVersion,
        normalizedScoreId,
        normalizedScoreVersion,
      };
    }

    let pendingCorrection: TranscriptionCorrection | undefined;
    let correctionFailure: string | undefined;
    while (true) {
      const correction = await presentScoreAnchoredReview(
        dialog,
        review,
        item,
        pendingCorrection,
        correctionFailure
      );
      try {
        const result = await api<CorrectionResult>(
          `/api/workspaces/${workspaceId}/transcriptions/${transcriptionId}/corrections`,
          { method: "POST", body: JSON.stringify(correction) }
        );
        transcriptionId = result.scoreTranscription.id;
        transcriptionVersion = result.scoreTranscription.version;
        normalizedScoreId = result.normalizedScore.id;
        normalizedScoreVersion = result.normalizedScore.version;
        break;
      } catch (error) {
        pendingCorrection = correction;
        correctionFailure = `${error instanceof Error ? error.message : "The correction could not be saved."} Your edits are still here; retry when ready.`;
      }
    }
  }
}

export function presentScoreAnchoredReview(
  dialog: HTMLDialogElement,
  review: ScoreAnchoredReview,
  item: ScoreAnchoredReview["items"][number],
  pendingCorrection?: TranscriptionCorrection,
  correctionFailure?: string
): Promise<TranscriptionCorrection> {
  const panel = dialog.querySelector<HTMLElement>("[data-score-review]")!;
  const source = panel.querySelector<HTMLIFrameElement>("[data-review-source]")!;
  const sourceImage = panel.querySelector<HTMLImageElement>("[data-review-source-image]")!;
  const sourceHighlight = panel.querySelector<HTMLElement>("[data-review-source-highlight]")!;
  const sourceCanvas = panel.querySelector<HTMLElement>("[data-review-source-canvas]")!;
  const zoomOut = panel.querySelector<HTMLButtonElement>("[data-review-zoom-out]")!;
  const zoomReset = panel.querySelector<HTMLButtonElement>("[data-review-zoom-reset]")!;
  const zoomIn = panel.querySelector<HTMLButtonElement>("[data-review-zoom-in]")!;
  const zoomValue = panel.querySelector<HTMLElement>("[data-review-zoom-value]")!;
  const heading = panel.querySelector<HTMLElement>("[data-review-heading]")!;
  const message = panel.querySelector<HTMLElement>("[data-review-message]")!;
  const location = panel.querySelector<HTMLElement>("[data-review-location]")!;
  const acceptance = panel.querySelector<HTMLElement>("[data-review-acceptance]")!;
  const editors = panel.querySelector<HTMLElement>("[data-review-editors]")!;
  const suggestions = panel.querySelector<HTMLElement>("[data-review-suggestions]")!;
  const rationale = panel.querySelector<HTMLInputElement>("[data-review-rationale]")!;
  const apply = panel.querySelector<HTMLButtonElement>("[data-review-apply]")!;
  const cancel = panel.querySelector<HTMLButtonElement>("[data-review-cancel]")!;
  const error = panel.querySelector<HTMLElement>("[data-review-error]")!;
  const status = dialog.querySelector<HTMLElement>("[data-guided-status]");
  const region = item.uncertainty.region;

  isolateArtifactFrame(source);
  panel.hidden = false;
  dialog.classList.add("review-active");
  setGuidedNavigationDisabled(dialog, true);
  if (status) {
    status.textContent =
      "Arrangement paused for this critical uncertainty. Apply a correction or cancel this run.";
  }
  if (item.sourceImageUrl && region?.coordinateSpace === "omr_raster") {
    source.hidden = true;
    source.removeAttribute("src");
    sourceImage.hidden = false;
    sourceImage.src = item.sourceImageUrl;
    sourceImage.alt = `${review.sourceFilename}, Audiveris source page ${region.page}`;
    let zoom = 1;
    const updateZoom = () => {
      sourceCanvas.style.width = `${zoom * 100}%`;
      zoomValue.textContent = `${Math.round(zoom * 100)}%`;
      zoomOut.disabled = zoom <= 1;
      zoomIn.disabled = zoom >= 4;
    };
    zoomOut.onclick = () => {
      zoom = Math.max(1, zoom - 0.5);
      updateZoom();
    };
    zoomReset.onclick = () => {
      zoom = 1;
      updateZoom();
    };
    zoomIn.onclick = () => {
      zoom = Math.min(4, zoom + 0.5);
      updateZoom();
    };
    updateZoom();
    sourceImage.onload = () => {
      sourceHighlight.hidden = false;
      sourceHighlight.style.left = `${(region.x / sourceImage.naturalWidth) * 100}%`;
      sourceHighlight.style.top = `${(region.y / sourceImage.naturalHeight) * 100}%`;
      sourceHighlight.style.width = `${(region.width / sourceImage.naturalWidth) * 100}%`;
      sourceHighlight.style.height = `${(region.height / sourceImage.naturalHeight) * 100}%`;
    };
  } else {
    sourceCanvas.style.width = "100%";
    sourceImage.hidden = true;
    sourceImage.removeAttribute("src");
    sourceHighlight.hidden = true;
    source.hidden = false;
    source.src = sourceFocusUrl(review.sourceContentUrl, region);
    source.title = `${review.sourceFilename}, source page ${region?.page ?? 1}`;
  }
  heading.textContent = `Review transcription v${review.version}`;
  message.textContent = item.uncertainty.message;
  location.textContent = region
    ? `Source page ${region.page}, region x ${region.x}, y ${region.y}, ${region.width} × ${region.height}`
    : "The recognition backend did not supply a precise source region.";
  acceptance.hidden = review.acceptanceBatches.length === 0;
  acceptance.textContent = review.acceptanceBatches
    .map(
      (batch) =>
        `OCR policy · ${Math.round(batch.threshold * 100)}% threshold · ${batch.accepted.length} accepted · ${batch.notAccepted.length} retained for review · ${batch.backendId} ${batch.backendVersion} · ${batch.omrRunId}`
    )
    .join("; ");
  rationale.value =
    pendingCorrection?.rationale ??
    "Confirmed against the source facsimile in Score-Anchored Review.";
  error.textContent = correctionFailure ?? "";
  apply.disabled = false;
  apply.textContent = correctionFailure
    ? "Retry correction and continue"
    : "Apply correction and continue";
  editors.replaceChildren();
  suggestions.replaceChildren();

  const editableNotes = item.events.filter(
    (event): event is Extract<ScoreEvent, { type: "note" }> => event.type === "note"
  );
  const recommendedVoices = recommendedVoiceAssignments(editableNotes);
  for (const event of editableNotes) {
    const label = document.createElement("label");
    label.textContent = `Recognized pitch · ${event.id}${event.confidence !== undefined ? ` · confidence ${(event.confidence * 100).toFixed(1)}%` : " · confidence unavailable"}`;
    const input = document.createElement("input");
    input.type = "text";
    input.value =
      pendingCorrection?.eventEdits.find((edit) => edit.eventId === event.id)?.pitch ?? event.pitch;
    input.pattern = "[A-G](?:#|b)?-?\\d+";
    input.dataset.reviewEventId = event.id;
    label.append(input);
    editors.append(label);
    if (item.uncertainty.category === "voice_identity") {
      const voiceLabel = document.createElement("label");
      voiceLabel.textContent = `Voice assignment · ${event.id}`;
      const voice = document.createElement("select");
      voice.dataset.reviewVoiceEventId = event.id;
      voice.dataset.recognizedPartId = event.partId;
      const recognized = document.createElement("option");
      recognized.value = event.partId;
      recognized.textContent = "Keep recognized chordal voice";
      voice.append(recognized);
      for (const role of ["soprano", "alto", "tenor", "bass"] as const) {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role[0]!.toUpperCase() + role.slice(1);
        voice.append(option);
      }
      voice.value =
        pendingCorrection?.eventEdits.find((edit) => edit.eventId === event.id)?.partRole ??
        recommendedVoices.get(event.id) ??
        "soprano";
      voiceLabel.append(voice);
      editors.append(voiceLabel);
    }
  }

  item.uncertainty.alternatives.forEach((alternative, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${alternative}`;
    button.addEventListener("click", () => {
      if (item.uncertainty.category === "voice_identity" && index === 0) {
        editors
          .querySelectorAll<HTMLSelectElement>("[data-review-voice-event-id]")
          .forEach((select) => {
            select.value = recommendedVoices.get(select.dataset.reviewVoiceEventId!) ?? "soprano";
          });
      } else if (item.uncertainty.category === "voice_identity" && index === 1) {
        editors
          .querySelectorAll<HTMLSelectElement>("[data-review-voice-event-id]")
          .forEach((select) => {
            select.value = select.dataset.recognizedPartId!;
          });
      } else if (item.uncertainty.category !== "voice_identity") {
        const first = editors.querySelector<HTMLInputElement>("input");
        if (first) first.value = alternative;
      }
    });
    suggestions.append(button);
  });

  return new Promise((resolve, reject) => {
    cancel.onclick = () => {
      apply.onclick = null;
      cancel.onclick = null;
      hideScoreAnchoredReview(dialog);
      reject(new Error("Arrangement stopped before transcription review was completed."));
    };
    apply.onclick = () => {
      const inputs = Array.from(
        editors.querySelectorAll<HTMLInputElement>("[data-review-event-id]")
      );
      if (inputs.length === 0) {
        error.textContent = "This uncertainty has no editable note event.";
        return;
      }
      if (inputs.some((input) => !input.checkValidity())) {
        error.textContent = "Use scientific pitch notation such as E4, F#4, or Bb3.";
        return;
      }
      const explanation = rationale.value.trim();
      if (!explanation) {
        error.textContent = "Record why this correction was accepted.";
        return;
      }
      apply.onclick = null;
      cancel.onclick = null;
      apply.disabled = true;
      apply.textContent = "Saving correction…";
      resolve({
        correctionId:
          pendingCorrection?.correctionId ?? `correction.${globalThis.crypto.randomUUID()}`,
        uncertaintyId: item.uncertainty.id,
        eventEdits: inputs.map((input) => {
          const voice = editors.querySelector<HTMLSelectElement>(
            `[data-review-voice-event-id="${input.dataset.reviewEventId}"]`
          );
          const role = ["soprano", "alto", "tenor", "bass"].includes(voice?.value ?? "")
            ? (voice!.value as "soprano" | "alto" | "tenor" | "bass")
            : undefined;
          return {
            eventId: input.dataset.reviewEventId!,
            pitch: input.value.trim(),
            ...(role
              ? {
                  partId: `part.reviewed-${role}`,
                  partName: role[0]!.toUpperCase() + role.slice(1),
                  partRole: role,
                }
              : voice
                ? { partId: voice.value }
                : {}),
          };
        }),
        rationale: explanation,
      });
    };
  });
}

export function recommendedVoiceAssignments(
  events: Array<Extract<ScoreEvent, { type: "note" }>>
): Map<string, "soprano" | "alto" | "tenor" | "bass"> {
  assertAuthorityPathRuntime("authority.validator.source-interpretation", "production");
  const groups = new Map<string, Array<Extract<ScoreEvent, { type: "note" }>>>();
  for (const event of events) {
    const key = `${event.measureId}:${event.onset.numerator}/${event.onset.denominator}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const assignments = new Map<string, "soprano" | "alto" | "tenor" | "bass">();
  const roles = ["soprano", "alto", "tenor", "bass"] as const;
  for (const group of groups.values()) {
    group
      .sort((left, right) => noteToMidi(right.pitch) - noteToMidi(left.pitch))
      .forEach((event, index) => assignments.set(event.id, roles[Math.min(index, 3)]!));
  }
  return assignments;
}

function hideScoreAnchoredReview(dialog: HTMLDialogElement): void {
  const panel = dialog.querySelector<HTMLElement>("[data-score-review]");
  if (!panel) return;
  panel.hidden = true;
  dialog.classList.remove("review-active");
  setGuidedNavigationDisabled(dialog, false);
  const source = panel.querySelector<HTMLIFrameElement>("[data-review-source]");
  if (source) source.removeAttribute("src");
  const sourceImage = panel.querySelector<HTMLImageElement>("[data-review-source-image]");
  if (sourceImage) sourceImage.removeAttribute("src");
  const sourceHighlight = panel.querySelector<HTMLElement>("[data-review-source-highlight]");
  if (sourceHighlight) sourceHighlight.hidden = true;
}

function setGuidedNavigationDisabled(dialog: HTMLDialogElement, disabled: boolean): void {
  for (const control of dialog.querySelectorAll<HTMLButtonElement>("[data-guided-skip]")) {
    control.disabled = disabled;
  }
}

type PreviewPlayback = { stop: (preservePosition: boolean) => void };

function playPreview(
  preview: AudioPreview,
  options: {
    fromSeconds: number;
    speed: number;
    volume: number;
    loopStart: number;
    loopEnd: number;
    partState: Map<Exclude<PlaybackPart, "full">, { mute: boolean; solo: boolean; level: number }>;
    onProgress: (seconds: number, activeEvents?: PlaybackEvent[]) => void;
    onEnded: () => void;
  }
): PreviewPlayback {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = options.volume * 0.35;
  master.connect(context.destination);
  const start = context.currentTime + 0.05;
  const oscillators: OscillatorNode[] = [];
  const soloed = [...options.partState.values()].some((state) => state.solo);
  const playbackEnd = Math.min(preview.durationSeconds, options.loopEnd);
  for (const event of preview.events) {
    const state = options.partState.get(event.part);
    if (!state || state.mute || (soloed && !state.solo) || state.level === 0) continue;
    const eventEnd = event.startSeconds + event.durationSeconds;
    if (eventEnd <= options.fromSeconds || event.startSeconds >= playbackEnd) continue;
    const audibleStart = Math.max(event.startSeconds, options.fromSeconds);
    const audibleEnd = Math.min(eventEnd, playbackEnd);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = midiFrequency(event.midi);
    const scheduledStart = start + (audibleStart - options.fromSeconds) / options.speed;
    const scheduledEnd = start + (audibleEnd - options.fromSeconds) / options.speed;
    envelope.gain.setValueAtTime(0, scheduledStart);
    envelope.gain.linearRampToValueAtTime(state.level * 0.8, scheduledStart + 0.01);
    envelope.gain.setValueAtTime(
      state.level * 0.8,
      Math.max(scheduledStart + 0.01, scheduledEnd - 0.03)
    );
    envelope.gain.linearRampToValueAtTime(0, scheduledEnd);
    oscillator.connect(envelope).connect(master);
    oscillator.start(scheduledStart);
    oscillator.stop(scheduledEnd + 0.01);
    oscillators.push(oscillator);
  }
  let stopped = false;
  let frame = 0;
  const tick = () => {
    if (stopped) return;
    const current = Math.min(
      playbackEnd,
      options.fromSeconds + Math.max(0, context.currentTime - start) * options.speed
    );
    const activeEvents = preview.events.filter(
      (event) =>
        event.startSeconds <= current && current < event.startSeconds + event.durationSeconds
    );
    options.onProgress(current, activeEvents);
    if (current >= playbackEnd) {
      stopNodes();
      if (options.loopEnd < preview.durationSeconds) {
        options.onProgress(options.loopStart);
      }
      options.onEnded();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
  const stopNodes = () => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(frame);
    for (const oscillator of oscillators) {
      try {
        oscillator.stop();
      } catch {
        /* already stopped */
      }
    }
    void context.close();
  };
  return {
    stop: (preservePosition) => {
      const current = Math.min(
        playbackEnd,
        options.fromSeconds + Math.max(0, context.currentTime - start) * options.speed
      );
      stopNodes();
      if (preservePosition) options.onProgress(current);
    },
  };
}

export function highlightLineage(
  panel: HTMLElement,
  events: PlaybackEvent[],
  preview?: AudioPreview
): void {
  const dimensions = {
    arrangementEventIds: new Set(events.map((event) => event.arrangementEventId)),
    sourceEventIds: new Set(events.flatMap((event) => event.sourceEventIds)),
    transformationIds: new Set(events.flatMap((event) => event.transformationEntryIds)),
    auditTargetIds: new Set(events.flatMap((event) => event.auditTargetIds)),
  };
  panel
    .querySelectorAll<HTMLElement>(
      "[data-arrangement-event-id], [data-arrangement-event-ids], [data-source-event-ids], [data-transformation-id], [data-audit-target-ids]"
    )
    .forEach((element) => {
      const active =
        datasetMatches(element.dataset.arrangementEventId, dimensions.arrangementEventIds) ||
        datasetMatches(element.dataset.arrangementEventIds, dimensions.arrangementEventIds) ||
        datasetMatches(element.dataset.sourceEventIds, dimensions.sourceEventIds) ||
        datasetMatches(element.dataset.transformationId, dimensions.transformationIds) ||
        datasetMatches(element.dataset.auditTargetIds, dimensions.auditTargetIds);
      element.classList.toggle("playback-active", active);
      if (element.dataset.arrangementEventId) {
        const event = events.find(
          (candidate) => candidate.arrangementEventId === element.dataset.arrangementEventId
        );
        element.classList.toggle("playback-principal-active", event?.part === "principal-voice");
      }
    });
  const notation = panel.querySelector<SVGSVGElement>(".artifact-preview-content > svg");
  if (!notation) return;
  const activeOccurrenceId = events[0]?.measureOccurrenceId;
  const activeMeasureId = activeOccurrenceId
    ? preview?.performedForm.measureOccurrences.find((item) => item.id === activeOccurrenceId)
        ?.measureId
    : undefined;
  const measureGroups = notation.querySelectorAll<SVGGElement>("[data-measure-id]");
  let activeMeasure: SVGGElement | undefined;
  for (const group of measureGroups) {
    const active = Boolean(activeMeasureId && group.dataset.measureId === activeMeasureId);
    group.classList.toggle("playback-measure-active", active);
    if (active && !activeMeasure) activeMeasure = group;
  }
  const activeEventId = events[0]?.arrangementEventId;
  const activeEvent = activeEventId
    ? notation.querySelector<SVGGElement>(
        `[data-arrangement-event-id="${CSS.escape(activeEventId)}"]`
      )
    : undefined;
  let marker = notation.querySelector<SVGLineElement>(".score-playhead");
  if (!activeMeasure || !activeOccurrenceId) {
    marker?.remove();
    notation.removeAttribute("data-playback-occurrence-id");
    followedMeasureOccurrences.delete(panel);
    return;
  }
  notation.dataset.playbackOccurrenceId = activeOccurrenceId;
  if (!marker) {
    marker = document.createElementNS("http://www.w3.org/2000/svg", "line");
    marker.classList.add("score-playhead");
    notation.append(marker);
  }
  const measureBox = activeMeasure.getBBox();
  const eventBox = activeEvent?.getBBox();
  const x = (eventBox ?? measureBox).x - 0.7;
  marker.setAttribute("x1", String(x));
  marker.setAttribute("x2", String(x));
  marker.setAttribute("y1", String(measureBox.y - 1.2));
  marker.setAttribute("y2", String(measureBox.y + measureBox.height + 1.2));
  if (followedMeasureOccurrences.get(panel) !== activeOccurrenceId) {
    followedMeasureOccurrences.set(panel, activeOccurrenceId);
    activeMeasure.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
}

function datasetMatches(value: string | undefined, active: Set<string>): boolean {
  return (value ?? "")
    .split(" ")
    .filter(Boolean)
    .some((id) => active.has(id));
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export async function installProviderConnection(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-provider-status]");
  const connect = root.querySelector<HTMLButtonElement>("[data-provider-connect]");
  const disconnect = root.querySelector<HTMLButtonElement>("[data-provider-disconnect]");
  const promptPanel = root.querySelector<HTMLElement>("[data-provider-prompt]");
  const promptMessage = root.querySelector<HTMLElement>("[data-provider-prompt-message]");
  const promptInput = root.querySelector<HTMLInputElement>("[data-provider-prompt-input]");
  const promptSubmit = root.querySelector<HTMLButtonElement>("[data-provider-prompt-submit]");
  const promptCancel = root.querySelector<HTMLButtonElement>("[data-provider-prompt-cancel]");
  if (
    !status ||
    !connect ||
    !disconnect ||
    !promptPanel ||
    !promptMessage ||
    !promptInput ||
    !promptSubmit ||
    !promptCancel
  )
    return;
  let lastState = "disconnected";
  const refresh = async () => {
    const current = await api<{
      state: string;
      error?: string;
      prompt?: { message: string; placeholder?: string; allowEmpty?: boolean };
    }>("/api/provider-connection");
    lastState = current.state;
    status.textContent = current.error ? `${current.state}: ${current.error}` : current.state;
    connect.hidden = current.state === "connected" || current.state === "refreshing";
    connect.textContent =
      current.state === "connecting"
        ? "Continue ChatGPT login"
        : current.state === "expired" || current.error
          ? "Reconnect"
          : "Connect ChatGPT";
    disconnect.hidden = !["connected", "expired", "refreshing"].includes(current.state);
    promptPanel.hidden = !current.prompt;
    promptMessage.textContent = current.prompt?.message ?? "";
    promptInput.placeholder = current.prompt?.placeholder ?? "Paste the final redirect URL";
    promptInput.disabled = !current.prompt;
    promptInput.required = Boolean(current.prompt && !current.prompt.allowEmpty);
    return current;
  };
  connect.addEventListener("click", async () => {
    connect.disabled = true;
    const popup = window.open("about:blank", "vellum-chatgpt-login", "popup,width=680,height=760");
    try {
      const endpoint =
        lastState === "expired"
          ? "/api/provider-connection/reconnect"
          : "/api/provider-connection/login";
      const login = await api<{ authUrl?: string }>(endpoint, {
        method: "POST",
      });
      if (login.authUrl && popup) popup.location.href = login.authUrl;
      const timer = window.setInterval(async () => {
        const current = await refresh();
        if (current.state === "connected" || current.error) {
          window.clearInterval(timer);
          if (current.state === "connected") popup?.close();
        }
      }, 1_000);
    } catch (error) {
      popup?.close();
      status.textContent = error instanceof Error ? error.message : "Could not start ChatGPT login";
    } finally {
      connect.disabled = false;
    }
  });
  promptSubmit.addEventListener("click", async () => {
    const value = promptInput.value.trim();
    if (promptInput.required && value.length === 0) {
      status.textContent = "Paste the final redirect URL to finish connecting";
      return;
    }
    promptSubmit.disabled = true;
    try {
      await api("/api/provider-connection/prompt", {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      promptInput.value = "";
      await refresh();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Invalid provider callback";
    } finally {
      promptSubmit.disabled = false;
    }
  });
  promptCancel.addEventListener("click", async () => {
    await api("/api/provider-connection", { method: "DELETE" });
    promptInput.value = "";
    await refresh();
  });
  disconnect.addEventListener("click", async () => {
    await api("/api/provider-connection", { method: "DELETE" });
    await refresh();
  });
  await refresh();
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const envelope = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !isApiSuccess<T>(envelope)) {
    throw apiErrorFromResponse(response.status, envelope);
  }
  return envelope.data;
}

export function sourceMimeType(file: Pick<File, "name" | "type">): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (["musicxml", "xml", "mxl"].includes(extension ?? ""))
    return "application/vnd.recordare.musicxml+xml";
  if (extension === "ly") return "text/x-lilypond";
  if (extension === "abc") return "text/vnd.abc";
  if (extension === "mei") return "application/mei+xml";
  if (extension === "mscz") return "application/vnd.musescore.mscz";
  throw new Error(`Unsupported musical source extension: ${extension ?? "unknown"}`);
}

export function isOpticalSource(file: Pick<File, "name" | "type">): boolean {
  const mimeType = sourceMimeType(file);
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

export function guidedStartMarkup(): string {
  assertAuthorityPathRuntime("authority.parameter.arrangement-defaults", "production");
  return `
    <form>
      <header><p>Guided Start</p><h1>Turn a score into a playable arrangement</h1><button type="button" data-guided-skip aria-label="Close">×</button></header>
      <section class="provider-connection"><div><strong>ChatGPT connection</strong><span data-provider-status>Checking…</span></div><button type="button" data-provider-connect>Connect ChatGPT</button><button type="button" data-provider-disconnect hidden>Log out</button><div data-provider-prompt hidden><label><span data-provider-prompt-message></span><input type="url" data-provider-prompt-input autocomplete="off" disabled></label><button type="button" data-provider-prompt-submit>Finish connection</button><button type="button" data-provider-prompt-cancel>Cancel login</button></div></section>
      <section class="model-action-recovery" data-model-action-recovery hidden><strong>Interrupted model work</strong><p>Nothing has been committed from these incomplete attempts. Review the retained boundary and choose how to continue.</p><div data-model-action-items></div></section>
      <section class="guided-workflow-recovery" data-guided-workflow-recovery hidden><strong>Resume Guided Start</strong><p data-guided-workflow-message></p><div><button type="button" data-guided-workflow-resume>Resume retained work</button><button type="button" data-guided-workflow-restart>Restart from source</button></div></section>
      <label>1. Upload musical source<input type="file" accept=".pdf,.png,.jpg,.jpeg,.musicxml,.xml,.mxl,.ly,.abc,.mei,.mscz,application/pdf,image/*" required><small>PDF and images use Audiveris review; MusicXML, restricted LilyPond, ABC, MEI, and MSCZ are parsed through their disclosed adapters.</small></label>
      <label>Title<input name="title" placeholder="Taken from the filename if blank"></label>
      <label data-ocr-threshold-field hidden>OCR auto-accept confidence <span data-ocr-threshold-value>80%</span><input type="range" name="ocrAutoAcceptConfidence" min="50" max="100" step="1" value="80"><small>Automatically accept OCR notes at or above this confidence. Lower this to 70% to accept a 72% note; voice identity and structurally abnormal readings still require review.</small></label>
      <fieldset><legend>2. Output format(s)</legend><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar" checked> <span><strong>5-course baroque guitar</strong><small>French letter tablature · French stringing · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-lute"> <span><strong>13-course baroque lute</strong><small>French letter tablature · default D-minor tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.renaissance-lute"> <span><strong>6-course Renaissance lute</strong><small>French letter tablature · polyphonic lineage preservation · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.classical-guitar"> <span><strong>Classical guitar</strong><small>Standard notation · standard EADGBE tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.piano-continuo"> <span><strong>Soprano + piano continuo</strong><small>For figured-bass sources · complete Italian Baroque realization · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar-continuo"> <span><strong>Soprano + baroque guitar + bass</strong><small>For figured-bass sources · separate bass preserves the foundation the re-entrant guitar cannot sound</small></span></label><p>Select any combination to create independently searched and audited siblings from one saved analysis.</p></fieldset>
      <fieldset><legend>3. Relationship to the source</legend><label>Preservation Policy <select name="preservationPolicy"><option value="faithful_reduction" selected>Faithful Reduction — preserve the Principal Voice exactly</option><option value="idiomatic_adaptation">Idiomatic Adaptation — preserve recognizable phrases, contour, and cadences</option><option value="free_paraphrase">Free Paraphrase — use the source as thematic material</option></select></label><p>Faithful Reduction is the historical-source default. The full Transformation Report remains available under every policy.</p></fieldset>
      <fieldset><legend>4. Performance context</legend><p>These choices make “playable” and “difficult” specific to this arrangement.</p><label>Intended use <select name="intendedUse"><option value="study" selected>Study and learning</option><option value="sight_reading">Sight reading</option><option value="prepared_performance">Prepared performance</option><option value="accompaniment">Accompaniment</option><option value="edition">Edition</option></select></label><label>Performer level <select name="performerProficiency"><option value="elementary">Elementary</option><option value="intermediate" selected>Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select></label><label>Difficulty goal <select name="difficultyIntent"><option value="elementary">Elementary</option><option value="intermediate" selected>Intermediate</option><option value="advanced">Advanced</option><option value="unrestricted">Unrestricted</option></select></label><details data-performance-details><summary>Tempo, preparation, technique, and notation details</summary><div><label>Minimum tempo (BPM, optional)<input type="number" name="minimumBpm" min="1"></label><label>Maximum tempo (BPM, optional)<input type="number" name="maximumBpm" min="1"></label><label>Preparation <select name="preparationExpectation"><option value="immediate">Immediate</option><option value="practice_expected" selected>Practice expected</option><option value="performance_ready">Performance ready</option></select></label><label>Reliability <select name="reliabilityGoal"><option value="possible">Possible once</option><option value="repeatable" selected>Repeatable</option><option value="performance_reliable">Performance reliable</option></select></label><label>Familiar techniques<input name="techniqueFamiliarity" placeholder="Comma-separated, optional"></label><label>Allowed techniques<input name="allowedTechniques" placeholder="Comma-separated, optional"></label><label>Avoided techniques<input name="avoidedTechniques" placeholder="Comma-separated, optional"></label><label>Notation needs<input name="notationNeeds" value="target-appropriate notation" placeholder="Comma-separated"></label><label>Ensemble role<input name="ensembleRole" value="solo" required></label></div></details></fieldset>
      <label>Anything else? <span>(optional)</span><textarea name="instruction" rows="3" placeholder="For example: keep the texture full but prioritize easy fingering"></textarea></label>
      <section class="score-anchored-review" data-score-review hidden>
        <div class="score-review-heading"><div><p>Critical uncertainty</p><h2 data-review-heading>Review transcription</h2></div><span data-review-location></span></div><p data-review-acceptance hidden></p>
        <p data-review-message></p>
        <div class="score-review-grid">
          <div><div class="source-review-toolbar"><strong>Source facsimile</strong><span><button type="button" data-review-zoom-out aria-label="Zoom out source">−</button><button type="button" data-review-zoom-reset><span data-review-zoom-value>100%</span></button><button type="button" data-review-zoom-in aria-label="Zoom in source">+</button></span></div><div class="source-page-frame"><div class="source-page-canvas" data-review-source-canvas><img data-review-source-image hidden><span data-review-source-highlight hidden aria-label="Uncertain recognized symbol"></span></div><iframe data-review-source sandbox="" referrerpolicy="no-referrer"></iframe></div></div>
          <div class="score-review-notation"><strong>Recognized notation</strong><div data-review-editors></div><strong>Ranked suggestions</strong><div class="score-review-suggestions" data-review-suggestions></div><label>Review note<input type="text" data-review-rationale></label><p class="score-review-error" data-review-error></p><div class="score-review-actions"><button type="button" data-review-cancel>Cancel this run</button><button type="button" data-review-apply>Apply correction and continue</button></div></div>
        </div>
      </section>
      <section class="analysis-review" data-analysis-review hidden><div class="score-review-heading"><div><p>Musicological review required</p><h2>Choose the Principal Voice</h2></div></div><p data-analysis-question></p><p>This is the line Vellum will preserve as the recognizable melody. The full analysis remains inspectable later.</p><div class="analysis-review-choices" data-analysis-choices></div><button type="button" data-analysis-cancel>Cancel this run</button></section>
      <p class="guided-status" data-guided-status>Vellum will preserve the Principal Voice automatically and show any source uncertainty before arranging.</p>
      <footer><button type="button" data-guided-skip>Skip to chat</button><button type="submit">Start arrangement</button></footer>
    </form>`;
}

export function performanceBriefFromForm(form: HTMLFormElement): PerformanceBriefInput {
  assertAuthorityPathRuntime("authority.parameter.arrangement-defaults", "production");
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const value = (name: string) =>
    form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value.trim() ??
    "";
  const list = (name: string) =>
    value(name)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const minimum = value("minimumBpm");
  const maximum = value("maximumBpm");
  if ((minimum && !maximum) || (!minimum && maximum)) {
    throw new Error("Specify both minimum and maximum tempo, or leave both blank.");
  }
  if (minimum && Number(minimum) > Number(maximum)) {
    throw new Error("Minimum tempo cannot exceed maximum tempo.");
  }
  const allowed = list("allowedTechniques");
  const avoided = list("avoidedTechniques");
  return {
    intendedUse: value("intendedUse") as PerformanceBriefInput["intendedUse"],
    performerProfile: {
      proficiency: value(
        "performerProficiency"
      ) as PerformanceBriefInput["performerProfile"]["proficiency"],
      assumptionSource: "owner_declared",
      techniqueFamiliarity: list("techniqueFamiliarity"),
    },
    tempoContext:
      minimum && maximum
        ? { status: "specified", minimumBpm: Number(minimum), maximumBpm: Number(maximum) }
        : { status: "not_specified" },
    difficultyIntent: value("difficultyIntent") as PerformanceBriefInput["difficultyIntent"],
    preparationExpectation: value(
      "preparationExpectation"
    ) as PerformanceBriefInput["preparationExpectation"],
    reliabilityGoal: value("reliabilityGoal") as PerformanceBriefInput["reliabilityGoal"],
    techniqueContext:
      allowed.length || avoided.length
        ? { status: "specified", allowed, avoided }
        : { status: "unspecified" },
    notationContext: {
      needs: list("notationNeeds"),
      ensembleRole: value("ensembleRole"),
    },
  };
}

function defaultGuidedPerformanceBrief(): PerformanceBriefInput {
  return {
    intendedUse: "study",
    performerProfile: {
      proficiency: "intermediate",
      assumptionSource: "guided_start_default_pending_owner_review",
      techniqueFamiliarity: [],
    },
    tempoContext: { status: "not_specified" },
    difficultyIntent: "intermediate",
    preparationExpectation: "practice_expected",
    reliabilityGoal: "repeatable",
    techniqueContext: { status: "unspecified" },
    notationContext: { needs: ["target-appropriate notation"], ensembleRole: "solo" },
  };
}

export function targetConfiguration(id: string): TargetConfiguration {
  assertAuthorityPathRuntime("authority.parameter.arrangement-defaults", "production");
  if (id === "target.baroque-guitar") {
    return {
      id,
      instrumentId: "baroque-guitar-5",
      role: "solo",
      stringing: "french",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    };
  }
  if (id === "target.baroque-lute") {
    return {
      id,
      instrumentId: "baroque-lute-13",
      role: "solo",
      tuningId: "d_minor",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    };
  }
  if (id === "target.classical-guitar") {
    return {
      id,
      instrumentId: "classical-guitar-6",
      role: "solo",
      tuningId: "standard",
      notationLayouts: ["standard-notation"],
      deliverables: ["pdf", "audio-preview"],
    };
  }
  if (id === "target.renaissance-lute") {
    return {
      id,
      instrumentId: "renaissance-lute-6",
      role: "solo",
      tuningId: "renaissance-g",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    };
  }
  if (id === "target.piano-continuo") {
    return {
      id,
      instrumentId: "piano",
      role: "ensemble",
      realizationProfileId: "continuo.italian-baroque",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    };
  }
  if (id === "target.baroque-guitar-continuo") {
    return {
      id,
      instrumentId: "baroque-guitar-5",
      role: "ensemble",
      stringing: "french",
      realizationProfileId: "continuo.italian-baroque",
      continuoTreatment: "separate_bass",
      continuoBassInstrumentId: "voice-bass",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    };
  }
  throw new Error(`Unknown target configuration: ${id}`);
}

function targetLabel(id: string): string {
  if (id === "target.baroque-lute") return "13-course baroque lute";
  if (id === "target.baroque-guitar") return "5-course baroque guitar";
  if (id === "target.classical-guitar") return "classical guitar";
  if (id === "target.renaissance-lute") return "6-course Renaissance lute";
  if (id === "target.piano-continuo") return "soprano and piano continuo";
  if (id === "target.baroque-guitar-continuo")
    return "soprano, 5-course baroque guitar, and separate bass";
  throw new Error(`Unknown target configuration: ${id}`);
}
