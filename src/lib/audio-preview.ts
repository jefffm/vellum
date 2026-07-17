import type {
  ArrangementScore,
  NormalizedScore,
  PerformanceInterpretation,
  Rational,
} from "./music-domain.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { noteToMidi } from "./pitch.js";
import { soundingPitches as instrumentSoundingPitches } from "./instrument-instance.js";

export type PlaybackPart =
  | "full"
  | "principal-voice"
  | "continuo-foundation"
  | "realization"
  | "accompaniment"
  | `voice:${string}`;

export type PlaybackEvent = {
  occurrenceId: string;
  measureOccurrenceId: string;
  iteration: number;
  arrangementEventId: string;
  sourceEventIds: string[];
  transformationEntryIds: string[];
  auditTargetIds: string[];
  instrumentId?: string;
  constituentStringId?: string;
  part: Exclude<PlaybackPart, "full">;
  midi: number;
  startSeconds: number;
  durationSeconds: number;
};

export type AudioPreview = {
  tempo: number;
  instrumentInstanceDigest?: string;
  durationSeconds: number;
  synthesis: "basic-oscillator";
  mode: "literal" | "interpreted";
  interpretation?: {
    id: string;
    version: number;
    rationale: string;
    choices: PerformanceInterpretation["choices"];
  };
  performedForm: {
    measureOccurrences: Array<{
      id: string;
      measureId: string;
      iteration: number;
      startSeconds: number;
      durationSeconds: number;
    }>;
    traversalDecisions: string[];
    skipRepeats: boolean;
  };
  parts: Array<{ id: PlaybackPart; label: string }>;
  events: PlaybackEvent[];
};

