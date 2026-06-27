export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "callout"; tone: "note" | "caution"; label?: string; text: string };

export interface BlogAuthor {
  name: string;
  role: string;
}

export interface BlogPostCta {
  eyebrow?: string;
  text: string;
  buttonLabel: string;
  href: string;
}

export interface BlogPost {
  /** URL segment: /blog/[slug] */
  slug: string;
  title: string;
  /** Meta description + card preview. Keep under ~160 characters. */
  description: string;
  category: string;
  tags: string[];
  author: BlogAuthor;
  /** ISO date, e.g. "2026-01-12" */
  publishedAt: string;
  /** ISO date — set when meaningfully revised */
  updatedAt?: string;
  readingTimeMinutes: number;
  content: ContentBlock[];
  /** Falls back to a generic "Schedule a Demo" CTA if omitted. */
  cta?: BlogPostCta;
}
