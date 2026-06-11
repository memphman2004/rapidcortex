import type { PublicReportSubmitInput, QRNFCRecord, ReportMedium } from "rapid-cortex-shared";
import { createCampusIncident } from "../campus/campus-incident-service.js";
import { createVenueQrIncident } from "../venue/venue-incident-service.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { buildRetentionFields, buildIncidentDedupe } from "../lib/retentionPolicy.js";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { Incident } from "rapid-cortex-shared";

const incidents = new IncidentRepository();
const auditRepo = new AuditRepository();
const agencies = new AgencyRepository();

function extractOrgCode(agencyId: string, vertical: QRNFCRecord["vertical"]): string {
  const raw = agencyId.trim();
  if (vertical === "campus") {
    const m = raw.match(/(?:test-)?campus-(.+)$/i);
    return (m?.[1] ?? raw).toUpperCase();
  }
  if (vertical === "venue") {
    const m = raw.match(/(?:test-)?venue-(.+)$/i);
    return (m?.[1] ?? raw).toUpperCase();
  }
  return raw.split("-").slice(1).join("-").toUpperCase() || raw.toUpperCase();
}

async function create911Incident(
  record: QRNFCRecord,
  input: PublicReportSubmitInput,
  medium: ReportMedium,
): Promise<string> {
  const now = new Date().toISOString();
  const incidentId = makeId("inc");
  const title = input.message.trim().slice(0, 120) || `Public report — ${record.name}`;
  const incident: Incident = {
    incidentId,
    agencyId: record.agencyId,
    title,
    category: "unknown",
    urgency: "moderate",
    status: "active",
    source: "manual",
    confidence: null,
    escalationFlag: false,
    summary: input.message.trim(),
    createdAt: now,
    updatedAt: now,
    callerAddressLine: input.locationNote?.trim() || record.zoneName || null,
    callerAddressNormalized: null,
  };

  const tenant = await agencies.get(record.agencyId);
  const ret = buildRetentionFields("incident", {
    agencyConfig: tenant?.config,
    anchorIso: now,
    policyId: env.defaultRetentionPolicyId,
    dedupe: buildIncidentDedupe(incidentId),
    envDefaults: env,
  });
  Object.assign(incident, { ...ret, legalHold: false });
  await incidents.create(incident);

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: record.agencyId,
    incidentId,
    actorId: "public-report",
    type: AUDIT_EVENT_TYPES.INCIDENT_CREATED,
    details: { source: medium, qrId: record.qrId, vertical: record.vertical },
    createdAt: now,
    resourceType: "incident",
    resourceId: incidentId,
  });

  return incidentId;
}

export async function createIncidentFromQrNfcReport(
  record: QRNFCRecord,
  input: PublicReportSubmitInput,
): Promise<string> {
  const medium = input.medium;
  const description = input.message.trim();
  const zone = input.locationNote?.trim() || record.zoneName || record.name;
  const isAnonymous = record.reportType === "anonymous";
  const reporterName = isAnonymous ? undefined : input.reporterName;
  const reporterPhone = isAnonymous ? undefined : input.reporterPhone;

  if (record.vertical === "campus") {
    const campusCode = extractOrgCode(record.agencyId, "campus");
    const incident = await createCampusIncident(
      {
        campusCode,
        buildingCode: record.zoneId ?? "UNKNOWN",
        roomCode: record.zoneId ?? "QR",
        zoneCode: record.zoneId ?? "QR",
        qrRcli: record.qrId,
        qrLocationName: record.name,
        type: "security",
        source: "qr",
        description: description || `Report at ${zone}`,
        isAnonymous,
        confidential: false,
        phoneNumber: reporterPhone ?? null,
        photoDataUrl: null,
      },
      campusCode,
      undefined,
    );
    return incident.id;
  }

  if (record.vertical === "venue") {
    const venueCode = extractOrgCode(record.agencyId, "venue");
    const incident = await createVenueQrIncident({
      venueCode,
      agencyId: record.agencyId,
      rcli: record.qrId,
      locationName: record.name,
      zoneCode: record.zoneId ?? "QR",
      building: record.zoneName,
      floor: undefined,
      helpType: "safety",
      description: description || `Report at ${zone}`,
      isAnonymous,
      reporterName,
      reporterPhone,
      mediaKeys: input.mediaKeys ?? [],
    });
    return incident.incidentId;
  }

  return create911Incident(record, input, medium);
}
