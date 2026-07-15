import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  ReferenceRecordRefSchema,
  canonicalReferenceJson,
  referenceSourceDigest,
  type ReferenceRecordRef,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceLifecycleActionSchema,
  ReferenceSourceLifecyclePlanResultSchema,
  planReferenceSourceLifecycle,
  type ReferenceSourceLifecyclePlanResult,
  type ReferenceSourceLifecyclePlannerInput,
} from "../../lib/reference-source-lifecycle.js";
import { assertReferenceSourceStagingSnapshotIntegrity } from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingNotFoundError,
  ReferenceSourceStagingStore,
  type ReferenceSourceStagingHead,
} from "./reference-source-staging-store.js";

const Strict = { additionalProperties: false } as const;

export const ReferenceSourceLifecycleDryRunRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    expectedHeadRef: ReferenceRecordRefSchema,
    action: ReferenceSourceLifecycleActionSchema,
  },
  Strict
);
export type ReferenceSourceLifecycleDryRunRequest = Static<
  typeof ReferenceSourceLifecycleDryRunRequestSchema
>;

export type ReferenceSourceLifecyclePlanningServiceOptions = {
  store?: ReferenceSourceStagingStore;
  now?: () => Date;
  planner?: (input: ReferenceSourceLifecyclePlannerInput) => ReferenceSourceLifecyclePlanResult;
};

/**
 * Read-only application boundary for lifecycle planning.
 *
 * The caller supplies only an action and the exact CAS head it observed. Every
 * acquisition, derivation, rights/access record, role binding, substitution,
 * storage policy, and lifecycle use comes from one integrity-checked current
 * staging snapshot. The service has no writer and rechecks the head after the
 * pure planner returns, so it can never publish a mixed-generation plan.
 */
export class ReferenceSourceLifecyclePlanningService {
  readonly store: ReferenceSourceStagingStore;
  private readonly now: () => Date;
  private readonly planner: (
    input: ReferenceSourceLifecyclePlannerInput
  ) => ReferenceSourceLifecyclePlanResult;

  constructor(options: ReferenceSourceLifecyclePlanningServiceOptions = {}) {
    this.store = options.store ?? new ReferenceSourceStagingStore();
    this.now = options.now ?? (() => new Date());
    this.planner = options.planner ?? planReferenceSourceLifecycle;
  }

  planDryRun(request: ReferenceSourceLifecycleDryRunRequest): ReferenceSourceLifecyclePlanResult {
    const decoded = decodeRequest(request);
    const state = this.store.readCurrentState();
    if (!state) {
      throw new ReferenceSourceStagingNotFoundError(
        "Reference-source lifecycle planning requires a current staging snapshot"
      );
    }
    assertExpectedHead(decoded.expectedHeadRef, state.head);
    assertReferenceSourceStagingSnapshotIntegrity(state.snapshot);

    const effectiveAt = this.now().toISOString();
    const result = this.planner({
      schemaVersion: 1,
      baseSnapshot: structuredClone(state.snapshot),
      effectiveAt,
      action: structuredClone(decoded.action),
    });
    assertPlanResult(result, state.snapshot, effectiveAt, decoded.action);

    const finalHead = this.store.readHead();
    if (!finalHead || !sameHead(finalHead, state.head)) {
      throw new ReferenceSourceStagingConflictError(
        "Reference-source staging head changed during lifecycle planning",
        finalHead
      );
    }
    return result;
  }
}

function decodeRequest(
  request: ReferenceSourceLifecycleDryRunRequest
): ReferenceSourceLifecycleDryRunRequest {
  try {
    return Value.Decode(ReferenceSourceLifecycleDryRunRequestSchema, request);
  } catch (error) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source lifecycle request failed schema validation: ${errorMessage(error)}`
    );
  }
}

function assertExpectedHead(
  expected: ReferenceRecordRef,
  current: ReferenceSourceStagingHead
): void {
  if (expected.id !== current.snapshotId || expected.digest !== current.digest) {
    throw new ReferenceSourceStagingConflictError(
      "Reference-source lifecycle request does not match the current staging head",
      current
    );
  }
}

function assertPlanResult(
  result: ReferenceSourceLifecyclePlanResult,
  snapshot: { id: string; digest: string },
  effectiveAt: string,
  action: ReferenceSourceLifecyclePlannerInput["action"]
): void {
  if (
    !Value.Check(ReferenceSourceLifecyclePlanResultSchema, result) ||
    !hasValidPlanSeal(result) ||
    result.mode !== "dry_run" ||
    result.baseSnapshotRef.id !== snapshot.id ||
    result.baseSnapshotRef.digest !== snapshot.digest ||
    result.effectiveAt !== effectiveAt ||
    canonicalReferenceJson(result.action) !== canonicalReferenceJson(action)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source lifecycle planner returned a result for another snapshot or mode"
    );
  }
}

function hasValidPlanSeal(result: ReferenceSourceLifecyclePlanResult): boolean {
  const { id, digest, ...value } = result;
  const seed = referenceSourceDigest(value);
  const expectedId = `reference-lifecycle-plan.${seed.slice(0, 24)}`;
  return id === expectedId && digest === referenceSourceDigest({ ...value, id });
}

function sameHead(left: ReferenceSourceStagingHead, right: ReferenceSourceStagingHead): boolean {
  return (
    left.snapshotId === right.snapshotId &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
