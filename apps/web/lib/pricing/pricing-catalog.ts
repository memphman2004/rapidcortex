export type PlanTierCol = {
  id: "t1" | "t2" | "t3" | "t4";
  label: string;
  seats: string;
  volume: string;
};

export const PSAP_PLANS = [
  {
    id: "ess",
    label: "Essential",
    seatCap: 10,
    dispatcherOvrFrom: 11,
    adminOvrFrom: 4,
    includedAdminSeats: 3,
    tiers: [
      { id: "t1", label: "T1 Micro", seats: "1–3 dispatchers", volume: "<2,000 calls/mo" },
      { id: "t2", label: "T2 Small", seats: "4–6 dispatchers", volume: "2K–3.5K calls/mo" },
      { id: "t3", label: "T3 Medium", seats: "7–8 dispatchers", volume: "3.5K–4.5K calls/mo" },
      { id: "t4", label: "T4 Large", seats: "9–10 dispatchers", volume: "4.5K–5K calls/mo" },
    ] as const satisfies readonly PlanTierCol[],
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
    adminOvrFrom: 9,
    includedAdminSeats: 8,
    tiers: [
      { id: "t1", label: "T1 Small", seats: "1–10 dispatchers", volume: "<10,000 calls/mo" },
      { id: "t2", label: "T2 Medium", seats: "11–18 dispatchers", volume: "10K–18K calls/mo" },
      { id: "t3", label: "T3 Large", seats: "19–23 dispatchers", volume: "18K–23K calls/mo" },
      { id: "t4", label: "T4 Max", seats: "24–25 dispatchers", volume: "23K–25K calls/mo" },
    ] as const satisfies readonly PlanTierCol[],
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
    adminOvrFrom: 21,
    includedAdminSeats: 20,
    tiers: [
      { id: "t1", label: "T1 Small", seats: "1–25 dispatchers", volume: "<30,000 calls/mo" },
      { id: "t2", label: "T2 Medium", seats: "26–50 dispatchers", volume: "30K–60K calls/mo" },
      { id: "t3", label: "T3 Large", seats: "51–65 dispatchers", volume: "60K–85K calls/mo" },
      { id: "t4", label: "T4 Max", seats: "66–75 dispatchers", volume: "85K–100K calls/mo" },
    ] as const satisfies readonly PlanTierCol[],
    rows: [
      { id: "monthly", label: "Monthly fee", suffix: "/mo" },
      { id: "pilot", label: "Pilot", suffix: "" },
      { id: "setup", label: "Setup", suffix: "" },
    ],
  },
] as const;

export const CAD_COMPLEXITY_TIERS = [
  { id: "t1", label: "Tier 1 — Simple" },
  { id: "t2", label: "Tier 2 — Standard" },
  { id: "t3", label: "Tier 3 — Complex" },
  { id: "t4", label: "Tier 4 — Advanced" },
] as const;

