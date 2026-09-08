import type { AlertTemplateType, AlertVertical } from "./schemas.js";

export type AlertTemplateSeed = {
  type: AlertTemplateType;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  body: string;
  smsBody: string;
};

function campusSeeds(): AlertTemplateSeed[] {
  return [
    {
      type: "ACTIVE_THREAT",
      title: "Active threat",
      severity: "CRITICAL",
      body: "ACTIVE THREAT at {{campusName}}. AVOID the area. If you are in immediate danger, hang up and dial 9-1-1. This is not a substitute for 911.",
      smsBody: "ACTIVE THREAT at {{campusName}}. AVOID area. Dial 911 if in danger.",
    },
    {
      type: "SHELTER_IN_PLACE",
      title: "Shelter in place",
      severity: "CRITICAL",
      body: "SHELTER IN PLACE at {{campusName}}. Stay inside, lock doors, and wait for an All Clear. If you are in immediate danger, dial 9-1-1.",
      smsBody: "SHELTER IN PLACE at {{campusName}}. Stay inside. Dial 911 if in danger.",
    },
    {
      type: "EVACUATION",
      title: "Evacuation",
      severity: "CRITICAL",
      body: "EVACUATION at {{campusName}}. Leave the building using marked exits. Do not use elevators. If you cannot evacuate safely, dial 9-1-1.",
      smsBody: "EVACUATE {{campusName}}. Use marked exits. Dial 911 if you cannot leave.",
    },
    {
      type: "LOCKDOWN",
      title: "Lockdown",
      severity: "CRITICAL",
      body: "LOCKDOWN at {{campusName}}. Lock doors, stay out of sight, silence devices. If you are in immediate danger, dial 9-1-1.",
      smsBody: "LOCKDOWN at {{campusName}}. Lock doors. Dial 911 if in danger.",
    },
    {
      type: "WEATHER_EMERGENCY",
      title: "Weather emergency",
      severity: "WARNING",
      body: "WEATHER EMERGENCY affecting {{campusName}}. Move to interior shelter as directed by campus officials. Dial 9-1-1 only for life-threatening emergencies.",
      smsBody: "WEATHER EMERGENCY at {{campusName}}. Seek interior shelter.",
    },
    {
      type: "HEALTH_ALERT",
      title: "Health alert",
      severity: "WARNING",
      body: "HEALTH ALERT for {{campusName}}. Follow campus health guidance. This is not 911 — dial 9-1-1 for a medical emergency.",
      smsBody: "HEALTH ALERT at {{campusName}}. Follow campus health guidance.",
    },
    {
      type: "INFRASTRUCTURE",
      title: "Infrastructure",
      severity: "WARNING",
      body: "INFRASTRUCTURE ALERT at {{campusName}}. Avoid the affected area until an All Clear is issued.",
      smsBody: "INFRASTRUCTURE ALERT at {{campusName}}. Avoid the affected area.",
    },
    {
      type: "ALL_CLEAR",
      title: "All clear",
      severity: "INFO",
      body: "ALL CLEAR for {{campusName}}. You may resume normal activity unless your supervisor directs otherwise.",
      smsBody: "ALL CLEAR at {{campusName}}. Resume normal activity.",
    },
    {
      type: "TIMELY_WARNING",
      title: "Timely Warning Notice",
      severity: "WARNING",
      body: "TIMELY WARNING: {{institutionName}} Campus Safety is issuing this notice per the Clery Act. {{warningBody}} Contact campus security at {{securityPhone}} with information. This notice will not identify victims. If you are in immediate danger, dial 9-1-1.",
      smsBody:
        "TIMELY WARNING: {{institutionName}} Campus Safety. {{warningBody}} Contact campus security at {{securityPhone}}. Dial 911 if in danger.",
    },
    {
      type: "CUSTOM",
      title: "Test / Drill",
      severity: "INFO",
      body: "TEST / DRILL at {{campusName}}. This is an exercise. Follow drill instructions from campus officials. If this were a real emergency and you were in danger, dial 9-1-1.",
      smsBody: "TEST/DRILL at {{campusName}}. This is an exercise. Follow official instructions.",
    },
  ];
}

function venueSeeds(): AlertTemplateSeed[] {
  return campusSeeds().map((s) => ({
    ...s,
    body: s.body.replaceAll("{{campusName}}", "{{venueName}}").replaceAll("campus", "venue"),
    smsBody: s.smsBody.replaceAll("{{campusName}}", "{{venueName}}"),
  }));
}

function transitSeeds(): AlertTemplateSeed[] {
  return campusSeeds().map((s) => ({
    ...s,
    body: s.body.replaceAll("{{campusName}}", "{{agencyName}}").replaceAll("campus", "transit"),
    smsBody: s.smsBody.replaceAll("{{campusName}}", "{{agencyName}}"),
  }));
}

export function systemTemplateSeeds(vertical: AlertVertical): AlertTemplateSeed[] {
  if (vertical === "venue") return venueSeeds();
  if (vertical === "transit") return transitSeeds();
  return campusSeeds();
}

export type AlertTemplateVars = {
  campusName?: string;
  venueName?: string;
  agencyName?: string;
  institutionName?: string;
  warningBody?: string;
  securityPhone?: string;
};

export function interpolateAlertTemplate(text: string, vars: AlertTemplateVars): string {
  return text
    .replaceAll("{{campusName}}", vars.campusName ?? vars.agencyName ?? "this campus")
    .replaceAll("{{venueName}}", vars.venueName ?? vars.agencyName ?? "this venue")
    .replaceAll("{{agencyName}}", vars.agencyName ?? "this agency")
    .replaceAll("{{institutionName}}", vars.institutionName ?? vars.campusName ?? vars.agencyName ?? "Campus")
    .replaceAll("{{warningBody}}", vars.warningBody ?? "")
    .replaceAll("{{securityPhone}}", vars.securityPhone ?? "campus security");
}

export function defaultGroupsForVertical(
  vertical: AlertVertical,
  agencyId: string,
): Array<{ slug: string; name: string }> {
  if (vertical === "venue") {
    return [
      { slug: "all-staff", name: "All staff (RC users)" },
      { slug: "all-occupants", name: "All occupants (imported)" },
    ];
  }
  if (vertical === "transit") {
    return [
      { slug: "all-operators", name: "All operators" },
      { slug: "all-riders", name: "All riders (imported)" },
    ];
  }
  return [
    { slug: "all", name: "All registered occupants" },
    { slug: "faculty-staff", name: "Faculty and staff" },
    { slug: "students", name: "Students" },
    { slug: `campus:${agencyId}`, name: "This campus" },
  ];
}
