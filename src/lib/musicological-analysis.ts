import { noteToMidi } from "./pitch.js";
import type { AnalysisRecord, NormalizedScore, ScoreEvent, ScorePart } from "./music-domain.js";

export type AnalyzeMusicOptions = {
  id: string;
  createdAt: string;
};

export function analyzeMusicologicalScore(
  score: NormalizedScore,
  options: AnalyzeMusicOptions
): AnalysisRecord {
  const imitation = detectImitativeTexture(score);
  if (imitation) return analyzeImitativeScore(score, options, imitation);
  const principal = selectPrincipalVoice(score);
  const principalEvents = score.events.filter(
    (event) => event.partId === principal.part.id && event.type === "note"
  );
  const principalPhraseGroups = phraseGroups(score, principal.part.id);
  if (principalEvents.length === 0) {
    throw new Error(`Principal Voice candidate has no notes: ${principal.part.id}`);
  }
  const continuoPart = score.parts.find((part) => part.role === "continuo_foundation");
  const continuoEvents = continuoPart
    ? score.events.filter((event) => event.partId === continuoPart.id && event.type !== "rest")
    : [];
  const suspension = detectPreparedSuspension(score, principal.part.id);
  const texture = inferTexture(score);
  const claims: AnalysisRecord["claims"] = [
    {
      id: `claim.${options.id.slice("analysis.".length)}.principal-voice`,
      kind: "principal_voice",
      subjectIds: [principal.part.id],
      statement: `${principal.part.name} carries the Principal Voice (${principal.reason}).`,
      basis: principal.basis,
      confidence: principal.confidence,
    },
    {
      id: `claim.${options.id.slice("analysis.".length)}.texture`,
      kind: "texture",
      subjectIds: score.parts.map((part) => part.id),
      statement: `The source texture is ${texture}.`,
      basis: "observation",
      confidence: 0.9,
    },
  ];
  if (continuoPart) {
    claims.push({
      id: `claim.${options.id.slice("analysis.".length)}.continuo-foundation`,
      kind: "continuo_foundation",
      subjectIds: continuoEvents.map((event) => event.id),
      statement: `${continuoPart.name} supplies an authoritative bass line and Figured Bass signs.`,
      basis: "observation",
      confidence: 1,
    });
  }
  if (suspension) {
    claims.push({
      id: `claim.${options.id.slice("analysis.".length)}.prepared-suspension`,
      kind: "prepared_suspension",
      subjectIds: suspension.eventIds,
      statement:
        "A source-supported 4-3 suspension is prepared consonantly, held as a fourth above the bass, and resolved downward by step to a third.",
      basis: "observation",
      confidence: 1,
    });
  }

  const preservationTargets: AnalysisRecord["preservationTargets"] = [
    {
      id: `target.${options.id.slice("analysis.".length)}.principal-voice`,
      kind: "principal_voice",
      partId: principal.part.id,
      eventIds: principalEvents.map((event) => event.id),
      rationale:
        "Faithful Reduction preserves every Principal Voice pitch, duration, order, phrase position, and perceptual prominence.",
    },
    {
      id: `target.${options.id.slice("analysis.".length)}.principal-sequence`,
      kind: "relationship",
      relationshipType: "principal_sequence",
      eventIds: principalEvents.map((event) => event.id),
      eventGroups: [principalEvents.map((event) => event.id)],
      rationale:
        "The Principal Voice retains its source onset sequence, interval contour, rhythmic identity, and chronological order.",
    },
    {
      id: `target.${options.id.slice("analysis.".length)}.cadential-goal`,
      kind: "relationship",
      relationshipType: "cadential_goal",
      eventIds: [principalEvents.at(-1)!.id],
      eventGroups: [[principalEvents.at(-1)!.id]],
      rationale: "The Principal Voice reaches its reviewed final cadential goal.",
    },
    ...principalPhraseGroups.map((eventIds, index) => ({
      id: `target.${options.id.slice("analysis.".length)}.phrase-${index + 1}`,
      kind: "relationship" as const,
      relationshipType: "phrase_contour" as const,
      eventIds,
      eventGroups: [eventIds],
      rationale:
        "This rest-delimited Principal Voice phrase retains its interval contour, rhythmic identity, and source placement.",
    })),
  ];
  if (continuoPart) {
    preservationTargets.push({
      id: `target.${options.id.slice("analysis.".length)}.continuo-foundation`,
      kind: "continuo_foundation",
      partId: continuoPart.id,
      eventIds: continuoEvents.map((event) => event.id),
      rationale:
        "Continuo Realization preserves every foundation bass event, figure, accidental, duration, and source order.",
    });
  }
  if (suspension) {
    preservationTargets.push({
      id: `target.${options.id.slice("analysis.".length)}.prepared-suspension`,
      kind: "relationship",
      relationshipType: "prepared_suspension",
      eventIds: suspension.eventIds,
      eventGroups: [suspension.eventIds],
      rationale:
        "The prepared dissonance and its downward resolution are source-supported contrapuntal structure, not a generic voice-leading violation.",
    });
  }

  return completeAnalysis(
    score,
    {
      id: options.id,
      normalizedScoreId: score.id,
      version: 1,
      texture,
      principalVoicePartId: principal.part.id,
      validationProfileId: continuoPart ? "continuo.italian-baroque" : undefined,
      contrapuntalTechniques: suspension ? ["prepared_suspension"] : [],
      claims,
      preservationTargets,
      createdAt: options.createdAt,
    },
    principal
  );
}

