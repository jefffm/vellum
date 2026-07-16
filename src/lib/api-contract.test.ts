import { describe, expect, it } from "vitest";
import {
  apiErrorFromResponse,
  isApiFailure,
  isApiSuccess,
  VellumApiError,
} from "./api-contract.js";

describe("API contract", () => {
  it("recognizes the sole success and failure envelopes", () => {
    expect(isApiSuccess({ ok: true, data: { value: 1 } })).toBe(true);
    expect(
      isApiFailure({
        ok: false,
        error: {
          code: "conflict",
          message: "Version changed",
          status: 409,
          correlationId: "request-1",
        },
      })
    ).toBe(true);
    expect(isApiFailure({ ok: false, error: "legacy" })).toBe(false);
  });

  it("creates a code-addressable client error without prose matching", () => {
    const error = apiErrorFromResponse(409, {
      ok: false,
      error: {
        code: "analysis_review_required",
        message: "Review required",
        status: 409,
        correlationId: "request-2",
        details: { analysisRecordId: "analysis.1234567890abcdef" },
      },
    });
    expect(error).toBeInstanceOf(VellumApiError);
    expect(error).toMatchObject({
      code: "analysis_review_required",
      status: 409,
      correlationId: "request-2",
      details: { analysisRecordId: "analysis.1234567890abcdef" },
    });
  });

  it("preserves a generic 403 authorization denial separately from origin rejection", () => {
    const error = apiErrorFromResponse(403, {
      ok: false,
      error: {
        code: "forbidden",
        message: "Separate publication authority is required",
        status: 403,
        correlationId: "request-typed-release",
      },
    });
    expect(error).toMatchObject({
      code: "forbidden",
      status: 403,
      correlationId: "request-typed-release",
    });
    expect(error.code).not.toBe("forbidden_origin");
  });

  it("uses a non-disclosing fallback for malformed failures", () => {
    expect(apiErrorFromResponse(500, { error: "raw server secret" })).toMatchObject({
      code: "internal_error",
      message: "Request failed (500)",
      correlationId: "unavailable",
    });
  });
});
