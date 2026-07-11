import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("WorkspaceStore", () => {
  let rootDirectory: string;
  let store: WorkspaceStore;
  let idCounter: number;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-workspaces-"));
    idCounter = 0;
    store = new WorkspaceStore({
      rootDirectory,
      now: () => new Date("2026-07-10T12:00:00.000Z"),
      createId: () => `${String(++idCounter).padStart(8, "0")}-0000-4000-8000-000000000000`,
    });
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("creates and lists a durable arrangement workspace", () => {
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
        ],
      },
    });

    expect(store.get(workspace.id)).toEqual(workspace);
    expect(store.list()).toEqual([workspace]);
  });

  it("renames locally and requires exact confirmation before recursive removal", () => {
    const workspace = store.create({ title: "Draft title" });
    expect(store.rename(workspace.id, "Greensleeves family")).toMatchObject({
      id: workspace.id,
      title: "Greensleeves family",
    });
    expect(() => store.remove(workspace.id, "Greensleeves family")).toThrow(/exact workspace id/i);
    expect(store.get(workspace.id).title).toBe("Greensleeves family");
    store.remove(workspace.id, workspace.id);
    expect(store.list()).toEqual([]);
  });

  it("migrates pre-Model-Action workspace manifests without losing existing links", () => {
    const id = "workspace.1111111111111111";
    const directory = path.join(rootDirectory, id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, "workspace.json"),
      JSON.stringify({
        id,
        title: "Legacy workspace",
        brief: { targetConfigurations: [] },
        sourceArtifactIds: ["source.1111111111111111"],
        omrRunIds: [],
        scoreTranscriptionIds: [],
        normalizedScoreIds: [],
        analysisRecordIds: [],
        arrangementScoreIds: [],
        createdAt: "2026-07-10T12:00:00.000Z",
        updatedAt: "2026-07-10T12:00:00.000Z",
      })
    );

    expect(store.get(id)).toMatchObject({
      schemaVersion: 5,
      sourceArtifactIds: ["source.1111111111111111"],
      modelActionIds: [],
      arrangementBranchIds: [],
      arrangementSearchIds: [],
      arrangementCandidateIds: [],
      arrangementFamilyIds: [],
      deliverableIds: [],
      staleDerivationIds: [],
      editorialCommitmentIds: [],
      familyCommitmentIds: [],
      commitmentConflictIds: [],
      policyExceptionIds: [],
    });
    expect(JSON.parse(readFileSync(path.join(directory, "workspace.json"), "utf8"))).toMatchObject({
      schemaVersion: 5,
      modelActionIds: [],
      arrangementBranchIds: [],
      arrangementSearchIds: [],
      arrangementCandidateIds: [],
      arrangementFamilyIds: [],
      deliverableIds: [],
      staleDerivationIds: [],
      editorialCommitmentIds: [],
      familyCommitmentIds: [],
      commitmentConflictIds: [],
      policyExceptionIds: [],
    });
  });

  it("stores the golden PDF immutably and links it by checksum", () => {
    const workspace = store.create({ title: "Greensleeves" });
    const fixturePath = path.resolve(
      process.cwd(),
      "test/fixtures/greensleeves/greensleeves-satb.pdf"
    );
    const content = readFileSync(fixturePath);

    const artifact = store.addSourceArtifact(workspace.id, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: content.toString("base64"),
      provenance: {
        license: "Public Domain",
        sourceUrl:
          "https://www.ibiblio.org/mutopia/ftp/Traditional/greensleeves/greensleeves-a4.pdf",
        catalogUrl: "https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=1247",
        attribution: "Traditional; typeset by Steve Dunlop, Mutopia 1247",
      },
    });

    expect(artifact.sha256).toBe(createHash("sha256").update(content).digest("hex"));
    expect(store.readSourceContent(workspace.id, artifact.id)).toEqual(content);
    expect(store.get(workspace.id).sourceArtifactIds).toEqual([artifact.id]);

    const duplicate = store.addSourceArtifact(workspace.id, {
      filename: "copy.pdf",
      mimeType: "application/pdf",
      contentBase64: content.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    expect(duplicate.id).toBe(artifact.id);
    expect(store.get(workspace.id).sourceArtifactIds).toEqual([artifact.id]);
  });

  it("rejects a claimed PDF without a PDF signature", () => {
    const workspace = store.create({ title: "Invalid" });

    expect(() =>
      store.addSourceArtifact(workspace.id, {
        filename: "fake.pdf",
        mimeType: "application/pdf",
        contentBase64: Buffer.from("not a pdf").toString("base64"),
        provenance: { license: "Unknown" },
      })
    ).toThrow(/valid PDF signature/i);
  });

  it("persists immutable transcription lineage and derived analysis records", () => {
    const workspace = store.create({ title: "Greensleeves" });
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    const artifact = store.addSourceArtifact(workspace.id, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const lilypond = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
      "utf8"
    );
    const parsed = parseExplicitVoiceLilypond(lilypond, ["Soprano", "Alto", "Tenor", "Bass"]);
    const timestamp = "2026-07-10T12:00:00.000Z";
    const omrRun = store.saveOmrRun(workspace.id, {
      id: "omr.1111111111111111",
      sourceArtifactId: artifact.id,
      backend: { id: "fixture", version: "1", configuration: {} },
      status: "completed",
      nativeArtifactPaths: [],
      interchangeArtifactPaths: ["records/omr-runs/fixture.musicxml"],
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      diagnostics: [],
      createdAt: timestamp,
      completedAt: timestamp,
    });
    const transcription = store.saveScoreTranscription(workspace.id, {
      id: "transcription.1111111111111111",
      sourceArtifactId: artifact.id,
      omrRunId: omrRun.id,
      version: 1,
      status: "reviewed",
      title: parsed.title,
      key: parsed.key,
      timeSignature: parsed.timeSignature,
      parts: parsed.parts,
      measures: parsed.measures,
      events: parsed.events,
      uncertainties: [],
      createdAt: timestamp,
    });
    const normalized = store.saveNormalizedScore(workspace.id, {
      id: "score.1111111111111111",
      scoreTranscriptionId: transcription.id,
      version: 1,
      title: transcription.title,
      key: transcription.key,
      timeSignature: transcription.timeSignature,
      parts: transcription.parts,
      measures: transcription.measures,
      events: transcription.events,
      createdAt: timestamp,
    });
    const sopranoEventIds = normalized.events
      .filter((event) => event.partId === "part.soprano" && event.type === "note")
      .map((event) => event.id);
    const analysis = store.saveAnalysisRecord(workspace.id, {
      id: "analysis.1111111111111111",
      normalizedScoreId: normalized.id,
      version: 1,
      texture: "homophonic-four-part",
      principalVoicePartId: "part.soprano",
      claims: [
        {
          id: "claim.principal-voice",
          kind: "principal_voice",
          subjectIds: ["part.soprano"],
          statement: "The soprano carries the recognizable tune.",
          basis: "observation",
          confidence: 1,
        },
      ],
      preservationTargets: [
        {
          id: "target.principal-voice",
          kind: "principal_voice",
          partId: "part.soprano",
          eventIds: sopranoEventIds,
          rationale: "Faithful Reduction preserves the complete tune.",
        },
      ],
      createdAt: timestamp,
    });
    const normalizedV2 = store.saveNormalizedScore(workspace.id, {
      ...normalized,
      id: "score.2222222222222222",
      version: 2,
    });

    expect(store.getOmrRun(workspace.id, omrRun.id)).toEqual(omrRun);
    expect(store.getScoreTranscription(workspace.id, transcription.id)).toEqual(transcription);
    expect(store.getNormalizedScore(workspace.id, normalized.id)).toEqual(normalized);
    expect(store.getAnalysisRecord(workspace.id, analysis.id)).toEqual(analysis);
    expect(() => store.assertCanonicalResultReference(workspace.id, analysis.id)).not.toThrow();
    expect(() =>
      store.assertCanonicalResultReference(workspace.id, "analysis.9999999999999999")
    ).toThrow(/not found/);
    expect(
      store.resolveCurrentInputVersions(workspace.id, [
        { recordType: "normalized_score", recordId: normalized.id, version: 1 },
      ])
    ).toEqual([{ recordType: "normalized_score", recordId: normalizedV2.id, version: 2 }]);
    expect(store.get(workspace.id)).toMatchObject({
      omrRunIds: [omrRun.id],
      scoreTranscriptionIds: [transcription.id],
      normalizedScoreIds: [normalized.id, normalizedV2.id],
      analysisRecordIds: [analysis.id],
    });

    expect(() => store.saveScoreTranscription(workspace.id, transcription)).toThrow(
      /already exists/i
    );
  });
});
