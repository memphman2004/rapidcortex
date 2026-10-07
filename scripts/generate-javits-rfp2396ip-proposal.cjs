/**
 * Rebuild Javits RFP 2396IP proposal to match NexCort iQ production product.
 * Output: ~/Downloads/NexCortiQ_Javits_Proposal_RFP2396IP.docx
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageNumber,
  Header,
  Footer,
  PageBreak,
} = require("docx");
const fs = require("fs");

const PAGE = { size: { width: 12240, height: 15840 } }; // US Letter
const MARGIN = { top: 720, right: 720, bottom: 720, left: 720 };
const ORANGE = "EA580C";
const NAVY = "0F172A";
const SLATE = "334155";
const MUTED = "64748B";
const THIN = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
const NO = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const NB = { top: NO, bottom: NO, left: NO, right: NO };

function p(text, opts = {}) {
  const {
    bold = false,
    size = 22,
    color = SLATE,
    align = AlignmentType.LEFT,
    spacingAfter = 120,
    spacingBefore = 0,
    heading = undefined,
    italics = false,
  } = opts;
  return new Paragraph({
    heading,
    alignment: align,
    spacing: { after: spacingAfter, before: spacingBefore },
    children: [
      new TextRun({
        text,
        bold,
        italics,
        size,
        color,
        font: "Calibri",
      }),
    ],
  });
}

function runs(parts, opts = {}) {
  const { align = AlignmentType.LEFT, spacingAfter = 120, spacingBefore = 0 } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter, before: spacingBefore },
    children: parts.map((part) =>
      new TextRun({
        text: part.text,
        bold: Boolean(part.bold),
        italics: Boolean(part.italics),
        size: part.size ?? 22,
        color: part.color ?? SLATE,
        font: "Calibri",
      }),
    ),
  });
}

function h1(text) {
  return p(text, { bold: true, size: 32, color: NAVY, spacingBefore: 240, spacingAfter: 200, heading: HeadingLevel.HEADING_1 });
}
function h2(text) {
  return p(text, { bold: true, size: 26, color: NAVY, spacingBefore: 200, spacingAfter: 140, heading: HeadingLevel.HEADING_2 });
}
function h3(text) {
  return p(text, { bold: true, size: 22, color: ORANGE, spacingBefore: 160, spacingAfter: 100, heading: HeadingLevel.HEADING_3 });
}
function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [new TextRun({ text: `•  ${text}`, size: 21, color: SLATE, font: "Calibri" })],
  });
}

function cell(text, opts = {}) {
  const { bold = false, width = 2340, shade = undefined, align = AlignmentType.LEFT, color = NAVY } = opts;
  return new TableCell({
    borders: BORDERS,
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: "clear", fill: shade } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { after: 40, before: 40 },
        children: [new TextRun({ text, bold, size: 18, color, font: "Calibri" })],
      }),
    ],
  });
}

function twoCol(rows) {
  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: [3600, 7200],
    rows: rows.map(([a, b]) =>
      new TableRow({
        children: [cell(a, { bold: true, width: 3600, shade: "F8FAFC" }), cell(b, { width: 7200 })],
      }),
    ),
  });
}

function moneyTable(headers, rows, widths) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: headers.map((h, i) =>
          cell(h, { bold: true, width: widths[i], shade: "0F172A", color: "FFFFFF", align: AlignmentType.LEFT }),
        ),
      }),
      ...rows.map((r) =>
        new TableRow({
          children: r.map((v, i) =>
            cell(String(v), {
              width: widths[i],
              bold: i === 0 && (String(v).startsWith("TOTAL") || String(v).includes("Total") || String(v).includes("Maximum")),
            }),
          ),
        }),
      ),
    ],
  });
}

function mapTable(rows) {
  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: [3600, 7200],
    rows: [
      new TableRow({
        children: [
          cell("RFP Requirement", { bold: true, width: 3600, shade: "0F172A", color: "FFFFFF" }),
          cell("NexCort iQ Venue Response", { bold: true, width: 7200, shade: "0F172A", color: "FFFFFF" }),
        ],
      }),
      ...rows.map(([a, b]) =>
        new TableRow({
          children: [cell(a, { bold: true, width: 3600, shade: "FFF7ED" }), cell(b, { width: 7200 })],
        }),
      ),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        styles: [{ id: "Normal", run: { font: "Calibri", size: 22 } }],
      },
    },
  },
  sections: [
    {
      properties: { page: { size: PAGE.size, margin: MARGIN } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "NexCort iQ  ·  RFP 2396IP  ·  Confidential", size: 16, color: MUTED, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Apps on Demand LLC d/b/a NexCort iQ  ·  Page ", size: 16, color: MUTED, font: "Calibri" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: "Calibri" }),
              ],
            }),
          ],
        }),
      },
      children: [
        p("PROPOSAL", { bold: true, size: 20, color: ORANGE, align: AlignmentType.CENTER, spacingAfter: 60 }),
        p("Digital Incident Reporting Solution", { bold: true, size: 40, color: NAVY, align: AlignmentType.CENTER, spacingAfter: 80 }),
        p("RFP No. 2396IP", { bold: true, size: 26, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 200 }),
        p("Submitted to:", { bold: true, size: 20, color: MUTED, align: AlignmentType.CENTER, spacingAfter: 40 }),
        p("Jacob K. Javits Convention Center", { bold: true, size: 24, color: NAVY, align: AlignmentType.CENTER, spacingAfter: 20 }),
        p("New York Convention Center Operating Corporation", { size: 20, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 20 }),
        p("655 West 34th Street, New York, NY 10001", { size: 20, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 240 }),
        p("Submitted by:", { bold: true, size: 20, color: MUTED, align: AlignmentType.CENTER, spacingAfter: 40 }),
        p("Apps on Demand LLC d/b/a NexCort iQ", { bold: true, size: 24, color: NAVY, align: AlignmentType.CENTER, spacingAfter: 20 }),
        p("NexCort iQ Venue — Production Platform", { size: 22, color: ORANGE, align: AlignmentType.CENTER, spacingAfter: 20 }),
        p("Dr. Jeffrey W. Coleman Jr., Founder & CEO", { size: 20, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 20 }),
        p("jwcoleman@nexcortiq.us  |  (404) 520-1747  |  www.nexcortiq.us", { size: 18, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 200 }),
        p("Proposal Submission Date: October 14, 2026", { size: 20, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 40 }),
        p("Contract Term: Three (3) Years with Two-Year Renewal Option", { size: 20, color: SLATE, align: AlignmentType.CENTER, spacingAfter: 200 }),
        p("CONFIDENTIAL — PROPRIETARY AND TRADE SECRET INFORMATION", { bold: true, size: 16, color: MUTED, align: AlignmentType.CENTER, spacingAfter: 200 }),

        new Paragraph({ children: [new PageBreak()] }),

        h1("Cover Letter"),
        p("October 14, 2026"),
        p("Indira Pazos"),
        p("Manager of Procurement Solutions"),
        p("Jacob K. Javits Convention Center"),
        p("655 West 34th Street"),
        p("New York, New York 10001", { spacingAfter: 200 }),
        p("Re: RFP No. 2396IP — Digital Incident Reporting Solution", { bold: true, spacingAfter: 200 }),
        p("Dear Ms. Pazos:"),
        p(
          "Apps on Demand LLC, doing business as NexCort iQ, is pleased to submit this proposal in response to the Jacob K. Javits Convention Center's Request for Proposal for a Digital Incident Reporting Solution.",
        ),
        p(
          "NexCort iQ is a production public-safety intelligence platform already operating on Amazon Web Services. The Venue product vertical is live in production today at app.rapidcortex.us with dedicated role consoles for Venue Admin, Supervisor, Security, Operator, and Guest Services. Guests report via QR code or SMS (no app download). Security teams manage incidents, guest reports, cameras, zones, and optional Rapid Vision AI context from a unified orange-branded venue console.",
        ),
        p(
          "We noted that the Javits Center has already designed guest-facing safety signage incorporating QR code scanning, SMS text intake (\"TEXT JAVITS\"), and NFC tap activation. NexCort iQ Venue natively supports QR, SMS, and NFC intake into the same incident record that security officers and supervisors work — with a full audit trail from first contact to disposition. NexCort iQ enhances venue security operations; it does not replace radios, CCTV matrices, CAD systems, medical direction, or 911. Escalation to emergency communications remains a human decision.",
        ),
        p(
          "We propose to serve as the Javits Center's Anchor Venue Partner — with dedicated onboarding, co-development input rights, and locked annual pricing for the base term. A Free 60-Day Pilot is available for qualified venues to evaluate QR/SMS reporting, the venue dashboard, zones, and training before full rollout.",
        ),
        p(
          "We welcome an in-person demonstration at any time during evaluation. A fully configured demonstration environment can be ready within 72 hours of request.",
        ),
        p("Respectfully submitted,", { spacingBefore: 200 }),
        p("Dr. Jeffrey W. Coleman Jr.", { bold: true, spacingBefore: 200, spacingAfter: 20 }),
        p("Founder and Chief Executive Officer", { spacingAfter: 20 }),
        p("Apps on Demand LLC d/b/a NexCort iQ", { spacingAfter: 20 }),
        p("jwcoleman@nexcortiq.us | (404) 520-1747", { spacingAfter: 200 }),

        h1("Section 1: Corporate Information and Staff Qualifications"),
        h2("1.1 Company Overview"),
        p(
          "Apps on Demand LLC is an artificial intelligence and public safety technology company (Wyoming LLC), authorized to conduct business in New York, doing business as NexCort iQ. Principal technology operations run on Amazon Web Services in US-East-1 (app.rapidcortex.us; marketing at www.nexcortiq.us).",
        ),
        p(
          "NexCort iQ serves 911/PSAP dispatch centers, campuses, venues, hospitals, transit, and non-emergency Call Assist — always as a force multiplier that does not replace CAD, telephony, dispatchers, or medical direction.",
        ),
        twoCol([
          ["Legal Entity", "Apps on Demand LLC (Wyoming LLC) d/b/a NexCort iQ"],
          ["Primary Platform", "NexCort iQ Venue (production)"],
          ["Operations Console", "https://app.rapidcortex.us"],
          ["Marketing Site", "https://www.nexcortiq.us"],
          ["Contact", "Dr. Jeffrey W. Coleman Jr., Founder & CEO"],
          ["Email", "jwcoleman@nexcortiq.us"],
          ["Phone", "(404) 520-1747"],
          ["Primary AWS Region", "US-East-1 (multi-AZ)"],
          ["NY Authorized Agent", "[TO BE DESIGNATED PRIOR TO SUBMISSION]"],
        ]),

        h2("1.2 Platform Description — As Deployed in Production"),
        p(
          "NexCort iQ Venue is a cloud-native venue safety and incident coordination product. The following surfaces are live in the production application today:",
        ),
        h3("Guest Intake (QR / SMS / NFC)"),
        p(
          "Guests scan a zone/section QR code, tap NFC where provisioned, or text a venue code to the NexCort iQ safety SMS channel. Reports create tracked incidents with location, message, and optional media — no guest app download. Guest Services roles see a non-911 guest-assist workflow clearly labeled as not a 911 emergency dispatch system.",
        ),
        h3("Venue Staff Consoles (role-isolated)"),
        bullet("VENUE_ADMIN — Dashboard, incidents, guest reports, staff, cameras, Rapid Vision, video wall, QR codes, zones/sections, alerts, settings"),
        bullet("VENUE_SUPERVISOR — Live ops, incidents, guest reports, cameras, Rapid Vision, video wall, QR/zones oversight"),
        bullet("VENUE_SECURITY — Field/ops: incidents, guest reports, cameras, Rapid Vision, video wall, zones"),
        bullet("VENUE_OPERATOR — Operational console for assigned venue workflows including QR management where granted"),
        bullet("VENUE_GUEST_SERVICES — Guest-assist surfaces only (not a 911 dispatch console)"),
        h3("Rapid Vision — Optional Camera AI"),
        p(
          "Rapid Vision provides AI-assisted observations and live transcript/context from integrated video sessions for authorized venue roles. It is an optional intelligence layer on the venue console (vision-ai / cameras). It does not replace the Center's CCTV matrix or automatically place 911 calls.",
        ),
        h3("Consent-Based Camera Connect"),
        p(
          "Production supports Nest SDM and Wyze Connect consent enrollment flows. Other camera stacks are scoped per contract. Camera context attaches to the SOC incident card when configured.",
        ),

        h2("1.3 Key Personnel"),
        p("Dr. Jeffrey W. Coleman Jr. — Founder & Chief Executive Officer", { bold: true }),
        p(
          "Architect of the NexCort iQ platform and principal engineer across product, AWS architecture, real-time communications, AI intake, RBAC, and venue multimodal reporting. Holds a doctoral degree with applied research focus on real-time public safety systems.",
        ),
        p("Cloud Architecture (production stack)", { bold: true, spacingBefore: 160 }),
        p(
          "AWS Lambda (Node.js), API Gateway HTTP APIs, DynamoDB, Amazon Cognito, Amazon Lex V2, Amazon Bedrock, Amazon Rekognition, Kinesis Video Streams / WebRTC, CloudFront, S3, SES/SNS/End User Messaging (SMS), ECS/Fargate for Next.js SSR, SAM/CloudFormation nested stacks, WAF, CloudWatch. Multi-AZ deployment in us-east-1.",
        ),
        p("Security and Compliance", { bold: true, spacingBefore: 160 }),
        p(
          "CJIS-aware design: agency-scoped data access, audit events for meaningful state changes, encryption at rest (KMS) and in transit (TLS). SOC 2 Type II documentation corpus completed; formal CPA audit engagement in progress (target certification Q1 2027).",
        ),

        h1("Section 2: References"),
        p(
          "Apps on Demand LLC d/b/a NexCort iQ is a new and emerging technology company. NexCort iQ Venue is a production cloud platform on Amazon Web Services; we are building our first Anchor Venue Partner reference and disclose that transparently.",
        ),
        h2("2.1 Government Procurement Validation"),
        p(
          "As a new and emerging technology provider, we are actively engaging public-sector procurement. We submitted a qualified proposal to the Kansas City, Missouri Police Department (RFP 2026-0010) for AI-powered non-emergency call handling. Contact available upon request, subject to procurement lobbying constraints.",
        ),
        h2("2.2 Technology Platform References"),
        p(
          "Amazon Web Services — production infrastructure partner. Platform validated against Well-Architected practices (security, reliability, performance, cost, operations).",
        ),
        bullet("Load/wave testing documented through 200+ concurrent connections"),
        bullet("API P95 targets under 100ms at tested concurrency"),
        bullet("Production custom domains: app.rapidcortex.us (ops), www.nexcortiq.us (marketing), api.rapidcortex.us (API)"),
        h2("2.3 Pilot Offer as Risk Mitigation"),
        p(
          "Qualified venues may evaluate NexCort iQ Venue through a Free 60-Day Pilot (QR reporting, SMS reporting, venue dashboard, limited zones/users, analytics, training, and onboarding). If NYCCOC proceeds to a full contract after a paid configuration engagement, mutually agreed pilot fees (if any) are credited against implementation as specified in Section 4.",
        ),

        h1("Section 3: Proposed Solution"),
        h2("3.1 Solution Summary"),
        p(
          "We propose to deploy production NexCort iQ Venue as the Javits Center Digital Incident Reporting Solution. The platform covers the RFP scope — customized incident reporting, mobile/responsive field reporting, evidence attachments, case management, notifications, dashboards, and APIs — and extends it with the guest intake channels already reflected in Javits safety signage (QR, SMS, NFC).",
        ),
        p(
          "Important product boundary (production policy): NexCort iQ is not a 911 emergency dispatch system, does not provide medical direction, and does not replace radios, CCTV control rooms, or CAD. Human decision remains in the loop for emergency escalation.",
        ),

        h2("3.2 Core Capability Mapping"),
        mapTable([
          [
            "Customized incident reports",
            "Venue-configurable categories, severity, zones/sections mapped to facility layout, approval workflows, and auto report numbering. Admin console updates without redeploying application code for standard configuration.",
          ],
          [
            "Mobile app + responsive web portal",
            "Production Next.js progressive web app at app.rapidcortex.us — no app-store requirement for staff. Create/update incidents, attach photos/video, capture witness notes, submit for supervisory review. Native iOS/Android wrappers available where licensed.",
          ],
          [
            "Evidence management",
            "S3-backed attachments with KMS encryption. Metadata on ingest. Access audited. Retention configurable per Center policy. Supports common image/video/document types used in venue ops.",
          ],
          [
            "Case management",
            "Create → assign → update → escalate → close workflows with role isolation (Admin / Supervisor / Security / Operator). Time-stamped application audit events for meaningful state changes. Related-incident linking and supervisor review paths.",
          ],
          [
            "Automated notifications",
            "Configurable occupant alerts / ENS test program features (feature-flagged). Email/SMS pathways via SES and AWS End User Messaging. Role-based distribution. Secure viewing for authorized parties.",
          ],
          [
            "Dashboards and reports",
            "Live venue dashboard: open incidents, guest reports, cameras, zones. Filters and exports for operational review. Event/zone tagging for post-event packages when event calendar data is imported.",
          ],
          [
            "Documented APIs",
            "HTTPS REST APIs on AWS API Gateway with JWT (Cognito) for staff surfaces. OpenAPI documentation for partner scopes. Scheduled imports for roster/event data in Phase 1. Export of reports and metadata in common formats.",
          ],
          [
            "Admin configurability",
            "Venue Admin settings for QR codes, zones/sections, staff, cameras, SMS numbers, and operational preferences without engineering for routine changes.",
          ],
        ]),

        h2("3.3 Guest-Facing Intake — QR / SMS / NFC (Production)"),
        p(
          "When a guest scans a QR code posted at a Javits zone or section, NexCort iQ opens a mobile browser intake bound to that location, creates a tracked guest report/incident, and notifies the venue security dashboard with location and media.",
        ),
        p(
          "When a guest texts the venue code / keyword to the configured safety SMS number, NexCort iQ parses venue and location context and routes the report into the same incident system officers use. Conversational follow-up can request additional detail and photos. Classification assists staff; it does not auto-dispatch 911.",
        ),
        p(
          "NFC taps, where provisioned on Center signage, follow the same location-bound intake path as QR. No download. No account creation for the guest.",
        ),

        h2("3.4 Incident Taxonomy — Javits Center Configuration"),
        p("Pre-configured and fully customizable by Center administrators:"),
        bullet("Security — Access Control — Unauthorized access, credential issue, perimeter breach"),
        bullet("Security — Suspicious Activity — Unattended items, suspicious behavior, surveillance concern"),
        bullet("Security — Crowd / Event — Crowd control, line issue, event disruption"),
        bullet("Medical Assistance — Injury, illness, AED needed, EMS requested (human escalation)"),
        bullet("Fire / Life Safety — Fire alarm, smoke, evacuation, sprinkler activation"),
        bullet("Theft / Property Crime — Theft, vandalism, property damage"),
        bullet("Guest Assist — Lost property, accessibility assistance, wayfinding"),
        bullet("Maintenance / Facilities — Spill, equipment failure, infrastructure hazard"),
        bullet("External Threat — Threat call, written threat, bomb threat protocol"),
        bullet("Active Emergency — Officer/supervisor upgrade for emergency communications coordination (human decision; not automatic 911)"),

        h2("3.5 Technology Architecture (Production)"),
        bullet("Compute: AWS Lambda (TypeScript/Node) and Amazon ECS Fargate for Next.js SSR web"),
        bullet("Data: Amazon DynamoDB (primary multi-tenant store), Amazon S3 (media/evidence)"),
        bullet("AI/ML: Amazon Lex V2, Amazon Bedrock, Amazon Rekognition; Rapid Vision sessions via KVS WebRTC"),
        bullet("Auth: Amazon Cognito JWT with role and agency claims; venue roles isolated from PSAP/dispatch consoles"),
        bullet("Messaging: AWS End User Messaging (SMS), Amazon SES, Amazon SNS"),
        bullet("Infrastructure: CloudFormation nested SAM stacks, CloudFront, Route53, ACM, WAF"),
        bullet("Security: KMS at rest, TLS in transit, agency-scoped data access on every database read/write, audit events for state changes"),
        p(
          "Live operations run on the production AWS account serving app.rapidcortex.us. Engineering staging remains fully isolated.",
          { italics: true, size: 18, color: MUTED },
        ),

        h2("3.6 Integration Plan"),
        p("Phase 1 (included):", { bold: true }),
        bullet("Employee / staff roster — scheduled import for provisioning and assignment"),
        bullet("Event calendar — scheduled import of shows, halls, attendance estimates for event-tagged reporting"),
        p("Phase 2 (scoped during term):", { bold: true }),
        bullet("Access control event feed (badge reads, door alarms)"),
        bullet("Enterprise VMS camera index for incident-linked clip attachment (beyond Nest/Wyze Connect)"),
        bullet("Expanded notification gateway integrations"),

        h2("3.7 Implementation Plan"),
        twoCol([
          ["Week 1–2", "Venue tenant configuration: taxonomy, zones/sections, QR/NFC map, roles, workflows, notification rules"],
          ["Week 3", "Staff roster + event calendar imports configured and validated"],
          ["Week 4", "UAT with Javits Security — mobile/web walkthrough"],
          ["Week 5", "Training: Security (field), Supervisor, Admin — digital materials"],
          ["Week 6", "Go-live with parallel operation; 24/7 on-call for first two weeks"],
          ["Ongoing", "Monthly check-in; quarterly updates; annual configuration review"],
        ]),

        h2("3.8 Security and Compliance"),
        bullet("SOC 2 Type II: documentation corpus complete; CPA audit in progress; target Q1 2027"),
        bullet("Encryption: AES-256/KMS at rest; TLS in transit; sensitive fields protected"),
        bullet("Access Control: RBAC least privilege; MFA for administrative accounts"),
        bullet("Audit: application AuditRepository events + CloudTrail for AWS API activity"),
        bullet("Retention: configurable; evidence deletion with human approval gate"),
        bullet("Incident Response: notify NYCCOC within 24 hours of confirmed breach"),
        bullet("Vulnerability management: dependency scanning; critical patches within 72 hours"),
        bullet("Business Continuity: multi-AZ us-east-1; RTO 4 hours; RPO 1 hour"),

        h2("3.9 Service Level Agreement"),
        twoCol([
          ["Platform Uptime", "99.9% monthly (excluding scheduled maintenance)"],
          ["Scheduled Maintenance", "Tuesdays 2:00–4:00 AM ET; 48-hour notice"],
          ["Critical (P1)", "1 hour ack; 4 hours remediation or workaround"],
          ["High (P2)", "4 hours ack; 8 hours remediation"],
          ["Standard (P3)", "Next business day ack; 3 business days resolution"],
          ["Support Hours", "24/7/365 for P1; business hours for P2/P3"],
          ["Dedicated Contact", "Named account manager + technical contact at execution"],
        ]),

        h1("Section 4: Financial Proposal"),
        h2("4.1 Pricing Overview"),
        p(
          "One-time implementation plus annual platform license. Prices fixed for the three-year base term. Option years 4–5 capped at ≤3% annual increase. Anchor Venue Partner net rates — no negotiation padding.",
        ),
        h2("4.2 One-Time Costs (Implementation)"),
        moneyTable(
          ["Line Item", "Type", "Cost"],
          [
            ["Platform configuration (taxonomy, zones, roles, workflows)", "One-Time", "$8,000"],
            ["Staff API integrations (roster + event calendar)", "One-Time", "$7,500"],
            ["Guest intake setup (QR / SMS / NFC)", "One-Time", "$5,000"],
            ["UAT coordination and sign-off support", "One-Time", "$3,500"],
            ["Onboarding and training", "One-Time", "$4,000"],
            ["Go-live support and 30-day hypercare", "One-Time", "$3,000"],
            ["Documentation package", "One-Time", "$2,000"],
            ["TOTAL ONE-TIME IMPLEMENTATION", "", "$33,000"],
          ],
          [7200, 1800, 1800],
        ),
        h2("4.3 Annual Recurring Costs"),
        moneyTable(
          ["Line Item", "Type", "Annual Cost"],
          [
            ["NexCort iQ Venue — staff consoles (unlimited named venue staff users)", "Annual", "$28,800"],
            ["Guest multimodal intake (QR / SMS / NFC)", "Annual", "$9,600"],
            ["Rapid Vision — Camera AI (up to 20 feeds) — starting tier", "Annual", "$7,200"],
            ["Evidence storage — up to 5TB/year (S3 + KMS)", "Annual", "$3,600"],
            ["SMS messaging — up to 5,000 guest intake messages/month", "Annual", "$2,400"],
            ["Platform support — 24/7 P1, business hours P2/P3", "Annual", "$6,000"],
            ["TOTAL ANNUAL RECURRING", "", "$57,600"],
          ],
          [7200, 1800, 1800],
        ),
        p(
          "Note: Rapid Vision at 20 feeds is a starting tier sized for pilot and high-priority zones. For a ~1.2 million sq ft venue with hundreds of cameras across halls, expansion wing, docks, and perimeter, extended feed tiers are offered in Section 4.7.",
          { italics: true, size: 18, color: MUTED, spacingAfter: 160 },
        ),
        h2("4.4 Three-Year Contract Total"),
        moneyTable(
          ["Period", "Type", "Cost"],
          [
            ["Implementation (one-time)", "One-Time", "$33,000"],
            ["Year 1 Annual License + Support", "Recurring", "$57,600"],
            ["Year 2 Annual License + Support", "Recurring", "$57,600"],
            ["Year 3 Annual License + Support", "Recurring", "$57,600"],
            ["3-Year Total Contract Value", "", "$205,800"],
            ["Option Year 4 (≤3% increase)", "Recurring", "$59,328"],
            ["Option Year 5 (≤3% from Y4)", "Recurring", "$61,008"],
            ["5-Year Maximum Total Contract Value", "", "$326,136"],
          ],
          [7200, 1800, 1800],
        ),
        h2("4.5 Pilot Option"),
        p(
          "Free 60-Day Pilot available for qualified venues (QR/SMS, dashboard, limited zones/users, training). If NYCCOC elects a paid pre-production configuration engagement before full contract, mutually agreed fees are credited against the $33,000 implementation total upon award.",
        ),
        h2("4.6 MWBE / SDVOB Participation"),
        p(
          "NYCCOC goals: 15% MBE, 15% WBE, 6% SDVOB. Apps on Demand LLC is actively pursuing New York State MWBE/SDVOB certification. Status at submission: [Application status to be confirmed]. Good-faith MWBE subcontractor efforts will be documented if subcontractors are engaged.",
        ),

        h2("4.7 Optional Add-Ons — Prioritized for Javits"),
        p(
          "The base proposal includes Rapid Vision for up to 20 camera feeds ($7,200/year). The add-ons below are optional, sold separately, and ordered by expected value for a large multi-hall convention center (140+ events and ~1.2 million visitors annually).",
        ),

        h3("Tier 1 — High Value, Strong Fit"),
        p("Rapid Vision Extended", { bold: true }),
        p(
          "Expand Camera AI beyond the 20-feed starting tier so Rapid Vision covers priority halls, expansion wing, loading docks, perimeter, and rooftop — not just a sample set. At each feed: real-time scene observation to the Supervisor dashboard, incident-triggered camera bring-up, scene-change detection, and AI summaries attached to incident records. Does not replace the Center CCTV matrix or auto-place 911 calls.",
        ),
        moneyTable(
          ["Coverage Tier", "Add-On Annual Cost"],
          [
            ["Up to 50 feeds", "+$9,600/yr"],
            ["Up to 100 feeds", "+$21,600/yr"],
            ["Unlimited feeds (contracted facility scope)", "+$36,000/yr"],
          ],
          [7200, 3600],
        ),
        p("RC Translate", { bold: true, spacingBefore: 160 }),
        p(
          "Real-time bilingual assistance for international trade shows, medical conferences, and foreign delegations. Officer speaks English; guest hears their language; reply returns in English; English transcript writes into the incident record. 75+ languages. Especially valuable for medical assist and suspicious-activity interviews where precision matters. Production venue console includes Translate for Admin, Supervisor, Security, and Operator roles.",
        ),
        p("Add-on: $12,000/year", { bold: true }),
        p("Call Assist for (212) 216-2000", { bold: true, spacingBefore: 160 }),
        p(
          "AI first-line for the Center’s published non-emergency security line. Handles routine calls (lost property, accessibility, wayfinding, event timing), creates service requests, and transfers to a live officer when needed. Call Assist is a non-emergency product vertical — not a 911 dispatcher console. Estimated 40–60% reduction in routine call load on security staff during peak event days.",
        ),
        p("Add-on: $18,000/year", { bold: true }),

        h3("Tier 2 — Operational Depth"),
        p("PTZ Camera Control", { bold: true }),
        p(
          "Remote pan/tilt/zoom of Center PTZ cameras from the Supervisor dashboard when an incident is open — without switching to a separate VMS. Role-gated (Supervisor and above); every PTZ action logged to the incident audit trail. Requires compatible camera/VMS integration scoped in Phase 2.",
        ),
        p("Add-on: $6,000/year", { bold: true }),
        p("Guest Live Video", { bold: true, spacingBefore: 160 }),
        p(
          "When a guest SMS/QR report indicates an escalating situation, NexCort iQ can send a secure browser link that opens a live video session — no app, no account. The Supervisor receives the feed in the venue console tied to the open incident. High value for person-down, suspicious package, or altercation reports where a guest is first on scene. Built on the production live-video / KVS WebRTC path.",
        ),
        p("Add-on: $9,600/year", { bold: true }),
        p("Mass Alert Broadcast (Occupant Alerts)", { bold: true, spacingBefore: 160 }),
        p(
          "Zone-based outbound text and email alerts to exhibitors, event staff, and registered attendees (Hall A, Hall B, docks, perimeter). Supervisors push “all clear” or reroute messages from the same venue console already in use. Maps to production Occupant Alerts / ENS test capabilities for venue Admin and Supervisor.",
        ),
        p("Add-on: $7,200/year", { bold: true }),

        h3("Tier 3 — Reporting and Integration"),
        p("Event Intelligence Package", { bold: true }),
        p(
          "Branded post-event safety summary within 24 hours of event close: incident counts by category, response-time averages, zone heat map, medical assist log, and trend comparison vs. prior similar events. Delivered as PDF for show managers and Center leadership.",
        ),
        p("Add-on: $4,800/year", { bold: true }),
        p("Additional API Integrations", { bold: true, spacingBefore: 160 }),
        p(
          "Beyond base roster and event-calendar imports: access-control feed (badge/door alarms correlated to open incidents), enterprise VMS camera index (attach clips without memorizing camera IDs), and building-management signals (elevator/HVAC context by location).",
        ),
        p("Add-on: $7,500 one-time per integration", { bold: true }),

        h3("Illustrative Full Deployment (optional)"),
        p(
          "If NYCCOC elects the core proposal plus the highest-fit add-ons for Javits scale:",
        ),
        moneyTable(
          ["Component", "Annual"],
          [
            ["Core proposal (Venue + QR/SMS/NFC + Rapid Vision 20 feeds + Support)", "$57,600"],
            ["Rapid Vision Extended (100 feeds)", "$21,600"],
            ["RC Translate", "$12,000"],
            ["Call Assist", "$18,000"],
            ["PTZ Control", "$6,000"],
            ["Guest Live Video", "$9,600"],
            ["Mass Alert Broadcast", "$7,200"],
            ["Event Intelligence Package", "$4,800"],
            ["FULL PLATFORM ANNUAL (illustrative)", "$136,800"],
          ],
          [7200, 3600],
        ),
        p(
          "Implementation one-time ($33,000) and per-integration API fees ($7,500 each) are additive when selected. Add-ons may be phased — e.g., Rapid Vision Extended + RC Translate in Year 1; Call Assist and Mass Alert after UAT of the published security line and subscriber lists.",
          { spacingBefore: 120 },
        ),

        h1("Appendix A: Vendor Risk Management Documentation"),
        twoCol([
          ["Information Security Policy", "Available — ISP corpus including access control, IR, patching, retention, encryption"],
          ["Privacy Policy", "Available — https://www.nexcortiq.us/privacy"],
          ["SOC 2 Documentation", "Available under NDA — Type II corpus complete; audit in progress; target Q1 2027"],
          ["Financial Statements", "Management-prepared; AWS billing history available as operational evidence"],
          ["Business Continuity / DR", "Multi-AZ AWS; RTO 4h; RPO 1h; runbooks"],
          ["Incident Response Plan", "24-hour notification commitment; escalation procedures"],
          ["Background Checks", "Policy and process documentation available"],
          ["Insurance Certificate", "See note below — certificates within LOI timelines"],
          ["SLAs", "Section 3.9 — available for contract annexation"],
          ["References", "Section 2 — additional references upon request"],
        ]),
        p(
          "Insurance Note: Apps on Demand LLC is obtaining the $10,000,000 Cyber Liability coverage in RFP Appendix B. CGL ($1M/$2M), E&O ($1M), and Business Auto will be bound within 3 business days of LOI; Cyber at $10M within 10 business days of LOI. Certificates will name NYCCOC, the State of New York, NYCCOD, Empire State Development, and TBTA as additional insureds per RFP requirements.",
          { spacingBefore: 160 },
        ),

        h1("Appendix B: Required Forms"),
        p("The following required forms are attached as separately executed documents:"),
        bullet("Affirmation of Understanding and Compliance with Procurement Lobbying Law — [EXECUTED AND ATTACHED]"),
        bullet("Offeror/Bidder Disclosure of Prior Non-Responsibility Determination — [EXECUTED AND ATTACHED — All responses: NO]"),
        bullet("Proposer's Signature and Certificate of Authority Form — [EXECUTED AND ATTACHED]"),
        bullet("Authorized Agent Form — [EXECUTED AND ATTACHED]"),
        bullet("EO 177 Certification — [EXECUTED AND ATTACHED]"),
        bullet("Addenda Acknowledgement — [EXECUTED AND ATTACHED — No addenda received as of submission date]"),
        bullet("Minority and Woman-Owned Business Information — [EXECUTED AND ATTACHED]"),
        p(
          "Note: Each form is signed by Dr. Jeffrey W. Coleman Jr. as authorized officer. The Authorized Agent Form designates [NAME TO BE INSERTED] of [NY ADDRESS TO BE INSERTED] as New York State agent.",
          { spacingBefore: 120 },
        ),

        h1("Signature and Certification"),
        p(
          "The undersigned certifies that all information in this proposal is complete, true, and accurate, and that the undersigned is fully authorized to submit this proposal on behalf of Apps on Demand LLC d/b/a NexCort iQ.",
        ),
        p("_____________________________________________", { spacingBefore: 400, spacingAfter: 40 }),
        p("Dr. Jeffrey W. Coleman Jr.", { bold: true, spacingAfter: 20 }),
        p("Founder and Chief Executive Officer", { spacingAfter: 20 }),
        p("Apps on Demand LLC d/b/a NexCort iQ", { spacingAfter: 20 }),
        p("Date: October 14, 2026"),
      ],
    },
  ],
});

const out = "/Users/jeffcoleman/Downloads/NexCortiQ_Javits_Proposal_RFP2396IP.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, buf.length);
});
