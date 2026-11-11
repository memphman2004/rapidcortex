/**
 * Canonical NexCortiQ Signal edition catalog for Sales Automation sync.
 * Keep statuses / slugs aligned with apps/marketing/lib/newsletter/newsletter-data.ts.
 *
 * Sales Automation upserts a newsletter content draft for every edition here
 * (published + upcoming) so RC admin can approve copy before send.
 */

export type SignalEditionStatus = "published" | "upcoming";

export type SignalEdition = {
  slug: string;
  volume: number;
  issue: number;
  title: string;
  subtitle: string;
  publishDate: string;
  pdfUrl?: string;
  status: SignalEditionStatus;
  coverTagline?: string;
};

export const SIGNAL_SITE_ORIGIN = "https://www.nexcortiq.us";

/** All Vol. 1 Signal editions — appear in Sales Automation Content for approval. */
export const SIGNAL_EDITIONS: readonly SignalEdition[] = [
  {
    slug: "vol1-no1-introduction",
    volume: 1,
    issue: 1,
    title: "Introduction to NexCortiQ",
    subtitle: "Redefining Emergency Communications Intelligence",
    publishDate: "2026-11-01",
    pdfUrl: "/newsletters/nexcortiq-signal-vol1-no1.pdf",
    status: "published",
    coverTagline: "Intelligence at the speed of response — introducing NexCortiQ.",
  },
  {
    slug: "vol1-no2-holiday-2026",
    volume: 1,
    issue: 2,
    title: "911 During the Holidays",
    subtitle: "High-Volume Season. The Same Urgency.",
    publishDate: "2026-12-01",
    status: "upcoming",
    coverTagline: "More calls. Thinner staffing. This is where NexCortiQ earns its place.",
  },
  {
    slug: "vol1-no3-pre-arrival-iq",
    volume: 1,
    issue: 3,
    title: "Pre-Arrival iQ",
    subtitle: "What If Responders Knew Before They Arrived?",
    publishDate: "2027-01-01",
    status: "upcoming",
    coverTagline: "Closing the gap between dispatch and arrival.",
  },
  {
    slug: "vol1-no4-ng911-radio-intelligence",
    volume: 1,
    issue: 4,
    title: "NG911 Radio Intelligence",
    subtitle: "Command Clarity in Real Time",
    publishDate: "2027-02-01",
    status: "upcoming",
    coverTagline: "Every transmission. Every unit. Every incident. In real time.",
  },
  {
    slug: "vol1-no5-iq-vision",
    volume: 1,
    issue: 5,
    title: "iQ Vision — Scene Intelligence",
    subtitle: "See the Scene Before Units Arrive",
    publishDate: "2027-03-01",
    status: "upcoming",
    coverTagline: "Visual intelligence, delivered to dispatch in real time.",
  },
  {
    slug: "vol1-no6-ai-call-assist",
    volume: 1,
    issue: 6,
    title: "AI Call Assist — Nova Sonic",
    subtitle: "Every Call. Handled with Intelligence.",
    publishDate: "2027-04-01",
    status: "upcoming",
    coverTagline: "Augmenting every call — not replacing the dispatcher.",
  },
  {
    slug: "vol1-no7-audio-intelligence",
    volume: 1,
    issue: 7,
    title: "Audio Intelligence",
    subtitle: "Hear What Your Dispatchers Can't",
    publishDate: "2027-05-01",
    status: "upcoming",
    coverTagline: "The sounds behind the call — analyzed and surfaced automatically.",
  },
  {
    slug: "vol1-no8-cad-integration",
    volume: 1,
    issue: 8,
    title: "CAD Integration Layer",
    subtitle: "One Platform. Every CAD System.",
    publishDate: "2027-06-01",
    status: "upcoming",
    coverTagline: "NexCortiQ works with your CAD — not instead of it.",
  },
  {
    slug: "vol1-no9-campus-safety",
    volume: 1,
    issue: 9,
    title: "Campus Safety Intelligence",
    subtitle: "Every Student. Every Building. Every Second.",
    publishDate: "2027-07-01",
    status: "upcoming",
    coverTagline: "Protecting every campus — before the first unit arrives.",
  },
  {
    slug: "vol1-no10-transit-safety",
    volume: 1,
    issue: 10,
    title: "Transit Safety Intelligence",
    subtitle: "Every Route. Every Station. Every Passenger.",
    publishDate: "2027-08-01",
    status: "upcoming",
    coverTagline: "Safety intelligence across every route, station, and vehicle.",
  },
  {
    slug: "vol1-no11-nexiq-signal",
    volume: 1,
    issue: 11,
    title: "NexiQ Signal Intelligence",
    subtitle: "The Procurement Layer No One Else Has",
    publishDate: "2027-09-01",
    status: "upcoming",
    coverTagline: "We track the signals so your agency never misses an opportunity.",
  },
  {
    slug: "vol1-no12-year-in-review",
    volume: 1,
    issue: 12,
    title: "Year One in Review",
    subtitle: "What We Built. What Changed. What's Next.",
    publishDate: "2027-10-01",
    status: "upcoming",
    coverTagline: "One year. Four verticals. One platform. What comes next is bigger.",
  },
] as const;

export function getPublishedSignalEditions(): SignalEdition[] {
  return SIGNAL_EDITIONS.filter((e) => e.status === "published").sort((a, b) =>
    b.publishDate.localeCompare(a.publishDate),
  );
}

/** Editions that should appear in Sales Automation for copy approval (all statuses). */
export function getSignalEditionsForSalesSync(): SignalEdition[] {
  return [...SIGNAL_EDITIONS].sort(
    (a, b) => a.volume - b.volume || a.issue - b.issue || a.publishDate.localeCompare(b.publishDate),
  );
}

export function signalEditionDraftId(slug: string): string {
  return `nl-${slug.trim()}`;
}

export function signalEditionCampaignId(slug: string): string {
  return `newsletter:${slug.trim()}`;
}

export function isNewsletterCampaignId(campaignId: string): boolean {
  const id = campaignId.trim();
  return id === "newsletter" || id.startsWith("newsletter:");
}

export function signalEditionUrl(slug: string): string {
  return `${SIGNAL_SITE_ORIGIN}/newsletter/${slug.trim()}/`;
}

export function signalEditionAbsolutePdfUrl(pdfUrl?: string): string | undefined {
  if (!pdfUrl?.trim()) return undefined;
  if (pdfUrl.startsWith("http")) return pdfUrl;
  return `${SIGNAL_SITE_ORIGIN}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
}

export function formatSignalEditionMonth(publishDate: string): string {
  const d = new Date(`${publishDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return publishDate;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function buildSignalEditionEmailBody(edition: SignalEdition): string {
  const month = formatSignalEditionMonth(edition.publishDate);
  const url = signalEditionUrl(edition.slug);
  const pdf = signalEditionAbsolutePdfUrl(edition.pdfUrl);
  const lines = [
    `The NexCortiQ Signal — Vol. ${edition.volume}, No. ${edition.issue} (${month})`,
    "",
    edition.title,
    edition.subtitle,
    "",
  ];
  if (edition.coverTagline) {
    lines.push(edition.coverTagline, "");
  }
  lines.push(`Read this issue: ${url}`);
  if (pdf) lines.push(`Download PDF: ${pdf}`);
  lines.push("", "— The NexCort iQ team");
  return lines.join("\n");
}

export function buildSignalEditionSubject(edition: SignalEdition): string {
  const month = formatSignalEditionMonth(edition.publishDate);
  return `The NexCortiQ Signal — ${edition.title} (${month})`;
}
