import { Value } from "@sinclair/typebox/value";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PerformanceReleaseFloorProfileSchema,
  RELEASE_FLOOR_POLICY_V1_DIGEST,
  TRACER_GATE_MATRIX_SCHEMA_V1_DIGEST,
  TracerGateMatrixSchema,
  bundledReleaseFloorPolicy,
  canonicalJson,
  compareReleaseFloorEnvironment,
  deriveReleaseFloorProfile,
  parseReleaseFloorPolicy,
  parseTracerGateMatrix,
  releaseFloorPolicyDigest,
  resourceLeaseIdForDeclaration,
  sha256Canonical,
  tracerGateMatrixSchemaDigest,
  type MetricFamilyId,
  type RawMeasurementSet,
  type ReleaseFloorEnvironment,
  type TracerGateMatrix,
} from "../../src/lib/release-floor-policy.js";
import { acquireResourceLease } from "../../src/lib/resource-lease.js";

const metricFamilies: MetricFamilyId[] = [
  "stage-time",
  "peak-rss",
  "persisted-bytes",
  "inventory-bytes",
  "catalog-bytes",
  "manifest-bytes",
  "frontier-bytes",
  "checkpoint-bytes",
  "cancellation-response",
  "checkpoint-interval",
  "resume-overhead",
  "redacted-diagnostic-bytes",
];

const environment: ReleaseFloorEnvironment = {
  hardware: {
    hardwareClassId: "darwin-arm64-local",
    os: "darwin",
    architecture: "arm64",
    cpuModel: "synthetic-test-host",
    logicalCores: 8,
    memoryBytes: 16_000_000_000,
    osRelease: "synthetic-1",
    nixSystem: "aarch64-darwin",
  },
  toolchains: [
    { component: "node", applicability: "applicable", identity: "synthetic-node" },
    { component: "npm", applicability: "applicable", identity: "synthetic-npm" },
    { component: "nix", applicability: "applicable", identity: "synthetic-nix" },
    {
      component: "lilypond",
      applicability: "applicable",
      identity: "synthetic-lilypond",
    },
    {
      component: "operating-system",
      applicability: "applicable",
      identity: "synthetic-os",
    },
    {
      component: "workload-generator",
      applicability: "applicable",
      identity: "synthetic-generator",
    },
    {
      component: "resource-lease",
      applicability: "applicable",
      identity: "resource-lease-v1",
    },
    {
      component: "audiveris",
      applicability: "applicable",
      identity: "synthetic-audiveris",
    },
    {
      component: "model-provider",
      applicability: "not_applicable",
      rationale: "synthetic derivation does not call a model provider",
    },
  ],
};

function rawMeasurements(): RawMeasurementSet[] {
  return bundledReleaseFloorPolicy.workloads.map(({ id: workloadId }, workloadIndex) => ({
    schemaId: "vellum.instrument-intelligence.raw-measurement-set.v1",
    policyId: "release-floor-derivation-policy.v1",
    policyDigest: releaseFloorPolicyDigest,
    workloadId,
    workloadBindingDigest: sha256Canonical(bundledReleaseFloorPolicy.workloads[workloadIndex]!),
    environment: structuredClone(environment),
    observations: [
      ...bundledReleaseFloorPolicy.workloads[workloadIndex]!.stages.map(
        (qualifier, stageIndex) => ({
          metricFamily: "stage-time" as const,
          qualifier,
          values: [1, 2, 3, 4, 5].map((value) => value + workloadIndex * 10 + stageIndex * 100),
        })
      ),
      ...metricFamilies
        .filter((metricFamily) => metricFamily !== "stage-time")
        .map((metricFamily, metricIndex) => ({
          metricFamily,
          values: [1, 2, 3, 4, 5].map((value) => value + workloadIndex * 10 + metricIndex * 100),
        })),
    ],
  }));
}

function gateMatrix(): TracerGateMatrix {
  return {
    schemaId: "vellum.instrument-intelligence.tracer-gate-matrix.v1",
    tracerId: "T04",
    definitionDigest: "a".repeat(64),
    executionProfile: "afk",
    baseGates: [
      {
        gateId: "typecheck",
        applicability: "required",
        command: "npm run typecheck",
        clauseIds: ["II-OPS-001"],
        resourceLeaseKeys: [],
      },
    ],
    conditionalGates: [
      {
        gateId: "browser",
        applicability: "not_applicable",
        clauseIds: ["II-EXEC-000A"],
        resourceLeaseKeys: [],
        rationale: "T04 publishes no browser behavior",
      },
    ],
    observableOutcomes: [
      {
        outcomeId: "policy-validation",
        kind: "process-exit",
        predicate: "the immutable derivation policy and gate matrix validate",
      },
    ],
    toolIdentities: structuredClone(environment.toolchains),
    evidencePath: ".scratch/instrument-intelligence/evidence/T04/verification.json",
    resourceLeases: [
      {
        resource: "performance-hardware",
        key: "release-floor-host",
        mode: "exclusive",
        cleanupPolicy: "prove-owner-absent-then-clean-rerun",
      },
    ],
  };
}

