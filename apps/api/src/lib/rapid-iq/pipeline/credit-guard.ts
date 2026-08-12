/**
 * Hard credit limit enforcement for Apollo and Hunter enrichment APIs.
 * Credit records live in RAPID_IQ_PIPELINE_SIGNALS_TABLE (pk CREDITS#*, sk CYCLE#*).
 * Never call Apollo or Hunter without checking canSpend() first.
 * Never decrement — only ADD (idempotent under concurrent Lambda spend).
 */

import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../env.js";
import { ddb } from "../../../repositories/baseRepository.js";

export type CreditTool = "apollo" | "hunter";

export const CREDIT_LIMITS: Record<CreditTool, number> = {
  apollo: 2500,
  hunter: 2000,
};

/** Billing cycle starts on the 11th of each month. */
export const BILLING_DAY = 11;

export interface CreditRecord {
  used: number;
  limit: number;
  cycleStart: string;
  cycleEnd: string;
  updatedAt: string;
}

export interface CanSpendResult {
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  cycleStart: string;
  cycleEnd: string;
  reason?: string;
}

function table(): string {
  const t =
    env.rapidIqPipelineSignalsTable?.trim() ||
    process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

/** YYYY-MM-DD cycle start (always the 11th) for the billing month containing `date`. */
export function cycleStartForDate(date: Date): string {
  const d = new Date(date.getTime());
  if (d.getDate() >= BILLING_DAY) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(BILLING_DAY).padStart(2, "0")}`;
  }
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(BILLING_DAY).padStart(2, "0")}`;
}

/** Exclusive-ish end date: day before the next billing day (cycleStart + ~1 month − 1 day). */
export function cycleEndForStart(cycleStart: string): string {
  const parts = cycleStart.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year == null || month == null || day == null) {
    throw new Error(`Invalid cycleStart: ${cycleStart}`);
  }
  // Date month is 0-indexed; `month` from YYYY-MM-DD is 1-indexed → next month index.
  const end = new Date(year, month, day - 1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export function todayCycleStart(now: Date = new Date()): string {
  return cycleStartForDate(now);
}

function pk(tool: CreditTool): string {
  return `CREDITS#${tool.toUpperCase()}`;
}

function sk(cycleStart: string): string {
  return `CYCLE#${cycleStart}`;
}

/** Pure decision helper — exported for unit tests without Dynamo. */
export function evaluateCanSpend(record: CreditRecord, amount: number): CanSpendResult {
  const remaining = Math.max(0, record.limit - record.used);
  const allowed = amount > 0 && remaining >= amount;
  return {
    allowed,
    remaining,
    used: record.used,
    limit: record.limit,
    cycleStart: record.cycleStart,
    cycleEnd: record.cycleEnd,
    reason: allowed
      ? undefined
      : `Credit limit reached: ${record.used}/${record.limit} used this cycle (${record.cycleStart})`,
  };
}

async function getOrCreateRecord(tool: CreditTool, now: Date = new Date()): Promise<CreditRecord> {
  const cycle = todayCycleStart(now);
  const limit = CREDIT_LIMITS[tool];

  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: pk(tool), sk: sk(cycle) },
    }),
  );

  if (res.Item) {
    const used = typeof res.Item.used === "number" ? res.Item.used : 0;
    return {
      used,
      limit: typeof res.Item.limit === "number" ? res.Item.limit : limit,
      cycleStart: typeof res.Item.cycleStart === "string" ? res.Item.cycleStart : cycle,
      cycleEnd:
        typeof res.Item.cycleEnd === "string" ? res.Item.cycleEnd : cycleEndForStart(cycle),
      updatedAt:
        typeof res.Item.updatedAt === "string" ? res.Item.updatedAt : now.toISOString(),
    };
  }

  const record: CreditRecord = {
    used: 0,
    limit,
    cycleStart: cycle,
    cycleEnd: cycleEndForStart(cycle),
    updatedAt: now.toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: pk(tool),
        sk: sk(cycle),
        ...record,
      },
    }),
  );

  return record;
}

/**
 * Check whether `amount` credits can be spent without exceeding the monthly limit.
 * Does NOT deduct credits — call spend() after the API call succeeds.
 */
export async function canSpend(tool: CreditTool, amount: number): Promise<CanSpendResult> {
  const record = await getOrCreateRecord(tool);
  return evaluateCanSpend(record, amount);
}

/**
 * Atomically increment the credit counter after a successful API call.
 * Uses DynamoDB ADD — safe under concurrent Lambda execution.
 */
export async function spend(tool: CreditTool, amount: number): Promise<number> {
  if (amount <= 0) return 0;

  const cycle = todayCycleStart();
  const now = new Date().toISOString();

  // Ensure cycle row exists before ADD (ADD creates attribute but not the item keys alone).
  await getOrCreateRecord(tool);

  const res = await ddb.send(
    new UpdateCommand({
      TableName: table(),
      Key: { pk: pk(tool), sk: sk(cycle) },
      UpdateExpression: "ADD #used :amt SET updatedAt = :now, #limit = if_not_exists(#limit, :limit), cycleStart = if_not_exists(cycleStart, :cycleStart), cycleEnd = if_not_exists(cycleEnd, :cycleEnd)",
      ExpressionAttributeNames: { "#used": "used", "#limit": "limit" },
      ExpressionAttributeValues: {
        ":amt": amount,
        ":now": now,
        ":limit": CREDIT_LIMITS[tool],
        ":cycleStart": cycle,
        ":cycleEnd": cycleEndForStart(cycle),
      },
      ReturnValues: "UPDATED_NEW",
    }),
  );

  const newUsed =
    typeof res.Attributes?.used === "number" ? res.Attributes.used : amount;
  console.log(
    JSON.stringify({
      msg: "rapid_iq_credit_spend",
      tool,
      amount,
      newUsed,
      limit: CREDIT_LIMITS[tool],
    }),
  );
  return newUsed;
}

/**
 * Read current credit status for both tools (UI / GET credits).
 */
export async function getCreditStatus(): Promise<
  Record<CreditTool, CreditRecord & { remaining: number }>
> {
  const [apollo, hunter] = await Promise.all([
    getOrCreateRecord("apollo"),
    getOrCreateRecord("hunter"),
  ]);

  return {
    apollo: { ...apollo, remaining: Math.max(0, apollo.limit - apollo.used) },
    hunter: { ...hunter, remaining: Math.max(0, hunter.limit - hunter.used) },
  };
}
