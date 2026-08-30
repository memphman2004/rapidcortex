import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  conferenceSourceUrl,
  detectConferenceChanges,
  extractedConferenceDataSchema,
  isSignificantConferenceChange,
  pendingConferenceChanges,
  type Conference,
  type ConferenceChangeRecord,
  type ExtractedConferenceData,
} from "rapid-cortex-shared";
import { env } from "../env.js";
import { isCollectorsMockEnabled } from "../rapid-iq/agenda-finder.js";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { sesConfigurationSetFields } from "../ses/sesConfigurationSet.js";
import { ConferenceRepository } from "../../repositories/conferenceRepository.js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-6";
const ses = new SESClient({});
const repo = new ConferenceRepository();

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractReadableText(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return withoutBlocks
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "RapidCortex-ConferenceTracker/1.0 (+https://rapidcortex.us)" },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("pdf") || contentType.includes("octet-stream")) return "";
    return await res.text();
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "conference_fetch_failed",
        url,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return "";
  }
}

function emptyExtracted(existing: Conference): ExtractedConferenceData {
  return {
    startDate: existing.startDate,
    endDate: existing.endDate ?? null,
    location: existing.location,
    venue: existing.venue ?? null,
    registrationDeadline: existing.registrationDeadline ?? null,
    isCancelled: Boolean(existing.isCancelled),
    isPostponed: false,
    newDatesTBD: existing.startDate.toUpperCase().includes("TBD"),
    confidence: "confirmed",
    rawDateText: null,
    rawLocationText: null,
    notes: "mock",
  };
}

function coerceNullString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "unknown") return null;
  return s;
}

