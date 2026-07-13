import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ReviewRequestSchema,
  decodeReviewRequest,
  type ReviewRequest,
} from "../src/lib/review-attestation.js";

const expected: Record<string, Record<string, string>> = {
  "baroque-guitar-5": {
    "audioPreview.json": "259f1666dfcae6a8861144dd22c3aec95f846037b050b4ddcd33739153850f39",
    "lilypond.ly": "29f7b79dac557791131aec7841280cc370cb390c04aec18087ebf48bc4d06b6c",
    "midi.midi": "5eb3a15e56285326fe9c132ac0c2b839f2fcbe8f377b1217101623adccc534c9",
    "pdf.pdf": "61a0788cbc5e88e88ff72b1b13bcccb2357f69b96a6deaa98dd639108a8e4f6f",
    "svg.svg": "bfa1d7cf11752724f6e8a0e9d425d5a75b1ffa207a36a76e60e7361d68c60c3b",
  },
  "baroque-lute-13": {
    "audioPreview.json": "43e0662f94dbf7fbe579dcfbd41bc89887457ddd4967c3d11499c673ddc89fc2",
    "lilypond.ly": "e62627a349244c297616fe9038678233e87d66435c095f4b2075982b81517af4",
    "midi.midi": "a4d777a435a1d863b44a93cb45cd16b00bd5e65e8cb22c10ed70dce7a2bc84c1",
    "pdf.pdf": "bfb3065747263ed151c988442e54f8fc2956aed7c903691e1d0cc61d7538b9d0",
    "svg.svg": "91f1d17cb0b1630e6b7c5e33b3c39a6423aa89b485bda401547f063160096e6a",
  },
  "classical-guitar-6": {
    "audioPreview.json": "159de92ad4825026a32e4da0e7e30565e6f22e2a2b78a526cb37707324529ad3",
    "lilypond.ly": "a920729fb043baa3c70c0efd992cf15201847e5b37b76f9adedcaf6192efdeea",
    "midi.midi": "80e3e70b164aa83bcf1a611b25418d03720ccd8b36a71d5a3e7367783bacd1c7",
    "pdf.pdf": "dc9c8b3291be9cc407cbde291fa587e32f71843d21cc21f28ea619af367db0a0",
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
      const request = JSON.parse(
        readFileSync(path.join(root, instrument, "review-request.json"), "utf8")
      ) as ReviewRequest;
      expect(Value.Check(ReviewRequestSchema, request)).toBe(true);
      expect(decodeReviewRequest(request)).toEqual(request);
      expect(request.instrument.profileId).toBe(instrument);
      const audioPreview = JSON.parse(
        readFileSync(path.join(root, instrument, "audioPreview.json"), "utf8")
      ) as { instrumentInstanceDigest?: string };
      expect(request.instrument.instanceDigest).toBe(audioPreview.instrumentInstanceDigest);
      expect(request.artifacts.map(({ sha256 }) => sha256).sort()).toEqual(
        Object.values(files).sort()
      );
      expect(request.requiredRoles).toContain("target_player");
      expect(request.requiredRoles).toContain("owner");
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