export function buildAudioPreview(
  arrangement: ArrangementScore,
  score: NormalizedScore,
  tempo = 70,
  options: { skipRepeats?: boolean } = {}
): AudioPreview {
  assertAuthorityPathRuntime("authority.compiler.playback-projection", "production");
  const secondsPerQuarter = 60 / tempo;
  const canonicalOccurrences =
    score.performedForm?.measureOccurrences ??
    score.measures.map((measure) => ({
      id: `measure-occurrence.${measure.id}`,
      measureId: measure.id,
      iteration: 1,
    }));
  const seenMeasures = new Set<string>();
  const occurrences = options.skipRepeats
    ? canonicalOccurrences.filter((occurrence) => {
        if (seenMeasures.has(occurrence.measureId)) return false;
        seenMeasures.add(occurrence.measureId);
        return true;
      })
    : canonicalOccurrences;
  const performedMeasures: AudioPreview["performedForm"]["measureOccurrences"] = [];
  let elapsedQuarters = 0;
  for (const occurrence of occurrences) {
    const measure = score.measures.find((candidate) => candidate.id === occurrence.measureId);
    if (!measure)
      throw new Error(`Performed Form references unknown measure: ${occurrence.measureId}`);
    const durationQuarters = rationalValue(measure.duration);
    performedMeasures.push({
      id: occurrence.id,
      measureId: occurrence.measureId,
      iteration: occurrence.iteration,
      startSeconds: elapsedQuarters * secondsPerQuarter,
      durationSeconds: durationQuarters * secondsPerQuarter,
    });
    elapsedQuarters += rationalValue(measure.duration);
  }
  const events: PlaybackEvent[] = [];
  for (const occurrence of performedMeasures) {
    for (const event of arrangement.events.filter(
      (candidate) => candidate.measureId === occurrence.measureId
    )) {
      if (event.type === "rest") continue;
      const exactInstance = arrangement.targetConfiguration?.instrumentInstance;
      const usesTargetInstance =
        exactInstance && (!event.instrumentId || event.instrumentId === exactInstance.profileId);
      const transformationEntries = (arrangement.transformationReport ?? []).filter((entry) =>
        entry.arrangementEventIds.includes(event.id)
      );
      if ((event.baroqueGuitarGesture || event.baroqueLuteGesture) && usesTargetInstance) {
        const principal = event.voiceConstituents?.find(
          (constituent) => constituent.role === "principal_voice"
        );
        let principalEmitted = false;
        for (const position of event.positions) {
          const course = exactInstance!.courses.find(
            (candidate) => candidate.course === position.course
          )!;
          const pitches = instrumentSoundingPitches(exactInstance!, position.course, position.fret);
          for (const [stringIndex, pitch] of pitches.entries()) {
            const isPrincipal =
              !principalEmitted &&
              principal?.position.course === position.course &&
              noteToMidi(pitch) === noteToMidi(principal.pitch);
            if (isPrincipal) principalEmitted = true;
            events.push({
              occurrenceId: `playback-occurrence.${occurrence.id}.${event.id}.course.${position.course}.string.${stringIndex + 1}`,
              measureOccurrenceId: occurrence.id,
              iteration: occurrence.iteration,
              arrangementEventId: event.id,
              sourceEventIds:
                isPrincipal && principal ? [principal.sourceEventId] : event.sourceEventIds,
              transformationEntryIds: transformationEntries.flatMap((entry) =>
                entry.id ? [entry.id] : []
              ),
              auditTargetIds: transformationEntries.flatMap(
                (entry) =>
                  entry.preservationTargetIds ??
                  (entry.sourceRelationshipId ? [entry.sourceRelationshipId] : [])
              ),
              instrumentId: event.instrumentId,
              constituentStringId: course.strings[stringIndex]!.id,
              part: isPrincipal ? "principal-voice" : "accompaniment",
              midi: noteToMidi(pitch),
              startSeconds:
                occurrence.startSeconds + rationalValue(event.onset) * secondsPerQuarter,
              durationSeconds: rationalValue(event.duration) * secondsPerQuarter,
            });
          }
        }
        continue;
      }
      if (event.voiceConstituents?.length) {
        for (const [constituentIndex, constituent] of event.voiceConstituents.entries()) {
          const course = usesTargetInstance
            ? exactInstance!.courses.find(
                (candidate) => candidate.course === constituent.position.course
              )
            : undefined;
          const soundingPitches = course
            ? instrumentSoundingPitches(
                exactInstance!,
                constituent.position.course,
                constituent.position.fret
              )
            : [constituent.pitch];
          let canonicalVoiceEmitted = false;
          for (const [stringIndex, pitch] of soundingPitches.entries()) {
            const canonicalVoicePitch =
              !canonicalVoiceEmitted && noteToMidi(pitch) === noteToMidi(constituent.pitch);
            if (canonicalVoicePitch) canonicalVoiceEmitted = true;
            const stringId = course?.strings[stringIndex]?.id;
            events.push({
              occurrenceId: `playback-occurrence.${occurrence.id}.${event.id}.voice.${constituentIndex + 1}.string.${stringIndex + 1}`,
              measureOccurrenceId: occurrence.id,
              iteration: occurrence.iteration,
              arrangementEventId: event.id,
              sourceEventIds: [constituent.sourceEventId],
              transformationEntryIds: transformationEntries.flatMap((entry) =>
                entry.id ? [entry.id] : []
              ),
              auditTargetIds: transformationEntries.flatMap(
                (entry) =>
                  entry.preservationTargetIds ??
                  (entry.sourceRelationshipId ? [entry.sourceRelationshipId] : [])
              ),
              instrumentId: event.instrumentId,
              ...(stringId ? { constituentStringId: stringId } : {}),
              part:
                constituent.role === "principal_voice" && canonicalVoicePitch
                  ? "principal-voice"
                  : (`voice:${constituent.voiceId}` as const),
              midi: noteToMidi(pitch),
              startSeconds:
                occurrence.startSeconds + rationalValue(constituent.onset) * secondsPerQuarter,
              durationSeconds: rationalValue(constituent.duration) * secondsPerQuarter,
            });
          }
        }
        continue;
      }
      const playbackPitches = usesTargetInstance
        ? event.positions.flatMap((position) =>
            instrumentSoundingPitches(exactInstance!, position.course, position.fret)
          )
        : event.pitches;
      const pitches = playbackPitches.map((pitch) => ({ pitch, midi: noteToMidi(pitch) }));
      const constituentStringIds = usesTargetInstance
        ? event.positions.flatMap((position) =>
            exactInstance!.courses
              .find((course) => course.course === position.course)!
              .strings.map((string) => string.id)
          )
        : [];
      const principalMidi = event.principalVoiceSourceEventId
        ? Math.max(...pitches.map(({ midi }) => midi))
        : undefined;
      const principalPitchIndex =
        principalMidi === undefined ? -1 : pitches.findIndex(({ midi }) => midi === principalMidi);
      for (const [{ midi }, pitchIndex] of pitches.map((pitch, index) => [pitch, index] as const)) {
        const part = playbackPart(event, pitchIndex === principalPitchIndex);
        events.push({
          occurrenceId: `playback-occurrence.${occurrence.id}.${event.id}.${pitchIndex + 1}`,
          measureOccurrenceId: occurrence.id,
          iteration: occurrence.iteration,
          arrangementEventId: event.id,
          sourceEventIds: event.sourceEventIds,
          transformationEntryIds: transformationEntries.flatMap((entry) =>
            entry.id ? [entry.id] : []
          ),
          auditTargetIds: transformationEntries.flatMap(
            (entry) =>
              entry.preservationTargetIds ??
              (entry.sourceRelationshipId ? [entry.sourceRelationshipId] : [])
          ),
          instrumentId: event.instrumentId,
          ...(constituentStringIds[pitchIndex]
            ? { constituentStringId: constituentStringIds[pitchIndex] }
            : {}),
          part,
          midi,
          startSeconds: occurrence.startSeconds + rationalValue(event.onset) * secondsPerQuarter,
          durationSeconds: rationalValue(event.duration) * secondsPerQuarter,
        });
      }
    }
  }
  return {
    tempo,
    ...(arrangement.targetConfiguration?.instrumentInstance
      ? {
          instrumentInstanceDigest:
            arrangement.targetConfiguration.instrumentInstance.contentDigest,
        }
      : {}),
    durationSeconds: elapsedQuarters * secondsPerQuarter,
    synthesis: "basic-oscillator",
    mode: "literal",
    performedForm: {
      measureOccurrences: performedMeasures,
      traversalDecisions: score.performedForm?.traversalDecisions ?? [
        "Play written measures once in score order.",
      ],
      skipRepeats: options.skipRepeats ?? false,
    },
    parts: playbackParts(events, score),
    events,
  };
}

