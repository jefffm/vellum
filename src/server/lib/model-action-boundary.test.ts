import { describe, expect, it } from "vitest";
import type { ModelActionInputVersion } from "../../lib/music-domain.js";
import {
  authorizeModelActionEgress,
  digestModelActionValue,
  INTERACTIVE_GUIDANCE_POLICY_DIGEST,
  INTERACTIVE_GUIDANCE_SYSTEM_PROMPT_DIGEST,
  modelActionValidationDigest,
  prepareModelActionEgress,
  serializeModelActionRequest,
  validateModelActionEnvelopeForDispatch,
} from "./model-action-boundary.js";

const actionId = "model-action.1111111111111111";
const attemptId = "model-attempt.2222222222222222";
const ownerIntent = "Explain the cadence without changing the selected voice.";
const now = () => new Date("2026-07-15T12:00:00.000Z");

describe("Model Action exact-payload authorization", () => {
  it("binds the exact visible Owner text, fixed policy, and serialized request", () => {
    const prepared = prepareModelActionEgress({
      actionId,
      attemptId,
      ownerIntent,
      inputVersions: [],
      createId: () => "3333333333333333",
      now,
    });

    expect(prepared.disclosure).toMatchObject({
      ownerIntent,
      ownerIntentDigest: digestModelActionValue(ownerIntent),
      policyDigest: INTERACTIVE_GUIDANCE_POLICY_DIGEST,
      systemPromptDigest: INTERACTIVE_GUIDANCE_SYSTEM_PROMPT_DIGEST,
      sourceReferences: [],
      toolCapabilities: [],
    });
    const authorized = authorizeModelActionEgress({
      actionId,
      attemptId,
      ownerIntent,
      inputVersions: [],
      disclosure: prepared.disclosure,
      disclosureDigest: prepared.disclosureDigest,
      decision: "authorize",
      createId: () => "4444444444444444",
      now,
    });
    const envelope = authorized.egressEnvelope!;
    const request = serializeModelActionRequest(envelope);

    expect(envelope).toMatchObject({
      ownerIntent,
      ownerIntentDigest: prepared.disclosure.ownerIntentDigest,
      policyDigest: prepared.disclosure.policyDigest,
      systemPromptDigest: prepared.disclosure.systemPromptDigest,
      serializedRequestDigest: prepared.disclosure.serializedRequestDigest,
      requestCreatedAt: prepared.disclosure.createdAt,
      inputVersions: [],
      toolCapabilities: [],
    });
    expect(request.context.messages[0]).toMatchObject({
      content: `OWNER_INTENT_UNTRUSTED_JSON\n${JSON.stringify(ownerIntent)}`,
      timestamp: Date.parse(prepared.disclosure.createdAt),
    });
    expect(digestModelActionValue(request)).toBe(prepared.disclosure.serializedRequestDigest);
    expect(modelActionValidationDigest(envelope, authorized.envelopeDigest!)).toMatch(
      /^[a-f0-9]{64}$/
    );
  });

  it("rejects changed intent or input bindings before minting an envelope", () => {
    const input: ModelActionInputVersion = {
      recordType: "normalized_score",
      recordId: "score.5555555555555555",
      version: 1,
      sha256: "a".repeat(64),
    };
    const prepared = prepareModelActionEgress({
      actionId,
      attemptId,
      ownerIntent,
      inputVersions: [input],
      createId: () => "3333333333333333",
      now,
    });
    const authorize = (changedIntent: string, inputVersions: ModelActionInputVersion[]) =>
      authorizeModelActionEgress({
        actionId,
        attemptId,
        ownerIntent: changedIntent,
        inputVersions,
        disclosure: prepared.disclosure,
        disclosureDigest: prepared.disclosureDigest,
        decision: "authorize",
        createId: () => "4444444444444444",
        now,
      });

    expect(() => authorize(`${ownerIntent} Send more.`, [input])).toThrow(/payload binding/);
    expect(() => authorize(ownerIntent, [{ ...input, version: 2 }])).toThrow(/payload binding/);
  });

  it("rejects a recomputed envelope whose request no longer matches the authorized request digest", () => {
    const prepared = prepareModelActionEgress({
      actionId,
      attemptId,
      ownerIntent,
      inputVersions: [],
      createId: () => "3333333333333333",
      now,
    });
    const authorized = authorizeModelActionEgress({
      actionId,
      attemptId,
      ownerIntent,
      inputVersions: [],
      disclosure: prepared.disclosure,
      disclosureDigest: prepared.disclosureDigest,
      decision: "authorize",
      createId: () => "4444444444444444",
      now,
    });
    const tampered = {
      ...authorized.egressEnvelope!,
      ownerIntent: "A substituted request",
      ownerIntentDigest: digestModelActionValue("A substituted request"),
    };

    expect(() =>
      validateModelActionEnvelopeForDispatch(tampered, digestModelActionValue(tampered))
    ).toThrow(/serialized request digest mismatch/);
  });
});
