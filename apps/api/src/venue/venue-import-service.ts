/**
 * Venue Import Service — RFP 2396IP, Build Item 6
 *
 * Employee directory / event schedule import framework.
 * Supports dry-run mode (validates + returns preview without writing).
 * All writes are agencyId-scoped; PK = VENUE_CONFIG#<venueCode>.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { VenueIntegrationImportBody } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { VENUE_KEYS } from "./venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();
const MAX_BATCH = 25; // DynamoDB BatchWrite limit

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

export interface ImportResult {
  importId: string;
  source: VenueIntegrationImportBody["source"];
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{ externalId: string; reason: string }>;
  dryRun: boolean;
  completedAt: string;
}

export async function runImport(params: {
  agencyId: string;
  venueCode: string;
  actorId: string;
  body: VenueIntegrationImportBody;
}): Promise<ImportResult> {
  const importId = makeId("imp");
  const now = new Date().toISOString();
  const errors: Array<{ externalId: string; reason: string }> = [];
  let inserted = 0;
  let skipped = 0;

  const records = params.body.records;

  // Validate all records first
  const validated: typeof records = [];
  for (const r of records) {
    if (r.type === "event") {
      if (!r.eventStart || !r.eventEnd) {
        errors.push({ externalId: r.externalId, reason: "eventStart and eventEnd required for event records" });
        skipped++;
        continue;
      }
    }
    validated.push(r);
  }

  if (!params.body.dryRun) {
    // Chunk into batches of 25
    const chunks: typeof records[] = [];
    for (let i = 0; i < validated.length; i += MAX_BATCH) {
      chunks.push(validated.slice(i, i + MAX_BATCH));
    }

    for (const chunk of chunks) {
      const puts = chunk.map((r) => ({
        PutRequest: {
          Item: {
            pk: VENUE_KEYS.configPk(params.venueCode),
            sk: `IMPORT_RECORD#${r.type.toUpperCase()}#${r.externalId}`,
            importId,
            agencyId: params.agencyId,
            venueCode: params.venueCode,
            source: params.body.source,
            ...r,
            importedAt: now,
            importedBy: params.actorId,
          },
        },
      }));

      try {
        await ddb.send(
          new BatchWriteCommand({
            RequestItems: { [venueConfigTable()]: puts },
          }),
        );
        inserted += chunk.length;
      } catch (err) {
        for (const r of chunk as typeof records) {
          errors.push({ externalId: r.externalId, reason: String((err as Error).message) });
          skipped++;
        }
        inserted -= 0; // already counted before error
      }
    }
  } else {
    inserted = validated.length; // dry-run preview
  }

  // Write import run log
  if (!params.body.dryRun) {
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [venueConfigTable()]: [
            {
              PutRequest: {
                Item: {
                  pk: VENUE_KEYS.configPk(params.venueCode),
                  sk: VENUE_KEYS.importRunSk(importId, now),
                  importId,
                  agencyId: params.agencyId,
                  venueCode: params.venueCode,
                  source: params.body.source,
                  total: records.length,
                  inserted,
                  skipped,
                  errorCount: errors.length,
                  dryRun: params.body.dryRun,
                  completedAt: now,
                  importedBy: params.actorId,
                },
              },
            },
          ],
        },
      }),
    );

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: params.agencyId,
        actorId: params.actorId,
        type: AUDIT_EVENT_TYPES.VENUE_IMPORT_COMPLETED,
        details: {
          importId,
          source: params.body.source,
          total: records.length,
          inserted,
          skipped,
        },
        createdAt: now,
        resourceType: "import",
        resourceId: importId,
      });
    } catch {
      // audit failure never aborts
    }
  }

  return {
    importId,
    source: params.body.source,
    total: records.length,
    inserted,
    skipped,
    errors,
    dryRun: params.body.dryRun,
    completedAt: now,
  };
}
