import { Value } from "@sinclair/typebox/value";
import yaml from "js-yaml";
import lute13ProfileYaml from "../../instruments/baroque-lute-13.yaml?raw";
import guitar5ProfileYaml from "../../instruments/baroque-guitar-5.yaml?raw";
import { InstrumentProfile, InstrumentProfileSchema } from "../types.js";
import { errorMessage } from "./errors.js";

const profileSources: Record<string, string> = {
  "baroque-lute-13": lute13ProfileYaml,
  "baroque-guitar-5": guitar5ProfileYaml,
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
