import type { AgencyTenant, CampusAgencyConfig } from "rapid-cortex-shared";

export type CampusSettingsView = {
  general: {
    displayName: string;
    campusType: "university" | "k12" | "community_college" | "corporate" | "other";
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
};

const DEFAULT_SETTINGS: CampusSettingsView = {
  general: {
    displayName: "",
    campusType: "university",
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
    collectPhone: false,
    collectLocation: true,
    customFields: [],
    disclaimerText:
      "This form is not monitored 24/7 and is not a substitute for calling 911 in an emergency.",
  },
};

export function campusSettingsFromAgency(agency: AgencyTenant): CampusSettingsView {
  const campus = agency.config?.campus;
  const recipients = campus?.notificationRecipients;

  return {
    general: {
      displayName: campus?.displayName ?? agency.name ?? "",
      campusType: campus?.campusType ?? DEFAULT_SETTINGS.general.campusType,
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
      collectPhone: campus?.publicReportForm?.collectPhone ?? false,
      collectLocation:
        campus?.publicReportForm?.collectLocation ??
        campus?.publicReportForm?.showLocationPicker ??
        true,
      customFields: campus?.publicReportForm?.customFields ?? [],
      disclaimerText:
        campus?.publicReportForm?.emergencyDisclaimer ?? DEFAULT_SETTINGS.publicForm.disclaimerText,
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

  if (general?.displayName !== undefined) {
    const trimmed = general.displayName.trim();
    if (trimmed) campus.displayName = trimmed;
  }
  if (general?.campusType) campus.campusType = general.campusType;
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

  return {
    ...(general?.displayName?.trim() ? { name: general.displayName.trim() } : {}),
    campus,
  };
}
