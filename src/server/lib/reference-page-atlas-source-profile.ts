import {
  referenceSourceDigest,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
} from "../../lib/reference-source-domain.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import type { ReferencePageAtlasInspection } from "./reference-page-atlas-parser.js";

export type MacePageAtlasSourceProfile = Readonly<{
  schemaVersion: 1;
  id: string;
  registryRef: ReferenceRecordRef;
  evidenceRef: ReferenceRecordRef;
  exactAsset: Readonly<{
    sha256: string;
    byteLength: number;
    mediaType: "application/pdf";
    pageCount: number;
  }>;
  identity: Readonly<{
    preferredTitle: string;
    workDate: string;
    language: string;
    claimantKind: "catalog" | "system";
  }>;
  atlas: Readonly<{
    targetScanPage: number;
    targetPrintedPage: string;
    initialScanPages: readonly number[];
    printedPageOffset: number;
  }>;
  extraction: Readonly<{
    originalTranscription: string;
    normalizedTranscription: string;
    mappings: readonly Readonly<{ course: 7 | 8 | 9 | 10 | 11 | 12; symbol: string }>[];
    regions: Readonly<{
      text: Readonly<{ x: number; y: number; width: number; height: number }>;
      notation: Readonly<{ x: number; y: number; width: number; height: number }>;
    }>;
  }>;
  configurationDigest: string;
}>;

export type ReferencePageAtlasSourceProfileResolver = Readonly<{
  resolveMaceProfile: (
    input: Readonly<{
      digitalAsset: ReferenceDigitalAsset;
      inspection: ReferencePageAtlasInspection;
    }>
  ) => MacePageAtlasSourceProfile | null;
}>;

/**
 * Exact public-scan registry entry, not an Owner-reference inference.
 *
 * The checksum and file length identify the publicly downloadable Internet
 * Archive object independently of any Owner-private library. Repository data
 * contains only catalog identity, normalized factual locators, and the six
 * symbols already specified in SPEC.md; it contains no page pixels or prose.
 */
export const PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE = defineMacePageAtlasSourceProfile({
  id: "source-profile.mace-musicks-monument-1676.archive-org.v1",
  registryRef: publicRef("registry.reference-source-profile.archive-org.v1"),
  evidenceRef: publicRef("catalog.archive-org.musicksmonumento0000mace.pdf"),
  exactAsset: {
    sha256: "2f27a1aed2cf8d51cc47942c132a8a15ea6cad93965505d7a41b85985baf40b7",
    byteLength: 16_093_259,
    mediaType: "application/pdf",
    pageCount: 310,
  },
  identity: {
    preferredTitle: "Musick's Monument",
    workDate: "1676",
    language: "en",
    claimantKind: "catalog",
  },
  atlas: {
    targetScanPage: 105,
    targetPrintedPage: "75",
    initialScanPages: [104, 105, 106],
    printedPageOffset: 30,
  },
  extraction: {
    originalTranscription: "a /a //a ///a 4 5",
    normalizedTranscription: "a /a //a ///a 4 5",
    mappings: [
      { course: 7, symbol: "a" },
      { course: 8, symbol: "/a" },
      { course: 9, symbol: "//a" },
      { course: 10, symbol: "///a" },
      { course: 11, symbol: "4" },
      { course: 12, symbol: "5" },
    ],
    regions: {
      text: { x: 0.103, y: 0.644, width: 0.655, height: 0.064 },
      notation: { x: 0.511, y: 0.554, width: 0.249, height: 0.085 },
    },
  },
});

export class ExactAssetReferencePageAtlasSourceProfileResolver implements ReferencePageAtlasSourceProfileResolver {
  constructor(
    private readonly maceProfiles: readonly MacePageAtlasSourceProfile[] = [
      PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE,
    ]
  ) {}

  resolveMaceProfile(
    input: Readonly<{
      digitalAsset: ReferenceDigitalAsset;
      inspection: ReferencePageAtlasInspection;
    }>
  ): MacePageAtlasSourceProfile | null {
    assertAuthorityPathRuntime(
      "authority.profile.reference-page-atlas-exact-source-routing",
      "production"
    );
    return (
      this.maceProfiles.find(
        ({ exactAsset }) =>
          input.digitalAsset.sha256 === exactAsset.sha256 &&
          input.digitalAsset.byteLength === exactAsset.byteLength &&
          input.digitalAsset.mediaType === exactAsset.mediaType &&
          input.inspection.pageCount === exactAsset.pageCount
      ) ?? null
    );
  }
}

export function defineMacePageAtlasSourceProfile(
  input: Omit<MacePageAtlasSourceProfile, "schemaVersion" | "configurationDigest">
): MacePageAtlasSourceProfile {
  assertProfile(input);
  const core = structuredClone({ schemaVersion: 1 as const, ...input });
  return deepFreeze({
    ...core,
    configurationDigest: referenceSourceDigest(core),
  });
}

function assertProfile(
  profile: Omit<MacePageAtlasSourceProfile, "schemaVersion" | "configurationDigest">
): void {
  const expectedSymbols = ["a", "/a", "//a", "///a", "4", "5"] as const;
  if (
    !/^[a-f0-9]{64}$/u.test(profile.exactAsset.sha256) ||
    profile.exactAsset.byteLength < 1 ||
    profile.exactAsset.pageCount < 1 ||
    profile.atlas.targetScanPage > profile.exactAsset.pageCount ||
    !profile.atlas.initialScanPages.includes(profile.atlas.targetScanPage) ||
    new Set(profile.atlas.initialScanPages).size !== profile.atlas.initialScanPages.length ||
    profile.atlas.initialScanPages.some(
      (ordinal) => ordinal < 1 || ordinal > profile.exactAsset.pageCount
    ) ||
    !Number.isSafeInteger(profile.atlas.printedPageOffset) ||
    profile.extraction.originalTranscription !== expectedSymbols.join(" ") ||
    profile.extraction.normalizedTranscription !== expectedSymbols.join(" ") ||
    profile.extraction.mappings.length !== 6 ||
    profile.extraction.mappings.some(
      ({ course, symbol }, index) => course !== index + 7 || symbol !== expectedSymbols[index]
    )
  ) {
    throw new TypeError("Mace Page Atlas source profile is invalid");
  }
  for (const region of Object.values(profile.extraction.regions)) {
    if (
      region.x < 0 ||
      region.y < 0 ||
      region.width <= 0 ||
      region.height <= 0 ||
      region.x + region.width > 1 ||
      region.y + region.height > 1
    ) {
      throw new TypeError("Mace Page Atlas source profile region is invalid");
    }
  }
}

function publicRef(id: string): ReferenceRecordRef {
  return Object.freeze({ id, digest: referenceSourceDigest({ id }) });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
