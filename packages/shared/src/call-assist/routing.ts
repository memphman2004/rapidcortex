import type { CallTriageClassification, RoutingDestinationType, TransferType } from "./classifications.js";
import type { AgencyTaxonomy } from "./taxonomy.js";
import { findCallType } from "./taxonomy.js";

export const AFTER_HOURS_POLICIES = ["message", "fallback", "human"] as const;
export type AfterHoursPolicy = (typeof AFTER_HOURS_POLICIES)[number];

export const TRANSFER_FAILURE_POLICIES = ["fallback", "human", "callback"] as const;
export type TransferFailurePolicy = (typeof TRANSFER_FAILURE_POLICIES)[number];

export const EXTERNAL_ROUTE_CONFIG_STATUSES = ["incomplete", "ready"] as const;
export type ExternalRouteConfigStatus = (typeof EXTERNAL_ROUTE_CONFIG_STATUSES)[number];

export type ExternalAgencyHoursDay = {
  day: number;
  closed: boolean;
  openMinutes: number;
  closeMinutes: number;
};

export type ExternalAgencyRoute = {
  agencyId: string;
  externalAgencyId: string;
  externalAgencyName: string;
  phoneNumber: string;
  sipUri?: string;
  description: string;
  transferType: TransferType;
  afterHoursMessage?: string;
  afterHoursAlternative?: string;
  callerExperienceScript: string;
  transferSummaryTemplate: string;
  enabled: boolean;
  triageClassifications: string[];
  acceptedCallTypes?: string[];
  hoursTimezone?: string;
  hoursAllDay?: boolean;
  hours?: ExternalAgencyHoursDay[];
  afterHoursPolicy?: AfterHoursPolicy;
  fallbackPhoneNumber?: string;
  fallbackSipUri?: string;
  transferFailurePolicy?: TransferFailurePolicy;
  maxAttempts?: number;
  configurationStatus?: ExternalRouteConfigStatus;
};

export type RoutingRuntimeDisposition =
  | "proceed"
  | "after_hours"
  | "incomplete_config"
  | "type_not_accepted"
  | "fallback";

export type RoutingRecommendation = {
  destinationType: RoutingDestinationType;
  destinationId: string;
  displayName: string;
  transferType: TransferType;
  spokenCallerScript: string;
  spokenReceiverSummary?: string;
  advisoryOnly: true;
  runtimeDisposition?: RoutingRuntimeDisposition;
  fallbackDestinationId?: string;
  configIssues?: string[];
  channel?: "PSTN" | "SIP" | "QUEUE";
};

export type ExternalRouteDecision = {
  disposition: RoutingRuntimeDisposition;
  destinationNumber?: string;
  sipUri?: string;
  channel: "PSTN" | "SIP" | "QUEUE";
  spokenCallerScript: string;
  issues: string[];
  fallbackNumber?: string;
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

export function externalRouteConfigIssues(route: ExternalAgencyRoute): string[] {
  const issues: string[] = [];
  const types = acceptedTypes(route);
  if (!route.phoneNumber?.trim() && !route.sipUri?.trim()) {
    issues.push("missing_pstn_and_sip");
  }
  if (types.length === 0) issues.push("missing_accepted_call_types");
  if (!route.callerExperienceScript?.trim()) issues.push("missing_caller_script");
  const wantsFallback =
    route.afterHoursPolicy === "fallback" || route.transferFailurePolicy === "fallback";
  if (wantsFallback && !route.fallbackPhoneNumber?.trim() && !route.fallbackSipUri?.trim()) {
    issues.push("missing_fallback_destination");
  }
  if (route.afterHoursPolicy === "message" && !route.afterHoursMessage?.trim()) {
    issues.push("missing_after_hours_message");
  }
  return issues;
}

export function withExternalRouteDefaults(route: ExternalAgencyRoute): ExternalAgencyRoute {
  const issues = externalRouteConfigIssues(route);
  return {
    ...route,
    acceptedCallTypes: route.acceptedCallTypes?.length ? route.acceptedCallTypes : route.triageClassifications,
    hoursAllDay: route.hoursAllDay ?? (!route.hours || route.hours.length === 0),
    afterHoursPolicy: route.afterHoursPolicy ?? "human",
    transferFailurePolicy: route.transferFailurePolicy ?? "human",
    maxAttempts: route.maxAttempts ?? 2,
    configurationStatus: issues.length === 0 ? "ready" : "incomplete",
  };
}

function acceptedTypes(route: ExternalAgencyRoute): string[] {
  if (route.acceptedCallTypes && route.acceptedCallTypes.length > 0) return route.acceptedCallTypes;
  return route.triageClassifications ?? [];
}

export function minutesInTimeZone(at: Date, timeZone?: string): { day: number; minutes: number } {
  if (!timeZone) {
    return { day: at.getDay(), minutes: at.getHours() * 60 + at.getMinutes() };
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: dayMap[weekday] ?? at.getDay(), minutes: hour * 60 + minute };
  } catch {
    return { day: at.getDay(), minutes: at.getHours() * 60 + at.getMinutes() };
  }
}

export function isExternalRouteOpen(route: ExternalAgencyRoute, at = new Date()): boolean {
  if (route.hoursAllDay || !route.hours?.length) return true;
  const { day, minutes } = minutesInTimeZone(at, route.hoursTimezone);
  const row = route.hours.find((d) => d.day === day);
  if (!row || row.closed) return false;
  if (row.openMinutes === 0 && row.closeMinutes === 24 * 60) return true;
  if (row.openMinutes <= row.closeMinutes) return minutes >= row.openMinutes && minutes < row.closeMinutes;
  return minutes >= row.openMinutes || minutes < row.closeMinutes;
}

