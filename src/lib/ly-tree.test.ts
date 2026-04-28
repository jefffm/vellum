import { describe, expect, it } from "vitest";
import {
  type LyContainer,
  type LyFile,
  lyChord,
  lyContainer,
  lyLyrics,
  lyNote,
  lyRest,
  lyRhythmicStaff,
  lyScore,
  lyStaff,
  lyTabStaff,
  lyVoice,
  serializeFile,
} from "./ly-tree.js";

describe("ly-tree helpers", () => {
  it("creates a note leaf", () => {
    const note = lyNote("c'", "4");
    expect(note).toEqual({ type: "note", pitch: "c'", duration: "4", indicators: [] });
  });

  it("creates a chord leaf", () => {
    const chord = lyChord(["c'", "e'", "g'"], "2");
    expect(chord).toEqual({
      type: "chord",
      pitches: ["c'", "e'", "g'"],
      duration: "2",
      indicators: [],
    });
  });

  it("creates a rest leaf", () => {
    const rest = lyRest("4");
    expect(rest).toEqual({ type: "rest", duration: "4", spacer: false, indicators: [] });
  });

  it("creates a spacer rest", () => {
    const spacer = lyRest("4", true);
    expect(spacer.spacer).toBe(true);
  });

  it("creates a voice container", () => {
    const voice = lyVoice("Music", [lyNote("d'", "4")]);
    expect(voice.type).toBe("container");
    expect(voice.context).toBe("Voice");
    expect(voice.name).toBe("Music");
    expect(voice.simultaneous).toBe(false);
    expect(voice.children).toHaveLength(1);
  });

  it("creates a staff container with withBlock", () => {
    const staff = lyStaff([lyVoice("V", [])], {
      withBlock: ["tablatureFormat = \\luteTabFormat"],
    });
    expect(staff.context).toBe("Staff");
    expect(staff.withBlock).toEqual(["tablatureFormat = \\luteTabFormat"]);
  });

  it("creates a score container (simultaneous by default)", () => {
    const score = lyScore([]);
    expect(score.context).toBe("Score");
    expect(score.simultaneous).toBe(true);
  });

  it("creates a TabStaff container", () => {
    const tab = lyTabStaff([lyVoice("Music", [])], {
      withBlock: ["tablatureFormat = \\luteTabFormat"],
    });
    expect(tab.context).toBe("TabStaff");
    expect(tab.withBlock).toEqual(["tablatureFormat = \\luteTabFormat"]);
  });

  it("creates a RhythmicStaff container", () => {
    const rhythm = lyRhythmicStaff([lyVoice("Rhythm", [])]);
    expect(rhythm.context).toBe("RhythmicStaff");
  });

  it("creates a Lyrics container with lyricsto", () => {
    const lyrics = lyLyrics("melody", []);
    expect(lyrics.context).toBe("Lyrics");
    expect(lyrics.lyricsto).toBe("melody");
  });
});

describe("serializeFile", () => {
  it("serializes a minimal file", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([
        lyContainer("Voice", {
          children: [lyNote("c'", "4")],
        }),
      ]),
      layout: true,
    };

    const output = serializeFile(file);
    expect(output).toContain('\\version "2.24.0"');
    expect(output).toContain("\\score {");
    expect(output).toContain("c'4");
    expect(output).toContain("\\layout { }");
    expect(output).toContain("}");
  });

  it("serializes includes", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: ["instruments/baroque-lute-13.ily"],
      score: lyScore([]),
      layout: true,
    };

    const output = serializeFile(file);
    expect(output).toContain('\\include "instruments/baroque-lute-13.ily"');
  });

  it("serializes header", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      header: { title: "Flow My Tears", composer: "John Dowland" },
      score: lyScore([]),
      layout: true,
    };

    const output = serializeFile(file);
    expect(output).toContain('title = "Flow My Tears"');
    expect(output).toContain('composer = "John Dowland"');
  });

  it("serializes variables with braces (default)", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      variables: [{ name: "myVar", body: "c'4 d'4 e'4" }],
      score: lyScore([]),
      layout: true,
    };

    const output = serializeFile(file);
    expect(output).toContain("myVar = { c'4 d'4 e'4 }");
  });

  it("serializes variables without braces when braces=false", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      variables: [
        { name: "lyricsText", body: "\\lyricmode { Sing now a sim -- ple song }", braces: false },
      ],
      score: lyScore([]),
      layout: true,
    };

    const output = serializeFile(file);
    expect(output).toContain("lyricsText = \\lyricmode { Sing now a sim -- ple song }");
    // Should NOT have outer braces
    expect(output).not.toContain("lyricsText = { \\lyricmode");
  });

  it("serializes midi block", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([]),
      layout: true,
      midi: { tempo: 72 },
    };

    const output = serializeFile(file);
    expect(output).toContain("\\midi { \\tempo 4 = 72 }");
  });

  it("omits header when empty", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).not.toContain("\\header");
    expect(output).not.toContain("\\layout");
    expect(output).not.toContain("\\midi");
  });
});

