import { createHash, randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";

import type {
  CorrectionBatchCommand,
  CorrectionBatchRecord,
  CreateMeiEditionCommand,
  DiplomaticToken,
  MeiAttributeChange,
  MeiEditionVersion,
  ModelCorrectionProvenance,
  SelectionContextEnvelope,
  TokenReviewResolution,
} from "../../lib/mei-edition-domain.js";
import { meiAttributeTarget } from "../../lib/mei-attribute-target.js";
import { canonicalJson } from "../../lib/canonical-json.js";
import { ApiRouteError } from "./create-route.js";
import { validateVellumDiplomaticTablatureProfile } from "./mei-diplomatic-profile.js";
import { MeiEditionStore } from "./mei-edition-store.js";
import { validateAgainstPinnedMeiSchema } from "./mei-schema-validator.js";
import { WorkspaceStore } from "./workspace-store.js";

const EDITABLE_ATTRIBUTES = Object.freeze({
  "tab.course": /^(?:[1-9]|1[0-3])$/,
  "tab.fret": /^(?:[0-9]|1[0-2])$/,
  dur: /^(?:1|2|4|8|16|32|64)$/,
  dots: /^(?:1|2|3)$/,
  "strum.direction": /^(?:up|down)$/,
});

const PROHIBITED_XML = /<!\s*(?:doctype|entity)\b/i;

export interface DiplomaticExtractionAdapter {
  readonly id: string;
  readonly version: string;
  extract(input: Readonly<{ sourceArtifactId: string; page: number }>): Promise<
    Readonly<{
      mei: string;
      tokens: readonly DiplomaticToken[];
      diagnostics: readonly string[];
    }>
  >;
}

export class MeiEditionService {
  private readonly store: MeiEditionStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly validateCanonical: (mei: string, tokens: readonly DiplomaticToken[]) => void;
  private readonly workspaces: WorkspaceStore;

  constructor(options: {
    store: MeiEditionStore;
    workspaces?: WorkspaceStore;
    now?: () => Date;
    createId?: () => string;
    validateCanonical?: (mei: string, tokens: readonly DiplomaticToken[]) => void;
  }) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.validateCanonical =
      options.validateCanonical ?? ((mei) => validateAgainstPinnedMeiSchema(mei));
    this.workspaces =
      options.workspaces ?? new WorkspaceStore({ rootDirectory: options.store.rootDirectory });
  }

  create(workspaceId: string, command: CreateMeiEditionCommand): MeiEditionVersion {
    const mei = validateAndSerializeMei(command.mei, command.tokens);
    this.validateCanonical(mei, command.tokens);
    return this.store.create(workspaceId, {
      editionId: `edition.${this.createId()}`,
      version: 1,
      sourceArtifactId: command.sourceArtifactId,
      sourcePage: command.sourcePage,
      title: command.title,
      mei,
      tokens: command.tokens,
      extraction: command.extraction,
      createdAt: this.now().toISOString(),
    });
  }

  get(workspaceId: string, editionId: string, version?: number): MeiEditionVersion {
    return this.store.get(workspaceId, editionId, version);
  }

  preview(
    workspaceId: string,
    editionId: string,
    command: CorrectionBatchCommand
  ): MeiEditionVersion {
    const current = this.store.get(workspaceId, editionId);
    return this.apply(workspaceId, current, command);
  }

  commit(
    workspaceId: string,
    editionId: string,
    command: CorrectionBatchCommand
  ): MeiEditionVersion {
    const current = this.store.get(workspaceId, editionId);
    const next = this.apply(workspaceId, current, command);
    this.validateCanonical(next.mei, next.tokens);
    return this.store.commit(workspaceId, next, command.expectedVersion);
  }

  undo(workspaceId: string, editionId: string, expectedVersion: number): MeiEditionVersion {
    const current = this.store.get(workspaceId, editionId);
    if (current.version !== expectedVersion) {
      throw new ApiRouteError(
        `MEI Edition parent is stale: expected v${expectedVersion}, current v${current.version}`,
        409
      );
    }
    const priorBatch = current.correctionBatch;
    if (!priorBatch)
      throw new ApiRouteError("The current MEI Edition version has no batch to undo", 409);
    const inverse: CorrectionBatchCommand = {
      id: `correction-batch.${this.createId()}`,
      name: `Undo ${priorBatch.name}`,
      expectedVersion,
      layer: "transcription",
      changes: priorBatch.changes.map((change) => ({
        tokenId: change.tokenId,
        attribute: change.attribute,
        expectedValue: change.replacementValue,
        replacementValue: change.expectedValue,
        rationale: `Inverse of ${priorBatch.id}: ${change.rationale}`,
      })),
      ...(priorBatch.reviewResolutions?.length
        ? {
            reviewResolutions: priorBatch.reviewResolutions.map((resolution) => ({
              tokenId: resolution.tokenId,
              expectedState: resolution.replacementState,
              replacementState: resolution.expectedState,
              rationale: `Inverse of ${priorBatch.id}: ${resolution.rationale}`,
            })),
          }
        : {}),
    };
    const next = this.apply(workspaceId, current, inverse, priorBatch.id);
    this.validateCanonical(next.mei, next.tokens);
    return this.store.commit(workspaceId, next, expectedVersion);
  }

  private apply(
    workspaceId: string,
    current: MeiEditionVersion,
    command: CorrectionBatchCommand,
    inverseOfBatchId?: string
  ): MeiEditionVersion {
    if (current.version !== command.expectedVersion) {
      throw new ApiRouteError(
        `MEI Edition parent is stale: expected v${command.expectedVersion}, current v${current.version}`,
        409
      );
    }
    if (!command.changes.length && !command.reviewResolutions?.length) {
      throw new ApiRouteError("A Correction Batch must change or review at least one token", 400);
    }
    if (command.modelProvenance && command.reviewResolutions?.length) {
      throw new ApiRouteError(
        "A model proposal cannot resolve source uncertainty without a separate Owner review",
        400
      );
    }
    if (command.modelProvenance)
      this.verifyModelProvenance(workspaceId, current, command.modelProvenance, command.changes);
    const duplicateKeys = new Set<string>();
    for (const change of command.changes) {
      const key = `${change.tokenId}\u0000${change.attribute}`;
      if (duplicateKeys.has(key)) {
        throw new ApiRouteError(
          `Correction Batch changes ${change.tokenId} ${change.attribute} twice`,
          400
        );
      }
      duplicateKeys.add(key);
    }
    const dom = parseMei(current.mei);
    for (const change of command.changes)
      applyAttributeChange(dom.window.document, current.tokens, change);
    const explicitReviews = command.reviewResolutions ?? [];
    validateReviewResolutions(current.tokens, explicitReviews);
    const reviewedIds = new Set(explicitReviews.map(({ tokenId }) => tokenId));
    const automaticReviews: TokenReviewResolution[] = command.changes.flatMap((change) => {
      const token = current.tokens.find(({ id }) => id === change.tokenId);
      if (!token?.critical || reviewedIds.has(token.id)) return [];
      reviewedIds.add(token.id);
      return [
        {
          tokenId: token.id,
          expectedState: tokenReviewState(token),
          replacementState: { critical: false, confidence: 1, alternatives: [] },
          rationale: `Resolved by reviewed attribute correction: ${change.rationale}`,
        },
      ];
    });
    const reviewResolutions = [...explicitReviews, ...automaticReviews];
    const reviewsById = new Map(
      reviewResolutions.map((resolution) => [resolution.tokenId, resolution.replacementState])
    );
    const tokens = current.tokens.map((token) =>
      reviewsById.has(token.id) ? { ...token, ...reviewsById.get(token.id)! } : token
    );
    const committedAt = this.now().toISOString();
    const correctionBatch: CorrectionBatchRecord = {
      ...command,
      ...(reviewResolutions.length ? { reviewResolutions } : {}),
      committedAt,
      ...(inverseOfBatchId ? { inverseOfBatchId } : {}),
    };
    return {
      ...current,
      version: current.version + 1,
      parentVersion: current.version,
      mei: validateAndSerializeDocument(dom, tokens),
      tokens,
      correctionBatch,
      createdAt: committedAt,
    };
  }

  private verifyModelProvenance(
    workspaceId: string,
    current: MeiEditionVersion,
    provenance: ModelCorrectionProvenance,
    changes: readonly MeiAttributeChange[]
  ): void {
    if (provenance.proposalLayer !== "transcription")
      throw new ApiRouteError("A transcription Correction Batch cannot mix proposal layers", 400);
    const selection = provenance.selectionContext.selection;
    if (selection.editionId !== current.editionId || selection.editionVersion !== current.version)
      throw new ApiRouteError("Model proposal targets another MEI Edition version", 409);
    const contextDigest = createHash("sha256")
      .update(canonicalJson(provenance.selectionContext))
      .digest("hex");
    if (contextDigest !== provenance.selectionContextDigest)
      throw new ApiRouteError("Selection Context digest mismatch", 409);
    this.assertSelectionContext(current, provenance.selectionContext);
    const action = this.workspaces.getModelAction(workspaceId, provenance.modelActionId);
    const publication = this.workspaces.getModelActionPublicationForAction(
      workspaceId,
      provenance.modelActionId
    );
    if (
      action.publicationReference !== provenance.publicationId ||
      publication.id !== provenance.publicationId ||
      publication.commit.id !== provenance.resultCommitId
    )
      throw new ApiRouteError("Model Action Result Commit linkage mismatch", 409);
    if (!action.intent.includes(`Selection-Context-SHA256: ${contextDigest}`))
      throw new ApiRouteError("Model Action intent is not bound to this Selection Context", 409);
    const proposalDigest = createHash("sha256").update(publication.result.content).digest("hex");
    if (proposalDigest !== provenance.proposalDigest)
      throw new ApiRouteError("Model proposal digest mismatch", 409);
    const parsedProposal = parseModelProposal(publication.result.content);
    if (parsedProposal.layer !== provenance.proposalLayer)
      throw new ApiRouteError("Model proposal layer linkage mismatch", 409);
    const suggestionIds = parsedProposal.suggestions.map((suggestion) => suggestion.id);
    const decisionIds = provenance.decisions.map((decision) => decision.suggestionId);
    if (
      new Set(suggestionIds).size !== suggestionIds.length ||
      new Set(decisionIds).size !== decisionIds.length ||
      canonicalJson([...suggestionIds].sort()) !== canonicalJson([...decisionIds].sort())
    )
      throw new ApiRouteError("Model proposal decisions do not cover the exact suggestions", 409);
    if (
      provenance.decisions.some(
        (decision) => decision.decision === "rejected" && decision.finalChange
      )
    )
      throw new ApiRouteError("A rejected model suggestion cannot carry a final change", 400);
    for (const decision of provenance.decisions) {
      const suggestion = parsedProposal.suggestions.find(
        (candidate) => candidate.id === decision.suggestionId
      )!;
      if (decision.decision === "rejected") continue;
      const change = decision.finalChange;
      if (
        !change ||
        change.tokenId !== suggestion.tokenId ||
        change.attribute !== suggestion.attribute ||
        (decision.decision === "approved" &&
          (change.replacementValue !== suggestion.replacementValue ||
            change.rationale !== suggestion.rationale))
      )
        throw new ApiRouteError("Reviewed decision is not bound to its model suggestion", 409);
    }
    const selected = new Set(selection.meiIds);
    const decidedChanges = provenance.decisions
      .filter((decision) => decision.decision !== "rejected")
      .map((decision) => decision.finalChange);
    if (decidedChanges.some((change) => !change))
      throw new ApiRouteError("Every approved model suggestion requires a final typed change", 400);
    if (
      decidedChanges.some((change) => !selected.has(change!.tokenId)) ||
      canonicalJson(decidedChanges) !== canonicalJson(changes)
    )
      throw new ApiRouteError("Approved model decisions do not match the Correction Batch", 409);
  }

  private assertSelectionContext(
    current: MeiEditionVersion,
    context: SelectionContextEnvelope
  ): void {
    if (context.sourcePage !== current.sourcePage)
      throw new ApiRouteError("Selection Context source page mismatch", 409);
    const ids = context.selection.meiIds;
    if (
      context.selectedObjects.length !== ids.length ||
      new Set(ids).size !== ids.length ||
      context.selectedObjects.some((object) => !ids.includes(object.id))
    )
      throw new ApiRouteError("Selection Context object identity mismatch", 409);
    const dom = parseMei(current.mei);
    try {
      const scoreDef = dom.window.document.querySelector("scoreDef");
      const expectedMeter = {
        count: Number(scoreDef?.getAttribute("meter.count") ?? 1),
        unit: Number(scoreDef?.getAttribute("meter.unit") ?? 4),
      };
      const expectedTuning = Array.from(
        dom.window.document.querySelectorAll("tuning > course")
      ).map((course) => ({
        course: Number(course.getAttribute("n")),
        pname: `${course.getAttribute("pname") ?? "c"}${course.getAttribute("accid") ?? ""}`,
        octave: Number(course.getAttribute("oct")),
      }));
      if (
        canonicalJson(expectedMeter) !== canonicalJson(context.meter) ||
        canonicalJson(expectedTuning) !== canonicalJson(context.tuning)
      )
        throw new ApiRouteError("Selection Context meter or tuning mismatch", 409);
      for (const object of context.selectedObjects) {
        const token = current.tokens.find((candidate) => candidate.id === object.id);
        const element = elementByXmlId(dom.window.document, object.id);
        if (!token || !element || token.kind !== object.kind)
          throw new ApiRouteError("Selection Context does not match canonical MEI", 409);
        const measure = element.closest("measure");
        const group = element.localName === "tabDurSym" ? element.parentElement : undefined;
        const expected = {
          ...(measure && elementXmlId(measure) ? { measureId: elementXmlId(measure) } : {}),
          ...(measure?.getAttribute("n")
            ? { measureNumber: Number(measure.getAttribute("n")) }
            : {}),
          ...(element.hasAttribute("tab.course")
            ? { course: Number(element.getAttribute("tab.course")) }
            : {}),
          ...(element.hasAttribute("tab.fret")
            ? { fret: Number(element.getAttribute("tab.fret")) }
            : {}),
          ...(group?.hasAttribute("dur") ? { dur: Number(group.getAttribute("dur")) } : {}),
          ...(group?.hasAttribute("dots") ? { dots: Number(group.getAttribute("dots")) } : {}),
        };
        const actual = {
          ...(object.measureId ? { measureId: object.measureId } : {}),
          ...(object.measureNumber ? { measureNumber: object.measureNumber } : {}),
          ...(object.course !== undefined ? { course: object.course } : {}),
          ...(object.fret !== undefined ? { fret: object.fret } : {}),
          ...(object.dur !== undefined ? { dur: object.dur } : {}),
          ...(object.dots !== undefined ? { dots: object.dots } : {}),
        };
        if (canonicalJson(expected) !== canonicalJson(actual))
          throw new ApiRouteError(
            "Selection Context symbolic facts do not match canonical MEI",
            409
          );
      }
      const orderedIds = Array.from(dom.window.document.querySelectorAll("note, tabDurSym"))
        .map(elementXmlId)
        .filter((id): id is string => Boolean(id));
      const indexes = ids.map((id) => orderedIds.indexOf(id)).sort((left, right) => left - right);
      if (indexes.some((index) => index < 0))
        throw new ApiRouteError("Selection Context object is absent from canonical order", 409);
      const contiguous = indexes.every(
        (index, position) => position === 0 || index === indexes[position - 1]! + 1
      );
      if ((context.selection.mode === "contiguous") !== contiguous)
        throw new ApiRouteError("Selection Context range mode mismatch", 409);
      const expectedNeighbors = new Set(
        indexes
          .flatMap((index) => [index - 1, index + 1])
          .filter((index) => index >= 0 && index < orderedIds.length)
          .map((index) => orderedIds[index]!)
          .filter((id) => !ids.includes(id))
      );
      if (
        canonicalJson([...expectedNeighbors].sort()) !==
        canonicalJson([...context.neighborIds].sort())
      )
        throw new ApiRouteError("Selection Context neighbor boundary mismatch", 409);
    } finally {
      dom.window.close();
    }
  }
}

