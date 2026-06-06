import type { RcLiteApiScope } from "./scopes.js";

export type HttpMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

export type RcLiteV1RouteDef = {
  /** Path after `/api/v1/` without leading slash. */
  path: string;
  methods: readonly HttpMethod[];
  scope: RcLiteApiScope;
  productModule: string;
  /**
   * When true, POST/PUT/PATCH/DELETE callers must supply `Idempotency-Key` (handled in edge handler).
   * GET ignores this flag.
   */
  requiresIdempotencyKey?: boolean;
};

/**
 * Canonical route table for RC Lite v1 — handlers may return 501 until wired to upstream services.
 * Keep synchronized with OpenAPI (`apps/web/public/openapi/rc-lite-v1.openapi.yaml`).
 */
export const RC_LITE_V1_ROUTES: readonly RcLiteV1RouteDef[] = [
  {
    path: "intelligence/analyze-incident",
    methods: ["POST"],
    scope: "intelligence:write",
    productModule: "incident_intelligence",
    requiresIdempotencyKey: true,
  },
  {
    path: "intelligence/classify-call",
    methods: ["POST"],
    scope: "intelligence:write",
    productModule: "incident_intelligence",
    requiresIdempotencyKey: true,
  },
  {
    path: "intelligence/risk-score",
    methods: ["POST"],
    scope: "intelligence:write",
    productModule: "incident_intelligence",
    requiresIdempotencyKey: true,
  },
  {
    path: "intelligence/recommended-actions",
    methods: ["POST"],
    scope: "intelligence:write",
    productModule: "incident_intelligence",
    requiresIdempotencyKey: true,
  },
  { path: "cad/export", methods: ["POST"], scope: "cad:write", productModule: "cad_export", requiresIdempotencyKey: true },
  { path: "cad/events", methods: ["POST"], scope: "cad:write", productModule: "cad_export", requiresIdempotencyKey: true },
  { path: "cad/manual-review", methods: ["POST"], scope: "cad:write", productModule: "cad_export", requiresIdempotencyKey: true },
  { path: "cad/export/:id/status", methods: ["GET"], scope: "cad:write", productModule: "cad_export" },
  {
    path: "transcription/jobs",
    methods: ["POST"],
    scope: "transcription:write",
    productModule: "transcription",
    requiresIdempotencyKey: true,
  },
  { path: "transcription/jobs/:id", methods: ["GET"], scope: "transcription:write", productModule: "transcription" },
  {
    path: "transcription/realtime-token",
    methods: ["POST"],
    scope: "transcription:write",
    productModule: "transcription",
    requiresIdempotencyKey: true,
  },
  {
    path: "translation/text",
    methods: ["POST"],
    scope: "translation:write",
    productModule: "translation",
    requiresIdempotencyKey: true,
  },
  {
    path: "translation/audio",
    methods: ["POST"],
    scope: "translation:write",
    productModule: "translation",
    requiresIdempotencyKey: true,
  },
  {
    path: "translation/realtime-token",
    methods: ["POST"],
    scope: "translation:write",
    productModule: "translation",
    requiresIdempotencyKey: true,
  },
  {
    path: "caller-links",
    methods: ["POST"],
    scope: "caller_links:write",
    productModule: "caller_links",
    requiresIdempotencyKey: true,
  },
  { path: "caller-links/:id", methods: ["GET"], scope: "caller_links:write", productModule: "caller_links" },
  {
    path: "media/upload-url",
    methods: ["POST"],
    scope: "media:write",
    productModule: "caller_media",
    requiresIdempotencyKey: true,
  },
  {
    path: "media/session",
    methods: ["POST"],
    scope: "media:write",
    productModule: "caller_media",
    requiresIdempotencyKey: true,
  },
  { path: "media/session/:id", methods: ["GET"], scope: "media:write", productModule: "caller_media" },
  {
    path: "qa/analyze-call",
    methods: ["POST"],
    scope: "qa:write",
    productModule: "qa_analysis",
    requiresIdempotencyKey: true,
  },
  {
    path: "qa/policy-flags",
    methods: ["POST"],
    scope: "qa:write",
    productModule: "qa_analysis",
    requiresIdempotencyKey: true,
  },
  {
    path: "qa/training-summary",
    methods: ["POST"],
    scope: "qa:write",
    productModule: "qa_analysis",
    requiresIdempotencyKey: true,
  },
  {
    path: "webhooks/endpoints",
    methods: ["POST", "GET"],
    scope: "webhooks:manage",
    productModule: "webhooks",
    requiresIdempotencyKey: true,
  },
  { path: "webhooks/endpoints/:id", methods: ["DELETE"], scope: "webhooks:manage", productModule: "webhooks" },
] as const;

/** Segment-equality match (`:id` matches any segment). */
export function resolveRcLiteRoute(pathnameSegments: string[], method: HttpMethod): RcLiteV1RouteDef | null {
  for (const def of RC_LITE_V1_ROUTES) {
    if (!def.methods.includes(method)) continue;
    const pattern = def.path.split("/").filter(Boolean);
    if (pattern.length !== pathnameSegments.length) continue;
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i];
      const seg = pathnameSegments[i];
      if (!p.startsWith(":") && p !== seg) {
        ok = false;
        break;
      }
    }
    if (ok) return def;
  }
  return null;
}

export function rcLiteRouteNeedsIdempotentHeader(def: RcLiteV1RouteDef, method: HttpMethod): boolean {
  if (!def.requiresIdempotencyKey) return false;
  if (method === "GET") return false;
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}
