/**
 * Grant narrative assembled from the application the user entered.
 * Used when the writing model is unavailable so a demonstration still downloads a complete package.
 * The document must say it was built from the profile, not from a model.
 */

export type GrantNarrativeSections = {
  executiveSummary: string;
  statementOfNeed: string;
  projectDescription: string;
  goalsAndObjectives: string[];
  implementationTimeline: string[];
  evaluationPlan: string;
  organizationalCapacity: string;
  budgetNarrative: string;
  sustainabilityPlan: string;
  conclusion: string;
};

/** Minimum usable length for prose sections — shorter model output is replaced by the profile draft. */
export const GRANT_NARRATIVE_MIN_CHARS = {
  executiveSummary: 450,
  statementOfNeed: 550,
  projectDescription: 650,
  evaluationPlan: 400,
  organizationalCapacity: 400,
  budgetNarrative: 350,
  sustainabilityPlan: 280,
  conclusion: 220,
} as const;

export const GRANT_NARRATIVE_MIN_BULLETS = {
  goalsAndObjectives: 5,
  implementationTimeline: 5,
} as const;

function text(form: Record<string, unknown>, key: string, fallback: string): string {
  const value = form[key];
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || fallback;
}

function modulesOf(form: Record<string, unknown>): string[] {
  if (!Array.isArray(form.rcModules)) return [];
  return form.rcModules.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

const MODULE_DETAIL: Record<string, string> = {
  "AI Dispatch Transcription":
    "AI Dispatch Transcription produces a near-real-time written record of the call so supervisors can review exact language instead of reconstructing events from memory.",
  "Supervisor Intelligence Dashboard":
    "The Supervisor Intelligence Dashboard gives command staff live visibility into workload, open calls, and quality indicators without sitting beside every console.",
  "QA & Coaching Automation":
    "QA & Coaching Automation helps supervisors sample calls, score protocol adherence, and coach with specific examples rather than general reminders.",
  "Incident Command":
    "Incident Command tools organize multi-agency coordination details in one place while leaving dispatch authority with the people who hold it today.",
  "Silent Text / Caller Media":
    "Silent Text / Caller Media lets the center exchange text and media with a caller when voice is unsafe or impractical, with a clear path to transfer to 911 when needed.",
  "CAD Integration":
    "CAD Integration places NexCort iQ beside the agency's computer-aided dispatch workflow; CAD remains the system of record for unit status and incident numbers.",
  "Live Camera Integration":
    "Live Camera Integration (where authorized) gives the communications center visual context for a scene without replacing field command or investigator judgment.",
  "Multi-Language Translation":
    "Multi-Language Translation supports callers who are not comfortable in English so location, nature, and callback details are captured more accurately.",
  "Post-Incident Review":
    "Post-Incident Review packages transcripts and notes for after-action work so the agency can improve training without inventing outcome statistics.",
  "Analytics & Reporting":
    "Analytics & Reporting summarizes call activity and review completion for leadership and grant reporting using measures the agency can actually verify.",
};

function moduleDetailParagraphs(modules: string[]): string[] {
  if (modules.length === 0) {
    return [
      "The project includes the NexCort iQ core platform: real-time transcription, supervisor visibility, quality review, and multi-language support configured for this agency's roles.",
    ];
  }
  const known = modules
    .map((name) => MODULE_DETAIL[name] ?? `${name} is included in the configured deployment for this agency.`)
    .slice(0, 8);
  return [
    `Selected product modules for this project: ${modules.join("; ")}.`,
    ...known,
  ];
}

function preferLonger(primary: string, fallback: string, minChars: number): string {
  const a = primary.trim();
  const b = fallback.trim();
  if (!a) return b;
  if (a.length >= minChars) return a;
  return b.length > a.length ? b : a;
}

function preferRicherList(primary: string[], fallback: string[], minItems: number): string[] {
  if (primary.length >= minItems) return primary;
  if (primary.length === 0) return fallback;
  return fallback.length > primary.length ? fallback : primary;
}

/** Complete narrative from the wizard fields. Does not invent call volumes or crime statistics. */
export function buildProfileGrantNarrative(form: Record<string, unknown>): GrantNarrativeSections {
  const agency = text(form, "agencyName", "the applicant agency");
  const agencyType = text(form, "agencyType", "public safety agency");
  const place = [form.agencyCity, form.agencyState]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
  const location = place || "its service area";
  const population = text(form, "agencyPopulation", "the community it serves");
  const grant = text(form, "grantName", "this grant program");
  const funder = text(form, "fundingAgency", "the funding agency");
  const grantNumber = text(form, "grantNumber", "");
  const amount = text(form, "requestedAmount", "the requested award");
  const period = text(form, "projectPeriod", "the project period");
  const deadline = text(form, "deadline", "");
  const title = text(form, "projectTitle", "NexCort iQ public safety intelligence");
  const problem = text(
    form,
    "problemStatement",
    "Call volume, staffing limits, and aging tools make it harder to keep every call accurate and reviewable.",
  );
  const project = text(
    form,
    "projectDescription",
    "Deploy NexCort iQ as decision support for communications staff. It does not replace the CAD system, dispatchers, or medical direction.",
  );
  const staffing = text(form, "staffingChallenge", "hiring and retaining trained communications staff");
  const existing = text(form, "existingTechnology", "the agency's current CAD and phone system");
  const additional = text(form, "additionalContext", "");
  const modules = modulesOf(form);
  const contact = text(form, "contactName", "the project contact");
  const contactTitle = text(form, "contactTitle", "project lead");
  const contactEmail = text(form, "contactEmail", "");
  const solicitation =
    grantNumber.length > 0 ? ` Solicitation / opportunity number: ${grantNumber}.` : "";
  const deadlineSentence =
    deadline.length > 0 ? ` The application deadline reflected in this package is ${deadline}.` : "";
  const contactLine = contactEmail
    ? `${contact}, ${contactTitle} (${contactEmail}), will be the day-to-day contact for implementation and for this application.`
    : `${contact}, ${contactTitle}, will be the day-to-day contact for implementation and for this application.`;

  return {
    executiveSummary: [
      `${agency}, a ${agencyType} serving ${location}, requests ${amount} under ${grant} to implement ${title}.${solicitation}${deadlineSentence}`,
      `The service population associated with this application is ${population}. The requested project period is ${period}. Funding agency: ${funder}.`,
      project,
      `NexCort iQ is public safety intelligence that assists communications staff — it does not replace CAD systems, dispatchers, responders, or medical direction. The platform adds real-time transcription, translation where configured, quality review, supervisor visibility, and post-incident reporting beside the tools the center already uses.`,
      `Dispatchers and call-takers remain responsible for every call decision. Emergency transfer to 911 cannot be suppressed by configuration. This package uses only facts the agency entered; it does not invent crime rates, response-time savings, or awards.`,
    ].join("\n\n"),

    statementOfNeed: [
      problem,
      `${agency} serves ${population} from ${location}. Communications staff must capture location, nature, callback, and safety details accurately while managing ${staffing}. Errors or incomplete notes create coaching gaps and make it harder to demonstrate performance to leadership and funders.`,
      `Today the center relies on ${existing}. Quality review often depends on memory, partial notes, or sparse recordings metadata. Supervisors spend disproportionate time reconstructing what happened on a call instead of coaching to a complete record.`,
      `Without a consistent, reviewable call record and role-appropriate supervisor tools, ${agency} cannot modernize QA, language access, or reporting at the pace the community expects — and cannot do so by replacing a CAD system mid-cycle.`,
      `Award funding from ${funder} under ${grant} would close that gap: place NexCort iQ beside existing telephony and CAD, train staff, and measure review completion with metrics the agency can verify.${additional ? `\n\nAdditional agency context provided for this application:\n${additional}` : ""}`,
    ].join("\n\n"),

    projectDescription: [
      project,
      ...moduleDetailParagraphs(modules),
      `Implementation approach during ${period}: (1) confirm agency profile, roles, and connection points to phone/CAD; (2) configure product modules for the roles that need them; (3) train supervisors and call-takers with practice traffic; (4) move to daily operations with sampled QA; (5) report progress to ${funder} using the evaluation measures in this package.`,
      `Role isolation is intentional. A call-taker sees the live call workspace. A supervisor sees quality, workload, and coaching tools. An administrator configures users and agency settings. No role receives another role's console. CAD write-back, when ever enabled for an agency, remains fail-closed and requires human review — it is not assumed in this narrative.`,
      `Safety and compliance posture: NexCort iQ is hosted on Amazon Web Services with per-agency data isolation and administrative audit trails. The product assists — never replaces — CAD, telephony, dispatchers, or medical direction. Emergency transfer to 911 remains immutable.`,
      `Change management: ${contact} (${contactTitle}) will coordinate scheduling, user provisioning, and funder reporting. Training materials stay with the agency so knowledge does not leave with a single employee.`,
    ].join("\n\n"),

    goalsAndObjectives: [
      `Objective 1 — Call record completeness: Produce a usable written record for eligible communications traffic so supervisors at ${agency} can review caller language, location capture, and disposition notes without reconstructing the call from memory.`,
      "Objective 2 — Supervisor efficiency: Reduce the time supervisors spend piecing together incomplete notes before coaching or after-action review.",
      "Objective 3 — Coaching quality: Support protocol coaching with specific call examples and review scores rather than general reminders.",
      "Objective 4 — Language access: Where Multi-Language Translation is configured, improve capture of location and nature details for callers who are not comfortable in English.",
      "Objective 5 — Reporting readiness: Produce verifiable activity and review-completion measures suitable for leadership and grant progress reports.",
      "Objective 6 — Authority preserved: Keep CAD, dispatch authority, medical direction, and emergency 911 transfer with the people and systems that hold them today — NexCort iQ remains decision support only.",
    ],

    implementationTimeline: [
      `Month 1 — Kickoff & readiness: Confirm ${agency} profile, users/roles, ${existing} connection points, success criteria, and the reporting calendar for ${funder}.`,
      "Months 1–2 — Configure & integrate: Stand up agency tenancy on AWS, map modules to roles, validate phone/CAD adjacency, and verify emergency 911 transfer cannot be disabled.",
      "Months 2–3 — Train & pilot: Train supervisors and call-takers; run supervised practice and limited live traffic; collect early QA samples and fix configuration gaps.",
      "Months 3–6 — Operate & coach: Expand to daily use; supervisors complete scheduled quality samples; refine coaching playbooks from real call examples.",
      `Months 6–12 (and through ${period} as applicable): Stabilize operations, complete progress reports to ${funder}, and adjust staffing/training where reviews show recurring gaps.`,
      "Closeout: Archive grant evidence (training logs, review samples, configuration notes) and confirm the sustainability path for continued licensing after the award period.",
    ],

    evaluationPlan: [
      `${agency} will evaluate the project with measures it can verify from platform activity and supervisor workflow — not with invented crime or response-time claims.`,
      "Primary indicators: (a) share of eligible calls with a usable transcript or written record; (b) supervisor review/QA sample completion against the agency's target cadence; (c) time-to-locate a prior call for coaching or complaint follow-up; (d) training completion for assigned roles; (e) open configuration or integration issues closed within the reporting period.",
      "Data sources: NexCort iQ audit and activity logs, supervisor QA worksheets, training attendance records, and the agency's existing CAD/phone systems of record for operational facts the platform does not own.",
      `${contact}, ${contactTitle}, owns the evaluation calendar, evidence package, and narrative progress reports required by ${funder}. Findings will be used to adjust training and configuration — not to claim outcomes the agency has not measured.`,
    ].join("\n\n"),

    organizationalCapacity: [
      `${agency} is a ${agencyType} operating communications services for ${location} and already maintains ${existing}. The center supports a service population described as ${population}.`,
      "Technical capacity: NexCort iQ runs on Amazon Web Services with tenant isolation, encryption in transit and at rest as configured for the deployment, and administrative audit logging. The agency continues to own CAD entries, radio, and telephony contracts.",
      "Operational capacity: Supervisors remain responsible for call handling standards and coaching. Dispatchers and call-takers retain decision authority on every call. The project does not create a shadow CAD or replace medical direction.",
      contactLine,
      `Fiscal and grant administration: ${agency} will align this request with ${funder} budget forms for ${grant}${grantNumber ? ` (${grantNumber})` : ""} and will retain documentation for audit.`,
    ].join("\n\n"),

    budgetNarrative: [
      `${agency} requests ${amount} to implement ${title} over ${period} under ${grant}.`,
      "Allowable use of funds contemplated in this narrative: NexCort iQ subscription for the roles and modules listed in the application; implementation and configuration support; initial training for communications supervisors and call-takers; and project management needed to meet funder reporting.",
      "The request does not replace the agency's CAD license, radio system, or core telephony contracts. Those systems remain separately funded operating costs.",
      modules.length
        ? `Module scope reflected in this budget narrative: ${modules.join("; ")}. Final line-item schedules should match the funder's required budget forms and any cost-share rules.`
        : "Final line-item schedules should match the funder's required budget forms and any cost-share rules.",
      "Figures in this narrative match the amount entered in the Grant Success Program wizard and must be verified against official quotes and the solicitation's budget instructions before submission.",
    ].join("\n\n"),

    sustainabilityPlan: [
      `After the award period, ${agency} intends to continue NexCort iQ as an operating expense of the communications center — alongside CAD, phone, and training budgets it already maintains.`,
      "Knowledge sustainability: agency-owned training materials, role-based playbooks, and supervisor QA cadence keep the practice in place if staff turn over.",
      "Technical sustainability: cloud hosting, vendor support pathways, and the agency's IT/communications leadership retain responsibility for access control and configuration changes.",
      `Reporting sustainability: the same evaluation indicators used for ${funder} during the grant period can continue as internal management metrics after closeout.`,
    ].join("\n\n"),

    conclusion: [
      `${agency} respectfully requests ${amount} from ${funder} under ${grant} to field ${title} for ${period}.`,
      `The project addresses documented operational need — ${staffing}; dependence on ${existing}; and the requirement for reviewable call records — while preserving dispatcher authority and emergency 911 transfer.`,
      "NexCort iQ supports the people who answer the calls. It does not take their place. The agency will review every section of this package for accuracy before submission.",
    ].join("\n\n"),
  };
}

/**
 * Fill empty sections from the profile draft, and replace thin model output
 * so the downloaded package stays substantive even when a provider truncates.
 */
export function fillEmptyGrantNarrative(
  sections: GrantNarrativeSections,
  form: Record<string, unknown>,
): GrantNarrativeSections {
  const draft = buildProfileGrantNarrative(form);
  return {
    executiveSummary: preferLonger(
      sections.executiveSummary,
      draft.executiveSummary,
      GRANT_NARRATIVE_MIN_CHARS.executiveSummary,
    ),
    statementOfNeed: preferLonger(
      sections.statementOfNeed,
      draft.statementOfNeed,
      GRANT_NARRATIVE_MIN_CHARS.statementOfNeed,
    ),
    projectDescription: preferLonger(
      sections.projectDescription,
      draft.projectDescription,
      GRANT_NARRATIVE_MIN_CHARS.projectDescription,
    ),
    goalsAndObjectives: preferRicherList(
      sections.goalsAndObjectives,
      draft.goalsAndObjectives,
      GRANT_NARRATIVE_MIN_BULLETS.goalsAndObjectives,
    ),
    implementationTimeline: preferRicherList(
      sections.implementationTimeline,
      draft.implementationTimeline,
      GRANT_NARRATIVE_MIN_BULLETS.implementationTimeline,
    ),
    evaluationPlan: preferLonger(
      sections.evaluationPlan,
      draft.evaluationPlan,
      GRANT_NARRATIVE_MIN_CHARS.evaluationPlan,
    ),
    organizationalCapacity: preferLonger(
      sections.organizationalCapacity,
      draft.organizationalCapacity,
      GRANT_NARRATIVE_MIN_CHARS.organizationalCapacity,
    ),
    budgetNarrative: preferLonger(
      sections.budgetNarrative,
      draft.budgetNarrative,
      GRANT_NARRATIVE_MIN_CHARS.budgetNarrative,
    ),
    sustainabilityPlan: preferLonger(
      sections.sustainabilityPlan,
      draft.sustainabilityPlan,
      GRANT_NARRATIVE_MIN_CHARS.sustainabilityPlan,
    ),
    conclusion: preferLonger(sections.conclusion, draft.conclusion, GRANT_NARRATIVE_MIN_CHARS.conclusion),
  };
}
