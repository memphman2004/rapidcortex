#!/usr/bin/env bash
# verify-rapidiq-rfp-systems.sh
#
# CLI verification for Rapid IQ RFP ingest (watches, web-search worker, unified
# RFP snapshot) without browser access. Resolves table names, function names,
# and API URLs from CloudFormation so nothing is hard-coded.
#
# Usage (from repo root):
#   STAGE=staging bash scripts/verify-rapidiq-rfp-systems.sh
#
# Prerequisites: AWS CLI, python3, jq (jq only needed for the printed curl recipes).
# Region: AWS_REGION / AWS_DEFAULT_REGION (default us-east-1).
#
# Five checks:
#   1. OPENAI_WEB_SEARCH_ENABLED stack parameter vs worker Lambda env
#   2. Watch count by market + transit cost guard (webSearchEnabled=true must be 0)
#   3. RFP_COUNTS / LATEST snapshot existence and staleness vs 15-minute schedule
#   4. GET /api/rapid-iq/intel/rfp-counts — 404 vs 401/403 vs 200
#   5. CloudWatch sampling for web-search discovery + snapshot writes
#
# Then prints a pre-filled cognito-idp initiate-auth command for authenticated checks.
#
# Live names (do not confuse with draft stack/output names):
#   Root stack:     rapid-cortex-${STAGE}
#   Pipeline nest:  ${root}-AppSamRapidIqPipelineStack  (or surgical stack of the same name)
#   Table:          RAPID_IQ_PIPELINE_SIGNALS_TABLE  (WATCH# / INTEL# / SIGNAL# / RFP_COUNTS)
#   Watch field:    market = PSAP | CAMPUS | VENUE | TRANSIT  (not vertical / rc911)
#   Snapshot:       pk=RFP_COUNTS sk=LATEST  shape opportunityFeed / pipeline / intel / total
#   Worker:         IntelWatchWorkerFunction  (SQS + direct {watchId} invoke)
#   Counter:        RfpUnifiedCounterFunction
#   API:            HttpApi3Url  (AppSam3)
#   Logs:           rapid_iq_web_search_discover  /  rapid_iq_rfp_count_snapshot
#
# DeploymentStage=dev is live production (app.rapidcortex.us), not a sandbox.

set -euo pipefail

STAGE="${STAGE:-staging}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ROOT_STACK="${STACK_NAME:-rapid-cortex-${STAGE}}"
export AWS_REGION="$REGION"
export AWS_DEFAULT_REGION="$REGION"
export REGION

G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; NC="\033[0m"; BOLD="\033[1m"
pass() { printf "${G}✓${NC}  %s\n" "$*"; }
fail() { printf "${R}✗${NC}  %s\n" "$*"; FAILURES=$((FAILURES + 1)); }
warn() { printf "${Y}⚠${NC}  %s\n" "$*"; }
info() { printf "${B}ℹ${NC}  %s\n" "$*"; }
section() { printf "\n${BOLD}%s${NC}\n" "$*"; printf '%s\n' "───────────────────────────────────────────────────────"; }

FAILURES=0

nz() {
  case "${1:-}" in
    ""|"None"|"null"|"NONE") return 1 ;;
    *) return 0 ;;
  esac
}

clean() {
  local v="${1:-}"
  case "$v" in
    ""|"None"|"null"|"NONE") printf "" ;;
    *) printf "%s" "$v" ;;
  esac
}

first() {
  local v
  for v in "$@"; do
    v="$(clean "$v")"
    if nz "$v"; then printf "%s" "$v"; return 0; fi
  done
  printf ""
}

stack_ok() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" \
    --query 'Stacks[0].StackStatus' --output text >/dev/null 2>&1
}

get_output() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text 2>/dev/null || true
}

get_param() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" \
    --query "Stacks[0].Parameters[?ParameterKey=='$2'].ParameterValue" --output text 2>/dev/null || true
}

get_nested_physical() {
  aws cloudformation describe-stack-resources --stack-name "$1" --region "$REGION" \
    --logical-resource-id "$2" \
    --query 'StackResources[0].PhysicalResourceId' --output text 2>/dev/null || true
}

get_resource() {
  aws cloudformation describe-stack-resources --stack-name "$1" --region "$REGION" \
    --logical-resource-id "$2" \
    --query 'StackResources[0].PhysicalResourceId' --output text 2>/dev/null || true
}

# ─── Resolve stacks / tables / functions / API ────────────────────────────────

section "RESOLVING STACK OUTPUTS"

PIPELINE_STACK=""
FEED_STACK=""
DATA_STACK=""

if stack_ok "$ROOT_STACK"; then
  pass "Root stack: $ROOT_STACK"
  PIPELINE_STACK="$(first "$(clean "$(get_nested_physical "$ROOT_STACK" "AppSamRapidIqPipelineStack")")" "rapid-cortex-${STAGE}-AppSamRapidIqPipelineStack")"
  FEED_STACK="$(first "$(clean "$(get_nested_physical "$ROOT_STACK" "AppSamRapidIqStack")")" "rapid-cortex-${STAGE}-AppSamRapidIqStack")"
  DATA_STACK="$(first "$(clean "$(get_nested_physical "$ROOT_STACK" "DataLayerStack")")" "rapid-cortex-${STAGE}-DataLayerStack")"
else
  warn "Root stack $ROOT_STACK not found — trying surgical pipeline stack"
fi

