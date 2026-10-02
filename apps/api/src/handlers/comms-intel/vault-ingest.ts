/**
 * S3-triggered NexiQ Vault CSV ingest processor.
 * Key format: AGENCY#{agencyId}/jobs/{jobId}/{fileName}
 */

import type { S3Handler } from "aws-lambda";
import { BatchWriteCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { normalizeAddress } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import {
  agencyPk,
  jobSk,
  locationSk,
  vaultIncidentsTable,
  vaultIngestionJobsTable,
  vaultLocationIndexTable,
} from "../../comms-intel/tables.js";
import { fetchVaultObjectText } from "../../comms-intel/vault-service.js";

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const mapped = headers.map(mapHeader);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    mapped.forEach((key, idx) => {
      if (key) row[key] = (cols[idx] ?? "").trim();
    });
    if (row.sourceIncidentId || row.address || row.callDate) rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Map vendor / generic headers onto canonical fields. */
function mapHeader(h: string): string {
  const x = h.replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    incidentid: "sourceIncidentId",
    sourceincidentid: "sourceIncidentId",
    callid: "sourceIncidentId",
    cadincidentid: "sourceIncidentId",
    calldate: "callDate",
    date: "callDate",
    incidentdate: "callDate",
    calltime: "callTime",
    time: "callTime",
    calltype: "callType",
    nature: "callType",
    problem: "callType",
    address: "address",
    location: "address",
    fulladdress: "address",
    disposition: "disposition",
    narrative: "narrative",
    comments: "narrative",
    phone: "phone",
    ani: "phone",
    callerphone: "phone",
  };
  return aliases[x] ?? "";
}

export const handler: S3Handler = async (event) => {
  const incidentsTable = vaultIncidentsTable();
  const jobsTable = vaultIngestionJobsTable();
  const indexTable = vaultLocationIndexTable();
  if (!incidentsTable || !jobsTable) {
    console.warn("vault ingest missing table env");
    return;
  }

  for (const rec of event.Records) {
    const bucket = rec.s3.bucket.name;
    const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, " "));
    const m = key.match(/^AGENCY#([^/]+)\/jobs\/([^/]+)\//);
    if (!m) {
      console.warn("vault ingest unexpected key", key);
      continue;
    }
    const agencyId = m[1];
    const jobId = m[2];

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: jobsTable,
          Key: { pk: agencyPk(agencyId), sk: jobSk(jobId) },
          UpdateExpression: "SET #s = :s",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":s": "processing" },
        }),
      );

      const text = await fetchVaultObjectText(bucket, key);
      const rows = parseCsv(text);
      let ok = 0;
      let err = 0;
      let dateStart: string | null = null;
      let dateEnd: string | null = null;
      const locAgg = new Map<
        string,
        { count: number; byType: Record<string, number>; first: string; last: string; raw: string }
      >();

      for (let i = 0; i < rows.length; i += 25) {
        const chunk = rows.slice(i, i + 25);
        const puts = [];
        for (const row of chunk) {
          const sourceIncidentId = row.sourceIncidentId || `row-${i}-${ok + err}`;
          const callDate = (row.callDate || "1970-01-01").slice(0, 10);
          const address = row.address || "";
          const normalized = address ? normalizeAddress(address) : "UNKNOWN";
          const callType = row.callType || "other";
          puts.push({
            PutRequest: {
              Item: {
                pk: agencyPk(agencyId),
                sk: `INC#${callDate}#${sourceIncidentId}`,
                gsi1pk: `ADDR#${normalized}`,
                gsi1sk: `${callDate}#${sourceIncidentId}`,
                agencyId,
                jobId,
                sourceSystem: "generic",
                sourceIncidentId,
                callDate,
                callTime: row.callTime || "",
                callType,
                address,
                normalizedAddress: normalized,
                disposition: row.disposition || "",
                narrative: row.narrative || "",
                phone: row.phone || "",
              },
            },
          });
          ok += 1;
          if (!dateStart || callDate < dateStart) dateStart = callDate;
          if (!dateEnd || callDate > dateEnd) dateEnd = callDate;
          const agg = locAgg.get(normalized) ?? {
            count: 0,
            byType: {},
            first: callDate,
            last: callDate,
            raw: address,
          };
          agg.count += 1;
          agg.byType[callType] = (agg.byType[callType] ?? 0) + 1;
          if (callDate < agg.first) agg.first = callDate;
          if (callDate > agg.last) agg.last = callDate;
          locAgg.set(normalized, agg);
        }
        try {
          await ddb.send(
            new BatchWriteCommand({
              RequestItems: { [incidentsTable]: puts },
            }),
          );
        } catch (e) {
          err += puts.length;
          console.warn("vault batch write failed", e instanceof Error ? e.message : String(e));
        }
      }

      if (indexTable) {
        for (const [normalized, agg] of locAgg) {
          await ddb.send(
            new PutCommand({
              TableName: indexTable,
              Item: {
                pk: agencyPk(agencyId),
                sk: locationSk(normalized),
                agencyId,
                normalizedAddress: normalized,
                rawAddressVariants: [agg.raw],
                totalCallCount: agg.count,
                callsByType: agg.byType,
                firstCallDate: agg.first,
                lastCallDate: agg.last,
                updatedAt: new Date().toISOString(),
              },
            }),
          );
        }
      }

      await ddb.send(
        new UpdateCommand({
          TableName: jobsTable,
          Key: { pk: agencyPk(agencyId), sk: jobSk(jobId) },
          UpdateExpression:
            "SET #s = :s, recordCount = :r, errorCount = :e, dateRangeStart = :ds, dateRangeEnd = :de, completedAt = :c",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":s": err && !ok ? "failed" : "completed",
            ":r": ok,
            ":e": err,
            ":ds": dateStart,
            ":de": dateEnd,
            ":c": new Date().toISOString(),
          },
        }),
      );
    } catch (e) {
      console.error("vault ingest failed", e instanceof Error ? e.message : String(e));
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: jobsTable,
            Key: { pk: agencyPk(agencyId), sk: jobSk(jobId) },
            UpdateExpression: "SET #s = :s, completedAt = :c",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":s": "failed",
              ":c": new Date().toISOString(),
            },
          }),
        );
      } catch {
        /* ignore */
      }
    }
  }
};
