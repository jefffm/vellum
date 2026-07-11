import { createHash, randomUUID } from "node:crypto";
import type {
  ModelAction,
  ModelActionAttempt,
  ModelActionInputVersion,
} from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { redactSecretText } from "./secret-redaction.js";
import { WorkspaceStore } from "./workspace-store.js";

type ModelActionServiceOptions = {
  store?: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
};

export type CreateModelAction = {
  kind: string;
  intent: string;
  inputVersions: ModelActionInputVersion[];
  lastConfirmedBoundary: string;
  idempotencyKey?: string;
};

export type ModelActionProgress = {
  completedLocalToolResults?: ModelActionAttempt["completedLocalToolResults"];
  partialProgressSummary?: string;
  diagnosticPartialOutput?: string;
  lastConfirmedBoundary?: string;
};

export class ModelActionService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: ModelActionServiceOptions = {}) {
    this.store = options.store ?? new WorkspaceStore();
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  create(workspaceId: string, input: CreateModelAction): ModelAction {
    this.store.resolveCurrentInputVersions(workspaceId, input.inputVersions);
    const idempotencyKey = createHash("sha256")
      .update(input.idempotencyKey ?? randomUUID())
      .digest("hex");
    const existing = this.store
      .listModelActions(workspaceId)
      .find((action) => action.idempotencyKey === idempotencyKey);
    if (existing) {
      const sameRequest =
        existing.kind === redactSecretText(input.kind) &&
        existing.intent === redactSecretText(input.intent) &&
        JSON.stringify(existing.originalInputVersions) === JSON.stringify(input.inputVersions);
      if (!sameRequest) {
        throw new ApiRouteError(
          "Model Action idempotency key was reused for different inputs",
          409
        );
      }
      return existing;
    }
    const timestamp = this.now().toISOString();
    const attempt = this.newAttempt(1, "initial", input.inputVersions, input.lastConfirmedBoundary);
    const action: ModelAction = {
      id: `model-action.${this.createId()}`,
      kind: redactSecretText(input.kind),
      intent: redactSecretText(input.intent),
      idempotencyKey,
      status: "running",
      originalInputVersions: input.inputVersions,
      attempts: [attempt],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.store.saveModelAction(workspaceId, action);
  }

  progress(workspaceId: string, actionId: string, progress: ModelActionProgress): ModelAction {
    return this.updateRunning(workspaceId, actionId, (attempt) => ({
      ...attempt,
      completedLocalToolResults: (
        progress.completedLocalToolResults ?? attempt.completedLocalToolResults
      ).map((result) => ({
        toolName: redactSecretText(result.toolName),
        resultReference: redactSecretText(result.resultReference),
      })),
      partialProgressSummary: cleanOptional(progress.partialProgressSummary),
      diagnosticPartialOutput: cleanOptional(progress.diagnosticPartialOutput),
      lastConfirmedBoundary: progress.lastConfirmedBoundary
        ? redactSecretText(progress.lastConfirmedBoundary)
        : attempt.lastConfirmedBoundary,
    }));
  }

  interrupt(workspaceId: string, actionId: string, reason: string): ModelAction {
    return this.finishAttempt(workspaceId, actionId, "interrupted", {
      interruptionReason: redactSecretText(reason),
    });
  }

  complete(workspaceId: string, actionId: string, canonicalResultReference: string): ModelAction {
    if (!canonicalResultReference.trim()) {
      throw new ApiRouteError("A validated canonical result reference is required", 400);
    }
    this.store.assertCanonicalResultReference(workspaceId, canonicalResultReference);
    return this.finishAttempt(workspaceId, actionId, "completed", {
      canonicalResultReference: redactSecretText(canonicalResultReference),
    });
  }

  cancel(workspaceId: string, actionId: string): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (action.status === "completed") {
      throw new ApiRouteError("A completed Model Action cannot be cancelled", 409);
    }
    if (action.status === "cancelled") return action;
    if (action.status === "interrupted") {
      const attempts = [...action.attempts];
      attempts[attempts.length - 1] = {
        ...attempts[attempts.length - 1]!,
        status: "cancelled",
        finishedAt: this.now().toISOString(),
      };
      return this.store.saveModelAction(workspaceId, {
        ...action,
        status: "cancelled",
        attempts,
        updatedAt: this.now().toISOString(),
      });
    }
    return this.finishAttempt(workspaceId, actionId, "cancelled", {});
  }

  retry(
    workspaceId: string,
    actionId: string,
    mode: "current_version" | "original_snapshot_branch" = "current_version",
    currentInputVersions?: ModelActionInputVersion[]
  ): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (action.status !== "interrupted") {
      throw new ApiRouteError("Only an interrupted Model Action can be retried", 409);
    }
    const current =
      currentInputVersions ??
      this.store.resolveCurrentInputVersions(workspaceId, action.originalInputVersions);
    const selected = mode === "current_version" ? current : action.originalInputVersions;
    const difference = inputDifference(action.originalInputVersions, current);
    const attempt = this.newAttempt(
      action.attempts.length + 1,
      mode,
      selected,
      action.attempts.at(-1)?.lastConfirmedBoundary ?? "No canonical result committed"
    );
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
    const updated: ModelAction = {
      ...action,
      status: "running",
      attempts: [...action.attempts, attempt],
      updatedAt: this.now().toISOString(),
    };
    return this.store.saveModelAction(workspaceId, updated);
  }

  private newAttempt(
    number: number,
    mode: ModelActionAttempt["mode"],
    inputVersions: ModelActionInputVersion[],
    lastConfirmedBoundary: string
  ): ModelActionAttempt {
    return {
      id: `model-attempt.${this.createId()}`,
      number,
      mode,
      status: "running",
      inputVersions,
      completedLocalToolResults: [],
      lastConfirmedBoundary: redactSecretText(lastConfirmedBoundary),
      startedAt: this.now().toISOString(),
    };
  }

  private updateRunning(
    workspaceId: string,
    actionId: string,
    update: (attempt: ModelActionAttempt) => ModelActionAttempt
  ): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (action.status !== "running") {
      throw new ApiRouteError("Model Action is not running", 409);
    }
    const attempts = [...action.attempts];
    attempts[attempts.length - 1] = update(attempts[attempts.length - 1]!);
    return this.store.saveModelAction(workspaceId, {
      ...action,
      attempts,
      updatedAt: this.now().toISOString(),
    });
  }

  private finishAttempt(
    workspaceId: string,
    actionId: string,
    status: "interrupted" | "completed" | "cancelled",
    details: Pick<ModelActionAttempt, "interruptionReason" | "canonicalResultReference">
  ): ModelAction {
    const action = this.store.getModelAction(workspaceId, actionId);
    if (action.status !== "running") {
      throw new ApiRouteError("Model Action is not running", 409);
    }
    const attempts = [...action.attempts];
    attempts[attempts.length - 1] = {
      ...attempts[attempts.length - 1]!,
      ...details,
      status,
      finishedAt: this.now().toISOString(),
    };
    return this.store.saveModelAction(workspaceId, {
      ...action,
      status,
      attempts,
      updatedAt: this.now().toISOString(),
    });
  }
}

function cleanOptional(value: string | undefined): string | undefined {
  return value?.trim() ? redactSecretText(value) : undefined;
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
    if (!current.some((item) => item.recordId === prior.recordId))
      changes.push(`${prior.recordId}: removed`);
  }
  return changes.join("; ");
}
