# NexCort iQ — Agency Intelligence & PSAP Prospecting Engine

Saved Cursor prompt. Run one phase per session. Phase 1 is the data foundation. Do not execute Phases 2–5 in the same session.

## Feasibility constraints

1. **Civic IQ API access is not automatic.** The Civic IQ MCP connector in a development chat is a session tool for research and content generation. It is not a server-side production API. Live sync needs a separate server-to-server API key from Civic IQ, stored in AWS Secrets Manager. The Starter plan may not include that key. Until the key exists, ship the manual import path and mark live sync `REQUIRES_CONFIGURATION`. Do not copy MCP session credentials into the application.
2. **DynamoDB will not serve the multi-attribute filter by itself.** State + zone + dispatcher count + CAD vendor + verification + modernization is a search problem. Phase 1 may filter in application code, using the existing PSAP state index when a state is selected. Nationwide production filtering needs OpenSearch, or a DynamoDB Streams projection into a search index. Do not add unrestricted table scans as the long-term design.
3. **FCC registry data is stale as an operational roster.** The Open Data listing has historically shown a February 2019 update. Use it for PSAP ID assignment after checking official metadata. Prefer current state 911 directories and NENA’s Master Street Address Guide for operational facts. Do not overwrite newer agency data with the old registry.
4. **This is multi-phase work.** Each phase below is its own session. Start with Phase 1. It does not need Civic IQ or a search cluster.

## Repository mapping

This monorepo does not use a single `src/app` tree. Implement against the existing Sales Dashboard and PSAP prospect registry. Do not create a second prospect database or a separate application.

| Concern | Location |
| --- | --- |
| Sales Dashboard | `apps/web/app/sales/` |
| Agency Intelligence UI | `apps/web/app/sales/agency-intelligence/` |
| Domain model, filter, verification | `packages/shared/src/agency-intelligence/` |
| API | `apps/api/src/handlers/rc-admin/psapProspectsHttp.ts` and `agencyIntelligenceHttp.ts` |
| Routes | `/api/rc-admin/psap-prospects/agency-intelligence` on the existing PSAP CRM Lambda (`infra/nested/stack-app-sam-3-psap-crm.yaml`) |
| Web BFF | `apps/web/app/api/rc-admin/psap-prospects/agency-intelligence/` |
| Canonical agency identity | Existing `PsapProspect` items in `PsapProspectsTable` |
| Sales zones | `packages/shared/src/sales/sales-territory-zones.ts` (six zones; do not replace them) |
| Navigation | `apps/web/lib/navigation/role-nav.ts` |
| Marketing dashboard | Leave it separate. Do not mix it into this module. |

Do not deploy to production without explicit authorization. Account `158961537080` only. Do not touch account `621957412915`.

---

# CURSOR MASTER IMPLEMENTATION PROMPT
# NexCort iQ — Agency Intelligence & PSAP Prospecting Engine

**Project:** NexCort iQ Sales Dashboard
**Module:** Agency Intelligence
**Release:** Version 1.0
**Implementation priority:** High
**Primary business objective:** Identify, qualify, prioritize, and monitor 911 communications centers that may benefit from NexCort iQ and NEXiQ Call Assist.

## 1. Role and execution directive

Implement Agency Intelligence inside the existing Sales Dashboard. Extend agency profiles, lead records, opportunity tracking, sales assignments, dashboards, and reporting. Do not create another sales pipeline.

The module enriches government agency profiles from reliable public information, supports manual verification, monitors procurement intelligence, and prioritizes leads. Deliver working code, data changes, services, UI, tests, deployment configuration, and an honest status report.

Audit the repository first. Reuse existing services. Preserve production behavior, sales records, assignments, permissions, and the marketing dashboard separation.

## 2. Initial prospecting configuration

Saved filter name: **Small Primary PSAPs — 7 or Fewer Dispatchers**

```json
{
  "name": "Small Primary PSAPs",
  "psapType": "PRIMARY",
  "maximumDispatcherHeadcount": 7,
  "minimumVacancies": null,
  "modernizationStatus": "ANY",
  "geography": "UNITED_STATES",
  "includeUnverifiedStaffingInQualifiedResults": false,
  "includeUnverifiedPrimaryStatus": false,
  "sortBy": "opportunityScore",
  "sortDirection": "DESC"
}
```

