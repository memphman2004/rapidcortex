import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  normalizeAddress,
  type ContextCard,
  type PutSafetyFlagBody,
  type UserContext,
} from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import {
  addrSk,
  agencyPk,
  contextAddressCacheTable,
  contextSafetyFlagsTable,
  locationSk,
  vaultLocationIndexTable,
} from "./tables.js";

const incidents = new IncidentRepository();

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export async function resolveContextCard(opts: {
  user: UserContext;
  incidentId: string;
  allowVault: boolean;
}): Promise<ContextCard | null> {
  const agencyId = opts.user.agencyId?.trim();
  if (!agencyId) return null;

  const incident = await incidents.get(opts.incidentId);
  if (!incident || incident.agencyId !== agencyId) return null;

  const address =
    (incident as { address?: string; locationText?: string; callerAddress?: string }).address ||
    (incident as { locationText?: string }).locationText ||
    (incident as { callerAddress?: string }).callerAddress ||
    "";
  const normalized = address ? normalizeAddress(address) : "";
  const phone =
    (incident as { callerPhone?: string; ani?: string; phone?: string }).callerPhone ||
    (incident as { ani?: string }).ani ||
    (incident as { phone?: string }).phone ||
    "";

  const safety = normalized ? await getSafetyFlag(agencyId, normalized) : null;
  const cache = normalized ? await getAddressCache(agencyId, normalized) : null;
  const vaultIdx =
    opts.allowVault && normalized ? await getVaultLocationIndex(agencyId, normalized) : null;

  const related = normalized
    ? await countActiveRelated(agencyId, normalized, opts.incidentId)
    : 0;

  const prior12 = cache?.totalCalls12mo ?? 0;
  const vaultAllTime = vaultIdx?.totalCallCount ?? 0;
  const priorAllTime = Math.max(prior12, vaultAllTime);
  const callsByType = {
    ...(cache?.callsByType ?? {}),
    ...(vaultIdx?.callsByType ?? {}),
  } as Record<string, number>;

  let dataSource: ContextCard["location"]["dataSource"] = "cad_only";
  if (vaultAllTime > 0 && prior12 > 0) dataSource = "cad_and_vault";
  else if (vaultAllTime > 0 && prior12 === 0) dataSource = "vault_only";

  const lastCallDate = cache?.lastCallDate ?? vaultIdx?.lastCallDate ?? null;
  const lastCallType = cache?.lastCallType ?? null;

  const caller = phone
    ? await buildCallerBlock(agencyId, phone, opts.allowVault)
    : undefined;

  return {
    incidentId: opts.incidentId,
    agencyId,
    resolvedAt: new Date().toISOString(),
    location: {
      address: address || "Unknown address",
      normalizedAddress: normalized || "UNKNOWN",
      priorCalls12Months: prior12,
      priorCallsAllTime: priorAllTime,
      callsByType,
      lastCallDate,
      lastCallType,
      daysSinceLastCall: daysBetween(lastCallDate),
      officerSafetyFlag: Boolean(safety?.officerSafetyFlag),
      officerSafetyNote: safety?.officerSafetyNote ?? null,
      activeRelatedIncidents: related,
      dataSource,
      recentCalls: cache?.recentCalls,
    },
    caller,
  };
}

export async function resolveContextCardByAddress(opts: {
  user: UserContext;
  address: string;
  allowVault: boolean;
}): Promise<ContextCard> {
  const agencyId = opts.user.agencyId!.trim();
  const normalized = normalizeAddress(opts.address);
  const safety = await getSafetyFlag(agencyId, normalized);
  const cache = await getAddressCache(agencyId, normalized);
  const vaultIdx = opts.allowVault ? await getVaultLocationIndex(agencyId, normalized) : null;
  const related = await countActiveRelated(agencyId, normalized, "");
  const prior12 = cache?.totalCalls12mo ?? 0;
  const vaultAllTime = vaultIdx?.totalCallCount ?? 0;
  let dataSource: ContextCard["location"]["dataSource"] = "cad_only";
  if (vaultAllTime > 0 && prior12 > 0) dataSource = "cad_and_vault";
  else if (vaultAllTime > 0) dataSource = "vault_only";
  const lastCallDate = cache?.lastCallDate ?? vaultIdx?.lastCallDate ?? null;

  return {
    incidentId: "manual-lookup",
    agencyId,
    resolvedAt: new Date().toISOString(),
    location: {
      address: opts.address,
      normalizedAddress: normalized,
      priorCalls12Months: prior12,
      priorCallsAllTime: Math.max(prior12, vaultAllTime),
      callsByType: { ...(cache?.callsByType ?? {}), ...(vaultIdx?.callsByType ?? {}) },
      lastCallDate,
      lastCallType: cache?.lastCallType ?? null,
      daysSinceLastCall: daysBetween(lastCallDate),
      officerSafetyFlag: Boolean(safety?.officerSafetyFlag),
      officerSafetyNote: safety?.officerSafetyNote ?? null,
      activeRelatedIncidents: related,
      dataSource,
      recentCalls: cache?.recentCalls,
    },
  };
}

