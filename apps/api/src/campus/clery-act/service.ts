import PDFDocument from "pdfkit";
import {
  AUDIT_EVENT_TYPES,
} from "rapid-cortex-security";
import type {
  CampusSecurityAuthority,
  CleryActGeography,
  CleryAsrStatus,
  CleryClassifyBody,
  CleryCsaCreateBody,
  CleryOffenseCategory,
  CleryPublicSettings,
  CleryRecord,
  CleryRecordStatus,
  CleryUnfoundBody,
  CleryZoneConfig,
  CleryZonePatchBody,
  DailyCrimeLogEntry,
  PublicDailyCrimeLogEntry,
} from "rapid-cortex-shared";
import {
  CLERY_OFFENSE_DISPLAY_NAMES,
  asrPublishDeadlineIso,
  asrStatisticsToEdSurveyCsv,
  calculateDCLDeadline,
  coverageYearsForAsr,
  formatAsrDisclaimer,
  generateAsrStatistics,
  HATE_CRIME_ONLY_CATEGORIES,
  isDclOverdue,
  filterPublicCrimeLogEntries,
  runVictimSafetyRedactionCheck,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { QRLocationsRepository } from "../../repositories/qrLocationsRepository.js";
import { getCampusIncident } from "../campus-incident-service.js";
import {
  assessTimelyWarning,
  suggestCleryClassification,
  suggestCleryGeography,
} from "./classification.js";
import { assertSwornOfficerMayUnfound, cleryActStore } from "./store.js";

const auditRepo = new AuditRepository();
const agencies = new AgencyRepository();
const qrLocations = new QRLocationsRepository();

function requireModule(): void {
  if (!env.enableCleryModule) throw new Error("FEATURE_DISABLED");
}

async function audit(params: {
  agencyId: string;
  actorId: string;
  type: string;
  details: Record<string, unknown>;
  resourceId?: string;
}): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.agencyId,
    incidentId: params.resourceId ?? params.agencyId,
    actorId: params.actorId,
    type: params.type,
    details: params.details,
    createdAt: new Date().toISOString(),
    resourceType: "clery_record",
    resourceId: params.resourceId,
  });
}

function ymd(iso: string): string {
  return iso.slice(0, 10);
}

function hm(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(11, 16);
}

function toPublicDcl(entry: DailyCrimeLogEntry): PublicDailyCrimeLogEntry {
  return {
    reportedDate: entry.reportedDate,
    reportedTime: entry.reportedTime,
    occurredDate: entry.occurredDate,
    occurredTime: entry.occurredTime,
    occurredDateRange: entry.occurredDateRange,
    offenseCategoryDisplayName: entry.offenseCategoryDisplayName,
    generalLocation: entry.generalLocation,
    disposition: entry.disposition,
    isHateCrime: entry.isHateCrime,
  };
}

export async function listCleryRecords(
  agencyId: string,
  filter?: { status?: CleryRecordStatus; year?: number },
): Promise<CleryRecord[]> {
  requireModule();
  const now = new Date();
  let records = await cleryActStore.listRecords(agencyId);
  records = records.map((r) => ({
    ...r,
    dailyCrimeLogOverdue: isDclOverdue(new Date(r.reportedToInstitutionAt), r.inDailyCrimeLog, now),
  }));
  if (filter?.status) records = records.filter((r) => r.status === filter.status);
  if (filter?.year) records = records.filter((r) => r.reportingCalendarYear === filter.year);
  return records.sort((a, b) => b.reportedToInstitutionAt.localeCompare(a.reportedToInstitutionAt));
}

export async function getCleryRecord(agencyId: string, recordId: string): Promise<CleryRecord | null> {
  requireModule();
  const r = await cleryActStore.getRecord(agencyId, recordId);
  if (!r) return null;
  return {
    ...r,
    dailyCrimeLogOverdue: isDclOverdue(new Date(r.reportedToInstitutionAt), r.inDailyCrimeLog),
  };
}

