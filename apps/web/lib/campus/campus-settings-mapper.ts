import type {
  AgencyTenant,
  CampusAgencyConfig,
  CampusInfoTab,
  CampusInstitutionType,
} from "rapid-cortex-shared";
import {
  normalizeCampusSiteCode,
  resolveCampusInstitutionTypeFromConfig,
} from "rapid-cortex-shared";

export type CampusSettingsView = {
  general: {
    displayName: string;
    campusType: "university" | "k12" | "community_college" | "corporate" | "other";
    institutionType: CampusInstitutionType;
    timezone: string;
  };
  notifications: {
    newIncidentEmails: string[];
    escalationEmails: string[];
    newIncidentSms: string[];
    escalationSms: string[];
  };
  escalation: {
    enabled: boolean;
    thresholdMinutes: number;
    escalationContacts: Array<{ name: string; email: string; phone: string }>;
  };
  publicForm: {
    title: string;
    instructions: string;
    collectName: boolean;
    collectPhone: boolean;
    collectLocation: boolean;
    customFields: Array<{ label: string; required: boolean }>;
    disclaimerText: string;
  };
  mapOverlay: {
    geojsonOverlayUrl: string;
  };
  /** Tenant / primary-site Information tab. */
  infoTab: CampusInfoTab;
  /** Per-site overrides (normalized siteCode → tab). */
  infoTabBySiteCode: Record<string, CampusInfoTab>;
  /** UI-only: which site is being edited ("" = tenant default). */
  infoTabEditingSiteCode: string;
  /** Escort iQ™ — higher-ed only; tenant must opt in (platform flag still fail-closed). */
  escortIq: {
    enabled: boolean;
    campusSafetyPhone: string;
    studentInstructions: string;
  };
  /** NexCort iQ Campus Alerts — higher-ed only; default disabled. */
  campusAlerts: {
    enabled: boolean;
    selfRegistrationEnabled: boolean;
    registrationValidityDays: number;
    /** Non-SMS renewal outreach materials (mass SMS renewals are forbidden). */
    renewalOutreachEnabled: boolean;
    emergencyMassSmsEnabled: boolean;
  };
};

const EMPTY_INFO_TAB: CampusInfoTab = {
  displayName: "",
  logoUrl: "",
  brandColor: undefined,
  emergencyContacts: [],
  sections: [],
  alertBanner: undefined,
  externalLinks: [],
};

const DEFAULT_SETTINGS: CampusSettingsView = {
  general: {
    displayName: "",
    campusType: "university",
    institutionType: "higher_ed",
    timezone: "America/New_York",
  },
  notifications: {
    newIncidentEmails: [],
    escalationEmails: [],
    newIncidentSms: [],
    escalationSms: [],
  },
  escalation: {
    enabled: false,
    thresholdMinutes: 15,
    escalationContacts: [],
  },
  publicForm: {
    title: "Report a Safety Concern",
    instructions: "",
    collectName: true,
    /** Campus default: collect callback phone for ops + live location. */
    collectPhone: true,
    collectLocation: true,
    customFields: [],
    disclaimerText:
      "This form is not monitored 24/7 and is not a substitute for calling 911 in an emergency.",
  },
  mapOverlay: {
    geojsonOverlayUrl: "",
  },
  infoTab: { ...EMPTY_INFO_TAB },
  infoTabBySiteCode: {},
  infoTabEditingSiteCode: "",
  escortIq: {
    enabled: false,
    campusSafetyPhone: "",
    studentInstructions: "",
  },
  campusAlerts: {
    enabled: false,
    selfRegistrationEnabled: true,
    registrationValidityDays: 365,
    renewalOutreachEnabled: true,
    emergencyMassSmsEnabled: true,
  },
};

function normalizeInfoTabView(base?: CampusInfoTab | null): CampusInfoTab {
  return {
    displayName: base?.displayName ?? "",
    logoUrl: base?.logoUrl ?? "",
    brandColor: base?.brandColor,
    emergencyContacts: base?.emergencyContacts ?? [],
    sections: base?.sections ?? [],
    alertBanner: base?.alertBanner,
    externalLinks: base?.externalLinks ?? [],
  };
}

