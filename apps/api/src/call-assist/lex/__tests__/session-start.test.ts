import { describe, expect, it } from "vitest";
import { defaultTenantConfig } from "../../config-service.js";
import { startCallAssistSession } from "../session-start.js";

describe("callAssistSessionStart", () => {
  it("sets greeting session attributes from tenant config", () => {
    const config = {
      ...defaultTenantConfig("springfield"),
      agencyName: "Springfield Police Department",
      tenantCity: "City of Springfield",
      callAssistGreeting: {
        mode: "hang_up" as const,
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
    const start = startCallAssistSession({
      agencyId: "springfield",
      locale: "en_US",
      config,
    });
    expect(start.nextAction).toBe("begin_intake");
    expect(start.greeting).toContain("hang up and dial 9-1-1");
    expect(start.sessionAttributes.greetingDelivered).toBe("true");
    expect(start.sessionAttributes.greetingMode).toBe("hang_up");
    expect(start.usedFallback).toBe(false);
  });

  it("falls back when the agency is not configured", () => {
    const start = startCallAssistSession({ agencyId: "", locale: "en-US", config: null });
    expect(start.usedFallback).toBe(true);
    expect(start.greeting).toContain("non-emergency");
    expect(start.greeting).not.toMatch(/Kansas City/i);
  });

  it("does not repeat the greeting when telephony already delivered it", () => {
    const config = {
      ...defaultTenantConfig("springfield"),
      callAssistGreeting: {
        mode: "stay_on_line" as const,
        cityName: "City of Springfield",
        agencyName: "Springfield PD",
        lineDescription: "non-emergency service line",
        escalationMode: "announce_and_transfer" as const,
        speakEscalationAnnouncement: true,
        enableColdClimateIntents: false,
        enableLiveAgentHandoff: true,
      },
    };
    const start = startCallAssistSession({
      agencyId: "springfield",
      locale: "en-US",
      config,
      existingAttributes: { greetingDelivered: "true", agencyId: "springfield" },
    });
    expect(start.greeting).toBe("How can I help you today?");
  });
});