export async function createCleryRecordFromIncident(opts: {
  agencyId: string;
  campusCode: string;
  incidentId: string;
  actorId: string;
  reportedToInstitutionAt?: string;
  cleryZoneRcli?: string;
}): Promise<CleryRecord> {
  requireModule();
  const incident = await getCampusIncident(opts.campusCode, opts.incidentId);
  if (!incident) throw new Error("NOT_FOUND");
  if (incident.agencyId && incident.agencyId !== opts.agencyId) throw new Error("TENANT_MISMATCH");

  const existing = (await cleryActStore.listRecords(opts.agencyId)).find(
    (r) => r.incidentId === opts.incidentId && r.status !== "EXCLUDED",
  );
  if (existing) return existing;

  const reported = opts.reportedToInstitutionAt ?? incident.createdAt;
  const deadline = calculateDCLDeadline(new Date(reported)).toISOString();
  const suggestion = await suggestCleryClassification(opts.agencyId, incident);
  const geo = await suggestCleryGeography(opts.agencyId, incident);
  const rcli = opts.cleryZoneRcli ?? incident.qrRcli;
  const now = new Date().toISOString();
  const record: CleryRecord = {
    recordId: makeId("cleryrec"),
    agencyId: opts.agencyId,
    incidentId: opts.incidentId,
    campusCode: opts.campusCode.toUpperCase(),
    primaryOffense: "NOT_CLERY_REPORTABLE",
    secondaryOffenses: [],
    isHateCrime: false,
    hateCrimeBiasCategories: [],
    isVAWAOffense: false,
    enforcementAction: "NONE",
    cleryGeography: (geo.geography as CleryActGeography | null) ?? "NOT_CLERY_REPORTABLE",
    isResidentialFacility: geo.isResidentialFacility,
    cleryZoneRcli: rcli,
    generalLocationDescription:
      geo.buildingName ?? incident.buildingLabel ?? incident.zoneLabel ?? "Campus",
    reportedToInstitutionAt: reported,
    occurredAt: incident.createdAt,
    occurredAtApproximate: true,
    reportingCalendarYear: new Date(reported).getUTCFullYear(),
    status: "PENDING_REVIEW",
    classificationVersion: 0,
    classificationHistory: [],
    aiSuggestedOffense: suggestion.primaryOffense as CleryOffenseCategory,
    aiSuggestedGeography: (geo.geography as CleryActGeography | null) ?? undefined,
    aiSuggestionConfidence: suggestion.confidence,
    aiSuggestionRationale: suggestion.rationale,
    inDailyCrimeLog: false,
    dailyCrimeLogDeadline: deadline,
    dailyCrimeLogOverdue: isDclOverdue(new Date(reported), false),
    timelyWarningAssessed: false,
    includedInASR: false,
    createdAt: now,
    updatedAt: now,
  };
  await cleryActStore.putRecord(record);
  await audit({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CLERY_RECORD_CREATED,
    resourceId: record.recordId,
    details: {
      incidentId: opts.incidentId,
      campusCode: opts.campusCode,
      aiSuggestedOffense: suggestion.primaryOffense,
      reportedToInstitutionAt: reported,
      dailyCrimeLogDeadline: deadline,
    },
  });
  return record;
}

export async function getSuggestion(agencyId: string, recordId: string) {
  requireModule();
  const record = await cleryActStore.getRecord(agencyId, recordId);
  if (!record) throw new Error("NOT_FOUND");
  const incident = await getCampusIncident(record.campusCode, record.incidentId);
  if (!incident) throw new Error("NOT_FOUND");
  const [suggestion, geography, timely] = await Promise.all([
    suggestCleryClassification(agencyId, incident),
    suggestCleryGeography(agencyId, incident),
    Promise.resolve(
      assessTimelyWarning(
        (record.aiSuggestedOffense ?? "NOT_CLERY_REPORTABLE") as CleryOffenseCategory,
      ),
    ),
  ]);
  return {
    advisoryOnly: true,
    notice:
      "AI suggestions are advisory only. A Clery Coordinator must confirm classification before the record counts in statistics or the Daily Crime Log.",
    suggestion,
    geography,
    timelyWarning: timely,
    incident: {
      id: incident.id,
      type: incident.type,
      description: incident.description,
      buildingLabel: incident.buildingLabel,
      zoneLabel: incident.zoneLabel,
      createdAt: incident.createdAt,
      isAnonymous: incident.isAnonymous,
    },
    record,
  };
}

