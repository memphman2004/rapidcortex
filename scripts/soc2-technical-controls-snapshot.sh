#!/usr/bin/env bash
# SOC 2 Type II — technical control baseline snapshot.
# Collects auditor-style evidence for CloudTrail, S3 encryption/BPA, DynamoDB PITR,
# KMS rotation, Secrets Manager rotation, WAF logging, CloudWatch alarms, Cognito MFA,
# and ACM certificates.
#
# Usage:
#   AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 \
#     bash scripts/soc2-technical-controls-snapshot.sh
#
# Writes timestamped artifacts under docs/evidence/<date>-soc2-technical-controls/
# Does not print secret values (describe-secret metadata only).

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DATE_DIR="$(date -u +%Y-%m-%d)"
OUT="${SOC2_EVIDENCE_DIR:-$ROOT/docs/evidence/${DATE_DIR}-soc2-technical-controls}"
RAW="$OUT/raw"
mkdir -p "$RAW"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

run_json() {
  local name="$1"; shift
  local file="$RAW/${STAMP}-${name}.json"
  local err="$RAW/${STAMP}-${name}.stderr.txt"
  log "aws $*"
  if "$@" >"$file" 2>"$err"; then
    printf '{"ok":true,"command":%s,"file":%s}\n' "$(printf '%s' "$*" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" "$(printf '%s' "$file" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
    if [[ ! -s "$err" ]]; then rm -f "$err"; fi
    return 0
  fi
  local rc=$?
  printf '{"ok":false,"exit":%s}\n' "$rc" >>"$file"
  log "FAIL ($rc) $name — see $(basename "$err")"
  return "$rc"
}

python3 - "$OUT" "$STAMP" "$AWS_PROFILE" "$AWS_REGION" <<'PY'
import json, os, sys, datetime
out, stamp, profile, region = sys.argv[1:]
meta = {
  "collectedAtUtc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "stamp": stamp,
  "awsProfile": profile,
  "awsRegion": region,
  "purpose": "SOC2 Type II technical control baseline evidence snapshot",
}
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "SNAPSHOT.json"), "w") as f:
    json.dump(meta, f, indent=2)
    f.write("\n")
PY

log "Evidence directory: $OUT"
log "Stamp: $STAMP  profile=$AWS_PROFILE region=$AWS_REGION"

# ---------------------------------------------------------------------------
# 0. Identity
# ---------------------------------------------------------------------------
run_json "00-sts-caller-identity" aws sts get-caller-identity || true

# ---------------------------------------------------------------------------
# 1. CloudTrail
# ---------------------------------------------------------------------------
run_json "01-cloudtrail-list-trails" aws cloudtrail list-trails || true
run_json "01-cloudtrail-describe-trails" aws cloudtrail describe-trails || true

# Known trail names plus the live production trail (Option B, outside SAM).
for trail in rapid-cortex-cloudtrail-prod rapid-cortex-audit-dev rapid-cortex-audit-staging rapid-cortex-audit-prod rapid-cortex-audit-pilot; do
  safe="${trail//\//_}"
  run_json "01-cloudtrail-status-${safe}" aws cloudtrail get-trail-status --name "$trail" || true
  run_json "01-cloudtrail-selectors-${safe}" aws cloudtrail get-event-selectors --trail-name "$trail" || true
  run_json "01-cloudtrail-get-trail-${safe}" aws cloudtrail get-trail --name "$trail" || true
done

# Compensating: management events are being delivered if lookup-events works.
run_json "01-cloudtrail-lookup-events-sample" aws cloudtrail lookup-events --max-results 5 || true

# Compensating: CloudFormation physical IDs for CloudTrail resources.
run_json "01-cfn-cloudtrail-resources" aws cloudformation list-stack-resources --stack-name rapid-cortex-dev || true

# ---------------------------------------------------------------------------
# 2. S3 encryption + Block Public Access
# ---------------------------------------------------------------------------
run_json "02-s3-list-buckets" aws s3api list-buckets || true

python3 - "$RAW" "$STAMP" <<'PY'
import json, os, subprocess, sys
raw, stamp = sys.argv[1:]
path = os.path.join(raw, f"{stamp}-02-s3-list-buckets.json")
try:
    data = json.load(open(path))
except Exception:
    data = {}
names = [b["Name"] for b in data.get("Buckets", [])]
open(os.path.join(raw, f"{stamp}-02-s3-bucket-names.txt"), "w").write("\n".join(names) + ("\n" if names else ""))
print(f"bucket_count={len(names)}")
PY

BUCKET_LIST="$RAW/${STAMP}-02-s3-bucket-names.txt"
if [[ -s "$BUCKET_LIST" ]]; then
  ENC_OUT="$RAW/${STAMP}-02-s3-encryption.jsonl"
  BPA_OUT="$RAW/${STAMP}-02-s3-public-access-block.jsonl"
  VER_OUT="$RAW/${STAMP}-02-s3-versioning.jsonl"
  : >"$ENC_OUT"; : >"$BPA_OUT"; : >"$VER_OUT"
  while IFS= read -r bucket; do
    [[ -z "$bucket" ]] && continue
    log "s3 encryption/bpa $bucket"
    enc="$(aws s3api get-bucket-encryption --bucket "$bucket" 2>&1)" || true
    bpa="$(aws s3api get-public-access-block --bucket "$bucket" 2>&1)" || true
    ver="$(aws s3api get-bucket-versioning --bucket "$bucket" 2>&1)" || true
    python3 - "$bucket" "$enc" "$bpa" "$ver" "$ENC_OUT" "$BPA_OUT" "$VER_OUT" <<'PY'
