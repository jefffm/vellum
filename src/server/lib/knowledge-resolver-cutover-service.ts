import {
  KnowledgeResolverControlStateSchema,
  KnowledgeResolverPreflightSchema,
  buildCutoverRecord,
  validateKnowledgeResolverControlState,
  validateKnowledgeResolverPreflight,
  type KnowledgeResolverActiveView,
  type KnowledgeResolverControlState,
  type KnowledgeResolverPreflight,
} from "../../lib/knowledge-resolver-cutover-contract.js";
import type { KnowledgeResolutionProjection } from "../../lib/knowledge-resolution-contract.js";
import type { KnowledgeResolutionRef } from "../../lib/knowledge-resolution-contract.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { referenceSourceDigest } from "../../lib/reference-source-domain.js";
import {
  KnowledgePublicationConflictError,
  type KnowledgePublicationGenerationRef,
  type KnowledgePublicationTransaction,
  type KnowledgePublicationSnapshot,
  type KnowledgePublicationStore,
  type KnowledgePublicationWrite,
} from "./knowledge-publication-store.js";
import {
  KnowledgeResolutionService,
  knowledgeResolutionWrites,
  validateKnowledgeResolutionProjection,
  type KnowledgeResolutionRequest,
} from "./knowledge-resolution-service.js";

export type KnowledgeResolverPreflightRequest = Omit<KnowledgeResolutionRequest, "expectedHead">;

type CutoverStore = Pick<
  KnowledgePublicationStore,
  "readCurrent" | "publish" | "listOrphans" | "reclaimExactTransactionOrphan"
>;

export type KnowledgeResolverCutoverServiceOptions = Readonly<{
  publicationStore: CutoverStore;
  now?: () => Date;
}>;

export class KnowledgeResolverCutoverIntegrityError extends Error {}

export class KnowledgeResolverCutoverService {
  private readonly publicationStore: CutoverStore;
  private readonly resolutionService: KnowledgeResolutionService;
  private readonly now: () => Date;

  constructor(options: KnowledgeResolverCutoverServiceOptions) {
    this.publicationStore = options.publicationStore;
    this.now = options.now ?? (() => new Date());
    this.resolutionService = new KnowledgeResolutionService({
      publicationStore: options.publicationStore,
      now: this.now,
    });
  }

  readActive(): KnowledgeResolverActiveView {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const snapshot = requireSnapshot(this.publicationStore.readCurrent());
    const states = controlStates(snapshot);
    if (states.length === 0) return legacyView(snapshot, null);
    const active = requireControlLeaf(states);
    if (active.mode === "legacy") return legacyView(snapshot, active);
    return Object.freeze({
      mode: active.mode,
      legacyActivationEnabled: active.legacyActivationEnabled,
      completeManifestResolverEnabled: active.completeManifestResolverEnabled,
      activeAuthorityHeadRef: active.activeAuthorityHeadRef,
      cutoverProofManifestRef: active.cutoverProofManifestRef,
      activeExecutionIdentity: active.activeExecutionIdentity,
      publicationGenerationRef: generationRef(snapshot),
      controlStateRef: ref(active),
    });
  }

  assertExecutionAuthority(input: {
    authority: KnowledgeResolverActiveView["mode"];
    cachedControlStateRef?: KnowledgeResolutionRef | null;
  }): KnowledgeResolverActiveView {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const active = this.readActive();
    if (active.mode !== input.authority) {
      throw new KnowledgeResolverCutoverIntegrityError(
        `${input.authority} is not the active resolver authority`
      );
    }
    if (
      input.cachedControlStateRef !== undefined &&
      !sameOptionalRef(active.controlStateRef, input.cachedControlStateRef)
    ) {
      throw new KnowledgeResolverCutoverIntegrityError("Resolver authority cache is stale");
    }
    return active;
  }

  resolveForExecution(
    request: KnowledgeResolverPreflightRequest,
    cachedControlStateRef: KnowledgeResolutionRef
  ): KnowledgeResolutionProjection {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const active = this.assertExecutionAuthority({
      authority: "complete_manifest",
      cachedControlStateRef,
    });
    if (active.mode !== "complete_manifest") {
      throw new KnowledgeResolverCutoverIntegrityError(
        "Complete manifest authority is unavailable"
      );
    }
    return this.resolutionService.preview(request);
  }

