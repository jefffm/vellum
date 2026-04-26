import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Static, TSchema } from "typebox";
import { toolError, toolResult } from "./tool-helpers.js";

export type CreateServerToolConfig<TParams extends TSchema, TDetails> = {
  name: string;
  label?: string;
  description: string;
  parameters: TParams;
  endpoint: string;
  formatContent: (response: TDetails) => string;
  formatDetails?: (response: TDetails) => TDetails;
};

type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export function createServerTool<TParams extends TSchema, TDetails>(
  config: CreateServerToolConfig<TParams, TDetails>
): AgentTool<TParams, TDetails> {
  return {
    name: config.name,
    label: config.label ?? config.name,
    description: config.description,
    parameters: config.parameters,
    execute: async (
      _toolCallId: string,
      params: Static<TParams>,
      signal?: AbortSignal
    ): Promise<AgentToolResult<TDetails>> => {
      let response: Response;

      try {
        response = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal,
        });
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) {
          throw error;
        }

        return toolError<TDetails>(errorMessage(error));
      }

      const body = await parseJson(response);

      if (!response.ok) {
        return toolError<TDetails>(httpErrorMessage(response, body));
      }

      const unwrapped = unwrapEnvelope<TDetails>(body);

      if (!unwrapped.ok) {
        return toolError<TDetails>(unwrapped.error);
      }

      const details = config.formatDetails ? config.formatDetails(unwrapped.data) : unwrapped.data;

      return toolResult(config.formatContent(details), details);
    },
  };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function unwrapEnvelope<T>(body: unknown): ApiEnvelope<T> {
  if (isRecord(body) && typeof body.ok === "boolean") {
    if (body.ok) {
      return { ok: true, data: body.data as T };
    }

    return { ok: false, error: typeof body.error === "string" ? body.error : "Server error" };
  }

  return { ok: true, data: body as T };
}

function httpErrorMessage(response: Response, body: unknown): string {
  if (isRecord(body) && typeof body.error === "string") {
    return body.error;
  }

  if (typeof body === "string" && body.length > 0) {
    return body;
  }

  return `HTTP ${response.status} ${response.statusText}`.trim();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Network request failed";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
