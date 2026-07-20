import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = process.argv[2] ?? process.env.VELLUM_DEVISEE_PDF;
if (!sourcePath) {
  throw new Error(
    "Pass the Owner-local de Visée PDF path as the first argument or VELLUM_DEVISEE_PDF"
  );
}
const baseUrl = process.env.VELLUM_URL ?? "http://127.0.0.1:5173";
const sourceBytes = await readFile(sourcePath);

async function data(url, init) {
  const response = await fetch(`${baseUrl}${url}`, init);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error?.message ?? `${response.status} ${url}`);
  return body.data;
}

const workspace = await data("/api/workspaces", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "de Visée 1686 · page 9 edition" }),
});
const source = await data(`/api/workspaces/${workspace.id}/sources`, {
  method: "POST",
  headers: {
    "Content-Type": "application/pdf",
    "X-Source-Filename": encodeURIComponent(path.basename(sourcePath)),
    "X-Source-License": "Owner supplied local facsimile; repository inclusion not authorized",
  },
  body: sourceBytes,
});
const recognition = await data(`/api/workspaces/${workspace.id}/historical-tab-recognition-runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sourceArtifactId: source.id,
    sourcePage: 9,
    courseCount: 5,
  }),
});

const url = new URL(baseUrl);
url.searchParams.set("workspace", workspace.id);
url.searchParams.set("tabRecognition", recognition.id);
process.stdout.write(
  `${JSON.stringify({ workspaceId: workspace.id, recognitionId: recognition.id, url: url.toString() }, null, 2)}\n`
);
