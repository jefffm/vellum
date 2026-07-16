import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REFERENCE_PAGE_ATLAS_PARSER_LIMITS,
  PopplerReferencePageAtlasParser,
  ReferencePageAtlasParserError,
  type ReferencePageAtlasParserFailureCode,
} from "./reference-page-atlas-parser.js";
import {
  resolveTrustedExecutable,
  SubprocessAbortedError,
  SubprocessError,
  SubprocessLimitError,
  type SubprocessConfig,
  type SubprocessResult,
  type SubprocessRunOptions,
} from "./subprocess.js";

const PDF_BYTES = Buffer.from("%PDF-1.7\nsynthetic parser fixture\n", "ascii");
const PRIVATE_METADATA = "PRIVATE-METADATA-CANARY";
const PRIVATE_PATH = "/Users/owner/PRIVATE-PATH-CANARY.pdf";
const PRIVATE_STDERR = `Syntax Error in ${PRIVATE_PATH}: PRIVATE-STDERR-CANARY`;

const popplerAvailable = (() => {
  try {
    resolveTrustedExecutable("pdfinfo");
    resolveTrustedExecutable("pdftoppm");
    return true;
  } catch {
    return false;
  }
})();

const noNetworkSandboxAvailable = (() => {
  try {
    if (process.platform === "darwin") {
      resolveTrustedExecutable("sandbox-exec");
      return true;
    }
    if (process.platform !== "linux") return false;
    const bwrap = resolveTrustedExecutable("bwrap");
    const executable = resolveTrustedExecutable("true");
    return (
      spawnSync(
        bwrap,
        ["--die-with-parent", "--new-session", "--unshare-net", "--ro-bind", "/", "/", executable],
        { stdio: "ignore" }
      ).status === 0
    );
  } catch {
    return false;
  }
})();

