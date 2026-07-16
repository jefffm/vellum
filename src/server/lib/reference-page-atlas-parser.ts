import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  SubprocessAbortedError,
  SubprocessError,
  SubprocessLimitError,
  SubprocessRunner,
  type SubprocessConfig,
  type SubprocessResult,
  type SubprocessRunOptions,
} from "./subprocess.js";

export type ReferencePageAtlasParserFailureCode =
  | "invalid_pdf_signature"
  | "input_byte_limit_exceeded"
  | "parser_unavailable"
  | "parser_cancelled"
  | "parser_timeout"
  | "parser_output_limit_exceeded"
  | "parser_failed"
  | "parser_output_invalid"
  | "page_count_limit_exceeded"
  | "page_dimension_limit_exceeded"
  | "page_ordinal_out_of_range"
  | "renderer_unavailable"
  | "renderer_cancelled"
  | "renderer_timeout"
  | "renderer_output_limit_exceeded"
  | "renderer_failed"
  | "renderer_output_invalid"
  | "render_pixel_limit_exceeded";

const FAILURE_MESSAGES: Readonly<Record<ReferencePageAtlasParserFailureCode, string>> =
  Object.freeze({
    invalid_pdf_signature: "The source is not an exact supported PDF byte stream.",
    input_byte_limit_exceeded: "The PDF exceeds the local inspection byte limit.",
    parser_unavailable: "The bounded local PDF inspector is unavailable.",
    parser_cancelled: "The local PDF inspection was cancelled.",
    parser_timeout: "The bounded local PDF inspection timed out.",
    parser_output_limit_exceeded: "The local PDF inspector exceeded its output limit.",
    parser_failed: "The local PDF inspector could not inspect this source safely.",
    parser_output_invalid: "The local PDF inspector returned invalid structural data.",
    page_count_limit_exceeded: "The PDF exceeds the local page-count limit.",
    page_dimension_limit_exceeded: "A PDF page exceeds the local page-dimension limit.",
    page_ordinal_out_of_range: "The selected scan page is outside this PDF.",
    renderer_unavailable: "The bounded local PDF page renderer is unavailable.",
    renderer_cancelled: "The local PDF page render was cancelled.",
    renderer_timeout: "The bounded local PDF page render timed out.",
    renderer_output_limit_exceeded: "The local PDF page renderer exceeded its output limit.",
    renderer_failed: "The local PDF page renderer could not render this page safely.",
    renderer_output_invalid: "The local PDF page renderer returned an invalid PNG.",
    render_pixel_limit_exceeded: "The rendered page exceeds the local pixel limit.",
  });

/**
 * Closed, source-independent failure. Raw Poppler output, PDF metadata, paths,
 * and subprocess causes deliberately never become properties or messages.
 */
export class ReferencePageAtlasParserError extends Error {
  constructor(readonly code: ReferencePageAtlasParserFailureCode) {
    super(FAILURE_MESSAGES[code]);
    this.name = "ReferencePageAtlasParserError";
  }
}

export type ReferencePageAtlasPageInspection = Readonly<{
  scanOrdinal: number;
  widthPoints: number;
  heightPoints: number;
  rotationDegrees: 0 | 90 | 180 | 270;
}>;

export type ReferencePageAtlasInspection = Readonly<{
  schemaVersion: 1;
  parserId: "poppler.pdfinfo";
  pageCount: number;
  pages: readonly ReferencePageAtlasPageInspection[];
}>;

export type ReferencePageAtlasRenderedPage = Readonly<{
  schemaVersion: 1;
  rendererId: "poppler.pdftoppm";
  scanOrdinal: number;
  mediaType: "image/png";
  widthPixels: number;
  heightPixels: number;
  bytes: Uint8Array;
}>;

export type ReferencePageAtlasRuntimeIdentity = Readonly<{
  schemaVersion: 1;
  interfaceId: "vellum.reference-page-atlas-parser.v1";
  implementationId: "vellum.poppler-reference-page-atlas-parser.v1";
  parser: Readonly<{
    id: "poppler.pdfinfo";
    executable: "pdfinfo";
    artifact: "poppler";
    version: string;
  }>;
  renderer: Readonly<{
    id: "poppler.pdftoppm";
    executable: "pdftoppm";
    artifact: "poppler";
    version: string;
  }>;
  schemas: Readonly<{
    inspection: "vellum.reference-page-atlas-inspection.v1";
    renderedPage: "vellum.reference-page-atlas-rendered-page.v1";
    atlas: "vellum.reference-page-atlas-version.v1";
    sourceSegment: "vellum.reference-source-segment-version.v1";
    browserProjection: "vellum.reference-page-atlas-projection.v1";
  }>;
  configuration: Readonly<{
    limits: ReferencePageAtlasParserLimits;
  }>;
}>;

