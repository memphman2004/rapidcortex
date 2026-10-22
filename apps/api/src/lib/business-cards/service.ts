import {
  ALWAYS_LOCKED_FIELDS,
  BizCardError,
  assertE164,
  assertHttpsUrl,
  assertSlug,
  assertWebsite,
  auditTtlSeconds,
  changedFieldNames,
  counterAttribute,
  isBusinessCardAdmin,
  isBusinessCardsEnabled,
  isCardTheme,
  monthKey,
  slugifyName,
} from "./domain.js";
import type { BizCardRepo } from "./repo.js";
import type {
  BusinessCardProfile,
  CardTheme,
  EmailAddress,
  NFCCard,
  NfcStatus,
  OfficeAddress,
  PhoneNumber,
  ProfileStatus,
  PublicBusinessCard,
  SocialLink,
  SourceType,
  TagType,
  TenantBizCardConfig,
  BusinessCardEventType,
} from "./types.js";
import { toPublicProfile } from "./visibility.js";

export type Actor = {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  displayName?: string;
};

export type ServiceOptions = {
  globalEnabled: boolean;
  publicBaseUrl: string;
  photoBaseUrl?: string;
  now?: () => number;
  newId?: () => string;
  resolveCompany: (tenantId: string) => Promise<{ name: string; website?: string }>;
};

type Draft = {
  slug?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  credentials?: string;
  title?: string;
  department?: string;
  companyName?: string;
  biography?: string;
  phoneNumbers?: PhoneNumber[];
  emailAddresses?: EmailAddress[];
  website?: string;
  officeAddress?: OfficeAddress;
  socialLinks?: SocialLink[];
  photoKey?: string;
  cardTheme?: CardTheme;
  visibilitySettings?: Record<string, boolean>;
  version?: number;
};

const DEFAULT_VISIBILITY: Record<string, boolean> = {
  credentials: true,
  title: true,
  department: true,
  biography: true,
  website: true,
  officeAddress: true,
  photo: true,
  "phone:mobile": true,
  "phone:office": true,
  "phone:sms": true,
  "phone:fax": false,
  "email:primary": true,
  "email:secondary": false,
  "link:linkedin": true,
  "link:website": true,
  "link:calendar": true,
  "link:custom": true,
};

function keysOf(profile: BusinessCardProfile): Pick<
  BusinessCardProfile,
  "pk" | "sk" | "gsi1pk" | "gsi1sk" | "gsi2pk" | "gsi2sk" | "gsi3pk" | "gsi3sk"
> {
  return {
    pk: `PROFILE#${profile.profileId}`,
    sk: `PROFILE#${profile.profileId}`,
    gsi1pk: `TENANT#${profile.tenantId}`,
    gsi1sk: `PROFILE#${profile.updatedAt}#${profile.profileId}`,
    gsi2pk: `SLUG#${profile.slug}`,
    gsi2sk: "PROFILE",
    gsi3pk: `USER#${profile.cognitoUserId}`,
    gsi3sk: "PROFILE",
  };
}

export class BusinessCardService {
  constructor(
    private readonly repo: BizCardRepo,
    private readonly options: ServiceOptions,
  ) {}

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private id(): string {
    return this.options.newId?.() ?? crypto.randomUUID();
  }

  private base(): string {
    return this.options.publicBaseUrl.replace(/\/$/, "");
  }

