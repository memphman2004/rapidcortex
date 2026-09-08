import type { PhysicalSecurityProviderId } from "rapid-cortex-shared";
import { PHYSICAL_SECURITY_COMMANDS_NOT_IMPLEMENTED } from "rapid-cortex-shared";

export class PhysicalSecurityCommandNotImplementedError extends Error {
  readonly statusCode = 501;
  constructor(provider: PhysicalSecurityProviderId) {
    super(`${PHYSICAL_SECURITY_COMMANDS_NOT_IMPLEMENTED} Provider=${provider}`);
    this.name = "PhysicalSecurityCommandNotImplementedError";
  }
}

export interface PhysicalSecurityProvider {
  getProviderInfo(): { id: PhysicalSecurityProviderId; name: string };
  lockDoors(agencyId: string, doorIds: string[], approvalToken: string): Promise<never>;
  unlockDoors(agencyId: string, doorIds: string[], approvalToken: string): Promise<never>;
  grantTemporaryAccess(
    agencyId: string,
    credentialId: string,
    doorIds: string[],
    durationMinutes: number,
    approvalToken: string,
  ): Promise<never>;
  revokeCredential(agencyId: string, credentialId: string, approvalToken: string): Promise<never>;
  acknowledgeFireAlarm(agencyId: string, alarmId: string, resolution: string): Promise<never>;
}

function reject(id: PhysicalSecurityProviderId): never {
  throw new PhysicalSecurityCommandNotImplementedError(id);
}

export const mockPhysicalSecurityProvider: PhysicalSecurityProvider = {
  getProviderInfo: () => ({ id: "mock", name: "Mock physical security (ingest only)" }),
  lockDoors: () => reject("mock"),
  unlockDoors: () => reject("mock"),
  grantTemporaryAccess: () => reject("mock"),
  revokeCredential: () => reject("mock"),
  acknowledgeFireAlarm: () => reject("mock"),
};

export const genetecSecurityCenterProvider: PhysicalSecurityProvider = {
  getProviderInfo: () => ({ id: "genetec-security-center", name: "Genetec Security Center" }),
  lockDoors: () => reject("genetec-security-center"),
  unlockDoors: () => reject("genetec-security-center"),
  grantTemporaryAccess: () => reject("genetec-security-center"),
  revokeCredential: () => reject("genetec-security-center"),
  acknowledgeFireAlarm: () => reject("genetec-security-center"),
};

export const honeywellProWatchProvider: PhysicalSecurityProvider = {
  getProviderInfo: () => ({ id: "honeywell-prowatch", name: "Honeywell Pro-Watch" }),
  lockDoors: () => reject("honeywell-prowatch"),
  unlockDoors: () => reject("honeywell-prowatch"),
  grantTemporaryAccess: () => reject("honeywell-prowatch"),
  revokeCredential: () => reject("honeywell-prowatch"),
  acknowledgeFireAlarm: () => reject("honeywell-prowatch"),
};

export function getPhysicalSecurityProvider(id: PhysicalSecurityProviderId): PhysicalSecurityProvider {
  if (id === "genetec-security-center") return genetecSecurityCenterProvider;
  if (id === "honeywell-prowatch") return honeywellProWatchProvider;
  return mockPhysicalSecurityProvider;
}
