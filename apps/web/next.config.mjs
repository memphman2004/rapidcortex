import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tracingRoot = path.join(__dirname, "..", "..");

function normalizeHttpOrigin(origin) {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/** Same apex / www expansion as `lib/http-origin-allowlist.ts` — inlined so config loads as plain ESM. */
function expandCanonicalHttpOrigins(raw) {
  let url;
  try {
    const trimmed = raw.trim();
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return [normalizeHttpOrigin(raw)].filter(Boolean);
  }
  const host = url.hostname.toLowerCase();
  const out = new Set([normalizeHttpOrigin(url.origin)]);
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return [...out];
  }
  if (host.startsWith("www.")) {
    const apex = host.slice(4);
    if (apex) {
      try {
        out.add(normalizeHttpOrigin(new URL(`${url.protocol}//${apex}`).origin));
      } catch {
        /* ignore */
      }
    }
  } else {
    try {
      out.add(normalizeHttpOrigin(new URL(`${url.protocol}//www.${host}`).origin));
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

const DEFAULT_SITE_URL = "https://www.rapidcortex.us";
function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function normalizeOrigins(value) {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const PRODUCTION_CONNECT_FALLBACK_SITES = ["https://rapidcortex.us"];
// Fallback must match live HttpApi endpoint (see `aws apigatewayv2 get-apis`; rapid-cortex-dev).
const PRODUCTION_CONNECT_FALLBACK_APIS = [
  "https://cv1z1us095.execute-api.us-east-1.amazonaws.com",
  "https://xatbi3w5f5.execute-api.us-east-1.amazonaws.com",
];

/** Third‑party embeds used on `/contact-sales` and similar pages (iframes + loader scripts). */
const FORM_EMBED_SCRIPT_HOSTS =
  "https://tally.so https://*.tally.so https://*.hubspot.com https://*.hsforms.com https://*.hs-scripts.com https://*.typeform.com https://*.calendly.com https://assets.calendly.com";

const YOUTUBE_EMBED_FRAME_SRC = [
  "https://www.youtube.com",
  "https://youtube.com",
  "https://www.youtube-nocookie.com",
  "https://youtube-nocookie.com",
];

const YOUTUBE_CONNECT_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://youtube-nocookie.com",
  "https://www.youtube.com",
  "https://youtube.com",
  "https://i.ytimg.com",
  "https://img.youtube.com",
];

const FORM_EMBED_FRAME_SRC = [
  "'self'",
  ...YOUTUBE_EMBED_FRAME_SRC,
  "https://tally.so",
  "https://*.tally.so",
  "https://*.hubspot.com",
  "https://*.hsforms.com",
  "https://*.typeform.com",
  "https://embed.typeform.com",
  "https://*.calendly.com",
  "https://assets.calendly.com",
].join(" ");

/** Hosts loaders may POST/GET besides existing allowlisted origins. */
const FORM_EMBED_CONNECT_HOSTS = [
  "https://tally.so",
  "https://*.tally.so",
  "https://*.hubspot.com",
  "https://*.hsforms.com",
  "https://*.hs-scripts.com",
  "https://*.typeform.com",
  "https://*.calendly.com",
  "https://assets.calendly.com",
];

function collectConnectOrigins() {
  const out = new Set();
  const add = (raw) => {
    const s = raw?.trim();
    if (!s) return;
    for (const o of expandCanonicalHttpOrigins(s)) out.add(o);
  };
  const addHttpsOriginLiteral = (raw) => {
    try {
      out.add(new URL(raw.trim()).origin.toLowerCase());
    } catch {
      /* skip */
    }
  };
  for (const chunk of normalizeOrigins(process.env.APP_ALLOWED_ORIGINS)) add(chunk);
  add(process.env.NEXT_PUBLIC_SITE_URL);
  add(process.env.API_UPSTREAM_BASE);
  const vercelHost = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  if (vercelHost) add(`https://${vercelHost}`);
  if (out.size === 0) {
    try {
      add(getSiteUrl());
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV === "production") {
    for (const site of PRODUCTION_CONNECT_FALLBACK_SITES) add(site);
    for (const api of PRODUCTION_CONNECT_FALLBACK_APIS) addHttpsOriginLiteral(api);
  }
  return [...out];
}

function buildCspHeader(extraConnectOrigins) {
  const connectSrc = [
    "'self'",
    "blob:",
    ...extraConnectOrigins,
    ...FORM_EMBED_CONNECT_HOSTS,
    ...YOUTUBE_CONNECT_HOSTS,
    ...(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()
      ? ["https://api.mapbox.com", "https://events.mapbox.com"]
      : []),
  ].join(" ");
  // Next injects inline boot/RSC payloads; without per-request script nonces production CSP blocks those scripts and hydration fails (broken sign-in UX).
  // TODO: switch to nonce + `strict-dynamic` and drop `'unsafe-inline'`.
  const scriptSrc = [
    process.env.NODE_ENV === "production"
      ? "'self' 'wasm-unsafe-eval' 'unsafe-inline'"
      : "'self' 'unsafe-eval' 'unsafe-inline'",
    FORM_EMBED_SCRIPT_HOSTS,
  ]
    .filter(Boolean)
    .join(" ");

  const imgSrcExtras =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ? " https://api.mapbox.com" : "";
  const imgSrc =
    process.env.NODE_ENV === "production"
      ? `'self' blob: data: https://rapidcortex.us https://www.rapidcortex.us https://img.youtube.com https://i.ytimg.com${imgSrcExtras}`
      : `'self' data: blob: https:${imgSrcExtras}`;

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "media-src 'self' https://www.youtube-nocookie.com https://youtube-nocookie.com https://www.youtube.com blob:",
    `connect-src ${connectSrc}`,
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    `frame-src ${FORM_EMBED_FRAME_SRC}`,
    "report-uri /api/csp-report",
  ];
  return directives.join("; ");
}

function shouldUseEnforcingCspHeader() {
  const v = process.env.NEXT_PUBLIC_CSP_ENFORCE?.trim().toLowerCase();
  if (process.env.NODE_ENV === "production") {
    if (v === "0" || v === "false" || v === "report-only") return false;
    return true;
  }
  return v === "1" || v === "true";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: tracingRoot,
  async redirects() {
    return [
      { source: "/intelligence-api", destination: "/rc-lite", permanent: true },
      { source: "/api", destination: "/developers/api", permanent: false },
      { source: "/book-demo", destination: "/contact-sales?interest=demo", permanent: false },
      // Legacy RBAC route naming — preserve deep links during Cognito/UI migration (see docs).
      { source: "/superadmin", destination: "/rc-admin", permanent: false },
      { source: "/superadmin/:path*", destination: "/rc-admin/:path*", permanent: false },
      { source: "/platform-superadmin", destination: "/rc-admin", permanent: false },
      { source: "/platform-superadmin/:path*", destination: "/rc-admin/:path*", permanent: false },
      { source: "/platform-admin", destination: "/rc-admin", permanent: false },
      { source: "/platform-admin/:path*", destination: "/rc-admin/:path*", permanent: false },
      // Common mistaken slug (example-city-dashboard vs example-city/dashboard).
      { source: "/example-city-dashboard", destination: "/example-city/dashboard", permanent: true },
      {
        source: "/example-city-dashboard/:path*",
        destination: "/example-city/dashboard/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      // Flat alias for aggregated readiness (same handler as `/api/health/chain`); avoids rare CDN/proxy confusion on nested paths.
      { source: "/api/health-chain", destination: "/api/health/chain" },
      // Product vertical routes — auth/middleware use `/app/venue/*`; pages live under `/venue/*`.
      { source: "/app/venue", destination: "/venue" },
      { source: "/app/venue/:path*", destination: "/venue/:path*" },
    ];
  },
  env: {
    DISABLE_MOBILE_AUTH: process.env.DISABLE_MOBILE_AUTH ?? "",
    BLOCK_TABLET_AUTH: process.env.BLOCK_TABLET_AUTH ?? "",
    NEXT_PUBLIC_DISABLE_MOBILE_AUTH: process.env.NEXT_PUBLIC_DISABLE_MOBILE_AUTH ?? "",
  },
  transpilePackages: [
    "rapid-cortex-maps",
    "rapid-cortex-shared",
    "rapid-cortex-protocols",
    "rapid-cortex-integrations",
    "rapid-cortex-security",
  ],
  async headers() {
    const csp = buildCspHeader(collectConnectOrigins());
    const strictTransportSecurity =
      process.env.NODE_ENV === "production"
        ? { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }
        : null;
    const cspEnforce = shouldUseEnforcingCspHeader();
    const ppDefault = "geolocation=(), microphone=(), camera=()";
    const ppPinpoint = "geolocation=(self), microphone=(), camera=()";
    const buildBlock = (permissionsPolicy) => {
      const baseHeaders = [
        cspEnforce
          ? { key: "Content-Security-Policy", value: csp }
          : {
              key: "Content-Security-Policy-Report-Only",
              value: csp,
            },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: permissionsPolicy },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ];
      if (strictTransportSecurity) baseHeaders.push(strictTransportSecurity);
      return baseHeaders;
    };
    return [
      { source: "/pinpoint/:path*", headers: buildBlock(ppPinpoint) },
      { source: "/:path*", headers: buildBlock(ppDefault) },
    ];
  },
};

export default nextConfig;
