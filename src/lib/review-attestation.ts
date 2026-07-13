import { createHash } from "node:crypto";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const Id = Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9._:-]*$", minLength: 1 });
const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoDate = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const ReviewArtifactRefSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("lilypond"),
      Type.Literal("svg"),
      Type.Literal("pdf"),
      Type.Literal("midi"),
      Type.Literal("audio_preview"),
    ]),
    relativePath: Type.String({ minLength: 1 }),
    sha256: Digest,
  },
  { additionalProperties: false }
);

export const HumanReviewerRoleSchema = Type.Union([
  Type.Literal("owner"),
  Type.Literal("target_player"),
  Type.Literal("historical_specialist"),
  Type.Literal("engraving_editor"),
  Type.Literal("baseline_reviewer"),
  Type.Literal("architecture_reviewer"),
]);
export type HumanReviewerRole = Static<typeof HumanReviewerRoleSchema>;

export const ReviewRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    tracerId: Type.Union([Type.Literal("T41"), Type.Literal("T42"), Type.Literal("T43")]),
    protocol: Type.Object(
      { id: Type.Literal("T40.review"), version: Type.Literal(1), digest: Digest },
      { additionalProperties: false }
    ),
    sourceDigest: Digest,
    arrangementScoreRef: Type.Object(
      { id: Id, version: Type.Integer({ minimum: 1 }), digest: Digest },
      { additionalProperties: false }
    ),
    performanceBriefRef: Type.Object({ id: Id, digest: Digest }, { additionalProperties: false }),
    instrument: Type.Object(
      { profileId: Id, instanceDigest: Digest, modeledDescription: Type.String({ minLength: 1 }) },
      { additionalProperties: false }
    ),
    artifacts: Type.Array(ReviewArtifactRefSchema, { minItems: 5, maxItems: 5 }),
    requiredRoles: Type.Array(HumanReviewerRoleSchema, { minItems: 1, uniqueItems: true }),
    requiredDimensions: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    roleAssignments: Type.Array(
      Type.Object(
        {
          dimension: Type.String({ minLength: 1 }),
          authorizedRoles: Type.Array(HumanReviewerRoleSchema, {
            minItems: 1,
            uniqueItems: true,
          }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    staleWhen: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type ReviewRequest = Static<typeof ReviewRequestSchema>;

export const ReviewAttestationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Id,
    reviewRequestId: Id,
    reviewRequestDigest: Digest,
    artifactDigests: Type.Array(Digest, { minItems: 5, maxItems: 5, uniqueItems: true }),
    reviewer: Type.Object(
      {
        pseudonymousId: Id,
        role: HumanReviewerRoleSchema,
        qualifications: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        conflictsOfInterest: Type.Array(Type.String({ minLength: 1 })),
        consentedToLocalRetention: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    evidenceBasis: Type.Array(
      Type.Union([
        Type.Literal("notation"),
        Type.Literal("listening"),
        Type.Literal("physical_playing"),
        Type.Literal("documentary_sources"),
        Type.Literal("owner_use"),
      ]),
      { minItems: 1, uniqueItems: true }
    ),
    actualInstrument: Type.Optional(
      Type.Object(
        {
          description: Type.String({ minLength: 1 }),
          tuningAndSetup: Type.String({ minLength: 1 }),
          scaleLengthMm: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        },
        { additionalProperties: false }
      )
    ),
    actualContext: Type.Object(
      {
        tempoBpm: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        repetitions: Type.Optional(Type.Integer({ minimum: 1 })),
        description: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    result: Type.Union([
      Type.Literal("accept"),
      Type.Literal("reject"),
      Type.Literal("accept_with_limitations"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    observations: Type.Array(
      Type.Object(
        {
          dimension: Type.String({ minLength: 1 }),
          outcome: Type.Union([
            Type.Literal("supports"),
            Type.Literal("concern"),
            Type.Literal("blocks"),
            Type.Literal("not_applicable"),
          ]),
          scoreAnchor: Type.String({ minLength: 1 }),
          rationale: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    limitations: Type.Array(Type.String({ minLength: 1 })),
    rationale: Type.String({ minLength: 1 }),
    staleDependenciesConfirmed: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type ReviewAttestation = Static<typeof ReviewAttestationSchema>;

export function digestReviewRequest(request: ReviewRequest): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(request)))
    .digest("hex");
}

export function decodeReviewRequest(value: unknown): ReviewRequest {
  const request = Value.Decode(ReviewRequestSchema, value);
  const assignedDimensions = request.roleAssignments.map(({ dimension }) => dimension);
  if (
    new Set(assignedDimensions).size !== assignedDimensions.length ||
    request.requiredDimensions.some((dimension) => !assignedDimensions.includes(dimension)) ||
    assignedDimensions.some((dimension) => !request.requiredDimensions.includes(dimension))
  ) {
    throw new Error(
      "Review request role assignments must cover every declared dimension exactly once"
    );
  }
  const assignedRoles = new Set(
    request.roleAssignments.flatMap(({ authorizedRoles }) => authorizedRoles)
  );
  if (request.requiredRoles.some((role) => !assignedRoles.has(role))) {
    throw new Error("Review request leaves a required reviewer role without authority");
  }
  return request;
}

export function validateReviewAttestation(
  requestValue: unknown,
  attestationValue: unknown
): ReviewAttestation {
  const request = decodeReviewRequest(requestValue);
  const attestation = Value.Decode(ReviewAttestationSchema, attestationValue);
  if (
    attestation.reviewRequestId !== request.id ||
    attestation.reviewRequestDigest !== digestReviewRequest(request)
  ) {
    throw new Error("Review attestation references a stale or incompatible request");
  }
  const expectedArtifacts = request.artifacts.map(({ sha256 }) => sha256).sort();
  if (
    JSON.stringify([...attestation.artifactDigests].sort()) !== JSON.stringify(expectedArtifacts)
  ) {
    throw new Error("Review attestation does not cover the exact artifact set");
  }
  if (!request.requiredRoles.includes(attestation.reviewer.role)) {
    throw new Error(`${attestation.reviewer.role} is not authorized by this review request`);
  }
  const unknownDimensions = attestation.observations
    .map(({ dimension }) => dimension)
    .filter((dimension) => !request.requiredDimensions.includes(dimension));
  if (unknownDimensions.length > 0) {
    throw new Error(
      `Review attestation cites undeclared dimensions: ${unknownDimensions.join(", ")}`
    );
  }
  for (const observation of attestation.observations) {
    const assignment = request.roleAssignments.find(
      ({ dimension }) => dimension === observation.dimension
    );
    if (!assignment?.authorizedRoles.includes(attestation.reviewer.role)) {
      throw new Error(
        `${attestation.reviewer.role} is not authorized for ${observation.dimension}`
      );
    }
  }
  if (
    attestation.reviewer.role === "target_player" &&
    (!attestation.evidenceBasis.includes("physical_playing") || !attestation.actualInstrument)
  ) {
    throw new Error("Target-player attestation requires physical playing on a declared instrument");
  }
  if (
    attestation.reviewer.role === "historical_specialist" &&
    !attestation.evidenceBasis.includes("documentary_sources")
  ) {
    throw new Error("Historical attestation requires documentary-source evidence");
  }
  if (attestation.result === "accept_with_limitations" && attestation.limitations.length === 0) {
    throw new Error("Qualified acceptance requires explicit limitations");
  }
  if (
    request.staleWhen.some(
      (dependency) => !attestation.staleDependenciesConfirmed.includes(dependency)
    )
  ) {
    throw new Error("Review attestation omits a declared staleness dependency");
  }
  return attestation;
}

export function validateReviewCoverage(
  requestValue: unknown,
  attestationValues: unknown[]
): {
  status: "accepted" | "rejected" | "incomplete";
  missingRoles: HumanReviewerRole[];
  missingDimensions: string[];
} {
  const request = decodeReviewRequest(requestValue);
  const attestations = attestationValues.map((value) => validateReviewAttestation(request, value));
  const roles = new Set(attestations.map(({ reviewer }) => reviewer.role));
  const missingRoles = request.requiredRoles.filter((role) => !roles.has(role));
  const observedDimensions = new Set(
    attestations.flatMap(({ observations }) => observations.map(({ dimension }) => dimension))
  );
  const missingDimensions = request.requiredDimensions.filter(
    (dimension) => !observedDimensions.has(dimension)
  );
  if (missingRoles.length > 0 || missingDimensions.length > 0) {
    return { status: "incomplete", missingRoles, missingDimensions };
  }
  return {
    status: attestations.some(({ result }) => result === "reject") ? "rejected" : "accepted",
    missingRoles: [],
    missingDimensions: [],
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}
