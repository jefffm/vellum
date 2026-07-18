import { mountSafeVerovioSvg } from "./artifact-preview.js";
import { browserSha256 } from "./lib/canonical-json.js";
import type {
  CorrectionBatchCommand,
  DiplomaticToken,
  MeiAttributeChange,
  MeiEditionVersion,
  ModelCorrectionProvenance,
  PassageSelection,
  SelectionContextEnvelope,
} from "./lib/mei-edition-domain.js";
import { meiAttributeTarget } from "./lib/mei-attribute-target.js";
import { runBoundedModelAction } from "./lib/vellum-stream-proxy.js";

type ProjectedEdition = Readonly<{
  edition: MeiEditionVersion;
  svg: string;
  rendererVersion: string;
  sourceContentUrl: string;
}>;

type ProposalSuggestion = Readonly<{
  id: string;
  tokenId: string;
  attribute: MeiAttributeChange["attribute"];
  replacementValue: string;
  rationale: string;
}>;

type ParsedProposal = Readonly<{
  summary: string;
  layer: "transcription" | "interpretation" | "emendation";
  suggestions: readonly ProposalSuggestion[];
}>;

const selectionMemory = new Map<
  string,
  { editionVersion: number; meiIds: string[]; stale: boolean }
>();

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as
    | { ok: true; data: T }
    | { ok: false; error?: { message?: string } };
  if (!response.ok || !body.ok)
    throw new Error(
      !body.ok ? (body.error?.message ?? "Edition request failed") : "Edition request failed"
    );
  return body.data;
}

function xmlId(element: Element): string | undefined {
  return (
    element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") ??
    element.getAttribute("xml:id") ??
    undefined
  );
}

function selectedObject(
  document: Document,
  token: DiplomaticToken
): SelectionContextEnvelope["selectedObjects"][number] {
  const element = Array.from(document.getElementsByTagName("*")).find(
    (candidate) => xmlId(candidate) === token.id
  );
  if (!element) throw new Error(`Selected MEI object is missing: ${token.id}`);
  const measure = element.closest("measure");
  const measureNumber = Number(measure?.getAttribute("n"));
  const rhythmGroup = element.localName === "tabDurSym" ? element.parentElement : undefined;
  const numeric = (name: string, source: Element = element) => {
    const value = source.getAttribute(name);
    return value === null ? undefined : Number(value);
  };
  return {
    id: token.id,
    kind: token.kind,
    ...(measure && xmlId(measure) ? { measureId: xmlId(measure) } : {}),
    ...(Number.isInteger(measureNumber) && measureNumber > 0 ? { measureNumber } : {}),
    ...(numeric("tab.course") !== undefined ? { course: numeric("tab.course") } : {}),
    ...(numeric("tab.fret") !== undefined ? { fret: numeric("tab.fret") } : {}),
    ...(rhythmGroup?.getAttribute("dur") ? { dur: Number(rhythmGroup.getAttribute("dur")) } : {}),
    ...(rhythmGroup?.getAttribute("dots")
      ? { dots: Number(rhythmGroup.getAttribute("dots")) }
      : {}),
    ...(token.kind === "strum"
      ? {
          strumDirection: (element.getAttribute("type") ?? "").includes("historical-strum-up")
            ? ("up" as const)
            : ("down" as const),
        }
      : {}),
  };
}

