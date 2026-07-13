# Instrument Knowledge Source Ingestion

Status: Draft proposal informed by seed imports on 2026-07-13

## Purpose

Vellum needs to accumulate instrument idiom without treating model memory, one performer's experience, or one historical source as universal truth. The Owner should be able to add a PDF or image set, let Vellum locate potentially reusable evidence, compare it with existing knowledge, and review any resulting Knowledge Candidates before a Knowledge Pack changes.

This proposal extends the boundary accepted in ADR 0015 and ADR 0021. Raw references, extracted evidence, historical claims, performer evidence, personal preferences, and evaluator calibration remain different records with different review authorities.

## Knowledge lanes

| Evidence                              | Canonical destination                                          | May directly change arranging behavior?                       |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Cited period prescription             | Historical Practice Claim in a reviewed Knowledge Pack         | Only after specialist review and pack release                 |
| Pattern observed in period repertoire | Descriptive observation with cited examples and sampling scope | No; it may support a reviewed claim or profile                |
| Modern method or editorial synthesis  | Scoped modern editorial claim                                  | Only after its authority and source dependencies are explicit |
| Exact instrument geometry             | Instrument Model or Instrument Instance                        | Yes, as mechanics rather than history                         |
| Physical playing result               | Owner Playtest or Owner Ergonomic Profile candidate            | Only in the reviewed performer context                        |
| Recurring Owner choice                | Personal Default Candidate                                     | Only after Owner approval                                     |
| Repeated evaluator error              | Fixture or Calibration Candidate                               | Only after its separate review and held-out evaluation        |

## Seed Owner Reference Library

The files below are stored content-addressed under `~/.vellum/owner/references`. Raw binaries are deliberately not committed to Git.

| Owner Reference                                                                                                    | Evidence class                               | Primary extraction use                                                                                                       | Important boundary                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference.fa64c52754b9c5c9da8ca9a6` — Gaspar Sanz, _Instrucción de música sobre la guitarra española_, 1697 issue | Primary treatise and repertory               | Rasgueado, punteado, alfabeto, campanella, accompaniment, counterpoint, right- and left-hand practice                        | Multiple pagination systems; long-s Spanish; engraved tablature; Sanz permits a fourth right-hand finger in some four-voice contexts                                    |
| `reference.25f3bec96fc531e1163ee219` — Ernst Gottlieb Baron, _Untersuchung des Instruments der Lauten_, 1727       | Primary treatise                             | Posture, fingering, barrés, transitions, ornaments, articulation, cantabile texture                                          | Fraktur OCR is poor; the illustrated ordinary instrument is eleven-course, not direct thirteen-course geometry                                                          |
| `reference.2f27a1aed2cf8d51cc47942c` — Thomas Mace, _Musick's Monument_, 1676                                      | Primary treatise                             | Lute posture, economical motion, right-hand use, tablature, diapason notation                                                | English, twelve-course, and an earlier tuning context; PDF page 105 / printed page 75 shows `a`, `/a`, `//a`, `///a`, `4`, `5` but supplies no thirteenth-course symbol |
| `reference.b3954e282090249b3cf803e6` — Silvius Leopold Weiss, _9 Pieces_, D-Dl Mus.2841-V-1,2, [1730–1765]         | Primary repertoire manuscript                | Voice leading, texture density, open diapasons, resonance, damping opportunities, and position transitions                   | Descriptive repertoire evidence, not a prescriptive method; handwritten tablature needs an image-first parser and piece-level course-count confidence                   |
| `reference.85206ca3d0b3b88626f0f0fe` — Fernando Sor, _Méthode pour la guitare_, first-edition text volume, 1830    | Primary treatise text                        | Harmony-aware fingering, accompaniment, bass continuity, melody, thirds, sixths, right-hand allocation, orchestral reduction | The examples and plates are a separate digital asset and must be linked rather than presumed present                                                                    |
| `reference.3ca8c55b0596b459c91dc607` — Ferdinando Carulli, _L'Harmonie appliquée à la Guitare_, 1825               | Primary treatise with worked reductions      | Aligned source texture to guitar reduction, harmony, inversions, resolutions, non-chord tones, accompaniment construction    | Mixed vocal, keyboard, orchestral, guitar, and two-guitar systems require region classification before OMR                                                              |
| `reference.d9eaa4f1484cc175bff9cb6a` — Sor/Harrison, _Method for the Guitar_, 1896                                 | Public-domain editorial derivative           | Edition comparison and navigation                                                                                            | Harrison says it is condensed, rewritten, and edited and explicitly removes material; it must not stand in for Sor's 1830 authority                                     |
| `reference.067e795216e418b8ec1793f7` — Toyohiko Satoh, _Method for the Baroque Lute_, 1987                         | Modern copyrighted secondary method, private | Practical fingering, exercises, and modern synthesis to compare with primary evidence and playtests                          | Local reference use only; not redistributable and not a primary historical authority                                                                                    |
| `reference.3c460a24ec66ff927a11bc8c` — _Basic Chords on Baroque Lute_ working sheet                                | Unattributed private note                    | Handwriting and owner-note extraction fixture                                                                                | Authorship and provenance are unresolved; no reusable claim may be promoted without review                                                                              |

