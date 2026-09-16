# KCPD live demo playbook — Call Assist

**RFP:** 2026-0010 Addendum 4 — AI-Assisted Non-Emergency Call Management (Kansas City Missouri Police Department PSAP)  
**Audience:** staff, commanders, and possibly the Chief — in the room **or over video** (see §2b)  
**Product:** Rapid Cortex **Call Assist** (non-emergency line). Not 911 CPE. Not CAD. Not RapidSOS.  
**KCPD told vendors to show:** system overview · multiple mock calls · language translation · non-emergency → emergency recognition and transfer · transcript accuracy · call-class accuracy · incident-type accuracy  

They score: **accuracy, escalation decisions, CAD integration, caller experience, supervisor oversight.**

Replace `{jurisdiction}` with the live KCPD tenant slug in the URL after login (example: `https://app.rapidcortex.us/{jurisdiction}/call-assist`). Tenant `agencyId` in product is `kcpd`.

---

## 0. What you are selling in one sentence

> Call Assist sits on the **non-emergency line**. It answers routine calls with conversational AI, gathers intake, classifies the call, and either **contains** it, **routes it to 311 / Parks / Water**, or **immediately hands it to a live call taker** — including when a “non-emergency” caller discloses an emergency mid-call. **Telecommunicators stay in command. CAD stays the system of record.**

Do **not** say we replace 911, PremierOne, or RapidSOS. Bid line 12 (RapidSOS) was **removed** — RapidSOS is 911 only.

---

## 1. Room setup (day-before)

| Check | Why |
|---|---|
| Two browsers or two users: **dispatcher** and **supervisor** (plus **agencyadmin** if you will run the demo runner) | Demo runner is admin-only; QA/analytics are supervisor+ |
| `{jurisdiction}/call-assist` loads with open sessions, not a 404 | Call Assist routes must be live |
| API demo mode on if you will use **Run scenario** (`ENABLE_CALL_ASSIST_DEMO_MODE`) | Demo emergency transfers go to the **tenant test destination**, never live 911 |
| CAD write-back **off** unless the addendum is signed | Show **CAD push ready — review before sending**. Do not auto-write PremierOne |
| Knowledge articles + 311 / Parks / Water routes enabled on the KCPD tenant | Out-of-agency transfer is an explicit RFP requirement |
| Spanish locale enabled (`es-US`) | Required language demo |
| Opening greeting includes KCPD disclosure | They asked about informing callers they are speaking with AI |

**Opening greeting (seeded):** *“Thank you for calling the Kansas City Police non-emergency line. I'm an automated assistant. This call may be recorded. If this is a life-threatening emergency, hang up and dial 9-1-1…”*

---

## 2. Recommended run-of-show (45 minutes)

Chiefs leave if this is a feature tour. Tell a **call story**, then prove oversight.

| Min | Block | What they asked for |
|---:|---|---|
| 0–4 | Frame + monitor | System overview |
| 4–10 | Call 1 — parking | Containment, intake, incident type |
| 10–16 | Call 2 — Spanish noise | Language / translation |
| 16–24 | Call 3 — gun mid-call | Emergency recognition + transfer (**do not skip**) |
| 24–30 | Call 4 — junk cars / 311 | Out-of-agency transfer |
| 30–36 | Session detail + CAD card | Transcript, class, PremierOne nature, human review |
| 36–42 | Supervisor QA + analytics | Oversight, false-transfer, containment |
| 42–45 | Admin: prompts, FAQ, Sunshine records | Config + Missouri retention |
| If time | Welfare check or theft/CarFax | Distressed caller / online reporting |

If the room is restless after Call 3, skip Call 4 and go to CAD + supervisor.

---

## 2b. If the demo is over video (Zoom / Teams / Meet)

The product story does **not** change. The **method** does. Live Connect/Lex is **mocked** in production today, so do **not** try a real DID into the meeting. Use the **demo runner + session screen** only. Treat the recording as scoring evidence.

### What changes vs in the room

| In the room | Over video |
|---|---|
| 45 min with a projector | **32 min demo + 10 min Q&A.** Chiefs drop at 25. |
| Speakerphone DID, you play caller | **No live phone.** You read the caller line, then click **Run scenario**. |
| Walk the room to a second PC | **Two Chrome profiles, two windows.** Share one window at a time. |
| Point at the screen with a finger | **Huge cursor, zoom the session panel, say the field name before you click.** |
| CarFax SMS to a test handset | **Do not text anyone on the call.** Show class + portal URL + the **Send SMS self-service** button. “SMS is wired; we are not sending to a KCPD cell from this meeting.” |