function buildContext(
  edition: MeiEditionVersion,
  selectedIds: readonly string[],
  orderedIds: readonly string[],
  roleFilter: PassageSelection["roleFilter"]
): SelectionContextEnvelope {
  const meiDocument = new DOMParser().parseFromString(edition.mei, "application/xml");
  const indexes = selectedIds
    .map((id) => orderedIds.indexOf(id))
    .sort((left, right) => left - right);
  const contiguous = indexes.every(
    (value, index) => index === 0 || value === indexes[index - 1]! + 1
  );
  const selection: PassageSelection = {
    id: `passage-selection.${crypto.randomUUID()}`,
    editionId: edition.editionId,
    editionVersion: edition.version,
    mode: contiguous ? "contiguous" : "noncontiguous",
    roleFilter,
    meiIds: [...selectedIds],
  };
  const scoreDef = meiDocument.querySelector("scoreDef");
  const neighborIndexes = new Set(
    indexes
      .flatMap((index) => [index - 1, index + 1])
      .filter((index) => index >= 0 && index < orderedIds.length)
  );
  for (const index of indexes) neighborIndexes.delete(index);
  return {
    kind: "vellum_mei_selection_context_v1",
    selection,
    sourcePage: edition.sourcePage,
    meter: {
      count: Number(scoreDef?.getAttribute("meter.count") ?? 1),
      unit: Number(scoreDef?.getAttribute("meter.unit") ?? 4),
    },
    tuning: Array.from(meiDocument.querySelectorAll("tuning > course")).map((course) => ({
      course: Number(course.getAttribute("n")),
      pname: `${course.getAttribute("pname") ?? "c"}${course.getAttribute("accid") ?? ""}`,
      octave: Number(course.getAttribute("oct")),
    })),
    selectedObjects: selectedIds.map((id) =>
      selectedObject(meiDocument, edition.tokens.find((token) => token.id === id)!)
    ),
    neighborIds: [...neighborIndexes]
      .sort((left, right) => left - right)
      .map((index) => orderedIds[index]!),
    facsimileIncluded: false,
  };
}

function eligible(
  token: DiplomaticToken,
  element: Element,
  filter: PassageSelection["roleFilter"]
): boolean {
  if (filter === "rhythm") return token.kind === "rhythm";
  if (token.kind !== "tablature") return filter === "all" && token.kind !== "barline";
  const course = Number(element.getAttribute("tab.course"));
  if (filter === "all") return true;
  if (filter === "treble_courses") return course <= 2;
  if (filter === "middle_course") return course === 3;
  return course >= 4;
}

function parseProposal(content: string, selectedIds: ReadonlySet<string>): ParsedProposal {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const value = JSON.parse(cleaned) as Partial<ParsedProposal>;
  if (
    !value ||
    typeof value.summary !== "string" ||
    !["transcription", "interpretation", "emendation"].includes(value.layer ?? "") ||
    !Array.isArray(value.suggestions)
  )
    throw new Error("The model response is not a typed Vellum proposal");
  const allowed = new Set(["tab.course", "tab.fret", "dur", "dots", "strum.direction"]);
  const suggestions = value.suggestions.map((raw) => {
    if (
      !raw ||
      typeof raw.id !== "string" ||
      typeof raw.tokenId !== "string" ||
      !selectedIds.has(raw.tokenId) ||
      !allowed.has(raw.attribute) ||
      typeof raw.replacementValue !== "string" ||
      typeof raw.rationale !== "string"
    )
      throw new Error("A model suggestion escaped the selected typed correction boundary");
    return raw;
  });
  if (value.layer !== "transcription" && suggestions.length)
    throw new Error(`${value.layer} proposals cannot masquerade as transcription corrections`);
  return {
    summary: value.summary,
    layer: value.layer as ParsedProposal["layer"],
    suggestions,
  };
}

