# NexCort iQ Call Assist — Architecture Overview  
## Kansas City Missouri Police Department  
### RFP 2026-0010 Addendum 4 — Attachment

**Offeror:** Apps on Demand LLC d/b/a NexCort iQ  
**Scope:** AI-assisted **non-emergency** call management  
**Not in this diagram:** 911 CPE replacement · RapidSOS (removed per Q&A) · autonomous CAD dispatch

Use the diagrams below in the proposal (export to PNG/PDF). Narrative text may be copied into a cover page.

---

## 1. One-paragraph summary

Citizens dial KCPD’s **designated non-emergency** number. KCPD telephony (SIP/PSTN) delivers the call into **Amazon Connect**, which runs a Call Assist contact flow (language menu, AI disclosure, Lex bot). **Amazon Lex** plus NexCort iQ safety/intake services perform conversational triage. Outcomes are: **contain** (self-service / FAQ), **warm-transfer** to city services (311 / Parks / Water), or **immediate transfer** to a live call taker when emergency, distress, or low confidence is detected. Supervisors use the NexCort iQ web console for QA and analytics. **Motorola PremierOne** remains the CAD system of record; incident packets are human-reviewed and **fail-closed** until KCPD authorizes write-back.

---

## 2. Context diagram (agency view)

```mermaid
flowchart LR
  subgraph Citizens
    C[Caller]
  end

  subgraph KCPD_OnPrem["KCPD telephony / PSAP (agency-owned)"]
    NE[Non-emergency DID / SIP]
    CPE[911 CPE / radio / CAD floor]
    Live[Live call taker / queue]
  end

  subgraph AWS["NexCort iQ — AWS us-east-1 Multi-AZ"]
    Connect[Amazon Connect]
    Lex[Amazon Lex V2]
    API[Call Assist API / Lambdas]
    Web[Web console<br/>ops · QA · admin]
    Data[(DynamoDB + S3<br/>sessions · audit · media)]
  end

  subgraph External["City / self-service"]
    City[311 · Parks · Water · …]
    Portal[KCPD online reporting]
  end

  subgraph CAD_RMS["Systems of record"]
    P1[Motorola PremierOne CAD]
    RMS[Motorola Records RMS]
  end

  C --> NE
  NE --> Connect
  Connect --> Lex
  Lex --> API
  API --> Data
  Web --> API
  Connect -->|Emergency / low confidence / human request| Live
  Connect -->|Warm transfer| City
  API -->|SMS / URL when eligible| Portal
  API -.->|Human-reviewed packet<br/>fail-closed write| P1
  API -.->|Draft path fail-closed| RMS
  Live --> CPE
  CPE --> P1
```

**Boundary note:** Everything left of Connect (DIDs, CPE, queues overflow into 911) stays with KCPD. NexCort iQ owns the AI front-end, session data, and consoles on AWS.

---

## 3. Call path (happy path + escalate)

```mermaid
sequenceDiagram
  autonumber
  actor Caller
  participant Tel as KCPD non-emergency telephony
  participant Connect as Amazon Connect
  participant Lex as Lex + Safety Engine
  participant API as Call Assist services
  participant KB as Knowledge / intake
  participant Human as Live call taker
  participant CAD as PremierOne (review packet)

  Caller->>Tel: Dial non-emergency
  Tel->>Connect: SIP / PSTN
  Connect->>Caller: AI disclosure + language menu
  Connect->>Lex: Voice turn
  Lex->>API: Intent / slots / session
  API->>KB: Grounded FAQ / dynamic questions
  alt Emergency, distress, or low confidence
    Lex-->>Connect: Stop AI interview
    Connect->>Human: Transfer original caller leg
  else Contain / self-service
    API-->>Caller: FAQ or online-report SMS/URL
  else City service
    Connect->>Human: Warm-transfer to 311/Parks/Water
  else Police non-emergency intake complete
    API->>CAD: Transfer Package for human review
    Note over CAD: Write-back off until UAT + dual flags
  end
```

---

## 4. Logical component view

