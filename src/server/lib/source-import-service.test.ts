import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceImportService } from "./source-import-service.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("versioned non-optical source ingestion", () => {
  let rootDirectory: string;
  let store: WorkspaceStore;
  let workspaceId: string;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-source-import-"));
    store = new WorkspaceStore({ rootDirectory });
    workspaceId = store.create({ title: "Imported source" }).id;
  });

  afterEach(() => rmSync(rootDirectory, { recursive: true, force: true }));

  it("parses MusicXML directly without fabricating an OMR run", async () => {
    const content = readFileSync(path.resolve("test/fixtures/hymn-simple.xml"));
    const source = store.addSourceArtifact(workspaceId, {
      filename: "hymn.musicxml",
      mimeType: "application/vnd.recordare.musicxml+xml",
      contentBase64: content.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const ids = ["1111111111111111", "2222222222222222", "3333333333333333"];
    const result = await new SourceImportService({
      store,
      createId: () => ids.shift()!,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    }).import(workspaceId, source.id);

    expect(result.scoreTranscription).toMatchObject({
      sourceArtifactId: source.id,
      status: "reviewed",
      ingestion: { method: "deterministic_parse", sourceFormat: "musicxml" },
    });
    expect(result.scoreTranscription.omrRunId).toBeUndefined();
    expect(result.normalizedScore.events.length).toBeGreaterThan(0);
    expect(result.analysisRecord.normalizedScoreId).toBe(result.normalizedScore.id);
    expect(store.get(workspaceId).omrRunIds).toEqual([]);
  });

  it("parses named voices from the restricted LilyPond grammar with disclosure", async () => {
    const content = readFileSync(path.resolve("test/fixtures/greensleeves/greensleeves-satb.ly"));
    const source = store.addSourceArtifact(workspaceId, {
      filename: "greensleeves.ly",
      mimeType: "text/x-lilypond",
      contentBase64: content.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const ids = ["4444444444444444", "5555555555555555", "6666666666666666"];
    const result = await new SourceImportService({
      store,
      createId: () => ids.shift()!,
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    }).import(workspaceId, source.id);

    expect(result.scoreTranscription.parts.map((part) => part.name)).toEqual([
      "Soprano",
      "Alto",
      "Tenor",
      "Bass",
    ]);
    expect(result.scoreTranscription.ingestion).toEqual({
      method: "deterministic_parse",
      sourceFormat: "lilypond",
      diagnostics: [expect.objectContaining({ code: "lilypond.restricted_grammar" })],
    });
    expect(result.normalizedScore.events.length).toBeGreaterThan(100);
  });

  it.each([
    ["mei", "application/mei+xml"],
    ["mscz", "application/vnd.musescore.mscz"],
  ] as const)("converts %s through a disclosed interchange adapter", async (kind, mimeType) => {
    const source = store.addSourceArtifact(workspaceId, {
      filename: `source.${kind}`,
      mimeType,
      contentBase64: Buffer.from(`fixture-${kind}`).toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const ids = ["7777777777777777", "8888888888888888", "9999999999999999"];
    const normalizedFixture = {
      title: "Converted",
      timeSignature: "4/4",
      parts: [{ id: "part.voice", name: "Voice", role: "principal_voice" as const }],
      measures: [
        {
          id: "measure.1",
          index: 0,
          displayNumber: "1",
          duration: { numerator: 1, denominator: 1 },
        },
      ],
      events: [
        {
          id: "event.1",
          partId: "part.voice",
          measureId: "measure.1",
          type: "note" as const,
          pitch: "C4",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
        },
      ],
      uncertainties: [],
    };
    const result = await new SourceImportService({
      store,
      createId: () => ids.shift()!,
      convertInterchange: async (receivedKind) => ({
        content: Buffer.from("converted"),
        converter: receivedKind === "mscz" ? "MuseScore" : "music21",
      }),
      normalizeMusicXml: async () => normalizedFixture,
    }).import(workspaceId, source.id);

    expect(result.scoreTranscription.ingestion).toMatchObject({
      method: "interchange_conversion",
      sourceFormat: kind,
      diagnostics: [expect.objectContaining({ code: `${kind}.converted_to_musicxml` })],
    });
  });

  it.each([
    ["lead_sheet", "application/vnd.vellum.lead-sheet+json"],
    ["tablature", "application/vnd.vellum.tablature+json"],
  ] as const)("retains %s semantics rather than flattening them", async (kind, mimeType) => {
    const semanticScore = semanticFixture(kind);
    const source = store.addSourceArtifact(workspaceId, {
      filename: `${kind}.json`,
      mimeType,
      contentBase64: Buffer.from(JSON.stringify(semanticScore)).toString("base64"),
      provenance: { license: "Owner supplied" },
    });
    const ids = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"];
    const result = await new SourceImportService({
      store,
      createId: () => ids.shift()!,
    }).import(workspaceId, source.id);
    expect(result.scoreTranscription.ingestion).toMatchObject({
      method: "deterministic_parse",
      sourceFormat: kind,
      diagnostics: [expect.objectContaining({ code: `${kind}.semantic_import` })],
    });
    if (kind === "lead_sheet") {
      expect(result.normalizedScore.events.some((event) => event.type === "chord_symbol")).toBe(
        true
      );
    } else {
      expect(
        result.normalizedScore.events.some(
          (event) => event.type === "note" && event.tablature?.course === 3
        )
      ).toBe(true);
    }
  });

  it("labels model-memory input as best effort and preserves its warning", async () => {
    const source = store.addSourceArtifact(workspaceId, {
      filename: "request.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("Arrange the tune I remember as Greensleeves").toString("base64"),
      provenance: { license: "Owner description" },
    });
    const ids = ["dddddddddddddddd", "eeeeeeeeeeeeeeee", "ffffffffffffffff"];
    const result = await new SourceImportService({
      store,
      createId: () => ids.shift()!,
    }).import(workspaceId, source.id, { bestEffortScore: semanticFixture("tablature") });
    expect(result.scoreTranscription).toMatchObject({
      status: "best_effort",
      ingestion: {
        method: "best_effort",
        diagnostics: [expect.objectContaining({ code: "source.best_effort_model_memory" })],
      },
    });
  });
});

function semanticFixture(kind: "lead_sheet" | "tablature") {
  const base = {
    title: "Semantic source",
    timeSignature: "4/4",
    parts: [
      { id: "part.melody", name: "Melody", role: "principal_voice" as const },
      { id: "part.harmony", name: "Harmony", role: "harmony" as const },
    ],
    measures: [
      {
        id: "measure.1",
        index: 0,
        displayNumber: "1",
        duration: { numerator: 1, denominator: 1 },
      },
    ],
    uncertainties: [],
  };
  const note = {
    id: "event.note.1",
    partId: "part.melody",
    measureId: "measure.1",
    type: "note" as const,
    pitch: "G4",
    onset: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 1 },
    ...(kind === "tablature"
      ? { tablature: { course: 3, fret: 2, notation: "French letter c" } }
      : {}),
  };
  return {
    ...base,
    events:
      kind === "lead_sheet"
        ? [
            note,
            {
              id: "event.chord.1",
              partId: "part.harmony",
              measureId: "measure.1",
              type: "chord_symbol" as const,
              symbol: "G",
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 1 },
            },
          ]
        : [note],
  };
}
