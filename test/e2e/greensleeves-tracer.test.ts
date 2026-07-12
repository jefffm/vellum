import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { arrangementToEngraveParams } from "../../src/lib/arrangement-engrave.js";
import { buildAudioPreview } from "../../src/lib/audio-preview.js";
import { GENERATED_ARTIFACT_POLICY_VERSION } from "../../src/lib/generated-artifact-security.js";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { compileLilyPond } from "../../src/server/lib/compile-route.js";
import { engrave } from "../../src/server/lib/engrave.js";
import { OmrService } from "../../src/server/lib/omr.js";
import type { OmrBackend } from "../../src/server/lib/omr.js";
import {
  DEFAULT_LILYPOND_IMAGE,
  PodmanLilyPondRunner,
} from "../../src/server/lib/podman-lilypond-runner.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

let lilypondSandboxAvailable = false;

beforeAll(() => {
  try {
    execFileSync("podman", ["info"], { stdio: "pipe" });
    execFileSync("podman", ["image", "exists", DEFAULT_LILYPOND_IMAGE], { stdio: "pipe" });
    lilypondSandboxAvailable = true;
  } catch {
    lilypondSandboxAvailable = false;
  }
});

describe("Greensleeves PDF tracer bullet", () => {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-greensleeves-e2e-"));

  afterAll(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("uploads, recognizes, analyzes, arranges, audits, engraves, and compiles", async () => {
    if (!lilypondSandboxAvailable) return;

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
          {
            id: "target.classical-guitar",
            instrumentId: "classical-guitar-6",
            role: "solo",
            tuningId: "standard",
            notationLayouts: ["standard-notation"],
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
    const classicalArranged = new ArrangementService({ store }).createFaithfulReduction(
      workspace.id,
      {
        normalizedScoreId: omr.normalizedScore.id,
        targetConfigurationId: "target.classical-guitar",
      }
    );
    expect(classicalArranged.analysisRecordId).toBe(arranged.analysisRecordId);
    expect(classicalArranged.arrangementScore).toMatchObject({
      targetConfiguration: {
        instrumentId: "classical-guitar-6",
        tuningId: "standard",
        notationLayouts: ["standard-notation"],
      },
      transpositionPlan: { sourceKey: "G major", targetKey: "G major", semitones: 0 },
      preservationAudit: { status: "pass", findings: [] },
    });

    const engraving = engrave(
      arrangementToEngraveParams(arranged.arrangementScore, omr.normalizedScore)
    );
    const compiled = await compileLilyPond(
      { source: engraving.source, format: "both" },
      new PodmanLilyPondRunner({ defaultTimeout: 60_000 }),
      60_000
    );
    const luteEngraving = engrave(
      arrangementToEngraveParams(luteArranged.arrangementScore, omr.normalizedScore)
    );
    const luteCompiled = await compileLilyPond(
      { source: luteEngraving.source, format: "both" },
      new PodmanLilyPondRunner({ defaultTimeout: 60_000 }),
      60_000
    );
    const classicalParams = arrangementToEngraveParams(
      classicalArranged.arrangementScore,
      omr.normalizedScore
    );
    expect(classicalParams.template).toBe("solo-staff");
    const classicalEngraving = engrave(classicalParams);
    const classicalCompiled = await compileLilyPond(
      { source: classicalEngraving.source, format: "both" },
      new PodmanLilyPondRunner({ defaultTimeout: 60_000 }),
      60_000
    );

    expect(compiled.errors).toEqual([]);
    expect(compiled.svg?.length ?? 0).toBeGreaterThan(1_000);
    expect(compiled.svg).toContain(
      `data-arrangement-event-id="${arranged.arrangementScore.events[0]!.id}"`
    );
    expect(compiled.svg).toContain(
      `data-measure-id="${arranged.arrangementScore.events[0]!.measureId}"`
    );
    expect(compiled.artifactPolicyVersion).toBe(GENERATED_ARTIFACT_POLICY_VERSION);
    expect(compiled.svg).not.toMatch(
      /<script|<style|<a\b|\shref=|xlink:href|textedit:|\son[a-z]+=/i
    );
    expect(compiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(compiled.midi?.length ?? 0).toBeGreaterThan(100);
    expect(luteCompiled.errors).toEqual([]);
    expect(luteCompiled.svg?.length ?? 0).toBeGreaterThan(1_000);
    expect(luteCompiled.artifactPolicyVersion).toBe(GENERATED_ARTIFACT_POLICY_VERSION);
    expect(luteCompiled.svg).not.toMatch(/<script|<style|<a\b|\shref=|xlink:href|textedit:/i);
    expect(luteCompiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(luteCompiled.midi?.length ?? 0).toBeGreaterThan(100);
    expect(classicalCompiled.errors).toEqual([]);
    expect(classicalCompiled.svg?.length ?? 0).toBeGreaterThan(1_000);
    expect(classicalCompiled.artifactPolicyVersion).toBe(GENERATED_ARTIFACT_POLICY_VERSION);
    expect(classicalCompiled.svg).not.toMatch(/<script|<style|<a\b|\shref=|xlink:href|textedit:/i);
    expect(classicalCompiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(classicalCompiled.midi?.length ?? 0).toBeGreaterThan(100);
    expect(classicalEngraving.source).toContain('\\include "instruments/classical-guitar-6.ily"');
    expect(classicalEngraving.source).toContain("\\new Staff");
    expect(classicalEngraving.source).toContain('\\clef "treble_8"');
    expect(classicalEngraving.source).not.toContain("\\new TabStaff");
    expect(classicalEngraving.source).not.toContain("tablatureFormat");
    expect(midiNoteOns(Buffer.from(classicalCompiled.midi!, "base64"))).toHaveLength(
      classicalArranged.arrangementScore.events.reduce(
        (total, event) => total + (event.type === "rest" ? 0 : event.pitches.length),
        0
      )
    );
    expect(luteEngraving.source).toContain('\include "instruments/baroque-lute-13.ily"');
    expect(luteEngraving.source).toContain(
      "additionalBassStrings = \\stringTuning <a,, bes,, c, d, ees, f, g,>"
    );
    const audioPreview = buildAudioPreview(arranged.arrangementScore, omr.normalizedScore);
    const protectedPrincipalEvents = arranged.arrangementScore.events.filter(
      (event) => event.principalVoiceSourceEventId
    );
    expect(audioPreview.synthesis).toBe("basic-oscillator");
    expect(audioPreview.mode).toBe("literal");
    expect(audioPreview.performedForm.traversalDecisions).toEqual([
      "Play written measures once in score order.",
    ]);
    expect(new Set(audioPreview.events.map((event) => event.occurrenceId)).size).toBe(
      audioPreview.events.length
    );
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
    expect(
      audioPreview.events
        .filter((event) => event.part === "principal-voice")
        .every(
          (event) =>
            event.sourceEventIds.length > 0 &&
            event.transformationEntryIds.length > 0 &&
            event.auditTargetIds.length > 0
        )
    ).toBe(true);
    const luteAudioPreview = buildAudioPreview(luteArranged.arrangementScore, omr.normalizedScore);
    expect(
      luteAudioPreview.events.filter((event) => event.part === "principal-voice")
    ).toHaveLength(protectedPrincipalEvents.length);
    const classicalAudioPreview = buildAudioPreview(
      classicalArranged.arrangementScore,
      omr.normalizedScore
    );
    expect(
      classicalAudioPreview.events.filter((event) => event.part === "principal-voice")
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
      writeFileSync(
        path.join(outputDirectory, "greensleeves-classical-guitar.pdf"),
        Buffer.from(classicalCompiled.pdf!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-classical-guitar.svg"),
        classicalCompiled.svg!,
        "utf8"
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-classical-guitar.midi"),
        Buffer.from(classicalCompiled.midi!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "greensleeves-classical-guitar.ly"),
        classicalEngraving.source,
        "utf8"
      );
    }
    expect(store.get(workspace.id)).toMatchObject({
      sourceArtifactIds: [source.id],
      omrRunIds: [omr.omrRun.id],
      scoreTranscriptionIds: [omr.scoreTranscription.id],
      normalizedScoreIds: [omr.normalizedScore.id],
      analysisRecordIds: [arranged.analysisRecordId],
      arrangementScoreIds: [
        arranged.arrangementScore.id,
        luteArranged.arrangementScore.id,
        classicalArranged.arrangementScore.id,
      ],
    });
  }, 300_000);
});

function midiNoteOns(midi: Buffer): number[] {
  const notes: number[] = [];
  let offset = 14;
  while (offset + 8 <= midi.length) {
    const chunk = midi.toString("ascii", offset, offset + 4);
    const length = midi.readUInt32BE(offset + 4);
    offset += 8;
    if (chunk !== "MTrk") {
      offset += length;
      continue;
    }
    const end = offset + length;
    let runningStatus = 0;
    while (offset < end) {
      offset = skipVariableLength(midi, offset);
      let status = midi[offset]!;
      if (status < 0x80) status = runningStatus;
      else {
        offset += 1;
        runningStatus = status;
      }
      if (status === 0xff) {
        offset += 1;
        const metaLengthStart = offset;
        offset = skipVariableLength(midi, offset);
        offset += readVariableLength(midi, metaLengthStart);
      } else if (status === 0xf0 || status === 0xf7) {
        const sysexLengthStart = offset;
        offset = skipVariableLength(midi, offset);
        offset += readVariableLength(midi, sysexLengthStart);
      } else {
        const kind = status & 0xf0;
        const dataLength = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        const note = midi[offset]!;
        const velocity = dataLength === 2 ? midi[offset + 1]! : 0;
        if (kind === 0x90 && velocity > 0) notes.push(note);
        offset += dataLength;
      }
    }
  }
  return notes;
}

function skipVariableLength(buffer: Buffer, offset: number): number {
  do {
    const byte = buffer[offset++]!;
    if ((byte & 0x80) === 0) return offset;
  } while (offset < buffer.length);
  return offset;
}

function readVariableLength(buffer: Buffer, offset: number): number {
  let value = 0;
  let byte = 0;
  do {
    byte = buffer[offset++]!;
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}
