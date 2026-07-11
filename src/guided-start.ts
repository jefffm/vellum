import {
  skipRepeatedOccurrences,
  type AudioPreview,
  type PlaybackEvent,
  type PlaybackPart,
} from "./lib/audio-preview.js";
import type {
  ScoreEvent,
  TargetConfiguration,
  TranscriptionCorrection,
  TranscriptionUncertainty,
} from "./lib/music-domain.js";
import type { CompileResult } from "./types.js";

type GuidedStartOptions = {
  onComplete: (deliverables: GuidedDeliverable[]) => void;
};

const audioSeekHandlers = new WeakMap<HTMLElement, EventListener>();
const audioPlaybackCleanups = new WeakMap<HTMLElement, () => void>();

export type GuidedDeliverable = {
  workspaceId: string;
  arrangementFamilyId: string;
  arrangementSearchId: string;
  targetConfigurationId: string;
  label: string;
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
        file.name.replace(/\.pdf$/i, "");
      const instruction = form
        .querySelector<HTMLTextAreaElement>('[name="instruction"]')
        ?.value.trim();
      const selectedTargets = Array.from(
        form.querySelectorAll<HTMLInputElement>('[name="targets"]:checked')
      ).map((input) => input.value);
      if (selectedTargets.length === 0) throw new Error("Choose at least one output format");
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
      status.textContent = "Uploading the source PDF…";
      const source = await api<{ id: string }>(`/api/workspaces/${workspace.id}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Source-Filename": encodeURIComponent(file.name),
          "X-Source-License": "User supplied; rights not asserted by Vellum",
        },
        body: file,
      });
      status.textContent = "Reading the score with optical music recognition…";
      const recognized = await api<{
        scoreTranscription: { id: string; status: ScoreAnchoredReview["status"] };
        normalizedScore: { id: string };
      }>(`/api/workspaces/${workspace.id}/omr-runs`, {
        method: "POST",
        body: JSON.stringify({ sourceArtifactId: source.id, backend: "audiveris" }),
      });
      const reviewed = await resolveCriticalUncertainties(
        dialog,
        workspace.id,
        recognized.scoreTranscription.id,
        recognized.normalizedScore.id
      );
      const deliverables: GuidedDeliverable[] = [];
      for (const target of targetConfigurations) {
        status.textContent = `Searching and auditing the ${targetLabel(target.id)} reduction…`;
        const arranged = await api<{
          analysis: GuidedDeliverable["analysis"];
          arrangementSearch: { id: string };
          candidates: GuidedDeliverable["candidates"];
          arrangementScore: {
            id: string;
            arrangementFamilyId: string;
            transformationReport: GuidedDeliverable["transformationReport"];
            preservationAudit: GuidedDeliverable["preservationAudit"];
            continuoDisposition?: GuidedDeliverable["continuoDisposition"];
          };
        }>(`/api/workspaces/${workspace.id}/arrangements`, {
          method: "POST",
          body: JSON.stringify({
            normalizedScoreId: reviewed.normalizedScoreId,
            targetConfigurationId: target.id,
            preservationPolicy: "faithful_reduction",
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
          arrangementFamilyId: arranged.arrangementScore.arrangementFamilyId,
          arrangementSearchId: arranged.arrangementSearch.id,
          targetConfigurationId: target.id,
          label: targetLabel(target.id),
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
  const updatePosition = (next: number, activeEvents: PlaybackEvent[] = []) => {
    position = next;
    progress.value = String(next);
    time.value = `${formatTime(next)} / ${formatTime(activePreview.durationSeconds)}`;
    highlightLineage(panel, activeEvents);
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
    updatePosition(0);
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
  for (const event of editableNotes) {
    const label = document.createElement("label");
    label.textContent = `Recognized pitch · ${event.id}`;
    const input = document.createElement("input");
    input.type = "text";
    input.value = event.pitch;
    input.pattern = "[A-G](?:#|b)?-?\\d+";
    input.dataset.reviewEventId = event.id;
    label.append(input);
    editors.append(label);
  }

  item.uncertainty.alternatives.forEach((alternative, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${alternative}`;
    button.addEventListener("click", () => {
      const first = editors.querySelector<HTMLInputElement>("input");
      if (first) first.value = alternative;
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
        eventEdits: inputs.map((input) => ({
          eventId: input.dataset.reviewEventId!,
          pitch: input.value.trim(),
        })),
        rationale: explanation,
      });
    };
  });
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