The BLUEUSB inventory currently contains 93 visible files: 70 PDFs, 21 JPEG images, one MuseScore file, and one additional JPEG. It includes large manuscript collections, Weiss facsimiles and working editions, Falckenhagen lessons, Blohm material, Satoh's method, working annotations, and modern transcriptions. Import should be selective and deduplicated rather than copying the entire volume blindly.

## Researched acquisition backlog

### Five-course baroque guitar

- Francesco Corbetta, [_La Guitarre royalle_ (1671)](https://gallica.bnf.fr/ark:/12148/bpt6k1505774n): mixed style, batteries, held harmony, course suppression, vocal accompaniment, and continuo.
- Giovanni Paolo Foscarini, [_I quattro libri della chitarra spagnola_ (c. 1632–1635)](<https://imslp.org/wiki/I_quattro_libri_della_chitarra_spagnola_(Foscarini,_Giovanni)>): transition from alfabeto and strumming into mixed tablature.
- Angelo Michele Bartolotti, [_Libro primo di chitarra spagnola_ (1640)](<https://imslp.org/wiki/Libro_Primo_Di_Chitarra_Spagnola_(Bartolotti,_Angelo_Michele)>): explicit stroke annotation and systematic harmonic material.
- Santiago de Murcia, [_Resumen de acompañar la parte con la guitarra_ (1714/1717)](<https://imslp.org/wiki/Resumen_de_acompa%C3%B1ar_la_parte_con_la_guitarra_(Murcia,_Santiago_de)>): continuo, figured bass, cadences, scales, meter, and accompaniment.

### Baroque lute

- Perrine, [_Livre de Musique pour le Lut_ (1679/1680)](https://gallica.bnf.fr/ark:/12148/btv1b100756018): staff-to-lute mapping, style brisé, movement rules, and continuo.
- Weiss, [_8 Suites_, D-Dl Mus.2841-V-1,1](https://digital.slub-dresden.de/id508190533): complementary D-minor-tuning manuscript evidence.
- Thomas Mace already supplies exact twelve-course bass notation. Vellum must continue to report the thirteenth-course symbol as unresolved until a properly scoped source supports it.
- Falckenhagen's _6 Lute Sonatas_, Op. 1 is useful thirteen-course repertoire but should remain quarantined until its physical exemplar and disputed publication metadata are resolved.

### Six-string classical guitar

- Dionisio Aguado, [_Nuevo método para guitarra_ (1843)](<https://imslp.org/wiki/Nuevo_m%C3%A9todo_para_guitarra_(Aguado,_Dionisio)>): simultaneous parts, right-hand allocation, intervals, barrés, harmony, and expression.
- Ferdinando Carulli, [_Méthode pour apprendre à accompagner le chant_, Op. 61](https://gallica.bnf.fr/ark:/12148/btv1b100704061): explicit melody-plus-accompaniment corpus.
- Matteo Carcassi, [_New and Improved Method for the Guitar_, Op. 59](https://archive.org/details/newimprovedmeth00carc): graded fingering and multi-voice repertoire examples.
- Sor's separate 1830 examples volume should be imported and linked to the text volume before extracting claims whose cited evidence depends on a plate.

## What the first imports revealed

### One `OwnerReference` record is too coarse

The current record collapses a work, edition, physical exemplar, scan, and citation into a title and citation string. The Sor misidentification exposed the failure: archive metadata grouped a heavily rewritten 1896 English edition under the 1830 method, while the title page identified a different authority.

The durable model needs distinct identities for:

1. Work — the abstract authored work.
2. Edition — publication date, language, editor, translator, and declared changes.
3. Exemplar — holding institution, shelfmark, completeness, and physical peculiarities.
4. Digital asset — provider URL, retrieval date, checksum, media type, page count, and scan-provider rights.
5. Source segment — printed locator, scan/canvas locator, bounding box, modality, transcription, translation, and confidence.

Underlying-work rights, scan-provider terms, and private-library access must be separate assertions. A public-domain work can have provider reuse conditions; a copyrighted private method can still support local reviewed candidates without being redistributed.

### Extraction must be layout- and modality-aware

The seed library contains:

- prose with long-s OCR errors;
- Fraktur prose;
- engraved and handwritten French tablature;
- alfabeto charts and mixed-style notation;
- staff notation, figured bass, tablature, and prose on one page;
- separate text and plate volumes;
- parallel orchestral or vocal sources and guitar reductions;
- modern typeset instruction; and
- handwritten private notes.

A single PDF-to-text pass cannot produce reliable knowledge. Page and region classification must route content to prose OCR, Fraktur OCR, staff OMR, tablature recognition, diagram extraction, handwriting recognition, or visual-only review. The original page image and geometry remain the citation authority.

### Prescription and observation are not interchangeable

Vellum must label whether evidence is:

- an author's explicit prescription;
- a notated worked example;
- a pattern inferred across repertoire;
- a modern editor's synthesis;
- a Vellum heuristic; or
- an Owner or performer observation.

Repertoire frequency can propose a scoped descriptive observation. It cannot silently become a universal historical rule. Conflicting sources remain visible alternatives with their own scope.

## Proposed extraction and refinement loop

1. **Ingest immutable asset.** Stream the file, compute its digest, deduplicate it, record provenance and rights, and keep it outside Git by default.
2. **Resolve source identity.** Link or create Work, Edition, Exemplar, and Digital Asset records. Do not trust filename or repository grouping as edition evidence.
3. **Build a page atlas.** Render page thumbnails, detect printed and scan pagination, classify page and region modalities, and expose missing or duplicate pages.
4. **Run modality-specific extraction.** Produce versioned OCR, OMR, tablature, diagram, translation, and alignment artifacts without overwriting the source.
5. **Create cited segments.** Every proposed statement or example points to an asset version, scan/canvas, printed locator, bounding box or musical range, transcription, and confidence.
6. **Propose knowledge.** Classify candidates as prescription, descriptive observation, modern convention, example, counterexample, validation guidance, or unresolved conflict.
7. **Review and promote.** The appropriate reviewer can correct, reject, relate, or promote candidates. Promotion creates a new claim or profile and increments a Knowledge Pack version; it never rewrites old evidence.
8. **Compile applicable idiom.** Passage context selects pack versions and compiles their reviewed profiles into plan alternatives, candidate generators, constraints, and evaluators. Search records the exact pack digests it used.
9. **Learn from use.** Arrangement evaluations and playtests may nominate new source questions, ergonomic profiles, Personal Defaults, fixtures, or Calibration Candidates. They do not mutate Historical Knowledge directly.
10. **Refine with later sources.** A newly uploaded PDF is compared with existing candidates and claims. It may corroborate, narrow, contradict, or supersede them. Conflicts and lineage remain queryable.

## First extraction experiments

1. **Mace diapason notation:** extract PDF page 105 / printed page 75 into exact ordered symbols and course identities. Pass only if the extractor preserves `a`, `/a`, `//a`, `///a`, `4`, `5` and explicitly refuses to infer a thirteenth-course symbol.
2. **Sanz technique evidence:** align the rules and tablature examples for rasgueado, punteado, and four-voice right-hand use. Pass only if the result contradicts an unscoped three-finger hard rule rather than silently averaging it away.
3. **Carulli reduction pair:** segment a source texture and its guitar realization, align voices, and propose explicit retain, omit, octave, rhythm, and accompaniment transformations.
4. **Weiss manuscript page:** recognize staff geometry, tablature symbols, rhythm flags, and diapason marks while retaining image coordinates. Output descriptive observations only.
5. **Sor edition comparison:** compare the 1830 French text with Harrison's 1896 rewritten edition and identify omissions, editorial additions, and assertions whose authority differs.
6. **Satoh plus Owner Playtest:** extract modern fingering advice as modern synthesis, compare it with exact Instrument Instance geometry and playtest evidence, and keep all three authorities separate.

## Tracer bullets

1. Extend source identity and rights records while migrating existing `OwnerReference` data without losing content hashes.
2. Add the streaming PDF/image upload UI, progress, deduplication result, source-type disclosure, and private/public rights choices. The streaming backend boundary is already implemented; the UI is not.
3. Build the page atlas and citation-segment editor around Mace page 75.
4. Extract and review one prose prescription and one exact notation example from Sanz.
5. Extract one aligned source-to-guitar reduction from Carulli and feed it into a target-voice evaluator fixture.
6. Add an image-first French-tablature candidate path using one Weiss manuscript page.
7. Extend Knowledge Packs with scoped profiles, examples, counterexamples, validation guidance, and executable compiler mappings.
8. Resolve applicable packs at Analysis and Arrangement Plan time, include their versions and digests in search identity, and expose their consequences in reports.
9. Route later-source corroboration, contradiction, and refinement through versioned Knowledge Candidates and pack review.
10. Close with held-out extraction fixtures, claim-provenance audits, pack-applicability tests, and real-browser upload and review for public and private sources.

## Non-goals and safety boundaries

- No OCR, OMR, model summary, or web result becomes a Historical Practice Claim automatically.
- No private or copyrighted full source is committed, exported, or included in a built-in pack without explicit rights.
- No modern pedagogical method is relabeled as a primary historical source.
- No one school, region, date, tuning, course count, or performer becomes an instrument-wide universal rule.
- No pack can certify its own output; output evaluators inspect the generated score, positions, notation, and playback independently.
