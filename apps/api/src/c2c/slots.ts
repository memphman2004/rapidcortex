import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  CAD_BRIDGE_SLOTS,
  cadSlotPathToken,
  parseCadSlotPathToken,
  type CADSlot,
  type CADVendor,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

export interface C2cSlotRecord {
  slot: CADSlot;
  label: string;
  vendor: CADVendor;
  enabled: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  /** Secrets Manager ARN. Default: rapid-cortex/c2c/{agencyId}/{slot} */
  credentialsSecretArn: string;
  /** Optional override if the vendor host is not in the secret JSON. */
  baseUrl?: string;
}

export interface C2cAgencySlots {
  agencyId: string;
  slots: C2cSlotRecord[];
  updatedAt: string;
}

export function defaultSlotSecretArn(agencyId: string, slot: CADSlot): string {
  return `rapid-cortex/c2c/${agencyId}/${cadSlotPathToken(slot)}`;
}

const DEFAULT_VENDORS: Record<CADSlot, CADVendor> = {
  CAD_A: "SOUTHERN_SOFTWARE",
  CAD_B: "SOUTHERN_SOFTWARE",
  CAD_C: "CENTRALSQUARE",
  CAD_D: "CENTRALSQUARE",
  CAD_E: "MOTOROLA",
  CAD_F: "TYLER",
  CAD_G: "HEXAGON",
  CAD_H: "SPILLMAN",
};

export function buildDefaultSlots(agencyId: string): C2cSlotRecord[] {
  return CAD_BRIDGE_SLOTS.map((slot) => ({
    slot,
    label: slot.replace("_", " "),
    vendor: DEFAULT_VENDORS[slot],
    enabled: true,
    inboundEnabled: true,
    outboundEnabled: false,
    credentialsSecretArn: defaultSlotSecretArn(agencyId, slot),
  }));
}

function slotsTable(): string {
  return env.c2cAgenciesTable;
}

export async function getAgencySlots(agencyId: string): Promise<C2cAgencySlots> {
  const table = slotsTable();
  if (!table) {
    return { agencyId, slots: buildDefaultSlots(agencyId), updatedAt: new Date().toISOString() };
  }
  const result = await ddb.send(new GetCommand({ TableName: table, Key: { agencyId } }));
  const item = result.Item as C2cAgencySlots | undefined;
  if (item && item.slots?.length === CAD_BRIDGE_SLOTS.length) return item;
  const created: C2cAgencySlots = {
    agencyId,
    slots: buildDefaultSlots(agencyId),
    updatedAt: new Date().toISOString(),
  };
  if (table) {
    await ddb.send(new PutCommand({ TableName: table, Item: created }));
  }
  return created;
}

export async function putAgencySlots(config: C2cAgencySlots): Promise<C2cAgencySlots> {
  const table = slotsTable();
  const next: C2cAgencySlots = { ...config, updatedAt: new Date().toISOString() };
  if (!table) return next;
  await ddb.send(new PutCommand({ TableName: table, Item: next }));
  return next;
}

export async function patchSlot(
  agencyId: string,
  slot: CADSlot,
  patch: Partial<Omit<C2cSlotRecord, "slot">>,
): Promise<C2cAgencySlots> {
  const current = await getAgencySlots(agencyId);
  const slots = current.slots.map((s) => (s.slot === slot ? { ...s, ...patch, slot } : s));
  return putAgencySlots({ agencyId, slots, updatedAt: new Date().toISOString() });
}

export function slotFromPathToken(token: string): CADSlot | null {
  return parseCadSlotPathToken(token);
}

export function isSlotAcceptingInbound(slot: C2cSlotRecord): boolean {
  return slot.enabled && slot.inboundEnabled;
}

export function isSlotAcceptingOutbound(slot: C2cSlotRecord): boolean {
  return slot.enabled && slot.outboundEnabled;
}