Maximum dispatcher headcount is an inclusive 7. Count distinct dispatch personnel when the source supports that classification, including routinely assigned part-time staff and dispatch-capable supervisors. Store these separately and do not add them together:

- Authorized dispatcher positions
- Filled dispatcher positions
- Full-time personnel
- Part-time personnel
- Per-diem or reserve personnel
- Dispatch-capable supervisors
- Employees working one shift
- Dispatch console positions
- Full-time-equivalent staffing

Display the reporting period and counting method. Do not treat authorized positions as employee headcount. Provide alternate filters for authorized positions and FTEs.

Vacancies: Any. Zero, unknown, and unavailable vacancy counts do not exclude an agency when the filter is Any.

Modernization: Any. An agency without a CAD replacement, RFP, NG911 project, or contract expiration stays eligible.

PSAP type: Primary. Prefer current state or agency evidence. Keep Primary, Secondary, Consolidated or regional, Unknown, and Closed, merged, or inactive separate. A regional PSAP that is still a primary receiving point stays eligible. Unknown classification goes to the verification queue. Do not treat it as primary.

## 3. Audit the existing Sales Dashboard

Inspect the sales pages, lead and opportunity boards, agency profiles, contacts, lifecycle stages, the six sales zones, representative ownership, CRM services, PSAP records, any Civic IQ or government integration, reporting, RBAC, AWS infrastructure, scheduled jobs, notifications, and import/export.

Reuse established models. Do not duplicate agency records, opportunities, or commissions. Keep the six-zone model.

## 4. Agency Intelligence data model

Add an Agency Intelligence section on each existing agency profile. Use current identifiers, access control, and storage patterns.

### 4.1 Agency identity

Internal agency ID, official name, alternative names, parent government, agency type, PSAP type, FCC PSAP ID (string, keep leading zeros), state, county, city, ZIP, government website, public phone, published email, communications-center website, operational status, population served, jurisdiction coverage, sales zone, assigned representative, linked opportunity, last verified date.

Support multiple PSAP facilities under one parent government. Do not assume each police department is its own primary PSAP.

### 4.2 Dispatcher staffing

Authorized positions, filled positions, reported headcount, full-time, part-time, reserve or per-diem, dispatch-capable supervisors, supervisory positions excluded from headcount, vacancies, vacancy percentage, FTE, documented shortages, recruiting, overtime concerns, report date, source, counting method, verification status.

Calculate vacancy percentage only when authorized and filled positions are both verified and comparable. Do not add overlapping categories. Do not treat operators on duty as total center staffing. Unknown stays unknown.

### 4.3 Call volume

Annual 911 calls, inbound non-emergency calls, administrative 10-digit calls, outbound calls, officially reported total calls, wireless 911, text-to-911, average daily volume, peak demand, reporting year, methodology, source, verification.

Do not assume every 10-digit call is non-emergency. Do not sum overlapping categories. Distinguish calls answered, calls received, CAD incidents, and service requests. Calculate a daily average only when the reporting period is valid.

### 4.4 CAD and technology

CAD provider, product, public version, deployment type, contract expiration, call-handling vendor, telephony platform, NG911 environment, non-emergency routing, separate administrative number, shared answering arrangement, IVR, digital 311, automated call handling, interoperability requirements, incumbent vendors, upcoming refresh.

CAD provider stays unknown until evidence supports it. A vendor named in an RFP is not the incumbent or the winner.

### 4.5 Modernization and procurement

Active RFPs, planned solicitations, CAD replacement discussions, NG911 upgrades, call-handling upgrades, renovations, staffing modernization, non-emergency automation, budget approvals, capital projects, renewal or expiration dates, procurement status, estimated budget, funding source, grants, purchase timing, source links, latest activity date.

Distinguish planned, discussed, funded, formally solicited, awarded, and canceled.

### 4.6 Contacts

Communications director, 911 coordinator, dispatch supervisor, PSAP manager, police chief, sheriff, IT director, procurement contact, administrative contact, public work email, public work telephone, source, verification date, status.

Keep the existing CRM contact model. Do not guess email addresses.

## 5. Data source integrations

Build source-specific adapters that return normalized facts and provenance.

### 5.1 FCC Master PSAP Registry

