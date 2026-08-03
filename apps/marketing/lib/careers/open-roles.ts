export type OpenRole = {
  id: string;
  positionCode: string;
  title: string;
  subtitle?: string;
  company: string;
  location: string;
  workplaceType: string;
  employmentType: string;
  compensation: string;
  hours: string;
  postedLabel: string;
  applicantsLabel: string;
  chips: string[];
  about: string[];
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
};

/** Public open roles shown on /careers. Add roles here as hiring expands. */
export const OPEN_ROLES: OpenRole[] = [
  {
    id: "ea-startup-ops",
    positionCode: "EA_STARTUP_OPS_COORDINATOR",
    title: "Executive Assistant / Startup Operations Coordinator",
    subtitle: "Founder & executive support",
    company: "Rapid Cortex",
    location: "United States (Remote)",
    workplaceType: "Remote",
    employmentType: "Contract (1099)",
    compensation: "Up to $22/hr",
    hours: "5–15 hrs/week",
    postedLabel: "Actively hiring",
    applicantsLabel: "Be an early applicant",
    chips: ["Remote", "Part-time", "1099", "Growth path"],
    about: [
      "Rapid Cortex is an intelligence platform serving 911 centers, university campuses, and large venues. We help dispatchers, supervisors, and command staff make faster, smarter decisions when it matters most.",
      "We are looking for a sharp, organized, entrepreneurially-minded Executive Assistant to work directly alongside our Founder & CEO, Chief Revenue Officer, and Marketing Director. You will own calendars, CRM hygiene, outreach coordination, marketing support, and customer pilot logistics.",
      "This is not a traditional admin role. It is a ground-floor opportunity at a mission-driven startup where your contributions are visible, and your work directly supports technology that protects communities.",
    ],
    responsibilities: [
      "Manage executive calendars, meetings, and follow-ups across the founding team",
      "Keep CRM records accurate and support outbound / inbound sales coordination",
      "Coordinate marketing tasks, content logistics, and partner outreach",
      "Help organize customer pilot onboarding and operational checklists",
      "Prepare concise briefs, agendas, and action trackers for leadership",
    ],
    requirements: [
      "Strong written and verbal communication",
      "Proven organization skills and comfort with tools like Google Workspace, Notion, or similar",
      "Ability to work independently in a remote, startup environment",
      "Reliable availability of roughly 5–15 hours per week",
      "Interest in public safety, technology, or high-growth startups",
    ],
    niceToHave: [
      "Prior executive assistant, operations, or startup experience",
      "Familiarity with CRM tools (HubSpot, Salesforce, or similar)",
      "Experience supporting sales or marketing teams",
    ],
  },
];

export function getOpenRole(id: string): OpenRole | undefined {
  return OPEN_ROLES.find((r) => r.id === id);
}