describe("PopplerReferencePageAtlasParser", () => {
  it("binds the exact Poppler executable versions, interface, schemas, and parser configuration", async () => {
    const run = vi.fn(async (config: SubprocessConfig) =>
      result({
        stderr: `${config.command} version 26.04.0\nCopyright ${PRIVATE_METADATA}\n`,
      })
    );
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });

    const identity = await parser.describeRuntime();
    expect(await parser.describeRuntime()).toBe(identity);
    expect(identity).toMatchObject({
      schemaVersion: 1,
      interfaceId: "vellum.reference-page-atlas-parser.v1",
      implementationId: "vellum.poppler-reference-page-atlas-parser.v1",
      parser: { executable: "pdfinfo", artifact: "poppler", version: "26.04.0" },
      renderer: { executable: "pdftoppm", artifact: "poppler", version: "26.04.0" },
      schemas: {
        atlas: "vellum.reference-page-atlas-version.v1",
        sourceSegment: "vellum.reference-source-segment-version.v1",
      },
      configuration: { limits: DEFAULT_REFERENCE_PAGE_ATLAS_PARSER_LIMITS },
    });
    expect(JSON.stringify(identity)).not.toContain(PRIVATE_METADATA);
    expect(run).toHaveBeenCalledTimes(2);
    for (const command of ["pdfinfo", "pdftoppm"] as const) {
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({
          command,
          args: ["-v"],
          networkAccess: "deny",
          maxCaptureBytes: 4_096,
          maxEmittedBytes: 4_096,
        })
      );
    }
  });

  it("inspects exact PDF bytes with bounded pdfinfo and returns only structural page data", async () => {
    const run = vi.fn(async () =>
      result({
        stdout: pdfInfoOutput([
          { width: 612, height: 792, rotation: 0 },
          { width: 595.28, height: 841.89, rotation: 90 },
        ]),
        stderr: PRIVATE_STDERR,
      })
    );
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });

    const inspection = await parser.inspect({ bytes: PDF_BYTES });

    expect(inspection).toEqual({
      schemaVersion: 1,
      parserId: "poppler.pdfinfo",
      pageCount: 2,
      pages: [
        { scanOrdinal: 1, widthPoints: 612, heightPoints: 792, rotationDegrees: 0 },
        { scanOrdinal: 2, widthPoints: 595.28, heightPoints: 841.89, rotationDegrees: 90 },
      ],
    });
    expect(JSON.stringify(inspection)).not.toContain(PRIVATE_METADATA);
    expect(JSON.stringify(inspection)).not.toContain(PRIVATE_STDERR);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      {
        command: "pdfinfo",
        args: ["-f", "1", "-l", "2049", "-box", "source.pdf"],
        inputFile: { name: "source.pdf", content: PDF_BYTES },
        timeout: 15_000,
        maxInputBytes: 32 * 1024 * 1024,
        maxAddressSpaceBytes: 768 * 1024 * 1024,
        maxCpuSeconds: 17,
        maxOpenFiles: 64,
        maxFileWriteBytes: 0,
        maxCaptureBytes: 2 * 1024 * 1024,
        maxEmittedBytes: 2 * 1024 * 1024,
        maxOutputFiles: 0,
        maxOutputFileBytes: 0,
        maxOutputTotalBytes: 0,
        maxScannedEntries: 4,
        networkAccess: "deny",
        filesystemAccess: "workdir-only",
      },
      { signal: undefined }
    );
  });

  it("rejects malformed and prefixed polyglot bytes before invoking Poppler", async () => {
    const run = vi.fn(async () => result());
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });

    for (const bytes of [
      Buffer.from("not a pdf"),
      Buffer.from(`<script>${PRIVATE_METADATA}</script>\n%PDF-1.7\n`),
      Buffer.from("%PDF-x.y\n"),
    ]) {
      await expectClosedFailure(
        parser.inspect({ bytes }),
        "invalid_pdf_signature",
        PRIVATE_METADATA
      );
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects an oversized PDF before the parser sees any bytes", async () => {
    const run = vi.fn(async () => result());
    const parser = new PopplerReferencePageAtlasParser({
      runner: { run },
      limits: { maxInputBytes: 16 },
    });

    await expectClosedFailure(parser.inspect({ bytes: PDF_BYTES }), "input_byte_limit_exceeded");
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects page-count and per-page geometry limits before producing an Atlas", async () => {
    const tooMany = new PopplerReferencePageAtlasParser({
      limits: { maxPages: 1 },
      runner: {
        run: async () =>
          result({
            stdout: pdfInfoOutput([
              { width: 612, height: 792, rotation: 0 },
              { width: 612, height: 792, rotation: 0 },
            ]),
          }),
      },
    });
    await expectClosedFailure(tooMany.inspect({ bytes: PDF_BYTES }), "page_count_limit_exceeded");

    for (const limits of [
      { maxPageWidthPoints: 600 },
      { maxPageHeightPoints: 700 },
      { maxPageAreaPointsSquared: 400_000 },
    ]) {
      const parser = new PopplerReferencePageAtlasParser({
        limits,
        runner: {
          run: async () =>
            result({ stdout: pdfInfoOutput([{ width: 612, height: 792, rotation: 0 }]) }),
        },
      });
      await expectClosedFailure(
        parser.inspect({ bytes: PDF_BYTES }),
        "page_dimension_limit_exceeded"
      );
    }
  });

  it("classifies timeout, parser failure, unavailability, and output overflow without diagnostics", async () => {
    const cases: Array<{
      expected: ReferencePageAtlasParserFailureCode;
      run: (config: SubprocessConfig) => Promise<SubprocessResult>;
    }> = [
      {
        expected: "parser_timeout",
        run: async () => result({ exitCode: 124, stderr: PRIVATE_STDERR }),
      },
      {
        expected: "parser_failed",
        run: async () => result({ exitCode: 1, stderr: PRIVATE_STDERR }),
      },
      {
        expected: "parser_unavailable",
        run: async () => {
          throw new SubprocessError(`${PRIVATE_STDERR} ${PRIVATE_PATH}`);
        },
      },
      {
        expected: "parser_output_limit_exceeded",
        run: async () => {
          throw new SubprocessLimitError("overflow", {
            stdoutTail: PRIVATE_METADATA,
            stderrTail: PRIVATE_STDERR,
          });
        },
      },
    ];

    for (const entry of cases) {
      const parser = new PopplerReferencePageAtlasParser({ runner: { run: entry.run } });
      await expectClosedFailure(
        parser.inspect({ bytes: PDF_BYTES }),
        entry.expected,
        PRIVATE_METADATA,
        PRIVATE_PATH,
        PRIVATE_STDERR
      );
    }
  });

  it("independently rejects oversized captured output from an injected runner", async () => {
    const parser = new PopplerReferencePageAtlasParser({
      limits: { maxInspectOutputBytes: 128 },
      runner: {
        run: async () => result({ stdout: `${PRIVATE_METADATA}${"x".repeat(256)}` }),
      },
    });

    await expectClosedFailure(
      parser.inspect({ bytes: PDF_BYTES }),
      "parser_output_limit_exceeded",
      PRIVATE_METADATA
    );
  });

  it("forwards inspection cancellation and exposes only the closed cancellation code", async () => {
    const controller = new AbortController();
    const run = vi.fn(
      async (_config: SubprocessConfig, options?: SubprocessRunOptions) =>
        await rejectWhenAborted(options?.signal)
    );
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });

    const pending = parser.inspect({ bytes: PDF_BYTES, signal: controller.signal });
    controller.abort();

    await expectClosedFailure(pending, "parser_cancelled", PRIVATE_METADATA, PRIVATE_STDERR);
    expect(run).toHaveBeenCalledWith(expect.any(Object), { signal: controller.signal });
  });

  it("rejects incomplete, duplicate, and non-finite structural output", async () => {
    for (const stdout of [
      `Pages: 1\nPage 1 size: 612 x 792 pts\n`,
      `Pages: 1\nPages: 1\nPage 1 size: 612 x 792 pts\nPage 1 rot: 0\n`,
      `Pages: 1\nPage 1 size: 0 x 792 pts\nPage 1 rot: 0\n`,
      `Pages: 1\nPage 1 size: 612 x 792 pts\nPage 1 rot: 45\n`,
    ]) {
      const parser = new PopplerReferencePageAtlasParser({
        runner: { run: async () => result({ stdout }) },
      });
      await expectClosedFailure(parser.inspect({ bytes: PDF_BYTES }), "parser_output_invalid");
    }
  });

  it("renders exactly one bounded PNG for one validated scan ordinal", async () => {
    const png = pngHeader(1_224, 1_584);
    const run = vi.fn(async (config: SubprocessConfig) =>
      config.command === "pdfinfo"
        ? result({ stdout: pdfInfoOutput([{ width: 612, height: 792, rotation: 0 }]) })
        : result({ files: new Map([["page.png", png]]), stderr: PRIVATE_STDERR })
    );
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });

    const rendered = await parser.renderPage({ bytes: PDF_BYTES, scanOrdinal: 1 });

    expect(rendered).toMatchObject({
      schemaVersion: 1,
      rendererId: "poppler.pdftoppm",
      scanOrdinal: 1,
      mediaType: "image/png",
      widthPixels: 1_224,
      heightPixels: 1_584,
    });
    expect(Buffer.from(rendered.bytes)).toEqual(png);
    expect(JSON.stringify({ ...rendered, bytes: "redacted" })).not.toContain(PRIVATE_STDERR);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]![0]).toEqual({
      command: "pdftoppm",
      args: ["-f", "1", "-l", "1", "-singlefile", "-png", "-r", "144", "source.pdf", "page"],
      inputFile: { name: "source.pdf", content: PDF_BYTES },
      outputGlobs: ["page*.png"],
      writableOutputFiles: ["page.png"],
      timeout: 20_000,
      maxInputBytes: 32 * 1024 * 1024,
      maxAddressSpaceBytes: 768 * 1024 * 1024,
      maxCpuSeconds: 22,
      maxOpenFiles: 64,
      maxFileWriteBytes: 16 * 1024 * 1024,
      maxCaptureBytes: 64 * 1024,
      maxEmittedBytes: 64 * 1024,
      maxOutputFiles: 1,
      maxOutputFileBytes: 16 * 1024 * 1024,
      maxOutputTotalBytes: 16 * 1024 * 1024,
      maxScannedEntries: 8,
      networkAccess: "deny",
      filesystemAccess: "workdir-only",
    });
  });

  it("rejects out-of-range pages and predicted pixel overflow before pdftoppm", async () => {
    const run = vi.fn(async () =>
      result({ stdout: pdfInfoOutput([{ width: 612, height: 792, rotation: 0 }]) })
    );
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });
    await expectClosedFailure(
      parser.renderPage({ bytes: PDF_BYTES, scanOrdinal: 2 }),
      "page_ordinal_out_of_range"
    );
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    const pixelBound = new PopplerReferencePageAtlasParser({
      runner: { run },
      limits: { maxRenderedWidthPixels: 1_000 },
    });
    await expectClosedFailure(
      pixelBound.renderPage({ bytes: PDF_BYTES, scanOrdinal: 1 }),
      "render_pixel_limit_exceeded"
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rejects renderer timeout, failures, overflow, invalid files, and actual pixel overflow", async () => {
    const renderCases: Array<{
      expected: ReferencePageAtlasParserFailureCode;
      render: () => Promise<SubprocessResult>;
      limits?: Partial<typeof DEFAULT_REFERENCE_PAGE_ATLAS_PARSER_LIMITS>;
    }> = [
      {
        expected: "renderer_timeout",
        render: async () => result({ exitCode: 124, stderr: PRIVATE_STDERR }),
      },
      {
        expected: "renderer_failed",
        render: async () => result({ exitCode: 1, stderr: PRIVATE_STDERR }),
      },
      {
        expected: "renderer_unavailable",
        render: async () => {
          throw new SubprocessError(PRIVATE_STDERR);
        },
      },
      {
        expected: "renderer_output_limit_exceeded",
        render: async () => {
          throw new SubprocessLimitError("overflow", { stderrTail: PRIVATE_STDERR });
        },
      },
      {
        expected: "renderer_output_invalid",
        render: async () => result({ files: new Map([["page.png", Buffer.from("not png")]]) }),
      },
      {
        expected: "renderer_output_invalid",
        render: async () => result({ files: new Map([["unexpected.png", pngHeader(1, 1)]]) }),
      },
      {
        expected: "render_pixel_limit_exceeded",
        render: async () => result({ files: new Map([["page.png", pngHeader(2_001, 1_584)]]) }),
        limits: { maxRenderedWidthPixels: 2_000 },
      },
    ];

    for (const entry of renderCases) {
      const parser = new PopplerReferencePageAtlasParser({
        limits: entry.limits,
        runner: {
          run: async (config) =>
            config.command === "pdfinfo"
              ? result({ stdout: pdfInfoOutput([{ width: 612, height: 792, rotation: 0 }]) })
              : entry.render(),
        },
      });
      await expectClosedFailure(
        parser.renderPage({ bytes: PDF_BYTES, scanOrdinal: 1 }),
        entry.expected,
        PRIVATE_METADATA,
        PRIVATE_PATH,
        PRIVATE_STDERR
      );
    }
  });

  it("forwards render cancellation and exposes only the closed cancellation code", async () => {
    const controller = new AbortController();
    const run = vi.fn(async (config: SubprocessConfig, options?: SubprocessRunOptions) =>
      config.command === "pdfinfo"
        ? result({ stdout: pdfInfoOutput([{ width: 612, height: 792, rotation: 0 }]) })
        : await rejectWhenAborted(options?.signal)
    );
    const parser = new PopplerReferencePageAtlasParser({ runner: { run } });

    const pending = parser.renderPage({
      bytes: PDF_BYTES,
      scanOrdinal: 1,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    controller.abort();

    await expectClosedFailure(pending, "renderer_cancelled", PRIVATE_METADATA, PRIVATE_STDERR);
    expect(run.mock.calls[1]![1]).toEqual({ signal: controller.signal });
  });

  it.runIf(popplerAvailable && noNetworkSandboxAvailable)(
    "inspects and renders a real small PDF with trusted Poppler",
    async () => {
      const bytes = readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
      );
      const parser = new PopplerReferencePageAtlasParser();

      const inspection = await parser.inspect({ bytes });
      const rendered = await parser.renderPage({ bytes, scanOrdinal: 1 });

      expect(inspection.pageCount).toBe(1);
      expect(inspection.pages[0]).toMatchObject({ scanOrdinal: 1, rotationDegrees: 0 });
      expect(rendered.widthPixels).toBeGreaterThan(0);
      expect(rendered.heightPixels).toBeGreaterThan(0);
      expect(Buffer.from(rendered.bytes).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    }
  );
});