export async function classifyCleryRecord(opts: {
  agencyId: string;
  recordId: string;
  actorId: string;
  body: CleryClassifyBody;
}): Promise<CleryRecord> {
  requireModule();
  const existing = await cleryActStore.getRecord(opts.agencyId, opts.recordId);
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.status === "UNFOUNDED") {
    throw Object.assign(
      new Error("Unfounded records cannot be reversed except through a new classification workflow"),
      { code: "UNFOUND_LOCKED" },
    );
  }

  const redaction = runVictimSafetyRedactionCheck(
    opts.body.generalLocationDescription,
    opts.body.primaryOffense,
  );
  if (!redaction.ok) {
    throw Object.assign(new Error(redaction.message ?? "Location blocked"), {
      code: "REDACTION_BLOCKED",
      blockedTerms: redaction.blockedTerms,
    });
  }

  if (
    (HATE_CRIME_ONLY_CATEGORIES as readonly string[]).includes(opts.body.primaryOffense) &&
    !opts.body.isHateCrime
  ) {
    throw Object.assign(
      new Error(
        "Simple assault, larceny-theft, intimidation, and destruction/vandalism are Clery-reportable only as hate crimes. Mark a bias category or choose a different offense.",
      ),
      { code: "HATE_CRIME_REQUIRED" },
    );
  }
  if (opts.body.isHateCrime && (opts.body.hateCrimeBiasCategories ?? []).length === 0) {
    throw Object.assign(new Error("Hate crimes require at least one bias category."), {
      code: "HATE_CRIME_BIAS_REQUIRED",
    });
  }

  const reported = opts.body.reportedToInstitutionAt ?? existing.reportedToInstitutionAt;
  const deadline = calculateDCLDeadline(new Date(reported)).toISOString();
  const now = new Date().toISOString();
  const notReportable = opts.body.primaryOffense === "NOT_CLERY_REPORTABLE";
  const nextStatus: CleryRecordStatus = notReportable ? "EXCLUDED" : "CLASSIFIED";
  const previousOffense = existing.classificationVersion > 0 ? existing.primaryOffense : undefined;
  const version = existing.classificationVersion + 1;
  const accepted =
    opts.body.aiSuggestionAccepted ??
    (existing.aiSuggestedOffense != null && existing.aiSuggestedOffense === opts.body.primaryOffense);

  const updated: CleryRecord = {
    ...existing,
    primaryOffense: opts.body.primaryOffense,
    secondaryOffenses: opts.body.secondaryOffenses ?? [],
    cleryGeography: opts.body.cleryGeography,
    isResidentialFacility: opts.body.isResidentialFacility,
    isHateCrime: opts.body.isHateCrime,
    hateCrimeBiasCategories: opts.body.hateCrimeBiasCategories ?? [],
    isVAWAOffense: opts.body.isVAWAOffense,
    vawaOffenseType: opts.body.vawaOffenseType,
    enforcementAction: opts.body.enforcementAction ?? "NONE",
    drugViolationType: opts.body.drugViolationType,
    generalLocationDescription: opts.body.generalLocationDescription,
    occurredAt: opts.body.occurredAt,
    occurredAtApproximate: opts.body.occurredAtApproximate ?? existing.occurredAtApproximate,
    occurredAtRangeStart: opts.body.occurredAtRangeStart,
    occurredAtRangeEnd: opts.body.occurredAtRangeEnd,
    classificationNotes: opts.body.classificationNotes,
    reportedToInstitutionAt: reported,
    reportingCalendarYear: new Date(reported).getUTCFullYear(),
    status: nextStatus,
    classifiedBy: opts.actorId,
    classifiedAt: now,
    classificationVersion: version,
    classificationHistory: [
      ...existing.classificationHistory,
      {
        version,
        previousOffense,
        newOffense: opts.body.primaryOffense,
        changedBy: opts.actorId,
        changedAt: now,
        reason: opts.body.classificationNotes,
      },
    ],
    aiSuggestionAccepted: accepted,
    inDailyCrimeLog: !notReportable,
    dailyCrimeLogEnteredAt: notReportable ? existing.dailyCrimeLogEnteredAt : now,
    dailyCrimeLogDeadline: deadline,
    dailyCrimeLogOverdue: false,
    dailyCrimeLogDisposition: opts.body.dailyCrimeLogDisposition,
    includedInASR: !notReportable,
    updatedAt: now,
  };

  await cleryActStore.putRecord(updated);

  if (!notReportable) {
    const existingDcl = (await cleryActStore.listDcl(opts.agencyId)).find(
      (e) => e.cleryRecordId === updated.recordId,
    );
    if (existingDcl) {
      const dcl = {
        ...existingDcl,
        cleryOffenseCategory: updated.primaryOffense,
        offenseCategoryDisplayName: CLERY_OFFENSE_DISPLAY_NAMES[updated.primaryOffense],
        generalLocation: updated.generalLocationDescription,
        cleryGeography: updated.cleryGeography,
        disposition: updated.dailyCrimeLogDisposition ?? existingDcl.disposition,
        isHateCrime: updated.isHateCrime,
        lastUpdatedAt: now,
      };
      await cleryActStore.putDcl(dcl);
      await audit({
        agencyId: opts.agencyId,
        actorId: opts.actorId,
        type: AUDIT_EVENT_TYPES.CLERY_DCL_ENTRY_UPDATED,
        resourceId: dcl.entryId,
        details: { cleryRecordId: updated.recordId },
      });
    } else {
      const dcl = buildDclEntry(updated, opts.actorId, now);
      await cleryActStore.putDcl(dcl);
      await audit({
        agencyId: opts.agencyId,
        actorId: opts.actorId,
        type: AUDIT_EVENT_TYPES.CLERY_DCL_ENTRY_CREATED,
        resourceId: dcl.entryId,
        details: { cleryRecordId: updated.recordId, generalLocation: dcl.generalLocation },
      });
    }
  }

  await audit({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type:
      existing.classificationVersion > 0
        ? AUDIT_EVENT_TYPES.CLERY_RECORD_RECLASSIFIED
        : AUDIT_EVENT_TYPES.CLERY_RECORD_CLASSIFIED,
    resourceId: updated.recordId,
    details: {
      primaryOffense: updated.primaryOffense,
      geography: updated.cleryGeography,
      status: updated.status,
      aiSuggestionAccepted: accepted,
    },
  });
  await audit({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: accepted
      ? AUDIT_EVENT_TYPES.CLERY_AI_SUGGESTION_ACCEPTED
      : AUDIT_EVENT_TYPES.CLERY_AI_SUGGESTION_OVERRIDDEN,
    resourceId: updated.recordId,
    details: {
      suggested: existing.aiSuggestedOffense,
      confirmed: updated.primaryOffense,
    },
  });
  if (notReportable) {
    await audit({
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CLERY_RECORD_EXCLUDED,
      resourceId: updated.recordId,
      details: { reason: opts.body.classificationNotes ?? "NOT_CLERY_REPORTABLE" },
    });
  }
  return updated;
}

