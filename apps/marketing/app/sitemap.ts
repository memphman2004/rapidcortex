import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog/utils";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/** Bumped when the public route set changes (forces crawlers to re-fetch). */
const STABLE_LAST_MODIFIED = new Date("2026-08-11T00:00:00.000Z");

type RouteEntry = {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
};

/**
 * Public marketing routes indexed for SEO.
 * Excludes auth/portals (login, signup, rc-lite portal), enter gate, unsubscribe,
 * and interactive developer sandboxes.
 */
const PUBLIC_ROUTES: RouteEntry[] = [
  // Core
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.65 },
  { path: "/careers", changeFrequency: "weekly", priority: 0.7 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/security", changeFrequency: "monthly", priority: 0.7 },
  { path: "/trust", changeFrequency: "monthly", priority: 0.65 },
  { path: "/press", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact-sales", changeFrequency: "weekly", priority: 0.85 },
  { path: "/request-demo", changeFrequency: "weekly", priority: 0.75 },
  { path: "/demo", changeFrequency: "weekly", priority: 0.7 },
  { path: "/free-60-day-pilot", changeFrequency: "weekly", priority: 0.75 },

  // Product
  { path: "/product", changeFrequency: "weekly", priority: 0.95 },
  { path: "/product/core", changeFrequency: "weekly", priority: 0.95 },
  { path: "/product/campus", changeFrequency: "weekly", priority: 0.9 },
  { path: "/product/venue", changeFrequency: "weekly", priority: 0.9 },
  { path: "/venue", changeFrequency: "weekly", priority: 0.9 },
  { path: "/venue/how-it-works", changeFrequency: "monthly", priority: 0.7 },
  { path: "/rc-lite", changeFrequency: "weekly", priority: 0.75 },
  { path: "/desktop", changeFrequency: "monthly", priority: 0.55 },
  { path: "/downloads", changeFrequency: "monthly", priority: 0.45 },

  // Solutions & integrations
  { path: "/solutions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/solutions/agencies", changeFrequency: "weekly", priority: 0.75 },
  { path: "/solutions/vendors", changeFrequency: "weekly", priority: 0.75 },
  { path: "/integrations", changeFrequency: "weekly", priority: 0.75 },
  { path: "/integrations/ring-review", changeFrequency: "monthly", priority: 0.55 },
  { path: "/cad", changeFrequency: "weekly", priority: 0.7 },
  { path: "/cad-integration", changeFrequency: "weekly", priority: 0.7 },
  { path: "/supervisor-dashboard", changeFrequency: "monthly", priority: 0.55 },
  { path: "/connect/ring/start", changeFrequency: "weekly", priority: 0.7 },
  { path: "/connect/nest", changeFrequency: "weekly", priority: 0.7 },

  // SEO keyword landings
  { path: "/911-dispatch-software", changeFrequency: "monthly", priority: 0.7 },
  { path: "/911-call-transcription", changeFrequency: "monthly", priority: 0.7 },
  { path: "/ng911-software", changeFrequency: "monthly", priority: 0.7 },
  { path: "/psap-software", changeFrequency: "monthly", priority: 0.7 },
  { path: "/public-safety-intelligence", changeFrequency: "monthly", priority: 0.7 },
  { path: "/campus-safety-software", changeFrequency: "weekly", priority: 0.85 },
  { path: "/venue-safety-software", changeFrequency: "weekly", priority: 0.85 },
  { path: "/stadium-security-software", changeFrequency: "weekly", priority: 0.8 },
  { path: "/campus-safety-integrations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/venue-safety-integrations", changeFrequency: "weekly", priority: 0.8 },

  // Developers (public docs surface)
  { path: "/developers", changeFrequency: "weekly", priority: 0.7 },
  { path: "/developers/docs", changeFrequency: "weekly", priority: 0.65 },
  { path: "/developers/docs/errors", changeFrequency: "monthly", priority: 0.45 },
  { path: "/developers/api", changeFrequency: "weekly", priority: 0.65 },
  { path: "/developers/changelog", changeFrequency: "weekly", priority: 0.5 },
  { path: "/developers/pricing", changeFrequency: "monthly", priority: 0.55 },
  { path: "/developers/roi", changeFrequency: "monthly", priority: 0.5 },
  { path: "/developers/status", changeFrequency: "weekly", priority: 0.45 },

  // Legal / compliance (canonical privacy/terms — not /legal/* stubs)
  { path: "/legal/dpa", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.55 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.55 },
  { path: "/cookies", changeFrequency: "monthly", priority: 0.35 },
  { path: "/acceptable-use", changeFrequency: "monthly", priority: 0.35 },
  { path: "/sms-consent", changeFrequency: "monthly", priority: 0.4 },
];

/** Public marketing and legal routes (same-origin). */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: STABLE_LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = getPublishedPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.updatedAt ?? post.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
