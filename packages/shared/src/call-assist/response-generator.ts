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
 * Spoken Call Assist responses — Absolute Speech Rules (short, no corporate filler).
 * Lex personalizes from CallAssistAgencyVoiceConfig; no agency name is hardcoded here.
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
    return this.override(
      "emergencyTransfer",
      "This sounds like an emergency — let me connect you now.",
    );
  }

  humanTransfer(): string {
    const { agencyShortName, officerLabel } = this.config;
    return this.override(
      "humanTransfer",
      `Connecting you to ${articleFor(agencyShortName)} ${agencyShortName} ${officerLabel} now. Stay on the line.`,
    );
  }

  incidentCreated(referenceNumber: string): string {
    const fallback =
      `Okay. We've got it. Your report number is ${referenceNumber}. ` +
      `Use that if you call back with updates.`;
    const raw = this.config.promptOverrides?.incidentCreated?.trim();
    if (!raw) return fallback;
    return interpolateCallAssistVoice(raw, { ...this.config, referenceNumber });
  }

  onlineReportEligible(portalUrl?: string): string {
    const override = this.config.promptOverrides?.onlineReportEligible?.trim();
    if (override) return interpolateCallAssistVoice(override, this.config);
    if (portalUrl ?? this.config.onlineReportPortalUrl) {
      return "Want me to text you a link to finish this online?";
    }
    return "";
  }

  callbackOffer(): string {
    return this.override("callbackOffer", "Want a callback at this number instead of holding?");
  }

  smsOffer(): string {
    return this.override(
      "smsOffer",
      this.onlineReportEligible() || "Want me to text you a secure link to finish online?",
    );
  }

  carfaxEligible(portalUrl?: string): string {
    if (portalUrl ?? this.config.carfaxPortalUrl) {
      return "Want a text link for the vehicle reporting program?";
    }
    return "";
  }

  opening(): string {
    const override = this.config.promptOverrides?.opening?.trim();
    if (override) return interpolateCallAssistVoice(override, this.config);
    if (this.config.disclosureText?.trim()) {
      return interpolateCallAssistVoice(this.config.disclosureText, this.config);
    }
    return "How can I help you today?";
  }

  fallbackTransfer(): string {
    return this.override(
      "fallbackTransfer",
      "Having trouble with that — connecting you to someone who can help.",
    );
  }

  /** Phase 2 — brief correction ack before the next question. */
  correctionAck(value: string): string {
    const v = value.trim();
    if (!v) return "Got it.";
    const short = v.length > 40 ? `${v.slice(0, 37)}…` : v;
    return `${short.charAt(0).toUpperCase()}${short.slice(1)}. Got it.`;
  }
}