function phraseGroups(score: NormalizedScore, partId: string): string[][] {
  const events = score.events
    .filter((event) => event.partId === partId && event.type !== "figured_bass")
    .slice()
    .sort((left, right) => absoluteOnset(score, left) - absoluteOnset(score, right));
  const groups: string[][] = [];
  let current: string[] = [];
  for (const event of events) {
    if (event.type === "rest") {
      if (current.length > 1) groups.push(current);
      current = [];
    } else {
      current.push(event.id);
    }
  }
  if (current.length > 1) groups.push(current);
  return groups;
}

type ImitationEvidence = {
  entries: Array<{
    part: ScorePart;
    notes: Array<Extract<ScoreEvent, { type: "note" }>>;
    start: number;
  }>;
  intervalShape: number[];
  durationShape: string[];
};

function analyzeImitativeScore(
  score: NormalizedScore,
  options: AnalyzeMusicOptions,
  evidence: ImitationEvidence
): AnalysisRecord {
  const suffix = options.id.slice("analysis.".length);
  const voiceTargets: AnalysisRecord["preservationTargets"] = evidence.entries.map((entry) => ({
    id: `target.${suffix}.voice.${entry.part.id.slice("part.".length)}`,
    kind: "voice",
    partId: entry.part.id,
    eventIds: score.events
      .filter((event) => event.partId === entry.part.id)
      .map((event) => event.id),
    rationale:
      "Imitative intabulation preserves this source voice's event order, rhythm, pitch contour, and continuity even when voices interleave on one tablature staff.",
  }));
  const subjectGroups = evidence.entries.map((entry) => entry.notes.map((note) => note.id));
  const subjectIds = subjectGroups.flat();
  const cadenceIds = evidence.entries.map((entry) => {
    const finalNote = score.events
      .filter(
        (event): event is Extract<ScoreEvent, { type: "note" }> =>
          event.partId === entry.part.id && event.type === "note"
      )
      .at(-1);
    if (!finalNote) throw new Error(`Imitative voice has no cadential goal: ${entry.part.id}`);
    return finalNote.id;
  });

  return completeAnalysis(score, {
    id: options.id,
    normalizedScoreId: score.id,
    version: 1,
    texture: "imitative-polyphony",
    validationProfileId: "counterpoint.renaissance-imitative",
    contrapuntalTechniques: ["imitation"],
    claims: [
      {
        id: `claim.${suffix}.texture`,
        kind: "texture",
        subjectIds: score.parts.map((part) => part.id),
        statement:
          "The source is imitative polyphony: its identity depends on ordered entries across independent voices, not a permanent Principal Voice.",
        basis: "observation",
        confidence: 1,
      },
      {
        id: `claim.${suffix}.imitation`,
        kind: "contrapuntal_technique",
        subjectIds,
        statement: `Three ordered subject entries preserve interval shape ${evidence.intervalShape.join(",")} and rhythm shape ${evidence.durationShape.join(",")}.`,
        basis: "observation",
        confidence: 1,
      },
      {
        id: `claim.${suffix}.cadence`,
        kind: "cadential_goal",
        subjectIds: cadenceIds,
        statement: "The final events of all three voices form the required cadential goal.",
        basis: "observation",
        confidence: 0.95,
      },
    ],
    preservationTargets: [
      ...voiceTargets,
      {
        id: `target.${suffix}.ordered-entries`,
        kind: "relationship",
        relationshipType: "ordered_entries",
        eventIds: subjectIds,
        eventGroups: subjectGroups,
        rationale:
          "Subject entries retain their source order, transposed interval-rhythm shape, and voice identity.",
      },
      {
        id: `target.${suffix}.cadential-goal`,
        kind: "relationship",
        relationshipType: "cadential_goal",
        eventIds: cadenceIds,
        eventGroups: cadenceIds.map((id) => [id]),
        rationale: "Every source voice must reach its reviewed cadential goal.",
      },
    ],
    createdAt: options.createdAt,
  });
}

