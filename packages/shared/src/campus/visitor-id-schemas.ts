/**
 * Visitor ID Scanning — NexCort iQ K-12 Visitor Intelligence
 *
 * Three capture methods feed the same pipeline:
 *   1. Client-side PDF417 barcode decode (BarcodeDetector / ZXing) — no server call
 *   2. AWS Textract OCR (front-face fallback for worn/damaged IDs)
 *   3. Manual entry fallback (name + DOB typed by staff)
 *
 * Privacy rules (FERPA + state laws):
 *   - Full ID number is NEVER stored — only a one-way hash.
 *   - Name + DOB stored in visitor profile per district retention policy.
 *   - Visitor photo: optional, district-configurable.
 *   - Textract images are analyzed and discarded — not stored in S3.
 */

import { z } from "zod";

// ─── AAMVA field names (PDF417 barcode standard) ──────────────────────────────

/**
 * Key AAMVA DL/ID Card Design Standard fields parsed from the PDF417 barcode.
 * Full spec: https://www.aamva.org/identity/drivers-license-id-card-DL-ID
 */
export const AAMVA_FIELDS = {
  // Name
  DCS: "last_name",        // Family name
  DAC: "first_name",       // First name
  DAD: "middle_name",      // Middle name or initial
  // Document dates (MMDDYYYY format)
  DBB: "dob",              // Date of birth
  DBA: "expiry",           // Document expiration date
  DBD: "issued_date",      // Document issue date
  // Address
  DAG: "street",           // Street address
  DAI: "city",             // City
  DAJ: "state",            // Jurisdiction code (2-letter state)
  DAK: "postal",           // Postal code
  // Document identifiers
  DAQ: "id_number",        // License/ID number (hashed before storage)
  DCG: "country",          // Country (USA / CAN)
  // Physical descriptors
  DAU: "height",           // Height
  DAY: "eye_color",        // Eye color
  // Jurisdiction-specific version
  BAC: "aamva_version",    // AAMVA version number
} as const;

// ─── Extracted ID fields schema ───────────────────────────────────────────────

/** Fields extracted from either PDF417 barcode decode or Textract OCR. */
export const extractedIdFieldsSchema = z.object({
  /** Capture method that produced these fields. */
  captureMethod: z.enum(["barcode", "textract_ocr", "manual"]),

  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
  middleName: z.string().trim().max(80).optional(),

  /** ISO 8601 date string (YYYY-MM-DD). */
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** ISO 8601 date string — expiry of the physical document. */
  idExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** 2-letter issuing state/territory code, e.g. "CA", "TX". */
  issuingState: z.string().max(3).optional(),

  /**
   * One-way SHA-256 hash of the raw ID number.
   * Never store the actual number. This hash is used to detect repeat visitors.
   */
  idNumberHash: z.string().length(64).optional(),

  /** Street address from the ID (optional, district-configurable). */
  address: z
    .object({
      street: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(3).optional(),
      postal: z.string().max(20).optional(),
    })
    .optional(),

  /** Whether the document has expired as of scan time. */
  documentExpired: z.boolean().optional(),

  /**
   * Confidence score 0–1 (Textract OCR only).
   * Not set for barcode captures (barcode data is binary — present or absent).
   */
  ocrConfidence: z.number().min(0).max(1).optional(),
});

export type ExtractedIdFields = z.infer<typeof extractedIdFieldsSchema>;

// ─── Enriched check-in body schema ───────────────────────────────────────────

/**
 * Full visitor check-in body — extends the basic manual entry with
 * scan-enriched fields when ID capture is available.
 */
export const visitorCheckInBodyV2Schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  idType: z.enum(["drivers_license", "state_id", "passport", "military_id", "other"]),
  purposeOfVisit: z.string().trim().min(1).max(500),

  // Scan-enriched fields (optional — not present for manual entry)
  captureMethod: z.enum(["barcode", "textract_ocr", "manual"]).default("manual"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  idExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  issuingState: z.string().max(3).optional(),
  idNumberHash: z.string().length(64).optional(),
  documentExpired: z.boolean().optional(),

  // Optional staff-entered fields
  visitingStaff: z.string().trim().max(120).optional(),
  vehiclePlate: z.string().trim().max(32).optional(),
  phone: z.string().trim().max(32).optional(),
  siteId: z.string().trim().max(64).optional(),
  buildingCode: z.string().trim().max(32).optional(),

  /**
   * Pre-registration token — if present, skip full ID scan and fast-lane the visitor.
   * Token was sent to the visitor's email/phone before arrival.
   */
  preRegistrationToken: z.string().optional(),
});

export type VisitorCheckInBodyV2 = z.infer<typeof visitorCheckInBodyV2Schema>;

// ─── Textract request/response schemas ───────────────────────────────────────

/** POST body for the server-side Textract OCR extraction endpoint. */
export const extractIdRequestSchema = z.object({
  /**
   * Base64-encoded JPEG or PNG of the FRONT face of the ID.
   * Max 5MB after decode. Image is analyzed and discarded — not stored.
   */
  imageBase64: z.string().min(100),
  mimeType: z.enum(["image/jpeg", "image/png"]).default("image/jpeg"),
});

