#!/usr/bin/env bash
# Remaining SOC 2 October-1 controls + evidence pack.
# Live production is DeploymentStage=dev. Do not rely on stage conditions.
set -u
export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVID="${SOC2_EVIDENCE_DIR:-$ROOT/docs/evidence/soc2-evidence/2026-10}"
COMPLY="/Volumes/Mac Mini/Business Documents/Compliance/Rapid Cortex Compliance/06 - AWS & Infrastructure Security/Evidence/2026-10"
mkdir -p "$EVID"
mkdir -p "$COMPLY" 2>/dev/null || true
cp_ev() { cp "$1" "$COMPLY/" 2>/dev/null || true; }

ACCOUNT=158961537080
TRAIL=rapid-cortex-cloudtrail-prod
POOL=us-east-1_0z6tA6WBs
SNS="arn:aws:sns:us-east-1:${ACCOUNT}:rapid-cortex-dev-AppSamStackV2-1BR5EYUP7MO39-OpsAlertsTopic-p56TnLJKwZWR"
CERT="arn:aws:acm:us-east-1:${ACCOUNT}:certificate/cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5"
CF_WAF="arn:aws:wafv2:us-east-1:${ACCOUNT}:global/webacl/rapid-cortex-httpapi-cdn-waf-dev/7f68bde8-cc59-4b9d-bed7-dd1f66e7eeef"
CDN_WAF="arn:aws:wafv2:us-east-1:${ACCOUNT}:global/webacl/rapid-cortex-v2-web-cdn-prod/a52d3854-ff3c-45c6-bf2a-b140213ef625"
AUDITOR_ROLE="${SOC2_AUDITOR_ROLE:-rc-soc2-auditor}"
AUDITOR_ROLE_FALLBACK=rapid-cortex-soc2-auditor

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# --- Fix 1: auditor role (rc-soc2-auditor; fall back to rapid-cortex-* if IAM path is scoped) ---
ensure_auditor_role() {
  local name="$1"
  log "Creating $name"
  local TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::'"$ACCOUNT"':root"},"Action":"sts:AssumeRole"}]}'
  if ! aws iam create-role --role-name "$name" --assume-role-policy-document "$TRUST" \
    --description "SOC 2 Type II auditor read-only (SecurityAudit + extra reads)" 2>/dev/null; then
    aws iam get-role --role-name "$name" >/dev/null 2>&1 || return 1
  fi
  aws iam update-assume-role-policy --role-name "$name" --policy-document "$TRUST"
  aws iam attach-role-policy --role-name "$name" --policy-arn arn:aws:iam::aws:policy/SecurityAudit 2>&1 | tee "$EVID/auditor-attach-securityaudit.txt" || true
  aws iam attach-role-policy --role-name "$name" --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess 2>&1 | tee "$EVID/auditor-attach-readonly.txt" || true
  aws iam put-role-policy --role-name "$name" --policy-name soc2-additional-reads --policy-document '{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Action":[
    "kms:ListKeys","kms:ListAliases","kms:DescribeKey","kms:GetKeyRotationStatus",
    "secretsmanager:ListSecrets","secretsmanager:DescribeSecret",
    "acm:ListCertificates","acm:DescribeCertificate",
    "cloudtrail:DescribeTrails","cloudtrail:GetTrail","cloudtrail:GetTrailStatus","cloudtrail:GetEventSelectors","cloudtrail:ListTrails","cloudtrail:LookupEvents",
    "wafv2:ListWebACLs","wafv2:GetLoggingConfiguration","wafv2:GetWebACL","wafv2:ListResourcesForWebACL",
    "dynamodb:ListTables","dynamodb:DescribeContinuousBackups","dynamodb:DescribeTable",
    "s3:ListAllMyBuckets","s3:GetBucketEncryption","s3:GetBucketPublicAccessBlock","s3:GetBucketVersioning",
    "cognito-idp:ListUserPools","cognito-idp:DescribeUserPool","cognito-idp:GetUserPoolMfaConfig",
    "cloudwatch:DescribeAlarms","iam:GetRole","iam:ListAttachedRolePolicies","iam:GetRolePolicy","sts:GetCallerIdentity"
  ],"Resource":"*"}]
}'
  aws iam get-role --role-name "$name" > "$EVID/auditor-role.json"
  aws iam list-attached-role-policies --role-name "$name" > "$EVID/auditor-attached-policies.json" 2>/dev/null || true
  return 0
}