function buildDclEntry(record: CleryRecord, actorId: string, now: string): DailyCrimeLogEntry {
  const entered = new Date(now);
  const publicExpires = new Date(entered.getTime() + 60 * 24 * 60 * 60 * 1000);
  const archiveExpires = new Date(entered.getTime() + 7 * 365 * 24 * 60 * 60 * 1000);
  return {
    entryId: makeId("clerydcl"),
    agencyId: record.agencyId,
    cleryRecordId: record.recordId,
    reportedDate: ymd(record.reportedToInstitutionAt),
    reportedTime: hm(record.reportedToInstitutionAt),
    occurredDate: record.occurredAt ? ymd(record.occurredAt) : undefined,
    occurredTime: record.occurredAt ? hm(record.occurredAt) : undefined,
    occurredDateRange:
      record.occurredAtRangeStart && record.occurredAtRangeEnd
        ? `between ${ymd(record.occurredAtRangeStart)} and ${ymd(record.occurredAtRangeEnd)}`
        : undefined,
    cleryOffenseCategory: record.primaryOffense,
    offenseCategoryDisplayName: CLERY_OFFENSE_DISPLAY_NAMES[record.primaryOffense],
    generalLocation: record.generalLocationDescription,
    cleryGeography: record.cleryGeography,
    disposition: record.dailyCrimeLogDisposition ?? "Open — Investigation Ongoing",
    isHateCrime: record.isHateCrime,
    enteredAt: now,
    enteredBy: actorId,
    lastUpdatedAt: now,
    isPubliclyVisible: true,
    publicVisibleFrom: now,
    publicWindowExpiresAt: publicExpires.toISOString(),
    archiveExpiresAt: archiveExpires.toISOString(),
    createdAt: now,
  };
}

