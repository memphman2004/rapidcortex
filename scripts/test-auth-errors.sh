#!/usr/bin/env bash
#
# Sign-in categorization sanity (401 invalid credentials / 429 throttling burst).
# Run after CSRF succeeds — shares cookie jar extraction with §5B.
#
# Burst test is best-effort: Cognito throttling thresholds vary by pool / account.
#
set -eu

BASE="${BASE:-https://rapidcortex.us}"
J="${CSRF_JAR:-$(mktemp -t rc-auth-cookies.XXXXXX)}"
trap 'rm -f "$J" 2>/dev/null || true' EXIT

extract_csrf() {
  awk -F'\t' '$6=="rc_csrf_token" { print $7; exit }' "$J"
}

echo "BASE=$BASE"
echo "== Seed CSRF jar =="
curl -fsS "${BASE%/}/api/auth/session" -c "$J" -o /dev/null
CSRF="$(extract_csrf)"
if [[ -z "${CSRF}" ]]; then
  echo "ERROR: rc_csrf_token missing in $J" >&2
  exit 1
fi

HDR_JSON='Content-Type: application/json'

echo ""
echo "== Wrong password / unknown user path (expect 401 + Invalid credentials; no guaranteed code field) =="
curl -sS "${BASE%/}/api/auth/signin" \
  -b "$J" \
  -H "$HDR_JSON" \
  -H "Origin: $BASE" \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"csrf-smoke-nonexistent@test.invalid","password":"WrongPassword999!"}' \
  -w "\nHTTP %{http_code}\n"

echo ""
echo "== Burst sign-in failures (may surface 429 TooManyRequestsException on some pools) =="
FAIL_BODY="$(mktemp -t burst-body.XXXXXX)"
for _i in $(seq 1 8); do
  code="$(curl -sS -o "$FAIL_BODY" -w "%{http_code}" "${BASE%/}/api/auth/signin" \
    -b "$J" \
    -H "$HDR_JSON" \
    -H "Origin: $BASE" \
    -H "x-csrf-token: $CSRF" \
    -d '{"email":"csrf-throttle@test.invalid","password":"wrong"}')"
  printf 'request #%s HTTP %s\n' "$_i" "$code"
  if [[ "$code" == "429" ]]; then
    cat "$FAIL_BODY"
    echo ""
    break
  fi
  sleep 0.35
done
rm -f "$FAIL_BODY"

echo ""
echo "== 503 / misconfiguration =="
echo "Manual only: corrupt COGNITO pool env in staging, or isolate network egress — expect"
echo "{\"error\":\"Authentication is misconfigured.\",\"code\":\"AUTH_CONFIGURATION_ERROR\"}"
echo "or {\"error\":\"Authentication service is temporarily unavailable.\",\"code\":\"AUTH_UPSTREAM_UNAVAILABLE\"}"

echo ""
echo "Done. Canonical messages: docs/customer-readiness-gate.md §5B and apps/web/lib/cognito-route-errors.ts"

echo ""
echo "== Password flow smoke checklist =="
echo "- Forced NEW_PASSWORD_REQUIRED completion redirects to /dashboard (302/200)."
echo "- Voluntary change-password keeps session valid (/api/me returns 200)."
echo "- Forgot-password confirm redirects to /login?passwordReset=true (not /dashboard)."
echo "- Login banner renders for passwordReset=true and URL is cleaned with replace()."
echo "- Manual: back button does not return to challenge/new-password screen."
