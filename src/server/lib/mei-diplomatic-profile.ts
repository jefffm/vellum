import type { DiplomaticToken } from "../../lib/mei-edition-domain.js";
import { ApiRouteError } from "./create-route.js";

const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";

export function validateVellumDiplomaticTablatureProfile(
  document: Document,
  tokens: readonly DiplomaticToken[]
): void {
  if (document.documentElement.getAttribute("meiversion") !== "5.1") {
    throw profileError("requires canonical MEI 5.1");
  }
  const zones = new Set(
    Array.from(document.querySelectorAll("zone"))
      .map(elementXmlId)
      .filter((id): id is string => Boolean(id))
  );
  const tokenIds = new Set<string>();
  for (const token of tokens) {
    if (tokenIds.has(token.id)) {
      throw profileError(`rejects duplicate diplomatic token ${token.id}`);
    }
    tokenIds.add(token.id);
    if (token.region.x + token.region.width > 1 || token.region.y + token.region.height > 1) {
      throw profileError(`rejects facsimile region outside the page for token ${token.id}`);
    }
    const element = elementByXmlId(document, token.id);
    if (!element) throw profileError(`requires an MEI element for token ${token.id}`);
    if (!tokenElementNames(token.kind).has(element.localName)) {
      throw profileError(`rejects ${token.kind} token ${token.id} on <${element.localName}>`);
    }
    const facsimileId = localFacsimileId(element.getAttribute("facs"));
    if (!facsimileId || !zones.has(facsimileId)) {
      throw profileError(`requires token ${token.id} to reference an existing facsimile zone`);
    }
  }

  for (const element of Array.from(
    document.querySelectorAll('note, tabDurSym:not([type="strum-render-anchor"])')
  )) {
    const id = elementXmlId(element);
    if (!id || !tokenIds.has(id)) {
      throw profileError(
        "requires every visible tablature and rhythm token to have a stable ID and facsimile region"
      );
    }
  }
  for (const element of Array.from(document.querySelectorAll("[facs]"))) {
    const facsimileId = localFacsimileId(element.getAttribute("facs"));
    if (!facsimileId || !zones.has(facsimileId)) {
      throw profileError(`rejects non-local or missing facsimile link on <${element.localName}>`);
    }
  }
  for (const note of Array.from(document.querySelectorAll("note"))) {
    if (note.parentElement?.localName !== "tabGrp") {
      throw profileError("permits tablature notes only inside tabGrp");
    }
    const course = Number(note.getAttribute("tab.course"));
    const fret = Number(note.getAttribute("tab.fret"));
    if (
      !note.hasAttribute("tab.course") ||
      !note.hasAttribute("tab.fret") ||
      !Number.isInteger(course) ||
      course < 1 ||
      course > 13 ||
      !Number.isInteger(fret) ||
      fret < 0 ||
      fret > 12
    ) {
      throw profileError("requires bounded integer course and fret evidence");
    }
    const forbidden = ["pname", "oct", "pnum", "accid.ges", "dur.ges"].find((attribute) =>
      note.hasAttribute(attribute)
    );
    if (forbidden || Array.from(note.attributes).some(({ name }) => name.startsWith("midi."))) {
      throw profileError(
        `rejects interpreted sounding-pitch data on ${elementXmlId(note) ?? "note"}`
      );
    }
  }
  for (const rhythm of Array.from(document.querySelectorAll("tabDurSym"))) {
    if (rhythm.parentElement?.localName !== "tabGrp") {
      throw profileError("permits rhythm signs only inside tabGrp");
    }
  }
  for (const annotation of Array.from(document.querySelectorAll('annot[type^="visible-"]'))) {
    if (annotation.textContent?.trim() === "none") continue;
    const id = elementXmlId(annotation);
    if (!id || !tokenIds.has(id)) {
      throw profileError(
        "requires visible annotations to be stable facsimile-linked diplomatic tokens"
      );
    }
  }
}

function profileError(message: string): ApiRouteError {
  return new ApiRouteError(`Vellum Diplomatic Tablature Profile ${message}`, 422);
}

function localFacsimileId(value: string | null): string | undefined {
  return value?.match(/^#([A-Za-z_][A-Za-z0-9_.:-]*)$/)?.[1];
}

function tokenElementNames(kind: DiplomaticToken["kind"]): ReadonlySet<string> {
  if (kind === "tablature") return new Set(["note"]);
  if (kind === "rhythm") return new Set(["tabDurSym"]);
  if (kind === "strum" || kind === "pince") return new Set(["annot", "tabGrp"]);
  if (kind === "barline") return new Set(["annot", "measure"]);
  return new Set(["annot"]);
}

function elementXmlId(element: Element): string | undefined {
  return element.getAttributeNS(XML_NAMESPACE, "id") ?? element.getAttribute("xml:id") ?? undefined;
}

function elementByXmlId(document: Document, id: string): Element | undefined {
  return Array.from(document.getElementsByTagName("*")).find(
    (element) => elementXmlId(element) === id
  );
}
