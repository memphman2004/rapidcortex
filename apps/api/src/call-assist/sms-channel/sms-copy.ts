/** Citizen-facing SMS copy for 311 issue types. Internal slot names never appear here. */

export const SMS_HELP_MESSAGE =
  "Non-emergency SMS\n" +
  "Text what you need help with. Examples:\n" +
  "• Pothole, sidewalk, flooding, debris\n" +
  "• Streetlight or traffic signal out\n" +
  "• Missing or damaged signs\n" +
  "• Missed trash, dumping, overflowing cans\n" +
  "• Water leak, hydrant, sewer, no water\n" +
  "• Noise, abandoned car, parking\n" +
  "• Graffiti, trees, parks\n" +
  "• Stray animals, housing, fire hydrant blocked\n" +
  "• Bus stop, bike lane, city info\n" +
  "We'll ask a few follow-ups, then send a confirmation number.\n" +
  "STOP to unsubscribe | Emergencies: call 911";

const DEFAULT_CLOSE = (n: string) =>
  `Your non-emergency report is in. Confirmation ${n}. Keep this number if you need an update. Reply HELP for options. For emergencies call 911.`;

const BY_INTENT: Record<string, (confirmation: string) => string> = {
  ReportRoadsInfrastructure: (n) =>
    `We logged your road report. Confirmation ${n}. Public Works will review it. Keep this number if you call back.`,
  ReportStreetLighting: (n) =>
    `We logged your lighting or signal report. Confirmation ${n}. Electrical crews typically follow up within 1–3 days.`,
  ReportTrafficSignsMarkings: (n) =>
    `We logged your sign or road-marking report. Confirmation ${n}. Keep this number if you need an update.`,
  ReportSanitationWaste: (n) =>
    `We logged your sanitation request. Confirmation ${n}. Sanitation will follow up on pickup or cleanup.`,
  ReportWaterSewerDrainage: (n) =>
    `We logged your water or sewer report. Confirmation ${n}. If water is still gushing or sewage is in the street, stay clear and call the non-emergency line too.`,
  ReportNoiseComplaint: (n) =>
    `We logged your noise complaint. Confirmation ${n}. If it's still going on, an officer or inspector may check when they're available — this is not 911.`,
  ReportVehicleIssue: (n) =>
    `We logged your vehicle report. Confirmation ${n}. Parking enforcement reviews these in order; we can't promise a tow time by text.`,
  ReportGraffitiVandalism: (n) =>
    `We logged your graffiti or vandalism report. Confirmation ${n}. Public property is usually cleaned in a few business days.`,
  ReportAnimalsPests: (n) =>
    `We logged your animal report. Confirmation ${n}. If an animal is attacking someone right now, hang up this text and call 911.`,
  ReportTreesVegetation: (n) =>
    `We logged your tree report. Confirmation ${n}. Urban Forestry will review it. If a tree is on live wires, stay back and call 911.`,
  ReportParksPublicSpaces: (n) =>
    `We logged your parks report. Confirmation ${n}. Parks and Recreation will follow up.`,
  ReportBuildingsHousing: (n) =>
    `We logged your building or housing report. Confirmation ${n}. Code enforcement reviews these in order.`,
  ReportHomelessSocialServices: (n) =>
    `We logged your request. Confirmation ${n}. Outreach or social services may follow up. If someone is in immediate danger, call 911.`,
  ReportEnvironmentalHealth: (n) =>
    `We logged your environmental or health report. Confirmation ${n}. If this is a large chemical spill or someone is hurt, call 911.`,
  ReportLawEnforcementNonEmergency: (n) =>
    `We logged your non-emergency police request. Confirmation ${n}. If a crime is happening right now, call 911 instead of texting.`,
  ReportFireEMSNonEmergency: (n) =>
    `We logged your fire-safety report. Confirmation ${n}. If you see smoke, fire, or someone needing medical help, call 911 now.`,
  ReportTransitIssue: (n) =>
    `We logged your transit report. Confirmation ${n}. The right team will review the stop, lane, or meter issue.`,
  RequestGovernmentInformation: (n) =>
    `We noted your city-info request. Confirmation ${n}. Text can't open permits or records. Call the non-emergency line or check the city website for hours, permits, and programs.`,
  ReportSpecialEventIssue: (n) =>
    `We logged your special-event question. Confirmation ${n}. For permits or street closures, you may also need to call the non-emergency line.`,
  CheckServiceRequestStatus: (n) =>
    `We logged your status request. Confirmation ${n}. Have your original confirmation number ready if a team member calls you back.`,
};

export function smsClosingForIntent(intentName: string, confirmationNumber: string): string {
  const fn = BY_INTENT[intentName] ?? DEFAULT_CLOSE;
  return fn(confirmationNumber);
}
