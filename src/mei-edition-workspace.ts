import { mountSafeVerovioSvg } from "./artifact-preview.js";
import type {
  CorrectionBatchCommand,
  DiplomaticToken,
  MeiAttributeChange,
  MeiEditionVersion,
} from "./lib/mei-edition-domain.js";
import { renderMeiDocumentInWorker } from "./mei-edition-surface.js";
import { installMeiEditionInterpretationWorkbench } from "./mei-edition-interpretation-workbench.js";

type ProjectedEdition = Readonly<{
  edition: MeiEditionVersion;
  svg: string;
  rendererVersion: string;
  sourceContentUrl: string;
}>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as
    | { ok: true; data: T }
    | { ok: false; error?: { message?: string } };
  if (!response.ok || !body.ok) {
    throw new Error(
      !body.ok
        ? (body.error?.message ?? "MEI Edition request failed")
        : "MEI Edition request failed"
    );
  }
  return body.data;
}

function attributeValue(
  mei: string,
  tokenId: string,
  attribute: MeiAttributeChange["attribute"]
): string | undefined {
  const document = new DOMParser().parseFromString(mei, "application/xml");
  const element = Array.from(document.getElementsByTagName("*")).find(
    (candidate) => candidate.getAttribute("xml:id") === tokenId
  );
  return element?.hasAttribute(attribute) ? element.getAttribute(attribute)! : undefined;
}

function correctionAttributes(token: DiplomaticToken): MeiAttributeChange["attribute"][] {
  if (token.kind === "rhythm") return ["dur", "dots"];
  if (token.kind === "tablature") return ["tab.course", "tab.fret"];
  return [];
}