function completeAnalysis(
  score: NormalizedScore,
  record: AnalysisRecord,
  principal?: PrincipalSelection
): AnalysisRecord {
  const claims = record.claims.map((claim) => {
    const eventIds = claim.subjectIds.filter((id) => score.events.some((event) => event.id === id));
    const partIds = claim.subjectIds.filter((id) => score.parts.some((part) => part.id === id));
    const scopedEvents = [
      ...eventIds,
      ...score.events.filter((event) => partIds.includes(event.partId)).map((event) => event.id),
    ].filter((id, index, all) => all.indexOf(id) === index);
    const measureIds = score.measures
      .filter((measure) =>
        score.events.some(
          (event) => event.measureId === measure.id && scopedEvents.includes(event.id)
        )
      )
      .map((measure) => measure.id);
    const alternatives =
      claim.kind === "principal_voice" && principal?.basis === "inference"
        ? score.parts
            .filter((part) => part.id !== principal.part.id)
            .map((part, index) => ({
              id: `${claim.id}.alternative.${index + 1}`,
              statement: `${part.name} may instead carry the Principal Voice.`,
              subjectIds: [part.id],
              confidence: Math.max(0.1, principal.confidence - 0.2 - index * 0.05),
              arrangementConsequence:
                "Faithful Reduction would protect this part and place its descendants in perceptual prominence.",
            }))
        : [];
    return {
      ...claim,
      scope: { measureIds, eventIds: scopedEvents },
      evidence: [
        {
          kind: "score_observation" as const,
          sourceIds: claim.subjectIds,
          explanation:
            claim.kind === "principal_voice" && principal
              ? principal.evidence
              : claim.basis === "observation"
                ? "The claim is directly supported by labeled or symbolic score data."
                : "The claim is inferred from register, timing, interval, rhythm, and voice-role evidence in the score.",
        },
      ],
      alternatives,
    };
  });
  const passages = passageAnalyses(score, record, claims);
  const profiles = analysisProfiles(record, claims);
  const principalClaim = claims.find((claim) => claim.kind === "principal_voice");
  const ambiguities: NonNullable<AnalysisRecord["ambiguities"]> = [];
  if (principalClaim && principalClaim.confidence < 0.8 && principalClaim.alternatives?.length) {
    ambiguities.push({
      id: `ambiguity.${record.id.slice("analysis.".length)}.principal-voice`,
      claimId: principalClaim.id,
      critical: true,
      question: "Which source part carries the musical identity that must remain prominent?",
      alternativeIds: principalClaim.alternatives.map((alternative) => alternative.id),
      affectedEventIds: principalClaim.scope?.eventIds ?? [],
      consequenceDimensions: ["voice", "identity", "recognizable_identity"],
    });
  }
  if (record.validationProfileId === "continuo.italian-baroque") {
    const profileAlternative = profiles.find((profile) => profile.status === "alternative");
    const profileClaim = claims.find((claim) => claim.kind === "continuo_foundation");
    if (profileAlternative && profileClaim) {
      ambiguities.push({
        id: `ambiguity.${record.id.slice("analysis.".length)}.realization-profile`,
        claimId: profileClaim.id,
        critical: false,
        question: "Could a different regional continuo practice materially change the realization?",
        alternativeIds: [profileAlternative.id],
        affectedEventIds: profileClaim.scope?.eventIds ?? [],
        consequenceDimensions: ["figure", "texture_technique_profile"],
      });
    }
  }
  return {
    ...record,
    summary: analysisSummary(record, principal, passages, ambiguities),
    passages,
    profiles,
    ambiguities,
    claims,
  };
}

