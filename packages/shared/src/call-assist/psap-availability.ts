export type PsapAvailabilityStatus = "available" | "after_hours" | "not_on_rapid_cortex" | "unknown";

export type PsapAvailabilityNotice = {
  status: PsapAvailabilityStatus;
  headline: string;
  body: string;
  /** When false, campus/venue live boards must not look like a 911 PSAP. */
  showLiveOps: boolean;
};

/**
 * Shared PSAP availability copy. Campus and Venue are never a 911 PSAP.
 * Call Assist (PSAP product) uses operating hours when the tenant is onboarded.
 */
export function buildPsapAvailabilityNotice(opts: {
  product: "campus" | "venue" | "transit" | "psap";
  callAssistOnboarded?: boolean;
  withinHours?: boolean;
  agencyName?: string | null;
}): PsapAvailabilityNotice {
  const name = opts.agencyName?.trim() || "this agency";
  if (opts.product !== "psap") {
    if (opts.callAssistOnboarded && opts.withinHours === false) {
      return {
        status: "after_hours",
        headline: "Linked PSAP is after hours",
        body: `${name} Call Assist is outside published operating hours. This ${opts.product} console is not a 911 dispatch position.`,
        showLiveOps: false,
      };
    }
    if (opts.callAssistOnboarded && opts.withinHours) {
      return {
        status: "available",
        headline: "Linked PSAP is on Rapid Cortex",
        body: `Non-emergency Call Assist for ${name} is in operating hours. This ${opts.product} console is still not a 911 dispatch position — escalate life-threatening emergencies to 911.`,
        showLiveOps: false,
      };
    }
    return {
      status: "not_on_rapid_cortex",
      headline: "PSAP is not on Rapid Cortex",
      body: `This ${opts.product} workspace is not a live 911 dispatch console. The public-safety answering point is not running Rapid Cortex Call Assist for this site.`,
      showLiveOps: false,
    };
  }
  if (!opts.callAssistOnboarded) {
    return {
      status: "not_on_rapid_cortex",
      headline: "Call Assist is not onboarded",
      body: "Finish Call Assist setup before treating this queue as a live non-emergency intake path.",
      showLiveOps: false,
    };
  }
  if (opts.withinHours === false) {
    return {
      status: "after_hours",
      headline: "PSAP Call Assist is after hours",
      body: `${name} is outside published operating hours. Do not present this queue as staffed live intake.`,
      showLiveOps: false,
    };
  }
  return {
    status: "available",
    headline: "Call Assist is in operating hours",
    body: `${name} non-emergency AI intake is staffed per the published schedule.`,
    showLiveOps: true,
  };
}
