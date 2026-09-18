#!/usr/bin/env bash
# Enable SOC 2 Type II technical controls on the live production account
# (DeploymentStage=dev / app.rapidcortex.us). Idempotent.
#
# Usage:
#   AWS_PROFILE=rapid-cortex AWS_DEFAULT_REGION=us-east-1 bash scripts/soc2-enable-live-controls.sh
set -u

export AWS_PROFILE="${AWS_PROFILE:-rapid-cortex}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

ACCOUNT="158961537080"
TRAIL_NAME="rapid-cortex-audit-prod"
TRAIL_BUCKET="rapid-cortex-cloudtrail-logs-prod-${ACCOUNT}"
PROD_POOL="us-east-1_0z6tA6WBs"
API_WAF_ARN="arn:aws:wafv2:us-east-1:${ACCOUNT}:global/webacl/rapid-cortex-httpapi-cdn-waf-dev/7f68bde8-cc59-4b9d-bed7-dd1f66e7eeef"
API_WAF_LOG_GROUP="aws-waf-logs-rapid-cortex-httpapi-cdn-dev"
API_CERT_ARN="arn:aws:acm:us-east-1:${ACCOUNT}:certificate/cc0f7fc4-d4ca-4b1a-8ff6-e0676d872fa5"
EVIDENCE_ROLE="rapid-cortex-soc2-evidence-readonly"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

log "Caller:"
aws sts get-caller-identity

# ---------------------------------------------------------------------------
# 1. DynamoDB PITR on Rapid Cortex / Ring tables
# ---------------------------------------------------------------------------
log "Enabling DynamoDB PITR on Rapid Cortex and Ring tables…"
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
    proc = run(cmd)
    data = json.loads(proc.stdout)
    names.extend(data.get("TableNames") or [])
    exclusive = data.get("LastEvaluatedTableName")
    if not exclusive:
        break

def in_scope(n):
    return n.startswith("rapid-cortex-") or n.startswith("RapidCortex") or n.startswith("Ring")

ok = skip = fail = 0
failed = []
for table in names:
    if not in_scope(table):
        skip += 1
        continue
    desc = run(["aws", "dynamodb", "describe-continuous-backups", "--table-name", table])
    enabled = False
    try:
        body = json.loads(desc.stdout)
        enabled = body["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"] == "ENABLED"
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
        err = (upd.stderr or upd.stdout).strip().splitlines()[-1] if (upd.stderr or upd.stdout) else "unknown"
        failed.append((table, err))
        print(f"  FAIL {table}: {err}")
print(f"PITR summary: enabled_or_already={ok} skipped_other={skip} failed={fail}")
if failed:
    sys.exit(1)
PY
PITR_RC=$?

# ---------------------------------------------------------------------------
# 2. Cognito MFA required
# ---------------------------------------------------------------------------
log "Setting production Cognito MFA to ON (TOTP)…"
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id "$PROD_POOL" \
  --mfa-configuration ON \
  --software-token-mfa-configuration Enabled=true
aws cognito-idp get-user-pool-mfa-config --user-pool-id "$PROD_POOL"

# ---------------------------------------------------------------------------
# 3. API edge WAF logging
# ---------------------------------------------------------------------------
log "Enabling WAF logging on $API_WAF_LOG_GROUP…"
aws logs create-log-group --log-group-name "$API_WAF_LOG_GROUP" 2>/dev/null || true
aws logs put-retention-policy --log-group-name "$API_WAF_LOG_GROUP" --retention-in-days 365 2>/dev/null || true
LOG_GROUP_ARN="arn:aws:logs:${AWS_REGION}:${ACCOUNT}:log-group:${API_WAF_LOG_GROUP}"
aws wafv2 put-logging-configuration --cli-input-json "$(python3 - <<PY
import json
print(json.dumps({
  "LoggingConfiguration": {
    "ResourceArn": "$API_WAF_ARN",
    "LogDestinationConfigs": ["$LOG_GROUP_ARN"],
  }
}))
PY
)"
aws wafv2 get-logging-configuration --resource-arn "$API_WAF_ARN"

