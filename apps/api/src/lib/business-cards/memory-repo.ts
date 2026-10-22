import type {
  BusinessCardAuditLog,
  BusinessCardEvent,
  BusinessCardProfile,
  NFCCard,
  TenantBizCardConfig,
} from "./types.js";
import type { BizCardRepo, ProfilePage } from "./repo.js";

export class MemoryBizCardRepo implements BizCardRepo {
  configs = new Map<string, TenantBizCardConfig>();
  profiles = new Map<string, BusinessCardProfile>();
  cards = new Map<string, NFCCard>();
  events: BusinessCardEvent[] = [];
  audits: BusinessCardAuditLog[] = [];

  async getConfig(tenantId: string): Promise<TenantBizCardConfig | null> {
    return this.configs.get(tenantId) ?? null;
  }

  async putConfig(config: TenantBizCardConfig): Promise<void> {
    this.configs.set(config.tenantId, config);
  }

  async getProfile(profileId: string): Promise<BusinessCardProfile | null> {
    return this.profiles.get(profileId) ?? null;
  }

  async getProfileByUser(tenantId: string, cognitoUserId: string): Promise<BusinessCardProfile | null> {
    return (
      [...this.profiles.values()].find(
        (profile) => profile.tenantId === tenantId && profile.cognitoUserId === cognitoUserId,
      ) ?? null
    );
  }

  async getProfileBySlug(slug: string): Promise<BusinessCardProfile | null> {
    return [...this.profiles.values()].find((profile) => profile.slug === slug) ?? null;
  }

  async getProfileByPublicId(publicProfileId: string): Promise<BusinessCardProfile | null> {
    return [...this.profiles.values()].find((profile) => profile.publicProfileId === publicProfileId) ?? null;
  }

  async saveProfile(
    profile: BusinessCardProfile,
    expectedVersion: number | null,
  ): Promise<"ok" | "conflict" | "slug_taken"> {
    const current = this.profiles.get(profile.profileId);
    if (expectedVersion === null && current) return "conflict";
    if (expectedVersion !== null && (!current || current.version !== expectedVersion)) return "conflict";
    const slugOwner = [...this.profiles.values()].find(
      (item) => item.slug === profile.slug && item.profileId !== profile.profileId,
    );
    if (slugOwner) return "slug_taken";
    this.profiles.set(profile.profileId, profile);
    return "ok";
  }

  async listProfiles(tenantId: string, limit: number, cursor?: string): Promise<ProfilePage> {
    const items = [...this.profiles.values()]
      .filter((profile) => profile.tenantId === tenantId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const start = cursor ? Number(cursor) : 0;
    const slice = items.slice(start, start + limit);
    const next = start + limit < items.length ? String(start + limit) : undefined;
    return { items: slice, cursor: next };
  }

  async incrementCounter(
    profileId: string,
    field: "totalViews" | "totalVcfDownloads" | "totalCallClicks" | "totalEmailClicks" | "totalWebClicks",
    touchLastViewed: boolean,
    now: number,
  ): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;
    profile[field] += 1;
    if (touchLastViewed) profile.lastViewedAt = now;
  }

  async getCard(cardId: string): Promise<NFCCard | null> {
    return this.cards.get(cardId) ?? null;
  }

  async saveCard(card: NFCCard, expectedVersion: number | null): Promise<"ok" | "conflict"> {
    const current = this.cards.get(card.cardId);
    if (expectedVersion === null && current) return "conflict";
    if (expectedVersion !== null && (!current || current.version !== expectedVersion)) return "conflict";
    this.cards.set(card.cardId, card);
    return "ok";
  }

  async listCards(tenantId: string): Promise<NFCCard[]> {
    return [...this.cards.values()].filter((card) => card.tenantId === tenantId);
  }

  async putEvent(event: BusinessCardEvent): Promise<void> {
    this.events.push(event);
  }

  async putAudit(entry: BusinessCardAuditLog): Promise<void> {
    this.audits.push(entry);
  }

  async listAudit(tenantId: string, profileId?: string): Promise<BusinessCardAuditLog[]> {
    return this.audits.filter(
      (entry) => entry.tenantId === tenantId && (!profileId || entry.targetProfileId === profileId),
    );
  }
}
