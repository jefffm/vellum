import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import type { ArrangementScore, PreservationAudit } from "./music-domain.js";

export type PreservationPolicy = ArrangementScore["preservationPolicy"];

/**
 * The audit always records source divergence. Only Faithful Reduction turns
 * note-level preservation findings into a completion gate; mechanics,
 * commitments, and contextual validation remain separate hard constraints.
 */
export function applyPreservationPolicy(
  audit: PreservationAudit,
  policy: PreservationPolicy
): PreservationAudit {
  assertAuthorityPathRuntime("authority.validator.preservation-editorial", "production");
  if (policy === "faithful_reduction") return audit;
  return {
    ...audit,
    status: "pass",
    findings: audit.findings.map((finding) => ({
      ...finding,
      severity: "observation" as const,
      code: `${policy}.${finding.code}`,
      message: `${policyLabel(policy)} permits this source divergence: ${finding.message}`,
    })),
  };
}

export function policyLabel(policy: PreservationPolicy): string {
  if (policy === "idiomatic_adaptation") return "Idiomatic Adaptation";
  if (policy === "free_paraphrase") return "Free Paraphrase";
  return "Faithful Reduction";
}
