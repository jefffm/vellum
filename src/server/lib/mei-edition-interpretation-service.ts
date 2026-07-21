import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";

import type {
  CreateEditionAcceptanceDecisionCommand,
  CreateTablatureInterpretationCommand,
  EditionAcceptanceDecision,
  MeiEditionVersion,
  TablatureInterpretation,
} from "../../lib/mei-edition-domain.js";
import { ApiRouteError } from "./create-route.js";
import { MeiEditionInterpretationStore } from "./mei-edition-interpretation-store.js";
import { MeiEditionStore } from "./mei-edition-store.js";

export type EditionPlaybackEvent = Readonly<{
  occurrenceId: string;
  measureOccurrenceId: string;
  measureNumber: number;
  iteration: number;
  meiId: string;
  course: number;
  fret: number;
  stringIndex: number;
  midi: number;
  startSeconds: number;
  durationSeconds: number;
}>;

export type EditionPlaybackPreview = Readonly<{
  editionId: string;
  editionVersion: number;
  interpretationId: string;
  interpretationVersion: number;
  authority: "provisional_audition" | "accepted_interpretation";
  permits: readonly ("literal_playback" | "analysis" | "reading_edition" | "idiom_evidence")[];
  durationSeconds: number;
  events: readonly EditionPlaybackEvent[];
  measureOccurrences: readonly Readonly<{
    id: string;
    measureNumber: number;
    iteration: number;
    startSeconds: number;
    durationSeconds: number;
  }>[];
}>;

export type EditionInterpretationState = Readonly<{
  editionVersion: number;
  interpretations: readonly TablatureInterpretation[];
  decisions: readonly EditionAcceptanceDecision[];
  interpretationStatuses: readonly Readonly<{
    interpretationId: string;
    stale: boolean;
    staleDecisionIds: readonly string[];
  }>[];
  transcription: Readonly<{
    unresolvedCriticalCount: number;
    accepted: boolean;
    staleDecisionIds: readonly string[];
  }>;
}>;