SURGICAL="rapid-cortex-${STAGE}-AppSamRapidIqPipelineStack"
if ! nz "$PIPELINE_STACK" || ! stack_ok "$PIPELINE_STACK"; then
  if stack_ok "$SURGICAL"; then
    PIPELINE_STACK="$SURGICAL"
    info "Using surgical pipeline stack: $PIPELINE_STACK"
  fi
fi

if nz "$PIPELINE_STACK" && stack_ok "$PIPELINE_STACK"; then
  pass "Pipeline stack: $PIPELINE_STACK"
else
  fail "Cannot resolve Rapid IQ pipeline stack (tried $ROOT_STACK nested + $SURGICAL)"
  PIPELINE_STACK=""
fi

if nz "$FEED_STACK" && stack_ok "$FEED_STACK"; then
  pass "Feed stack: $FEED_STACK"
else
  FEED_STACK="$(first "$FEED_STACK" "rapid-cortex-${STAGE}-AppSamRapidIqStack")"
  if stack_ok "$FEED_STACK"; then pass "Feed stack: $FEED_STACK"; else warn "Feed stack not resolved (SAM.gov check will be skipped)"; FEED_STACK=""; fi
fi

PIPELINE_TABLE="$(first \
  "$(clean "$(get_output "$ROOT_STACK" "RapidIqPipelineSignalsTableName")")" \
  "$(clean "$(get_output "$PIPELINE_STACK" "RapidIqPipelineSignalsTableName")")" \
  "$(clean "$(get_param "$PIPELINE_STACK" "RapidIqPipelineSignalsTable")")" \
  "$(clean "$(get_output "$DATA_STACK" "RapidIqPipelineSignalsTable")")" \
  "rapid-cortex-rapid-iq-pipeline-signals-${STAGE}"
)"

FEED_TABLE="$(first \
  "$(clean "$(get_param "$PIPELINE_STACK" "RapidIqOpportunitiesTable")")" \
  "$(clean "$(get_output "$DATA_STACK" "RapidIqOpportunitiesTable")")" \
  "rapid-cortex-rapid-iq-opportunities-${STAGE}"
)"

WORKER_FN="$(first \
  "$(clean "$(get_output "$ROOT_STACK" "RapidIqIntelWatchWorkerFunctionName")")" \
  "$(clean "$(get_output "$PIPELINE_STACK" "IntelWatchWorkerFunctionName")")" \
  "$(clean "$(get_resource "$PIPELINE_STACK" "IntelWatchWorkerFunction")")"
)"

SNAPSHOT_FN="$(first \
  "$(clean "$(get_output "$ROOT_STACK" "RapidIqRfpUnifiedCounterFunctionName")")" \
  "$(clean "$(get_output "$PIPELINE_STACK" "RfpUnifiedCounterFunctionName")")" \
  "$(clean "$(get_resource "$PIPELINE_STACK" "RfpUnifiedCounterFunction")")"
)"

API_URL="$(first \
  "$(clean "$(get_output "$ROOT_STACK" "HttpApi3Url")")" \
  "$(clean "$(get_output "$PIPELINE_STACK" "PipelineApiUrl")")"
)"
API_URL="${API_URL%/}"

if ! nz "$API_URL"; then
  HTTP_API_ID="$(first \
    "$(clean "$(get_output "$ROOT_STACK" "HttpApi3Id")")" \
    "$(clean "$(get_output "$PIPELINE_STACK" "PipelineHttpApiId")")" \
    "$(clean "$(get_param "$PIPELINE_STACK" "HttpApiId")")"
  )"
  if nz "$HTTP_API_ID"; then
    API_URL="$(aws apigatewayv2 get-api --api-id "$HTTP_API_ID" --region "$REGION" --query 'ApiEndpoint' --output text 2>/dev/null || true)"
    API_URL="${API_URL%/}"
  fi
fi

WEB_SEARCH_PARAM="$(first \
  "$(clean "$(get_param "$PIPELINE_STACK" "OpenAiWebSearchEnabled")")" \
  "$(clean "$(get_param "$ROOT_STACK" "OpenAiWebSearchEnabled")")"
)"

OPENAI_SECRET_ARN="$(first \
  "$(clean "$(get_param "$PIPELINE_STACK" "OpenAiApiKeySecretArn")")" \
  "$(clean "$(get_param "$ROOT_STACK" "OpenAiApiKeySecretArn")")"
)"

SAM_SECRET_ARN="$(first \
  "$(clean "$(get_param "$FEED_STACK" "RapidIqSamGovApiKeySecretArn")")" \
  "$(clean "$(get_param "$PIPELINE_STACK" "RapidIqSamGovApiKeySecretArn")")"
)"

if nz "$PIPELINE_TABLE"; then pass "Pipeline table: $PIPELINE_TABLE"
else fail "Pipeline table name not resolved"; fi

if nz "$FEED_TABLE"; then info "Opportunity feed table: $FEED_TABLE"; fi

if nz "$WORKER_FN"; then pass "Watch worker: $WORKER_FN"
else fail "IntelWatchWorkerFunction not resolved — pipeline stack may not be deployed"; fi

if nz "$SNAPSHOT_FN"; then pass "RFP counter: $SNAPSHOT_FN"
else fail "RfpUnifiedCounterFunction not resolved — pipeline stack may not be deployed"; fi

if nz "$API_URL"; then pass "HttpApi3: $API_URL"
else warn "HttpApi3Url not resolved — HTTP check will be skipped"; fi

# ─── CHECK 1: Web search flag ─────────────────────────────────────────────────

section "CHECK 1 — OPENAI_WEB_SEARCH_ENABLED (parameter vs worker env)"

