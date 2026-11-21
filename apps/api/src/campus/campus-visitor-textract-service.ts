/**
 * AWS Textract OCR service for visitor ID extraction.
 *
 * Used as the FALLBACK when client-side PDF417 barcode decode fails
 * (worn IDs, Safari, kiosk mode, NFC-only devices).
 *
 * Privacy contract:
 *   - The image is sent directly to Textract bytes API (no S3 upload).
 *   - The raw image is NEVER stored in S3 or DynamoDB.
 *   - Only extracted text fields are returned to the caller.
 *   - The ID number is hashed server-side before leaving this function.
 *
 * Cost: ~$0.0015 per page (AnalyzeDocument with QUERIES feature).
 * Rate limit: 5 TPS default; request increase for high-volume deployments.
 */

import { createHash } from "node:crypto";
import {
  TextractClient,
  AnalyzeDocumentCommand,
  type AnalyzeDocumentCommandOutput,
} from "@aws-sdk/client-textract";
import type { ExtractedIdFields } from "rapid-cortex-shared";
import { parseAamvaDate } from "rapid-cortex-shared";

const textract = new TextractClient({});

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB Textract limit

/** Hash the raw ID number (never stored) */
function hashIdNumber(raw: string): string {
  return createHash("sha256").update(raw.trim().toUpperCase()).digest("hex");
}

/** Extract a query result answer by alias */
function findAnswer(
  blocks: { BlockType?: string; Text?: string; Relationships?: { Type: string; Ids: string[] }[]; Id?: string }[],
  pageAliasMap: Map<string, string>,
  alias: string,
): string | null {
  for (const block of blocks) {
    if (
      block.BlockType === "QUERY_RESULT" &&
      pageAliasMap.get(block.Id ?? "") === alias
    ) {
      return block.Text?.trim() ?? null;
    }
  }
  return null;
}

/** Normalize common OCR date formats to YYYY-MM-DD */
function normalizeOcrDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // MMDDYYYY (AAMVA-style)
  const aamva = parseAamvaDate(s);
  if (aamva) return aamva;
  // MM-DD-YYYY
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export interface TextractExtractionResult {
  success: boolean;
  fields?: ExtractedIdFields;
  errorReason?: "image_too_large" | "textract_error" | "no_text_found" | "low_confidence";
}

/**
 * Run AWS Textract QUERIES against a driver's license image.
 * Returns structured ID fields — the image is NOT stored.
 */
export async function extractIdFieldsViaTextract(
  imageBase64: string,
): Promise<TextractExtractionResult> {
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
    return { success: false, errorReason: "image_too_large" };
  }

  let result: AnalyzeDocumentCommandOutput;
  try {
    result = await textract.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: imageBytes },
        FeatureTypes: ["QUERIES"],
        QueriesConfig: {
          Queries: [
            { Text: "What is the first name on the ID?", Alias: "FIRST_NAME" },
            { Text: "What is the last name on the ID?", Alias: "LAST_NAME" },
            { Text: "What is the date of birth?", Alias: "DOB" },
            { Text: "What is the expiration date?", Alias: "EXPIRY" },
            { Text: "What is the driver license number?", Alias: "ID_NUMBER" },
            { Text: "What state issued this ID?", Alias: "STATE" },
            { Text: "What is the street address?", Alias: "STREET" },
          ],
        },
      }),
    );
  } catch (err) {
    console.error("[textract] AnalyzeDocument failed:", err);
    return { success: false, errorReason: "textract_error" };
  }

  const blocks = result.Blocks ?? [];
  if (blocks.length === 0) {
    return { success: false, errorReason: "no_text_found" };
  }

  // Build alias → answer map by following QUERY → QUERY_RESULT relationships
  const aliasMap = new Map<string, string>(); // queryBlockId → alias
  const resultIdToAlias = new Map<string, string>(); // resultBlockId → alias

  for (const block of blocks) {
    if (block.BlockType === "QUERY" && block.Text) {
      const queryText = block.Text;
      // Find alias from query text (we know what we sent)
      const aliasEntry: [string, string][] = [
        ["What is the first name on the ID?", "FIRST_NAME"],
        ["What is the last name on the ID?", "LAST_NAME"],
        ["What is the date of birth?", "DOB"],
        ["What is the expiration date?", "EXPIRY"],
        ["What is the driver license number?", "ID_NUMBER"],
        ["What state issued this ID?", "STATE"],
        ["What is the street address?", "STREET"],
      ];
      const found = aliasEntry.find(([q]) => q === queryText);
      if (found && block.Id) {
        aliasMap.set(block.Id, found[1]);
        // Map result IDs
        for (const rel of block.Relationships ?? []) {
          if (rel.Type === "ANSWER") {
            for (const id of rel.Ids) {
              resultIdToAlias.set(id, found[1]);
            }
          }
        }
      }
    }
  }

  // Build blocks with their aliases for findAnswer
  type BlockWithId = { BlockType?: string; Text?: string; Relationships?: { Type: string; Ids: string[] }[]; Id?: string };
  const blocksTyped = blocks as BlockWithId[];

  const firstName = findAnswer(blocksTyped, resultIdToAlias, "FIRST_NAME");
  const lastName = findAnswer(blocksTyped, resultIdToAlias, "LAST_NAME");

  if (!firstName && !lastName) {
    return { success: false, errorReason: "no_text_found" };
  }

  const dobRaw = findAnswer(blocksTyped, resultIdToAlias, "DOB");
  const expiryRaw = findAnswer(blocksTyped, resultIdToAlias, "EXPIRY");
  const idNumberRaw = findAnswer(blocksTyped, resultIdToAlias, "ID_NUMBER");
  const stateRaw = findAnswer(blocksTyped, resultIdToAlias, "STATE");
  const streetRaw = findAnswer(blocksTyped, resultIdToAlias, "STREET");

  const dob = normalizeOcrDate(dobRaw);
  const idExpiresAt = normalizeOcrDate(expiryRaw);
  const documentExpired = idExpiresAt ? new Date(idExpiresAt) < new Date() : undefined;

  // Calculate average confidence from QUERY_RESULT blocks
  const confidences: number[] = [];
  for (const block of blocksTyped) {
    if (block.BlockType === "QUERY_RESULT") {
      const conf = (block as { Confidence?: number }).Confidence;
      if (typeof conf === "number") confidences.push(conf / 100);
    }
  }
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.5;

  // Extract 2-letter state code from text like "CALIFORNIA" or "CA"
  const US_STATES: Record<string, string> = {
    ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
    COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA",
    HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
    KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
    MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
    MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN",
    TEXAS: "TX", UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA",
    "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
  };
  const stateUpper = stateRaw?.toUpperCase().trim() ?? "";
  const issuingState =
    stateUpper.length === 2
      ? stateUpper
      : US_STATES[stateUpper] ?? stateRaw?.slice(0, 2).toUpperCase() ?? undefined;

  const fields: ExtractedIdFields = {
    captureMethod: "textract_ocr",
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    dob: dob ?? undefined,
    idExpiresAt: idExpiresAt ?? undefined,
    issuingState: issuingState,
    idNumberHash: idNumberRaw ? hashIdNumber(idNumberRaw) : undefined,
    address: streetRaw
      ? {
          street: streetRaw,
          state: issuingState,
        }
      : undefined,
    documentExpired,
    ocrConfidence: avgConfidence,
  };

  return { success: true, fields };
}
