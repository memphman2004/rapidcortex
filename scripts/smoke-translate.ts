#!/usr/bin/env npx tsx
/**
 * Smoke RC Translate REST surface through the web BFF (or API_UPSTREAM_BASE_2).
 *
 *   TRANSLATE_SMOKE_COOKIE='...' npx tsx scripts/smoke-translate.ts
 *
 * Without a session cookie, the script only checks that the BFF route exists (401/403).
 */
const base = (process.env.APP_PUBLIC_BASE_URL || process.env.WEB_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const cookie = process.env.TRANSLATE_SMOKE_COOKIE?.trim() ?? "";

async function hit(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const languages = await hit("/api/translate/languages");
  if (languages.status === 404) {
    console.error("RC Translate BFF route missing (404). Deploy AppSamTranslateStack2 and web BFF.");
    process.exit(1);
  }
  if (!cookie) {
    if (languages.status === 401 || languages.status === 403) {
      console.log("RC Translate route is mounted (auth required). Pass TRANSLATE_SMOKE_COOKIE for a full check.");
      process.exit(0);
    }
  }
  if (languages.status !== 200) {
    console.error("languages failed", languages.status, languages.body);
    process.exit(1);
  }
  const created = await hit("/api/translate/sessions", {
    method: "POST",
    body: JSON.stringify({ subjectLanguage: "es", vertical: "law_enforcement" }),
  });
  if (created.status !== 201) {
    console.error("create session failed", created.status, created.body);
    process.exit(1);
  }
  const session = (created.body as { session: { sessionId: string } }).session;
  const closed = await hit(`/api/translate/sessions/${session.sessionId}/close`, {
    method: "POST",
    body: JSON.stringify({ writebackNote: false }),
  });
  if (closed.status !== 200) {
    console.error("close session failed", closed.status, closed.body);
    process.exit(1);
  }
  console.log("RC Translate smoke ok", session.sessionId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
