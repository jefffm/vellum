import { Type, type Static } from "@sinclair/typebox";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");

export const KnowledgeExecutionRefSchema = Type.Object(
  { id: IdSchema, digest: DigestSchema },
  Strict
);

/** Browser-safe exact resolver identity shared by search and evaluation records. */
export const KnowledgeExecutionIdentitySchema = Type.Object(
  {
    inventorySnapshotRef: KnowledgeExecutionRefSchema,
    catalogSnapshotRef: KnowledgeExecutionRefSchema,
    activationDecisionRefs: Type.Array(KnowledgeExecutionRefSchema),
    componentRegistrySnapshotRef: KnowledgeExecutionRefSchema,
    resolutionPolicyRef: KnowledgeExecutionRefSchema,
    appliedKnowledgeManifestRef: KnowledgeExecutionRefSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeExecutionIdentity = Static<typeof KnowledgeExecutionIdentitySchema>;
