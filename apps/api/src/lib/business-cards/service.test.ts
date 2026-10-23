import { describe, expect, it } from "vitest";
import { BizCardError } from "./domain.js";
import { MemoryBizCardRepo } from "./memory-repo.js";
import { BusinessCardService, type Actor } from "./service.js";
import { publicResponseHasInternalFields } from "./visibility.js";

const admin: Actor = {
  userId: "admin-1",
  tenantId: "__platform__",
  role: "rcadmin",
  email: "admin@agency.example",
  displayName: "Avery Admin",
};

const employee: Actor = {
  userId: "user-1",
  tenantId: "__platform__",
  role: "salescontractor",
  email: "jeff@agency.example",
  displayName: "Jeff Coleman",
};

const other: Actor = {
  userId: "user-2",
  tenantId: "agency-b",
  role: "dispatcher",
  email: "other@other.example",
};

function service(
  repo: MemoryBizCardRepo,
  globalEnabled = false,
  loadPhoto?: (key: string) => Promise<{ contentType: string; bytes: Uint8Array } | null>,
) {
  return new BusinessCardService(repo, {
    globalEnabled,
    publicBaseUrl: "https://www.nexcortiq.us",
    photoBaseUrl: "https://assets.nexcortiq.us",
    now: () => 1_700_000_000_000,
    newId: (() => {
      let n = 0;
      return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    })(),
    loadPhoto,
    resolveCompany: async (tenantId) => ({
      name: tenantId === "__platform__" ? "NexCort iQ" : "Other Agency",
      website: "https://www.nexcortiq.us",
    }),
  });
}

async function enable(repo: MemoryBizCardRepo, svc: BusinessCardService, actor: Actor) {
  await svc.saveSettings(actor, { enabled: true, version: 0 });
}

