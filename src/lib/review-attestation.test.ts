import { describe, expect, it } from "vitest";
import {
  digestReviewRequest,
  validateReviewAttestation,
  validateReviewCoverage,
  type HumanReviewerRole,
  type ReviewAttestation,
  type ReviewRequest,
} from "./review-attestation.js";

const digest = (character: string) => character.repeat(64);
const request: ReviewRequest = {
  schemaVersion: 1,
  id: "review-request.T41.baroque-guitar",
  tracerId: "T41",
  protocol: { id: "T40.review", version: 1, digest: digest("a") },
  sourceDigest: digest("b"),
  arrangementScoreRef: { id: "arrangement.1", version: 1, digest: digest("c") },
  performanceBriefRef: { id: "performance-brief.1", digest: digest("d") },
  instrument: {
    profileId: "baroque-guitar-5",
    instanceDigest: digest("e"),
    modeledDescription: "Five-course baroque guitar with French stringing",
  },
  artifacts: [
    artifact("lilypond", "lilypond.ly", "1"),
    artifact("svg", "svg.svg", "2"),
    artifact("pdf", "pdf.pdf", "3"),
    artifact("midi", "midi.midi", "4"),
    artifact("audio_preview", "audioPreview.json", "5"),
  ],
  requiredRoles: ["target_player", "historical_specialist", "engraving_editor", "owner"],
  requiredDimensions: ["physical_playability", "historical_practice", "notation", "recognition"],
  roleAssignments: [
    { dimension: "physical_playability", authorizedRoles: ["target_player"] },
    { dimension: "historical_practice", authorizedRoles: ["historical_specialist"] },
    { dimension: "notation", authorizedRoles: ["engraving_editor"] },
    { dimension: "recognition", authorizedRoles: ["owner"] },
  ],
  staleWhen: ["source changes", "arrangement bytes change", "instrument setup changes"],
  createdAt: "2026-07-13T03:00:00Z",
};

describe("review attestation boundary", () => {
  it("binds a scoped human attestation to exact request, artifacts, role, and staleness", () => {
    expect(validateReviewAttestation(request, attestation("target_player"))).toMatchObject({
      reviewRequestId: request.id,
      result: "accept",
    });
    expect(() =>
      validateReviewAttestation(request, {
        ...attestation("target_player"),
        artifactDigests: [digest("1"), digest("2"), digest("3"), digest("4"), digest("6")],
      })
    ).toThrow(/exact artifact set/);
    expect(() =>
      validateReviewAttestation(request, {
        ...attestation("target_player"),
        reviewRequestDigest: digest("f"),
      })
    ).toThrow(/stale or incompatible/);
  });

  it("does not launder role authority or nonphysical evidence", () => {
    expect(() =>
      validateReviewAttestation(request, {
        ...attestation("target_player"),
        evidenceBasis: ["notation"],
        actualInstrument: undefined,
      })
    ).toThrow(/physical playing/);
    expect(() =>
      validateReviewAttestation(request, {
        ...attestation("historical_specialist", "historical_practice"),
        evidenceBasis: ["notation"],
      })
    ).toThrow(/documentary-source/);
    expect(() =>
      validateReviewAttestation(request, {
        ...attestation("target_player"),
        reviewer: { ...attestation("target_player").reviewer, role: "baseline_reviewer" },
      })
    ).toThrow(/not authorized/);
    expect(() =>
      validateReviewAttestation(request, attestation("owner", "historical_practice"))
    ).toThrow(/not authorized for historical_practice/);
  });

  it("keeps coverage incomplete until every required scoped role attests and preserves rejection", () => {
    expect(validateReviewCoverage(request, [attestation("target_player")])).toEqual({
      status: "incomplete",
      missingRoles: ["historical_specialist", "engraving_editor", "owner"],
      missingDimensions: ["historical_practice", "notation", "recognition"],
    });
    const complete = request.requiredRoles.map((role, index) =>
      attestation(role, request.requiredDimensions[index] ?? request.requiredDimensions.at(-1)!)
    );
    expect(validateReviewCoverage(request, complete)).toEqual({
      status: "accepted",
      missingRoles: [],
      missingDimensions: [],
    });
    expect(
      validateReviewCoverage(request, [
        ...complete.slice(0, -1),
        { ...complete.at(-1)!, result: "reject" },
      ])
    ).toEqual({ status: "rejected", missingRoles: [], missingDimensions: [] });
  });
});

function artifact(
  kind: ReviewRequest["artifacts"][number]["kind"],
  relativePath: string,
  character: string
) {
  return { kind, relativePath, sha256: digest(character) };
}

function attestation(
  role: HumanReviewerRole,
  dimension = request.requiredDimensions[0]!
): ReviewAttestation {
  return {
    schemaVersion: 1,
    id: `attestation.${role}`,
    reviewRequestId: request.id,
    reviewRequestDigest: digestReviewRequest(request),
    artifactDigests: request.artifacts.map(({ sha256 }) => sha256),
    reviewer: {
      pseudonymousId: `reviewer.${role}`,
      role,
      qualifications: ["Declared qualification for the scoped role"],
      conflictsOfInterest: [],
      consentedToLocalRetention: true,
    },
    evidenceBasis:
      role === "target_player"
        ? ["notation", "listening", "physical_playing"]
        : role === "historical_specialist"
          ? ["notation", "documentary_sources"]
          : role === "owner"
            ? ["notation", "listening", "owner_use"]
            : ["notation"],
    ...(role === "target_player"
      ? {
          actualInstrument: {
            description: "Five-course baroque guitar",
            tuningAndSetup: "French stringing at review pitch",
            scaleLengthMm: 680,
          },
        }
      : {}),
    actualContext: { tempoBpm: 72, repetitions: 3, description: "Complete scoped protocol" },
    result: "accept",
    confidence: 0.9,
    observations: [
      {
        dimension,
        outcome: "supports",
        scoreAnchor: "measure 1 through final bar",
        rationale: "Reviewed under the declared evidence basis.",
      },
    ],
    limitations: [],
    rationale: "Scoped evidence supports this exact artifact set.",
    staleDependenciesConfirmed: request.staleWhen,
    createdAt: "2026-07-13T04:00:00Z",
  };
}
