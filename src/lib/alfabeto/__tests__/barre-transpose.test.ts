import { describe, expect, it } from "vitest";
import { barreTranspose, barrePitchClasses, shapePitchClasses } from "../barre-transpose.js";
import { TYLER_UNIVERSAL } from "../charts/tyler-universal.js";

function getShape(letter: string) {
  return TYLER_UNIVERSAL.shapes.find((s) => s.letter === letter)!;
}

describe("barreTranspose", () => {
  it("A (G major) barred at 2 → A major", () => {
    const a = getShape("A");
    const result = barreTranspose(a, 2, 8);

    expect(result).not.toBeNull();
    expect(result!.chord).toBe("A major");
    expect(result!.barreAt).toBe(2);
    expect(result!.source).toBe("barre");
    expect(result!.positions.map((p) => p.fret)).toEqual([5, 5, 2, 2, 4]);
  });

  it("D (A minor) barred at 3 → C minor", () => {
    const d = getShape("D");
    const result = barreTranspose(d, 3, 8);

    expect(result).not.toBeNull();
    expect(result!.chord).toBe("C minor");
    expect(result!.barreAt).toBe(3);
  });

  it("returns null for semitones ≤ 0", () => {
    expect(barreTranspose(getShape("A"), 0, 8)).toBeNull();
    expect(barreTranspose(getShape("A"), -1, 8)).toBeNull();
  });

  it("returns null when transposition exceeds maxFret", () => {
    // Y has frets [3,3,4,5,5] — barring at 4 would give [7,7,8,9,9] > maxFret 8
    const y = getShape("Y");
    expect(barreTranspose(y, 4, 8)).toBeNull();
  });

  it("correctly transposes chord name roots through enharmonics", () => {
    // G (F major) barred at 1 → Gb major
    const g = getShape("G");
    const result = barreTranspose(g, 1, 8);

    expect(result).not.toBeNull();
    expect(result!.chord).toBe("Gb major");
  });

  it("confirms Foscarini lettere tagliate: G+2 frets = G major (matches Y)", () => {
    const g = getShape("G");
    const y = getShape("Y");
    const gTransposed = barreTranspose(g, 2, 8);

    expect(gTransposed).not.toBeNull();

    // G+2 should produce the same pitch classes as Y
    const gPCs = barrePitchClasses(g, 2);
    const yPCs = shapePitchClasses(y);

    expect([...gPCs].sort()).toEqual([...yPCs].sort());
  });
});

describe("barrePitchClasses", () => {
  it("A barred at 2 gives pitch classes of A major (A=9, C#=1, E=4)", () => {
    const pcs = barrePitchClasses(getShape("A"), 2);
    expect([...pcs].sort((a, b) => a - b)).toEqual([1, 4, 9]);
  });

  it("+ (E minor) barred at 1 gives F minor", () => {
    const pcs = barrePitchClasses(getShape("+"), 1);
    // F=5, Ab=8, C=0
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 5, 8]);
  });
});

describe("shapePitchClasses", () => {
  it("A (G major) → {G=7, B=11, D=2}", () => {
    const pcs = shapePitchClasses(getShape("A"));
    expect([...pcs].sort((a, b) => a - b)).toEqual([2, 7, 11]);
  });

  it("+ (E minor) → {E=4, G=7, B=11}", () => {
    const pcs = shapePitchClasses(getShape("+"));
    expect([...pcs].sort((a, b) => a - b)).toEqual([4, 7, 11]);
  });
});
