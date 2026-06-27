import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog/utils";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

const STABLE_LAST_MODIFIED = new Date("2026-04-27T00:00:00.000Z");

/** Public marketing and legal routes (same-origin). */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly";
    priority: number;
    lastModified?: string | Date;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
    { path: "/product", changeFrequency: "weekly", priority: 0.95 },
    { path: "/product/core", changeFrequency: "weekly", priority: 0.95 },
    { path: "/product/campus", changeFrequency: "weekly", priority: 0.9 },
    { path: "/product/venue", changeFrequency: "weekly", priority: 0.9 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/security", changeFrequency: "monthly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.65 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
    { path: "/request-demo", changeFrequency: "weekly", priority: 0.75 },
    { path: "/legal/privacy", changeFrequency: "monthly", priority: 0.4 },
    { path: "/legal/terms", changeFrequency: "monthly", priority: 0.4 },
    { path: "/legal/dpa", changeFrequency: "monthly", priority: 0.4 },
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.lastModified ?? STABLE_LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = getPublishedPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.updatedAt ?? post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