describe("serializer — leaves", () => {
  function serializeLeafInContext(child: Parameters<typeof lyVoice>[1][0]): string {
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([lyVoice("V", [child])]),
      layout: false,
    };

    return serializeFile(file);
  }

  it("serializes a note", () => {
    const output = serializeLeafInContext(lyNote("d'", "4"));
    expect(output).toContain("d'4");
  });

  it("serializes a chord", () => {
    const output = serializeLeafInContext(lyChord(["c'", "e'", "g'"], "2"));
    expect(output).toContain("<c' e' g'>2");
  });

  it("serializes a regular rest", () => {
    const output = serializeLeafInContext(lyRest("4"));
    expect(output).toContain("r4");
  });

  it("serializes a spacer rest", () => {
    const output = serializeLeafInContext(lyRest("4", true));
    expect(output).toContain("s4");
  });

  it("serializes tie indicator", () => {
    const output = serializeLeafInContext(lyNote("c'", "4", [{ kind: "tie" }]));
    expect(output).toContain("c'4~");
  });

  it("serializes slur start", () => {
    const output = serializeLeafInContext(lyNote("c'", "4", [{ kind: "slur_start" }]));
    expect(output).toContain("c'4(");
  });

  it("serializes slur end", () => {
    const output = serializeLeafInContext(lyNote("d'", "4", [{ kind: "slur_end" }]));
    expect(output).toContain("d'4)");
  });

  it("serializes ornament", () => {
    const output = serializeLeafInContext(lyNote("e'", "4", [{ kind: "ornament", name: "trill" }]));
    expect(output).toContain("e'4\\trill");
  });

  it("serializes bar check", () => {
    const output = serializeLeafInContext(lyNote("f'", "4", [{ kind: "bar_check" }]));
    expect(output).toContain("f'4 |");
  });

  it("serializes time signature before note", () => {
    const output = serializeLeafInContext(
      lyNote("c'", "4", [{ kind: "time_signature", numerator: 3, denominator: 4 }])
    );
    expect(output).toContain("\\time 3/4");
    expect(output).toContain("c'4");
  });

  it("serializes key signature before note", () => {
    const output = serializeLeafInContext(
      lyNote("d'", "4", [{ kind: "key_signature", tonic: "d", mode: "minor" }])
    );
    expect(output).toContain("\\key d \\minor");
    expect(output).toContain("d'4");
  });

  it("serializes partial (pickup) before note", () => {
    const output = serializeLeafInContext(lyNote("a'", "4", [{ kind: "partial", duration: "4" }]));
    expect(output).toContain("\\partial 4");
    expect(output).toContain("a'4");
  });

  it("serializes literal indicator before", () => {
    const output = serializeLeafInContext(
      lyNote("c'", "4", [{ kind: "literal", text: "\\p", site: "before" }])
    );
    expect(output).toContain("\\p");
    expect(output).toContain("c'4");
  });

  it("serializes literal indicator after", () => {
    const output = serializeLeafInContext(
      lyNote("c'", "4", [{ kind: "literal", text: "\\fermata", site: "after" }])
    );
    expect(output).toContain("c'4 \\fermata");
  });

  it("serializes multiple indicators on one note", () => {
    const output = serializeLeafInContext(
      lyNote("c'", "4", [
        { kind: "time_signature", numerator: 4, denominator: 4 },
        { kind: "slur_start" },
        { kind: "ornament", name: "mordent" },
        { kind: "bar_check" },
      ])
    );
    expect(output).toContain("\\time 4/4");
    expect(output).toContain("c'4(\\mordent |");
  });
});

