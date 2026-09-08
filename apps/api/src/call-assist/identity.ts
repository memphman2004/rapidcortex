import { createHash } from "node:crypto";

export function digitsOnly(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function hashAni(ani: string | undefined): string | undefined {
  const digits = digitsOnly(ani);
  if (digits.length < 7) return undefined;
  return createHash("sha256").update(digits).digest("hex");
}

export function aniLast4(ani: string | undefined): string | undefined {
  const digits = digitsOnly(ani);
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}

export function locationKey(text: string | undefined): string | undefined {
  const norm = (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (norm.length < 5) return undefined;
  return norm.slice(0, 120);
}
