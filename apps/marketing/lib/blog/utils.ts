import { posts } from "./posts";
import type { BlogPost } from "./types";

/** ISO date string for posts that are live on the marketing site (release calendar). */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPostPublished(post: BlogPost, asOf = todayIsoDate()): boolean {
  return post.publishedAt <= asOf;
}

export function getAllPosts(): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

/** Posts whose release date has arrived — used for blog index, RSS, and static routes. */
export function getPublishedPosts(asOf = todayIsoDate()): BlogPost[] {
  return getAllPosts().filter((post) => isPostPublished(post, asOf));
}

export function getAllSlugs(): string[] {
  return getPublishedPosts().map((post) => post.slug);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug && isPostPublished(post));
}

export function getRelatedPosts(current: BlogPost, limit = 3): BlogPost[] {
  return getPublishedPosts()
    .filter((post) => post.slug !== current.slug)
    .filter(
      (post) =>
        post.category === current.category ||
        post.tags.some((tag) => current.tags.includes(tag)),
    )
    .slice(0, limit);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Compact console-style date stamp, e.g. "2026.01.12" — used in meta rows. */
export function formatDateCompact(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}
