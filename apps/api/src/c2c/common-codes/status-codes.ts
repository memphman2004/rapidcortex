/**
 * APCO-style unit status codes (ANS 1.116.1-2015 pattern).
 */

export const APCO_UNIT_STATUS_CODES = [
  "AVAILABLE",
  "DISPATCHED",
  "EN_ROUTE",
  "ON_SCENE",
  "TRANSPORT",
  "AT_HOSPITAL",
  "CLEARED",
  "OUT_OF_SERVICE",
  "MEAL_BREAK",
  "TRAINING",
  "STAGING",
  "RETURNING",
  "ASSIGNED",
  "BUSY",
] as const;

export type APCOUnitStatusCode = (typeof APCO_UNIT_STATUS_CODES)[number] | (string & {});

export function isStandardUnitStatus(code: string): code is (typeof APCO_UNIT_STATUS_CODES)[number] {
  return (APCO_UNIT_STATUS_CODES as readonly string[]).includes(code);
}

export function isValidUnitStatus(code: string): boolean {
  return isStandardUnitStatus(code) || code.startsWith("X-");
}
