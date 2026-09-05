import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { broadcastToAgency } from "../lib/websocket/send-message.js";

export type IncidentCreatedBroadcastPayload = {
  incidentId: string;
  zoneCode: string;
  zoneLabel: string;
  type: string;
  source: string;
  status: string;
  qrRcli?: string;
};

export async function broadcastVenueIncidentCreated(params: {
  agencyId: string;
  incident: IncidentCreatedBroadcastPayload;
  cameras: VenueIncidentCameraSummary[];
}): Promise<void> {
  await broadcastToAgency({
    agencyId: params.agencyId,
    message: {
      type: "incident:created",
      data: {
        incidentId: params.incident.incidentId,
        section: params.incident.zoneCode,
        reportType: params.incident.type,
        location: params.incident.zoneLabel,
        source: params.incident.source,
        status: params.incident.status,
        qrRcli: params.incident.qrRcli,
        cameras: params.cameras,
      },
    },
  });
}

export async function broadcastVenueIncidentUpdate(params: {
  agencyId: string;
  incidentId: string;
  updateId: string;
  message: string;
  actorLabel: string;
  createdAt: string;
}): Promise<void> {
  await broadcastToAgency({
    agencyId: params.agencyId,
    message: {
      type: "incident:updated",
      data: {
        incidentId: params.incidentId,
        updateId: params.updateId,
        message: params.message,
        actorLabel: params.actorLabel,
        createdAt: params.createdAt,
      },
    },
  });
}

export async function broadcastVenueIncidentStatusChanged(params: {
  agencyId: string;
  incidentId: string;
  status: string;
  actorLabel: string;
  updatedAt: string;
}): Promise<void> {
  await broadcastToAgency({
    agencyId: params.agencyId,
    message: {
      type: "status:changed",
      data: {
        incidentId: params.incidentId,
        status: params.status,
        actorLabel: params.actorLabel,
        updatedAt: params.updatedAt,
      },
    },
  });
}