### Setup (30 minutes before join)

1. Clean Chrome profile. No Slack, no mail, no Rapid Cortex tickets, no other agencies in the switcher.
2. Browser at 125%. Share **the window**, not the whole desktop.
3. Pre-open and leave logged in:
   - Dispatcher: `/{jurisdiction}/call-assist`
   - Agency admin: `/{jurisdiction}/call-assist/demo` (runner)
   - Supervisor: `/{jurisdiction}/call-assist/qa` and `…/analytics`
   - Admin: `/{jurisdiction}/call-assist/admin` (Greeting tab)
4. Run **Parking** once privately. Confirm a session appears on the board. If it 404s, abort and use the backup (below).
5. Camera on for the first 60 seconds, then **camera off** so the UI fills the tile. Mic close; no HVAC noise.
6. Turn on **share computer sound** only if you play a recorded greeting. Otherwise leave it off — Zoom will eat TTS.
7. Co-pilot in chat: they paste URLs and park questions. You never Alt-Tab to Slack.

### Video run-of-show (32 minutes)

| Min | Block | On screen (share this window) |
|---:|---|---|
| 0–3 | Frame (camera on) | Call Assist **board** already visible behind you |
| 3–8 | Call 1 parking | Demo runner → Run → switch share to **board** → open session |
| 8–13 | Call 2 Spanish | Same pattern. Zoom the language chip + transcript |
| 13–20 | Call 3 gun | Same. Full-screen the **escalation** state. Pause 3 seconds. |
| 20–24 | CAD card | Stay on that session. Scroll slowly through intake → class → PremierOne review |
| 24–28 | 311 / Parks / Water | Either Call 4 **or** scroll the **External transfer** directory on the gun/code session — do not start a fifth scenario if time is gone |
| 28–32 | Supervisor | Switch share to QA window. One dashboard, one false-transfer sentence. Stop. |

**Drop from video if behind:** Call 4, CarFax, Greeting admin, Sunshine records. Offer “we can stay for admin after Q&A.”

**Do not drop:** gun call, CAD review card, “we do not auto-write PremierOne,” RapidSOS is out.

### How you play the caller on video

You are both narrator and caller. Script:

> “I’ll be the citizen. Watch the right side — class and confidence will move.”

Then **read one utterance**, click **Run scenario** (or the next step if the runner batches them), **stop talking** until the transcript line appears. Do not narrate over the model. After the session opens: *“Location. Vehicle. Class Parking. Nature PARK. No plate — it asked a follow-up instead of inventing one.”*

Spanish: read the Spanish line **in Spanish**. Then English: *“Language is Spanish. Transcript is source language. Interpreter is still your SOP.”*

Gun: after “he pulled out a gun,” wait for AI to **stop**. Then: *“AI conversation stopped. That is the product.”*

### Backup if the runner fails on the call

Have three **already-run** sessions pinned (parking, Spanish, gun) from the dry run. Open those. Say: *“These are the same engines; I’m opening the scored sessions from our rehearsal so we don’t debug live.”* Do not screenshare CloudWatch.

### Video-specific questions

| They ask | You say |
|---|---|
| Can we hear the actual voice bot? | Connect/Lex is on a test/mock path in this environment. What you are scoring is Safety, Triage, and Intake — the same engines that would sit on the DID. We can schedule a telephony soak separately. |
| Can you text me the CarFax link? | Not from this call. I’ll show eligibility and the KCPD portal URL. SMS uses a tokenized app link; we are not sending into the meeting. |
| Send us the recording / click path | Yes — this playbook plus the four URLs. We will not send production credentials in chat. |

### Close on video (same 30 seconds)

Same close as in person. Then: *“We’ll stay on for questions. If the Chief has to drop, the gun-call and CAD-review clips are the evaluation.”*

---

## 3. How you get there (clicks)

All paths are under the **dispatcher / supervisor** left nav unless noted.