if [[ "$WEB_SEARCH_PARAM" == "true" ]]; then
  pass "Stack parameter OpenAiWebSearchEnabled=true"
elif [[ -z "$WEB_SEARCH_PARAM" ]]; then
  warn "OpenAiWebSearchEnabled not found on pipeline/root stack — nested stack may be pending deploy"
else
  info "Stack parameter OpenAiWebSearchEnabled=${WEB_SEARCH_PARAM} (default false is expected)"
fi

WEB_SEARCH_ENV=""
OPENAI_WORKER_ARN=""
if nz "$WORKER_FN"; then
  WEB_SEARCH_ENV="$(aws lambda get-function-configuration \
    --function-name "$WORKER_FN" --region "$REGION" \
    --query 'Environment.Variables.OPENAI_WEB_SEARCH_ENABLED' \
    --output text 2>/dev/null || true)"
  WEB_SEARCH_ENV="$(clean "$WEB_SEARCH_ENV")"
  OPENAI_WORKER_ARN="$(aws lambda get-function-configuration \
    --function-name "$WORKER_FN" --region "$REGION" \
    --query 'Environment.Variables.OPENAI_API_KEY_SECRET_ARN' \
    --output text 2>/dev/null || true)"
  OPENAI_WORKER_ARN="$(clean "$OPENAI_WORKER_ARN")"
  if [[ "$WEB_SEARCH_ENV" == "true" ]]; then
    pass "Worker Lambda OPENAI_WEB_SEARCH_ENABLED=true"
  elif [[ -z "$WEB_SEARCH_ENV" ]]; then
    warn "Worker Lambda OPENAI_WEB_SEARCH_ENABLED is unset"
  else
    info "Worker Lambda OPENAI_WEB_SEARCH_ENABLED=${WEB_SEARCH_ENV}"
  fi
  if [[ -n "$WEB_SEARCH_PARAM" && -n "$WEB_SEARCH_ENV" && "$WEB_SEARCH_PARAM" != "$WEB_SEARCH_ENV" ]]; then
    warn "Parameter (${WEB_SEARCH_PARAM}) and worker env (${WEB_SEARCH_ENV}) differ — env was likely patched by hand"
  fi
  if nz "$OPENAI_WORKER_ARN"; then
    pass "Worker OPENAI_API_KEY_SECRET_ARN is set"
  else
    warn "Worker OPENAI_API_KEY_SECRET_ARN is empty — intel falls back to heuristics, web search cannot run"
  fi
fi

if nz "$OPENAI_SECRET_ARN"; then
  info "Stack OpenAiApiKeySecretArn is configured"
fi

if nz "$SAM_SECRET_ARN"; then
  pass "SAM.gov secret ARN present on feed/pipeline stack"
  if nz "$FEED_STACK"; then
    FEED_ORCH="$(clean "$(get_resource "$FEED_STACK" "RapidIqOrchestratorFunction")")"
    if nz "$FEED_ORCH"; then
      SAM_ENV="$(aws lambda get-function-configuration \
        --function-name "$FEED_ORCH" --region "$REGION" \
        --query 'Environment.Variables.RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN' \
        --output text 2>/dev/null || true)"
      SAM_ENV="$(clean "$SAM_ENV")"
      if nz "$SAM_ENV"; then pass "Feed orchestrator RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN is set"
      else warn "Feed orchestrator missing RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN"; fi
    fi
  fi
else
  info "SAM.gov secret ARN empty (feed collectors run without SAM.gov)"
fi

info "Staging web-search toggle (full nested deploy, not the -dev surgical script):"
info "  source scripts/env-api-staging.sh && OPENAI_WEB_SEARCH_ENABLED=true bash scripts/deploy.sh staging"
info "Surgical live (DeploymentStage=dev = production): OPENAI_WEB_SEARCH_ENABLED=true bash scripts/deploy-rapid-iq-pipeline-api-dev.sh"

# ─── CHECK 2: Watch seeds ─────────────────────────────────────────────────────

section "CHECK 2 — WATCH seeds by market + transit cost guard"

if ! nz "$PIPELINE_TABLE"; then
  fail "Skipping watch query — no table name"
else
  WATCH_JSON="$(mktemp -t rc-riq-watches.XXXXXX)"
  USED_INDEX="$(
    python3 - "$PIPELINE_TABLE" "$REGION" "$WATCH_JSON" <<'PY' || true
import json, subprocess, sys

table, region, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

def aws(args):
    p = subprocess.run(
        ["aws"] + args + ["--region", region, "--output", "json"],
        capture_output=True, text=True,
    )
    if p.returncode != 0:
        sys.stderr.write(p.stderr)
        return None
    return json.loads(p.stdout or "{}")

def unmarshal(node):
    if not isinstance(node, dict):
        return node
    if "S" in node: return node["S"]
    if "N" in node:
        n = node["N"]
        return float(n) if "." in n else int(n)
    if "BOOL" in node: return node["BOOL"]
    if "NULL" in node: return None
    if "L" in node: return [unmarshal(x) for x in node["L"]]
    if "M" in node: return {k: unmarshal(v) for k, v in node["M"].items()}
    if "SS" in node: return list(node["SS"])
    return {k: unmarshal(v) for k, v in node.items()}

def paginate_query(kwargs_base):
    items = []
    start = None
    while True:
        args = list(kwargs_base)
        if start:
            args += ["--exclusive-start-key", json.dumps(start)]
        res = aws(args)
        if res is None:
            return None
        items.extend(res.get("Items") or [])
        start = res.get("LastEvaluatedKey")
        if not start:
            break
    return items

