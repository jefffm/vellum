# Pinned MEI 5.1 schema

`mei-all.rng` is the upstream MEI 5.1 Relax NG schema downloaded from:

<https://music-encoding.org/schema/5.1/mei-all.rng>

- Upstream generation date recorded in the schema: 2025-01-22
- Retrieved: 2026-07-20
- SHA-256: `24f0d6e53eebdaf6e85f91f38fccc479bf91a200e15177d5284070cafd3b29bc`
- License: Educational Community License 2.0, as declared in the schema header

The broader upstream schema is necessary because MEI's CMN customization excludes the facsimile
module required by Vellum's source-linked transcription. Vellum's separate Diplomatic Tablature
Profile supplies the narrow permitted subset and evidence-layer rules.

Vellum verifies the digest before every uncached canonical MEI validation and never fetches a
schema at runtime. Updating the schema requires changing the vendored bytes and the pinned digest
in `src/server/lib/mei-schema-validator.ts` together.
