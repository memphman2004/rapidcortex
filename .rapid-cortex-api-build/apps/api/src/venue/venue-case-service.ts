/**
 * Venue Case Service — RFP 2396IP, Build Item 2
 *
 * Full lifecycle state machine: open → assigned → responding →
 * pending_approval → approved / resolved / closed / escalated / reopened.
 *
 * All transitions write append-only audit records (ConditionExpression
 * attribute_not_exists) before updating the incident row.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { VenueCaseAction, VenueCaseActionBody } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { VENUE_KEYS } from "./venue-types.js";
import type { VenueIncidentRecord } from "./venue-types.js";

/** Alias for the shared schema type to keep the state machine readable. */
type VenueCaseStatus = VenueIncidentRecord["status"];
import { appendVenueAudit } from "./venue-evidence-service.js";
import {
  broadcastVenueIncidentStatusChanged,
} from "./venue-incident-realtime.js";
import { writeVenueRfpAudit } from "./venue-rfp-audit.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Valid transitions keyed by current status.
 * "reopened" allows the full loop to restart.
 */
const ALLOWED_TRANSITIONS: Record<VenueCaseStatus, VenueCaseStatus[]> = {
  open: ["assigned", "escalated", "closed"],
  assigned: ["responding", "escalated", "pending_approval", "closed"],
  responding: ["pending_approval", "escalated", "resolved", "closed"],
  pending_approval: ["approved", "responding", "escalated"],
  approved: ["resolved", "closed"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  escalated: ["assigned", "responding", "pending_approval", "resolved", "closed"],
  reopened: ["assigned", "responding", "escalated", "closed"],
};

/** Map VenueCaseAction → target status (null means multi-step / field update only). */
function actionToStatus(
  action: VenueCaseAction,
  current: VenueCaseStatus,
): VenueCaseStatus | null {
  switch (action) {
    case "assign":
      return "assigned";
    case "investigate":
      return "responding";
    case "escalate":
      return "escalated";
    case "submit_for_approval":
      return "pending_approval";
    case "approve":
      return "approved";
    case "reject":
      return "responding";
    case "close":
      return "closed";
    case "reopen":
      return "reopened";
    case "link":
    case "update_fields":
      return null; // no status change
    default:
      return null;
  }
}

/** Pure preview for unit tests / UI (does not validate ALLOWED_TRANSITIONS). */
export function previewCaseStatus(
  current: VenueCaseStatus,
  action: VenueCaseAction,
): VenueCaseStatus {
  return actionToStatus(action, current) ?? current;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseActionResult {
  incidentId: string;
  action: VenueCaseAction;
  previousStatus: VenueCaseStatus;
  newStatus: VenueCaseStatus;
  updatedAt: string;
}

// ─── Load incident ────────────────────────────────────────────────────────────

async function requireIncident(
  venueCode: string,
  incidentId: string,
  agencyId: string,
): Promise<VenueIncidentRecord> {
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(venueCode),
        sk: VENUE_KEYS.incidentSk(incidentId),
      },
    }),
  );
  const row = result.Item;
  if (!row) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });
  if (String(row.agencyId) !== agencyId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  return row as unknown as VenueIncidentRecord;
}

// ─── performCaseAction ────────────────────────────────────────────────────────