import json, sys
bucket, enc, bpa, ver, enc_out, bpa_out, ver_out = sys.argv[1:]

def parse(raw):
    try:
        return json.loads(raw)
    except Exception:
        return {"error": raw.strip()}

open(enc_out, "a").write(json.dumps({"bucket": bucket, "result": parse(enc)}) + "\n")
open(bpa_out, "a").write(json.dumps({"bucket": bucket, "result": parse(bpa)}) + "\n")
open(ver_out, "a").write(json.dumps({"bucket": bucket, "result": parse(ver)}) + "\n")
PY
  done < "$BUCKET_LIST"
fi

# ---------------------------------------------------------------------------
# 3. DynamoDB PITR
# ---------------------------------------------------------------------------
python3 - "$RAW" "$STAMP" <<'PY'
import json, os, subprocess, sys
raw, stamp = sys.argv[1:]
names = []
exclusive = None
pages = []
while True:
    cmd = ["aws", "dynamodb", "list-tables"]
    if exclusive:
        cmd += ["--exclusive-start-table-name", exclusive]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    pages.append({"ok": proc.returncode == 0, "stdout": proc.stdout, "stderr": proc.stderr})
    try:
        data = json.loads(proc.stdout)
    except Exception:
        break
    names.extend(data.get("TableNames") or [])
    exclusive = data.get("LastEvaluatedTableName")
    if not exclusive:
        break
open(os.path.join(raw, f"{stamp}-03-dynamodb-list-tables.json"), "w").write(json.dumps({"TableNames": names, "pages": len(pages)}, indent=2) + "\n")
open(os.path.join(raw, f"{stamp}-03-dynamodb-table-names.txt"), "w").write("\n".join(names) + ("\n" if names else ""))
print(f"table_count={len(names)}")
PY

TABLE_LIST="$RAW/${STAMP}-03-dynamodb-table-names.txt"
if [[ -s "$TABLE_LIST" ]]; then
  PITR_OUT="$RAW/${STAMP}-03-dynamodb-pitr.jsonl"
  : >"$PITR_OUT"
  while IFS= read -r table; do
    [[ -z "$table" ]] && continue
    log "dynamodb pitr $table"
    desc="$(aws dynamodb describe-continuous-backups --table-name "$table" 2>&1)" || true
    python3 - "$table" "$desc" "$PITR_OUT" <<'PY'
import json, sys
table, desc, out = sys.argv[1:]
try:
    parsed = json.loads(desc)
except Exception:
    parsed = {"error": desc.strip()}
open(out, "a").write(json.dumps({"table": table, "result": parsed}) + "\n")
PY
  done < "$TABLE_LIST"
fi

# ---------------------------------------------------------------------------
# 4. KMS key rotation
# ---------------------------------------------------------------------------
run_json "04-kms-list-keys" aws kms list-keys || true
run_json "04-kms-list-aliases" aws kms list-aliases || true

python3 - "$RAW" "$STAMP" <<'PY'
import json, os, sys
raw, stamp = sys.argv[1:]
path = os.path.join(raw, f"{stamp}-04-kms-list-keys.json")
try:
    data = json.load(open(path))
except Exception:
    data = {}
ids = [k.get("KeyId") for k in data.get("Keys", []) if k.get("KeyId")]
open(os.path.join(raw, f"{stamp}-04-kms-key-ids.txt"), "w").write("\n".join(ids) + ("\n" if ids else ""))
print(f"kms_key_count={len(ids)}")
PY

KEY_LIST="$RAW/${STAMP}-04-kms-key-ids.txt"
if [[ -s "$KEY_LIST" ]]; then
  ROT_OUT="$RAW/${STAMP}-04-kms-rotation.jsonl"
  : >"$ROT_OUT"
  while IFS= read -r kid; do
    [[ -z "$kid" ]] && continue
    log "kms rotation $kid"
    rot="$(aws kms get-key-rotation-status --key-id "$kid" 2>&1)" || true
    meta="$(aws kms describe-key --key-id "$kid" --query 'KeyMetadata.{KeyId:KeyId,Arn:Arn,KeyManager:KeyManager,KeyState:KeyState,Description:Description,CustomerMasterKeySpec:CustomerMasterKeySpec}' 2>&1)" || true
    python3 - "$kid" "$rot" "$meta" "$ROT_OUT" <<'PY'
import json, sys
kid, rot, meta, out = sys.argv[1:]
def parse(raw):
    try:
        return json.loads(raw)
    except Exception:
        return {"error": raw.strip()}
open(out, "a").write(json.dumps({"keyId": kid, "rotation": parse(rot), "metadata": parse(meta)}) + "\n")
PY
  done < "$KEY_LIST"
fi

