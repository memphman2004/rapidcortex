import type { Metadata } from "next";
import { SITE_BRAND_MARK_PATH, SITE_DESCRIPTION, SITE_NAME } from "./site";

const DEFAULT_SITE_URL = "https://www.rapidcortex.us";

/**
 * Stable link-preview entry URL.
 * Production meta points at the marketing API rotator (302 → one of {@link OG_SHARE_ROTATION_PATHS}).
 * Local/static fallback file: `public/og-share.png`.
 */
export const SEO_IMAGE_PATH = "/og-share.png";

/** AppSam3 marketing HttpApi (same host as Inside-the-Cortex lead capture). */
const DEFAULT_OG_SHARE_API_URL =
  "https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/marketing/og-share";

/** Branded share assets (URL-safe copies under `public/Logo/share/`). */
export const OG_SHARE_ROTATION_PATHS = [
  "/Logo/share/alt3-rapid.png",
  "/Logo/share/911-marketing.png",
  "/Logo/share/flag-dispatch.png",
] as const;

export const OG_SHARE_IMAGE_WIDTH = 1200;
export const OG_SHARE_IMAGE_HEIGHT = 630;

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return DEFAULT_SITE_URL;
  }
  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

/** Absolute OG image URL used in meta tags (rotating API in shipped builds). */
export function getOgShareImageUrl(): string {
  const override = process.env.NEXT_PUBLIC_OG_SHARE_URL?.trim();
  if (override) {
    return override;
  }
  // Static export always bakes production meta; local `next dev` can opt into the file fallback.
  if (process.env.NEXT_PUBLIC_OG_SHARE_USE_STATIC === "1") {
    return absoluteUrl(SEO_IMAGE_PATH);
  }
  return DEFAULT_OG_SHARE_API_URL;
}

export function buildOgShareImage(alt = `${SITE_NAME} — branded link preview`) {
  return {
    url: getOgShareImageUrl(),
    width: OG_SHARE_IMAGE_WIDTH,
    height: OG_SHARE_IMAGE_HEIGHT,
    alt,
  };
}

export function buildPublicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = absoluteUrl(input.path);
  const image = buildOgShareImage();
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

export function buildOrganizationJsonLd() {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url,
    logo: absoluteUrl(SITE_BRAND_MARK_PATH),
    description: SITE_DESCRIPTION,
  };
}

export function buildWebsiteJsonLd() {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