export class MeiEditionInterpretationService {
  private readonly editions: MeiEditionStore;
  private readonly records: MeiEditionInterpretationStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: {
    editions: MeiEditionStore;
    records: MeiEditionInterpretationStore;
    now?: () => Date;
    createId?: () => string;
  }) {
    this.editions = options.editions;
    this.records = options.records;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  state(workspaceId: string, editionId: string): EditionInterpretationState {
    const edition = this.editions.get(workspaceId, editionId);
    const decisions = this.records.listDecisions(workspaceId, editionId);
    const interpretations = this.records.listInterpretations(workspaceId, editionId);
    return {
      editionVersion: edition.version,
      interpretations,
      decisions,
      interpretationStatuses: interpretations.map((interpretation) => {
        const superseded = interpretations.some(
          (candidate) => candidate.parentInterpretationId === interpretation.id
        );
        const stale = interpretation.editionVersion !== edition.version || superseded;
        return {
          interpretationId: interpretation.id,
          stale,
          staleDecisionIds: stale
            ? decisions
                .filter((decision) => decision.interpretationId === interpretation.id)
                .map((decision) => decision.id)
            : [],
        };
      }),
      transcription: {
        unresolvedCriticalCount: edition.tokens.filter((token) => token.critical).length,
        accepted: Boolean(this.currentTranscriptionAcceptance(decisions, edition.version)),
        staleDecisionIds: decisions
          .filter(
            (decision) =>
              decision.scope === "transcription" && decision.editionVersion !== edition.version
          )
          .map((decision) => decision.id),
      },
    };
  }

  createInterpretation(
    workspaceId: string,
    editionId: string,
    command: CreateTablatureInterpretationCommand
  ): TablatureInterpretation {
    const edition = this.editions.get(workspaceId, editionId);
    this.assertExpectedEdition(edition, command.expectedEditionVersion);
    const parent = command.parentInterpretationId
      ? this.records.getInterpretation(workspaceId, editionId, command.parentInterpretationId)
      : undefined;
    const courseNumbers = command.courseTunings.map((course) => course.course);
    if (new Set(courseNumbers).size !== courseNumbers.length)
      throw new ApiRouteError("Course tunings must name each course once", 400);
    const requirements = readTablatureRequirements(edition.mei);
    const tuningByCourse = new Map(
      command.courseTunings.map((course) => [course.course, course.openMidis] as const)
    );
    const available = new Set(courseNumbers);
    const missing = requirements.courses.filter((course) => !available.has(course));
    if (missing.length)
      throw new ApiRouteError(
        `Interpretation has no sounding tuning for course ${missing.join(", ")}`,
        400
      );
    for (const tuning of command.courseTunings) {
      const maxFret = requirements.maxFretByCourse.get(tuning.course) ?? 0;
      if (tuning.openMidis.some((midi) => midi + maxFret > 127))
        throw new ApiRouteError(`Course ${tuning.course} interpretation exceeds MIDI range`, 400);
    }
    assertEventRhythms(command.eventRhythms, requirements);
    assertRepeatSections(command.repeatSections, requirements);
    const pinceIds = assertPinceRealizations(
      command.pinceRealizations,
      command.strumRealizations,
      requirements
    );
    assertStrumRealizations(command.strumRealizations, requirements, tuningByCourse, pinceIds);
    const interpretation: TablatureInterpretation = {
      id: `tab-interpretation.${this.createId()}`,
      editionId,
      editionVersion: edition.version,
      version: (parent?.version ?? 0) + 1,
      ...(parent ? { parentInterpretationId: parent.id } : {}),
      tempo: command.tempo,
      courseTunings: command.courseTunings,
      eventRhythms: command.eventRhythms,
      repeatSections: command.repeatSections,
      strumRealizations: command.strumRealizations,
      pinceRealizations: command.pinceRealizations,
      rationale: command.rationale,
      createdAt: this.now().toISOString(),
    };
    return this.records.saveInterpretation(workspaceId, editionId, interpretation);
  }

  decide(
    workspaceId: string,
    editionId: string,
    command: CreateEditionAcceptanceDecisionCommand
  ): EditionAcceptanceDecision {
    const edition = this.editions.get(workspaceId, editionId);
    const existingDecisions = this.records.listDecisions(workspaceId, editionId);
    this.assertExpectedEdition(edition, command.expectedEditionVersion);
    if (command.decision === "rejected" && command.purposes.length)
      throw new ApiRouteError("A rejection cannot grant purposes", 400);
    if (command.decision === "accepted" && !command.purposes.length)
      throw new ApiRouteError("An acceptance must name at least one purpose", 400);
    let interpretation: TablatureInterpretation | undefined;
    if (command.scope === "transcription") {
      if (command.interpretationId)
        throw new ApiRouteError("Transcription Acceptance cannot target an interpretation", 400);
      if (command.purposes.some((purpose) => purpose !== "reading_edition"))
        throw new ApiRouteError("Transcription Acceptance can grant only Reading Edition use", 400);
      if (command.decision === "accepted" && edition.tokens.some((token) => token.critical)) {
        throw new ApiRouteError("Transcription has unresolved Critical Uncertainty", 409);
      }
    } else {
      if (!command.interpretationId)
        throw new ApiRouteError("Interpretation Acceptance requires an exact interpretation", 400);
      if (command.purposes.includes("reading_edition"))
        throw new ApiRouteError("Reading Edition use belongs to Transcription Acceptance", 400);
      interpretation = this.records.getInterpretation(
        workspaceId,
        editionId,
        command.interpretationId
      );
      if (interpretation.editionVersion !== edition.version)
        throw new ApiRouteError("Interpretation targets a stale transcription version", 409);
      if (
        command.decision === "accepted" &&
        !this.currentTranscriptionAcceptance(existingDecisions, edition.version)
      ) {
        throw new ApiRouteError("Accept the exact transcription before its interpretation", 409);
      }
    }
    const sameSubject = existingDecisions.filter(
      (decision) =>
        decision.scope === command.scope &&
        (command.scope === "transcription" || decision.interpretationId === interpretation?.id)
    );
    const prior = latestDecision(sameSubject);
    if (prior?.id !== command.expectedPriorDecisionId)
      throw new ApiRouteError("Acceptance Decision parent is stale", 409);
    return this.records.saveDecision(workspaceId, editionId, {
      id: `edition-acceptance.${this.createId()}`,
      version: Math.max(0, ...sameSubject.map((decision) => decision.version)) + 1,
      editionId,
      editionVersion: edition.version,
      scope: command.scope,
      ...(interpretation
        ? { interpretationId: interpretation.id, interpretationVersion: interpretation.version }
        : {}),
      decision: command.decision,
      purposes: command.purposes,
      evidence: command.evidence,
      decidedAt: this.now().toISOString(),
    });
  }

  playback(
    workspaceId: string,
    editionId: string,
    interpretationId: string
  ): EditionPlaybackPreview {
    const edition = this.editions.get(workspaceId, editionId);
    const interpretation = this.records.getInterpretation(workspaceId, editionId, interpretationId);
    if (interpretation.editionVersion !== edition.version)
      throw new ApiRouteError("Interpretation targets a stale transcription version", 409);
    const decisions = this.records.listDecisions(workspaceId, editionId);
    const superseded = this.records
      .listInterpretations(workspaceId, editionId)
      .some((candidate) => candidate.parentInterpretationId === interpretation.id);
    const accepted = latestDecision(
      decisions.filter(
        (decision) =>
          decision.scope === "interpretation" &&
          decision.interpretationId === interpretation.id &&
          decision.interpretationVersion === interpretation.version &&
          decision.editionVersion === edition.version
      )
    );
    const authority =
      accepted?.decision === "accepted" && !superseded
        ? "accepted_interpretation"
        : "provisional_audition";
    const built = buildEditionPlayback(edition, interpretation);
    return {
      ...built,
      authority,
      permits:
        authority === "accepted_interpretation"
          ? accepted!.purposes
          : (["literal_playback"] as const),
    };
  }

  private currentTranscriptionAcceptance(
    decisions: readonly EditionAcceptanceDecision[],
    editionVersion: number
  ): EditionAcceptanceDecision | undefined {
    const latest = latestDecision(
      decisions.filter(
        (decision) =>
          decision.scope === "transcription" && decision.editionVersion === editionVersion
      )
    );
    return latest?.decision === "accepted" ? latest : undefined;
  }

  private assertExpectedEdition(edition: MeiEditionVersion, expectedVersion: number): void {
    if (edition.version !== expectedVersion) {
      throw new ApiRouteError(
        `MEI Edition parent is stale: expected v${expectedVersion}, current v${edition.version}`,
        409
      );
    }
  }
}

