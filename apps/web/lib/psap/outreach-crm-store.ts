import {
  PSAP_OUTREACH_STATUSES,
  type AddPsapActivityRequest,
  type PatchPsapProspectBody,
  type PsapActivity,
  type PsapOutreachStatus,
  type PsapProspect,
} from "rapid-cortex-shared";

const STORAGE_KEY = "rc-outreach-prospect-crm-v1";

export type OutreachCrmOverlay = {
  outreachStatus?: PsapOutreachStatus;
  notes?: string;
  assignedToName?: string;
  assignedToUserId?: string;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  website?: string;
  lastContactedAt?: string;
  nextActionDate?: string;
  nextActionNote?: string;
  estimatedValue?: number;
  activities?: PsapActivity[];
  mailingStreet?: string;
  updatedAt?: string;
};

type StoreShape = Record<string, OutreachCrmOverlay>;

function readStore(): StoreShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoreShape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function getOutreachOverlay(id: string): OutreachCrmOverlay | undefined {
  return readStore()[id];
}

export function applyOutreachOverlay(base: PsapProspect, overlay?: OutreachCrmOverlay): PsapProspect {
  if (!overlay) return base;
  let mailingAddress = base.mailingAddress;
  if (overlay.mailingStreet !== undefined) {
    mailingAddress = {
      streetAddress: overlay.mailingStreet,
      city: base.mailingAddress?.city ?? base.city ?? "",
      county: base.mailingAddress?.county ?? base.county ?? "",
      state: base.mailingAddress?.state ?? base.state ?? "",
      zip: base.mailingAddress?.zip,
      verified: base.mailingAddress?.verified ?? false,
      source: base.mailingAddress?.source ?? "manual",
      enrichedAt: base.mailingAddress?.enrichedAt,
      formattedAddress: base.mailingAddress?.formattedAddress,
      confidence: base.mailingAddress?.confidence,
    };
  }
  return {
    ...base,
    outreachStatus: overlay.outreachStatus ?? base.outreachStatus,
    notes: overlay.notes ?? base.notes,
    assignedToName: overlay.assignedToName ?? base.assignedToName,
    assignedToUserId: overlay.assignedToUserId ?? base.assignedToUserId,
    primaryContactName: overlay.primaryContactName ?? base.primaryContactName,
    primaryContactTitle: overlay.primaryContactTitle ?? base.primaryContactTitle,
    primaryContactEmail: overlay.primaryContactEmail ?? base.primaryContactEmail,
    primaryContactPhone: overlay.primaryContactPhone ?? base.primaryContactPhone,
    website: overlay.website ?? base.website,
    lastContactedAt: overlay.lastContactedAt ?? base.lastContactedAt,
    nextActionDate: overlay.nextActionDate ?? base.nextActionDate,
    nextActionNote: overlay.nextActionNote ?? base.nextActionNote,
    estimatedValue: overlay.estimatedValue ?? base.estimatedValue,
    activities: overlay.activities ?? base.activities,
    mailingAddress,
    updatedAt: overlay.updatedAt ?? base.updatedAt,
  };
}

export function patchOutreachProspectLocal(
  current: PsapProspect,
  body: PatchPsapProspectBody,
): PsapProspect {
  const store = readStore();
  const prev = store[current.psapId] ?? {};
  const now = new Date().toISOString();
  const nextOverlay: OutreachCrmOverlay = {
    ...prev,
    updatedAt: now,
  };

  if (body.outreachStatus !== undefined) nextOverlay.outreachStatus = body.outreachStatus;
  if (body.notes !== undefined) nextOverlay.notes = body.notes;
  if (body.assignedToName !== undefined) nextOverlay.assignedToName = body.assignedToName;
  if (body.assignedToUserId !== undefined) nextOverlay.assignedToUserId = body.assignedToUserId;
  if (body.primaryContactName !== undefined) nextOverlay.primaryContactName = body.primaryContactName;
  if (body.primaryContactTitle !== undefined) nextOverlay.primaryContactTitle = body.primaryContactTitle;
  if (body.primaryContactEmail !== undefined) nextOverlay.primaryContactEmail = body.primaryContactEmail;
  if (body.primaryContactPhone !== undefined) nextOverlay.primaryContactPhone = body.primaryContactPhone;
  if (body.website !== undefined) nextOverlay.website = body.website;
  if (body.nextActionDate !== undefined) nextOverlay.nextActionDate = body.nextActionDate;
  if (body.nextActionNote !== undefined) nextOverlay.nextActionNote = body.nextActionNote;
  if (body.estimatedValue !== undefined) nextOverlay.estimatedValue = body.estimatedValue;
  if (body.mailingAddress?.streetAddress !== undefined) {
    nextOverlay.mailingStreet = body.mailingAddress.streetAddress;
  }

  let activities = [...(prev.activities ?? current.activities ?? [])];
  if (body.outreachStatus && body.outreachStatus !== current.outreachStatus) {
    activities = [
      {
        activityId: `act_${Date.now()}`,
        type: "stage_change",
        description: `Status changed from ${current.outreachStatus} to ${body.outreachStatus}`,
        performedByUserId: "local",
        performedByName: "You",
        performedAt: now,
        metadata: { from: current.outreachStatus, to: body.outreachStatus },
      },
      ...activities,
    ];
    nextOverlay.lastContactedAt = now;
  }
  nextOverlay.activities = activities;

  store[current.psapId] = nextOverlay;
  writeStore(store);
  return applyOutreachOverlay(current, nextOverlay);
}

export function addOutreachActivityLocal(
  current: PsapProspect,
  req: AddPsapActivityRequest,
): PsapProspect {
  const store = readStore();
  const prev = store[current.psapId] ?? {};
  const now = new Date().toISOString();
  const activity: PsapActivity = {
    activityId: `act_${Date.now()}`,
    type: req.type,
    description: req.description,
    performedByUserId: "local",
    performedByName: "You",
    performedAt: now,
    metadata: req.metadata,
  };
  const activities = [activity, ...(prev.activities ?? current.activities ?? [])];
  const nextOverlay: OutreachCrmOverlay = {
    ...prev,
    activities,
    lastContactedAt: now,
    updatedAt: now,
  };
  // Auto-bump status on first contact actions when still uncontacted.
  if (
    (!prev.outreachStatus || prev.outreachStatus === "UNCONTACTED") &&
    current.outreachStatus === "UNCONTACTED"
  ) {
    if (req.type === "call") nextOverlay.outreachStatus = "CALLED";
    else if (req.type === "email") nextOverlay.outreachStatus = "EMAILED";
    else if (req.type === "mail") nextOverlay.outreachStatus = "MAILED";
  }
  store[current.psapId] = nextOverlay;
  writeStore(store);
  return applyOutreachOverlay(current, nextOverlay);
}

export function isValidOutreachStatus(v: string): v is PsapOutreachStatus {
  return (PSAP_OUTREACH_STATUSES as readonly string[]).includes(v);
}
