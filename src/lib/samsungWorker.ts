import { importSamsungFiles } from './samsung';

self.onmessage = async (ev: MessageEvent<File[]>) => {
  try {
    const res = await importSamsungFiles(ev.data);
    self.postMessage({ ok: true, res });
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