export interface ReferencePageAtlasParser {
  describeRuntime(): Promise<ReferencePageAtlasRuntimeIdentity>;
  inspect(
    input: Readonly<{ bytes: Uint8Array; signal?: AbortSignal }>
  ): Promise<ReferencePageAtlasInspection>;
  renderPage(
    input: Readonly<{ bytes: Uint8Array; scanOrdinal: number; signal?: AbortSignal }>
  ): Promise<ReferencePageAtlasRenderedPage>;
}

export type ReferencePageAtlasParserLimits = Readonly<{
  maxInputBytes: number;
  maxProcessAddressSpaceBytes: number;
  maxOpenFiles: number;
  maxPages: number;
  maxPageWidthPoints: number;
  maxPageHeightPoints: number;
  maxPageAreaPointsSquared: number;
  inspectTimeoutMs: number;
  maxInspectOutputBytes: number;
  renderTimeoutMs: number;
  renderDpi: number;
  maxRenderedWidthPixels: number;
  maxRenderedHeightPixels: number;
  maxRenderedPixels: number;
  maxRenderedOutputBytes: number;
  maxRenderDiagnosticBytes: number;
}>;

export const DEFAULT_REFERENCE_PAGE_ATLAS_PARSER_LIMITS: ReferencePageAtlasParserLimits =
  Object.freeze({
    maxInputBytes: 32 * 1024 * 1024,
    maxProcessAddressSpaceBytes: 768 * 1024 * 1024,
    maxOpenFiles: 64,
    maxPages: 2_048,
    maxPageWidthPoints: 2_880,
    maxPageHeightPoints: 2_880,
    maxPageAreaPointsSquared: 4_147_200,
    inspectTimeoutMs: 15_000,
    maxInspectOutputBytes: 2 * 1024 * 1024,
    renderTimeoutMs: 20_000,
    renderDpi: 144,
    maxRenderedWidthPixels: 4_096,
    maxRenderedHeightPixels: 4_096,
    maxRenderedPixels: 16_777_216,
    maxRenderedOutputBytes: 16 * 1024 * 1024,
    maxRenderDiagnosticBytes: 64 * 1024,
  });

type ReferencePageAtlasCommandRunner = Readonly<{
  run(config: SubprocessConfig, options?: SubprocessRunOptions): Promise<SubprocessResult>;
}>;

export type PopplerReferencePageAtlasParserOptions = Readonly<{
  runner?: ReferencePageAtlasCommandRunner;
  limits?: Partial<ReferencePageAtlasParserLimits>;
}>;

/**
 * Structural PDF inspection and one-page rasterization through Poppler only.
 *
 * Both tools receive a server-named file in SubprocessRunner's disposable
 * directory. No URI, source identity, metadata request, OCR option, provider,
 * callback, or network destination is accepted by this interface.
 */
export class PopplerReferencePageAtlasParser implements ReferencePageAtlasParser {
  private readonly runner: ReferencePageAtlasCommandRunner;
  readonly limits: ReferencePageAtlasParserLimits;
  private runtimeIdentity?: ReferencePageAtlasRuntimeIdentity;

  constructor(options: PopplerReferencePageAtlasParserOptions = {}) {
    this.limits = decodeLimits({
      ...DEFAULT_REFERENCE_PAGE_ATLAS_PARSER_LIMITS,
      ...options.limits,
    });
    this.runner = options.runner ?? new SubprocessRunner(this.limits.inspectTimeoutMs);
  }

