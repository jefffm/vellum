import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { authorizeTrackedSourceOperation } from "../../lib/tracked-source-quarantine.js";

const Id = Type.String({ minLength: 1 });
const NonEmpty = Type.String({ minLength: 1 });
const Sha256 = Type.String({ pattern: "^[a-f0-9]{64}$" });
const TargetIdSchema = Type.Union([
  Type.Literal("baroque-guitar-5"),
  Type.Literal("baroque-lute-13"),
  Type.Literal("classical-guitar-6"),
]);

const SourceSchema = Type.Object(
  {
    path: NonEmpty,
    sha256: Sha256,
    mediaType: NonEmpty,
    origin: NonEmpty,
    license: NonEmpty,
    provenancePath: NonEmpty,
    rightsArtifactId: Id,
    rightsSubstitutionId: Type.Optional(Id),
  },
  { additionalProperties: false }
);

const InvariantSchema = Type.Object(
  {
    id: Id,
    category: NonEmpty,
    targetIds: Type.Array(TargetIdSchema, { minItems: 1, uniqueItems: true }),
    assertion: NonEmpty,
    allowedTransformations: Type.Array(NonEmpty),
    forbidden: Type.Array(NonEmpty, { minItems: 1 }),
  },
  { additionalProperties: false }
);