| Screen | Nav | URL |
|---|---|---|
| Call Assist live board | OPERATIONS → **Call Assist** | `/{jurisdiction}/call-assist` |
| One call | Click a session row | `/{jurisdiction}/call-assist/sessions/{sessionId}` |
| Scripted mock calls | Sign in as **agencyadmin** → Call Assist → demo (or paste URL) | `/{jurisdiction}/call-assist/demo` |
| Live 911 workspace (contrast only) | OPERATIONS → **Dispatcher** | `/{jurisdiction}/dispatcher` |
| RC Translate | OPERATIONS → **RC Translate** | `/{jurisdiction}/translate` |
| CAD review queue | Supervisor → **CAD Queue** (only if write-back UI is on) | `/{jurisdiction}/review` |
| Call Assist QA | SUPERVISOR → **Call Assist QA** | `/{jurisdiction}/call-assist/qa` |
| Analytics | SUPERVISOR → **Call Assist Analytics** | `/{jurisdiction}/call-assist/analytics` |
| Admin / prompts / FAQ / routing | Agency admin → Call Assist (or `…/call-assist/admin`) | `/{jurisdiction}/call-assist/admin` |
| Sunshine / public records | `…/call-assist/records` | `/{jurisdiction}/call-assist/records` |

**Two ways to run mock calls**

1. **Preferred (required over video):** `{jurisdiction}/call-assist/demo` → pick scenario → **Run scenario**. Then open the new session on the live board. Label it: *“These are seeded KCPD streets (Troost, Main, Grand). The engines are the same ones that would sit on the non-emergency DID.”*
2. **Live DID (in-room only, and only if Connect/Lex is un-mocked):** put the test number on speaker, you play caller, dispatcher screen is projected. **Do not patch a DID into Zoom** — echo plus the current mock voice path will fail in front of the Chief.

Do not run 911 cardiac / fire scenarios from Scenario Center. Wrong product.

---

## 4. Opening (4 minutes)

**Say this, then stop talking:**

1. KCPD handles on the order of **450,000 non-emergency calls a year** (~1,200/day). This product is for **that** queue, not 911.
2. Call Assist **augments** call takers. It does not sit in the 911 chair.
3. Three outcomes only: **AI contains** · **warm-transfer to city services** · **immediate human** (low confidence, distress, or emergency language).
4. CAD: we **recommend** PremierOne nature and priority. A person **reviews** before anything is sent. Same adapter pattern if you leave Motorola later.
5. RapidSOS is out of this bid. We will not demo it.

**Show:** `{jurisdiction}/call-assist` — open sessions, class badges (emergency / non-emergency / self-service), elapsed time, confidence.

**Anticipated questions**

| They ask | You say |
|---|---|
| Does this answer 911? | No. Non-emergency line only. Emergencies transfer to a live call taker / 911 path. |
| Will callers know it’s AI? | Yes, if you require it. KCPD greeting already discloses an automated assistant and points life-threats to 9-1-1. Configurable under Admin → Greeting. |
| Does it dispatch? | No. It does not allocate units. CAD remains authoritative. |

---

## 5. Mock calls — order, clicks, talk track

Use the seeded KCPD scenarios. IDs in the product: `kcpd-01` … `kcpd-10`.

### Call 1 — Parking (containment) — `kcpd-04`

**Why first:** Easy win. Shows intake, classification, CAD nature `PARK`, no drama.

**Run:** Demo runner → **Parking complaint** → Run scenario.  
**Then:** Call Assist board → new session → open it.

**Caller lines (if live):** “Someone is blocking my driveway” → “742 Elm Street” → “It’s a silver sedan” → “I don’t have the plate.”

**Point at the session:** location, vehicle, missing plate (intelligent follow-up, not a hung script), classification **Parking**, CAD type label / nature **PARK**, confidence.

**Say:** *“Incomplete information is normal. The AI asks the next useful question for this call type. It does not invent a plate.”*

**They will ask:** What if they get angry?  
**Answer:** Distress / low confidence / barge-in escalates to a human. We would rather transfer early than contain a bad call.

---

### Call 2 — Spanish noise — `kcpd-08`

**Why second:** They explicitly required language translation.

**Run:** **Spanish noise**.  
**Caller:** “Hay mucho ruido en mi vecindario” / “4500 Calle Broadway”.

**Show:** language chip on the session (`es-US` / Spanish). Transcript in source language. If you also open **RC Translate** (`/{jurisdiction}/translate`), show assistive translation for the call taker — **human interpreter remains the backstop**.

**Say:** *“English and Spanish are first-class. Other locales are configured per tenant. We do not claim every language is equal, and we do not remove Language Line from your SOP.”*

