import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { Request, RequestHandler, Response } from "express";
import {
  apiErrorCodes,
  isApiFailure,
  type ApiErrorCode,
  type ApiFailure,
} from "../../lib/api-contract.js";
import { redactSecretText } from "./secret-redaction.js";

const DEFAULT_FRONTEND_ORIGIN = "http://127.0.0.1:5173";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const ALLOWED_HEADERS = new Set([
  "authorization",
  "content-type",
  "x-source-filename",
  "x-source-license",
]);
const SECRET_KEY =
  /^(?:api[-_]?key|authorization|token|access(?:_token)?|refresh(?:_token)?|client_secret|secret|password|code|state)$/i;

export type RuntimeSecurity = {
  host: string;
  frontendOrigin: string;
  mode: "local";
};

export type ApiFailureInput = {
  status: number;
  code?: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export function resolveRuntimeSecurity(
  env: Record<string, string | undefined> = process.env
): RuntimeSecurity {
  const host = env.VELLUM_SERVER_HOST?.trim() || "127.0.0.1";
  const frontendOrigin = normalizeOrigin(
    env.VELLUM_FRONTEND_ORIGIN?.trim() || DEFAULT_FRONTEND_ORIGIN
  );
  return validateRuntimeSecurity({ host, frontendOrigin, mode: "local" });
}

export function validateRuntimeSecurity(security: RuntimeSecurity): RuntimeSecurity {
  const frontendOrigin = normalizeOrigin(security.frontendOrigin);
  if (security.mode !== "local" || !isLoopbackAddress(security.host)) {
    throw new Error(
      "VELLUM_SERVER_HOST must be a numeric loopback address; authenticated remote access requires a future accepted ADR"
    );
  }
  if (!isLoopbackOrigin(frontendOrigin)) {
    throw new Error("VELLUM_FRONTEND_ORIGIN must be a loopback origin for the local runtime");
  }
  return { host: security.host, frontendOrigin, mode: "local" };
}

export const requestContext: RequestHandler = (_request, response, next) => {
  ensureCorrelationId(response);
  next();
};

export const normalizeApiErrorResponses: RequestHandler = (_request, response, next) => {
  const json = response.json.bind(response);
  response.json = ((body: unknown) => {
    if (response.statusCode < 400 || isApiFailure(body)) return json(body);
    const status = response.statusCode;
    const message = status >= 500 ? "Internal server error" : legacyMessage(body, status);
    return json(
      apiFailure(response, {
        status,
        code: errorCodeForStatus(status),
        message,
      })
    );
  }) as typeof response.json;
  next();
};

export function createApiBoundary(security: RuntimeSecurity): RequestHandler {
  return (request, response, next) => {
    const origin = request.header("Origin");
    if (origin !== undefined && !isAllowedOrigin(request, origin, security)) {
      sendApiFailure(response, {
        status: 403,
        code: "forbidden_origin",
        message: "Browser origin is not allowed",
      });
      return;
    }
    if (origin !== undefined) setCorsHeaders(response, origin);
    if (origin === undefined && request.header("Sec-Fetch-Site") === "cross-site") {
      sendApiFailure(response, {
        status: 403,
        code: "forbidden_origin",
        message: "Cross-site browser requests are not allowed",
      });
      return;
    }

    if (request.method === "OPTIONS") {
      if (!origin) {
        sendApiFailure(response, {
          status: 400,
          code: "invalid_request",
          message: "CORS preflight requires an Origin header",
        });
        return;
      }
      const requestedMethod = request.header("Access-Control-Request-Method")?.toUpperCase();
      const requestedHeaders = parseRequestedHeaders(
        request.header("Access-Control-Request-Headers")
      );
      if (
        !requestedMethod ||
        !ALLOWED_METHODS.has(requestedMethod) ||
        requestedHeaders.some((header) => !ALLOWED_HEADERS.has(header))
      ) {
        sendApiFailure(response, {
          status: 403,
          code: "forbidden_origin",
          message: "CORS preflight method or headers are not allowed",
        });
        return;
      }
      response.header("Access-Control-Allow-Methods", [...ALLOWED_METHODS].join(","));
      response.header("Access-Control-Allow-Headers", [...ALLOWED_HEADERS].join(","));
      response.header("Access-Control-Max-Age", "600");
      response.status(204).end();
      return;
    }

    next();
  };
}

export function sendApiFailure(response: Response, input: ApiFailureInput): void {
  response.status(input.status).json(apiFailure(response, input));
}

export function apiFailure(response: Response, input: ApiFailureInput): ApiFailure {
  return {
    ok: false,
    error: {
      code: input.code ?? errorCodeForStatus(input.status),
      message: publicMessage(input.message),
      status: input.status,
      correlationId: ensureCorrelationId(response),
      ...(input.details ? { details: sanitizeDetails(input.details) } : {}),
    },
  };
}

export function ensureCorrelationId(response: Response): string {
  const existing = response.locals.correlationId;
  const correlationId = typeof existing === "string" && existing ? existing : randomUUID();
  response.locals.correlationId = correlationId;
  if (!response.headersSent) response.header("X-Vellum-Correlation-Id", correlationId);
  return correlationId;
}

export function errorCodeForStatus(status: number): ApiErrorCode {
  if (status === 400) return "invalid_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden_origin";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "request_too_large";
  if (status === 422) return "unprocessable_content";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  return "internal_error";
}

export function logApiError(
  request: Pick<Request, "method" | "path" | "route">,
  response: Response,
  error: unknown,
  status: number,
  code: ApiErrorCode
): void {
  const raw = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      event: "api_error",
      correlationId: ensureCorrelationId(response),
      method: request.method,
      path: safeRequestPath(request),
      status,
      code,
      error: publicMessage(redactSecretText(raw)),
    })
  );
}