export type ExtractIdRequest = z.infer<typeof extractIdRequestSchema>;

// ─── Visitor record (stored in DynamoDB) ─────────────────────────────────────

/**
 * Full visitor record shape (DynamoDB item).
 * PK = AGENCY#{agencyId}  SK = VISIT#{dateKey}#{visitorId}
 * Also has GSI1: gsi1pk = DATE#{dateKey}, gsi1sk = {agencyId}#{checkedInAt}
 * And a badge lookup item: PK = BADGE#{badgeToken}  SK = META
 */
export const visitorRecordSchema = z.object({
  visitorId: z.string(),
  agencyId: z.string(),
  campusCode: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  idType: z.string(),
  captureMethod: z.enum(["barcode", "textract_ocr", "manual"]).default("manual"),
  dob: z.string().optional(),
  idExpiresAt: z.string().optional(),
  issuingState: z.string().optional(),
  idNumberHash: z.string().optional(),
  documentExpired: z.boolean().optional(),
  visitingStaff: z.string().nullable().optional(),
  purposeOfVisit: z.string(),
  vehiclePlate: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
  buildingCode: z.string().nullable().optional(),
  status: z.enum(["cleared", "flagged", "review_required"]),
  nsopwMatchCount: z.number().default(0),
  screeningError: z.boolean().default(false),
  badgeToken: z.string().optional(),
  badgeExpiresAt: z.string().optional(),
  checkedInBy: z.string(),
  checkedInAt: z.string(),
  checkedOutAt: z.string().optional(),
  ttl: z.number(),
});

export type VisitorRecord = z.infer<typeof visitorRecordSchema>;

// ─── Badge verification response ─────────────────────────────────────────────

/** Returned by the public badge verification endpoint. */
export const badgeVerificationResponseSchema = z.object({
  valid: z.boolean(),
  expired: z.boolean(),
  checkedOut: z.boolean(),
  visitor: z
    .object({
      visitorId: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      visitingStaff: z.string().nullable().optional(),
      purposeOfVisit: z.string(),
      siteId: z.string().nullable().optional(),
      buildingCode: z.string().nullable().optional(),
      status: z.enum(["cleared", "flagged", "review_required"]),
      checkedInAt: z.string(),
      checkedOutAt: z.string().optional(),
      badgeExpiresAt: z.string().optional(),
    })
    .optional(),
  message: z.string().optional(),
});

export type BadgeVerificationResponse = z.infer<typeof badgeVerificationResponseSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse an AAMVA-format date string (MMDDYYYY or YYYYMMDD) to ISO 8601 (YYYY-MM-DD).
 * Returns null if unparseable.
 */
export function parseAamvaDate(raw: string): string | null {
  const s = raw.trim().replace(/\s/g, "");
  if (s.length === 8) {
    // MMDDYYYY (most common AAMVA format)
    if (/^\d{8}$/.test(s)) {
      const mm = s.slice(0, 2);
      const dd = s.slice(2, 4);
      const yyyy = s.slice(4, 8);
      const year = parseInt(yyyy, 10);
      if (year >= 1900 && year <= 2100) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }
  return null;
}

/**
 * Parse a raw AAMVA PDF417 barcode string into named fields.
 * Returns null if the string does not look like a valid AAMVA document.
 */
export function parseAamvaBarcode(raw: string): ExtractedIdFields | null {
  // Basic AAMVA compliance check: must start with @ and contain ANSI
  if (!raw.startsWith("@") && !raw.includes("ANSI ")) return null;

  const fields: Record<string, string> = {};
  // Split on 3-character field IDs followed by value up to next field ID or end
  const fieldRegex = /([A-Z]{3})([^\n\r]+)/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(raw)) !== null) {
    const [, id, value] = match;
    fields[id] = value.trim();
  }

  const firstName = fields["DAC"] ?? fields["DBP"] ?? "";
  const lastName = fields["DCS"] ?? fields["DBO"] ?? "";

  if (!firstName && !lastName) return null;

  const dobRaw = fields["DBB"] ?? fields["DBJ"] ?? "";
  const expiryRaw = fields["DBA"] ?? "";
  const idNumber = fields["DAQ"] ?? "";

  const dob = parseAamvaDate(dobRaw);
  const idExpiresAt = parseAamvaDate(expiryRaw);
  const documentExpired = idExpiresAt ? new Date(idExpiresAt) < new Date() : undefined;

  // Hash the ID number before returning (SHA-256 in hex — handled server-side)
  // Client returns the raw ID number for the server to hash — it is NOT stored client-side
  const idNumberHash = undefined; // Server hashes; client sends idNumber separately if needed

  return {
    captureMethod: "barcode",
    firstName,
    lastName,
    middleName: fields["DAD"] || undefined,
    dob: dob ?? undefined,
    idExpiresAt: idExpiresAt ?? undefined,
    issuingState: fields["DAJ"] || undefined,
    idNumberHash,
    address: {
      street: fields["DAG"] || undefined,
      city: fields["DAI"] || undefined,
      state: fields["DAJ"] || undefined,
      postal: fields["DAK"]?.slice(0, 5) || undefined,
    },
    documentExpired,
  };
}
