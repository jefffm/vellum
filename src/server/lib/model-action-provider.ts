import { createHash } from "node:crypto";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import type { ModelEgressEnvelope } from "../../lib/music-domain.js";
import {
  serializeModelActionRequest,
  type ModelActionProviderResponse,
  validateModelActionEnvelopeForDispatch,
} from "./model-action-boundary.js";
import { redactSecretText } from "./secret-redaction.js";
import { resolveApiKeyForProvider } from "./provider-runtime.js";

export async function executeServerModelAction(
  envelope: ModelEgressEnvelope,
  envelopeDigest: string,
  signal?: AbortSignal
): Promise<ModelActionProviderResponse> {
  assertAuthorityPathRuntime("authority.validator.model-action-commit", "production");
  const authorizedEnvelope = validateModelActionEnvelopeForDispatch(envelope, envelopeDigest);
  const request = serializeModelActionRequest(authorizedEnvelope);
  const apiKey = await resolveApiKeyForProvider(request.model.provider);
  if (!apiKey) {
    throw new Error(
      "ChatGPT is not connected. Use Vellum's Connect ChatGPT control before authorizing this Model Action."
    );
  }

  let content = "";
  let started = false;
  let completed = false;
  let activeBlock: { type: "text" | "thinking"; contentIndex: number; content: string } | undefined;
  const stream = streamSimple(getModel(request.model.provider, request.model.id), request.context, {
    ...request.options,
    apiKey,
    signal,
  });
  for await (const event of stream) {
    if (completed) throw new Error("The provider emitted output after its terminal event");
    switch (event.type) {
      case "start":
        if (started) throw new Error("The provider emitted more than one start event");
        started = true;
        break;
      case "text_start":
      case "thinking_start": {
        if (!started || activeBlock) {
          throw new Error("The provider emitted an invalid content-block sequence");
        }
        activeBlock = {
          type: event.type === "text_start" ? "text" : "thinking",
          contentIndex: event.contentIndex,
          content: "",
        };
        break;
      }
      case "text_delta":
      case "thinking_delta": {
        const expectedType = event.type === "text_delta" ? "text" : "thinking";
        if (
          !activeBlock ||
          activeBlock.type !== expectedType ||
          activeBlock.contentIndex !== event.contentIndex
        ) {
          throw new Error("The provider emitted a delta outside its declared content block");
        }
        activeBlock.content += event.delta;
        break;
      }
      case "text_end":
      case "thinking_end": {
        const expectedType = event.type === "text_end" ? "text" : "thinking";
        if (
          !activeBlock ||
          activeBlock.type !== expectedType ||
          activeBlock.contentIndex !== event.contentIndex ||
          activeBlock.content !== event.content
        ) {
          throw new Error("The provider content block failed closed validation");
        }
        if (expectedType === "text") content += event.content;
        activeBlock = undefined;
        break;
      }
      case "toolcall_start":
      case "toolcall_delta":
      case "toolcall_end":
        throw new Error("The provider attempted an unauthorized tool call");
      case "done": {
        if (
          !started ||
          activeBlock ||
          event.reason !== "stop" ||
          event.message.stopReason !== "stop"
        ) {
          throw new Error("The provider did not complete with an allowed terminal state");
        }
        if (
          event.message.provider !== request.model.provider ||
          event.message.model !== request.model.id ||
          event.message.content.some((item) => item.type === "toolCall")
        ) {
          throw new Error("The provider terminal result exceeded its authorized identity or tools");
        }
        const terminalText = event.message.content
          .filter((item): item is Extract<typeof item, { type: "text" }> => item.type === "text")
          .map((item) => item.text)
          .join("");
        if (terminalText !== content) {
          throw new Error("The provider terminal result does not match its validated text stream");
        }
        completed = true;
        break;
      }
      case "error":
        throw new Error(
          redactSecretText(event.error.errorMessage || "The provider rejected the Model Action", [
            apiKey,
          ])
        );
    }
  }
  if (!completed) throw new Error("The provider stream ended without a valid terminal event");
  if (!content.trim()) throw new Error("The provider returned no publishable Model Action result");
  const responseDigest = createHash("sha256").update(`${envelopeDigest}\0${content}`).digest("hex");
  return {
    envelopeDigest,
    provider: request.model.provider,
    model: request.model.id,
    providerResponseId: `provider-response.${responseDigest}`,
    content,
  };
}
