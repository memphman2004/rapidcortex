import type { Metadata } from "next";
import { SITE_BRAND_MARK_PATH, SITE_DESCRIPTION, SITE_NAME } from "./site";

const DEFAULT_SITE_URL = "https://www.rapidcortex.us";
/** Static OG image — no `/api/og` on the marketing export host. */
export const SEO_IMAGE_PATH = SITE_BRAND_MARK_PATH;

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

export function buildPublicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = absoluteUrl(input.path);
  const imageUrl = absoluteUrl(SEO_IMAGE_PATH);
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
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — branded link preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [{ url: imageUrl, alt: `${SITE_NAME} preview` }],
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
