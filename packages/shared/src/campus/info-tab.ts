import { z } from "zod";
import { normalizeCampusSiteCode } from "./campus-sites.js";

const httpsUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => u.startsWith("https://"), { message: "URL must use HTTPS" });

export const campusInfoTabContactSchema = z.object({
  label: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(32),
});

export const campusInfoTabSectionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** Markdown only — never raw HTML. */
  content: z.string().trim().max(8000),
  order: z.number().int().min(0).max(100).default(0),
  visible: z.boolean().default(true),
});

export const campusInfoTabAlertBannerSchema = z.object({
  message: z.string().trim().min(1).max(500),
  severity: z.enum(["info", "warning", "critical"]),
  active: z.boolean().default(false),
});

export const campusInfoTabExternalLinkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: httpsUrlSchema,
});

export const campusInfoTabSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  logoUrl: httpsUrlSchema.optional().or(z.literal("")),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "brandColor must be a hex color like #0F766E")
    .optional(),
  emergencyContacts: z.array(campusInfoTabContactSchema).max(12).optional(),
  sections: z.array(campusInfoTabSectionSchema).max(24).optional(),
  alertBanner: campusInfoTabAlertBannerSchema.optional(),
  externalLinks: z.array(campusInfoTabExternalLinkSchema).max(12).optional(),
});

export type CampusInfoTab = z.infer<typeof campusInfoTabSchema>;

/** Public-safe subset returned on QR engage (same shape; empty strings stripped). */
export const campusInfoTabPublicSchema = campusInfoTabSchema;

export type CampusInfoTabPublic = z.infer<typeof campusInfoTabPublicSchema>;

export const campusInfoTabBySiteCodeSchema = z
  .record(z.string(), campusInfoTabSchema)
  .refine((m) => Object.keys(m).length <= 50, {
    message: "At most 50 site-specific info tabs",
  });

/** Resolve site override → tenant default for public engage. */
export function resolveCampusInfoTab(
  campus: {
    infoTab?: CampusInfoTab | null;
    infoTabBySiteCode?: Record<string, CampusInfoTab> | null;
  } | null | undefined,
  siteCode?: string | null,
): CampusInfoTab | null {
  if (!campus) return null;
  const code = siteCode?.trim() ? normalizeCampusSiteCode(siteCode) : "";
  if (code && campus.infoTabBySiteCode?.[code]) {
    return campus.infoTabBySiteCode[code]!;
  }
  return campus.infoTab ?? null;
}

/** Strip empty logo and invisible sections for public payload. */
export function toPublicCampusInfoTab(tab: CampusInfoTab | null | undefined): CampusInfoTabPublic | undefined {
  if (!tab) return undefined;
  const sections = (tab.sections ?? [])
    .filter((s) => s.visible !== false && s.title.trim() && s.content.trim())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const contacts = (tab.emergencyContacts ?? []).filter((c) => c.label.trim() && c.phone.trim());
  const links = (tab.externalLinks ?? []).filter((l) => l.label.trim() && l.url.trim());
  const banner =
    tab.alertBanner?.active && tab.alertBanner.message.trim()
      ? tab.alertBanner
      : undefined;
  const logoUrl = tab.logoUrl?.trim() || undefined;
  const hasContent =
    Boolean(tab.displayName?.trim()) ||
    Boolean(logoUrl) ||
    Boolean(tab.brandColor) ||
    contacts.length > 0 ||
    sections.length > 0 ||
    Boolean(banner) ||
    links.length > 0;
  if (!hasContent) return undefined;
  return {
    ...(tab.displayName?.trim() ? { displayName: tab.displayName.trim() } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(tab.brandColor ? { brandColor: tab.brandColor } : {}),
    ...(contacts.length ? { emergencyContacts: contacts } : {}),
    ...(sections.length ? { sections } : {}),
    ...(banner ? { alertBanner: banner } : {}),
    ...(links.length ? { externalLinks: links } : {}),
  };
}
