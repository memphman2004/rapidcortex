import type { CampusIncidentTypeConfig, ReportVertical } from "rapid-cortex-shared";
import { getIncidentTypes } from "rapid-cortex-shared";

export type SafetyVerticalConfig = {
  productLabel: string;
  contextLabel: string;
  headline: string;
  supporting: string;
  callButtonFallback: string;
  submitLabel: string;
  locationFieldLabel: string;
  defaultLocationPlaceholder: string;
  categories: string[];
  /** When set, ReportForm uses grouped K-12 picker + follow-ups instead of flat chips. */
  k12Types?: CampusIncidentTypeConfig[];
};

/** Higher-ed campus public form (i18n keys `cat.campus.0`… assume length 6). */
export const campusConfig: SafetyVerticalConfig = {
  productLabel: "NexCort iQ Campus",
  contextLabel: "Campus Safety Reporting",
  headline: "Report a Safety Concern",
  supporting:
    "Send a report directly to campus safety. You can call, submit details, share location, or report discreetly.",
  callButtonFallback: "Call Campus Security",
  submitLabel: "Submit Report",
  locationFieldLabel: "Your location / zone",
  defaultLocationPlaceholder: "Building · Floor · Area",
  categories: [
    "Medical concern",
    "Suspicious activity",
    "Harassment/threat",
    "Mental health concern",
    "Facility hazard",
    "Other",
  ],
};

/** K-12 school public form — grouped concern catalog (not a flat chip dump). */
export const campusK12Config: SafetyVerticalConfig = {
  ...campusConfig,
  contextLabel: "School Safety Reporting",
  callButtonFallback: "Call School Safety",
  categories: [],
  k12Types: getIncidentTypes("k12"),
};

export const venueConfig: SafetyVerticalConfig = {
  productLabel: "NexCort iQ Venue",
  contextLabel: "Venue Safety Reporting",
  headline: "Report a Venue Safety Concern",
  supporting:
    "Send a report directly to venue security. You can call, submit details, share location, or report discreetly.",
  callButtonFallback: "Call Venue Security",
  submitLabel: "Submit Report",
  locationFieldLabel: "Your location / zone",
  defaultLocationPlaceholder: "Section · Row · Seat / Gate · Concourse",
  categories: [
    "Medical issue",
    "Fight/disturbance",
    "Harassment",
    "Suspicious activity",
    "Lost person/child",
    "Facility hazard",
    "Other",
  ],
};

const nineOneOneConfig: SafetyVerticalConfig = {
  productLabel: "NexCort iQ",
  contextLabel: "Public Safety Reporting",
  headline: "Submit a Report",
  supporting:
    "Send a report directly to the communications center. You can call, submit details, or report discreetly.",
  callButtonFallback: "Call Dispatch",
  submitLabel: "Submit Report",
  locationFieldLabel: "Your location / zone",
  defaultLocationPlaceholder: "Address or landmark",
  categories: ["Medical", "Fire", "Police", "Welfare check", "Other"],
};

const hospitalConfig: SafetyVerticalConfig = {
  productLabel: "NexCort iQ Hospital",
  contextLabel: "Hospital Safety Reporting",
  headline: "Report a Patient Concern",
  supporting: "Send a message directly to hospital staff for coordination and response.",
  callButtonFallback: "Call Hospital Staff",
  submitLabel: "Submit",
  locationFieldLabel: "Your location / unit",
  defaultLocationPlaceholder: "Unit · Floor · Room",
  categories: ["Patient concern", "Facility hazard", "Security", "Other"],
};

const transitConfig: SafetyVerticalConfig = {
  productLabel: "NexCort iQ Transit",
  contextLabel: "Transit Safety Reporting",
  headline: "Report a Transit Issue",
  supporting: "Send a report directly to transit security for response coordination.",
  callButtonFallback: "Call Transit Security",
  submitLabel: "Submit Report",
  locationFieldLabel: "Your location / stop",
  defaultLocationPlaceholder: "Station · Platform · Vehicle",
  categories: ["Safety concern", "Suspicious activity", "Facility hazard", "Other"],
};

export function safetyConfigForVertical(
  vertical: ReportVertical | string,
  opts?: { institutionType?: "higher_ed" | "k12" },
): SafetyVerticalConfig {
  switch (vertical) {
    case "campus":
      return opts?.institutionType === "k12" ? campusK12Config : campusConfig;
    case "venue":
      return venueConfig;
    case "hospital":
      return hospitalConfig;
    case "transit":
      return transitConfig;
    case "911":
    default:
      return nineOneOneConfig;
  }
}