  preflight(request: KnowledgeResolverPreflightRequest): KnowledgeResolverPreflight {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const snapshot = requireSnapshot(this.publicationStore.readCurrent());
    const active = this.readActive();
    if (active.mode !== "legacy") {
      throw new KnowledgeResolverCutoverIntegrityError("Resolver cutover is already active");
    }
    const projection = this.resolutionService.preview(request);
    validateKnowledgeResolutionProjection(projection, snapshot);
    const legacyBehavior = effectiveBehavior({
      ordinaryActivation: false,
      readinessClaim: false,
      consequences: [],
    });
    const completeBehavior = effectiveBehavior(projection);
    const legacyBehaviorDigest = referenceSourceDigest(legacyBehavior);
    const completeManifestBehaviorDigest = referenceSourceDigest(completeBehavior);
    const checks = [
      check(
        "authority_registry",
        projection.componentRegistry.authorityPathOutcomes.length > 0 &&
          projection.componentRegistry.authorityPathOutcomes.every(
            ({ disposition, reasonCodes }) =>
              disposition !== "disabled" || reasonCodes.includes("quarantined_or_forbidden")
          ),
        [ref(projection.componentRegistry)]
      ),
      check("compatible_readers", true, [ref(projection.manifest)]),
      check(
        "migration",
        !snapshot.records.some(
          ({ recordKind }) => recordKind === "owner_reference_migration_quarantine"
        ),
        []
      ),
      check(
        "rights",
        projection.outcomes
          .filter(({ state }) => state === "eligible")
          .every(({ rightsDecisionRefs }) => rightsDecisionRefs.length > 0),
        projection.outcomes.flatMap(({ rightsDecisionRefs }) => rightsDecisionRefs)
      ),
      check("rollback", Boolean(active.activeAuthorityHeadRef), [active.activeAuthorityHeadRef]),
      check("shadow_comparison", legacyBehaviorDigest === completeManifestBehaviorDigest, [
        ref(projection.manifest),
      ]),
    ].sort((left, right) =>
      left.check.localeCompare(right.check)
    ) as KnowledgeResolverPreflight["checks"];
    const core = {
      recordKind: "knowledge_resolver_preflight" as const,
      schemaVersion: 1 as const,
      id: `knowledge-resolver-preflight.${snapshot.generation.digest}`,
      basePublicationGenerationRef: generationRef(snapshot),
      checks,
      result: checks.every(({ status }) => status === "pass")
        ? ("pass" as const)
        : ("fail" as const),
      legacyBehaviorDigest,
      completeManifestBehaviorDigest,
      shadowDeltaDigest: referenceSourceDigest({ legacyBehavior, completeBehavior }),
      rollbackStateDigest: referenceSourceDigest(active),
      projection,
      checkedAt: this.now().toISOString(),
    };
    return buildCutoverRecord<KnowledgeResolverPreflight>(
      KnowledgeResolverPreflightSchema,
      "knowledge-resolver-preflight",
      core
    );
  }

