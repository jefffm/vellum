import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const TEMPLATES_DIR = path.resolve(PROJECT_ROOT, "templates");
const OUTPUT_DIR = "/tmp/vellum-template-tests";

let lilypondAvailable = false;

beforeAll(() => {
  try {
    execSync("which lilypond", { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }

  if (lilypondAvailable) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
});

afterAll(() => {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
});

function compileTemplate(templateFile: string): {
  exitCode: number;
  stderr: string;
  outputDir: string;
} {
  const stem = path.basename(templateFile, ".ly");
  const outputPath = path.join(OUTPUT_DIR, stem);
  const templatePath = path.join("templates", templateFile);

  try {
    execSync(
      `lilypond --svg -I instruments -I templates -o "${outputPath}" "${templatePath}"`,
      {
        cwd: PROJECT_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30_000,
      }
    );

    return { exitCode: 0, stderr: "", outputDir: outputPath };
  } catch (error: unknown) {
    const execError = error as { status?: number; stderr?: Buffer };
    return {
      exitCode: execError.status ?? 1,
      stderr: execError.stderr?.toString() ?? "",
      outputDir: outputPath,
    };
  }
}

describe("template compilation", () => {
  const templates = fs.existsSync(TEMPLATES_DIR)
    ? fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".ly"))
    : [];

  // Cache compilation results so we compile each template only once
  const results = new Map<string, ReturnType<typeof compileTemplate>>();

  function getResult(template: string): ReturnType<typeof compileTemplate> {
    if (!results.has(template)) {
      results.set(template, compileTemplate(template));
    }
    return results.get(template)!;
  }

  for (const template of templates) {
    it(`compiles ${template} without LilyPond errors`, () => {
      if (!lilypondAvailable) {
        return; // skip silently
      }

      const result = getResult(template);
      // LilyPond may return 0 even with warnings; check for actual errors in stderr
      const hasErrors = /error:/i.test(result.stderr);
      expect(hasErrors).toBe(false);
    });

    it(`${template} produces non-empty SVG`, () => {
      if (!lilypondAvailable) {
        return;
      }

      const result = getResult(template);
      const stem = path.basename(template, ".ly");
      const svgPath = path.join(OUTPUT_DIR, `${stem}.svg`);

      expect(fs.existsSync(svgPath)).toBe(true);
      const svg = fs.readFileSync(svgPath, "utf8");
      expect(svg.length).toBeGreaterThan(0);
      expect(svg).toContain("<svg");
    });
  }

  describe("french-tab.ly", () => {
    it("produces MIDI output", () => {
      if (!lilypondAvailable) {
        return;
      }

      getResult("french-tab.ly");
      const midiPath = path.join(OUTPUT_DIR, "french-tab.midi");
      const midPath = path.join(OUTPUT_DIR, "french-tab.mid");
      const hasMidi = fs.existsSync(midiPath) || fs.existsSync(midPath);
      expect(hasMidi).toBe(true);
    });

    it("SVG contains text elements (tab letters)", () => {
      if (!lilypondAvailable) {
        return;
      }

      getResult("french-tab.ly");
      const svgPath = path.join(OUTPUT_DIR, "french-tab.svg");
      const svg = fs.readFileSync(svgPath, "utf8");
      expect(svg).toContain("<text");
    });
  });
});
