import type { NextRequest } from "next/server";

/**
 * Best-effort RSC / prefetch detection for `nextOrRedirect()`.
 *
 * **Next.js 16.2+** (`node_modules/next/dist/server/web/adapter.js`): internal Flight
 * headers (`rsc`, `next-router-state-tree`, `next-router-prefetch`, …) are removed from
 * `request.headers` before middleware runs. Do not rely on those headers here.
 *
 * Signals that may still be visible on the middleware `NextRequest`:
 * - `_rsc` query param (when not normalized away)
 * - `Accept: text/x-component`
 * - `Purpose: prefetch` (browser prefetch)
 *
 * Post-login dashboard flash-crash is mitigated primarily by `hardNavigateTo()` after auth,
 * not by skipping redirects in middleware.
 */
export function isNextFlightOrPrefetchRequest(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.has("_rsc")) return true;

  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/x-component")) return true;

  if (request.headers.get("Purpose") === "prefetch") return true;

  if (process.env.RC_LOG_MIDDLEWARE_RSC === "1") {
    console.log(
      JSON.stringify({
        msg: "middleware_rsc_probe",
        path: request.nextUrl.pathname,
        hasRscQuery: request.nextUrl.searchParams.has("_rsc"),
        accept,
        purpose: request.headers.get("Purpose"),
        // Stripped on Next 16 — logged only when explicitly enabled for staging diagnosis:
        rscHeader: request.headers.get("rsc"),
        nextRouterStateTree: request.headers.get("next-router-state-tree"),
        nextRouterPrefetch: request.headers.get("next-router-prefetch"),
      }),
    );
  }

  return false;
}