export async function unfoundCleryRecord(opts: {
  agencyId: string;
  recordId: string;
  actorId: string;
  body: CleryUnfoundBody;
}): Promise<CleryRecord> {
  requireModule();
  const csa = await assertSwornOfficerMayUnfound(opts.agencyId, opts.actorId);
  const existing = await cleryActStore.getRecord(opts.agencyId, opts.recordId);
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.status === "UNFOUNDED") throw new Error("ALREADY_UNFOUNDED");

  const now = new Date().toISOString();
  const updated: CleryRecord = {
    ...existing,
    status: "UNFOUNDED",
    unfoundedBy: opts.actorId,
    unfoundedByBadgeNumber: csa.badgeNumber,
    unfoundedAt: now,
    unfoundedReason: opts.body.reason,
    includedInASR: false,
    dailyCrimeLogDisposition: "Unfounded",
    updatedAt: now,
  };
  await cleryActStore.putRecord(updated);

  const dclEntries = await cleryActStore.listDcl(opts.agencyId);
  const dcl = dclEntries.find((e) => e.cleryRecordId === opts.recordId);
  if (dcl) {
    await cleryActStore.putDcl({
      ...dcl,
      disposition: "Unfounded",
      lastUpdatedAt: now,
    });
    await audit({
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CLERY_DCL_ENTRY_UPDATED,
      resourceId: dcl.entryId,
      details: { disposition: "Unfounded", cleryRecordId: opts.recordId },
    });
  }

  await audit({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CLERY_RECORD_UNFOUNDED,
    resourceId: opts.recordId,
    details: {
      badgeNumber: csa.badgeNumber,
      reporterType: csa.reporterType,
      reason: opts.body.reason,
      fullInvestigationCompleted: true,
    },
  });
  return updated;
}

export async function listDailyCrimeLog(agencyId: string, includeInternal: boolean) {
  requireModule();
  const entries = await cleryActStore.listDcl(agencyId);
  const now = Date.now();
  const filtered = includeInternal
    ? entries
    : entries.filter(
        (e) => e.isPubliclyVisible && Date.parse(e.publicWindowExpiresAt) >= now,
      );
  return filtered.sort((a, b) => b.reportedDate.localeCompare(a.reportedDate));
}

export async function listOverdueCleryRecords(agencyId: string): Promise<CleryRecord[]> {
  requireModule();
  const records = await listCleryRecords(agencyId);
  return records.filter((r) => r.dailyCrimeLogOverdue && r.status !== "EXCLUDED");
}

export async function patchDclDisposition(
  agencyId: string,
  entryId: string,
  actorId: string,
  disposition: string,
): Promise<DailyCrimeLogEntry> {
  requireModule();
  const existing = await cleryActStore.getDcl(agencyId, entryId);
  if (!existing) throw new Error("NOT_FOUND");
  const now = new Date().toISOString();
  const updated = { ...existing, disposition, lastUpdatedAt: now };
  await cleryActStore.putDcl(updated);
  await audit({
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CLERY_DCL_ENTRY_UPDATED,
    resourceId: entryId,
    details: { disposition },
  });
  return updated;
}

