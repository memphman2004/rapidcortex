/**
 * Client-side AAMVA PDF417 barcode parser for US driver's licenses.
 *
 * The PDF417 barcode on the back of every AAMVA-compliant US/Canadian
 * driver's license encodes structured data following the AAMVA DL/ID
 * Card Design Standard (versions 1–9+).
 *
 * No server call, no PII upload. All parsing is done in the browser.
 * The parsed fields pre-fill the check-in form; the actual ID number
 * is never stored or displayed — only hashed server-side.
 */

import type { ExtractedIdFields } from "rapid-cortex-shared";
import { parseAamvaBarcode } from "rapid-cortex-shared";

export type { ExtractedIdFields };

/**
 * Parse a raw string from a PDF417 barcode detector.
 * Returns structured fields or null if the string is not a valid AAMVA barcode.
 */
export function parseAamvaString(raw: string): ExtractedIdFields | null {
  return parseAamvaBarcode(raw);
}

/**
 * Extract the raw ID number from an AAMVA barcode for server-side hashing.
 * Returns null if not found.
 * NOTE: Never store, log, or display this value — send to server for hashing only.
 */
export function extractRawIdNumber(barcodeString: string): string | null {
  const fieldRegex = /([A-Z]{3})([^\n\r]+)/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(barcodeString)) !== null) {
    const [, id, value] = match;
    if (id === "DAQ") return value.trim();
  }
  return null;
}

/**
 * Check if a string looks like an AAMVA-format barcode
 * (quick pre-filter before full parse).
 */
export function looksLikeAamva(raw: string): boolean {
  if (!raw || raw.length < 50) return false;
  return raw.startsWith("@") || raw.includes("ANSI ") || raw.includes("AAMVA");
}
