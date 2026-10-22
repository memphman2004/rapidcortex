import type {
  BusinessCardAuditLog,
  BusinessCardEvent,
  BusinessCardProfile,
  NFCCard,
  TenantBizCardConfig,
} from "./types.js";

export type ProfilePage = {
  items: BusinessCardProfile[];
  cursor?: string;
};

export type BizCardRepo = {
  getConfig(tenantId: string): Promise<TenantBizCardConfig | null>;
  putConfig(config: TenantBizCardConfig): Promise<void>;
  getProfile(profileId: string): Promise<BusinessCardProfile | null>;
  getProfileByUser(tenantId: string, cognitoUserId: string): Promise<BusinessCardProfile | null>;
  getProfileBySlug(slug: string): Promise<BusinessCardProfile | null>;
  getProfileByPublicId(publicProfileId: string): Promise<BusinessCardProfile | null>;
  saveProfile(profile: BusinessCardProfile, expectedVersion: number | null): Promise<"ok" | "conflict" | "slug_taken">;
  listProfiles(tenantId: string, limit: number, cursor?: string): Promise<ProfilePage>;
  incrementCounter(
    profileId: string,
    field: "totalViews" | "totalVcfDownloads" | "totalCallClicks" | "totalEmailClicks" | "totalWebClicks",
    touchLastViewed: boolean,
    now: number,
  ): Promise<void>;
  getCard(cardId: string): Promise<NFCCard | null>;
  saveCard(card: NFCCard, expectedVersion: number | null): Promise<"ok" | "conflict">;
  listCards(tenantId: string): Promise<NFCCard[]>;
  putEvent(event: BusinessCardEvent): Promise<void>;
  putAudit(entry: BusinessCardAuditLog): Promise<void>;
  listAudit(tenantId: string, profileId?: string): Promise<BusinessCardAuditLog[]>;
};
