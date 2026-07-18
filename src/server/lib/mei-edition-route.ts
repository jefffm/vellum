import type { RequestHandler } from "express";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";

import {
  FRENCH_TAB_MEI_FIXTURE,
  MEI_EDITION_PROOF_ID,
  MEI_EDITION_PROOF_VERSION,
} from "../../lib/mei-edition-fixtures.js";
import { renderMeiWithVerovio } from "../../lib/verovio-renderer.js";
import { createNodeGeneratedArtifactSecurity } from "./generated-artifact-security-node.js";

const EVENT_IDS = ["note-1", "note-4", "note-5"] as const;
const FIXED_PDF_DATE = new Date("2026-07-17T00:00:00.000Z");

export async function renderMeiEditionProof() {
  const rendered = await renderMeiWithVerovio(FRENCH_TAB_MEI_FIXTURE, EVENT_IDS);
  const security = createNodeGeneratedArtifactSecurity();
  try {
    const svg = security.sanitizeVerovioSvg(rendered.svg).markup;
    return { ...rendered, svg };
  } finally {
    security.dispose();
  }
}

export async function pdfFromMeiSvg(svg: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      autoFirstPage: false,
      bufferPages: false,
      compress: true,
      info: {
        Title: "Vellum MEI edition proof",
        Author: "Vellum",
        CreationDate: FIXED_PDF_DATE,
        ModDate: FIXED_PDF_DATE,
      },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.addPage({ size: [792, 612], margin: 36 });
    SVGtoPDF(document, svg, 36, 36, {
      width: 720,
      height: 540,
      preserveAspectRatio: "xMinYMin meet",
    });
    document.end();
  });
}

export const createMeiEditionProofRoute =
  (): RequestHandler => async (_request, response, next) => {
    try {
      const rendered = await renderMeiEditionProof();
      response.json({
        ok: true,
        data: {
          editionId: MEI_EDITION_PROOF_ID,
          editionVersion: MEI_EDITION_PROOF_VERSION,
          ...rendered,
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const createMeiEditionProofPdfRoute =
  (): RequestHandler => async (_request, response, next) => {
    try {
      const rendered = await renderMeiEditionProof();
      const pdf = await pdfFromMeiSvg(rendered.svg);
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'attachment; filename="vellum-mei-edition-proof.pdf"'
      );
      response.setHeader("Content-Length", String(pdf.length));
      response.send(pdf);
    } catch (error) {
      next(error);
    }
  };
