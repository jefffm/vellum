import express from "express";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildAudioPreview } from "../../src/lib/audio-preview.js";
import { imitativeArrangementToLilyPond } from "../../src/lib/imitative-engrave.js";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { createArrangementCompileRoute } from "../../src/server/lib/arrangement-deliverable-route.js";
import { SubprocessRunner } from "../../src/server/lib/subprocess.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { OmrService } from "../../src/server/lib/omr.js";
import type { OmrBackend } from "../../src/server/lib/omr.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";
import { midiNoteOns } from "../lib/midi.js";

describe("three-voice imitative counterpoint tracer", () => {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-imitation-e2e-"));

  afterAll(() => rmSync(rootDirectory, { recursive: true, force: true }));

  it("preserves ordered entries and voice lineages in a Renaissance-lute intabulation", async () => {
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Three-Voice Imitative Passage",
      brief: {
        targetConfigurations: [
          {
            id: "target.renaissance-lute",
            instrumentId: "renaissance-lute-6",
            role: "solo",
            tuningId: "renaissance-g",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
        ],
      },
    });
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/imitation/imitative-passage.pdf")
    );
    const source = store.addSourceArtifact(workspace.id, {
      filename: "imitative-passage.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: {
        license: "CC0 1.0 Universal / Public Domain Dedication",
        attribution: "Vellum project fixture",
      },
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/imitation/imitative-passage.ly"),
        "utf8"
      ),
      ["VoiceOne", "VoiceTwo", "VoiceThree"]
    );
    const backend: OmrBackend = {
      id: "reviewed-imitation-fixture",
      recognize: async () => ({
        backend: { id: "reviewed-imitation-fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: { ...parsed, uncertainties: [] },
      }),
    };

    const omr = await new OmrService({ store }).recognize(workspace.id, source.id, backend);
    const arranged = new ArrangementService({ store }).createFaithfulReduction(workspace.id, {
      normalizedScoreId: omr.normalizedScore.id,
      targetConfigurationId: "target.renaissance-lute",
    });
    expect(arranged.candidates).toHaveLength(2);
    expect(arranged.arrangementPlan).toMatchObject({
      kind: "imitative_intabulation",
      specialistIntent: {
        kind: "imitative_intabulation",
        candidateStrategies: ["low-fret-polyphony", "voice-continuity"],
      },
    });
    expect(
      arranged.arrangementPlan.decisions.find(
        (decision) => decision.dimension === "imitative_voice_distribution"
      )
    ).toMatchObject({
      alternatives: [
        expect.objectContaining({ value: "low_fret_polyphony", viable: true }),
        expect.objectContaining({ value: "voice_continuity", viable: true }),
      ],
      confirmation: { requirement: "not_required", status: "not_required" },
    });
    expect(arranged.candidates[0]!.events).not.toEqual(arranged.candidates[1]!.events);
    expect(arranged.arrangementScore).toMatchObject({
      targetConfiguration: { instrumentId: "renaissance-lute-6" },
      preservationAudit: { status: "pass" },
    });
    expect(arranged.arrangementScore.preservationAudit.findings).toContainEqual(
      expect.objectContaining({ code: "imitation.ordered_entries_preserved" })
    );

    const preview = buildAudioPreview(arranged.arrangementScore, omr.normalizedScore);
    expect(preview.parts).toEqual([
      { id: "full", label: "Full arrangement" },
      { id: "voice:part.voiceone", label: "VoiceOne" },
      { id: "voice:part.voicetwo", label: "VoiceTwo" },
      { id: "voice:part.voicethree", label: "VoiceThree" },
    ]);
    for (const part of omr.normalizedScore.parts) {
      expect(preview.events.some((event) => event.part === `voice:${part.id}`)).toBe(true);
    }
    expect(preview.events.every((event) => event.auditTargetIds.length > 0)).toBe(true);
    expect(new Set(preview.events.map((event) => event.occurrenceId)).size).toBe(
      preview.events.length
    );

    const lilypond = imitativeArrangementToLilyPond(arranged.arrangementScore, omr.normalizedScore);
    expect(lilypond).toContain('\\include "instruments/renaissance-lute-6.ily"');
    expect(lilypond).toContain('\\new TabVoice = "lineage1"');
    expect(lilypond).toContain('\\new TabVoice = "lineage2"');
    expect(lilypond).toContain('\\new TabVoice = "lineage3"');
    expect(lilypond).toContain("\\new RhythmicStaff");
    expect(lilypond).toContain('\\remove "Note_performer"');
    expect(lilypond).toContain("tablatureFormat = \\renaissanceLuteTabFormat");

    const app = express();
    app.post(
      "/api/workspaces/:workspaceId/arrangements/:arrangementId/compile",
      createArrangementCompileRoute(store, new SubprocessRunner(60_000))
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
      data: { errors: unknown[]; pdf?: string; svg?: string; midi?: string; source: string };
    };
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    expect(response.status).toBe(200);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.errors).toEqual([]);
    expect(envelope.data.source).toBe(lilypond);
    expect(envelope.data.pdf?.length ?? 0).toBeGreaterThan(1_000);
    expect(envelope.data.midi?.length ?? 0).toBeGreaterThan(100);
    expect(midiNoteOns(Buffer.from(envelope.data.midi!, "base64"))).toHaveLength(
      arranged.arrangementScore.events.filter((event) => event.type === "note").length
    );

    if (process.env.VELLUM_CAPTURE_FIXTURE_ARTIFACTS === "1") {
      const outputDirectory = path.resolve(process.cwd(), "tmp/pdfs");
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(
        path.join(outputDirectory, "imitative-renaissance-lute.pdf"),
        Buffer.from(envelope.data.pdf!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "imitative-renaissance-lute.svg"),
        envelope.data.svg!,
        "utf8"
      );
      writeFileSync(
        path.join(outputDirectory, "imitative-renaissance-lute.midi"),
        Buffer.from(envelope.data.midi!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "imitative-renaissance-lute.ly"),
        envelope.data.source,
        "utf8"
      );
    }

    expect(store.get(workspace.id)).toMatchObject({
      sourceArtifactIds: [source.id],
      analysisRecordIds: [arranged.analysisRecordId],
      arrangementScoreIds: [arranged.arrangementScore.id],
    });
  }, 90_000);
});