function passageAnalyses(
  score: NormalizedScore,
  record: AnalysisRecord,
  claims: AnalysisRecord["claims"]
): NonNullable<AnalysisRecord["passages"]> {
  const suspensionEventIds = new Set(
    claims.find((claim) => claim.kind === "prepared_suspension")?.subjectIds ?? []
  );
  const raw = score.measures.map((measure) => {
    const events = score.events.filter((event) => event.measureId === measure.id);
    const activeParts = new Set(
      events.filter((event) => event.type === "note").map((event) => event.partId)
    );
    const hasContinuo = events.some((event) => event.type === "figured_bass");
    const texture =
      record.texture === "imitative-polyphony"
        ? "imitative-polyphony"
        : hasContinuo || record.texture === "continuo"
          ? "continuo"
          : activeParts.size <= 1
            ? "monophony"
            : activeParts.size === 2
              ? "melody-with-accompaniment"
              : record.texture;
    const techniques = [
      ...(record.texture === "imitative-polyphony" ? ["imitation"] : []),
      ...(events.some((event) => suspensionEventIds.has(event.id)) ? ["prepared_suspension"] : []),
    ];
    return { measure, events, texture, techniques };
  });
  const grouped: (typeof raw)[] = [];
  for (const passage of raw) {
    const previous = grouped.at(-1);
    const same =
      previous?.[0]?.texture === passage.texture &&
      previous[0].techniques.join(",") === passage.techniques.join(",");
    if (same) previous.push(passage);
    else grouped.push([passage]);
  }
  return grouped.map((group, index) => {
    const eventIds = group.flatMap((item) => item.events.map((event) => event.id));
    const pitchedEvents = group
      .flatMap((item) => item.events)
      .filter((event): event is Extract<ScoreEvent, { type: "note" }> => event.type === "note");
    const activePartIds = [...new Set(pitchedEvents.map((event) => event.partId))];
    const finalMeasure = group.at(-1)!.measure;
    const goalEvents = activePartIds.flatMap((partId) => {
      const notes = pitchedEvents.filter((event) => event.partId === partId);
      return notes.length ? [notes.at(-1)!.id] : [];
    });
    const passageId = `passage.${record.id.slice("analysis.".length)}.${index + 1}`;
    return {
      id: passageId,
      measureIds: group.map((item) => item.measure.id),
      eventIds,
      texture: group[0]!.texture,
      contrapuntalTechniques: group[0]!.techniques,
      claimIds: claims
        .filter((claim) => claim.scope?.eventIds.some((id) => eventIds.includes(id)))
        .map((claim) => claim.id),
      boundaries: {
        startReason:
          index === 0
            ? "Beginning of the notated work."
            : "Texture or contrapuntal-technique profile changes here.",
        endReason:
          index === grouped.length - 1
            ? "End of the notated work."
            : "The following measure changes texture or contrapuntal technique.",
      },
      roles: activePartIds.map((partId) => ({
        partId,
        role: passageRole(score, record, partId),
        evidenceEventIds: pitchedEvents
          .filter((event) => event.partId === partId)
          .map((event) => event.id),
      })),
      phrases: passagePhrases(group, passageId, activePartIds),
      cadences:
        goalEvents.length && index === grouped.length - 1
          ? [
              {
                id: `${passageId}.cadence`,
                kind: "final_goal" as const,
                measureId: finalMeasure.id,
                goalEventIds: goalEvents,
                confidence: 0.95,
              },
            ]
          : [],
    };
  });
}

function passagePhrases(
  group: Array<{
    events: ScoreEvent[];
  }>,
  passageId: string,
  partIds: string[]
): NonNullable<AnalysisRecord["passages"]>[number]["phrases"] {
  let phraseIndex = 0;
  return partIds.flatMap((partId) => {
    const phrases: string[][] = [];
    let current: string[] = [];
    for (const event of group
      .flatMap((item) => item.events)
      .filter((item) => item.partId === partId)) {
      if (event.type === "rest") {
        if (current.length) phrases.push(current);
        current = [];
      } else if (event.type === "note") {
        current.push(event.id);
      }
    }
    if (current.length) phrases.push(current);
    return phrases.map((eventIds) => ({
      id: `${passageId}.phrase.${++phraseIndex}`,
      partId,
      eventIds,
    }));
  });
}

