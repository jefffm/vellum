import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { buildDiplomaticMei } from "./lib/build-diplomatic-mei.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const sourcePath = process.argv[2] ?? process.env.VELLUM_DEVISEE_PDF;
if (!sourcePath) {
  throw new Error(
    "Pass the Owner-local de Visée PDF path as the first argument or VELLUM_DEVISEE_PDF"
  );
}
const baseUrl = process.env.VELLUM_URL ?? "http://127.0.0.1:5173";
const extraction = JSON.parse(
  await readFile(path.join(repo, "resources/editions/devisee-page9-provisional.json"), "utf8")
);
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
const diplomatic = buildDiplomaticMei(extraction);
const projected = await data(`/api/workspaces/${workspace.id}/mei-editions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sourceArtifactId: source.id,
    sourcePage: extraction.sourcePage,
    title: extraction.title,
    ...diplomatic,
    extraction: {
      backendId: "vellum.structured-provisional-page-extraction",
      backendVersion: "1",
      diagnostics: [
        "Diplomatic readings are provisional and source-linked.",
        "Confidence prioritizes review and does not establish acceptance.",
      ],
    },
  }),
});

const url = new URL(baseUrl);
url.searchParams.set("workspace", workspace.id);
url.searchParams.set("meiEdition", projected.edition.editionId);
process.stdout.write(
  `${JSON.stringify({ workspaceId: workspace.id, editionId: projected.edition.editionId, url: url.toString() }, null, 2)}\n`
);
