# ADR 0014: Make Preservation Policy an executable choice

## Status

Accepted

## Context

The domain model named Faithful Reduction, Idiomatic Adaptation, and Free Paraphrase, but the Guided Start and arrangement API could request only Faithful Reduction. Merely changing the label on the same hard audit would misrepresent what the other policies promise.

## Decision

Every Arrangement Search and Arrangement Score records one of the three policies. Guided Start defaults historical source work to Faithful Reduction and exposes all three with plain-language consequences.

All policies retain a complete Transformation Report and Preservation Audit. Faithful Reduction treats note- and relationship-level preservation findings as a completion gate. Idiomatic Adaptation and Free Paraphrase retain those findings as observations while instrument mechanics, contextual validation, and Editorial Commitments remain hard constraints.

The selected policy also changes search behavior. Faithful Reduction prioritizes source coverage and voice continuity. Idiomatic Adaptation prioritizes economical, instrument-native realization. Free Paraphrase gives still more weight to resonant open-string and low-effort solutions. For continuo sources, a target that cannot sound the foundation may select an honestly labeled Continuo Reduction only under a less restrictive policy; Faithful Reduction still requires the foundation or a separate bass.

## Consequences

- A policy choice changes executable selection and validation semantics, not just displayed prose.
- Relaxed policies never erase omissions or source divergence from provenance.
- The default remains conservative, while knowledgeable users can deliberately request greater freedom before generation.
