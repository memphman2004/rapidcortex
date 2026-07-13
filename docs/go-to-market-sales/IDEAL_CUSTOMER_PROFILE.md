# Ideal customer profile (ICP)

**Purpose:** Fit filter and segment playbook for sales and pilot qualification — not a public marketing persona deck.

Product boundaries remain in [MVP_SCOPE.md](./MVP_SCOPE.md) and [NON_GOALS.md](./NON_GOALS.md). Use this with [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) and [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md). Pricing figures below are **sales guidance for ICP sizing**; confirm current commercial terms before quoting.

Segments:

| Segment | Product focus | Typical ACV sweet spot |
|---------|---------------|------------------------|
| **Core** | 911 / PSAP / ECC | $33.6K–$216K/yr (+ add-ons) |
| **Campus** | University & campus safety | $25K–$70K/yr |
| **Venue** | Stadiums & event centers | $28K–$72K/yr |

---

## Quick scorecard (all segments)

### Strong fit

- Bounded customer (single ECC/PSAP, campus, or venue) willing to run a **controlled** pilot with written assistive-AI governance ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).
- IT / security can support Cognito-based access, URL deployment, and required secrets ([INSTALLATION.md](./INSTALLATION.md)).
- Supervision culture that **reviews** escalations and AI-assisted outputs — not set-and-forget automation.
- **Side-by-side posture:** CAD, radio, ENS, VMS, and logging remain authoritative; Rapid Cortex is an intelligence / reporting layer ([PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)).

### Weak fit (defer or reshape)

- Expectation that Rapid Cortex **replaces** CAD, 911 CPE, radio, ENS, or logging as system of record ([NON_GOALS.md](./NON_GOALS.md)).
- Requirement for certified CJIS / HIPAA / SOC 2 **claims** in the pilot window without a completed assessment program.
- Unbounded multi-tenant self-serve signup without agency/institution onboarding.
- Mandatory bidirectional CAD or guaranteed live radio ingest as a **Day-1** deliverable without a scoped connector project.
- No executive / operational sponsor, no IT capacity, or budget below segment floors listed below.

---

## 1. Core — 911 & emergency communications

**Tags:** CJIS-aware · CAD integration · 40+ languages

### Organization profile

| Attribute | Profile |
|-----------|---------|
| Organization types | PSAP · 911 center · ECC · Regional dispatch authority · County / city / municipal dispatch |
| Dispatcher seat range | 1–75 seats (Micro through Command); Enterprise / statewide for 75+ |
| Call volume | &lt;2K to 100K+ calls/month depending on jurisdiction size |
| Geography | US-wide; Southeast priority (Columbus, GA home base); state capital regions and mid-size counties are highest-density targets |
| Annual budget range | $33,600–$600,000/year platform + CAD integration add-ons ($35K–$250K) + professional services |
| Procurement | Government purchasing; competitive RFP often &gt;$25K; PSAP grants (NextGen 911, E911 surcharge, BRIC); annual budget cycles |
| Contract length | 12–36 months; annual renewal standard; multi-year preferred |
| ACV sweet spot | $33.6K–$216K/year (Essential through Max Pro) + onboarding + add-ons |

### Decision makers & stakeholders

| Role | Type | Notes |
|------|------|-------|
| Communications Director / PSAP Manager / ECC Director | Champion | Day-to-day pain owner; first evaluator; needs IT and leadership buy-in |
| Director of IT / CISO | Technical gate | Security, CJIS alignment, CAD/telephony feasibility; can block or accelerate |
| Sheriff / Chief of Police / Fire Chief / City Manager | Budget authority | Final approver for larger deals; liability, staffing, performance metrics |
| County Board / City Council | Final approval | Larger contracts; can add 60–120 days; public procurement |
| Dispatchers / Shift Supervisors | End users | Adoption validators; resistant to added cognitive load — demo live workflow benefits |

### Pain points & trigger events

