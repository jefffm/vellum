import type { ProxyStreamOptions } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  getModel,
  type AssistantMessage,
  type Context,
  type Model,
} from "@mariozechner/pi-ai";
import type { ModelAction, ModelActionPublication, ModelEgressDisclosure } from "./music-domain.js";
import { apiErrorFromResponse, isApiFailure } from "./api-contract.js";

type ApiSuccess<T> = { data: T };
type ModelActionRunResult = { action: ModelAction; publication: ModelActionPublication };
type EgressAuthorizer = (disclosure: ModelEgressDisclosure) => Promise<boolean>;

let egressAuthorizer: EgressAuthorizer = presentEgressDisclosure;

/** Test seam for the one explicit Owner authorization decision. */
export function setModelEgressAuthorizer(authorizer?: EgressAuthorizer): void {
  egressAuthorizer = authorizer ?? presentEgressDisclosure;
}

/**
 * Pi-compatible adapter for Vellum's server-governed Model Action boundary.
 *
 * The model and full Context arguments are intentionally not serialized. The
 * browser can submit only the latest Owner intent to one registered policy;
 * the server selects destination, system prompt, data, and capabilities.
 */
export function vellumStreamProxy(
  _clientModel: Model<string>,
  context: Context,
  options: ProxyStreamOptions
) {
  const stream = createAssistantMessageEventStream();

  void (async () => {
    const partial = initialMessage();
    try {
      const workspaceId = activeWorkspaceId();
      const intent = latestOwnerIntent(context);
      const action = await api<ModelAction>(`/api/workspaces/${workspaceId}/model-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "interactive_guidance_v1", intent }),
        signal: options.signal,
      });
      const attempt = action.attempts.at(-1);
      if (!attempt?.disclosure || !attempt.disclosureDigest) {
        throw new Error("The server did not return a complete Model Action disclosure");
      }

      const authorizedByOwner = await egressAuthorizer(attempt.disclosure);
      const decided = await api<ModelAction>(
        `/api/workspaces/${workspaceId}/model-actions/${action.id}/authorization`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: authorizedByOwner ? "authorize" : "deny",
            disclosureDigest: attempt.disclosureDigest,
          }),
          signal: options.signal,
        }
      );
      if (!authorizedByOwner || decided.status === "denied") {
        pushAssistantText(
          stream,
          partial,
          authorizedByOwner
            ? `Nothing was sent. ${attempt.disclosure.policyReason}`
            : "Nothing was sent. You declined this one-time Model Action egress request."
        );
        return;
      }

      const authorizedAttempt = decided.attempts.at(-1);
      if (!authorizedAttempt?.envelopeDigest) {
        throw new Error("The server did not mint an authorized Egress Envelope");
      }
      const completed = await api<ModelActionRunResult>(
        `/api/workspaces/${workspaceId}/model-actions/${action.id}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ envelopeDigest: authorizedAttempt.envelopeDigest }),
          signal: options.signal,
        }
      );
      if (
        completed.action.status !== "completed" ||
        completed.action.publicationReference !== completed.publication.id
      ) {
        throw new Error("The Model Action result was not atomically published");
      }
      pushAssistantText(stream, partial, completed.publication.result.content);
    } catch (error) {
      const reason = options.signal?.aborted ? "aborted" : "error";
      partial.stopReason = reason;
      partial.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason, error: partial });
      stream.end();
    }
  })();

  return stream;
}

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw await typedProxyError(response);
  const body = (await response.json()) as ApiSuccess<T>;
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("Vellum returned an invalid Model Action response");
  }
  return body.data;
}

async function typedProxyError(response: Response): Promise<Error> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new Error(`Vellum API error: ${response.status} ${response.statusText}`.trim());
  }
  const error = apiErrorFromResponse(response.status, body);
  if (!isApiFailure(body)) return error;
  error.message = `${error.message} (reference ${error.correlationId})`;
  return error;
}

function activeWorkspaceId(): string {
  if (typeof window === "undefined") {
    throw new Error("A Vellum workspace is required before starting a Model Action");
  }
  const query = new URL(window.location.href).searchParams.get("workspace");
  const stored = window.localStorage.getItem("vellum.active-workspace");
  const workspaceId = query ?? stored;
  if (!workspaceId?.match(/^workspace\.[a-f0-9-]{16,}$/)) {
    throw new Error("Open or create a Vellum project before asking the musicology assistant");
  }
  return workspaceId;
}