  cutover(input: {
    preflight: KnowledgeResolverPreflight;
    expectedHead: KnowledgePublicationGenerationRef;
  }): Readonly<{
    active: KnowledgeResolverActiveView & { mode: "complete_manifest" };
    projection: KnowledgeResolutionProjection;
    snapshot: KnowledgePublicationSnapshot;
  }> {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const preflight = validateKnowledgeResolverPreflight(input.preflight);
    if (preflight.result !== "pass") {
      throw new KnowledgeResolverCutoverIntegrityError("Resolver cutover preflight did not pass");
    }
    const before = requireSnapshot(this.publicationStore.readCurrent());
    const alreadyActive = this.readActive();
    if (
      alreadyActive.mode === "complete_manifest" &&
      alreadyActive.cutoverProofManifestRef.id === preflight.projection.manifest.id &&
      alreadyActive.cutoverProofManifestRef.digest === preflight.projection.manifest.digest
    ) {
      return Object.freeze({
        active: alreadyActive,
        projection: preflight.projection,
        snapshot: before,
      });
    }
    if (
      !sameGeneration(before, input.expectedHead) ||
      !sameGeneration(before, preflight.basePublicationGenerationRef)
    ) {
      throw new KnowledgePublicationConflictError(
        "Resolver cutover publication head changed",
        before.head,
        null
      );
    }
    const current = alreadyActive;
    if (current.mode !== "legacy") {
      throw new KnowledgeResolverCutoverIntegrityError(
        "Complete manifest resolver is already active"
      );
    }
    const projection = validateKnowledgeResolutionProjection(preflight.projection, before);
    const priorStates = controlStates(before);
    const prior = priorStates.length ? requireControlLeaf(priorStates) : null;
    const state = buildCutoverRecord<KnowledgeResolverControlState>(
      KnowledgeResolverControlStateSchema,
      "knowledge-resolver-control-state",
      {
        recordKind: "knowledge_resolver_control_state",
        schemaVersion: 1,
        id: `knowledge-resolver-control-state.cutover.${projection.manifest.digest}`,
        sequence: (prior?.sequence ?? 0) + 1,
        transition: "cutover",
        mode: "complete_manifest",
        legacyActivationEnabled: false,
        completeManifestResolverEnabled: true,
        activeAuthorityHeadRef: ref(projection.manifest),
        cutoverProofManifestRef: ref(projection.manifest),
        activeExecutionIdentity: projection.executionIdentity,
        preflightRef: ref(preflight),
        rollbackAuthorityHeadRef: ref(before.generation),
        ...(prior ? { priorControlStateRef: ref(prior) } : {}),
        createdAt: preflight.checkedAt,
      }
    );
    const writes = [
      ...knowledgeResolutionWrites(projection),
      publicationWrite(preflight),
      publicationWrite(state),
    ];
    const transaction: KnowledgePublicationTransaction = {
      schemaVersion: 1,
      transactionId: `knowledge-resolver-cutover.${preflight.digest}`,
      writerKind: "activation",
      expectedHead: input.expectedHead,
      writes,
    };
    const exactOrphan = this.publicationStore
      .listOrphans()
      .find(({ transactionId }) => transactionId === transaction.transactionId);
    if (exactOrphan) this.publicationStore.reclaimExactTransactionOrphan(transaction);
    const snapshot = this.publicationStore.publish(transaction);
    const active = this.readActive();
    if (active.mode !== "complete_manifest") {
      throw new KnowledgeResolverCutoverIntegrityError(
        "Cutover committed without one complete manifest authority"
      );
    }
    return Object.freeze({ active, projection, snapshot });
  }

  rollback(input: { expectedHead: KnowledgePublicationGenerationRef }): Readonly<{
    active: KnowledgeResolverActiveView & { mode: "legacy" };
    snapshot: KnowledgePublicationSnapshot;
  }> {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const before = requireSnapshot(this.publicationStore.readCurrent());
    const existingStates = controlStates(before);
    if (existingStates.length > 0) {
      const existing = requireControlLeaf(existingStates);
      if (
        existing.mode === "legacy" &&
        existing.transition === "rollback" &&
        sameGenerationRef(existing.rollbackBasePublicationGenerationRef, input.expectedHead)
      ) {
        const active = this.readActive();
        if (active.mode !== "legacy") {
          throw new KnowledgeResolverCutoverIntegrityError(
            "Committed rollback did not restore legacy authority"
          );
        }
        return Object.freeze({ active, snapshot: before });
      }
    }
    if (!sameGeneration(before, input.expectedHead)) {
      throw new KnowledgePublicationConflictError(
        "Resolver rollback publication head changed",
        before.head,
        null
      );
    }
    const current = requireControlLeaf(existingStates);
    if (current.mode !== "complete_manifest") {
      throw new KnowledgeResolverCutoverIntegrityError(
        "Only the active complete manifest resolver can be rolled back"
      );
    }
    const state = buildCutoverRecord<KnowledgeResolverControlState>(
      KnowledgeResolverControlStateSchema,
      "knowledge-resolver-control-state",
      {
        recordKind: "knowledge_resolver_control_state",
        schemaVersion: 1,
        id: `knowledge-resolver-control-state.rollback.${current.digest}`,
        sequence: current.sequence + 1,
        transition: "rollback",
        mode: "legacy",
        legacyActivationEnabled: true,
        completeManifestResolverEnabled: false,
        activeAuthorityHeadRef: current.rollbackAuthorityHeadRef,
        rollbackOfRef: ref(current),
        rollbackBasePublicationGenerationRef: input.expectedHead,
        priorControlStateRef: ref(current),
        createdAt: deterministicSuccessorTimestamp(current.createdAt),
      }
    );
    const transaction: KnowledgePublicationTransaction = {
      schemaVersion: 1,
      transactionId: `knowledge-resolver-rollback.${current.digest}`,
      writerKind: "activation",
      expectedHead: input.expectedHead,
      writes: [publicationWrite(state)],
    };
    const exactOrphan = this.publicationStore
      .listOrphans()
      .find(({ transactionId }) => transactionId === transaction.transactionId);
    if (exactOrphan) this.publicationStore.reclaimExactTransactionOrphan(transaction);
    const snapshot = this.publicationStore.publish(transaction);
    const active = this.readActive();
    if (active.mode !== "legacy") {
      throw new KnowledgeResolverCutoverIntegrityError("Rollback did not restore legacy authority");
    }
    return Object.freeze({ active, snapshot });
  }
}

