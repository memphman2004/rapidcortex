# G4: Auditability & forensics — evidence template

**Date:** _YYYY-MM-DD_  
**Environment:** _staging_

## Scenario pack

For each scenario, record **request ID**, **actor**, **expected event types**, and **log export link** (redacted).

1. Dispatcher login + incident create  
2. CAD read (or staging CAD proxy)  
3. Failed authentication  
4. Supervisor / privileged action (if in scope)  
5. External API / RC Lite call (if in scope)

## Retention & export

- [ ] Retention period documented.
- [ ] Export format tested (JSON/CSV) with sample attached.

## Sign-offs

- [ ] Compliance / security — date: ___

**Gate status:** _YELLOW until scenarios are reproduced in target env._
