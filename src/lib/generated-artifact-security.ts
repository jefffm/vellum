import createDOMPurify, {
  type Config,
  type DOMPurify,
  type UponSanitizeAttributeHookEvent,
  type WindowLike,
} from "dompurify";

export const GENERATED_ARTIFACT_POLICY_VERSION = "vellum-generated-artifact-v1" as const;

export const DEFAULT_GENERATED_ARTIFACT_MAX_INPUT_BYTES = 8 * 1024 * 1024;

export const DEFAULT_GENERATED_ARTIFACT_LIMITS = Object.freeze({
  maxInputBytes: DEFAULT_GENERATED_ARTIFACT_MAX_INPUT_BYTES,
  maxNodes: 100_000,
  maxTreeDepth: 128,
  maxAttributesPerElement: 64,
  maxAttributeValueBytes: 32 * 1024,
  maxPathDataBytes: 512 * 1024,
  maxTextNodeBytes: 256 * 1024,
});

/**
 * Defense-in-depth policy for an isolated generated-artifact document.
 *
 * The application CSP is necessarily broader because Vellum itself executes
 * scripts. Generated artifacts must never depend on that broader authority.
 */
export const GENERATED_ARTIFACT_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'none'",
  "img-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "sandbox",
].join("; ");

export type GeneratedArtifactProfile = "notation-svg" | "evaluation-report";

declare const sanitizedGeneratedMarkupBrand: unique symbol;

export type SanitizedGeneratedMarkupText<Profile extends GeneratedArtifactProfile> = string & {
  readonly [sanitizedGeneratedMarkupBrand]: Profile;
};

export type SanitizedGeneratedMarkup<Profile extends GeneratedArtifactProfile> = Readonly<{
  policyVersion: typeof GENERATED_ARTIFACT_POLICY_VERSION;
  profile: Profile;
  markup: SanitizedGeneratedMarkupText<Profile>;
}>;

export type GeneratedArtifactSecurityErrorCode =
  | "invalid_input"
  | "input_too_large"
  | "prohibited_declaration"
  | "malformed_markup"
  | "invalid_svg_root"
  | "complexity_limit_exceeded"
  | "unsupported_environment"
  | "sanitization_failed";

export class GeneratedArtifactSecurityError extends Error {
  readonly code: GeneratedArtifactSecurityErrorCode;
  readonly profile: GeneratedArtifactProfile;

  constructor(
    code: GeneratedArtifactSecurityErrorCode,
    profile: GeneratedArtifactProfile,
    message: string
  ) {
    super(message);
    this.name = "GeneratedArtifactSecurityError";
    this.code = code;
    this.profile = profile;
  }
}

export type GeneratedArtifactSecurityLimits = Readonly<{
  maxInputBytes: number;
  maxNodes: number;
  maxTreeDepth: number;
  maxAttributesPerElement: number;
  maxAttributeValueBytes: number;
  maxPathDataBytes: number;
  maxTextNodeBytes: number;
}>;

export type GeneratedArtifactSecurityOptions = Readonly<Partial<GeneratedArtifactSecurityLimits>>;

export type GeneratedArtifactSecurity = Readonly<{
  policyVersion: typeof GENERATED_ARTIFACT_POLICY_VERSION;
  maxInputBytes: number;
  limits: GeneratedArtifactSecurityLimits;
  sanitizeNotationSvg(input: string): SanitizedGeneratedMarkup<"notation-svg">;
  sanitizeEvaluationReport(input: string): SanitizedGeneratedMarkup<"evaluation-report">;
}>;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const SVG_ALLOWED_TAGS = Object.freeze([
  "svg",
  "g",
  "path",
  "rect",
  "line",
  "polyline",
  "polygon",
  "circle",
  "ellipse",
  "text",
  "tspan",
  "title",
  "desc",
]);

const SVG_ALLOWED_ATTR = Object.freeze([
  "xmlns",
  "version",
  "width",
  "height",
  "viewBox",
  "preserveAspectRatio",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "word-spacing",
  "vector-effect",
  "class",
  "role",
  "aria-label",
  "aria-hidden",
  "data-arrangement-event-id",
  "data-measure-id",
]);

