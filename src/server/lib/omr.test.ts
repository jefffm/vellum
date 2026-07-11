import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import type { RecognizedScore } from "../../lib/music-domain.js";
import { AudiverisBackend, OmrService, audiverisCommand } from "./omr.js";
import type { OmrBackend, OmrBackendResult } from "./omr.js";
import { SubprocessError } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("OMR pipeline", () => {
  it("discovers an installed macOS Audiveris application", () => {
    if (process.platform === "darwin") {
      expect(audiverisCommand()).toMatch(/Audiveris\.app\/Contents\/MacOS\/Audiveris$|audiveris$/);
    }
  });
  let rootDirectory: string;
  let store: WorkspaceStore;
  let workspaceId: string;
  let sourceArtifactId: string;
  let recognizedScore: RecognizedScore;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-omr-"));
    store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({ title: "Greensleeves" });
    workspaceId = workspace.id;
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    sourceArtifactId = store.addSourceArtifact(workspaceId, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: { license: "Public Domain" },
    }).id;

    const lilypond = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
      "utf8"
    );
    const parsed = parseExplicitVoiceLilypond(lilypond, ["Soprano", "Alto", "Tenor", "Bass"]);
    recognizedScore = { ...parsed, uncertainties: [] };
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("persists a complete backend-neutral OMR run and reviewed transcription", async () => {
    const backend: OmrBackend = {
      id: "fixture",
      recognize: vi.fn(
        async (): Promise<OmrBackendResult> => ({
          backend: { id: "fixture", version: "1", configuration: { fixture: "greensleeves" } },
          artifacts: [
            { filename: "greensleeves.omr", category: "native", content: Buffer.from("omr") },
            {
              filename: "greensleeves.musicxml",
              category: "interchange",
              content: Buffer.from("<score-partwise/>"),
            },
            { filename: "fixture.log", category: "log", content: Buffer.from("ok") },
          ],
          pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
          diagnostics: [],
          recognizedScore,
        })
      ),
    };
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    const service = new OmrService({
      store,
      now: () => new Date("2026-07-10T12:00:00.000Z"),
      createId: () => ids.shift()!,
    });

    const result = await service.recognize(workspaceId, sourceArtifactId, backend);

    expect(result.omrRun).toMatchObject({
      id: "omr.11111111-1111-4111-8111-111111111111",
      status: "completed",
      nativeArtifactPaths: [expect.stringMatching(/greensleeves\.omr$/)],
      interchangeArtifactPaths: [expect.stringMatching(/greensleeves\.musicxml$/)],
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
    });
    expect(result.scoreTranscription).toMatchObject({
      id: "transcription.22222222-2222-4222-8222-222222222222",
      status: "reviewed",
      title: "Greensleeves",
      key: "G major",
      timeSignature: "6/8",
    });
    expect(result.normalizedScore.id).toBe("score.33333333-3333-4333-8333-333333333333");

    const soprano = result.normalizedScore.events.filter(
      (event) => event.partId === "part.soprano" && event.type === "note"
    );
    expect(
      soprano.slice(0, 6).flatMap((event) => (event.type === "note" ? [event.pitch] : []))
    ).toEqual(["E4", "G4", "A4", "B4", "C5", "B4"]);
    expect(store.get(workspaceId)).toMatchObject({
      omrRunIds: [result.omrRun.id],
      scoreTranscriptionIds: [result.scoreTranscription.id],
      normalizedScoreIds: [result.normalizedScore.id],
    });
  });

  it("marks critical uncertainty for score-anchored review", async () => {
    const uncertain: RecognizedScore = {
      ...recognizedScore,
      uncertainties: [
        {
          id: "uncertainty.soprano-opening",
          eventIds: ["event.soprano.1"],
          critical: false,
          category: "pitch",
          message: "Audiveris recognized the opening pitch with native confidence 0.420.",
          alternatives: ["E4", "F#4"],
          region: { page: 1, x: 100, y: 100, width: 20, height: 20 },
          resolved: false,
        },
      ],
    };
    const backend: OmrBackend = {
      id: "fixture",
      recognize: async () => ({
        backend: { id: "fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: uncertain,
      }),
    };
    const ids = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ];
    const service = new OmrService({ store, createId: () => ids.shift()! });

    const result = await service.recognize(workspaceId, sourceArtifactId, backend);
    expect(result.scoreTranscription.status).toBe("needs_review");
    expect(result.scoreTranscription.uncertainties[0]).toMatchObject({
      critical: true,
      resolved: false,
      region: { page: 1 },
    });
    expect(result.scoreTranscription.uncertainties[0]!.message).toContain("Preservation Target");
  });

  it("drives review from production-derived Audiveris native evidence", async () => {
    const nativeOmr = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/audiveris/imitative-passage-audiveris-5.10.2.omr")
    );
    const musicXml = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/audiveris/imitative-passage-audiveris-5.10.2.mxl")
    );
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "Audiveris\n- Version: 5.10.2\n",
        stderr: "",
        exitCode: 0,
        files: new Map(),
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        stdout: "done",
        stderr: "",
        exitCode: 0,
        files: new Map([
          ["imitative-passage.omr", nativeOmr],
          ["imitative-passage.mxl", musicXml],
        ]),
        durationMs: 2,
      });
    const backend = new AudiverisBackend({ runner: { run } });
    const ids = [
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
    ];
    const result = await new OmrService({ store, createId: () => ids.shift()! }).recognize(
      workspaceId,
      sourceArtifactId,
      backend
    );

    expect(result.omrRun).toMatchObject({
      status: "completed",
      backend: { id: "audiveris", version: "5.10.2" },
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      nativeArtifactPaths: expect.arrayContaining([
        expect.stringMatching(/imitative-passage\.omr$/),
        expect.stringMatching(/audiveris-page-1\.png$/),
      ]),
      interchangeArtifactPaths: [expect.stringMatching(/imitative-passage\.mxl$/)],
    });
    expect(result.omrRun.diagnostics).toContainEqual(
      expect.objectContaining({ code: "audiveris.native-evidence" })
    );
    expect(result.scoreTranscription.status).toBe("needs_review");
    expect(
      result.scoreTranscription.events.filter((event) => event.sourceRegion && event.confidence)
    ).toHaveLength(22);
    expect(result.scoreTranscription.uncertainties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          critical: true,
          region: expect.objectContaining({ page: 1, width: expect.any(Number) }),
        }),
      ])
    );
    expect(result.scoreTranscription.uncertainties.every((item) => item.critical)).toBe(true);
  });
});

