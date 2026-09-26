/**
 * NexCort iQ — Help Article Fetcher
 *
 * Fetches markdown from CloudFront/S3 or local `/public/help/` at runtime.
 * Articles: {NEXT_PUBLIC_HELP_CDN_BASE}/{role}/{topic}.md
 */

import { normalizeHelpRole } from "./help-content";

const HELP_CDN_BASE =
  process.env.NEXT_PUBLIC_HELP_CDN_BASE?.replace(/\/$/, "") ?? "/help";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

/** Markdown → HTML for staff guide and in-app Help (no external deps). */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (!listType) return;
    out.push(listType === "ul" ? "</ul>" : "</ol>");
    listType = null;
  };

  const openList = (next: "ul" | "ol") => {
    if (listType === next) return;
    closeList();
    out.push(next === "ul" ? "<ul>" : "<ol>");
    listType = next;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      openList("ul");
      out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (numbered) {
      openList("ol");
      out.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      continue;
    }
    closeList();
    if (/^---+$/.test(line.trim())) {
      out.push("<hr />");
      continue;
    }
    const quote = /^>\s+(.+)$/.exec(line);
    if (quote) {
      out.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

export interface HelpArticleContent {
  html: string;
  raw: string;
}

/**
 * Fetches a help article for a given role and topic.
 * Returns null if the article doesn't exist or the fetch fails.
 */
export async function fetchHelpArticle(
  role: string,
  topic: string,
): Promise<HelpArticleContent | null> {
  const normalizedRole = normalizeHelpRole(role);
  const url = `${HELP_CDN_BASE}/${normalizedRole}/${topic}.md`;

  try {
    const res = await fetch(url, {
      headers: { "Cache-Control": "max-age=60" },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const raw = await res.text();
    return { raw, html: markdownToHtml(raw) };
  } catch {
    return null;
  }
}
