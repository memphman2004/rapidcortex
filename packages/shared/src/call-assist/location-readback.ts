const STREET_ADDRESS = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}/;

/** True when the slot is a place the caller just gave, not a description or a name. */
export function isLocationSlot(slotId: string | null | undefined): boolean {
  return /location|address|cross/i.test(slotId ?? "");
}

/** One spoken check of a street address. Empty when the text is not an address. */
export function locationReadback(text: string | null | undefined): string | null {
  const address = (text ?? "").trim().replace(/\s+/g, " ");
  if (address.length < 5 || address.length > 180) return null;
  if (!STREET_ADDRESS.test(address)) return null;
  return `I have the location as ${address}. Is that right?`;
}