describe("Audiveris backend", () => {
  it("uses documented batch/save/export arguments and normalizes MusicXML", async () => {
    const nativeZip = new JSZip();
    nativeZip.file("sheet#1/BINARY.png", Buffer.from("png"));
    const nativeOmr = await nativeZip.generateAsync({ type: "nodebuffer" });
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "Audiveris\n- Version: 5.10.0\n",
        stderr: "",
        exitCode: 0,
        files: new Map(),
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        stdout: "done",
        stderr: "",
        exitCode: 0,
        files: new Map([
          ["source.omr", nativeOmr],
          ["source.mxl", Buffer.from("mxl")],
        ]),
        durationMs: 2,
      });
    const normalized: RecognizedScore = {
      parts: [{ id: "part.1", name: "Voice", role: "other" }],
      measures: [
        {
          id: "measure.0",
          index: 0,
          displayNumber: "0",
          duration: { numerator: 1, denominator: 1 },
        },
      ],
      events: [
        {
          id: "event.1",
          type: "note",
          partId: "part.1",
          measureId: "measure.0",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: "E4",
        },
      ],
      uncertainties: [],
    };
    const normalizer = vi.fn(async () => ({
      recognizedScore: normalized,
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      diagnostics: [],
    }));
    const backend = new AudiverisBackend({ runner: { run }, normalizer });

    const result = await backend.recognize({
      source: {
        id: "source.1111111111111111",
        kind: "pdf",
        filename: "score.pdf",
        mimeType: "application/pdf",
        sha256: "a".repeat(64),
        byteLength: 8,
        storedPath: "sources/source/score.pdf",
        provenance: { license: "Public Domain" },
        createdAt: "2026-07-10T12:00:00.000Z",
      },
      content: Buffer.from("%PDF-1.4"),
    });

    expect(result.backend.version).toBe("5.10.0");
    expect(run.mock.calls[1]![0].args).toEqual([
      "-batch",
      "-transcribe",
      "-save",
      "-export",
      "-output",
      ".",
      "--",
      "source.pdf",
    ]);
    expect(normalizer).toHaveBeenCalledWith(Buffer.from("mxl"), "source.mxl", nativeOmr);
    expect(result.recognizedScore).toEqual(normalized);
    expect(result.pageMappings).toEqual([{ sourcePage: 1, recognizedPage: 1 }]);
    expect(result.artifacts.map((artifact) => artifact.filename)).toEqual([
      "source.omr",
      "source.mxl",
      "audiveris-page-1.png",
      "audiveris-process.log",
    ]);
  });

  it("reports an unavailable Audiveris runtime as a service dependency", async () => {
    const backend = new AudiverisBackend({
      runner: {
        run: async () => {
          throw new SubprocessError("spawn ENOENT");
        },
      },
    });

    await expect(
      backend.recognize({
        source: {
          id: "source.1111111111111111",
          kind: "pdf",
          filename: "score.pdf",
          mimeType: "application/pdf",
          sha256: "a".repeat(64),
          byteLength: 8,
          storedPath: "sources/source/score.pdf",
          provenance: { license: "Public Domain" },
          createdAt: "2026-07-10T12:00:00.000Z",
        },
        content: Buffer.from("%PDF-1.4"),
      })
    ).rejects.toMatchObject({ status: 503 });
  });
});
