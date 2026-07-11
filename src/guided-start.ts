import type { AudioPreview, PlaybackPart } from "./lib/audio-preview.js";
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

export type GuidedDeliverable = {
  targetConfigurationId: string;
  label: string;
  compiled: CompileResult;
  preview: AudioPreview;
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
  }>;
};

type CorrectionResult = {
  scoreTranscription: { id: string; status: ScoreAnchoredReview["status"] };
  normalizedScore: { id: string };
};

export function installGuidedStart(options: GuidedStartOptions): void {
  const launcher = document.createElement("button");
  launcher.id = "guided-start-launcher";
  launcher.type = "button";
  launcher.textContent = "New arrangement";
  document.body.append(launcher);

  const dialog = document.createElement("dialog");
  dialog.id = "guided-start";
  dialog.innerHTML = guidedStartMarkup();
  document.body.append(dialog);
  launcher.addEventListener("click", () => dialog.showModal());
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
        const arranged = await api<{ arrangementScore: { id: string } }>(
          `/api/workspaces/${workspace.id}/arrangements`,
          {
            method: "POST",
            body: JSON.stringify({
              normalizedScoreId: reviewed.normalizedScoreId,
              targetConfigurationId: target.id,
              preservationPolicy: "faithful_reduction",
            }),
          }
        );
        status.textContent = `Engraving ${targetLabel(target.id)} and preparing literal playback…`;
        const [compiled, preview] = await Promise.all([
          api<CompileResult>(
            `/api/workspaces/${workspace.id}/arrangements/${arranged.arrangementScore.id}/compile`,
            { method: "POST" }
          ),
          api<AudioPreview>(
            `/api/workspaces/${workspace.id}/arrangements/${arranged.arrangementScore.id}/audio-preview`
          ),
        ]);
        deliverables.push({
          targetConfigurationId: target.id,
          label: targetLabel(target.id),
          compiled,
          preview,
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
    } finally {
      submit.disabled = false;
    }
  });

  if (!localStorage.getItem("vellum.guided-start.seen")) {
    localStorage.setItem("vellum.guided-start.seen", "true");
    dialog.showModal();
  }
}

export function installAudioPreviewControls(panel: HTMLElement, preview: AudioPreview): void {
  const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
  if (!header) return;
  const controls = document.createElement("div");
  controls.className = "audio-preview-controls";
  controls.innerHTML = `
    <label>Audio Preview
      <select>${preview.parts.map((part) => `<option value="${part.id}">${part.label}</option>`).join("")}</select>
    </label>
    <button type="button" data-audio-play>▶ Play</button>
    <button type="button" data-audio-stop disabled>■ Stop</button>
  `;
  header.append(controls);
  let stopPlayback: (() => void) | undefined;
  const play = controls.querySelector<HTMLButtonElement>("[data-audio-play]")!;
  const stop = controls.querySelector<HTMLButtonElement>("[data-audio-stop]")!;
  play.addEventListener("click", () => {
    stopPlayback?.();
    const part = controls.querySelector<HTMLSelectElement>("select")!.value as PlaybackPart;
    stopPlayback = playPreview(preview, part, () => {
      play.disabled = false;
      stop.disabled = true;
    });
    play.disabled = true;
    stop.disabled = false;
  });
  stop.addEventListener("click", () => stopPlayback?.());
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
  source.src = sourceFocusUrl(review.sourceContentUrl, region);
  source.title = `${review.sourceFilename}, source page ${region?.page ?? 1}`;
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
}

function setGuidedNavigationDisabled(dialog: HTMLDialogElement, disabled: boolean): void {
  for (const control of dialog.querySelectorAll<HTMLButtonElement>("[data-guided-skip]")) {
    control.disabled = disabled;
  }
}

