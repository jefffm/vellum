import { describe, expect, it } from "vitest";
import { isCompatibleRuntimeHealth, VELLUM_API_SCHEMA_VERSION } from "./runtime-contract.js";

describe("runtime contract", () => {
  it("accepts only the exact browser/API schema version", () => {
    const current = {
      status: "ok",
      version: "0.1.0",
      apiSchemaVersion: VELLUM_API_SCHEMA_VERSION,
      runtimeInstanceId: "runtime.1",
    };
    expect(isCompatibleRuntimeHealth(current)).toBe(true);
    expect(isCompatibleRuntimeHealth({ ...current, apiSchemaVersion: "stale" })).toBe(false);
    expect(isCompatibleRuntimeHealth({ status: "ok", version: "old" })).toBe(false);
  });
});