export function evaluateExternalRoute(opts: {
  route: ExternalAgencyRoute;
  classification: string;
  at?: Date;
}): ExternalRouteDecision {
  const route = withExternalRouteDefaults(opts.route);
  const issues = externalRouteConfigIssues(route);
  const types = acceptedTypes(route);
  const script = route.callerExperienceScript;
  if (!route.enabled) {
    return { disposition: "type_not_accepted", channel: "QUEUE", spokenCallerScript: script, issues: ["disabled"] };
  }
  if (types.length > 0 && !types.includes(opts.classification)) {
    return { disposition: "type_not_accepted", channel: "QUEUE", spokenCallerScript: script, issues: ["type_not_accepted"] };
  }
  if (issues.length > 0) {
    return {
      disposition: "incomplete_config",
      channel: "QUEUE",
      spokenCallerScript: "I'm connecting you with a call taker because that transfer destination is not fully configured.",
      issues,
    };
  }
  if (!isExternalRouteOpen(route, opts.at)) {
    const policy = route.afterHoursPolicy ?? "human";
    if (policy === "message") {
      return {
        disposition: "after_hours",
        channel: "QUEUE",
        spokenCallerScript: route.afterHoursMessage ?? "That office is closed. I'll connect you with a call taker.",
        issues: ["after_hours"],
        fallbackNumber: route.fallbackPhoneNumber,
      };
    }
    if (policy === "fallback" && (route.fallbackPhoneNumber || route.fallbackSipUri)) {
      return {
        disposition: "fallback",
        destinationNumber: route.fallbackPhoneNumber,
        sipUri: route.fallbackSipUri,
        channel: route.fallbackSipUri ? "SIP" : "PSTN",
        spokenCallerScript: route.afterHoursAlternative ?? script,
        issues: ["after_hours_fallback"],
        fallbackNumber: route.fallbackPhoneNumber,
      };
    }
    return {
      disposition: "after_hours",
      channel: "QUEUE",
      spokenCallerScript: route.afterHoursMessage ?? "That office is closed. I'll connect you with a call taker.",
      issues: ["after_hours"],
    };
  }
  return {
    disposition: "proceed",
    destinationNumber: route.phoneNumber,
    sipUri: route.sipUri,
    channel: route.sipUri ? "SIP" : "PSTN",
    spokenCallerScript: script,
    issues: [],
    fallbackNumber: route.fallbackPhoneNumber,
  };
}

export function recommendRoute(opts: {
  classification: CallTriageClassification;
  externalAgencies: ExternalAgencyRoute[];
  intakeSummary?: string;
  callbackNumber?: string;
  locationText?: string;
  taxonomy?: AgencyTaxonomy | null;
  at?: Date;
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
      runtimeDisposition: "proceed",
      channel: "QUEUE",
    };
  }

  const candidates = opts.externalAgencies.filter((a) => a.enabled);
  const matchedExternal = candidates.find((a) => acceptedTypes(a).includes(opts.classification));
  if (matchedExternal || matchedType?.escalationPath === "external") {
    if (matchedExternal) {
      const decision = evaluateExternalRoute({
        route: matchedExternal,
        classification: opts.classification,
        at: opts.at,
      });
      const fields = {
        issue: opts.intakeSummary ?? opts.classification,
        callback: opts.callbackNumber ?? "not provided",
        location: opts.locationText ?? "not provided",
      };
      if (decision.disposition === "incomplete_config" || decision.disposition === "after_hours") {
        return {
          destinationType: "CALL_TAKER",
          destinationId: "queue-call-taker",
          displayName: "Live call taker",
          transferType: "WARM",
          spokenCallerScript: decision.spokenCallerScript,
          advisoryOnly: true,
          runtimeDisposition: decision.disposition,
          configIssues: decision.issues,
          channel: "QUEUE",
        };
      }
      if (decision.disposition === "fallback") {
        return {
          destinationType: "EXTERNAL_AGENCY",
          destinationId: matchedExternal.externalAgencyId,
          displayName: matchedExternal.externalAgencyName,
          transferType: matchedExternal.transferType,
          spokenCallerScript: decision.spokenCallerScript,
          spokenReceiverSummary: fillTemplate(matchedExternal.transferSummaryTemplate, fields),
          advisoryOnly: true,
          runtimeDisposition: "fallback",
          fallbackDestinationId: decision.fallbackNumber,
          channel: decision.channel,
        };
      }
      if (decision.disposition === "proceed") {
        return {
          destinationType: "EXTERNAL_AGENCY",
          destinationId: matchedExternal.externalAgencyId,
          displayName: matchedExternal.externalAgencyName,
          transferType: matchedExternal.transferType,
          spokenCallerScript: matchedExternal.callerExperienceScript,
          spokenReceiverSummary: fillTemplate(matchedExternal.transferSummaryTemplate, fields),
          advisoryOnly: true,
          runtimeDisposition: "proceed",
          channel: decision.channel,
        };
      }
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
      runtimeDisposition: "proceed",
      channel: "QUEUE",
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
      runtimeDisposition: "proceed",
      channel: "QUEUE",
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
    runtimeDisposition: "proceed",
    channel: destType === "CALL_QUEUE" ? "QUEUE" : "QUEUE",
  };
}
