import { randomUUID } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import { normalizeAbc } from "../../lib/abc-normalizer.js";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import type {
  AnalysisRecord,
  NormalizedScore,
  RecognizedScore,
  ScoreTranscription,
} from "../../lib/music-domain.js";
import { RecognizedScoreSchema } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { normalizeMusicXml } from "./musicxml-normalizer.js";
import { convertInterchangeToMusicXml } from "./interchange-converter.js";
import { WorkspaceStore } from "./workspace-store.js";

type SourceImportServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
  normalizeMusicXml?: typeof normalizeMusicXml;
  convertInterchange?: typeof convertInterchangeToMusicXml;
};

export type SourceImportResult = {
  scoreTranscription: ScoreTranscription;
  normalizedScore: NormalizedScore;
  analysisRecord: AnalysisRecord;
};

export class SourceImportService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly musicXmlNormalizer: typeof normalizeMusicXml;
  private readonly convertInterchange: typeof convertInterchangeToMusicXml;

  constructor(options: SourceImportServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.musicXmlNormalizer = options.normalizeMusicXml ?? normalizeMusicXml;
    this.convertInterchange = options.convertInterchange ?? convertInterchangeToMusicXml;
  }

  async import(
    workspaceId: string,
    sourceArtifactId: string,
    options: { voiceNames?: string[]; bestEffortScore?: RecognizedScore } = {}
  ): Promise<SourceImportResult> {
    const source = this.store.getSourceArtifact(workspaceId, sourceArtifactId);
    const content = this.store.readSourceContent(workspaceId, sourceArtifactId);
    let recognized: RecognizedScore;
    let method: NonNullable<ScoreTranscription["ingestion"]>["method"];
    const diagnostics: NonNullable<ScoreTranscription["ingestion"]>["diagnostics"] = [];

    if (source.kind === "musicxml") {
      recognized = await this.musicXmlNormalizer(content, source.filename);
      method = "deterministic_parse";
    } else if (source.kind === "lilypond") {
      const text = content.toString("utf8");
      const voiceNames = options.voiceNames?.length ? options.voiceNames : inferVoiceNames(text);
      const parsed = parseExplicitVoiceLilypond(text, voiceNames);
      recognized = { ...parsed, uncertainties: [] };
      method = "deterministic_parse";
      diagnostics.push({
        severity: "info",
        code: "lilypond.restricted_grammar",
        message: `Parsed the supported explicit-voice LilyPond subset (${voiceNames.join(", ")}).`,
      });
    } else if (source.kind === "abc") {
      recognized = normalizeAbc(content.toString("utf8"));
      method = "deterministic_parse";
      diagnostics.push({
        severity: "info",
        code: "abc.native_parse",
        message: "ABC melody, rhythm, meter, key, and bar structure were parsed directly.",
      });
    } else if (["mei", "mscz"].includes(source.kind)) {
      const converted = await this.convertInterchange(
        source.kind as "abc" | "mei" | "mscz",
        content
      );
      recognized = await this.musicXmlNormalizer(converted.content, `${source.filename}.musicxml`);
      method = "interchange_conversion";
      diagnostics.push({
        severity: "info",
        code: `${source.kind}.converted_to_musicxml`,
        message: `${source.kind.toUpperCase()} was converted through ${converted.converter}; the original Source Artifact remains authoritative.`,
      });
    } else if (source.kind === "lead_sheet" || source.kind === "tablature") {
      try {
        recognized = Value.Decode(RecognizedScoreSchema, JSON.parse(content.toString("utf8")));
      } catch (error) {
        throw new ApiRouteError(
          `${source.kind} source does not match the semantic JSON format: ${error instanceof Error ? error.message : String(error)}`,
          422
        );
      }
      if (
        source.kind === "lead_sheet" &&
        (!recognized.events.some((event) => event.type === "chord_symbol") ||
          !recognized.events.some((event) => event.type === "note"))
      ) {
        throw new ApiRouteError("A lead sheet must contain melody notes and chord symbols", 422);
      }
      if (
        source.kind === "tablature" &&
        !recognized.events.some((event) => event.type === "note" && event.tablature)
      ) {
        throw new ApiRouteError(
          "Existing tablature must preserve at least one explicit course and fret assignment",
          422
        );
      }
      method = "deterministic_parse";
      diagnostics.push({
        severity: "info",
        code: `${source.kind}.semantic_import`,
        message:
          source.kind === "lead_sheet"
            ? "Melody notes and chord symbols were retained as simultaneous source semantics."
            : "Pitches, course choices, frets, rhythm, and notation labels were retained where supplied.",
      });
    } else if (source.kind === "natural_language" && options.bestEffortScore) {
      recognized = Value.Decode(RecognizedScoreSchema, options.bestEffortScore);
      method = "best_effort";
      diagnostics.push({
        severity: "warning",
        code: "source.best_effort_model_memory",
        message:
          "This transcription was proposed from natural language or model memory and is not equivalent to an uploaded score.",
      });
    } else {
      throw new ApiRouteError(
        `${source.kind} ingestion requires its format adapter and cannot be mislabeled as optical recognition or MusicXML`,
        422
      );
    }

    const timestamp = this.now().toISOString();
    const transcription: ScoreTranscription = {
      id: `transcription.${this.createId()}`,
      sourceArtifactId: source.id,
      version: 1,
      status: method === "best_effort" ? "best_effort" : "reviewed",
      title: recognized.title,
      key: recognized.key,
      timeSignature: recognized.timeSignature,
      parts: recognized.parts,
      measures: recognized.measures,
      events: recognized.events,
      uncertainties: recognized.uncertainties,
      ingestion: { method, sourceFormat: source.kind, diagnostics },
      createdAt: timestamp,
    };
    this.store.saveScoreTranscription(workspaceId, transcription);
    const normalizedScore: NormalizedScore = {
      id: `score.${this.createId()}`,
      scoreTranscriptionId: transcription.id,
      version: 1,
      title: transcription.title,
      key: transcription.key,
      timeSignature: transcription.timeSignature,
      parts: transcription.parts,
      measures: transcription.measures,
      events: transcription.events,
      createdAt: timestamp,
    };
    this.store.saveNormalizedScore(workspaceId, normalizedScore);
    const analysisRecord = analyzeMusicologicalScore(normalizedScore, {
      id: `analysis.${this.createId()}`,
      createdAt: timestamp,
    });
    this.store.saveAnalysisRecord(workspaceId, analysisRecord);
    return { scoreTranscription: transcription, normalizedScore, analysisRecord };
  }
}

function inferVoiceNames(source: string): string[] {
  const names = [...source.matchAll(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*=\s*\{/gm)].map(
    (match) => match[1]!
  );
  if (!names.length) {
    throw new ApiRouteError(
      "Restricted LilyPond import requires explicit named voice assignments",
      422
    );
  }
  return names;
}
