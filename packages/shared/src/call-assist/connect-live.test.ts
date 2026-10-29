import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONNECT_LANGUAGE_MENU_DTMF,
  CONNECT_LANGUAGE_MENU_PROMPT,
  CONNECT_LIVE_LEX_LOCALES,
  connectLiveLexLocale,
  connectLivePrompts,
  connectLocaleAttrSuffix,
  connectNovaSonicVoice,
  connectVoiceForLocale,
  resolveConnectStartLocale,
} from "./connect-live.js";
import { CALL_ASSIST_LOCALE_META } from "./lex/provisioning-types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("Nexiq Connect live locales", () => {
  it("maps DTMF 1-7 onto the seven live Lex locales", () => {
    expect(CONNECT_LIVE_LEX_LOCALES).toEqual(["en_US", "es_US", "zh_CN", "zh_HK", "tl_PH", "vi_VN", "ar_AE"]);
    expect(Object.keys(CONNECT_LANGUAGE_MENU_DTMF)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(Object.values(CONNECT_LANGUAGE_MENU_DTMF)).toEqual([...CONNECT_LIVE_LEX_LOCALES]);
  });

  it("resolves tenant and event locales to BCP-47 Connect language codes", () => {
    expect(resolveConnectStartLocale({ tenantDefault: "es_US" })).toBe("es-US");
    expect(resolveConnectStartLocale({ eventLocale: "zh-CN", tenantDefault: "en-US" })).toBe("zh-CN");
    expect(resolveConnectStartLocale({ eventLocale: "yue", tenantDefault: "en-US" })).toBe("zh-HK");
    expect(resolveConnectStartLocale({})).toBe("en-US");
    expect(connectLiveLexLocale("fil")).toBe("tl_PH");
    expect(connectLocaleAttrSuffix("vi-VN")).toBe("vi_VN");
  });

  it("uses native Polly voices except Tagalog (Ruth) which Lex cannot attach", () => {
    expect(connectVoiceForLocale("en-US")).toEqual({ voiceId: "Ruth", engine: "Neural" });
    expect(connectVoiceForLocale("es-US").voiceId).toBe("Lupe");
    expect(connectVoiceForLocale("zh-CN").voiceId).toBe("Zhiyu");
    expect(connectVoiceForLocale("zh-HK").voiceId).toBe("Hiujin");
    expect(connectVoiceForLocale("ar-AE").voiceId).toBe("Hala");
    expect(connectVoiceForLocale("vi-VN").voiceId).toBe("Linh");
    expect(connectVoiceForLocale("tl-PH").voiceId).toBe("Ruth");
    expect(connectNovaSonicVoice("en-US")).toEqual({ voiceId: "Ruth", engine: "Neural", style: "None" });
    expect(connectNovaSonicVoice("es-US")?.voiceId).toBe("Lupe");
    expect(connectNovaSonicVoice("zh-CN")).toBeNull();
    expect(CALL_ASSIST_LOCALE_META.tl_PH.limitedAsr).toBe(true);
    expect(CALL_ASSIST_LOCALE_META.vi_VN.limitedAsr).toBe(true);
  });

  it("returns localized transfer and error prompts", () => {
    expect(connectLivePrompts("es-US").transfer).toMatch(/espere/i);
    expect(connectLivePrompts("zh_CN").error).toContain("转接");
    expect(connectLivePrompts("ar-AE").transferFail).toContain("عذرا");
    expect(CONNECT_LANGUAGE_MENU_PROMPT).toContain("press 1");
    expect(CONNECT_LANGUAGE_MENU_PROMPT).toContain("press 7");
  });
});

describe("Nexiq contact flow template", () => {
  it("sets Polly voice and language for every live locale and plays a DTMF menu", () => {
    const flow = JSON.parse(readFileSync(join(repoRoot, "connect/contact-flow-call-assist.json"), "utf8")) as {
      Actions: Array<{
        Identifier?: string;
        Type?: string;
        Parameters?: Record<string, unknown> & { LexSessionAttributes?: Record<string, string> };
        Transitions?: { NextAction?: string; Conditions?: Array<{ NextAction?: string; Condition?: { Operands?: string[] } }> };
      }>;
    };
    const blob = JSON.stringify(flow);
    expect(blob).toContain(CONNECT_LANGUAGE_MENU_PROMPT);
    expect(blob).toContain("GetParticipantInput");
    expect(blob).toContain("__EMERGENCY_QUEUE_ARN__");
    expect(blob).toContain("$.Attributes.spokenGreeting");
    expect(blob).toContain("$.Attributes.language");
    const voices = flow.Actions.map((a) => a.Parameters?.TextToSpeechVoice).filter(Boolean);
    const langs = flow.Actions.map((a) => a.Parameters?.LanguageCode).filter(Boolean);
    expect(voices).toEqual(expect.arrayContaining(["Ruth", "Lupe", "Zhiyu", "Hiujin", "Hala", "Linh"]));
    expect(voices).not.toContain("Matthew");
    expect(blob).toContain("\"TextToSpeechEngine\":\"Generative\"");
    expect(blob).toContain("check-nova-en");
    expect(blob).toContain("play-emergency");
    expect(blob).toContain("lex-intake");
    expect(langs).toEqual(
      expect.arrayContaining(["en-US", "es-US", "zh-CN", "zh-HK", "tl-PH", "vi-VN", "ar-AE"]),
    );
    expect(flow.Actions.some((a) => a.Identifier === "language-menu")).toBe(true);
    const nova = flow.Actions.find((a) => a.Identifier === "lex-intake-nova");
    expect(nova?.Type).toBe("ConnectParticipantWithLexBot");
    expect(nova?.Parameters?.Text).toBeUndefined();
    expect(nova?.Parameters?.LexSessionAttributes?.greetingDelivered).toBe("false");
    expect(nova?.Transitions?.NextAction).toBe("disconnect");
    expect(nova?.Transitions?.Conditions?.some((c) => c.NextAction === "check-escalation-mode" && c.Condition?.Operands?.[0] === "EmergencyEscalation")).toBe(true);
    expect(nova?.Transitions?.Conditions?.some((c) => c.NextAction === "set-fallback-attrs")).toBe(true);
    const polly = flow.Actions.find((a) => a.Identifier === "lex-intake");
    expect(polly?.Parameters?.LexSessionAttributes?.greetingDelivered).toBe("true");
    expect(String(polly?.Parameters?.Text ?? "")).toContain("Please tell me");
  });
});
