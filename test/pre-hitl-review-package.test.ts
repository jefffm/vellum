import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expected: Record<string, Record<string, string>> = {
  "baroque-guitar-5": {
    "audioPreview.json": "652985ccdf3833174836fa080d5b38778d227daaf9364c767adc5cb9f5e1d1ba",
    "lilypond.ly": "29f7b79dac557791131aec7841280cc370cb390c04aec18087ebf48bc4d06b6c",
    "midi.midi": "5eb3a15e56285326fe9c132ac0c2b839f2fcbe8f377b1217101623adccc534c9",
    "pdf.pdf": "cdbfa1b89d37b87a4293547d6d06cdf45e93a53ba4f6119b3a7f436144f8347a",
    "svg.svg": "bfa1d7cf11752724f6e8a0e9d425d5a75b1ffa207a36a76e60e7361d68c60c3b",
  },
  "baroque-lute-13": {
    "audioPreview.json": "b583de091ae826130a24ed29b8ef1dff2f825c32323a86410b087992b9443a8d",
    "lilypond.ly": "f4ec937e024d2363ce0721339c3400bcc684fb52313c92d7c9bbe0110814ca57",
    "midi.midi": "a4d777a435a1d863b44a93cb45cd16b00bd5e65e8cb22c10ed70dce7a2bc84c1",
    "pdf.pdf": "f753410d620fc250127a508e905c8f6f2c3f0fcb485f324c05750f4577247387",
    "svg.svg": "13db67d7322062f31737971b55a7fbbc5ba3f08ecb6601999ec2abc96f304c19",
  },
  "classical-guitar-6": {
    "audioPreview.json": "2af06a20a8a87fb4b8af2fc09205a0847b424df06825641ced2a8dc1ad7d9b4a",
    "lilypond.ly": "a920729fb043baa3c70c0efd992cf15201847e5b37b76f9adedcaf6192efdeea",
    "midi.midi": "80e3e70b164aa83bcf1a611b25418d03720ccd8b36a71d5a3e7367783bacd1c7",
    "pdf.pdf": "81536ecabcb3a63a1e4b278802d6c89e3a817bdd9daad01ac1af20955b7aaee2",
    "svg.svg": "bde5f4291ae6c24bbe79684a3cbf82fd526c7d46f402cc2d010221ef6915029e",
  },
};

describe("pre-HITL review package", () => {
  it("pins every exact target artifact and keeps human-only protocol boundaries explicit", () => {
    const root = path.join(
      process.cwd(),
      ".scratch/arrangement-intelligence/evidence/T40/review-packages"
    );
    for (const [instrument, files] of Object.entries(expected)) {
      for (const [filename, digest] of Object.entries(files)) {
        expect(
          createHash("sha256")
            .update(readFileSync(path.join(root, instrument, filename)))
            .digest("hex")
        ).toBe(digest);
      }
    }
    const protocol = readFileSync(
      path.join(
        process.cwd(),
        ".scratch/arrangement-intelligence/evidence/T40/REVIEW_PROTOCOLS.md"
      ),
      "utf8"
    );
    expect(protocol).toContain("T40.review.v1");
    expect(protocol).toContain("A deterministic pass is not a physical or historical attestation");
    expect(protocol).toMatch(/T41[\s\S]*T42[\s\S]*T43/);
    expect(protocol).toContain("Stale when");
  });
});
