import type {
  AnalysisRecord,
  ArrangementEvent,
  NormalizedScore,
  ScoreEvent,
  TransformationEntry,
} from "./music-domain.js";
import { compareRational } from "./music-domain.js";
import { noteToMidi, transposeNote } from "./pitch.js";

export function buildCompleteTransformationReport(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  arrangedEvents: ArrangementEvent[],
  semitones: number
): TransformationEntry[] {
  const principalEventIds = new Set(
    analysis.preservationTargets.find((target) => target.kind === "principal_voice")?.eventIds ?? []
  );
  const eventEntries = score.events.map((sourceEvent, index) =>
    sourceTransformation(sourceEvent, arrangedEvents, semitones, index, principalEventIds)
  );
  const generatedEntries = arrangedEvents
    .filter((event) => event.role === "realization" || event.sourceEventIds.length === 0)
    .map((event, index) => ({
      id: `transformation.generated.${index + 1}`,
      entryType: "event" as const,
      sourceEventIds: event.sourceEventIds,
      arrangementEventIds: [event.id],
      classification: "generated" as const,
      rationale:
        event.role === "realization"
          ? "This upper-voice material is newly generated from the linked Continuo Foundation and remains distinct from its source figures and bass."
          : "This arrangement event has no source event and is disclosed as newly generated material.",
    }));
  const relationshipEntries = analysis.preservationTargets
    .filter((target) => target.kind === "relationship")
    .map((target, index) => {
      const descendants = arrangedEvents.filter((event) =>
        event.sourceEventIds.some((id) => target.eventIds.includes(id))
      );
      const missing = target.eventIds.filter(
        (id) => !descendants.some((event) => event.sourceEventIds.includes(id))
      );
      return {
        id: `transformation.relationship.${index + 1}`,
        entryType: "relationship" as const,
        sourceEventIds: target.eventIds,
        sourceRelationshipId: target.id,
        relationshipType: target.relationshipType,
        sourceEventGroups: target.eventGroups,
        arrangementEventIds: descendants.map((event) => event.id),
        arrangementEventGroups: (target.eventGroups ?? [target.eventIds]).map((group) =>
          group.flatMap((sourceId) =>
            descendants
              .filter((event) => event.sourceEventIds.includes(sourceId))
              .map((event) => event.id)
          )
        ),
        classification:
          missing.length > 0
            ? ("omitted" as const)
            : semitones !== 0
              ? ("transposed" as const)
              : ("retained" as const),
        rationale:
          missing.length > 0
            ? `The arrangement has no descendant for ${missing.length} event(s) in the protected ${target.relationshipType ?? "relationship"}.`
            : `The complete ${target.relationshipType ?? "relationship"} is mapped to arrangement descendants with order and grouping available for Preservation Audit recomputation.`,
      };
    });
  return [...eventEntries, ...generatedEntries, ...relationshipEntries];
}

function sourceTransformation(
  source: ScoreEvent,
  arrangedEvents: ArrangementEvent[],
  semitones: number,
  index: number,
  principalEventIds: Set<string>
): TransformationEntry {
  const descendants = arrangedEvents.filter((event) => event.sourceEventIds.includes(source.id));
  const base = {
    id: `transformation.source.${index + 1}`,
    entryType: "event" as const,
    sourceEventId: source.id,
    sourceEventIds: [source.id],
    arrangementEventIds: descendants.map((event) => event.id),
  };
  if (descendants.length === 0) {
    return {
      ...base,
      classification: "omitted",
      rationale: "No arrangement event descends from this source event.",
    };
  }
  if (source.type === "rest") {
    const retained = descendants.some((event) => event.type === "rest");
    return {
      ...base,
      classification: retained ? "retained" : "omitted",
      rationale: retained
        ? "The written rest retains its onset and duration in the descendant voice."
        : "The rest has lineage links but no retained rest event.",
    };
  }
  if (source.type === "figured_bass") {
    return {
      ...base,
      classification: "retained",
      rationale:
        "The Figured Bass sign remains the authoritative harmonic constraint; separately disclosed generated entries realize it in upper voices.",
    };
  }
  const expected = transposeNote(source.pitch, semitones);
  const pitches = descendants.flatMap((event) => event.pitches);
  const timingChanged = descendants.some(
    (event) =>
      event.measureId !== source.measureId ||
      compareRational(event.onset, source.onset) !== 0 ||
      compareRational(event.duration, source.duration) !== 0
  );
  if (timingChanged) {
    return {
      ...base,
      classification: "rhythm_changed",
      rationale:
        "At least one descendant changes the source measure, onset, or duration; the report does not label it retained merely because pitch survives.",
    };
  }
  if (pitches.includes(expected)) {
    const exactOnly = descendants.every(
      (event) => event.pitches.length === 1 && event.pitches[0] === expected
    );
    return {
      ...base,
      classification:
        exactOnly || principalEventIds.has(source.id)
          ? semitones === 0
            ? "retained"
            : "transposed"
          : "revoiced",
      rationale:
        exactOnly || principalEventIds.has(source.id)
          ? semitones === 0
            ? "Pitch, rhythm, and voice lineage are retained."
            : "Pitch is changed only by the uniform Transposition Plan; rhythm and lineage are retained."
          : "The expected source pitch is retained inside a target-instrument chord or redistributed voicing.",
    };
  }
  const expectedMidi = noteToMidi(expected);
  if (pitches.some((pitch) => Math.abs(noteToMidi(pitch) - expectedMidi) % 12 === 0)) {
    return {
      ...base,
      classification: "octave_relocated",
      rationale:
        "The source pitch class is retained at a different octave for target range or voice distribution.",
    };
  }
  return {
    ...base,
    classification: "reharmonized",
    rationale:
      "Descendant material is linked to this source event but does not retain its transposed pitch class.",
  };
}
