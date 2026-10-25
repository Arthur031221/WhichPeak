import { type AlignRequest, runAlign } from "../core/autoalign";
import type { AlignResult } from "../core/align";

export type AlignResponse = { ok: true; result: AlignResult } | { ok: false; message: string };

self.onmessage = (e: MessageEvent<AlignRequest>) => {
  try {
    self.postMessage({ ok: true, result: runAlign(e.data) } satisfies AlignResponse);
  } catch (err) {
    self.postMessage({ ok: false, message: (err as Error).message } satisfies AlignResponse);
  }
};