items = paginate_query([
    "dynamodb", "query",
    "--table-name", table,
    "--index-name", "gsi2-source-date",
    "--key-condition-expression", "gsi2pk = :pk",
    "--expression-attribute-values", json.dumps({":pk": {"S": "WATCH#ALL"}}),
])
used = "gsi2"
if items is None:
    items = []
    used = "error"
elif len(items) == 0:
    # Seeds written before gsi2pk, or index empty — fall back to scan.
    items = paginate_query([
        "dynamodb", "scan",
        "--table-name", table,
        "--filter-expression", "begins_with(pk, :w)",
        "--expression-attribute-values", json.dumps({":w": {"S": "WATCH#"}}),
    ]) or []
    used = "scan"

watches = []
for raw in items:
    item = unmarshal(raw)
    if not isinstance(item, dict):
        continue
    pk = str(item.get("pk") or "")
    if pk.startswith("WATCH#") or item.get("entityType") == "watch" or item.get("id"):
        watches.append(item)

payload = {"used": used, "watches": watches}
with open(out_path, "w") as f:
    json.dump(payload, f)
print(used)
PY
)"
  USED_INDEX="$(clean "${USED_INDEX:-error}")"
  eval "$(python3 - "$WATCH_JSON" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
watches = d.get("watches") or []
by = {"PSAP": 0, "CAMPUS": 0, "VENUE": 0, "TRANSIT": 0, "OTHER": 0}
web_true = {"PSAP": 0, "CAMPUS": 0, "VENUE": 0, "TRANSIT": 0}
fulton = False
for w in watches:
    m = str(w.get("market") or w.get("vertical") or "").upper().replace("RC911", "PSAP")
    if m not in by:
        m = "OTHER"
    by[m] += 1
    if w.get("webSearchEnabled") is True:
        key = m if m in web_true else None
        if key:
            web_true[key] += 1
    wid = str(w.get("id") or "")
    pk = str(w.get("pk") or "")
    if wid == "psap-fulton-county-ga" or pk.endswith("psap-fulton-county-ga"):
        fulton = True

def emit(k, v):
    print("%s=%s" % (k, v))

emit("WATCH_TOTAL", len(watches))
emit("WATCH_PSAP", by["PSAP"])
emit("WATCH_CAMPUS", by["CAMPUS"])
emit("WATCH_VENUE", by["VENUE"])
emit("WATCH_TRANSIT", by["TRANSIT"])
emit("WATCH_OTHER", by["OTHER"])
emit("WEB_PSAP", web_true["PSAP"])
emit("WEB_CAMPUS", web_true["CAMPUS"])
emit("WEB_VENUE", web_true["VENUE"])
emit("WEB_TRANSIT", web_true["TRANSIT"])
emit("FULTON_OK", "1" if fulton else "0")
PY
)"

  if [[ "$USED_INDEX" == "error" ]]; then
    fail "Cannot query pipeline table — check IAM / table name / GSI gsi2-source-date"
  else
    info "Watch query path: $USED_INDEX"
    info "Total watches: ${WATCH_TOTAL:-0} (expect ≥ 68 = 17 PSAP + 13 campus + 13 venue + 25 transit)"
    if [[ "${WATCH_TOTAL:-0}" -ge 68 ]]; then pass "Watch count meets expected minimum (68)"
    elif [[ "${WATCH_TOTAL:-0}" -ge 25 ]]; then
      warn "Only ${WATCH_TOTAL} watches — new vertical seeds may not have run yet"
      info "  → STAGE=$STAGE npx tsx scripts/seed-rapid-iq-intel-watches.ts"
    else
      fail "Watch count critically low (${WATCH_TOTAL:-0}) — seed did not complete"
    fi
  fi

  expect_market() {
    local label="$1" count="$2" expected="$3"
    if [[ "$count" -ge "$expected" ]]; then pass "$label: $count watches (≥ $expected)"
    else warn "$label: $count watches ($expected expected)"; fi
  }
  expect_market "PSAP" "${WATCH_PSAP:-0}" 17
  expect_market "CAMPUS" "${WATCH_CAMPUS:-0}" 13
  expect_market "VENUE" "${WATCH_VENUE:-0}" 13
  expect_market "TRANSIT" "${WATCH_TRANSIT:-0}" 25

  if [[ "${WEB_TRANSIT:-0}" -eq 0 ]]; then
    pass "Transit watches: webSearchEnabled=true count is 0 (cost guard)"
  else
    fail "TRANSIT webSearchEnabled=true on ${WEB_TRANSIT} watches — must stay false (would double OpenAI cost on the largest group)"
  fi

  VERT_WEB=$(( ${WEB_PSAP:-0} + ${WEB_CAMPUS:-0} + ${WEB_VENUE:-0} ))
  if [[ "$VERT_WEB" -ge 40 ]]; then
    pass "PSAP/campus/venue watches: webSearchEnabled=true ($VERT_WEB, expected ~43)"
  else
    warn "Only $VERT_WEB PSAP/campus/venue watches have webSearchEnabled=true (expected ~43)"
    info "  Existing WATCH# rows are never overwritten by seed — patch or recreate if these predate the flag"
  fi

  if [[ "${FULTON_OK:-0}" == "1" ]]; then
    pass "Spot-check WATCH#psap-fulton-county-ga exists"
  else
    warn "WATCH#psap-fulton-county-ga not found — seed may not have run"
  fi
  rm -f "$WATCH_JSON"
fi

# ─── CHECK 3: RFP snapshot ────────────────────────────────────────────────────