**They will ask:** TTY / TDD?  
**Answer:** Session can flag TTY mode and recommend SMS fallback scripts. We are **not** claiming we replace your certified 911 TTY CPE. Hearing-impaired path on this bid is SMS / TTY-aware assist on the non-emergency line, plus your existing 911 TTY.

---

### Call 3 — Mid-call emergency (must hit) — `kcpd-06`

**Why this is the demo:** RFP: identify emergencies, distressed callers who first said non-emergency, transfer immediately. Q&A: “non-emergency to emergency recognition and transfer.”

**Run:** **Mid-call emergency**.  
**Caller:** “There’s a suspicious person outside” → “Actually he just pulled out a gun” → “I need help now.”

**Show on the board:** state flips toward **escalation** (transfer 911 / live call taker). AI conversation **stops**. Do **not** keep chatting.

**Say:** *“The first utterance looks like suspicious person. Weapons language is a hard interrupt. Confidence and safety rules beat containment. Demo transfers use a test destination — we never place a live 911 call from this room.”*

**They will ask:** What if the model is wrong?  
**Answer:** Fail **toward the human**. False transfer is tracked in QA. A false 911 transfer is cheaper than containing a gun call. Supervisors score those sessions.

**They will ask:** Intoxicated / mental health / juvenile?  
**Answer:** Sentiment, voice-emotion (when enabled), and low confidence all escalate. We do **not** diagnose. We do not keep a juvenile on an AI script when the signal is messy.

---

### Call 4 — Code / 311 — `kcpd-10`

**Why:** Last page of their requirements: transfer **outside the agency** — 311, Parks, Water.

**Run:** **Code enforcement**.  
**Caller:** “My neighbor has junk cars in their yard” / “1900 Troost Avenue.”

**Show:** classification **Code Enforcement**; **External transfer** directory on the session — **311 Kansas City**, Parks, Water. Warm-transfer script: summary goes with the caller.

**Say:** *“Police non-emergency should not eat city-service demand. Routing is a directory you own, not a hardcoded Rapid Cortex phone book.”*

**They will ask:** Who picks 311 vs Parks?  
**Answer:** Triage class maps to the enabled external agency. Admins edit that under Call Assist Admin. Noise can route Parks; parking/code/info can route 311; public works can route Water.

---

### Optional if the Chief is still in the chair

| Scenario | ID | Show this |
|---|---|---|
| Abandoned vehicle | `kcpd-01` | 1847 Troost; days on scene; callback; **Non-emergency police** |
| Noise | `kcpd-02` | Apt 3B; **Noise** nature |
| Welfare check | `kcpd-03` | Elderly neighbor; do **not** contain if distress; likely human |
| Theft / report only | `kcpd-05` | Porch package; **Report only** / online reporting |
| Parking, no plate | `kcpd-07` | Follow-up questions; still classifies Parking |

### CarFax (KCPD meaning) — `kcpd-09` or **Theft Report**

KCPD’s list says **“CarFax Reporting eligible.”** In this bid that is **self-service online vehicle reporting**, not the commercial Carfax insurance/history product. On the KCPD tenant the portal URL is `https://www.kcpd.org/online-reporting`. CAD nature maps to `VEHTHFT`. The monitor badge is **SELF SERVICE**.

**Do not say** we are integrated with Carfax Inc. **Do say:** *“If the theft is not in progress, nobody is hurt, and we have a vehicle and a location, we can text a link to KCPD online reporting instead of holding a call taker.”*

**Best live lines (the eligibility engine actually checks these):**  
“My car was stolen **yesterday** from I-70 and Woodland. It’s a blue Honda Civic, plate XYZ999. Nobody was hurt.”

Must be **historical** (not in progress), **no injury**, **vehicle identified**, **location given**. A fender-bender *in progress* or with injuries is **not** CarFax-eligible — that stays with a human / CAD.

**Clicks:** Demo runner → **CarFax eligible** or **Theft Report** → open the session → class `CARFAX_REPORTING_ELIGIBLE` → **Send SMS self-service** on the session (portal link). Assistant script: *“This may be eligible for online vehicle reporting. I can text you a secure link.”*

**If they ask “is that Carfax the company?”**  
*“No. It’s KCPD’s name for the online vehicle-report path. The link is your portal. We only decide eligibility and send the SMS.”*

---

## 6. Session detail — transcript, class, CAD (6 minutes)

**Where:** click the mid-call emergency or parking session.

**Walk the screen top to bottom, slowly:**

