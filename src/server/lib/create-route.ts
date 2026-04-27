import type { Request, RequestHandler } from "express";

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: string;
};

export type ApiRouteConfig<TInput, TOutput> = {
  validate: (body: unknown, request: Request) => TInput;
  handler: (input: TInput) => Promise<TOutput>;
};

export function createApiRoute<TInput, TOutput>(
  config: ApiRouteConfig<TInput, TOutput>
): RequestHandler {
  return async (request, response) => {
    const startedAt = Date.now();
    let status = 200;

    try {
      let input: TInput;

      try {
        input = config.validate(request.body, request);
      } catch (error) {
        status = 400;
        response
          .status(status)
          .json({ ok: false, error: errorMessage(error) } satisfies ApiFailure);
        return;
      }

      const data = await config.handler(input);
      status = 200;
      response.status(status).json({ ok: true, data } satisfies ApiSuccess<TOutput>);
    } catch (error) {
      status = httpStatus(error);
      response.status(status).json({ ok: false, error: errorMessage(error) } satisfies ApiFailure);
    } finally {
      const durationMs = Date.now() - startedAt;
      console.log(`${request.method} ${request.path} ${status} ${durationMs}ms`);
    }
  };
}

export class ApiRouteError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

function httpStatus(error: unknown): number {
  if (error instanceof ApiRouteError) {
    return error.status;
  }

  if (isRecord(error) && typeof error.status === "number") {
    return error.status;
  }

  return 500;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Internal server error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
