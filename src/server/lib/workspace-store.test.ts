import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelAction, ModelActionPublication } from "../../lib/music-domain.js";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import { digestValue } from "./evaluation-harness.js";
import {
  authorizeModelActionEgress,
  buildModelActionPublication,
  prepareModelActionEgress,
} from "./model-action-boundary.js";
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
      schemaVersion: 8,
      revision: 1,
      sourceArtifactIds: ["source.1111111111111111"],
      modelActionIds: [],
      sourceTruthAssessmentIds: [],
      performanceBriefIds: [],
      arrangementPlanIds: [],
      planConflictIds: [],
      arrangementBranchIds: [],
      arrangementSearchIds: [],
      passageSearchIds: [],
      ownerPlaytestIds: [],
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
      schemaVersion: 8,
      revision: 1,
      modelActionIds: [],
      sourceTruthAssessmentIds: [],
      performanceBriefIds: [],
      arrangementPlanIds: [],
      planConflictIds: [],
      arrangementBranchIds: [],
      arrangementSearchIds: [],
      passageSearchIds: [],
      ownerPlaytestIds: [],
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

  it("resolves Model Action inputs only inside their workspace and rejects stale bindings", () => {
    const workspace = store.create({ title: "Bound inputs" });
    const otherWorkspace = store.create({ title: "Other workspace" });
    const content = Buffer.from("%PDF-1.4\nfixture");
    const source = store.addSourceArtifact(workspace.id, {
      filename: "source.pdf",
      mimeType: "application/pdf",
      contentBase64: content.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const input = {
      recordType: "source_artifact",
      recordId: source.id,
      version: 1,
      sha256: source.sha256,
    };

    expect(store.resolveModelActionInputVersions(workspace.id, [])).toEqual([]);
    expect(store.resolveModelActionInputVersions(workspace.id, [input])).toEqual([input]);
    expect(() =>
      store.resolveModelActionInputVersions(workspace.id, [{ ...input, version: 2 }])
    ).toThrow(/version mismatch/i);
    expect(() =>
      store.resolveModelActionInputVersions(workspace.id, [{ ...input, sha256: "0".repeat(64) }])
    ).toThrow(/digest mismatch/i);
    expect(() =>
      store.resolveModelActionInputVersions(workspace.id, [
        { ...input, recordType: "normalized_score" },
      ])
    ).toThrow(/mismatched Model Action input reference/i);
    expect(() => store.resolveModelActionInputVersions(otherWorkspace.id, [input])).toThrow(
      /not part of workspace/i
    );
  });

  it("publishes one closed Model Action result and exposes it only through the action", () => {
    const workspace = store.create({ title: "Atomic publication" });
    const otherWorkspace = store.create({ title: "Wrong workspace" });
    const { action, publication } = modelActionPublicationFixture("1");
    store.saveModelAction(workspace.id, action);

    expect(() => store.getModelActionPublicationForAction(workspace.id, action.id)).toThrow(
      /not published/i
    );
    expect(store.publishModelActionResult(workspace.id, action.id, publication)).toEqual(
      publication
    );
    expect(store.getModelActionPublicationForAction(workspace.id, action.id)).toEqual(publication);
    expect(store.getModelAction(workspace.id, action.id)).toMatchObject({
      status: "completed",
      publicationReference: publication.id,
      attempts: [
        expect.objectContaining({
          status: "completed",
          publicationReference: publication.id,
        }),
      ],
    });
    expect(() => store.publishModelActionResult(workspace.id, action.id, publication)).toThrow(
      /replay/i
    );
    expect(() => store.getModelActionPublicationForAction(otherWorkspace.id, action.id)).toThrow(
      /not found/i
    );
    expect(() =>
      store.saveModelAction(workspace.id, {
        ...store.getModelAction(workspace.id, action.id),
        status: "interrupted",
      })
    ).toThrow(/published Model Action is immutable/i);
  });

  it("rejects a stale Model Action transition after another request wins the claim", () => {
    const workspace = store.create({ title: "Atomic action transition" });
    const { action } = modelActionPublicationFixture("4");
    store.saveModelAction(workspace.id, action);

    const claimed = store.compareAndSwapModelAction(workspace.id, action, (current) => ({
      ...current,
      status: "running",
      attempts: current.attempts.map((attempt) => ({ ...attempt, status: "running" })),
    }));
    expect(claimed.status).toBe("running");
    expect(() =>
      store.compareAndSwapModelAction(workspace.id, action, (current) => ({
        ...current,
        status: "denied",
        attempts: current.attempts.map((attempt) => ({ ...attempt, status: "denied" })),
      }))
    ).toThrow(/state changed/i);
    expect(store.getModelAction(workspace.id, action.id).status).toBe("running");
  });

  it("keeps an unlinked publication orphan unreadable and rejects binding mismatches", () => {
    const workspace = store.create({ title: "Publication failures" });
    const first = modelActionPublicationFixture("2");
    store.saveModelAction(workspace.id, first.action);
    const publicationDirectory = path.join(
      rootDirectory,
      workspace.id,
      "records",
      "model-action-publications"
    );
    mkdirSync(publicationDirectory, { recursive: true });
    writeFileSync(
      path.join(publicationDirectory, `${first.publication.id}.json`),
      JSON.stringify(first.publication)
    );

    expect(() => store.getModelActionPublicationForAction(workspace.id, first.action.id)).toThrow(
      /not published/i
    );
    expect(() =>
      store.publishModelActionResult(workspace.id, first.action.id, first.publication)
    ).toThrow(/already exists/i);

    const second = modelActionPublicationFixture("3");
    store.saveModelAction(workspace.id, second.action);
    expect(() =>
      store.publishModelActionResult(workspace.id, second.action.id, {
        ...second.publication,
        result: { ...second.publication.result, attemptId: "model-attempt.ffffffffffffffff" },
      })
    ).toThrow(/attempt binding mismatch/i);
    expect(() => store.getModelActionPublicationForAction(workspace.id, second.action.id)).toThrow(
      /not published/i
    );

    const badResponseDigest = modelActionPublicationFixture("6");
    store.saveModelAction(workspace.id, badResponseDigest.action);
    expect(() =>
      store.publishModelActionResult(workspace.id, badResponseDigest.action.id, {
        ...badResponseDigest.publication,
        commit: { ...badResponseDigest.publication.commit, responseDigest: "0".repeat(64) },
      })
    ).toThrow(/provider response digest mismatch/i);

    const badValidationDigest = modelActionPublicationFixture("7");
    store.saveModelAction(workspace.id, badValidationDigest.action);
    expect(() =>
      store.publishModelActionResult(workspace.id, badValidationDigest.action.id, {
        ...badValidationDigest.publication,
        commit: { ...badValidationDigest.publication.commit, validationDigest: "0".repeat(64) },
      })
    ).toThrow(/validation digest mismatch/i);
  });

  it("quarantines a publication left unlinked by a simulated process crash", () => {
    const workspace = store.create({ title: "Publication crash recovery" });
    const { action, publication } = modelActionPublicationFixture("5");
    store.saveModelAction(workspace.id, action);
    const publicationDirectory = path.join(
      rootDirectory,
      workspace.id,
      "records",
      "model-action-publications"
    );
    const publicationPath = path.join(publicationDirectory, `${publication.id}.json`);
    mkdirSync(publicationDirectory, { recursive: true });
    writeFileSync(publicationPath, JSON.stringify(publication));

    const report = store.recoverWorkspace(workspace.id);

    expect(report.quarantinedPaths).toContain(
      `.recovery/quarantine/records/model-action-publications/${publication.id}.json`
    );
    expect(existsSync(publicationPath)).toBe(false);
    expect(store.publishModelActionResult(workspace.id, action.id, publication)).toEqual(
      publication
    );
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

function modelActionPublicationFixture(suffix: string): {
  action: ModelAction;
  publication: ModelActionPublication;
} {
  const digits = suffix.repeat(16);
  const actionId = `model-action.${digits}`;
  const attemptId = `model-attempt.${digits}`;
  const timestamp = "2026-07-10T12:00:00.000Z";
  const identity = {
    actionId,
    attemptId,
    createId: () => digits,
    now: () => new Date(timestamp),
  };
  const intent = "Explain the passage.";
  const { disclosure, disclosureDigest } = prepareModelActionEgress({
    ...identity,
    ownerIntent: intent,
    inputVersions: [],
  });
  const { accessDecision, egressEnvelope, envelopeDigest } = authorizeModelActionEgress({
    ...identity,
    ownerIntent: intent,
    inputVersions: [],
    disclosure,
    disclosureDigest,
    decision: "authorize" as const,
  });
  if (!egressEnvelope || !envelopeDigest) throw new Error("Fixture authorization failed");
  const action: ModelAction = {
    id: actionId,
    kind: "interactive_guidance_v1",
    intent,
    idempotencyKey: suffix.repeat(64),
    status: "authorized",
    originalInputVersions: [],
    attempts: [
      {
        id: attemptId,
        number: 1,
        mode: "initial",
        status: "authorized",
        inputVersions: [],
        completedLocalToolResults: [],
        lastConfirmedBoundary: "No canonical state changed",
        disclosure,
        disclosureDigest,
        accessDecision,
        egressEnvelope,
        envelopeDigest,
        startedAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const publication = buildModelActionPublication({
    ...identity,
    envelope: egressEnvelope,
    envelopeDigest,
    response: {
      envelopeDigest,
      provider: egressEnvelope.provider,
      model: egressEnvelope.model,
      providerResponseId: `provider-response.${digits}`,
      content: "The upper voice is structurally primary.",
    },
  });
  return { action, publication };
}
