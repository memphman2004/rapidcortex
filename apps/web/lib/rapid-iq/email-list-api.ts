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
