export const CARD_THEMES = ["navy", "gold", "slate", "midnight"] as const;
export type CardTheme = (typeof CARD_THEMES)[number];

export const PROFILE_STATUSES = ["active", "inactive", "archived"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const NFC_STATUSES = ["unassigned", "assigned", "programmed", "verified", "revoked"] as const;
export type NfcStatus = (typeof NFC_STATUSES)[number];

export const TAG_TYPES = ["NTAG213", "NTAG215", "NTAG216", "other"] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const EVENT_TYPES = [
  "page_view",
  "vcf_download",
  "call_click",
  "email_click",
  "web_click",
  "linkedin_click",
  "calendar_click",
  "share_click",
] as const;
export type BusinessCardEventType = (typeof EVENT_TYPES)[number];

export const SOURCE_TYPES = ["nfc", "qr", "direct_link", "shared_link", "unknown"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export type PhoneNumber = {
  type: "mobile" | "office" | "sms" | "fax";
  number: string;
  extension?: string;
  public: boolean;
};

export type EmailAddress = {
  type: "primary" | "secondary";
  address: string;
  public: boolean;
};

export type SocialLink = {
  type: "linkedin" | "website" | "calendar" | "custom";
  label?: string;
  url: string;
  public: boolean;
};

export type OfficeAddress = {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  public: boolean;
};

export type BusinessCardProfile = {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk: string;
  gsi2sk: string;
  gsi3pk: string;
  gsi3sk: string;
  profileId: string;
  tenantId: string;
  cognitoUserId: string;
  publicProfileId: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  credentials?: string;
  title: string;
  department?: string;
  companyName: string;
  biography?: string;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
  website?: string;
  officeAddress?: OfficeAddress;
  socialLinks: SocialLink[];
  photoKey?: string;
  companyLogoKey?: string;
  /** Optional override of the preset theme. Empty means the preset is in use. */
  backgroundColor?: string;
  accentColor?: string;
  coverKey?: string;
  /** Profile photo focal point, 0–100. Omitted means centered. */
  photoFocusX?: number;
  photoFocusY?: number;
  visibilitySettings: Record<string, boolean>;
  lockedFields: string[];
  cardTheme: CardTheme;
  status: ProfileStatus;
  activatedAt?: number;
  deactivatedAt?: number;
  archivedAt?: number;
  archiveReason?: string;
  internalNotes?: string;
  totalViews: number;
  totalVcfDownloads: number;
  totalCallClicks: number;
  totalEmailClicks: number;
  totalWebClicks: number;
  lastViewedAt?: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
  version: number;
};

export type NFCCard = {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk: string;
  gsi2sk: string;
  cardId: string;
  tenantId: string;
  assignedProfileId?: string;
  tagType: TagType;
  permanentUrl: string;
  status: NfcStatus;
  programmedAt?: number;
  verifiedAt?: number;
  assignedAt?: number;
  revokedAt?: number;
  revokedBy?: string;
  revokedReason?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  version: number;
};

export type BusinessCardEvent = {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  eventId: string;
  tenantId: string;
  profileId: string;
  cardId?: string;
  eventType: BusinessCardEventType;
  sourceType: SourceType;
  occurredAt: number;
  anonymousMetadata: {
    userAgent?: string;
    referrer?: string;
    region?: string;
  };
};

export type BusinessCardAuditLog = {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  auditId: string;
  tenantId: string;
  actorUserId: string;
  actorRole: "admin" | "employee";
  targetProfileId: string;
  action: string;
  changedFields?: string[];
  occurredAt: number;
  requestId?: string;
  ttl: number;
};

export type TenantBizCardConfig = {
  pk: string;
  sk: "CONFIG";
  tenantId: string;
  enabled: boolean;
  defaultVisibility: Record<string, boolean>;
  lockedFields: string[];
  defaultTheme: CardTheme;
  requireSetup: boolean;
  companyWebsite?: string;
  updatedAt: number;
  updatedBy: string;
  version: number;
};

export type PublicBusinessCard = {
  publicProfileId: string;
  slug: string;
  displayName: string;
  credentials?: string;
  title?: string;
  department?: string;
  companyName: string;
  biography?: string;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
  website?: string;
  officeAddress?: OfficeAddress;
  socialLinks: SocialLink[];
  photoUrl?: string;
  coverUrl?: string;
  backgroundColor?: string;
  accentColor?: string;
  photoFocusX?: number;
  photoFocusY?: number;
  cardTheme: CardTheme;
  permanentUrl: string;
};
