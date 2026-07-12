import { spawnSync } from "node:child_process";

const image =
  process.env.VELLUM_LILYPOND_IMAGE ??
  "docker.io/codello/lilypond@sha256:e9aeee661e40f9cd4b7cd573e3787f09abc52858b074e03ba04c2e17326b69f4";

function run(args) {
  const result = spawnSync("podman", args, { encoding: "utf8", timeout: 30_000 });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr.trim() ?? result.stdout.trim();
    throw new Error(`podman ${args[0]} failed: ${detail}`);
  }
  return result.stdout.trim();
}

run(["info"]);
run(["image", "exists", image]);
const version = run([
  "run",
  "--rm",
  "--pull=never",
  "--platform=linux/amd64",
  "--network=none",
  "--read-only",
  "--cap-drop=all",
  "--security-opt=no-new-privileges",
  image,
  "--version",
]);
console.log(`LilyPond sandbox ready: ${version.split("\n")[0]}`);