export async function renderMeiEditionWorkspace(
  panel: HTMLElement,
  workspaceId: string,
  editionId: string
): Promise<void> {
  let projected = await api<ProjectedEdition>(
    `/api/workspaces/${workspaceId}/mei-editions/${editionId}`
  );
  const render = async (
    next: ProjectedEdition,
    preview = false,
    pending?: CorrectionBatchCommand
  ) => {
    projected = next;
    const edition = next.edition;
    panel.replaceChildren();
    const shell = panel.ownerDocument.createElement("section");
    shell.className = "mei-edition-surface diplomatic-edition-workspace";
    shell.innerHTML = `<header class="artifact-preview-header"><div><p class="artifact-preview-eyebrow">Diplomatic Tablature Transcription</p><h1></h1><p class="artifact-preview-meta"></p></div><div class="artifact-preview-controls"><button type="button" data-undo ${edition.version === 1 || preview ? "disabled" : ""}>Undo latest batch</button></div></header><p class="mei-edition-status" role="status" data-status></p><div class="mei-edition-review-grid"><section class="mei-facsimile-pane"><header><strong>Facsimile · page ${edition.sourcePage}</strong><span>Click a token to inspect its exact source region.</span><span class="mei-facsimile-zoom"><button type="button" data-source-zoom-out aria-label="Zoom source out">−</button><button type="button" data-source-zoom-reset>100%</button><button type="button" data-source-zoom-in aria-label="Zoom source in">+</button></span></header><div class="mei-facsimile-viewport"><div class="mei-facsimile-canvas"><img alt="${edition.title}, source page ${edition.sourcePage}"/><span class="mei-facsimile-highlight" hidden></span></div></div></section><section class="mei-notation-pane"><header><strong>${preview ? "Correction preview" : "Canonical MEI"}</strong><span>Verovio ${next.rendererVersion}</span></header><div class="artifact-preview-content" data-notation></div></section></div><section class="mei-correction-workbench"><div data-token-detail>Select a rendered token to stage a typed transcription correction.</div><form data-change-form hidden><label>Attribute<select data-attribute></select></label><label>Current<input data-current readonly/></label><label>Replacement<input data-replacement required/></label><label>Rationale<input data-rationale required value="Confirmed against the source facsimile."/></label><button type="submit">Stage change</button></form><div data-staged></div><div class="mei-batch-controls"><label>Batch name<input data-batch-name value="Page ${edition.sourcePage} diplomatic corrections"/></label><button type="button" data-preview disabled>Preview batch</button><button type="button" data-cancel disabled>Cancel staging</button><button type="button" data-commit disabled>Commit canonical version</button></div><p data-error role="alert"></p></section>`;
    panel.append(shell);
    shell.querySelector("h1")!.textContent =
      `${edition.title}${preview ? ` · preview v${edition.version}` : ""}`;
    shell.querySelector<HTMLElement>(".artifact-preview-meta")!.textContent =
      `${edition.editionId} · canonical version ${preview ? edition.parentVersion : edition.version} · ${edition.tokens.length} facsimile-linked tokens · ${edition.extraction.backendId} ${edition.extraction.backendVersion}`;
    const image = shell.querySelector<HTMLImageElement>(".mei-facsimile-canvas img")!;
    image.src = `/api/workspaces/${workspaceId}/mei-editions/${editionId}/facsimile`;
    const sourceCanvas = shell.querySelector<HTMLElement>(".mei-facsimile-canvas")!;
    let sourceZoom = 1;
    const updateSourceZoom = () => {
      sourceCanvas.style.width = `${sourceZoom * 100}%`;
      shell.querySelector<HTMLButtonElement>("[data-source-zoom-reset]")!.textContent =
        `${Math.round(sourceZoom * 100)}%`;
    };
    shell.querySelector<HTMLButtonElement>("[data-source-zoom-out]")!.onclick = () => {
      sourceZoom = Math.max(1, sourceZoom - 0.5);
      updateSourceZoom();
    };
    shell.querySelector<HTMLButtonElement>("[data-source-zoom-reset]")!.onclick = () => {
      sourceZoom = 1;
      updateSourceZoom();
    };
    shell.querySelector<HTMLButtonElement>("[data-source-zoom-in]")!.onclick = () => {
      sourceZoom = Math.min(4, sourceZoom + 0.5);
      updateSourceZoom();
    };
    const browserRender = await renderMeiDocumentInWorker(
      edition.mei,
      edition.tokens.filter((token) => token.kind === "tablature").map((token) => token.id)
    );
    const svg = mountSafeVerovioSvg(
      shell.querySelector<HTMLElement>("[data-notation]")!,
      browserRender.svg
    );
    const tokenDetail = shell.querySelector<HTMLElement>("[data-token-detail]")!;
    const form = shell.querySelector<HTMLFormElement>("[data-change-form]")!;
    const attribute = shell.querySelector<HTMLSelectElement>("[data-attribute]")!;
    const current = shell.querySelector<HTMLInputElement>("[data-current]")!;
    const replacement = shell.querySelector<HTMLInputElement>("[data-replacement]")!;
    const rationale = shell.querySelector<HTMLInputElement>("[data-rationale]")!;
    const highlight = shell.querySelector<HTMLElement>(".mei-facsimile-highlight")!;
    const staged: MeiAttributeChange[] = [...(pending?.changes ?? [])];
    let selected: DiplomaticToken | undefined;
    const refreshStaged = () => {
      const list = shell.querySelector<HTMLElement>("[data-staged]")!;
      list.replaceChildren();
      for (const [index, change] of staged.entries()) {
        const row = document.createElement("p");
        row.textContent = `${change.tokenId} · ${change.attribute}: ${change.expectedValue ?? "absent"} → ${change.replacementValue ?? "absent"}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          staged.splice(index, 1);
          refreshStaged();
        });
        row.append(" ", remove);
        list.append(row);
      }
      shell
        .querySelectorAll<HTMLButtonElement>("[data-preview], [data-cancel], [data-commit]")
        .forEach((button) => (button.disabled = staged.length === 0));
    };
    for (const token of edition.tokens) {
      const node = svg.querySelector<SVGGElement>(`g[data-id="${token.id}"]`);
      if (!node) continue;
      node.classList.add("vellum-selectable-event");
      node.tabIndex = 0;
      const select = () => {
        selected = token;
        svg
          .querySelectorAll(".score-selected")
          .forEach((candidate) => candidate.classList.remove("score-selected"));
        node.classList.add("score-selected");
        tokenDetail.textContent = `${token.id} · ${token.kind} · confidence ${Math.round(token.confidence * 100)}%${token.critical ? " · Critical Uncertainty" : ""}`;
        const editableAttributes = correctionAttributes(token);
        form.hidden = editableAttributes.length === 0;
        attribute.replaceChildren(
          ...editableAttributes.map((name) => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            return option;
          })
        );
        const setCurrent = () => {
          const value = attributeValue(
            edition.mei,
            token.id,
            attribute.value as MeiAttributeChange["attribute"]
          );
          current.value = value ?? "";
          replacement.value = value ?? "";
        };
        if (editableAttributes.length > 0) {
          attribute.onchange = setCurrent;
          setCurrent();
        }
        Object.assign(highlight.style, {
          left: `${token.region.x * 100}%`,
          top: `${token.region.y * 100}%`,
          width: `${token.region.width * 100}%`,
          height: `${token.region.height * 100}%`,
        });
        highlight.hidden = false;
      };
      node.addEventListener("click", select);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") select();
      });
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!selected || !replacement.value.trim() || !rationale.value.trim()) return;
      staged.push({
        tokenId: selected.id,
        attribute: attribute.value as MeiAttributeChange["attribute"],
        ...(current.value ? { expectedValue: current.value } : {}),
        replacementValue: replacement.value.trim(),
        rationale: rationale.value.trim(),
      });
      refreshStaged();
    });
    const command = (): CorrectionBatchCommand => ({
      id: pending?.id ?? `correction-batch.${crypto.randomUUID()}`,
      name: shell.querySelector<HTMLInputElement>("[data-batch-name]")!.value.trim(),
      expectedVersion: preview ? edition.parentVersion! : edition.version,
      layer: "transcription",
      changes: staged,
    });
    shell.querySelector<HTMLButtonElement>("[data-preview]")!.onclick = () =>
      void api<ProjectedEdition>(
        `/api/workspaces/${workspaceId}/mei-editions/${editionId}/correction-preview`,
        { method: "POST", body: JSON.stringify(command()) }
      )
        .then((result) => render(result, true, command()))
        .catch(showError);
    shell.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick = () => {
      staged.splice(0);
      refreshStaged();
    };
    shell.querySelector<HTMLButtonElement>("[data-commit]")!.onclick = () =>
      void api<ProjectedEdition>(
        `/api/workspaces/${workspaceId}/mei-editions/${editionId}/correction-batches`,
        { method: "POST", body: JSON.stringify(command()) }
      )
        .then((result) => render(result))
        .catch(showError);
    shell.querySelector<HTMLButtonElement>("[data-undo]")!.onclick = () =>
      void api<ProjectedEdition>(`/api/workspaces/${workspaceId}/mei-editions/${editionId}/undo`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: edition.version }),
      })
        .then((result) => render(result))
        .catch(showError);
    function showError(error: unknown) {
      shell.querySelector<HTMLElement>("[data-error]")!.textContent =
        error instanceof Error ? error.message : "MEI Edition update failed";
    }
    if (pending) {
      shell.querySelector<HTMLInputElement>("[data-batch-name]")!.value = pending.name;
      refreshStaged();
    }
    if (!preview) {
      await installMeiEditionInterpretationWorkbench(shell, workspaceId, edition, svg);
    }
    shell.dataset.ready = "true";
  };
  await render(projected);
}

export async function restoreLinkedMeiEdition(panel: HTMLElement): Promise<boolean> {
  const query = new URL(window.location.href).searchParams;
  const workspaceId = query.get("workspace");
  const editionId = query.get("meiEdition");
  if (!workspaceId || !editionId) return false;
  await renderMeiEditionWorkspace(panel, workspaceId, editionId);
  return true;
}
