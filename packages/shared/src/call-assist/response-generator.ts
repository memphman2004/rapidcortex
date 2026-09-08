import { interpolateCallAssistVoice, type CallAssistAgencyVoiceConfig } from "./voice-config.js";

function articleFor(noun: string): "a" | "an" {
  return /^[aeiou]/i.test(noun.trim()) ? "an" : "a";
}

export type ResponseVoice = {
  agencyDisplayName: string;
  agencyShortName: string;
  officerLabel: string;
  emergencyLine: string;
  disclosureText?: string;
  onlineReportPortalUrl?: string;
  carfaxPortalUrl?: string;
  promptOverrides?: Partial<Record<string, string>>;
};

export function responseVoiceFromConfig(config: {
  agencyDisplayName?: string | null;
  agencyName?: string | null;
  agencyShortName?: string | null;
  shortName?: string | null;
  officerLabel?: string | null;
  emergencyLine?: string | null;
  emergencyDestination?: string | null;
  disclosureText?: string | null;
  onlineReportPortalUrl?: string | null;
  onlineReportUrl?: string | null;
  carfaxPortalUrl?: string | null;
  promptOverrides?: Partial<Record<string, string>> | null;
}): ResponseVoice {
  const short =
    config.agencyShortName?.trim() || config.shortName?.trim() || config.agencyName?.trim() || "this agency";
  return {
    agencyDisplayName: config.agencyDisplayName?.trim() || config.agencyName?.trim() || short,
    agencyShortName: short,
    officerLabel: config.officerLabel?.trim() || "officer",
    emergencyLine: config.emergencyLine?.trim() || config.emergencyDestination?.trim() || "911",
    disclosureText: config.disclosureText?.trim() || undefined,
    onlineReportPortalUrl: config.onlineReportPortalUrl?.trim() || config.onlineReportUrl?.trim() || undefined,
    carfaxPortalUrl: config.carfaxPortalUrl?.trim() || undefined,
    promptOverrides: config.promptOverrides ?? undefined,
  };
}

/**
 * ALL spoken Call Assist responses. The Lex bot is universal intake machinery;
 * Lambda personalizes from CallAssistAgencyVoiceConfig. No agency name lives here.
 */
export class ResponseGenerator {
  constructor(private readonly config: ResponseVoice) {}

  static fromAgencyConfig(config: CallAssistAgencyVoiceConfig): ResponseGenerator {
    return new ResponseGenerator(responseVoiceFromConfig(config));
  }

  private override(key: string, fallback: string): string {
    const raw = this.config.promptOverrides?.[key]?.trim();
    if (!raw) return fallback;
    return interpolateCallAssistVoice(raw, { ...this.config, referenceNumber: "{referenceNumber}" });
  }

  emergencyTransfer(): string {
    const { agencyShortName, officerLabel, emergencyLine } = this.config;
    return this.override(
      "emergencyTransfer",
      `This is the non-emergency line. For life-threatening emergencies, ` +
        `please hang up and dial ${emergencyLine} now. ` +
        `I'm also alerting ${articleFor(agencyShortName)} ${agencyShortName} ${officerLabel}.`,
    );
  }

  humanTransfer(): string {
    const { agencyShortName, officerLabel } = this.config;
    return this.override(
      "humanTransfer",
      `Of course. I'm connecting you to ${articleFor(agencyShortName)} ` +
        `${agencyShortName} ${officerLabel} now. Stay on the line.`,
    );
  }

  incidentCreated(referenceNumber: string): string {
    const { agencyDisplayName, officerLabel } = this.config;
    const fallback =
      `I've created a report for ${agencyDisplayName}. ` +
      `Your reference number is ${referenceNumber}. ` +
      `${articleFor(officerLabel) === "an" ? "An" : "A"} ${officerLabel} will follow up.`;
    const raw = this.config.promptOverrides?.incidentCreated?.trim();
    if (!raw) return fallback;
    return interpolateCallAssistVoice(raw, { ...this.config, referenceNumber });
  }

  onlineReportEligible(portalUrl?: string): string {
    const override = this.config.promptOverrides?.onlineReportEligible?.trim();
    if (override) return interpolateCallAssistVoice(override, this.config);
    if (portalUrl ?? this.config.onlineReportPortalUrl) {
      return (
        `This incident may be eligible for online reporting. ` +
        `Would you like me to text you a secure link to file your report online?`
      );
    }
    return "";
  }

  callbackOffer(): string {
    return this.override(
      "callbackOffer",
      "If you prefer, we can schedule a callback instead of holding. Would you like us to call you back at this number?",
    );
  }

  smsOffer(): string {
    return this.override("smsOffer", this.onlineReportEligible() || "Would you like me to text you a secure link to finish this report online?");
  }

  carfaxEligible(portalUrl?: string): string {
    if (portalUrl ?? this.config.carfaxPortalUrl) {
      return (
        `Your vehicle incident may be eligible for the vehicle reporting program. ` +
        `Would you like me to text you a secure link?`
      );
    }
    return "";
  }

  opening(): string {
    const override = this.config.promptOverrides?.opening?.trim();
    if (override) return interpolateCallAssistVoice(override, this.config);
    const raw =
      this.config.disclosureText ||
      `Thank you for calling ${this.config.agencyDisplayName} non-emergency. ` +
        `I'm an automated assistant that will gather your information and route your call. ` +
        `This call may be recorded. ` +
        `If this is a life-threatening emergency, please hang up and dial ${this.config.emergencyLine}, ` +
        `or say emergency now. How can I help you today?`;
    return interpolateCallAssistVoice(raw, this.config);
  }

  fallbackTransfer(): string {
    const { agencyDisplayName, officerLabel } = this.config;
    return this.override(
      "fallbackTransfer",
      `I'm sorry, I'm having trouble understanding. ` +
        `Let me connect you to ${articleFor(agencyDisplayName)} ${agencyDisplayName} ${officerLabel} ` +
        `who can help. Stay on the line.`,
    );
  }
}
