import {
  skipRepeatedOccurrences,
  type AudioPreview,
  type PlaybackEvent,
  type PlaybackPart,
} from "./lib/audio-preview.js";
import type {
  ArrangementEvent,
  ArrangementScore,
  ScoreEvent,
  TargetConfiguration,
  TranscriptionCorrection,
  TranscriptionUncertainty,
} from "./lib/music-domain.js";
import type { CompileResult } from "./types.js";
import { noteToMidi } from "./lib/pitch.js";

type GuidedStartOptions = {
  onComplete: (deliverables: GuidedDeliverable[]) => void;
};

const audioSeekHandlers = new WeakMap<HTMLElement, EventListener>();
const audioPlaybackCleanups = new WeakMap<HTMLElement, () => void>();
const followedMeasureOccurrences = new WeakMap<HTMLElement, string>();

export type GuidedDeliverable = {
  workspaceId: string;
  arrangementScoreId: string;
  arrangementScoreVersion: number;
  parentArrangementScoreId?: string;
  branchId?: string;
  editorialCommitmentIds: string[];
  arrangementFamilyId: string;
  arrangementSearchId: string;
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
};

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
  targetConfiguration: TargetConfiguration;
  preservationPolicy: ArrangementScore["preservationPolicy"];
  eventIds: string[];
  measureIds: string[];
  sourceEventIds: string[];
  events: ArrangementEvent[];
  lineage: GuidedDeliverable["transformationReport"];
  findings: GuidedDeliverable["preservationAudit"]["findings"];
};

export function buildScoreSelectionContext(
  deliverable: GuidedDeliverable,
  selectedEventIds: readonly string[]
): ScoreSelectionContext {
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
  };
}

