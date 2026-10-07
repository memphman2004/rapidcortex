import {
  BuildBotLocaleCommand,
  CreateBotAliasCommand,
  CreateBotCommand,
  CreateBotLocaleCommand,
  CreateBotVersionCommand,
  CreateIntentCommand,
  CreateSlotCommand,
  CreateSlotTypeCommand,
  DescribeBotLocaleCommand,
  LexModelsV2Client,
  ListBotAliasesCommand,
  ListBotLocalesCommand,
  ListIntentsCommand,
  UpdateBotAliasCommand,
  UpdateIntentCommand,
  type SampleUtterance,
} from "@aws-sdk/client-lex-models-v2";
import { BOT_TEMPLATE_SLOT_TYPES, type CallAssistLocale } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import type { LexModelsPort } from "./lex-bot-provisioner.js";
import { LEX_SPEC_INTENT_ORDER, LEX_SPEC_SLOTS } from "./lex-spec-slots.js";
import { UTTERANCES_911, UTTERANCES_911_ES } from "./utterances/911.js";

const DRAFT = "DRAFT";

function client(): LexModelsV2Client {
  return new LexModelsV2Client({ region: env.region || process.env.AWS_REGION || "us-east-1" });
}

function roleArn(): string {
  const arn = process.env.CALL_ASSIST_LEX_BOT_ROLE_ARN?.trim() ?? "";
  if (!arn) {
    throw new Error("CALL_ASSIST_LEX_BOT_ROLE_ARN is required when CALL_ASSIST_LEX_MOCK=false");
  }
  return arn;
}

function isConflict(err: unknown): boolean {
  return err instanceof Error && (err.name === "ConflictException" || /ConflictException/i.test(err.message));
}

function utterancesFor(intent: string, locale: CallAssistLocale): SampleUtterance[] {
  const en = (UTTERANCES_911 as Record<string, readonly string[]>)[intent] ?? [];
  const es = (UTTERANCES_911_ES as Record<string, readonly string[]>)[intent] ?? [];
  const phrases = locale === "es_US" ? (es.length ? es : en) : en;
  return phrases.slice(0, 200).map((utterance) => ({ utterance }));
}

function promptForSlot(intent: string, slotName: string, locale: CallAssistLocale): string {
  const slot = (LEX_SPEC_SLOTS[intent] ?? []).find((s) => s.name === slotName);
  if (!slot) return "Can you share a bit more detail so we can log this correctly?";
  if (locale === "es_US" && slot.promptEs) return slot.promptEs;
  return slot.promptEn;
}

function resolveSlotTypeId(slotName: string): string {
  const lower = slotName.toLowerCase();
  if (lower.includes("still") || lower.includes("happening") || lower.includes("confirm")) {
    return "AMAZON.Confirmation";
  }
  if (lower.includes("noise") && lower.includes("type")) return "NoiseType";
  if (lower.includes("color")) return "VehicleColor";
  if (lower.includes("vehicle") && lower.includes("type")) return "VehicleType";
  if (lower.includes("time") || lower.includes("when") || lower.includes("timeframe")) return "IncidentTimeframe";
  if (lower.includes("location") || lower.includes("address")) return "LocationAddress";
  return "FreeText";
}

async function ensureSlotTypes(lex: LexModelsV2Client, botId: string, localeId: string): Promise<void> {
  for (const st of BOT_TEMPLATE_SLOT_TYPES) {
    try {
      await lex.send(
        new CreateSlotTypeCommand({
          botId,
          botVersion: DRAFT,
          localeId,
          slotTypeName: st.slotTypeName,
          valueSelectionSetting: {
            resolutionStrategy: "OriginalValue",
          },
          slotTypeValues: st.values.map((v) => ({
            sampleValue: { value: v.value },
            synonyms: (v.synonyms ?? []).map((s) => ({ value: s })),
          })),
        }),
      );
    } catch (err) {
      if (!isConflict(err)) throw err;
    }
  }
  for (const name of ["FreeText", "LocationAddress", "NoiseType"]) {
    try {
      await lex.send(
        new CreateSlotTypeCommand({
          botId,
          botVersion: DRAFT,
          localeId,
          slotTypeName: name,
          valueSelectionSetting: { resolutionStrategy: "OriginalValue" },
          slotTypeValues: [{ sampleValue: { value: "unknown" } }, { sampleValue: { value: "none" } }],
        }),
      );
    } catch (err) {
      if (!isConflict(err)) throw err;
    }
  }
}

async function intentIdByName(
  lex: LexModelsV2Client,
  botId: string,
  localeId: string,
  intentName: string,
): Promise<string | undefined> {
  const listed = await lex.send(
    new ListIntentsCommand({ botId, botVersion: DRAFT, localeId, maxResults: 100 }),
  );
  return listed.intentSummaries?.find((i) => i.intentName === intentName)?.intentId;
}

async function upsertIntent(
  lex: LexModelsV2Client,
  botId: string,
  locale: CallAssistLocale,
  intentName: string,
): Promise<string> {
  const sampleUtterances = utterancesFor(intentName, locale);
  const existingId = await intentIdByName(lex, botId, locale, intentName);
  if (existingId) {
    await lex.send(
      new UpdateIntentCommand({
        botId,
        botVersion: DRAFT,
        localeId: locale,
        intentId: existingId,
        intentName,
        description: `Call Assist ${intentName}`,
        sampleUtterances: sampleUtterances.length ? sampleUtterances : undefined,
      }),
    );
    return existingId;
  }
  try {
    const created = await lex.send(
      new CreateIntentCommand({
        botId,
        botVersion: DRAFT,
        localeId: locale,
        intentName,
        description: `Call Assist ${intentName}`,
        sampleUtterances: sampleUtterances.length ? sampleUtterances : undefined,
      }),
    );
    if (!created.intentId) throw new Error(`CreateIntent returned no id for ${intentName}`);
    return created.intentId;
  } catch (err) {
    if (!isConflict(err)) throw err;
    const id = await intentIdByName(lex, botId, locale, intentName);
    if (!id) throw err;
    return id;
  }
}

