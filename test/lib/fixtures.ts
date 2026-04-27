import fs from "node:fs";
import path from "node:path";

export function fixtureDir(): string {
  return path.resolve(process.cwd(), "test", "fixtures");
}

export function loadFixture(name: string): string {
  const filePath = path.join(fixtureDir(), name);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture not found: ${name} (${filePath})`);
  }

  return fs.readFileSync(filePath, "utf8");
}

export function loadLyFixture(name: string): string {
  return loadFixture(`${name}.ly`);
}

export function loadMusicXMLFixture(name: string): string {
  return loadFixture(`${name}.xml`);
}
