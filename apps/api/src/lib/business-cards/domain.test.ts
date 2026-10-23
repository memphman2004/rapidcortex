import { describe, expect, it } from "vitest";
import {
  BIOGRAPHY_MAX_LENGTH,
  assertSlug,
  BizCardError,
  consumeRateLimit,
  counterAttribute,
  isBusinessCardAdmin,
  isNexCortEmployee,
  isPlatformCardAgency,
  isBusinessCardsEnabled,
  resetRateLimits,
  slugifyName,
} from "./domain.js";
import { DraftSchema, SettingsSchema } from "./schemas.js";
import { buildVCard, foldVCardLine, vcardPhotoFromBytes } from "./vcard.js";
import { publicResponseHasInternalFields, toPublicProfile } from "./visibility.js";
import type { BusinessCardProfile, PublicBusinessCard } from "./types.js";

describe("business card slugs", () => {
  it("adds https when a website is typed as a domain", () => {
    expect(SettingsSchema.parse({ enabled: true, companyWebsite: "www.NexCortIQ.com" }).companyWebsite).toBe(
      "https://www.NexCortIQ.com",
    );
    expect(DraftSchema.parse({ website: "www.NexCortIQ.com" }).website).toBe("https://www.NexCortIQ.com");
    expect(SettingsSchema.safeParse({ companyWebsite: "javascript:alert(1)" }).success).toBe(false);
  });

  it("accepts a draft and rejects a reserved slug", () => {
    expect(DraftSchema.safeParse({ displayName: "Ada Lovelace", slug: "ada-lovelace" }).success).toBe(true);
    const bio = "A".repeat(600);
    expect(DraftSchema.safeParse({ biography: bio }).success).toBe(true);
    expect(DraftSchema.safeParse({ biography: "A".repeat(BIOGRAPHY_MAX_LENGTH + 1) }).success).toBe(false);
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
  it("limits cards to NexCort iQ employees and card admin to RC admins", () => {
    expect(isNexCortEmployee("rcadmin")).toBe(true);
    expect(isNexCortEmployee("salescontractor")).toBe(true);
    expect(isNexCortEmployee("rcitadmin")).toBe(true);
    expect(isNexCortEmployee("dispatcher")).toBe(false);
    expect(isNexCortEmployee("agencyadmin")).toBe(false);
    expect(isBusinessCardAdmin("rcsuperadmin")).toBe(true);
    expect(isBusinessCardAdmin("rcadmin")).toBe(true);
    expect(isBusinessCardAdmin("salescontractor")).toBe(false);
    expect(isPlatformCardAgency("__platform__")).toBe(true);
    expect(isPlatformCardAgency("kcpd")).toBe(false);
    expect(isBusinessCardAdmin("agencyadmin")).toBe(false);
    expect(isBusinessCardAdmin("CAMPUS_ADMIN")).toBe(false);
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
    expect(body).not.toContain("PHOTO");
  });

  it("folds a small JPEG into the vCard and skips photos that cannot be embedded", () => {
    const bytes = new Uint8Array(90);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    const photo = vcardPhotoFromBytes("image/jpeg", bytes);
    const body = buildVCard(card, photo);
    expect(body).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    expect(body.endsWith("\r\n")).toBe(true);
    for (const line of body.split("\r\n")) {
      if (!line) continue;
      expect(Buffer.byteLength(line.startsWith(" ") ? line.slice(1) : line) + (line.startsWith(" ") ? 1 : 0)).toBeLessThanOrEqual(75);
    }
    const oversized = new Uint8Array(180_001);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    expect(vcardPhotoFromBytes("image/jpeg", oversized)).toBeNull();
    expect(vcardPhotoFromBytes("image/webp", Uint8Array.from([0x52, 0x49, 0x46, 0x46]))).toBeNull();
    expect(buildVCard(card)).not.toContain("PHOTO");
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
      coverKey: "biz-cards/agency/secret-cover",
      backgroundColor: "#112233",
    } satisfies BusinessCardProfile;
    const pub = toPublicProfile(profile, "https://assets.nexcortiq.us/a.webp", "https://www.nexcortiq.us/card/ada");
    expect(pub.biography).toBeUndefined();
    expect(pub.phoneNumbers).toHaveLength(1);
    expect(publicResponseHasInternalFields(pub)).toBe(false);
    expect(JSON.stringify(pub)).not.toContain("user-1");
    expect(JSON.stringify(pub)).not.toContain("secret-cover");
    expect(pub.backgroundColor).toBe("#112233");
    expect(JSON.stringify(pub)).not.toContain("secret");
  });
});
