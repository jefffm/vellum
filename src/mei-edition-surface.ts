import { mountSafeVerovioSvg } from "./artifact-preview.js";
import {
  FRENCH_TAB_MEI_FIXTURE,
  MEI_EDITION_PROOF_ID,
  MEI_EDITION_PROOF_VERSION,
} from "./lib/mei-edition-fixtures.js";
import type { VerovioRenderResult } from "./lib/verovio-renderer.js";
import type { MeiEditionWorkerRequest, MeiEditionWorkerResponse } from "./mei-edition-worker.js";

export type PassageSelection = Readonly<{
  editionId: typeof MEI_EDITION_PROOF_ID;
  editionVersion: typeof MEI_EDITION_PROOF_VERSION;
  meiIds: readonly string[];
}>;

const EVENT_IDS = ["note-1", "note-4", "note-5"] as const;

function renderInWorker(
  worker: Worker,
  mei: string,
  eventIds: readonly string[]
): Promise<VerovioRenderResult> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const receive = (event: MessageEvent<MeiEditionWorkerResponse>) => {
      if (event.data.requestId !== requestId) return;
      worker.removeEventListener("message", receive);
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.addEventListener("message", receive);
    worker.postMessage({
      requestId,
      mei,
      eventIds,
    } satisfies MeiEditionWorkerRequest);
  });
}

export async function renderMeiDocumentInWorker(
  mei: string,
  eventIds: readonly string[]
): Promise<VerovioRenderResult> {
  const worker = new Worker(new URL("./mei-edition-worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await renderInWorker(worker, mei, eventIds);
  } finally {
    worker.terminate();
  }
}

function soundEvent(event: VerovioRenderResult["events"][number]): void {
  if (!event.pitch) return;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 440 * 2 ** ((event.pitch - 69) / 12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
  oscillator.addEventListener("ended", () => void context.close());
}

export async function renderMeiEditionProof(panel: HTMLElement): Promise<void> {
  panel.replaceChildren();
  const shell = panel.ownerDocument.createElement("section");
  shell.className = "mei-edition-surface";
  shell.innerHTML = `<header class="artifact-preview-header"><div><p class="artifact-preview-eyebrow">MEI Edition · development proof</p><h1>French tablature edition</h1><p class="artifact-preview-meta">Loading pinned local Verovio…</p></div><div class="artifact-preview-controls"><button type="button" data-play disabled>Play literal preview</button><button type="button" data-export disabled>Export PDF</button></div></header><div class="score-selection-summary" data-selection>Click a tablature event to create a version-bound Passage Selection.</div><div class="artifact-preview-viewport"><div class="artifact-preview-content" data-notation></div></div>`;
  panel.append(shell);
  {
    const result = await renderMeiDocumentInWorker(FRENCH_TAB_MEI_FIXTURE, EVENT_IDS);
    const notation = shell.querySelector<HTMLElement>("[data-notation]")!;
    const svg = mountSafeVerovioSvg(notation, result.svg);
    const meta = shell.querySelector<HTMLElement>(".artifact-preview-meta")!;
    meta.textContent = `${MEI_EDITION_PROOF_ID} · version ${MEI_EDITION_PROOF_VERSION} · Verovio ${result.version}`;
    const selectionSummary = shell.querySelector<HTMLElement>("[data-selection]")!;
    let selection: PassageSelection | undefined;
    for (const id of EVENT_IDS) {
      const element = svg.querySelector<SVGGElement>(`g[data-id="${id}"]`);
      if (!element) continue;
      element.classList.add("vellum-selectable-event");
      element.tabIndex = 0;
      const select = () => {
        svg
          .querySelectorAll(".score-selected")
          .forEach((node) => node.classList.remove("score-selected"));
        element.classList.add("score-selected");
        selection = Object.freeze({
          editionId: MEI_EDITION_PROOF_ID,
          editionVersion: MEI_EDITION_PROOF_VERSION,
          meiIds: Object.freeze([id]),
        });
        selectionSummary.textContent = `Passage Selection: ${selection.editionId} v${selection.editionVersion} · ${id}`;
        shell.dispatchEvent(
          new CustomEvent<PassageSelection>("vellum-passage-selection", {
            detail: selection,
            bubbles: true,
          })
        );
      };
      element.addEventListener("click", select);
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") select();
      });
    }
    const play = shell.querySelector<HTMLButtonElement>("[data-play]")!;
    play.disabled = false;
    play.addEventListener("click", () => {
      const start = performance.now();
      for (const event of result.events) {
        window.setTimeout(
          () => {
            svg
              .querySelectorAll(".mei-playback-active")
              .forEach((node) => node.classList.remove("mei-playback-active"));
            svg.querySelector(`g[data-id="${event.id}"]`)?.classList.add("mei-playback-active");
            soundEvent(event);
          },
          Math.max(0, event.timeMs - (performance.now() - start))
        );
      }
    });
    const pdf = shell.querySelector<HTMLButtonElement>("[data-export]")!;
    pdf.disabled = false;
    pdf.addEventListener("click", () => {
      void fetch("/api/mei-editions/proof/export", { method: "POST" })
        .then((response) => {
          if (!response.ok) throw new Error("PDF export failed");
          return response.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "vellum-mei-edition-proof.pdf";
          link.click();
          URL.revokeObjectURL(url);
        });
    });
  }
}

export function installMeiEditionProofLauncher(panel: HTMLElement): void {
  const launch = panel.ownerDocument.createElement("button");
  launch.type = "button";
  launch.className = "mei-edition-launcher";
  launch.textContent = "Open MEI edition proof";
  launch.addEventListener("click", () => void renderMeiEditionProof(panel));
  panel.querySelector(".artifact-placeholder-card")?.append(launch);
  if (new URL(window.location.href).searchParams.get("editionProof") === "1") {
    void renderMeiEditionProof(panel);
  }
}