  async describeRuntime(): Promise<ReferencePageAtlasRuntimeIdentity> {
    assertAuthorityPathRuntime("authority.validator.source-normalization", "production");
    if (this.runtimeIdentity) return this.runtimeIdentity;
    const [parserVersion, rendererVersion] = await Promise.all([
      this.readExecutableVersion("pdfinfo", "parser"),
      this.readExecutableVersion("pdftoppm", "renderer"),
    ]);
    const identity: ReferencePageAtlasRuntimeIdentity = Object.freeze({
      schemaVersion: 1,
      interfaceId: "vellum.reference-page-atlas-parser.v1",
      implementationId: "vellum.poppler-reference-page-atlas-parser.v1",
      parser: Object.freeze({
        id: "poppler.pdfinfo",
        executable: "pdfinfo",
        artifact: "poppler",
        version: parserVersion,
      }),
      renderer: Object.freeze({
        id: "poppler.pdftoppm",
        executable: "pdftoppm",
        artifact: "poppler",
        version: rendererVersion,
      }),
      schemas: Object.freeze({
        inspection: "vellum.reference-page-atlas-inspection.v1",
        renderedPage: "vellum.reference-page-atlas-rendered-page.v1",
        atlas: "vellum.reference-page-atlas-version.v1",
        sourceSegment: "vellum.reference-source-segment-version.v1",
        browserProjection: "vellum.reference-page-atlas-projection.v1",
      }),
      configuration: Object.freeze({ limits: Object.freeze({ ...this.limits }) }),
    });
    this.runtimeIdentity = identity;
    return identity;
  }

  async inspect(
    input: Readonly<{ bytes: Uint8Array; signal?: AbortSignal }>
  ): Promise<ReferencePageAtlasInspection> {
    assertAuthorityPathRuntime("authority.validator.source-normalization", "production");
    const bytes = this.decodePdfBytes(input.bytes);
    let result: SubprocessResult;
    try {
      result = await this.runner.run(this.pdfInfoConfig(bytes), { signal: input.signal });
    } catch (error) {
      throw inspectRunnerFailure(error);
    }

    assertCapturedOutputLimit(result, this.limits.maxInspectOutputBytes, "inspect");
    if (result.exitCode === 124) throw failure("parser_timeout");
    if (result.exitCode !== 0) throw failure("parser_failed");
    return parsePdfInfo(result.stdout, this.limits);
  }

  async renderPage(
    input: Readonly<{ bytes: Uint8Array; scanOrdinal: number; signal?: AbortSignal }>
  ): Promise<ReferencePageAtlasRenderedPage> {
    assertAuthorityPathRuntime("authority.validator.source-normalization", "production");
    const bytes = this.decodePdfBytes(input.bytes);
    if (!Number.isSafeInteger(input.scanOrdinal) || input.scanOrdinal < 1) {
      throw failure("page_ordinal_out_of_range");
    }
    const inspection = await this.inspect({ bytes, signal: input.signal });
    const page = inspection.pages[input.scanOrdinal - 1];
    if (!page || page.scanOrdinal !== input.scanOrdinal) {
      throw failure("page_ordinal_out_of_range");
    }
    const expectedPixels = expectedRenderPixels(page, this.limits);
    assertRenderedPixelLimits(expectedPixels.widthPixels, expectedPixels.heightPixels, this.limits);

    let result: SubprocessResult;
    try {
      result = await this.runner.run(this.renderConfig(bytes, input.scanOrdinal), {
        signal: input.signal,
      });
    } catch (error) {
      throw renderRunnerFailure(error);
    }

    assertCapturedOutputLimit(result, this.limits.maxRenderDiagnosticBytes, "render");
    if (result.exitCode === 124) throw failure("renderer_timeout");
    if (result.exitCode !== 0) throw failure("renderer_failed");
    if (result.files.size !== 1 || !result.files.has("page.png")) {
      throw failure("renderer_output_invalid");
    }
    const png = Buffer.from(result.files.get("page.png")!);
    if (png.byteLength < 1 || png.byteLength > this.limits.maxRenderedOutputBytes) {
      throw failure("renderer_output_limit_exceeded");
    }
    const dimensions = decodePngDimensions(png);
    assertRenderedPixelLimits(dimensions.widthPixels, dimensions.heightPixels, this.limits);
    if (
      Math.abs(dimensions.widthPixels - expectedPixels.widthPixels) > 2 ||
      Math.abs(dimensions.heightPixels - expectedPixels.heightPixels) > 2
    ) {
      throw failure("renderer_output_invalid");
    }

    return Object.freeze({
      schemaVersion: 1,
      rendererId: "poppler.pdftoppm",
      scanOrdinal: input.scanOrdinal,
      mediaType: "image/png",
      widthPixels: dimensions.widthPixels,
      heightPixels: dimensions.heightPixels,
      bytes: new Uint8Array(png),
    });
  }

