export type CardTheme = "navy" | "gold" | "slate" | "midnight";

export type SocialDraft = {
  id: string;
  type: "linkedin" | "calendar" | "custom";
  label: string;
  url: string;
  public: boolean;
};

export type CardForm = {
  profileId?: string;
  publicProfileId?: string;
  version?: number;
  status?: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  credentials: string;
  title: string;
  department: string;
  companyName: string;
  biography: string;
  website: string;
  primaryEmail: string;
  primaryEmailPublic: boolean;
  secondaryEmail: string;
  secondaryEmailPublic: boolean;
  mobile: string;
  mobilePublic: boolean;
  office: string;
  officeExtension: string;
  officePublic: boolean;
  sms: string;
  smsPublic: boolean;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressPublic: boolean;
  orderedLinks: SocialDraft[];
  linkedin: string;
  linkedinPublic: boolean;
  calendar: string;
  calendarPublic: boolean;
  custom1Label: string;
  custom1Url: string;
  custom1Public: boolean;
  custom2Label: string;
  custom2Url: string;
  custom2Public: boolean;
  extras: Array<{ label: string; url: string; public: boolean }>;
  cardTheme: CardTheme;
  backgroundColor: string;
  accentColor: string;
  photoFocusX: number;
  photoFocusY: number;
  lockedFields: string[];
  internalNotes: string;
  totalViews?: number;
  totalVcfDownloads?: number;
};

export type ApiProfile = {
  profileId: string;
  publicProfileId: string;
  version: number;
  status: string;
  slug: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  credentials?: string;
  title?: string;
  department?: string;
  companyName: string;
  biography?: string;
  website?: string;
  emailAddresses?: Array<{ type: "primary" | "secondary"; address: string; public: boolean }>;
  phoneNumbers?: Array<{ type: "mobile" | "office" | "sms" | "fax"; number: string; extension?: string; public: boolean }>;
  officeAddress?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string; public: boolean };
  socialLinks?: Array<{ type: "linkedin" | "website" | "calendar" | "custom"; label?: string; url: string; public: boolean }>;
  cardTheme?: CardTheme;
  backgroundColor?: string;
  accentColor?: string;
  photoFocusX?: number;
  photoFocusY?: number;
  photoUrl?: string;
  coverUrl?: string;
  lockedFields?: string[];
  internalNotes?: string;
  totalViews?: number;
  totalVcfDownloads?: number;
  cognitoUserId?: string;
};

export const EMPTY_FORM: CardForm = {
  slug: "",
  firstName: "",
  lastName: "",
  displayName: "",
  credentials: "",
  title: "",
  department: "",
  companyName: "",
  biography: "",
  website: "",
  primaryEmail: "",
  primaryEmailPublic: true,
  secondaryEmail: "",
  secondaryEmailPublic: false,
  mobile: "",
  mobilePublic: true,
  office: "",
  officeExtension: "",
  officePublic: true,
  sms: "",
  smsPublic: false,
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  addressPublic: true,
  orderedLinks: [],
  linkedin: "",
  linkedinPublic: true,
  calendar: "",
  calendarPublic: true,
  custom1Label: "",
  custom1Url: "",
  custom1Public: true,
  custom2Label: "",
  custom2Url: "",
  custom2Public: true,
  extras: [],
  cardTheme: "navy",
  backgroundColor: "",
  accentColor: "",
  photoFocusX: 50,
  photoFocusY: 50,
  lockedFields: ["companyName"],
  internalNotes: "",
};