Dataset `dpq5-ta9j`: https://opendata.fcc.gov/Public-Safety/911-Master-PSAP-Registry/dpq5-ta9j

Support approved CSV or API import. Verify the published schema first. Historical fields include `psap_id`, `psap_name`, `county`, `city`, `state`, `type_of_change_full_text`, `date_last_modified`, `geocode_city_level`. Do not assume staffing, CAD vendor, or current primary/secondary classification.

Store dataset version, download time, publication date, PSAP ID as a string, original row, currentness assessment, and match result. Do not overwrite newer agency information with an older registry row. Check official FCC metadata monthly. Treat a February 2019 publication as stale operational data.

### 5.2 State 911 agencies

Configurable adapters for state PSAP directories, annual reports, staffing studies, funding reports, NG911 plans, consolidation announcements, and operational reports. Cover all states and the District of Columbia. Do not invent a universal state API. Accept public CSV, XLSX, JSON, HTML, and PDF through approved ingestion. Do not crawl without authorization or bypass authentication.

### 5.3 Municipal and county sources

City and county sites, adopted budgets, capital plans, annual reports, council or commission minutes, staffing tables, official job postings, procurement portals, published contracts, and public directories. Keep the source and reporting period on every fact. A budget that lists five full-time positions does not prove there are exactly five dispatchers.

### 5.4 Federal 911 information

Use https://www.911.gov/ for context and state reporting. Do not assign state aggregate call volume or staffing to an individual PSAP.

### 5.5 Manual research

Authorized staff may enter facts from supervisor calls, demonstrations, agency email, discovery meetings, published records, records requests, and other documented official communication. Store the date, contact role, and field-level verification.

## 6. FCC matching and deduplication

Match in this order:

1. Verified FCC PSAP ID
2. Existing verified external identifier
3. Exact normalized name plus state and jurisdiction
4. Verified website or domain plus geography
5. Alias plus county, city, and state
6. Fuzzy name match with geographic constraints

Do not merge on similar names alone. A sheriff’s office and a city police department may share a center and still be distinct. A consolidated PSAP may serve several municipalities.

Confidence levels: exact identifier, strong official-document match, probable match requiring review, ambiguous, no match. Scores do not replace source verification.

Authorized users can compare matches, see conflicting identifiers, review evidence, merge, reject, preserve history, and undo a merge through an audited workflow. Never merge two sales opportunities only because the agency names look similar.

## 7. Civic IQ integration

The Civic IQ MCP connector available in this development environment is for research and content generation only. The production integration requires a separate server-to-server API key stored in AWS Secrets Manager. If the key is not yet available, implement the manual import adapter in Phase 3 and mark live sync as REQUIRES_CONFIGURATION.

NexCort iQ may have a Civic IQ Starter subscription. Research capabilities can include government signals, RFPs, contacts, contracts, and funding. The connector in a chat session does not authenticate the deployed web application.

Before any live server-to-server access:

1. Inspect the application for existing Civic IQ credentials, integration code, approved APIs, or an MCP connection.
2. Verify the vendor’s supported access method and the subscription’s permissions.
3. Use only authorized integrations.
4. Store secrets in AWS Secrets Manager.
5. Never extract or reuse private connector credentials from a chat session.
6. If production access is unavailable, ship a secure manual or import adapter and mark live synchronization as configuration required.

### 7.1 Procurement signals

CAD replacements, NG911 modernization, emergency communications upgrades, call-handling projects, staffing studies, consolidation, non-emergency automation, public-safety technology budgets, contract renewals, and 911 technology grants.

Store the Civic IQ identifier when provided, agency, meeting date, title, summary, stage, estimated value, named vendors, contract status, document URL, signal URL, retrieval date, linked agency, and relevance score. Treat signed or temporary document links as expiring. Keep durable metadata where permitted.

### 7.2 RFP intelligence

When access allows: title, issuing agency, publication date, submission deadline, status, scope, requirements, budget, procurement contact, source URL. A result labeled OPEN is not open after the deadline. Validate the deadline and agency status before calling it actionable.

### 7.3 Contact enrichment

Published work contacts for PSAP directors, communications supervisors, emergency communications administrators, IT directors, procurement officials, and police or sheriff leadership. Do not overwrite a personally verified CRM contact without review.

### 7.4 Opportunity linking