- **Dispatcher burnout & staffing crisis** — 25–40% vacancy rates industry-wide; RC reduces per-call mental load via AI structuring.
- **Language barriers** — Interpreter connect times 3–8 minutes; RC real-time translation (40+ languages, &lt;4s latency target).
- **Manual CAD data entry** — Transcribing while managing the call; RC extracts and assists structured population (write-back is gated / not Day-1 default).
- **Supervisor visibility gaps** — Command dashboard, silent monitoring, whisper coaching.
- **QA, compliance & liability** — Searchable transcripts and automated QA scoring vs manual review.
- **Modernization without CAD replacement** — Layer on existing CAD and telephony.

**Triggers:** Major incident / high-profile failure · New communications director · Grant funding (BRIC, E911, NextGen911) · State modernization mandate · Accreditation review · Staffing crisis.

### Technical environment

| Area | Typical stack / posture |
|------|-------------------------|
| CAD | Motorola PremierOne · Tyler New World · Hexagon · CentralSquare · Tritech · Mark43 · Zetron |
| Telephony / PSAP | Motorola ASTRO/APX · Airbus Vesta · Intrado · Comtech · Mission Critical Partners |
| Logging | NICE Inform · Verint · Motorola Wave · HigherGround · Replay |
| Existing AI | Often none — greenfield opportunity |
| RC integration mode | Phase 1 standalone (most pilots) → Phase 2 assisted CAD push → Phase 3 full bidirectional (custom) |
| Timeline | Standalone in days; CAD read-only 30–90 days; full bidirectional 90–180 days |

### Buying process

1. **Discovery** — ECC intro → live demo → workflow mapping (30–60 days)
2. **Technical review** — IT/CISO questionnaire → CJIS alignment → CAD feasibility (30–45 days)
3. **Pilot proposal** — 90-day Quick-Start ($32K–$210K); no CAD write-back in pilot; Pilot Scope Agreement (15–30 days)
4. **Budget & procurement** — City/county approval, RFP if required, MSA; NET 30 (30–120 days)
5. **Production** — Full MSA → implementation → go-live → support tier

**Sales notes**

- Cycle: 3–18 months depending on size and procurement.
- Fastest path: ECC Director with budget authority at small–mid agency ($33.6K–$72K tier).
- Accelerant: Active grant funding before fiscal year end.
- Blocker: IT security review without a pre-delivered CJIS alignment / security packet.

### Pricing fit (guidance)

| Tier | Size | Price band | Fit |
|------|------|------------|-----|
| Micro / Essential | 1–3 seats · &lt;2K calls/mo | $2,800/mo · $33,600/yr | Small municipal / rural county |
| Small / Pro | 4–10 seats · &lt;10K calls/mo | $4,200–$8,500/mo · up to $102K/yr | Mid-size city or county PSAP |
| Medium / Pro | 11–18 seats · 10K–18K calls/mo | $13,000/mo · $156K/yr | Regional / larger county |
| Command | 19–75 seats · up to 100K calls/mo | $15.5K–$50K/mo · up to $600K/yr | Metro ECC, regional PSAP, state capital |
| Enterprise / Statewide | 75+ seats | $60K–$250K+/mo · $720K–$3M+/yr | Multi-agency / statewide |

**Add-ons:** CAD read-only $35K–$100K one-time · CAD write-back $75K–$250K · Onsite $15K–$100K · Priority support $2.5K–$7.5K/mo.

### Negative ICP (Core)

- CAD write-back required as non-negotiable Day-1
- No IT capacity for integration setup
- Annual technology budget under $25K
- Competing AI platform procurement in final stages
- Unwilling to run standalone pilot before full CAD integration
- On-premises only (no cloud)
- No executive sponsor with operational authority

### Entry motion & pilot path (Core)