export function campusSettingsFromAgency(agency: AgencyTenant): CampusSettingsView {
  const campus = agency.config?.campus;
  const recipients = campus?.notificationRecipients;
  const bySite: Record<string, CampusInfoTab> = {};
  for (const [code, tab] of Object.entries(campus?.infoTabBySiteCode ?? {})) {
    bySite[normalizeCampusSiteCode(code)] = normalizeInfoTabView(tab);
  }

  return {
    general: {
      displayName: campus?.displayName ?? agency.name ?? "",
      campusType: campus?.campusType ?? DEFAULT_SETTINGS.general.campusType,
      institutionType: resolveCampusInstitutionTypeFromConfig({
        institutionType: agency.institutionType ?? campus?.institutionType,
        campusType: campus?.campusType,
      }),
      timezone: campus?.timezone ?? DEFAULT_SETTINGS.general.timezone,
    },
    notifications: {
      newIncidentEmails: recipients?.newIncidentEmails ?? [],
      escalationEmails: recipients?.escalationEmails ?? [],
      newIncidentSms: recipients?.newIncidentSms ?? [],
      escalationSms: recipients?.escalationSms ?? [],
    },
    escalation: {
      enabled: campus?.escalation?.enabled ?? false,
      thresholdMinutes: campus?.escalation?.unacknowledgedMinutes ?? 15,
      escalationContacts:
        campus?.escalation?.contacts?.map((c) => ({
          name: c.name,
          email: c.email ?? "",
          phone: c.phone ?? "",
        })) ?? [],
    },
    publicForm: {
      title: campus?.publicReportForm?.headline ?? DEFAULT_SETTINGS.publicForm.title,
      instructions: campus?.publicReportForm?.instructions ?? "",
      collectName: campus?.publicReportForm?.collectName ?? true,
      collectPhone: campus?.publicReportForm?.collectPhone ?? true,
      collectLocation:
        campus?.publicReportForm?.collectLocation ??
        campus?.publicReportForm?.showLocationPicker ??
        true,
      customFields: campus?.publicReportForm?.customFields ?? [],
      disclaimerText:
        campus?.publicReportForm?.emergencyDisclaimer ?? DEFAULT_SETTINGS.publicForm.disclaimerText,
    },
    mapOverlay: {
      geojsonOverlayUrl: campus?.geojsonOverlayUrl ?? "",
    },
    infoTab: normalizeInfoTabView(campus?.infoTab),
    infoTabBySiteCode: bySite,
    infoTabEditingSiteCode: "",
    escortIq: {
      enabled: campus?.escortIq?.enabled === true,
      campusSafetyPhone: campus?.escortIq?.campusSafetyPhone ?? "",
      studentInstructions: campus?.escortIq?.studentInstructions ?? "",
    },
    campusAlerts: {
      enabled: campus?.campusAlerts?.enabled === true,
      selfRegistrationEnabled: campus?.campusAlerts?.selfRegistrationEnabled !== false,
      registrationValidityDays: campus?.campusAlerts?.registrationValidityDays ?? 365,
      renewalOutreachEnabled: campus?.campusAlerts?.renewalOutreachEnabled !== false,
      emergencyMassSmsEnabled: campus?.campusAlerts?.emergencyMassSmsEnabled !== false,
    },
  };
}

