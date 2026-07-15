import { createHash, randomUUID } from "node:crypto";
import type {
  ModelAction,
  ModelActionAttempt,
  ModelActionInputVersion,
  ModelActionPublication,
  ModelEgressEnvelope,
} from "../../lib/music-domain.js";
import {
  authorizeModelActionEgress,
  buildModelActionPublication,
  prepareModelActionEgress,
  type ModelActionProviderResponse,
} from "./model-action-boundary.js";
import { executeServerModelAction } from "./model-action-provider.js";
import { ApiRouteError } from "./create-route.js";
import { redactSecretText } from "./secret-redaction.js";
import { WorkspaceStore } from "./workspace-store.js";

type ModelActionProviderExecutor = (
  envelope: ModelEgressEnvelope,
  envelopeDigest: string,
  signal?: AbortSignal
) => Promise<ModelActionProviderResponse>;

type ModelActionServiceOptions = {
  store?: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
  executeProvider?: ModelActionProviderExecutor;
};

export type CreateModelAction = {
  kind: "interactive_guidance_v1";
  intent: string;
  inputVersions?: ModelActionInputVersion[];
  idempotencyKey?: string;
};

export class ModelActionService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly executeProvider: ModelActionProviderExecutor;

  constructor(options: ModelActionServiceOptions = {}) {
    this.store = options.store ?? new WorkspaceStore();
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.executeProvider = options.executeProvider ?? executeServerModelAction;
  }

  create(workspaceId: string, input: CreateModelAction): ModelAction {
    if (input.kind !== "interactive_guidance_v1") {
      throw new ApiRouteError("Unknown server-governed Model Action policy", 400);
    }
    const intent = redactSecretText(input.intent).trim();
    if (!intent) throw new ApiRouteError("A bounded Owner intent is required", 400);
    const inputVersions = this.store.resolveModelActionInputVersions(
      workspaceId,
      input.inputVersions ?? []
    );
    const idempotencyKey = createHash("sha256")
      .update(input.idempotencyKey ?? randomUUID())
      .digest("hex");
    const existing = this.store
      .listModelActions(workspaceId)
      .find((action) => action.idempotencyKey === idempotencyKey);
    if (existing) {
      const sameRequest =
        existing.kind === input.kind &&
        existing.intent === intent &&
        JSON.stringify(existing.originalInputVersions) === JSON.stringify(inputVersions);
      if (!sameRequest) {
        throw new ApiRouteError(
          "Model Action idempotency key was reused for different inputs",
          409
        );
      }
      return existing;
    }

    const actionId = `model-action.${this.createId()}`;
    const attempt = this.newAttempt(actionId, 1, "initial", intent, inputVersions);
    const timestamp = this.now().toISOString();
    const action: ModelAction = {
      id: actionId,
      kind: input.kind,
      intent,
      idempotencyKey,
      status: "awaiting_authorization",
      originalInputVersions: inputVersions,
      attempts: [attempt],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.store.saveModelAction(workspaceId, action);
  }

  authorize(
    workspaceId: string,
    actionId: string,
    decision: "authorize" | "deny" | "withdraw",
    disclosureDigest: string
  ): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    const attempt = action.attempts.at(-1)!;
    if (!attempt.disclosure || !attempt.disclosureDigest) {
      throw new ApiRouteError("Model Action has no server-minted egress disclosure", 409);
    }
    if (attempt.disclosureDigest !== disclosureDigest) {
      throw new ApiRouteError("Model Action disclosure digest mismatch", 409);
    }
    if (decision === "withdraw") {
      if (!["authorized", "running"].includes(action.status)) {
        throw new ApiRouteError("Only an active authorization can be withdrawn", 409);
      }
    } else if (action.status !== "awaiting_authorization") {
      throw new ApiRouteError("Model Action authorization is no longer pending", 409);
    }

    const authorization = authorizeModelActionEgress({
      actionId: action.id,
      attemptId: attempt.id,
      createId: this.createId,
      now: this.now,
      ownerIntent: action.intent,
      inputVersions: attempt.inputVersions,
      disclosure: attempt.disclosure,
      disclosureDigest,
      decision,
    });
    const dispatched = action.status === "running";
    const status =
      authorization.accessDecision.effectiveDecision === "authorized"
        ? "authorized"
        : dispatched
          ? "interrupted"
          : "denied";
    return this.saveCurrentAttempt(workspaceId, action, status, {
      ...attempt,
      status,
      accessDecision: authorization.accessDecision,
      egressEnvelope: authorization.egressEnvelope ?? attempt.egressEnvelope,
      envelopeDigest: authorization.envelopeDigest ?? attempt.envelopeDigest,
      finishedAt: status === "authorized" ? undefined : this.now().toISOString(),
      interruptionReason: dispatched
        ? "Owner withdrew authorization after provider dispatch; no result was published"
        : undefined,
      lastConfirmedBoundary:
        status === "authorized"
          ? "Owner authorized one exact server-minted Egress Envelope"
          : dispatched
            ? "Provider dispatch began; authorization was withdrawn before publication"
            : "No provider data sent; egress denied or withdrawn",
    });
  }

  async run(
    workspaceId: string,
    actionId: string,
    envelopeDigest: string,
    signal?: AbortSignal
  ): Promise<{ action: ModelAction; publication: ModelActionPublication }> {
    const action = this.store.getModelAction(workspaceId, actionId);
    const attempt = action.attempts.at(-1)!;
    if (
      action.status !== "authorized" ||
      attempt.status !== "authorized" ||
      !attempt.egressEnvelope ||
      attempt.envelopeDigest !== envelopeDigest ||
      attempt.accessDecision?.effectiveDecision !== "authorized"
    ) {
      throw new ApiRouteError("Model Action Egress Envelope is not currently authorized", 409);
    }
    const claimed = this.saveCurrentAttempt(workspaceId, action, "running", {
      ...attempt,
      status: "running",
      lastConfirmedBoundary:
        "Provider dispatch began; no canonical result has been validated or published",
    });
    const claimedAttempt = claimed.attempts.at(-1)!;

    try {
      const response = await this.executeProvider(
        claimedAttempt.egressEnvelope!,
        envelopeDigest,
        signal
      );
      const current = this.store.getModelAction(workspaceId, actionId);
      const currentAttempt = current.attempts.at(-1)!;
      if (
        current.status !== "running" ||
        currentAttempt.envelopeDigest !== envelopeDigest ||
        currentAttempt.accessDecision?.effectiveDecision !== "authorized"
      ) {
        throw new ApiRouteError(
          "Model Action authorization changed before publication; no result was committed",
          409
        );
      }
      const publication = buildModelActionPublication({
        actionId,
        attemptId: currentAttempt.id,
        createId: this.createId,
        now: this.now,
        envelope: currentAttempt.egressEnvelope!,
        envelopeDigest,
        response,
      });
      this.store.publishModelActionResult(workspaceId, actionId, publication);
      return {
        action: this.store.getModelAction(workspaceId, actionId),
        publication: this.store.getModelActionPublicationForAction(workspaceId, actionId),
      };
    } catch (error) {
      const current = this.store.getModelAction(workspaceId, actionId);
      if (current.status === "running") {
        this.interrupt(workspaceId, actionId, safeError(error));
      }
      if (error instanceof ApiRouteError) throw error;
      throw new ApiRouteError(safeError(error), 502);
    }
  }

  interrupt(workspaceId: string, actionId: string, reason: string): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (!["awaiting_authorization", "authorized", "running"].includes(action.status)) {
      throw new ApiRouteError("Model Action is not active", 409);
    }
    const attempt = action.attempts.at(-1)!;
    return this.saveCurrentAttempt(workspaceId, action, "interrupted", {
      ...attempt,
      status: "interrupted",
      interruptionReason: redactSecretText(reason),
      finishedAt: this.now().toISOString(),
      lastConfirmedBoundary: "No canonical Model Action result published",
    });
  }

  cancel(workspaceId: string, actionId: string): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (action.status === "completed") {
      throw new ApiRouteError("A completed Model Action cannot be cancelled", 409);
    }
    if (action.status === "cancelled") return action;
    const attempt = action.attempts.at(-1)!;
    return this.saveCurrentAttempt(workspaceId, action, "cancelled", {
      ...attempt,
      status: "cancelled",
      finishedAt: this.now().toISOString(),
      lastConfirmedBoundary: "Model Action cancelled; no new provider result published",
    });
  }

  retry(
    workspaceId: string,
    actionId: string,
    mode: "current_version" | "original_snapshot_branch" = "current_version",
    currentInputVersions?: ModelActionInputVersion[]
  ): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (!["interrupted", "denied"].includes(action.status)) {
      throw new ApiRouteError("Only an interrupted or denied Model Action can be retried", 409);
    }
    const current =
      currentInputVersions ??
      this.store.resolveCurrentInputVersions(workspaceId, action.originalInputVersions);
    const selected = mode === "current_version" ? current : action.originalInputVersions;
    if (mode === "original_snapshot_branch" && selected.length === 0) {
      throw new ApiRouteError("An intent-only Model Action has no snapshot to branch", 409);
    }
    const attempt = this.newAttempt(
      action.id,
      action.attempts.length + 1,
      mode,
      action.intent,
      selected
    );
    const difference = inputDifference(action.originalInputVersions, current);
    if (difference) attempt.inputDifferenceSummary = difference;
    if (mode === "original_snapshot_branch") {
      const branchId = `branch.${this.createId()}`;
      attempt.arrangementBranchId = branchId;
      this.store.saveArrangementBranch(workspaceId, {
        id: branchId,
        label: `Retry original snapshot for ${action.kind}`,
        rootInputVersions: action.originalInputVersions,
        createdByModelActionId: action.id,
        createdByAttemptId: attempt.id,
        createdAt: this.now().toISOString(),
      });
    }
    return this.store.compareAndSwapModelAction(workspaceId, action, (currentAction) => ({
      ...currentAction,
      status: "awaiting_authorization",
      attempts: [...currentAction.attempts, attempt],
      updatedAt: this.now().toISOString(),
    }));
  }

  private newAttempt(
    actionId: string,
    number: number,
    mode: ModelActionAttempt["mode"],
    intent: string,
    inputVersions: ModelActionInputVersion[]
  ): ModelActionAttempt {
    const attemptId = `model-attempt.${this.createId()}`;
    const prepared = prepareModelActionEgress({
      actionId,
      attemptId,
      createId: this.createId,
      now: this.now,
      ownerIntent: intent,
      inputVersions,
    });
    return {
      id: attemptId,
      number,
      mode,
      status: "awaiting_authorization",
      inputVersions,
      completedLocalToolResults: [],
      lastConfirmedBoundary: "No provider data sent; awaiting exact egress authorization",
      disclosure: prepared.disclosure,
      disclosureDigest: prepared.disclosureDigest,
      startedAt: this.now().toISOString(),
    };
  }

  private saveCurrentAttempt(
    workspaceId: string,
    action: ModelAction,
    status: ModelAction["status"],
    attempt: ModelActionAttempt
  ): ModelAction {
    const attempts = [...action.attempts];
    attempts[attempts.length - 1] = attempt;
    return this.store.compareAndSwapModelAction(workspaceId, action, (currentAction) => ({
      ...currentAction,
      status,
      attempts,
      updatedAt: this.now().toISOString(),
    }));
  }
}

function inputDifference(
  original: ModelActionInputVersion[],
  current: ModelActionInputVersion[]
): string | undefined {
  const serialize = (values: ModelActionInputVersion[]) =>
    JSON.stringify([...values].sort((left, right) => left.recordId.localeCompare(right.recordId)));
  if (serialize(original) === serialize(current)) return undefined;
  const originalById = new Map(original.map((item) => [item.recordId, item]));
  const changes = current.map((item) => {
    const prior = originalById.get(item.recordId);
    return prior
      ? `${item.recordId}: v${prior.version} -> v${item.version}`
      : `${item.recordId}: added at v${item.version}`;
  });
  for (const prior of original) {
    if (!current.some((item) => item.recordId === prior.recordId)) {
      changes.push(`${prior.recordId}: removed`);
    }
  }
  return changes.join("; ");
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.message) return redactSecretText(error.message);
  return "Model Action provider execution failed";
}
