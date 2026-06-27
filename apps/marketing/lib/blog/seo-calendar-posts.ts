import { calendarEntries } from "./calendar-entries";
import { buildSeoPost } from "./build-seo-post";
import { seoPostContent } from "./seo-post-content";

export const seoCalendarPosts = calendarEntries.map((entry) => {
  const content = seoPostContent[entry.slug];
  if (!content) {
    throw new Error(`Missing SEO content for slug: ${entry.slug}`);
  }
  return buildSeoPost(entry, content);
});
