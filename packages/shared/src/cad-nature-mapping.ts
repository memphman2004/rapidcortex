import { z } from "zod";
import { cadPrioritySchema } from "./cad.js";
import { getProtocolPackById } from "./protocol/registry.js";
import type { IncidentCategory, SopProtocolOverlayState } from "./types.js";

const rcIncidentCategorySchema = z.enum([
  "medical",
  "fire",
  "police",
  "welfare_check",
  "domestic_disturbance",
  "unknown",
]);

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const t = value.trim();
  return t.length === 0 ? undefined : t;
}

/** Agency-owned CAD nature → Rapid Cortex type / protocol mapping (stored on integration `config`). */
export const cadNatureCodeMappingRowSchema = z.object({
  mappingId: z.string().min(1).max(80).optional(),
  cadNatureCode: z.string().min(1).max(64),
  cadNatureAliases: z.array(z.string().min(1).max(64)).max(20).default([]),
  rcIncidentTypeId: z.preprocess(blankToUndefined, z.string().min(1).max(80).optional()),
  rcIncidentTypeLabel: z.preprocess(blankToUndefined, z.string().min(1).max(120).optional()),
  rcIncidentCategory: rcIncidentCategorySchema.optional(),
  protocolPackId: z.preprocess(blankToUndefined, z.string().min(1).max(120).optional()),
  defaultPriority: cadPrioritySchema.optional(),
  priorityModifier: z.preprocess(blankToUndefined, z.string().max(40).optional()),
  supervisorAlert: z.boolean().optional().default(false),
  sopOnIngest: z.boolean().optional().default(true),
  notes: z.preprocess(blankToUndefined, z.string().max(500).optional()),
  enabled: z.boolean().optional().default(true),
});

export type CadNatureCodeMapping = z.infer<typeof cadNatureCodeMappingRowSchema>;

export const cadNatureCodeMappingsSchema = z.array(cadNatureCodeMappingRowSchema).max(500);

export const putCadNatureCodeMappingsBodySchema = z
  .object({
    natureCodeMappings: cadNatureCodeMappingsSchema,
  })
  .strict();

export type PutCadNatureCodeMappingsBody = z.infer<typeof putCadNatureCodeMappingsBodySchema>;

/**
 * Fold CAD nature codes for matching (`DV-IP`, `dv_ip`, `10-16` → comparable keys).
 * Matching is case-insensitive and ignores spaces, hyphens, underscores, slashes, and dots.
 */
export function normalizeCadNatureCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s_\-./\\]+/g, "");
}

export function parseCadNatureCodeMappings(config: Record<string, unknown> | null | undefined): CadNatureCodeMapping[] {
  const raw = config?.natureCodeMappings;
  const parsed = cadNatureCodeMappingsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}

/** First enabled mapping whose CAD code or alias matches `cadNatureCode`. */
export function matchCadNatureMapping(
  mappings: readonly CadNatureCodeMapping[],
  cadNatureCode: string | null | undefined,
): CadNatureCodeMapping | null {
  if (!cadNatureCode?.trim()) return null;
  const needle = normalizeCadNatureCode(cadNatureCode);
  if (!needle) return null;
  for (const mapping of mappings) {
    if (mapping.enabled === false) continue;
    if (normalizeCadNatureCode(mapping.cadNatureCode) === needle) return mapping;
    for (const alias of mapping.cadNatureAliases ?? []) {
      if (normalizeCadNatureCode(alias) === needle) return mapping;
    }
  }
  return null;
}

export function matchCadNatureMappingFromConfig(
  config: Record<string, unknown> | null | undefined,
  cadNatureCode: string | null | undefined,
): CadNatureCodeMapping | null {
  return matchCadNatureMapping(parseCadNatureCodeMappings(config), cadNatureCode);
}

/**
 * Assign mapping ids, trim aliases, drop disabled-empty rows, and reject duplicate CAD codes.
 * Returns `{ ok: false, error }` when two enabled rows collide after normalization.
 */
export function canonicalizeCadNatureMappings(
  rows: CadNatureCodeMapping[],
  newId: () => string,
): { ok: true; mappings: CadNatureCodeMapping[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const mappings: CadNatureCodeMapping[] = [];
  for (const row of rows) {
    const parsed = cadNatureCodeMappingRowSchema.safeParse({
      ...row,
      mappingId: row.mappingId?.trim() || newId(),
      cadNatureCode: row.cadNatureCode.trim(),
      cadNatureAliases: [...new Set((row.cadNatureAliases ?? []).map((a) => a.trim()).filter(Boolean))],
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid nature-code mapping row." };
    }
    const mapping = parsed.data;
    if (mapping.protocolPackId && !getProtocolPackById(mapping.protocolPackId)) {
      return { ok: false, error: `Unknown protocol pack: ${mapping.protocolPackId}` };
    }
    const key = normalizeCadNatureCode(mapping.cadNatureCode);
    if (mapping.enabled !== false) {
      if (seen.has(key)) {
        return { ok: false, error: `Duplicate CAD nature code: ${mapping.cadNatureCode}` };
      }
      seen.add(key);
      for (const alias of mapping.cadNatureAliases) {
        const ak = normalizeCadNatureCode(alias);
        if (seen.has(ak)) {
          return { ok: false, error: `Duplicate CAD nature alias: ${alias}` };
        }
        seen.add(ak);
      }
    }
    mappings.push(mapping);
  }
  return { ok: true, mappings };
}

export type CadMappedSopOverlayInput = {
  mapping: CadNatureCodeMapping | null;
  existing: SopProtocolOverlayState | null | undefined;
  now: string;
};

/**
 * Build an SOP overlay from an agency CAD nature mapping.
 * Never overwrites dispatcher dismiss / manual override, or a higher-confidence transcript hit.
 */
export function buildCadMappedSopOverlay(input: CadMappedSopOverlayInput): SopProtocolOverlayState | null {
  const { mapping, existing, now } = input;
  if (!mapping?.protocolPackId || mapping.sopOnIngest === false) return null;
  if (existing?.dismissedAt) return null;
  if (existing?.manualProtocolPackId) return null;
  if (existing?.source === "transcript" && existing.confidence >= 0.75) return null;
  const pack = getProtocolPackById(mapping.protocolPackId);
  if (!pack) return null;
  if (existing?.recommendedProtocolPackId === pack.id && existing.source === "cad_nature_code") return null;
  return {
    recommendedProtocolPackId: pack.id,
    incidentTypeLabel: mapping.rcIncidentTypeLabel?.trim() || pack.name,
    confidence: 0.92,
    dismissedAt: null,
    manualProtocolPackId: existing?.manualProtocolPackId ?? null,
    completedStepIds: existing?.completedStepIds ?? [],
    segmentCountAtDetection: existing?.segmentCountAtDetection ?? 0,
    detectedAt: now,
    source: "cad_nature_code",
  };
}

export function mappedIncidentCategory(mapping: CadNatureCodeMapping | null): IncidentCategory | undefined {
  return mapping?.rcIncidentCategory;
}