function highlightLineage(panel: HTMLElement, events: PlaybackEvent[]): void {
  const dimensions = {
    arrangementEventIds: new Set(events.map((event) => event.arrangementEventId)),
    sourceEventIds: new Set(events.flatMap((event) => event.sourceEventIds)),
    transformationIds: new Set(events.flatMap((event) => event.transformationEntryIds)),
    auditTargetIds: new Set(events.flatMap((event) => event.auditTargetIds)),
  };
  panel
    .querySelectorAll<HTMLElement>(
      "[data-arrangement-event-ids], [data-source-event-ids], [data-transformation-id], [data-audit-target-ids]"
    )
    .forEach((element) => {
      const active =
        datasetMatches(element.dataset.arrangementEventIds, dimensions.arrangementEventIds) ||
        datasetMatches(element.dataset.sourceEventIds, dimensions.sourceEventIds) ||
        datasetMatches(element.dataset.transformationId, dimensions.transformationIds) ||
        datasetMatches(element.dataset.auditTargetIds, dimensions.auditTargetIds);
      element.classList.toggle("playback-active", active);
    });
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

async function installProviderConnection(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-provider-status]");
  const connect = root.querySelector<HTMLButtonElement>("[data-provider-connect]");
  const disconnect = root.querySelector<HTMLButtonElement>("[data-provider-disconnect]");
  if (!status || !connect || !disconnect) return;
  let handledPrompt: string | undefined;
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
    connect.disabled = current.state === "connecting";
    connect.textContent =
      current.state === "expired" || current.error ? "Reconnect" : "Connect ChatGPT";
    disconnect.hidden = !["connected", "expired", "refreshing"].includes(current.state);
    if (current.prompt && current.prompt.message !== handledPrompt) {
      handledPrompt = current.prompt.message;
      const value = window.prompt(current.prompt.message, current.prompt.placeholder ?? "");
      if (value !== null && (current.prompt.allowEmpty || value.length > 0)) {
        try {
          await api("/api/provider-connection/prompt", {
            method: "POST",
            body: JSON.stringify({ value }),
          });
        } catch (error) {
          handledPrompt = undefined;
          status.textContent = error instanceof Error ? error.message : "Invalid provider callback";
        }
      }
    }
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

export function guidedStartMarkup(): string {
  return `
    <form>
      <header><p>Guided Start</p><h1>Turn a score into a playable arrangement</h1><button type="button" data-guided-skip aria-label="Close">×</button></header>
      <section class="provider-connection"><div><strong>ChatGPT connection</strong><span data-provider-status>Checking…</span></div><button type="button" data-provider-connect>Connect ChatGPT</button><button type="button" data-provider-disconnect hidden>Log out</button></section>
      <section class="model-action-recovery" data-model-action-recovery hidden><strong>Interrupted model work</strong><p>Nothing has been committed from these incomplete attempts. Review the retained boundary and choose how to continue.</p><div data-model-action-items></div></section>
      <label>1. Upload score PDF<input type="file" accept="application/pdf,.pdf" required></label>
      <label>Title<input name="title" placeholder="Taken from the filename if blank"></label>
      <fieldset><legend>2. Output format(s)</legend><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar" checked> <span><strong>5-course baroque guitar</strong><small>French letter tablature · French stringing · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-lute"> <span><strong>13-course baroque lute</strong><small>French letter tablature · default D-minor tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.renaissance-lute"> <span><strong>6-course Renaissance lute</strong><small>French letter tablature · polyphonic lineage preservation · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.classical-guitar"> <span><strong>Classical guitar</strong><small>Standard notation · standard EADGBE tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.piano-continuo"> <span><strong>Soprano + piano continuo</strong><small>For figured-bass sources · complete Italian Baroque realization · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar-continuo"> <span><strong>Soprano + baroque guitar + bass</strong><small>For figured-bass sources · separate bass preserves the foundation the re-entrant guitar cannot sound</small></span></label><p>Select any combination to create independently searched and audited siblings from one saved analysis.</p></fieldset>
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
