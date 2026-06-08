/**
 * In-process routing config cache for BFF until a dedicated upstream route exists.
 * PATCH merges partial updates; GET returns stored config or defaults.
 */

export type HospitalRoutingConfig = {
  alertThresholdBeds: number;
  diversionThresholdBeds: number;
  autoUpdateDiversionStatus: boolean;
  emsRoutingPriority: Array<{
    facilityId: string;
    facilityName: string;
    priority: number;
    conditions: {
      minBedsAvailable?: number;
      diversionStatuses: Array<"OPEN" | "ALERT">;
      traumaRequired?: boolean;
      specialtyRequired?: string;
    };
  }>;
  notifyEmsOnDiversion: boolean;
  notifyEmsOnAlert: boolean;
  diversionContactNumbers: string[];
};

const DEFAULT_CONFIG: HospitalRoutingConfig = {
  alertThresholdBeds: 10,
  diversionThresholdBeds: 5,
  autoUpdateDiversionStatus: false,
  emsRoutingPriority: [],
  notifyEmsOnDiversion: true,
  notifyEmsOnAlert: false,
  diversionContactNumbers: [],
};

const store = new Map<string, HospitalRoutingConfig>();

export function getHospitalRoutingConfig(agencyId: string): HospitalRoutingConfig {
  return store.get(agencyId) ?? { ...DEFAULT_CONFIG, emsRoutingPriority: [] };
}

export function patchHospitalRoutingConfig(
  agencyId: string,
  patch: Partial<HospitalRoutingConfig>,
): HospitalRoutingConfig {
  const current = getHospitalRoutingConfig(agencyId);
  const next: HospitalRoutingConfig = {
    ...current,
    ...patch,
    emsRoutingPriority: patch.emsRoutingPriority ?? current.emsRoutingPriority,
    diversionContactNumbers: patch.diversionContactNumbers ?? current.diversionContactNumbers,
  };
  store.set(agencyId, next);
  return next;
}
