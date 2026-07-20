import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  CreateHistoricalTabRecognitionCommand,
  HistoricalTabRecognitionProfile,
  HistoricalTabRecognitionRun,
  PublishHistoricalTabDraftCommand,
} from "../../lib/historical-tab-recognition-domain.js";
import { canonicalJson } from "../../lib/canonical-json.js";
import { ApiRouteError } from "./create-route.js";
import { HistoricalTabRecognitionStore } from "./historical-tab-recognition-store.js";
import { MeiEditionService } from "./mei-edition-service.js";
import { MeiEditionStore } from "./mei-edition-store.js";
import { SubprocessRunner } from "./subprocess.js";
import { WorkspaceStore } from "./workspace-store.js";

type Runner = Pick<SubprocessRunner, "run">;

export class HistoricalTabRecognitionService {
  private readonly workspaces: WorkspaceStore;
  private readonly store: HistoricalTabRecognitionStore;
  private readonly runner: Runner;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    options: {
      workspaces?: WorkspaceStore;
      store?: HistoricalTabRecognitionStore;
      runner?: Runner;
      now?: () => Date;
      createId?: () => string;
    } = {}
  ) {
    this.workspaces = options.workspaces ?? new WorkspaceStore();
    this.store =
      options.store ?? new HistoricalTabRecognitionStore({ workspaces: this.workspaces });
    this.runner = options.runner ?? new SubprocessRunner(60_000);
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async recognize(
    workspaceId: string,
    command: CreateHistoricalTabRecognitionCommand
  ): Promise<HistoricalTabRecognitionRun> {
    const source = this.workspaces.getSourceArtifact(workspaceId, command.sourceArtifactId);
    if (source.kind !== "pdf")
      throw new ApiRouteError("The initial printed-tablature recognizer requires a PDF", 422);
    const sourceBytes = this.workspaces.readSourceContent(workspaceId, source.id);
    const recognitionProfile = command.recognitionProfileId
      ? this.store.getProfile(workspaceId, command.recognitionProfileId)
      : undefined;
    if (
      recognitionProfile &&
      (recognitionProfile.courseCount !== command.courseCount ||
        recognitionProfile.notationType !== "tab.lute.french")
    )
      throw new ApiRouteError("Recognition profile is incompatible with this source run", 409);
    const rendered = await this.runner.run({
      command: "pdftoppm",
      args: [
        "-f",
        String(command.sourcePage),
        "-l",
        String(command.sourcePage),
        "-singlefile",
        "-png",
        "-r",
        "240",
        "source.pdf",
        "page",
      ],
      inputFile: { name: "source.pdf", content: sourceBytes },
      outputGlobs: ["page.png"],
      timeout: 45_000,
      maxInputBytes: 64 * 1024 * 1024,
      maxOutputFiles: 1,
      maxOutputFileBytes: 32 * 1024 * 1024,
      maxOutputTotalBytes: 32 * 1024 * 1024,
    });
    const pageImage = rendered.files.get("page.png");
    if (rendered.exitCode !== 0 || !pageImage)
      throw new ApiRouteError("Poppler could not render the requested tablature page", 422);

    const script = readFileSync(
      path.resolve(process.cwd(), "src/server/historical_tab_recognize.py")
    );
    const recognized = await this.runner.run({
      command: "python3",
      args: [
        "recognize.py",
        "page.png",
        String(command.courseCount),
        ...(recognitionProfile ? ["profile.json"] : []),
      ],
      inputFiles: [
        { name: "recognize.py", content: script },
        { name: "page.png", content: pageImage },
        ...(recognitionProfile
          ? [
              {
                name: "profile.json",
                content: Buffer.from(
                  JSON.stringify({
                    id: recognitionProfile.id,
                    version: recognitionProfile.version,
                    courseCount: recognitionProfile.courseCount,
                    notationType: recognitionProfile.notationType,
                    vocabulary: recognitionProfile.vocabulary,
                    spatialRules: recognitionProfile.spatialRules,
                  })
                ),
              },
            ]
          : []),
      ],
      timeout: 45_000,
      maxInputBytes: 40 * 1024 * 1024,
      maxCaptureBytes: 16 * 1024 * 1024,
      maxEmittedBytes: 16 * 1024 * 1024,
    });
    if (recognized.exitCode !== 0)
      throw new ApiRouteError(`Historical-tab geometry failed: ${recognized.stderr}`, 422);
    let extraction: Omit<
      HistoricalTabRecognitionRun,
      "id" | "sourceArtifactId" | "sourcePage" | "createdAt" | "pageImageSha256"
    >;
    try {
      extraction = JSON.parse(recognized.stdout) as typeof extraction;
    } catch {
      throw new ApiRouteError("Historical-tab geometry returned invalid JSON", 500);
    }
    if (recognitionProfile) {
      const profile = recognitionProfile;
      extraction = {
        ...extraction,
        profile: {
          ...extraction.profile,
          id: profile.id,
          version: profile.version,
          vocabulary: profile.vocabulary,
          spatialRules: profile.spatialRules,
        },
        clusters: extraction.clusters.map((cluster) => ({
          ...cluster,
          label: reviewedShapeLabel(
            cluster,
            profile.labels,
            profile.spatialRules.shapeDistanceThreshold
          ),
        })),
        hypotheses: extraction.clusters.flatMap((cluster, index) => {
          const proposedLabel = reviewedShapeLabel(
            cluster,
            profile.labels,
            profile.spatialRules.shapeDistanceThreshold
          );
          return proposedLabel
            ? [
                {
                  id: `hypothesis-${index + 1}`,
                  kind: "fret-cluster-label" as const,
                  clusterId: cluster.id,
                  proposedLabel,
                  profileId: profile.id,
                  authority: "proposal" as const,
                },
              ]
            : [];
        }),
        diagnostics: [
          ...extraction.diagnostics,
          `Applied ${profile.labels.length} reviewed cluster labels from ${profile.id}.`,
        ],
      };
    }
    const run: HistoricalTabRecognitionRun = {
      ...extraction,
      id: `tab-recognition.${this.createId()}`,
      sourceArtifactId: source.id,
      sourcePage: command.sourcePage,
      backend: {
        ...extraction.backend,
        configuration: {
          dpi: 240,
          courseCount: command.courseCount,
          recognizerSha256: createHash("sha256").update(script).digest("hex"),
          threshold: extraction.image.threshold,
          ...(recognitionProfile
            ? {
                recognitionProfileId: recognitionProfile.id,
                recognitionProfileSha256: createHash("sha256")
                  .update(canonicalJson(recognitionProfile))
                  .digest("hex"),
              }
            : {}),
        },
      },
      pageImageSha256: createHash("sha256").update(pageImage).digest("hex"),
      createdAt: this.now().toISOString(),
    };
    this.store.save(workspaceId, run, pageImage);
    return this.store.get(workspaceId, run.id);
  }

  publish(workspaceId: string, runId: string, command: PublishHistoricalTabDraftCommand) {
    const run = this.store.get(workspaceId, runId);
    if (command.events.some((event) => event.courses.length !== run.profile.courseCount))
      throw new ApiRouteError("Every reviewed event must cover all profile courses", 400);
    if (command.events.some((event) => event.rhythmGlyph === "unread"))
      throw new ApiRouteError(
        "Every reviewed event must resolve the visible rhythm-sign state",
        409
      );
    if (command.events.some((event) => event.verticalMark === "unread"))
      throw new ApiRouteError(
        "Every reviewed event must resolve detected vertical-mark evidence",
        409
      );
    const sourceEvents = new Map(
      run.systems.flatMap((system) =>
        system.events.map((event) => [event.id, { event, systemId: system.id }] as const)
      )
    );
    const covered = new Set<string>();
    for (const event of command.events) {
      for (const sourceEventId of event.sourceEventIds) {
        const source = sourceEvents.get(sourceEventId);
        if (!source)
          throw new ApiRouteError(
            `Reviewed event references unknown source event: ${sourceEventId}`,
            400
          );
        if (covered.has(sourceEventId))
          throw new ApiRouteError(`Source event is covered more than once: ${sourceEventId}`, 400);
        covered.add(sourceEventId);
      }
      const systems = new Set(
        event.sourceEventIds.map((sourceEventId) => sourceEvents.get(sourceEventId)!.systemId)
      );
      if (systems.size !== 1)
        throw new ApiRouteError("Reviewed events cannot merge across source systems", 400);
      assertRegionWithinSourceEvents(
        event.region,
        event.sourceEventIds.map((id) => sourceEvents.get(id)!.event)
      );
    }
    const missing = [...sourceEvents.keys()].filter((id) => !covered.has(id));
    if (missing.length)
      throw new ApiRouteError(`Reviewed draft omits ${missing.length} source-derived events`, 409);
    const built = buildReviewedDiplomaticMei(run, command);
    const confirmedEvents = command.events.filter((event) => event.state === "confirmed").length;
    const ambiguousEvents = command.events.length - confirmedEvents;
    if (
      command.reviewMetrics.reviewed !== command.events.length ||
      command.reviewMetrics.untouched !== 0 ||
      command.reviewMetrics.unresolved !== ambiguousEvents ||
      [
        command.reviewMetrics.corrected,
        command.reviewMetrics.regrouped,
        command.reviewMetrics.propagated,
        command.reviewMetrics.rejected,
      ].some((count) => count > command.events.length)
    )
      throw new ApiRouteError("Review metrics do not match the publishable draft", 400);
    const edition = new MeiEditionService({
      store: new MeiEditionStore({
        rootDirectory: this.store.rootDirectory,
        workspaces: this.workspaces,
      }),
      workspaces: this.workspaces,
      now: this.now,
      createId: this.createId,
    }).create(workspaceId, {
      sourceArtifactId: run.sourceArtifactId,
      sourcePage: run.sourcePage,
      title: command.title,
      mei: built.mei,
      tokens: built.tokens,
      extraction: {
        backendId: run.backend.id,
        backendVersion: run.backend.version,
        recognitionRunId: run.id,
        initialReviewBatch: {
          name: command.batchName,
          draftDigest: createHash("sha256").update(canonicalJson(command.events)).digest("hex"),
          confirmedEvents,
          ambiguousEvents,
          reviewMetrics: command.reviewMetrics,
        },
        diagnostics: [...run.diagnostics, `Published ${command.events.length} reviewed events.`],
      },
    });
    const profile = reviewedProfile(run, command, `tab-profile.${this.createId()}`, this.now());
    this.store.saveProfile(workspaceId, profile);
    return { edition, recognitionProfile: profile };
  }
}

