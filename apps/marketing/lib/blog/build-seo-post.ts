import type { CalendarEntry, ContentHub } from "./calendar-entries";
import type { BlogPost, ContentBlock } from "./types";

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hubTags(hub: ContentHub, seoFocus: string): string[] {
  const base: Record<ContentHub, string[]> = {
    "Leadership & Buying": ["public safety technology", "emergency communications software"],
    "Campus Safety": ["campus safety software", "university safety platform"],
    "Venue Safety": ["venue safety platform", "stadium security software"],
    "911, PSAP & NG911": ["911 software", "psap technology", "ng911"],
    "Airport Safety": ["airport security software", "airport incident reporting"],
    "Buyer Intent": ["incident intelligence platform", "public safety software"],
  };
  return [seoFocus, ...base[hub]];
}

function hubCta(hub: ContentHub): BlogPost["cta"] {
  switch (hub) {
    case "Campus Safety":
      return {
        eyebrow: "Scope a campus pilot",
        text: "See how QR, NFC, and text-based reporting map onto your buildings — without asking students to download another app.",
        buttonLabel: "Request a Pilot",
        href: "/demo",
      };
    case "Venue Safety":
    case "Airport Safety":
      return {
        eyebrow: "See it on your floor plan",
        text: "Walk through how low-friction reporting and zone-based routing work inside your venue or terminal layout.",
        buttonLabel: "Schedule a Demo",
        href: "/demo",
      };
    case "911, PSAP & NG911":
      return {
        eyebrow: "See Core on a live call flow",
        text: "Walk through real-time transcription, translation, and multimedia intake the way your call-takers would actually use them.",
        buttonLabel: "Request a Pilot",
        href: "/demo",
      };
    case "Buyer Intent":
      return {
        eyebrow: "Compare on your terms",
        text: "Get a scoped walkthrough of Rapid Cortex Core, Venue, and Campus — and how each sits alongside the systems you already run.",
        buttonLabel: "Contact Sales",
        href: "/contact-sales",
      };
    case "Leadership & Buying":
    default:
      return {
        eyebrow: "Evaluate without disruption",
        text: "Rapid Cortex pilots run alongside your existing CAD, telephony, and security workflows — not instead of them.",
        buttonLabel: "Schedule a Demo",
        href: "/demo",
      };
  }
}

function buildDescription(entry: CalendarEntry): string {
  const focus = entry.seoFocus.charAt(0).toUpperCase() + entry.seoFocus.slice(1);
  const base = `${focus} for agencies evaluating modern incident intelligence. Practical guidance on workflows, compliance, and deployment — without replacing CAD.`;
  return base.length <= 160 ? base : base.slice(0, 157) + "…";
}

export interface SeoSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
  ordered?: boolean;
  subheading?: { heading: string; paragraphs: string[] };
  callout?: { tone: "note" | "caution"; label: string; text: string };
}

export interface SeoPostContent {
  intro: string;
  sections: SeoSection[];
  closing?: string;
}

export function sectionsToBlocks(sections: SeoSection[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  for (const section of sections) {
    blocks.push({
      type: "heading",
      level: 2,
      id: slugifyHeading(section.heading),
      text: section.heading,
    });

    for (const paragraph of section.paragraphs) {
      blocks.push({ type: "paragraph", text: paragraph });
    }

    if (section.list?.length) {
      blocks.push({
        type: "list",
        ordered: section.ordered,
        items: section.list,
      });
    }

    if (section.subheading) {
      blocks.push({
        type: "heading",
        level: 3,
        id: slugifyHeading(section.subheading.heading),
        text: section.subheading.heading,
      });
      for (const paragraph of section.subheading.paragraphs) {
        blocks.push({ type: "paragraph", text: paragraph });
      }
    }

    if (section.callout) {
      blocks.push({
        type: "callout",
        tone: section.callout.tone,
        label: section.callout.label,
        text: section.callout.text,
      });
    }
  }

  return blocks;
}

export function buildSeoPost(entry: CalendarEntry, content: SeoPostContent): BlogPost {
  const blocks: ContentBlock[] = [
    { type: "paragraph", text: content.intro },
    ...sectionsToBlocks(content.sections),
  ];

  if (content.closing) {
    blocks.push({ type: "paragraph", text: content.closing });
  }

  const wordCount =
    [content.intro, ...content.sections.flatMap((s) => [...s.paragraphs, ...(s.list ?? []), ...(s.subheading?.paragraphs ?? [])]), content.closing ?? ""]
      .join(" ")
      .split(/\s+/).length;

  return {
    slug: entry.slug,
    title: entry.title,
    description: buildDescription(entry),
    category: entry.hub,
    tags: hubTags(entry.hub, entry.seoFocus),
    author: { name: "Rapid Cortex Team", role: "Product" },
    publishedAt: entry.publishedAt,
    readingTimeMinutes: Math.max(5, Math.round(wordCount / 200)),
    content: blocks,
    cta: hubCta(entry.hub),
  };
}
