import type { ApplicationStatus, JobApplication } from "rapid-cortex-shared";

const BASE = "/api/rc-admin/applications";

export interface ApplicationsData {
  applications: JobApplication[];
  metrics: {
    total: number;
    new: number;
    inProgress: number;
    hired: number;
    rejected: number;
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof body === "object" && body && "error" in body && body.error
        ? String(body.error)
        : `Request failed (${res.status})`,
    );
  }
  return body;
}

export async function getApplications(): Promise<ApplicationsData> {
  const res = await fetch(BASE, { credentials: "include" });
  return parseJson<ApplicationsData>(res);
}

export async function getApplication(applicationId: string): Promise<JobApplication> {
  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}`, {
    credentials: "include",
  });
  return parseJson<JobApplication>(res);
}

export async function updateApplicationStatus(
  applicationId: string,
  opts: {
    status: ApplicationStatus;
    statusNote?: string;
    schedulingLink?: string;
    customMessage?: string;
    skipEmail?: boolean;
  },
): Promise<JobApplication> {
  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: opts.status,
      ...(opts.statusNote ? { statusNote: opts.statusNote } : {}),
      ...(opts.schedulingLink ? { schedulingLink: opts.schedulingLink } : {}),
      ...(opts.customMessage ? { customMessage: opts.customMessage } : {}),
      skipEmail: opts.skipEmail ?? false,
    }),
  });
  return parseJson<JobApplication>(res);
}

export async function patchApplication(
  applicationId: string,
  patch: Partial<Pick<JobApplication, "rating" | "assignedTo" | "assignedToName">>,
): Promise<JobApplication> {
  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<JobApplication>(res);
}

export async function addNote(
  applicationId: string,
  text: string,
  pinned = false,
): Promise<JobApplication> {
  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, pinned }),
  });
  return parseJson<JobApplication>(res);
}

export async function getResumeDownloadUrl(applicationId: string): Promise<string> {
  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}/resume-url`, {
    credentials: "include",
  });
  const data = await parseJson<{ url: string }>(res);
  return data.url;
}
