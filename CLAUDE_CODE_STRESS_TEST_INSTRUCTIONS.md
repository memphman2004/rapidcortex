# Rapid Cortex — Stress Test Execution Instructions for Claude Code
# Execute these steps exactly in order. Do not skip steps.

## CONTEXT
You are executing a production stress test against the Rapid Cortex API.
- Target: https://api.rapidcortex.us
- Monitor: AWS CloudWatch via rc-stress-monitor.sh
- SLA gates enforced by k6 scripts
- Output: JSON results + HTML report + PDF report

---

## STEP 1 — Verify prerequisites

Run each command and confirm output before proceeding.

```bash
# Confirm k6 is installed
k6 version

# Confirm AWS CLI is authenticated
aws sts get-caller-identity --region us-east-1

# Confirm npm scripts exist
cat package.json | grep -A 10 '"stress'

# Confirm results directory exists
mkdir -p results

# Confirm rc-stress-monitor.sh is executable
chmod +x ./rc-stress-monitor.sh
ls -la rc-stress-monitor.sh
```

If k6 is missing:
```bash
brew install k6
# or on Linux:
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

---

## STEP 2 — Capture a fresh JWT

```bash
# Replace USERNAME and PASSWORD with the smoke-test service account credentials
export SMOKE_TEST_USERNAME="<smoke-test-user@rapidcortex.us>"
export SMOKE_TEST_PASSWORD="<password>"

export BEARER_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-1 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $(aws cloudformation describe-stacks \
    --stack-name rapid-cortex-prod \
    --region us-east-1 \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text) \
  --auth-parameters USERNAME="${SMOKE_TEST_USERNAME}",PASSWORD="${SMOKE_TEST_PASSWORD}" \
  --query "AuthenticationResult.IdToken" \
  --output text)

# Verify token was captured (should print a long JWT string)
echo "Token captured: ${BEARER_TOKEN:0:40}..."
```

---

## STEP 3 — Open Terminal 2 and start the CloudWatch monitor

Open a second terminal window. Run this BEFORE starting k6:

```bash
STAGE=prod \
AWS_REGION=us-east-1 \
POLL_SECONDS=30 \
./rc-stress-monitor.sh
```

Leave this running throughout the entire test. Watch for:
- Lambda Errors > 0 → STOP immediately
- API GW 5xx > 1 → STOP immediately
- DynamoDB throttles > 0 → STOP immediately
- ECS CPU > 80% → note but continue
- CloudFront 5xx rate > 1% → STOP immediately

---

## STEP 4 — Run smoke profile (Terminal 1)

```bash
API_BASE_URL=https://api.rapidcortex.us \
BEARER_TOKEN="${BEARER_TOKEN}" \
npm run stress:smoke 2>&1 | tee results/smoke-run-$(date +%Y%m%d-%H%M%S).log
```

Wait for completion. It must exit with code 0.
If it fails, STOP. Do NOT proceed to Step 5. Paste the output for diagnosis.

Check exit code:
```bash
echo "Smoke exit code: $?"
```

---

## STEP 5 — If smoke PASSED: run load profile

```bash
API_BASE_URL=https://api.rapidcortex.us \
BEARER_TOKEN="${BEARER_TOKEN}" \
npm run stress:load 2>&1 | tee results/load-run-$(date +%Y%m%d-%H%M%S).log
```

Wait for full completion. This will take longer. Monitor Terminal 2 throughout.

---

## STEP 6 — Capture CloudWatch snapshot after load test

```bash
# Capture final CloudWatch metrics snapshot
STAGE=prod \
AWS_REGION=us-east-1 \
POLL_SECONDS=1 \
./rc-stress-monitor.sh 2>&1 | head -80 | tee results/cloudwatch-snapshot-$(date +%Y%m%d-%H%M%S).txt
```

Stop the monitor (Ctrl+C in Terminal 2) after one poll cycle.

---

## STEP 7 — Generate k6 HTML report

```bash
npm run stress:report
```

Confirm `results/stress-report.html` was created:
```bash
ls -lh results/stress-report.html
```

---

## STEP 8 — Export k6 results as JSON (if not already done by npm script)

If the k6 script does not already produce a JSON output file, run:

```bash
# Check what JSON results exist
ls -lh results/*.json 2>/dev/null || echo "No JSON results found"

# If missing, re-run smoke with JSON output explicitly
API_BASE_URL=https://api.rapidcortex.us \
BEARER_TOKEN="${BEARER_TOKEN}" \
k6 run --out json=results/k6-summary.json k6/smoke.js
```

---

## STEP 9 — Generate the PDF report

```bash
# Run the PDF report generator
python3 scripts/generate-stress-report.py \
  --results-dir results \
  --stage prod \
  --api-url https://api.rapidcortex.us \
  --output results/RC_StressTest_Report_$(date +%Y%m%d).pdf

# Confirm PDF was created
ls -lh results/RC_StressTest_Report_*.pdf
echo "PDF report generated."
```

---

## STEP 10 — Paste full output back

Paste ALL of the following:
1. Contents of the smoke log: `cat results/smoke-run-*.log`
2. Contents of the load log: `cat results/load-run-*.log`
3. Contents of the CloudWatch snapshot: `cat results/cloudwatch-snapshot-*.txt`
4. PDF file path for download

Do NOT summarize. Paste raw output.

---

## ABORT CRITERIA

Stop the test immediately and paste output if:
- Any k6 threshold breach is reported (red text in k6 output)
- Lambda error count > 0 in CloudWatch monitor
- API Gateway 5xx count > 1
- DynamoDB throttle events > 0
- ECS CPU sustained > 85% for 2+ poll cycles
- Any `FAILED` result in k6 output
- k6 exits with non-zero code
