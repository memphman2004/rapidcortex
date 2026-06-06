/**
 * Lightweight smoke harness for multilingual language discovery + translation safeguards.
 *
 * Typical upstream (direct HTTP API Gateway):
 *   LANGUAGE_SMOKE_API_BASE=https://xxxx.execute-api.us-east-1.amazonaws.com LANGUAGE_SMOKE_BEARER=... npx tsx scripts/language-support-smoke-test.ts
 *
 * Or via local Next SSR proxy after signing in:
 *   LANGUAGE_SMOKE_API_BASE=http://localhost:3000 LANGUAGE_SMOKE_COOKIE='id_token=...' npx tsx scripts/language-support-smoke-test.ts
 */

type LangResp = {
  ok?: boolean;
  primaryProvider?: string;
  fallbackProvider?: string;
  count?: number;
  languages?: { code: string; direction?: string; capabilities?: { speechToText?: boolean; translation?: boolean } }[];
  warnings?: string[];
};

async function main() {
  const base = process.env.LANGUAGE_SMOKE_API_BASE?.replace(/\/$/, "");
  const bearer = process.env.LANGUAGE_SMOKE_BEARER;
  const cookie = process.env.LANGUAGE_SMOKE_COOKIE;

  if (!base) {
    console.error("Set LANGUAGE_SMOKE_API_BASE to the HTTPS API base (or local Next URL).");
    process.exit(2);
    return;
  }

  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${base}/api/call-intelligence/languages`, {
    headers,
  });
  const body = (await res.json().catch(() => ({}))) as LangResp;

  console.log(JSON.stringify({ status: res.status, bodyPreview: { ok: body.ok, count: body.count, warnings: body.warnings?.length } }, null, 2));

  if (!res.ok) {
    console.error("Language discovery request failed");
    process.exit(1);
  }

  let failed = false;
  function assert(name: string, cond: boolean) {
    if (!cond) {
      console.error(`FAIL: ${name}`);
      failed = true;
    }
  }

  assert("ok flag", body.ok === true);
  assert("providers default", body.primaryProvider === "azure-translator" && body.fallbackProvider === "google-translate");
  const restrict = !!process.env.SUPPORTED_CALL_LANGUAGES?.trim();
  if (!restrict) assert("count>=100 default registry", Number(body.count) >= 100);
  assert("english row", body.languages?.some((l) => l.code === "en"));
  assert("spanish row", body.languages?.some((l) => l.code === "es"));
  assert("arabic rtl", body.languages?.find((l) => l.code === "ar")?.direction === "rtl");
  assert("some translation-enabled row", !!body.languages?.some((l) => l.capabilities?.translation));
  assert("not universal STT claims", !(body.languages ?? []).every((l) => l.capabilities?.speechToText));

  if (failed) process.exit(1);
  console.log("language-support smoke: OK");
}

void main();
