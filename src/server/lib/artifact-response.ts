import { createHash } from "node:crypto";
import path from "node:path";
import type { Response } from "express";
import type { Deliverable, SourceArtifact } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";

const ARTIFACT_CONTENT_SECURITY_POLICY = [
  "sandbox",
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const sourceMimeTypesByKind: Record<SourceArtifact["kind"], ReadonlySet<string>> = {
  pdf: new Set(["application/pdf"]),
  image: new Set(["image/png", "image/jpeg"]),
  musicxml: new Set(["application/vnd.recordare.musicxml+xml", "application/xml", "text/xml"]),
  lilypond: new Set(["text/x-lilypond"]),
  abc: new Set(["text/vnd.abc"]),
  mei: new Set(["application/mei+xml"]),
  mscz: new Set(["application/vnd.musescore.mscz"]),
  lead_sheet: new Set(["application/vnd.vellum.lead-sheet+json"]),
  tablature: new Set(["application/vnd.vellum.tablature+json"]),
  natural_language: new Set(["text/plain"]),
};

const deliverableMimeTypeByKind: Record<Deliverable["kind"], string> = {
  browser_preview: "image/svg+xml",
  pdf: "application/pdf",
  midi: "audio/midi",
  lilypond: "text/x-lilypond",
  musicxml: "application/vnd.recordare.musicxml+xml",
  audio_preview: "application/json",
};

const deliverableExtensionByKind: Record<Deliverable["kind"], string> = {
  browser_preview: "svg",
  pdf: "pdf",
  midi: "midi",
  lilypond: "ly",
  musicxml: "musicxml",
  audio_preview: "json",
};

export function validateSourceArtifactForServing(artifact: SourceArtifact, content: Buffer): void {
  if (!sourceMimeTypesByKind[artifact.kind].has(artifact.mimeType)) {
    throw new ApiRouteError("Stored source kind and MIME type are inconsistent", 409, "conflict");
  }
  validateStoredBytes(artifact, content, "source");
  validateMagicBytes(artifact.mimeType, content, "source");
}

export function validateDeliverableForServing(deliverable: Deliverable, content: Buffer): void {
  if (deliverableMimeTypeByKind[deliverable.kind] !== deliverable.mimeType) {
    throw new ApiRouteError(
      "Stored deliverable kind and MIME type are inconsistent",
      409,
      "conflict"
    );
  }
  validateStoredBytes(deliverable, content, "deliverable");
  validateMagicBytes(deliverable.mimeType, content, "deliverable");
}

export function setSourceArtifactResponseHeaders(
  response: Response,
  artifact: SourceArtifact
): void {
  const inline =
    artifact.mimeType === "application/pdf" ||
    artifact.mimeType === "image/png" ||
    artifact.mimeType === "image/jpeg";
  setArtifactResponseHeaders(response, {
    mimeType: artifact.mimeType,
    byteLength: artifact.byteLength,
    sha256: artifact.sha256,
    filename: artifact.filename,
    disposition: inline ? "inline" : "attachment",
  });
}

export function setDeliverableResponseHeaders(response: Response, deliverable: Deliverable): void {
  setArtifactResponseHeaders(response, {
    mimeType: deliverable.mimeType,
    byteLength: deliverable.byteLength,
    sha256: deliverable.sha256,
    filename: `${deliverable.id}.${deliverableExtensionByKind[deliverable.kind]}`,
    disposition: deliverable.kind === "pdf" ? "inline" : "attachment",
  });
}

function setArtifactResponseHeaders(
  response: Response,
  artifact: {
    mimeType: string;
    byteLength: number;
    sha256: string;
    filename: string;
    disposition: "inline" | "attachment";
  }
): void {
  response.setHeader("Content-Type", artifact.mimeType);
  response.setHeader("Content-Length", artifact.byteLength);
  response.setHeader(
    "Content-Disposition",
    `${artifact.disposition}; filename="${safeHeaderFilename(artifact.filename)}"`
  );
  response.setHeader("ETag", `"sha256-${artifact.sha256}"`);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", ARTIFACT_CONTENT_SECURITY_POLICY);
}

function validateStoredBytes(
  metadata: { sha256: string; byteLength: number },
  content: Buffer,
  label: "source" | "deliverable"
): void {
  const sha256 = createHash("sha256").update(content).digest("hex");
  if (content.byteLength !== metadata.byteLength || sha256 !== metadata.sha256) {
    throw new ApiRouteError(`Stored ${label} failed integrity validation`, 409, "conflict");
  }
}

function validateMagicBytes(
  mimeType: string,
  content: Buffer,
  label: "source" | "deliverable"
): void {
  const valid = (() => {
    switch (mimeType) {
      case "application/pdf":
        return content.subarray(0, 5).equals(Buffer.from("%PDF-"));
      case "image/png":
        return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      case "image/jpeg":
        return (
          content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
        );
      case "audio/midi":
        return content.subarray(0, 4).equals(Buffer.from("MThd"));
      case "image/svg+xml":
        return startsWithXmlRoot(content, "svg");
      case "application/vnd.recordare.musicxml+xml":
        return startsWithAnyXmlRoot(content) || isZip(content);
      case "application/xml":
      case "text/xml":
        return startsWithAnyXmlRoot(content);
      case "application/mei+xml":
        return startsWithXmlRoot(content, "mei");
      case "application/vnd.musescore.mscz":
        return isZip(content);
      case "application/json":
      case "application/vnd.vellum.lead-sheet+json":
      case "application/vnd.vellum.tablature+json":
        return isJson(content);
      case "text/x-lilypond":
      case "text/vnd.abc":
      case "text/plain":
        return !content.includes(0);
      default:
        return false;
    }
  })();

  if (!valid) {
    throw new ApiRouteError(
      `Stored ${label} content does not match its MIME type`,
      409,
      "conflict"
    );
  }
}

function startsWithXmlRoot(content: Buffer, root: string): boolean {
  const text = xmlPrefix(content);
  return new RegExp(`^<${root}(?:\\s|>)`, "i").test(text);
}

function startsWithAnyXmlRoot(content: Buffer): boolean {
  return /^<[A-Za-z_][A-Za-z0-9_.:-]*(?:\s|>)/.test(xmlPrefix(content));
}

function xmlPrefix(content: Buffer): string {
  return content
    .subarray(0, 4096)
    .toString("utf8")
    .replace(/^\uFEFF?\s*/, "")
    .replace(/^<\?xml[^?]*\?>\s*/i, "")
    .replace(/^<!DOCTYPE\s+[A-Za-z_:][^>]*>\s*/i, "");
}

function isZip(content: Buffer): boolean {
  return (
    content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
    content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
  );
}

function isJson(content: Buffer): boolean {
  try {
    JSON.parse(content.toString("utf8"));
    return true;
  } catch {
    return false;
  }
}

function safeHeaderFilename(filename: string): string {
  const safe = path.basename(filename).replace(/[^A-Za-z0-9._-]/g, "-");
  return safe.length > 0 && safe !== "." && safe !== ".." ? safe : "artifact";
}