if ! ensure_auditor_role "$AUDITOR_ROLE"; then
  log "IAM denied $AUDITOR_ROLE (deploy policy is rapid-cortex-* until sam-deploy-policy-soc2 is attached); using $AUDITOR_ROLE_FALLBACK"
  ensure_auditor_role "$AUDITOR_ROLE_FALLBACK" || true
fi
cp_ev "$EVID/auditor-role.json"

# Keep the previously created evidence-readonly role as a second principal.
aws iam get-role --role-name rapid-cortex-soc2-evidence-readonly > "$EVID/auditor-role-evidence-readonly.json" 2>/dev/null || true

# --- Fix 2: CloudTrail Option B (existing trail) ---
log "CloudTrail $TRAIL"
aws cloudtrail describe-trails --trail-name-list "$TRAIL" > "$EVID/cloudtrail-describe.json"
aws cloudtrail get-trail-status --name "$TRAIL" > "$EVID/cloudtrail-status.json"
aws cloudtrail update-trail --name "$TRAIL" --enable-log-file-validation >/dev/null
python3 - "$TRAIL" "$EVID/cloudtrail-event-selectors.json" <<'PY'
import json, subprocess, sys
trail, out_path = sys.argv[1:]
buckets = json.loads(subprocess.check_output(["aws","s3api","list-buckets"]))["Buckets"]
s3 = [f"arn:aws:s3:::{b['Name']}/" for b in buckets if b["Name"].startswith("rapid-cortex-")]
selectors = [{
  "ReadWriteType": "All",
  "IncludeManagementEvents": True,
  "DataResources": [
    {"Type": "AWS::S3::Object", "Values": s3},
    {"Type": "AWS::Lambda::Function", "Values": ["arn:aws:lambda"]},
  ],
}]
open("/tmp/rc-ct-selectors.json","w").write(json.dumps({"TrailName": trail, "EventSelectors": selectors}))
proc = subprocess.run(["aws","cloudtrail","put-event-selectors","--cli-input-json","file:///tmp/rc-ct-selectors.json"], capture_output=True, text=True)
open(out_path,"w").write(proc.stdout if proc.returncode==0 else proc.stderr)
print("put-event-selectors", "OK" if proc.returncode==0 else proc.stderr[:400])
PY
aws cloudtrail get-event-selectors --trail-name "$TRAIL" > "$EVID/cloudtrail-event-selectors.json"
aws cloudtrail get-trail-status --name "$TRAIL" > "$EVID/cloudtrail-status.json"
cp_ev "$EVID/cloudtrail-status.json"
cp_ev "$EVID/cloudtrail-describe.json"
cp_ev "$EVID/cloudtrail-event-selectors.json"

# --- Fix 3: PITR enable + verification TSV ---
log "Enabling PITR on Rapid Cortex / Ring tables"
python3 - <<'PY'
import json, subprocess, sys
def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)
names = []
exclusive = None
while True:
    cmd = ["aws", "dynamodb", "list-tables"]
    if exclusive:
        cmd += ["--exclusive-start-table-name", exclusive]
    data = json.loads(run(cmd).stdout or "{}")
    names.extend(data.get("TableNames") or [])
    exclusive = data.get("LastEvaluatedTableName")
    if not exclusive:
        break
ok = fail = 0
for table in names:
    if not (table.startswith("rapid-cortex-") or table.startswith("RapidCortex") or table.startswith("Ring")):
        continue
    desc = run(["aws", "dynamodb", "describe-continuous-backups", "--table-name", table])
    enabled = False
    try:
        enabled = json.loads(desc.stdout)["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"] == "ENABLED"
    except Exception:
        pass
    if enabled:
        ok += 1
        continue
    upd = run([
        "aws", "dynamodb", "update-continuous-backups",
        "--table-name", table,
        "--point-in-time-recovery-specification", "PointInTimeRecoveryEnabled=true",
    ])
    if upd.returncode == 0:
        ok += 1
        print(f"  ENABLED {table}")
    else:
        fail += 1
        print(f"  FAIL {table}: {(upd.stderr or upd.stdout).strip().splitlines()[-1:]}")
print(f"PITR enabled_or_already={ok} failed={fail}")
if fail:
    sys.exit(1)
