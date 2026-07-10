import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { arrangementToEngraveParams } from "../../src/lib/arrangement-engrave.js";
import { buildAudioPreview } from "../../src/lib/audio-preview.js";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { compileLilyPond } from "../../src/server/lib/compile-route.js";
import { engrave } from "../../src/server/lib/engrave.js";
import { OmrService } from "../../src/server/lib/omr.js";
import type { OmrBackend } from "../../src/server/lib/omr.js";
import { SubprocessRunner } from "../../src/server/lib/subprocess.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

let lilypondAvailable = false;

beforeAll(() => {
  try {
    execFileSync("lilypond", ["--version"], { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }
});

describe("Greensleeves PDF tracer bullet", () => {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-greensleeves-e2e-"));

  afterAll(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("uploads, recognizes, analyzes, arranges, audits, engraves, and compiles", async () => {
    if (!lilypondAvailable) return;

    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Greensleeves",
      brief: {
        targetConfigurations: [
          {
            id: "target.baroque-guitar",
            instrumentId: "baroque-guitar-5",
            role: "solo",
            stringing: "french",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
          {
            id: "target.baroque-lute",
            instrumentId: "baroque-lute-13",
            role: "solo",
            tuningId: "d_minor",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
        ],
      },
    });
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    const source = store.addSourceArtifact(workspace.id, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: {
        license: "Public Domain",
        catalogUrl: "https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=1247",
      },
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    const backend: OmrBackend = {
      id: "fixture",
      recognize: async () => ({
        backend: { id: "fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: { ...parsed, uncertainties: [] },
      }),
    };
    const omr = await new OmrService({ store }).recognize(workspace.id, source.id, backend);
    const arranged = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-guitar",
    });
    expect(arranged.arrangementScore.preservationAudit.status).toBe("pass");
    const luteArranged = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-lute",
    });
    expect(luteArranged.analysisRecordId).toBe(arranged.analysisRecordId);
    expect(luteArranged.arrangementScore).toMatchObject({
      targetConfiguration: { instrumentId: "baroque-lute-13", tuningId: "d_minor" },
      transpositionPlan: { sourceKey: "G major", targetKey: "D major", semitones: -5 },
      preservationAudit: { status: "pass", findings: [] },
    });

    const engraving = engrave(
      arrangementToEngraveParams(arranged.arrangementScore, omr.normalizedScore)
    );
    const compiled = await compileLilyPond(
      { source: engraving.source, format: "both" },
      new SubprocessRunner(60_000),
      60_000
    );
    const luteEngraving = engrave(
      arrangementToEngraveParams(luteArranged.arrangementScore, omr.normalizedScore)
    );
    const luteCompiled = await compileLilyPond(
      { source: luteEngraving.source, format: "both" },
      new SubprocessRunner(60_000),
      60_000
    );

    expect(compiled.errors).toEqual([]);
    expect(compiled.svg?.length ?? 0).toBeGreaterThan(1_000);
    expect(compiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(compiled.midi?.length ?? 0).toBeGreaterThan(100);
    expect(luteCompiled.errors).toEqual([]);
    expect(luteCompiled.svg?.length ?? 0).toBeGreaterThan(1_000);
    expect(luteCompiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(luteCompiled.midi?.length ?? 0).toBeGreaterThan(100);
    expect(luteEngraving.source).toContain('\include "instruments/baroque-lute-13.ily"');
    expect(luteEngraving.source).toContain(
      "additionalBassStrings = \\stringTuning <a,, bes,, c, d, ees, f, g,>"
    );
    const audioPreview = buildAudioPreview(arranged.arrangementScore, omr.normalizedScore);
    const protectedPrincipalEvents = arranged.arrangementScore.events.filter(
      (event) => event.principalVoiceSourceEventId
    );
    expect(audioPreview.synthesis).toBe("basic-oscillator");
    expect(audioPreview.events.filter((event) => event.part === "principal-voice")).toHaveLength(
      protectedPrincipalEvents.length
    );
    expect(
      new Set(
        audioPreview.events.map(
          (event) => `${event.arrangementEventId}:${event.midi}:${event.part}`
        )
      ).size
    ).toBe(audioPreview.events.length);
    const luteAudioPreview = buildAudioPreview(luteArranged.arrangementScore, omr.normalizedScore);
    expect(
      luteAudioPreview.events.filter((event) => event.part === "principal-voice")
    ).toHaveLength(protectedPrincipalEvents.length);
    if (process.env.VELLUM_CAPTURE_FIXTURE_ARTIFACTS === "1") {
      const outputDirectory = path.resolve(process.cwd(), "tmp/pdfs");
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-guitar.pdf"),
        Buffer.from(compiled.pdf!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-guitar.svg"),
        compiled.svg!,
        "utf8"
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-guitar.midi"),
        Buffer.from(compiled.midi!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-guitar.ly"),
        engraving.source,
        "utf8"
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-lute.pdf"),
        Buffer.from(luteCompiled.pdf!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-lute.svg"),
        luteCompiled.svg!,
        "utf8"
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-lute.midi"),
        Buffer.from(luteCompiled.midi!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-baroque-lute.ly"),
        luteEngraving.source,
        "utf8"
      );
    }
    expect(store.get(workspace.id)).toMatchObject({
      sourceArtifactIds: [source.id],
      omrRunIds: [omr.omrRun.id],
      scoreTranscriptionIds: [omr.scoreTranscription.id],
      normalizedScoreIds: [omr.normalizedScore.id],
      analysisRecordIds: [arranged.analysisRecordId],
      arrangementScoreIds: [arranged.arrangementScore.id, luteArranged.arrangementScore.id],
    });
  }, 90_000);
});
