/** AWS Lambda Function URL (payload 2.0) helpers — no Express. */

export type LambdaHttpEvent = {
  version?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
      sourceIp?: string;
    };
  };
};

export type LambdaHttpResult = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
};

export function getMethod(event: LambdaHttpEvent): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

export function getPath(event: LambdaHttpEvent): string {
  const p = event.rawPath || event.requestContext?.http?.path || "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function getHeader(event: LambdaHttpEvent, name: string): string | undefined {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (k.toLowerCase() === want && typeof v === "string") return v;
  }
  return undefined;
}

export function getQuery(event: LambdaHttpEvent): URLSearchParams {
  return new URLSearchParams(event.rawQueryString ?? "");
}

export function readBodyText(event: LambdaHttpEvent): string {
  if (event.body == null || event.body === "") return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

export function parseBody(event: LambdaHttpEvent): unknown {
  const text = readBodyText(event);
  if (!text) return undefined;
  const ct = (getHeader(event, "content-type") ?? "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function jsonResult(statusCode: number, body: unknown, extraHeaders?: Record<string, string>): LambdaHttpResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function redirectResult(location: string): LambdaHttpResult {
  return {
    statusCode: 302,
    headers: { location },
    body: "",
  };
}

export function toWebRequest(event: LambdaHttpEvent, publicBaseUrl: string): Request {
  const path = event.rawPath || getPath(event);
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `${publicBaseUrl.replace(/\/$/, "")}${path}${qs}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (typeof v === "string") headers.set(k, v);
  }
  const method = getMethod(event);
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD" && event.body) {
    init.body = readBodyText(event);
  }
  return new Request(url, init);
}

export async function fromWebResponse(response: Response): Promise<LambdaHttpResult> {
  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    // Function URL / API GW dislike hop-by-hop headers
    if (["transfer-encoding", "connection"].includes(k.toLowerCase())) return;
    headers[k] = v;
  });
  const buf = Buffer.from(await response.arrayBuffer());
  const contentType = headers["content-type"] ?? "";
  const isBinary = !contentType.includes("json") && !contentType.includes("text") && !contentType.includes("javascript");
  if (isBinary && buf.length > 0) {
    return {
      statusCode: response.status,
      headers,
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  }
  return {
    statusCode: response.status,
    headers,
    body: buf.toString("utf8"),
  };
}
