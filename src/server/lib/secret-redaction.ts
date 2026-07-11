const SECRET_KEY =
  /(api[-_ ]?key|authorization|access(?:_token)?|refresh(?:_token)?|token|secret|password|code|state)/i;

export function redactSecretText(value: string, knownSecrets: string[] = []): string {
  let redacted = value;
  for (const secret of knownSecrets.filter((candidate) => candidate.length > 0)) {
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted api key]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .replace(/([?&](?:code|state|token|access_token|refresh_token)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(
      /("(?:api[-_ ]?key|authorization|access|refresh|token|secret|password|code|state)"\s*:\s*")[^"]*(")/gi,
      "$1[redacted]$2"
    )
    .replace(
      /((?:api[-_ ]?key|authorization|access|refresh|token|secret|password|code|state)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[redacted]"
    );
}

export function redactSecretValue(value: unknown, knownSecrets: string[] = []): unknown {
  if (typeof value === "string") return redactSecretText(value, knownSecrets);
  if (Array.isArray(value)) return value.map((item) => redactSecretValue(item, knownSecrets));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[redacted]" : redactSecretValue(item, knownSecrets),
    ])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