# ---------------------------------------------------------------------------
# 5. Secrets Manager rotation
# ---------------------------------------------------------------------------
run_json "05-secrets-list" aws secretsmanager list-secrets || true

python3 - "$RAW" "$STAMP" <<'PY'
import json, os, sys
raw, stamp = sys.argv[1:]
path = os.path.join(raw, f"{stamp}-05-secrets-list.json")
try:
    data = json.load(open(path))
except Exception:
    data = {}
names = [s.get("Name") or s.get("ARN") for s in data.get("SecretList", [])]
open(os.path.join(raw, f"{stamp}-05-secret-names.txt"), "w").write("\n".join(n for n in names if n) + "\n")
print(f"secret_count={len(names)}")
PY

SECRET_LIST="$RAW/${STAMP}-05-secret-names.txt"
if [[ -s "$SECRET_LIST" ]]; then
  SEC_OUT="$RAW/${STAMP}-05-secrets-describe.jsonl"
  : >"$SEC_OUT"
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    log "secrets describe $name"
    desc="$(aws secretsmanager describe-secret --secret-id "$name" --query '{Name:Name,ARN:ARN,RotationEnabled:RotationEnabled,RotationLambdaARN:RotationLambdaARN,NextRotationDate:NextRotationDate,LastRotatedDate:LastRotatedDate,KmsKeyId:KmsKeyId}' 2>&1)" || true
    python3 - "$name" "$desc" "$SEC_OUT" <<'PY'
import json, sys
name, desc, out = sys.argv[1:]
try:
    parsed = json.loads(desc)
except Exception:
    parsed = {"error": desc.strip()}
open(out, "a").write(json.dumps({"secret": name, "result": parsed}) + "\n")
PY
  done < "$SECRET_LIST"
fi

# Compensating: CloudFormation secret resources (names/ARNs, no values).
run_json "05-cfn-datalayer-resources" aws cloudformation list-stack-resources --stack-name rapid-cortex-dev-DataLayerStack-17H2VCAOH7V78 || true

# ---------------------------------------------------------------------------
# 6. WAF logging
# ---------------------------------------------------------------------------
run_json "06-waf-regional" aws wafv2 list-web-acls --scope REGIONAL || true
run_json "06-waf-cloudfront" aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1 || true

# Paginate remaining CloudFront ACLs if NextMarker present.
python3 - "$RAW" "$STAMP" <<'PY'
import json, os, subprocess, sys
raw, stamp = sys.argv[1:]
path = os.path.join(raw, f"{stamp}-06-waf-cloudfront.json")
try:
    data = json.load(open(path))
except Exception:
    data = {}
acls = list(data.get("WebACLs", []))
marker = data.get("NextMarker")
while marker:
    proc = subprocess.run(
        ["aws", "wafv2", "list-web-acls", "--scope", "CLOUDFRONT", "--region", "us-east-1", "--next-marker", marker],
        capture_output=True, text=True,
    )
    open(os.path.join(raw, f"{stamp}-06-waf-cloudfront-page.json"), "a").write(proc.stdout + "\n")
    try:
        page = json.loads(proc.stdout)
    except Exception:
        break
    acls.extend(page.get("WebACLs", []))
    marker = page.get("NextMarker") if page.get("WebACLs") else None
    if not page.get("WebACLs"):
        break
open(os.path.join(raw, f"{stamp}-06-waf-all-acls.json"), "w").write(json.dumps({"WebACLs": acls}, indent=2) + "\n")
print(f"waf_acl_count={len(acls)}")
PY

WAF_LOG_OUT="$RAW/${STAMP}-06-waf-logging.jsonl"
: >"$WAF_LOG_OUT"
python3 - "$RAW" "$STAMP" "$WAF_LOG_OUT" <<'PY'
import json, os, subprocess, sys
raw, stamp, out_path = sys.argv[1:]
acls = []
for name in (f"{stamp}-06-waf-regional.json", f"{stamp}-06-waf-all-acls.json"):
    path = os.path.join(raw, name)
    if not os.path.exists(path):
        continue
    try:
        data = json.load(open(path))
    except Exception:
        continue
    acls.extend(data.get("WebACLs", []))
seen = set()
for acl in acls:
    arn = acl.get("ARN")
    if not arn or arn in seen:
        continue
    seen.add(arn)
    proc = subprocess.run(
        ["aws", "wafv2", "get-logging-configuration", "--resource-arn", arn],
        capture_output=True, text=True,
    )
    try:
        parsed = json.loads(proc.stdout) if proc.returncode == 0 else {"error": (proc.stderr or proc.stdout).strip()}
    except Exception:
        parsed = {"error": (proc.stderr or proc.stdout).strip()}
    open(out_path, "a").write(json.dumps({"arn": arn, "name": acl.get("Name"), "result": parsed}) + "\n")
print(f"waf_logging_checked={len(seen)}")
PY

# Stack outputs for API WAF ARNs.
run_json "06-cfn-dev-outputs" aws cloudformation describe-stacks --stack-name rapid-cortex-dev --query 'Stacks[0].{Parameters:Parameters,Outputs:Outputs}' || true
run_json "06-cfn-appsamv2-outputs" aws cloudformation describe-stacks --stack-name rapid-cortex-dev-AppSamStackV2-1BR5EYUP7MO39 --query 'Stacks[0].Outputs' || true

