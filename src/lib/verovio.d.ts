declare module "verovio/wasm" {
  export default function createVerovioModule(): Promise<unknown>;
}

declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    destroy(): void;
    getElementAttr(id: string): Record<string, string>;
    getMIDIValuesForElement(id: string): { pitch?: number };
    getPageCount(): number;
    getTimeForElement(id: string): number;
    getVersion(): string;
    loadData(data: string): boolean;
    renderToMIDI(): string;
    renderToSVG(page: number): string;
    renderToTimemap(options?: Record<string, unknown>): unknown;
    setOptions(options: Record<string, unknown>): void;
  }
}

declare module "svg-to-pdfkit" {
  import type PDFDocument from "pdfkit";
  export default function SVGtoPDF(
    document: PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: Record<string, unknown>
  ): void;
}
