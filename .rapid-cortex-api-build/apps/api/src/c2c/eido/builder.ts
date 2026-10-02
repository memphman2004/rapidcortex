import { wrapInNIEM } from "../common-codes/niem.js";
import type {
  EidoCaller,
  EidoEnvelope,
  EidoLocation,
  EidoUnitAssignment,
  IncidentPriority,
  IncidentStatus,
  NIEMEnvelope,
  RawCADIncident,
} from "./types.js";

export class EidoBuilder {
  private envelope: EidoEnvelope;

  private constructor(envelope: EidoEnvelope) {
    this.envelope = envelope;
  }

  static fromCADIncident(incident: RawCADIncident, agencyId: string): EidoBuilder {
    const now = new Date().toISOString();
    const raw = incident.rawData;
    const callType = String(raw.callType ?? raw.CallType ?? "OT-UNKNOWN");
    const description = String(raw.callTypeDescription ?? raw.CallTypeDescription ?? callType);
    const city = String(raw.city ?? raw.City ?? "Unknown");
    const state = String(raw.state ?? raw.State ?? "SC").slice(0, 2).toUpperCase();
    const street = String(raw.address ?? raw.street ?? raw.StreetName ?? "Unknown");
    const lat = typeof raw.latitude === "number" ? raw.latitude : undefined;
    const lon = typeof raw.longitude === "number" ? raw.longitude : undefined;
    return new EidoBuilder({
      header: {
        MessageId: crypto.randomUUID(),
        DateTimeSent: now,
        SenderAgencyId: agencyId,
        SenderAgencyName: String(raw.agencyName ?? agencyId),
        RecipientAgencyId: "*",
        SchemaVersion: "APCO-NENA-2.105.1-2017",
        MessageType: "NEW_INCIDENT",
      },
      incident: {
        IncidentId: incident.nativeId,
        CallType: callType,
        CallTypeDescription: description,
        Priority: (["1", "2", "3", "4", "5"].includes(String(raw.priority))
          ? String(raw.priority)
          : "3") as IncidentPriority,
        Status: "PENDING" as IncidentStatus,
        Location: {
          Address: {
            FullAddress: street,
            StreetName: street,
            City: city,
            State: state,
          },
          ...(lat !== undefined && lon !== undefined
            ? { Coordinates: { Latitude: lat, Longitude: lon, DeterminationMethod: "ADDRESS" as const } }
            : {}),
        },
        ReceivedAt: String(raw.receivedAt ?? now),
        UpdatedAt: incident.fetchedAt,
        ExtendedData: { adapterType: incident.adapterType, sourceAgencyId: incident.sourceAgencyId },
      },
    });
  }

  withLocation(loc: EidoLocation): EidoBuilder {
    this.envelope.incident.Location = loc;
    return this;
  }

  withCallerInfo(caller: EidoCaller): EidoBuilder {
    this.envelope.incident.Caller = caller;
    return this;
  }

  withUnits(units: EidoUnitAssignment[]): EidoBuilder {
    this.envelope.incident.Units = units;
    return this;
  }

  withNIEM(): EidoBuilder {
    this.envelope.incident.ExtendedData = {
      ...(this.envelope.incident.ExtendedData ?? {}),
      niemWrapped: true,
    };
    return this;
  }

  build(): EidoEnvelope {
    return structuredClone(this.envelope);
  }

  buildNIEM(): NIEMEnvelope<EidoEnvelope> {
    return wrapInNIEM(this.build(), this.envelope.header.MessageType, this.envelope.header.SenderAgencyId);
  }
}
