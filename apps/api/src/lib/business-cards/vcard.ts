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

export function buildVCard(card: PublicBusinessCard): string {
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
  for (const phone of card.phoneNumbers) {
    const type = phone.type.toUpperCase();
    lines.push(`TEL;TYPE=${type}:${phone.number}`);
  }
  for (const email of card.emailAddresses) {
    lines.push(`EMAIL;TYPE=${email.type.toUpperCase()}:${escapeVCard(email.address)}`);
  }
  if (card.website) lines.push(`URL:${escapeVCard(card.website)}`);
  for (const link of card.socialLinks) {
    lines.push(`URL:${escapeVCard(link.url)}`);
  }
  lines.push("END:VCARD");
  return `${lines.map(foldVCardLine).join("\r\n")}\r\n`;
}
