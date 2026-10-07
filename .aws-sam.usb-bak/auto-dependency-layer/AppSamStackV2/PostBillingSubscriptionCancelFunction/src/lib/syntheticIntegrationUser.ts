import type { UserContext } from "rapid-cortex-shared";

/** Stable synthetic user representing an agency-scoped OAuth client credential. */
export function integrationUserFromApiClient(parent: {
  agencyId: string;
  clientId: string;
}): UserContext {
  return {
    userId: `apic_${parent.clientId}`,
    agencyId: parent.agencyId,
    role: "auditor",
    email: `agency-api@${parent.clientId}.internal`,
    accountStatus: "active",
  };
}

/** Synthetic user representing an RC Lite `rclite_*` programmatic key (not Cognito). */
export function integrationUserFromRcLiteKey(parent: {
  agencyId: string;
  keyId: string;
}): UserContext {
  return {
    userId: `rclk_${parent.keyId}`,
    agencyId: parent.agencyId,
    role: "auditor",
    email: `rc-lite@${parent.keyId}.internal`,
    accountStatus: "active",
  };
}