const REPORT_ALLOWED_TAGS = Object.freeze([
  "article",
  "section",
  "aside",
  "header",
  "footer",
  "main",
  "div",
  "p",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "small",
  "mark",
  "code",
  "pre",
  "blockquote",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "details",
  "summary",
  "figure",
  "figcaption",
  "time",
]);

const REPORT_ALLOWED_ATTR = Object.freeze([
  "class",
  "role",
  "title",
  "aria-label",
  "aria-hidden",
  "aria-live",
  "aria-expanded",
  "aria-controls",
  "open",
  "datetime",
  "scope",
  "colspan",
  "rowspan",
  "data-arrangement-event-id",
  "data-measure-id",
]);

const DANGEROUS_TAGS = Object.freeze([
  "script",
  "style",
  "foreignobject",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
  "image",
  "use",
  "a",
  "link",
  "base",
  "meta",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "video",
  "audio",
  "source",
  "track",
  "canvas",
  "math",
]);

const DANGEROUS_CONTENT_TAGS = Object.freeze(DANGEROUS_TAGS.filter((tag) => tag !== "a"));

const DANGEROUS_ATTRIBUTES = Object.freeze([
  "style",
  "href",
  "xlink:href",
  "src",
  "srcset",
  "action",
  "formaction",
  "poster",
  "background",
  "ping",
  "target",
  "download",
]);

