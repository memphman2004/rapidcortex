# Ring Developer Portal — Privacy & Legal Questionnaire (paste pack)

**App:** Rapid Cortex Connect  
**Entity:** Apps on Demand LLC d/b/a Rapid Cortex  
**Support:** support@rapidcortex.us · Privacy: privacy@rapidcortex.us  
**Privacy:** https://www.rapidcortex.us/legal/privacy/  
**Terms:** https://www.rapidcortex.us/legal/terms/  
**Website:** https://www.rapidcortex.us  
**Sub-processors:** https://www.rapidcortex.us/legal/sub-processors/  

Use these answers in the Certify → **Privacy & Legal questionnaire** tabs. Adjust free-text if your counsel prefers different entity naming. Mark radio options to match the intent notes.

---

## Ring-flagged answers — paste these (replace any “Rapid Cortex should add…” placeholders)

### Use of customer data for AI model training

Rapid Cortex does not use customer data, incident data, call recordings, transcripts, or any personally identifiable information to train, fine-tune, or develop AI or machine learning models. AI functionality within Rapid Cortex is provided by third-party AI providers operating under data processing agreements that explicitly prohibit the use of customer data for model training purposes.

### Data retention

Incident and call data is retained for the duration of the agency's active subscription plus 90 days following contract termination, after which it is permanently deleted. Ring camera access tokens are deleted immediately upon account unlinking or subscription termination. Audit logs are retained for 7 years in compliance with public safety recordkeeping requirements. Users may request data deletion by contacting support@rapidcortex.us, or Ring Device Owners may delete their Rapid Cortex account on the Account Link page (https://www.rapidcortex.us/connect/ring/link).

Ring video from Connect is not stored by Rapid Cortex (0-day retention).

### Data sharing with third parties and sub-processors

Rapid Cortex shares data with the following categories of sub-processors to deliver the service:

- Infrastructure: Amazon Web Services (AWS) — hosting, storage, compute
- Communications: Twilio Inc. — SMS and voice messaging
- Camera Integration: Ring LLC (Amazon) — device authorization and live video streaming, solely pursuant to user consent
- AI Processing: Anthropic PBC — natural language processing and transcription analysis under a data processing agreement

Rapid Cortex does not sell, rent, or share personal data with third parties for advertising, marketing, or any purpose other than delivering the contracted services. A complete list of sub-processors is available at https://www.rapidcortex.us/legal/sub-processors/.

---

## Tab 1 — General

**Business description**  
Rapid Cortex provides decision-support software for emergency communications (911 / PSAP), campus safety, and venue security. Rapid Cortex Connect is a Ring Appstore integration that lets Ring Device Owners voluntarily enroll so nearby public-safety agencies can request temporary, consent-gated live video during an active emergency near the device address. Video is never shared without a per-request Allow from the owner.

**Headquarters / primary location**  
United States (US operations; customer agencies are US public-safety and campus/venue operators).

**Years in operation**  
Use your current company tenure (Apps on Demand LLC d/b/a Rapid Cortex). If unsure, state the year Rapid Cortex product development began and that the Ring Connect module is in partner certification.

**Features provided through Ring**  
- Account linking via Ring Appstore (OAuth + nonce verification)  
- Discovery of owner-authorized Ring devices for Connect eligibility  
- Per-incident emergency video access requests with SMS Allow / Decline / Stop Sharing  
- Time-limited live viewing for authorized dispatchers (no standing access)  
- Owner disconnect via Ring My Apps and Rapid Cortex data-deletion requests  

**Serve users outside the US?**  
No for the Ring Connect pilot / Appstore listing (US Ring accounts and US agencies). Select **No** unless counsel expands scope.

**Targets children under 13?**  
No. Select **No**.

---

## Tab 2 — Data processing

**Ring user data collected / processed**  
| Data | Purpose |
|------|---------|
| Ring OAuth tokens (access/refresh) | Call Ring Partner / Amazon Vision APIs for authorized devices and streaming after consent |
| Ring account id / partner account id | Link Ring identity to Rapid Cortex homeowner account; nonce matching |
| Device id + user-assigned device name | Show devices to owners/dispatchers; never rely on raw ids in owner-facing SMS |
| Device location (when provided by Ring / ops seed) | Radius search for nearby emergencies only |
| Profile email / phone (when returned by Ring) | Account linking, SMS consent delivery, Cognito phone sync when available |
| App-integration status | Complete Appstore linking (POST then PATCH `completed`) |

**Video / media**  
Live video is streamed only after the owner taps **Allow** on that request. Rapid Cortex does **not** record or retain Ring video (0-day retention). No bulk download of historical Ring clips for Connect.

**Data minimization**  
- No standing LE dashboard into customer cameras  
- One active request per camera/incident; rate limits on requests  
- Scopes limited to devices the owner authorized in Ring  
- Tokens stored in AWS Secrets Manager; agency-scoped DynamoDB records  

