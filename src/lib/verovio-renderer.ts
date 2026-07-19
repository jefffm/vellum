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
      svg: postprocessSourceNotation(mei, toolkit.renderToSVG(1)),
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

function postprocessSourceNotation(mei: string, svg: string): string {
  return postprocessHistoricalStrums(postprocessNoteheadRhythmSigns(mei, svg));
}

function postprocessNoteheadRhythmSigns(mei: string, svg: string): string {
  if (!/<staffDef\b[^>]*\btype="vellum\.notehead-rhythm-signs"/.test(mei)) return svg;
  let rendered = svg;
  const groups = /<tabGrp\b([^>]*)>([\s\S]*?)<\/tabGrp>/g;
  for (const match of mei.matchAll(groups)) {
    const attributes = match[1];
    const body = match[2];
    const duration = Number(attributes.match(/\bdur="(\d+)"/)?.[1]);
    const dots = Number(attributes.match(/\bdots="(\d+)"/)?.[1] ?? 0);
    const rhythmAttributes = body.match(/<tabDurSym\b([^>]*\bfacs="[^"]+"[^>]*)\/?\s*>/)?.[1];
    const rhythmId = rhythmAttributes?.match(/\bxml:id="([^"]+)"/)?.[1];
    if (!rhythmId || !Number.isInteger(duration) || duration < 1) continue;
    const escapedId = rhythmId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const group = new RegExp(
      `<g data-id="${escapedId}" data-class="tabDurSym" class="tabDurSym">([\\s\\S]*?)<\\/g>`
    );
    const renderedGroup = rendered.match(group)?.[0];
    if (!renderedGroup) continue;
    const position = renderedGroup
      .match(/transform="translate\(([-\d.]+),\s*([-\d.]+)\)/)
      ?.slice(1)
      .map(Number);
    if (!position || position.some((value) => !Number.isFinite(value))) continue;
    const [x, y] = position;
    const flagCount = Math.max(0, Math.round(Math.log2(duration)) - 2);
    const noteY = y + 105;
    const stemX = x + 54;
    const stemTop = noteY - 315;
    const openHead = duration <= 2;
    const head = `<ellipse cx="${x}" cy="${noteY}" rx="62" ry="43" transform="rotate(-18 ${x} ${noteY})" fill="${openHead ? "white" : "currentColor"}" stroke="currentColor" stroke-width="24"/>`;
    const stem =
      duration === 1
        ? ""
        : `<path d="M${stemX} ${noteY - 4} L${stemX} ${stemTop}" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round"/>`;
    const flags = Array.from({ length: flagCount }, (_, index) => {
      const flagY = stemTop + index * 74;
      return `<path data-rhythm-flag="${index + 1}" d="M${stemX} ${flagY} C${stemX + 104} ${flagY + 22} ${stemX + 112} ${flagY + 82} ${stemX + 24} ${flagY + 138} C${stemX + 65} ${flagY + 78} ${stemX + 36} ${flagY + 43} ${stemX} ${flagY + 54} Z" fill="currentColor" stroke="none"/>`;
    }).join("");
    const dotMarks = Array.from(
      { length: dots },
      (_, index) =>
        `<circle cx="${x + 132 + index * 58}" cy="${noteY - 8}" r="22" fill="currentColor" stroke="none"/>`
    ).join("");
    const durationLabel =
      duration === 1
        ? "Whole"
        : duration === 2
          ? "Half"
          : duration === 4
            ? "Quarter"
            : duration === 8
              ? "Eighth"
              : `${duration}th`;
    const replacement = `<g data-id="${rhythmId}" data-rhythm-flags="${flagCount}" data-class="tabDurSym" class="tabDurSym vellum-notehead-rhythm" aria-label="${durationLabel} rhythm sign">${head}${stem}${flags}${dotMarks}</g>`;
    rendered = rendered.replace(group, replacement);
  }
  return rendered;
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