export async function getPublicCrimeLog(agencySlug: string) {
  if (!env.enableCleryModule) throw new Error("FEATURE_DISABLED");
  const { resolveCampusAgencyId } = await import("../campus-access.js");
  const agencyId = await resolveCampusAgencyId(agencySlug);
  if (!agencyId) throw new Error("NOT_FOUND");
  const agency = await agencies.get(agencyId);
  const settings = await cleryActStore.getPublicSettings(agencyId);
  const entries = await cleryActStore.listDcl(agencyId);
  const now = Date.now();
  const publicEntries = filterPublicCrimeLogEntries(
    entries.filter((e) => e.isPubliclyVisible && Date.parse(e.publicWindowExpiresAt) >= now),
  )
    .sort((a, b) => b.reportedDate.localeCompare(a.reportedDate) || (b.reportedTime ?? "").localeCompare(a.reportedTime ?? ""))
    .map(toPublicDcl);
  const lastUpdated = entries.reduce((acc, e) => (e.lastUpdatedAt > acc ? e.lastUpdatedAt : acc), "");
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 60 * 24 * 60 * 60 * 1000);
  return {
    institutionName: settings?.institutionName || agency?.name || agencySlug.toUpperCase(),
    agencySlug: agencySlug.toLowerCase(),
    statute: "20 U.S.C. § 1092(f)",
    windowStart: windowStart.toISOString().slice(0, 10),
    windowEnd: windowEnd.toISOString().slice(0, 10),
    lastUpdated: lastUpdated || null,
    contact: {
      name: settings?.publicContactName || "Campus Security",
      email: settings?.publicContactEmail || agency?.primaryContactEmail,
      phone: settings?.publicContactPhone,
    },
    archiveNote: "Records older than 60 days are archived and available upon request.",
    entries: publicEntries,
  };
}

export async function listCsa(agencyId: string): Promise<CampusSecurityAuthority[]> {
  requireModule();
  return cleryActStore.listCsa(agencyId);
}

export async function upsertCsa(
  agencyId: string,
  actorId: string,
  body: CleryCsaCreateBody,
): Promise<CampusSecurityAuthority> {
  requireModule();
  const now = new Date().toISOString();
  const existing = await cleryActStore.getCsa(agencyId, body.userId);
  const csa: CampusSecurityAuthority = {
    agencyId,
    userId: body.userId,
    displayName: body.displayName,
    email: body.email,
    reporterType: body.reporterType,
    isSwornOfficer: body.isSwornOfficer,
    badgeNumber: body.badgeNumber,
    isCleryCoordinator: body.isCleryCoordinator ?? false,
    trainingCompletedAt: body.trainingCompletedAt,
    trainingExpiresAt: body.trainingExpiresAt,
    activeFrom: existing?.activeFrom ?? now,
    addedBy: existing?.addedBy ?? actorId,
    addedAt: existing?.addedAt ?? now,
  };
  await cleryActStore.putCsa(csa);
  await audit({
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CLERY_CSA_ADDED,
    resourceId: body.userId,
    details: { reporterType: csa.reporterType, isSwornOfficer: csa.isSwornOfficer },
  });
  return csa;
}

export async function deactivateCsa(agencyId: string, userId: string, actorId: string) {
  requireModule();
  const existing = await cleryActStore.getCsa(agencyId, userId);
  if (!existing) throw new Error("NOT_FOUND");
  const now = new Date().toISOString();
  await cleryActStore.putCsa({ ...existing, activeTo: now });
  await audit({
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CLERY_CSA_DEACTIVATED,
    resourceId: userId,
    details: {},
  });
}

export async function listZonesWithConfig(agencyId: string) {
  requireModule();
  const [locations, configs] = await Promise.all([
    qrLocations.listByAgency(agencyId, { vertical: "campus", active: true }),
    cleryActStore.listZones(agencyId),
  ]);
  const byRcli = new Map(configs.map((c) => [c.rcli, c]));
  const zones = locations.map((loc) => ({
    rcli: loc.rcli,
    locationName: loc.locationName,
    building: loc.building,
    zoneCode: loc.zoneCode,
    config: byRcli.get(loc.rcli) ?? null,
  }));
  const configured = zones.filter((z) => z.config).length;
  return { zones, configured, total: zones.length, missing: zones.length - configured };
}

