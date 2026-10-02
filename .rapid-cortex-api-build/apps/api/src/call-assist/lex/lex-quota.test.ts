import { describe, expect, it } from "vitest";
import { checkLexBotQuota, LexBotQuotaExhaustedError, type LexQuotaPort } from "./lex-quota.js";

function port(currentBotCount: number, limit = 100): LexQuotaPort {
  return {
    getLimit: async () => limit,
    countBots: async () => currentBotCount,
  };
}

describe("checkLexBotQuota", () => {
  it("allows provisioning while more than 5 slots remain", async () => {
    await expect(checkLexBotQuota(port(94))).resolves.toMatchObject({
      currentBotCount: 94,
      limit: 100,
      headroom: 6,
    });
  });

  it("throws at current >= limit - 5 so onboarding fails loudly", async () => {
    await expect(checkLexBotQuota(port(95))).rejects.toBeInstanceOf(LexBotQuotaExhaustedError);
    await expect(checkLexBotQuota(port(95))).rejects.toThrow(/95\/100/);
  });
});
