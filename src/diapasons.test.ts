import { describe, expect, it } from "vitest";
import { diapasonsTool } from "./diapasons.js";

describe("diapasons tool", () => {
  it("returns d_minor scheme for 'D minor'", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D minor",
      instrument: "baroque-lute-13",
    });

    expect(result.details.schemeName).toBe("d_minor");
    expect(result.details.courses).toHaveLength(7);
    expect(result.details.courses.map((c) => c.pitch)).toEqual([
      "G", "F", "Eb", "D", "C", "Bb", "A",
    ]);
  });

  it("returns a_minor scheme for 'A minor'", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "A minor",
      instrument: "baroque-lute-13",
    });

    expect(result.details.schemeName).toBe("a_minor");
    expect(result.details.courses.map((c) => c.pitch)).toEqual([
      "G", "F", "E", "D", "C", "B", "A",
    ]);
  });

  it("returns d_major scheme with F# and C#", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D major",
      instrument: "baroque-lute-13",
    });

    expect(result.details.schemeName).toBe("d_major");
    const pitches = result.details.courses.map((c) => c.pitch);
    expect(pitches).toContain("F#");
    expect(pitches).toContain("C#");
  });

  it("generates correct LilyPond syntax for d_minor", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D minor",
      instrument: "baroque-lute-13",
    });

    expect(result.details.lilypondSyntax).toBe(
      "\\stringTuning <g, f, ees, d, c, bes,, a,,>"
    );
  });

  it("generates correct LilyPond syntax for a_minor", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "A minor",
      instrument: "baroque-lute-13",
    });

    expect(result.details.lilypondSyntax).toBe(
      "\\stringTuning <g, f, e, d, c, b,, a,,>"
    );
  });

  it("generates correct LilyPond syntax for d_major", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D major",
      instrument: "baroque-lute-13",
    });

    expect(result.details.lilypondSyntax).toBe(
      "\\stringTuning <g, fis, e, d, cis, b,, a,,>"
    );
  });

  it("returns closest match with warning for unknown key", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D dorian",
      instrument: "baroque-lute-13",
    });

    // Should match d_minor or d_major as closest
    expect(result.details.schemeName).toMatch(/^d_/);
    expect(result.details.warning).toBeDefined();
    expect(result.details.warning).toContain("not found exactly");
  });

  it("returns error for instrument without diapason schemes", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "A minor",
      instrument: "baroque-guitar-5",
    });

    const c = result.content[0];
    expect(c.type).toBe("text");
    if (c.type === "text") {
      expect(c.text).toContain("Error");
      expect(c.text).toContain("no diapason schemes");
    }
  });

  it("handles case-insensitive key names", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "d Minor",
      instrument: "baroque-lute-13",
    });

    expect(result.details.schemeName).toBe("d_minor");
  });

  it("handles hyphenated key format", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "d-minor",
      instrument: "baroque-lute-13",
    });

    expect(result.details.schemeName).toBe("d_minor");
  });

  it("defaults instrument to baroque-lute-13", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D minor",
    });

    expect(result.details.schemeName).toBe("d_minor");
    expect(result.details.courses).toHaveLength(7);
  });

  it("assigns correct course numbers starting after fretted courses", async () => {
    const result = await diapasonsTool.execute("call-1", {
      key: "D minor",
      instrument: "baroque-lute-13",
    });

    // baroque-lute-13 has 6 fretted courses, so diapasons start at 7
    expect(result.details.courses[0].course).toBe(7);
    expect(result.details.courses[6].course).toBe(13);
  });
});