1. **Transcript** — caller vs assistant. “This is what we mean by transcript accuracy. You can QA the words, not a black box.”
2. **Intake block** — location, apt, vehicle, weapons, injuries, callback. Maps to their Call Intake list.
3. **Triage / class** — Emergency vs Parking vs Report only. Maps to item 4 (AI-assisted call triage).
4. **CAD card** — “CAD push ready — review before sending to PremierOne.” Nature codes on this tenant: `NEPOL`, `NOISE`, `PARK`, `CODE`, `PW`, `RPT`, `ONRPT`, `VEHTHFT`, etc.
5. **Duplicates / chronic / premise** — if chips are present, say they come from CAD/history integration when connected; do not fake a Motorola live query if the adapter is mock.
6. **Send to PremierOne** — only click if write-back is **on** and you are in a sandbox. Otherwise: *“Selecting Motorola does not turn on write-back. That is a signed addendum. Today the call taker sees the packet; CAD remains the system of record until you enable send.”*

**CAD-agnostic (they added this in writing):** *“PremierOne is today’s adapter. The same review packet can target another CAD if you leave Motorola. We do not lock you to one vendor.”*

**They will ask:** Incident creation / updates / unit status / CAD notes?  
**Answer:** Creation and notes are the first write path, **human-approved**. Unit status and full RMS (Motorola Records) are a **project**, not a checkbox in this demo. Do not promise bidirectional RMS Day 1.

---

## 7. Supervisor oversight (6 minutes)

Switch user (or second screen) to **supervisor**.

### QA — `/{jurisdiction}/call-assist/qa`

**Show:** dashboard, keyword search, **false transfer** filter, AI score, human review, prompt-proposal from a QA finding (proposals do **not** go live until an admin approves).

**Say:** *“Containment without QA is how agencies get burned. Supervisors score the AI the same way they score people.”*

### Analytics — `/{jurisdiction}/call-assist/analytics`

**Point at whatever is populated:** answer/handle time, containment, transfer rate, language, incident types. If heat maps are empty, say geographic views need volume + geocodes — do not apologize, do not invent a map.

**KCPD asked for:** average answer time, AHT, AI containment, transfer rate, abandonment, queue, peak, language, incident types, heat maps. Show what is live; list the rest as dashboard fields in the same app, not a future product.

---

## 8. Admin, knowledge, records (3 minutes)

Sign in as **agencyadmin** → `/{jurisdiction}/call-assist/admin`

| Tab | Show | Tie to RFP |
|---|---|---|
| **Greeting** | Disclosure + 911 redirect | “Inform callers they are interacting with AI” |
| **Prompts** | Opening / follow-up; versioned; rollback | Item 21 — adjust AI prompts |
| **Knowledge** | FAQ, city services, directories | Item 10 |
| **Settings / types / routing** | Call types, external agencies | Workflows, 311/Parks/Water |
| **Records** (`…/call-assist/records`) | Sunshine request intake | Missouri Sunshine Law, export formats, chain of custody |

**Retention (say once):** tenant default is Missouri Sunshine (RSMo 610) — audio/transcript years, legal hold, export MP3/WAV/JSON/CSV/PDF. **Department policy wins**; we do not invent a hidden vendor retention.

---

## 9. Anticipated questions (rest of the list)

Answer short. Then offer the screen if you have it.