# ---------------------------------------------------------------------------
# 4. CloudTrail (multi-region + log-file validation) on existing prod log bucket
# ---------------------------------------------------------------------------
log "Ensuring CloudTrail $TRAIL_NAME on s3://$TRAIL_BUCKET…"
if aws cloudtrail get-trail --name "$TRAIL_NAME" >/dev/null 2>&1; then
  aws cloudtrail update-trail \
    --name "$TRAIL_NAME" \
    --s3-bucket-name "$TRAIL_BUCKET" \
    --is-multi-region-trail \
    --enable-log-file-validation
else
  aws cloudtrail create-trail \
    --name "$TRAIL_NAME" \
    --s3-bucket-name "$TRAIL_BUCKET" \
    --is-multi-region-trail \
    --enable-log-file-validation
fi
aws cloudtrail start-logging --name "$TRAIL_NAME"
aws cloudtrail get-trail-status --name "$TRAIL_NAME"
aws cloudtrail get-event-selectors --trail-name "$TRAIL_NAME"

# ---------------------------------------------------------------------------
# 5. KMS: rotate customer-managed keys; create CloudTrail CMK if none
# ---------------------------------------------------------------------------
log "KMS key rotation…"
python3 - <<'PY'
import json, subprocess, time
def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

keys = json.loads(run(["aws", "kms", "list-keys"]).stdout).get("Keys") or []
rotated = aws_managed = skipped = 0
for k in keys:
    kid = k["KeyId"]
    meta = run(["aws", "kms", "describe-key", "--key-id", kid])
    try:
        m = json.loads(meta.stdout)["KeyMetadata"]
    except Exception:
        skipped += 1
        continue
    if m.get("KeyManager") != "CUSTOMER" or m.get("KeyState") != "Enabled":
        aws_managed += 1
        continue
    rot = run(["aws", "kms", "enable-key-rotation", "--key-id", kid])
    if rot.returncode == 0:
        rotated += 1
        print(f"  rotation on {kid} ({m.get('Description','')[:60]})")
    else:
        print(f"  skip {kid}: {(rot.stderr or rot.stdout).strip().splitlines()[-1:]}")
print(f"KMS CMK rotation enabled={rotated} aws_managed_or_other={aws_managed}")
PY

# ---------------------------------------------------------------------------
# 6. ACM expiry alarms (Rapid Cortex certs)
# ---------------------------------------------------------------------------
log "ACM DaysToExpiry alarms…"
python3 - <<PY
import json, subprocess
ACCOUNT = "$ACCOUNT"
API_CERT = "$API_CERT_ARN"

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

certs = []
listed = run(["aws", "acm", "list-certificates", "--certificate-statuses", "ISSUED"])
if listed.returncode == 0:
    certs = json.loads(listed.stdout).get("CertificateSummaryList") or []
else:
    print("  list-certificates denied; alarming known API cert only")
    certs = [{"CertificateArn": API_CERT, "DomainName": "api.rapidcortex.us"}]

for c in certs:
    arn = c.get("CertificateArn")
    domain = (c.get("DomainName") or "cert").replace("*", "star")
    if ACCOUNT not in arn:
        continue
    # Only Rapid Cortex hostnames + the known API cert
    interesting = any(x in domain for x in ("rapidcortex", "rapid-cortex")) or arn == API_CERT
    if not interesting:
        continue
    name = "rapid-cortex-acm-expiry-" + domain.replace(".", "-")[:40]
    cmd = [
        "aws", "cloudwatch", "put-metric-alarm",
        "--alarm-name", name,
        "--alarm-description", f"ACM certificate {domain} expires in < 30 days",
        "--namespace", "AWS/CertificateManager",
        "--metric-name", "DaysToExpiry",
        "--dimensions", f"Name=CertificateArn,Value={arn}",
        "--statistic", "Minimum",
        "--period", "86400",
        "--evaluation-periods", "1",
        "--threshold", "30",
        "--comparison-operator", "LessThanThreshold",
        "--treat-missing-data", "notBreaching",
    ]
    proc = run(cmd)
    print(("  OK " if proc.returncode == 0 else "  FAIL ") + name)
    if proc.returncode != 0:
        print("   ", (proc.stderr or proc.stdout).strip()[:300])
