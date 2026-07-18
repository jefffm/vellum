import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";

import type {
  CorrectionBatchCommand,
  CorrectionBatchRecord,
  CreateMeiEditionCommand,
  DiplomaticToken,
  MeiAttributeChange,
  MeiEditionVersion,
} from "../../lib/mei-edition-domain.js";
import { ApiRouteError } from "./create-route.js";
import { MeiEditionStore } from "./mei-edition-store.js";

const EDITABLE_ATTRIBUTES = Object.freeze({
  "tab.course": /^(?:[1-9]|1[0-3])$/,
  "tab.fret": /^(?:[0-9]|1[0-2])$/,
  dur: /^(?:1|2|4|8|16|32|64)$/,
  dots: /^(?:1|2|3)$/,
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

  constructor(options: { store: MeiEditionStore; now?: () => Date; createId?: () => string }) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  create(workspaceId: string, command: CreateMeiEditionCommand): MeiEditionVersion {
    const mei = validateAndSerializeMei(command.mei, command.tokens);
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
    return this.apply(current, command);
  }

  commit(
    workspaceId: string,
    editionId: string,
    command: CorrectionBatchCommand
  ): MeiEditionVersion {
    const current = this.store.get(workspaceId, editionId);
    const next = this.apply(current, command);
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
    };
    const next = this.apply(current, inverse, priorBatch.id);
    return this.store.commit(workspaceId, next, expectedVersion);
  }

  private apply(
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
    const affected = new Set(command.changes.map((change) => change.tokenId));
    const tokens = current.tokens.map((token) =>
      affected.has(token.id)
        ? { ...token, confidence: 1, alternatives: [], critical: false }
        : token
    );
    const committedAt = this.now().toISOString();
    const correctionBatch: CorrectionBatchRecord = {
      ...command,
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
  const tokenIds = new Set<string>();
  for (const token of tokens) {
    if (tokenIds.has(token.id))
      throw new ApiRouteError(`Duplicate diplomatic token: ${token.id}`, 400);
    tokenIds.add(token.id);
    if (token.region.x + token.region.width > 1 || token.region.y + token.region.height > 1) {
      throw new ApiRouteError(`Facsimile region leaves the page for token ${token.id}`, 400);
    }
    if (!elementByXmlId(document, token.id)) {
      throw new ApiRouteError(`Diplomatic token has no MEI element: ${token.id}`, 400);
    }
  }
  for (const element of Array.from(document.querySelectorAll("note, tabDurSym"))) {
    const id = element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id");
    if (!id || !tokenIds.has(id)) {
      throw new ApiRouteError(
        "Every visible tablature and rhythm token requires an ID and facsimile region",
        400
      );
    }
  }
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
  const element = elementByXmlId(document, change.tokenId);
  if (!element)
    throw new ApiRouteError(`Correction target is absent from MEI: ${change.tokenId}`, 400);
  const current = element.hasAttribute(change.attribute)
    ? element.getAttribute(change.attribute)!
    : undefined;
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
  if (change.replacementValue === undefined) element.removeAttribute(change.attribute);
  else element.setAttribute(change.attribute, change.replacementValue);
}
