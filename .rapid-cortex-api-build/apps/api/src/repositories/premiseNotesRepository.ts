import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { CallerCardPremiseNoteItem, PremiseHazardType, PremiseNoteRecord } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

function scopeKey(agencyId: string, callerAddressNormalized: string): string {
  return `${agencyId}#${callerAddressNormalized}`;
}

function rowToCardItem(row: Record<string, unknown>): CallerCardPremiseNoteItem {
  const hazardRaw = row.hazardType;
  const hazardType =
    hazardRaw === "weapons" ||
    hazardRaw === "dogs" ||
    hazardRaw === "mental_health" ||
    hazardRaw === "hazmat" ||
    hazardRaw === "violent_history" ||
    hazardRaw === "other"
      ? (hazardRaw as PremiseHazardType)
      : hazardRaw === null
        ? null
        : undefined;
  return {
    noteId: String(row.noteId),
    text: String(row.text),
    createdAt: String(row.createdAt),
    createdBy: String(row.createdByUserId ?? row.createdBy ?? "unknown"),
    ...(row.updatedAt ? { updatedAt: String(row.updatedAt) } : {}),
    ...(hazardType !== undefined ? { hazardType } : {}),
    isHazard: Boolean(row.isHazard),
    ...(typeof row.knownOccupants === "string" && row.knownOccupants.trim()
      ? { knownOccupants: String(row.knownOccupants) }
      : {}),
    ...(typeof row.specialInstructions === "string" && row.specialInstructions.trim()
      ? { specialInstructions: String(row.specialInstructions) }
      : {}),
    source: "manual_note",
  };
}

export type PremiseNotePatch = {
  text?: string;
  hazardType?: PremiseHazardType | null;
  isHazard?: boolean;
  knownOccupants?: string | null;
  specialInstructions?: string | null;
};

export class PremiseNotesRepository {
  async listForAddress(
    agencyId: string,
    callerAddressNormalized: string,
  ): Promise<CallerCardPremiseNoteItem[]> {
    const table = env.premiseNotesTable;
    if (!table) return [];
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "premiseScopeKey = :k",
        ExpressionAttributeValues: { ":k": scopeKey(agencyId, callerAddressNormalized) },
        ScanIndexForward: false,
        Limit: 100,
      }),
    );
    return (res.Items ?? []).map((it) => rowToCardItem(it as Record<string, unknown>));
  }

  async getNote(
    agencyId: string,
    callerAddressNormalized: string,
    noteId: string,
  ): Promise<CallerCardPremiseNoteItem | null> {
    const table = env.premiseNotesTable;
    if (!table) return null;
    const res = await ddb.send(
      new GetCommand({
        TableName: table,
        Key: {
          premiseScopeKey: scopeKey(agencyId, callerAddressNormalized),
          noteId,
        },
      }),
    );
    const item = res.Item as Record<string, unknown> | undefined;
    if (!item) return null;
    if (String(item.agencyId) !== agencyId) return null;
    return rowToCardItem(item);
  }

  async createNote(input: PremiseNoteRecord): Promise<void> {
    const table = env.premiseNotesTable;
    if (!table) throw new Error("PREMISE_NOTES_DISABLED");
    const hazardType = input.hazardType ?? null;
    const isHazard = input.isHazard ?? Boolean(hazardType && hazardType !== "other");
    const item: Record<string, unknown> = {
      premiseScopeKey: scopeKey(input.agencyId, input.normalizedAddress),
      noteId: input.noteId,
      agencyId: input.agencyId,
      callerAddressNormalized: input.normalizedAddress,
      normalizedAddress: input.normalizedAddress,
      incidentId: input.incidentId,
      text: input.text,
      createdAt: input.createdAt,
      createdByUserId: input.createdBy,
      source: "manual",
      isHazard,
    };
    if (hazardType != null) item.hazardType = hazardType;
    if (input.knownOccupants?.trim()) item.knownOccupants = input.knownOccupants.trim();
    if (input.specialInstructions?.trim()) item.specialInstructions = input.specialInstructions.trim();
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: item,
      }),
    );
  }

  async updateNote(
    agencyId: string,
    callerAddressNormalized: string,
    noteId: string,
    patch: PremiseNotePatch,
  ): Promise<boolean> {
    const table = env.premiseNotesTable;
    if (!table) throw new Error("PREMISE_NOTES_DISABLED");
    const sets: string[] = [];
    const removes: string[] = [];
    const vals: Record<string, unknown> = {
      ":ag": agencyId,
    };
    const now = new Date().toISOString();
    sets.push("updatedAt = :u");
    vals[":u"] = now;

    if (patch.text !== undefined) {
      sets.push("text = :t");
      vals[":t"] = patch.text;
    }
    if (patch.knownOccupants !== undefined) {
      if (patch.knownOccupants === null || patch.knownOccupants.trim() === "") {
        removes.push("knownOccupants");
      } else {
        sets.push("knownOccupants = :ko");
        vals[":ko"] = patch.knownOccupants.trim();
      }
    }
    if (patch.specialInstructions !== undefined) {
      if (patch.specialInstructions === null || patch.specialInstructions.trim() === "") {
        removes.push("specialInstructions");
      } else {
        sets.push("specialInstructions = :si");
        vals[":si"] = patch.specialInstructions.trim();
      }
    }
    if (patch.hazardType !== undefined) {
      if (patch.hazardType === null) {
        removes.push("hazardType");
      } else {
        sets.push("hazardType = :ht");
        vals[":ht"] = patch.hazardType;
      }
    }
    if (patch.isHazard !== undefined) {
      sets.push("isHazard = :ih");
      vals[":ih"] = patch.isHazard;
    } else if (patch.hazardType !== undefined) {
      const inferred = patch.hazardType ? patch.hazardType !== "other" : false;
      sets.push("isHazard = :ih");
      vals[":ih"] = inferred;
    }

    const updateParts: string[] = [];
    if (sets.length) updateParts.push(`SET ${sets.join(", ")}`);
    if (removes.length) updateParts.push(`REMOVE ${removes.join(", ")}`);

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: table,
          Key: {
            premiseScopeKey: scopeKey(agencyId, callerAddressNormalized),
            noteId,
          },
          UpdateExpression: updateParts.join(" "),
          ConditionExpression: "agencyId = :ag",
          ExpressionAttributeValues: vals,
        }),
      );
      return true;
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }
}
