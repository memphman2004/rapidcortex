import { markdownToHtml, type HelpArticleContent } from "@/lib/help/fetch-help-article";
import { findStaffGuideArticle, type StaffGuideVertical } from "./catalog";

const STAFF_GUIDE_BASE =
  process.env.NEXT_PUBLIC_STAFF_GUIDE_CDN_BASE?.replace(/\/$/, "") ?? "/staff-guide";

async function fetchMarkdown(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "Cache-Control": "max-age=60" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = await res.text();
    return raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Load a Staff Guide article. Shared field-tool topics fall back to /staff-guide/shared/.
 * No view quota — callers may fetch as often as needed.
 */
export async function fetchStaffGuideArticle(
  vertical: StaffGuideVertical,
  topic: string,
): Promise<HelpArticleContent | null> {
  const article = findStaffGuideArticle(vertical, topic);
  const urls = article?.shared
    ? [`${STAFF_GUIDE_BASE}/shared/${topic}.md`]
    : [`${STAFF_GUIDE_BASE}/${vertical}/${topic}.md`, `${STAFF_GUIDE_BASE}/shared/${topic}.md`];

  for (const url of urls) {
    const raw = await fetchMarkdown(url);
    if (raw) return { raw, html: markdownToHtml(raw) };
  }
  return null;
}