function playPreview(preview: AudioPreview, part: PlaybackPart, onEnded: () => void): () => void {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.12;
  master.connect(context.destination);
  const start = context.currentTime + 0.05;
  const oscillators: OscillatorNode[] = [];
  for (const event of preview.events) {
    if (part !== "full" && event.part !== part) continue;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = midiFrequency(event.midi);
    envelope.gain.setValueAtTime(0, start + event.startSeconds);
    envelope.gain.linearRampToValueAtTime(0.8, start + event.startSeconds + 0.01);
    envelope.gain.setValueAtTime(
      0.8,
      start + event.startSeconds + Math.max(0.02, event.durationSeconds - 0.03)
    );
    envelope.gain.linearRampToValueAtTime(0, start + event.startSeconds + event.durationSeconds);
    oscillator.connect(envelope).connect(master);
    oscillator.start(start + event.startSeconds);
    oscillator.stop(start + event.startSeconds + event.durationSeconds + 0.01);
    oscillators.push(oscillator);
  }
  const timer = window.setTimeout(
    () => {
      void context.close();
      onEnded();
    },
    (preview.durationSeconds + 0.2) * 1_000
  );
  return () => {
    window.clearTimeout(timer);
    for (const oscillator of oscillators) {
      try {
        oscillator.stop();
      } catch {
        /* already stopped */
      }
    }
    void context.close();
    onEnded();
  };
}

async function installProviderConnection(root: HTMLElement): Promise<void> {
  const status = root.querySelector<HTMLElement>("[data-provider-status]");
  const connect = root.querySelector<HTMLButtonElement>("[data-provider-connect]");
  const disconnect = root.querySelector<HTMLButtonElement>("[data-provider-disconnect]");
  if (!status || !connect || !disconnect) return;
  let handledPrompt: string | undefined;
  const refresh = async () => {
    const current = await api<{
      state: string;
      error?: string;
      prompt?: { message: string; placeholder?: string; allowEmpty?: boolean };
    }>("/api/provider-connection");
    status.textContent = current.error ? `${current.state}: ${current.error}` : current.state;
    connect.hidden = current.state === "connected";
    disconnect.hidden = current.state !== "connected";
    if (current.prompt && current.prompt.message !== handledPrompt) {
      handledPrompt = current.prompt.message;
      const value = window.prompt(current.prompt.message, current.prompt.placeholder ?? "");
      if (value !== null && (current.prompt.allowEmpty || value.length > 0)) {
        await api("/api/provider-connection/prompt", {
          method: "POST",
          body: JSON.stringify({ value }),
        });
      }
    }
    return current;
  };
  connect.addEventListener("click", async () => {
    connect.disabled = true;
    const popup = window.open("about:blank", "vellum-chatgpt-login", "popup,width=680,height=760");
    try {
      const login = await api<{ authUrl?: string }>("/api/provider-connection/login", {
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
      <label>1. Upload score PDF<input type="file" accept="application/pdf,.pdf" required></label>
      <label>Title<input name="title" placeholder="Taken from the filename if blank"></label>
      <fieldset><legend>2. Output format(s)</legend><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar" checked> <span><strong>5-course baroque guitar</strong><small>French letter tablature · French stringing · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-lute"> <span><strong>13-course baroque lute</strong><small>French letter tablature · default D-minor tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.classical-guitar"> <span><strong>Classical guitar</strong><small>Standard notation · standard EADGBE tuning · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.piano-continuo"> <span><strong>Soprano + piano continuo</strong><small>For figured-bass sources · Italian Baroque profile · PDF + Audio Preview</small></span></label><p>Select any combination to create independently searched and audited siblings from one saved analysis.</p></fieldset>
      <label>Anything else? <span>(optional)</span><textarea name="instruction" rows="3" placeholder="For example: keep the texture full but prioritize easy fingering"></textarea></label>
      <section class="score-anchored-review" data-score-review hidden>
        <div class="score-review-heading"><div><p>Critical uncertainty</p><h2 data-review-heading>Review transcription</h2></div><span data-review-location></span></div>
        <p data-review-message></p>
        <div class="score-review-grid">
          <div><strong>Source facsimile</strong><iframe data-review-source></iframe></div>
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
  throw new Error(`Unknown target configuration: ${id}`);
}

function targetLabel(id: string): string {
  if (id === "target.baroque-lute") return "13-course baroque lute";
  if (id === "target.baroque-guitar") return "5-course baroque guitar";
  if (id === "target.classical-guitar") return "classical guitar";
  if (id === "target.piano-continuo") return "soprano and piano continuo";
  throw new Error(`Unknown target configuration: ${id}`);
}
