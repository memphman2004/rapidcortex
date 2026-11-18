import type { DemoAgency } from "../types";
import { DEMO_AGENCY_ID } from "../types";

/** Single fictional PSAP used by every scenario. */
export const MAPLEWOOD_AGENCY: DemoAgency = {
  id: DEMO_AGENCY_ID,
  name: "Maplewood County Communications Center",
  location: "Maplewood County",
  jurisdiction: "Unincorporated Maplewood County, the City of Ridgemont, and the Town of Clearfield",
  populationServed: 94200,
  facilityType: "Combined primary PSAP",
  disciplines: ["Law enforcement", "Fire", "EMS"],
  annualEmergencyCalls: 86000,
  annualAdminCalls: 32000,
  cadDescription: "The county's existing computer-aided dispatch system",
};
