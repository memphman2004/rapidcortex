/** Single source of truth for Campus / Venue public NFC/QR intake theming. */

/** Public QR/NFC post-scan backgrounds (served from `apps/web/public`). */
export const INTAKE_PAGE_BACKGROUNDS = {
  campus: "/Campustap.png",
  venue: "/Venuetap.png",
} as const;

/** Cover photo + dark scrim so white/dark cards stay readable on cinematic art. */
export function intakePageBackgroundStyle(
  vertical: string,
): {
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
} | null {
  if (vertical === "venue") {
    return {
      backgroundColor: "#020617",
      backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.42) 0%, rgba(2,6,23,0.78) 100%), url(${INTAKE_PAGE_BACKGROUNDS.venue})`,
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
    };
  }
  if (vertical === "campus") {
    return {
      backgroundColor: "#020617",
      backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.38) 0%, rgba(2,6,23,0.75) 100%), url(${INTAKE_PAGE_BACKGROUNDS.campus})`,
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
    };
  }
  return null;
}

export const VERTICAL_THEME = {
  campus: {
    headerBg: "#0a1628",
    pageBg: "#f1f5f9",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    accentLine: "#dc2626",
    primary: "#16a34a",
    primaryHover: "#15803d",
    primaryText: "#ffffff",
    pillSelected: "#f0fdf4",
    pillBorder: "#16a34a",
    pillText: "#15803d",
    labelColor: "#2563eb",
    focusRing: "rgba(22,163,74,0.12)",
    anonChecked: "#16a34a",
    securityBg: "#eff6ff",
    securityBorder: "#bfdbfe",
    securityText: "#1e40af",
    securityIcon: "#2563eb",
    emergencyText: "#dc2626",
    headerSubtext: "#93c5fd",
    footerBg: "#f1f5f9",
    footerBorder: "#e2e8f0",
    inputBg: "#ffffff",
    inputBorder: "#e2e8f0",
    inputText: "#0f172a",
    mutedText: "#64748b",
    bodyText: "#0f172a",
    labelText: "#374151",
    categoryStyle: "pill" as const,

    headerTitle: "Rapid Cortex Campus",
    secureLabel: "Secure reporting",
    agencyLabel: "Campus Safety Reporting",
    pageTitle: "Report a safety concern",
    pageDesc:
      "Send a report directly to campus safety. You can call, submit details, share your location, or report discreetly.",
    callLabel: "Call Campus Security",
    submitLabel: "Submit report",
    categoryLabel: "Category",
    categoryHint: "(optional)",
    whatHappeningLabel: "What is happening?",
    locationLabel: "Your location / zone",
    anonLabel: "Report anonymously",
    nameLabel: "Your name",
    phoneLabel: "Your phone number",
    successTitle: "Report submitted",
    successDesc: "Campus security has been notified and will respond shortly.",

    categories: [
      "Medical concern",
      "Suspicious activity",
      "Harassment / threat",
      "Mental health concern",
      "Facility hazard",
      "Other",
    ],
  },

  venue: {
    headerBg: "#060d1a",
    pageBg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    accentLine: "#dc2626",
    primary: "#f59e0b",
    primaryHover: "#d97706",
    primaryText: "#0f172a",
    pillSelected: "rgba(245,158,11,0.08)",
    pillBorder: "#f59e0b",
    pillText: "#fbbf24",
    labelColor: "#f59e0b",
    focusRing: "rgba(245,158,11,0.12)",
    anonChecked: "#f59e0b",
    securityBg: "rgba(37,99,235,0.08)",
    securityBorder: "rgba(59,130,246,0.2)",
    securityText: "#93c5fd",
    securityIcon: "#60a5fa",
    emergencyText: "#f87171",
    headerSubtext: "#f59e0b",
    footerBg: "#060d1a",
    footerBorder: "#1e293b",
    inputBg: "#111827",
    inputBorder: "#334155",
    inputText: "#e2e8f0",
    mutedText: "#94a3b8",
    bodyText: "#f1f5f9",
    labelText: "#cbd5e1",
    categoryStyle: "card" as const,

    headerTitle: "Rapid Cortex Venue",
    secureLabel: "Secure reporting",
    agencyLabel: "Venue Security",
    pageTitle: "Get help now",
    pageDesc:
      "Report an incident or request security and medical staff. Your report goes directly to the venue operations team.",
    callLabel: "Contact venue security",
    submitLabel: "Submit report",
    categoryLabel: "What type of incident?",
    categoryHint: "(optional)",
    whatHappeningLabel: "What is happening?",
    locationLabel: "Your location",
    anonLabel: "Report anonymously",
    nameLabel: "Your name",
    phoneLabel: "Your phone number",
    successTitle: "Report received",
    successDesc: "The venue operations team has been notified and is responding.",

    categories: [
      "Fight / disturbance",
      "Medical emergency",
      "Lost child",
      "Suspicious item",
      "Spill / hazard",
      "Need staff",
    ],
  },
} as const;

export type IntakeVertical = keyof typeof VERTICAL_THEME;
export type VerticalTheme = (typeof VERTICAL_THEME)[IntakeVertical];

export function themeForVertical(vertical: string): VerticalTheme {
  if (vertical === "venue") return VERTICAL_THEME.venue;
  return VERTICAL_THEME.campus;
}

/** Map UI category labels to the existing public intake `helpType` enum. */
export function categoryToHelpType(
  category: string | null,
): "safety" | "medical" | "suspicious" | "other" {
  if (!category) return "other";
  const c = category.toLowerCase();
  if (c.includes("medical")) return "medical";
  if (c.includes("suspicious")) return "suspicious";
  if (c === "other") return "other";
  return "safety";
}
