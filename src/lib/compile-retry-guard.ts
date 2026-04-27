import type { Agent, AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";

import type { CompileError, CompileResult } from "../types.js";

export const DEFAULT_COMPILE_RETRY_LIMIT = 3;

export type CompileRetryGuardOptions = {
  maxAttempts?: number;
  now?: () => number;
};

type CompileRetryAgent = Pick<Agent, "subscribe" | "steer">;

export function installCompileRetryGuard(
  agent: CompileRetryAgent,
  options: CompileRetryGuardOptions = {}
): void {
  const maxAttempts = options.maxAttempts ?? DEFAULT_COMPILE_RETRY_LIMIT;
  const now = options.now ?? Date.now;
  let failedAttempts = 0;

  agent.subscribe((event) => {
    const action = evaluateCompileRetryEvent(event, failedAttempts, maxAttempts);

    if (action.resetAttempts) {
      failedAttempts = 0;
    }

    if (action.failedAttempts !== undefined) {
      failedAttempts = action.failedAttempts;
    }

    if (action.message) {
      agent.steer({ role: "user", content: action.message, timestamp: now() });
    }
  });
}

export type CompileRetryAction = {
  resetAttempts?: boolean;
  failedAttempts?: number;
  message?: string;
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

  if (failedAttempts >= maxAttempts) {
    return { failedAttempts };
  }

  const nextFailedAttempts = failedAttempts + 1;
  const finalErrors = formatCompileErrors(details.errors);

  if (nextFailedAttempts >= maxAttempts) {
    return {
      failedAttempts: nextFailedAttempts,
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

function isCompileResult(value: unknown): value is CompileResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CompileResult>;
  return Array.isArray(candidate.errors);
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