  private decodePdfBytes(value: Uint8Array): Buffer {
    const bytes = Buffer.from(value);
    if (bytes.byteLength > this.limits.maxInputBytes) {
      throw failure("input_byte_limit_exceeded");
    }
    if (!hasExactPdfSignature(bytes)) throw failure("invalid_pdf_signature");
    return bytes;
  }

  private pdfInfoConfig(bytes: Buffer): SubprocessConfig {
    return {
      command: "pdfinfo",
      args: ["-f", "1", "-l", String(this.limits.maxPages + 1), "-box", "source.pdf"],
      inputFile: { name: "source.pdf", content: bytes },
      timeout: this.limits.inspectTimeoutMs,
      maxInputBytes: this.limits.maxInputBytes,
      maxAddressSpaceBytes: this.limits.maxProcessAddressSpaceBytes,
      maxCpuSeconds: Math.ceil(this.limits.inspectTimeoutMs / 1_000) + 2,
      maxOpenFiles: this.limits.maxOpenFiles,
      maxFileWriteBytes: 0,
      maxCaptureBytes: this.limits.maxInspectOutputBytes,
      maxEmittedBytes: this.limits.maxInspectOutputBytes,
      maxOutputFiles: 0,
      maxOutputFileBytes: 0,
      maxOutputTotalBytes: 0,
      maxScannedEntries: 4,
      networkAccess: "deny",
      filesystemAccess: "workdir-only",
    };
  }

  private renderConfig(bytes: Buffer, scanOrdinal: number): SubprocessConfig {
    return {
      command: "pdftoppm",
      args: [
        "-f",
        String(scanOrdinal),
        "-l",
        String(scanOrdinal),
        "-singlefile",
        "-png",
        "-r",
        String(this.limits.renderDpi),
        "source.pdf",
        "page",
      ],
      inputFile: { name: "source.pdf", content: bytes },
      outputGlobs: ["page*.png"],
      writableOutputFiles: ["page.png"],
      timeout: this.limits.renderTimeoutMs,
      maxInputBytes: this.limits.maxInputBytes,
      maxAddressSpaceBytes: this.limits.maxProcessAddressSpaceBytes,
      maxCpuSeconds: Math.ceil(this.limits.renderTimeoutMs / 1_000) + 2,
      maxOpenFiles: this.limits.maxOpenFiles,
      maxFileWriteBytes: this.limits.maxRenderedOutputBytes,
      maxCaptureBytes: this.limits.maxRenderDiagnosticBytes,
      maxEmittedBytes: this.limits.maxRenderDiagnosticBytes,
      maxOutputFiles: 1,
      maxOutputFileBytes: this.limits.maxRenderedOutputBytes,
      maxOutputTotalBytes: this.limits.maxRenderedOutputBytes,
      maxScannedEntries: 8,
      networkAccess: "deny",
      filesystemAccess: "workdir-only",
    };
  }

  private async readExecutableVersion(
    executable: "pdfinfo" | "pdftoppm",
    operation: "parser" | "renderer"
  ): Promise<string> {
    let result: SubprocessResult;
    try {
      result = await this.runner.run({
        command: executable,
        args: ["-v"],
        timeout: this.limits.inspectTimeoutMs,
        maxCaptureBytes: 4_096,
        maxEmittedBytes: 4_096,
        maxAddressSpaceBytes: this.limits.maxProcessAddressSpaceBytes,
        maxCpuSeconds: Math.ceil(this.limits.inspectTimeoutMs / 1_000) + 2,
        maxOpenFiles: this.limits.maxOpenFiles,
        maxFileWriteBytes: 0,
        maxOutputFiles: 0,
        maxOutputFileBytes: 0,
        maxOutputTotalBytes: 0,
        maxScannedEntries: 4,
        networkAccess: "deny",
        filesystemAccess: "workdir-only",
      });
    } catch (error) {
      throw operation === "parser" ? inspectRunnerFailure(error) : renderRunnerFailure(error);
    }
    if (result.exitCode !== 0) {
      throw failure(operation === "parser" ? "parser_unavailable" : "renderer_unavailable");
    }
    const escaped = executable.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const match = new RegExp(
      `(?:^|\\n)${escaped} version ([0-9][A-Za-z0-9.+~_-]{0,63})(?:\\r?$|\\n)`,
      "u"
    ).exec(`${result.stdout}\n${result.stderr}`);
    if (!match?.[1]) {
      throw failure(operation === "parser" ? "parser_output_invalid" : "renderer_output_invalid");
    }
    return match[1];
  }
}

