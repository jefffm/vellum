import { Type, type Static } from "@sinclair/typebox";

const Id = Type.String({ minLength: 3 });
const DateTime = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}T" });
const Scope = Type.Record(Type.String(), Type.String());

export const OwnerChoiceSchema = Type.Object({
  id: Id,
  workspaceId: Id,
  dimension: Type.String({ minLength: 1 }),
  value: Type.Unknown(),
  scope: Scope,
  createdAt: DateTime,
});
export type OwnerChoice = Static<typeof OwnerChoiceSchema>;

export const PersonalDefaultCandidateSchema = Type.Object({
  id: Id,
  dimension: Type.String({ minLength: 1 }),
  value: Type.Unknown(),
  scope: Scope,
  evidenceChoiceIds: Type.Array(Id, { minItems: 1 }),
  status: Type.Union([
    Type.Literal("proposed"),
    Type.Literal("approved"),
    Type.Literal("rejected"),
  ]),
  createdAt: DateTime,
  resolvedAt: Type.Optional(DateTime),
});
export type PersonalDefaultCandidate = Static<typeof PersonalDefaultCandidateSchema>;

export const PersonalDefaultSchema = Type.Object({
  id: Id,
  candidateId: Id,
  dimension: Type.String({ minLength: 1 }),
  value: Type.Unknown(),
  scope: Scope,
  status: Type.Union([Type.Literal("active"), Type.Literal("released")]),
  createdAt: DateTime,
  releasedAt: Type.Optional(DateTime),
});
export type PersonalDefault = Static<typeof PersonalDefaultSchema>;

export const OwnerReferenceSchema = Type.Object({
  id: Id,
  title: Type.String({ minLength: 1 }),
  citation: Type.String({ minLength: 1 }),
  mimeType: Type.String({ minLength: 1 }),
  sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  byteLength: Type.Optional(Type.Integer({ minimum: 1 })),
  storedPath: Type.String({ minLength: 1 }),
  authorityState: Type.Literal("raw_staged"),
  activationAllowed: Type.Literal(false),
  createdAt: DateTime,
});
export type OwnerReference = Static<typeof OwnerReferenceSchema>;

export const KnowledgeScopeSchema = Type.Object({
  period: Type.String({ minLength: 1 }),
  region: Type.String({ minLength: 1 }),
  genre: Type.String({ minLength: 1 }),
  instrument: Type.String({ minLength: 1 }),
  ensembleRole: Type.String({ minLength: 1 }),
});

export const KnowledgeCandidateSchema = Type.Object({
  id: Id,
  statement: Type.String({ minLength: 1 }),
  scope: KnowledgeScopeSchema,
  referenceId: Id,
  citationLocator: Type.String({ minLength: 1 }),
  status: Type.Union([
    Type.Literal("proposed"),
    Type.Literal("promoted"),
    Type.Literal("rejected"),
  ]),
  createdAt: DateTime,
  reviewedAt: Type.Optional(DateTime),
});
export type KnowledgeCandidate = Static<typeof KnowledgeCandidateSchema>;

export const HistoricalPracticeClaimSchema = Type.Object({
  id: Id,
  statement: Type.String({ minLength: 1 }),
  scope: KnowledgeScopeSchema,
  authority: Type.Union([
    Type.Literal("documented_practice"),
    Type.Literal("modern_editorial_convention"),
    Type.Literal("vellum_heuristic"),
  ]),
  referenceId: Id,
  citationLocator: Type.String({ minLength: 1 }),
  sourceCandidateId: Id,
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  status: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("released")])),
  correctedClaimId: Type.Optional(Id),
  reviewedAt: DateTime,
  releasedAt: Type.Optional(DateTime),
});
export type HistoricalPracticeClaim = Static<typeof HistoricalPracticeClaimSchema>;

export const KnowledgePackSchema = Type.Object({
  id: Id,
  name: Type.String({ minLength: 1 }),
  version: Type.Integer({ minimum: 1 }),
  reviewed: Type.Literal(true),
  claimIds: Type.Array(Id),
  createdAt: DateTime,
  updatedAt: DateTime,
});
export type KnowledgePack = Static<typeof KnowledgePackSchema>;