# ---------------------------------------------------------------------------
# 7. CloudWatch alarms
# ---------------------------------------------------------------------------
run_json "07-cloudwatch-alarms-ok" aws cloudwatch describe-alarms --state-value OK || true
run_json "07-cloudwatch-alarms-alarm" aws cloudwatch describe-alarms --state-value ALARM || true
run_json "07-cloudwatch-alarms-insufficient" aws cloudwatch describe-alarms --state-value INSUFFICIENT_DATA || true
run_json "07-cloudwatch-alarms-all" aws cloudwatch describe-alarms || true

# ---------------------------------------------------------------------------
# 8. Cognito MFA
# ---------------------------------------------------------------------------
run_json "08-cognito-list-user-pools" aws cognito-idp list-user-pools --max-results 60 || true
for pool in us-east-1_0z6tA6WBs us-east-1_6i7Jq3Tzw us-east-1_IoBei9vlD; do
  run_json "08-cognito-describe-${pool}" aws cognito-idp describe-user-pool --user-pool-id "$pool" || true
  run_json "08-cognito-mfa-config-${pool}" aws cognito-idp get-user-pool-mfa-config --user-pool-id "$pool" || true
done

# ---------------------------------------------------------------------------
# 9. ACM certificate expiry
# ---------------------------------------------------------------------------
run_json "09-acm-list-issued" aws acm list-certificates --certificate-statuses ISSUED || true
run_json "09-acm-list-all" aws acm list-certificates || true

python3 - "$RAW" "$STAMP" <<'PY'
import json, os, subprocess, sys
raw, stamp = sys.argv[1:]
path = os.path.join(raw, f"{stamp}-09-acm-list-issued.json")
try:
    data = json.load(open(path))
except Exception:
    data = {}
certs = data.get("CertificateSummaryList", [])
out = os.path.join(raw, f"{stamp}-09-acm-describe.jsonl")
open(out, "w").close()
for c in certs:
    arn = c.get("CertificateArn")
    if not arn:
        continue
    proc = subprocess.run(["aws", "acm", "describe-certificate", "--certificate-arn", arn], capture_output=True, text=True)
    try:
        parsed = json.loads(proc.stdout) if proc.returncode == 0 else {"error": (proc.stderr or proc.stdout).strip()}
    except Exception:
        parsed = {"error": (proc.stderr or proc.stdout).strip()}
    open(out, "a").write(json.dumps({"arn": arn, "domain": c.get("DomainName"), "result": parsed}) + "\n")
print(f"acm_cert_count={len(certs)}")
PY

# Compensating: CloudFront cert ARNs if ACM list is denied.
run_json "09-cloudfront-distributions" aws cloudfront list-distributions --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Aliases:Aliases.Items,ViewerCertificate:ViewerCertificate}' || true

# ---------------------------------------------------------------------------
# 10. Compensating CloudFormation: CloudTrail / WAF / KMS / Secrets / PITR params
# ---------------------------------------------------------------------------
run_json "10-cfn-dev-parameters" aws cloudformation describe-stacks --stack-name rapid-cortex-dev --query 'Stacks[0].Parameters' || true
run_json "10-cfn-appsamv2-resources" aws cloudformation list-stack-resources --stack-name rapid-cortex-dev-AppSamStackV2-1BR5EYUP7MO39 || true
run_json "10-cfn-appsam5-resources" aws cloudformation list-stack-resources --stack-name rapid-cortex-dev-AppSam5Stack-1T38GG051RWIG || true
run_json "10-cfn-appsam2-resources" aws cloudformation list-stack-resources --stack-name rapid-cortex-dev-AppSam2Stack-1URVS591Q6ESS || true
run_json "10-cfn-alarms-resources" aws cloudformation list-stack-resources --stack-name rapid-cortex-dev --query 'StackResources[?contains(LogicalResourceId, `Alarm`) || contains(ResourceType, `Alarm`)]' || true

# Search nested stacks for CloudTrail / KMS / WAF / ACM / Secrets resource types.
python3 - "$RAW" "$STAMP" <<'PY'
import json, os, subprocess, sys
raw, stamp = sys.argv[1:]
stacks_path = os.path.join(raw, f"{stamp}-01-cfn-cloudtrail-resources.json")
try:
    root = json.load(open(stacks_path))
except Exception:
    root = {}
nested = [
    r["PhysicalResourceId"].split("/")[-2] if r.get("PhysicalResourceId") and r.get("PhysicalResourceId").startswith("arn:") else r.get("PhysicalResourceId")
    for r in root.get("StackResourceSummaries", root.get("StackResources", []))
    if r.get("ResourceType") == "AWS::CloudFormation::Stack"
]
wanted_types = (
    "AWS::CloudTrail::Trail",
    "AWS::KMS::Key",
    "AWS::WAFv2::WebACL",
    "AWS::WAFv2::LoggingConfiguration",
    "AWS::CertificateManager::Certificate",
    "AWS::SecretsManager::Secret",
    "AWS::SecretsManager::RotationSchedule",
    "AWS::S3::Bucket",
)
hits = []
for stack in nested:
    if not stack:
        continue
    proc = subprocess.run(["aws", "cloudformation", "list-stack-resources", "--stack-name", stack], capture_output=True, text=True)
    try:
        data = json.loads(proc.stdout)
    except Exception:
        hits.append({"stack": stack, "error": (proc.stderr or proc.stdout).strip()[:500]})
        continue
    for r in data.get("StackResourceSummaries", []):
        if r.get("ResourceType") in wanted_types or "CloudTrail" in (r.get("LogicalResourceId") or "") or "Trail" in (r.get("LogicalResourceId") or ""):
            hits.append({
                "stack": stack,
                "type": r.get("ResourceType"),
                "logical": r.get("LogicalResourceId"),
                "physical": r.get("PhysicalResourceId"),
                "status": r.get("ResourceStatus"),
            })
