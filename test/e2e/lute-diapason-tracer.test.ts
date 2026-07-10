import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { EngraveParams } from "../../src/lib/engrave-schema.js";
import { compileLilyPond } from "../../src/server/lib/compile-route.js";
import { engrave } from "../../src/server/lib/engrave.js";
import { SubprocessRunner } from "../../src/server/lib/subprocess.js";

let lilypondAvailable = false;

beforeAll(() => {
  try {
    execFileSync("lilypond", ["--version"], { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }
});

describe("13-course lute diapason engraving tracer", () => {
  it("renders course 10 as ///a below the staff and sounds one D2", async () => {
    if (!lilypondAvailable) return;
    const params = diapasonSequence("d_minor");
    const engraved = engrave(params);
    expect(engraved.source).toContain("d,1 \\10");
    expect(engraved.source).toContain(
      "additionalBassStrings = \\stringTuning <a,, bes,, c, d, ees, f, g,>"
    );
    const compiled = await compileLilyPond(
      { source: engraved.source, format: "both" },
      new SubprocessRunner(60_000),
      60_000
    );
    expect(compiled.errors).toEqual([]);
    expect(compiled.svg).toContain("///a");
    const noteOns = midiNoteOns(Buffer.from(compiled.midi!, "base64"));
    expect(noteOns.filter((note) => note === 38)).toHaveLength(1);

    if (process.env.VELLUM_CAPTURE_FIXTURE_ARTIFACTS === "1") {
      const outputDirectory = path.resolve(process.cwd(), "tmp/pdfs");
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(
        path.join(outputDirectory, "baroque-lute-course-10.pdf"),
        Buffer.from(compiled.pdf!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "baroque-lute-course-10.svg"),
        compiled.svg!,
        "utf8"
      );
      writeFileSync(
        path.join(outputDirectory, "baroque-lute-course-10.midi"),
        Buffer.from(compiled.midi!, "base64")
      );
      writeFileSync(
        path.join(outputDirectory, "baroque-lute-course-10.ly"),
        engraved.source,
        "utf8"
      );
    }
  }, 90_000);

  it("keeps the course-10 sign and pitch under the D-major bass tuning", async () => {
    if (!lilypondAvailable) return;
    const engraved = engrave(diapasonSequence("d_major"));
    expect(engraved.source).toContain(
      "additionalBassStrings = \\stringTuning <a,, b,, cis, d, e, fis, g,>"
    );
    const compiled = await compileLilyPond(
      { source: engraved.source, format: "both" },
      new SubprocessRunner(60_000),
      60_000
    );
    expect(compiled.errors).toEqual([]);
    expect(compiled.svg).toContain("///a");
    expect(
      midiNoteOns(Buffer.from(compiled.midi!, "base64")).filter((note) => note === 38)
    ).toHaveLength(1);
  }, 90_000);

  it("renders the historical signs for courses 7 through 13 without duplicate playback", async () => {
    if (!lilypondAvailable) return;
    const engraved = engrave({
      ...diapasonSequence("d_minor"),
      title: "13-Course Diapason Signs",
      bars: Array.from({ length: 7 }, (_, index) => ({
        events: [
          {
            type: "note" as const,
            input: "position" as const,
            course: index + 7,
            fret: 0,
            duration: "1",
          },
        ],
      })),
    });
    const compiled = await compileLilyPond(
      { source: engraved.source, format: "both" },
      new SubprocessRunner(60_000),
      60_000
    );
    expect(compiled.errors).toEqual([]);
    for (const sign of ["a", "/a", "//a", "///a", "4", "/4", "//4"]) {
      expect(compiled.svg).toContain(`>${sign}<`);
    }
    expect(midiNoteOns(Buffer.from(compiled.midi!, "base64")).sort((a, b) => a - b)).toEqual([
      33, 34, 36, 38, 39, 41, 43,
    ]);
  }, 90_000);
});

function diapasonSequence(diapasonScheme: string): EngraveParams {
  return {
    instrument: "baroque-lute-13",
    template: "french-tab",
    title: "Course 10 Diapason",
    time: "4/4",
    tempo: 60,
    diapason_scheme: diapasonScheme,
    bars: [
      {
        events: [{ type: "note", input: "position", course: 10, fret: 0, duration: "1" }],
      },
    ],
  };
}

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
        const metaLength = readVariableLength(midi, metaLengthStart).value;
        offset += metaLength;
      } else if (status === 0xf0 || status === 0xf7) {
        const sysexLengthStart = offset;
        offset = skipVariableLength(midi, offset);
        offset += readVariableLength(midi, sysexLengthStart).value;
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

function readVariableLength(buffer: Buffer, offset: number): { value: number; next: number } {
  let value = 0;
  let byte = 0;
  do {
    byte = buffer[offset++]!;
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return { value, next: offset };
}