function tokenReviewState(token: DiplomaticToken): TokenReviewResolution["expectedState"] {
  return {
    critical: token.critical,
    confidence: token.confidence,
    alternatives: [...token.alternatives],
  };
}

function validateReviewResolutions(
  tokens: readonly DiplomaticToken[],
  resolutions: readonly TokenReviewResolution[]
): void {
  const seen = new Set<string>();
  for (const resolution of resolutions) {
    if (seen.has(resolution.tokenId))
      throw new ApiRouteError(`Correction Batch reviews ${resolution.tokenId} twice`, 400);
    seen.add(resolution.tokenId);
    const token = tokens.find(({ id }) => id === resolution.tokenId);
    if (!token)
      throw new ApiRouteError(
        `Review resolution references unknown diplomatic token: ${resolution.tokenId}`,
        400
      );
    if (JSON.stringify(tokenReviewState(token)) !== JSON.stringify(resolution.expectedState)) {
      throw new ApiRouteError(`Review precondition failed for ${resolution.tokenId}`, 409);
    }
    if (JSON.stringify(resolution.expectedState) === JSON.stringify(resolution.replacementState)) {
      throw new ApiRouteError(`Review resolution for ${resolution.tokenId} changes no state`, 400);
    }
  }
}

function elementXmlId(element: Element): string | undefined {
  return (
    element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") ??
    element.getAttribute("xml:id") ??
    undefined
  );
}

