import { createHash } from "node:crypto";

export type BaroqueGuitarPunteadoPolicy = Readonly<{
  packId: "knowledge-pack.baroque-guitar-punteado";
  version: 1 | 2;
  authorityLane: "software_heuristic" | "historical_practice";
  domain: "instrument_technique";
  applicability: Readonly<{
    instrumentFamily: "five-course-baroque-guitar";
    technique: "punteado";
  }>;
  citation: Readonly<{
    sourceId: string;
    locator: string;
    publicUrl?: string;
  }>;
  consequence: Readonly<{
    maximumSimultaneousAttacks: 3 | 4;
    rightHandFingers: readonly ("p" | "i" | "m" | "a")[];
  }>;
}>;

export type SanzPunteadoKnowledgeCandidate = Readonly<{
  id: "knowledge-candidate.sanz-punteado-fourth-finger";
  status: "proposed";
  activationAllowed: false;
  source: Readonly<{
    id: string;
    sha256: string;
    byteLength: number;
    bibliographicIdentity: Readonly<{
      author: "Gaspar Sanz";
      title: "Instrucción de música sobre la guitarra española";
      publicationYear: 1697;
    }>;
    rightsBasis: Readonly<{
      status: "public_domain";
      rationale: string;
    }>;
    citedSegment: Readonly<{
      sourcePage: 17;
      excerptPage: 1;
      locator: string;
    }>;
  }>;
  authorityLane: "historical_practice";
  domain: "instrument_technique";
  applicability: BaroqueGuitarPunteadoPolicy["applicability"];
  proposition: string;
  declarativeConsequence: BaroqueGuitarPunteadoPolicy["consequence"];
}>;

export type ReviewedSanzPunteadoKnowledge = Readonly<{
  candidateId: SanzPunteadoKnowledgeCandidate["id"];
  reviewState: "reviewed";
  reviewedBy: "owner";
  reviewedAt: string;
  rationale: string;
  pack: BaroqueGuitarPunteadoPolicy;
}>;

export const SANZ_PUNTEADO_EXCERPT = Object.freeze({
  sha256: "8991a09bce4a4a0011f29ac63a4033ad96a476bf70051db9be41a99b347c585c",
  byteLength: 48_655,
  repositoryPath: "knowledge-packs/sources/sanz-1697-punteado-rule-page-17.pdf",
  publicUrl:
    "https://commons.wikimedia.org/wiki/File:Instruccion_de_musica_sobre_la_guitarra_espanola_-_y_metodo_de_susprimeros_rudimentos,_hasta_tanerla_con_destreza_-_con_dos_laberintos_ingeniosos,_variedad_de_sones_(IA_instrucciondemus0000sanz).pdf",
});

export const BASELINE_PUNTEADO_POLICY: BaroqueGuitarPunteadoPolicy = deepFreeze({
  packId: "knowledge-pack.baroque-guitar-punteado",
  version: 1,
  authorityLane: "software_heuristic",
  domain: "instrument_technique",
  applicability: {
    instrumentFamily: "five-course-baroque-guitar",
    technique: "punteado",
  },
  citation: {
    sourceId: "software-heuristic.vellum-punteado-three-fingers",
    locator: "Original Vellum conservative p-i-m default",
  },
  consequence: {
    maximumSimultaneousAttacks: 3,
    rightHandFingers: ["p", "i", "m"],
  },
});

export function extractSanzPunteadoCandidate(input: {
  sourceId: string;
  bytes: Uint8Array;
}): SanzPunteadoKnowledgeCandidate {
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  if (sha256 !== SANZ_PUNTEADO_EXCERPT.sha256 || input.bytes.byteLength !== 48_655) {
    throw new Error("The Sanz cited excerpt bytes do not match the reviewed source segment");
  }
  return deepFreeze({
    id: "knowledge-candidate.sanz-punteado-fourth-finger",
    status: "proposed",
    activationAllowed: false,
    source: {
      id: input.sourceId,
      sha256,
      byteLength: input.bytes.byteLength,
      bibliographicIdentity: {
        author: "Gaspar Sanz",
        title: "Instrucción de música sobre la guitarra española",
        publicationYear: 1697,
      },
      rightsBasis: {
        status: "public_domain",
        rationale: "The cited original was published in 1697; this excerpt is from a public scan.",
      },
      citedSegment: {
        sourcePage: 17,
        excerptPage: 1,
        locator:
          "Rules for punteado, right column: a fourth right-hand finger may be applied when necessary for a fourth voice.",
      },
    },
    authorityLane: "historical_practice",
    domain: "instrument_technique",
    applicability: {
      instrumentFamily: "five-course-baroque-guitar",
      technique: "punteado",
    },
    proposition:
      "Sanz permits a fourth right-hand finger when necessary to sound a fourth voice in punteado.",
    declarativeConsequence: {
      maximumSimultaneousAttacks: 4,
      rightHandFingers: ["p", "i", "m", "a"],
    },
  });
}

export function reviewSanzPunteadoCandidate(
  candidate: SanzPunteadoKnowledgeCandidate,
  input: { reviewedAt: string; rationale: string }
): ReviewedSanzPunteadoKnowledge {
  if (!input.rationale.trim()) throw new Error("Owner review rationale is required");
  return deepFreeze({
    candidateId: candidate.id,
    reviewState: "reviewed",
    reviewedBy: "owner",
    reviewedAt: input.reviewedAt,
    rationale: input.rationale,
    pack: {
      packId: "knowledge-pack.baroque-guitar-punteado",
      version: 2,
      authorityLane: candidate.authorityLane,
      domain: candidate.domain,
      applicability: candidate.applicability,
      citation: {
        sourceId: candidate.source.id,
        locator: candidate.source.citedSegment.locator,
        publicUrl: SANZ_PUNTEADO_EXCERPT.publicUrl,
      },
      consequence: candidate.declarativeConsequence,
    },
  });
}

export function resolveBaroqueGuitarPunteadoPolicy(
  version: 1 | 2,
  reviewed?: ReviewedSanzPunteadoKnowledge
): BaroqueGuitarPunteadoPolicy {
  if (version === 1) return BASELINE_PUNTEADO_POLICY;
  if (!reviewed || reviewed.pack.version !== 2) {
    throw new Error("Punteado Knowledge Pack v2 is unavailable until Owner review");
  }
  return reviewed.pack;
}

export function baroqueGuitarPunteadoPolicyForTarget(
  policy: BaroqueGuitarPunteadoPolicy,
  instrumentId: string
): BaroqueGuitarPunteadoPolicy | undefined {
  return instrumentId === "baroque-guitar-5" ? policy : undefined;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
