import type { CallTriageClassification, RoutingDestinationType, TransferType } from "./classifications.js";
import type { AgencyTaxonomy } from "./taxonomy.js";
import { findCallType } from "./taxonomy.js";

export type ExternalAgencyRoute = {
  agencyId: string;
  externalAgencyId: string;
  externalAgencyName: string;
  phoneNumber: string;
  description: string;
  transferType: TransferType;
  afterHoursMessage?: string;
  afterHoursAlternative?: string;
  callerExperienceScript: string;
  transferSummaryTemplate: string;
  enabled: boolean;
  triageClassifications: string[];
};

export type RoutingRecommendation = {
  destinationType: RoutingDestinationType;
  destinationId: string;
  displayName: string;
  transferType: TransferType;
  spokenCallerScript: string;
  spokenReceiverSummary?: string;
  advisoryOnly: true;
};

const DEFAULT_QUEUE_FOR: Record<string, { id: string; name: string; script: string }> = {
  EMERGENCY: {
    id: "emergency-911",
    name: "Emergency 911",
    script: "This is an emergency. Transferring you to a live call taker now.",
  },
  NON_EMERGENCY_POLICE: {
    id: "queue-non-emergency-police",
    name: "Non-emergency police",
    script: "I'll connect you with a non-emergency call taker.",
  },
  ANIMAL_CONTROL: {
    id: "queue-animal-control",
    name: "Animal control",
    script: "I'll connect you with animal control.",
  },
  PARKING: {
    id: "queue-parking",
    name: "Parking",
    script: "I'll connect you with parking enforcement, or we can send an online report link.",
  },
  CODE_ENFORCEMENT: {
    id: "queue-code",
    name: "Code enforcement",
    script: "I'll connect you with code enforcement.",
  },
  PUBLIC_WORKS: {
    id: "queue-public-works",
    name: "Public works",
    script: "This sounds like a city public-works issue. I can transfer you to the right department.",
  },
  TOW_COMPLAINT: {
    id: "queue-tow",
    name: "Tow complaints",
    script: "I'll connect you with the tow complaint line.",
  },
  NOISE_COMPLAINT: {
    id: "queue-noise",
    name: "Noise complaints",
    script: "I'll connect you with the non-emergency noise complaint queue.",
  },
  REPORT_ONLY: {
    id: "queue-report-only",
    name: "Report only",
    script: "This can often be completed as a report. I can send a secure link or connect you with a call taker.",
  },
  INFORMATION_REQUEST: {
    id: "kb-information",
    name: "Information",
    script: "I can look that up from the department knowledge base, or connect you with a call taker.",
  },
  CARFAX_REPORTING_ELIGIBLE: {
    id: "online-carfax",
    name: "Vehicle reporting portal",
    script: "This may be eligible for online vehicle reporting. I can text you a secure link.",
  },
  ONLINE_REPORTING_ELIGIBLE: {
    id: "online-report",
    name: "Online report",
    script: "You may be able to complete this online. I can text you a secure link.",
  },
  UNKNOWN: {
    id: "queue-call-taker",
    name: "Live call taker",
    script: "I'm connecting you with a call taker so we get this right.",
  },
};

function fillTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => fields[key] ?? "");
}

export function recommendRoute(opts: {
  classification: CallTriageClassification;
  externalAgencies: ExternalAgencyRoute[];
  intakeSummary?: string;
  callbackNumber?: string;
  locationText?: string;
  taxonomy?: AgencyTaxonomy | null;
}): RoutingRecommendation {
  const matchedType = opts.taxonomy ? findCallType(opts.taxonomy, opts.classification) : undefined;
  const isEmergencyClass =
    opts.classification === "EMERGENCY" ||
    opts.classification === "emergency" ||
    matchedType?.isEmergency === true ||
    matchedType?.escalationPath === "emergency";

  if (isEmergencyClass) {
    const row = DEFAULT_QUEUE_FOR.EMERGENCY;
    return {
      destinationType: "EMERGENCY_911",
      destinationId: row.id,
      displayName: row.name,
      transferType: "WARM",
      spokenCallerScript: row.script,
      advisoryOnly: true,
    };
  }

  const external = opts.externalAgencies.find(
    (a) => a.enabled && a.triageClassifications.includes(opts.classification),
  );
  if (external || matchedType?.escalationPath === "external") {
    if (external) {
      const fields = {
        issue: opts.intakeSummary ?? opts.classification,
        callback: opts.callbackNumber ?? "not provided",
        location: opts.locationText ?? "not provided",
      };
      return {
        destinationType: "EXTERNAL_AGENCY",
        destinationId: external.externalAgencyId,
        displayName: external.externalAgencyName,
        transferType: external.transferType,
        spokenCallerScript: external.callerExperienceScript,
        spokenReceiverSummary: fillTemplate(external.transferSummaryTemplate, fields),
        advisoryOnly: true,
      };
    }
  }

  if (matchedType?.escalationPath === "self_service") {
    return {
      destinationType: "ONLINE_SERVICE",
      destinationId: `self-${matchedType.id}`,
      displayName: matchedType.label,
      transferType: "WARM",
      spokenCallerScript: "You may be able to complete this without a live transfer.",
      advisoryOnly: true,
    };
  }

  if (matchedType?.escalationPath === "dispatcher") {
    return {
      destinationType: "CALL_TAKER",
      destinationId: `queue-${matchedType.id}`,
      displayName: matchedType.label,
      transferType: "WARM",
      spokenCallerScript: `I'll connect you with ${matchedType.label.toLowerCase()} staff.`,
      advisoryOnly: true,
    };
  }

  const row = DEFAULT_QUEUE_FOR[opts.classification] ?? DEFAULT_QUEUE_FOR.UNKNOWN;
  const destType: RoutingDestinationType =
    opts.classification === "CARFAX_REPORTING_ELIGIBLE" || opts.classification === "ONLINE_REPORTING_ELIGIBLE"
      ? "ONLINE_SERVICE"
      : opts.classification === "INFORMATION_REQUEST"
        ? "WORKFLOW"
        : "CALL_QUEUE";

  return {
    destinationType: destType,
    destinationId: row.id,
    displayName: row.name,
    transferType: "WARM",
    spokenCallerScript: row.script,
    advisoryOnly: true,
  };
}