function reviewedProfile(
  run: HistoricalTabRecognitionRun,
  command: PublishHistoricalTabDraftCommand,
  id: string,
  now: Date
): HistoricalTabRecognitionProfile {
  const sourceEvents = new Map(
    run.systems.flatMap((system) => system.events.map((event) => [event.id, event] as const))
  );
  const glyphs = new Map(run.glyphs.map((glyph) => [glyph.id, glyph] as const));
  const clusters = new Map(run.clusters.map((cluster) => [cluster.id, cluster] as const));
  const observations = new Map<string, Map<string, Set<string>>>();
  for (const event of command.events) {
    if (event.state !== "confirmed") continue;
    for (const sourceEventId of event.sourceEventIds) {
      const sourceEvent = sourceEvents.get(sourceEventId)!;
      for (const [courseIndex, letter] of event.courses.entries()) {
        if (!letter) continue;
        const candidate = sourceEvent.glyphIds
          .map((glyphId) => glyphs.get(glyphId))
          .filter((glyph) => glyph?.courseCandidate === courseIndex + 1)
          .sort((left, right) => (right?.area ?? 0) - (left?.area ?? 0))[0];
        const cluster = candidate ? clusters.get(candidate.clusterId) : undefined;
        const signature = cluster?.kind === "fret-letter" ? cluster.signature : undefined;
        if (!signature) continue;
        const labels = observations.get(signature) ?? new Map<string, Set<string>>();
        const evidence = labels.get(letter) ?? new Set<string>();
        evidence.add(sourceEventId);
        labels.set(letter, evidence);
        observations.set(signature, labels);
      }
    }
  }
  const conflicts = [...observations].filter(([, labels]) => labels.size > 1);
  const labels = [...observations].flatMap(([signature, readings]) => {
    if (readings.size !== 1) return [];
    const [label, evidence] = [...readings][0]!;
    const cluster = [...clusters.values()].find((candidate) => candidate.signature === signature)!;
    return [
      {
        signature,
        shapeCode: cluster.shapeCode!,
        label,
        evidenceEventIds: [...evidence].sort(),
      },
    ];
  });
  return {
    id,
    version: run.profile.version + 1,
    ...(run.profile.id.startsWith("tab-profile.") ? { parentProfileId: run.profile.id } : {}),
    notationType: run.profile.notationType,
    courseCount: run.profile.courseCount,
    vocabulary: run.profile.vocabulary,
    spatialRules: run.profile.spatialRules,
    labels,
    diagnostics: [
      `Learned ${labels.length} unconflicted glyph-shape labels from ${command.batchName}.`,
      ...(conflicts.length
        ? [`Withheld ${conflicts.length} conflicting shape signatures for later review.`]
        : []),
    ],
    createdAt: now.toISOString(),
  };
}