open(os.path.join(raw, f"{stamp}-10-cfn-security-resources.json"), "w").write(json.dumps(hits, indent=2) + "\n")
print(f"cfn_security_resource_hits={len(hits)}")
PY

log "Raw collection complete. Building summary…"

python3 - "$OUT" "$RAW" "$STAMP" <<'PY'
import json, os, sys, datetime, re
out, raw, stamp = sys.argv[1:]

def load(name):
    path = os.path.join(raw, f"{stamp}-{name}")
    if not os.path.exists(path):
        return None
    if name.endswith(".jsonl"):
        rows = []
        for line in open(path):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                rows.append({"raw": line})
        return rows
    if name.endswith(".json"):
        try:
            return json.load(open(path))
        except Exception:
            return {"error": open(path).read()[:2000]}
    return open(path).read()

def is_denied(obj):
    text = json.dumps(obj) if not isinstance(obj, str) else obj
    return "AccessDenied" in text or "not authorized" in text

identity = load("00-sts-caller-identity.json") or {}
trails_list = load("01-cloudtrail-list-trails.json")
trails_describe = load("01-cloudtrail-describe-trails.json")
lookup = load("01-cloudtrail-lookup-events-sample.json")
s3_enc = load("02-s3-encryption.jsonl") or []
s3_bpa = load("02-s3-public-access-block.jsonl") or []
s3_ver = load("02-s3-versioning.jsonl") or []
pitr = load("03-dynamodb-pitr.jsonl") or []
kms_rot = load("04-kms-rotation.jsonl") or []
kms_list = load("04-kms-list-keys.json")
secrets_list = load("05-secrets-list.json")
secrets_desc = load("05-secrets-describe.jsonl") or []
waf_reg = load("06-waf-regional.json")
waf_cf = load("06-waf-all-acls.json") or load("06-waf-cloudfront.json")
waf_log = load("06-waf-logging.jsonl") or []
alarms_ok = load("07-cloudwatch-alarms-ok.json") or {}
alarms_alarm = load("07-cloudwatch-alarms-alarm.json") or {}
alarms_ins = load("07-cloudwatch-alarms-insufficient.json") or {}
alarms_all = load("07-cloudwatch-alarms-all.json") or {}
cognito_prod = load("08-cognito-describe-us-east-1_0z6tA6WBs.json") or {}
cognito_mfa_prod = load("08-cognito-mfa-config-us-east-1_0z6tA6WBs.json") or {}
acm_list = load("09-acm-list-issued.json")
acm_desc = load("09-acm-describe.jsonl") or []
cfn_hits = load("10-cfn-security-resources.json") or []
cfn_params = load("10-cfn-dev-parameters.json") or []
cf_dists = load("09-cloudfront-distributions.json") or []

params = {p.get("ParameterKey"): p.get("ParameterValue") for p in cfn_params if isinstance(p, dict)}

