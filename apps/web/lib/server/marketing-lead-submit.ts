import "server-only";

import { marketingLeadBodySchema, marketingUnsubscribeBodySchema } from "rapid-cortex-shared";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

function upstreamBases(): string[] {
  const b1 = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "") ?? "";
  const b2 = process.env.API_UPSTREAM_BASE_2?.replace(/\/$/, "") ?? "";
  const b3 = process.env.API_UPSTREAM_BASE_3?.replace(/\/$/, "") ?? "";
  const out: string[] = [];
  if (b3) out.push(b3);
  if (b2 && b2 !== b3) out.push(b2);
  if (b1 && b1 !== b2 && b1 !== b3) out.push(b1);
  return out;
}

function parseUpstreamError(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { error?: string; message?: string };
    const msg = j.error ?? j.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    /* plain text */
  }
  return text.slice(0, 300) || `Request failed (${status})`;
}

async function proxyMarketingPath(
  apiPath: string,
  bodyText: string,
  contentType: string,
): Promise<Response> {
  const bases = upstreamBases();
  if (!bases.length) {
    return Response.json(
      {
        error:
          "API upstream is not configured (set API_UPSTREAM_BASE_3, API_UPSTREAM_BASE_2, and/or API_UPSTREAM_BASE on the web container).",
      },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  let lastStatus = 502;
  let lastBody = "";
  let lastFetchError: string | null = null;

  for (const base of bases) {
    let upstream: Response;
    try {
      upstream = await fetch(`${base}${apiPath}`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: bodyText,
        cache: "no-store",
      });
    } catch (e) {
      lastFetchError = e instanceof Error ? e.message : "Upstream request failed";
      continue;
    }

    const text = await upstream.text();
    if (upstream.ok) {
      const headers = new Headers(CORS_HEADERS);
      const ct = upstream.headers.get("content-type");
      if (ct) headers.set("content-type", ct);
      return new Response(text || JSON.stringify({ success: true }), {
        status: upstream.status,
        headers,
      });
    }

    lastStatus = upstream.status;
    lastBody = text;
    if (upstream.status !== 404) {
      return Response.json(
        { error: parseUpstreamError(text, upstream.status) },
        { status: upstream.status, headers: CORS_HEADERS },
      );
    }
  }

  if (lastFetchError) {
    return Response.json(
      {
        error: "Could not reach the marketing API. Please try again later.",
        detail: lastFetchError,
      },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  return Response.json(
    { error: parseUpstreamError(lastBody, lastStatus) },
    { status: lastStatus, headers: CORS_HEADERS },
  );
}

export function validateMarketingLeadBody(bodyRaw: string):
  | { ok: true; bodyText: string }
  | { ok: false; response: Response } {
  let json: unknown;
  try {
    json = JSON.parse(bodyRaw || "{}");
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS }),
    };
  }
  const parsed = marketingLeadBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return {
      ok: false,
      response: Response.json({ error: msg }, { status: 400, headers: CORS_HEADERS }),
    };
  }
  return { ok: true, bodyText: JSON.stringify(parsed.data) };
}

export function validateMarketingUnsubscribeBody(bodyRaw: string):
  | { ok: true; bodyText: string }
  | { ok: false; response: Response } {
  let json: unknown;
  try {
    json = JSON.parse(bodyRaw || "{}");
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS }),
    };
  }
  const parsed = marketingUnsubscribeBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return {
      ok: false,
      response: Response.json({ error: msg }, { status: 400, headers: CORS_HEADERS }),
    };
  }
  return { ok: true, bodyText: JSON.stringify(parsed.data) };
}

export async function submitMarketingLeadUpstream(
  bodyText: string,
  contentType: string,
): Promise<Response> {
  return proxyMarketingPath("/api/marketing/lead", bodyText, contentType);
}

export async function submitMarketingUnsubscribeUpstream(
  bodyText: string,
  contentType: string,
): Promise<Response> {
  return proxyMarketingPath("/api/marketing/unsubscribe", bodyText, contentType);
}