describe("business card service", () => {
  it("hides the feature from every agency except the NexCort platform", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo, true);
    const customer: Actor = { ...admin, tenantId: "kcpd" };
    const status = await svc.getStatus(customer);
    expect(status.enabled).toBe(false);
    await expect(svc.saveSettings(customer, { enabled: true })).rejects.toMatchObject({ status: 404 });
    await expect(svc.saveMine({ ...employee, tenantId: "kcpd" }, { displayName: "Pat" })).rejects.toMatchObject({ status: 404 });
  });

  it("hides the feature from agency staff", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo, true);
    const dispatcher: Actor = { ...employee, role: "dispatcher" };
    const status = await svc.getStatus(dispatcher);
    expect(status.enabled).toBe(false);
    await expect(svc.saveMine(dispatcher, { displayName: "Pat Dispatcher" })).rejects.toMatchObject({
      code: "nexcort_only",
      status: 403,
    });
  });

  it("returns enabled false for a tenant that has not opted in", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo, false);
    const status = await svc.getStatus(employee);
    expect(status.enabled).toBe(false);
    expect(status.hasProfile).toBe(false);
    await expect(svc.getMine(employee)).rejects.toMatchObject({ code: "feature_not_enabled", status: 403 });
  });

  it("lets an employee edit unlocked fields and rejects locked ones", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo);
    await enable(repo, svc, admin);
    const created = await svc.saveMine(employee, {
      firstName: "Jeff",
      lastName: "Coleman",
      displayName: "Jeff Coleman",
      title: "Director",
      phoneNumbers: [{ type: "mobile", number: "+14155552671", public: true }],
    });
    expect(created.companyName).toBe("NexCort iQ");
    expect(created.status).toBe("inactive");
    await expect(
      svc.saveMine(employee, { version: created.version, companyName: "Not The Agency", title: "Director" }),
    ).rejects.toMatchObject({ code: "field_locked" });
    const saved = await svc.saveMine(employee, { version: created.version, title: "Chief" });
    expect(saved.title).toBe("Chief");
    const renamed = await svc.saveMine(employee, { version: saved.version, slug: "jeff-c" });
    expect(renamed.slug).toBe("jeff-c");
    expect(saved.companyName).toBe("NexCort iQ");
    const contacted = await svc.saveMine(employee, {
      version: renamed.version,
      website: "https://james.example",
      emailAddresses: [{ type: "primary", address: "james@nexcortiq.us", public: true }],
    });
    expect(contacted.website).toBe("https://james.example");
    expect(contacted.emailAddresses[0]?.address).toBe("james@nexcortiq.us");
    await expect(svc.saveMine(employee, { version: 1, title: "Stale" })).rejects.toBeInstanceOf(BizCardError);
    const recovered = await svc.saveMine(employee, { biography: "A longer biography that was typed before the card loaded." });
    expect(recovered.biography).toBe("A longer biography that was typed before the card loaded.");
    expect(recovered.version).toBeGreaterThan(contacted.version);
  });

  it("hides another tenant's profile", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo);
    await enable(repo, svc, admin);
    const created = await svc.adminCreate(admin, employee.userId, {
      displayName: "Jeff Coleman",
      firstName: "Jeff",
      lastName: "Coleman",
      title: "Director",
      emailAddresses: [{ type: "primary", address: employee.email, public: true }],
    });
    const otherAdmin: Actor = { ...admin, userId: "admin-b", tenantId: "agency-b", role: "rcadmin", email: "admin@other.example" };
    await expect(svc.saveSettings(otherAdmin, { enabled: true })).rejects.toMatchObject({ status: 404 });
    await expect(svc.getAdmin(otherAdmin, created.profileId)).rejects.toMatchObject({ status: 404 });
    await expect(svc.adminUpdate(other, created.profileId, { version: 1, title: "Nope" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("keeps a revoked tag from resolving to the profile", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo);
    await enable(repo, svc, admin);
    const profile = await svc.saveMine(employee, {
      firstName: "Jeff",
      lastName: "Coleman",
      displayName: "Jeff Coleman",
      title: "Director",
    });
    await svc.publishMine(employee);
    const card = await svc.createCard(admin, "NTAG213");
    const assigned = await svc.assignCard(admin, card.cardId, profile.profileId, card.version);
    const programmed = await svc.setCardStatus(admin, card.cardId, "programmed", assigned.version);
    expect((await svc.resolveNfc(card.cardId)).location).toBe("/card/jeff-coleman");
    await svc.revokeCard(admin, card.cardId, "Tag lost", programmed.version);
    expect((await svc.resolveNfc(card.cardId)).location).toBe("/c/revoked");
    const live = await svc.publicBySlug("jeff-coleman");
    expect(live.companyName).toBe("NexCort iQ");
    expect(publicResponseHasInternalFields(live)).toBe(false);
    await svc.recordEvent({
      publicProfileId: live.publicProfileId,
      eventType: "page_view",
      sourceType: "nfc",
    });
    const stats = await svc.analyticsFor(employee);
    expect(stats.totalViews).toBe(1);
  });

  it("walks a card from draft through publish, vCard, program, and revoke", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo);
    await enable(repo, svc, admin);
    const draft = await svc.saveMine(employee, {
      firstName: "Jeff",
      lastName: "Coleman",
      displayName: "Jeff Coleman",
      title: "Director",
      phoneNumbers: [{ type: "mobile", number: "+14155552671", public: true }],
      emailAddresses: [{ type: "primary", address: employee.email, public: true }],
    });
    expect(await svc.publicBySlug("jeff-coleman").catch((error: BizCardError) => error.status)).toBe(404);
    await svc.publishMine(employee);
    const live = await svc.publicBySlug("jeff-coleman");
    const file = await svc.vcardForPublicId(live.publicProfileId);
    expect(file.body).toContain("FN:Jeff Coleman");
    expect(file.body).toContain("ORG:NexCort iQ");
    expect(file.body).toContain("TEL;TYPE=MOBILE:+14155552671");
    await svc.adminSetLocks(admin, draft.profileId, ["title"]);
    const locked = await svc.getMine(employee);
    await expect(svc.saveMine(employee, { version: locked.version, title: "Intern" })).rejects.toMatchObject({
      code: "field_locked",
    });
    const card = await svc.createCard(admin, "NTAG213");
    const assigned = await svc.assignCard(admin, card.cardId, draft.profileId, card.version);
    const programmed = await svc.setCardStatus(admin, card.cardId, "programmed", assigned.version);
    const verified = await svc.setCardStatus(admin, card.cardId, "verified", programmed.version);
    expect((await svc.resolveNfc(card.cardId)).location).toBe("/card/jeff-coleman");
    await svc.revokeCard(admin, card.cardId, "Lost tag", verified.version);
    expect((await svc.resolveNfc(card.cardId)).location).toBe("/c/revoked");
    expect((await svc.publicBySlug("jeff-coleman")).displayName).toBe("Jeff Coleman");
  });

  it("denies an employee who targets someone else's card in the same agency", async () => {
    const repo = new MemoryBizCardRepo();
    const svc = service(repo);
    await enable(repo, svc, admin);
    const created = await svc.adminCreate(admin, "user-9", {
      displayName: "Other Person",
      firstName: "Other",
      lastName: "Person",
      title: "Operator",
      emailAddresses: [{ type: "primary", address: "other@agency.example", public: true }],
    });
    await expect(svc.adminUpdate(employee, created.profileId, { version: 1, title: "Hacked" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("persists custom colors, keeps another tenant out, and embeds a portrait", async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x11]);
    const repo = new MemoryBizCardRepo();
    const svc = service(repo, false, async () => ({ contentType: "image/jpeg", bytes: jpeg }));
    await enable(repo, svc, admin);
    const created = await svc.saveMine(employee, {
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      emailAddresses: [{ type: "primary", address: employee.email, public: true }],
    });
    const saved = await svc.saveMine(employee, {
      version: created.version,
      backgroundColor: "#112233",
      accentColor: "#abcdef",
      photoFocusX: 30,
      photoFocusY: 70,
    });
    expect(saved.backgroundColor).toBe("#112233");
    expect(saved.accentColor).toBe("#abcdef");
    await svc.setPhotoKey(employee, saved.profileId, `biz-cards/${employee.tenantId}/${saved.profileId}/face.jpg`, false);
    await svc.setCoverKey(employee, saved.profileId, `biz-cards/${employee.tenantId}/${saved.profileId}/cover.jpg`, false);
    const cleared = await svc.saveMine(employee, { version: (await svc.getMine(employee)).version, backgroundColor: "" });
    expect(cleared.backgroundColor).toBeUndefined();
    await svc.saveMine(employee, { version: cleared.version, backgroundColor: "#112233" });
    await svc.publishMine(employee);
    const pub = await svc.publicBySlug(saved.slug);
    expect(pub.backgroundColor).toBe("#112233");
    expect(pub.coverUrl).toContain("cover.jpg");
    expect(JSON.stringify(pub)).not.toContain("coverKey");
    const file = await svc.vcardForPublicId(pub.publicProfileId);
    expect(file.body).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    expect(file.body).toContain("VERSION:3.0");
    const outsider: Actor = { ...admin, userId: "admin-b", tenantId: "agency-b", email: "b@agency.example" };
    await expect(svc.saveSettings(outsider, { enabled: true })).rejects.toMatchObject({ status: 404, code: "not_found" });
    await expect(svc.getAdmin(outsider, saved.profileId)).rejects.toMatchObject({ status: 404, code: "not_found" });
  });
});
