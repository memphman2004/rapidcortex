# NexCort iQ K–12 — Integration Matrix

**Product:** NexCort iQ Campus (K–12)  
**Last updated:** November 2026

---

## Overview

This document maps every integration point for the K-12 platform: what's live, what's planned, and what will never be in scope (by design). External integrations always require a signed customer agreement covering data privacy before activation.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Live | Implemented, deployed, and testable |
| ⚠️ Partial | Scaffolding exists; full integration incomplete |
| 🔧 Planned Phase 2 | Architecture decided; not yet built |
| 🔧 Planned Phase 3 | Deferred; design not finalized |
| ❌ Out of scope | Will not be built; documented reason given |
| 🔒 Requires contract | Requires signed DPA or vendor agreement before build |

---

## 1. Identity & Access Management

| Integration | Status | Notes |
|------------|--------|-------|
| AWS Cognito (platform IdP) | ✅ Live | Shared User Pool `us-east-1_0z6tA6WBs`; `custom:role = campus_*_k12` |
| Google Workspace SSO | ❌ Out of scope | Districts request; Cognito Hosted UI supports SAML/OIDC; needs per-district config |
| Microsoft Entra ID (Azure AD) SSO | ❌ Out of scope | Same Cognito SAML support path; district IT integration task |
| Clever (school SSO) | 🔧 Planned Phase 3 | Popular in K-12 for roster sync + SSO; requires OAuth app approval |
| ClassLink | 🔧 Planned Phase 3 | Competitor to Clever; similar OAuth path |

---

## 2. Student Information Systems (SIS)

The absence of SIS integration is the **most significant functional gap** compared to Raptor Technologies, which supports PowerSchool, Infinite Campus, Skyward, Aeries, and others out of the box.

| Integration | Status | Notes |
|------------|--------|-------|
| PowerSchool | 🔒 Planned Phase 3 | Most common US K-12 SIS; REST API + OAuth; requires district API credentials and DPA |
| Infinite Campus | 🔒 Planned Phase 3 | Strong Midwest/West presence; SDK available |
| Skyward | 🔒 Planned Phase 3 | WSIPC model; REST or SOAP API |
| Aeries (CA focus) | 🔒 Planned Phase 3 | California dominant; REST API available |
| Synergy (Edupoint) | 🔒 Planned Phase 3 | Strong Pacific Northwest |
| Tyler Technologies SIS | 🔒 Planned Phase 3 | Also integrates with Tyler CAD (existing NexCort iQ partner) |
| Clever roster sync only | 🔧 Planned Phase 2 | Lightweight student/guardian roster via Clever API; no full SIS sync |
| Manual CSV roster upload | 🔧 Planned Phase 2 | District uploads student/guardian CSV; maps to pickup auth records |

**What SIS sync enables:**
- Student lookup by name or ID in visitor/pickup workflows
- Pre-populated class roster for evacuation roll call
- Guardian phone numbers for parent notification
- Grade-level context on incidents

**Data boundary (critical):** Only import name, student ID, grade, and guardian contact info. Do **not** import grades, attendance, discipline history, IEP status, or medical records from SIS. Those require separate FERPA consents and data processing agreements.

---

## 3. Law Enforcement & Background Checks

| Integration | Status | Notes |
|------------|--------|-------|
| NSOPW (National Sex Offender Public Website) | ✅ Live | Public API; no key required; called on every visitor check-in |
| FBI CJIS NCIC | ❌ Out of scope | Requires CJIS Security Addendum + law enforcement affiliation; schools are not CJIS-eligible entities |
| State DOJ background check (DOJ Live Scan) | 🔒 Requires contract | CA Education Code §45125.1 requires DOJ fingerprint check for school volunteers; NexCort iQ tracks status (cleared/pending/flagged) but does not conduct the check |
| IDEMIA / IdentoGO (fingerprint vendor) | 🔒 Requires contract | For tracking fingerprint-based background check clearances; NexCort iQ receives status webhook, doesn't conduct check |
| Checkr (soft background check) | 🔒 Planned Phase 3 | For contractor/vendor background checks; non-fingerprint; Checkr has a school district program |
| Raptor Technologies (sex offender check) | ❌ Competitor | NexCort iQ directly competes; use NSOPW instead |

**Compliance note:** NexCort iQ's NSOPW integration satisfies NSOPW national registry check. It does NOT satisfy state laws requiring fingerprint-based DOJ background checks for school volunteers. Those checks must be completed through the state-approved vendor; NexCort iQ tracks the clearance status received from the district HR system.

---

## 4. Emergency Notifications

| Integration | Status | Notes |
|------------|--------|-------|
| AWS Pinpoint (SMS) | ✅ Live | Inbound (reporter texts campus number) + outbound (broadcast SMS to staff) |
| Campus broadcast (in-platform) | ✅ Live | WebSocket push to logged-in staff |
| Everbridge | ❌ Out of scope Phase 1 | Enterprise ENS; NexCort iQ would publish an event; Everbridge handles distribution. Requires contract. |
| Omnilert | ❌ Out of scope Phase 1 | K-12-specific ENS; API available; requires contract |
| Rave Mobile Safety | ❌ Out of scope Phase 1 | 911-integrated ENS; requires contract |
| Parent/guardian SMS (Pinpoint) | 🔧 Planned Phase 2 | Requires parent consent table + opt-in campaign |
| Push notifications (mobile app) | 🔄 Platform SNS | SNS topic available; campus-specific push not yet configured |

---

## 5. Physical Security Systems

