import { describe, expect, it } from "vitest";
import { resolveConnectStartLocale } from "rapid-cortex-shared";
import { defaultTenantConfig } from "../config-service.js";
import { buildConnectStartResult, eventLocaleHint } from "./get-agency-for-number.js";

describe("GetAgencyConfigForNumber Connect start", () => {
  it("returns BCP-47 language and per-locale greeting bags", () => {
    const config = {
      ...defaultTenantConfig("springfield"),
      agencyName: "Springfield Police Department",
      agencyShortName: "Springfield PD",
      tenantCity: "City of Springfield",
      defaultLanguageCode: "es-US",
      callAssistGreeting: {
        mode: "stay_on_line" as const,
        cityName: "City of Springfield",
        agencyName: "Springfield Police Department",
        lineDescription: "non-emergency service line",
        escalationMode: "announce_and_transfer" as const,
        speakEscalationAnnouncement: true,
        enableColdClimateIntents: false,
        enableLiveAgentHandoff: true,
        greetingPreviewConfirmed: true,
      },
    };
    const result = buildConnectStartResult({
      agencyId: "springfield",
      locale: resolveConnectStartLocale({ tenantDefault: config.defaultLanguageCode }),
      config,
      identity: { ani: "+18165550100", aliAddress: "4200 Main", apartmentSuite: "4B" },
      agencyShortName: "Springfield PD",
    });
    expect(result.language).toBe("es-US");
    expect(result.greetingText).toMatch(/permanezca en la línea/i);
    expect(result["greeting_zh_CN"]).toContain("非紧急");
    expect(result["greeting_ar_AE"]).toContain("غير الطارئة");
    expect(result["transferPrompt_tl_PH"]).toMatch(/Pakihintay/i);
    expect(result["errorPrompt_vi_VN"]).toMatch(/sự cố/);
    expect(result.ani).toBe("+18165550100");
    expect(result.language).not.toBe("es");
    expect(result.language).not.toBe("en");
  });

  it("prefers an event locale over the tenant default", () => {
    expect(
      eventLocaleHint({
        Details: { ContactData: { Attributes: { language: "zh-HK" } } },
      }),
    ).toBe("zh-HK");
    expect(resolveConnectStartLocale({ eventLocale: "ar", tenantDefault: "en-US" })).toBe("ar-AE");
  });
});
