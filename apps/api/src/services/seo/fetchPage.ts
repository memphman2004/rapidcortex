import { env } from "../../lib/env.js";

export type FetchedPage = {
  statusCode: number;
  finalUrl: string;
  html: string;
  responseHeaders: Record<string, string>;
};

function normalizeHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

export async function fetchHtmlWithLimits(
  absoluteUrl: string,
  opts?: { maxBytes?: number; timeoutMs?: number },
): Promise<FetchedPage> {
  const maxBytes = opts?.maxBytes ?? env.seoMaxFetchBytes;
  const timeoutMs = opts?.timeoutMs ?? env.seoFetchTimeoutMs;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(absoluteUrl, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "RapidCortex-CortexSeoBot/1.0",
      },
    });
    const reader = res.body?.getReader();
    if (!reader) {
      return {
        statusCode: res.status,
        finalUrl: res.url,
        html: "",
        responseHeaders: normalizeHeaders(res.headers),
      };
    }
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("PAGE_TOO_LARGE");
        }
        chunks.push(Buffer.from(value));
      }
    }
    const html = Buffer.concat(chunks).toString("utf8");
    return {
      statusCode: res.status,
      finalUrl: res.url,
      html,
      responseHeaders: normalizeHeaders(res.headers),
    };
  } finally {
    clearTimeout(timer);
  }
}
