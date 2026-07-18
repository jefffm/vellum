/// <reference lib="webworker" />

import { renderMeiWithVerovio } from "./lib/verovio-renderer.js";

export type MeiEditionWorkerRequest = Readonly<{
  requestId: string;
  mei: string;
  eventIds: readonly string[];
}>;

export type MeiEditionWorkerResponse =
  | Readonly<{
      requestId: string;
      ok: true;
      result: Awaited<ReturnType<typeof renderMeiWithVerovio>>;
    }>
  | Readonly<{ requestId: string; ok: false; error: string }>;

self.addEventListener("message", (event: MessageEvent<MeiEditionWorkerRequest>) => {
  const request = event.data;
  void renderMeiWithVerovio(request.mei, request.eventIds)
    .then((result) => {
      self.postMessage({
        requestId: request.requestId,
        ok: true,
        result,
      } satisfies MeiEditionWorkerResponse);
    })
    .catch((error: unknown) => {
      self.postMessage({
        requestId: request.requestId,
        ok: false,
        error: error instanceof Error ? error.message : "MEI rendering failed",
      } satisfies MeiEditionWorkerResponse);
    });
});