section "CHECK 3 — RFP_COUNTS / LATEST snapshot (15-minute schedule)"

SNAPSHOT_RAW="$(mktemp -t rc-riq-snap.XXXXXX)"
if nz "$PIPELINE_TABLE"; then
  aws dynamodb get-item \
    --table-name "$PIPELINE_TABLE" \
    --key '{"pk":{"S":"RFP_COUNTS"},"sk":{"S":"LATEST"}}' \
    --region "$REGION" --output json >"$SNAPSHOT_RAW" 2>/dev/null || echo '{}' >"$SNAPSHOT_RAW"

  eval "$(python3 - "$SNAPSHOT_RAW" <<'PY'
import json, sys
from datetime import datetime, timezone
raw = json.load(open(sys.argv[1]))
item = raw.get("Item")
if not item:
    print("SNAP_HAS=0")
    sys.exit(0)
print("SNAP_HAS=1")

def un(node):
    if not isinstance(node, dict):
        return node
    if "S" in node: return node["S"]
    if "N" in node:
        n = node["N"]
        return float(n) if "." in n else int(n)
    if "BOOL" in node: return node["BOOL"]
    if "NULL" in node: return None
    if "L" in node: return [un(x) for x in node["L"]]
    if "M" in node: return {k: un(v) for k, v in node["M"].items()}
    return {k: un(v) for k, v in node.items()}

d = un(item)
updated = str(d.get("updatedAt") or "")
total = d.get("total") or {}
feed = d.get("opportunityFeed") or d.get("feed") or {}
pipe = d.get("pipeline") or {}
intel = d.get("intel") or {}
print("SNAP_UPDATED='%s'" % updated.replace("'", ""))
print("SNAP_TOTAL_OPEN=%s" % (total.get("open") if total.get("open") is not None else "''"))
print("SNAP_FEED_OPEN=%s" % (feed.get("open") if feed.get("open") is not None else "''"))
print("SNAP_PIPE_OPEN=%s" % (pipe.get("open") if pipe.get("open") is not None else "''"))
print("SNAP_INTEL_OPEN=%s" % (intel.get("open") if intel.get("open") is not None else "''"))
print("SNAP_PSAP=%s" % (total.get("psap") if total.get("psap") is not None else "''"))
print("SNAP_HAS_RC911=%s" % (1 if isinstance(total, dict) and "rc911" in total else 0))
age = "?"
if updated:
    try:
        snap = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        age = str(int((datetime.now(timezone.utc) - snap).total_seconds() / 60))
    except Exception:
        age = "?"
print("SNAP_AGE_MINS=%s" % age)
PY
)"

  if [[ "${SNAP_HAS:-0}" == "1" ]]; then
    pass "Snapshot exists — updatedAt: ${SNAP_UPDATED}"
    info "  total.open=${SNAP_TOTAL_OPEN}  opportunityFeed.open=${SNAP_FEED_OPEN}  pipeline.open=${SNAP_PIPE_OPEN}  intel.open=${SNAP_INTEL_OPEN}  psap=${SNAP_PSAP}"
    if [[ "${SNAP_HAS_RC911:-0}" == "1" ]]; then
      fail "Snapshot still has rc911 — live vertical key is psap"
    else
      pass "Snapshot vertical key is psap (not rc911)"
    fi
    if [[ "${SNAP_AGE_MINS}" == "?" ]]; then
      warn "Cannot parse snapshot age"
    elif [[ "${SNAP_AGE_MINS}" -le 20 ]]; then
      pass "Snapshot is fresh (${SNAP_AGE_MINS} min old; schedule is rate(15 minutes))"
    elif [[ "${SNAP_AGE_MINS}" -le 60 ]]; then
      warn "Snapshot is ${SNAP_AGE_MINS} min old — 15-minute rule may have missed a beat"
    else
      fail "Snapshot is ${SNAP_AGE_MINS} min old — RfpUnifiedCounterFunction may not be running"
    fi
    # Arithmetic sum check when values are integers
    if [[ "${SNAP_FEED_OPEN}" =~ ^[0-9]+$ && "${SNAP_PIPE_OPEN}" =~ ^[0-9]+$ && "${SNAP_INTEL_OPEN}" =~ ^[0-9]+$ && "${SNAP_TOTAL_OPEN}" =~ ^[0-9]+$ ]]; then
      SUM=$((SNAP_FEED_OPEN + SNAP_PIPE_OPEN + SNAP_INTEL_OPEN))
      if [[ "$SUM" -eq "$SNAP_TOTAL_OPEN" ]]; then
        pass "opportunityFeed + pipeline + intel open counts sum to total.open ($SUM)"
      else
        fail "Store open counts ($SUM) do not equal total.open ($SNAP_TOTAL_OPEN)"
      fi
    fi
  else
    warn "Snapshot not found — first 15-minute run may not have executed yet"
    if nz "$SNAPSHOT_FN"; then
      info "  → aws lambda invoke --function-name $SNAPSHOT_FN --region $REGION /tmp/riq-snap-out.json && cat /tmp/riq-snap-out.json"
    fi
    info "  Until the first snapshot, the dashboard tile falls back to feed 'RFP LIVE' tag count"
  fi
fi
rm -f "$SNAPSHOT_RAW"

RULE_HIT=""
RULE_STATE=""
for prefix in \
  "${ROOT_STACK}-riq-rfp-count" \
  "rapid-cortex-${STAGE}-riq-rfp-count" \
  "rapid-cortex-dev-riq-rfp-count" \
  "rapid-cortex-staging-riq-rfp-count"