When a project matches an existing agency, attach the signal, add it to the timeline, suggest opportunity updates, and notify the assigned representative when appropriate. Do not create a duplicate opportunity. If another vendor already won, label it awarded. Do not present an awarded contract as an open solicitation.

### 7.5 Administration

Show connection status, last successful sync, capabilities, permission failures, rate limits, import history, unmatched signals, duplicates, a manual sync control, and an error log. Respect configured cost controls. Do not send paid or metered requests outside those controls.

## 8. Extraction and verification

Collect trustworthy data. Do not generate plausible answers.

### 8.1 Pipeline

Acquire an authorized source, record publisher metadata, extract text and tables, identify candidate facts, keep the quoted passage or locator, normalize units and periods, resolve the agency, detect conflicts, assign a verification state, and queue proposed changes. Models may assist extraction. Numeric fields still need deterministic validation. Never invent staffing or call volume.

### 8.2 Evidence

Store field-level provenance: agency id, field, proposed value, source type, source URL, publication date, reporting period, extraction time, verification status, confidence, and reviewer. Follow repository naming. The sample in the original brief is illustrative, not a real agency.

### 8.3 Verification levels

- **Agency Confirmed** — an authorized agency representative verified it.
- **Official Source Verified** — an authoritative government publication supports it.
- **Third-Party Sourced** — an identifiable external provider supports it, and it is not independently confirmed.
- **Pending Review** — extracted, not yet validated.
- **Conflicting** — incompatible claims exist.
- **Stale** — older than the configured freshness policy.
- **Unknown** — no reliable information.

Verification is per field. CAD vendor can be verified while staffing is unknown.

### 8.4 Conflicts

Keep every supported claim. Compare periods and definitions. Identify the newest authoritative evidence. Flag material conflicts. Suggest a resolution for a reviewer. Do not replace a manually verified fact with an older source. Store the previous verified value and the change history.

### 8.5 Freshness defaults

These are review intervals, not a claim that sources publish this often.

- Current vacancies: 30 days
- Named contacts: 90 days
- Current staffing: 180 days
- Annual call volume: annually
- CAD provider: 180 days
- Modernization signals: 7–30 days
- Active RFP status: daily while open
- FCC registry metadata: monthly
- PSAP classification: annually, or after a known consolidation

## 9. Sales Dashboard UI

Extend Sales. Leave the Marketing Dashboard intact.

Navigation: Overview, PSAP Prospecting, Agency Profiles, Research & Verification, Procurement Signals, Lead Prioritization, Data Sources, Enrichment Settings. Reuse current navigation and components.

Prospecting columns: agency, state, sales zone, PSAP type, total dispatcher headcount, authorized staffing, vacancies, annual 911 calls, annual administrative calls, CAD provider, modernization status, opportunity score, data confidence, assigned representative, last verified, next action.

Support search, filtering, sorting, pagination, CSV export, and saved views. Show a clear unknown indicator. Do not render unknown staffing as zero.

Filters: PSAP type, maximum dispatcher headcount, minimum vacancies, state, county, sales zone, CAD vendor, non-emergency call volume, modernization activity, active RFP, upcoming contract expiration, verification status, lead owner, sales lifecycle stage, agency type.

Default saved view: **Primary PSAPs with 7 or Fewer Dispatchers**, inclusive of seven. With vacancies Any and modernization Any, neither criterion excludes a match. Agencies with unknown headcount or unconfirmed primary status go to a research queue.

Profile groups: Agency Overview, Staffing & Workload, Existing Technology, Procurement & Funding, Research Sources, Sales Activity.

Research queue: review proposed values, inspect evidence, approve, reject, correct extraction errors, mark a field agency-confirmed, request fresh research, track assignments, and review conflicts. Bulk review is allowed for safe, independently supported fields, and each change remains inspectable.

## 10. Sales prioritization

Configurable Agency Opportunity Score from 0 to 100. It prioritizes research and outreach. It is not a prediction that the agency will buy.

| Factor | Maximum points |
| --- | ---: |
| Staffing and documented operational pressure | 25 |
| Non-emergency workload opportunity | 20 |
| Technology integration fit | 15 |
| Procurement and modernization signals | 15 |
| Budget or funding readiness | 10 |
| Contactability and relationship progress | 10 |
| Evidence completeness and freshness | 5 |
| **Total** | **100** |

