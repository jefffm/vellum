import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { KnowledgeExecutionIdentitySchema } from "./knowledge-resolution-identity.js";
import {
  KnowledgeResolutionGenerationRefSchema,
  KnowledgeResolutionProjectionSchema,
  KnowledgeResolutionRefSchema,
} from "./knowledge-resolution-contract.js";
import { referenceSourceDigest } from "./reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const Id = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const Timestamp = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

export const KnowledgeResolverPreflightCheckNameSchema = Type.Union([
  Type.Literal("authority_registry"),
  Type.Literal("compatible_readers"),
  Type.Literal("migration"),
  Type.Literal("rights"),
  Type.Literal("rollback"),
  Type.Literal("shadow_comparison"),
]);

export const KnowledgeResolverPreflightCheckSchema = Type.Object(
  {
    check: KnowledgeResolverPreflightCheckNameSchema,
    status: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
    evidenceRefs: Type.Array(KnowledgeResolutionRefSchema),
    reasonCode: Id,
  },
  Strict
);

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");

export const KnowledgeResolverPreflightSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_resolver_preflight"),
    schemaVersion: Type.Literal(1),
    id: Id,
    basePublicationGenerationRef: KnowledgeResolutionGenerationRefSchema,
    checks: Type.Tuple([
      KnowledgeResolverPreflightCheckSchema,
      KnowledgeResolverPreflightCheckSchema,
      KnowledgeResolverPreflightCheckSchema,
      KnowledgeResolverPreflightCheckSchema,
      KnowledgeResolverPreflightCheckSchema,
      KnowledgeResolverPreflightCheckSchema,
    ]),
    result: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
    legacyBehaviorDigest: Digest,
    completeManifestBehaviorDigest: Digest,
    shadowDeltaDigest: Digest,
    rollbackStateDigest: Digest,
    projection: KnowledgeResolutionProjectionSchema,
    checkedAt: Timestamp,
    digest: Digest,
  },
  Strict
);
export type KnowledgeResolverPreflight = Static<typeof KnowledgeResolverPreflightSchema>;

export const KnowledgeResolverControlStateSchema = Type.Union([
  Type.Object(
    {
      recordKind: Type.Literal("knowledge_resolver_control_state"),
      schemaVersion: Type.Literal(1),
      id: Id,
      sequence: Type.Integer({ minimum: 1 }),
      transition: Type.Literal("cutover"),
      mode: Type.Literal("complete_manifest"),
      legacyActivationEnabled: Type.Literal(false),
      completeManifestResolverEnabled: Type.Literal(true),
      activeAuthorityHeadRef: KnowledgeResolutionRefSchema,
      cutoverProofManifestRef: KnowledgeResolutionRefSchema,
      activeExecutionIdentity: KnowledgeExecutionIdentitySchema,
      preflightRef: KnowledgeResolutionRefSchema,
      rollbackAuthorityHeadRef: KnowledgeResolutionRefSchema,
      priorControlStateRef: Type.Optional(KnowledgeResolutionRefSchema),
      createdAt: Timestamp,
      digest: Digest,
    },
    Strict
  ),
  Type.Object(
    {
      recordKind: Type.Literal("knowledge_resolver_control_state"),
      schemaVersion: Type.Literal(1),
      id: Id,
      sequence: Type.Integer({ minimum: 1 }),
      transition: Type.Literal("rollback"),
      mode: Type.Literal("legacy"),
      legacyActivationEnabled: Type.Literal(true),
      completeManifestResolverEnabled: Type.Literal(false),
      activeAuthorityHeadRef: KnowledgeResolutionRefSchema,
      rollbackOfRef: KnowledgeResolutionRefSchema,
      rollbackBasePublicationGenerationRef: KnowledgeResolutionGenerationRefSchema,
      priorControlStateRef: KnowledgeResolutionRefSchema,
      createdAt: Timestamp,
      digest: Digest,
    },
    Strict
  ),
]);
export type KnowledgeResolverControlState = Static<typeof KnowledgeResolverControlStateSchema>;

export type KnowledgeResolverActiveView = Readonly<
  | {
      mode: "legacy";
      legacyActivationEnabled: true;
      completeManifestResolverEnabled: false;
      activeAuthorityHeadRef: Static<typeof KnowledgeResolutionRefSchema>;
      publicationGenerationRef: Static<typeof KnowledgeResolutionGenerationRefSchema>;
      controlStateRef: Static<typeof KnowledgeResolutionRefSchema> | null;
    }
  | {
      mode: "complete_manifest";
      legacyActivationEnabled: false;
      completeManifestResolverEnabled: true;
      activeAuthorityHeadRef: Static<typeof KnowledgeResolutionRefSchema>;
      cutoverProofManifestRef: Static<typeof KnowledgeResolutionRefSchema>;
      activeExecutionIdentity: Static<typeof KnowledgeExecutionIdentitySchema>;
      publicationGenerationRef: Static<typeof KnowledgeResolutionGenerationRefSchema>;
      controlStateRef: Static<typeof KnowledgeResolutionRefSchema>;
    }
>;

export function buildCutoverRecord<T>(schema: TSchema, domain: string, value: unknown): T {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const core = Value.Decode(schema, { ...(value as object), digest: "0".repeat(64) }) as Record<
    string,
    unknown
  >;
  delete core.digest;
  return Value.Decode(schema, {
    ...core,
    digest: referenceSourceDigest({ domain: `vellum.${domain}.v1`, core }),
  }) as unknown as T;
}

export function validateKnowledgeResolverPreflight(value: unknown): KnowledgeResolverPreflight {
  const decoded = Value.Decode(KnowledgeResolverPreflightSchema, value);
  return validateDigest(decoded, KnowledgeResolverPreflightSchema, "knowledge-resolver-preflight");
}

export function validateKnowledgeResolverControlState(
  value: unknown
): KnowledgeResolverControlState {
  const decoded = Value.Decode(KnowledgeResolverControlStateSchema, value);
  return validateDigest(
    decoded,
    KnowledgeResolverControlStateSchema,
    "knowledge-resolver-control-state"
  );
}

function validateDigest<T extends { digest: string }>(
  value: T,
  schema: TSchema,
  domain: string
): T {
  const { digest, ...core } = value;
  const expected = referenceSourceDigest({ domain: `vellum.${domain}.v1`, core });
  if (digest !== expected) throw new Error(`${domain} digest mismatch`);
  return Object.freeze(Value.Decode(schema, value)) as unknown as T;
}