export function formFromProfile(profile: ApiProfile): CardForm {
  const phone = (type: "mobile" | "office" | "sms") => profile.phoneNumbers?.find((item) => item.type === type);
  const link = (type: "linkedin" | "calendar") => profile.socialLinks?.find((item) => item.type === type);
  const customs = profile.socialLinks?.filter((item) => item.type === "custom") ?? [];
  const primary = profile.emailAddresses?.find((item) => item.type === "primary");
  const secondary = profile.emailAddresses?.find((item) => item.type === "secondary");
  return {
    ...EMPTY_FORM,
    profileId: profile.profileId,
    publicProfileId: profile.publicProfileId,
    version: profile.version,
    status: profile.status,
    slug: profile.slug,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    displayName: profile.displayName,
    credentials: profile.credentials ?? "",
    title: profile.title ?? "",
    department: profile.department ?? "",
    companyName: profile.companyName,
    biography: profile.biography ?? "",
    website: profile.website ?? "",
    primaryEmail: primary?.address ?? "",
    primaryEmailPublic: primary?.public ?? true,
    secondaryEmail: secondary?.address ?? "",
    secondaryEmailPublic: secondary?.public ?? false,
    mobile: phone("mobile")?.number ?? "",
    mobilePublic: phone("mobile")?.public ?? true,
    office: phone("office")?.number ?? "",
    officeExtension: phone("office")?.extension ?? "",
    officePublic: phone("office")?.public ?? true,
    sms: phone("sms")?.number ?? "",
    smsPublic: phone("sms")?.public ?? false,
    street: profile.officeAddress?.street ?? "",
    city: profile.officeAddress?.city ?? "",
    state: profile.officeAddress?.state ?? "",
    postalCode: profile.officeAddress?.postalCode ?? "",
    country: profile.officeAddress?.country ?? "",
    addressPublic: profile.officeAddress?.public ?? true,
    orderedLinks: (profile.socialLinks ?? []).map((item, index) => ({
      id: `${item.type}-${index}`,
      type: item.type === "linkedin" || item.type === "calendar" ? item.type : "custom",
      label: item.label || (item.type === "linkedin" ? "LinkedIn" : item.type === "calendar" ? "Calendar" : "Link"),
      url: item.url,
      public: item.public,
    })),
    linkedin: link("linkedin")?.url ?? "",
    linkedinPublic: link("linkedin")?.public ?? true,
    calendar: link("calendar")?.url ?? "",
    calendarPublic: link("calendar")?.public ?? true,
    custom1Label: customs[0]?.label ?? "",
    custom1Url: customs[0]?.url ?? "",
    custom1Public: customs[0]?.public ?? true,
    custom2Label: customs[1]?.label ?? "",
    custom2Url: customs[1]?.url ?? "",
    custom2Public: customs[1]?.public ?? true,
    extras: customs.map((item) => ({ label: item.label ?? "Link", url: item.url, public: item.public })),
    cardTheme: profile.cardTheme ?? "navy",
    backgroundColor: profile.backgroundColor ?? "",
    accentColor: profile.accentColor ?? "",
    photoFocusX: profile.photoFocusX ?? 50,
    photoFocusY: profile.photoFocusY ?? 50,
    lockedFields: profile.lockedFields ?? EMPTY_FORM.lockedFields,
    internalNotes: profile.internalNotes ?? "",
    totalViews: profile.totalViews,
    totalVcfDownloads: profile.totalVcfDownloads,
  };
}