export async function putSafetyFlag(
  user: UserContext,
  body: PutSafetyFlagBody,
): Promise<{ normalizedAddress: string }> {
  const table = contextSafetyFlagsTable();
  if (!table) throw new Error("CONTEXT_SAFETY_FLAGS_TABLE not configured");
  const agencyId = user.agencyId!.trim();
  const normalized = normalizeAddress(body.address);
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: agencyPk(agencyId),
        sk: addrSk(normalized),
        agencyId,
        normalizedAddress: normalized,
        officerSafetyFlag: body.officerSafetyFlag,
        officerSafetyNote: body.officerSafetyNote ?? null,
        updatedAt: now,
        updatedBy: user.userId,
      },
    }),
  );
  return { normalizedAddress: normalized };
}

async function getSafetyFlag(agencyId: string, normalized: string) {
  const table = contextSafetyFlagsTable();
  if (!table) return null;
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: agencyPk(agencyId), sk: addrSk(normalized) },
    }),
  );
  return (res.Item as {
    officerSafetyFlag?: boolean;
    officerSafetyNote?: string | null;
  } | null) ?? null;
}

async function getAddressCache(agencyId: string, normalized: string) {
  const table = contextAddressCacheTable();
  if (!table) return null;
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: agencyPk(agencyId), sk: addrSk(normalized) },
    }),
  );
  return (res.Item as {
    totalCalls12mo?: number;
    callsByType?: Record<string, number>;
    lastCallDate?: string;
    lastCallType?: string;
    recentCalls?: Array<{ date: string; type: string; disposition?: string }>;
  } | null) ?? null;
}

async function getVaultLocationIndex(agencyId: string, normalized: string) {
  const table = vaultLocationIndexTable();
  if (!table) return null;
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: agencyPk(agencyId), sk: locationSk(normalized) },
    }),
  );
  return (res.Item as {
    totalCallCount?: number;
    callsByType?: Record<string, number>;
    lastCallDate?: string;
  } | null) ?? null;
}

async function countActiveRelated(
  agencyId: string,
  normalized: string,
  excludeIncidentId: string,
): Promise<number> {
  try {
    const list = await incidents.listByAgencyWithLimit(agencyId, 100);
    return list.filter((inc) => {
      if (excludeIncidentId && inc.incidentId === excludeIncidentId) return false;
      const status = String((inc as { status?: string }).status ?? "").toLowerCase();
      if (status === "closed" || status === "archived") return false;
      const addr =
        (inc as { address?: string; locationText?: string }).address ||
        (inc as { locationText?: string }).locationText ||
        "";
      return addr ? normalizeAddress(addr) === normalized : false;
    }).length;
  } catch {
    return 0;
  }
}

async function buildCallerBlock(agencyId: string, phone: string, _allowVault: boolean) {
  const digits = phone.replace(/\D/g, "");
  let prior = 0;
  let lastCallDate: string | null = null;
  let lastCallType: string | null = null;
  const known = new Set<string>();
  try {
    const list = await incidents.listByAgencyWithLimit(agencyId, 200);
    for (const inc of list) {
      const p =
        (inc as { callerPhone?: string; ani?: string; phone?: string }).callerPhone ||
        (inc as { ani?: string }).ani ||
        (inc as { phone?: string }).phone ||
        "";
      if (p.replace(/\D/g, "") !== digits) continue;
      prior += 1;
      const created = (inc as { createdAt?: string }).createdAt ?? null;
      if (created && (!lastCallDate || created > lastCallDate)) {
        lastCallDate = created;
        lastCallType = (inc as { type?: string; incidentType?: string }).type ??
          (inc as { incidentType?: string }).incidentType ??
          null;
      }
      const addr =
        (inc as { address?: string; locationText?: string }).address ||
        (inc as { locationText?: string }).locationText ||
        "";
      if (addr) known.add(addr);
    }
  } catch {
    /* empty */
  }
  return {
    phone,
    priorCallCount: prior,
    lastCallDate,
    lastCallType,
    knownAddresses: [...known].slice(0, 10),
    agencyNotes: null as string | null,
  };
}

/** Touch cache from live incident activity (best-effort). */
export async function bumpAddressCacheFromIncident(agencyId: string, address: string, callType: string) {
  const table = contextAddressCacheTable();
  if (!table || !address) return;
  const normalized = normalizeAddress(address);
  const existing = await getAddressCache(agencyId, normalized);
  const now = new Date().toISOString();
  const callsByType = { ...(existing?.callsByType ?? {}) };
  callsByType[callType || "other"] = (callsByType[callType || "other"] ?? 0) + 1;
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: agencyPk(agencyId),
        sk: addrSk(normalized),
        agencyId,
        normalizedAddress: normalized,
        totalCalls12mo: (existing?.totalCalls12mo ?? 0) + 1,
        callsByType,
        lastCallDate: now.slice(0, 10),
        lastCallType: callType || "other",
        cachedAt: now,
        ttl: Math.floor(Date.now() / 1000) + 4 * 3600,
      },
    }),
  );
}