Do not treat a small workforce as a verified shortage. Do not assume high call volume without data. Unknown is not evidence of low or high need. Show Data Completeness separately.

Classifications: high-priority outreach, qualified prospect, research required, long-term opportunity, existing customer, not currently eligible. Thresholds are configurable by authorized administrators. Show the reasons, and only when recorded evidence supports them.

Product fit: NEXiQ Call Assist (administrative volume, small team, shared non-emergency answering, after-hours workload, city service needs, routine automation) and NexCort iQ Core (dispatch operations, CAD integration, supervisor visibility, translation, live transcription, Continuity Log, modernization plans). Do not promise an integration that has not been verified for that agency.

Respect the six-zone model and the current state mapping. Preserve existing ownership. If a lead has no owner, use current assignment rules or a review queue. Never overwrite an assigned representative because enrichment changed a field.

## 11. Sales workflow

When a prospect is discovered: match or create the agency, attach source and verification, evaluate PSAP class and staffing, calculate a transparent score, check for duplicate leads and opportunities, assign the zone, surface the queue, suggest a next action, and let an authorized representative accept or dismiss it. Discovery does not mean outreach happened or that the agency is interested.

Suggested next actions include verify staffing, confirm non-emergency routing, identify the CAD vendor, research call volume, find the communications director, request a demonstration, discuss the free 60-day pilot, review budget constraints, identify procurement, and follow up. Founding Partner pricing and the free 60-day pilot may be offered as collateral. Do not apply a discount or start outreach automatically.

## 12. Automated monitoring

Use the existing scheduler. Suggested jobs: PSAP registry health check, staffing research refresh, procurement intelligence refresh, opportunity recalculation, research queue management, and sales notifications. Use AWS-native scheduling consistent with the current architecture. Do not overload providers or scrape without authorization. Include retry, concurrency limits, and access control.

## 13. Notifications

Examples: confirmed vacancy, a verified staffing report that qualifies a primary PSAP for the seven-or-fewer list, a matching CAD modernization RFP, a sourced CAD agreement approaching expiration, a verified procurement signal on an existing opportunity, a PSAP that consolidated or closed, a high-priority agency that needs verification.

Include agency, event, source, reporting date, verification status, suggested next step, and assigned representative. Do not duplicate a notification for the same source event. Use verified data, or label preliminary data. Do not fabricate urgency.

## 14. Technical architecture

Use the existing stack: Next.js, TypeScript, Cognito, API Gateway, Lambda, DynamoDB, EventBridge, SQS, S3, CloudWatch, Secrets Manager, and the current infrastructure-as-code layout.

Logical services may be named to match the repository: agency intelligence, PSAP registry import, matching, staffing enrichment, call-volume enrichment, CAD intelligence, procurement signals, Civic IQ adapter, evidence, verification workflow, opportunity scoring, and research scheduling. Do not create infrastructure that an existing service already provides.

The existing agency or PSAP prospect record is the canonical identity. Store facts, evidence, jobs, external identifiers, decisions, procurement events, and score history in compatible structures. Index agency lookup, FCC ID, state and zone, verification queues, and saved searches. Do not rely on a full-table scan for nationwide filtering. Imports and updates must be idempotent and safe under concurrency.

## 15. Security and access control

Suggested permissions:

- **NexCort administrator** — global configuration, sources, jobs, system access.
- **Sales administrator** — profiles, qualification settings, assignments.
- **Sales representative** — view authorized agencies, update assigned opportunities, submit research for verification.
- **Marketing** — approved aggregates only, without changing ownership or confidential notes.
- **Read-only analyst** — review intelligence and evidence without editing.

Require authentication, role checks, tenant scoping, field-level audit history, secret management, rate limits, input validation, safe document ingestion, no credential exposure, access logging, and restricted exports. Store public professional contacts only where appropriate. Do not collect private personal contact information without a need.

## 16. Acceptance tests

Use synthetic data and authorized sandbox services. Cover at least:

