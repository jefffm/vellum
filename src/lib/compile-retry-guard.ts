import type { Agent, AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";

import type { CompileError, CompileResult } from "../types.js";

export const DEFAULT_COMPILE_RETRY_LIMIT = 3;

export type CompileRetryGuardOptions = {
  maxAttempts?: number;
  now?: () => number;
};

type CompileRetryAgent = Pick<Agent, "subscribe" | "steer" | "followUp">;

export function installCompileRetryGuard(
  agent: CompileRetryAgent,
  options: CompileRetryGuardOptions = {}
): void {
  const maxAttempts = options.maxAttempts ?? DEFAULT_COMPILE_RETRY_LIMIT;
  const now = options.now ?? Date.now;
  let failedAttempts = 0;
  let awaitingRetryCompile = false;
  let stalledTurns = 0;

  agent.subscribe((event) => {
    const action = evaluateCompileRetryEvent(event, failedAttempts, maxAttempts);

    if (action.resetAttempts) {
      failedAttempts = 0;
      awaitingRetryCompile = false;
      stalledTurns = 0;
    }

    if (action.failedAttempts !== undefined) {
      failedAttempts = action.failedAttempts;
    }

    if (action.message) {
      awaitingRetryCompile = !action.retryLimitReached;
      stalledTurns = 0;
      agent.steer({ role: "user", content: action.message, timestamp: now() });
      return;
    }

    if (
      awaitingRetryCompile &&
      event.type === "turn_end" &&
      event.toolResults.length === 0 &&
      isAssistantTextOnly(event.message) &&
      failedAttempts < maxAttempts
    ) {
      stalledTurns += 1;
      if (stalledTurns <= maxAttempts) {
        agent.followUp({
          role: "user",
          content: buildStallRecoveryMessage(maxAttempts),
          timestamp: now(),
        });
      }
    }
  });
}

export type CompileRetryAction = {
  resetAttempts?: boolean;
  failedAttempts?: number;
  message?: string;
  retryLimitReached?: boolean;
};

export function evaluateCompileRetryEvent(
  event: AgentEvent,
  failedAttempts: number,
  maxAttempts = DEFAULT_COMPILE_RETRY_LIMIT
): CompileRetryAction {
  if (event.type === "agent_start") {
    return { resetAttempts: true };
  }

  if (event.type !== "tool_execution_end" || event.toolName !== "compile" || event.isError) {
    return {};
  }

  const details = (event.result as { details?: unknown } | undefined)?.details;
  if (!isCompileResult(details)) {
    return {};
  }

  if (details.errors.length === 0) {
    return { resetAttempts: true };
  }

  if (hasEnvironmentError(details.errors)) {
    return {
      failedAttempts,
      retryLimitReached: true,
      message: [
        "Compile could not run because the local environment is missing a required executable or dependency.",
        "Do not retry `compile` for the same source, do not create final artifacts, and do not claim success.",
        "Reply with an honest blocked-by-environment summary and include the error below.",
        "If the error says LilyPond is unavailable, tell the user to install LilyPond or run Vellum inside `nix develop`.",
        "",
        formatCompileErrors(details.errors),
      ].join("\n"),
    };
  }

  if (failedAttempts >= maxAttempts) {
    return { failedAttempts };
  }

  const nextFailedAttempts = failedAttempts + 1;
  const finalErrors = formatCompileErrors(details.errors);

  if (nextFailedAttempts >= maxAttempts) {
    return {
      failedAttempts: nextFailedAttempts,
      retryLimitReached: true,
      message: [
        `Compile attempt ${nextFailedAttempts}/${maxAttempts} failed. The bounded compile retry limit has been reached.`,
        "Do not ask the user for permission and do not claim success.",
        "Do not call `compile` again for this source unless the user explicitly requests a new attempt.",
        "Reply with an honest failure summary, include the final LilyPond errors below, and explain what would need to change.",
        "",
        finalErrors,
      ].join("\n"),
    };
  }

  return {
    failedAttempts: nextFailedAttempts,
    message: [
      `Compile attempt ${nextFailedAttempts}/${maxAttempts} failed. Continue autonomously; do not ask the user whether to proceed.`,
      "Diagnose the LilyPond errors, revise the source, and call `compile` again with SVG output before presenting the work as complete.",
      "For historical or re-entrant plucked instruments, prefer tab-first validated source: use `tabulate`, `voicings`, and `check_playability` to choose explicit playable course/fret mappings instead of relying on LilyPond automatic string assignment.",
      "Only report success after `compile` returns an SVG or PDF artifact with no errors.",
      "",
      finalErrors,
    ].join("\n"),
  };
}

function buildStallRecoveryMessage(maxAttempts: number): string {
  return [
    "You stopped after an interim text response, but this task is still inside the mandatory compile repair workflow.",
    "Continue now without waiting for user approval: revise the LilyPond source and call `compile` again with SVG output.",
    `Stay within the bounded compile retry limit of ${maxAttempts} compile attempts, and report honest failure if the limit is reached.`,
  ].join("\n");
}

function isAssistantTextOnly(message: AgentMessage): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as { role?: unknown; content?: unknown };
  if (candidate.role !== "assistant" || !Array.isArray(candidate.content)) {
    return false;
  }

  return candidate.content.length > 0 && candidate.content.every(isNonToolContent);
}

function isNonToolContent(content: unknown): boolean {
  return (
    !content || typeof content !== "object" || (content as { type?: unknown }).type !== "toolCall"
  );
}

function isCompileResult(value: unknown): value is CompileResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CompileResult>;
  return Array.isArray(candidate.errors);
}

function hasEnvironmentError(errors: CompileError[]): boolean {
  return errors.some((error) => error.type === "environment");
}

function formatCompileErrors(errors: CompileError[]): string {
  if (errors.length === 0) {
    return "Final compile errors: none reported.";
  }

  const lines = errors.map((error) => {
    const location = error.line > 0 ? `Line ${error.line}` : "Line unknown";
    const type = error.type ? ` [${error.type}]` : "";
    return `- ${location}${type}: ${error.message}`;
  });

  return [`Final compile errors (${errors.length}):`, ...lines].join("\n");
}

export function compileRetrySteeringMessage(content: string, timestamp = Date.now()): AgentMessage {
  return { role: "user", content, timestamp };
}
