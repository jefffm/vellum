import bundledInventoryJson from "./data/authority-path-inventory.v1.json" with { type: "json" };

export type AuthorityPathRuntimeContext = "evaluation" | "inspection" | "production";

type RuntimeEntry = {
  id: string;
  runtimeAccess: AuthorityPathRuntimeContext[];
  classification: string;
  quarantine: { state: string };
  digest: string;
  [key: string]: unknown;
};

type RuntimeInventory = {
  state: {
    resolver: string;
    productionActivation: string;
  };
  writerContractRef: {
    id: string;
    version: number;
    path: string;
    digest: string;
  };
  entries: RuntimeEntry[];
  digest: string;
  [key: string]: unknown;
};

const EXPECTED_WRITER_CONTRACT_DIGEST =
  "d77b0c7f6fd92b062700a0310a939bf9b1e38b841e241768f6ec5094ce65d24d";

function validateRuntimeInventory(value: unknown): RuntimeInventory {
  if (
    !isRecord(value) ||
    !Array.isArray(value.entries) ||
    !isRecord(value.state) ||
    !isRecord(value.writerContractRef)
  ) {
    throw new Error("Authority Path runtime inventory has an invalid closed shape");
  }
  const digest = value.digest;
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error("Authority Path runtime inventory lacks a valid digest");
  }
  const { digest: _digest, ...core } = value;
  if (runtimeDigest("inventory", core) !== digest) {
    throw new Error("Authority Path runtime inventory digest is stale or invalid");
  }
  if (value.state.resolver !== "disabled" || value.state.productionActivation !== "unchanged") {
    throw new Error("Authority Path runtime inventory is not classification-only");
  }
  if (
    value.writerContractRef.id !== "authority-writer-contract.v1" ||
    value.writerContractRef.version !== 1 ||
    value.writerContractRef.path !== "src/lib/data/authority-writer-contract.v1.json" ||
    value.writerContractRef.digest !== EXPECTED_WRITER_CONTRACT_DIGEST
  ) {
    throw new Error("Authority Path runtime writer contract identity is invalid");
  }
  const ids = new Set<string>();
  for (const item of value.entries) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !Array.isArray(item.runtimeAccess) ||
      typeof item.classification !== "string" ||
      !isRecord(item.quarantine) ||
      typeof item.quarantine.state !== "string" ||
      typeof item.digest !== "string"
    ) {
      throw new Error("Authority Path runtime entry has an invalid closed shape");
    }
    const { digest: entryDigest, ...entryCore } = item;
    if (runtimeDigest("entry", entryCore) !== entryDigest) {
      throw new Error(`Authority Path runtime entry digest is stale or invalid: ${item.id}`);
    }
    if (ids.has(item.id)) throw new Error(`Duplicate Authority Path runtime id: ${item.id}`);
    ids.add(item.id);
    const contexts = item.runtimeAccess;
    if (
      contexts.some(
        (context) => !["evaluation", "inspection", "production"].includes(String(context))
      ) ||
      new Set(contexts).size !== contexts.length
    ) {
      throw new Error(`Authority Path runtime contexts are invalid: ${item.id}`);
    }
    if (
      contexts.includes("production") &&
      (item.quarantine.state !== "not_quarantined" ||
        item.classification === "evaluator_only_logic" ||
        item.classification === "forbidden_unregistered_bypass")
    ) {
      throw new Error(`Forbidden Authority Path is marked production-reachable: ${item.id}`);
    }
  }
  return value as RuntimeInventory;
}

function runtimeDigest(domain: string, value: unknown): string {
  return sha256(`vellum.authority-path-inventory.v1\0${domain}\0${canonicalRuntimeJson(value)}`);
}

function canonicalRuntimeJson(value: unknown, active = new Set<object>()): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Authority Path runtime JSON is non-finite");
    return JSON.stringify(value);
  }
  if (!value || typeof value !== "object") {
    throw new Error("Authority Path runtime JSON contains an unsupported value");
  }
  if (active.has(value)) throw new Error("Authority Path runtime JSON contains a cycle");
  active.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalRuntimeJson(item, active)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalRuntimeJson(record[key], active)}`)
      .join(",")}}`;
  } finally {
    active.delete(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Synchronous browser-safe SHA-256 keeps the bundled inventory fail-closed
// before any guarded production module can execute.
function sha256(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const x = w[index - 15]!;
      const y = w[index - 2]!;
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      w[index] = (w[index - 16]! + s0 + w[index - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const t1 = (hh! + s1 + choice + k[index]! + w[index]!) >>> 0;
      const s0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + majority) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a!) >>> 0;
    h[1] = (h[1]! + b!) >>> 0;
    h[2] = (h[2]! + c!) >>> 0;
    h[3] = (h[3]! + d!) >>> 0;
    h[4] = (h[4]! + e!) >>> 0;
    h[5] = (h[5]! + f!) >>> 0;
    h[6] = (h[6]! + g!) >>> 0;
    h[7] = (h[7]! + hh!) >>> 0;
  }
  return h.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

const inventory = validateRuntimeInventory(bundledInventoryJson);
const entriesById = new Map(inventory.entries.map((entry) => [entry.id, entry]));

export class AuthorityPathRuntimeError extends Error {
  readonly code:
    | "authority_inventory_state_invalid"
    | "runtime_context_forbidden"
    | "unknown_authority_path";

  constructor(code: AuthorityPathRuntimeError["code"], message: string) {
    super(message);
    this.name = "AuthorityPathRuntimeError";
    this.code = code;
  }
}

/**
 * Browser-safe production guard for one frozen Authority Path Inventory entry.
 * It grants no authority and never resolves knowledge; it only fails closed when
 * the compiled reader is not bound to a permitted classification-only path.
 */
export function assertAuthorityPathRuntime(id: string, context: AuthorityPathRuntimeContext): void {
  if (
    inventory.state.resolver !== "disabled" ||
    inventory.state.productionActivation !== "unchanged"
  ) {
    throw new AuthorityPathRuntimeError(
      "authority_inventory_state_invalid",
      "Authority Path Inventory must remain classification-only in T08"
    );
  }
  const entry = entriesById.get(id);
  if (!entry) {
    throw new AuthorityPathRuntimeError(
      "unknown_authority_path",
      `Unknown Authority Path Inventory id: ${id}`
    );
  }
  if (!entry.runtimeAccess.includes(context)) {
    throw new AuthorityPathRuntimeError(
      "runtime_context_forbidden",
      `${id} is not classified for the ${context} runtime context`
    );
  }
  if (
    context === "production" &&
    (entry.quarantine.state !== "not_quarantined" ||
      entry.classification === "evaluator_only_logic" ||
      entry.classification === "forbidden_unregistered_bypass")
  ) {
    throw new AuthorityPathRuntimeError(
      "runtime_context_forbidden",
      `${id} cannot execute through a production path`
    );
  }
}