do
  RULE_JSON="$(aws events list-rules --name-prefix "$prefix" --region "$REGION" --output json 2>/dev/null || echo '{"Rules":[]}')"
  RULE_HIT="$(python3 -c "
import json,sys
d=json.loads(sys.argv[1])
names=[r.get('Name','') for r in d.get('Rules') or [] if 'riq-rfp-count' in r.get('Name','')]
print(names[0] if names else '')
" "$RULE_JSON")"
  if nz "$RULE_HIT"; then
    RULE_STATE="$(python3 -c "
import json,sys
want=sys.argv[1]
d=json.loads(sys.argv[2])
for r in d.get('Rules') or []:
    if r.get('Name')==want:
        print(r.get('State','')); break
" "$RULE_HIT" "$RULE_JSON")"
    break
  fi
done
if nz "$RULE_HIT"; then
  if [[ "$RULE_STATE" == "ENABLED" ]]; then pass "EventBridge rule $RULE_HIT is ENABLED"
  else warn "EventBridge rule $RULE_HIT state=$RULE_STATE"; fi
else
  warn "No EventBridge rule name containing riq-rfp-count — counter schedule may not be deployed"
fi

# BoardDocs negative sample (solicitation predicate, not relevant+fit)
if nz "$PIPELINE_TABLE"; then
  BD_JSON="$(mktemp -t rc-riq-bd.XXXXXX)"
  python3 - "$PIPELINE_TABLE" "$REGION" "$BD_JSON" <<'PY' || true
import json, subprocess, sys

table, region, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

def aws(args):
    p = subprocess.run(["aws"] + args + ["--region", region, "--output", "json"], capture_output=True, text=True)
    if p.returncode != 0:
        return None
    return json.loads(p.stdout or "{}")

def un(node):
    if not isinstance(node, dict):
        return node
    if "S" in node: return node["S"]
    if "N" in node:
        n = node["N"]
        return float(n) if "." in n else int(n)
    if "BOOL" in node: return node["BOOL"]
    if "NULL" in node: return None
    if "L" in node: return [un(x) for x in node["L"]]
    if "M" in node: return {k: un(v) for k, v in node["M"].items()}
    return {k: un(v) for k, v in node.items()}

INTEL_RFP_TYPES = {"RFP", "RFQ", "RFB", "PROCUREMENT_NOTICE"}

def is_rfp(item):
    tags = item.get("tags") or []
    if isinstance(tags, list) and any(str(t).upper() in ("RFP LIVE", "ACTIVE_RFP", "RFP") for t in tags):
        return True
    if item.get("intentStage") == "active_rfp":
        return True
    if str(item.get("signalType") or "").lower() == "rfp":
        return True
    if item.get("procurementStage") == "rfp":
        return True
    stage = item.get("procurementStage")
    if isinstance(stage, (int, float)) and stage >= 8:
        return True
    try:
        if int(str(item.get("userProcurementStage") or "")) >= 8:
            return True
    except Exception:
        pass
    ot = str(item.get("opportunityType") or "").upper()
    if ot in INTEL_RFP_TYPES:
        return True
    if ot == "PRE_RFP_SIGNAL" and item.get("preRfpSignal") is True:
        return True
    return False

res = aws([
    "dynamodb", "query",
    "--table-name", table,
    "--index-name", "gsi2-source-date",
    "--key-condition-expression", "gsi2pk = :pk",
    "--expression-attribute-values", json.dumps({":pk": {"S": "SOURCE#boarddocs"}}),
    "--limit", "8",
])
payload = {"status": "query_failed", "n": 0, "counted": 0, "sample": "", "title": ""}
if res is not None:
    items = [un(x) for x in (res.get("Items") or [])]
    if not items:
        payload["status"] = "empty"
    else:
        counted = 0
        sample_id = ""
        sample_title = ""
        for it in items:
            if is_rfp(it):
                counted += 1
            if not sample_id:
                sample_id = str(it.get("pk") or it.get("signalId") or "")
                sample_title = str(it.get("rawTitle") or it.get("title") or "")[:80]
        payload = {
            "status": "ok",
            "n": len(items),
            "counted": counted,
            "sample": sample_id,
            "title": sample_title,
        }
with open(out_path, "w") as f:
    json.dump(payload, f)
PY
  BD_STATUS="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('status',''))" "$BD_JSON" 2>/dev/null || echo "query_failed")"
  BD_N="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('n',0))" "$BD_JSON" 2>/dev/null || echo 0)"
  BD_COUNTED="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('counted',0))" "$BD_JSON" 2>/dev/null || echo 0)"
  BD_SAMPLE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('sample',''))" "$BD_JSON" 2>/dev/null || echo "")"
  BD_TITLE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('title',''))" "$BD_JSON" 2>/dev/null || echo "")"
  case "${BD_STATUS}" in
    ok)
      info "BoardDocs sample: ${BD_N} SIGNAL# rows, ${BD_COUNTED} would match isUnifiedRfpRecord"
      info "  example ${BD_SAMPLE}: ${BD_TITLE}"
      if [[ "${BD_COUNTED}" -eq 0 ]]; then
        pass "BoardDocs agendas in this sample are not counted as RFPs (solicitation predicate holds)"
      elif [[ "${BD_COUNTED}" -lt "${BD_N}" ]]; then
        warn "Some BoardDocs rows matched the RFP predicate (${BD_COUNTED}/${BD_N}) — spot-check titles; genuine RFPs on BoardDocs are allowed"
      else
        fail "Every sampled BoardDocs row counted as an RFP — predicate likely regressed to relevant+fit"
      fi
      ;;
    empty) info "No SOURCE#boarddocs rows yet — skip BoardDocs negative test until ingest has run" ;;
    *) info "BoardDocs GSI query skipped or failed (index may be empty)" ;;
  esac
  rm -f "$BD_JSON"