function passageRole(
  score: NormalizedScore,
  record: AnalysisRecord,
  partId: string
): "principal_voice" | "continuo_foundation" | "bass" | "imitative_voice" | "accompaniment" {
  if (record.texture === "imitative-polyphony") return "imitative_voice";
  if (record.principalVoicePartId === partId) return "principal_voice";
  const part = score.parts.find((candidate) => candidate.id === partId)!;
  if (part.role === "continuo_foundation") return "continuo_foundation";
  if (part.role === "bass") return "bass";
  return "accompaniment";
}

function analysisProfiles(
  record: AnalysisRecord,
  claims: AnalysisRecord["claims"]
): NonNullable<AnalysisRecord["profiles"]> {
  const evidenceClaimIds = claims.map((claim) => claim.id);
  if (record.validationProfileId === "continuo.italian-baroque") {
    return [
      {
        id: "continuo.italian-baroque",
        label: "Italian Baroque continuo",
        status: "selected",
        confidence: 0.86,
        scope: {
          period: "seventeenth to early eighteenth century",
          region: "Italy",
          genre: "soprano with figured bass",
          instruments: ["keyboard", "plucked continuo"],
          ensembleRole: "continuo realization",
        },
        evidenceClaimIds,
        arrangementConsequence:
          "Realize written figures completely while preserving the authoritative bass and prepared dissonances.",
      },
      {
        id: "continuo.french-baroque",
        label: "French Baroque continuo",
        status: "alternative",
        confidence: 0.38,
        scope: {
          period: "late seventeenth to early eighteenth century",
          region: "France",
          genre: "soprano with figured bass",
          instruments: ["keyboard", "plucked continuo"],
          ensembleRole: "continuo realization",
        },
        evidenceClaimIds,
        arrangementConsequence:
          "Spacing, texture density, and ornamental assumptions may differ; select only with corroborating provenance.",
      },
    ];
  }
  if (record.validationProfileId === "counterpoint.renaissance-imitative") {
    return [
      {
        id: "counterpoint.renaissance-imitative",
        label: "Renaissance imitative counterpoint",
        status: "selected",
        confidence: 0.95,
        scope: {
          period: "sixteenth century",
          region: "Western Europe",
          genre: "imitative polyphony",
          instruments: ["voices", "Renaissance lute"],
          ensembleRole: "polyphonic intabulation",
        },
        evidenceClaimIds,
        arrangementConsequence:
          "Preserve ordered subject entries, voice continuity, interval-rhythm shape, and cadential goals.",
      },
    ];
  }
  return [];
}

function analysisSummary(
  record: AnalysisRecord,
  principal: PrincipalSelection | undefined,
  passages: NonNullable<AnalysisRecord["passages"]>,
  ambiguities: NonNullable<AnalysisRecord["ambiguities"]>
): string {
  const identity = principal
    ? `${principal.part.name} is the best-supported Principal Voice`
    : "The work's identity depends on relationships among independent voices";
  const textures = [...new Set(passages.map((passage) => passage.texture))].join(", ");
  const techniques = record.contrapuntalTechniques?.length
    ? ` Protected techniques: ${record.contrapuntalTechniques.join(", ")}.`
    : "";
  const review = ambiguities.some((ambiguity) => ambiguity.critical)
    ? " A material ambiguity requires review before faithful arrangement."
    : "";
  return `${identity}. Passage textures: ${textures}.${techniques}${review}`;
}

