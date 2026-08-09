import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { RefreshStatus } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

/** Stored as a singleton row in state-coverage table under reserved key. */
const STATUS_KEY = "__REFRESH_STATUS__";

function table(): string {
  const t = env.rapidIqStateCoverageTable;
  if (!t) throw new Error("RAPID_IQ_STATE_COVERAGE_TABLE_NOT_CONFIGURED");
  return t;
}

export class RapidIqRefreshStatusRepository {
  async get(): Promise<RefreshStatus> {
    try {
      const r = await ddb.send(new GetCommand({ TableName: table(), Key: { stateCode: STATUS_KEY } }));
      const item = r.Item as (RefreshStatus & { stateCode?: string }) | undefined;
      if (!item) {
        return { status: "idle", startedAt: null, completedAt: null, signalsFound: 0, error: null };
      }
      return {
        status: item.status ?? "idle",
        startedAt: item.startedAt ?? null,
        completedAt: item.completedAt ?? null,
        signalsFound: item.signalsFound ?? 0,
        error: item.error ?? null,
      };
    } catch {
      return { status: "idle", startedAt: null, completedAt: null, signalsFound: 0, error: null };
    }
  }

  async put(status: RefreshStatus): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          stateCode: STATUS_KEY,
          stateName: "Rapid IQ Refresh",
          ...status,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }
}
