export type SyntheticPagedPdfOptions = Readonly<{
  pageCount?: number;
  citedPage?: number;
  widthPoints?: number;
  heightPoints?: number;
  citedText?: string;
}>;

/**
 * Build a deterministic, self-authored PDF without importing a historical scan.
 *
 * The fixture deliberately shares one blank content stream across ordinary
 * pages and places the public semantic tokens from SPEC.md on one cited page.
 * It is suitable for parser, pagination, resume, and citation-lineage tests;
 * it is not evidence about Mace or any historical source.
 */
export function buildSyntheticPagedPdf(options: SyntheticPagedPdfOptions = {}): Buffer {
  const pageCount = options.pageCount ?? 110;
  const citedPage = options.citedPage ?? Math.min(105, pageCount);
  const widthPoints = options.widthPoints ?? 409;
  const heightPoints = options.heightPoints ?? 674;
  const citedText = options.citedText ?? "Synthetic notation candidate: a /a //a ///a 4 5";

  assertPositiveInteger(pageCount, "page count");
  assertPositiveInteger(citedPage, "cited page");
  if (citedPage > pageCount) throw new RangeError("Synthetic cited page exceeds page count");
  assertPositiveFinite(widthPoints, "page width");
  assertPositiveFinite(heightPoints, "page height");

  const fontId = 3;
  const blankContentId = 4;
  const citedContentId = 5;
  const firstPageId = 6;
  const pageIds = Array.from({ length: pageCount }, (_, index) => firstPageId + index);
  const objects = new Map<number, Buffer>();

  objects.set(1, body("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.set(
    2,
    body(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`
    )
  );
  objects.set(3, body("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  objects.set(4, stream("q\nQ\n"));
  objects.set(
    5,
    stream(
      `BT\n/F1 11 Tf\n42 ${Math.max(42, heightPoints - 74)} Td\n(${escapePdfText(citedText)}) Tj\nET\n`
    )
  );
  for (const [index, id] of pageIds.entries()) {
    const contentId = index + 1 === citedPage ? citedContentId : blankContentId;
    objects.set(
      id,
      body(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPoints} ${heightPoints}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    );
  }

  const header = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets = new Map<number, number>();
  let offset = header.byteLength;
  for (let id = 1; id <= objects.size; id += 1) {
    const object = objects.get(id);
    if (!object) throw new Error(`Synthetic PDF object ${id} is missing`);
    const encoded = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, "ascii"),
      object,
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    offsets.set(id, offset);
    chunks.push(encoded);
    offset += encoded.byteLength;
  }

  const xrefOffset = offset;
  const xrefRows = ["0000000000 65535 f "];
  for (let id = 1; id <= objects.size; id += 1) {
    xrefRows.push(`${String(offsets.get(id)).padStart(10, "0")} 00000 n `);
  }
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.size + 1}\n${xrefRows.join("\n")}\ntrailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      "ascii"
    )
  );
  return Buffer.concat(chunks);
}

function body(value: string): Buffer {
  return Buffer.from(value, "ascii");
}

function stream(value: string): Buffer {
  const content = Buffer.from(value, "ascii");
  return Buffer.concat([
    Buffer.from(`<< /Length ${content.byteLength} >>\nstream\n`, "ascii"),
    content,
    Buffer.from("endstream", "ascii"),
  ]);
}

function escapePdfText(value: string): string {
  if (!/^[\x20-\x7e]*$/u.test(value)) {
    throw new TypeError("Synthetic PDF text must be printable ASCII");
  }
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new RangeError(`Synthetic ${label} is invalid`);
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Synthetic ${label} is invalid`);
}
