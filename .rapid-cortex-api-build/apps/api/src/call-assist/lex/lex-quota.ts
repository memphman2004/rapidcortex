import {
  isLexBotQuotaBlocking,
  LEX_BOT_QUOTA_CODE,
  LEX_BOT_QUOTA_CONSOLE_URL,
  LEX_BOT_QUOTA_HEADROOM,
  LEX_DEFAULT_BOT_QUOTA,
} from "rapid-cortex-shared";

export type LexQuotaSnapshot = {
  currentBotCount: number;
  limit: number;
  headroom: number;
  quotaCode: string;
};

export class LexBotQuotaExhaustedError extends Error {
  constructor(public readonly snapshot: LexQuotaSnapshot) {
    super(
      `Lex bot quota nearly exhausted: ${snapshot.currentBotCount}/${snapshot.limit}. ` +
        `Submit a Service Quota increase before onboarding new agencies. ` +
        `Headroom must stay at least ${LEX_BOT_QUOTA_HEADROOM}. ` +
        LEX_BOT_QUOTA_CONSOLE_URL,
    );
    this.name = "LexBotQuotaExhaustedError";
  }
}

export type LexQuotaPort = {
  getLimit(): Promise<number>;
  countBots(): Promise<number>;
};

export function envLexQuotaPort(): LexQuotaPort {
  return {
    async getLimit() {
      const raw = process.env.CALL_ASSIST_LEX_BOT_LIMIT?.trim();
      const n = raw ? Number(raw) : LEX_DEFAULT_BOT_QUOTA;
      return Number.isFinite(n) && n > 0 ? n : LEX_DEFAULT_BOT_QUOTA;
    },
    async countBots() {
      const raw = process.env.CALL_ASSIST_LEX_BOT_COUNT?.trim();
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) && n >= 0 ? n : 0;
    },
  };
}

export async function readLexBotQuota(port: LexQuotaPort = envLexQuotaPort()): Promise<LexQuotaSnapshot> {
  const [limit, currentBotCount] = await Promise.all([port.getLimit(), port.countBots()]);
  return {
    currentBotCount,
    limit,
    headroom: Math.max(0, limit - currentBotCount),
    quotaCode: LEX_BOT_QUOTA_CODE,
  };
}

/** Hard gate: throw before CreateBot when fewer than 5 slots remain. */
export async function checkLexBotQuota(port: LexQuotaPort = envLexQuotaPort()): Promise<LexQuotaSnapshot> {
  const snapshot = await readLexBotQuota(port);
  if (isLexBotQuotaBlocking(snapshot.currentBotCount, snapshot.limit)) {
    throw new LexBotQuotaExhaustedError(snapshot);
  }
  return snapshot;
}
