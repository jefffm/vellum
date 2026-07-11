import { Value } from "@sinclair/typebox/value";
import express from "express";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildAudioPreview } from "../../src/lib/audio-preview.js";
import { continuoArrangementToLilyPond } from "../../src/lib/continuo-engrave.js";
import { RecognizedScoreSchema } from "../../src/lib/music-domain.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import {
  createArrangementCompileRoute,
  createArrangementPreviewRoute,
} from "../../src/server/lib/arrangement-deliverable-route.js";
import { OmrService } from "../../src/server/lib/omr.js";
import type { OmrBackend } from "../../src/server/lib/omr.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";
import { midiNoteOns } from "../lib/midi.js";

describe("soprano plus Figured Bass Continuo Realization tracer", () => {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-continuo-e2e-"));

  afterAll(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("imports, analyzes, realizes, audits, engraves, and previews semantic parts", async () => {
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Continuo Suspension Exercise",
      brief: {
        targetConfigurations: [
          {
            id: "target.piano-continuo",
            instrumentId: "piano",
            role: "ensemble",
            realizationProfileId: "continuo.italian-baroque",
            notationLayouts: ["continuo-score"],
            deliverables: ["pdf", "audio-preview"],
          },
          {
            id: "target.baroque-guitar-continuo",
            instrumentId: "baroque-guitar-5",
            role: "ensemble",
            stringing: "french",
            realizationProfileId: "continuo.italian-baroque",
            continuoTreatment: "separate_bass",
            continuoBassInstrumentId: "voice-bass",
            notationLayouts: ["continuo-score"],
            deliverables: ["pdf", "audio-preview"],
          },
        ],
      },
    });
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/continuo/continuo-suspension.pdf")
    );
    const source = store.addSourceArtifact(workspace.id, {
      filename: "continuo-suspension.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: {
        license: "CC0 1.0 Universal / Public Domain Dedication",
        attribution: "Vellum project fixture",
      },
    });
    const recognizedScore = Value.Decode(
      RecognizedScoreSchema,
      JSON.parse(
        readFileSync(
          path.resolve(process.cwd(), "test/fixtures/continuo/reviewed-score.json"),
          "utf8"
        )
      )
    );
    const backend: OmrBackend = {
      id: "reviewed-continuo-fixture",
      recognize: async () => ({
        backend: { id: "reviewed-continuo-fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore,
      }),
    };

    const omr = await new OmrService({ store }).recognize(workspace.id, source.id, backend);
    const arranged = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.piano-continuo",
    });
    expect(arranged.candidates).toHaveLength(2);
    expect(arranged.arrangementScore).toMatchObject({
      targetConfiguration: {
        instrumentId: "piano",
        realizationProfileId: "continuo.italian-baroque",
      },
      preservationAudit: { status: "pass" },
    });
    expect(arranged.arrangementScore.preservationAudit.findings).toContainEqual(
      expect.objectContaining({ code: "continuo.prepared_suspension_accepted" })
    );
    const guitarArranged = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.baroque-guitar-continuo",
    });
    expect(guitarArranged.analysisRecordId).toBe(arranged.analysisRecordId);
    expect(guitarArranged.arrangementScore.arrangementFamilyId).toBe(
      arranged.arrangementScore.arrangementFamilyId
    );
    expect(guitarArranged.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ strategy: "separate-bass-realization", status: "selected" }),
        expect.objectContaining({
          strategy: "continuo-reduction",
          status: "rejected",
          rejectionReason: expect.stringMatching(/not sounded as bass/i),
        }),
      ])
    );
    expect(guitarArranged.arrangementScore).toMatchObject({
      preservationAudit: { status: "pass" },
      continuoDisposition: {
        kind: "separate_bass_realization",
        bassInstrumentId: "voice-bass",
        unsoundedFoundationEventIds: [],
      },
    });
    const guitarPreview = buildAudioPreview(guitarArranged.arrangementScore, omr.normalizedScore);
    expect(guitarPreview.parts).toEqual(
      expect.arrayContaining([
        {
          id: "continuo-foundation",
          label: "Continuo Foundation · voice-bass",
        },
        {
          id: "realization",
          label: "Generated realization · baroque-guitar-5",
        },
      ])
    );
    expect(
      guitarPreview.events
        .filter((event) => event.part === "continuo-foundation")
        .map((event) => event.midi)
    ).toEqual([50, 48, 43, 48]);

    const preview = buildAudioPreview(arranged.arrangementScore, omr.normalizedScore);
    expect(preview.parts).toEqual([
      { id: "full", label: "Full arrangement" },
      { id: "principal-voice", label: "Principal Voice" },
      { id: "continuo-foundation", label: "Continuo Foundation" },
      { id: "realization", label: "Generated realization" },
    ]);
    expect(preview.events.filter((event) => event.part === "principal-voice")).toHaveLength(5);
    expect(preview.events.filter((event) => event.part === "continuo-foundation")).toHaveLength(4);
    expect(preview.events.filter((event) => event.part === "realization")).toHaveLength(11);
    expect(
      preview.events
        .filter((event) => event.part === "realization")
        .every(
          (event) => event.transformationEntryIds.length > 0 && event.auditTargetIds.length > 0
        )
    ).toBe(true);

    const lilypond = continuoArrangementToLilyPond(arranged.arrangementScore, omr.normalizedScore);
    expect(lilypond).toContain('\\new Voice = "principalVoice"');
    expect(lilypond).toContain('\\new Voice = "continuoFoundation"');
    expect(lilypond).toContain('\\new Voice = "generatedRealization"');
    expect(lilypond).toContain("<4>2 <3>2");
    expect(lilypond).toContain("Continuo Realization · continuo.italian-baroque");
    const app = express();
    app.post(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/compile",
      createArrangementCompileRoute(store)
    );
    app.get(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/audio-preview",
      createArrangementPreviewRoute(store)
    );
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangements/${arranged.arrangementScore.id}/compile`,
      { method: "POST" }
    );
    const envelope = (await response.json()) as {
      ok: boolean;
      data: {
        errors: unknown[];
        pdf?: string;
        svg?: string;
        midi?: string;
        source: string;
        deliverables: Array<{ id: string; kind: string; arrangementScoreVersion: number }>;
      };
    };
    const guitarResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangements/${guitarArranged.arrangementScore.id}/compile`,
      { method: "POST" }
    );
    const guitarEnvelope = (await guitarResponse.json()) as {
      ok: boolean;
      data: { errors: unknown[]; pdf?: string; source: string };
    };
    const previewResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangements/${guitarArranged.arrangementScore.id}/audio-preview`
    );
    const previewEnvelope = (await previewResponse.json()) as {
      ok: boolean;
      data: { deliverable: { id: string; kind: string; arrangementScoreVersion: number } };
    };
    const repeatedCompileResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspace.id}/arrangements/${arranged.arrangementScore.id}/compile`,
      { method: "POST" }
    );
    const repeatedCompileEnvelope = (await repeatedCompileResponse.json()) as {
      data: { deliverables: Array<{ id: string }> };
    };
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    expect(response.status).toBe(200);
    expect(envelope.ok).toBe(true);
    const compiled = envelope.data;
    expect(compiled.source).toBe(lilypond);
    expect(envelope.data.deliverables.map((item) => item.kind).sort()).toEqual([
      "browser_preview",
      "lilypond",
      "midi",
      "pdf",
    ]);
    expect(envelope.data.deliverables.every((item) => item.arrangementScoreVersion === 1)).toBe(
      true
    );
    expect(repeatedCompileEnvelope.data.deliverables.map((item) => item.id)).toEqual(
      envelope.data.deliverables.map((item) => item.id)
    );
    expect(compiled.errors).toEqual([]);
    expect(compiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(compiled.svg?.length ?? 0).toBeGreaterThan(1_000);
    expect(compiled.midi?.length ?? 0).toBeGreaterThan(100);
    expect(midiNoteOns(Buffer.from(compiled.midi!, "base64"))).toHaveLength(
      arranged.arrangementScore.events.reduce(
        (total, event) => total + (event.type === "rest" ? 0 : event.pitches.length),
        0
      )
    );
    expect(guitarResponse.status).toBe(200);
    expect(guitarEnvelope.ok).toBe(true);
    expect(guitarEnvelope.data.errors).toEqual([]);
    expect(guitarEnvelope.data.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(guitarEnvelope.data.source).toContain(
      "Complete Continuo Realization · continuo.italian-baroque · baroque-guitar-5 with separate voice-bass"
    );
    expect(previewResponse.status).toBe(200);
    expect(previewEnvelope.data.deliverable).toMatchObject({
      kind: "audio_preview",
      arrangementScoreVersion: 1,
    });
    const family = store.getArrangementFamily(
      workspace.id,
      arranged.arrangementScore.arrangementFamilyId!
    );
    expect(family.arrangementScoreIds).toEqual([
      arranged.arrangementScore.id,
      guitarArranged.arrangementScore.id,
    ]);
    expect(store.get(workspace.id).deliverableIds).toHaveLength(9);
    const audioMetadata = store.getDeliverable(workspace.id, previewEnvelope.data.deliverable.id);
    expect(
      JSON.parse(store.readDeliverableContent(workspace.id, audioMetadata.id).toString())
    ).toMatchObject({
      mode: "literal",
    });
    expect(guitarEnvelope.data.source).toContain('instrumentName = "Separate bass (voice-bass)"');

    if (process.env.VELLUM_CAPTURE_FIXTURE_ARTIFACTS === "1") {
      const outputDirectory = path.resolve(process.cwd(), "tmp/pdfs");
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(
        path.join(outputDirectory, "continuo-realization.pdf"),
        Buffer.from(compiled.pdf!, "base64")
      );
      writeFileSync(path.join(outputDirectory, "continuo-realization.svg"), compiled.svg!, "utf8");
      writeFileSync(
        path.join(outputDirectory, "continuo-realization.midi"),
        Buffer.from(compiled.midi!, "base64")
      );
      writeFileSync(path.join(outputDirectory, "continuo-realization.ly"), lilypond, "utf8");
    }

    expect(store.get(workspace.id)).toMatchObject({
      sourceArtifactIds: [source.id],
      omrRunIds: [omr.omrRun.id],
      scoreTranscriptionIds: [omr.scoreTranscription.id],
      normalizedScoreIds: [omr.normalizedScore.id],
      analysisRecordIds: [arranged.analysisRecordId],
      arrangementScoreIds: [arranged.arrangementScore.id, guitarArranged.arrangementScore.id],
    });
  }, 90_000);
});