export async function patchZone(
  agencyId: string,
  rcli: string,
  actorId: string,
  body: CleryZonePatchBody,
): Promise<CleryZoneConfig> {
  requireModule();
  const loc = await qrLocations.getByRcli(rcli);
  if (!loc || loc.agencyId !== agencyId) throw new Error("NOT_FOUND");
  const now = new Date().toISOString();
  const zone: CleryZoneConfig = {
    rcli,
    agencyId,
    cleryGeography: body.cleryGeography,
    buildingName: body.buildingName,
    isResidentialFacility: body.isResidentialFacility,
    cleryBuildingCode: body.cleryBuildingCode,
    configuredBy: actorId,
    configuredAt: now,
    notes: body.notes,
  };
  await cleryActStore.putZone(zone);
  await audit({
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CLERY_ZONE_CONFIGURED,
    resourceId: rcli,
    details: { cleryGeography: zone.cleryGeography, isResidentialFacility: zone.isResidentialFacility },
  });
  return zone;
}

export async function savePublicSettings(
  agencyId: string,
  actorId: string,
  patch: Partial<CleryPublicSettings>,
): Promise<CleryPublicSettings> {
  requireModule();
  const existing = await cleryActStore.getPublicSettings(agencyId);
  const agency = await agencies.get(agencyId);
  const next: CleryPublicSettings = {
    agencyId,
    institutionName: patch.institutionName || existing?.institutionName || agency?.name || agencyId,
    publicContactName: patch.publicContactName ?? existing?.publicContactName,
    publicContactEmail: patch.publicContactEmail ?? existing?.publicContactEmail,
    publicContactPhone: patch.publicContactPhone ?? existing?.publicContactPhone,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  };
  await cleryActStore.putPublicSettings(next);
  return next;
}

export async function getAsrPreview(agencyId: string, reportYear: number) {
  requireModule();
  const years = coverageYearsForAsr(reportYear);
  const records = await cleryActStore.listRecords(agencyId);
  const statistics = generateAsrStatistics(records, years);
  const settings = await cleryActStore.getPublicSettings(agencyId);
  const agency = await agencies.get(agencyId);
  const institutionName = settings?.institutionName || agency?.name || agencyId;
  const policies = await cleryActStore.listPolicies(agencyId, reportYear);
  const report = await cleryActStore.getAsrReport(agencyId, reportYear);
  return {
    reportYear,
    coverageYears: years,
    publishDeadline: asrPublishDeadlineIso(reportYear),
    disclaimer: formatAsrDisclaimer(institutionName),
    coordinatorNotice:
      "These statistics are generated from RC data. The Clery Coordinator is responsible for reviewing all figures before publication.",
    statistics,
    policies: Object.fromEntries(policies.map((p) => [p.section, p.body])),
    report,
  };
}

export async function generateAsrArtifacts(opts: {
  agencyId: string;
  reportYear: number;
  actorId: string;
}) {
  requireModule();
  const preview = await getAsrPreview(opts.agencyId, opts.reportYear);
  const now = new Date().toISOString();
  const reportId = makeId("cleryasr");
  await cleryActStore.putAsrReport({
    agencyId: opts.agencyId,
    sk: `ASR#${opts.reportYear}`,
    reportId,
    reportYear: opts.reportYear,
    coverageYears: preview.coverageYears,
    publishDeadline: preview.publishDeadline,
    status: "DRAFT",
    generatedBy: opts.actorId,
    generatedAt: now,
    updatedAt: now,
  });
  await audit({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CLERY_ASR_GENERATED,
    resourceId: String(opts.reportYear),
    details: { coverageYears: preview.coverageYears },
  });
  return preview;
}

