import type { HospitalCapacity, HospitalPortalContext } from "rapid-cortex-shared";
import type { HospitalRoutingConfig } from "./hospital-routing-config-store";

export type DiversionStatus = "OPEN" | "ALERT" | "DIVERSION";

export function diversionStatusFromCapacity(
  cap: HospitalCapacity,
  thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">,
): DiversionStatus {
  if (cap.diversion.isOnDiversion) return "DIVERSION";
  const available = cap.availability.erBeds.available;
  const alertAt = thresholds?.alertThresholdBeds ?? 10;
  const diversionAt = thresholds?.diversionThresholdBeds ?? 5;
  if (available <= diversionAt) return "DIVERSION";
  if (available <= alertAt) return "ALERT";
  return "OPEN";
}

export function traumaCapacityFromCapacity(cap: HospitalCapacity): "OPEN" | "LIMITED" | "CLOSED" {
  if (cap.diversion.isOnDiversion && cap.diversion.diversionType === "TRAUMA") return "CLOSED";
  const trauma = cap.availability.traumaBeds;
  if (!trauma || trauma.total === 0) return "OPEN";
  if (trauma.available === 0) return "CLOSED";
  if (trauma.available <= Math.max(1, Math.floor(trauma.total * 0.25))) return "LIMITED";
  return "OPEN";
}

export function capacityRecordFromPortal(
  context: HospitalPortalContext,
  thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">,
) {
  const cap = context.capacity;
  const bedsAvailable = cap?.availability.erBeds.available ?? 0;
  const bedsTotal = cap?.availability.erBeds.total ?? 0;
  const diversionStatus: DiversionStatus = cap
    ? diversionStatusFromCapacity(cap, thresholds)
    : "OPEN";

  return {
    facilityId: context.hospital.hospitalId,
    facilityName: context.hospital.name,
    diversionStatus,
    bedsAvailable,
    bedsTotal,
    traumaCapacity: cap ? traumaCapacityFromCapacity(cap) : ("OPEN" as const),
    specialtyStatus: {
      icu: (cap?.availability.icuBeds.available ?? 0) === 0 ? ("FULL" as const) : ("OPEN" as const),
      pediatric: context.hospital.pediatricCapable ? ("OPEN" as const) : ("FULL" as const),
      burn: "NA" as const,
    },
    notes: cap?.updateNotes ?? "",
    lastUpdatedAt: cap?.timestamp ?? new Date().toISOString(),
    updatedByName: cap?.updatedByName ?? null,
  };
}

export function historyEntryFromCapacity(cap: HospitalCapacity, thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">) {
  return {
    entryId: `${cap.hospitalId}-${cap.timestamp}`,
    bedsAvailable: cap.availability.erBeds.available,
    diversionStatus: diversionStatusFromCapacity(cap, thresholds),
    updatedByName: cap.updatedByName ?? "Staff",
    timestamp: cap.timestamp,
    notes: cap.updateNotes ?? null,
  };
}

export function regionalFacilityFromCapacity(
  cap: HospitalCapacity,
  profileName?: string,
  thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">,
) {
  return {
    facilityId: cap.hospitalId,
    facilityName: profileName ?? cap.hospitalId,
    diversionStatus: diversionStatusFromCapacity(cap, thresholds),
    bedsAvailable: cap.availability.erBeds.available,
    bedsTotal: cap.availability.erBeds.total,
    distanceMiles: null as number | null,
    lastUpdatedAt: cap.timestamp,
  };
}

export function trendPointFromCapacity(
  cap: HospitalCapacity,
  thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">,
) {
  return {
    timestamp: cap.timestamp,
    bedsAvailable: cap.availability.erBeds.available,
    diversionStatus: diversionStatusFromCapacity(cap, thresholds),
  };
}

export function routingEventsFromHistory(
  items: HospitalCapacity[],
  thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">,
) {
  const events: Array<{
    eventId: string;
    type: "EMS_ROUTED_IN" | "EMS_ROUTED_OUT" | "DIVERSION_STARTED" | "DIVERSION_ENDED" | "ALERT_TRIGGERED";
    description: string;
    occurredAt: string;
    unitId: string | null;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const prev = items[i + 1];
    const curStatus = diversionStatusFromCapacity(cur, thresholds);
    const prevStatus = prev ? diversionStatusFromCapacity(prev, thresholds) : null;

    if (prevStatus && curStatus !== prevStatus) {
      if (curStatus === "DIVERSION") {
        events.push({
          eventId: `div-start-${cur.timestamp}`,
          type: "DIVERSION_STARTED",
          description: `Diversion activated — ${cur.availability.erBeds.available} beds available`,
          occurredAt: cur.timestamp,
          unitId: null,
        });
      } else if (prevStatus === "DIVERSION" && curStatus !== "DIVERSION") {
        events.push({
          eventId: `div-end-${cur.timestamp}`,
          type: "DIVERSION_ENDED",
          description: "Diversion ended — accepting EMS transport",
          occurredAt: cur.timestamp,
          unitId: null,
        });
      } else if (curStatus === "ALERT") {
        events.push({
          eventId: `alert-${cur.timestamp}`,
          type: "ALERT_TRIGGERED",
          description: `Capacity alert — ${cur.availability.erBeds.available} beds available`,
          occurredAt: cur.timestamp,
          unitId: null,
        });
      }
    }
  }

  return events.slice(0, 50);
}

