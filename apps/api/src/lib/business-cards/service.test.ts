import { describe, expect, it } from "vitest";
import { BizCardError } from "./domain.js";
import { MemoryBizCardRepo } from "./memory-repo.js";
import { BusinessCardService, type Actor } from "./service.js";
import { publicResponseHasInternalFields } from "./visibility.js";

const admin: Actor = {
  userId: "admin-1",
  tenantId: "agency-a",
  role: "agencyadmin",
  email: "admin@agency.example",
  displayName: "Avery Admin",
};

const employee: Actor = {
  userId: "user-1",
  tenantId: "agency-a",
  role: "dispatcher",
  email: "jeff@agency.example",
  displayName: "Jeff Coleman",
};

const other: Actor = {
  userId: "user-2",
  tenantId: "agency-b",
  role: "dispatcher",
  email: "other@other.example",
};

function service(repo: MemoryBizCardRepo, globalEnabled = false) {
  return new BusinessCardService(repo, {
    globalEnabled,
    publicBaseUrl: "https://www.nexcortiq.us",
    photoBaseUrl: "https://assets.nexcortiq.us",
    now: () => 1_700_000_000_000,
    newId: (() => {
      let n = 0;
      return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    })(),
    resolveCompany: async (tenantId) => ({
      name: tenantId === "agency-a" ? "Metro PSAP" : "Other Agency",
      website: "https://www.nexcortiq.us",
    }),
  });
}

async function enable(repo: MemoryBizCardRepo, svc: BusinessCardService, actor: Actor) {
  await svc.saveSettings(actor, { enabled: true, version: 0 });
}

describe("business card service", () => {
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
    expect(created.companyName).toBe("Metro PSAP");
    expect(created.status).toBe("inactive");
    await expect(
      svc.saveMine(employee, { version: created.version, companyName: "Not The Agency", title: "Director" }),
    ).rejects.toMatchObject({ code: "field_locked" });
    const saved = await svc.saveMine(employee, { version: created.version, title: "Chief" });
    expect(saved.title).toBe("Chief");
    expect(saved.companyName).toBe("Metro PSAP");
    await expect(svc.saveMine(employee, { version: 1, title: "Stale" })).rejects.toBeInstanceOf(BizCardError);
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
    const otherAdmin: Actor = { ...admin, userId: "admin-b", tenantId: "agency-b", email: "admin@other.example" };
    await enable(repo, svc, otherAdmin);
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
    expect(live.companyName).toBe("Metro PSAP");
    expect(publicResponseHasInternalFields(live)).toBe(false);
    await svc.recordEvent({
      publicProfileId: live.publicProfileId,
      eventType: "page_view",
      sourceType: "nfc",
    });
    const stats = await svc.analyticsFor(employee);
    expect(stats.totalViews).toBe(1);
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
});