export function selectionPrompt(context: ScoreSelectionContext, request: string): string {
  const conciseRequest =
    request.trim() || "Give me interactive musical feedback on this selection.";
  return `${conciseRequest}\n\nUse this exact Vellum Selection Context; do not infer a different passage or score version:\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
}

type EditBatchResult = {
  arrangementScore: ArrangementScore;
  editorialCommitments: Array<{ id: string }>;
  branch: { id: string };
};

type PassageCandidate = {
  id: string;
  sourceCandidateId: string;
  strategy: string;
  status: "survived" | "selected" | "rejected";
  rank?: number;
  replacementEvents: ArrangementEvent[];
  changedArrangementEventIds: string[];
  evaluation?: { weightedTotal: number; rationale: string };
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
    const result = await api<{ candidates: PassageCandidate[] }>(
      `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/passage-candidates`,
      { method: "POST", body: JSON.stringify({ arrangement_event_ids: eventIds }) }
    );
    status.textContent = `${result.candidates.filter((candidate) => candidate.status !== "rejected").length} viable alternative projections; rejected options retain their audit evidence.`;
    for (const candidate of result.candidates) {
      const card = document.createElement("article");
      card.className = `passage-candidate ${candidate.status}`;
      const title = document.createElement("h3");
      title.textContent = `${candidate.rank ? `#${candidate.rank} ` : ""}${candidate.strategy}`;
      const evidence = document.createElement("p");
      evidence.textContent =
        candidate.status === "rejected"
          ? `Rejected · ${candidate.rejectionReason ?? "A hard constraint failed."}`
          : `${candidate.changedArrangementEventIds.length} selected object${candidate.changedArrangementEventIds.length === 1 ? "" : "s"} differ · ${candidate.evaluation ? `${(candidate.evaluation.weightedTotal * 100).toFixed(1)}% · ${candidate.evaluation.rationale}` : `Audit ${candidate.audit.status}`}`;
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
          const result = await api<EditBatchResult & { changedArrangementEventIds: string[] }>(
            `/api/workspaces/${deliverable.workspaceId}/arrangements/${deliverable.arrangementScoreId}/passage-candidates/adopt`,
            {
              method: "POST",
              body: JSON.stringify({
                arrangement_event_ids: eventIds,
                source_candidate_id: candidate.sourceCandidateId,
              }),
            }
          );
          document.dispatchEvent(
            new CustomEvent("vellum-arrangement-version-created", {
              detail: { result, deliverable },
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
        { method: "POST", body: JSON.stringify({ edits }) }
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
    const request = document.createElement("input");
    request.type = "text";
    request.placeholder = "Ask about this passage…";
    request.setAttribute("aria-label", "Question about selected score events");
    const ask = document.createElement("button");
    ask.type = "button";
    ask.textContent = "Ask Vellum";
    ask.addEventListener("click", () => {
      const context = buildScoreSelectionContext(
        deliverable,
        selectedEvents.map((event) => event.id)
      );
      document.dispatchEvent(
        new CustomEvent("vellum-ask-selection", {
          detail: { message: selectionPrompt(context, request.value), context },
        })
      );
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      selected.clear();
      anchorId = undefined;
      renderSelection();
    });
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit selection";
    edit.addEventListener("click", () => openEditBatchDialog(deliverable, selectedEvents));
    const alternatives = document.createElement("button");
    alternatives.type = "button";
    alternatives.textContent = "Try alternatives";
    alternatives.addEventListener(
      "click",
      () => void openPassageCandidatesDialog(panel, deliverable, selectedEvents)
    );
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
    const actions = document.createElement("span");
    actions.className = "score-selection-actions";
    actions.append(request, ask, edit, alternatives, loop, clear);
    summary.replaceChildren(title, facts, actions);
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
    frame.title = `${source.filename}, source page ${item.region!.page}`;
    frame.src = sourceFocusUrl(source.contentUrl, item.region!);
    figure.append(caption, frame);
  }
  return figure;
}

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type ScoreAnchoredReview = {
  transcriptionId: string;
  version: number;
  status: "needs_review" | "reviewed" | "best_effort";
  sourceArtifactId: string;
  sourceFilename: string;
  sourceContentUrl: string;
  items: Array<{
    uncertainty: TranscriptionUncertainty;
    events: ScoreEvent[];
    sourceImageUrl?: string;
  }>;
};

type CorrectionResult = {
  scoreTranscription: { id: string; status: ScoreAnchoredReview["status"] };
  normalizedScore: { id: string };
};

export function installGuidedStart(options: GuidedStartOptions): void {
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
  document.body.append(launcher);

  const dialog = document.createElement("dialog");
  dialog.id = "guided-start";
  dialog.innerHTML = guidedStartMarkup();
  document.body.append(dialog);
  launcher.addEventListener("click", () => {
    dialog.showModal();
    if (activeWorkspaceId) void refreshModelActionRecovery(dialog, activeWorkspaceId);
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
      const optical = mimeType === "application/pdf" || mimeType.startsWith("image/");
      status.textContent = optical
        ? "Reading the score with optical music recognition…"
        : "Parsing and normalizing the musical source…";
      const recognized = await api<{
        scoreTranscription: { id: string; status: ScoreAnchoredReview["status"] };
        normalizedScore: { id: string };
      }>(
        optical
          ? `/api/workspaces/${workspace.id}/omr-runs`
          : `/api/workspaces/${workspace.id}/sources/${source.id}/import`,
        {
          method: "POST",
          body: JSON.stringify(
            optical ? { sourceArtifactId: source.id, backend: "audiveris" } : {}
          ),
        }
      );
      const reviewed = optical
        ? await resolveCriticalUncertainties(
            dialog,
            workspace.id,
            recognized.scoreTranscription.id,
            recognized.normalizedScore.id
          )
        : { normalizedScoreId: recognized.normalizedScore.id };
      const deliverables: GuidedDeliverable[] = [];
      for (const target of targetConfigurations) {
        status.textContent = `Searching and auditing the ${targetLabel(target.id)} reduction…`;
        const arranged = await api<{
          analysis: GuidedDeliverable["analysis"];
          arrangementSearch: { id: string };
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
        }>(`/api/workspaces/${workspace.id}/arrangements`, {
          method: "POST",
          body: JSON.stringify({
            normalizedScoreId: reviewed.normalizedScoreId,
            targetConfigurationId: target.id,
            preservationPolicy: preservationPolicy as ArrangementScore["preservationPolicy"],
          }),
        });
        status.textContent = `Engraving ${targetLabel(target.id)} and preparing literal playback…`;
        const [compiled, preview] = await Promise.all([
          api<CompileResult & { deliverables: GuidedDeliverable["deliverables"] }>(
            `/api/workspaces/${workspace.id}/arrangements/${arranged.arrangementScore.id}/compile`,
            { method: "POST" }
          ),
          api<AudioPreview & { deliverable: GuidedDeliverable["deliverables"][number] }>(
            `/api/workspaces/${workspace.id}/arrangements/${arranged.arrangementScore.id}/audio-preview`
          ),
        ]);
        deliverables.push({
          workspaceId: workspace.id,
          arrangementScoreId: arranged.arrangementScore.id,
          arrangementScoreVersion: arranged.arrangementScore.version,
          parentArrangementScoreId: arranged.arrangementScore.parentArrangementScoreId,
          branchId: arranged.arrangementScore.branchId,
          editorialCommitmentIds: arranged.arrangementScore.editorialCommitmentIds ?? [],
          arrangementFamilyId: arranged.arrangementScore.arrangementFamilyId,
          arrangementSearchId: arranged.arrangementSearch.id,
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
          deliverables: [...compiled.deliverables, preview.deliverable],
          candidates: arranged.candidates,
        });
      }
      options.onComplete(deliverables);
      status.textContent =
        "Arrangement ready. The source, analysis, candidates, audit, and deliverables are saved locally.";
      window.setTimeout(() => dialog.close(), 900);
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "The arrangement could not be started.";
      status.dataset.error = "true";
      if (activeWorkspaceId) await refreshModelActionRecovery(dialog, activeWorkspaceId);
    } finally {
      submit.disabled = false;
    }
  });

  if (!localStorage.getItem("vellum.guided-start.seen")) {
    localStorage.setItem("vellum.guided-start.seen", "true");
    dialog.showModal();
  }
}

type RecoverableModelAction = {
  id: string;
  kind: string;
  intent: string;
  status: "interrupted";
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
  const interrupted = actions.filter((action) => action.status === "interrupted");
  panel.hidden = interrupted.length === 0;
  items.replaceChildren();
  for (const action of interrupted) {
    const attempt = action.attempts.at(-1)!;
    const item = document.createElement("article");
    item.className = "model-action-recovery-item";
    const heading = document.createElement("strong");
    heading.textContent = `${action.kind.replaceAll("_", " ")}: ${action.intent}`;
    const detail = document.createElement("p");
    detail.textContent = [
      attempt.interruptionReason ?? "Provider work was interrupted.",
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
    row.innerHTML = `<span>${part.label}</span><label><input type="checkbox" data-part-mute> Mute</label><label><input type="checkbox" data-part-solo> Solo</label><label>Level <input type="range" min="0" max="1" value="1" step="0.01" data-part-level></label>`;
    row.querySelector<HTMLInputElement>("[data-part-mute]")!.addEventListener("change", (event) => {
      partState.get(id)!.mute = (event.currentTarget as HTMLInputElement).checked;
    });
    row.querySelector<HTMLInputElement>("[data-part-solo]")!.addEventListener("change", (event) => {
      partState.get(id)!.solo = (event.currentTarget as HTMLInputElement).checked;
    });
    row.querySelector<HTMLInputElement>("[data-part-level]")!.addEventListener("input", (event) => {
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

async function resolveCriticalUncertainties(
  dialog: HTMLDialogElement,
  workspaceId: string,
  initialTranscriptionId: string,
  initialNormalizedScoreId: string
): Promise<{ transcriptionId: string; normalizedScoreId: string }> {
  let transcriptionId = initialTranscriptionId;
  let normalizedScoreId = initialNormalizedScoreId;

  while (true) {
    const review = await api<ScoreAnchoredReview>(
      `/api/workspaces/${workspaceId}/transcriptions/${transcriptionId}/review`
    );
    const item = review.items[0];
    if (!item) {
      hideScoreAnchoredReview(dialog);
      return { transcriptionId, normalizedScoreId };
    }

    const correction = await presentScoreAnchoredReview(dialog, review, item);
    const result = await api<CorrectionResult>(
      `/api/workspaces/${workspaceId}/transcriptions/${transcriptionId}/corrections`,
      { method: "POST", body: JSON.stringify(correction) }
    );
    transcriptionId = result.scoreTranscription.id;
    normalizedScoreId = result.normalizedScore.id;
  }
}

function presentScoreAnchoredReview(
  dialog: HTMLDialogElement,
  review: ScoreAnchoredReview,
  item: ScoreAnchoredReview["items"][number]
): Promise<TranscriptionCorrection> {
  const panel = dialog.querySelector<HTMLElement>("[data-score-review]")!;
  const source = panel.querySelector<HTMLIFrameElement>("[data-review-source]")!;
  const sourceImage = panel.querySelector<HTMLImageElement>("[data-review-source-image]")!;
  const sourceHighlight = panel.querySelector<HTMLElement>("[data-review-source-highlight]")!;
  const heading = panel.querySelector<HTMLElement>("[data-review-heading]")!;
  const message = panel.querySelector<HTMLElement>("[data-review-message]")!;
  const location = panel.querySelector<HTMLElement>("[data-review-location]")!;
  const editors = panel.querySelector<HTMLElement>("[data-review-editors]")!;
  const suggestions = panel.querySelector<HTMLElement>("[data-review-suggestions]")!;
  const rationale = panel.querySelector<HTMLInputElement>("[data-review-rationale]")!;
  const apply = panel.querySelector<HTMLButtonElement>("[data-review-apply]")!;
  const cancel = panel.querySelector<HTMLButtonElement>("[data-review-cancel]")!;
  const error = panel.querySelector<HTMLElement>("[data-review-error]")!;
  const status = dialog.querySelector<HTMLElement>("[data-guided-status]");
  const region = item.uncertainty.region;

  panel.hidden = false;
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
    sourceImage.onload = () => {
      sourceHighlight.hidden = false;
      sourceHighlight.style.left = `${(region.x / sourceImage.naturalWidth) * 100}%`;
      sourceHighlight.style.top = `${(region.y / sourceImage.naturalHeight) * 100}%`;
      sourceHighlight.style.width = `${(region.width / sourceImage.naturalWidth) * 100}%`;
      sourceHighlight.style.height = `${(region.height / sourceImage.naturalHeight) * 100}%`;
    };
  } else {
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
  rationale.value = "Confirmed against the source facsimile in Score-Anchored Review.";
  error.textContent = "";
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
    input.value = event.pitch;
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
      voice.value = recommendedVoices.get(event.id) ?? "soprano";
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
      resolve({
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
  let markerTarget: SVGGElement | undefined;
  for (const group of measureGroups) {
    const active = Boolean(activeMeasureId && group.dataset.measureId === activeMeasureId);
    group.classList.toggle("playback-measure-active", active);
    if (active && !markerTarget) markerTarget = group;
  }
  let marker = notation.querySelector<SVGLineElement>(".score-playhead");
  if (!markerTarget || !activeOccurrenceId) {
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
  const box = markerTarget.getBBox();
  marker.setAttribute("x1", String(box.x - 0.7));
  marker.setAttribute("x2", String(box.x - 0.7));
  marker.setAttribute("y1", String(box.y - 1.2));
  marker.setAttribute("y2", String(box.y + box.height + 1.2));
  if (followedMeasureOccurrences.get(panel) !== activeOccurrenceId) {
    followedMeasureOccurrences.set(panel, activeOccurrenceId);
    markerTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
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
  const envelope = (await response.json()) as ApiEnvelope<T> | { error?: { message?: string } };
  if (!response.ok || !("ok" in envelope) || !envelope.ok) {
    const error = "error" in envelope ? envelope.error : undefined;
    const message =
      typeof error === "string" ? error : (error?.message ?? `Request failed (${response.status})`);
    throw new Error(message);
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

export function guidedStartMarkup(): string {
  return `
    <form>
      <header><p>Guided Start</p><h1>Turn a score into a playable arrangement</h1><button type="button" data-guided-skip aria-label="Close">×</button></header>
      <section class="provider-connection"><div><strong>ChatGPT connection</strong><span data-provider-status>Checking…</span></div><button type="button" data-provider-connect>Connect ChatGPT</button><button type="button" data-provider-disconnect hidden>Log out</button><div data-provider-prompt hidden><label><span data-provider-prompt-message></span><input type="url" data-provider-prompt-input autocomplete="off" disabled></label><button type="button" data-provider-prompt-submit>Finish connection</button><button type="button" data-provider-prompt-cancel>Cancel login</button></div></section>
      <section class="model-action-recovery" data-model-action-recovery hidden><strong>Interrupted model work</strong><p>Nothing has been committed from these incomplete attempts. Review the retained boundary and choose how to continue.</p><div data-model-action-items></div></section>
      <label>1. Upload musical source<input type="file" accept=".pdf,.png,.jpg,.jpeg,.musicxml,.xml,.mxl,.ly,.abc,.mei,.mscz,application/pdf,image/*" required><small>PDF and images use Audiveris review; MusicXML, restricted LilyPond, ABC, MEI, and MSCZ are parsed through their disclosed adapters.</small></label>
      <label>Title<input name="title" placeholder="Taken from the filename if blank"></label>
      <fieldset><legend>2. Output format(s)</legend><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar" checked> <span><strong>5-course baroque guitar</strong><small>French letter tablature · French stringing · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-lute"> <span><strong>13-course baroque lute</strong><small>French letter tablature · default D-minor tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.renaissance-lute"> <span><strong>6-course Renaissance lute</strong><small>French letter tablature · polyphonic lineage preservation · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.classical-guitar"> <span><strong>Classical guitar</strong><small>Standard notation · standard EADGBE tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.piano-continuo"> <span><strong>Soprano + piano continuo</strong><small>For figured-bass sources · complete Italian Baroque realization · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar-continuo"> <span><strong>Soprano + baroque guitar + bass</strong><small>For figured-bass sources · separate bass preserves the foundation the re-entrant guitar cannot sound</small></span></label><p>Select any combination to create independently searched and audited siblings from one saved analysis.</p></fieldset>
      <fieldset><legend>3. Relationship to the source</legend><label>Preservation Policy <select name="preservationPolicy"><option value="faithful_reduction" selected>Faithful Reduction — preserve the Principal Voice exactly</option><option value="idiomatic_adaptation">Idiomatic Adaptation — preserve recognizable phrases, contour, and cadences</option><option value="free_paraphrase">Free Paraphrase — use the source as thematic material</option></select></label><p>Faithful Reduction is the historical-source default. The full Transformation Report remains available under every policy.</p></fieldset>
      <label>Anything else? <span>(optional)</span><textarea name="instruction" rows="3" placeholder="For example: keep the texture full but prioritize easy fingering"></textarea></label>
      <section class="score-anchored-review" data-score-review hidden>
        <div class="score-review-heading"><div><p>Critical uncertainty</p><h2 data-review-heading>Review transcription</h2></div><span data-review-location></span></div>
        <p data-review-message></p>
        <div class="score-review-grid">
          <div><strong>Source facsimile</strong><div class="source-page-frame"><img data-review-source-image hidden><span data-review-source-highlight hidden aria-label="Uncertain recognized symbol"></span><iframe data-review-source></iframe></div></div>
          <div class="score-review-notation"><strong>Recognized notation</strong><div data-review-editors></div><strong>Ranked suggestions</strong><div class="score-review-suggestions" data-review-suggestions></div><label>Review note<input type="text" data-review-rationale></label><p class="score-review-error" data-review-error></p><div class="score-review-actions"><button type="button" data-review-cancel>Cancel this run</button><button type="button" data-review-apply>Apply correction and continue</button></div></div>
        </div>
      </section>
      <p class="guided-status" data-guided-status>Vellum will preserve the Principal Voice automatically and show any source uncertainty before arranging.</p>
      <footer><button type="button" data-guided-skip>Skip to chat</button><button type="submit">Start arrangement</button></footer>
    </form>`;
}

export function targetConfiguration(id: string): TargetConfiguration {
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
