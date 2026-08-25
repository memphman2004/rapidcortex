/**
 * Join API Gateway origin + path without doubling `/api`.
 *
 * `API_UPSTREAM_BASE` is sometimes `https://host` and sometimes `https://host/api`.
 * The cookie BFF is mounted at `/api/backend`, and clients append `/api/agencies`,
 * so the browser URL looks like `/api/backend/api/agencies`. The proxy must strip
 * the BFF prefix and never concatenate another `/api` onto a base that already has it.
 */

export function normalizeUpstreamApiBase(base: string): string {
  return base.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
}

export function normalizeUpstreamApiPath(rawPath: string): string {
  let path = rawPath.trim();
  if (!path.startsWith("/")) path = `/${path}`;

  if (path === "/api/backend" || path.startsWith("/api/backend/")) {
    path = path.slice("/api/backend".length) || "/";
  }

  while (path.startsWith("/api/api")) {
    path = `/api${path.slice("/api/api".length)}`;
  }
  if (path === "/api/api") path = "/api";

  if (path === "/" || path === "") {
    return "/api";
  }
  if (!path.startsWith("/api/") && path !== "/api") {
    path = `/api${path}`;
  }
  return path;
}

export function joinUpstreamApiUrl(base: string, path: string): URL {
  return new URL(`${normalizeUpstreamApiBase(base)}${normalizeUpstreamApiPath(path)}`);
}