function latestDecision(
  decisions: readonly EditionAcceptanceDecision[]
): EditionAcceptanceDecision | undefined {
  return [...decisions].sort(
    (left, right) => right.version - left.version || right.decidedAt.localeCompare(left.decidedAt)
  )[0];
}

function readTablatureRequirements(mei: string): {
  courses: number[];
  numberedMeasures: number[];
  pickupMeasureIds: string[];
  closingMeasureIds: string[];
  eventIds: string[];
  eventLocations: Map<string, Readonly<{ measure: number; order: number }>>;
  maxFretByCourse: Map<number, number>;
  strums: Map<
    string,
    Readonly<{
      direction?: "up" | "down";
      explicitNotes: readonly Readonly<{ course: number; fret: number }>[];
      genericGesture: boolean;
    }>
  >;
} {
  const dom = new JSDOM(mei, { contentType: "application/xml" });
  try {
    const courses = new Set<number>();
    const maxFretByCourse = new Map<number, number>();
    for (const note of Array.from(dom.window.document.querySelectorAll("note[tab\\.course]"))) {
      const course = Number(note.getAttribute("tab.course"));
      const fret = Number(note.getAttribute("tab.fret"));
      if (!Number.isInteger(course) || !Number.isInteger(fret) || course < 1 || fret < 0)
        throw new ApiRouteError("Tablature Interpretation requires integer course and fret", 400);
      courses.add(course);
      maxFretByCourse.set(course, Math.max(maxFretByCourse.get(course) ?? 0, fret));
    }
    const numberedMeasures = Array.from(dom.window.document.querySelectorAll("measure"))
      .map((measure) => Number(measure.getAttribute("n")))
      .filter((number) => Number.isInteger(number) && number > 0);
    const pickupMeasureIds = Array.from(dom.window.document.querySelectorAll("measure"))
      .filter((measure) => hasType(measure, "section-pickup"))
      .map((measure) => xmlId(measure));
    const closingMeasureIds = Array.from(dom.window.document.querySelectorAll("measure"))
      .filter((measure) => hasType(measure, "section-closing"))
      .map((measure) => xmlId(measure));
    const eventLocations = new Map<string, Readonly<{ measure: number; order: number }>>();
    const eventIds = Array.from(dom.window.document.querySelectorAll("tabGrp")).map((group) =>
      xmlId(group)
    );
    let eventOrder = 0;
    for (const measure of Array.from(dom.window.document.querySelectorAll("measure"))) {
      const number = Number(measure.getAttribute("n"));
      if (!Number.isInteger(number) || number < 1) continue;
      for (const group of Array.from(measure.querySelectorAll("tabGrp"))) {
        eventLocations.set(xmlId(group), { measure: number, order: eventOrder++ });
      }
    }
    const strums = new Map<
      string,
      Readonly<{
        direction?: "up" | "down";
        explicitNotes: readonly Readonly<{ course: number; fret: number }>[];
        genericGesture: boolean;
      }>
    >();
    for (const group of Array.from(dom.window.document.querySelectorAll("tabGrp[type]"))) {
      const types = new Set((group.getAttribute("type") ?? "").split(/\s+/));
      const direction = types.has("historical-strum-up")
        ? "up"
        : types.has("historical-strum-down")
          ? "down"
          : undefined;
      if (!direction) continue;
      const id = xmlId(group);
      const explicitNotes = Array.from(group.querySelectorAll("note")).map((note) => ({
        course: Number(note.getAttribute("tab.course")),
        fret: Number(note.getAttribute("tab.fret")),
      }));
      strums.set(id, { direction, explicitNotes, genericGesture: false });
    }
    const groupsById = new Map(
      Array.from(dom.window.document.querySelectorAll("tabGrp")).map((group) => [
        xmlId(group),
        group,
      ])
    );
    for (const annotation of Array.from(dom.window.document.querySelectorAll("annot[type]"))) {
      const types = new Set((annotation.getAttribute("type") ?? "").split(/\s+/));
      const direction = types.has("visible-vertical-arrow-up")
        ? "up"
        : types.has("visible-vertical-arrow-down")
          ? "down"
          : undefined;
      if (!direction && !types.has("visible-vertical-gesture")) continue;
      const targetId = annotation.getAttribute("startid")?.replace(/^#/, "");
      const group = targetId ? groupsById.get(targetId) : undefined;
      if (!targetId || !group)
        throw new ApiRouteError("A visible gesture does not target a tablature event", 400);
      const explicitNotes = Array.from(group.querySelectorAll("note")).map((note) => ({
        course: Number(note.getAttribute("tab.course")),
        fret: Number(note.getAttribute("tab.fret")),
      }));
      strums.set(targetId, {
        ...(direction ? { direction } : {}),
        explicitNotes,
        genericGesture: !direction,
      });
    }
    return {
      courses: [...courses].sort((left, right) => left - right),
      numberedMeasures,
      pickupMeasureIds,
      closingMeasureIds,
      eventIds,
      eventLocations,
      maxFretByCourse,
      strums,
    };
  } finally {
    dom.window.close();
  }
}

type TablatureRequirements = ReturnType<typeof readTablatureRequirements>;

function assertEventRhythms(
  readings: CreateTablatureInterpretationCommand["eventRhythms"],
  requirements: TablatureRequirements
): void {
  const byId = new Map(readings.map((reading) => [reading.eventId, reading]));
  if (byId.size !== readings.length) {
    throw new ApiRouteError("Each tablature event must have exactly one rhythm reading", 400);
  }
  const expectedIds = [...requirements.eventIds].sort();
  const actualIds = [...byId.keys()].sort();
  if (actualIds.join(",") !== expectedIds.join(",")) {
    throw new ApiRouteError(
      "Interpretation must explicitly read the duration of every tablature event and no others",
      400
    );
  }
}

function assertRepeatSections(
  sections: TablatureInterpretation["repeatSections"],
  requirements: TablatureRequirements
): void {
  const expected = [...requirements.numberedMeasures].sort((left, right) => left - right);
  const covered: number[] = [];
  let priorEnd = 0;
  for (const section of sections) {
    if (section.startMeasure > section.endMeasure || section.startMeasure <= priorEnd) {
      throw new ApiRouteError("Interpretation repeat sections must be ordered and disjoint", 400);
    }
    for (let number = section.startMeasure; number <= section.endMeasure; number += 1) {
      covered.push(number);
    }
    if (
      section.pickupMeasureId &&
      !requirements.pickupMeasureIds.includes(section.pickupMeasureId)
    ) {
      throw new ApiRouteError(
        `Interpretation pickup is not in the transcription: ${section.pickupMeasureId}`,
        400
      );
    }
    if (section.petiteReprise) {
      const start = requirements.eventLocations.get(section.petiteReprise.startEventId);
      const end = requirements.eventLocations.get(section.petiteReprise.endEventId);
      if (
        !start ||
        !end ||
        start.measure < section.startMeasure ||
        end.measure > section.endMeasure ||
        start.order > end.order
      ) {
        throw new ApiRouteError(
          "Interpretation petite reprise must name an ordered event span inside its section",
          400
        );
      }
      if (section.totalPasses !== 1) {
        throw new ApiRouteError(
          "A section with an event-level petite reprise must traverse the whole section once",
          400
        );
      }
    }
    if (
      section.closingMeasureId &&
      !requirements.closingMeasureIds.includes(section.closingMeasureId)
    ) {
      throw new ApiRouteError(
        `Interpretation closing partial is not in the transcription: ${section.closingMeasureId}`,
        400
      );
    }
    priorEnd = section.endMeasure;
  }
  if (covered.join(",") !== expected.join(",")) {
    throw new ApiRouteError(
      "Interpretation repeat sections must cover every numbered measure exactly once",
      400
    );
  }
}

function assertStrumRealizations(
  realizations: CreateTablatureInterpretationCommand["strumRealizations"],
  requirements: TablatureRequirements,
  tuningByCourse: ReadonlyMap<number, readonly number[]>,
  pinceIds: ReadonlySet<string>
): void {
  const byId = new Map(realizations.map((realization) => [realization.strumId, realization]));
  if (byId.size !== realizations.length) {
    throw new ApiRouteError("Each historical strum must be realized exactly once", 400);
  }
  const expectedIds = [...requirements.strums.keys()].filter((id) => !pinceIds.has(id)).sort();
  const actualIds = [...byId.keys()].sort();
  if (actualIds.join(",") !== expectedIds.join(",")) {
    throw new ApiRouteError(
      "Interpretation must explicitly realize every historical strum and no others",
      400
    );
  }
  for (const [strumId, realization] of byId) {
    const source = requirements.strums.get(strumId)!;
    if (source.direction && realization.direction !== source.direction) {
      throw new ApiRouteError(
        `Strum ${strumId} direction disagrees with the reviewed visible gesture`,
        400
      );
    }
    if (new Set(realization.notes.map(({ course }) => course)).size !== realization.notes.length) {
      throw new ApiRouteError(`Strum ${strumId} names a course more than once`, 400);
    }
    for (const note of realization.notes) {
      const openMidis = tuningByCourse.get(note.course);
      if (!openMidis) {
        throw new ApiRouteError(`Strum ${strumId} uses an untuned course ${note.course}`, 400);
      }
      if (openMidis.some((midi) => midi + note.fret > 127)) {
        throw new ApiRouteError(`Strum ${strumId} exceeds MIDI range`, 400);
      }
    }
    if (source.explicitNotes.length) {
      const realizedByCourse = new Map(
        realization.notes.map(({ course, fret }) => [course, fret] as const)
      );
      if (source.explicitNotes.some(({ course, fret }) => realizedByCourse.get(course) !== fret)) {
        throw new ApiRouteError(
          `Explicit strum realization disagrees with source-written chord ${strumId}`,
          400
        );
      }
    }
  }
}

function assertPinceRealizations(
  realizations: CreateTablatureInterpretationCommand["pinceRealizations"],
  strumRealizations: CreateTablatureInterpretationCommand["strumRealizations"],
  requirements: TablatureRequirements
): ReadonlySet<string> {
  const pinceIds = realizations.map(({ eventId }) => eventId);
  if (new Set(pinceIds).size !== pinceIds.length) {
    throw new ApiRouteError("Each pincé gesture must be realized exactly once", 400);
  }
  const genericIds = [...requirements.strums]
    .filter(([, requirement]) => requirement.genericGesture)
    .map(([id]) => id)
    .sort();
  const genericStrumIds = strumRealizations
    .map(({ strumId }) => strumId)
    .filter((id) => requirements.strums.get(id)?.genericGesture);
  if (pinceIds.some((id) => genericStrumIds.includes(id))) {
    throw new ApiRouteError("A visible gesture cannot be both pincé and strummed", 400);
  }
  const resolvedIds = [...new Set([...pinceIds, ...genericStrumIds])].sort();
  if (resolvedIds.join(",") !== genericIds.join(",")) {
    throw new ApiRouteError(
      "Interpretation must explicitly resolve every generic visible gesture as pincé or strum",
      400
    );
  }
  for (const id of pinceIds) {
    const source = requirements.strums.get(id);
    if (!source?.genericGesture || source.explicitNotes.length < 2) {
      throw new ApiRouteError(`Pincé ${id} does not target a source-written chord`, 400);
    }
  }
  return new Set(pinceIds);
}

function xmlId(element: Element): string {
  const id =
    element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "id") ??
    element.getAttribute("xml:id");
  if (!id) throw new ApiRouteError("MEI interpretation encountered an object without xml:id", 400);
  return id;
}