PY
log "PITR inventory"
python3 - "$EVID/dynamodb-pitr-post-fix.tsv" <<'PY'
import json, subprocess, sys
out = sys.argv[1]
names=[]
ex=None
while True:
    cmd=["aws","dynamodb","list-tables"]
    if ex: cmd += ["--exclusive-start-table-name", ex]
    data=json.loads(subprocess.check_output(cmd))
    names += data.get("TableNames") or []
    ex=data.get("LastEvaluatedTableName")
    if not ex: break
lines=["table\tpitr_status"]
disabled=[]
for t in names:
    if not (t.startswith("rapid-cortex-") or t.startswith("RapidCortex") or t.startswith("Ring")):
        continue
    try:
        d=json.loads(subprocess.check_output(["aws","dynamodb","describe-continuous-backups","--table-name",t]))
        st=d["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"]
    except Exception:
        st="ERROR"
    lines.append(f"{t}\t{st}")
    if st!="ENABLED":
        disabled.append(t)
open(out,"w").write("\n".join(lines)+"\n")
print(f"pitr_rows={len(lines)-1} disabled={len(disabled)}")
if disabled:
    print("STILL_DISABLED", ",".join(disabled[:20]))
PY
cp_ev "$EVID/dynamodb-pitr-post-fix.tsv"

# --- Fix 4: Cognito MFA ---
log "Cognito MFA ON (required TOTP)"
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id "$POOL" \
  --mfa-configuration ON \
  --software-token-mfa-configuration Enabled=true >/dev/null
aws cognito-idp get-user-pool-mfa-config --user-pool-id "$POOL" > "$EVID/cognito-mfa-config.json"
cp_ev "$EVID/cognito-mfa-config.json"

# --- Fix 5: WAF logging evidence (CloudFront edge is the live API WAF; HTTP API cannot use restapis associate) ---
log "WAF logging"
aws wafv2 get-logging-configuration --resource-arn "$CF_WAF" > "$EVID/waf-logging-config-api-edge.json"
aws wafv2 get-logging-configuration --resource-arn "$CDN_WAF" > "$EVID/waf-logging-config-web-cdn.json"
python3 - <<PY > "$EVID/waf-logging-config.json"
import json
api=json.load(open("$EVID/waf-logging-config-api-edge.json"))
cdn=json.load(open("$EVID/waf-logging-config-web-cdn.json"))
json.dump({"note":"HTTP API k26yw4o3xk is protected by CloudFront-scope WAF, not Regional REST association.","apiEdge":api,"webCdn":cdn}, open("$EVID/waf-logging-config.json","w"), indent=2)
print("wrote combined waf-logging-config.json")
PY
cp_ev "$EVID/waf-logging-config.json"

# --- Fix 6: ACM 45-day alarm with SNS ---
log "ACM expiry alarm"
aws cloudwatch put-metric-alarm \
  --alarm-name rc-acm-cert-expiry-cc0f7fc4 \
  --alarm-description "Alert when RC production certificate DaysToExpiry drops below 45 days" \
  --namespace AWS/CertificateManager \
  --metric-name DaysToExpiry \
  --dimensions Name=CertificateArn,Value="$CERT" \
  --statistic Minimum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 45 \
  --comparison-operator LessThanThreshold \
  --alarm-actions "$SNS" \
  --treat-missing-data breaching
aws cloudwatch describe-alarms --alarm-names rc-acm-cert-expiry-cc0f7fc4 > "$EVID/acm-expiry-alarm.json"
cp_ev "$EVID/acm-expiry-alarm.json"

# --- Fix 7: Secrets inventory (names/rotation only) ---
log "Secrets inventory"
python3 - "$EVID/secrets-inventory.json" <<'PY'
import json, subprocess, sys
out=sys.argv[1]
listed=json.loads(subprocess.check_output(["aws","secretsmanager","list-secrets"]))
rows=[]
for s in listed.get("SecretList") or []:
    name=s.get("Name") or ""
    if "rapid-cortex" not in name and "rapidcortex" not in name:
        continue
    d=json.loads(subprocess.check_output([
        "aws","secretsmanager","describe-secret","--secret-id",name,
        "--query","{Name:Name,ARN:ARN,RotationEnabled:RotationEnabled,LastRotatedDate:LastRotatedDate,RotationLambdaARN:RotationLambdaARN,RotationRules:RotationRules}"
    ]))
    rows.append(d)
json.dump({"count":len(rows),"secrets":rows}, open(out,"w"), indent=2, default=str)
print("rapid_cortex_secrets", len(rows))
PY
cp_ev "$EVID/secrets-inventory.json"

log "Artifacts in $EVID"
ls -la "$EVID"
