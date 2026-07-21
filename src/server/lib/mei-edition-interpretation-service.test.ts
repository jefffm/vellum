import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { JSDOM } from "jsdom";
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

function harness(options: { mei?: string; tokenIds?: string[] } = {}) {
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
  const tokenIds = options.tokenIds ?? [
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
    kind: id.startsWith("rhythm")
      ? "rhythm"
      : id.startsWith("strum") && !id.includes("-note")
        ? "strum"
        : "tablature",
    region: { page: 1, x: 0.02 + index * 0.08, y: 0.1, width: 0.04, height: 0.06 },
    confidence: 0.95,
    alternatives: [],
    critical: false,
  }));
  const editions = new MeiEditionStore({ rootDirectory: root, workspaces });
  const transcription = new MeiEditionService({ store: editions, createId, now });
  const mei = linkFixtureTokensToFacsimile(options.mei ?? FRENCH_TAB_MEI_FIXTURE, tokens);
  const edition = transcription.create(workspace.id, {
    sourceArtifactId: source.id,
    sourcePage: 1,
    title: "Project-authored Sarabande",
    mei,
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
    repeatSections: [{ startMeasure: 1, endMeasure: 1, totalPasses: 2 }],
    strumRealizations: [],
    rationale: "Provisional French five-course tuning with octave-strung fifth course.",
  };
  return { service, transcription, workspaceId: workspace.id, edition, command };
}

function linkFixtureTokensToFacsimile(mei: string, tokens: readonly DiplomaticToken[]): string {
  const dom = new JSDOM(mei, { contentType: "application/xml" });
  try {
    const document = dom.window.document;
    const namespace = "http://www.music-encoding.org/ns/mei";
    const music = document.querySelector("music")!;
    let facsimile = document.querySelector("facsimile");
    if (!facsimile) {
      facsimile = document.createElementNS(namespace, "facsimile");
      music.insertBefore(facsimile, music.firstChild);
    }
    let surface = facsimile.querySelector("surface");
    if (!surface) {
      surface = document.createElementNS(namespace, "surface");
      facsimile.append(surface);
    }
    for (const [index, token] of tokens.entries()) {
      const zoneId = `zone-${token.id}`;
      if (
        !Array.from(document.querySelectorAll("zone")).some((zone) => zoneId === zoneIdOf(zone))
      ) {
        const zone = document.createElementNS(namespace, "zone");
        zone.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:id", zoneId);
        zone.setAttribute("ulx", String(200 + index * 800));
        zone.setAttribute("uly", "1000");
        zone.setAttribute("lrx", String(600 + index * 800));
        zone.setAttribute("lry", "1600");
        surface.append(zone);
      }
      const element = Array.from(document.getElementsByTagName("*")).find(
        (candidate) =>
          candidate.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") === token.id ||
          candidate.getAttribute("xml:id") === token.id
      );
      element?.setAttribute("facs", `#${zoneId}`);
    }
    return new dom.window.XMLSerializer().serializeToString(document);
  } finally {
    dom.window.close();
  }
}