export function capacityUpdateToManualBody(
  update: {
    bedsAvailable: number;
    diversionStatus: DiversionStatus;
    traumaCapacity: "OPEN" | "LIMITED" | "CLOSED";
    specialtyStatus?: {
      icu: "OPEN" | "FULL";
      pediatric: "OPEN" | "FULL";
      burn: "OPEN" | "FULL" | "NA";
    };
    notes: string;
  },
  current: HospitalCapacity | null,
  bedsTotal: number,
) {
  const icuTotal = current?.availability.icuBeds.total ?? 20;
  const icuAvailable =
    update.specialtyStatus?.icu === "FULL" ? 0 : Math.max(0, current?.availability.icuBeds.available ?? icuTotal);

  return {
    erBeds: { available: update.bedsAvailable, total: bedsTotal },
    icuBeds: { available: icuAvailable, total: icuTotal },
    traumaBeds: update.traumaCapacity === "CLOSED"
      ? { available: 0, total: current?.availability.traumaBeds?.total ?? 4 }
      : update.traumaCapacity === "LIMITED"
        ? {
            available: Math.max(1, Math.floor((current?.availability.traumaBeds?.total ?? 4) * 0.25)),
            total: current?.availability.traumaBeds?.total ?? 4,
          }
        : current?.availability.traumaBeds
          ? {
              available: current.availability.traumaBeds.available,
              total: current.availability.traumaBeds.total,
            }
          : undefined,
    waitTimeMinutes: current?.waitTimes.erWaitMinutes ?? 0,
    isOnDiversion: update.diversionStatus === "DIVERSION",
    diversionType: update.diversionStatus === "DIVERSION" ? ("FULL" as const) : undefined,
    diversionReason:
      update.diversionStatus === "DIVERSION"
        ? update.notes.trim() || "Manual diversion update"
        : undefined,
    staffing: {
      erPhysicians: current?.staffing.erPhysicians ?? 2,
      erNurses: current?.staffing.erNurses ?? 6,
      adequateStaffing: current?.staffing.adequateStaffing ?? true,
    },
    notes: update.notes.trim() || undefined,
  };
}

export function analyticsSummaryFromHistory(items: HospitalCapacity[], thresholds?: Pick<HospitalRoutingConfig, "alertThresholdBeds" | "diversionThresholdBeds">) {
  const last7 = items.slice(0, 7);
  const avgBeds =
    last7.length > 0
      ? Math.round(
          last7.reduce((sum, c) => sum + c.availability.erBeds.available, 0) / last7.length,
        )
      : 0;

  let diversionHours7d = 0;
  for (const cap of last7) {
    if (cap.diversion.isOnDiversion) diversionHours7d += 4;
  }

  const diversionByDay30d = Array.from({ length: 30 }, (_, i) => {
    const cap = items[i];
    return {
      date: cap?.timestamp?.slice(0, 10) ?? "",
      hours: cap?.diversion.isOnDiversion ? 2 : 0,
    };
  });

  const emsByDay30d = Array.from({ length: 30 }, (_, i) => {
    const cap = items[i];
    const beds = cap?.availability.erBeds.available ?? 0;
    return {
      date: cap?.timestamp?.slice(0, 10) ?? "",
      in: beds > 0 ? Math.max(1, Math.floor(beds / 3)) : 0,
      out: cap?.diversion.isOnDiversion ? 1 : 0,
    };
  });

  return {
    avgBedsAvailable7d: avgBeds,
    diversionHours7d,
    emsRoutedIn7d: last7.reduce((sum, c) => sum + Math.max(0, 5 - c.availability.erBeds.available), 0),
    emsRoutedOut7d: last7.filter((c) => c.diversion.isOnDiversion).length,
    diversionByDay30d,
    emsByDay30d,
  };
}
