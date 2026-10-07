import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { intelFingerprintKey } from "./opportunity-intel-schemas.js";

export function intelFingerprint(input: {
  agency: string;
  solicitationNumber?: string | null;
  title: string;
  dueDate?: string | null;
}): string {
  return bytesToHex(sha256(utf8ToBytes(intelFingerprintKey(input)))).slice(0, 32);
}