export function payloadFromForm(form: CardForm, asAdmin: boolean): Record<string, unknown> {
  const locked = new Set(form.lockedFields);
  const phones = [
    form.mobile ? { type: "mobile", number: form.mobile, public: form.mobilePublic } : null,
    form.office ? { type: "office", number: form.office, extension: form.officeExtension || undefined, public: form.officePublic } : null,
    form.sms ? { type: "sms", number: form.sms, public: form.smsPublic } : null,
  ].filter(Boolean);
  const link = (type: "linkedin" | "calendar" | "custom", url: string, isPublic: boolean, label?: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname) return null;
    } catch {
      return null;
    }
    return { type, url, public: isPublic, ...(label ? { label } : {}) };
  };
  const drafts = form.orderedLinks.length
    ? form.orderedLinks
    : [
        ...(form.linkedin ? [{ type: "linkedin" as const, url: form.linkedin, public: form.linkedinPublic, label: "LinkedIn" }] : []),
        ...(form.calendar ? [{ type: "calendar" as const, url: form.calendar, public: form.calendarPublic, label: "Calendar" }] : []),
        ...form.extras.map((item) => ({ type: "custom" as const, url: item.url, public: item.public, label: item.label || "Link" })),
      ];
  const links = drafts
    .map((item) => link(item.type, item.url, item.public, item.type === "custom" ? item.label || "Link" : undefined))
    .filter(Boolean);
  const body: Record<string, unknown> = { version: form.version };
  const assign = (field: string, value: unknown) => {
    if (!asAdmin && locked.has(field)) return;
    body[field] = value;
  };
  assign("displayName", form.displayName);
  assign("credentials", form.credentials);
  assign("title", form.title);
  assign("department", form.department);
  assign("biography", form.biography);
  assign("slug", form.slug || undefined);
  assign("firstName", form.firstName);
  assign("lastName", form.lastName);
  assign("cardTheme", form.cardTheme);
  if (asAdmin || !locked.has("cardTheme")) {
    body.backgroundColor = form.backgroundColor;
    body.accentColor = form.accentColor;
    body.photoFocusX = form.photoFocusX;
    body.photoFocusY = form.photoFocusY;
  }
  assign("phoneNumbers", phones);
  assign("socialLinks", links);
  body.website = normalizeWebsite(form.website);
  body.emailAddresses = [
    { type: "primary", address: form.primaryEmail.trim(), public: form.primaryEmailPublic },
    ...(form.secondaryEmail.trim() ? [{ type: "secondary", address: form.secondaryEmail.trim(), public: form.secondaryEmailPublic }] : []),
  ].filter((email) => email.address);
  assign("officeAddress", {
    street: form.street || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    postalCode: form.postalCode || undefined,
    country: form.country || undefined,
    public: form.addressPublic,
  });
  if (asAdmin) {
    body.visibilitySettings = {
      title: true,
      biography: true,
      website: true,
      photo: true,
      officeAddress: form.addressPublic,
      "phone:mobile": form.mobilePublic,
      "phone:office": form.officePublic,
      "phone:sms": form.smsPublic,
      "email:primary": form.primaryEmailPublic,
      "email:secondary": form.secondaryEmailPublic,
      "link:linkedin": form.orderedLinks.find((item) => item.type === "linkedin")?.public ?? form.linkedinPublic,
      "link:calendar": form.orderedLinks.find((item) => item.type === "calendar")?.public ?? form.calendarPublic,
      "link:custom": form.orderedLinks.some((item) => item.type === "custom" && item.public) || form.custom1Public || form.custom2Public,
    };
    body.internalNotes = form.internalNotes;
    body.lockedFields = form.lockedFields;
  }
  return body;
}

const E164 = /^\+[1-9]\d{1,14}$/;

/** Matches `BIOGRAPHY_MAX_LENGTH` in the business-card API. */
export const BIOGRAPHY_MAX_LENGTH = 1200;

/** `www.nexcortiq.com` becomes `https://www.nexcortiq.com`. */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/** Blocks a save when a filled field would be rejected by the card API. */
export function cardFormIssues(form: CardForm): string[] {
  const issues: string[] = [];
  if (!form.displayName.trim()) issues.push("Full name is required.");
  if (form.biography.length > BIOGRAPHY_MAX_LENGTH) {
    issues.push(`Bio must be ${BIOGRAPHY_MAX_LENGTH} characters or fewer.`);
  }
  if (form.primaryEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.primaryEmail.trim())) {
    issues.push("Email must be a valid address.");
  }
  const website = normalizeWebsite(form.website);
  if (website) {
    try {
      const parsed = new URL(website);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") issues.push("Website must start with http:// or https://.");
    } catch {
      issues.push("Website must be a full address, such as https://www.nexcortiq.com.");
    }
  }
  for (const [label, value] of [["Background", form.backgroundColor], ["Accent", form.accentColor]] as const) {
    if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) issues.push(`${label} must be a hex color such as #1e1b4b.`);
  }
  const phones: Array<[string, string]> = [
    ["Phone number", form.mobile],
    ["Office phone", form.office],
    ["Message number", form.sms],
  ];
  for (const [label, value] of phones) {
    if (value.trim() && !E164.test(value.trim())) issues.push(`${label} must use E.164, such as +14045550100.`);
  }
  for (const item of form.orderedLinks) {
    const url = item.url.trim();
    if (!url || url === "https://") continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname) issues.push(`${item.label} must be an https link.`);
    } catch {
      issues.push(`${item.label} needs a valid https link.`);
    }
  }
  return issues;
}
