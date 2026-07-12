/**
 * Rapid Cortex — Help Article Fetcher
 *
 * Fetches markdown from CloudFront/S3 or local `/public/help/` at runtime.
 * Articles: {NEXT_PUBLIC_HELP_CDN_BASE}/{role}/{topic}.md
 */

import { normalizeHelpRole } from "./help-content";

const HELP_CDN_BASE =
  process.env.NEXT_PUBLIC_HELP_CDN_BASE?.replace(/\/$/, "") ?? "/help";

/** Minimum viable markdown → HTML converter (no external deps). */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^[\-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr />")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|li|hr|blockquote)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");
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
      headers: { "Cache-Control": "max-age=300" },
      cache: "force-cache",
    });

    if (!res.ok) return null;

    const raw = await res.text();
    return { raw, html: markdownToHtml(raw) };
  } catch {
    return null;
  }
}