function parseModelProposal(content: string): {
  layer: "transcription" | "interpretation" | "emendation";
  suggestions: Array<{
    id: string;
    tokenId: string;
    attribute: MeiAttributeChange["attribute"];
    replacementValue: string;
    rationale: string;
  }>;
} {
  try {
    const value = JSON.parse(
      content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
    ) as { layer?: unknown; suggestions?: unknown };
    if (
      !["transcription", "interpretation", "emendation"].includes(String(value.layer)) ||
      !Array.isArray(value.suggestions) ||
      value.suggestions.some((suggestion) => {
        if (!suggestion || typeof suggestion !== "object") return true;
        const candidate = suggestion as Record<string, unknown>;
        return (
          typeof candidate.id !== "string" ||
          typeof candidate.tokenId !== "string" ||
          !["tab.course", "tab.fret", "dur", "dots", "strum.direction"].includes(
            String(candidate.attribute)
          ) ||
          typeof candidate.replacementValue !== "string" ||
          typeof candidate.rationale !== "string"
        );
      })
    )
      throw new Error();
    return {
      layer: value.layer as "transcription" | "interpretation" | "emendation",
      suggestions: value.suggestions as Array<{
        id: string;
        tokenId: string;
        attribute: MeiAttributeChange["attribute"];
        replacementValue: string;
        rationale: string;
      }>,
    };
  } catch {
    throw new ApiRouteError("Model Action result is not a typed Vellum proposal", 409);
  }
}