fi

# ─── CHECK 4: HTTP route ──────────────────────────────────────────────────────

section "CHECK 4 — GET /api/rapid-iq/intel/rfp-counts (404 vs 401/403 vs 200)"

if ! nz "$API_URL"; then
  warn "No API URL — skipping HTTP check"
else
  HTTP_FILE="$(mktemp -t rc-riq-http.XXXXXX)"
  HTTP_STATUS="$(curl -sS -o "$HTTP_FILE" -w "%{http_code}" \
    "${API_URL}/api/rapid-iq/intel/rfp-counts" \
    --max-time 15 2>/dev/null || echo "000")"
  case "$HTTP_STATUS" in
    200)
      pass "GET /api/rapid-iq/intel/rfp-counts → 200"
      info "  Unauthenticated 200 is unexpected (handler requires rcadmin) — check authorizer"
      ;;
    401|403)
      pass "GET /api/rapid-iq/intel/rfp-counts → $HTTP_STATUS (auth required — route is deployed)"
      info "  Use the Cognito token section below for an authenticated 200"
      ;;
    404)
      fail "GET /api/rapid-iq/intel/rfp-counts → 404 — route not on HttpApi3 (pipeline stack not deployed onto this API)"
      ;;
    000)
      warn "No response from $API_URL — check network / WAF / VPC"
      ;;
    *)
      warn "GET /api/rapid-iq/intel/rfp-counts → $HTTP_STATUS"
      info "  body: $(head -c 200 "$HTTP_FILE" 2>/dev/null || true)"
      ;;
  esac
  rm -f "$HTTP_FILE"
fi

# ─── CHECK 5: CloudWatch ──────────────────────────────────────────────────────

section "CHECK 5 — CloudWatch log sampling (last 6h)"

CW_SINCE="$(python3 -c "import time; print(int((time.time()-21600)*1000))")"

check_log_pattern() {
  local log_group="$1" pattern="$2" label="$3"
  local count
  count="$(aws logs filter-log-events \
    --log-group-name "$log_group" \
    --start-time "$CW_SINCE" \
    --filter-pattern "$pattern" \
    --region "$REGION" \
    --query 'length(events)' \
    --output text 2>/dev/null || echo "0")"
  count="$(clean "$count")"
  case "$count" in
    ""|None) count=0 ;;
  esac
  if [[ "$count" =~ ^[0-9]+$ ]] && [[ "$count" -gt 0 ]]; then
    pass "$label ($count hits in last 6h)"
  else
    info "$label — no hits in last 6h (may not have run yet)"
  fi
}

if nz "$WORKER_FN"; then
  WORKER_LOG="/aws/lambda/${WORKER_FN}"
  if aws logs describe-log-groups --log-group-name-prefix "$WORKER_LOG" --region "$REGION" \
      --query "logGroups[?logGroupName=='$WORKER_LOG'].logGroupName" --output text 2>/dev/null | grep -q .; then
    check_log_pattern "$WORKER_LOG" '"rapid_iq_web_search_discover"' "Web search discover log (msg rapid_iq_web_search_discover)"
    check_log_pattern "$WORKER_LOG" '"OPENAI_WEB_SEARCH_ENABLED not true"' "Web search skip (expected while the global flag is off)"
    check_log_pattern "$WORKER_LOG" '"openai-web-search"' "openai-web-search source attribution"
    ERR_COUNT="$(aws logs filter-log-events \
      --log-group-name "$WORKER_LOG" \
      --start-time "$CW_SINCE" \
      --filter-pattern "ERROR" \
      --region "$REGION" \
      --query 'length(events)' --output text 2>/dev/null || echo "0")"
    ERR_COUNT="$(clean "$ERR_COUNT")"
    case "$ERR_COUNT" in ""|None) ERR_COUNT=0 ;; esac
    if [[ "$ERR_COUNT" =~ ^[0-9]+$ ]] && [[ "$ERR_COUNT" -gt 5 ]]; then
      warn "Watch worker: $ERR_COUNT ERROR events in last 6h"
      info "  → aws logs tail $WORKER_LOG --since 6h --filter-pattern ERROR --region $REGION"
    elif [[ "$ERR_COUNT" =~ ^[0-9]+$ ]] && [[ "$ERR_COUNT" -gt 0 ]]; then
      info "Watch worker: $ERR_COUNT ERROR events in last 6h"
    else
      pass "Watch worker: no ERROR events in last 6h"
    fi
  else
    info "Worker log group $WORKER_LOG does not exist yet (function never invoked)"
  fi
fi

if nz "$SNAPSHOT_FN"; then
  SNAP_LOG="/aws/lambda/${SNAPSHOT_FN}"
  if aws logs describe-log-groups --log-group-name-prefix "$SNAP_LOG" --region "$REGION" \
      --query "logGroups[?logGroupName=='$SNAP_LOG'].logGroupName" --output text 2>/dev/null | grep -q .; then
    check_log_pattern "$SNAP_LOG" '"rapid_iq_rfp_count_snapshot"' "Snapshot write log (msg rapid_iq_rfp_count_snapshot)"
    check_log_pattern "$SNAP_LOG" '"total"' "Snapshot total field logged"
  else
    info "Counter log group $SNAP_LOG does not exist yet (invoke once if the schedule has not fired)"
  fi