export function buildInterpretedAudioPreview(
  arrangement: ArrangementScore,
  score: NormalizedScore,
  interpretation: PerformanceInterpretation
): AudioPreview {
  assertAuthorityPathRuntime("authority.parameter.performance-interpretation", "production");
  if (
    interpretation.arrangementScoreId !== arrangement.id ||
    interpretation.arrangementScoreVersion !== (arrangement.version ?? 1)
  ) {
    throw new Error(
      "Performance Interpretation is linked to a different Arrangement Score version"
    );
  }
  const literal = buildAudioPreview(arrangement, score, interpretation.choices.tempo);
  const byArrangementEvent = new Map<string, PlaybackEvent[]>();
  for (const event of literal.events) {
    const key = `${event.measureOccurrenceId}:${event.arrangementEventId}`;
    byArrangementEvent.set(key, [...(byArrangementEvent.get(key) ?? []), event]);
  }
  const arpeggiationSeconds = interpretation.choices.arpeggiationMs / 1_000;
  const interpreted = literal.events.flatMap((event) => {
    const group = byArrangementEvent
      .get(`${event.measureOccurrenceId}:${event.arrangementEventId}`)!
      .slice()
      .sort((left, right) => left.midi - right.midi);
    const arpeggiationOffset = group.indexOf(event) * arpeggiationSeconds;
    const eighthIndex = Math.floor(event.startSeconds / (30 / interpretation.choices.tempo));
    const inequalityOffset =
      eighthIndex % 2 === 1
        ? (30 / interpretation.choices.tempo) * interpretation.choices.inequality
        : 0;
    const shaped = {
      ...event,
      startSeconds: event.startSeconds + arpeggiationOffset + inequalityOffset,
      durationSeconds: event.durationSeconds * interpretation.choices.articulation,
    };
    if (
      interpretation.choices.principalVoiceOrnament !== "upper_neighbor" ||
      event.part !== "principal-voice"
    ) {
      return [shaped];
    }
    const ornamentDuration = Math.min(shaped.durationSeconds / 2, 0.18);
    return [
      {
        ...shaped,
        occurrenceId: `${shaped.occurrenceId}.ornament-upper-neighbor`,
        midi: shaped.midi + 2,
        durationSeconds: ornamentDuration,
      },
      {
        ...shaped,
        startSeconds: shaped.startSeconds + ornamentDuration,
        durationSeconds: Math.max(0.03, shaped.durationSeconds - ornamentDuration),
      },
    ];
  });
  return {
    ...literal,
    mode: "interpreted",
    interpretation: {
      id: interpretation.id,
      version: interpretation.version,
      rationale: interpretation.rationale,
      choices: interpretation.choices,
    },
    durationSeconds: Math.max(
      literal.durationSeconds,
      ...interpreted.map((event) => event.startSeconds + event.durationSeconds)
    ),
    events: interpreted,
  };
}

