import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { normalizeAddress, type CommandSummary, type UserContext } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { agencyPk, dailyMetricsSnapshotTable, dateSk } from "./tables.js";

const incidents = new IncidentRepository();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getCommandSummary(
  user: UserContext,
  opts: { date?: string; range?: string },
): Promise<CommandSummary> {
  const agencyId = user.agencyId!.trim();
  const date = opts.date || todayUtc();
  const range = opts.range || "today";
  const table = dailyMetricsSnapshotTable();

  if (table) {
    const res = await ddb.send(
      new GetCommand({
        TableName: table,
        Key: { pk: agencyPk(agencyId), sk: dateSk(date) },
      }),
    );
    if (res.Item) {
      const item = res.Item as Record<string, unknown>;
      return {
        agencyId,
        date,
        range,
        total911Calls: Number(item.total911Calls ?? 0),
        totalNonEmergencyCalls: Number(item.totalNonEmergencyCalls ?? 0),
        callAssistContainmentRate:
          item.callAssistContainmentRate == null ? null : Number(item.callAssistContainmentRate),
        aiToHumanTransferRate:
          item.aiToHumanTransferRate == null ? null : Number(item.aiToHumanTransferRate),
        averageAnswerTime911Sec:
          item.averageAnswerTime911Sec == null ? null : Number(item.averageAnswerTime911Sec),
        averageAnswerTimeNonEmergencySec:
          item.averageAnswerTimeNonEmergencySec == null
            ? null
            : Number(item.averageAnswerTimeNonEmergencySec),
        translationUsageByLanguage: (item.translationUsageByLanguage as Record<string, number>) ?? {},
        cadWritebackSuccessRate:
          item.cadWritebackSuccessRate == null ? null : Number(item.cadWritebackSuccessRate),
        dispatcherWorkload: (item.dispatcherWorkload as Record<string, number>) ?? {},
        callsByType: (item.callsByType as Record<string, number>) ?? {},
        repeatLocations: (item.repeatLocations as CommandSummary["repeatLocations"]) ?? [],
      };
    }
  }

  // On-demand compute from recent incidents when snapshot missing
  return computeFromIncidents(agencyId, date, range);
}

async function computeFromIncidents(
  agencyId: string,
  date: string,
  range: string,
): Promise<CommandSummary> {
  const since = new Date();
  if (range === "7d") since.setUTCDate(since.getUTCDate() - 7);
  else if (range === "30d") since.setUTCDate(since.getUTCDate() - 30);
  else since.setUTCHours(0, 0, 0, 0);

  let list: Awaited<ReturnType<IncidentRepository["listByAgencySince"]>> = [];
  try {
    list = await incidents.listByAgencySince(agencyId, since.toISOString(), 500);
  } catch {
    list = [];
  }

  const callsByType: Record<string, number> = {};
  const dispatcherWorkload: Record<string, number> = {};
  const addrCounts = new Map<string, { address: string; count: number; type: string; last: string }>();

  for (const inc of list) {
    const t =
      (inc as { type?: string; incidentType?: string }).type ||
      (inc as { incidentType?: string }).incidentType ||
      "other";
    callsByType[t] = (callsByType[t] ?? 0) + 1;
    const disp =
      (inc as { assignedDispatcherId?: string; createdBy?: string }).assignedDispatcherId ||
      (inc as { createdBy?: string }).createdBy ||
      "unknown";
    dispatcherWorkload[disp] = (dispatcherWorkload[disp] ?? 0) + 1;
    const addr =
      (inc as { address?: string; locationText?: string }).address ||
      (inc as { locationText?: string }).locationText ||
      "";
    if (addr) {
      const n = normalizeAddress(addr);
      const prev = addrCounts.get(n);
      const created = (inc as { createdAt?: string }).createdAt ?? "";
      if (!prev) addrCounts.set(n, { address: addr, count: 1, type: t, last: created });
      else {
        prev.count += 1;
        if (created > prev.last) {
          prev.last = created;
          prev.type = t;
        }
      }
    }
  }

  const repeatLocations = [...addrCounts.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([normalizedAddress, v]) => ({
      address: v.address,
      normalizedAddress,
      callCount: v.count,
      dominantType: v.type,
      daysSinceLastCall: v.last
        ? Math.max(0, Math.floor((Date.now() - Date.parse(v.last)) / 86_400_000))
        : null,
    }));

  return {
    agencyId,
    date,
    range,
    total911Calls: list.length,
    totalNonEmergencyCalls: 0,
    callAssistContainmentRate: null,
    aiToHumanTransferRate: null,
    averageAnswerTime911Sec: null,
    averageAnswerTimeNonEmergencySec: null,
    translationUsageByLanguage: {},
    cadWritebackSuccessRate: null,
    dispatcherWorkload,
    callsByType,
    repeatLocations,
  };
}

export async function exportCommandCsv(user: UserContext, opts: { date?: string; range?: string }) {
  const summary = await getCommandSummary(user, opts);
  const lines = [
    "metric,value",
    `total911Calls,${summary.total911Calls}`,
    `totalNonEmergencyCalls,${summary.totalNonEmergencyCalls}`,
    `callAssistContainmentRate,${summary.callAssistContainmentRate ?? ""}`,
    `aiToHumanTransferRate,${summary.aiToHumanTransferRate ?? ""}`,
  ];
  for (const [lang, n] of Object.entries(summary.translationUsageByLanguage)) {
    lines.push(`translation.${lang},${n}`);
  }
  for (const [t, n] of Object.entries(summary.callsByType)) {
    lines.push(`callType.${t},${n}`);
  }
  return lines.join("\n");
}

/** Scheduled aggregator writes a snapshot for one agency. */
export async function writeDailySnapshot(agencyId: string, date: string): Promise<void> {
  const table = dailyMetricsSnapshotTable();
  if (!table) return;
  const summary = await computeFromIncidents(agencyId, date, "today");
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: agencyPk(agencyId),
        sk: dateSk(date),
        ...summary,
        ttl: Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600,
        writtenAt: new Date().toISOString(),
      },
    }),
  );
}

export async function listAgencyIdsFromSnapshots(): Promise<string[]> {
  // Aggregator uses ACTIVE_AGENCY_IDS env when set; otherwise no-op.
  const raw = process.env.ACTIVE_AGENCY_IDS?.trim() ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
