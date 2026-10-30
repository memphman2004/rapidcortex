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

function text(form: Record<string, unknown>, key: string, fallback: string): string {
  const value = form[key];
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || fallback;
}

function modulesOf(form: Record<string, unknown>): string[] {
  if (!Array.isArray(form.rcModules)) return [];
  return form.rcModules.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/** Complete narrative from the wizard fields. Does not invent call volumes or crime statistics. */
export function buildProfileGrantNarrative(form: Record<string, unknown>): GrantNarrativeSections {
  const agency = text(form, "agencyName", "the applicant agency");
  const agencyType = text(form, "agencyType", "public safety agency");
  const place = [form.agencyCity, form.agencyState].filter((part) => typeof part === "string" && part.trim()).join(", ");
  const location = place || "its service area";
  const population = text(form, "agencyPopulation", "the community it serves");
  const grant = text(form, "grantName", "this grant program");
  const funder = text(form, "fundingAgency", "the funding agency");
  const amount = text(form, "requestedAmount", "the requested award");
  const period = text(form, "projectPeriod", "the project period");
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
  const modules = modulesOf(form);
  const moduleSentence = modules.length
    ? `The project includes ${modules.join(", ")}.`
    : "The project includes the NexCort iQ core platform.";
  const contact = text(form, "contactName", "the project contact");
  const contactTitle = text(form, "contactTitle", "project lead");

  return {
    executiveSummary: [
      `${agency}, a ${agencyType} in ${location}, requests ${amount} under ${grant} to implement ${title}.`,
      `${project}`,
      `NexCort iQ adds real-time transcription, translation, quality review, and supervisor visibility beside the systems staff already use. Dispatchers stay in control of every call. The platform does not replace computer-aided dispatch, responders, or medical direction.`,
    ].join("\n\n"),
    statementOfNeed: [
      problem,
      `${agency} serves ${population}. Staff must capture location, nature, and caller details accurately while ${staffing}.`,
      `Today the center relies on ${existing}. Review of calls depends on memory and manual notes, which slows coaching and makes it harder to show how the center performs.`,
      `Funding from ${funder} would close that gap without asking the agency to replace its CAD system.`,
    ].join("\n\n"),
    projectDescription: [
      project,
      moduleSentence,
      `During the project period (${period}), ${agency} will connect NexCort iQ to the communications workflow, train supervisors and call-takers, and confirm that emergency transfer to 911 cannot be turned off.`,
      `Each product surface stays inside the role that needs it. A call-taker sees the live call. A supervisor sees quality and workload. An administrator configures the agency. No role receives another role's console.`,
    ].join("\n\n"),
    goalsAndObjectives: [
      `Give ${agency} a written record of each non-emergency and emergency-communications call that supervisors can review.`,
      "Shorten the time a supervisor spends reconstructing a call from memory or a partial note.",
      "Support coaching with specific call examples instead of general reminders.",
      "Keep CAD, dispatch authority, and medical direction with the people who hold them today.",
    ],
    implementationTimeline: [
      "Month 1: Confirm the agency profile, users, and the phone or CAD connection the site will use.",
      "Months 2–3: Configure roles, train supervisors and call-takers, and run the workflow on live practice calls.",
      "Months 4–6: Operate the platform in daily use and review quality samples with the command staff.",
      `Through ${period}: Report progress to ${funder} and adjust training where reviews show a gap.`,
    ],
    evaluationPlan: [
      `${agency} will track whether calls have a usable transcript, whether supervisors complete reviews, and whether staff can find a call without reconstructing it by hand.`,
      `${contact}, ${contactTitle}, will own the project record and the reports this grant requires.`,
      "The evaluation will not claim response-time savings or crime reductions that the agency has not measured.",
    ].join("\n\n"),
    organizationalCapacity: [
      `${agency} operates the communications function for ${location} and already maintains ${existing}.`,
      "NexCort iQ is hosted on Amazon Web Services, keeps each agency's records separate, and records administrative access. The agency's own supervisors remain responsible for call handling and for any CAD entry.",
      `${contact} will be the day-to-day contact for implementation and for this application.`,
    ].join("\n\n"),
    budgetNarrative: [
      `${agency} requests ${amount} for ${title} during ${period}.`,
      "The request covers the NexCort iQ subscription for the roles in this project, implementation support, and training for communications staff. It does not replace the agency's CAD license or radio system.",
      "Amounts in this narrative match the figure entered in the application and should be checked against the funder's budget form before submission.",
    ].join("\n\n"),
    sustainabilityPlan: [
      `After the grant period, ${agency} can continue NexCort iQ as an operating cost of the communications center, alongside the CAD and phone systems it already funds.`,
      "Training materials and the agency's own supervisors carry the practice forward so the project does not depend on a single employee.",
    ].join("\n\n"),
    conclusion: [
      `${agency} asks ${funder} to fund ${title} under ${grant}. The project gives communications staff a clearer record of each call and gives supervisors a practical way to review that work.`,
      "NexCort iQ supports the people who answer the calls. It does not take their place.",
    ].join("\n\n"),
  };
}

export function fillEmptyGrantNarrative(
  sections: GrantNarrativeSections,
  form: Record<string, unknown>,
): GrantNarrativeSections {
  const draft = buildProfileGrantNarrative(form);
  return {
    executiveSummary: sections.executiveSummary.trim() || draft.executiveSummary,
    statementOfNeed: sections.statementOfNeed.trim() || draft.statementOfNeed,
    projectDescription: sections.projectDescription.trim() || draft.projectDescription,
    goalsAndObjectives: sections.goalsAndObjectives.length > 0 ? sections.goalsAndObjectives : draft.goalsAndObjectives,
    implementationTimeline:
      sections.implementationTimeline.length > 0 ? sections.implementationTimeline : draft.implementationTimeline,
    evaluationPlan: sections.evaluationPlan.trim() || draft.evaluationPlan,
    organizationalCapacity: sections.organizationalCapacity.trim() || draft.organizationalCapacity,
    budgetNarrative: sections.budgetNarrative.trim() || draft.budgetNarrative,
    sustainabilityPlan: sections.sustainabilityPlan.trim() || draft.sustainabilityPlan,
    conclusion: sections.conclusion.trim() || draft.conclusion,
  };
}