| Topic | Honest answer |
|---|---|
| **Never fabricate** | Grounded in intake + knowledge. Low confidence → human. We do not let the model invent addresses or plates. |
| **Interrupted / two speakers** | Barge-in count is on the session; we treat overlapping speech as a reason to slow down or escalate, not to guess. |
| **Motorola PremierOne** | Nature mapping is on this tenant. Write-back is fail-closed until addendum. |
| **Works if we leave Motorola** | Yes — adapter pattern. New CAD is a scoped integration, not a rewrite of Call Assist. |
| **RapidSOS** | Out of this RFP. 911 stack. We will not pretend. |
| **SIP / existing 911 phone system** | Call Assist attaches to the **non-emergency** voice path (Connect / SIP as implemented). We do not rip out 911 CPE. Queue/overflow is telephony + our routing rules together. |
| **GIS** | Address text + geocoding/jurisdiction when GIS is connected. Demo streets are KCPD-flavored examples. |
| **CJIS** | **CJIS-aligned** controls: MFA (Cognito), TLS in transit, encryption at rest, RBAC, audit logs. **Do not say CJIS certified.** Pen-test / vuln scanning are operational commitments, not a slide claim unless you have the report. |
| **99.99% / 500 ms / 95% ASR** | Do not quote those numbers as guarantees in the room. Offer SLA discussion in the proposal, AWS architecture, and pilot measurement. |
| **Continuous learning** | QA scores and prompt proposals. No silent training on production audio without legal sign-off. |
| **Video / SMS** | Rapid Cortex has SMS and video-assist in the platform. This bid’s core demo is **voice Call Assist**. Offer a 60-second pointer to silent text / media if asked; do not derail. |
| **Callbacks** | Callback queue on the Call Assist monitor. Automated status callbacks are configured, not magic. |
| **CarFax** | KCPD label for **online vehicle reporting**, not Carfax Inc. Eligible when historical vehicle crime, vehicle ID, location, no injury. SMS link to `kcpd.org/online-reporting`. In-progress or injury → human. |
| **Five years / 500k population references** | Do not bluff. Offer current US PSAP/campus references you actually have. |
| **Implementation** | Named PM, parallel ops, UAT, cutover, rollback — from the RFP pack (`docs/rfp/implementation-and-transition.md`). This demo is capability, not a signed schedule. |

---

## 10. Words to use / words that lose the room

**Use**

- Augment, assist, contain, escalate, review, system of record  
- Non-emergency line  
- Human when confidence fails  
- PremierOne **adapter**  
- CJIS-**aligned**

**Do not use**

- “We replace CAD / 911 / RapidSOS”  
- “CJIS certified” / “SOC 2 Type II” unless counsel has the paper  
- “The AI dispatches”  
- “Always 95% accurate”  
- “We train on your live calls automatically”  
- Clicking **Send to PremierOne** against production CAD  

---

## 11. If something breaks

| Symptom | Move |
|---|---|
| Demo runner 403 | You are on dispatcher — switch to **agencyadmin** |
| Demo runner “demo mode” error | Skip to a **pre-seeded session** on the board; narrate engines |
| Call Assist 404 | Do not debug in front of the Chief. Switch to QA screenshots / second tenant you tested |
| Empty analytics | Stay on **one session’s transcript + class** — that is what they score |
| Someone asks RapidSOS | “Removed from the bid. Happy to discuss 911 separately.” |

---

## 12. Close (30 seconds)

> You asked for a live, scenario-based demo because paper hides escalation mistakes. You just watched containment on a parking call, Spanish intake, a gun call leave the AI, and a city-service handoff to 311 — with a supervisor QA path and a CAD packet that does not write until a person says so. That is the product: **take 1,200 non-emergency calls a day off the 911 floor without letting a weapon stay in the bot.**

---

## 13. Requirement → screen (cheat sheet)

| KCPD item | Where you prove it |
|---|---|
| 1 AI answering / disclosure / escalate | Greeting + Calls 1–3 |
| 2 Intake | Session intake block |
| 3 Classification / duplicates / premise | Session chips + CAD card |
| 4 Triage classes | Class badge + Call 1/4/optional theft |
| 5 NLP / LLM / sentiment / summary | Transcript, confidence rows, QA score |
| 6 Language | Call 2 + RC Translate |
| 7 Voice / SMS / video | Voice here; SMS/video only if asked |
| 8 Callbacks | Monitor callback queue |
| 9 Self-service / online reporting | CarFax / report-only scenario |
| 10 Knowledge | Admin → Knowledge |
| 11 Motorola CAD | CAD review card (write-back gated) |
| 12 RapidSOS | **Do not demo** (removed) |
| 13 Telephony | Talk track: non-emergency SIP/Connect |
| 14 RMS | “Project, not this demo” |
| 15 GIS | Location on session; don’t fake a full GIS console |
| 16–17 CJIS / cyber | MFA login, audit, aligned language |
| 18 Retention / Sunshine | Records + retention policy |
| 19 QA | `/call-assist/qa` |
| 20 Analytics | `/call-assist/analytics` |
| 21 Admin | `/call-assist/admin` |
| 22 Perf SLAs | Proposal, not live stopwatch theater |
| 23–25 Training / implementation / maintenance | Close + RFP pack |
| CAD-agnostic | Adapter talk track |
| 311 / Parks / Water | Call 4 + external directory |

---

**Related:** [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md) · [NON_GOALS.md](./NON_GOALS.md) · [rfp/README.md](../rfp/README.md)
