export const PSAP_TIERS = [
  { id: "t1", label: "T1 Micro", seats: "1–3 dispatchers", volume: "≤500 calls/mo" },
  { id: "t2", label: "T2 Small", seats: "4–8 dispatchers", volume: "≤1,500 calls/mo" },
  { id: "t3", label: "T3 Medium", seats: "9–15 dispatchers", volume: "≤3,500 calls/mo" },
  { id: "t4", label: "T4 Large", seats: "16–25 dispatchers", volume: "≤7,500 calls/mo" },
] as const;

export const PSAP_PLANS = [
  {
    id: "ess",
    label: "Essential",
    seatCap: 10,
    dispatcherOvrFrom: 11,
    adminOvrFrom: 6,
    rows: [
      { id: "monthly", label: "Monthly fee", suffix: "/mo" },
      { id: "pilot", label: "Pilot", suffix: "" },
      { id: "setup", label: "Setup", suffix: "" },
    ],
  },
  {
    id: "pro",
    label: "Professional",
    seatCap: 25,
    dispatcherOvrFrom: 26,
    adminOvrFrom: 11,
    rows: [
      { id: "monthly", label: "Monthly fee", suffix: "/mo" },
      { id: "pilot", label: "Pilot", suffix: "" },
      { id: "setup", label: "Setup", suffix: "" },
    ],
  },
  {
    id: "cmd",
    label: "Command",
    seatCap: 75,
    dispatcherOvrFrom: 76,
    adminOvrFrom: 26,
    rows: [
      { id: "monthly", label: "Monthly fee", suffix: "/mo" },
      { id: "pilot", label: "Pilot", suffix: "" },
      { id: "setup", label: "Setup", suffix: "" },
    ],
  },
] as const;

export const VERTICALS = [
  {
    id: "campus",
    label: "Campus",
    annualTiers: [] as const,
    implSizes: [
      { id: "sm", label: "Small" },
      { id: "md", label: "Medium" },
      { id: "lg", label: "Large" },
      { id: "xl", label: "XL" },
    ],
  },
  {
    id: "venue",
    label: "Venue",
    annualTiers: PSAP_TIERS.map((t) => ({ id: t.id, label: t.label })),
    implSizes: PSAP_TIERS.map((t) => ({ id: t.id, label: t.label })),
  },
  {
    id: "hosp",
    label: "Hospital",
    annualTiers: PSAP_TIERS.map((t) => ({ id: t.id, label: t.label })),
    implSizes: PSAP_TIERS.map((t) => ({ id: t.id, label: t.label })),
  },
  {
    id: "transit",
    label: "Transit",
    annualTiers: PSAP_TIERS.map((t) => ({ id: t.id, label: t.label })),
    implSizes: PSAP_TIERS.map((t) => ({ id: t.id, label: t.label })),
  },
] as const;

export const CAD_SECTIONS = [
  {
    id: "disco",
    label: "Discovery",
    rows: [
      { key: "cad.disco.basic", label: "Basic discovery" },
      { key: "cad.disco.std", label: "Standard discovery" },
      { key: "cad.disco.adv", label: "Advanced discovery" },
      { key: "cad.disco.mapping", label: "Mapping workshop" },
      { key: "cad.disco.audit", label: "Integration audit" },
      { key: "cad.disco.failover", label: "Failover planning" },
    ],
  },
  {
    id: "coord",
    label: "Vendor Coordination",
    rows: [
      { key: "cad.coord.basic", label: "Basic coordination" },
      { key: "cad.coord.std", label: "Standard coordination" },
      { key: "cad.coord.prem", label: "Premium coordination" },
      { key: "cad.coord.sandbox", label: "Sandbox setup" },
    ],
  },
  {
    id: "ro",
    label: "Read-Only",
    rows: PSAP_TIERS.map((t, i) => ({
      key: `cad.ro.t${i + 1}`,
      label: t.label,
    })),
  },
  {
    id: "awb",
    label: "Assisted Write-Back",
    rows: PSAP_TIERS.map((t, i) => ({
      key: `cad.awb.t${i + 1}`,
      label: t.label,
    })),
  },
  {
    id: "auto",
    label: "Automated Write-Back",
    rows: [
      { key: "cad.auto.t1", label: "T1 Micro" },
      { key: "cad.auto.t2", label: "T2 Small" },
      { key: "cad.auto.t3", label: "T3 Medium" },
    ],
  },
] as const;