function parseMei(mei: string): JSDOM {
  if (PROHIBITED_XML.test(mei))
    throw new ApiRouteError("MEI may not contain a doctype or entity", 400);
  try {
    const dom = new JSDOM(mei, { contentType: "application/xml" });
    const root = dom.window.document.documentElement;
    if (root.localName !== "mei" || root.namespaceURI !== "http://www.music-encoding.org/ns/mei") {
      dom.window.close();
      throw new ApiRouteError("Diplomatic transcription must have an MEI root", 400);
    }
    return dom;
  } catch (error) {
    if (error instanceof ApiRouteError) throw error;
    throw new ApiRouteError("Diplomatic transcription is not well-formed MEI", 400);
  }
}

function validateAndSerializeMei(mei: string, tokens: readonly DiplomaticToken[]): string {
  const dom = parseMei(mei);
  try {
    return validateAndSerializeDocument(dom, tokens);
  } finally {
    dom.window.close();
  }
}

function validateAndSerializeDocument(dom: JSDOM, tokens: readonly DiplomaticToken[]): string {
  const document = dom.window.document;
  validateVellumDiplomaticTablatureProfile(document, tokens);
  return new dom.window.XMLSerializer().serializeToString(document);
}

function elementByXmlId(document: Document, id: string): Element | undefined {
  return Array.from(document.getElementsByTagName("*")).find(
    (element) =>
      element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") === id ||
      element.getAttribute("xml:id") === id
  );
}