function latestOwnerIntent(context: Context): string {
  const message = [...context.messages].reverse().find((candidate) => candidate.role === "user");
  if (!message) throw new Error("A Model Action requires an Owner intent");
  if (typeof message.content === "string" && message.content.trim()) return message.content.trim();
  if (Array.isArray(message.content)) {
    const text = message.content
      .map((item) =>
        typeof item === "object" && item !== null && "text" in item && typeof item.text === "string"
          ? item.text
          : ""
      )
      .join("\n")
      .trim();
    if (text) return text;
  }
  throw new Error("The latest Owner message contains no text that Vellum can disclose");
}

function initialMessage(): AssistantMessage {
  const model = getModel("openai-codex", "gpt-5.3-codex");
  return {
    role: "assistant",
    stopReason: "stop",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: emptyUsage(),
    timestamp: Date.now(),
  };
}

function pushAssistantText(
  stream: ReturnType<typeof createAssistantMessageEventStream>,
  partial: AssistantMessage,
  content: string
): void {
  stream.push({ type: "start", partial });
  partial.content[0] = { type: "text", text: "" };
  stream.push({ type: "text_start", contentIndex: 0, partial });
  partial.content[0] = { type: "text", text: content };
  stream.push({ type: "text_delta", contentIndex: 0, delta: content, partial });
  stream.push({ type: "text_end", contentIndex: 0, content, partial });
  partial.stopReason = "stop";
  stream.push({ type: "done", reason: "stop", message: partial });
  stream.end();
}

async function presentEgressDisclosure(disclosure: ModelEgressDisclosure): Promise<boolean> {
  if (typeof document === "undefined" || typeof HTMLDialogElement === "undefined") {
    return typeof window !== "undefined" ? window.confirm(disclosureSummary(disclosure)) : false;
  }
  return await new Promise<boolean>((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "model-egress-disclosure";
    const title = document.createElement("h2");
    title.id = `model-egress-title-${disclosure.id}`;
    title.textContent = "Authorize this one-time ChatGPT request?";
    const summary = document.createElement("p");
    summary.id = `model-egress-summary-${disclosure.id}`;
    summary.textContent = disclosure.policyReason;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.setAttribute("aria-describedby", summary.id);
    const details = document.createElement("dl");
    appendDetail(details, "Destination", `${disclosure.provider} · ${disclosure.model}`);
    appendDetail(details, "Purpose", disclosure.purpose.replaceAll("_", " "));
    appendDetail(details, "Data", disclosure.dataClasses.join(", "));
    appendDetail(
      details,
      "Exact Owner text",
      disclosure.ownerIntent,
      "model-egress-disclosure-intent"
    );
    appendDetail(
      details,
      "Source references",
      disclosure.sourceReferences.length
        ? disclosure.sourceReferences.map((reference) => reference.recordId).join(", ")
        : "None"
    );
    appendDetail(details, "Provider tools", "None");
    const actions = document.createElement("div");
    actions.className = "model-egress-disclosure-actions";
    const deny = document.createElement("button");
    deny.type = "button";
    deny.textContent = "Don't send";
    const authorize = document.createElement("button");
    authorize.type = "button";
    authorize.textContent = "Authorize once";
    authorize.disabled = disclosure.policyDecision !== "allow";
    actions.append(deny, authorize);
    dialog.append(title, summary, details, actions);
    document.body.append(dialog);
    const finish = (decision: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(decision);
    };
    deny.addEventListener("click", () => finish(false));
    authorize.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.showModal();
  });
}

function appendDetail(
  list: HTMLDListElement,
  label: string,
  value: string,
  className?: string
): void {
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  if (className) description.className = className;
  list.append(term, description);
}

function disclosureSummary(disclosure: ModelEgressDisclosure): string {
  return [
    "Authorize this one-time ChatGPT request?",
    `Destination: ${disclosure.provider} · ${disclosure.model}`,
    `Purpose: ${disclosure.purpose}`,
    `Data: ${disclosure.dataClasses.join(", ")}`,
    `Exact Owner text: ${disclosure.ownerIntent}`,
    `Source references: ${disclosure.sourceReferences.map((item) => item.recordId).join(", ") || "none"}`,
    "Provider tools: none",
    disclosure.policyReason,
  ].join("\n");
}

function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}
