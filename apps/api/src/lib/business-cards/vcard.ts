import type { PublicBusinessCard } from "./types.js";

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Fold at 75 octets. Continuation lines begin with a single space. */
export function foldVCardLine(line: string): string {
  const chars = Array.from(line);
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of chars) {
    const size = Buffer.byteLength(ch);
    const max = parts.length === 0 ? 75 : 74;
    if (current && bytes + size > max) {
      parts.push(current);
      current = ch;
      bytes = size;
    } else {
      current += ch;
      bytes += size;
    }
  }
  if (current) parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

export function sanitizeVCardFileName(displayName: string): string {
  const cleaned = displayName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${cleaned || "contact"}.vcf`;
}

const MAX_VCARD_PHOTO_BYTES = 180_000;

export type VCardPhoto = { mime: "JPEG" | "PNG"; base64: string };

/** Embed a portrait only when it is a small JPEG or PNG. Anything else is omitted. */
export function vcardPhotoFromBytes(contentType: string, bytes: Uint8Array): VCardPhoto | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_VCARD_PHOTO_BYTES) return null;
  const declared = contentType.toLowerCase();
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (jpeg && !declared.includes("png")) return { mime: "JPEG", base64: Buffer.from(bytes).toString("base64") };
  if (png && !declared.includes("jpeg") && !declared.includes("jpg")) return { mime: "PNG", base64: Buffer.from(bytes).toString("base64") };
  return null;
}

export function buildVCard(card: PublicBusinessCard, photo?: VCardPhoto | null): string {
  const [first = "", ...rest] = card.displayName.split(" ");
  const last = rest.join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(card.displayName)}`,
    `N:${escapeVCard(last)};${escapeVCard(first)};;;`,
    `ORG:${escapeVCard(card.companyName)}`,
  ];
  if (card.title) lines.push(`TITLE:${escapeVCard(card.title)}`);
  if (card.department) lines.push(`ROLE:${escapeVCard(card.department)}`);
  if (card.officeAddress) {
    const address = card.officeAddress;
    const parts = [address.street, address.city, address.state, address.postalCode, address.country].filter(Boolean);
    if (parts.length) {
      const adr = ["", "", address.street ?? "", address.city ?? "", address.state ?? "", address.postalCode ?? "", address.country ?? ""]
        .map((part) => escapeVCard(part))
        .join(";");
      lines.push(`ADR;TYPE=WORK:${adr}`);
    }
  }
  for (const phone of card.phoneNumbers) {
    const type = phone.type.toUpperCase();
    lines.push(`TEL;TYPE=${type}:${phone.number}`);
  }
  for (const email of card.emailAddresses) {
    lines.push(`EMAIL;TYPE=${email.type.toUpperCase()}:${escapeVCard(email.address)}`);
  }
  if (photo?.base64) lines.push(`PHOTO;ENCODING=b;TYPE=${photo.mime}:${photo.base64}`);
  if (card.website) lines.push(`URL:${escapeVCard(card.website)}`);
  for (const link of card.socialLinks) {
    lines.push(`URL:${escapeVCard(link.url)}`);
  }
  lines.push("END:VCARD");
  return `${lines.map(foldVCardLine).join("\r\n")}\r\n`;
}