const PROHIBITED_DECLARATION = /<\s*!(?:doctype|entity)\b|<\s*\?/i;
const DANGEROUS_CSS_VALUE = /(?:url\s*\(|@import\b|expression\s*\(|-moz-binding\b|behavior\s*:)/i;

export function createGeneratedArtifactSecurity(
  windowLike: WindowLike,
  options: GeneratedArtifactSecurityOptions = {}
): GeneratedArtifactSecurity {
  const limits = resolveLimits(options);
  if (!windowLike || typeof windowLike.DOMParser !== "function") {
    throw new GeneratedArtifactSecurityError(
      "unsupported_environment",
      "notation-svg",
      "Generated artifact sanitation requires a DOMParser-capable window"
    );
  }

  return Object.freeze({
    policyVersion: GENERATED_ARTIFACT_POLICY_VERSION,
    maxInputBytes: limits.maxInputBytes,
    limits,
    sanitizeNotationSvg(input) {
      validateInput(input, "notation-svg", limits.maxInputBytes);
      const parsed = parseSvg(windowLike, input);
      validateTreeBudget(parsed.documentElement, "notation-svg", limits);
      const sanitized = sanitizeWithIsolatedPurifier(
        windowLike,
        parsed.documentElement.outerHTML,
        "notation-svg"
      );
      validateSanitizedSvg(windowLike, sanitized, limits);
      return brandedResult("notation-svg", sanitized);
    },
    sanitizeEvaluationReport(input) {
      validateInput(input, "evaluation-report", limits.maxInputBytes);
      validateReportInputBudget(windowLike, input, limits);
      const sanitized = sanitizeWithIsolatedPurifier(windowLike, input, "evaluation-report");
      validateSanitizedReport(windowLike, sanitized, limits);
      return brandedResult("evaluation-report", sanitized);
    },
  });
}

function validateInput(
  input: string,
  profile: GeneratedArtifactProfile,
  maxInputBytes: number
): void {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new GeneratedArtifactSecurityError(
      "invalid_input",
      profile,
      "Generated artifact markup must be a non-empty string"
    );
  }
  if (exceedsUtf8ByteLimit(input, maxInputBytes)) {
    throw new GeneratedArtifactSecurityError(
      "input_too_large",
      profile,
      `Generated artifact markup exceeds the ${maxInputBytes}-byte limit`
    );
  }
  if (PROHIBITED_DECLARATION.test(input)) {
    throw new GeneratedArtifactSecurityError(
      "prohibited_declaration",
      profile,
      "Generated artifact markup may not contain doctypes, entities, or processing instructions"
    );
  }
}

function parseSvg(windowLike: WindowLike, input: string): Document {
  let document: Document;
  try {
    document = new windowLike.DOMParser().parseFromString(input, "image/svg+xml");
  } catch {
    throw new GeneratedArtifactSecurityError(
      "malformed_markup",
      "notation-svg",
      "Generated notation is not well-formed SVG"
    );
  }
  if (hasParserError(document)) {
    throw new GeneratedArtifactSecurityError(
      "malformed_markup",
      "notation-svg",
      "Generated notation is not well-formed SVG"
    );
  }
  const root = document.documentElement;
  if (root.localName.toLowerCase() !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    throw new GeneratedArtifactSecurityError(
      "invalid_svg_root",
      "notation-svg",
      "Generated notation must have one SVG root in the SVG namespace"
    );
  }
  return document;
}

function sanitizeWithIsolatedPurifier(
  windowLike: WindowLike,
  input: string,
  profile: GeneratedArtifactProfile
): string {
  const purifier = createDOMPurify(windowLike);
  if (!purifier.isSupported) {
    throw new GeneratedArtifactSecurityError(
      "unsupported_environment",
      profile,
      "DOMPurify is unavailable in this environment"
    );
  }

  const hook = (_node: Element, event: UponSanitizeAttributeHookEvent) => {
    const attribute = event.attrName.toLowerCase();
    if (
      attribute.startsWith("on") ||
      DANGEROUS_ATTRIBUTES.includes(attribute) ||
      DANGEROUS_CSS_VALUE.test(event.attrValue)
    ) {
      event.keepAttr = false;
    }
  };
  purifier.addHook("uponSanitizeAttribute", hook);

  try {
    const output = purifier.sanitize(input, configFor(profile));
    if (typeof output !== "string") {
      throw new Error("DOMPurify did not return string markup");
    }
    return output;
  } catch (error) {
    if (error instanceof GeneratedArtifactSecurityError) throw error;
    throw new GeneratedArtifactSecurityError(
      "sanitization_failed",
      profile,
      `Generated artifact sanitation failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  } finally {
    purifier.removeAllHooks();
  }
}

function configFor(profile: GeneratedArtifactProfile): Config {
  const common: Config = {
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_XML: true,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    KEEP_CONTENT: true,
    FORBID_TAGS: [...DANGEROUS_TAGS],
    FORBID_ATTR: [...DANGEROUS_ATTRIBUTES],
    RETURN_TRUSTED_TYPE: false,
  };

  if (profile === "notation-svg") {
    return {
      ...common,
      ALLOWED_TAGS: [...SVG_ALLOWED_TAGS],
      ALLOWED_ATTR: [...SVG_ALLOWED_ATTR],
      ALLOWED_NAMESPACES: [SVG_NAMESPACE],
      NAMESPACE: SVG_NAMESPACE,
      PARSER_MEDIA_TYPE: "image/svg+xml",
    };
  }

  return {
    ...common,
    ALLOWED_TAGS: [...REPORT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...REPORT_ALLOWED_ATTR],
    ALLOWED_NAMESPACES: ["http://www.w3.org/1999/xhtml"],
    FORBID_CONTENTS: [...DANGEROUS_CONTENT_TAGS],
    PARSER_MEDIA_TYPE: "text/html",
  };
}

function validateSanitizedSvg(
  windowLike: WindowLike,
  output: string,
  limits: GeneratedArtifactSecurityLimits
): void {
  const document = parseSvg(windowLike, output);
  validateTreeBudget(document.documentElement, "notation-svg", limits);
  validateTree(document.documentElement, "notation-svg", SVG_ALLOWED_TAGS, SVG_ALLOWED_ATTR);
}

function validateSanitizedReport(
  windowLike: WindowLike,
  output: string,
  limits: GeneratedArtifactSecurityLimits
): void {
  let document: Document;
  try {
    document = new windowLike.DOMParser().parseFromString(output, "text/html");
  } catch {
    throw new GeneratedArtifactSecurityError(
      "sanitization_failed",
      "evaluation-report",
      "Sanitized report could not be reparsed"
    );
  }
  validateTreeBudget(document.body, "evaluation-report", limits);
  validateTree(document.body, "evaluation-report", REPORT_ALLOWED_TAGS, REPORT_ALLOWED_ATTR);
}

function validateReportInputBudget(
  windowLike: WindowLike,
  input: string,
  limits: GeneratedArtifactSecurityLimits
): void {
  let document: Document;
  try {
    document = new windowLike.DOMParser().parseFromString(input, "text/html");
  } catch {
    throw new GeneratedArtifactSecurityError(
      "malformed_markup",
      "evaluation-report",
      "Generated report markup could not be parsed"
    );
  }
  validateTreeBudget(document.body, "evaluation-report", limits);
}

function validateTreeBudget(
  root: Node,
  profile: GeneratedArtifactProfile,
  limits: GeneratedArtifactSecurityLimits
): void {
  let nodes = 0;
  const pending: Array<{ node: Node; depth: number }> = [{ node: root, depth: 1 }];
  while (pending.length > 0) {
    const current = pending.pop()!;
    nodes += 1;
    if (nodes > limits.maxNodes) {
      throwComplexity(profile, `node count exceeds ${limits.maxNodes}`);
    }
    if (current.depth > limits.maxTreeDepth) {
      throwComplexity(profile, `tree depth exceeds ${limits.maxTreeDepth}`);
    }

    if (current.node.nodeType === 1) {
      const element = current.node as Element;
      if (element.attributes.length > limits.maxAttributesPerElement) {
        throwComplexity(
          profile,
          `${element.localName} has more than ${limits.maxAttributesPerElement} attributes`
        );
      }
      for (const attribute of Array.from(element.attributes)) {
        const limit =
          attribute.name.toLowerCase() === "d" || attribute.name.toLowerCase() === "points"
            ? limits.maxPathDataBytes
            : limits.maxAttributeValueBytes;
        if (exceedsUtf8ByteLimit(attribute.value, limit)) {
          throwComplexity(profile, `${attribute.name} exceeds its ${limit}-byte value limit`);
        }
      }
    } else if (
      current.node.nodeType === 3 &&
      exceedsUtf8ByteLimit(current.node.nodeValue ?? "", limits.maxTextNodeBytes)
    ) {
      throwComplexity(profile, `text node exceeds ${limits.maxTextNodeBytes} bytes`);
    }

    for (let index = current.node.childNodes.length - 1; index >= 0; index -= 1) {
      pending.push({ node: current.node.childNodes[index]!, depth: current.depth + 1 });
    }
  }
}

function throwComplexity(profile: GeneratedArtifactProfile, reason: string): never {
  throw new GeneratedArtifactSecurityError(
    "complexity_limit_exceeded",
    profile,
    `Generated artifact exceeds the ${profile} complexity policy: ${reason}`
  );
}

function validateTree(
  root: Element,
  profile: GeneratedArtifactProfile,
  allowedTags: readonly string[],
  allowedAttributes: readonly string[]
): void {
  const allowedTagSet = new Set(allowedTags.map((tag) => tag.toLowerCase()));
  const allowedAttributeSet = new Set(
    allowedAttributes.map((attribute) => attribute.toLowerCase())
  );
  const elements = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const element of elements) {
    const tag = element.localName.toLowerCase();
    if (profile === "evaluation-report" && (tag === "body" || tag === "html")) continue;
    if (!allowedTagSet.has(tag)) {
      throw new GeneratedArtifactSecurityError(
        "sanitization_failed",
        profile,
        `Sanitized ${profile} retained forbidden element ${tag}`
      );
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        !allowedAttributeSet.has(name) ||
        DANGEROUS_CSS_VALUE.test(attribute.value)
      ) {
        throw new GeneratedArtifactSecurityError(
          "sanitization_failed",
          profile,
          `Sanitized ${profile} retained forbidden attribute ${name}`
        );
      }
    }
  }
}

function hasParserError(document: Document): boolean {
  return (
    document.documentElement.localName.toLowerCase() === "parsererror" ||
    document.getElementsByTagName("parsererror").length > 0 ||
    document.getElementsByTagNameNS("*", "parsererror").length > 0
  );
}

function brandedResult<Profile extends GeneratedArtifactProfile>(
  profile: Profile,
  markup: string
): SanitizedGeneratedMarkup<Profile> {
  return Object.freeze({
    policyVersion: GENERATED_ARTIFACT_POLICY_VERSION,
    profile,
    markup: markup as SanitizedGeneratedMarkupText<Profile>,
  });
}

function resolveLimits(options: GeneratedArtifactSecurityOptions): GeneratedArtifactSecurityLimits {
  const limits = {
    ...DEFAULT_GENERATED_ARTIFACT_LIMITS,
    ...options,
  };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`);
    }
  }
  return Object.freeze(limits);
}

function exceedsUtf8ByteLimit(input: string, limit: number): boolean {
  if (input.length > limit) return true;
  let bytes = 0;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < input.length) {
      const next = input.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
    if (bytes > limit) return true;
  }
  return false;
}