async function createSlotsForIntent(
  lex: LexModelsV2Client,
  botId: string,
  locale: CallAssistLocale,
  intentName: string,
  intentId: string,
): Promise<void> {
  for (const slot of LEX_SPEC_SLOTS[intentName] ?? []) {
    try {
      await lex.send(
        new CreateSlotCommand({
          botId,
          botVersion: DRAFT,
          localeId: locale,
          intentId,
          slotName: slot.name,
          slotTypeId: resolveSlotTypeId(slot.name),
          valueElicitationSetting: {
            slotConstraint: slot.required ? "Required" : "Optional",
            promptSpecification: {
              messageGroups: [
                {
                  message: {
                    plainTextMessage: { value: promptForSlot(intentName, slot.name, locale) },
                  },
                },
              ],
              maxRetries: 2,
              allowInterrupt: true,
            },
          },
        }),
      );
    } catch (err) {
      if (!isConflict(err)) throw err;
    }
  }
}

/**
 * Live Lex Models V2 port. Used when CALL_ASSIST_LEX_MOCK=false.
 * Creates per-agency bots from the canonical utterance/slot specs.
 */
export function awsLexModelsPort(): LexModelsPort {
  const lex = client();

  async function syncIntentsAndSlots(botId: string, locale: CallAssistLocale): Promise<void> {
    await ensureSlotTypes(lex, botId, locale);
    for (const intentName of LEX_SPEC_INTENT_ORDER) {
      const intentId = await upsertIntent(lex, botId, locale, intentName);
      await createSlotsForIntent(lex, botId, locale, intentName, intentId);
    }
  }

  return {
    async createBot({ botName, agencyId }) {
      const out = await lex.send(
        new CreateBotCommand({
          botName: botName.slice(0, 100),
          description: `NexCort iQ Call Assist bot for ${agencyId}`,
          roleArn: roleArn(),
          dataPrivacy: { childDirected: false },
          idleSessionTTLInSeconds: 300,
        }),
      );
      if (!out.botId) throw new Error(`CreateBot returned no botId for ${botName}`);
      return { botId: out.botId };
    },

    async createLocale({ botId, locale }) {
      try {
        await lex.send(
          new CreateBotLocaleCommand({
            botId,
            botVersion: DRAFT,
            localeId: locale,
            nluIntentConfidenceThreshold: 0.4,
            voiceSettings: {
              voiceId: locale === "es_US" ? "Lupe" : "Ruth",
              engine: "neural",
            },
          }),
        );
      } catch (err) {
        if (!isConflict(err)) throw err;
      }
    },

    async createIntentsAndSlots({ botId, locale }) {
      await syncIntentsAndSlots(botId, locale);
    },

    async updateIntents({ botId, locale }) {
      await syncIntentsAndSlots(botId, locale);
    },

    async buildLocale({ botId, locale }) {
      await lex.send(new BuildBotLocaleCommand({ botId, botVersion: DRAFT, localeId: locale }));
    },

    async describeLocale({ botId, locale }) {
      const out = await lex.send(
        new DescribeBotLocaleCommand({ botId, botVersion: DRAFT, localeId: locale }),
      );
      const status = out.botLocaleStatus;
      if (status === "Built" || status === "ReadyExpressTesting") return "Built";
      if (status === "Failed") return "Failed";
      return "Building";
    },

    async createBotVersion(botId) {
      const locales = await lex.send(
        new ListBotLocalesCommand({ botId, botVersion: DRAFT, maxResults: 20 }),
      );
      const botVersionLocaleSpecification: Record<string, { sourceBotVersion: string }> = {};
      for (const row of locales.botLocaleSummaries ?? []) {
        if (row.localeId && (row.botLocaleStatus === "Built" || row.botLocaleStatus === "ReadyExpressTesting")) {
          botVersionLocaleSpecification[row.localeId] = { sourceBotVersion: DRAFT };
        }
      }
      if (!Object.keys(botVersionLocaleSpecification).length) {
        botVersionLocaleSpecification.en_US = { sourceBotVersion: DRAFT };
      }
      const out = await lex.send(
        new CreateBotVersionCommand({
          botId,
          description: `Call Assist publish ${new Date().toISOString()}`,
          botVersionLocaleSpecification,
        }),
      );
      if (!out.botVersion) throw new Error(`CreateBotVersion returned no version for ${botId}`);
      return out.botVersion;
    },

    async upsertAlias({ botId, aliasName, version, agencyId, stage }) {
      const listed = await lex.send(new ListBotAliasesCommand({ botId, maxResults: 50 }));
      const existing = (listed.botAliasSummaries ?? []).find((a) => a.botAliasName === aliasName);
      if (existing?.botAliasId) {
        await lex.send(
          new UpdateBotAliasCommand({
            botId,
            botAliasId: existing.botAliasId,
            botAliasName: aliasName,
            botVersion: version,
            description: `Call Assist live alias for ${agencyId}/${stage}`,
          }),
        );
        return { botAliasId: existing.botAliasId };
      }
      const created = await lex.send(
        new CreateBotAliasCommand({
          botId,
          botAliasName: aliasName,
          botVersion: version,
          description: `Call Assist live alias for ${agencyId}/${stage}`,
        }),
      );
      if (!created.botAliasId) throw new Error(`CreateBotAlias returned no id for ${aliasName}`);
      return { botAliasId: created.botAliasId };
    },
  };
}
