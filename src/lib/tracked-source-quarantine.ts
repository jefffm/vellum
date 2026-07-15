import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import bundledInventoryJson from "./data/tracked-source-inventory.v1.json" with { type: "json" };

const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const TrackedSourceOutcomeSchema = Type.Union([
  Type.Literal("allow"),
  Type.Literal("deny"),
  Type.Literal("review_required"),
]);

export const TrackedSourceOperationSchema = Type.Union([
  Type.Literal("local_use"),
  Type.Literal("knowledge_pack_load"),
  Type.Literal("default_generation"),
  Type.Literal("fixture"),
  Type.Literal("prompt"),
  Type.Literal("provider_egress"),
  Type.Literal("export"),
  Type.Literal("report"),
  Type.Literal("repository_inclusion"),
  Type.Literal("redistribution"),
]);

export type TrackedSourceOperation = Static<typeof TrackedSourceOperationSchema>;

const DistributionScopeSchema = Type.Union([
  Type.Literal("local_only"),
  Type.Literal("repository"),
  Type.Literal("external"),
]);

const SourceIdentityComponentSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("identified"),
      Type.Literal("not_applicable"),
      Type.Literal("unresolved"),
      Type.Literal("conflicting"),
    ]),
    identity: Type.Optional(Type.String({ minLength: 1 })),
    rightsStatus: Type.Union([
      Type.Literal("public_domain"),
      Type.Literal("licensed"),
      Type.Literal("owner_authored"),
      Type.Literal("copyrighted"),
      Type.Literal("not_applicable"),
      Type.Literal("unknown"),
      Type.Literal("conflicting"),
    ]),
    evidenceRefs: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const TrackedSourceArtifactSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    path: Type.String({ minLength: 1 }),
    sha256: Sha256Schema,
    byteLength: Type.Integer({ minimum: 0 }),
    mediaType: Type.String({ minLength: 1 }),
    derivation: Type.Object(
      {
        kind: Type.Union([
          Type.Literal("direct_transcription"),
          Type.Literal("derived_overlay"),
          Type.Literal("reviewed_claim"),
          Type.Literal("source_fixture"),
        ]),
        sourceRefs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        evidenceRefs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
      },
      { additionalProperties: false }
    ),
    consumers: Type.Array(Type.String({ minLength: 1 })),
    sourceIdentity: Type.Object(
      {
        underlyingWork: SourceIdentityComponentSchema,
        exemplar: SourceIdentityComponentSchema,
        scan: SourceIdentityComponentSchema,
      },
      { additionalProperties: false }
    ),
    irreversiblePriorDisclosure: Type.Object(
      {
        status: Type.Union([
          Type.Literal("disclosed"),
          Type.Literal("not_disclosed"),
          Type.Literal("unknown"),
        ]),
        evidenceRefs: Type.Array(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export type TrackedSourceArtifact = Static<typeof TrackedSourceArtifactSchema>;

const OperationScopeSchema = Type.Object(
  {
    operation: TrackedSourceOperationSchema,
    distribution: DistributionScopeSchema,
    purpose: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

const DecisionBindingSchema = Type.Object(
  {
    artifactId: Type.String({ minLength: 1 }),
    artifactSha256: Sha256Schema,
    operation: TrackedSourceOperationSchema,
    scope: OperationScopeSchema,
  },
  { additionalProperties: false }
);

const SourcedAuthoritySchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    kind: Type.Union([
      Type.Literal("owner"),
      Type.Literal("rights_reviewer"),
      Type.Literal("source_license"),
      Type.Literal("maintainer"),
    ]),
    evidenceRefs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  },
  { additionalProperties: false }
);

const FinalDecisionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    outcome: Type.Union([Type.Literal("allow"), Type.Literal("deny")]),
    binding: DecisionBindingSchema,
    authority: SourcedAuthoritySchema,
    basisRefs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  },
  { additionalProperties: false }
);

const ReviewRequiredDecisionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    outcome: Type.Literal("review_required"),
    binding: DecisionBindingSchema,
    unresolved: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    evidenceRefs: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const TrackedSourceDecisionSchema = Type.Union([
  FinalDecisionSchema,
  ReviewRequiredDecisionSchema,
]);

export type TrackedSourceDecision = Static<typeof TrackedSourceDecisionSchema>;

export const ProvenanceSubstitutionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    fromArtifactId: Type.String({ minLength: 1 }),
    toArtifactId: Type.String({ minLength: 1 }),
    binding: Type.Object(
      {
        fromSha256: Sha256Schema,
        toSha256: Sha256Schema,
        operation: TrackedSourceOperationSchema,
        scope: OperationScopeSchema,
        decisionId: Type.String({ minLength: 1 }),
        authorityId: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export type ProvenanceSubstitution = Static<typeof ProvenanceSubstitutionSchema>;

export const TrackedSourceInventorySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inventoryId: Type.String({ minLength: 1 }),
    artifacts: Type.Array(TrackedSourceArtifactSchema),
    decisions: Type.Array(TrackedSourceDecisionSchema),
    substitutions: Type.Array(ProvenanceSubstitutionSchema),
  },
  { additionalProperties: false }
);

export type TrackedSourceInventory = Static<typeof TrackedSourceInventorySchema>;

export const TrackedSourceOperationRequestSchema = Type.Object(
  {
    artifactId: Type.String({ minLength: 1 }),
    sha256: Sha256Schema,
    operation: TrackedSourceOperationSchema,
    substitutionId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export type TrackedSourceOperationRequest = Static<typeof TrackedSourceOperationRequestSchema>;

const ResolutionReasonSchema = Type.Union([
  Type.Literal("artifact_missing"),
  Type.Literal("artifact_bytes_mismatch"),
  Type.Literal("decision_missing"),
  Type.Literal("decision_conflict"),
  Type.Literal("decision_binding_mismatch"),
  Type.Literal("source_identity_unresolved"),
  Type.Literal("scope_mismatch"),
  Type.Literal("explicit_denial"),
  Type.Literal("review_required"),
  Type.Literal("substitution_missing"),
  Type.Literal("substitution_binding_mismatch"),
]);

export const TrackedSourceResolutionSchema = Type.Object(
  {
    outcome: TrackedSourceOutcomeSchema,
    artifactId: Type.String({ minLength: 1 }),
    artifactSha256: Sha256Schema,
    resolvedArtifactId: Type.Optional(Type.String({ minLength: 1 })),
    resolvedSha256: Type.Optional(Sha256Schema),
    operation: TrackedSourceOperationSchema,
    decisionId: Type.Optional(Type.String({ minLength: 1 })),
    substitutionId: Type.Optional(Type.String({ minLength: 1 })),
    provenanceEvidenceRefs: Type.Array(Type.String({ minLength: 1 })),
    reasons: Type.Array(ResolutionReasonSchema),
  },
  { additionalProperties: false }
);

export type TrackedSourceResolution = Static<typeof TrackedSourceResolutionSchema>;

export type TrackedSourceAuthorizer = (
  request: TrackedSourceOperationRequest
) => TrackedSourceResolution;

export type BundledTrackedSourceOperationRequest = Omit<TrackedSourceOperationRequest, "sha256">;

export function parseTrackedSourceInventory(value: unknown): TrackedSourceInventory {
  const inventory = Value.Decode(TrackedSourceInventorySchema, structuredClone(value));
  requireUniqueIds(inventory.artifacts, "artifact");
  requireUniqueIds(inventory.decisions, "decision");
  requireUniqueIds(inventory.substitutions, "substitution");

  const artifacts = new Map(inventory.artifacts.map((artifact) => [artifact.id, artifact]));
  const decisions = new Map(inventory.decisions.map((decision) => [decision.id, decision]));
  for (const decision of inventory.decisions) {
    const artifact = artifacts.get(decision.binding.artifactId);
    if (!artifact || artifact.sha256 !== decision.binding.artifactSha256) {
      throw new Error(
        `Tracked-source decision ${decision.id} is not bound to exact inventory bytes`
      );
    }
    if (decision.binding.operation !== decision.binding.scope.operation) {
      throw new Error(`Tracked-source decision ${decision.id} has an inconsistent operation scope`);
    }
  }
  for (const substitution of inventory.substitutions) {
    const source = artifacts.get(substitution.fromArtifactId);
    const target = artifacts.get(substitution.toArtifactId);
    const decision = decisions.get(substitution.binding.decisionId);
    if (
      !source ||
      !target ||
      !decision ||
      source.sha256 !== substitution.binding.fromSha256 ||
      target.sha256 !== substitution.binding.toSha256 ||
      substitution.binding.operation !== substitution.binding.scope.operation
    ) {
      throw new Error(
        `Tracked-source substitution ${substitution.id} is not bound to exact inventory identities`
      );
    }
  }
  return inventory;
}

function requireUniqueIds(values: ReadonlyArray<{ id: string }>, kind: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) throw new Error(`Duplicate tracked-source ${kind} id: ${value.id}`);
    seen.add(value.id);
  }
}

function scopeFor(operation: TrackedSourceOperation): Static<typeof DistributionScopeSchema> {
  switch (operation) {
    case "repository_inclusion":
    case "fixture":
      return "repository";
    case "provider_egress":
    case "export":
    case "redistribution":
      return "external";
    default:
      return "local_only";
  }
}

function hasResolvedIdentity(artifact: TrackedSourceArtifact): boolean {
  return Object.values(artifact.sourceIdentity).every((component) => {
    if (component.status === "not_applicable") {
      return component.rightsStatus === "not_applicable";
    }
    return (
      component.status === "identified" &&
      component.identity !== undefined &&
      component.evidenceRefs.length > 0 &&
      component.rightsStatus !== "unknown" &&
      component.rightsStatus !== "conflicting" &&
      component.rightsStatus !== "not_applicable"
    );
  });
}

function evidenceFor(artifact: TrackedSourceArtifact, decision?: TrackedSourceDecision): string[] {
  const refs = [
    ...artifact.derivation.evidenceRefs,
    ...artifact.sourceIdentity.underlyingWork.evidenceRefs,
    ...artifact.sourceIdentity.exemplar.evidenceRefs,
    ...artifact.sourceIdentity.scan.evidenceRefs,
    ...(decision?.outcome === "review_required"
      ? decision.evidenceRefs
      : (decision?.authority.evidenceRefs ?? [])),
    ...(decision?.outcome === "review_required" ? [] : (decision?.basisRefs ?? [])),
  ];
  return [...new Set(refs)].sort();
}

function review(
  request: TrackedSourceOperationRequest,
  reasons: TrackedSourceResolution["reasons"],
  artifact?: TrackedSourceArtifact,
  decision?: TrackedSourceDecision,
  substitutionId?: string
): TrackedSourceResolution {
  return Value.Decode(TrackedSourceResolutionSchema, {
    outcome: "review_required",
    artifactId: request.artifactId,
    artifactSha256: request.sha256,
    operation: request.operation,
    ...(decision ? { decisionId: decision.id } : {}),
    ...(substitutionId ? { substitutionId } : {}),
    provenanceEvidenceRefs: artifact ? evidenceFor(artifact, decision) : [],
    reasons: [...new Set(reasons)],
  });
}

function resolveDirect(
  inventory: TrackedSourceInventory,
  request: TrackedSourceOperationRequest,
  artifact: TrackedSourceArtifact
): TrackedSourceResolution {
  const decisions = inventory.decisions.filter(
    (candidate) =>
      candidate.binding.artifactId === artifact.id &&
      candidate.binding.operation === request.operation
  );
  if (decisions.length === 0) {
    return review(request, ["decision_missing"], artifact);
  }
  if (decisions.length !== 1) {
    return review(request, ["decision_conflict"], artifact);
  }

  const decision = decisions[0]!;
  if (
    decision.binding.artifactSha256 !== artifact.sha256 ||
    decision.binding.scope.operation !== request.operation
  ) {
    return review(request, ["decision_binding_mismatch"], artifact, decision);
  }
  if (decision.binding.scope.distribution !== scopeFor(request.operation)) {
    return review(request, ["scope_mismatch"], artifact, decision);
  }
  if (decision.outcome === "review_required") {
    return review(request, ["review_required"], artifact, decision);
  }
  if (!hasResolvedIdentity(artifact)) {
    return review(request, ["source_identity_unresolved"], artifact, decision);
  }

  return Value.Decode(TrackedSourceResolutionSchema, {
    outcome: decision.outcome,
    artifactId: request.artifactId,
    artifactSha256: request.sha256,
    resolvedArtifactId: artifact.id,
    resolvedSha256: artifact.sha256,
    operation: request.operation,
    decisionId: decision.id,
    provenanceEvidenceRefs: evidenceFor(artifact, decision),
    reasons: decision.outcome === "deny" ? ["explicit_denial"] : [],
  });
}

export function resolveTrackedSourceOperation(
  inventoryValue: TrackedSourceInventory,
  requestValue: TrackedSourceOperationRequest
): TrackedSourceResolution {
  const inventory = Value.Decode(TrackedSourceInventorySchema, inventoryValue);
  const request = Value.Decode(TrackedSourceOperationRequestSchema, requestValue);
  const artifacts = inventory.artifacts.filter((candidate) => candidate.id === request.artifactId);
  if (artifacts.length !== 1) {
    return review(request, ["artifact_missing"]);
  }
  const artifact = artifacts[0]!;
  if (artifact.sha256 !== request.sha256) {
    return review(request, ["artifact_bytes_mismatch"], artifact);
  }
  if (!request.substitutionId) {
    return resolveDirect(inventory, request, artifact);
  }

  const substitutions = inventory.substitutions.filter(
    (candidate) => candidate.id === request.substitutionId
  );
  if (substitutions.length !== 1) {
    return review(request, ["substitution_missing"], artifact, undefined, request.substitutionId);
  }
  const substitution = substitutions[0]!;
  const target = inventory.artifacts.find(
    (candidate) => candidate.id === substitution.toArtifactId
  );
  const targetDecision = inventory.decisions.find(
    (candidate) => candidate.id === substitution.binding.decisionId
  );
  if (
    substitution.fromArtifactId !== artifact.id ||
    substitution.binding.fromSha256 !== artifact.sha256 ||
    substitution.binding.operation !== request.operation ||
    substitution.binding.scope.operation !== request.operation ||
    substitution.binding.scope.distribution !== scopeFor(request.operation) ||
    !target ||
    substitution.binding.toSha256 !== target.sha256 ||
    !targetDecision ||
    targetDecision.outcome === "review_required" ||
    targetDecision.outcome !== "allow" ||
    targetDecision.binding.artifactId !== target.id ||
    targetDecision.binding.artifactSha256 !== target.sha256 ||
    targetDecision.binding.operation !== request.operation ||
    targetDecision.binding.scope.operation !== substitution.binding.scope.operation ||
    targetDecision.binding.scope.distribution !== substitution.binding.scope.distribution ||
    targetDecision.binding.scope.purpose !== substitution.binding.scope.purpose ||
    targetDecision.authority.id !== substitution.binding.authorityId ||
    !hasResolvedIdentity(target)
  ) {
    return review(
      request,
      ["substitution_binding_mismatch"],
      artifact,
      targetDecision,
      substitution.id
    );
  }

  return Value.Decode(TrackedSourceResolutionSchema, {
    outcome: "allow",
    artifactId: request.artifactId,
    artifactSha256: request.sha256,
    resolvedArtifactId: target.id,
    resolvedSha256: target.sha256,
    operation: request.operation,
    decisionId: targetDecision.id,
    substitutionId: substitution.id,
    provenanceEvidenceRefs: evidenceFor(target, targetDecision),
    reasons: [],
  });
}

export function createTrackedSourceAuthorizer(
  inventoryValue: TrackedSourceInventory
): TrackedSourceAuthorizer {
  const inventory = parseTrackedSourceInventory(inventoryValue);
  return (request) => resolveTrackedSourceOperation(inventory, request);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

const bundledInventory = deepFreeze(parseTrackedSourceInventory(bundledInventoryJson));
const bundledAuthorizer = createTrackedSourceAuthorizer(bundledInventory);

/** Returns the validated, deeply frozen production inventory. */
export function loadBundledTrackedSourceInventory(): TrackedSourceInventory {
  return bundledInventory;
}

/** Production authorization is bound to the repository-reviewed inventory. */
export function authorizeTrackedSourceOperation(
  request: TrackedSourceOperationRequest
): TrackedSourceResolution {
  return bundledAuthorizer(request);
}

/**
 * Authorizes one bundled artifact while binding its digest inside this module.
 * Product call sites cannot supply an authority decision or substitute bytes.
 */
export function authorizeBundledTrackedSourceOperation(
  request: BundledTrackedSourceOperationRequest
): TrackedSourceResolution {
  const artifact = bundledInventory.artifacts.find(
    (candidate) => candidate.id === request.artifactId
  );
  const sha256 = artifact?.sha256 ?? "0".repeat(64);
  return bundledAuthorizer({ ...request, sha256 });
}
