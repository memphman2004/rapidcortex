export type SalesTemplateVertical = "rc911" | "campus" | "venue" | "hospital" | "transit" | "general";

export type SalesOutreachTemplate = {
  id: string;
  title: string;
  vertical: SalesTemplateVertical;
  channel: "email" | "linkedin";
  subject: string;
  body: string;
};

export const SALES_OUTREACH_TEMPLATES: readonly SalesOutreachTemplate[] = [
  {
    id: "rc911-intro",
    title: "911 / PSAP — Intro",
    vertical: "rc911",
    channel: "email",
    subject: "Operational intelligence for {{agency_name}}",
    body: `Hi {{first_name}},

I work with PSAPs that want clearer visibility into call load, language demand, and dispatcher time — without replacing CAD.

Would a 20-minute look at how {{agency_name}} compares to peer centers be useful?

Best,
{{sender_name}}`,
  },
  {
    id: "rc911-wellness",
    title: "911 — Wellness free offer",
    vertical: "rc911",
    channel: "email",
    subject: "Free dispatcher wellness check-in for {{agency_name}}",
    body: `Hi {{first_name}},

NexCort iQ Wellness is free for accredited PSAPs — anonymous end-of-shift check-ins, aggregate supervisor view, no CJIS data.

Happy to turn it on for {{agency_name}} this week.

{{sender_name}}`,
  },
  {
    id: "campus-tip",
    title: "Campus — Community Connect",
    vertical: "campus",
    channel: "email",
    subject: "Free campus tip line for {{agency_name}}",
    body: `Hi {{first_name}},

NexCort iQ Community Connect gives {{agency_name}} one QR tip zone with email forwarding — free for qualifying institutions. No console required to start.

Worth a quick walkthrough?

{{sender_name}}`,
  },
  {
    id: "venue-tip",
    title: "Venue — Community Connect",
    vertical: "venue",
    channel: "email",
    subject: "Guest tip intake for {{agency_name}}",
    body: `Hi {{first_name}},

Guest tip QR + email forwarding is available free via NexCort iQ Community Connect for qualifying venues.

Can I send a one-pager?

{{sender_name}}`,
  },
  {
    id: "hospital-intro",
    title: "Hospital — Capacity intro",
    vertical: "hospital",
    channel: "email",
    subject: "Live capacity coordination for {{agency_name}}",
    body: `Hi {{first_name}},

NexCort iQ helps hospitals share live ER capacity and diversion status with EMS partners in real time.

Open to a short demo for {{agency_name}}?

{{sender_name}}`,
  },
  {
    id: "transit-intro",
    title: "Transit — Ops intro",
    vertical: "transit",
    channel: "email",
    subject: "Passenger safety ops for {{agency_name}}",
    body: `Hi {{first_name}},

NexCort iQ Transit gives security and ops a shared view of passenger reports and route incidents.

Worth 15 minutes?

{{sender_name}}`,
  },
  {
    id: "intel-scan",
    title: "All — Intelligence Scan offer",
    vertical: "general",
    channel: "email",
    subject: "Complimentary ops intelligence report",
    body: `Hi {{first_name}},

We offer a complimentary Operational Intelligence Report from anonymized CAD/call export data — volume by hour, language %, peak load.

Limited slots. Interested for {{agency_name}}?

{{sender_name}}`,
  },
  {
    id: "follow-up",
    title: "General follow-up",
    vertical: "general",
    channel: "email",
    subject: "Following up — {{agency_name}}",
    body: `Hi {{first_name}},

Checking back on our conversation about NexCort iQ for {{agency_name}}. Happy to answer questions or schedule a brief demo.

{{sender_name}}`,
  },
  {
    id: "linkedin-short",
    title: "LinkedIn short",
    vertical: "general",
    channel: "linkedin",
    subject: "",
    body: `{{first_name}} — helping PSAPs and campuses with real-time ops intelligence (not another CAD). Open to a quick chat about {{agency_name}}?`,
  },
] as const;