```mermaid
flowchart TB
  subgraph Edge["Voice edge"]
    CF[Connect contact flow<br/>disclosure · DTMF language · Lex attach]
    STT[Amazon Transcribe / Connect voice]
    TTS[Amazon Polly Neural<br/>EN Ruth · ES Lupe]
  end

  subgraph Brain["Call Assist intelligence"]
    LexBot[Lex V2 bot<br/>EmergencyEscalation · RequestHuman immutable]
    Safety[Safety Engine<br/>weapons / mid-call emergency hard stop]
    Triage[Triage + taxonomy<br/>13 RFP classes]
    Intake[Structured intake + dynamic Q]
    Ground[Never-fabricate grounding]
    Sentiment[Comprehend / Contact Lens distress path]
  end

  subgraph Ops["Operator surfaces"]
    Board[Call Assist live board]
    Session[Session detail · transcript · CAD card]
    QA[Supervisor QA]
    Analytics[Analytics]
    Admin[Admin · prompts · knowledge · routing · retention]
  end

  subgraph Integration["Integrations — gated"]
    CadGate{Dual fail-closed<br/>CAD_WRITEBACK + Call Assist push}
    CadAdapters[CAD adapters<br/>PremierOne first · multi-CAD ready]
    RmsGate[RMS draft fail-closed]
    Gis[GIS enrichment<br/>when KCPD endpoints provided]
    Sms[SMS self-service / status]
  end

  CF --> LexBot
  STT --> LexBot
  LexBot --> TTS
  LexBot --> Safety
  Safety --> Triage
  Triage --> Intake
  Intake --> Ground
  Sentiment --> Safety
  LexBot --> Board
  Board --> Session
  Session --> QA
  Session --> Analytics
  Admin --> LexBot
  Intake --> CadGate
  CadGate -->|authorized| CadAdapters
  CadGate -->|blocked| Session
  Intake --> RmsGate
  Intake --> Gis
  Triage --> Sms
```

---

## 5. Trust zones & data flow

| Zone | Components | Data |
|------|------------|------|
| **Agency edge** | Non-emergency DID, SIP to Connect, live queues | ANI/ALI/Caller ID when signaling provides them |
| **AWS application** | Connect, Lex, Lambda APIs, Cognito MFA console | Session, transcript, intake, audit (`agencyId`-scoped) |
| **Data at rest** | DynamoDB, S3 | Encryption at rest; TLS in transit |
| **Systems of record** | PremierOne, Records | Only after human review / UAT; write paths fail-closed by default |
| **Subprocessors** | AWS Connect, Lex, Transcribe, Polly, Translate, Bedrock (as configured), Comprehend | Listed in proposal subprocessors attachment |

**CJIS posture:** CJIS-**aligned** controls (MFA, encryption, RBAC, audit). Not an FBI CJIS ATO issued to NexCort iQ. RapidSOS is **not** on this non-emergency path.

---

## 6. CAD / RMS posture (proposal honesty)

```mermaid
stateDiagram-v2
  [*] --> ReviewPacket: Intake complete
  ReviewPacket --> FailClosed: Default production
  FailClosed --> HumanApprove: Call taker / supervisor
  HumanApprove --> LiveCreate: Only if dual write-back flags ON + KCPD UAT
  LiveCreate --> PremierOne
  FailClosed --> NoWrite: Flags off
  NoWrite --> [*]
  ReviewPacket --> RmsDraft: Optional Year 1 project
  RmsDraft --> HumanFile: Human submits in Records
```

---

## 7. How to attach

1. Export §2 (context) and §3 (sequence) as **two PNG figures** for the proposal body.  
2. Keep §4–§6 as an appendix if page count allows.  
3. Caption suggestion:

> **Figure A.** NexCort iQ Call Assist attaches to KCPD’s non-emergency telephony via Amazon Connect. AI triage runs in AWS; emergencies transfer to live call takers; CAD remains system of record with fail-closed write-back.

**Render tip (from repo root):**

```bash
# requires @mermaid-js/mermaid-cli
npx @mermaid-js/mermaid-cli -i docs/rfp/kcpd-2026-0010/diagrams/01-context.mmd -o docs/rfp/kcpd-2026-0010/diagrams/01-context.png -b white
```

Standalone `.mmd` files for export are in `diagrams/` beside this document.

---

## Version

| Date | Notes |
|------|-------|
| 2026-09-27 | Initial KCPD proposal architecture attachment |
