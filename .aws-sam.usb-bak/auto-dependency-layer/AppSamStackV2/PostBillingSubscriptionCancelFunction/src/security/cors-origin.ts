/**
 * Lambda-side CORS helpers aligned with API Gateway `HttpApiCorsAllowedOrigins` / `APPROVED_CORS_ORIGINS`.
 * Production stacks should list explicit origins (wildcard `*` is blocked for pilot/prod/staging in SAM rules).
 */

const LOCAL_DEV_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function parseList(): Set<string> {
  const raw = process.env.APPROVED_CORS_ORIGINS?.trim() ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const p = part.trim();
    if (p) set.add(normalizeOrigin(p).toLowerCase());
  }
  return set;
}

function isDevLike(): boolean {
  const s = (process.env.DEPLOYMENT_STAGE ?? "dev").toLowerCase();
  return s === "dev" || s === "local" || process.env.AWS_SAM_LOCAL === "true";
}

/**
 * Whether a browser `Origin` header may receive `Access-Control-Allow-Origin` echo.
 * Does not grant API auth — only CORS reflection for credentialed browser calls.
 */
export function isApprovedOrigin(origin: string | undefined): boolean {
  if (!origin?.trim()) return false;
  const o = normalizeOrigin(origin).toLowerCase();

  const allowed = parseList();
  if (allowed.has("*") && isDevLike()) return true;
  if (allowed.has(o)) return true;

  if (isDevLike() && LOCAL_DEV_ORIGINS.has(o)) return true;
  return false;
}

/** Build CORS headers for a successful preflight or JSON response (no wildcard in prod). */
export function buildApiGatewayCorsHeaders(
  requestOrigin: string | undefined,
  opts?: { allowCredentials?: boolean },
): Record<string, string> {
  if (!isApprovedOrigin(requestOrigin)) {
    return {};
  }
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": normalizeOrigin(requestOrigin!),
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization,content-type,x-csrf-token",
  };
  if (opts?.allowCredentials) {
    h["Access-Control-Allow-Credentials"] = "true";
  }
  return h;
}