fi

# ─── Cognito token helper ─────────────────────────────────────────────────────

section "COGNITO TOKEN — for authenticated API verification"

USER_POOL_ID="$(first \
  "$(clean "$(get_output "$ROOT_STACK" "UserPoolId")")" \
  "$(clean "$(get_output "$ROOT_STACK" "CognitoUserPoolId")")"
)"
CLIENT_ID="$(first \
  "$(clean "$(get_output "$ROOT_STACK" "UserPoolClientId")")" \
  "$(clean "$(get_output "$ROOT_STACK" "CognitoUserPoolClientId")")"
)"

if nz "$USER_POOL_ID"; then info "User Pool: $USER_POOL_ID"; else warn "UserPoolId not in root outputs"; fi
if nz "$CLIENT_ID"; then info "Client:    $CLIENT_ID"; else warn "UserPoolClientId not in root outputs"; fi

API_PRINT="${API_URL:-https://YOUR_HTTPAPI3_URL}"
CLIENT_PRINT="${CLIENT_ID:-YOUR_CLIENT_ID}"
POOL_PRINT="${USER_POOL_ID:-YOUR_USER_POOL_ID}"

cat <<EOF

Export rcsuperadmin / rcadmin credentials, then:

  TOKEN=\$(aws cognito-idp initiate-auth \\
    --auth-flow USER_PASSWORD_AUTH \\
    --client-id ${CLIENT_PRINT} \\
    --auth-parameters USERNAME=\${RC_ADMIN_EMAIL},PASSWORD=\${RC_ADMIN_PASS} \\
    --region ${REGION} \\
    --query 'AuthenticationResult.IdToken' --output text)

If USER_PASSWORD_AUTH is not enabled on the app client:

  TOKEN=\$(aws cognito-idp admin-initiate-auth \\
    --user-pool-id ${POOL_PRINT} \\
    --client-id ${CLIENT_PRINT} \\
    --auth-flow ADMIN_USER_PASSWORD_AUTH \\
    --auth-parameters USERNAME=\${RC_ADMIN_EMAIL},PASSWORD=\${RC_ADMIN_PASS} \\
    --region ${REGION} \\
    --query 'AuthenticationResult.IdToken' --output text)

Authenticated checks (response is { watches, defaultMarket, total } — not .data):

  curl -sS -H "Authorization: Bearer \$TOKEN" \\
    ${API_PRINT}/api/rapid-iq/intel/rfp-counts | jq '{updatedAt: .snapshot.updatedAt, open: .snapshot.total.open, psap: .snapshot.total.psap}'

  curl -sS -H "Authorization: Bearer \$TOKEN" \\
    ${API_PRINT}/api/rapid-iq/intel/watches | jq '{
      defaultMarket,
      total,
      ok: (.defaultMarket == "all" and .total >= 68),
      markets: [.watches[].market] | group_by(.) | map({(.[0]): length}) | add
    }'

  curl -sS -H "Authorization: Bearer \$TOKEN" \\
    ${API_PRINT}/api/rapid-iq/intel/watches/psap-fulton-county-ga | jq '{
      id: .watch.id, market: .watch.market, webSearchEnabled: .watch.webSearchEnabled,
      sourceUrlCount: (.watch.sourceUrls | length)
    }'

Direct worker invoke (macOS AWS CLI v2). dryRun is accepted and ignored;
web search is gated only by OPENAI_WEB_SEARCH_ENABLED + watch.webSearchEnabled:

  aws lambda invoke \\
    --function-name ${WORKER_FN:-IntelWatchWorkerFunction} \\
    --cli-binary-format raw-in-base64-out \\
    --payload '{"watchId":"psap-fulton-county-ga"}' \\
    --region ${REGION} \\
    /tmp/riq-worker-out.json && python3 -m json.tool /tmp/riq-worker-out.json

Expected keys: urls_fetched, intel_rows_written, web_search_urls_discovered,
web_search_source_ids, web_search_skipped, web_search_skip_reason.

EOF

# ─── Summary ──────────────────────────────────────────────────────────────────

section "VERIFICATION SUMMARY"

info "STAGE=$STAGE  (dev = live production; staging = engineering)"
info "Pipeline table: ${PIPELINE_TABLE:-unset}"
info "Worker:         ${WORKER_FN:-unset}"
info "Counter:        ${SNAPSHOT_FN:-unset}"
info "API:            ${API_URL:-unset}"

if [[ "$FAILURES" -eq 0 ]]; then
  printf "${G}${BOLD}All blocking checks passed.${NC}\n"
else
  printf "${R}${BOLD}%s blocking check(s) failed — review output above.${NC}\n" "$FAILURES"
fi

cat <<EOF

Next (see docs/rfp-post-deploy-checklist.md — run this script first):

  1. Seed watches if count < 68:
       STAGE=$STAGE npx tsx scripts/seed-rapid-iq-intel-watches.ts

  2. First snapshot if RFP_COUNTS/LATEST is missing:
       aws lambda invoke --function-name ${SNAPSHOT_FN:-RfpUnifiedCounterFunction} --region $REGION /tmp/riq-snap-out.json

  3. Web search ON for one watch only (staging), then turn the flag back off.
     Do not leave OPENAI_WEB_SEARCH_ENABLED=true on staging (~\$2/day once all 43 vertical watches run).

  4. Production promotion requires an explicit web-search timing decision (enable now vs defer).
     That is a deploy flag only — no code change.

EOF

if [[ "$FAILURES" -ne 0 ]]; then
  exit 1
fi
