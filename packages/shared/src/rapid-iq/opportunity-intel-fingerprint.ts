import { createHash } from "node:crypto";
import { intelFingerprintKey } from "./opportunity-intel-schemas.js";

export function intelFingerprint(input: {
  agency: string;
  solicitationNumber?: string | null;
  title: string;
  dueDate?: string | null;
}): string {
  return createHash("sha256").update(intelFingerprintKey(input)).digest("hex").slice(0, 32);
}
