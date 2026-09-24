import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml } from "@/lib/help/fetch-help-article";
import { flattenStaffGuideArticles, type StaffGuideVertical } from "./catalog";

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), "../../public/staff-guide");

/** HTML for every catalog article in this vertical. Missing files are omitted. */
export function loadStaffGuideArticles(vertical: StaffGuideVertical): Record<string, string> {
  const html: Record<string, string> = {};
  for (const article of flattenStaffGuideArticles(vertical)) {
    const rel = article.shared
      ? join(publicRoot, "shared", `${article.topic}.md`)
      : join(publicRoot, vertical, `${article.topic}.md`);
    try {
      const raw = readFileSync(rel, "utf8").trim();
      if (raw) html[article.topic] = markdownToHtml(raw);
    } catch {
      // Portal shows the empty state for this topic.
    }
  }
  return html;
}