function zoneIdOf(zone: Element): string | null {
  return (
    zone.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") ?? zone.getAttribute("xml:id")
  );
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

  it("repeats two pickup-led strains and requires exact strum realizations", () => {
    const mei = `<?xml version="1.0"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title>Two strains</title></titleStmt><pubStmt/></fileDesc></meiHead><music><body><mdiv><score><scoreDef meter.count="3" meter.unit="4"><staffGrp><staffDef n="1" lines="5" notationtype="tab.lute.french"/></staffGrp></scoreDef><section><measure xml:id="pickup-a" n="0" metcon="false" type="section-pickup"><staff n="1"><layer n="1"><tabGrp xml:id="pickup-a-group" dur="8"><note xml:id="pickup-a-note-1" tab.course="1" tab.fret="1"/><note xml:id="pickup-a-note-2" tab.course="3" tab.fret="2"/></tabGrp></layer></staff></measure><measure xml:id="measure-1" n="1"><staff n="1"><layer n="1"><tabGrp xml:id="strum-held" dur="2" dots="1" type="historical-strum-up chord-held"/></layer></staff></measure><measure xml:id="closing-a" n="1b" metcon="false" type="section-closing" right="rptend"><staff n="1"><layer n="1"><tabGrp xml:id="closing-a-group" dur="4"><note xml:id="closing-a-note" tab.course="1" tab.fret="1"/></tabGrp></layer></staff></measure><measure xml:id="pickup-b" n="1a" metcon="false" type="section-pickup"><staff n="1"><layer n="1"><tabGrp xml:id="pickup-b-group" dur="8"><note xml:id="pickup-b-note" tab.course="1" tab.fret="2"/></tabGrp></layer></staff></measure><measure xml:id="measure-2" n="2" right="rptend"><staff n="1"><layer n="1"><tabGrp xml:id="strum-explicit" dur="2" dots="1" type="historical-strum-down chord-explicit"><note xml:id="strum-explicit-note-1" tab.course="1" tab.fret="2"/><note xml:id="strum-explicit-note-2" tab.course="3" tab.fret="2"/></tabGrp></layer></staff></measure></section></score></mdiv></body></music></mei>`;
    const { service, transcription, workspaceId, edition, command } = harness({
      mei,
      tokenIds: [
        "pickup-a-note-1",
        "pickup-a-note-2",
        "strum-held",
        "closing-a-note",
        "pickup-b-note",
        "strum-explicit",
        "strum-explicit-note-1",
        "strum-explicit-note-2",
      ],
    });
    const exact = {
      ...command,
      repeatSections: [
        {
          startMeasure: 1,
          endMeasure: 1,
          totalPasses: 2,
          pickupMeasureId: "pickup-a",
          closingMeasureId: "closing-a",
        },
        {
          startMeasure: 2,
          endMeasure: 2,
          totalPasses: 1,
          pickupMeasureId: "pickup-b",
          petiteReprise: {
            startEventId: "strum-explicit",
            endEventId: "strum-explicit",
            totalPasses: 2,
          },
        },
      ],
      strumRealizations: [
        {
          strumId: "strum-held",
          notes: [
            { course: 1, fret: 1 },
            { course: 3, fret: 2 },
          ],
          spreadMilliseconds: 40,
        },
        {
          strumId: "strum-explicit",
          notes: [
            { course: 1, fret: 2 },
            { course: 3, fret: 2 },
          ],
          spreadMilliseconds: 40,
        },
      ],
    } satisfies CreateTablatureInterpretationCommand;

    expect(() =>
      service.createInterpretation(workspaceId, edition.editionId, {
        ...exact,
        strumRealizations: exact.strumRealizations.slice(0, 1),
      })
    ).toThrowError(/explicitly realize every historical strum/);
    expect(() =>
      service.createInterpretation(workspaceId, edition.editionId, {
        ...exact,
        strumRealizations: exact.strumRealizations.map((realization) =>
          realization.strumId === "strum-explicit"
            ? { ...realization, notes: [{ course: 1, fret: 1 }] }
            : realization
        ),
      })
    ).toThrowError(/disagrees with source-written chord/);

    const correctedDirection = transcription.preview(workspaceId, edition.editionId, {
      id: "correction-batch.00000000-0000-4000-8000-000000000088",
      name: "Correct source strum direction",
      expectedVersion: 1,
      layer: "transcription",
      changes: [
        {
          tokenId: "strum-held",
          attribute: "strum.direction",
          expectedValue: "up",
          replacementValue: "down",
          rationale: "The source-linked stem points down.",
        },
      ],
    });
    expect(correctedDirection.mei).toContain('type="historical-strum-down chord-held"');

    const interpretation = service.createInterpretation(workspaceId, edition.editionId, exact);
    const preview = service.playback(workspaceId, edition.editionId, interpretation.id);
    expect(preview.measureOccurrences).toHaveLength(9);
    expect(preview.durationSeconds).toBe(15.5);
    expect(preview.events.filter((event) => event.meiId === "closing-a-note")).toHaveLength(2);
    const held = preview.events.filter(
      (event) => event.meiId === "strum-held" && event.iteration === 1
    );
    expect(held.map((event) => event.course)).toEqual([1, 3]);
    expect(held[1]!.startSeconds - held[0]!.startSeconds).toBeCloseTo(0.04);
    const explicit = preview.events.filter(
      (event) => event.meiId === "strum-explicit" && event.iteration === 1
    );
    expect(explicit.map((event) => event.course)).toEqual([3, 1]);
  });
});
