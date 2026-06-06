#!/usr/bin/env bash
#
# CSRF double-submit exercises against hosted web `/api/auth/*`.
# Prerequisites: reachable BASE (default https://rapidcortex.us), curl, awk with -F'\t'.
#
# Expected bodies match apps/web/lib/csrf.ts validateCsrfForRequest verbatim.
#
set -eu

BASE="${BASE:-https://rapidcortex.us}"
J="${CSRF_JAR:-$(mktemp -t rc-cookies.XXXXXX)}"
trap 'rm -f "$J" 2>/dev/null || true' EXIT

echo "BASE=$BASE"
echo "Cookie jar=$J"

echo ""
echo "== Step 1: GET /api/auth/session (seed rc_csrf_token) =="
curl -fsS "${BASE%/}/api/auth/session" -c "$J" -o /dev/null

extract_csrf() {
  # curl Mozilla jar: domain, flag, path, secure, expiry, name, value (tab-separated).
  awk -F'\t' '$6=="rc_csrf_token" { print $7; exit }' "$J"
}

CSRF="$(extract_csrf)"
if [[ -z "${CSRF}" ]]; then
  echo "ERROR: could not read rc_csrf_token from jar (inspect $J)" >&2
  exit 1
fi
echo "CSRF extracted (prefix): ${CSRF:0:8}…"

hdr_json='Content-Type: application/json'

echo ""
echo "== Valid CSRF + wrong password (expect 401 Invalid credentials) =="
curl -sS "${BASE%/}/api/auth/signin" \
  -b "$J" \
  -H "$hdr_json" \
  -H "Origin: $BASE" \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"test@example.invalid","password":"WrongPassword999!"}' \
  -w "\nHTTP %{http_code}\n"

echo ""
echo "== Missing x-csrf-token header only (expect 403 missing CSRF token.) =="
curl -sS "${BASE%/}/api/auth/signin" \
  -b "$J" \
  -H "$hdr_json" \
  -H "Origin: $BASE" \
  -d '{"email":"test@example.invalid","password":"anything"}' \
  -w "\nHTTP %{http_code}\n"

echo ""
echo "== Wrong x-csrf-token (expect 403 invalid CSRF token.) =="
curl -sS "${BASE%/}/api/auth/signin" \
  -b "$J" \
  -H "$hdr_json" \
  -H "Origin: $BASE" \
  -H "x-csrf-token: wrong-token-plaintext" \
  -d '{"email":"test@example.invalid","password":"anything"}' \
  -w "\nHTTP %{http_code}\n"

echo ""
echo "== Header echoes token but Cookie jar omitted (still missing CSRF token.) =="
curl -sS "${BASE%/}/api/auth/signin" \
  -H "$hdr_json" \
  -H "Origin: $BASE" \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"test@example.invalid","password":"anything"}' \
  -w "\nHTTP %{http_code}\n"

echo ""
echo "== Disallowed Origin (expect 403 origin is not allowed.) =="
curl -sS "${BASE%/}/api/auth/signin" \
  -b "$J" \
  -H "$hdr_json" \
  -H "Origin: https://evil.example" \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"test@example.invalid","password":"anything"}' \
  -w "\nHTTP %{http_code}\n"

echo ""
echo "Done. Compare JSON {\"error\":\"...\"} bodies to docs/customer-readiness-gate.md §5B."