Lead with Quick-Start Pilot (no CAD required). Target ECC Directors at mid-size PSAPs (4–10 seats) with active PSAP grant funds. 90-day scope: real-time transcription, AI incident structuring, live translation on 2–3 channels, supervisor dashboard. **Pilot Scope Agreement first; MSA after pilot success.**

---

## 2. Campus — university & campus safety

**Tags:** ~$1.40/student · Clery Act · QR · NFC · SMS

### Organization profile

| Attribute | Profile |
|-----------|---------|
| Organization types | 4-year universities · Community colleges · Private colleges · Large K-12 (5,000+ students) · Hospital / medical campuses with dedicated security |
| Size basis | $1.40/enrolled student/year · $5,000 minimum · Sweet spot 10,000–50,000 enrolled ($14K–$70K/yr ACV) |
| Geography | US-wide; large state universities (SEC, ACC, Big Ten, Pac-12) highest value; regional 10K–30K enrollment highest volume |
| Annual budget | $15,000–$100,000/year platform + onboarding + training |
| Procurement | University purchasing; often single-approver sub-$50K; Clery / Title IX / campus safety mandates create urgency |
| Contract length | 12-month academic year aligned; multi-year preferred; auto-renew common |
| ACV sweet spot | $25,000–$70,000/year for 18K–50K student institutions |

### Decision makers & stakeholders

| Role | Type | Notes |
|------|------|-------|
| Chief of Campus Police / Director of Public Safety | Champion | Owns ops problem; Clery and reporting gaps; fastest demo path |
| VP Student Affairs / Dean of Students | Budget authority | Safety / student experience budgets; often signer sub-$50K |
| CISO / Director of IT | Technical gate | SMS, FERPA, privacy; no PII in logs, anonymous reporting |
| Provost / President | Institutional sign-off | Larger or politically sensitive purchases |
| Students / Campus safety staff | End users | Students report (no app); staff operate console |

### Pain points & trigger events

- Students won’t call 911 for many campus incidents → anonymous QR/SMS/NFC (no app).
- Location accuracy broken on vague texts → consent GPS link or manual entry.
- Fragmented radio / phone / walk-up intake → single live console with zones.
- Clery ASR burden → structured, exportable incident records.
- Passive tip lines / download-required apps → live two-way text with security.
- Board / accreditation modernization pressure and peer adoption.

**Triggers:** High-profile campus incident · New Chief · Clery audit finding · Board modernization directive · Drill outcomes · Enrollment-linked grants.

### Technical environment

| Area | Typical stack / posture |
|------|-------------------------|
| ENS | Rave · Omnilert · Regroup · Everbridge · Blackboard Connect — RC alongside, not instead |
| VMS | Milestone · Avigilon · Salient · Genetec · ONVIF-compatible |
| Campus PD CAD | Some run Motorola/Tyler; many rely on city/county 911 — RC layers on campus security ops |
| RC requirements | Dedicated Twilio number (local) · A2P 10DLC · QR/NFC per building/zone · Campus admin console |
| Timeline | MSA → Twilio → accounts → QR/NFC → signs → live in **2–4 weeks** |
| Privacy | No PII in CloudWatch · Anonymous reporting option · Ephemeral location · FERPA-aware design |

### Buying process

1. **Intro & demo** — QR scan → console (15 min closes most pilots) (14–30 days)
2. **Stakeholder review** — VP Student Affairs + IT; FERPA/privacy + CJIS-alignment brief (15–30 days)
3. **Pilot agreement** — One campus, one semester (~90 days); QR/NFC + training (5–15 days to close)
4. **Contract** — MSA; ACV = enrollment × $1.40 (confirm current min); live 2–4 weeks
5. **Renewal** — Scan/incident/response metrics → expand zones / roles / multi-year

**Sales notes**

- Cycle: 6 weeks–4 months (fastest of three segments).
- Fastest path: Campus Police Chief with budget authority at 10K–30K enrollment.
- Accelerant: Recent incident, Clery finding, or peer adoption.
- Submit A2P 10DLC early (1–5 business days) so registration does not delay go-live.

