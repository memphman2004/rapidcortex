import type { BusinessCardProfile, PublicBusinessCard } from "./types.js";

const INTERNAL_PUBLIC_KEYS = [
  "cognitoUserId",
  "profileId",
  "tenantId",
  "lockedFields",
  "version",
  "createdBy",
  "updatedBy",
  "pk",
  "sk",
  "gsi1pk",
  "gsi1sk",
  "gsi2pk",
  "gsi2sk",
  "gsi3pk",
  "gsi3sk",
  "internalNotes",
  "photoKey",
  "coverKey",
  "companyLogoKey",
] as const;

export function isFieldPublic(settings: Record<string, boolean>, key: string): boolean {
  return settings[key] !== false;
}

export function toPublicProfile(
  profile: BusinessCardProfile,
  photoUrl: string | undefined,
  permanentUrl: string,
  coverUrl?: string,
): PublicBusinessCard {
  const settings = profile.visibilitySettings ?? {};
  const card: PublicBusinessCard = {
    publicProfileId: profile.publicProfileId,
    slug: profile.slug,
    displayName: profile.displayName,
    companyName: profile.companyName,
    cardTheme: profile.cardTheme,
    permanentUrl,
    phoneNumbers: profile.phoneNumbers.filter(
      (phone) => phone.public && phone.number && isFieldPublic(settings, `phone:${phone.type}`),
    ),
    emailAddresses: profile.emailAddresses.filter(
      (email) => email.public && email.address && isFieldPublic(settings, `email:${email.type}`),
    ),
    socialLinks: profile.socialLinks.filter(
      (link) => link.public && link.url && isFieldPublic(settings, `link:${link.type}`),
    ),
  };
  if (profile.credentials && isFieldPublic(settings, "credentials")) card.credentials = profile.credentials;
  if (profile.title && isFieldPublic(settings, "title")) card.title = profile.title;
  if (profile.department && isFieldPublic(settings, "department")) card.department = profile.department;
  if (profile.biography && isFieldPublic(settings, "biography")) card.biography = profile.biography;
  if (profile.website && isFieldPublic(settings, "website")) card.website = profile.website;
  if (profile.officeAddress?.public && isFieldPublic(settings, "officeAddress")) {
    card.officeAddress = profile.officeAddress;
  }
  if (photoUrl && isFieldPublic(settings, "photo")) card.photoUrl = photoUrl;
  if (coverUrl) card.coverUrl = coverUrl;
  if (profile.backgroundColor) card.backgroundColor = profile.backgroundColor;
  if (profile.accentColor) card.accentColor = profile.accentColor;
  if (profile.photoFocusX !== undefined) card.photoFocusX = profile.photoFocusX;
  if (profile.photoFocusY !== undefined) card.photoFocusY = profile.photoFocusY;
  return card;
}

export function publicResponseHasInternalFields(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return INTERNAL_PUBLIC_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}
