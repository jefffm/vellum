export const apiErrorCodes = [
  "invalid_request",
  "unauthorized",
  "forbidden",
  "forbidden_origin",
  "not_found",
  "conflict",
  "request_too_large",
  "unprocessable_content",
  "cancelled",
  "rate_limited",
  "service_unavailable",
  "analysis_review_required",
  "score_review_required",
  "search_exhausted",
  "plan_conflict",
  "internal_error",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
  status: number;
  correlationId: string;
  details?: Record<string, unknown>;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorPayload;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class VellumApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly correlationId: string;
  readonly details?: Record<string, unknown>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "VellumApiError";
    this.code = payload.code;
    this.status = payload.status;
    this.correlationId = payload.correlationId;
    this.details = payload.details;
  }
}

export function isApiFailure(value: unknown): value is ApiFailure {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) return false;
  return (
    apiErrorCodes.includes(value.error.code as ApiErrorCode) &&
    typeof value.error.message === "string" &&
    Number.isInteger(value.error.status) &&
    typeof value.error.correlationId === "string" &&
    value.error.correlationId.length > 0 &&
    (value.error.details === undefined || isRecord(value.error.details))
  );
}

export function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return isRecord(value) && value.ok === true && "data" in value;
}

export function apiErrorFromResponse(status: number, body: unknown): VellumApiError {
  if (isApiFailure(body)) return new VellumApiError(body.error);
  return new VellumApiError({
    code: status === 404 ? "not_found" : "internal_error",
    message: `Request failed (${status})`,
    status,
    correlationId: "unavailable",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
