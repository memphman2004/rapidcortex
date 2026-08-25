#!/usr/bin/env bash
# One-shot CloudWatch snapshot for Rapid Cortex stress-test report.
set -euo pipefail
PROFILE="${AWS_PROFILE:-rapid-cortex}"
REGION="${AWS_REGION:-us-east-1}"
STAGE="${STAGE:-dev}"
API_ID="${API_ID:-k26yw4o3xk}"
CLUSTER="${CLUSTER:-rapid-cortex-v2-web-prod}"
SERVICE="${SERVICE:-rapid-cortex-v2-web-prod}"
WINDOW="${WINDOW:-300}"
LABEL="${LABEL:-snapshot}"

START="$(date -u -v-${WINDOW}S +%Y-%m-%dT%H:%M:%SZ)"
END="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==== ${LABEL}  ${END}  window=${WINDOW}s ===="

echo "-- Lambda Errors (FunctionName contains rapid-cortex-dev) --"
aws cloudwatch get-metric-data \
  --profile "$PROFILE" --region "$REGION" \
  --start-time "$START" --end-time "$END" \
  --metric-data-queries "$(cat <<'JSON'
[
  {
    "Id": "lambda_errors",
    "Expression": "SUM(SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Errors\" FunctionName=rapid-cortex-dev', 'Sum', 60))",
    "Period": 60,
    "ReturnData": true
  }
]
JSON
)" \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); r=d['MetricDataResults'][0]; print('values', r.get('Values')); print('timestamps', r.get('Timestamps')); print('sum', round(sum(r.get('Values') or [0]), 3))"

echo "-- DynamoDB ThrottledRequests (rapid-cortex tables) --"
aws cloudwatch get-metric-data \
  --profile "$PROFILE" --region "$REGION" \
  --start-time "$START" --end-time "$END" \
  --metric-data-queries "$(cat <<'JSON'
[
  {
    "Id": "ddb_throttle",
    "Expression": "SUM(SEARCH('{AWS/DynamoDB,TableName} MetricName=\"ThrottledRequests\" TableName=rapid-cortex', 'Sum', 60))",
    "Period": 60,
    "ReturnData": true
  },
  {
    "Id": "ddb_rthrottle",
    "Expression": "SUM(SEARCH('{AWS/DynamoDB,TableName} MetricName=\"ReadThrottleEvents\" TableName=rapid-cortex', 'Sum', 60))",
    "Period": 60,
    "ReturnData": true
  },
  {
    "Id": "ddb_wthrottle",
    "Expression": "SUM(SEARCH('{AWS/DynamoDB,TableName} MetricName=\"WriteThrottleEvents\" TableName=rapid-cortex', 'Sum', 60))",
    "Period": 60,
    "ReturnData": true
  }
]
JSON
)" \
  --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d['MetricDataResults']:
    vals=r.get('Values') or []
    print(r['Id'], 'values', vals, 'sum', round(sum(vals),3))
"

echo "-- API Gateway Latency p99 / 5xx  ApiId=${API_ID} --"
aws cloudwatch get-metric-statistics \
  --profile "$PROFILE" --region "$REGION" \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiId,Value="$API_ID" \
  --start-time "$START" --end-time "$END" \
  --period 60 \
  --extended-statistics p99 \
  --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
pts=sorted(d.get('Datapoints') or [], key=lambda x: x['Timestamp'])
print('p99 datapoints', [(p['Timestamp'], round(p.get('ExtendedStatistics',{}).get('p99',0),2)) for p in pts[-5:]])
print('p99 max', max((p.get('ExtendedStatistics',{}).get('p99',0) for p in pts), default=None))
"

aws cloudwatch get-metric-statistics \
  --profile "$PROFILE" --region "$REGION" \
  --namespace AWS/ApiGateway \
  --metric-name 5xx \
  --dimensions Name=ApiId,Value="$API_ID" \
  --start-time "$START" --end-time "$END" \
  --period 60 \
  --statistics Sum \
  --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
pts=sorted(d.get('Datapoints') or [], key=lambda x: x['Timestamp'])
print('5xx datapoints', [(p['Timestamp'], p.get('Sum',0)) for p in pts[-5:]])
print('5xx sum', sum(p.get('Sum',0) for p in pts))
"

echo "-- ECS CPU / Memory  ${CLUSTER}/${SERVICE} --"
for metric in CPUUtilization MemoryUtilization; do
  aws cloudwatch get-metric-statistics \
    --profile "$PROFILE" --region "$REGION" \
    --namespace AWS/ECS \
    --metric-name "$metric" \
    --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$SERVICE" \
    --start-time "$START" --end-time "$END" \
    --period 60 \
    --statistics Average Maximum \
    --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
pts=sorted(d.get('Datapoints') or [], key=lambda x: x['Timestamp'])
print('${metric} last', [(p['Timestamp'], round(p.get('Average',0),2), round(p.get('Maximum',0),2)) for p in pts[-5:]])
print('${metric} peak max', max((p.get('Maximum',0) for p in pts), default=None))
"
done

echo "-- CloudFront 5xxErrorRate (all distributions, last window) --"
IDS=$(aws cloudfront list-distributions --profile "$PROFILE" --query 'DistributionList.Items[].Id' --output text)
echo "distribution ids: $IDS"
for id in $IDS; do
  aws cloudwatch get-metric-statistics \
    --profile "$PROFILE" --region "$REGION" \
    --namespace AWS/CloudFront \
    --metric-name 5xxErrorRate \
    --dimensions Name=DistributionId,Value="$id" Name=Region,Value=Global \
    --start-time "$START" --end-time "$END" \
    --period 60 \
    --statistics Average Maximum \
    --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
pts=sorted(d.get('Datapoints') or [], key=lambda x: x['Timestamp'])
peak=max((p.get('Maximum',0) for p in pts), default=None)
avg=None
if pts:
    avg=sum(p.get('Average',0) for p in pts)/len(pts)
print('CF ${id} peak_max', peak, 'avg', None if avg is None else round(avg,4), 'n', len(pts))
"
done
