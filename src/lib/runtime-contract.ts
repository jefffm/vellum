export const VELLUM_API_SCHEMA_VERSION = "vellum-api-2026-07-12.1";

export type RuntimeHealth = {
  status: "ok";
  version: string;
  apiSchemaVersion: string;
  runtimeInstanceId: string;
};

export function isCompatibleRuntimeHealth(value: unknown): value is RuntimeHealth {
  if (typeof value !== "object" || value === null) return false;
  const health = value as Partial<RuntimeHealth>;
  return (
    health.status === "ok" &&
    typeof health.version === "string" &&
    health.apiSchemaVersion === VELLUM_API_SCHEMA_VERSION &&
    typeof health.runtimeInstanceId === "string" &&
    health.runtimeInstanceId.length > 0
  );
}
