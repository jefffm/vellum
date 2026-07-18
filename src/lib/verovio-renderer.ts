import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

export const PINNED_VEROVIO_VERSION = "6.2.0" as const;

export const VELLUM_VEROVIO_OPTIONS = Object.freeze({
  adjustPageHeight: true,
  breaks: "encoded",
  footer: "none",
  header: "none",
  pageHeight: 1200,
  pageWidth: 2400,
  scale: 70,
  svgHtml5: true,
  svgRemoveXlink: true,
  svgViewBox: true,
});

export type VerovioEvent = Readonly<{
  id: string;
  timeMs: number;
  pitch?: number;
}>;

export type VerovioRenderResult = Readonly<{
  svg: string;
  midiBase64: string;
  timemap: unknown;
  events: readonly VerovioEvent[];
  version: string;
  profile: typeof VELLUM_VEROVIO_OPTIONS;
}>;

let modulePromise: Promise<unknown> | undefined;

function loadModule(): Promise<unknown> {
  return (modulePromise ??= createVerovioModule());
}

export async function renderMeiWithVerovio(
  mei: string,
  eventIds: readonly string[] = []
): Promise<VerovioRenderResult> {
  const toolkit = new VerovioToolkit(await loadModule());
  try {
    toolkit.setOptions({ ...VELLUM_VEROVIO_OPTIONS });
    if (!toolkit.loadData(mei)) throw new Error("Verovio rejected the MEI document");
    const version = toolkit.getVersion();
    if (!version.startsWith(`${PINNED_VEROVIO_VERSION}-`) && version !== PINNED_VEROVIO_VERSION) {
      throw new Error(`Expected Verovio ${PINNED_VEROVIO_VERSION}, received ${version}`);
    }
    return Object.freeze({
      svg: postprocessHistoricalStrums(toolkit.renderToSVG(1)),
      midiBase64: toolkit.renderToMIDI(),
      timemap: toolkit.renderToTimemap({ includeMeasures: true, includeRests: true }),
      events: Object.freeze(
        eventIds.map((id) => {
          const midi = toolkit.getMIDIValuesForElement(id);
          return Object.freeze({
            id,
            timeMs: toolkit.getTimeForElement(id),
            ...(Number.isFinite(midi.pitch) ? { pitch: midi.pitch } : {}),
          });
        })
      ),
      version,
      profile: VELLUM_VEROVIO_OPTIONS,
    });
  } finally {
    toolkit.destroy();
  }
}

function postprocessHistoricalStrums(svg: string): string {
  let rendered = svg;
  let searchFrom = 0;
  while (true) {
    const start = rendered.indexOf(
      'data-class="tabGrp" class="tabGrp historical-strum-',
      searchFrom
    );
    if (start < 0) return rendered;
    const groupStart = rendered.lastIndexOf("<g ", start);
    const openingEnd = rendered.indexOf(">", start);
    if (groupStart < 0 || openingEnd < 0) return rendered;
    const opening = rendered.slice(groupStart, openingEnd + 1);
    const id = opening.match(/data-id="([^"]+)"/)?.[1];
    const direction = opening.includes("historical-strum-up") ? "up" : "down";
    const dots = Number(opening.match(/\sdots="(\d+)"/)?.[1] ?? 0);
    if (!id) {
      searchFrom = openingEnd + 1;
      continue;
    }
    let depth = 1;
    let closingStart = -1;
    const tags = /<\/?g\b[^>]*>/g;
    tags.lastIndex = openingEnd + 1;
    for (let match = tags.exec(rendered); match; match = tags.exec(rendered)) {
      if (match[0].startsWith("</g")) depth -= 1;
      else if (!match[0].endsWith("/>")) depth += 1;
      if (depth === 0) {
        closingStart = match.index;
        break;
      }
    }
    if (closingStart < 0) return rendered;
    const body = rendered.slice(openingEnd + 1, closingStart);
    if (body.includes("mei-historical-strum-mark")) {
      searchFrom = closingStart + 4;
      continue;
    }
    const notePosition = body
      .match(/data-class="note"[\s\S]*?transform="translate\(([-\d.]+),\s*([-\d.]+)\)/)
      ?.slice(1)
      .map(Number);
    const anchorPosition = body
      .match(/strum-render-anchor[\s\S]*?transform="translate\(([-\d.]+),\s*([-\d.]+)\)/)
      ?.slice(1)
      .map(Number);
    const position = notePosition ?? anchorPosition;
    if (!position || position.some((value) => !Number.isFinite(value))) {
      searchFrom = closingStart + 4;
      continue;
    }
    const [x, sourceY] = position;
    const centerY = sourceY + (notePosition ? 180 : 471);
    const tipY = centerY + (direction === "up" ? -120 : 120);
    const tailY = centerY + (direction === "up" ? 120 : -120);
    const arrowBaseY = tipY + (direction === "up" ? 58 : -58);
    const dotMarks = Array.from(
      { length: dots },
      (_, index) =>
        `<circle cx="${x + 75 + index * 55}" cy="${centerY}" r="22" fill="currentColor" stroke="none"/>`
    ).join("");
    const mark = `<g data-id="${id}-display" data-class="dir" class="dir mei-historical-strum-mark mei-historical-strum-${direction}" aria-label="Historical ${direction} strum"><path d="M${x} ${tailY} L${x} ${tipY}" fill="none" stroke="currentColor" stroke-width="26"/><path d="M${x} ${tipY} L${x - 48} ${arrowBaseY} L${x + 48} ${arrowBaseY} Z" fill="currentColor" stroke="none"/>${dotMarks}</g>`;
    const bodyWithoutRenderAnchor = body.replace(
      /<g\b[^>]*data-id="[^"]+-render-anchor"[^>]*>[\s\S]*?<\/g>/,
      ""
    );
    rendered = `${rendered.slice(0, openingEnd + 1)}${bodyWithoutRenderAnchor}${mark}${rendered.slice(closingStart)}`;
    searchFrom = openingEnd + 1 + bodyWithoutRenderAnchor.length + mark.length + 4;
  }
}