function hasExactPdfSignature(bytes: Buffer): boolean {
  if (bytes.byteLength < 8) return false;
  return /^%PDF-[12]\.[0-9]$/u.test(bytes.subarray(0, 8).toString("ascii"));
}

function parsePdfInfo(
  stdout: string,
  limits: ReferencePageAtlasParserLimits
): ReferencePageAtlasInspection {
  const lines = stdout.split(/\r?\n/u);
  const pageCountMatches = lines.flatMap((line) => {
    const match = /^Pages:\s+([0-9]+)\s*$/u.exec(line);
    return match ? [match[1]!] : [];
  });
  if (pageCountMatches.length !== 1) throw failure("parser_output_invalid");
  const pageCount = Number(pageCountMatches[0]);
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
    throw failure("parser_output_invalid");
  }
  if (pageCount > limits.maxPages) throw failure("page_count_limit_exceeded");

  const sizes = new Map<number, { widthPoints: number; heightPoints: number }>();
  const rotations = new Map<number, 0 | 90 | 180 | 270>();
  for (const line of lines) {
    const size =
      /^Page\s+([0-9]+)\s+size:\s+([0-9]+(?:\.[0-9]+)?)\s+x\s+([0-9]+(?:\.[0-9]+)?)\s+pts(?:\s|$)/u.exec(
        line
      );
    if (size) {
      const ordinal = Number(size[1]);
      if (sizes.has(ordinal)) throw failure("parser_output_invalid");
      sizes.set(ordinal, {
        widthPoints: Number(size[2]),
        heightPoints: Number(size[3]),
      });
      continue;
    }
    const rotation = /^Page\s+([0-9]+)\s+rot:\s+(-?[0-9]+)\s*$/u.exec(line);
    if (rotation) {
      const ordinal = Number(rotation[1]);
      const degrees = Number(rotation[2]);
      if (rotations.has(ordinal) || !isRotation(degrees)) {
        throw failure("parser_output_invalid");
      }
      rotations.set(ordinal, degrees);
    }
  }

  const pages: ReferencePageAtlasPageInspection[] = [];
  for (let scanOrdinal = 1; scanOrdinal <= pageCount; scanOrdinal += 1) {
    const size = sizes.get(scanOrdinal);
    const rotationDegrees = rotations.get(scanOrdinal);
    if (!size || rotationDegrees === undefined) throw failure("parser_output_invalid");
    assertPageDimensions(size.widthPoints, size.heightPoints, limits);
    pages.push(
      Object.freeze({
        scanOrdinal,
        widthPoints: size.widthPoints,
        heightPoints: size.heightPoints,
        rotationDegrees,
      })
    );
  }
  if (sizes.size !== pageCount || rotations.size !== pageCount) {
    throw failure("parser_output_invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    parserId: "poppler.pdfinfo",
    pageCount,
    pages: Object.freeze(pages),
  });
}

function assertPageDimensions(
  widthPoints: number,
  heightPoints: number,
  limits: ReferencePageAtlasParserLimits
): void {
  if (
    !Number.isFinite(widthPoints) ||
    !Number.isFinite(heightPoints) ||
    widthPoints <= 0 ||
    heightPoints <= 0
  ) {
    throw failure("parser_output_invalid");
  }
  if (
    widthPoints > limits.maxPageWidthPoints ||
    heightPoints > limits.maxPageHeightPoints ||
    widthPoints * heightPoints > limits.maxPageAreaPointsSquared
  ) {
    throw failure("page_dimension_limit_exceeded");
  }
}

function expectedRenderPixels(
  page: ReferencePageAtlasPageInspection,
  limits: ReferencePageAtlasParserLimits
): { widthPixels: number; heightPixels: number } {
  const rotated = page.rotationDegrees === 90 || page.rotationDegrees === 270;
  const widthPoints = rotated ? page.heightPoints : page.widthPoints;
  const heightPoints = rotated ? page.widthPoints : page.heightPoints;
  return {
    widthPixels: Math.ceil((widthPoints * limits.renderDpi) / 72),
    heightPixels: Math.ceil((heightPoints * limits.renderDpi) / 72),
  };
}