| Integration | Status | Notes |
|------------|--------|-------|
| Security event webhook (generic) | ✅ Live | `POST /api/public/campus/{code}/security-events` accepts VMS/ALPR/alarm sources |
| VMS (Video Management System) | ⚠️ Partial | Webhook schema supports VMS events; no specific VMS vendor adapter |
| ALPR (Automatic License Plate Reader) | ⚠️ Partial | ALPR source in `campusSecurityEventSourceSchema`; no plate-to-student lookup |
| Access control (door alarms) | ⚠️ Partial | `alarm` source in webhook; no access control panel integration |
| LenelS2 / Genetec | ❌ Planned Phase 3 | Enterprise access control; webhook adapter needed |
| Avigilon / Milestone VMS | ❌ Planned Phase 3 | Full VMS SDK adapter; camera feed to Rapid Vision |
| Bluelight poles (custom network) | ✅ Live | Activation via API key; `BlueLightApiKeySecretArn` |
| Verkada (cloud camera) | 🔧 Planned Phase 3 | Webhook + API; popular in K-12; Verkada has school safety program |

---

## 6. Dispatch / CAD

| Integration | Status | Notes |
|------------|--------|-------|
| NexCort iQ PSAP (same account) | 🔄 Platform | Campus incidents can link to PSAP incidents via shared incident bus |
| Nex iQ CAD (account 621957412915) | 🔄 Platform EventBridge | CAD publishes `incident.created`; Pre-Arrival iQ fires; campus does not submit to CAD |
| CentralSquare CAD | 🔄 Platform | NexCort iQ has CentralSquare adapter; campus incidents can be shared if PSAP has NexCort iQ |
| Tyler CAD (New World) | 🔄 Platform | Same; Tyler CAD adapter exists in platform |
| Motorola PremierOne | 🔄 Platform | Same |
| Campus → CAD submission | ❌ Out of scope | Campus is not a PSAP; no campus-to-CAD writeback. Campus staff call 911. |

---

## 7. Geographic Information Systems

| Integration | Status | Notes |
|------------|--------|-------|
| Amazon Location Service (GIS) | ✅ Live | `rc-map-dev`, `rc-map-dark-dev`, campus building geocoding |
| Education POI search | ✅ Live | `education-places.ts`; nearby school search with GeoPlaces; `EDUCATION_POI_CATEGORIES` |
| Campus map / floor plan | ⚠️ Partial | Zone model exists; no SVG/DXF floor plan rendering |
| Google Maps | ❌ Out of scope | Amazon Location is primary mapping solution |
| Esri ArcGIS | 🔧 Planned Phase 3 | Some districts use ArcGIS for property boundaries; GeoJSON import |

---

## 8. AI Services

All AI services route through the same AWS account (158961537080). The CJIS AI content fence applies: campus student welfare data is **not** CJIS-controlled, but FERPA applies to personally identifiable student information.

| Integration | Status | Notes |
|------------|--------|-------|
| AWS Bedrock (AI triage) | ✅ Live | Incident description AI classification; EAP suggestion |
| RC Translate (AWS Transcribe + Translate) | ✅ Live | Multi-language translation for non-English speaking reporters |
| Rapid Vision (AWS KVS + Rekognition) | ✅ Live | AI scene intelligence from campus cameras |
| AWS Transcribe (voice reporting) | 🔧 Planned Phase 3 | Voice-to-text for staff incident notes |
| OpenAI / Anthropic (external) | ❌ Out of scope | All AI runs on AWS Bedrock; no external AI API |

**AI guardrails for K-12 student data:**
- AI output on incidents involving minors must be labeled "AI-assisted draft — requires human review"
- AI must never independently classify a student as a threat or flag them in a background context
- AI recommendations for BTAM cases require TAT member review before any action

---

## 9. Media & Evidence

| Integration | Status | Notes |
|------------|--------|-------|
| S3 incident media | ✅ Live | Pre-signed upload URL → S3 `rapid-cortex-incident-media-{stage}-{accountId}` |
| Visitor photo (S3) | ⚠️ Partial | `idPhotoKey` field exists; full upload flow not confirmed in visitor UI |
| Video clip export | ✅ Live | `VideoClipExporterFunction`; download clip from KVS stream |
| Court order / document upload | ❌ Planned Phase 2 | For custody restriction documentation; needs pickup auth attachment support |

---

## 10. Reporting & Compliance

| Integration | Status | Notes |
|------------|--------|-------|
| School safety PDF (internal) | ✅ Live | `schoolSafetyReportPdfBodySchema`; pdfkit generation |
| After-action PDF | ✅ Live | `campus-after-action-pdf.ts` |
| State education safety portal | ❌ Out of scope Phase 1 | Each state has different portals (CA SARC, IL School Safety Center, etc.); no adapters built |
| FBI UCR / NIBRS school data | ❌ Out of scope | Law enforcement reporting; not applicable to campus safety software |
| Clery Act (higher-ed) | 🚫 Higher-ed only | `campus-clery-service.ts`; blocked for K-12 by institution type gate |

---

## Integration Decision Matrix

Before adding any new integration:

| Check | Required? |
|-------|----------|
| Signed customer DPA (data processing agreement) | Yes for student PII |
| State education privacy law review (SOPIPA, FERPA, state law) | Yes |
| Parent notification of new data sharing | Yes if student data leaves the platform |
| Minimum data principle review | Yes — only import what the feature requires |
| Demo mode mock path | Yes — no live API calls during demo/CI |

---

## Integration Request Process

Districts requesting new SIS or background check integrations should:

1. Submit a support ticket with the system name and API documentation link
2. NexCort iQ confirms technical feasibility
3. District provides API credentials + executed DPA
4. NexCort iQ builds to staging environment
5. District UAT
6. Production deployment with district authorization

Integrations that require law enforcement system access (NCIC, state DOJ) are **not available** to campus customers. Campus NexCort iQ is not a CJIS-covered entity.
