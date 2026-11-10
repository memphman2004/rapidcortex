/**
 * Canonical NexCortiQ Signal edition catalog for Sales Automation sync.
 * When an edition is `published` here, Sales Automation upserts a newsletter
 * content draft for RC admin approval (marketing site publish = source of truth).
 *
 * Keep in sync with apps/marketing/lib/newsletter/newsletter-data.ts statuses.
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

/** Published editions appear automatically in Sales Automation Content for approval. */
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
  },
  {
    slug: "vol1-no3-pre-arrival-iq",
    volume: 1,
    issue: 3,
    title: "Pre-Arrival iQ",
    subtitle: "What If Responders Knew Before They Arrived?",
    publishDate: "2027-01-01",
    status: "upcoming",
  },
  {
    slug: "vol1-no4-ng911-radio-intelligence",
    volume: 1,
    issue: 4,
    title: "NG911 Radio Intelligence",
    subtitle: "Command Clarity in Real Time",
    publishDate: "2027-02-01",
    status: "upcoming",
  },
] as const;

export function getPublishedSignalEditions(): SignalEdition[] {
  return SIGNAL_EDITIONS.filter((e) => e.status === "published").sort((a, b) =>
    b.publishDate.localeCompare(a.publishDate),
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
