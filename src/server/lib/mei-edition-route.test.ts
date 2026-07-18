import { describe, expect, it } from "vitest";

import { MEI_EDITION_PROOF_ID, MEI_EDITION_PROOF_VERSION } from "../../lib/mei-edition-fixtures.js";
import { PINNED_VEROVIO_VERSION } from "../../lib/verovio-renderer.js";
import { pdfFromMeiSvg, renderMeiEditionProof } from "./mei-edition-route.js";

describe("MEI edition server deliverables", () => {
  it("reproduces the browser rendering profile and emits a deterministic PDF", async () => {
    const first = await renderMeiEditionProof();
    const second = await renderMeiEditionProof();

    expect(MEI_EDITION_PROOF_ID).toBe("edition.visee-proof.1");
    expect(MEI_EDITION_PROOF_VERSION).toBe(1);
    expect(first.version).toMatch(new RegExp(`^${PINNED_VEROVIO_VERSION}(?:-|$)`));
    expect(first.profile).toEqual(second.profile);
    expect(first.svg).toBe(second.svg);
    expect(first.svg).toContain('data-id="note-1"');
    expect(first.svg).toContain('href="#vellum-vrv-definition-');
    expect(first.svg).not.toMatch(/<style|<script|href="(?:https?:|javascript:)/i);

    const [firstPdf, secondPdf] = await Promise.all([
      pdfFromMeiSvg(first.svg),
      pdfFromMeiSvg(first.svg),
    ]);
    expect(firstPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(firstPdf.length).toBeGreaterThan(1_000);
    expect(firstPdf.equals(secondPdf)).toBe(true);
  });
});
