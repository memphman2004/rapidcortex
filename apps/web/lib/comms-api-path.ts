/**
 * Routes served by the optional second SAM stack (stack-app-sam-2 / template2.yaml).
 * When `NEXT_PUBLIC_API_BASE_2` / `API_UPSTREAM_BASE_2` are unset, all traffic uses stack 1 only.
 */

const STACK2_PATH_TESTS: RegExp[] = [
  /^\/api\/v1(\/|$)/,
  /^\/api\/wellness\//,
  /^\/api\/supervisor\//,
  /^\/api\/dispatcher\//,
  /^\/api\/admin\/analytics/,
  /^\/api\/admin\/notices(\/|$)/,
  /^\/api\/notices(\/|$)/,
  /^\/api\/audit\/events(\/|$)/,
  /^\/api\/demo\//,
  /^\/api\/integration\//,
  /^\/api\/call-intelligence\//,
  /^\/api\/media\/live\//,
  /^\/api\/agency-admin\//,
  /^\/api\/rc-admin\//,
  /^\/api\/superadmin\//,
  /^\/api\/admin\/desktop-releases/,
  /^\/api\/admin\/cad-writeback-approvals/,
  /^\/api\/cad\/writeback\//,
  /^\/api\/platform\//,
  /^\/api\/video-assist\/t\//,
  /^\/api\/silent-text\/t\//,
  /^\/api\/incidents\/[^/]+\/language-session/,
  /^\/api\/incidents\/[^/]+\/caller-card/,
  /^\/api\/incidents\/[^/]+\/premise-notes/,
  /^\/api\/incidents\/[^/]+\/live-video/,
  /^\/api\/incidents\/[^/]+\/video-assist/,
  /^\/api\/incidents\/[^/]+\/silent-text/,
  /^\/api\/incidents\/[^/]+\/pinpoint\//,
  /^\/api\/incidents\/[^/]+\/surge\//,
  /^\/api\/pinpoint\/t\//,
  /^\/api\/agencies\/[^/]+\/share-partners/,
];

export function isCommsPlatformApiPath(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  return STACK2_PATH_TESTS.some((re) => re.test(p));
}

/** Server-side BFF / Route Handlers: pick stack 2 upstream when `API_UPSTREAM_BASE_2` is set. */
export function resolveUpstreamApiBase(path: string): string {
  const b1 = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "") ?? "";
  const b2 = process.env.API_UPSTREAM_BASE_2?.replace(/\/$/, "") ?? "";
  if (isCommsPlatformApiPath(path)) {
    // Comms / call-intelligence Lambdas are deployed on stack 2 only — do not proxy to stack 1.
    return b2;
  }
  return b1;
}
