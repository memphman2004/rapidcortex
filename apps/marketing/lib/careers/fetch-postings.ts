import {
  ENGAGEMENT_LABEL,
  LOCATION_LABEL,
  formatCompensation,
  type JobPosting,
} from "rapid-cortex-shared";
import type { OpenRole } from "./open-roles";
import { OPEN_ROLES } from "./open-roles";

const DEFAULT_CAREERS_API_BASE = "https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com";

export function careersApiBase(): string {
  const override = process.env.NEXT_PUBLIC_CAREERS_API_BASE?.trim();
  if (override) return override.replace(/\/$/, "");
  return DEFAULT_CAREERS_API_BASE;
}

/** Map a Dynamo job posting into the careers UI card/detail shape. */
export function postingToOpenRole(p: JobPosting): OpenRole {
  const about = [p.summary, ...(p.description ? p.description.split(/\n\n+/).slice(0, 3) : [])].filter(
    Boolean,
  );
  return {
    id: p.slug,
    positionCode: p.positionKey,
    title: p.title,
    subtitle: p.subtitle,
    company: "Rapid Cortex",
    location: LOCATION_LABEL[p.workLocation] ?? p.workLocation,
    workplaceType: LOCATION_LABEL[p.workLocation] ?? "Remote",
    employmentType: ENGAGEMENT_LABEL[p.engagementType] ?? p.engagementType,
    compensation: formatCompensation(p),
    hours: "",
    postedLabel: p.publishedAt ? "Actively hiring" : "Open role",
    applicantsLabel:
      p.applicationCount != null && p.applicationCount > 0
        ? `${p.applicationCount} applicant${p.applicationCount === 1 ? "" : "s"}`
        : "Be an early applicant",
    chips: [
      LOCATION_LABEL[p.workLocation],
      ENGAGEMENT_LABEL[p.engagementType],
      formatCompensation(p),
      ...(p.department ? [p.department] : []),
    ].filter(Boolean),
    about: about.length ? about : [p.summary],
    responsibilities: [],
    requirements: p.requirements ?? [],
    niceToHave: p.preferredQualifications ?? [],
  };
}

export async function fetchPublishedRoles(): Promise<OpenRole[]> {
  try {
    const res = await fetch(`${careersApiBase()}/api/careers/postings`, {
      credentials: "omit",
      cache: "no-store",
    });
    if (!res.ok) return OPEN_ROLES;
    const data = (await res.json()) as { postings?: JobPosting[] };
    const postings = data.postings ?? [];
    if (!postings.length) return OPEN_ROLES;
    return postings.map(postingToOpenRole);
  } catch {
    return OPEN_ROLES;
  }
}
