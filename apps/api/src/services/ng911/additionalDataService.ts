import type {
  AdditionalDataAutoBuildBody,
  AdditionalDataItem,
  AdditionalDataPackage,
  AdditionalDataUpsertBody,
} from "rapid-cortex-shared";
import { additionalDataPackageSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { AnalysisRepository } from "../../repositories/analysisRepository.js";
import { IncidentMediaRepository } from "../../repositories/incidentMediaRepository.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";
import { PremiseNotesRepository } from "../../repositories/premiseNotesRepository.js";
import { ng911AssistStore } from "./ng911AssistStore.js";

const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();
const analysisRepo = new AnalysisRepository();
const premiseNotesRepo = new PremiseNotesRepository();
const incidentMediaRepo = new IncidentMediaRepository();

/** Providers considered "generated" by {@link autoBuild} and safe to regenerate on each run. */
const AUTO_BUILD_PROVIDERS = new Set<AdditionalDataItem["provider"]>([
  "rapid_cortex",
  "ai_analysis",
  "premise_notes",
  "video_assist",
]);

const MAX_ITEMS = 100;

/** Flattens items into a CAD-friendly note block (used for `cadNoteText` and CAD write-back attach). */
export function buildCadNoteText(items: AdditionalDataItem[]): string {
  if (!items.length) return "";
  return items
    .map((item) => {
      const header = `[${item.provider.toUpperCase()}] ${item.label}`;
      const body = item.contentType === "json" ? item.value.slice(0, 2000) : item.value;
      return `${header}\n${body}`.trim();
    })
    .join("\n\n")
    .slice(0, 16000);
}

function mergeItems(
  existing: AdditionalDataItem[],
  incoming: AdditionalDataItem[],
): AdditionalDataItem[] {
  const byId = new Map(existing.map((item) => [item.itemId, item]));
  for (const item of incoming) byId.set(item.itemId, item);
  const merged = [...byId.values()];
  return merged.length > MAX_ITEMS ? merged.slice(merged.length - MAX_ITEMS) : merged;
}

export async function getAdditionalData(
  agencyId: string,
  incidentId: string,
): Promise<AdditionalDataPackage | null> {
  return ng911AssistStore.getAdditionalData(agencyId, incidentId);
}

export async function putAdditionalData(
  agencyId: string,
  incidentId: string,
  actorId: string,
  body: AdditionalDataUpsertBody,
): Promise<AdditionalDataPackage> {
  const now = new Date().toISOString();
  const existing = await ng911AssistStore.getAdditionalData(agencyId, incidentId);

  const incoming: AdditionalDataItem[] = body.items.map((item) => ({
    ...item,
    itemId: item.itemId ?? makeId("adi"),
    collectedAt: item.collectedAt ?? now,
  }));

  const items = body.replaceAll ? incoming : mergeItems(existing?.items ?? [], incoming);

  const pkg: AdditionalDataPackage = additionalDataPackageSchema.parse({
    agencyId,
    incidentId,
    packageId: existing?.packageId ?? makeId("adp"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    items,
    cadNoteText: buildCadNoteText(items),
  });

  await ng911AssistStore.putAdditionalData(pkg);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    incidentId,
    actorId,
    type: AUDIT_EVENT_TYPES.ADDITIONAL_DATA_UPDATED,
    details: { itemCount: items.length, replaceAll: body.replaceAll, autoBuild: false },
    createdAt: now,
    resourceType: "incident",
    resourceId: incidentId,
  });

  return pkg;
}

/**
 * Rebuilds the auto-generated portion of an incident's Additional Data package from the
 * incident record, latest AI analysis (if available), premise notes (if configured), and
 * caller media hints (if configured) — each source is best-effort and skipped gracefully
 * when its repository/table is unavailable.
 */
