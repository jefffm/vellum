import type { PublishHistoricalTabDraftCommand } from "./historical-tab-recognition-domain.js";

type ReviewedEvent = PublishHistoricalTabDraftCommand["events"][number];

export type HistoricalTabRecognitionEvaluation = {
  status: "pass" | "fail";
  comparedEvents: number;
  structure: { missing: string[]; unexpected: string[] };
  mismatches: {
    glyphs: string[];
    courses: string[];
    rhythmSigns: string[];
    ornaments: string[];
    gestureMarks: string[];
    regions: string[];
  };
  propagation: { proposedEvents: number; rejectedEvents: number };
  reviewerBurden: PublishHistoricalTabDraftCommand["reviewMetrics"] & {
    keyboardActionsPerEvent: number;
  };
};

const identity = (event: ReviewedEvent) => [...event.sourceEventIds].sort().join("+");

export function evaluateHistoricalTabRecognition(
  candidate: PublishHistoricalTabDraftCommand,
  reviewedTruth: readonly ReviewedEvent[],
  minimumRegionIntersection = 0.7
): HistoricalTabRecognitionEvaluation {
  const candidates = new Map(candidate.events.map((event) => [identity(event), event] as const));
  const truth = new Map(reviewedTruth.map((event) => [identity(event), event] as const));
  const missing = [...truth.keys()].filter((id) => !candidates.has(id));
  const unexpected = [...candidates.keys()].filter((id) => !truth.has(id));
  const mismatches = {
    glyphs: [] as string[],
    courses: [] as string[],
    rhythmSigns: [] as string[],
    ornaments: [] as string[],
    gestureMarks: [] as string[],
    regions: [] as string[],
  };
  for (const [id, expected] of truth) {
    const actual = candidates.get(id);
    if (!actual) continue;
    if (
      actual.courses.join("|") !== expected.courses.join("|") ||
      actual.rhythmGlyph !== expected.rhythmGlyph ||
      actual.dots !== expected.dots ||
      actual.ornaments !== expected.ornaments ||
      actual.marks !== expected.marks ||
      actual.verticalMark !== expected.verticalMark
    )
      mismatches.glyphs.push(id);
    if (actual.courses.join("|") !== expected.courses.join("|")) mismatches.courses.push(id);
    if (actual.rhythmGlyph !== expected.rhythmGlyph || actual.dots !== expected.dots)
      mismatches.rhythmSigns.push(id);
    if (actual.ornaments !== expected.ornaments) mismatches.ornaments.push(id);
    if (actual.marks !== expected.marks || actual.verticalMark !== expected.verticalMark)
      mismatches.gestureMarks.push(id);
    if (regionIntersectionOverUnion(actual.region, expected.region) < minimumRegionIntersection)
      mismatches.regions.push(id);
  }
  const findingCount =
    missing.length +
    unexpected.length +
    Object.values(mismatches).reduce((sum, findings) => sum + findings.length, 0);
  return {
    status: findingCount === 0 ? "pass" : "fail",
    comparedEvents: reviewedTruth.length - missing.length,
    structure: { missing, unexpected },
    mismatches,
    propagation: {
      proposedEvents: candidate.reviewMetrics.propagated,
      rejectedEvents: candidate.reviewMetrics.rejected,
    },
    reviewerBurden: {
      ...candidate.reviewMetrics,
      keyboardActionsPerEvent:
        candidate.events.length === 0
          ? 0
          : candidate.reviewMetrics.keyboardActions / candidate.events.length,
    },
  };
}

function regionIntersectionOverUnion(
  left: ReviewedEvent["region"],
  right: ReviewedEvent["region"]
): number {
  const intersectionWidth = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  );
  const intersection = intersectionWidth * intersectionHeight;
  const union = left.width * left.height + right.width * right.height - intersection;
  return union ? intersection / union : 0;
}