const GoldenCaseSchema = Type.Object(
  {
    id: Id,
    source: SourceSchema,
    reviewedTruth: Type.Object(
      {
        reviewStatus: Type.Literal("repository_reviewed"),
        principalVoice: NonEmpty,
        voices: Type.Array(NonEmpty, { minItems: 1, uniqueItems: true }),
        facts: Type.Array(NonEmpty, { minItems: 1 }),
      },
      { additionalProperties: false }
    ),
    analysis: Type.Object(
      {
        texture: NonEmpty,
        concepts: Type.Array(NonEmpty, { minItems: 1, uniqueItems: true }),
        cadenceGoals: Type.Array(NonEmpty),
      },
      { additionalProperties: false }
    ),
    plans: Type.Array(
      Type.Object(
        {
          targetId: TargetIdSchema,
          decisions: Type.Array(NonEmpty, { minItems: 1 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    invariants: Type.Array(InvariantSchema, { minItems: 1 }),
    mutations: Type.Array(
      Type.Object(
        {
          id: Id,
          operation: NonEmpty,
          expectedInvariantIds: Type.Array(Id, { minItems: 1, uniqueItems: true }),
          expectedDisposition: Type.Literal("hard_fail"),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    acceptableAlternatives: Type.Array(
      Type.Object(
        {
          id: Id,
          status: Type.Literal("reviewed_valid_boundary"),
          description: NonEmpty,
        },
        { additionalProperties: false }
      ),
      { minItems: 2 }
    ),
  },
  { additionalProperties: false }
);

export const PrivateFixtureExportSchema = Type.Object(
  {
    workspaceId: Id,
    contentSha256: Sha256,
    license: NonEmpty,
    reviewRef: NonEmpty,
    deliberatelySelected: Type.Literal(true),
    privacyReviewed: Type.Literal(true),
    rightsArtifactId: Id,
    rightsSubstitutionId: Type.Optional(Id),
  },
  { additionalProperties: false }
);
export type PrivateFixtureExport = Static<typeof PrivateFixtureExportSchema>;

export const GoldenCorpusSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    dataset: Type.Object(
      {
        id: Id,
        version: Type.Integer({ minimum: 1 }),
        role: Type.Literal("held_out"),
        privateWorkspaceExports: Type.Array(PrivateFixtureExportSchema),
      },
      { additionalProperties: false }
    ),
    cases: Type.Array(GoldenCaseSchema, { minItems: 4 }),
  },
  { additionalProperties: false }
);

export type GoldenCorpus = Static<typeof GoldenCorpusSchema>;
export type GoldenCase = Static<typeof GoldenCaseSchema>;

export function loadGoldenCorpus(projectRoot = process.cwd()): GoldenCorpus {
  const manifestPath = path.join(
    projectRoot,
    "test/fixtures/evaluation/three-target-golden-corpus.json"
  );
  const corpus = Value.Decode(GoldenCorpusSchema, JSON.parse(readFileSync(manifestPath, "utf8")));
  validateGoldenCorpus(corpus, projectRoot);
  return corpus;
}

export function validateGoldenCandidate(
  evaluationCase: GoldenCase,
  input: { satisfiedInvariantIds: string[]; referenceAlternativeId?: string }
): { status: "pass" | "fail"; missingInvariantIds: string[]; rationale: string } {
  const satisfied = new Set(input.satisfiedInvariantIds);
  const missingInvariantIds = evaluationCase.invariants
    .map(({ id }) => id)
    .filter((id) => !satisfied.has(id));
  if (
    input.referenceAlternativeId &&
    !evaluationCase.acceptableAlternatives.some(({ id }) => id === input.referenceAlternativeId)
  ) {
    throw new Error(`Unknown acceptable alternative: ${input.referenceAlternativeId}`);
  }
  return {
    status: missingInvariantIds.length ? "fail" : "pass",
    missingInvariantIds,
    rationale:
      missingInvariantIds.length === 0
        ? "Candidate satisfies the declared boundaries; reference-output equality is not required."
        : "Candidate violates one or more declared invariant boundaries.",
  };
}

export function goldenGeneratorVisibleInput(evaluationCase: GoldenCase): {
  caseId: string;
  source: Pick<GoldenCase["source"], "path" | "sha256" | "mediaType">;
} {
  return {
    caseId: evaluationCase.id,
    source: {
      path: evaluationCase.source.path,
      sha256: evaluationCase.source.sha256,
      mediaType: evaluationCase.source.mediaType,
    },
  };
}

export function validatePrivateFixtureExport(input: unknown): PrivateFixtureExport {
  const value = Value.Decode(PrivateFixtureExportSchema, input);
  requireTrackedSourceAuthorization(
    value.rightsArtifactId,
    value.contentSha256,
    "export",
    value.rightsSubstitutionId
  );
  requireTrackedSourceAuthorization(
    value.rightsArtifactId,
    value.contentSha256,
    "fixture",
    value.rightsSubstitutionId
  );
  return value;
}

export function validateGoldenCorpus(corpus: GoldenCorpus, projectRoot = process.cwd()): void {
  const caseIds = unique(
    corpus.cases.map(({ id }) => id),
    "Golden case"
  );
  void caseIds;
  for (const evaluationCase of corpus.cases) {
    const sourcePath = safeFixturePath(projectRoot, evaluationCase.source.path);
    const provenancePath = safeFixturePath(projectRoot, evaluationCase.source.provenancePath);
    const bytes = readFileSync(sourcePath);
    readFileSync(provenancePath);
    if (createHash("sha256").update(bytes).digest("hex") !== evaluationCase.source.sha256) {
      throw new Error(`Golden source digest mismatch: ${evaluationCase.id}`);
    }
    requireTrackedSourceAuthorization(
      evaluationCase.source.rightsArtifactId,
      evaluationCase.source.sha256,
      "fixture",
      evaluationCase.source.rightsSubstitutionId
    );
    if (
      /owner workspace/i.test(evaluationCase.source.origin) &&
      !corpus.dataset.privateWorkspaceExports.some(
        ({ contentSha256 }) => contentSha256 === evaluationCase.source.sha256
      )
    ) {
      throw new Error(
        `Private Golden source lacks a deliberate licensed export: ${evaluationCase.id}`
      );
    }
    const targetIds = unique(
      evaluationCase.plans.map(({ targetId }) => targetId),
      `Plan target in ${evaluationCase.id}`
    );
    const invariantIds = new Set(
      unique(
        evaluationCase.invariants.map(({ id }) => id),
        `Invariant in ${evaluationCase.id}`
      )
    );
    for (const mutation of evaluationCase.mutations) {
      if (mutation.expectedInvariantIds.some((id) => !invariantIds.has(id))) {
        throw new Error(`Mutation references an unknown invariant: ${mutation.id}`);
      }
    }
    for (const invariant of evaluationCase.invariants) {
      if (invariant.targetIds.some((id) => !targetIds.includes(id))) {
        throw new Error(`Invariant target lacks an independent Plan: ${invariant.id}`);
      }
    }
  }
  corpus.dataset.privateWorkspaceExports.forEach(validatePrivateFixtureExport);

  const greensleeves = requiredCase(corpus, "golden.greensleeves-cross-target");
  requireTargets(greensleeves, ["baroque-guitar-5", "baroque-lute-13", "classical-guitar-6"]);
  requireConcepts(requiredCase(corpus, "golden.baroque-guitar-transition"), [
    "alfabeto",
    "reentrant_stringing",
    "transition_cost",
  ]);
  requireConcepts(requiredCase(corpus, "golden.baroque-lute-stopped-diapason"), [
    "stopped_course",
    "diapason",
    "course_identity",
  ]);
  requireConcepts(requiredCase(corpus, "golden.classical-guitar-polyphony"), [
    "counterpoint",
    "voice_duration",
    "left_hand_fingering",
    "standard_notation",
  ]);
}

function requireTrackedSourceAuthorization(
  artifactId: string,
  sha256: string,
  operation: "fixture" | "export",
  substitutionId?: string
): void {
  const resolution = authorizeTrackedSourceOperation({
    artifactId,
    sha256,
    operation,
    ...(substitutionId ? { substitutionId } : {}),
  });
  const resolvedSha256 = resolution.resolvedSha256 ?? resolution.artifactSha256;
  const exactRequestBinding =
    resolution.artifactId === artifactId &&
    resolution.artifactSha256 === sha256 &&
    resolution.operation === operation;
  const exactSubstitutionBinding = substitutionId
    ? resolution.substitutionId === substitutionId
    : !resolution.substitutionId &&
      resolution.resolvedArtifactId === artifactId &&
      resolvedSha256 === sha256;
  if (
    resolution.outcome !== "allow" ||
    !resolution.decisionId ||
    !resolution.resolvedArtifactId ||
    !resolution.resolvedSha256 ||
    resolution.provenanceEvidenceRefs.length === 0 ||
    !exactRequestBinding ||
    !exactSubstitutionBinding
  ) {
    const reason =
      resolution.outcome !== "allow"
        ? resolution.outcome
        : "incomplete or mismatched allow decision";
    throw new Error(`Tracked source ${artifactId} is not authorized for ${operation}: ${reason}`);
  }
}

function safeFixturePath(projectRoot: string, relativePath: string): string {
  const fixtureRoot = path.resolve(projectRoot, "test/fixtures");
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(`${fixtureRoot}${path.sep}`)) {
    throw new Error(`Golden corpus path escapes test/fixtures: ${relativePath}`);
  }
  return resolved;
}

function requiredCase(corpus: GoldenCorpus, id: string): GoldenCase {
  const found = corpus.cases.find((evaluationCase) => evaluationCase.id === id);
  if (!found) throw new Error(`Golden corpus is missing required case: ${id}`);
  return found;
}

function requireTargets(
  evaluationCase: GoldenCase,
  required: GoldenCase["plans"][number]["targetId"][]
) {
  const actual = new Set(evaluationCase.plans.map(({ targetId }) => targetId));
  if (required.some((target) => !actual.has(target))) {
    throw new Error(`${evaluationCase.id} does not cover all three targets`);
  }
}

function requireConcepts(evaluationCase: GoldenCase, required: string[]): void {
  const actual = new Set(evaluationCase.analysis.concepts);
  if (required.some((concept) => !actual.has(concept))) {
    throw new Error(`${evaluationCase.id} omits required target-specific evidence`);
  }
}

function unique(values: string[], label: string): string[] {
  if (new Set(values).size !== values.length) throw new Error(`${label} identities must be unique`);
  return values;
}
