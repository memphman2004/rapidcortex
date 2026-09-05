import { z } from "zod";

/** Session / UI value meaning every campus in the tenant. */
export const CAMPUS_SITE_SCOPE_ALL = "all";

export function normalizeCampusSiteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

export const campusSiteCodeSchema = z
  .string()
  .trim()
  .transform((s) => normalizeCampusSiteCode(s))
  .refine((s) => s.length >= 2 && s.length <= 20, {
    message: "Campus code must be 2–20 letters or numbers",
  });

export const campusSiteKindSchema = z.enum([
  "main",
  "regional",
  "medical",
  "research",
  "other",
]);

export const campusSiteSchema = z.object({
  code: campusSiteCodeSchema,
  name: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).optional(),
  state: z
    .string()
    .trim()
    .max(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  kind: campusSiteKindSchema.optional(),
  active: z.boolean().optional().default(true),
});

export type CampusSite = z.infer<typeof campusSiteSchema>;

export const campusBuildingSiteAssignmentSchema = z.object({
  buildingId: z.string().trim().min(1).max(50),
  siteCode: campusSiteCodeSchema,
});

export const campusSitesPutSchema = z
  .object({
    sites: z.array(campusSiteSchema).min(1).max(50),
    buildingAssignments: z.array(campusBuildingSiteAssignmentSchema).max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const codes = value.sites.map((site) => site.code);
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Campus codes must be unique",
        path: ["sites"],
      });
    }
    const allowed = new Set(codes);
    for (const [index, assignment] of (value.buildingAssignments ?? []).entries()) {
      if (!allowed.has(assignment.siteCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown campus ${assignment.siteCode}`,
          path: ["buildingAssignments", index, "siteCode"],
        });
      }
    }
  });

export type CampusSitesPut = z.infer<typeof campusSitesPutSchema>;

export function defaultCampusSites(primaryCode: string, primaryName?: string): CampusSite[] {
  const code = normalizeCampusSiteCode(primaryCode);
  const fallback = code.length >= 2 ? code : "CAMPUS";
  return [
    {
      code: fallback,
      name: primaryName?.trim() || fallback,
      active: true,
    },
  ];
}

/**
 * Tenant campus list. Always includes the system campus code so untagged
 * legacy buildings / incidents remain visible on the primary site.
 */
export function resolveCampusSites(
  stored: CampusSite[] | undefined,
  primaryCode: string,
  primaryName?: string,
): { sites: CampusSite[]; primarySiteCode: string } {
  const primarySiteCode = normalizeCampusSiteCode(primaryCode);
  const fallback = primarySiteCode.length >= 2 ? primarySiteCode : "CAMPUS";
  const active = (stored ?? []).filter((site) => site.active !== false);
  if (active.length === 0) {
    return { sites: defaultCampusSites(fallback, primaryName), primarySiteCode: fallback };
  }
  if (fallback.length >= 2 && !active.some((site) => site.code === fallback)) {
    return {
      sites: [
        { code: fallback, name: primaryName?.trim() || fallback, active: true },
        ...active,
      ],
      primarySiteCode: fallback,
    };
  }
  return { sites: active, primarySiteCode: fallback };
}

/**
 * Untagged legacy rows are visible in All campuses and on the tenant primary site.
 * Tagged rows are visible in All and their matching campus.
 */
export function matchesCampusSiteScope(
  itemSiteCode: string | undefined,
  selectedScope: string,
  primarySiteCode: string,
): boolean {
  const selected = selectedScope.trim().toLowerCase();
  if (!selected || selected === CAMPUS_SITE_SCOPE_ALL) return true;
  const selectedCode = normalizeCampusSiteCode(selectedScope);
  const primary = normalizeCampusSiteCode(primarySiteCode);
  const item = itemSiteCode?.trim() ? normalizeCampusSiteCode(itemSiteCode) : "";
  if (!item) return selectedCode === primary;
  return item === selectedCode;
}
