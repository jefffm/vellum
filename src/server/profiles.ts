import { Value } from "@sinclair/typebox/value";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { InstrumentProfile, InstrumentProfileSchema } from "../types.js";

export class ProfileLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProfileLoadError";
  }
}

export function instrumentsDirectory(): string {
  return process.env.VELLUM_INSTRUMENTS_DIR ?? path.join(process.cwd(), "instruments");
}

export function validateProfile(value: unknown, source: string): InstrumentProfile {
  if (!Value.Check(InstrumentProfileSchema, value)) {
    const errors = [...Value.Errors(InstrumentProfileSchema, value)];
    const summary = errors
      .slice(0, 5)
      .map((error) => `${error.path || "/"}: ${error.message}`)
      .join("; ");

    throw new ProfileLoadError(`Invalid instrument profile ${source}: ${summary}`);
  }

  return value;
}

export function loadProfile(id: string): InstrumentProfile {
  const filePath = path.join(instrumentsDirectory(), `${id}.yaml`);

  try {
    const document = yaml.load(readFileSync(filePath, "utf8"));
    return validateProfile(document, filePath);
  } catch (error) {
    if (error instanceof ProfileLoadError) {
      throw error;
    }

    throw new ProfileLoadError(
      `Could not load instrument profile ${id} from ${filePath}: ${(error as Error).message}`,
      { cause: error }
    );
  }
}

export function loadAllProfiles(): InstrumentProfile[] {
  try {
    return readdirSync(instrumentsDirectory())
      .filter((fileName) => fileName.endsWith(".yaml") || fileName.endsWith(".yml"))
      .sort()
      .map((fileName) => loadProfile(path.basename(fileName, path.extname(fileName))));
  } catch (error) {
    if (error instanceof ProfileLoadError) {
      throw error;
    }

    throw new ProfileLoadError(`Could not load instrument profiles: ${(error as Error).message}`, {
      cause: error
    });
  }
}

