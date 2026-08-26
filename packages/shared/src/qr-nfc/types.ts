export type ReportMedium = "qr" | "nfc" | "sms" | "direct" | "url";

export type ReportVertical = "911" | "campus" | "venue" | "hospital" | "transit";

export type QrNfcReportType = "anonymous" | "identified" | "both";

export interface QRNFCRecord {
  qrId: string;
  agencyId: string;
  agencyName?: string;
  name: string;
  description?: string;
  zoneId?: string;
  zoneName?: string;
  vertical: ReportVertical;
  reportType: QrNfcReportType;
  nfcEnabled: boolean;
  nfcTagId?: string;
  active: boolean;
  /**
   * `marketing_site` = Rapid Cortex homepage/demo booth codes (not a location report).
   * Omitted on location report codes.
   */
  kind?: "location" | "marketing_site";
  url: string;
  qrImageBase64?: string;
  scanCount: number;
  nfcTapCount: number;
  totalEngagements: number;
  lastEngagementAt?: string;
  /** E.164 tap-to-call number shown on public intake (from SMS routing or admin override). */
  callNumber?: string;
  /**
   * Mobile / field NFC programming history (written URLs on physical tags).
   * Optional for backward compatibility with records created before this field existed.
   */
  nfcWriteLog?: QRNFCWriteEvent[];
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

/** One successful NFC tag program event logged from the mobile app. */
export interface QRNFCWriteEvent {
  eventId: string;
  writtenBy: string;
  writtenByName?: string | null;
  devicePlatform: "ios" | "android";
  writeMethod: "native_nfc";
  bytesWritten: number;
  tagType?: string | null;
  writtenAt: string;
}

export interface CreateQRNFCInput {
  agencyId?: string;
  name: string;
  description?: string;
  zoneId?: string;
  zoneName?: string;
  vertical: ReportVertical;
  reportType: QrNfcReportType;
  nfcEnabled?: boolean;
  nfcTagId?: string;
  expiresAt?: string;
  callNumber?: string;
}

export interface UpdateQRNFCInput {
  name?: string;
  description?: string;
  zoneId?: string;
  zoneName?: string;
  nfcEnabled?: boolean;
  nfcTagId?: string;
  active?: boolean;
  callNumber?: string;
}

/** Public-safe fields for `/report/{qrId}` intake. */
export interface QRNFCPublicRecord {
  qrId: string;
  agencyId: string;
  agencyName: string;
  zoneName?: string;
  vertical: ReportVertical;
  reportType: QrNfcReportType;
  active: boolean;
  medium?: ReportMedium;
  callNumber?: string;
  callNumberDisplay?: string;
}

export interface PublicReportSubmitInput {
  qrId: string;
  message: string;
  locationNote?: string;
  reporterName?: string;
  reporterPhone?: string;
  medium: ReportMedium;
  mediaKeys?: string[];
}
