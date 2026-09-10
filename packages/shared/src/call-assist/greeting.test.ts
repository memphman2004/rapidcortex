import { describe, expect, it } from "vitest";
import {
  buildEscalationAnnouncement,
  buildGreeting,
  checkEscalation,
  DEFAULT_GREETING_CONFIG,
  greetingActivationBlockedReason,
  isCallAssistGreetingReady,
  mergeGreetingConfig,
  normalizeGreetingLocale,
  resolveGreetingConfig,
} from "./greeting.js";

const springfield = {
  ...DEFAULT_GREETING_CONFIG,
  cityName: "City of Springfield",
  agencyName: "Springfield Police Department",
  greetingPreviewConfirmed: true,
};

describe("Call Assist greeting builders", () => {
  it("interpolates stay-on-the-line English and Spanish templates", () => {
    const en = buildGreeting(springfield, "en-US");
    expect(en).toContain("City of Springfield");
    expect(en).toContain("dial 9-1-1");
    expect(en).toContain("stay on the line");
    expect(en).not.toMatch(/Kansas City|KCPD/i);

    const es = buildGreeting(springfield, "es_US");
    expect(es).toContain("City of Springfield");
    expect(es).toContain("9-1-1");
    expect(es.toLowerCase()).toContain("permanezca en la línea");
  });

  it("uses hang_up phrasing when the agency requires it", () => {
    const text = buildGreeting({ ...springfield, mode: "hang_up" }, "en-US");
    expect(text).toContain("please hang up and dial 9-1-1");
  });

  it("interpolates custom text and locale overrides first", () => {
    const custom = buildGreeting(
      {
        ...springfield,
        mode: "custom",
        customGreetingText: "This is {agencyName} in {cityName}.",
      },
      "en-US",
    );
    expect(custom).toBe("This is Springfield Police Department in City of Springfield.");

    const localized = buildGreeting(
      {
        ...springfield,
        localizedGreetings: { "es-US": "Línea de {cityName}." },
      },
      "es-US",
    );
    expect(localized).toBe("Línea de City of Springfield.");
  });

  it("blocks activation when city or agency is empty", () => {
    expect(isCallAssistGreetingReady(DEFAULT_GREETING_CONFIG)).toBe(false);
    expect(greetingActivationBlockedReason(DEFAULT_GREETING_CONFIG)).toMatch(/City name/);
    expect(isCallAssistGreetingReady(springfield)).toBe(true);
    expect(greetingActivationBlockedReason({ ...springfield, greetingPreviewConfirmed: false })).toMatch(
      /preview and confirm/,
    );
  });

  it("silent_transfer speaks nothing; other modes return announcements", () => {
    expect(buildEscalationAnnouncement({ ...springfield, escalationMode: "silent_transfer" })).toBe("");
    expect(buildEscalationAnnouncement({ ...springfield, speakEscalationAnnouncement: false })).toBe("");
    expect(buildEscalationAnnouncement(springfield, "en-US")).toContain("connecting you with an emergency dispatcher");
    expect(buildEscalationAnnouncement(springfield, "es-US")).toContain("despachador");
  });

  it("checkEscalation never suppresses a weapons utterance", () => {
    const silent = checkEscalation("he has a gun", { ...springfield, escalationMode: "silent_transfer" });
    expect(silent.escalate).toBe(true);
    expect(silent.announcement).toBe("");
    expect(silent.action).toBe("silent_transfer");

    const announce = checkEscalation("this is an emergency", springfield);
    expect(announce.escalate).toBe(true);
    expect(announce.announcement.length).toBeGreaterThan(10);

    expect(checkEscalation("loud music next door", springfield).escalate).toBe(false);
  });

  it("resets preview confirmation when identity fields change", () => {
    const next = mergeGreetingConfig(springfield, { cityName: "City of Oakridge" });
    expect(next.greetingPreviewConfirmed).toBe(false);
    expect(next.localizedGreetings?.["es-US"]).toContain("City of Oakridge");
  });

  it("resolves city from tenantCity when greeting config is missing", () => {
    const resolved = resolveGreetingConfig({
      tenantCity: "Fulton",
      agencyName: "Fulton County Police",
    });
    expect(resolved.cityName).toBe("Fulton");
    expect(resolved.agencyName).toBe("Fulton County Police");
    expect(resolved.mode).toBe("stay_on_line");
  });

  it("normalizes Lex locale ids", () => {
    expect(normalizeGreetingLocale("en_US")).toBe("en-US");
    expect(normalizeGreetingLocale("es_US")).toBe("es-US");
  });
});