export const ADDON_SECTIONS = [
  {
    id: "ai",
    label: "AI & Call Intelligence",
    rows: [
      { label: "Triage — Basic", key: "ai.triage.basic" },
      { label: "Triage — Standard", key: "ai.triage.std" },
      { label: "Triage — Premium", key: "ai.triage.prem" },
      { label: "Confidence — Basic", key: "ai.conf.basic" },
      { label: "Confidence — Advanced", key: "ai.conf.adv" },
      { label: "Confidence — Premium", key: "ai.conf.prem" },
      { label: "Summaries — Basic", key: "ai.summ.basic" },
      { label: "Summaries — Standard", key: "ai.summ.std" },
      { label: "Summaries — Premium", key: "ai.summ.prem" },
    ],
  },
  {
    id: "trans",
    label: "Transcription & Translation",
    rows: [
      { label: "Accuracy T1 / T2 / T3", loKey: "trans.acc.t1", hiKey: "trans.acc.t3", midKey: "trans.acc.t2" },
      { label: "Diarization T1 / T2 / T3", loKey: "trans.diar.t1", hiKey: "trans.diar.t3", midKey: "trans.diar.t2" },
      { label: "Translation T1–T4", keys: ["xlat.t1", "xlat.t2", "xlat.t3", "xlat.t4"] },
    ],
  },
  {
    id: "media",
    label: "Camera & Media",
    rows: [
      { label: "Photo capture", loKey: "media.photo.lo", hiKey: "media.photo.hi" },
      { label: "Video capture", loKey: "media.video.lo", hiKey: "media.video.hi" },
      { label: "Live stream", loKey: "media.stream.lo", hiKey: "media.stream.hi" },
      { label: "SMS media", loKey: "media.sms.lo", hiKey: "media.sms.hi" },
      { label: "Connect Standard", loKey: "connect.std.lo", hiKey: "connect.std.hi" },
      { label: "Connect Pro", loKey: "connect.pro.lo", hiKey: "connect.pro.hi" },
      { label: "Connect Enterprise", loKey: "connect.ent.lo", hiKey: "connect.ent.hi" },
      { label: "Ring Connect", loKey: "connect.ring.lo", hiKey: "connect.ring.hi" },
      { label: "Connect setup", loKey: "connect.setup.lo", hiKey: "connect.setup.hi" },
      { label: "Priority support SM/MD/LG", keys: ["support.priority.sm", "support.priority.md", "support.priority.lg"] },
      { label: "Mission support SM/MD/LG", keys: ["support.mission.sm", "support.mission.md", "support.mission.lg"] },
      { label: "Agency share", key: "agency.share" },
    ],
  },
  {
    id: "rcs",
    label: "Response Continuity",
    rows: [
      { label: "Response Continuity System (RCS) Module", key: "rcs.module" },
    ],
  },
] as const;

export type TabProps = {
  editMode: boolean;
  globalOverrides: import("@/lib/pricing/pricing-types").PricingOverrides;
  tenantOverrides?: import("@/lib/pricing/pricing-types").PricingOverrides;
  staged: import("@/lib/pricing/pricing-types").PricingOverrides;
  onStage: (key: string, value: number) => void;
  onRevert: (key: string) => void;
  getFieldProps: (key: string, opts?: { decimals?: number; suffix?: string }) => {
    stagedValue?: number;
    effectiveValue: number;
    defaultValue: number;
    isGlobalOverride: boolean;
    isTenantOverride: boolean;
    decimals?: number;
    suffix?: string;
  };
};