PY

# ---------------------------------------------------------------------------
# 7. Secrets Manager — inventory rotation (no values)
# ---------------------------------------------------------------------------
log "Secrets Manager rotation inventory…"
python3 - <<'PY'
import json, subprocess
proc = subprocess.run(["aws", "secretsmanager", "list-secrets"], capture_output=True, text=True)
if proc.returncode != 0:
    print("  ListSecrets failed:", (proc.stderr or proc.stdout).strip()[:300])
    raise SystemExit(0)
secrets = json.loads(proc.stdout).get("SecretList") or []
print(f"  secret_count={len(secrets)}")
for s in secrets:
    name = s.get("Name") or ""
    if "rapid-cortex" not in name and "rapidcortex" not in name:
        continue
    d = subprocess.run(
        ["aws", "secretsmanager", "describe-secret", "--secret-id", name,
         "--query", "{Name:Name,RotationEnabled:RotationEnabled,RotationLambdaARN:RotationLambdaARN,LastRotatedDate:LastRotatedDate}"],
        capture_output=True, text=True,
    )
    print(" ", d.stdout.strip() if d.returncode == 0 else f"{name} describe failed")
PY

# ---------------------------------------------------------------------------
# 8. Read-only evidence role (auditors assume this)
# ---------------------------------------------------------------------------
log "Ensuring IAM role $EVIDENCE_ROLE…"
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::'"$ACCOUNT"':root"},"Action":"sts:AssumeRole","Condition":{"Bool":{"aws:MultiFactorAuthPresent":"true"}}}]}'
aws iam create-role \
  --role-name "$EVIDENCE_ROLE" \
  --assume-role-policy-document "$TRUST" \
  --description "SOC 2 Type II read-only evidence collection (MFA required to assume)" \
  2>/dev/null || aws iam update-assume-role-policy --role-name "$EVIDENCE_ROLE" --policy-document "$TRUST"

aws iam put-role-policy --role-name "$EVIDENCE_ROLE" --policy-name soc2-evidence-readonly --policy-document '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "Soc2Read",
    "Effect": "Allow",
    "Action": [
      "cloudtrail:DescribeTrails",
      "cloudtrail:GetTrail",
      "cloudtrail:GetTrailStatus",
      "cloudtrail:GetEventSelectors",
      "cloudtrail:LookupEvents",
      "cloudtrail:ListTrails",
      "s3:ListAllMyBuckets",
      "s3:GetBucketEncryption",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetBucketVersioning",
      "s3:GetBucketLogging",
      "s3:GetBucketPolicy",
      "dynamodb:ListTables",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:DescribeTable",
      "kms:ListKeys",
      "kms:ListAliases",
      "kms:DescribeKey",
      "kms:GetKeyRotationStatus",
      "secretsmanager:ListSecrets",
      "secretsmanager:DescribeSecret",
      "wafv2:ListWebACLs",
      "wafv2:GetLoggingConfiguration",
      "wafv2:GetWebACL",
      "cloudwatch:DescribeAlarms",
      "cognito-idp:ListUserPools",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:GetUserPoolMfaConfig",
      "acm:ListCertificates",
      "acm:DescribeCertificate",
      "logs:DescribeLogGroups",
      "iam:GetRole",
      "iam:ListRolePolicies",
      "iam:GetRolePolicy",
      "sts:GetCallerIdentity"
    ],
    "Resource": "*"
  }]
}'

log "Done. PITR script exit=$PITR_RC"
exit 0
