import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  withReferenceRecordDigest,
  type ReferenceDigitalAsset,
} from "../../lib/reference-source-domain.js";
import {
  defineMacePageAtlasSourceProfile,
  ExactAssetReferencePageAtlasSourceProfileResolver,
  PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE,
} from "./reference-page-atlas-source-profile.js";

describe("exact-asset Page Atlas source profiles", () => {
  it("matches only the exact registered bytes and structural page identity", () => {
    const resolver = new ExactAssetReferencePageAtlasSourceProfileResolver();
    const asset = digitalAsset(
      PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.exactAsset.sha256,
      PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.exactAsset.byteLength
    );
    const inspection = inspectedPages(310);

    expect(resolver.resolveMaceProfile({ digitalAsset: asset, inspection })).toBe(
      PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE
    );
    expect(
      resolver.resolveMaceProfile({
        digitalAsset: { ...asset, sha256: "0".repeat(64) },
        inspection,
      })
    ).toBeNull();
    expect(
      resolver.resolveMaceProfile({ digitalAsset: asset, inspection: inspectedPages(110) })
    ).toBeNull();
  });

  it("supports an exact self-authored profile without weakening production matching", () => {
    const bytes = new TextEncoder().encode("self-authored T11 source profile fixture");
    const asset = digitalAsset(createHash("sha256").update(bytes).digest("hex"), bytes.byteLength);
    const fixture = defineMacePageAtlasSourceProfile({
      id: "source-profile.self-authored-t11.v1",
      registryRef: PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.registryRef,
      evidenceRef: PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.evidenceRef,
      exactAsset: {
        sha256: asset.sha256,
        byteLength: asset.byteLength,
        mediaType: "application/pdf",
        pageCount: 110,
      },
      atlas: {
        ...PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.atlas,
        initialScanPages: [104, 105, 106],
      },
      identity: PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.identity,
      extraction: PUBLIC_MACE_MUSICKS_MONUMENT_PROFILE.extraction,
    });
    const resolver = new ExactAssetReferencePageAtlasSourceProfileResolver([fixture]);

    expect(
      resolver.resolveMaceProfile({ digitalAsset: asset, inspection: inspectedPages(110) })?.id
    ).toBe(fixture.id);
    expect(
      new ExactAssetReferencePageAtlasSourceProfileResolver().resolveMaceProfile({
        digitalAsset: asset,
        inspection: inspectedPages(110),
      })
    ).toBeNull();
  });
});

function digitalAsset(sha256: string, byteLength: number): ReferenceDigitalAsset {
  return withReferenceRecordDigest({
    recordKind: "digital_asset",
    id: "digital-asset.source-profile-test",
    sha256,
    mediaType: "application/pdf",
    byteLength,
  }) as ReferenceDigitalAsset;
}

function inspectedPages(pageCount: number) {
  return {
    schemaVersion: 1 as const,
    parserId: "poppler.pdfinfo" as const,
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      scanOrdinal: index + 1,
      widthPoints: 409,
      heightPoints: 674,
      rotationDegrees: 0 as const,
    })),
  };
}