function detectImitativeTexture(score: NormalizedScore): ImitationEvidence | undefined {
  if (score.parts.length < 3) return undefined;
  const windows = score.parts.flatMap((part) => {
    const notes = score.events
      .filter(
        (event): event is Extract<ScoreEvent, { type: "note" }> =>
          event.partId === part.id && event.type === "note"
      )
      .sort((left, right) => absoluteOnset(score, left) - absoluteOnset(score, right));
    return notes.slice(0, -3).map((_, index) => {
      const subject = notes.slice(index, index + 4);
      const shape = subjectShape(subject);
      return {
        part,
        notes: subject,
        start: absoluteOnset(score, subject[0]!),
        shape,
        key: `${shape.intervals.join(",")}|${shape.durations.join(",")}`,
      };
    });
  });
  const candidateKeys = [...new Set(windows.map((window) => window.key))].sort();
  const candidates = candidateKeys.flatMap((key) => {
    const matching = windows.filter((window) => window.key === key);
    if (!score.parts.every((part) => matching.some((window) => window.part.id === part.id)))
      return [];
    const selected = score.parts.map(
      (part) =>
        matching
          .filter((window) => window.part.id === part.id)
          .sort((a, b) => a.start - b.start)[0]!
    );
    return [
      {
        entries: selected,
        span:
          Math.max(...selected.map((entry) => entry.start)) -
          Math.min(...selected.map((entry) => entry.start)),
      },
    ];
  });
  const best = candidates.sort(
    (left, right) =>
      left.span - right.span ||
      Math.min(...left.entries.map((entry) => entry.start)) -
        Math.min(...right.entries.map((entry) => entry.start))
  )[0];
  if (!best) return undefined;
  const ordered = best.entries.slice().sort((left, right) => left.start - right.start);
  if (ordered.some((entry, index) => index > 0 && entry.start <= ordered[index - 1]!.start)) {
    return undefined;
  }
  return {
    entries: ordered,
    intervalShape: ordered[0]!.shape.intervals,
    durationShape: ordered[0]!.shape.durations,
  };
}

function subjectShape(notes: Array<Extract<ScoreEvent, { type: "note" }>>): {
  intervals: number[];
  durations: string[];
} {
  return {
    intervals: notes
      .slice(1)
      .map((note, index) => noteToMidi(note.pitch) - noteToMidi(notes[index]!.pitch)),
    durations: notes.map((note) => `${note.duration.numerator}/${note.duration.denominator}`),
  };
}

function absoluteOnset(score: NormalizedScore, event: ScoreEvent): number {
  let result = 0;
  for (const measure of score.measures) {
    if (measure.id === event.measureId) break;
    result += measure.duration.numerator / measure.duration.denominator;
  }
  return result + event.onset.numerator / event.onset.denominator;
}

type PrincipalSelection = {
  part: ScorePart;
  reason: string;
  basis: "observation" | "inference";
  confidence: number;
  evidence: string;
};

function selectPrincipalVoice(score: NormalizedScore): PrincipalSelection {
  const explicit = score.parts.find((part) => part.role === "principal_voice");
  if (explicit) {
    return {
      part: explicit,
      reason: "the source explicitly assigns the Principal Voice role",
      basis: "observation",
      confidence: 1,
      evidence: `Part ${explicit.id} carries the explicit principal_voice source role; all ${noteCount(score, explicit.id)} pitched events support the assignment.`,
    };
  }

  const soprano = score.parts.find(
    (part) => part.role === "soprano" || /\bsoprano\b/i.test(part.name)
  );
  if (soprano) {
    return {
      part: soprano,
      reason: "the labeled soprano presents the tune in this four-part setting",
      basis: "observation",
      confidence: 0.99,
      evidence: `The source labels ${soprano.name} as soprano; its ${noteCount(score, soprano.id)} pitched events form the upper labeled line across the score.`,
    };
  }

  const ranked = score.parts
    .map((part) => ({ part, median: medianMidi(score.events, part.id) }))
    .filter((entry): entry is { part: ScorePart; median: number } => entry.median !== undefined)
    .sort((left, right) => right.median - left.median || left.part.id.localeCompare(right.part.id));
  if (ranked.length === 0) {
    throw new Error(
      "Normalized score contains no pitched voice suitable for Principal Voice inference"
    );
  }

  return {
    part: ranked[0]!.part,
    reason:
      "it has the strongest upper-line register evidence among the available unlabeled voices",
    basis: "inference",
    confidence: ranked.length === 1 ? 0.8 : 0.65,
    evidence: `Compared every unlabeled pitched part. ${ranked[0]!.part.name} has median MIDI ${ranked[0]!.median} across ${noteCount(score, ranked[0]!.part.id)} notes; alternatives are retained because register alone does not establish melodic identity.`,
  };
}

function noteCount(score: NormalizedScore, partId: string): number {
  return score.events.filter((event) => event.partId === partId && event.type === "note").length;
}

