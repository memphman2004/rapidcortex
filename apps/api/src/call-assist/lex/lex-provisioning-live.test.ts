import { describe, expect, it } from "vitest";
import { createLexModelsPort, mockLexModelsPort } from "./lex-bot-provisioner.js";
import { parameterizeContactFlowTemplate } from "../connect/contact-flow-provisioner.js";

describe("createLexModelsPort", () => {
  it("returns the mock port when mock=true", async () => {
    const port = createLexModelsPort(true);
    const bot = await port.createBot({ botName: "RCCallAssistBot-test-dev", agencyId: "test" });
    expect(bot.botId.startsWith("mock-")).toBe(true);
  });

  it("mockLexModelsPort alias matches createLexModelsPort(true)", async () => {
    const a = await mockLexModelsPort().upsertAlias({
      botId: "x",
      aliasName: "live-dev",
      version: "1",
      agencyId: "a",
      stage: "dev",
    });
    expect(a.botAliasId).toContain("mock-alias");
  });
});

describe("parameterizeContactFlowTemplate", () => {
  it("substitutes Lex alias and Connect queue placeholders", () => {
    const out = parameterizeContactFlowTemplate(
      '{"AliasArn":"{{lexBotAliasArn}}","q":"__DEMO_QUEUE_ARN__","e":"__EMERGENCY_QUEUE_ARN__"}',
      {
        agencyId: "kcpd",
        lexBotId: "BOT",
        lexBotAliasId: "ALIAS",
        lexBotAliasArn: "arn:aws:lex:us-east-1:123:bot-alias/BOT/ALIAS",
        primaryQueueArn: "arn:aws:connect:us-east-1:123:instance/i/queue/demo",
        emergencyQueueArn: "arn:aws:connect:us-east-1:123:instance/i/queue/emg",
        fulfillmentLambdaArn: "arn:aws:lambda:us-east-1:123:function:ff",
        stage: "dev",
      },
    );
    expect(out).toContain("bot-alias/BOT/ALIAS");
    expect(out).toContain("queue/demo");
    expect(out).toContain("queue/emg");
    expect(out).not.toContain("{{");
    expect(out).not.toContain("__DEMO");
  });
});
