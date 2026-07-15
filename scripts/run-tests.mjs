import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const environment = { ...process.env };

if (process.platform === "linux" && !environment.FONTCONFIG_FILE) {
  const command = spawnSync("sh", ["-c", "command -v lilypond"], { encoding: "utf8" });
  const lilypond = command.status === 0 ? command.stdout.trim() : "";
  if (lilypond) {
    const storeRoot = path.dirname(path.dirname(realpathSync(lilypond)));
    const closure = spawnSync("nix-store", ["-qR", storeRoot], { encoding: "utf8" });
    if (closure.status === 0) {
      for (const dependency of closure.stdout.split("\n")) {
        const candidate = path.join(dependency, "etc", "fonts", "fonts.conf");
        if (dependency.includes("-fontconfig-") && existsSync(candidate)) {
          environment.FONTCONFIG_FILE = candidate;
          break;
        }
      }
    }
  }
}

const vitest = path.resolve("node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", ...process.argv.slice(2)], {
  env: environment,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