function medianMidi(events: ScoreEvent[], partId: string): number | undefined {
  const values = events
    .flatMap((event) =>
      event.partId === partId && event.type === "note" ? [noteToMidi(event.pitch)] : []
    )
    .sort((left, right) => left - right);
  if (values.length === 0) return undefined;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1]! + values[middle]!) / 2 : values[middle];
}

function inferTexture(score: NormalizedScore): string {
  if (score.parts.length === 1) return "monophonic";
  if (score.parts.some((part) => part.role === "continuo_foundation")) {
    return "continuo";
  }
  if (score.parts.length === 4 && score.parts.some((part) => part.role === "bass")) {
    return "homophonic-four-part";
  }
  return "polyphonic";
}

function detectPreparedSuspension(
  score: NormalizedScore,
  principalPartId: string
): { eventIds: string[] } | undefined {
  const figures = score.events
    .filter((event) => event.type === "figured_bass")
    .sort(
      (left, right) =>
        score.measures.findIndex((measure) => measure.id === left.measureId) -
          score.measures.findIndex((measure) => measure.id === right.measureId) ||
        compareOnset(left.onset, right.onset)
    );
  for (let index = 0; index < figures.length - 1; index += 1) {
    const suspensionFigure = figures[index]!;
    const resolutionFigure = figures[index + 1]!;
    if (
      suspensionFigure.bassEventId !== resolutionFigure.bassEventId ||
      !suspensionFigure.figures.some((figure) => figure.interval === 4) ||
      !resolutionFigure.figures.some((figure) => figure.interval === 3)
    ) {
      continue;
    }
    const suspensionNote = soundingNoteAt(
      score,
      principalPartId,
      suspensionFigure.measureId,
      suspensionFigure.onset
    );
    const resolutionNote = soundingNoteAt(
      score,
      principalPartId,
      resolutionFigure.measureId,
      resolutionFigure.onset
    );
    const bass = score.events.find(
      (event): event is Extract<ScoreEvent, { type: "note" }> =>
        event.id === suspensionFigure.bassEventId && event.type === "note"
    );
    const previousPrincipal = previousNote(score, principalPartId, suspensionNote?.id);
    const previousBass = previousNote(score, bass?.partId ?? "", bass?.id);
    if (!suspensionNote || !resolutionNote || !bass || !previousPrincipal || !previousBass)
      continue;
    const prepared = noteToMidi(previousPrincipal.pitch) === noteToMidi(suspensionNote.pitch);
    const dissonance = mod12(noteToMidi(suspensionNote.pitch) - noteToMidi(bass.pitch)) === 5;
    const resolvesDown = noteToMidi(resolutionNote.pitch) === noteToMidi(suspensionNote.pitch) - 1;
    const resolution = mod12(noteToMidi(resolutionNote.pitch) - noteToMidi(bass.pitch)) === 4;
    const preparationConsonant = [3, 4, 8, 9].includes(
      mod12(noteToMidi(previousPrincipal.pitch) - noteToMidi(previousBass.pitch))
    );
    if (prepared && preparationConsonant && dissonance && resolvesDown && resolution) {
      return {
        eventIds: [
          previousPrincipal.id,
          suspensionNote.id,
          resolutionNote.id,
          previousBass.id,
          bass.id,
          suspensionFigure.id,
          resolutionFigure.id,
        ],
      };
    }
  }
  return undefined;
}

function soundingNoteAt(
  score: NormalizedScore,
  partId: string,
  measureId: string,
  onset: { numerator: number; denominator: number }
): Extract<ScoreEvent, { type: "note" }> | undefined {
  return score.events.find(
    (event): event is Extract<ScoreEvent, { type: "note" }> =>
      event.type === "note" &&
      event.partId === partId &&
      event.measureId === measureId &&
      compareOnset(event.onset, onset) <= 0 &&
      compareOnset(onset, addDuration(event.onset, event.duration)) < 0
  );
}

function previousNote(
  score: NormalizedScore,
  partId: string,
  beforeEventId: string | undefined
): Extract<ScoreEvent, { type: "note" }> | undefined {
  const notes = score.events.filter(
    (event): event is Extract<ScoreEvent, { type: "note" }> =>
      event.type === "note" && event.partId === partId
  );
  const index = notes.findIndex((event) => event.id === beforeEventId);
  return index > 0 ? notes[index - 1] : undefined;
}

function compareOnset(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function addDuration(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
): { numerator: number; denominator: number } {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}
