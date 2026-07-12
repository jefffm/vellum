import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { normalizeAudiverisMusicXml, normalizeMusicXml } from "./musicxml-normalizer.js";

describe("MusicXML normalizer", () => {
  it("normalizes a score into stable parts, measures, and rational events", async () => {
    const source = readFileSync(path.resolve(process.cwd(), "test/fixtures/hymn-simple.xml"));
    const score = await normalizeMusicXml(source, "hymn-simple.xml");

    expect(score.parts.length).toBeGreaterThan(0);
    expect(score.measures.length).toBeGreaterThan(0);
    expect(score.events.length).toBeGreaterThan(0);
    expect(score.events[0]).toMatchObject({
      id: expect.stringMatching(/^event\./),
      partId: expect.stringMatching(/^part\./),
      measureId: "measure.0",
      onset: { numerator: 0, denominator: 1 },
    });
    expect(score.events.every((event) => event.duration.denominator > 0)).toBe(true);
  });

  it("rejects non-MusicXML input with a structured error", async () => {
    await expect(normalizeMusicXml(Buffer.from("not xml"), "bad.xml")).rejects.toThrow(
      /normalization failed/i
    );
  });

  it("preserves Figured Bass tokens and identifies the Continuo Foundation", async () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/continuo/continuo-fragment.musicxml")
    );
    const score = await normalizeMusicXml(source, "continuo-fragment.musicxml");

    expect(score.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Soprano", role: "soprano" }),
        expect.objectContaining({ name: "Basso Continuo", role: "continuo_foundation" }),
      ])
    );
    expect(score.events).toContainEqual(
      expect.objectContaining({
        type: "figured_bass",
        bassEventId: "event.p2-voice-1.1",
        figures: [{ interval: 6 }],
        duration: { numerator: 4, denominator: 1 },
      })
    );
  });

  it("preserves tuplets, double dots, ties, repeats, endings, and performed occurrences", async () => {
    const source = Buffer.from(`<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1"><attributes><divisions>12</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <barline location="left"><repeat direction="forward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification><notations><tuplet type="start"/></notations></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification><notations><tuplet type="stop"/></notations></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>42</duration><voice>1</voice><type>half</type><dot/><dot/><tie type="start"/></note>
    </measure>
    <measure number="2"><barline location="left"><ending number="1" type="start"/></barline>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice><type>eighth</type><tie type="stop"/></note>
      <barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>
    </measure>
    <measure number="3"><barline location="left"><ending number="2" type="start"/></barline>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>12</duration><voice>1</voice><type>quarter</type></note>
      <barline location="right"><ending number="2" type="discontinue"/></barline>
    </measure>
  </part>
</score-partwise>`);

    const score = await normalizeMusicXml(source, "rhythm.musicxml");
    const notes = score.events.filter((event) => event.type === "note");
    expect(notes.slice(0, 3).map((event) => event.rhythmicNotation?.tuplet?.boundary)).toEqual([
      "start",
      "continue",
      "stop",
    ]);
    expect(notes[3]).toMatchObject({
      duration: { numerator: 7, denominator: 2 },
      tie: "start",
      rhythmicNotation: { writtenDuration: { numerator: 7, denominator: 2 }, dots: 2 },
    });
    expect(score.performedForm?.measureOccurrences.map((item) => item.measureId)).toEqual([
      "measure.0",
      "measure.1",
      "measure.0",
      "measure.2",
    ]);
    expect(score.performedForm?.measureOccurrences[1]).toMatchObject({ ending: 1 });
    expect(score.performedForm?.measureOccurrences[3]).toMatchObject({ ending: 2 });
  });

  it("reports unsupported notation at precise source scope", async () => {
    const source = Buffer.from(`<?xml version="1.0"?><score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
      <part id="P1"><measure number="1"><note><grace/><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note></measure></part>
    </score-partwise>`);
    const score = await normalizeMusicXml(source, "unsupported.musicxml");
    expect(score.notationIssues).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "unsupported_grace_note",
        measureIds: ["measure.0"],
      }),
    ]);
  });

  it("derives da-capo navigation and Fine into performed form", async () => {
    const measure = (number: number, direction = "") => `<measure number="${number}">${direction}
      <note><pitch><step>${number === 1 ? "C" : number === 2 ? "D" : "E"}</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note></measure>`;
    const source = Buffer.from(`<?xml version="1.0"?><score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list><part id="P1">
      ${measure(1)}${measure(2, '<direction><sound fine="yes"/></direction>')}${measure(3, '<direction><sound dacapo="yes"/></direction>')}
      </part></score-partwise>`);
    const score = await normalizeMusicXml(source, "dacapo.musicxml");
    expect(score.performedForm?.measureOccurrences.map((item) => item.measureId)).toEqual([
      "measure.0",
      "measure.1",
      "measure.2",
      "measure.0",
      "measure.1",
    ]);
    expect(score.performedForm?.measureOccurrences.at(-1)).toMatchObject({ jump: "fine" });
    expect(score.performedForm?.traversalDecisions).toContain("Da capo after measure 3.");
  });

  it("correlates genuine Audiveris native chord/head evidence to reviewable score events", async () => {
    const musicXml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Soprano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key><time><beats>2</beats><beat-type>4</beat-type></time></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
    <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
  </measure></part>
</score-partwise>`);
    const nativeXml = `<?xml version="1.0" encoding="UTF-8"?>
<sheet><systems><system id="1">
  <part id="1"><measure id="1"><head-chords>100 101</head-chords><voice id="1"><slots>
    <entry><key>1</key><value chord="100" status="BEGIN"/></entry>
    <entry><key>2</key><value chord="101" status="BEGIN"/></entry>
  </slots></voice></measure></part>
  <sig><inters>
    <head pitch="0" shape="NOTEHEAD_BLACK" grade="0.420" ctx-grade="0.550" staff="1" id="10"><bounds x="120" y="150" w="24" h="28"/></head>
    <head pitch="-1" shape="NOTEHEAD_BLACK" grade="0.950" ctx-grade="0.970" staff="1" id="11"><bounds x="180" y="142" w="24" h="28"/></head>
    <head-chord grade="0.700" ctx-grade="0.800" staff="1" id="100"><bounds x="118" y="148" w="28" h="32"/></head-chord>
    <head-chord grade="0.960" ctx-grade="0.980" staff="1" id="101"><bounds x="178" y="140" w="28" h="32"/></head-chord>
  </inters><relations>
    <relation source="100" target="10"><containment/></relation>
    <relation source="101" target="11"><containment/></relation>
  </relations></sig>
</system></systems></sheet>`;
    const zip = new JSZip();
    zip.file("book.xml", '<book><stub number="1"/></book>');
    zip.file("sheet#1/sheet#1.xml", nativeXml);
    const nativeOmr = await zip.generateAsync({ type: "nodebuffer" });

    const result = await normalizeAudiverisMusicXml(musicXml, "recognized.musicxml", nativeOmr);

    expect(result.pageMappings).toEqual([{ sourcePage: 1, recognizedPage: 1 }]);
    expect(result.recognizedScore.events[0]).toMatchObject({
      id: "event.p1-voice-1.1",
      pitch: "C4",
      confidence: 0.42,
      sourceRegion: {
        coordinateSpace: "omr_raster",
        page: 1,
        x: 120,
        y: 150,
        width: 24,
        height: 28,
      },
    });
    expect(result.recognizedScore.events[1]).toMatchObject({
      pitch: "D4",
      confidence: 0.95,
      sourceRegion: {
        coordinateSpace: "omr_raster",
        page: 1,
        x: 180,
        y: 142,
        width: 24,
        height: 28,
      },
    });
    expect(result.recognizedScore.uncertainties).toEqual([
      expect.objectContaining({
        id: "uncertainty.p1-voice-1.1",
        eventIds: ["event.p1-voice-1.1"],
        critical: false,
        category: "pitch_recognition",
        region: {
          coordinateSpace: "omr_raster",
          page: 1,
          x: 120,
          y: 150,
          width: 24,
          height: 28,
        },
      }),
    ]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "audiveris.native-evidence" })
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "audiveris.evidence-mismatch" })
    );
  });

  it("blocks suspicious SATB-to-chord flattening with ranked voice corrections", async () => {
    const notes = [
      ["G", 4],
      ["E", 4],
      ["C", 4],
      ["C", 3],
      ["A", 4],
      ["F", 4],
      ["D", 4],
      ["B", 2],
    ] as const;
    const musicXml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Choir</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes>
${notes
  .map(
    ([step, octave], index) =>
      `<note>${index % 4 ? "<chord/>" : ""}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>1</voice></note>`
  )
  .join("\n")}
</measure></part></score-partwise>`);
    const heads = notes
      .map(
        (_note, index) =>
          `<head pitch="${index}" grade="0.95" id="${10 + index}"><bounds x="${100 + index * 5}" y="${100 + index * 5}" w="12" h="12"/></head>`
      )
      .join("");
    const relations = notes
      .map(
        (_note, index) =>
          `<relation source="${index < 4 ? 100 : 101}" target="${10 + index}"><containment/></relation>`
      )
      .join("");
    const nativeXml = `<sheet><systems><system id="1"><part id="1"><measure id="1"><voice id="1"><slots>
<entry><value chord="100" status="BEGIN"/></entry><entry><value chord="101" status="BEGIN"/></entry>
</slots></voice></measure></part><sig><inters>${heads}<head-chord grade="0.95" id="100"/><head-chord grade="0.95" id="101"/></inters><relations>${relations}</relations></sig></system></systems></sheet>`;
    const zip = new JSZip();
    zip.file("book.xml", '<book><stub number="1"/></book>');
    zip.file("sheet#1/sheet#1.xml", nativeXml);
    const nativeOmr = await zip.generateAsync({ type: "nodebuffer" });

    const result = await normalizeAudiverisMusicXml(musicXml, "flattened.musicxml", nativeOmr);
    expect(result.recognizedScore.parts).toHaveLength(1);
    expect(result.recognizedScore.uncertainties).toContainEqual(
      expect.objectContaining({
        id: "uncertainty.polyphonic-voice-identity",
        category: "voice_identity",
        critical: true,
        eventIds: expect.arrayContaining(["event.p1-voice-1.1", "event.p1-voice-1.8"]),
        alternatives: [
          expect.stringMatching(/soprano, alto, tenor, and bass/i),
          expect.stringMatching(/block chords/i),
        ],
      })
    );
  });
});
