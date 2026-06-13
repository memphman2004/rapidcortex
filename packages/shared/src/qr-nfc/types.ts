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
  url: string;
  qrImageBase64?: string;
  scanCount: number;
  nfcTapCount: number;
  totalEngagements: number;
  lastEngagementAt?: string;
  /** E.164 tap-to-call number shown on public intake (from SMS routing or admin override). */
  callNumber?: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
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