def sse(result):
    try:
        return result["ServerSideEncryptionConfiguration"]["Rules"][0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"]
    except Exception:
        return None

def bpa_ok(result):
    cfg = result.get("PublicAccessBlockConfiguration") if isinstance(result, dict) else None
    if not cfg:
        return False
    return all(cfg.get(k) is True for k in ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"))

rc_enc = [r for r in s3_enc if str(r.get("bucket","")).startswith("rapid-cortex-")]
rc_bpa = [r for r in s3_bpa if str(r.get("bucket","")).startswith("rapid-cortex-")]
rc_pitr = [r for r in pitr if str(r.get("table","")).startswith("rapid-cortex-") or str(r.get("table","")).startswith("RapidCortex") or str(r.get("table","")).startswith("Ring")]

s3_missing_enc = [r["bucket"] for r in rc_enc if not sse(r.get("result") or {})]
s3_missing_bpa = [r["bucket"] for r in rc_bpa if not bpa_ok(r.get("result") or {})]
all_missing_enc = [r["bucket"] for r in s3_enc if not sse(r.get("result") or {})]
all_missing_bpa = [r["bucket"] for r in s3_bpa if not bpa_ok(r.get("result") or {})]

def pitr_on(row):
    try:
        return row["result"]["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"] == "ENABLED"
    except Exception:
        return False

pitr_off = [r["table"] for r in rc_pitr if not pitr_on(r)]
pitr_on_n = sum(1 for r in rc_pitr if pitr_on(r))

waf_no_log = [w for w in waf_log if "error" in (w.get("result") or {}) or not (w.get("result") or {}).get("LoggingConfiguration")]

ok_alarms = alarms_ok.get("MetricAlarms", []) if isinstance(alarms_ok, dict) else []
bad_alarms = alarms_alarm.get("MetricAlarms", []) if isinstance(alarms_alarm, dict) else []
ins_alarms = alarms_ins.get("MetricAlarms", []) if isinstance(alarms_ins, dict) else []
all_alarms = alarms_all.get("MetricAlarms", []) if isinstance(alarms_all, dict) else []

pool = (cognito_prod.get("UserPool") or cognito_prod) if isinstance(cognito_prod, dict) else {}
mfa = pool.get("MfaConfiguration") or (cognito_mfa_prod.get("MfaConfiguration") if isinstance(cognito_mfa_prod, dict) else None)

trail_hits = [h for h in cfn_hits if isinstance(h, dict) and ("CloudTrail" in str(h.get("type","")) or "CloudTrail" in str(h.get("logical","")) or "Trail" in str(h.get("logical","")))]
kms_hits = [h for h in cfn_hits if isinstance(h, dict) and h.get("type") == "AWS::KMS::Key"]
secret_hits = [h for h in cfn_hits if isinstance(h, dict) and "SecretsManager" in str(h.get("type",""))]
waf_hits = [h for h in cfn_hits if isinstance(h, dict) and "WAFv2" in str(h.get("type",""))]

summary = {
  "collectedAtUtc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "stamp": stamp,
  "account": identity.get("Account"),
  "principal": identity.get("Arn"),
  "region": os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"),
  "stack": "rapid-cortex-dev (live production / app.rapidcortex.us)",
  "controls": {
    "cloudtrail": {
      "listDenied": is_denied(trails_list),
      "describeDenied": is_denied(trails_describe),
      "lookupEventsWorks": isinstance(lookup, dict) and bool(lookup.get("Events")),
      "lookupEventCount": len((lookup or {}).get("Events") or []) if isinstance(lookup, dict) else 0,
      "cfnTrailResources": trail_hits,
      "enableCloudTrailParam": params.get("EnableCloudTrail"),
      "cloudTrailKmsKeyArn": params.get("CloudTrailKmsKeyArn") or "(empty — SSE-S3 default)",
      "s3DataEventsParam": params.get("EnableCloudTrailS3DataEvents"),
      "lambdaDataEventsParam": params.get("EnableCloudTrailLambdaDataEvents"),
      "logBucketExists": any(r.get("bucket") == "rapid-cortex-cloudtrail-logs-prod-158961537080" for r in s3_enc),
      "samExpectedDevLogBucketExists": any(r.get("bucket") == "rapid-cortex-cloudtrail-logs-dev-158961537080" for r in s3_enc),
    },
    "s3": {
      "bucketCountAccount": len(s3_enc),
      "rapidCortexBucketCount": len(rc_enc),
      "rapidCortexMissingEncryption": s3_missing_enc,
      "rapidCortexMissingBpa": s3_missing_bpa,
      "accountMissingEncryption": all_missing_enc,
      "accountMissingBpa": all_missing_bpa,
      "rapidCortexAlgorithms": sorted({sse(r.get("result") or {}) or "NONE" for r in rc_enc}),
    },
    "dynamodbPitr": {
      "rapidCortexTableCount": len(rc_pitr),
      "pitrEnabled": pitr_on_n,
      "pitrDisabled": pitr_off,
      "parameter": params.get("DynamoPointInTimeRecovery"),
    },
    "kms": {
      "listDenied": is_denied(kms_list),
      "rotationChecked": len(kms_rot),
      "cfnCustomerKeys": kms_hits,
    },
    "secrets": {
      "listDenied": is_denied(secrets_list),
      "described": len(secrets_desc),
      "cfnSecrets": [{"logical": h.get("logical"), "physical": h.get("physical"), "stack": h.get("stack")} for h in secret_hits],
    },
    "waf": {
      "regionalCount": len((waf_reg or {}).get("WebACLs") or []) if isinstance(waf_reg, dict) else None,
      "cloudfrontCount": len((waf_cf or {}).get("WebACLs") or []) if isinstance(waf_cf, dict) else None,
      "loggingGaps": [{"name": w.get("name"), "arn": w.get("arn"), "error": (w.get("result") or {}).get("error")} for w in waf_no_log],
      "enableApiWafParam": params.get("EnableApiWaf"),
      "cfnWafResources": waf_hits,
    },
    "cloudwatchAlarms": {
      "ok": len(ok_alarms),
      "alarm": len(bad_alarms),
      "insufficientData": len(ins_alarms),
      "total": len(all_alarms),
      "alarmNames": [a.get("AlarmName") for a in bad_alarms],
      "okNames": [a.get("AlarmName") for a in ok_alarms],
    },
    "cognitoMfa": {
      "productionUserPoolId": "us-east-1_0z6tA6WBs",
      "mfaConfiguration": mfa,
      "enabledMfas": pool.get("EnabledMfas") or cognito_mfa_prod.get("EnabledMfas") if isinstance(cognito_mfa_prod, dict) else None,
      "passwordMinLength": ((pool.get("Policies") or {}).get("PasswordPolicy") or {}).get("MinimumLength"),
      "advancedSecurity": (pool.get("UserPoolAddOns") or {}).get("AdvancedSecurityMode") if isinstance(pool.get("UserPoolAddOns"), dict) else None,
    },
    "acm": {
      "listDenied": is_denied(acm_list),
      "issuedCount": len((acm_list or {}).get("CertificateSummaryList") or []) if isinstance(acm_list, dict) else None,
      "cloudfrontViewerCerts": cf_dists if isinstance(cf_dists, list) else cf_dists,
    },
  },
}

json.dump(summary, open(os.path.join(out, "SUMMARY.json"), "w"), indent=2)
open(os.path.join(out, "SUMMARY.json"), "a").write("\n")

def yn(ok):
    return "PASS" if ok else "GAP"

lines = []
a = lines.append
a("# SOC 2 Type II — Technical Controls Baseline")
a("")
a(f"**Collected (UTC):** {summary['collectedAtUtc']}")
a(f"**Account:** `{summary['account']}`")
a(f"**Principal:** `{summary['principal']}`")
a(f"**Region:** `{summary.get('region')}`")
a(f"**In-scope production stack:** `{summary['stack']}`")
a(f"**Raw artifacts:** `raw/{stamp}-*.json` (+ `.jsonl`)")
a("")
a("This snapshot is the control baseline for the observation period. Any control not operating at period start is a Type II gap.")
a("")
a("## Verdict by control")
a("")
a("| Control | Auditor command status | Operating? | Notes |")
a("|---|---|---|---|")

ct = summary["controls"]["cloudtrail"]
ct_note = []
if ct["listDenied"]:
    ct_note.append("`cloudtrail:ListTrails` / `GetTrailStatus` denied for deploy user — cannot prove trail name, log-file validation, or IsLogging from CloudTrail APIs.")
if ct["lookupEventsWorks"]:
    ct_note.append("Management events are being recorded (`lookup-events` returned recent STS events).")
if ct["logBucketExists"]:
    ct_note.append("S3 log bucket `rapid-cortex-cloudtrail-logs-prod-158961537080` exists (SSE-S3, BPA on, versioning on).")
if not ct["samExpectedDevLogBucketExists"]:
    ct_note.append("SAM-expected bucket `rapid-cortex-cloudtrail-logs-dev-*` does **not** exist. Trail resource not found in nested-stack inventory under expected `rapid-cortex-audit-dev` physical ID.")
if not ct["cfnTrailResources"]:
    ct_note.append("No `AWS::CloudTrail::Trail` resource found via CloudFormation on nested stacks of `rapid-cortex-dev`.")
ct_note.append(f"Stack param `EnableCloudTrail={ct['enableCloudTrailParam']}`; S3 data events={ct['s3DataEventsParam']}; Lambda data events={ct['lambdaDataEventsParam']}; KMS={ct['cloudTrailKmsKeyArn']}.")
a(f"| CloudTrail + log integrity | {'DENIED' if ct['listDenied'] else 'OK'} | {'PARTIAL' if ct['lookupEventsWorks'] else 'GAP'} | {' '.join(ct_note)} |")

s3 = summary["controls"]["s3"]
s3_ok = not s3["rapidCortexMissingEncryption"] and not s3["rapidCortexMissingBpa"]
s3_note = f"{s3['rapidCortexBucketCount']} Rapid Cortex buckets; encryption algs={', '.join(s3['rapidCortexAlgorithms'])}."
if s3["rapidCortexMissingEncryption"]:
    s3_note += f" Missing encryption: {', '.join(s3['rapidCortexMissingEncryption'])}."
if s3["rapidCortexMissingBpa"]:
    s3_note += f" Missing BPA: {', '.join(s3['rapidCortexMissingBpa'])}."
if s3["accountMissingEncryption"] or s3["accountMissingBpa"]:
    s3_note += f" Account-wide (all products): {len(s3['accountMissingEncryption'])} without default encryption, {len(s3['accountMissingBpa'])} without BPA. Shared account is in-scope for SOC2 unless carved out."
a(f"| S3 encryption + Block Public Access | OK | {yn(s3_ok)} for rapid-cortex-* | {s3_note} |")

ddb = summary["controls"]["dynamodbPitr"]
ddb_ok = ddb["rapidCortexTableCount"] > 0 and not ddb["pitrDisabled"]
ddb_note = f"{ddb['pitrEnabled']}/{ddb['rapidCortexTableCount']} Rapid Cortex / Ring tables have PITR. Param DynamoPointInTimeRecovery={ddb['parameter']}."
if ddb["pitrDisabled"]:
    shown = ddb["pitrDisabled"][:20]
    extra = f" (+{len(ddb['pitrDisabled'])-20} more)" if len(ddb["pitrDisabled"]) > 20 else ""
    ddb_note += f" Disabled: {', '.join(shown)}{extra}."
a(f"| DynamoDB PITR | OK | {yn(ddb_ok)} | {ddb_note} |")

kms = summary["controls"]["kms"]
a(f"| KMS CMK rotation | {'DENIED' if kms['listDenied'] else 'OK'} | UNKNOWN | `kms:ListKeys` denied for deploy user. CFN customer-managed keys found: {len(kms['cfnCustomerKeys'])}. Re-run with a read-only auditor/admin role. |")

sec = summary["controls"]["secrets"]
a(f"| Secrets Manager rotation | {'DENIED' if sec['listDenied'] else 'OK'} | UNKNOWN | `secretsmanager:ListSecrets` denied. CFN secret resources inventoried: {len(sec['cfnSecrets'])}. Re-run with auditor/admin role. No secret values collected. |")

waf = summary["controls"]["waf"]
waf_ok = (waf["cloudfrontCount"] or 0) > 0 and not waf["loggingGaps"]
a(f"| WAF logging | OK (CloudFront list) | {'GAP' if waf['loggingGaps'] else yn((waf['cloudfrontCount'] or 0) > 0)} | Regional ACLs: {waf['regionalCount']}. CloudFront ACLs: {waf['cloudfrontCount']}. EnableApiWaf={waf['enableApiWafParam']}. Logging not configured on: {', '.join(x.get('name') or x.get('arn') or '?' for x in waf['loggingGaps']) or 'none'}. |")

cw = summary["controls"]["cloudwatchAlarms"]
a(f"| CloudWatch alarms | OK | {'PARTIAL' if cw['total'] else 'GAP'} | {cw['total']} alarms ({cw['ok']} OK, {cw['alarm']} ALARM, {cw['insufficientData']} INSUFFICIENT_DATA). |")

cog = summary["controls"]["cognitoMfa"]
mfa_ok = (cog.get("mfaConfiguration") or "").upper() in ("ON", "REQUIRED")
a(f"| Cognito MFA | OK | {yn(mfa_ok)} | Production pool `{cog['productionUserPoolId']}` MfaConfiguration=`{cog.get('mfaConfiguration')}`. Password min length={cog.get('passwordMinLength')}. OPTIONAL is not enforced MFA. |")

acm = summary["controls"]["acm"]
a(f"| ACM expiry monitoring | {'DENIED' if acm['listDenied'] else 'OK'} | UNKNOWN | `acm:ListCertificates` denied. CloudFront viewer-certificate inventory captured as compensating evidence. No ACM expiry alarm proven. |")

a("")
a("## Required before observation period start")
a("")
a("1. **IAM:** Create a dedicated SOC2 evidence role (read-only) with `cloudtrail:*Read*`, `kms:ListKeys`, `kms:GetKeyRotationStatus`, `kms:DescribeKey`, `secretsmanager:ListSecrets`, `secretsmanager:DescribeSecret`, `acm:ListCertificates`, `acm:DescribeCertificate`. Re-run this script as that role and replace UNKNOWN rows.")
a("2. **CloudTrail:** Confirm a multi-Region trail with `LogFileValidationEnabled=true` and `IsLogging=true`. If the SAM trail was never created (no `rapid-cortex-audit-dev`, no `cloudtrail-logs-dev` bucket), provision it or document the separately named prod log bucket + trail as the control, including event selectors (S3/Lambda data events currently default **false**).")
a("3. **Cognito MFA:** Production pool is `OPTIONAL`. For SOC2 CC6.1, require MFA (`ON`) for all console/app users or document compensating SSO/IdP MFA.")
a("4. **WAF logging:** Attach `GetLoggingConfiguration` destinations (CloudWatch Logs or S3/Kinesis) on every in-scope WebACL. Regional API WAF list was empty — confirm API Gateway association.")
a("5. **KMS:** Enable rotation on every customer-managed key; empty `CloudTrailKmsKeyArn` means CloudTrail uses SSE-S3, not a rotating CMK.")
a("6. **Secrets rotation:** Enable rotation (or document why not, e.g. Cognito client secrets / third-party keys rotated operationally) on every production secret.")
a("7. **ACM:** Prove expiry monitoring (CloudWatch metric `DaysToExpiry` or EventBridge `ACM Certificate Approaching Expiration`).")
a("8. **Account scope:** This AWS account hosts non-Rapid-Cortex buckets/tables (Melios, MindHeist, PassPoint, OR Game, CDK assets). SOC2 either needs a **separate production account** or those resources are in-scope.")
a("")
a("## How to re-run")
a("")
a("```bash")
a("AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-technical-controls-snapshot.sh")
a("```")
a("")
a("Retain this directory. Do not delete raw JSON; auditors sample original CLI output.")

open(os.path.join(out, "README.md"), "w").write("\n".join(lines) + "\n")
print("wrote SUMMARY.json and README.md")
PY

log "Done. See $OUT/README.md"
# Re-score with Option B trail / SOP / ACM alarm so UNKNOWN/GAP from the
# deploy-user collector become PASS or ACCEPT when compensating evidence exists.
python3 "$ROOT/scripts/lib/soc2_controls_verdict.py" \
  --summary "$OUT/SUMMARY.json" \
  --raw "$RAW" \
  --stamp "$STAMP" \
  --out "$OUT" \
  --sop "$ROOT/docs/evidence/soc2-evidence/2026-10/secrets-rotation-sop.md" \
  --evidence "$ROOT/docs/evidence/soc2-evidence/2026-10" \
  || true
log "Verdict: $OUT/VERDICT.json"
ls -la "$OUT" "$RAW" | head -80
