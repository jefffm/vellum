import type { AudioPreview, PlaybackPart } from "./lib/audio-preview.js";
import type { TargetConfiguration } from "./lib/music-domain.js";
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
      const recognized = await api<{ normalizedScore: { id: string } }>(
        `/api/workspaces/${workspace.id}/omr-runs`,
        {
          method: "POST",
          body: JSON.stringify({ sourceArtifactId: source.id, backend: "audiveris" }),
        }
      );
      const deliverables: GuidedDeliverable[] = [];
      for (const target of targetConfigurations) {
        status.textContent = `Searching and auditing the ${targetLabel(target.id)} reduction…`;
        const arranged = await api<{ arrangementScore: { id: string } }>(
          `/api/workspaces/${workspace.id}/arrangements`,
          {
            method: "POST",
            body: JSON.stringify({
              normalizedScoreId: recognized.normalizedScore.id,
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

function guidedStartMarkup(): string {
  return `
    <form>
      <header><p>Guided Start</p><h1>Turn a score into a playable arrangement</h1><button type="button" data-guided-skip aria-label="Close">×</button></header>
      <section class="provider-connection"><div><strong>ChatGPT connection</strong><span data-provider-status>Checking…</span></div><button type="button" data-provider-connect>Connect ChatGPT</button><button type="button" data-provider-disconnect hidden>Log out</button></section>
      <label>1. Upload score PDF<input type="file" accept="application/pdf,.pdf" required></label>
      <label>Title<input name="title" placeholder="Taken from the filename if blank"></label>
      <fieldset><legend>2. Output format(s)</legend><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-guitar" checked> <span><strong>5-course baroque guitar</strong><small>French letter tablature · French stringing · PDF + Audio Preview</small></span></label><label class="output-choice"><input type="checkbox" name="targets" value="target.baroque-lute"> <span><strong>13-course baroque lute</strong><small>French letter tablature · default D-minor tuning · PDF + Audio Preview</small></span></label><p>Select both to create independently searched and audited siblings from one saved analysis.</p></fieldset>
      <label>Anything else? <span>(optional)</span><textarea name="instruction" rows="3" placeholder="For example: keep the texture full but prioritize easy fingering"></textarea></label>
      <p class="guided-status" data-guided-status>Vellum will preserve the Principal Voice automatically and show any source uncertainty before arranging.</p>
      <footer><button type="button" data-guided-skip>Skip to chat</button><button type="submit">Start arrangement</button></footer>
    </form>`;
}

function targetConfiguration(id: string): TargetConfiguration {
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
  throw new Error(`Unknown target configuration: ${id}`);
}

function targetLabel(id: string): string {
  if (id === "target.baroque-lute") return "13-course baroque lute";
  if (id === "target.baroque-guitar") return "5-course baroque guitar";
  throw new Error(`Unknown target configuration: ${id}`);
}