  private photoUrl(key?: string): string | undefined {
    if (!key || !this.options.photoBaseUrl) return undefined;
    return `${this.options.photoBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  private async requireEnabled(tenantId: string): Promise<TenantBizCardConfig | null> {
    const config = await this.repo.getConfig(tenantId);
    if (!isBusinessCardsEnabled(this.options.globalEnabled, config)) {
      throw new BizCardError(403, "feature_not_enabled", "feature_not_enabled");
    }
    return config;
  }

  private requireAdmin(actor: Actor): void {
    if (!isBusinessCardAdmin(actor.role)) {
      throw new BizCardError(403, "admin_required", "This action requires an agency administrator.");
    }
  }

  private async loadOwn(actor: Actor, profileId: string): Promise<BusinessCardProfile> {
    const profile = await this.repo.getProfile(profileId);
    if (!profile || profile.tenantId !== actor.tenantId) {
      throw new BizCardError(404, "not_found", "Profile not found.");
    }
    if (profile.cognitoUserId !== actor.userId && !isBusinessCardAdmin(actor.role)) {
      throw new BizCardError(403, "not_owner", "You can edit only your own card.");
    }
    return profile;
  }

  private project(profile: BusinessCardProfile): PublicBusinessCard {
    return toPublicProfile(
      profile,
      this.photoUrl(profile.photoKey),
      `${this.base()}/card/${profile.slug}`,
    );
  }

  async getStatus(actor: Actor): Promise<{
    enabled: boolean;
    hasProfile: boolean;
    profileStatus?: string;
    activeProfiles: number;
    totalProfiles: number;
  }> {
    const config = await this.repo.getConfig(actor.tenantId);
    const enabled = isBusinessCardsEnabled(this.options.globalEnabled, config);
    const mine = await this.repo.getProfileByUser(actor.tenantId, actor.userId);
    const page = isBusinessCardAdmin(actor.role)
      ? await this.repo.listProfiles(actor.tenantId, 200)
      : { items: [] };
    const activeProfiles = page.items.filter((item) => item.status === "active").length;
    return {
      enabled,
      hasProfile: Boolean(mine),
      profileStatus: mine?.status,
      activeProfiles,
      totalProfiles: page.items.length,
    };
  }

  async getMine(actor: Actor): Promise<BusinessCardProfile> {
    await this.requireEnabled(actor.tenantId);
    const profile = await this.repo.getProfileByUser(actor.tenantId, actor.userId);
    if (!profile) throw new BizCardError(404, "not_found", "You do not have a card yet.");
    return profile;
  }

  async saveMine(actor: Actor, draft: Draft): Promise<BusinessCardProfile> {
    const config = await this.requireEnabled(actor.tenantId);
    const existing = await this.repo.getProfileByUser(actor.tenantId, actor.userId);
    if (!existing) return this.createForUser(actor, actor, draft, config, "inactive");
    return this.applyDraft(actor, existing, draft, false);
  }

  async publishMine(actor: Actor): Promise<BusinessCardProfile> {
    const profile = await this.getMine(actor);
    return this.setStatus(actor, profile.profileId, "active");
  }

  async adminCreate(actor: Actor, cognitoUserId: string, draft: Draft): Promise<BusinessCardProfile> {
    this.requireAdmin(actor);
    const config = await this.requireEnabled(actor.tenantId);
    const owner: Actor = { ...actor, userId: cognitoUserId, email: draft.emailAddresses?.find((e) => e.type === "primary")?.address || actor.email };
    const taken = await this.repo.getProfileByUser(actor.tenantId, cognitoUserId);
    if (taken) throw new BizCardError(409, "profile_exists", "That person already has a card.");
    return this.createForUser(actor, owner, draft, config, "inactive");
  }

  async adminUpdate(actor: Actor, profileId: string, draft: Draft): Promise<BusinessCardProfile> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const profile = await this.repo.getProfile(profileId);
    if (!profile || profile.tenantId !== actor.tenantId) {
      throw new BizCardError(404, "not_found", "Profile not found.");
    }
    return this.applyDraft(actor, profile, draft, true);
  }

  async adminSetStatus(
    actor: Actor,
    profileId: string,
    status: ProfileStatus,
    reason: string | undefined,
    version: number,
  ): Promise<BusinessCardProfile> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    return this.setStatus(actor, profileId, status, reason, version);
  }

  async adminSetLocks(actor: Actor, profileId: string, lockedFields: string[]): Promise<BusinessCardProfile> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const profile = await this.loadOwn(actor, profileId);
    const next = { ...profile, lockedFields: [...new Set([...lockedFields, ...ALWAYS_LOCKED_FIELDS])], updatedAt: this.now(), updatedBy: actor.userId, version: profile.version + 1 };
    const saved = await this.repo.saveProfile({ ...next, ...keysOf(next) }, profile.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The card changed. Reload and try again.");
    await this.audit(actor, profile.profileId, "field.lock", ["lockedFields"]);
    return { ...next, ...keysOf(next) };
  }

  async listAdmin(actor: Actor, cursor?: string): Promise<{ items: BusinessCardProfile[]; cursor?: string }> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    return this.repo.listProfiles(actor.tenantId, 50, cursor);
  }

  async getAdmin(actor: Actor, profileId: string): Promise<BusinessCardProfile> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const profile = await this.repo.getProfile(profileId);
    if (!profile || profile.tenantId !== actor.tenantId) {
      throw new BizCardError(404, "not_found", "Profile not found.");
    }
    return profile;
  }

  async getSettings(actor: Actor): Promise<TenantBizCardConfig | null> {
    this.requireAdmin(actor);
    return this.repo.getConfig(actor.tenantId);
  }

  async saveSettings(
    actor: Actor,
    input: Partial<Pick<TenantBizCardConfig, "enabled" | "defaultVisibility" | "lockedFields" | "defaultTheme" | "requireSetup" | "companyWebsite">> & { version?: number },
  ): Promise<TenantBizCardConfig> {
    this.requireAdmin(actor);
    const current = await this.repo.getConfig(actor.tenantId);
    if (current && input.version !== undefined && input.version !== current.version) {
      throw new BizCardError(409, "version_conflict", "Settings changed. Reload and try again.");
    }
    if (input.companyWebsite) assertWebsite(input.companyWebsite);
    if (input.defaultTheme && !isCardTheme(input.defaultTheme)) {
      throw new BizCardError(400, "invalid_theme", "Choose navy, gold, slate, or midnight.");
    }
    const next: TenantBizCardConfig = {
      pk: `TENANT#${actor.tenantId}`,
      sk: "CONFIG",
      tenantId: actor.tenantId,
      enabled: input.enabled ?? current?.enabled ?? false,
      defaultVisibility: input.defaultVisibility ?? current?.defaultVisibility ?? DEFAULT_VISIBILITY,
      lockedFields: [...new Set([...(input.lockedFields ?? current?.lockedFields ?? []), ...ALWAYS_LOCKED_FIELDS])],
      defaultTheme: input.defaultTheme ?? current?.defaultTheme ?? "navy",
      requireSetup: input.requireSetup ?? current?.requireSetup ?? false,
      companyWebsite: input.companyWebsite ?? current?.companyWebsite,
      updatedAt: this.now(),
      updatedBy: actor.userId,
      version: (current?.version ?? 0) + 1,
    };
    await this.repo.putConfig(next);
    await this.audit(actor, actor.tenantId, "tenant.settings", Object.keys(input));
    return next;
  }

  async createCard(actor: Actor, tagType: TagType): Promise<NFCCard> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const now = this.now();
    const cardId = this.id();
    const card: NFCCard = {
      pk: `NFC#${cardId}`,
      sk: `NFC#${cardId}`,
      gsi1pk: `TENANT#${actor.tenantId}`,
      gsi1sk: `NFC#unassigned#${cardId}`,
      gsi2pk: "PROFILE#",
      gsi2sk: `NFC#${cardId}`,
      cardId,
      tenantId: actor.tenantId,
      tagType,
      permanentUrl: `${this.base()}/c/${cardId}`,
      status: "unassigned",
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
      version: 1,
    };
    await this.repo.saveCard(card, null);
    await this.audit(actor, cardId, "card.create", ["cardId"]);
    return card;
  }

  async listCards(actor: Actor): Promise<NFCCard[]> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    return this.repo.listCards(actor.tenantId);
  }

  async getCard(actor: Actor, cardId: string): Promise<NFCCard> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const card = await this.repo.getCard(cardId);
    if (!card || card.tenantId !== actor.tenantId) throw new BizCardError(404, "not_found", "Card not found.");
    return card;
  }

  async assignCard(actor: Actor, cardId: string, profileId: string, version: number): Promise<NFCCard> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const card = await this.getCard(actor, cardId);
    if (card.version !== version) throw new BizCardError(409, "version_conflict", "The NFC card changed. Reload and try again.");
    if (card.status === "revoked") throw new BizCardError(400, "revoked", "A revoked tag cannot be assigned. Issue a new card.");
    const profile = await this.repo.getProfile(profileId);
    if (!profile || profile.tenantId !== actor.tenantId) throw new BizCardError(404, "not_found", "Profile not found.");
    const now = this.now();
    const next: NFCCard = {
      ...card,
      assignedProfileId: profile.profileId,
      status: "assigned",
      assignedAt: now,
      updatedAt: now,
      version: card.version + 1,
      gsi1sk: `NFC#assigned#${card.cardId}`,
      gsi2pk: `PROFILE#${profile.profileId}`,
    };
    const saved = await this.repo.saveCard(next, card.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The NFC card changed. Reload and try again.");
    await this.audit(actor, profile.profileId, "card.assign", ["assignedProfileId"]);
    return next;
  }

  async setCardStatus(actor: Actor, cardId: string, status: NfcStatus, version: number): Promise<NFCCard> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    if (status === "revoked") {
      throw new BizCardError(400, "use_revoke", "Revocation requires a reason.");
    }
    const card = await this.getCard(actor, cardId);
    if (card.version !== version) throw new BizCardError(409, "version_conflict", "The NFC card changed. Reload and try again.");
    const now = this.now();
    const next: NFCCard = {
      ...card,
      status,
      updatedAt: now,
      version: card.version + 1,
      gsi1sk: `NFC#${status}#${card.cardId}`,
      programmedAt: status === "programmed" ? now : card.programmedAt,
      verifiedAt: status === "verified" ? now : card.verifiedAt,
    };
    const saved = await this.repo.saveCard(next, card.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The NFC card changed. Reload and try again.");
    await this.audit(actor, card.assignedProfileId ?? card.cardId, "card.status", ["status"]);
    return next;
  }

  async revokeCard(actor: Actor, cardId: string, reason: string, version: number): Promise<NFCCard> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    if (!reason.trim()) throw new BizCardError(400, "reason_required", "A revocation reason is required.");
    const card = await this.getCard(actor, cardId);
    if (card.version !== version) throw new BizCardError(409, "version_conflict", "The NFC card changed. Reload and try again.");
    const now = this.now();
    const next: NFCCard = {
      ...card,
      status: "revoked",
      revokedAt: now,
      revokedBy: actor.userId,
      revokedReason: reason.trim(),
      updatedAt: now,
      version: card.version + 1,
      gsi1sk: `NFC#revoked#${card.cardId}`,
    };
    const saved = await this.repo.saveCard(next, card.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The NFC card changed. Reload and try again.");
    await this.audit(actor, card.assignedProfileId ?? card.cardId, "card.revoke", ["status"]);
    return next;
  }

  async publicBySlug(slug: string): Promise<PublicBusinessCard> {
    const profile = await this.repo.getProfileBySlug(slug);
    if (!profile || profile.status !== "active") throw new BizCardError(404, "not_found", "Card not found.");
    const config = await this.repo.getConfig(profile.tenantId);
    if (!isBusinessCardsEnabled(this.options.globalEnabled, config)) {
      throw new BizCardError(404, "not_found", "Card not found.");
    }
    return this.project(profile);
  }

  async publicById(publicProfileId: string): Promise<PublicBusinessCard> {
    const profile = await this.repo.getProfileByPublicId(publicProfileId);
    if (!profile || profile.status !== "active") throw new BizCardError(404, "not_found", "Card not found.");
    const config = await this.repo.getConfig(profile.tenantId);
    if (!isBusinessCardsEnabled(this.options.globalEnabled, config)) {
      throw new BizCardError(404, "not_found", "Card not found.");
    }
    return this.project(profile);
  }

  async vcardForPublicId(publicProfileId: string): Promise<{ body: string; fileName: string }> {
    const card = await this.publicById(publicProfileId);
    const { buildVCard, sanitizeVCardFileName } = await import("./vcard.js");
    return { body: buildVCard(card), fileName: sanitizeVCardFileName(card.displayName) };
  }

  async resolveNfc(cardId: string): Promise<{ location: string; profile?: BusinessCardProfile }> {
    const card = await this.repo.getCard(cardId);
    if (!card || card.status === "revoked") return { location: "/c/revoked" };
    if (!card.assignedProfileId) return { location: "/c/inactive" };
    const profile = await this.repo.getProfile(card.assignedProfileId);
    if (!profile || profile.tenantId !== card.tenantId || profile.status !== "active") {
      return { location: "/c/inactive" };
    }
    const config = await this.repo.getConfig(card.tenantId);
    if (!isBusinessCardsEnabled(this.options.globalEnabled, config)) return { location: "/c/inactive" };
    return { location: `/card/${profile.slug}`, profile };
  }

  async recordEvent(input: {
    publicProfileId: string;
    eventType: BusinessCardEventType;
    sourceType: SourceType;
    cardId?: string;
    userAgent?: string;
    referrer?: string;
    region?: string;
  }): Promise<void> {
    const profile = await this.repo.getProfileByPublicId(input.publicProfileId);
    if (!profile || profile.status !== "active") return;
    const config = await this.repo.getConfig(profile.tenantId);
    if (!isBusinessCardsEnabled(this.options.globalEnabled, config)) return;
    const now = this.now();
    const eventId = this.id();
    const month = monthKey(now);
    const counter = counterAttribute(input.eventType);
    await this.repo.putEvent({
      pk: `EVENT#${profile.profileId}#${month}`,
      sk: `EVENT#${now}#${eventId}`,
      gsi1pk: `TENANT#${profile.tenantId}#${month}`,
      gsi1sk: `EVENT#${now}`,
      eventId,
      tenantId: profile.tenantId,
      profileId: profile.profileId,
      cardId: input.cardId,
      eventType: input.eventType,
      sourceType: input.sourceType,
      occurredAt: now,
      anonymousMetadata: {
        userAgent: browserFamily(input.userAgent),
        referrer: referrerDomain(input.referrer),
        region: input.region,
      },
    });
    await this.repo.incrementCounter(profile.profileId, counter.field, counter.touchLastViewed, now);
  }

  async analyticsFor(actor: Actor, profileId?: string): Promise<Record<string, number | undefined>> {
    await this.requireEnabled(actor.tenantId);
    const profile = profileId
      ? await this.getAdmin(actor, profileId)
      : await this.getMine(actor);
    return {
      totalViews: profile.totalViews,
      totalVcfDownloads: profile.totalVcfDownloads,
      totalCallClicks: profile.totalCallClicks,
      totalEmailClicks: profile.totalEmailClicks,
      totalWebClicks: profile.totalWebClicks,
      lastViewedAt: profile.lastViewedAt,
    };
  }

  async tenantAnalytics(actor: Actor): Promise<{ activeProfiles: number; totalProfiles: number; totalViews: number }> {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    const page = await this.repo.listProfiles(actor.tenantId, 200);
    return {
      activeProfiles: page.items.filter((item) => item.status === "active").length,
      totalProfiles: page.items.length,
      totalViews: page.items.reduce((sum, item) => sum + (item.totalViews || 0), 0),
    };
  }

  async auditFor(actor: Actor, profileId?: string) {
    this.requireAdmin(actor);
    await this.requireEnabled(actor.tenantId);
    if (profileId) await this.getAdmin(actor, profileId);
    return this.repo.listAudit(actor.tenantId, profileId);
  }

  photoTarget(actor: Actor, profile: BusinessCardProfile, contentType: string): { key: string; ext: string } {
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : contentType === "image/jpeg" ? "jpg" : "";
    if (!ext) throw new BizCardError(400, "invalid_type", "Upload a JPEG, PNG, or WebP image.");
    return { key: `biz-cards/${actor.tenantId}/${profile.profileId}/${this.id()}.${ext}`, ext };
  }

  async setPhotoKey(actor: Actor, profileId: string, photoKey: string | undefined, asAdmin: boolean): Promise<void> {
    const profile = asAdmin ? await this.getAdmin(actor, profileId) : await this.getMine(actor);
    if (!asAdmin && profile.lockedFields.includes("photoKey")) {
      throw new BizCardError(400, "field_locked", "Photo is locked by an administrator.");
    }
    const next = { ...profile, photoKey, updatedAt: this.now(), updatedBy: actor.userId, version: profile.version + 1 };
    const saved = await this.repo.saveProfile({ ...next, ...keysOf(next) }, profile.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The card changed. Reload and try again.");
    await this.audit(actor, profile.profileId, photoKey ? "profile.photo" : "profile.photo.remove", ["photoKey"]);
  }

  private async createForUser(
    actor: Actor,
    owner: Actor,
    draft: Draft,
    config: TenantBizCardConfig | null,
    status: ProfileStatus,
  ): Promise<BusinessCardProfile> {
    const company = await this.options.resolveCompany(actor.tenantId);
    const now = this.now();
    const profileId = this.id();
    const publicProfileId = this.id();
    const slug = draft.slug?.trim() || slugifyName(draft.firstName || owner.displayName || "card", draft.lastName || "user");
    assertSlug(slug);
    this.validateDraft(draft);
    const profile: BusinessCardProfile = {
      ...keysOf({
        profileId,
        tenantId: actor.tenantId,
        cognitoUserId: owner.userId,
        slug,
        updatedAt: now,
      } as BusinessCardProfile),
      profileId,
      tenantId: actor.tenantId,
      cognitoUserId: owner.userId,
      publicProfileId,
      slug,
      firstName: draft.firstName?.trim() || "",
      lastName: draft.lastName?.trim() || "",
      displayName: draft.displayName?.trim() || owner.displayName || owner.email,
      credentials: draft.credentials?.trim(),
      title: draft.title?.trim() || "",
      department: draft.department?.trim(),
      companyName: company.name,
      biography: draft.biography?.slice(0, 280),
      phoneNumbers: draft.phoneNumbers ?? [],
      emailAddresses: this.lockPrimaryEmail(draft.emailAddresses ?? [], owner.email),
      website: company.website || config?.companyWebsite,
      officeAddress: draft.officeAddress,
      socialLinks: draft.socialLinks ?? [],
      visibilitySettings: draft.visibilitySettings ?? config?.defaultVisibility ?? DEFAULT_VISIBILITY,
      lockedFields: [...new Set([...(config?.lockedFields ?? []), ...ALWAYS_LOCKED_FIELDS])],
      cardTheme: draft.cardTheme && isCardTheme(draft.cardTheme) ? draft.cardTheme : config?.defaultTheme ?? "navy",
      status,
      totalViews: 0,
      totalVcfDownloads: 0,
      totalCallClicks: 0,
      totalEmailClicks: 0,
      totalWebClicks: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      version: 1,
    };
    const saved = await this.repo.saveProfile(profile, null);
    if (saved === "slug_taken") throw new BizCardError(409, "slug_taken", "That public address is already in use.");
    await this.audit(actor, profileId, "profile.create", ["profileId"]);
    return profile;
  }

  private async applyDraft(
    actor: Actor,
    profile: BusinessCardProfile,
    draft: Draft,
    asAdmin: boolean,
  ): Promise<BusinessCardProfile> {
    if (draft.version === undefined || draft.version !== profile.version) {
      throw new BizCardError(409, "version_conflict", "The card changed. Reload and try again.");
    }
    this.validateDraft(draft);
    const company = await this.options.resolveCompany(actor.tenantId);
    const locked = new Set(profile.lockedFields);
    if (!asAdmin) this.rejectLockedChanges(profile, draft, locked);
    const slug = asAdmin && draft.slug ? draft.slug : profile.slug;
    if (asAdmin && draft.slug) assertSlug(draft.slug);
    const now = this.now();
    const next: BusinessCardProfile = {
      ...profile,
      slug,
      firstName: pick(draft.firstName, profile.firstName, asAdmin || !locked.has("firstName")),
      lastName: pick(draft.lastName, profile.lastName, asAdmin || !locked.has("lastName")),
      displayName: pick(draft.displayName, profile.displayName, asAdmin || !locked.has("displayName")),
      credentials: pick(draft.credentials, profile.credentials, asAdmin || !locked.has("credentials")),
      title: pick(draft.title, profile.title, asAdmin || !locked.has("title")) ?? "",
      department: pick(draft.department, profile.department, asAdmin || !locked.has("department")),
      companyName: company.name,
      biography: (asAdmin || !locked.has("biography") ? draft.biography ?? profile.biography : profile.biography)?.slice(0, 280),
      phoneNumbers: asAdmin || !locked.has("phoneNumbers") ? draft.phoneNumbers ?? profile.phoneNumbers : profile.phoneNumbers,
      emailAddresses: this.lockPrimaryEmail(
        asAdmin || !locked.has("emailAddresses") ? draft.emailAddresses ?? profile.emailAddresses : profile.emailAddresses,
        profile.emailAddresses.find((email) => email.type === "primary")?.address || actor.email,
      ),
      website: company.website || profile.website,
      officeAddress: asAdmin || !locked.has("officeAddress") ? draft.officeAddress ?? profile.officeAddress : profile.officeAddress,
      socialLinks: asAdmin || !locked.has("socialLinks") ? draft.socialLinks ?? profile.socialLinks : profile.socialLinks,
      cardTheme: asAdmin || !locked.has("cardTheme") ? draft.cardTheme ?? profile.cardTheme : profile.cardTheme,
      visibilitySettings: asAdmin ? draft.visibilitySettings ?? profile.visibilitySettings : profile.visibilitySettings,
      updatedAt: now,
      updatedBy: actor.userId,
      version: profile.version + 1,
    };
    const saved = await this.repo.saveProfile({ ...next, ...keysOf(next) }, profile.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The card changed. Reload and try again.");
    if (saved === "slug_taken") throw new BizCardError(409, "slug_taken", "That public address is already in use.");
    const fields = changedFieldNames(
      profile as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
    ).filter((field) => !["updatedAt", "updatedBy", "version", "gsi1sk", "gsi2pk", "pk", "sk"].includes(field));
    await this.audit(actor, profile.profileId, "profile.update", fields);
    return { ...next, ...keysOf(next) };
  }

  private rejectLockedChanges(profile: BusinessCardProfile, draft: Draft, locked: Set<string>): void {
    const attempts: Array<[string, unknown, unknown]> = [
      ["displayName", draft.displayName, profile.displayName],
      ["credentials", draft.credentials, profile.credentials],
      ["title", draft.title, profile.title],
      ["department", draft.department, profile.department],
      ["biography", draft.biography, profile.biography],
      ["companyName", draft.companyName, profile.companyName],
      ["website", draft.website, profile.website],
      ["phoneNumbers", draft.phoneNumbers, profile.phoneNumbers],
      ["emailAddresses", draft.emailAddresses, profile.emailAddresses],
      ["officeAddress", draft.officeAddress, profile.officeAddress],
      ["socialLinks", draft.socialLinks, profile.socialLinks],
      ["cardTheme", draft.cardTheme, profile.cardTheme],
      ["slug", draft.slug, profile.slug],
    ];
    for (const [field, incoming, current] of attempts) {
      if (incoming === undefined) continue;
      if (!locked.has(field) && !ALWAYS_LOCKED_FIELDS.includes(field as (typeof ALWAYS_LOCKED_FIELDS)[number])) continue;
      if (field === "companyName" || field === "website" || field === "primaryEmail") {
        if (JSON.stringify(incoming) !== JSON.stringify(current) && field !== "primaryEmail") {
          throw new BizCardError(400, "field_locked", `${field} is locked.`);
        }
        continue;
      }
      if (locked.has(field) && JSON.stringify(incoming) !== JSON.stringify(current)) {
        throw new BizCardError(400, "field_locked", `${field} is locked.`);
      }
    }
    const primary = draft.emailAddresses?.find((email) => email.type === "primary");
    const currentPrimary = profile.emailAddresses.find((email) => email.type === "primary");
    if (primary && currentPrimary && primary.address !== currentPrimary.address) {
      throw new BizCardError(400, "field_locked", "primaryEmail is locked.");
    }
  }

  private lockPrimaryEmail(emails: EmailAddress[], primary: string): EmailAddress[] {
    const rest = emails.filter((email) => email.type !== "primary");
    return [{ type: "primary", address: primary, public: emails.find((email) => email.type === "primary")?.public ?? true }, ...rest];
  }

  private validateDraft(draft: Draft): void {
    if (draft.biography && draft.biography.length > 280) {
      throw new BizCardError(400, "biography_too_long", "Biography must be 280 characters or fewer.");
    }
    for (const phone of draft.phoneNumbers ?? []) assertE164(phone.number);
    for (const link of draft.socialLinks ?? []) assertHttpsUrl(link.url, "Link");
    if (draft.website) assertWebsite(draft.website);
    if (draft.slug) assertSlug(draft.slug);
    if (draft.cardTheme && !isCardTheme(draft.cardTheme)) {
      throw new BizCardError(400, "invalid_theme", "Choose navy, gold, slate, or midnight.");
    }
  }

  private async setStatus(
    actor: Actor,
    profileId: string,
    status: ProfileStatus,
    reason?: string,
    expectedVersion?: number,
  ): Promise<BusinessCardProfile> {
    const profile = await this.loadOwn(actor, profileId);
    if (expectedVersion !== undefined && profile.version !== expectedVersion) {
      throw new BizCardError(409, "version_conflict", "The card changed. Reload and try again.");
    }
    const now = this.now();
    const next: BusinessCardProfile = {
      ...profile,
      status,
      updatedAt: now,
      updatedBy: actor.userId,
      version: profile.version + 1,
      activatedAt: status === "active" ? now : profile.activatedAt,
      deactivatedAt: status === "inactive" ? now : profile.deactivatedAt,
      archivedAt: status === "archived" ? now : profile.archivedAt,
      archiveReason: status === "archived" ? reason : profile.archiveReason,
    };
    const saved = await this.repo.saveProfile({ ...next, ...keysOf(next) }, profile.version);
    if (saved === "conflict") throw new BizCardError(409, "version_conflict", "The card changed. Reload and try again.");
    await this.audit(actor, profile.profileId, `profile.${status}`, ["status"]);
    return { ...next, ...keysOf(next) };
  }

  private async audit(actor: Actor, targetProfileId: string, action: string, changedFields: string[]): Promise<void> {
    const now = this.now();
    const auditId = this.id();
    const month = monthKey(now);
    try {
      await this.repo.putAudit({
        pk: `AUDIT#${actor.tenantId}#${month}`,
        sk: `AUDIT#${now}#${auditId}`,
        gsi1pk: `AUDITPROFILE#${targetProfileId}`,
        gsi1sk: `AUDIT#${now}`,
        auditId,
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        actorRole: isBusinessCardAdmin(actor.role) ? "admin" : "employee",
        targetProfileId,
        action,
        changedFields,
        occurredAt: now,
        ttl: auditTtlSeconds(now),
      });
    } catch {
      // Audit failure must not block the card change.
    }
  }
}

function pick<T>(incoming: T | undefined, current: T, allowed: boolean): T {
  if (!allowed || incoming === undefined) return current;
  return incoming;
}

function browserFamily(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  if (/iphone|ipad/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/windows/i.test(userAgent)) return "Windows";
  return "other";
}

function referrerDomain(referrer?: string): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname;
  } catch {
    return undefined;
  }
}
