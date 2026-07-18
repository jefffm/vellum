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
      svg: toolkit.renderToSVG(1),
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