export async function saveAsrPolicy(
  agencyId: string,
  reportYear: number,
  section: string,
  body: string,
  actorId: string,
) {
  requireModule();
  await cleryActStore.putPolicy({
    agencyId,
    sk: `POL#${reportYear}#${section}`,
    reportYear,
    section,
    body,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

export function buildAsrPdf(opts: {
  institutionName: string;
  reportYear: number;
  coverageYears: [number, number, number];
  statistics: ReturnType<typeof generateAsrStatistics>;
}): Promise<Buffer> {
  const disclaimer = formatAsrDisclaimer(opts.institutionName);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).text(`Annual Security Report — ${opts.institutionName}`);
    doc.font("Helvetica").fontSize(9).text(`Publication year ${opts.reportYear} · Coverage ${opts.coverageYears.join(", ")}`);
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#64748B").text(disclaimer, { align: "left" });
    doc.moveDown(0.6).fillColor("#0F172A").fontSize(9);
    doc.font("Helvetica-Bold").text("CRIMINAL OFFENSES");
    doc.font("Helvetica").fontSize(8);
    doc.text("OC = On Campus (total) · RES = Residential (subset of OC) · NC = Non-Campus · PP = Public Property");
    doc.moveDown(0.4);
    for (const row of opts.statistics.offenses) {
      doc.text(
        `${row.calendarYear} ${CLERY_OFFENSE_DISPLAY_NAMES[row.offenseCategory]}  OC ${row.onCampus}  RES ${row.onCampusResidential}  NC ${row.nonCampus}  PP ${row.publicProperty}  Unfounded ${row.unfounded}`,
      );
    }
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(9).text("VAWA OFFENSES");
    doc.font("Helvetica").fontSize(8);
    for (const row of opts.statistics.vawa) {
      doc.text(
        `${row.calendarYear} ${row.offenseType}  OC ${row.onCampus}  RES ${row.onCampusResidential}  NC ${row.nonCampus}  PP ${row.publicProperty}`,
      );
    }
    doc.end();
  });
}

export function buildEdExportCsv(institutionName: string, reportYear: number, stats: ReturnType<typeof generateAsrStatistics>) {
  return asrStatisticsToEdSurveyCsv(institutionName, reportYear, stats);
}

export async function recordTimelyWarning(opts: {
  agencyId: string;
  recordId: string;
  actorId: string;
  required: boolean;
  declinedReason?: string;
  alertId?: string;
}): Promise<CleryRecord> {
  requireModule();
  const existing = await cleryActStore.getRecord(opts.agencyId, opts.recordId);
  if (!existing) throw new Error("NOT_FOUND");
  const now = new Date().toISOString();
  const updated: CleryRecord = {
    ...existing,
    timelyWarningAssessed: true,
    timelyWarningRequired: opts.required,
    timelyWarningDeclinedReason: opts.required ? undefined : opts.declinedReason,
    timelyWarningIssuedAt: opts.required ? now : existing.timelyWarningIssuedAt,
    timelyWarningAlertId: opts.alertId ?? existing.timelyWarningAlertId,
    updatedAt: now,
  };
  await cleryActStore.putRecord(updated);
  await audit({
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: opts.required
      ? AUDIT_EVENT_TYPES.CLERY_TIMELY_WARNING_ISSUED
      : AUDIT_EVENT_TYPES.CLERY_TIMELY_WARNING_DECLINED,
    resourceId: opts.recordId,
    details: {
      required: opts.required,
      declinedReason: opts.declinedReason,
      alertId: opts.alertId,
    },
  });
  return updated;
}

export async function getComplianceDashboard(agencyId: string, campusCode: string) {
  requireModule();
  const now = new Date();
  const reportYear = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const [records, zones, csas, asr] = await Promise.all([
    listCleryRecords(agencyId),
    listZonesWithConfig(agencyId),
    cleryActStore.listCsa(agencyId),
    cleryActStore.getAsrReport(agencyId, reportYear),
  ]);
  const pendingReview = records.filter((r) => r.status === "PENDING_REVIEW" || r.status === "PENDING_INFORMATION");
  const overdue = records.filter((r) => r.dailyCrimeLogOverdue && r.status !== "EXCLUDED");
  const trainingExpired = csas.filter(
    (c) => c.trainingExpiresAt && Date.parse(c.trainingExpiresAt) < now.getTime(),
  );
  return {
    campusCode,
    pendingReviewCount: pendingReview.length,
    overdueDclCount: overdue.length,
    classifiedCount: records.filter((r) => r.status === "CLASSIFIED").length,
    unfoundedCount: records.filter((r) => r.status === "UNFOUNDED").length,
    zoneConfig: { configured: zones.configured, total: zones.total, missing: zones.missing },
    csaCount: csas.length,
    csaTrainingExpired: trainingExpired.length,
    asr: {
      reportYear,
      publishDeadline: asrPublishDeadlineIso(reportYear),
      status: (asr?.status ?? "DRAFT") as CleryAsrStatus,
    },
    publicCrimeLogPath: `/crime-log/${campusCode.toLowerCase()}`,
  };
}
