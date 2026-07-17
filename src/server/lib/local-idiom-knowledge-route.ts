import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";

import { createApiRoute } from "./create-route.js";
import { LocalIdiomKnowledgeStore } from "./local-idiom-knowledge-store.js";

export function createLocalIdiomKnowledgeReadRoute(
  store: LocalIdiomKnowledgeStore
): RequestHandler {
  return createApiRoute({ validate: () => undefined, handler: async () => store.snapshot() });
}

export function createLocalIdiomKnowledgeExtractRoute(
  store: LocalIdiomKnowledgeStore
): RequestHandler {
  return createApiRoute({
    validate: () => undefined,
    handler: async () => store.extractBundledSource(),
  });
}

export function createLocalIdiomKnowledgeReviewRoute(
  store: LocalIdiomKnowledgeStore
): RequestHandler {
  const Body = Type.Object(
    { rationale: Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }) },
    { additionalProperties: false }
  );
  return createApiRoute({
    validate: (body) => Value.Decode(Body, body),
    handler: async (input) => store.review(input),
  });
}

export function createLocalIdiomKnowledgeActivationRoute(
  store: LocalIdiomKnowledgeStore
): RequestHandler {
  const Body = Type.Object(
    { version: Type.Union([Type.Literal(1), Type.Literal(2)]) },
    { additionalProperties: false }
  );
  return createApiRoute({
    validate: (body) => Value.Decode(Body, body),
    handler: async ({ version }) => store.activate(version),
  });
}
