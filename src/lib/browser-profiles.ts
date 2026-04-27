import { Value } from "@sinclair/typebox/value";
import yaml from "js-yaml";
import lute13ProfileYaml from "../../instruments/baroque-lute-13.yaml?raw";
import guitar5ProfileYaml from "../../instruments/baroque-guitar-5.yaml?raw";
import classicalGuitar6ProfileYaml from "../../instruments/classical-guitar-6.yaml?raw";
import pianoProfileYaml from "../../instruments/piano.yaml?raw";
import renaissanceLute6ProfileYaml from "../../instruments/renaissance-lute-6.yaml?raw";
import theorbo14ProfileYaml from "../../instruments/theorbo-14.yaml?raw";
import voiceAltoProfileYaml from "../../instruments/voice-alto.yaml?raw";
import voiceBassProfileYaml from "../../instruments/voice-bass.yaml?raw";
import voiceSopranoProfileYaml from "../../instruments/voice-soprano.yaml?raw";
import voiceTenorProfileYaml from "../../instruments/voice-tenor.yaml?raw";
import { InstrumentProfile, InstrumentProfileSchema } from "../types.js";
import { errorMessage } from "./errors.js";

const profileSources: Record<string, string> = {
  "baroque-lute-13": lute13ProfileYaml,
  "baroque-guitar-5": guitar5ProfileYaml,
  "classical-guitar-6": classicalGuitar6ProfileYaml,
  piano: pianoProfileYaml,
  "renaissance-lute-6": renaissanceLute6ProfileYaml,
  "theorbo-14": theorbo14ProfileYaml,
  "voice-alto": voiceAltoProfileYaml,
  "voice-bass": voiceBassProfileYaml,
  "voice-soprano": voiceSopranoProfileYaml,
  "voice-tenor": voiceTenorProfileYaml,
};

export class BrowserProfileLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BrowserProfileLoadError";
  }
}

export function loadBrowserProfile(id: string): InstrumentProfile {
  const source = profileSources[id];

  if (!source) {
    throw new BrowserProfileLoadError(`Unknown instrument profile: ${id}`);
  }

  try {
    const document = yaml.load(source);

    if (!Value.Check(InstrumentProfileSchema, document)) {
      const errors = [...Value.Errors(InstrumentProfileSchema, document)];
      const summary = errors
        .slice(0, 5)
        .map((error) => `${error.path || "/"}: ${error.message}`)
        .join("; ");

      throw new BrowserProfileLoadError(`Invalid instrument profile ${id}: ${summary}`);
    }

    return document;
  } catch (error) {
    if (error instanceof BrowserProfileLoadError) {
      throw error;
    }

    throw new BrowserProfileLoadError(
      `Could not load instrument profile ${id}: ${errorMessage(error)}`,
      {
        cause: error,
      }
    );
  }
}

export function loadAllBrowserProfiles(): InstrumentProfile[] {
  return Object.keys(profileSources)
    .sort()
    .map((id) => loadBrowserProfile(id));
}