export const VERTICALS = [
  {
    id: "campus",
    label: "Campus",
    annualTiers: [] as const,
    implSizes: [
      { id: "sm", label: "Under 10,000 students" },
      { id: "md", label: "10,001 – 25,000" },
      { id: "lg", label: "25,001 – 50,000" },
      { id: "xl", label: "50,001+" },
    ],
  },
  {
    id: "venue",
    label: "Venue",
    annualTiers: [
      { id: "t1", label: "T1 Small — Under 5,000" },
      { id: "t2", label: "T2 Mid — 5,000–20,000" },
      { id: "t3", label: "T3 Large — 20,000–50,000" },
      { id: "t4", label: "T4 Stadium — 50,000+" },
    ],
    implSizes: [
      { id: "t1", label: "T1 Small — Under 5,000" },
      { id: "t2", label: "T2 Mid — 5,000–20,000" },
      { id: "t3", label: "T3 Large — 20,000–50,000" },
      { id: "t4", label: "T4 Stadium — 50,000+" },
    ],
  },
  {
    id: "hosp",
    label: "Hospital",
    annualTiers: [
      { id: "t1", label: "T1 Small — Under 100 beds" },
      { id: "t2", label: "T2 Mid — 100–300 beds" },
      { id: "t3", label: "T3 Large — 300–600 beds" },
      { id: "t4", label: "T4 System — 600+ / multi" },
    ],
    implSizes: [
      { id: "t1", label: "T1 Small — Under 100 beds" },
      { id: "t2", label: "T2 Mid — 100–300 beds" },
      { id: "t3", label: "T3 Large — 300–600 beds" },
      { id: "t4", label: "T4 System — 600+ / multi" },
    ],
  },
  {
    id: "transit",
    label: "Transit",
    annualTiers: [
      { id: "t1", label: "T1 Small — Under 50 vehicles" },
      { id: "t2", label: "T2 Mid — 50–200 vehicles" },
      { id: "t3", label: "T3 Large — 200–500 vehicles" },
      { id: "t4", label: "T4 Metro — 500+" },
    ],
    implSizes: [
      { id: "t1", label: "T1 Small — Under 50 vehicles" },
      { id: "t2", label: "T2 Mid — 50–200 vehicles" },
      { id: "t3", label: "T3 Large — 200–500 vehicles" },
      { id: "t4", label: "T4 Metro — 500+" },
    ],
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
      { key: "cad.disco.mapping", label: "Field mapping document (list)" },
      { key: "cad.disco.audit", label: "Integration audit (list)" },
      { key: "cad.disco.failover", label: "Rollback / failover planning (list)" },
    ],
  },
  {
    id: "coord",
    label: "Vendor Coordination",
    rows: [
      { key: "cad.coord.basic", label: "Basic coordination" },
      { key: "cad.coord.std", label: "Standard coordination" },
      { key: "cad.coord.prem", label: "Premium coordination" },
      { key: "cad.coord.sandbox", label: "Sandbox testing package" },
    ],
  },
  {
    id: "ro",
    label: "Read-Only",
    rows: CAD_COMPLEXITY_TIERS.map((t, i) => ({
      key: `cad.ro.t${i + 1}`,
      label: t.label,
    })),
  },
  {
    id: "awb",
    label: "Assisted Write-Back",
    rows: CAD_COMPLEXITY_TIERS.map((t, i) => ({
      key: `cad.awb.t${i + 1}`,
      label: t.label,
    })),
  },
  {
    id: "connector",
    label: "Multi-CAD Connector",
    rows: [{ key: "cad.connector", label: "Multi-CAD Connector / mesh (base monthly)" }],
  },
  {
    id: "auto",
    label: "Automated Write-Back",
    rows: CAD_COMPLEXITY_TIERS.map((t, i) => ({
      key: `cad.auto.t${i + 1}`,
      label: t.label,
    })),
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
      { label: "Summaries — Basic (<5K calls/mo)", key: "ai.summ.basic" },
      { label: "Summaries — Standard (5K–20K)", key: "ai.summ.std" },
      { label: "Summaries — Premium (20K+)", key: "ai.summ.prem" },
    ],
  },
  {
    id: "trans",
    label: "Transcription & Translation",
    rows: [
      { label: "Accuracy T1 / T2 / T3", keys: ["trans.acc.t1", "trans.acc.t2", "trans.acc.t3"] },
      { label: "Diarization T1 / T2 / T3", keys: ["trans.diar.t1", "trans.diar.t2", "trans.diar.t3"] },
      { label: "Translation T1–T4", keys: ["xlat.t1", "xlat.t2", "xlat.t3", "xlat.t4"] },
      { label: "Translate (field / LE)", key: "rc.translate" },
      { label: "Translate — Venue", key: "rc.translate.venue" },
      { label: "Translate — Campus", key: "rc.translate.campus" },
      { label: "Translate — Clinical", key: "rc.translate.hospital" },
    ],
  },
  {
    id: "media",
    label: "Caller Media & Vision",
    rows: [
      { label: "SMS link generation", loKey: "media.sms.lo", hiKey: "media.sms.hi" },
      { label: "Photo upload", loKey: "media.photo.lo", hiKey: "media.photo.hi" },
      { label: "Video upload", loKey: "media.video.lo", hiKey: "media.video.hi" },
      { label: "Live caller video", loKey: "media.stream.lo", hiKey: "media.stream.hi" },
      { label: "NexIQ Vision — Standard", loKey: "connect.std.lo", hiKey: "connect.std.hi" },
      { label: "NexIQ Vision — Professional", loKey: "connect.pro.lo", hiKey: "connect.pro.hi" },
      { label: "NexIQ Vision — Enterprise", loKey: "connect.ent.lo", hiKey: "connect.ent.hi" },
      { label: "Citizen / Ring share", loKey: "connect.ring.lo", hiKey: "connect.ring.hi" },
      { label: "Camera integration setup", loKey: "connect.setup.lo", hiKey: "connect.setup.hi" },
    ],
  },
  {
    id: "platform",
    label: "Platform & vertical add-ons",
    rows: [
      { label: "Priority support SM / MD / LG", keys: ["support.priority.sm", "support.priority.md", "support.priority.lg"] },
      { label: "Agency Share", key: "agency.share" },
      { label: "iQ Reporting (Essential add-on)", loKey: "iq.reporting.lo", hiKey: "iq.reporting.hi" },
      { label: "Command Intelligence", loKey: "comms.intel.lo", hiKey: "comms.intel.hi" },
      { label: "NexiQ Vault", loKey: "nexiq.vault.lo", hiKey: "nexiq.vault.hi" },
      { label: "Response Continuity System (RCS)", key: "rcs.module" },
      { label: "Call Assist module", loKey: "call_assist.module", hiKey: "call_assist.module.hi" },
      { label: "Call Assist CAD push", key: "call_assist.cad_integration" },
      { label: "Call Assist RMS drafts", key: "call_assist.rms_integration" },
      { label: "Call Assist TTY", key: "call_assist.tty_accommodation" },
      { label: "Call Assist external routing", key: "call_assist.external_routing" },
      { label: "Map unit overlays (AVL)", loKey: "cad.avl.lo", hiKey: "cad.avl.hi" },
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