describe("T04 release-floor derivation policy and gate matrix", () => {
  it("commits a closed pre-measurement policy covering every workload and metric family", () => {
    const parsed = parseReleaseFloorPolicy(bundledReleaseFloorPolicy);
    expect(parsed.workloads.map(({ id }) => id)).toEqual([
      "short-interactive-three-target",
      "multipage-satb-three-target",
      "complete-work-resume",
      "mature-reviewed-library",
      "adversarial-dense-passage",
      "oversized-reviewed-library",
    ]);
    expect(new Set(parsed.metricFamilies.map(({ id }) => id))).toEqual(new Set(metricFamilies));
    expect(parsed.resourceClasses).toEqual([
      "podman-vm",
      "audiveris",
      "fixed-port",
      "mutable-store",
      "vault-writer",
      "performance-hardware",
    ]);
    expect(parsed.cleanState.requireOrphanAbsenceProof).toBe(true);
    expect(parsed.cleanState.requireCleanRerunAfterOrphanCleanup).toBe(true);
    expect(parsed.replacementRules.forbidThresholdLooseningInPlace).toBe(true);
    expect(canonicalJson(parsed)).not.toMatch(/"(?:observations|profiles|thresholds)"/);

    expect(() => parseReleaseFloorPolicy({ ...structuredClone(parsed), unexpected: true })).toThrow(
      /invalid release-floor policy/
    );
  });

  it("publishes stable content identities for T70 without publishing a baseline", () => {
    expect(releaseFloorPolicyDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(tracerGateMatrixSchemaDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(releaseFloorPolicyDigest).toBe(sha256Canonical(bundledReleaseFloorPolicy));
    expect(tracerGateMatrixSchemaDigest).toBe(sha256Canonical(TracerGateMatrixSchema));
    expect(releaseFloorPolicyDigest).toBe(RELEASE_FLOOR_POLICY_V1_DIGEST);
    expect(tracerGateMatrixSchemaDigest).toBe(TRACER_GATE_MATRIX_SCHEMA_V1_DIGEST);
    expect(releaseFloorPolicyDigest).not.toBe(tracerGateMatrixSchemaDigest);
  });

  it("derives every threshold deterministically from complete synthetic repetitions", () => {
    const raw = rawMeasurements();
    const first = deriveReleaseFloorProfile(raw);
    const second = deriveReleaseFloorProfile(structuredClone(raw));
    const reordered = deriveReleaseFloorProfile(
      [...structuredClone(raw)].reverse().map((measurement) => ({
        ...measurement,
        observations: [...measurement.observations].reverse(),
        environment: {
          ...measurement.environment,
          toolchains: [...measurement.environment.toolchains].reverse(),
        },
      }))
    );

    expect(second).toEqual(first);
    expect(reordered).toEqual(first);
    expect(Value.Check(PerformanceReleaseFloorProfileSchema, first)).toBe(true);
    expect(first.schemaId).toBe("performance.release-floor.v1");
    expect(first.thresholds).toHaveLength(
      bundledReleaseFloorPolicy.workloads.reduce(
        (count, workload) => count + workload.stages.length + metricFamilies.length - 1,
        0
      )
    );
    expect(
      first.thresholds.find(
        ({ workloadId, metricFamily, qualifier }) =>
          workloadId === "short-interactive-three-target" &&
          metricFamily === "stage-time" &&
          qualifier === "pdf-ingest"
      )
    ).toMatchObject({ observedAggregate: 3, limit: 5 });
  });

  it("invalidates changed policy identity and incomplete measurement sets", () => {
    const raw = rawMeasurements();
    const changedPolicy = structuredClone(bundledReleaseFloorPolicy);
    changedPolicy.metricFamilies[0]!.safetyMargin.numerator += 1;
    const relabeledPolicyRaw = rawMeasurements().map((measurement) => ({
      ...measurement,
      policyDigest: sha256Canonical(changedPolicy),
    }));

    expect(() => deriveReleaseFloorProfile(relabeledPolicyRaw, changedPolicy)).toThrow(
      /policy v1 content changed/
    );
    expect(() => deriveReleaseFloorProfile(raw.slice(1))).toThrow(
      /every policy workload exactly once/
    );

    const missingMetric = rawMeasurements();
    missingMetric[0]!.observations.pop();
    expect(() => deriveReleaseFloorProfile(missingMetric)).toThrow(/omits required/);

    const missingStage = rawMeasurements();
    missingStage[0]!.observations = missingStage[0]!.observations.filter(
      ({ qualifier }) => qualifier !== "pdf-ingest"
    );
    expect(() => deriveReleaseFloorProfile(missingStage)).toThrow(/every declared workflow stage/);

    const shortRepetition = rawMeasurements();
    shortRepetition[0]!.observations[0]!.values.pop();
    expect(() => deriveReleaseFloorProfile(shortRepetition)).toThrow(
      /requires exactly 5 repetitions/
    );

    const relabeledWorkload = rawMeasurements();
    relabeledWorkload[0]!.workloadBindingDigest = "f".repeat(64);
    expect(() => deriveReleaseFloorProfile(relabeledWorkload)).toThrow(
      /bound to a different workload/
    );
  });

  it("blocks unsupported hardware and marks changed hosts or toolchains incomparable", () => {
    expect(compareReleaseFloorEnvironment(environment, structuredClone(environment))).toEqual({
      status: "pass",
      reason: "exact supported environment match",
    });

    const unsupported = structuredClone(environment);
    unsupported.hardware.hardwareClassId = "unknown-host";
    expect(compareReleaseFloorEnvironment(unsupported, environment).status).toBe("blocked");

    const otherHost = structuredClone(environment);
    otherHost.hardware.cpuModel = "different-cpu";
    expect(compareReleaseFloorEnvironment(otherHost, environment).status).toBe("incomparable");

    const otherToolchain = structuredClone(environment);
    otherToolchain.toolchains[0]!.identity = "different-node";
    expect(compareReleaseFloorEnvironment(otherToolchain, environment).status).toBe("incomparable");

    const missingToolchain = structuredClone(environment);
    missingToolchain.toolchains.pop();
    expect(compareReleaseFloorEnvironment(missingToolchain, environment).status).toBe("blocked");
  });

  it("validates executable base gates and justified conditional applicability", () => {
    const valid = gateMatrix();
    expect(parseTracerGateMatrix(valid)).toEqual(valid);
    expect(Value.Check(TracerGateMatrixSchema, { ...valid, unknown: true })).toBe(false);

    expect(() => parseTracerGateMatrix({ ...valid, baseGates: [] })).toThrow(
      /invalid tracer gate matrix/
    );
    expect(() =>
      parseTracerGateMatrix({
        ...valid,
        baseGates: [{ ...valid.baseGates[0]!, applicability: "conditional" }],
      })
    ).toThrow(/must be required and executable/);
    expect(() =>
      parseTracerGateMatrix({
        ...valid,
        conditionalGates: [{ ...valid.conditionalGates[0]!, rationale: undefined }],
      })
    ).toThrow(/requires a rationale/);
    expect(() =>
      parseTracerGateMatrix({
        ...valid,
        observableOutcomes: [],
      })
    ).toThrow(/invalid tracer gate matrix/);
    expect(() =>
      parseTracerGateMatrix({
        ...valid,
        toolIdentities: valid.toolIdentities.map((tool) =>
          tool.component === "node"
            ? { component: "node", applicability: "not_applicable" as const }
            : tool
        ),
      })
    ).toThrow(/required tool node/);

    expect(() =>
      parseTracerGateMatrix({
        ...valid,
        baseGates: [
          {
            ...valid.baseGates[0]!,
            command: "npm run test:browser -- playwright",
          },
        ],
      })
    ).toThrow(/requires a fixed-port resource lease/);

    const browserWithLease = structuredClone(valid);
    browserWithLease.resourceLeases.push({
      resource: "fixed-port",
      key: "browser-port",
      mode: "exclusive",
      cleanupPolicy: "prove-owner-absent-then-clean-rerun",
    });
    browserWithLease.baseGates[0] = {
      ...browserWithLease.baseGates[0]!,
      command: "npm run test:browser -- playwright",
      resourceLeaseKeys: ["browser-port"],
    };
    expect(parseTracerGateMatrix(browserWithLease)).toEqual(browserWithLease);
  });

  it("serializes a gate's declared shared resource across concurrent runners", async () => {
    const root = await mkdtemp(join(tmpdir(), "vellum-t04-resource-"));
    try {
      const resourceId = resourceLeaseIdForDeclaration({
        resource: "fixed-port",
        key: "browser-port",
        mode: "exclusive",
        cleanupPolicy: "prove-owner-absent-then-clean-rerun",
      });
      const first = await acquireResourceLease({ rootDirectory: root, resourceIds: [resourceId] });
      expect(first.status).toBe("acquired");
      if (first.status !== "acquired") return;

      const second = await acquireResourceLease({
        rootDirectory: root,
        resourceIds: [resourceId],
      });
      expect(second).toMatchObject({ status: "blocked", blockerState: "live_owner" });

      await first.lease.release();
      const afterRelease = await acquireResourceLease({
        rootDirectory: root,
        resourceIds: [resourceId],
      });
      expect(afterRelease.status).toBe("acquired");
      if (afterRelease.status === "acquired") await afterRelease.lease.release();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
