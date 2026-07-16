import { describe, expect, it, vi } from "vitest";

import {
  AuthorityPathInventoryError,
  authorityPathObservationDigest,
  buildT14AuthorityPathHandoff,
  bundledAuthorityPathInventory,
  compareAuthorityPathShadow,
  getAuthorityPathInventoryView,
  inspectAuthorityPath,
  observeAuthorityPath,
  validateAuthorityPathInventory,
  withAuthorityPath,
} from "./authority-path-inventory.js";

const CLASSICAL_PROFILE_LEGACY_OUTPUT = {
  canonicalByteLength: 697,
  canonicalSha256: "7d6166910333737bf49afa822f077212fc3f3477fb0615834fb2c06397d23589",
};

describe("Authority Path Inventory runtime contract", () => {
  it("freezes its canonical snapshot and returns an independent clone-safe view", () => {
    expect(Object.isFrozen(bundledAuthorityPathInventory)).toBe(true);
    expect(Object.isFrozen(bundledAuthorityPathInventory.entries[0])).toBe(true);

    const view = getAuthorityPathInventoryView();
    expect(view).toEqual(bundledAuthorityPathInventory);
    expect(view).not.toBe(bundledAuthorityPathInventory);
    expect(Object.isFrozen(view)).toBe(false);
  });

  it("rejects semantic contradictions before reporting their now-stale digests", () => {
    const tampered = getAuthorityPathInventoryView();
    const mechanical = tampered.entries.find((entry) => entry.classification === "mechanical_fact");
    expect(mechanical).toBeDefined();
    mechanical!.mechanicality = "nonmechanical";

    expect(() => validateAuthorityPathInventory(tampered)).toThrowError(
      /mechanical facts require neutral, exact-reader mechanical evidence/
    );
  });

  it("independently rejects a canonical digest mismatch after semantics pass", () => {
    const tampered = getAuthorityPathInventoryView();
    tampered.entries[0].digest = "0".repeat(64);

    expect(() => validateAuthorityPathInventory(tampered)).toThrowError(
      /entry digest does not match its canonical core/
    );
  });

  it("guards known runtime contexts and never invokes a quarantined no-read callback", () => {
    const observation = observeAuthorityPath("authority.prompt.instructions", "production");
    expect(observation).toMatchObject({
      pathId: "authority.prompt.instructions",
      context: "production",
      guardDecision: "observation_only",
      authorityGranted: false,
      resolver: "disabled",
      manifestCompleteness: "not_evaluated",
      productionActivation: "unchanged",
    });

    const compatible = vi.fn(() => "ok");
    expect(withAuthorityPath("authority.prompt.instructions", "production", compatible)).toBe("ok");
    expect(compatible).toHaveBeenCalledOnce();

    const quarantined = vi.fn();
    expect(() =>
      withAuthorityPath("authority.builtin.alfabeto-charts", "inspection", quarantined)
    ).toThrowError(AuthorityPathInventoryError);
    expect(quarantined).not.toHaveBeenCalled();
  });

  it("keeps inspection bounded and explicitly unevaluated", () => {
    const inspection = inspectAuthorityPath("authority.validator.instrument-mechanics");
    expect(inspection.entry.classification).toBe("mechanical_fact");
    expect(inspection.coverage.length).toBeGreaterThan(0);
    expect(inspection).toMatchObject({
      authorityGranted: false,
      access: "inspection",
      resolver: "disabled",
      manifestCompleteness: "not_evaluated",
      productionActivation: "unchanged",
    });
    expect(Object.isFrozen(inspection.entry)).toBe(true);
  });

  it("preserves all four shadow outcomes without making an activation decision", () => {
    const base = {
      fixtureId: "shadow.classical-profile.v1",
      legacyOutput: CLASSICAL_PROFILE_LEGACY_OUTPUT,
    };
    expect(
      compareAuthorityPathShadow({ ...base, candidateOutput: CLASSICAL_PROFILE_LEGACY_OUTPUT })
    ).toMatchObject({
      result: "exact_match",
      productionEffect: "none",
      candidateDisposition: "shadow_only",
      activationDecision: "not_evaluated",
      productionActivation: "unchanged",
    });
    expect(compareAuthorityPathShadow({ ...base, candidateOutput: { changed: true } }).result).toBe(
      "different"
    );
    expect(compareAuthorityPathShadow(base).result).toBe("unknown");
    expect(
      compareAuthorityPathShadow({ ...base, candidateError: new Error("hidden") }).result
    ).toBe("error");
  });

  it("canonicalizes observation keys and emits a deterministic T14 handoff", () => {
    expect(authorityPathObservationDigest({ a: 1, b: 2 })).toBe(
      authorityPathObservationDigest({ b: 2, a: 1 })
    );

    const first = buildT14AuthorityPathHandoff();
    const second = buildT14AuthorityPathHandoff();
    expect(first).toEqual(second);
    expect(first.manifestCompleteness.status).toBe("not_evaluated");
    expect(first.entries.every((entry) => entry.disposition === "unknown")).toBe(true);
    expect(first.entries.every((entry) => entry.componentRef === null)).toBe(true);
    expect(Object.isFrozen(first.entries[0])).toBe(true);
  });
});
