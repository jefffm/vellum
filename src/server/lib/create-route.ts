import type { Request, RequestHandler, Response } from "express";
import type { ApiErrorCode, ApiSuccess } from "../../lib/api-contract.js";
import {
  ensureCorrelationId,
  errorCodeForStatus,
  logApiError,
  safeRequestPath,
  sendApiFailure,
} from "./api-boundary.js";
import { redactSecretText } from "./secret-redaction.js";

export type { ApiResponse } from "../../lib/api-contract.js";

export type ApiRouteConfig<TInput, TOutput> = {
  validate: (body: unknown, request: Request) => TInput;
  handler: (input: TInput, request: Request, response: Response) => Promise<TOutput>;
};

export function createApiRoute<TInput, TOutput>(
  config: ApiRouteConfig<TInput, TOutput>
): RequestHandler {
  return async (request, response) => {
    const startedAt = Date.now();
    let status = 200;
    ensureCorrelationId(response);

    try {
      let input: TInput;

      try {
        input = config.validate(request.body, request);
      } catch (error) {
        status = 400;
        sendApiFailure(response, {
          status,
          code: "invalid_request",
          message: errorMessage(error),
        });
        return;
      }

      const data = await config.handler(input, request, response);
      status = 200;
      response.status(status).json({ ok: true, data } satisfies ApiSuccess<TOutput>);
    } catch (error) {
      status = error instanceof ApiRouteError ? error.status : 500;
      if (
        error instanceof ApiRouteError &&
        (error.status < 500 || error.code !== "internal_error")
      ) {
        sendApiFailure(response, {
          status,
          code: error.code,
          message: errorMessage(error),
          details: error.details,
        });
      } else {
        logApiError(request, response, error, status, "internal_error");
        sendApiFailure(response, {
          status,
          code: "internal_error",
          message: "Internal server error",
        });
      }
    } finally {
      const durationMs = Date.now() - startedAt;
      console.log(
        JSON.stringify({
          event: "api_request",
          correlationId: ensureCorrelationId(response),
          method: request.method,
          path: safeRequestPath(request),
          status,
          durationMs,
        })
      );
    }
  };
}

export class ApiRouteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ApiErrorCode = errorCodeForStatus(status),
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return redactSecretText(error.message);
  }

  if (typeof error === "string" && error.length > 0) {
    return redactSecretText(error);
  }

  return "Internal server error";
}
