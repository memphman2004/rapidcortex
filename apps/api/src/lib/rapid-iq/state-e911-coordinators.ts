/** Static registry of state E911 / 911 coordinator office pages. */

export type StateE911Coordinator = {
  stateCode: string;
  name: string;
  url: string;
  pathHints: string[];
};

export const STATE_E911_COORDINATORS: StateE911Coordinator[] = [
  // Southeast — primary RC market
  {
    stateCode: "GA",
    name: "Georgia Technology Authority — 911",
    url: "https://gta.georgia.gov/911",
    pathHints: ["/911", "/programs/911", "/resources"],
  },
  {
    stateCode: "AL",
    name: "Alabama 911 Board",
    url: "https://ema.alabama.gov/911",
    pathHints: ["/911", "/programs/communications"],
  },
  {
    stateCode: "FL",
    name: "Florida E911 — Department of Management Services",
    url: "https://www.dms.myflorida.com/business_operations/telecommunications/9_1_1",
    pathHints: ["/9_1_1", "/telecommunications/911", "/ng911"],
  },
  {
    stateCode: "SC",
    name: "SC 911 Advisory Committee",
    url: "https://www.911.sc.gov",
    pathHints: ["/advisory", "/reports", "/meetings"],
  },
  {
    stateCode: "TN",
    name: "Tennessee Emergency Communications Board",
    url: "https://www.tecb.tn.gov",
    pathHints: ["/meetings", "/agendas", "/reports", "/ng911"],
  },
  {
    stateCode: "NC",
    name: "NC 911 Board",
    url: "https://nc911.nc.gov",
    pathHints: ["/reports", "/meetings", "/ng911", "/grants"],
  },
  {
    stateCode: "VA",
    name: "Virginia 911 Services Board",
    url: "https://www.vita.virginia.gov/life-cycle/it-planning/public-safety-communications/911",
    pathHints: ["/911", "/meeting-minutes", "/reports"],
  },
  {
    stateCode: "MS",
    name: "Mississippi Enhanced 911",
    url: "https://www.mema.ms.gov/emergency-management/communications",
    pathHints: ["/communications", "/911", "/reports"],
  },

  // Northeast
  {
    stateCode: "NY",
    name: "NY DHSES — 911 Programs",
    url: "https://www.dhses.ny.gov/911-programs",
    pathHints: ["/911-programs", "/ng911", "/reports"],
  },
  {
    stateCode: "PA",
    name: "Pennsylvania 911 Program",
    url: "https://pema.pa.gov/911-program",
    pathHints: ["/911-program", "/ng911", "/meeting-minutes"],
  },
  {
    stateCode: "MA",
    name: "Massachusetts 911 Department",
    url: "https://www.mass.gov/orgs/911-department",
    pathHints: ["/911", "/ng911", "/reports", "/annual-reports"],
  },
  {
    stateCode: "NJ",
    name: "New Jersey 911 — State Police",
    url: "https://www.njsp.org/about/911.shtml",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "CT",
    name: "Connecticut 911 — DESPP",
    url: "https://portal.ct.gov/DESPP/Division-of-State-Police/9-1-1",
    pathHints: ["/9-1-1", "/ng911", "/reports"],
  },

  // Midwest
  {
    stateCode: "OH",
    name: "Ohio 911 — Public Safety",
    url: "https://publicsafety.ohio.gov/divisions/ohio-emergency-medical-services/911",
    pathHints: ["/911", "/ng911", "/reports", "/meeting-minutes"],
  },
  {
    stateCode: "MI",
    name: "Michigan 911 — State Police",
    url: "https://www.michigan.gov/msp/divisions/emhsd/911",
    pathHints: ["/911", "/ng911", "/annual-report"],
  },
  {
    stateCode: "IL",
    name: "Illinois Emergency Management — 911",
    url: "https://iema.illinois.gov/Programs/E911",
    pathHints: ["/E911", "/ng911", "/reports"],
  },
  {
    stateCode: "MN",
    name: "Minnesota Emergency Communications",
    url: "https://dps.mn.gov/divisions/ecpc",
    pathHints: ["/ecpc", "/reports", "/meetings", "/ng911"],
  },
  {
    stateCode: "IN",
    name: "Indiana 911 Advisory Board",
    url: "https://www.in.gov/idhs/emergency-preparedness/indiana-911-advisory-board",
    pathHints: ["/911", "/advisory-board", "/reports"],
  },
  {
    stateCode: "WI",
    name: "Wisconsin 911 — DMA",
    url: "https://dma.wi.gov/DMA/wem/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },

  // South
  {
    stateCode: "TX",
    name: "Texas Commission on State Emergency Communications",
    url: "https://www.csec.texas.gov",
    pathHints: ["/meetings", "/reports", "/ng911", "/agendas"],
  },
  {
    stateCode: "LA",
    name: "Louisiana 911 — GOHSEP",
    url: "https://gohsep.la.gov/MITIGATION/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "AR",
    name: "Arkansas 911",
    url: "https://www.911.arkansas.gov",
    pathHints: ["/meetings", "/reports", "/ng911"],
  },
  {
    stateCode: "KY",
    name: "Kentucky 911 Services Board",
    url: "https://911.ky.gov",
    pathHints: ["/meetings", "/reports", "/ng911", "/agendas"],
  },
  {
    stateCode: "MO",
    name: "Missouri 911",
    url: "https://dps.mo.gov/dir/programs/emd/911.php",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "OK",
    name: "Oklahoma 911 Management Authority",
    url: "https://www.ok.gov/911",
    pathHints: ["/reports", "/ng911", "/meetings"],
  },

  // West
  {
    stateCode: "CA",
    name: "California 911 — Cal OES",
    url: "https://www.caloes.ca.gov/cal-oes-divisions/communications",
    pathHints: ["/communications", "/911", "/ng911", "/reports"],
  },
  {
    stateCode: "WA",
    name: "Washington State 911",
    url: "https://911.wa.gov",
    pathHints: ["/reports", "/ng911", "/meetings", "/agendas"],
  },
  {
    stateCode: "CO",
    name: "Colorado 911",
    url: "https://oedit.colorado.gov/colorado-9-1-1",
    pathHints: ["/reports", "/ng911", "/grant-program"],
  },
  {
    stateCode: "AZ",
    name: "Arizona 911 Program",
    url: "https://az911.gov",
    pathHints: ["/reports", "/ng911", "/meetings"],
  },
  {
    stateCode: "OR",
    name: "Oregon 911 — Public Safety",
    url: "https://www.oregon.gov/OEM/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "UT",
    name: "Utah 911",
    url: "https://www.utah.gov/government/agencies/utah-communications-authority",
    pathHints: ["/reports", "/ng911", "/meetings"],
  },
  {
    stateCode: "NV",
    name: "Nevada 911",
    url: "https://detr.nv.gov/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "NM",
    name: "New Mexico 911",
    url: "https://www.dps.nm.gov/emergency-communications",
    pathHints: ["/emergency-communications", "/911", "/ng911"],
  },

  // Plains / Mountain
  {
    stateCode: "KS",
    name: "Kansas 911",
    url: "https://www.kansastag.gov/KCIT_E911.asp",
    pathHints: ["/E911", "/reports", "/ng911"],
  },
  {
    stateCode: "NE",
    name: "Nebraska 911",
    url: "https://nema.nebraska.gov/programs/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "SD",
    name: "South Dakota 911",
    url: "https://dlr.sd.gov/911",
    pathHints: ["/911", "/reports"],
  },
  {
    stateCode: "ND",
    name: "North Dakota 911",
    url: "https://www.nd.gov/des/emergency-management/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "MT",
    name: "Montana 911 — DES",
    url: "https://des.mt.gov/emergency-management/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "ID",
    name: "Idaho 911",
    url: "https://isp.idaho.gov/communications/911",
    pathHints: ["/911", "/ng911", "/reports"],
  },
  {
    stateCode: "WY",
    name: "Wyoming 911",
    url: "https://wyoming.gov/911",
    pathHints: ["/911", "/reports"],
  },
];

/** Rotate offices across runs so Lambda stays within timeout. */
export const E911_OFFICES_PER_RUN = 8;

export function selectE911OfficesForRun(
  offices: StateE911Coordinator[] = STATE_E911_COORDINATORS,
  now = new Date(),
): StateE911Coordinator[] {
  if (offices.length === 0) return [];
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) /
      86_400_000,
  );
  const start = (dayOfYear * E911_OFFICES_PER_RUN) % offices.length;
  const selected: StateE911Coordinator[] = [];
  for (let i = 0; i < Math.min(E911_OFFICES_PER_RUN, offices.length); i++) {
    selected.push(offices[(start + i) % offices.length]!);
  }
  return selected;
}
