import { describe, expect, it } from "vitest";
import {
  assertSlug,
  BizCardError,
  consumeRateLimit,
  counterAttribute,
  isBusinessCardAdmin,
  isBusinessCardsEnabled,
  resetRateLimits,
  slugifyName,
} from "./domain.js";
import { DraftSchema } from "./schemas.js";
import { buildVCard, foldVCardLine } from "./vcard.js";
import { publicResponseHasInternalFields, toPublicProfile } from "./visibility.js";
import type { BusinessCardProfile, PublicBusinessCard } from "./types.js";

describe("business card slugs", () => {
  it("accepts a draft and rejects a reserved slug", () => {
    expect(DraftSchema.safeParse({ displayName: "Ada Lovelace", slug: "ada-lovelace" }).success).toBe(true);
    expect(DraftSchema.safeParse({ slug: "admin" }).success).toBe(false);
  });

  it("builds a url-safe slug and rejects reserved words", () => {
    expect(slugifyName("Jeff", "Coleman")).toBe("jeff-coleman");
    expect(slugifyName("Admin", "")).not.toBe("admin");
    expect(() => assertSlug("admin")).toThrow(BizCardError);
    expect(() => assertSlug("ab")).toThrow(BizCardError);
    expect(() => assertSlug("ok name")).toThrow(BizCardError);
  });
});

describe("business card feature flag", () => {
  it("stays off until a tenant turns it on", () => {
    expect(isBusinessCardsEnabled(false, null)).toBe(false);
    expect(isBusinessCardsEnabled(true, null)).toBe(true);
    expect(isBusinessCardsEnabled(false, { enabled: true })).toBe(true);
    expect(isBusinessCardsEnabled(true, { enabled: false })).toBe(false);
  });
});

describe("business card permissions", () => {
  it("treats agency administrators as admins and dispatchers as employees", () => {
    expect(isBusinessCardAdmin("agencyadmin")).toBe(true);
    expect(isBusinessCardAdmin("CAMPUS_ADMIN")).toBe(true);
    expect(isBusinessCardAdmin("dispatcher")).toBe(false);
    expect(isBusinessCardAdmin("admin")).toBe(false);
    expect(isBusinessCardAdmin("employee")).toBe(false);
  });
});

describe("business card analytics counters", () => {
  it("maps page views onto the view counter", () => {
    expect(counterAttribute("page_view")).toEqual({ field: "totalViews", touchLastViewed: true });
    expect(counterAttribute("vcf_download").field).toBe("totalVcfDownloads");
    expect(counterAttribute("linkedin_click").field).toBe("totalWebClicks");
  });

  it("limits a key after the threshold", () => {
    resetRateLimits();
    expect(consumeRateLimit("ip", 2, 1_000)).toBe(false);
    expect(consumeRateLimit("ip", 2, 1_001)).toBe(false);
    expect(consumeRateLimit("ip", 2, 1_002)).toBe(true);
  });
});

describe("vCard", () => {
  const card: PublicBusinessCard = {
    publicProfileId: "pub",
    slug: "ada-lovelace",
    displayName: "Ada Lovelace",
    title: "Engineer",
    companyName: "NexCort iQ",
    cardTheme: "navy",
    permanentUrl: "https://www.nexcortiq.us/card/ada-lovelace",
    phoneNumbers: [{ type: "mobile", number: "+14155552671", public: true }],
    emailAddresses: [{ type: "primary", address: "ada@nexcortiq.us", public: true }],
    socialLinks: [],
    website: "https://www.nexcortiq.us",
  };

  it("uses CRLF, escapes reserved characters, and folds long lines", () => {
    const body = buildVCard({ ...card, displayName: "Ada; Lovelace, PhD\n" });
    expect(body.endsWith("\r\n")).toBe(true);
    expect(body.includes("\n") && !body.includes("\r\n")).toBe(false);
    expect(body).toContain("FN:Ada\\; Lovelace\\, PhD\\n");
    expect(body).toContain("TEL;TYPE=MOBILE:+14155552671");
    const folded = foldVCardLine(`NOTE:${"é".repeat(40)}`);
    expect(folded.includes("\r\n ")).toBe(true);
    for (const line of folded.split("\r\n")) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    }
  });
});

describe("public visibility", () => {
  it("drops private and internal fields", () => {
    const profile = {
      pk: "PROFILE#1",
      sk: "PROFILE#1",
      gsi1pk: "TENANT#a",
      gsi1sk: "PROFILE#1#1",
      gsi2pk: "SLUG#ada",
      gsi2sk: "PROFILE",
      gsi3pk: "USER#u",
      gsi3sk: "PROFILE",
      profileId: "1",
      tenantId: "a",
      cognitoUserId: "user-1",
      publicProfileId: "pub-1",
      slug: "ada",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      title: "Engineer",
      companyName: "NexCort iQ",
      biography: "Private bio",
      phoneNumbers: [
        { type: "mobile", number: "+14155552671", public: true },
        { type: "office", number: "+14155552672", public: false },
      ],
      emailAddresses: [{ type: "primary", address: "ada@nexcortiq.us", public: true }],
      socialLinks: [],
      visibilitySettings: { biography: false, "phone:mobile": true },
      lockedFields: ["companyName"],
      cardTheme: "navy",
      status: "active",
      totalViews: 0,
      totalVcfDownloads: 0,
      totalCallClicks: 0,
      totalEmailClicks: 0,
      totalWebClicks: 0,
      createdAt: 1,
      updatedAt: 1,
      createdBy: "user-1",
      updatedBy: "user-1",
      version: 1,
      internalNotes: "secret",
    } satisfies BusinessCardProfile;
    const pub = toPublicProfile(profile, "https://assets.nexcortiq.us/a.webp", "https://www.nexcortiq.us/card/ada");
    expect(pub.biography).toBeUndefined();
    expect(pub.phoneNumbers).toHaveLength(1);
    expect(publicResponseHasInternalFields(pub)).toBe(false);
    expect(JSON.stringify(pub)).not.toContain("user-1");
    expect(JSON.stringify(pub)).not.toContain("secret");
  });
});
