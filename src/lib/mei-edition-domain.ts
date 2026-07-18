import { Type, type Static } from "@sinclair/typebox";

const EditionIdSchema = Type.String({ pattern: "^edition\\.[a-f0-9-]{16,}$" });
const SourceIdSchema = Type.String({ pattern: "^source\\.[a-f0-9-]{16,}$" });
const BatchIdSchema = Type.String({ pattern: "^correction-batch\\.[a-f0-9-]{16,}$" });
const MeiIdSchema = Type.String({ pattern: "^[A-Za-z_][A-Za-z0-9_.:-]*$" });
const IsoDateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const FacsimileRegionSchema = Type.Object(
  {
    page: Type.Integer({ minimum: 1 }),
    x: Type.Number({ minimum: 0, maximum: 1 }),
    y: Type.Number({ minimum: 0, maximum: 1 }),
    width: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
    height: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
  },
  { additionalProperties: false }
);

export const DiplomaticTokenSchema = Type.Object(
  {
    id: MeiIdSchema,
    kind: Type.Union([
      Type.Literal("tablature"),
      Type.Literal("rhythm"),
      Type.Literal("barline"),
      Type.Literal("ornament"),
      Type.Literal("text"),
      Type.Literal("other"),
    ]),
    region: FacsimileRegionSchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    alternatives: Type.Array(Type.String({ minLength: 1 })),
    critical: Type.Boolean(),
  },
  { additionalProperties: false }
);

export const MeiAttributeChangeSchema = Type.Object(
  {
    tokenId: MeiIdSchema,
    attribute: Type.Union([
      Type.Literal("tab.course"),
      Type.Literal("tab.fret"),
      Type.Literal("dur"),
      Type.Literal("dots"),
    ]),
    expectedValue: Type.Optional(Type.String()),
    replacementValue: Type.Optional(Type.String()),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const CorrectionBatchCommandSchema = Type.Object(
  {
    id: BatchIdSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    layer: Type.Literal("transcription"),
    changes: Type.Array(MeiAttributeChangeSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export const CorrectionBatchRecordSchema = Type.Object(
  {
    id: BatchIdSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    layer: Type.Literal("transcription"),
    changes: Type.Array(MeiAttributeChangeSchema, { minItems: 1 }),
    committedAt: IsoDateSchema,
    inverseOfBatchId: Type.Optional(BatchIdSchema),
  },
  { additionalProperties: false }
);

export const MeiEditionVersionSchema = Type.Object(
  {
    editionId: EditionIdSchema,
    version: Type.Integer({ minimum: 1 }),
    parentVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    sourceArtifactId: SourceIdSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1 }),
    mei: Type.String({ minLength: 1 }),
    tokens: Type.Array(DiplomaticTokenSchema, { minItems: 1 }),
    extraction: Type.Object(
      {
        backendId: Type.String({ minLength: 1 }),
        backendVersion: Type.String({ minLength: 1 }),
        diagnostics: Type.Array(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false }
    ),
    correctionBatch: Type.Optional(CorrectionBatchRecordSchema),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const CreateMeiEditionCommandSchema = Type.Object(
  {
    sourceArtifactId: SourceIdSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1 }),
    mei: Type.String({ minLength: 1 }),
    tokens: Type.Array(DiplomaticTokenSchema, { minItems: 1 }),
    extraction: Type.Object(
      {
        backendId: Type.String({ minLength: 1 }),
        backendVersion: Type.String({ minLength: 1 }),
        diagnostics: Type.Array(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export type FacsimileRegion = Static<typeof FacsimileRegionSchema>;
export type DiplomaticToken = Static<typeof DiplomaticTokenSchema>;
export type MeiAttributeChange = Static<typeof MeiAttributeChangeSchema>;
export type CorrectionBatchCommand = Static<typeof CorrectionBatchCommandSchema>;
export type CorrectionBatchRecord = Static<typeof CorrectionBatchRecordSchema>;
export type MeiEditionVersion = Static<typeof MeiEditionVersionSchema>;
export type CreateMeiEditionCommand = Static<typeof CreateMeiEditionCommandSchema>;