function assertRenderedPixelLimits(
  widthPixels: number,
  heightPixels: number,
  limits: ReferencePageAtlasParserLimits
): void {
  if (
    !Number.isSafeInteger(widthPixels) ||
    !Number.isSafeInteger(heightPixels) ||
    widthPixels < 1 ||
    heightPixels < 1
  ) {
    throw failure("renderer_output_invalid");
  }
  if (
    widthPixels > limits.maxRenderedWidthPixels ||
    heightPixels > limits.maxRenderedHeightPixels ||
    widthPixels * heightPixels > limits.maxRenderedPixels
  ) {
    throw failure("render_pixel_limit_exceeded");
  }
}

function decodePngDimensions(bytes: Buffer): { widthPixels: number; heightPixels: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.byteLength < 57 || !bytes.subarray(0, 8).equals(signature)) {
    throw failure("renderer_output_invalid");
  }
  let offset = 8;
  let dimensions: { widthPixels: number; heightPixels: number } | undefined;
  let sawImageData = false;
  let sawEnd = false;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 12) throw failure("renderer_output_invalid");
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.byteLength - offset - 12) throw failure("renderer_output_invalid");
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(type)) throw failure("renderer_output_invalid");
    const dataStart = offset + 8;
    const next = dataStart + length + 4;
    if (chunkIndex === 0 && type !== "IHDR") throw failure("renderer_output_invalid");
    if (type === "IHDR") {
      if (chunkIndex !== 0 || length !== 13 || dimensions) {
        throw failure("renderer_output_invalid");
      }
      dimensions = {
        widthPixels: bytes.readUInt32BE(dataStart),
        heightPixels: bytes.readUInt32BE(dataStart + 4),
      };
    } else if (type === "IDAT") {
      if (!dimensions || sawEnd) throw failure("renderer_output_invalid");
      sawImageData = true;
    } else if (type === "IEND") {
      if (length !== 0 || !dimensions || !sawImageData || next !== bytes.byteLength) {
        throw failure("renderer_output_invalid");
      }
      sawEnd = true;
    }
    offset = next;
    chunkIndex += 1;
    if (sawEnd) break;
  }
  if (!dimensions || !sawImageData || !sawEnd || offset !== bytes.byteLength) {
    throw failure("renderer_output_invalid");
  }
  return dimensions;
}

function assertCapturedOutputLimit(
  result: SubprocessResult,
  maxBytes: number,
  operation: "inspect" | "render"
): void {
  if (Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > maxBytes) {
    throw failure(
      operation === "inspect" ? "parser_output_limit_exceeded" : "renderer_output_limit_exceeded"
    );
  }
}

function inspectRunnerFailure(error: unknown): ReferencePageAtlasParserError {
  if (error instanceof SubprocessAbortedError) return failure("parser_cancelled");
  if (error instanceof SubprocessLimitError) return failure("parser_output_limit_exceeded");
  if (error instanceof SubprocessError) return failure("parser_unavailable");
  return failure("parser_failed");
}

function renderRunnerFailure(error: unknown): ReferencePageAtlasParserError {
  if (error instanceof SubprocessAbortedError) return failure("renderer_cancelled");
  if (error instanceof SubprocessLimitError) return failure("renderer_output_limit_exceeded");
  if (error instanceof SubprocessError) return failure("renderer_unavailable");
  return failure("renderer_failed");
}

function failure(code: ReferencePageAtlasParserFailureCode): ReferencePageAtlasParserError {
  return new ReferencePageAtlasParserError(code);
}

function isRotation(value: number): value is 0 | 90 | 180 | 270 {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

function decodeLimits(input: ReferencePageAtlasParserLimits): ReferencePageAtlasParserLimits {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`Reference Page Atlas parser limit ${name} must be positive and finite`);
    }
  }
  for (const name of [
    "maxInputBytes",
    "maxProcessAddressSpaceBytes",
    "maxOpenFiles",
    "maxPages",
    "inspectTimeoutMs",
    "maxInspectOutputBytes",
    "renderTimeoutMs",
    "renderDpi",
    "maxRenderedWidthPixels",
    "maxRenderedHeightPixels",
    "maxRenderedPixels",
    "maxRenderedOutputBytes",
    "maxRenderDiagnosticBytes",
  ] as const) {
    if (!Number.isSafeInteger(input[name])) {
      throw new TypeError(`Reference Page Atlas parser limit ${name} must be a safe integer`);
    }
  }
  return Object.freeze({ ...input });
}
