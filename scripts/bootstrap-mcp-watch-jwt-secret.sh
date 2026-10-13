#!/usr/bin/env bash
# Generate / rotate RS256 key material for NexCort Watch MCP JWTs.
# Usage:
#   bash scripts/bootstrap-mcp-watch-jwt-secret.sh [secret-name-or-arn] [kid]
# Defaults:
#   secret: rapid-cortex/mcp-watch/jwt-signing-dev
#   kid:    YYYY-MM
set -euo pipefail

SECRET_ID="${1:-rapid-cortex/mcp-watch/jwt-signing-dev}"
KID="${2:-$(date -u +%Y-%m)}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

openssl genrsa -out "$TMP/private.pem" 2048 >/dev/null 2>&1
openssl rsa -in "$TMP/private.pem" -pubout -out "$TMP/public.pem" >/dev/null 2>&1

EXISTING="$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --query SecretString --output text 2>/dev/null || true)"

PAYLOAD="$(
  KID="$KID" EXISTING="$EXISTING" PRIVATE_PEM_PATH="$TMP/private.pem" PUBLIC_PEM_PATH="$TMP/public.pem" python3 - <<'PY'
import json, os
kid = os.environ["KID"]
private_pem = open(os.environ["PRIVATE_PEM_PATH"]).read()
public_pem = open(os.environ["PUBLIC_PEM_PATH"]).read()
existing_raw = os.environ.get("EXISTING", "")
keys = []
if existing_raw and existing_raw not in ("", "None") and "PLACEHOLDER" not in existing_raw:
    try:
        prev = json.loads(existing_raw)
        for k in prev.get("keys", []):
            if k.get("kid") != kid:
                keys.append(k)
    except Exception:
        pass
keys.insert(0, {"kid": kid, "privateKeyPem": private_pem, "publicKeyPem": public_pem})
keys = keys[:3]
print(json.dumps({"activeKid": kid, "keys": keys}))
PY
)"

if aws secretsmanager describe-secret --secret-id "$SECRET_ID" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_ID" --secret-string "$PAYLOAD" >/dev/null
else
  aws secretsmanager create-secret --name "$SECRET_ID" --secret-string "$PAYLOAD" >/dev/null
fi

echo "Updated MCP JWT signing secret: $SECRET_ID (activeKid=$KID)"
echo "Keep EnableMcpWatch=false until smoke tests pass."
