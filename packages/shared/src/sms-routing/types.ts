export type SmsRoutingVertical = "campus" | "venue" | "911" | "hospital" | "transit";

export interface SmsRoutingRecord {
  /** E.164 — partition key, e.g. +17065551234 */
  phoneNumber: string;
  agencyId: string;
  vertical: SmsRoutingVertical;
  agencyName: string;
  label: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export type SmsRoutingRecordPublic = Omit<SmsRoutingRecord, "createdBy">;