function reviewedShapeLabel(
  cluster: HistoricalTabRecognitionRun["clusters"][number],
  labels: Array<{ signature: string; shapeCode: string; label: string }>,
  maximumDistance: number
): string | null {
  if (cluster.kind !== "fret-letter" || !cluster.shapeCode) return null;
  const matches = labels
    .map((label) => ({ label, distance: shapeDistance(cluster.shapeCode!, label.shapeCode) }))
    .sort((left, right) => left.distance - right.distance);
  if (!matches.length || matches[0]!.distance > maximumDistance) return null;
  if (
    matches[1] &&
    matches[1].distance === matches[0]!.distance &&
    matches[1].label.label !== matches[0]!.label.label
  )
    return null;
  return matches[0]!.label.label;
}

function shapeDistance(left: string, right: string): number {
  const leftValues = Buffer.from(left, "hex");
  const rightValues = Buffer.from(right, "hex");
  return leftValues.reduce(
    (total, value, index) => total + Math.abs(value - rightValues[index]!) * (index < 2 ? 2 : 1),
    0
  );
}

function assertRegionWithinSourceEvents(
  region: { x: number; y: number; width: number; height: number },
  sourceEvents: Array<{ region: { x: number; y: number; width: number; height: number } }>
): void {
  const left = Math.min(...sourceEvents.map((event) => event.region.x));
  const top = Math.min(...sourceEvents.map((event) => event.region.y));
  const right = Math.max(...sourceEvents.map((event) => event.region.x + event.region.width));
  const bottom = Math.max(...sourceEvents.map((event) => event.region.y + event.region.height));
  const epsilon = 1e-8;
  if (
    region.x < left - epsilon ||
    region.y < top - epsilon ||
    region.x + region.width > right + epsilon ||
    region.y + region.height > bottom + epsilon
  )
    throw new ApiRouteError("Reviewed event region exceeds its source-derived evidence", 400);
}