describe("serializer — indentation", () => {
  it("aligns before-indicators with their note at any nesting depth", () => {
    // Score (indent 1) → Staff (indent 2) → Voice (indent 3) → leaf (indent 4)
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([
        lyStaff([
          lyVoice("V", [
            lyNote("c'", "4", [{ kind: "time_signature", numerator: 3, denominator: 4 }]),
          ]),
        ]),
      ]),
      layout: false,
    };

    const output = serializeFile(file);
    const lines = output.split("\n");

    // Find the time signature line and the note line
    const timeLine = lines.find((l) => l.includes("\\time 3/4"));
    const noteLine = lines.find((l) => l.includes("c'4"));

    expect(timeLine).toBeDefined();
    expect(noteLine).toBeDefined();

    // Both should have the same indentation (8 spaces = indent level 4)
    const timeIndent = timeLine!.match(/^(\s*)/)?.[1].length ?? 0;
    const noteIndent = noteLine!.match(/^(\s*)/)?.[1].length ?? 0;
    expect(timeIndent).toBe(noteIndent);
    expect(timeIndent).toBe(8); // 4 levels × 2 spaces
  });
});

describe("serializer — containers", () => {
  it("serializes sequential container with { }", () => {
    const voice = lyVoice("Music", [lyNote("c'", "4"), lyNote("d'", "4")]);
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([voice]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain('\\new Voice = "Music" {');
    expect(output).toContain("c'4");
    expect(output).toContain("d'4");
  });

  it("serializes simultaneous container with << >>", () => {
    const score = lyScore([lyStaff([lyNote("c'", "4")]), lyStaff([lyNote("g", "4")])], {
      simultaneous: true,
    });
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score,
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain("\\new Score <<");
    expect(output).toContain(">>");
  });

  it("serializes withBlock with string entries", () => {
    const tabStaff = lyContainer("TabStaff", {
      withBlock: [
        "tablatureFormat = \\luteTabFormat",
        "stringTunings = \\luteStringTunings",
        "additionalBassStrings = \\luteDiapasons",
      ],
      children: [lyVoice("Music", [lyNote("f'", "4")])],
    });
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([tabStaff]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain("\\new TabStaff \\with {");
    expect(output).toContain("tablatureFormat = \\luteTabFormat");
    expect(output).toContain("stringTunings = \\luteStringTunings");
    expect(output).toContain("additionalBassStrings = \\luteDiapasons");
  });

  it("serializes withBlock with \\remove commands", () => {
    const staff = lyStaff([lyVoice("Music", [lyNote("c'", "4")])], {
      withBlock: [
        '\\remove "Staff_symbol_engraver"',
        '\\remove "Clef_engraver"',
        "\\override NoteHead.transparent = ##t",
      ],
    });
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([staff]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain("\\new Staff \\with {");
    expect(output).toContain('\\remove "Staff_symbol_engraver"');
    expect(output).toContain('\\remove "Clef_engraver"');
    expect(output).toContain("\\override NoteHead.transparent = ##t");
  });

  it("serializes withBlock mixing commands and key=value entries", () => {
    const tabStaff = lyTabStaff([lyVoice("Music", [])], {
      withBlock: [
        "tablatureFormat = \\luteTabFormat",
        '\\remove "Time_signature_engraver"',
        "stringTunings = \\luteStringTunings",
      ],
    });
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([tabStaff]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain("tablatureFormat = \\luteTabFormat");
    expect(output).toContain('\\remove "Time_signature_engraver"');
    expect(output).toContain("stringTunings = \\luteStringTunings");
  });

  it("serializes lyricsto syntax", () => {
    const lyrics = lyLyrics("melody", []);
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([lyrics]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain('\\new Lyrics \\lyricsto "melody" {');
  });

  it("serializes container-level indicators", () => {
    const staff = lyStaff([], {
      indicators: [
        { kind: "literal", text: "\\override NoteHead.transparent = ##t", site: "before" },
        { kind: "literal", text: '\\remove "Staff_symbol_engraver"', site: "before" },
      ],
    });
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([staff]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain("\\override NoteHead.transparent = ##t");
    expect(output).toContain('\\remove "Staff_symbol_engraver"');
  });

  it("serializes nested containers", () => {
    const innerVoice = lyVoice("Inner", [lyNote("a", "2")]);
    const staff = lyStaff([innerVoice], { name: "MyStaff" });
    const score = lyScore([staff]);
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score,
      layout: true,
    };

    const output = serializeFile(file);
    expect(output).toContain('\\new Staff = "MyStaff"');
    expect(output).toContain('\\new Voice = "Inner"');
    expect(output).toContain("a2");
  });

  it("produces deterministic output", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: ["instruments/baroque-lute-13.ily"],
      header: { title: "Test" },
      score: lyScore([
        lyContainer("TabStaff", {
          withBlock: ["tablatureFormat = \\luteTabFormat"],
          children: [
            lyVoice("Music", [
              lyNote("f'", "4", [{ kind: "time_signature", numerator: 4, denominator: 4 }]),
              lyNote("d'", "4"),
              lyNote("a", "4"),
              lyNote("f", "4", [{ kind: "bar_check" }]),
            ]),
          ],
        }),
      ]),
      layout: true,
      midi: { tempo: 72 },
    };

    const output1 = serializeFile(file);
    const output2 = serializeFile(file);
    expect(output1).toBe(output2);
  });
});

describe("serializer — polyphony (v2 readiness)", () => {
  it("serializes simultaneous voices in a staff", () => {
    const upper = lyVoice("Upper", [lyNote("d''", "4"), lyNote("e''", "4")], {
      indicators: [{ kind: "literal", text: "\\voiceOne", site: "before" }],
    });
    const lower = lyVoice("Lower", [lyNote("d'", "4"), lyNote("c'", "4")], {
      indicators: [{ kind: "literal", text: "\\voiceTwo", site: "before" }],
    });

    const staff = lyContainer("Staff", {
      simultaneous: true,
      children: [upper, lower],
    });
    const file: LyFile = {
      version: "2.24.0",
      includes: [],
      score: lyScore([staff]),
      layout: false,
    };

    const output = serializeFile(file);
    expect(output).toContain("\\new Staff <<");
    expect(output).toContain('\\new Voice = "Upper" {');
    expect(output).toContain("\\voiceOne");
    expect(output).toContain('\\new Voice = "Lower" {');
    expect(output).toContain("\\voiceTwo");
    expect(output).toContain(">>");
  });
});

describe("serializer — voice-and-tab pattern", () => {
  it("serializes a complete voice-and-tab layout", () => {
    const file: LyFile = {
      version: "2.24.0",
      includes: ["instruments/classical-guitar-6.ily"],
      variables: [
        { name: "melody", body: "c'4 d' e' f'" },
        { name: "lyricsText", body: "\\lyricmode { Sing now a song }", braces: false },
        { name: "lute", body: "c'4 e' g' c''" },
      ],
      score: lyScore([
        lyContainer("Staff", {
          name: "voice",
          simultaneous: true,
          children: [lyVoice("melody", [lyNote("c'", "4")])],
        }),
        lyLyrics("melody", []),
        lyTabStaff([lyVoice("tab", [lyNote("c'", "4")])], {
          withBlock: [
            "tablatureFormat = \\classicalGuitarTabFormat",
            "stringTunings = \\classicalGuitarStringTunings",
          ],
        }),
      ]),
      layout: true,
      midi: { tempo: 72 },
    };

    const output = serializeFile(file);
    expect(output).toContain("melody = { c'4 d' e' f' }");
    expect(output).toContain("lyricsText = \\lyricmode { Sing now a song }");
    expect(output).toContain("lute = { c'4 e' g' c'' }");
    expect(output).toContain('\\new Lyrics \\lyricsto "melody" {');
    expect(output).toContain("\\new TabStaff \\with {");
    expect(output).toContain("tablatureFormat = \\classicalGuitarTabFormat");
  });
});