export function campusPatchFromSettingsView(
  patch: Partial<CampusSettingsView>,
): { name?: string; campus: CampusAgencyConfig } {
  const campus: CampusAgencyConfig = {};
  const general = patch.general;
  const notifications = patch.notifications;
  const escalation = patch.escalation;
  const publicForm = patch.publicForm;
  const mapOverlay = patch.mapOverlay;
  if (general?.displayName !== undefined) {
    const trimmed = general.displayName.trim();
    if (trimmed) campus.displayName = trimmed;
  }
  if (general?.campusType) campus.campusType = general.campusType;
  if (general?.institutionType) campus.institutionType = general.institutionType;
  if (general?.timezone) campus.timezone = general.timezone;

  if (notifications) {
    campus.notificationRecipients = {
      newIncidentEmails: notifications.newIncidentEmails,
      escalationEmails: notifications.escalationEmails,
      newIncidentSms: notifications.newIncidentSms,
      escalationSms: notifications.escalationSms,
    };
  }

  if (escalation) {
    const contacts = escalation.escalationContacts
      ?.filter((c) => c.name.trim().length > 0)
      .map((c) => ({
        name: c.name.trim(),
        ...(c.email?.trim() ? { email: c.email.trim() } : {}),
        ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}),
      }));
    campus.escalation = {
      enabled: escalation.enabled,
      unacknowledgedMinutes: escalation.thresholdMinutes,
      contacts: contacts && contacts.length > 0 ? contacts : undefined,
    };
  }

  if (publicForm) {
    campus.publicReportForm = {
      headline: publicForm.title,
      instructions: publicForm.instructions,
      collectName: publicForm.collectName,
      collectPhone: publicForm.collectPhone,
      collectLocation: publicForm.collectLocation,
      showLocationPicker: publicForm.collectLocation,
      showPhotoUpload: true,
      customFields: publicForm.customFields,
      emergencyDisclaimer: publicForm.disclaimerText,
    };
  }

  if (mapOverlay) {
    campus.geojsonOverlayUrl = mapOverlay.geojsonOverlayUrl.trim();
  }

  if (patch.infoTab) {
    campus.infoTab = cleanInfoTabForPatch(patch.infoTab);
  }
  if (patch.infoTabBySiteCode) {
    const next: Record<string, CampusInfoTab> = {};
    for (const [code, tab] of Object.entries(patch.infoTabBySiteCode)) {
      next[normalizeCampusSiteCode(code)] = cleanInfoTabForPatch(tab);
    }
    campus.infoTabBySiteCode = next;
  }

  if (patch.escortIq) {
    campus.escortIq = {
      enabled: Boolean(patch.escortIq.enabled),
      ...(patch.escortIq.campusSafetyPhone?.trim()
        ? { campusSafetyPhone: patch.escortIq.campusSafetyPhone.trim() }
        : {}),
      ...(patch.escortIq.studentInstructions?.trim()
        ? { studentInstructions: patch.escortIq.studentInstructions.trim() }
        : {}),
    };
  }

  if (patch.campusAlerts) {
    campus.campusAlerts = {
      ...(campus.campusAlerts ?? {}),
      enabled: Boolean(patch.campusAlerts.enabled),
      selfRegistrationEnabled: patch.campusAlerts.selfRegistrationEnabled !== false,
      registrationValidityDays: patch.campusAlerts.registrationValidityDays || 365,
      renewalOutreachEnabled: patch.campusAlerts.renewalOutreachEnabled !== false,
      emergencyMassSmsEnabled: patch.campusAlerts.emergencyMassSmsEnabled !== false,
      // Mass SMS renewal campaigns permanently disabled under emergency-only policy.
      remindersEnabled: false,
      campusWideRenewalCampaignEnabled: false,
      reminderDaysBeforeExpiration: [],
      smsNotificationsEnabled: campus.campusAlerts?.smsNotificationsEnabled ?? true,
      retentionDaysAfterExpiration: campus.campusAlerts?.retentionDaysAfterExpiration ?? 90,
      subscriberExportEnabled: campus.campusAlerts?.subscriberExportEnabled ?? false,
      consentTextVersion: campus.campusAlerts?.consentTextVersion ?? "campus-alerts-sms-v1",
      publicActiveAlertBannerEnabled: campus.campusAlerts?.publicActiveAlertBannerEnabled ?? true,
      requireDualAuthorization: campus.campusAlerts?.requireDualAuthorization ?? false,
      allClearMassSmsEnabled: campus.campusAlerts?.allClearMassSmsEnabled ?? true,
      contractualBillingMode: campus.campusAlerts?.contractualBillingMode ?? "nexcort_managed",
      estimatedRatePerSegmentUsd: campus.campusAlerts?.estimatedRatePerSegmentUsd ?? 0.01,
      billingCostDisclaimer:
        campus.campusAlerts?.billingCostDisclaimer ??
        "Estimates are illustrative. Actual charges depend on carrier fees, message length, encoding, and your service agreement.",
    };
  }

  return {
    ...(general?.displayName?.trim() ? { name: general.displayName.trim() } : {}),
    campus,
  };
}

function cleanInfoTabForPatch(infoTab: CampusInfoTab): CampusInfoTab {
  return {
    ...(infoTab.displayName?.trim() ? { displayName: infoTab.displayName.trim() } : {}),
    ...(infoTab.logoUrl?.trim() ? { logoUrl: infoTab.logoUrl.trim() } : { logoUrl: "" }),
    ...(infoTab.brandColor?.trim() ? { brandColor: infoTab.brandColor.trim() } : {}),
    emergencyContacts: (infoTab.emergencyContacts ?? []).filter(
      (c) => c.label.trim() && c.phone.trim(),
    ),
    sections: (infoTab.sections ?? []).map((s, i) => ({
      title: s.title.trim(),
      content: s.content,
      order: s.order ?? i,
      visible: s.visible !== false,
    })),
    ...(infoTab.alertBanner?.message?.trim()
      ? {
          alertBanner: {
            message: infoTab.alertBanner.message.trim(),
            severity: infoTab.alertBanner.severity,
            active: Boolean(infoTab.alertBanner.active),
          },
        }
      : {}),
    externalLinks: (infoTab.externalLinks ?? []).filter((l) => l.label.trim() && l.url.trim()),
  };
}