function pdfInfoOutput(
  pages: ReadonlyArray<{ width: number; height: number; rotation: number }>
): string {
  return [
    `Title: ${PRIVATE_METADATA}`,
    `Pages: ${pages.length}`,
    ...pages.flatMap((page, index) => [
      `Page ${index + 1} size: ${page.width} x ${page.height} pts`,
      `Page ${index + 1} rot: ${page.rotation}`,
    ]),
    `File size: 123 bytes`,
    "",
  ].join("\n");
}

function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from([0])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(data.byteLength + 12);
  chunk.writeUInt32BE(data.byteLength, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function result(overrides: Partial<SubprocessResult> = {}): SubprocessResult {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    files: new Map(),
    durationMs: 1,
    ...overrides,
  };
}

function rejectWhenAborted(signal?: AbortSignal): Promise<SubprocessResult> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error("Test runner did not receive an AbortSignal"));
      return;
    }
    if (signal.aborted) {
      reject(new SubprocessAbortedError());
      return;
    }
    signal.addEventListener("abort", () => reject(new SubprocessAbortedError()), { once: true });
  });
}

async function expectClosedFailure(
  promise: Promise<unknown>,
  code: ReferencePageAtlasParserFailureCode,
  ...forbidden: string[]
): Promise<void> {
  let failure: unknown;
  try {
    await promise;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ReferencePageAtlasParserError);
  expect(failure).toMatchObject({ code });
  const exposed = `${(failure as Error).message}\n${JSON.stringify(failure)}`;
  for (const value of forbidden) expect(exposed).not.toContain(value);
  expect(failure).not.toHaveProperty("cause");
  expect(failure).not.toHaveProperty("stderr");
  expect(failure).not.toHaveProperty("stdout");
}