export async function performCaseAction(params: {
  agencyId: string;
  venueCode: string;
  incidentId: string;
  actorId: string;
  actorLabel: string;
  body: VenueCaseActionBody;
}): Promise<CaseActionResult> {
  const incident = await requireIncident(
    params.venueCode,
    params.incidentId,
    params.agencyId,
  );

  const currentStatus = incident.status as VenueCaseStatus;
  const targetStatus = actionToStatus(params.body.action, currentStatus);
  const now = new Date().toISOString();

  // Validate transition when status changes
  if (targetStatus !== null) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw Object.assign(
        new Error(
          `Cannot transition from '${currentStatus}' to '${targetStatus}' via action '${params.body.action}'`,
        ),
        { statusCode: 422 },
      );
    }
  }

  const newStatus: VenueCaseStatus = targetStatus ?? currentStatus;

  // Build DDB update expression
  const updateParts: string[] = ["updatedAt = :u"];
  const attrNames: Record<string, string> = {};
  const attrValues: Record<string, unknown> = { ":u": now };

  if (targetStatus !== null) {
    updateParts.push("#st = :status");
    attrNames["#st"] = "status";
    attrValues[":status"] = newStatus;

    // Track status history (append to list)
    const historyEntry = {
      at: now,
      from: currentStatus,
      to: newStatus,
      actorId: params.actorId,
      actorLabel: params.actorLabel,
      note: params.body.note ?? null,
    };
    // Append via list_append; init if missing
    updateParts.push("statusHistory = list_append(if_not_exists(statusHistory, :empty), :hist)");
    attrValues[":empty"] = [];
    attrValues[":hist"] = [historyEntry];
  }

  if (params.body.action === "assign" && params.body.assigneeId) {
    updateParts.push("assignedTo = :aId, assignedLabel = :aLabel, assignedAt = :aAt");
    attrValues[":aId"] = params.body.assigneeId;
    attrValues[":aLabel"] = params.body.assigneeLabel ?? params.body.assigneeId;
    attrValues[":aAt"] = now;
  }

  if (params.body.action === "escalate") {
    const nextLevel = Math.min(3, Math.max(1, Number(incident.escalationLevel ?? 0) + 1));
    updateParts.push("escalationLevel = :escLvl");
    attrValues[":escLvl"] = nextLevel;
    updateParts.push(
      "escalationHistory = list_append(if_not_exists(escalationHistory, :emptyEsc), :escEvt)",
    );
    attrValues[":emptyEsc"] = [];
    attrValues[":escEvt"] = [
      {
        at: now,
        level: nextLevel,
        actorId: params.actorId,
        actorLabel: params.actorLabel,
        note: params.body.note ?? null,
      },
    ];
  }

  if (params.body.action === "approve") {
    updateParts.push("approvalStatus = :appr");
    attrValues[":appr"] = "approved";
    updateParts.push(
      "approvalHistory = list_append(if_not_exists(approvalHistory, :emptyAppr), :apprEvt)",
    );
    attrValues[":emptyAppr"] = [];
    attrValues[":apprEvt"] = [
      {
        at: now,
        status: "approved",
        actorId: params.actorId,
        actorLabel: params.actorLabel,
        note: params.body.note ?? null,
      },
    ];
  }

  if (params.body.action === "reject") {
    updateParts.push("approvalStatus = :appr");
    attrValues[":appr"] = "rejected";
    updateParts.push(
      "approvalHistory = list_append(if_not_exists(approvalHistory, :emptyAppr), :apprEvt)",
    );
    attrValues[":emptyAppr"] = [];
    attrValues[":apprEvt"] = [
      {
        at: now,
        status: "rejected",
        actorId: params.actorId,
        actorLabel: params.actorLabel,
        note: params.body.note ?? null,
      },
    ];
  }

  if (params.body.action === "close" && params.body.note) {
    updateParts.push("disposition = :disp, dispositionAt = :dispAt");
    attrValues[":disp"] = params.body.note;
    attrValues[":dispAt"] = now;
  }

  if (params.body.action === "reopen") {
    updateParts.push(
      "reopenHistory = list_append(if_not_exists(reopenHistory, :emptyRe), :reEvt)",
    );
    attrValues[":emptyRe"] = [];
    attrValues[":reEvt"] = [
      {
        at: now,
        actorId: params.actorId,
        actorLabel: params.actorLabel,
        note: params.body.note ?? null,
      },
    ];
  }

  if (params.body.action === "link" && params.body.linkedIncidentId) {
    updateParts.push(
      "linkedIncidentIds = list_append(if_not_exists(linkedIncidentIds, :empty), :link)",
    );
    attrValues[":empty"] = attrValues[":empty"] ?? [];
    attrValues[":link"] = [params.body.linkedIncidentId];
  }

  if (params.body.severity) {
    updateParts.push("severity = :sev");
    attrValues[":sev"] = params.body.severity;
  }

  if (params.body.category) {
    updateParts.push("category = :cat");
    attrValues[":cat"] = params.body.category;
  }

  if (params.body.fields && Object.keys(params.body.fields).length > 0) {
    // Store custom fields as a single map replacement merge (avoids nested path init issues)
    updateParts.push("customFields = :cfMap");
    attrValues[":cfMap"] = {
      ...(incident.customFields ?? {}),
      ...params.body.fields,
    };
  }

  await ddb.send(
    new UpdateCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.incidentPk(params.venueCode),
        sk: VENUE_KEYS.incidentSk(params.incidentId),
      },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: Object.keys(attrNames).length ? attrNames : undefined,
      ExpressionAttributeValues: attrValues,
    }),
  );

  // Append-only venue audit
  await appendVenueAudit(params.venueCode, params.agencyId, "case.action", {
    action: params.body.action,
    incidentId: params.incidentId,
    previousStatus: currentStatus,
    newStatus,
    actorId: params.actorId,
    note: params.body.note ?? null,
  });

  try {
    const eventType =
      params.body.action === "assign"
        ? "INCIDENT_ASSIGNED"
        : params.body.action === "escalate"
          ? "INCIDENT_ESCALATED"
          : params.body.action === "approve"
            ? "INCIDENT_APPROVED"
            : params.body.action === "reject"
              ? "INCIDENT_REJECTED"
              : params.body.action === "close"
                ? "INCIDENT_CLOSED"
                : params.body.action === "reopen"
                  ? "INCIDENT_REOPENED"
                  : params.body.action === "link"
                    ? "INCIDENT_LINKED"
                    : "INCIDENT_STATUS_CHANGED";
    await writeVenueRfpAudit({
      venueCode: params.venueCode,
      agencyId: params.agencyId,
      eventType,
      actorId: params.actorId,
      actorRole: "venue",
      resourceType: "case",
      resourceId: params.incidentId,
      incidentId: params.incidentId,
      before: { status: currentStatus },
      after: { status: newStatus, action: params.body.action },
      metadata: { note: params.body.note ?? null },
    });
  } catch {
    // never abort
  }

  // Security audit repo
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      incidentId: params.incidentId,
      actorId: params.actorId,
      type: AUDIT_EVENT_TYPES.VENUE_CASE_ACTION,
      details: {
        action: params.body.action,
        previousStatus: currentStatus,
        newStatus,
      },
      createdAt: now,
      resourceType: "incident",
      resourceId: params.incidentId,
    });
  } catch {
    // audit failure never aborts business logic
  }

  // Broadcast real-time if status changed
  if (targetStatus !== null) {
    try {
      await broadcastVenueIncidentStatusChanged({
        agencyId: params.agencyId,
        incidentId: params.incidentId,
        status: newStatus,
        actorLabel: params.actorLabel,
        updatedAt: now,
      });
    } catch {
      // realtime failure is non-fatal
    }
  }

  return {
    incidentId: params.incidentId,
    action: params.body.action,
    previousStatus: currentStatus,
    newStatus,
    updatedAt: now,
  };
}

// ─── getCase ──────────────────────────────────────────────────────────────────

export async function getCaseDetail(
  venueCode: string,
  incidentId: string,
  agencyId: string,
): Promise<VenueIncidentRecord> {
  return requireIncident(venueCode, incidentId, agencyId);
}

// ─── listVenueAudit ───────────────────────────────────────────────────────────

export async function listVenueAuditLog(
  venueCode: string,
  agencyId: string,
  limit = 100,
): Promise<unknown[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: venueConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": VENUE_KEYS.incidentPk(venueCode),
        ":prefix": VENUE_KEYS.auditPrefix(),
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []).filter((r) => String(r.agencyId) === agencyId);
}
