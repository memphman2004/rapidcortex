# 04 - Monitoring Alarm Test (Trigger + Reset)

## Command Executed

```bash
aws cloudwatch set-alarm-state --region us-east-1 \
  --alarm-name "rapid-cortex-dev-IncidentMediaHttpErrorsAlarm-6FYjhWgyxz06" \
  --state-value ALARM \
  --state-reason "Compliance evidence test alert"

aws cloudwatch describe-alarms --region us-east-1 \
  --alarm-names "rapid-cortex-dev-IncidentMediaHttpErrorsAlarm-6FYjhWgyxz06" \
  --query "MetricAlarms[0].{AlarmName:AlarmName,StateValue:StateValue,StateReason:StateReason,AlarmActions:AlarmActions}" \
  --output json

aws cloudwatch set-alarm-state --region us-east-1 \
  --alarm-name "rapid-cortex-dev-IncidentMediaHttpErrorsAlarm-6FYjhWgyxz06" \
  --state-value OK \
  --state-reason "Compliance evidence reset"
```

## Output Capture

### Triggered ALARM state

```json
{
  "AlarmName": "rapid-cortex-dev-IncidentMediaHttpErrorsAlarm-6FYjhWgyxz06",
  "StateValue": "ALARM",
  "StateReason": "Compliance evidence test alert",
  "AlarmActions": [
    "arn:aws:sns:us-east-1:158961537080:rapid-cortex-ops-dev-158961537080"
  ]
}
```

### Reset to OK

```json
{
  "AlarmName": "rapid-cortex-dev-IncidentMediaHttpErrorsAlarm-6FYjhWgyxz06",
  "StateValue": "OK",
  "StateReason": "Compliance evidence reset"
}
```

## Result

- Alarm transition path validated (`ALARM` -> `OK`).
- Alarm action target is configured to SNS ops topic in dev environment.

## Status

- **Pass** for alarm trigger/reset mechanics.
