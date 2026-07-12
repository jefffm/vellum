import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const apiPort = Number(process.env.VELLUM_DEV_API_PORT ?? 3000);
const webPort = Number(process.env.VELLUM_DEV_WEB_PORT ?? 5173);
const host = "127.0.0.1";
const children = new Set();
let shuttingDown = false;

function command(name, args, env = {}) {
  const child = spawn(name, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: false,
  });
  track(child, name);
  return child;
}

function track(child, name) {
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`${name} stopped unexpectedly (${signal ?? code ?? "unknown"})`);
      void shutdown(code === 0 ? 1 : (code ?? 1));
    }
  });
}

async function startCompilerWatch() {
  const child = spawn(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "-p",
      "tsconfig.server.json",
      "--watch",
      "--preserveWatchOutput",
    ],
    { cwd: root, env: process.env, stdio: ["ignore", "pipe", "inherit"], shell: false }
  );
  track(child, "TypeScript API watcher");
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error("TypeScript API watcher readiness timed out")),
      30_000
    );
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      if (chunk.includes("Watching for file changes")) {
        clearTimeout(deadline);
        resolve();
      }
    });
    child.once("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
  });
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(
    [...children].map(
      (child) =>
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 5_000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
        })
    )
  );
  process.exitCode = code;
}

async function waitForApi(schemaVersion) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${host}:${apiPort}/health`, { cache: "no-store" });
      const health = await response.json();
      if (response.ok && health.apiSchemaVersion === schemaVersion) return health;
      lastError = new Error(
        `API schema ${String(health.apiSchemaVersion)} does not match ${schemaVersion}`
      );
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError ?? new Error("API readiness timed out");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(0));
}

const initial = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.server.json"],
  {
    cwd: root,
    stdio: "inherit",
  }
);
if (initial.status !== 0) process.exit(initial.status ?? 1);

const { VELLUM_API_SCHEMA_VERSION } = await import(
  new URL("../dist-server/lib/runtime-contract.js", import.meta.url)
);
await startCompilerWatch();
command(process.execPath, ["--watch", "dist-server/server/index.js"], { PORT: String(apiPort) });

try {
  const health = await waitForApi(VELLUM_API_SCHEMA_VERSION);
  console.log(`Compatible API ready: ${health.runtimeInstanceId}`);
  command(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "--host",
    host,
    "--port",
    String(webPort),
    "--strictPort",
  ]);
} catch (error) {
  console.error(error);
  await shutdown(1);
}