export function safeRequestPath(request: Pick<Request, "path" | "route">): string {
  const template = request.route?.path;
  return typeof template === "string" ? publicMessage(template).slice(0, 500) : "[unmatched route]";
}

export function isLoopbackAddress(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "::1") return true;
  return isIP(normalized) === 4 && normalized.split(".")[0] === "127";
}

export function isLoopbackHost(host: string): boolean {
  return host.toLowerCase() === "localhost" || isLoopbackAddress(host);
}

function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VELLUM_FRONTEND_ORIGIN must be an absolute HTTP(S) origin");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.origin !== value) {
    throw new Error("VELLUM_FRONTEND_ORIGIN must be an exact HTTP(S) origin without a path");
  }
  return url.origin;
}

function isAllowedOrigin(request: Request, origin: string, security: RuntimeSecurity): boolean {
  if (origin === "null") return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  if (origin === security.frontendOrigin) return true;
  if (!isLoopbackHost(parsed.hostname)) return false;
  return parsed.host === request.header("Host");
}

function setCorsHeaders(response: Response, origin: string): void {
  response.header("Access-Control-Allow-Origin", origin);
  response.header("Access-Control-Expose-Headers", "X-Vellum-Correlation-Id");
  response.vary("Origin");
}

function parseRequestedHeaders(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
}

function publicMessage(value: string): string {
  return redactSecretText(value).slice(0, 1000) || "Request failed";
}

function sanitizeDetails(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(value, 0, new WeakSet());
}

function sanitizeRecord(
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  if (depth >= 5 || seen.has(value)) return {};
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    result[key] = SECRET_KEY.test(key) ? "[redacted]" : sanitizeValue(item, depth + 1, seen);
  }
  seen.delete(value);
  return result;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return publicMessage(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    if (depth >= 5 || seen.has(value)) return [];
    seen.add(value);
    const sanitized = value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1, seen));
    seen.delete(value);
    return sanitized;
  }
  if (typeof value === "object" && value !== null) {
    return sanitizeRecord(value as Record<string, unknown>, depth, seen);
  }
  return undefined;
}

function legacyMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body) return publicMessage(body);
  if (typeof body === "object" && body !== null) {
    const error = (body as Record<string, unknown>).error;
    if (typeof error === "string" && error) return publicMessage(error);
    if (typeof error === "object" && error !== null) {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message) return publicMessage(message);
    }
  }
  return `Request failed (${status})`;
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && apiErrorCodes.includes(value as ApiErrorCode);
}

function isLoopbackOrigin(origin: string): boolean {
  return isLoopbackHost(new URL(origin).hostname);
}