export async function autoBuild(
  agencyId: string,
  incidentId: string,
  actorId: string,
  body: AdditionalDataAutoBuildBody,
): Promise<AdditionalDataPackage> {
  const incident = await incidentRepo.get(incidentId);
  if (!incident || incident.agencyId !== agencyId) throw new Error("NOT_FOUND");

  const now = new Date().toISOString();
  const generated: AdditionalDataItem[] = [];

  const hasGeo = incident.callerLocationLat != null && incident.callerLocationLng != null;
  if (incident.callerAddressLine?.trim() || hasGeo) {
    generated.push({
      itemId: makeId("adi"),
      provider: "rapid_cortex",
      label: "Incident Location",
      contentType: "text",
      value:
        [
          incident.callerAddressLine?.trim() || undefined,
          hasGeo ? `(${incident.callerLocationLat}, ${incident.callerLocationLng})` : undefined,
        ]
          .filter(Boolean)
          .join(" ") || "Location unavailable",
      collectedAt: now,
    });
  }

  if (incident.callerCallback?.trim()) {
    generated.push({
      itemId: makeId("adi"),
      provider: "rapid_cortex",
      label: "Caller Callback Number",
      contentType: "text",
      value: incident.callerCallback,
      collectedAt: now,
    });
  }

  if (body.includeAi) {
    try {
      const analyses = await analysisRepo.listByIncident(incidentId);
      const latest =
        analyses.find(
          (a) => a.analysisRecordKind !== "triage" && a.analysisRecordKind !== "field_confidence",
        ) ?? analyses[0];
      if (latest?.summary?.trim()) {
        generated.push({
          itemId: makeId("adi"),
          provider: "ai_analysis",
          label: "AI Situational Summary",
          contentType: "text",
          value: latest.summary,
          collectedAt: latest.createdAt ?? now,
          meta: {
            confidence: latest.confidence,
            category: latest.category,
            urgency: latest.urgency,
          },
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          type: "ng911.additional_data.ai_lookup_failed",
          incidentId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  if (body.includePremise && env.premiseNotesTable && incident.callerAddressNormalized) {
    try {
      const notes = await premiseNotesRepo.listForAddress(agencyId, incident.callerAddressNormalized);
      if (notes.length) {
        generated.push({
          itemId: makeId("adi"),
          provider: "premise_notes",
          label: "Premise Notes",
          contentType: "text",
          value: notes
            .map((n) => `- ${n.text}${n.isHazard ? " [HAZARD]" : ""}`)
            .join("\n")
            .slice(0, 16000),
          collectedAt: now,
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          type: "ng911.additional_data.premise_notes_lookup_failed",
          incidentId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  if (body.includeMediaHints && env.incidentMediaTable) {
    try {
      const media = await incidentMediaRepo.listByIncident(agencyId, incidentId);
      if (media.length) {
        const uploaded = media.filter((m) => m.status === "uploaded").length;
        generated.push({
          itemId: makeId("adi"),
          provider: "video_assist",
          label: "Caller Media Captures",
          contentType: "text",
          value: `${media.length} media request(s) — ${uploaded} uploaded. Review in the Incident Media panel.`,
          collectedAt: now,
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          type: "ng911.additional_data.media_lookup_failed",
          incidentId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  if (!generated.length) {
    generated.push({
      itemId: makeId("adi"),
      provider: "rapid_cortex",
      label: "Auto-Build Summary",
      contentType: "text",
      value: "No additional enrichment data was available for this incident at build time.",
      collectedAt: now,
    });
  }

  const existing = await ng911AssistStore.getAdditionalData(agencyId, incidentId);
  const keep = (existing?.items ?? []).filter((item) => !AUTO_BUILD_PROVIDERS.has(item.provider));
  const items = mergeItems(keep, generated);

  const pkg: AdditionalDataPackage = additionalDataPackageSchema.parse({
    agencyId,
    incidentId,
    packageId: existing?.packageId ?? makeId("adp"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    items,
    cadNoteText: buildCadNoteText(items),
  });

  await ng911AssistStore.putAdditionalData(pkg);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    incidentId,
    actorId,
    type: AUDIT_EVENT_TYPES.ADDITIONAL_DATA_UPDATED,
    details: { itemCount: items.length, autoBuild: true },
    createdAt: now,
    resourceType: "incident",
    resourceId: incidentId,
  });

  return pkg;
}
