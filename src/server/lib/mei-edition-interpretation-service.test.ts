import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  CreateTablatureInterpretationCommand,
  DiplomaticToken,
} from "../../lib/mei-edition-domain.js";
import { FRENCH_TAB_MEI_FIXTURE } from "../../lib/mei-edition-fixtures.js";
import { MeiEditionInterpretationService } from "./mei-edition-interpretation-service.js";
import { MeiEditionInterpretationStore } from "./mei-edition-interpretation-store.js";
import { MeiEditionService } from "./mei-edition-service.js";
import { MeiEditionStore } from "./mei-edition-store.js";
import { WorkspaceStore } from "./workspace-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function harness() {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-mei-interpretation-"));
  roots.push(root);
  let sequence = 0;
  const createId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const now = () => new Date(`2026-07-17T20:00:${String(sequence).padStart(2, "0")}.000Z`);
  const workspaces = new WorkspaceStore({ rootDirectory: root, createId, now });
  const workspace = workspaces.create({ title: "Interpretation test" });
  const source = workspaces.addSourceArtifact(workspace.id, {
    filename: "facsimile.pdf",
    mimeType: "application/pdf",
    contentBase64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"),
    provenance: { license: "project-authored test fixture" },
  });
  const tokenIds = [
    "rhythm-1",
    "note-1",
    "note-2",
    "note-3",
    "rhythm-2",
    "note-4",
    "rhythm-3",
    "note-5",
    "note-6",
  ];
  const tokens: DiplomaticToken[] = tokenIds.map((id, index) => ({
    id,
    kind: id.startsWith("rhythm") ? "rhythm" : "tablature",
    region: { page: 1, x: 0.02 + index * 0.08, y: 0.1, width: 0.04, height: 0.06 },
    confidence: 0.95,
    alternatives: [],
    critical: false,
  }));
  const editions = new MeiEditionStore({ rootDirectory: root, workspaces });
  const transcription = new MeiEditionService({ store: editions, createId, now });
  const edition = transcription.create(workspace.id, {
    sourceArtifactId: source.id,
    sourcePage: 1,
    title: "Project-authored Sarabande",
    mei: FRENCH_TAB_MEI_FIXTURE,
    tokens,
    extraction: {
      backendId: "fixture",
      backendVersion: "1",
      diagnostics: ["No facsimile uncertainty in this fixture"],
    },
  });
  const service = new MeiEditionInterpretationService({
    editions,
    records: new MeiEditionInterpretationStore({ rootDirectory: root, editions }),
    createId,
    now,
  });
  const command: CreateTablatureInterpretationCommand = {
    expectedEditionVersion: 1,
    tempo: 60,
    courseTunings: [
      { course: 1, openMidis: [64] },
      { course: 2, openMidis: [59] },
      { course: 3, openMidis: [55] },
      { course: 4, openMidis: [50] },
      { course: 5, openMidis: [45, 57] },
    ],
    repeat: { startMeasure: 1, endMeasure: 1, totalPasses: 2 },
    rationale: "Provisional French five-course tuning with octave-strung fifth course.",
  };
  return { service, transcription, workspaceId: workspace.id, edition, command };
}

describe("versioned tablature interpretation and acceptance", () => {
  it("derives pitch, timing, repeats, and provisional authority from one exact interpretation", () => {
    const { service, workspaceId, edition, command } = harness();
    const interpretation = service.createInterpretation(workspaceId, edition.editionId, command);
    const preview = service.playback(workspaceId, edition.editionId, interpretation.id);

    expect(preview.authority).toBe("provisional_audition");
    expect(preview.permits).toEqual(["literal_playback"]);
    expect(preview.durationSeconds).toBe(6);
    expect(preview.measureOccurrences).toHaveLength(2);
    expect(
      preview.events
        .filter((event) => event.meiId === "note-3" && event.iteration === 1)
        .map((event) => event.midi)
    ).toEqual([47, 59]);
    expect(preview.events.find((event) => event.meiId === "note-4")?.startSeconds).toBe(1.5);
  });

  it("keeps exact transcription and interpretation decisions separate, immutable, and stale-aware", () => {
    const { service, transcription, workspaceId, edition, command } = harness();
    const first = service.createInterpretation(workspaceId, edition.editionId, command);
    expect(() =>
      service.decide(workspaceId, edition.editionId, {
        expectedEditionVersion: 1,
        scope: "interpretation",
        interpretationId: first.id,
        decision: "accepted",
        purposes: ["literal_playback", "analysis"],
        evidence: "Fixture interpretation reviewed.",
      })
    ).toThrowError(/Accept the exact transcription/);

    service.decide(workspaceId, edition.editionId, {
      expectedEditionVersion: 1,
      scope: "transcription",
      decision: "accepted",
      purposes: ["reading_edition"],
      evidence: "Whole fixture compared with its project-authored source.",
    });
    const accepted = service.decide(workspaceId, edition.editionId, {
      expectedEditionVersion: 1,
      scope: "interpretation",
      interpretationId: first.id,
      decision: "accepted",
      purposes: ["literal_playback", "analysis"],
      evidence: "Tuning and repeat realization reviewed.",
    });
    const alternative = service.createInterpretation(workspaceId, edition.editionId, {
      ...command,
      tempo: 72,
      rationale: "Viable faster alternative retained independently.",
    });
    service.decide(workspaceId, edition.editionId, {
      expectedEditionVersion: 1,
      scope: "interpretation",
      interpretationId: alternative.id,
      decision: "rejected",
      purposes: [],
      evidence: "Too quick for this reading; the record remains inspectable.",
    });

    const state = service.state(workspaceId, edition.editionId);
    expect(state.interpretations).toHaveLength(2);
    expect(state.decisions).toHaveLength(3);
    expect(service.playback(workspaceId, edition.editionId, first.id)).toMatchObject({
      authority: "accepted_interpretation",
      permits: ["literal_playback", "analysis"],
    });
    expect(accepted.interpretationVersion).toBe(first.version);
    expect(() =>
      service.decide(workspaceId, edition.editionId, {
        expectedEditionVersion: 1,
        scope: "interpretation",
        interpretationId: first.id,
        decision: "rejected",
        purposes: [],
        evidence: "A contradictory successor must name its exact prior decision.",
      })
    ).toThrowError(/Decision parent is stale/);

    service.createInterpretation(workspaceId, edition.editionId, {
      ...command,
      parentInterpretationId: first.id,
      tempo: 66,
      rationale: "Explicit revision of the accepted interpretation.",
    });
    expect(
      service
        .state(workspaceId, edition.editionId)
        .interpretationStatuses.find((status) => status.interpretationId === first.id)
    ).toMatchObject({ stale: true, staleDecisionIds: [accepted.id] });
    expect(service.playback(workspaceId, edition.editionId, first.id).authority).toBe(
      "provisional_audition"
    );

    transcription.commit(workspaceId, edition.editionId, {
      id: "correction-batch.00000000-0000-4000-8000-000000000099",
      name: "Successor transcription",
      expectedVersion: 1,
      layer: "transcription",
      changes: [
        {
          tokenId: "note-1",
          attribute: "tab.fret",
          expectedValue: "1",
          replacementValue: "2",
          rationale: "Exercise exact-version staleness.",
        },
      ],
    });
    const stale = service.state(workspaceId, edition.editionId);
    expect(stale.transcription.accepted).toBe(false);
    expect(stale.transcription.staleDecisionIds).toHaveLength(1);
    expect(() => service.playback(workspaceId, edition.editionId, first.id)).toThrowError(
      /stale transcription/
    );
  });
});
