/**
 * Routes served by optional secondary/tertiary SAM stacks.
 * When upstream env vars are unset, traffic falls back to stack 1 only.
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
  /^\/api\/admin\/cad-writeback-approvals/,
  /^\/api\/cad\/writeback\//,
  /^\/api\/incidents\/[^/]+\/language-session/,
  /^\/api\/incidents\/[^/]+\/caller-card/,
  /^\/api\/incidents\/[^/]+\/premise-notes/,
  /^\/api\/incidents\/[^/]+\/pinpoint\//,
  /^\/api\/incidents\/[^/]+\/surge\//,
];

/** Billing, payments, Ring Connect, network policy — stack-app-sam-4 (AppSam4Stack). */
const STACK4_PATH_TESTS: RegExp[] = [
  /^\/api\/billing\//,
  /^\/api\/agencies\/[^/]+\/billing/,
  /^\/api\/integrations\/ring\//,
  /^\/api\/admin\/invoices/,
  /^\/api\/agency\/entitlements/,
  /^\/api\/agency\/network-policy/,
  /^\/api\/agency\/emergency-override/,
  /^\/api\/admin\/tenants\/[^/]+\/entitlements/,
  /^\/api\/admin\/tenants\/[^/]+\/invoice/,
  /^\/api\/admin\/agencies\/[^/]+\/network-policy/,
];

/** Campus, venue, media, stream, live video — stack-app-sam-5 (AppSam5Stack). */
const STACK5_PATH_TESTS: RegExp[] = [
  /^\/api\/campus\//,
  /^\/api\/venue\//,
  /^\/api\/incidents\/[^/]+\/media/,
  /^\/api\/incidents\/[^/]+\/live-video/,
  /^\/api\/incidents\/[^/]+\/silent-text/,
  /^\/api\/incidents\/[^/]+\/pinpoint\//,
  /^\/api\/incidents\/[^/]+\/venue-intelligence/,
  /^\/api\/media\//,
  /^\/api\/silent-text\//,
  /^\/api\/pinpoint\//,
  /^\/api\/stream\//,
  /^\/api\/public\/incident-media\//,
  /^\/api\/public\/campus\//,
];

/** Media, agency-admin, RC-admin, platform — stack-app-sam-3 (AppSam3Stack). */
const STACK3_PATH_TESTS: RegExp[] = [
  /^\/api\/contact-sales(\/|$)/,
  /^\/api\/agency-admin\//,
  /^\/api\/rc-admin\//,
  /^\/api\/superadmin\//,
  /^\/api\/admin\/desktop-releases/,
  /^\/api\/platform\//,
  /^\/api\/video-assist\//,
  /^\/api\/incidents\/[^/]+\/video-assist/,
  /^\/api\/agencies\/[^/]+\/share-partners/,
];

export function isSam4ApiPath(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  return STACK4_PATH_TESTS.some((re) => re.test(p));
}

export function isSam5ApiPath(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  return STACK5_PATH_TESTS.some((re) => re.test(p));
}

export function isSam3ApiPath(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  return STACK3_PATH_TESTS.some((re) => re.test(p));
}

export function isStack2ApiPath(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  return STACK2_PATH_TESTS.some((re) => re.test(p));
}

/** True when the path is not served by the primary SAM stack (stack 1). */
export function isCommsPlatformApiPath(path: string): boolean {
  return isSam4ApiPath(path) || isSam5ApiPath(path) || isSam3ApiPath(path) || isStack2ApiPath(path);
}

/** Server-side BFF / Route Handlers: pick the correct upstream base. */
export function resolveUpstreamApiBase(path: string): string {
  const b1 = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "") ?? "";
  const b2 = process.env.API_UPSTREAM_BASE_2?.replace(/\/$/, "") ?? "";
  const b3 = process.env.API_UPSTREAM_BASE_3?.replace(/\/$/, "") ?? "";
  const b4 = process.env.API_UPSTREAM_BASE_4?.replace(/\/$/, "") ?? "";
  const b5 = process.env.API_UPSTREAM_BASE_5?.replace(/\/$/, "") ?? "";
  if (isSam4ApiPath(path)) {
    return b4;
  }
  if (isSam5ApiPath(path)) {
    return b5;
  }
  if (isSam3ApiPath(path)) {
    return b3;
  }
  if (isStack2ApiPath(path)) {
    return b2;
  }
  return b1;
}
