import { Type, type Static } from "@sinclair/typebox";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

export const CanonicalOwnerIntentLayerSchema = Type.Union([
  Type.Literal("score_transcription"),
  Type.Literal("analysis_claim"),
  Type.Literal("arrangement_plan"),
  Type.Literal("arrangement_score"),
  Type.Literal("performance_interpretation"),
  Type.Literal("commitment"),
  Type.Literal("policy_exception"),
  Type.Literal("personal_default_candidate"),
  Type.Literal("explanation"),
]);
export type CanonicalOwnerIntentLayer = Static<typeof CanonicalOwnerIntentLayerSchema>;

export const OwnerIntentAnchorSchema = Type.Object(
  {
    workspaceId: Type.String({ minLength: 1 }),
    arrangementScoreId: Type.String({ minLength: 1 }),
    arrangementScoreVersion: Type.Integer({ minimum: 1 }),
    arrangementFamilyId: Type.String({ minLength: 1 }),
    arrangementSearchId: Type.String({ minLength: 1 }),
    arrangementPlanId: Type.String({ minLength: 1 }),
    analysisRecordId: Type.String({ minLength: 1 }),
    targetConfigurationId: Type.String({ minLength: 1 }),
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    eventIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    measureIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    sourceEventIds: Type.Array(Type.String({ minLength: 1 })),
    findingIds: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);
export type OwnerIntentAnchor = Static<typeof OwnerIntentAnchorSchema>;

export const OwnerIntentProposalSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    request: Type.String({ minLength: 1 }),
    anchor: OwnerIntentAnchorSchema,
    proposedLayer: Type.Optional(CanonicalOwnerIntentLayerSchema),
    alternatives: Type.Array(CanonicalOwnerIntentLayerSchema),
    resolution: Type.Union([Type.Literal("resolved"), Type.Literal("ambiguous")]),
    consequence: Type.Union([
      Type.Literal("none"),
      Type.Literal("local"),
      Type.Literal("lineage"),
      Type.Literal("policy"),
    ]),
    consequenceSummary: Type.String({ minLength: 1 }),
    confirmation: Type.Union([Type.Literal("not_required"), Type.Literal("required")]),
    mutationAuthorized: Type.Literal(false),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type OwnerIntentProposal = Static<typeof OwnerIntentProposalSchema>;

const CLASSIFIERS: Array<{
  layer: Exclude<CanonicalOwnerIntentLayer, "explanation">;
  patterns: RegExp[];
  consequence: OwnerIntentProposal["consequence"];
  summary: string;
}> = [
  {
    layer: "policy_exception",
    patterns: [/\bexception\b/i, /\boverride\b/i, /\bdespite (?:the )?(?:rule|policy|failure)\b/i],
    consequence: "policy",
    summary: "Would authorize a disclosed departure from an otherwise governing rule.",
  },
  {
    layer: "commitment",
    patterns: [
      /\b(?:always|never) (?:change|alter|omit|move|revoice)\b/i,
      /\bprotect this\b/i,
      /\bkeep this (?:exactly|in future|from now on)\b/i,
    ],
    consequence: "lineage",
    summary: "Would protect selected Owner intent across later regeneration.",
  },
  {
    layer: "personal_default_candidate",
    patterns: [/\b(?:my )?default\b/i, /\bgoing forward\b/i, /\bI (?:usually|generally) prefer\b/i],
    consequence: "lineage",
    summary: "Would propose a reusable personal default without changing behavior yet.",
  },
  {
    layer: "score_transcription",
    patterns: [
      /\b(?:OCR|transcription|source reading)\b/i,
      /\bsource (?:note|pitch|rhythm|figure|text) is wrong\b/i,
      /\bmisread\b/i,
    ],
    consequence: "lineage",
    summary: "Would correct source truth and stale every dependent derivation in scope.",
  },
  {
    layer: "analysis_claim",
    patterns: [
      /\b(?:analysis|principal voice|lead voice|cadence|texture|counterpoint) is wrong\b/i,
      /\breclassify (?:the )?(?:voice|cadence|texture|passage)\b/i,
    ],
    consequence: "lineage",
    summary: "Would version a musicological Analysis Claim and stale dependent planning.",
  },
  {
    layer: "arrangement_plan",
    patterns: [
      /\b(?:plan|arrangement design)\b/i,
      /\b(?:preserve|omit|reduce|redistribute|transpose) (?:the )?(?:voice|bass|harmony|section|passage|melody)\b/i,
    ],
    consequence: "lineage",
    summary: "Would revise family design intent and stale dependent searches and scores.",
  },
  {
    layer: "performance_interpretation",
    patterns: [
      /\b(?:tempo|rubato|articulation|inequality|swing|playback)\b/i,
      /\bplay (?:it|this) (?:faster|slower|more|less)\b/i,
    ],
    consequence: "local",
    summary: "Would create a separate playback interpretation without changing notation.",
  },
  {
    layer: "arrangement_score",
    patterns: [
      /\b(?:change|edit|replace|move) (?:this|these|the) (?:note|notes|pitch|rhythm|fret|position|chord)\b/i,
      /\bmake (?:this|these) (?:note|notes|chord)\b/i,
    ],
    consequence: "local",
    summary: "Would propose an exact new Arrangement Score version in the selected scope.",
  },
];

const EXPLANATION_PATTERNS = [
  /^\s*(?:why|what|how|where|which|explain|describe|analy[sz]e|tell me|show me)\b/i,
  /^\s*(?:give|offer|provide) me (?:interactive )?(?:musical )?(?:feedback|analysis)\b/i,
  /\?\s*$/,
];

export function classifyOwnerIntent(input: {
  id: string;
  request: string;
  anchor: OwnerIntentAnchor;
  modelProposedLayer?: CanonicalOwnerIntentLayer;
}): OwnerIntentProposal {
  assertAuthorityPathRuntime("authority.parameter.owner-intent-and-edit", "production");
  const request = input.request.trim();
  if (!request) throw new Error("Owner request must not be empty");
  const matched = CLASSIFIERS.filter((classifier) =>
    classifier.patterns.some((pattern) => pattern.test(request))
  );
  const unique = [...new Set(matched.map((classifier) => classifier.layer))];
  const explanation = EXPLANATION_PATTERNS.some((pattern) => pattern.test(request));
  if (unique.length === 0 && explanation) {
    return {
      id: input.id,
      request,
      anchor: input.anchor,
      proposedLayer: "explanation",
      alternatives: [],
      resolution: "resolved",
      consequence: "none",
      consequenceSummary: "Explains the selected evidence without changing canonical state.",
      confirmation: "not_required",
      mutationAuthorized: false,
      rationale: "The request asks for information and contains no mutation instruction.",
    };
  }
  if (unique.length === 1 && !explanation) {
    const classifier = matched.find((candidate) => candidate.layer === unique[0])!;
    return {
      id: input.id,
      request,
      anchor: input.anchor,
      proposedLayer: classifier.layer,
      alternatives: [],
      resolution: "resolved",
      consequence: classifier.consequence,
      consequenceSummary: classifier.summary,
      confirmation: "required",
      mutationAuthorized: false,
      rationale: `The request matches the ${classifier.layer.replaceAll("_", " ")} ownership boundary.`,
    };
  }
  const alternatives: CanonicalOwnerIntentLayer[] = [...unique];
  if (explanation) alternatives.push("explanation");
  if (input.modelProposedLayer && !alternatives.includes(input.modelProposedLayer)) {
    alternatives.push(input.modelProposedLayer);
  }
  if (alternatives.length === 0) {
    alternatives.push(
      "score_transcription",
      "analysis_claim",
      "arrangement_plan",
      "arrangement_score",
      "performance_interpretation",
      "commitment",
      "policy_exception",
      "personal_default_candidate",
      "explanation"
    );
  }
  return {
    id: input.id,
    request,
    anchor: input.anchor,
    alternatives,
    resolution: "ambiguous",
    consequence: alternatives.includes("policy_exception") ? "policy" : "lineage",
    consequenceSummary:
      "The request crosses or does not uniquely identify a canonical ownership boundary.",
    confirmation: "required",
    mutationAuthorized: false,
    rationale: input.modelProposedLayer
      ? "A model suggestion is retained only as an alternative; the Owner must resolve the layer."
      : "The Owner must choose the intended canonical layer before this request can proceed.",
  };
}