export async function extractConferenceData(
  pageText: string,
  sourceUrl: string,
  existing: Conference,
): Promise<ExtractedConferenceData | null> {
  if (isCollectorsMockEnabled()) {
    return emptyExtracted(existing);
  }

  const apiKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  if (!apiKey) {
    console.warn(JSON.stringify({ msg: "conference_extract_skipped_no_anthropic", sourceUrl }));
    return null;
  }

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system:
        "You are extracting conference and event details from a website. Extract only information that is explicitly stated on the page. Do not infer or guess. If a field is not clearly stated, return null. Return only valid JSON with no explanation or markdown.",
      messages: [
        {
          role: "user",
          content: `Extract conference details from this page content.
Current stored data for comparison:
  Name: ${existing.name}
  Stored start date: ${existing.startDate}
  Stored end date: ${existing.endDate ?? "unknown"}
  Stored location: ${existing.location}
  Stored venue: ${existing.venue ?? "unknown"}
  Stored registration deadline: ${existing.registrationDeadline ?? "unknown"}

Page URL: ${sourceUrl}

Page content:
${pageText.slice(0, 6000)}

Return JSON only:
{
  "startDate": "YYYY-MM-DD or null if not found",
  "endDate": "YYYY-MM-DD or null if not found",
  "location": "City, ST or null",
  "venue": "venue name or null",
  "registrationDeadline": "YYYY-MM-DD or null",
  "isCancelled": false,
  "isPostponed": false,
  "newDatesTBD": false,
  "confidence": "confirmed | likely | possible",
  "rawDateText": "the exact date text found on page",
  "rawLocationText": "the exact location text found on page",
  "notes": "any other relevant changes noticed"
}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(
      JSON.stringify({
        msg: "conference_extract_http_error",
        status: response.status,
        body: body.slice(0, 400),
      }),
    );
    return null;
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = String(data.content?.[0]?.text ?? "")
    .replace(/```json|```/g, "")
    .trim();
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const parsed = extractedConferenceDataSchema.safeParse({
      startDate: coerceNullString(raw.startDate),
      endDate: coerceNullString(raw.endDate),
      location: coerceNullString(raw.location),
      venue: coerceNullString(raw.venue),
      registrationDeadline: coerceNullString(raw.registrationDeadline),
      isCancelled: Boolean(raw.isCancelled),
      isPostponed: Boolean(raw.isPostponed),
      newDatesTBD: Boolean(raw.newDatesTBD),
      confidence: raw.confidence,
      rawDateText: coerceNullString(raw.rawDateText),
      rawLocationText: coerceNullString(raw.rawLocationText),
      notes: coerceNullString(raw.notes),
    });
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "conference_extract_parse_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

function fromAddress(): string {
  return process.env.SES_FROM_EMAIL?.trim() || env.sesFromEmail || "noreply@rapidcortex.us";
}

function alertToAddresses(): string[] {
  const raw =
    process.env.CONFERENCE_ALERT_TO_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.RAPID_IQ_ALERT_TO_EMAIL?.trim() ||
    "rcsuperadmin@appsondemand.net";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

const CHANGE_LABEL: Record<string, string> = {
  dates: "DATES",
  "dates-announced": "DATES ANNOUNCED",
  location: "LOCATION",
  venue: "VENUE",
  deadline: "DEADLINE",
  cancelled: "CANCELLED",
  "new-info": "NEW INFO",
};

export async function sendChangeAlert(
  conf: Conference,
  changes: ConferenceChangeRecord[],
): Promise<{ sent: boolean }> {
  const changeLines = changes
    .map((c) => {
      const label = CHANGE_LABEL[c.changeType] ?? c.changeType.toUpperCase();
      return `${label}: ${c.previousValue} → ${c.newValue} (${c.confidence})`;
    })
    .join("\n");

  const body = `
Rapid Cortex detected changes on the ${conf.name} website.

EVENT: ${conf.name}
WEBSITE: ${conferenceSourceUrl(conf)}
DETECTED: ${new Date().toISOString()}

CHANGES DETECTED:
${changeLines}

Review and confirm at: https://app.rapidcortex.us/rc-admin/conferences

This update was detected automatically. Please verify on the
official conference website before acting on this information.

—
Rapid Cortex Conference Tracker
`.trim();

  const to = alertToAddresses();
  if (to.length === 0) {
    console.log(JSON.stringify({ msg: "conference_alert_log_only", conferenceId: conf.conferenceId, body }));
    return { sent: false };
  }

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromAddress(),
        Destination: { ToAddresses: to },
        Message: {
          Subject: { Data: `Conference Update Detected — ${conf.name}`, Charset: "UTF-8" },
          Body: { Text: { Data: body, Charset: "UTF-8" } },
        },
        ...sesConfigurationSetFields(),
      }),
    );
    return { sent: true };
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "conference_alert_ses_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { sent: false };
  }
}

function isUpcoming(conf: Conference, now = new Date()): boolean {
  if (conf.isCancelled) return false;
  const start = conf.startDate.trim().toUpperCase();
  if (start.includes("TBD")) return true;
  const t = Date.parse(start);
  if (Number.isNaN(t)) return true;
  const end = conf.endDate ? Date.parse(conf.endDate) : t;
  const endMs = Number.isNaN(end) ? t : end;
  return endMs + 24 * 60 * 60 * 1000 >= now.getTime();
}

export async function fetchUpcomingConferences(): Promise<Conference[]> {
  const all = await repo.listByAgency();
  return all.filter((c) => c.autoUpdateEnabled !== false && isUpcoming(c));
}

export async function refreshConference(conf: Conference): Promise<{
  conferenceId: string;
  changes: number;
  alerted: boolean;
}> {
  const urls = [conferenceSourceUrl(conf), ...(conf.alternateSourceUrls ?? [])].filter(Boolean);
  if (urls.length === 0) {
    await updateLastChecked(conf);
    return { conferenceId: conf.conferenceId, changes: 0, alerted: false };
  }

  let html = "";
  let usedUrl = urls[0]!;
  for (const url of urls) {
    html = await fetchPage(url);
    if (html) {
      usedUrl = url;
      break;
    }
  }
  if (!html) {
    await updateLastChecked(conf);
    return { conferenceId: conf.conferenceId, changes: 0, alerted: false };
  }

  const text = extractReadableText(html);
  const extracted = await extractConferenceData(text, usedUrl, conf);
  if (!extracted) {
    await updateLastChecked(conf);
    return { conferenceId: conf.conferenceId, changes: 0, alerted: false };
  }

  const changes = detectConferenceChanges(conf, extracted, { sourceUrl: usedUrl });
  const pendingKeys = new Set(
    pendingConferenceChanges(conf).map((c) => `${c.changeType}::${c.newValue.toLowerCase()}`),
  );
  const novel = changes.filter(
    (c) => !pendingKeys.has(`${c.changeType}::${c.newValue.toLowerCase()}`),
  );
  if (novel.length === 0) {
    await updateLastChecked(conf);
    return { conferenceId: conf.conferenceId, changes: 0, alerted: false };
  }

  const now = new Date().toISOString();
  const next: Conference = {
    ...conf,
    lastChecked: now,
    lastUpdated: now,
    lastChangeType: novel[0]?.changeType,
    changeHistory: [...(conf.changeHistory ?? []), ...novel].slice(-50),
    updatedAt: now,
  };
  await repo.put(next);

  const significant = novel.filter((c) => isSignificantConferenceChange(c.changeType));
  let alerted = false;
  if (significant.length > 0) {
    const result = await sendChangeAlert(next, significant);
    alerted = result.sent;
  }

  return { conferenceId: conf.conferenceId, changes: novel.length, alerted };
}

async function updateLastChecked(conf: Conference): Promise<void> {
  const now = new Date().toISOString();
  await repo.put({ ...conf, lastChecked: now, updatedAt: now });
}
