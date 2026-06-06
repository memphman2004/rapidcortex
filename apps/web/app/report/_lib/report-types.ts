export type HelpType =
  | "medical"
  | "security"
  | "lost_person"
  | "maintenance"
  | "guest_services"
  | "other";

export interface ReportFormState {
  step: 1 | 2 | 3 | 4;
  helpType: HelpType | null;
  venueCode: string;
  zoneCode: string;
  zoneLabel: string;
  details: string;
  phoneNumber: string;
  photoFile: File | null;
  photoPreviewUrl: string | null;
  submitted: boolean;
  referenceId: string | null;
}

export const HELP_TYPES: {
  type: HelpType;
  label: string;
  emoji: string;
  description: string;
  urgent: boolean;
}[] = [
  { type: "medical", label: "Medical", emoji: "🏥", description: "Someone needs medical attention", urgent: true },
  {
    type: "security",
    label: "Security",
    emoji: "🛡️",
    description: "Security concern or suspicious activity",
    urgent: true,
  },
  {
    type: "lost_person",
    label: "Lost Person",
    emoji: "👤",
    description: "Lost child or separated from group",
    urgent: false,
  },
  {
    type: "maintenance",
    label: "Maintenance",
    emoji: "🔧",
    description: "Spill, damage, or facility issue",
    urgent: false,
  },
  {
    type: "guest_services",
    label: "Guest Services",
    emoji: "ℹ️",
    description: "Question or general assistance",
    urgent: false,
  },
  { type: "other", label: "Other", emoji: "❓", description: "Something else", urgent: false },
];

export function generateReferenceId(venueCode: string): string {
  const now = new Date();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${venueCode}-${now.getFullYear()}-${seq}`;
}
