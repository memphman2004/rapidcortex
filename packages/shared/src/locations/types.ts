export type QRLocationVertical = "campus" | "venue" | "core";

export interface QRLocation {
  rcli: string;
  agencyId: string;
  orgCode: string;
  vertical: QRLocationVertical;
  locationName: string;
  building?: string;
  floor?: string;
  zone?: string;
  zoneCode: string;
  lat?: number;
  lng?: number;
  active: boolean;
  scanCount: number;
  lastScannedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QRLocationPublic {
  rcli: string;
  agencyId: string;
  vertical: QRLocationVertical;
  locationName: string;
  building?: string;
  floor?: string;
  zoneCode: string;
  active: boolean;
  /** Venue/campus guest media policy — defaults true when unset. */
  photoUploadsEnabled?: boolean;
  /** Venue/campus guest media policy — defaults true for campus, false for venue when unset. */
  videoUploadsEnabled?: boolean;
}
