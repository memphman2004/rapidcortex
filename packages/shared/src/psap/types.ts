/**
 * PSAP Prospect CRM — national outbound prospect database.
 * Source: FCC/NENA PSAP registry (~5,597 US dispatch centers).
 * Separate from the inbound SalesLeadCrmRecord system.
 */

export const PSAP_OUTREACH_STATUSES = [
  "UNCONTACTED",
  "MAILED",
  "CALLED",
  "EMAILED",
  "ENGAGED",
  "DEMO_SCHEDULED",
  "PILOT",
  "CUSTOMER",
  "NOT_INTERESTED",
  "DO_NOT_CONTACT",
] as const;

export type PsapOutreachStatus = (typeof PSAP_OUTREACH_STATUSES)[number];

export const PSAP_OUTREACH_STATUS_CONFIG: Record<
  PsapOutreachStatus,
  { label: string; color: string; mapPinColor: string; bgClass: string; textClass: string }
> = {
  UNCONTACTED: {
    label: "Uncontacted",
    color: "#4b5563",
    mapPinColor: "#6b7280",
    bgClass: "bg-slate-800",
    textClass: "text-slate-400",
  },
  MAILED: {
    label: "Mailed",
    color: "#3b82f6",
    mapPinColor: "#60a5fa",
    bgClass: "bg-blue-900/40",
    textClass: "text-blue-300",
  },
  CALLED: {
    label: "Called",
    color: "#0ea5e9",
    mapPinColor: "#38bdf8",
    bgClass: "bg-sky-900/40",
    textClass: "text-sky-300",
  },
  EMAILED: {
    label: "Emailed",
    color: "#8b5cf6",
    mapPinColor: "#a78bfa",
    bgClass: "bg-violet-900/40",
    textClass: "text-violet-300",
  },
  ENGAGED: {
    label: "Engaged",
    color: "#f59e0b",
    mapPinColor: "#fbbf24",
    bgClass: "bg-amber-900/40",
    textClass: "text-amber-300",
  },
  DEMO_SCHEDULED: {
    label: "Demo Scheduled",
    color: "#f97316",
    mapPinColor: "#fb923c",
    bgClass: "bg-orange-900/40",
    textClass: "text-orange-300",
  },
  PILOT: {
    label: "Pilot",
    color: "#10b981",
    mapPinColor: "#34d399",
    bgClass: "bg-emerald-900/40",
    textClass: "text-emerald-300",
  },
  CUSTOMER: {
    label: "Customer",
    color: "#22c55e",
    mapPinColor: "#4ade80",
    bgClass: "bg-green-900/40",
    textClass: "text-green-300",
  },
  NOT_INTERESTED: {
    label: "Not Interested",
    color: "#ef4444",
    mapPinColor: "#f87171",
    bgClass: "bg-red-900/40",
    textClass: "text-red-300",
  },
  DO_NOT_CONTACT: {
    label: "Do Not Contact",
    color: "#1f2937",
    mapPinColor: "#374151",
    bgClass: "bg-slate-950",
    textClass: "text-slate-600",
  },
};

export interface PsapActivity {
  activityId: string;
  type: "call" | "email" | "mail" | "note" | "demo" | "stage_change";
  description: string;
  performedByUserId: string;
  performedByName: string;
  performedAt: string;
  metadata?: Record<string, string>;
}

export interface PsapMailingAddress {
  streetAddress?: string;
  city: string;
  county: string;
  state: string;
  zip?: string;
  verified: boolean;
  enrichedAt?: string;
  source?: "aws_location" | "nominatim" | "manual" | "import";
  /** Full Esri/AWS Location label when enriched via Location Service. */
  formattedAddress?: string;
  confidence?: "high" | "medium" | "low";
}

export interface PsapProspect {
  psapId: string;
  psapName: string;
  county: string;
  state: string;
  city: string;
  phone: string;
  fips: string;
  latitude: number;
  longitude: number;
  mailingAddress?: PsapMailingAddress;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  outreachStatus: PsapOutreachStatus;
  assignedToUserId?: string;
  assignedToName?: string;
  lastContactedAt?: string;
  lastContactedBy?: string;
  nextActionDate?: string;
  nextActionNote?: string;
  estimatedValue?: number;
  notes?: string;
  activities: PsapActivity[];
  createdAt: string;
  updatedAt: string;
  importedFrom: string;
}

export interface PatchPsapProspectBody {
  outreachStatus?: PsapOutreachStatus;
  assignedToUserId?: string;
  assignedToName?: string;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  mailingAddress?: Partial<PsapMailingAddress>;
  notes?: string;
  nextActionDate?: string;
  nextActionNote?: string;
  estimatedValue?: number;
}

export interface AddPsapActivityRequest {
  type: PsapActivity["type"];
  description: string;
  metadata?: Record<string, string>;
}

export interface PsapProspectListQuery {
  state?: string;
  outreachStatus?: PsapOutreachStatus;
  assignedToUserId?: string;
  search?: string;
  hasAddress?: boolean;
  hasContact?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "psapName" | "state" | "outreachStatus" | "lastContactedAt" | "updatedAt";
  sortDir?: "asc" | "desc";
  /** Export-only: verified mailing addresses only. */
  verifiedOnly?: boolean;
}

export interface PsapProspectListResponse {
  items: PsapProspect[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PsapProspectStats {
  total: number;
  byStatus: Record<PsapOutreachStatus, number>;
  withAddress: number;
  withContact: number;
  totalEstimatedValue: number;
}

export interface PsapMapPin {
  psapId: string;
  lat: number;
  lon: number;
  status: PsapOutreachStatus;
  psapName: string;
  state: string;
}