- **A** FCC import preserves IDs, geography, provenance, and historical freshness, and does not duplicate agencies.
- **B** A matching PSAP reuses the existing account, links the FCC ID, and keeps the representative and opportunity.
- **C** Similar names in one area require review and do not auto-merge.
- **D** Verified primary PSAP with seven dispatch personnel is included.
- **E** Eight is excluded.
- **F** Missing headcount is excluded from the verified list, included in research, and displayed as unknown.
- **G** Vacancy filter Any does not exclude zero, two, or unknown vacancies.
- **H** Modernization Any does not exclude an agency with no modernization project.
- **I** Seven console positions and seventeen employees are not classified as a seven-dispatcher PSAP from the console count.
- **J** An old FCC row without current classification evidence stays unverified.
- **K** 911 and administrative call statistics stay separate, with year and source, and are not double-counted.
- **L** Conflicting staffing claims from different years are both retained and require review. No silent overwrite.
- **M** A current CAD vendor from an official procurement record is stored with evidence. A bidder is not the incumbent.
- **N** A Civic IQ signal for an existing agency links, stores, avoids duplicates, keeps the source, and can recommend an opportunity update.
- **O** An awarded procurement is marked awarded and is not an open RFP.
- **P** A new verified fact recalculates the score, explains it, and keeps the previous score. No unsupported claims.
- **Q** A new agency receives the correct zone. Existing ownership, stages, and commissions stay intact.
- **R** Approving one staffing value and rejecting another publishes only the approved value and keeps the decision history.
- **S** A fact past its freshness threshold is marked stale, can create a research review, and is not fabricated forward.
- **T** An authorized merge keeps contacts, sources, opportunities, and sales history, and writes an audit event.
- **U** A Civic IQ or official-source outage fabricates nothing, preserves records, retries in a controlled way, and shows the error.
- **V** A sales representative cannot change restricted global enrichment settings. The denial is audited.
- **W** CSV export honors the filter, includes only permitted fields, and keeps source and verification metadata where configured.
- **X** Existing pipeline, stages, opportunities, contacts, zones, ownership, reporting, marketing separation, authentication, and CRM APIs still work.

## 17. Phases

**Phase 1 — Data foundation.** Audit, data models, profile extension, field-level evidence, manual research, verification workflow, saved PSAP filter, initial Agency Intelligence UI. Test this before continuing.

**Phase 2 — Federal and state data.** FCC import, freshness validation, matching, aliases, state source configuration, staffing and call-volume extraction, duplicate review, research suggestions.

**Phase 3 — Civic IQ and procurement.** Connection audit, authorized connector or import adapter, signals, RFPs, contact enrichment, contracts, opportunity linking, procurement alerts. Live sync stays `REQUIRES_CONFIGURATION` without a Secrets Manager key.

**Phase 4 — Sales prioritization.** Opportunity score, completeness, product fit, zone integration, saved views, research tasks, priority notifications.

**Phase 5 — Production readiness.** Scheduled refresh, monitoring, audit, performance, security tests, data-quality regression, import/export, staged rollout, rollback, operations documentation.

## 18. Final deliverables

Report architecture, reused modules, files, schema changes, API contracts, FCC configuration, state sources, Civic IQ status, verification rules, scoring, UI changes, the seven-dispatcher filter, permissions, schedules, actual test results, missing credentials, coverage limits, deployment steps, rollback, and a production-readiness checklist.

Classify each feature as implemented, tested, sandbox ready, production ready, requires configuration, or blocked. Do not call a placeholder, mock, or unused type “implemented.”

## 19. Definition of done

An authorized sales representative can open the Sales Dashboard, select Agency Intelligence, load **Primary PSAPs — 7 or Fewer Dispatchers**, see verified matches, filter them, open a profile, inspect staffing, call volume, technology, procurement, and the evidence behind material facts, see what is missing, stale, or conflicting, review Civic IQ opportunities when that integration is actually supported, view a transparent score, continue the agency in the existing pipeline, create research and follow-up tasks, export permitted results, and receive later updates without duplicate records or unverified claims.

The module stays grounded in source-backed data and does not present inferred staffing as verified fact.

## Final instruction

Begin with an audit of the existing Sales Dashboard. Build the feature in the existing application. Prioritize the seven-dispatcher view, reliable matching, evidence-backed staffing, and manual verification. Then add authorized source integrations, Civic IQ procurement intelligence, automated enrichment, and scoring in dependency order.

Execute meaningful tests and document the actual results. Do not stop at recommendations or mockups. Report what is verified, what is incomplete, and what needs external access or approval.