function publicationWrite(
  value: KnowledgeResolverPreflight | KnowledgeResolverControlState
): KnowledgePublicationWrite {
  return {
    recordKind: value.recordKind,
    id: `published.${value.recordKind}.${value.digest}`,
    successorRefs: [],
    content: value,
  };
}

function controlStates(snapshot: KnowledgePublicationSnapshot): KnowledgeResolverControlState[] {
  return snapshot.records
    .filter(({ recordKind }) => recordKind === "knowledge_resolver_control_state")
    .map(({ content }) => validateKnowledgeResolverControlState(content));
}

function requireControlLeaf(
  states: readonly KnowledgeResolverControlState[]
): KnowledgeResolverControlState {
  const referenced = new Set(
    states.flatMap((state) =>
      state.priorControlStateRef
        ? [`${state.priorControlStateRef.id}:${state.priorControlStateRef.digest}`]
        : []
    )
  );
  const leaves = states.filter((state) => !referenced.has(`${state.id}:${state.digest}`));
  if (leaves.length !== 1) {
    throw new KnowledgeResolverCutoverIntegrityError("Resolver control state has no unique leaf");
  }
  return leaves[0]!;
}

function legacyView(
  snapshot: KnowledgePublicationSnapshot,
  state: KnowledgeResolverControlState | null
): KnowledgeResolverActiveView {
  const authorityHead =
    state?.mode === "legacy" ? state.activeAuthorityHeadRef : ref(snapshot.generation);
  return Object.freeze({
    mode: "legacy",
    legacyActivationEnabled: true,
    completeManifestResolverEnabled: false,
    activeAuthorityHeadRef: authorityHead,
    publicationGenerationRef: generationRef(snapshot),
    controlStateRef: state ? ref(state) : null,
  });
}

function effectiveBehavior(value: {
  ordinaryActivation: boolean;
  readinessClaim: boolean;
  consequences: readonly unknown[];
}) {
  return {
    ordinaryActivation: value.ordinaryActivation,
    readinessClaim: value.readinessClaim,
    consequenceDigests: value.consequences.map((item) =>
      typeof item === "object" && item !== null && "digest" in item
        ? (item as { digest: string }).digest
        : referenceSourceDigest(item)
    ),
  };
}

function check(
  name: KnowledgeResolverPreflight["checks"][number]["check"],
  passed: boolean,
  evidenceRefs: readonly { id: string; digest: string }[]
): KnowledgeResolverPreflight["checks"][number] {
  return {
    check: name,
    status: passed ? "pass" : "fail",
    evidenceRefs: evidenceRefs.map(ref),
    reasonCode: passed ? `${name}_verified` : `${name}_failed`,
  };
}

function requireSnapshot(
  snapshot: KnowledgePublicationSnapshot | null
): KnowledgePublicationSnapshot {
  if (!snapshot)
    throw new KnowledgeResolverCutoverIntegrityError("Publication head is unavailable");
  return snapshot;
}

function generationRef(snapshot: KnowledgePublicationSnapshot): KnowledgePublicationGenerationRef {
  return {
    id: snapshot.generation.id,
    digest: snapshot.generation.digest,
    revision: snapshot.generation.revision,
  };
}

function sameGeneration(
  snapshot: KnowledgePublicationSnapshot,
  reference: KnowledgePublicationGenerationRef
): boolean {
  return (
    snapshot.generation.id === reference.id &&
    snapshot.generation.digest === reference.digest &&
    snapshot.generation.revision === reference.revision
  );
}

function sameGenerationRef(
  left: KnowledgePublicationGenerationRef,
  right: KnowledgePublicationGenerationRef
): boolean {
  return left.id === right.id && left.digest === right.digest && left.revision === right.revision;
}

function deterministicSuccessorTimestamp(value: string): string {
  return new Date(Date.parse(value) + 1).toISOString();
}

function ref(value: { id: string; digest: string }) {
  return { id: value.id, digest: value.digest };
}

function sameOptionalRef(
  left: KnowledgeResolutionRef | null,
  right: KnowledgeResolutionRef | null
): boolean {
  if (left === null || right === null) return left === right;
  return left.id === right.id && left.digest === right.digest;
}