function buildReviewedDiplomaticMei(
  run: HistoricalTabRecognitionRun,
  command: PublishHistoricalTabDraftCommand
) {
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const zones: string[] = [];
  const tokens: Array<{
    id: string;
    kind: "tablature" | "rhythm" | "strum" | "barline" | "ornament" | "other";
    region: { page: number; x: number; y: number; width: number; height: number };
    confidence: number;
    alternatives: string[];
    critical: boolean;
  }> = [];
  const eventBySourceId = new Map(
    run.systems.flatMap((system) => system.events.map((event) => [event.id, system.id] as const))
  );
  const sourceEventById = new Map(
    run.systems.flatMap((system) => system.events.map((event) => [event.id, event] as const))
  );
  const glyphById = new Map(run.glyphs.map((glyph) => [glyph.id, glyph] as const));
  const verticalById = new Map(
    run.systems.flatMap((system) =>
      system.barlines.map((candidate) => [candidate.id, candidate] as const)
    )
  );
  const groupsBySystem = new Map<
    string,
    Array<{ xml: string; measureBoundaryAfter: boolean; boundaryType: string }>
  >();
  for (const [index, event] of command.events.entries()) {
    const eventId = `reviewed-event-${index + 1}`;
    const region = { page: run.sourcePage, ...event.region };
    zones.push(zoneXml(eventId, event.region));
    const notes = event.courses.flatMap((letter, courseIndex) => {
      if (!letter) return [];
      const noteId = `${eventId}-course-${courseIndex + 1}`;
      const sourceGlyph = event.sourceEventIds
        .flatMap((sourceId) => sourceEventById.get(sourceId)?.glyphIds ?? [])
        .map((glyphId) => glyphById.get(glyphId))
        .filter((glyph) => glyph?.courseCandidate === courseIndex + 1)
        .sort((left, right) => (right?.area ?? 0) - (left?.area ?? 0))[0];
      const noteRegion = sourceGlyph?.region ?? event.region;
      zones.push(zoneXml(noteId, noteRegion));
      tokens.push({
        id: noteId,
        kind: "tablature",
        region: { page: run.sourcePage, ...noteRegion },
        confidence: event.state === "confirmed" ? 1 : 0.5,
        alternatives: event.state === "ambiguous" ? ["Owner marked this event ambiguous"] : [],
        critical: event.state === "ambiguous",
      });
      return [
        `<note xml:id="${noteId}" facs="#zone-${noteId}" tab.course="${courseIndex + 1}" tab.fret="${fretNumber(letter)}" label="${escape(letter)}"/>`,
      ];
    });
    const courseAbsences = event.courses
      .flatMap((letter, courseIndex) =>
        letter ? [] : [`<annot type="course-absence" n="${courseIndex + 1}">absent</annot>`]
      )
      .join("");
    const rhythmId = `${eventId}-rhythm`;
    zones.push(zoneXml(rhythmId, event.region));
    tokens.push({
      id: rhythmId,
      kind: "rhythm",
      region,
      confidence: event.state === "confirmed" ? 1 : 0.5,
      alternatives: event.state === "ambiguous" ? ["Owner marked this event ambiguous"] : [],
      critical: event.state === "ambiguous",
    });
    const annotations = [
      event.ornaments
        ? `<annot type="visible-ornament">${escape(event.ornaments)}</annot>`
        : '<annot type="ornament-absence">absent</annot>',
      event.marks
        ? `<annot type="visible-other-mark">${escape(event.marks)}</annot>`
        : '<annot type="other-mark-absence">absent</annot>',
    ].join("");
    let verticalAnnotation = '<annot type="visible-vertical-none">none</annot>';
    if (event.verticalMark !== "none") {
      const verticalId = `${eventId}-vertical`;
      const candidate = event.sourceEventIds
        .flatMap((sourceId) => sourceEventById.get(sourceId)?.verticalCandidateIds ?? [])
        .map((candidateId) => verticalById.get(candidateId))
        .filter(Boolean)
        .sort((left, right) => (right?.coverage ?? 0) - (left?.coverage ?? 0))[0];
      const verticalRegion = candidate?.region ?? event.region;
      zones.push(zoneXml(verticalId, verticalRegion));
      tokens.push({
        id: verticalId,
        kind:
          event.verticalMark.includes("barline") || event.verticalMark.startsWith("repeat")
            ? "barline"
            : event.verticalMark === "gesture"
              ? "strum"
              : "other",
        region: { page: run.sourcePage, ...verticalRegion },
        confidence: event.state === "confirmed" ? 1 : 0.5,
        alternatives: event.state === "ambiguous" ? ["Owner marked this event ambiguous"] : [],
        critical: event.state === "ambiguous",
      });
      verticalAnnotation = `<annot xml:id="${verticalId}" facs="#zone-${verticalId}" type="visible-vertical-${event.verticalMark}">${escape(event.verticalMark)}</annot>`;
    }
    const group = `<tabGrp xml:id="${eventId}" facs="#zone-${eventId}" type="diplomatic-event visible-rhythm-${event.rhythmGlyph}"${event.dots ? ` dots="${event.dots}"` : ""}><tabDurSym xml:id="${rhythmId}" facs="#zone-${rhythmId}" type="visible-rhythm-${event.rhythmGlyph}"/>${notes.join("")}${courseAbsences}${annotations}${verticalAnnotation}</tabGrp>`;
    const systemId = eventBySourceId.get(event.sourceEventIds[0]!)!;
    groupsBySystem.set(systemId, [
      ...(groupsBySystem.get(systemId) ?? []),
      {
        xml: group,
        measureBoundaryAfter: ["barline", "double-barline", "repeat-start", "repeat-end"].includes(
          event.verticalMark
        ),
        boundaryType: event.verticalMark,
      },
    ]);
  }
  let measureNumber = 0;
  const body = run.systems
    .map((system, systemIndex) => {
      const chunks: Array<{ groups: string[]; boundaryType: string }> = [];
      let active: string[] = [];
      for (const group of groupsBySystem.get(system.id) ?? []) {
        active.push(group.xml);
        if (group.measureBoundaryAfter) {
          chunks.push({ groups: active, boundaryType: group.boundaryType });
          active = [];
        }
      }
      if (active.length) chunks.push({ groups: active, boundaryType: "system-end" });
      return chunks
        .map((chunk, chunkIndex) => {
          measureNumber += 1;
          return `${systemIndex > 0 && chunkIndex === 0 ? "<sb/>" : ""}<measure xml:id="diplomatic-${system.id}-measure-${chunkIndex + 1}" n="${measureNumber}" metcon="false" type="reviewed-source-segment boundary-${chunk.boundaryType}"><staff n="1"><layer n="1">${chunk.groups.join("")}</layer></staff></measure>`;
        })
        .join("");
    })
    .join("");
  return {
    mei: `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.1"><meiHead><fileDesc><titleStmt><title>${escape(command.title)}</title></titleStmt><pubStmt><p>Source-reviewed diplomatic transcription.</p></pubStmt></fileDesc></meiHead><facsimile><surface xml:id="source-page-${run.sourcePage}" n="${run.sourcePage}">${zones.join("")}</surface></facsimile><music><body><mdiv><score><scoreDef><staffGrp><staffDef n="1" lines="5" notationtype="tab.lute.french"><label>Guitare</label></staffDef></staffGrp></scoreDef><section>${body}</section></score></mdiv></body></music></mei>`,
    tokens,
  };
}

function zoneXml(id: string, region: { x: number; y: number; width: number; height: number }) {
  return `<zone xml:id="zone-${id}" ulx="${Math.round(region.x * 10000)}" uly="${Math.round(region.y * 10000)}" lrx="${Math.round((region.x + region.width) * 10000)}" lry="${Math.round((region.y + region.height) * 10000)}"/>`;
}

function fretNumber(letter: string): number {
  const alphabet = "abcdefghiklmn";
  const result = alphabet.indexOf(letter);
  if (result < 0)
    throw new ApiRouteError(`Unsupported French tablature fret letter: ${letter}`, 400);
  return result;
}
