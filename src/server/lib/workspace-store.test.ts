import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    const renamed = store.rename(workspace.id, "Greensleeves family", workspace.revision);
    expect(renamed).toMatchObject({
      id: workspace.id,
      title: "Greensleeves family",
      revision: workspace.revision + 1,
    });
    expect(() => store.rename(workspace.id, "Lost update", workspace.revision)).toThrow(
      /revision conflict/i
    );
    expect(() => store.remove(workspace.id, "Greensleeves family")).toThrow(/exact workspace id/i);
    expect(store.get(workspace.id).title).toBe("Greensleeves family");
    store.remove(workspace.id, workspace.id);
    expect(store.list()).toEqual([]);
  });

  it("recovers valid orphan records and quarantines invalid records on startup", () => {
    const workspace = store.create({ title: "Recover me" });
    const records = path.join(rootDirectory, workspace.id, "records", "guided-workflows");
    mkdirSync(records, { recursive: true });
    const workflowId = "workflow.1111111111111111";
    writeFileSync(
      path.join(records, `${workflowId}.json`),
      JSON.stringify({
        id: workflowId,
        workspaceId: workspace.id,
        status: "interrupted",
        stage: "source_saved",
        sourceArtifactId: "source.1111111111111111",
        optical: true,
        preservationPolicy: "faithful_reduction",
        targets: [
          {
            targetConfigurationId: "target.1111111111111111",
            status: "pending",
            deliverableIds: [],
          },
        ],
        resumeCount: 0,
        failureCode: "process_exit",
        createdAt: "2026-07-10T12:00:00.000Z",
        updatedAt: "2026-07-10T12:00:00.000Z",
      })
    );
    writeFileSync(path.join(records, "workflow.2222222222222222.json"), "{broken");
    writeFileSync(path.join(rootDirectory, workspace.id, ".workspace.lock"), "99999999");
    const recovering = new WorkspaceStore({ rootDirectory, recoverOnStart: false });

    const report = recovering.recoverWorkspace(workspace.id);

    expect(report.linkedRecordIds).toEqual([workflowId]);
    expect(report.staleLockRemoved).toBe(true);
    expect(report.quarantinedPaths).toEqual([
      ".recovery/quarantine/records/guided-workflows/workflow.2222222222222222.json",
    ]);
    expect(recovering.get(workspace.id).guidedWorkflowIds).toEqual([workflowId]);
  });

  it("checks immutable Deliverable metadata before writing or replacing bytes", () => {
    const workspace = store.create({ title: "Artifacts" });
    vi.spyOn(store, "getArrangementScore").mockReturnValue({ version: 1 } as never);
    const content = Buffer.from("immutable artifact");
    const id = "deliverable.1111111111111111";
    const deliverable = {
      id,
      arrangementScoreId: "arrangement.1111111111111111",
      arrangementScoreVersion: 1,
      notationLayout: "standard-notation",
      kind: "pdf" as const,
      mimeType: "application/pdf",
      sha256: createHash("sha256").update(content).digest("hex"),
      byteLength: content.byteLength,
      storedPath: `records/deliverable-artifacts/${id}/artifact.pdf`,
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    store.saveDeliverable(workspace.id, deliverable, content);
    const conflictingContent = Buffer.from("different immutable artifact");
    expect(() =>
      store.saveDeliverable(
        workspace.id,
        {
          ...deliverable,
          sha256: createHash("sha256").update(conflictingContent).digest("hex"),
          byteLength: conflictingContent.byteLength,
        },
        conflictingContent
      )
    ).toThrow(/metadata conflicts/i);
    expect(store.readDeliverableContent(workspace.id, id)).toEqual(content);
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
      schemaVersion: 6,
      revision: 1,
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
      performanceInterpretationIds: [],
    });
    expect(JSON.parse(readFileSync(path.join(directory, "workspace.json"), "utf8"))).toMatchObject({
      schemaVersion: 6,
      revision: 1,
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
      performanceInterpretationIds: [],
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
    const unrelatedTranscription = store.saveScoreTranscription(workspace.id, {
      ...transcription,
      id: "transcription.9999999999999999",
      version: 99,
    });
    const unrelatedScore = store.saveNormalizedScore(workspace.id, {
      ...normalized,
      id: "score.9999999999999999",
      scoreTranscriptionId: unrelatedTranscription.id,
      version: 99,
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
    const branchA = store.saveScoreTranscription(workspace.id, {
      ...transcription,
      id: "transcription.3333333333333333",
      parentId: transcription.id,
      version: 2,
    });
    const branchB = store.saveScoreTranscription(workspace.id, {
      ...transcription,
      id: "transcription.4444444444444444",
      parentId: transcription.id,
      version: 2,
    });
    store.saveNormalizedScore(workspace.id, {
      ...normalized,
      id: "score.3333333333333333",
      scoreTranscriptionId: branchA.id,
      version: 2,
    });
    store.saveNormalizedScore(workspace.id, {
      ...normalized,
      id: "score.4444444444444444",
      scoreTranscriptionId: branchB.id,
      version: 2,
    });
    expect(() =>
      store.resolveCurrentInputVersions(workspace.id, [
        { recordType: "normalized_score", recordId: normalized.id, version: 1 },
      ])
    ).toThrow(/ambiguous correction lineage/i);
    expect(unrelatedScore.version).toBe(99);
    expect(store.get(workspace.id)).toMatchObject({
      omrRunIds: [omrRun.id],
      scoreTranscriptionIds: [transcription.id, unrelatedTranscription.id, branchA.id, branchB.id],
      normalizedScoreIds: expect.arrayContaining([
        normalized.id,
        normalizedV2.id,
        unrelatedScore.id,
      ]),
      analysisRecordIds: [analysis.id],
    });

    expect(() => store.saveScoreTranscription(workspace.id, transcription)).toThrow(
      /already exists/i
    );
  });
});
