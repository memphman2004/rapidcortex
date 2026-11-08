import type { EmailListEntry, EmailListVertical } from "rapid-cortex-shared";

const BASE = "/api/rapid-iq/sales-automation/email-list";

export const EMAIL_LIST_QUERY_KEY = ["rapid-iq-email-list"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function listEmailList(vertical?: EmailListVertical | "ALL"): Promise<{
  entries: EmailListEntry[];
  vertical: string;
}> {
  const qs =
    vertical && vertical !== "ALL"
      ? `?vertical=${encodeURIComponent(vertical)}`
      : "";
  const res = await fetch(`${BASE}${qs}`, { credentials: "include" });
  return parseJson(res);
}

export async function addEmailListEntry(input: {
  email: string;
  vertical: EmailListVertical;
  name?: string;
}): Promise<EmailListEntry> {
  const res = await fetch(BASE, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, source: "manual" }),
  });
  const body = await parseJson<{ entry: EmailListEntry }>(res);
  return body.entry;
}

export async function removeEmailListEntry(opts: {
  email: string;
  vertical?: EmailListVertical | "ALL";
}): Promise<void> {
  const params = new URLSearchParams({ email: opts.email });
  if (opts.vertical) params.set("vertical", opts.vertical);
  const res = await fetch(`${BASE}?${params.toString()}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson(res);
}

export async function moveEmailListEntry(input: {
  email: string;
  fromVertical: EmailListVertical;
  vertical: EmailListVertical;
}): Promise<EmailListEntry> {
  const res = await fetch(BASE, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ entry: EmailListEntry }>(res);
  return body.entry;
}

export async function exportEmailListCsv(
  vertical?: EmailListVertical | "ALL",
): Promise<{ csv: string; count: number }> {
  const qs =
    vertical && vertical !== "ALL"
      ? `?vertical=${encodeURIComponent(vertical)}`
      : "";
  const res = await fetch(`${BASE}/export${qs}`, { credentials: "include" });
  return parseJson(res);
}

export async function importEmailListCsv(
  rows: Array<{
    email: string;
    vertical: EmailListVertical;
    firstName?: string;
    lastName?: string;
    title?: string;
    agencyName?: string;
    state?: string;
    name?: string;
  }>,
  source: "import" | "apollo" = "import",
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const res = await fetch(`${BASE}/import`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, source }),
  });
  return parseJson(res);
}

export async function syncEmailListFromApollo(
  vertical: EmailListVertical,
  forceRefresh = true,
): Promise<{
  result: {
    vertical: EmailListVertical;
    scanned: number;
    imported: number;
    skipped: number;
    errors: number;
  };
}> {
  const res = await fetch(`${BASE}/apollo-sync`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vertical, forceRefresh }),
  });
  return parseJson(res);
}