**AI training on Ring data?**  
No. Rapid Cortex does not use customer data, incident data, call recordings, transcripts, Ring video/metadata, or any personally identifiable information to train, fine-tune, or develop AI or machine learning models. AI features are provided by third-party providers (see sub-processors) under DPAs that prohibit using customer data for model training. Public policy: https://www.rapidcortex.us/legal/privacy/

**Secondary uses**  
None beyond providing Connect, security, audit, and support. No advertising, no sale of Ring data.

**Transparency**  
Privacy Policy: https://www.rapidcortex.us/legal/privacy/  
Terms: https://www.rapidcortex.us/legal/terms/  
Owners see consent language on Appstore link / start pages and in each SMS.

---

## Tab 3 — AI governance

**AI models in use related to Ring Connect**  
Ring Connect itself does not run ML on Ring video. Broader Rapid Cortex platform may use AI for 911 call intelligence (transcription/triage/QA) on agency telephony — that pipeline is separate from Ring camera streams.

**Performance / drift / edge cases**  
Connect relies on explicit human approval (owner SMS) and dispatcher action; no automated decision grants camera access.

**Explainability**  
Access decisions are human: dispatcher initiates request; owner Allow/Decline/Stop; dispatcher End Access.

**Automated decision-making**  
No automated granting of Ring camera access.

**Law enforcement integrations**  
Rapid Cortex serves licensed emergency communications / public-safety agencies as the **customer**. Access to a Ring owner's camera requires **that owner's per-request consent**. There is no standing LE feed, no backdoor, and no sharing without the owner Allow for that incident. Aligns with Ring permitted “customer-initiated / per-instance consent” patterns — not standing surveillance.

---

## Tab 4 — Data protection

**Security architecture**  
- AWS-hosted (API Gateway HTTP APIs, Lambda, DynamoDB, Secrets Manager, Cognito, KVS WebRTC for live view)  
- TLS in transit; secrets not stored in plaintext env vars  
- Agency (`agencyId`) scoping on data access; RBAC for dispatcher roles  
- Audit events for link, consent, revoke, disconnect  

**Security programs**  
CJIS-**aligned** engineering controls documented; not claiming FBI CJIS certification or SOC 2 attestation in this questionnaire unless counsel provides current attestations. Vulnerability management via AWS + internal review.

**Access controls**  
Cognito authentication; role-based dispatch consoles; owner SMS tokens for consent links (no login required for Allow/Decline/Stop).

**Audit**  
CloudWatch + DynamoDB audit records for Ring Connect actions.

**Rights management**  
- Consent: per-request SMS Allow  
- Retention: Incident/call data for the active subscription plus 90 days after termination, then permanent deletion. Ring camera access tokens deleted immediately on unlink or termination. Audit logs retained 7 years. Ring video not stored (0-day). Deletion requests: support@rapidcortex.us; self-serve at https://www.rapidcortex.us/connect/ring/link  
- DSAR / deletion: support@rapidcortex.us; owner disconnect via Ring My Apps; Account Link page self-serve delete; Connect privacy section documents deletion  
- Revocation: Stop Sharing SMS, dispatcher End Access, Ring My Apps remove app  

**Privacy governance**  
Privacy policy + terms published; support contact on listing and site.

---

## Tab 5 — Third parties

**Who accesses Ring data**  
| Party | Why |
|-------|-----|
| AWS (infrastructure) | Hosting, secrets, live stream transport |
| Twilio Inc. | SMS Allow/Decline/Stop Sharing messages to device owners |
| Anthropic PBC | Agency telephony NLP/transcription (separate from Ring video; DPA prohibits training on customer data) |
| Ring / Amazon Vision API | Device list, streaming after consent |
| Participating public-safety agency (customer) | Only after owner Allow for that request; live view only |

Public sub-processor list: https://www.rapidcortex.us/legal/sub-processors/

**Vetting**  
AWS as primary cloud; Ring as partner platform; agencies under MSA/pilot agreements.

**Contractual safeguards**  
Agency MSA / pilot terms; Ring Appstore program requirements; privacy policy.

**Access revocation**  
Owner Stop Sharing / Decline; remove app in Ring My Apps; webhook handling for `app_integration_removed` / `device_removed`; dispatcher End Access.

**Can users restrict third-party sharing?**  
Yes — owners choose devices in Ring, can Decline every request, Stop mid-session, and disconnect the app. Rapid Cortex does not share Ring video with unrelated third parties.

---

## After pasting

1. Save and submit the questionnaire in the portal.  
2. Paste `REVIEWER_NOTES.md` into the three “Add notes” fields.  
3. Follow `SUBMIT_RUNBOOK.md` for the attestation checkbox.