### Pricing fit (guidance)

| Tier | Enrollment | Price band | Fit |
|------|------------|------------|-----|
| Small campus | ~3,500–10,000 | $5,000–$14,000/yr | Community / small private (min applies) |
| Mid-size | 10,000–25,000 | $14,000–$35,000/yr | Regional state / smaller conference schools |
| Large | 25,000–50,000 | $35,000–$70,000/yr | Major state / flagship campuses |
| Flagship / mega | 50,000–70,000+ | $70,000–$100,000+/yr | Top enrollment / multi-campus |

**Add-ons:** Camera integration for supported VMS often in onboarding · Training $2,500–$7,500 · A2P ~$10 · Twilio number ~$1.15/mo.

### Negative ICP (Campus)

- Under ~3,500 enrolled (below ACV floor)
- No IT capacity for Twilio webhooks / DNS
- Recent ENS contract covering similar functionality
- Legal prohibits SMS-based location collection
- No dedicated campus security / public safety department
- Campus PD fully dependent on city/county 911 with no independent security ops

### Entry motion & pilot path (Campus)

Lead with 15-minute student QR → live console demo. Target Chief / Director of Public Safety at 10K–50K enrollment. Pilot: 3–5 zones with QR/NFC, SMS intake, console for one semester. Go-live 2–4 weeks from MSA. Post-pilot metrics (scans, incidents, response) drive renewal and expansion.

---

## 3. Venue — stadiums & event centers

**Tags:** Capacity-tiered · Camera auto-launch · QR · NFC · SMS

### Organization profile

| Attribute | Profile |
|-----------|---------|
| Organization types | NFL/NBA/MLB/NHL/MLS stadiums · NCAA arenas · Major concert venues · Convention centers · Airports (domestic terminal) · Multi-purpose event centers · Large fairgrounds |
| Capacity tiers | Tier 1 &lt;10K · Tier 2 10K–25K · Tier 3 25K–50K · Tier 4 50K+ (custom) |
| Geography | US-wide; Southeast priority (Atlanta, Charlotte, Nashville, Jacksonville, New Orleans); NFL/NBA highest ACV; NCAA Tier 1 highest volume |
| Annual budget | $18,000–$72,000+/year; enterprise/stadium custom |
| Procurement | Private sector (faster than government); Security / Ops P&L often to sub-$75K; legal + insurance/risk |
| Contract length | 12-month (calendar or season); multi-year preferred; event-specific pilots possible |
| ACV sweet spot | $28,000–$72,000/year for Tier 2–4 |

### Decision makers & stakeholders

| Role | Type | Notes |
|------|------|-------|
| Director of Security / VP Security Operations | Champion | Event-day volume and radio gaps; section visibility and fan-to-console |
| VP / Director of Operations | Budget authority | Liability, insurance, guest NPS |
| GM / CEO / President | Executive sign-off | Brand protection, peer venues, league pressure |
| Legal / Risk / Insurance | Compliance gate | Fan-report liability, consent, retention |
| IT / Technology | Technical gate | VMS/KVS/RTSP, SMS, network segmentation |

### Pain points & trigger events

- Fan reports lost in radio traffic → structured fan-to-console channel.
- No section-level awareness → bowl map + camera auto-launch.
- Guests won’t approach security → QR/NFC on seatbacks / concourses.
- Evidence missed before arrival → photo/video in report flow.
- Post-incident documentation gaps → timestamped audit trail.
- Event-day surge → severity-sorted queues vs radio chatter.

**Triggers:** High-profile stadium incident · New Security Director · Insurance / risk audit · Peer adoption · League safety mandate · Season planning kickoff.

### Technical environment