export function skipRepeatedOccurrences(preview: AudioPreview): AudioPreview {
  const seen = new Set<string>();
  const kept = preview.performedForm.measureOccurrences.filter((occurrence) => {
    if (seen.has(occurrence.measureId)) return false;
    seen.add(occurrence.measureId);
    return true;
  });
  let elapsed = 0;
  const shifts = new Map<string, number>();
  const measures = kept.map((occurrence) => {
    shifts.set(occurrence.id, elapsed - occurrence.startSeconds);
    const shifted = { ...occurrence, startSeconds: elapsed };
    elapsed += occurrence.durationSeconds;
    return shifted;
  });
  return {
    ...preview,
    durationSeconds: elapsed,
    performedForm: { ...preview.performedForm, measureOccurrences: measures, skipRepeats: true },
    events: preview.events
      .filter((event) => shifts.has(event.measureOccurrenceId))
      .map((event) => ({
        ...event,
        startSeconds: event.startSeconds + shifts.get(event.measureOccurrenceId)!,
      })),
  };
}

function playbackPart(
  event: ArrangementScore["events"][number],
  isPrincipalPitch: boolean
): Exclude<PlaybackPart, "full"> {
  if (event.role === "principal_voice") return "principal-voice";
  if (event.role === "continuo_foundation") return "continuo-foundation";
  if (event.role === "realization") return "realization";
  if (event.role === "source_voice" && event.voiceId) return `voice:${event.voiceId}`;
  return isPrincipalPitch ? "principal-voice" : "accompaniment";
}

function playbackParts(events: PlaybackEvent[], score: NormalizedScore): AudioPreview["parts"] {
  const labels: Partial<Record<Exclude<PlaybackPart, "full">, string>> = {
    "principal-voice": "Principal Voice",
    "continuo-foundation": "Continuo Foundation",
    realization: "Generated realization",
    accompaniment: "Accompaniment",
  };
  const foundationInstrument = events.find(
    (event) => event.part === "continuo-foundation"
  )?.instrumentId;
  const realizationInstrument = events.find((event) => event.part === "realization")?.instrumentId;
  if (foundationInstrument)
    labels["continuo-foundation"] = `Continuo Foundation · ${foundationInstrument}`;
  if (realizationInstrument)
    labels.realization = `Generated realization · ${realizationInstrument}`;
  const order: Array<Exclude<PlaybackPart, "full">> = [
    "principal-voice",
    "continuo-foundation",
    "realization",
    "accompaniment",
  ];
  const used = new Set(events.map((event) => event.part));
  const voiceParts = (score.parts ?? []).flatMap((part) => {
    const id = `voice:${part.id}` as const;
    return used.has(id) ? [{ id, label: part.name }] : [];
  });
  return [
    { id: "full", label: "Full arrangement" },
    ...voiceParts,
    ...order.filter((part) => used.has(part)).map((part) => ({ id: part, label: labels[part]! })),
  ];
}

function rationalValue(value: Rational): number {
  return value.numerator / value.denominator;
}
