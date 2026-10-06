import {
  DeleteSessionCommand,
  LexRuntimeV2Client,
  RecognizeTextCommand,
  type RecognizeTextCommandOutput,
} from "@aws-sdk/client-lex-runtime-v2";
import type { SmsLexTurn } from "./types.js";

const LOCALE_ID = "en_US";

function client(): LexRuntimeV2Client {
  return new LexRuntimeV2Client({ region: process.env.AWS_REGION ?? "us-east-1" });
}

function botIds(): { botId: string; botAliasId: string } | null {
  const botId = process.env.CALL_ASSIST_LEX_BOT_ID?.trim() || process.env.LEX_BOT_ID?.trim();
  const botAliasId =
    process.env.CALL_ASSIST_LEX_BOT_ALIAS_ID?.trim() || process.env.LEX_BOT_ALIAS_ID?.trim();
  if (!botId || !botAliasId) return null;
  return { botId, botAliasId };
}

export function isLexSmsMock(): boolean {
  const mock = process.env.CALL_ASSIST_LEX_MOCK?.trim().toLowerCase();
  if (mock === "true" || mock === "1") return true;
  return botIds() === null;
}

function mapRaw(raw: RecognizeTextCommandOutput): SmsLexTurn {
  const messages = (raw.messages ?? [])
    .filter((m: { contentType?: string }) => m.contentType !== "CustomPayload")
    .map((m: { contentType?: string; content?: string }) => ({
      contentType: m.contentType ?? "PlainText",
      content: m.content ?? "",
    }));
  const dialogActionType = raw.sessionState?.dialogAction?.type;
  const intentState = raw.sessionState?.intent?.state;
  const sessionEnded =
    dialogActionType === "Close" || intentState === "Fulfilled" || intentState === "Failed";
  return {
    messages,
    sessionAttributes: { ...(raw.sessionState?.sessionAttributes ?? {}) },
    intentName: raw.sessionState?.intent?.name,
    intentState,
    dialogActionType,
    sessionEnded,
  };
}

export async function sendToLex(opts: {
  sessionId: string;
  text: string;
  sessionAttributes: Record<string, string>;
  requestAttributes?: Record<string, string>;
}): Promise<SmsLexTurn> {
  if (isLexSmsMock()) {
    const confirmation = opts.sessionAttributes.confirmationNumber;
    const closing = /^(yes|y|confirm|ok|okay|submit)$/i.test(opts.text.trim());
    if (closing || confirmation) {
      const number = confirmation || "RC-1001-TEST";
      return {
        messages: [{ contentType: "PlainText", content: `Your report number is ${number}.` }],
        sessionAttributes: { ...opts.sessionAttributes, confirmationNumber: number, departmentId: "public_works" },
        intentName: "PublicWorksIssue",
        intentState: "Fulfilled",
        dialogActionType: "Close",
        sessionEnded: true,
      };
    }
    return {
      messages: [
        {
          contentType: "PlainText",
          content: "Is this happening right now, or has it already occurred?",
        },
      ],
      sessionAttributes: opts.sessionAttributes,
      intentName: "PublicWorksIssue",
      intentState: "InProgress",
      dialogActionType: "ElicitSlot",
      sessionEnded: false,
    };
  }

  const ids = botIds();
  if (!ids) throw new Error("CALL_ASSIST_LEX_BOT_ID and CALL_ASSIST_LEX_BOT_ALIAS_ID are required");

  const lex = client();
  const command = new RecognizeTextCommand({
    botId: ids.botId,
    botAliasId: ids.botAliasId,
    localeId: LOCALE_ID,
    sessionId: opts.sessionId,
    text: opts.text,
    sessionState: { sessionAttributes: opts.sessionAttributes },
    requestAttributes: { "x-amz-lex:channel-type": "sms", ...(opts.requestAttributes ?? {}) },
  });

  let raw: RecognizeTextCommandOutput;
  try {
    raw = await lex.send(command);
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
    if (name === "ResourceNotFoundException") {
      raw = await lex.send(command);
    } else {
      throw err;
    }
  }
  return mapRaw(raw);
}

export async function resetLexSession(sessionId: string): Promise<void> {
  if (isLexSmsMock()) return;
  const ids = botIds();
  if (!ids) return;
  try {
    await client().send(
      new DeleteSessionCommand({
        botId: ids.botId,
        botAliasId: ids.botAliasId,
        localeId: LOCALE_ID,
        sessionId,
      }),
    );
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
    if (name !== "ResourceNotFoundException") {
      console.warn(JSON.stringify({ event: "lex_sms_delete_session_soft_fail", name }));
    }
  }
}