function hasType(element: Element, expected: string): boolean {
  return new Set((element.getAttribute("type") ?? "").split(/\s+/).filter(Boolean)).has(expected);
}

function buildEditionPlayback(
  edition: MeiEditionVersion,
  interpretation: TablatureInterpretation
): Omit<EditionPlaybackPreview, "authority" | "permits"> {
  const dom = new JSDOM(edition.mei, { contentType: "application/xml" });
  try {
    const allMeasures = Array.from(dom.window.document.querySelectorAll("measure"));
    const numbered = new Map(
      allMeasures
        .map((measure) => [Number(measure.getAttribute("n")), measure] as const)
        .filter(([number]) => Number.isInteger(number) && number > 0)
    );
    const pickups = new Map(
      allMeasures
        .filter((measure) => hasType(measure, "section-pickup"))
        .map((measure) => [xmlId(measure), measure] as const)
    );
    const closings = new Map(
      allMeasures
        .filter((measure) => hasType(measure, "section-closing"))
        .map((measure) => [xmlId(measure), measure] as const)
    );
    const eventMeasure = new Map<string, number>();
    for (const [number, measure] of numbered) {
      for (const group of Array.from(measure.querySelectorAll("tabGrp"))) {
        eventMeasure.set(xmlId(group), number);
      }
    }
    const traversal: Array<{
      measure: Element;
      iteration: number;
      measureNumber: number;
      startEventId?: string;
      endEventId?: string;
    }> = interpretation.repeatSections.flatMap((section) => {
      const fullPasses = Array.from({ length: section.totalPasses }, (_, pass) => {
        const measures = Array.from(
          { length: section.endMeasure - section.startMeasure + 1 },
          (__, offset) => {
            const number = section.startMeasure + offset;
            const measure = numbered.get(number);
            if (!measure)
              throw new ApiRouteError(`Interpretation measure ${number} is missing`, 400);
            return { measure, iteration: pass + 1, measureNumber: number };
          }
        );
        const prefix = section.pickupMeasureId
          ? (() => {
              const pickup = pickups.get(section.pickupMeasureId!);
              if (!pickup)
                throw new ApiRouteError(
                  `Interpretation pickup ${section.pickupMeasureId} is missing`,
                  400
                );
              return [{ measure: pickup, iteration: pass + 1, measureNumber: 0 }];
            })()
          : [];
        const suffix = section.closingMeasureId
          ? (() => {
              const closing = closings.get(section.closingMeasureId!);
              if (!closing)
                throw new ApiRouteError(
                  `Interpretation closing partial ${section.closingMeasureId} is missing`,
                  400
                );
              return [{ measure: closing, iteration: pass + 1, measureNumber: section.endMeasure }];
            })()
          : [];
        return [...prefix, ...measures, ...suffix];
      }).flat();
      if (!section.petiteReprise) return fullPasses;
      const startMeasure = eventMeasure.get(section.petiteReprise.startEventId);
      const endMeasure = eventMeasure.get(section.petiteReprise.endEventId);
      if (startMeasure === undefined || endMeasure === undefined) {
        throw new ApiRouteError("Petite reprise event is missing from playback MEI", 400);
      }
      const reprisePasses = Array.from(
        { length: section.petiteReprise.totalPasses - 1 },
        (_, pass) =>
          Array.from({ length: endMeasure - startMeasure + 1 }, (__, offset) => {
            const number = startMeasure + offset;
            const measure = numbered.get(number);
            if (!measure)
              throw new ApiRouteError(`Interpretation measure ${number} is missing`, 400);
            return {
              measure,
              iteration: pass + 2,
              measureNumber: number,
              ...(number === startMeasure
                ? { startEventId: section.petiteReprise!.startEventId }
                : {}),
              ...(number === endMeasure ? { endEventId: section.petiteReprise!.endEventId } : {}),
            };
          })
      ).flat();
      return [...fullPasses, ...reprisePasses];
    });
    const tunings = new Map(
      interpretation.courseTunings.map((course) => [course.course, course.openMidis] as const)
    );
    const quarterSeconds = 60 / interpretation.tempo;
    const strums = new Map(
      interpretation.strumRealizations.map((realization) => [realization.strumId, realization])
    );
    if (!interpretation.eventRhythms) {
      throw new ApiRouteError(
        "Interpretation predates explicit event timing; create a successor interpretation",
        409
      );
    }
    const eventRhythms = new Map(
      interpretation.eventRhythms.map((reading) => [reading.eventId, reading])
    );
    const events: EditionPlaybackEvent[] = [];
    const measureOccurrences: EditionPlaybackPreview["measureOccurrences"] extends readonly (infer T)[]
      ? T[]
      : never = [];
    let elapsedQuarters = 0;
    for (const [
      occurrenceIndex,
      { measure, iteration, measureNumber, startEventId, endEventId },
    ] of traversal.entries()) {
      const measureStart = elapsedQuarters;
      const measureOccurrenceId = `edition-measure-occurrence.${measureNumber}.${iteration}.${occurrenceIndex + 1}`;
      let inMeasure = 0;
      let groups = Array.from(measure.querySelectorAll("tabGrp"));
      if (startEventId) {
        const startIndex = groups.findIndex((group) => xmlId(group) === startEventId);
        if (startIndex < 0) throw new ApiRouteError("Petite reprise start event is missing", 400);
        groups = groups.slice(startIndex);
      }
      if (endEventId) {
        const endIndex = groups.findIndex((group) => xmlId(group) === endEventId);
        if (endIndex < 0) throw new ApiRouteError("Petite reprise end event is missing", 400);
        groups = groups.slice(0, endIndex + 1);
      }
      for (const group of groups) {
        const groupId = xmlId(group);
        const rhythm = eventRhythms.get(groupId);
        if (!rhythm)
          throw new ApiRouteError(`Tablature event ${groupId} has no interpreted duration`, 409);
        const durationQuarters = (4 / rhythm.duration) * (2 - 1 / 2 ** rhythm.dots);
        const groupTypes = new Set((group.getAttribute("type") ?? "").split(/\s+/));
        const strumDirection = groupTypes.has("historical-strum-up")
          ? "up"
          : groupTypes.has("historical-strum-down")
            ? "down"
            : undefined;
        const strumId = strums.has(groupId) ? groupId : strumDirection ? groupId : undefined;
        const realization = strumId ? strums.get(strumId) : undefined;
        if (strumId && !realization) {
          throw new ApiRouteError(`Historical strum ${strumId} has no realization`, 409);
        }
        const soundingNotes = realization
          ? [...realization.notes]
              .sort((left, right) =>
                (("direction" in realization ? realization.direction : undefined) ??
                  strumDirection) === "up"
                  ? left.course - right.course
                  : right.course - left.course
              )
              .map((note, index) => ({
                ...note,
                meiId: strumId!,
                attackOffsetSeconds: (index * realization.spreadMilliseconds) / 1000,
              }))
          : Array.from(group.querySelectorAll("note")).map((note) => ({
              course: Number(note.getAttribute("tab.course")),
              fret: Number(note.getAttribute("tab.fret")),
              meiId: xmlId(note),
              attackOffsetSeconds: 0,
            }));
        for (const { course, fret, meiId, attackOffsetSeconds } of soundingNotes) {
          if (!Number.isInteger(course) || !Number.isInteger(fret) || course < 1 || fret < 0)
            throw new ApiRouteError(
              "Tablature Interpretation encountered invalid course or fret",
              400
            );
          const openMidis = tunings.get(course);
          if (!openMidis)
            throw new ApiRouteError(
              `Interpretation has no sounding tuning for course ${course}`,
              400
            );
          for (const [stringIndex, openMidi] of openMidis.entries()) {
            if (openMidi + fret > 127)
              throw new ApiRouteError(`Course ${course} interpretation exceeds MIDI range`, 400);
            events.push({
              occurrenceId: `edition-playback.${interpretation.id}.${occurrenceIndex + 1}.${meiId}.${stringIndex + 1}`,
              measureOccurrenceId,
              measureNumber,
              iteration,
              meiId,
              course,
              fret,
              stringIndex: stringIndex + 1,
              midi: openMidi + fret,
              startSeconds: (measureStart + inMeasure) * quarterSeconds + attackOffsetSeconds,
              durationSeconds: Math.max(
                0.05,
                durationQuarters * quarterSeconds - attackOffsetSeconds
              ),
            });
          }
        }
        inMeasure += durationQuarters;
      }
      measureOccurrences.push({
        id: measureOccurrenceId,
        measureNumber,
        iteration,
        startSeconds: measureStart * quarterSeconds,
        durationSeconds: inMeasure * quarterSeconds,
      });
      elapsedQuarters += inMeasure;
    }
    return {
      editionId: edition.editionId,
      editionVersion: edition.version,
      interpretationId: interpretation.id,
      interpretationVersion: interpretation.version,
      durationSeconds: elapsedQuarters * quarterSeconds,
      events,
      measureOccurrences,
    };
  } finally {
    dom.window.close();
  }
}