function applyAttributeChange(
  document: Document,
  tokens: readonly DiplomaticToken[],
  change: MeiAttributeChange
): void {
  if (!tokens.some((token) => token.id === change.tokenId)) {
    throw new ApiRouteError(
      `Correction references unknown diplomatic token: ${change.tokenId}`,
      400
    );
  }
  const element = meiAttributeTarget(document, change.tokenId, change.attribute);
  if (!element)
    throw new ApiRouteError(`Correction target is absent from MEI: ${change.tokenId}`, 400);
  const current = editableAttributeValue(element, change.attribute);
  if (current !== change.expectedValue) {
    throw new ApiRouteError(
      `Correction precondition failed for ${change.tokenId} ${change.attribute}: expected ${change.expectedValue ?? "absent"}, found ${current ?? "absent"}`,
      409
    );
  }
  if (
    change.replacementValue !== undefined &&
    !EDITABLE_ATTRIBUTES[change.attribute].test(change.replacementValue)
  ) {
    throw new ApiRouteError(`Invalid ${change.attribute} value: ${change.replacementValue}`, 400);
  }
  if (change.attribute === "strum.direction") {
    if (!change.replacementValue)
      throw new ApiRouteError("A historical strum direction cannot be removed", 400);
    const types = (element.getAttribute("type") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((type) => !type.startsWith("historical-strum-"));
    element.setAttribute("type", `historical-strum-${change.replacementValue} ${types.join(" ")}`);
  } else if (change.replacementValue === undefined) element.removeAttribute(change.attribute);
  else element.setAttribute(change.attribute, change.replacementValue);
}

function editableAttributeValue(
  element: Element,
  attribute: MeiAttributeChange["attribute"]
): string | undefined {
  if (attribute !== "strum.direction") {
    return element.hasAttribute(attribute) ? element.getAttribute(attribute)! : undefined;
  }
  const type = element.getAttribute("type") ?? "";
  if (type.split(/\s+/).includes("historical-strum-up")) return "up";
  if (type.split(/\s+/).includes("historical-strum-down")) return "down";
  return undefined;
}
