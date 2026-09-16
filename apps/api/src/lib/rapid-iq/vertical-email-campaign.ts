/**
 * Vertical 3-touch copy for Rapid IQ sales automation.
 * Canonical long sequences (emails 4–6, lists, UTMs) live in
 * docs/go-to-market-sales/EMAIL_CAMPAIGN_911_VENUE_CAMPUS.md.
 *
 * Rapid Cortex enhances operations. It does not replace CAD, 911, radio, ENS, or VMS.
 */

import type { RapidIqSalesVertical } from "rapid-cortex-shared";

export type VerticalCampaignTouch = {
  subject: string;
  body: string;
};

function signalClause(signalTitle?: string, rfpDeadline?: string): string {
  const title = signalTitle?.trim();
  if (!title) return "";
  const deadline = rfpDeadline?.trim() ? ` ahead of ${rfpDeadline.trim().slice(0, 10)}` : "";
  return `I noticed ${title}${deadline}. `;
}

export function verticalThreeTouchCopy(input: {
  agencyName: string;
  vertical: RapidIqSalesVertical;
  signalTitle?: string;
  rfpDeadline?: string;
}): VerticalCampaignTouch[] {
  const org = input.agencyName.trim() || "your agency";
  const signal = signalClause(input.signalTitle, input.rfpDeadline);

  if (input.vertical === "CAMPUS") {
    return [
      {
        subject: `${org}: most students still will not call 911`,
        body: `${signal}At ${org}, a lot of welfare and property incidents never become a 911 call. Students will scan a code or text a short keyword. They will not install another app during week one.\n\nRapid Cortex Campus puts QR, NFC, and SMS reports on a live campus console with building / zone context. It is not a 911 emergency dispatch system and it does not replace campus police.\n\nFifteen minutes is enough to watch a scan land on the console. Would that be useful this week?`,
      },
      {
        subject: `Re: ${org} — one console, not another ENS`,
        body: `Campus ENS products blast alerts. Rapid Cortex is the intake and coordination layer for what students actually report: location-aware incidents, two-way text with security when you enable it, and structured records that help Clery documentation.\n\nIT usually asks about FERPA and logs: we design for no PII in operational CloudWatch logs and anonymous reporting options. Your counsel still owns policy.\n\nHappy to demo the student path or send the campus one-pager.`,
      },
      {
        subject: `${org} — semester pilot, not a year-long CAD project`,
        body: `Last note unless you want a working session. Campus pilots here are usually one semester, a handful of zones, and SMS registration started early. Go-live is measured in weeks after MSA — not a CAD replacement program.\n\nIf this semester is already locked, say so. If Public Safety wants to see the QR path, I will keep it to 15 minutes.`,
      },
    ];
  }

  if (input.vertical === "VENUE") {
    return [
      {
        subject: `${org}: guest reports should not die on the radio`,
        body: `${signal}On event day at ${org}, guest problems still compete with radio traffic. A medical in section, a fight on the concourse, and a lost child do not wait for a free channel.\n\nRapid Cortex Venue gives guests QR / NFC / SMS reporting into a security console with section and gate context. It is not a 911 dispatch system and it does not replace your VMS or radio.\n\nWould a 20-minute walkthrough this week be useful?`,
      },
      {
        subject: `Re: ${org} — your cameras stay yours`,
        body: `We do not ask you to rip out the camera platform. Rapid Cortex registers venue cameras you already have (RTSP / ONVIF) so a section incident can open the relevant views in the same console as the guest report.\n\nLegal and risk usually want consent and retention in writing before a public QR program. We treat that as a joint plan, not a checkbox in a slide.\n\nHappy to walk the console or send the venue overview.`,
      },
      {
        subject: `${org} — one section, one event, then decide`,
        body: `Last note unless you want a working session. Venue pilots here are a few sections plus concourses, SMS registration, and a required test the day before the first live event.\n\nIf this season’s stack is frozen, I will wait. If Security wants a console walk before the next event, I will keep it tight.`,
      },
    ];
  }

  // PSAP / HOSPITAL / TRANSIT / ALL — Core 911 posture (assistive, CAD remains SoR).
  return [
    {
      subject: `${org}: less typing while the call is still live`,
      body: `${signal}Dispatchers at ${org} still have to listen, type, and decide on the same call. Rapid Cortex is a browser co-pilot for 911 / ECC staff: live transcription, AI-assisted incident structure, and supervisor visibility. It does not replace CAD, CPE, radio, or the dispatcher.\n\nWould a 20-minute walkthrough this week be useful?`,
    },
    {
      subject: `Re: ${org} — CAD stays the system of record`,
      body: `CAD remains the system of record. Rapid Cortex is an intelligence layer: transcripts, suggested structure, protocol-aligned coaching when your agency has approved packs, and QA surfaces for supervisors.\n\nCAD write-back is off unless you later sign a scoped connector project. We start most agencies on a standalone pilot so IT is not blocked on a vendor program.\n\nHappy to send a one-page technical overview or walk the dispatcher workspace live.`,
    },
    {
      subject: `${org} — what supervisors actually see`,
      body: `Last note unless you want a working session. Supervisors use Rapid Cortex for a second look: searchable transcripts, flags for review, and coaching that follows agency-approved protocol packs. Translation runs when your deployment wires that pipeline — it does not replace interpreters.\n\nIf the timing is wrong, say so. If a 20-minute floor walkthrough is useful, I will keep it tight.`,
    },
  ];
}
