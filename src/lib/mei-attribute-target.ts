import type { MeiAttributeChange } from "./mei-edition-domain.js";

export function meiElementById(document: Document, id: string): Element | undefined {
  return Array.from(document.getElementsByTagName("*")).find(
    (element) =>
      element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") === id ||
      element.getAttribute("xml:id") === id
  );
}

export function meiAttributeTarget(
  document: Document,
  tokenId: string,
  attribute: MeiAttributeChange["attribute"]
): Element | undefined {
  const token = meiElementById(document, tokenId);
  if (!token) return undefined;
  if ((attribute === "dur" || attribute === "dots") && token.localName === "tabDurSym") {
    return token.parentElement?.localName === "tabGrp" ? token.parentElement : undefined;
  }
  return token;
}