| Area | Typical stack / posture |
|------|-------------------------|
| VMS | Genetec (common in major leagues) · Milestone · Avigilon · Salient · ONVIF |
| Camera path | RTSP → KVS Producer Agent → Kinesis Video Streams → WebRTC in console; no camera replacement |
| SMS / reporting | Dedicated Twilio + A2P 10DLC · QR/NFC per section, gate, concourse, restroom corridor |
| Camera count | Often 100–500+; RC auto-selects top cameras for section — no manual pick |
| Network | Agent: RTSP:554 on LAN; HTTPS/443 + UDP high ports outbound to AWS; ~5 Mbps/upload per concurrent 1080p stream |
| Timeline | MSA → Twilio → camera registry → KVS agent → QR/NFC → pre-event test → live; typically **3–6 weeks** |

### Buying process

1. **Intro & demo** — QR → console → **camera auto-launch** → two-way chat (14–30 days)
2. **Technical site assessment** — VMS/RTSP, agent path, SMS plan (15–30 days)
3. **Legal & risk** — MSA, privacy/consent, retention (15–30 days)
4. **Pilot** — One season (3–5 events); selected sections + concourses; pre-event test required (5–15 days)
5. **Production** — Annual MSA; full zone coverage; post-season debrief → renewal

**Sales notes**

- Cycle: 6 weeks–6 months (faster than government Core).
- Fastest path: Security Director at Tier 2–3 (10K–50K) approaching season.
- Demo closer: camera auto-launch on section incident.
- Mandatory day-before pre-event test: text in → incident → location → camera → two-way chat.

### Pricing fit (guidance)

| Tier | Capacity | Price band | Fit |
|------|----------|------------|-----|
| Tier 1 — Small | &lt;10,000 | $18,000/yr | Minor league, small arenas, amphitheaters |
| Tier 2 — Mid | 10,000–25,000 | $28,000/yr | MLS, mid arenas, convention centers |
| Tier 3 — Large | 25,000–50,000 | $45,000/yr | MLB, major NCAA, large amphitheaters |
| Tier 4 — Major | 50,000+ | $72,000+/yr (custom) | NFL, mega-venues, large airports |

**Add-ons:** Camera onboarding often included · Onsite event support $10K–$25K/event · QR/NFC production client-owned (RC provides assets) · Pre-event testing included.

### Negative ICP (Venue)

- Under ~1,000 capacity
- No dedicated security ops / supervisor on event day
- Camera system with no RTSP (legacy analog, no IP conversion)
- Network blocks outbound AWS HTTPS/UDP
- Competing in-house fan reporting already live
- Fewer than ~4 events/year
- Decision-maker is a one-off promoter with no ongoing venue relationship

### Entry motion & pilot path (Venue)

Lead with camera auto-launch demo. Target Security Director at Tier 2–3 near season. Pilot: 3–5 sections + concourses, SMS, KVS for pilot zones, 3–5 events. Pre-event test 24 hours before first live event. Per-event debriefs (scans, incidents, response) drive full-venue annual renewal.

---

## Roles we optimize for in pilot

| Segment | Primary console operators | Primary reporters |
|---------|---------------------------|-------------------|
| Core | Dispatchers, supervisors, agency admins | Callers (voice) |
| Campus | Campus security / dispatch | Students / community (QR/SMS/NFC) |
| Venue | Venue security / guest services / ops | Guests / fans (QR/SMS/NFC) |

See [USER_GUIDE.md](../admin-user-management/USER_GUIDE.md), [role-dashboard-spec.md](../role-dashboard-spec.md), and segment ops guides under `docs/admin-user-management/`.

---

## Related

- [USE_CASES.md](./USE_CASES.md)
- [PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md)
- [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)
- [GTM_EXECUTION_PLAN.md](./GTM_EXECUTION_PLAN.md) — ICP qualification checkpoint
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)
- [PILOT_OVERVIEW.md](./PILOT_OVERVIEW.md)
- [CONTRACT_PACKAGE_INDEX.md](./CONTRACT_PACKAGE_INDEX.md)