export async function installMeiEditionSelectionWorkbench(
  shell: HTMLElement,
  workspaceId: string,
  edition: MeiEditionVersion,
  svg: SVGSVGElement,
  onCommitted: (projected: ProjectedEdition) => Promise<void>
): Promise<void> {
  const base = `/api/workspaces/${workspaceId}/mei-editions/${edition.editionId}`;
  const meiDocument = new DOMParser().parseFromString(edition.mei, "application/xml");
  const tokenById = new Map(edition.tokens.map((token) => [token.id, token]));
  const elements = Array.from(meiDocument.querySelectorAll("note, tabDurSym"));
  const orderedIds = elements
    .map(xmlId)
    .filter((id): id is string => Boolean(id && tokenById.has(id)));
  const selected = new Set<string>();
  let anchorId: string | undefined;
  let roleFilter: PassageSelection["roleFilter"] = "all";
  const remembered = selectionMemory.get(edition.editionId);
  let remapMessage = "";
  if (remembered) {
    const allPresent = remembered.meiIds.every((id) => orderedIds.includes(id));
    if (allPresent && edition.version >= remembered.editionVersion) {
      remembered.meiIds.forEach((id) => selected.add(id));
      remapMessage =
        edition.version === remembered.editionVersion
          ? "Selection restored from this exact version."
          : `Selection remapped unambiguously from v${remembered.editionVersion} by stable MEI identity.`;
      selectionMemory.set(edition.editionId, {
        editionVersion: edition.version,
        meiIds: [...selected],
        stale: false,
      });
    } else {
      remapMessage = `Selection from v${remembered.editionVersion} is stale; canonical identity could not be remapped.`;
      selectionMemory.set(edition.editionId, { ...remembered, stale: true });
    }
  }
  const section = shell.ownerDocument.createElement("section");
  section.className = "mei-selection-workbench";
  section.innerHTML = `<header><div><p class="artifact-preview-eyebrow">Passage Selection</p><h2>Ask or propose a reviewed edit</h2></div><label>Role filter<select data-role-filter><option value="all">All sounding and rhythm tokens</option><option value="treble_courses">Treble courses 1–2</option><option value="middle_course">Middle course 3</option><option value="bass_courses">Bass courses 4–5</option><option value="rhythm">Rhythm signs</option></select></label></header><p data-selection-status>Click a token; Shift-click selects a range; Command/Ctrl-click toggles noncontiguous objects.</p><details data-context-details><summary>Inspect Selection Context Envelope</summary><p>Facsimile bytes are excluded unless separately authorized.</p><pre data-context></pre></details><div class="mei-model-request"><label>Request<input data-model-request value="Explain this passage and propose only source-supported transcription corrections."/></label><label>Response mode<select data-response-mode><option value="edit">Typed correction proposal</option><option value="explain">Explanation only</option></select></label><button type="button" data-ask-model disabled>Ask musicology assistant</button></div><p data-model-status></p><div data-model-result></div><div data-proposal-review></div><div data-proposal-preview></div><p data-selection-error role="alert"></p>`;
  shell.append(section);
  const status = section.querySelector<HTMLElement>("[data-selection-status]")!;
  const contextOutput = section.querySelector<HTMLElement>("[data-context]")!;
  const ask = section.querySelector<HTMLButtonElement>("[data-ask-model]")!;
  const error = section.querySelector<HTMLElement>("[data-selection-error]")!;
  const modelStatus = section.querySelector<HTMLElement>("[data-model-status]")!;
  const resultOutput = section.querySelector<HTMLElement>("[data-model-result]")!;
  const review = section.querySelector<HTMLElement>("[data-proposal-review]")!;
  const previewOutput = section.querySelector<HTMLElement>("[data-proposal-preview]")!;
  let currentContext: SelectionContextEnvelope | undefined;

  const renderSelection = () => {
    svg
      .querySelectorAll(".passage-selected")
      .forEach((node) => node.classList.remove("passage-selected"));
    for (const id of selected)
      svg.querySelector(`g[data-id="${CSS.escape(id)}"]`)?.classList.add("passage-selected");
    if (!selected.size) {
      currentContext = undefined;
      contextOutput.textContent = "";
      ask.disabled = true;
      status.textContent = remapMessage || "Select one or more canonical MEI objects.";
      return;
    }
    const orderedSelection = orderedIds.filter((id) => selected.has(id));
    currentContext = buildContext(edition, orderedSelection, orderedIds, roleFilter);
    contextOutput.textContent = JSON.stringify(currentContext, null, 2);
    ask.disabled = false;
    status.textContent = `${orderedSelection.length} canonical object(s) · ${currentContext.selection.mode} · edition v${edition.version}. ${remapMessage}`;
    selectionMemory.set(edition.editionId, {
      editionVersion: edition.version,
      meiIds: orderedSelection,
      stale: false,
    });
  };

  for (const id of orderedIds) {
    const node = svg.querySelector<SVGGElement>(`g[data-id="${CSS.escape(id)}"]`);
    if (!node) continue;
    node.classList.add("vellum-selectable-event");
    node.setAttribute("role", "button");
    node.tabIndex = 0;
  }
  svg.addEventListener("click", (event) => {
    const target = (event.target as Element | null)?.closest<SVGGElement>("g[data-id]");
    const id = target?.dataset.id;
    const token = id ? tokenById.get(id) : undefined;
    const source = id ? elements.find((element) => xmlId(element) === id) : undefined;
    if (!id || !token || !source || !eligible(token, source, roleFilter)) return;
    if (event.shiftKey && anchorId) {
      const left = orderedIds.indexOf(anchorId);
      const right = orderedIds.indexOf(id);
      for (let index = Math.min(left, right); index <= Math.max(left, right); index += 1) {
        const candidateId = orderedIds[index]!;
        const candidate = tokenById.get(candidateId)!;
        const candidateElement = elements.find((element) => xmlId(element) === candidateId)!;
        if (eligible(candidate, candidateElement, roleFilter)) selected.add(candidateId);
      }
    } else if (event.metaKey || event.ctrlKey) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      anchorId = id;
    } else {
      selected.clear();
      selected.add(id);
      anchorId = id;
    }
    remapMessage = "";
    renderSelection();
  });
  section.querySelector<HTMLSelectElement>("[data-role-filter]")!.onchange = (event) => {
    roleFilter = (event.currentTarget as HTMLSelectElement).value as PassageSelection["roleFilter"];
    for (const id of [...selected]) {
      const token = tokenById.get(id)!;
      const element = elements.find((candidate) => xmlId(candidate) === id)!;
      if (!eligible(token, element, roleFilter)) selected.delete(id);
    }
    renderSelection();
  };

  ask.onclick = () => {
    if (!currentContext) return;
    error.textContent = "";
    review.replaceChildren();
    previewOutput.replaceChildren();
    ask.disabled = true;
    const mode = section.querySelector<HTMLSelectElement>("[data-response-mode]")!.value;
    const request = section.querySelector<HTMLInputElement>("[data-model-request]")!.value.trim();
    void (async () => {
      const contextDigest = await browserSha256(currentContext);
      const schemaInstruction =
        mode === "edit"
          ? 'Return only JSON: {"summary":string,"layer":"transcription"|"interpretation"|"emendation","suggestions":[{"id":string,"tokenId":string,"attribute":"tab.course"|"tab.fret"|"dur"|"dots"|"strum.direction","replacementValue":string,"rationale":string}]}. Use an empty suggestions array when no source-supported correction is warranted.'
          : "Explain the selected passage in plain text. Do not propose or apply canonical changes.";
      const intent = `${request}\n\nSelection-Context-SHA256: ${contextDigest}\nFacsimile-Included: false\n${schemaInstruction}\n\n${JSON.stringify(currentContext, null, 2)}`;
      modelStatus.textContent = "Awaiting one-time egress authorization…";
      const outcome = await runBoundedModelAction(workspaceId, intent);
      if (outcome.status === "denied") {
        modelStatus.textContent = outcome.message;
        return;
      }
      modelStatus.textContent = `Model Action Result Commit ${outcome.publication.commit.id}`;
      resultOutput.textContent = outcome.publication.result.content;
      if (mode !== "edit") return;
      const proposal = parseProposal(
        outcome.publication.result.content,
        new Set(currentContext!.selection.meiIds)
      );
      if (proposal.layer !== "transcription") {
        review.textContent = `${proposal.layer} proposal retained separately; this transcription workbench will not apply it.`;
        return;
      }
      const proposalDigest = await browserSha256(outcome.publication.result.content);
      await renderProposalReview({
        proposal,
        context: currentContext!,
        contextDigest,
        proposalDigest,
        modelActionId: outcome.action.id,
        publicationId: outcome.publication.id,
        resultCommitId: outcome.publication.commit.id,
      });
    })()
      .catch((reason) => {
        error.textContent = reason instanceof Error ? reason.message : "Model proposal failed";
      })
      .finally(() => (ask.disabled = !currentContext));
  };

  async function renderProposalReview(input: {
    proposal: ParsedProposal;
    context: SelectionContextEnvelope;
    contextDigest: string;
    proposalDigest: string;
    modelActionId: string;
    publicationId: string;
    resultCommitId: string;
  }) {
    review.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = input.proposal.summary;
    review.append(heading);
    const rows: Array<{
      suggestion: ProposalSuggestion;
      decision: HTMLSelectElement;
      replacement: HTMLInputElement;
    }> = [];
    for (const suggestion of input.proposal.suggestions) {
      const row = document.createElement("div");
      row.className = "mei-proposal-row";
      row.innerHTML = `<strong></strong><span></span><label>Decision<select><option value="rejected">Reject</option><option value="approved">Approve</option></select></label><label>Final value<input/></label>`;
      row.querySelector("strong")!.textContent = `${suggestion.tokenId} · ${suggestion.attribute}`;
      row.querySelector("span")!.textContent = suggestion.rationale;
      const decision = row.querySelector("select")!;
      const replacement = row.querySelector("input")!;
      replacement.value = suggestion.replacementValue;
      rows.push({ suggestion, decision, replacement });
      review.append(row);
    }
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.textContent = "Preview reviewed set";
    const commitButton = document.createElement("button");
    commitButton.type = "button";
    commitButton.textContent = "Commit reviewed Correction Batch";
    commitButton.disabled = true;
    review.append(previewButton, commitButton);
    let command: CorrectionBatchCommand | undefined;
    const buildCommand = (): CorrectionBatchCommand => {
      const decisions: ModelCorrectionProvenance["decisions"] = [];
      const changes: MeiAttributeChange[] = [];
      for (const row of rows) {
        const approved = row.decision.value === "approved";
        const originalValue = attributeValue(
          edition.mei,
          row.suggestion.tokenId,
          row.suggestion.attribute
        );
        const finalChange: MeiAttributeChange | undefined = approved
          ? {
              tokenId: row.suggestion.tokenId,
              attribute: row.suggestion.attribute,
              ...(originalValue !== undefined ? { expectedValue: originalValue } : {}),
              replacementValue: row.replacement.value,
              rationale: row.suggestion.rationale,
            }
          : undefined;
        if (finalChange) changes.push(finalChange);
        decisions.push({
          suggestionId: row.suggestion.id,
          decision: approved
            ? row.replacement.value === row.suggestion.replacementValue
              ? "approved"
              : "revised"
            : "rejected",
          ...(finalChange ? { finalChange } : {}),
          rationale: approved ? "Included in the reviewed preview." : "Excluded by the Owner.",
        });
      }
      if (!changes.length) throw new Error("Approve at least one typed suggestion before preview");
      return {
        id: `correction-batch.${crypto.randomUUID()}`,
        name: `Model-assisted corrections for ${input.context.selection.id}`,
        expectedVersion: edition.version,
        layer: "transcription",
        changes,
        modelProvenance: {
          modelActionId: input.modelActionId,
          publicationId: input.publicationId,
          resultCommitId: input.resultCommitId,
          selectionContext: input.context,
          selectionContextDigest: input.contextDigest,
          proposalDigest: input.proposalDigest,
          proposalLayer: "transcription",
          decisions,
        },
      };
    };
    previewButton.onclick = () => {
      error.textContent = "";
      void (async () => {
        command = buildCommand();
        const projected = await api<ProjectedEdition>(`${base}/correction-preview`, {
          method: "POST",
          body: JSON.stringify(command),
        });
        previewOutput.replaceChildren();
        const label = document.createElement("p");
        label.textContent = `Complete staged preview · canonical parent v${edition.version}`;
        const notation = document.createElement("div");
        notation.className = "artifact-preview-content";
        const previewSvg = mountSafeVerovioSvg(notation, projected.svg);
        for (const id of input.context.selection.meiIds)
          previewSvg
            .querySelector(`g[data-id="${CSS.escape(id)}"]`)
            ?.classList.add("passage-selected");
        previewOutput.append(label, notation);
        commitButton.disabled = false;
      })().catch((reason) => {
        error.textContent = reason instanceof Error ? reason.message : "Proposal preview failed";
      });
    };
    commitButton.onclick = () => {
      if (!command) return;
      commitButton.disabled = true;
      void api<ProjectedEdition>(`${base}/correction-batches`, {
        method: "POST",
        body: JSON.stringify(command),
      })
        .then(onCommitted)
        .catch((reason) => {
          error.textContent = reason instanceof Error ? reason.message : "Proposal commit failed";
          commitButton.disabled = false;
        });
    };
  }

  renderSelection();
}

function attributeValue(
  mei: string,
  tokenId: string,
  attribute: MeiAttributeChange["attribute"]
): string | undefined {
  const document = new DOMParser().parseFromString(mei, "application/xml");
  const element = meiAttributeTarget(document, tokenId, attribute);
  return element?.getAttribute(attribute) ?? undefined;
}
