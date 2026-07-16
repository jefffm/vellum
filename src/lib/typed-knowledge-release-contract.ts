import { Type, type Static } from "@sinclair/typebox";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { ReferencePageAtlasOpaqueHmacRefSchema } from "./reference-page-atlas-contract.js";

const Strict = { additionalProperties: false } as const;
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const SafeIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const KnowledgeRecordRefSchema = Type.Object({ id: SafeIdSchema, digest: DigestSchema }, Strict);

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
export const TypedKnowledgeReleaseSelectionSchema = Type.Object(
  {
    workbenchSnapshotRef: ReferencePageAtlasOpaqueHmacRefSchema,
    workbenchCardRef: ReferencePageAtlasOpaqueHmacRefSchema,
    operationRef: ReferencePageAtlasOpaqueHmacRefSchema,
    expectedProjectionRef: ReferencePageAtlasOpaqueHmacRefSchema,
    candidateRef: ReferencePageAtlasOpaqueHmacRefSchema,
  },
  Strict
);
export type TypedKnowledgeReleaseSelection = Static<typeof TypedKnowledgeReleaseSelectionSchema>;

export const TypedKnowledgePublicationGenerationRefSchema = Type.Object(
  {
    id: SafeIdSchema,
    digest: DigestSchema,
    revision: Type.Integer({ minimum: 1 }),
  },
  Strict
);
export type TypedKnowledgePublicationGenerationRef = Static<
  typeof TypedKnowledgePublicationGenerationRefSchema
>;

export const TypedKnowledgeReleasePreviewRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("preview"),
    selection: TypedKnowledgeReleaseSelectionSchema,
  },
  Strict
);
export type TypedKnowledgeReleasePreviewRequest = Static<
  typeof TypedKnowledgeReleasePreviewRequestSchema
>;

export const TypedKnowledgeReleasePublishRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("publish"),
    selection: TypedKnowledgeReleaseSelectionSchema,
    expectedPublicationHead: Type.Union([
      TypedKnowledgePublicationGenerationRefSchema,
      Type.Null(),
    ]),
  },
  Strict
);
export type TypedKnowledgeReleasePublishRequest = Static<
  typeof TypedKnowledgeReleasePublishRequestSchema
>;

export const TypedKnowledgeReleaseOperationRequestSchema = Type.Union([
  TypedKnowledgeReleasePreviewRequestSchema,
  TypedKnowledgeReleasePublishRequestSchema,
]);
export type TypedKnowledgeReleaseOperationRequest = Static<
  typeof TypedKnowledgeReleaseOperationRequestSchema
>;

const CandidateProjectionSchema = Type.Object(
  {
    mappingCandidateRef: KnowledgeRecordRefSchema,
    course13QuestionCandidateRef: KnowledgeRecordRefSchema,
    authorityLane: Type.Literal("historical_practice"),
    activationAllowed: Type.Literal(false),
  },
  Strict
);

const DraftProjectionSchema = Type.Object(
  {
    draftRef: KnowledgeRecordRefSchema,
    contentMerkleRoot: DigestSchema,
    closureMerkleRoot: DigestSchema,
  },
  Strict
);

const ReleaseProjectionSchema = Type.Object(
  {
    releaseRef: KnowledgeRecordRefSchema,
    sequence: Type.Integer({ minimum: 1 }),
    sourceDraftRef: KnowledgeRecordRefSchema,
    contentMerkleRoot: DigestSchema,
    merkleRoot: DigestSchema,
    predecessorReleaseRef: Type.Union([KnowledgeRecordRefSchema, Type.Null()]),
    successorState: Type.Union([Type.Literal("initial"), Type.Literal("successor")]),
  },
  Strict
);

const PublicationCapabilitySchema = Type.Union([
  Type.Object(
    {
      state: Type.Literal("configured"),
      authorityCheck: Type.Literal("required_on_publish"),
    },
    Strict
  ),
  Type.Object(
    {
      state: Type.Literal("unavailable"),
      missingPrerequisites: Type.Union([
        Type.Tuple([Type.Literal("pack_citation_authority")]),
        Type.Tuple([Type.Literal("system_identity")]),
        Type.Tuple([Type.Literal("pack_citation_authority"), Type.Literal("system_identity")]),
      ]),
    },
    Strict
  ),
]);

const OrdinaryActivationProjectionSchema = Type.Object(
  {
    state: Type.Literal("not_evaluated"),
    defaultActivation: Type.Literal("deny"),
  },
  Strict
);

const SharedProjectionProperties = {
  schemaVersion: Type.Literal(1),
  selection: TypedKnowledgeReleaseSelectionSchema,
  candidate: CandidateProjectionSchema,
  draft: DraftProjectionSchema,
  release: ReleaseProjectionSchema,
  ordinaryActivation: OrdinaryActivationProjectionSchema,
} as const;

const CandidateReleaseProjectionSchema = Type.Object(
  {
    ...SharedProjectionProperties,
    publicationState: Type.Literal("candidate"),
    publicationOutcome: Type.Literal("preview_candidate"),
    publicationHead: Type.Union([TypedKnowledgePublicationGenerationRefSchema, Type.Null()]),
    publicationCapability: PublicationCapabilitySchema,
    packCitationAuthority: Type.Literal("not_evaluated"),
    testAttestation: Type.Object({ state: Type.Literal("not_issued") }, Strict),
  },
  Strict
);

const PublishedReleaseProjectionSchema = Type.Object(
  {
    ...SharedProjectionProperties,
    publicationState: Type.Literal("published"),
    publicationOutcome: Type.Union([
      Type.Literal("preview_existing"),
      Type.Literal("publish_committed"),
      Type.Literal("publish_idempotent"),
    ]),
    publicationHead: TypedKnowledgePublicationGenerationRefSchema,
    publicationCapability: PublicationCapabilitySchema,
    packCitationAuthority: Type.Literal("verified_for_publication"),
    testAttestation: Type.Object(
      {
        state: Type.Literal("issued_test_only"),
        attestationRef: KnowledgeRecordRefSchema,
        testPolicyRef: KnowledgeRecordRefSchema,
        humanAuthority: Type.Literal(false),
        historicalAuthority: Type.Literal(false),
        activationAuthority: Type.Literal(false),
      },
      Strict
    ),
  },
  Strict
);

export const TypedKnowledgeReleaseProjectionSchema = Type.Union([
  CandidateReleaseProjectionSchema,
  PublishedReleaseProjectionSchema,
]);
export type TypedKnowledgeReleaseProjection = Static<typeof TypedKnowledgeReleaseProjectionSchema>;
