# Email campaign — 911, Campus, and Venue

**Audience:** sales, Rapid IQ operators, marketing.  
**Cold outreach still requires human approval** before send. Bulk campaigns (100–500 prospects) are queued as drafts, then approved once on [Sales Automation](../../apps/web/app/rc-admin/sales-automation/page.tsx). Email 1 sends from the connected Outlook mailbox; the 15-minute worker drains up to 150 due emails per run.  
**Scope guardrails:** [PROMISE_CONTROL.md](./PROMISE_CONTROL.md), [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md), [IDEAL_CUSTOMER_PROFILE.md](./IDEAL_CUSTOMER_PROFILE.md).

This is one program with **three vertical tracks**. Do not mix tracks. A PSAP director should never receive a stadium QR email.

---

## 1. Campaign brief

| | |
|--|--|
| **Name** | NexCort iQ vertical outbound 2026 |
| **Goal** | Book a 20-minute product walkthrough that can convert to a **controlled pilot**. Not self-serve GA. |
| **Primary CTA** | [Contact sales](https://www.rapidcortex.us/contact-sales?interest=demo) with vertical UTM (below). |
| **Offer** | Assistive intelligence layer alongside existing CAD / campus PD / venue security — not a replacement for 911, CAD, radio, ENS, or VMS. |
| **Duration** | Always-on 6-touch outbound + weekly *Inside the Cortex* for opted-in contacts. |
| **Owner** | Sales. Rapid IQ drafts sequences; an `rcadmin` approves each send. |

**Success (90 days)**

- Reply rate ≥ 3% on approved sends (track in Rapid IQ).
- ≥ 8 qualified walkthroughs (ICP scorecard passed).
- ≥ 2 written pilot conversations (scope agreement path, not a verbal “we’ll try it”).

---

## 2. Lists and who gets which track

Build three suppression-clean lists. Source: Rapid IQ intel, PSAP prospect export, conference attendees, inbound `/contact-sales`.

| Track | Include | Exclude | Primary titles |
|-------|---------|---------|----------------|
| **911 / PSAP (Core)** | US PSAPs, ECCs, regional dispatch; 4–75 dispatcher seats | Agencies demanding Day-1 CAD write-back; no IT; budget &lt; $25K | Communications Director, PSAP/ECC Manager, Sheriff/Chief (budget), IT/CISO |
| **Campus** | 10K–50K enrollment with dedicated public safety | &lt; ~3,500 enrolled; no campus security ops; legal ban on SMS location | Chief of Campus Police, Director of Public Safety, VP Student Affairs |
| **Venue** | Tier 2–4 stadiums, arenas, convention centers, major event ops | &lt; ~1K capacity; no event-day supervisor; analog-only cameras with no RTSP path | Director of Security, VP Ops, GM (cc only after champion engages) |

**Shared suppressions:** unsubscribed, bounced, `noreply`, contacted in last 30 days, active competitor procurement in final award, Ring-only camera pitch (Ring Connect is suspended — do not mention Ring).

---

## 3. Mechanics (use on every send)

| Field | Value |
|-------|--------|
| From name | NexCort iQ |
| From address | `hello@nexcortiq.us` (Connect Outlook as this mailbox on `/rc-admin/sales-automation`) |
| Reply-to | Same mailbox (replies land in Outlook Sent / Inbox) |
| Send window | Tue–Thu, 09:30–11:30 **recipient local** |
| Cadence | Day 0 → 5 → 12 → 19 → 26 → 33. Stop on reply, bounce, or unsubscribe. |
| Rapid IQ | First three touches only (days 0 / 5 / 12), after human approval. Email 1 sends immediately from Outlook; 2 and 3 on the 15-minute worker. Emails 4–6 stay manual. |

**CTA URLs** (append `&utm_content=e01` … `e06`):

```
911     https://www.rapidcortex.us/contact-sales?interest=demo&utm_source=email&utm_medium=outbound&utm_campaign=psap_core_2026
Campus  https://www.rapidcortex.us/contact-sales?interest=demo&utm_source=email&utm_medium=outbound&utm_campaign=campus_safety_2026
Venue   https://www.rapidcortex.us/contact-sales?interest=venue-demo&utm_source=email&utm_medium=outbound&utm_campaign=venue_ops_2026
```

**Landing pages to mention, never as a dump:** Core `/product/core` · Campus `/product/campus` · Venue `/product/venue` · Pilot `/free-60-day-pilot`.

**Footer (required)**

```
NexCort iQ · rapidcortex.us
This email is for {{org_name}} operations leadership. Unsubscribe: https://www.rapidcortex.us/unsubscribe
```

**Banned phrases** (do not edit back in): certified CJIS/HIPAA/SOC 2; replaces CAD/911/radio; AI dispatches units; guaranteed latency/accuracy; eliminates interpreters; bidirectional CAD (unless that named connector is in contract); Ring Connect.

---

## 4. Merge fields

| Token | Example |
|-------|---------|
| `{{first_name}}` | Maria |
| `{{org_name}}` | Harris County 911 |
| `{{title}}` | Communications Director |
| `{{signal}}` | NG911 board agenda / Clery finding / season opener (omit the sentence if empty) |
| `{{cta}}` | Vertical CTA URL with `utm_content` |

If Rapid IQ has a procurement signal, keep **one** factual clause. Do not invent RFPs.

---

## 5. Track A — 911 / PSAP (Core)

**Promise:** NexCort iQ sits **beside** CAD and telephony. Transcription, structured AI assistance, supervisor visibility, and translation **when the agency configures that pipeline**. Humans remain in charge.

**Asset links (email 5):** `/product/core` · `/psap-software` · `/cad-integration`

### A1 · Day 0 — Problem (Rapid IQ step 1)

**Subject:** `{{org_name}}: less typing while the call is still live`  
**Alt subject:** `A second screen for {{org_name}} dispatch — not another CAD`  
**Preheader:** Assistive transcription and structure next to the systems you already trust.

```
{{first_name}},

Dispatchers at {{org_name}} still have to listen, type, and decide on the same call. That load does not get smaller when vacancies sit at 25–40%.

NexCort iQ is a browser co-pilot for 911 / ECC staff: live transcription, AI-assisted incident structure, and supervisor visibility. It does not replace CAD, CPE, radio, or the dispatcher.

{{signal}}

If a 20-minute walkthrough would help you judge fit against your floor — not a product pitch in the abstract — reply here or use:
{{cta}}

Best,
The NexCort iQ team
```

### A2 · Day 5 — How it sits with CAD (Rapid IQ step 2)

**Subject:** `Re: {{org_name}} — CAD stays the system of record`  
**Preheader:** Side-by-side with Motorola, Tyler, Hexagon, CentralSquare, and the rest.

```
{{first_name}},

Quick clarification, because this is where 911 evaluations go sideways:

CAD remains the system of record. NexCort iQ is an intelligence layer: transcripts, suggested structure, protocol-aligned coaching when your agency has approved packs, and QA surfaces for supervisors.

CAD write-back is off unless you later sign a scoped connector project. We start most agencies on a standalone pilot so IT is not blocked on a vendor program.

Happy to send the one-page architecture note or walk the dispatcher workspace live:
{{cta}}
```

### A3 · Day 12 — Supervisor + language (Rapid IQ step 3)

**Subject:** `{{org_name}} — what supervisors actually see`  
**Preheader:** Second-line review, not set-and-forget automation.

```
{{first_name}},

Last note unless you want a working session.

Supervisors use NexCort iQ for a second look: searchable transcripts, flags for review, and coaching that follows agency-approved protocol packs. Translation and language detection run when your deployment wires that pipeline — they do not replace interpreters.

If the timing is wrong, say so. If a 20-minute floor walkthrough is useful before budget lock, I will keep it tight:
{{cta}}
```

### A4 · Day 19 — Objection: “We already record”

**Subject:** `Recording ≠ structure at {{org_name}}`

```
{{first_name}},

Logging systems keep the tape. They do not usually put a structured, searchable incident in front of the call-taker while the caller is still talking.

That is the gap NexCort iQ is built for: assistive structure during the event, then audit after — still next to CAD, not instead of it.

If that is already solved on your floor, I will close this thread. If not:
{{cta}}
```

### A5 · Day 26 — Asset + grants

**Subject:** `One page for {{org_name}} IT / procurement`

```
{{first_name}},

If it is easier to share internally than take a call: NexCort iQ Core overview is here:
https://www.rapidcortex.us/product/core

For agencies using NG911 or E911 surcharge / BRIC timing, we scope a controlled pilot first (transcription + AI assistance + supervisor view). We do not lead with a CAD rip-and-replace SOW.

Walkthrough when you are ready:
{{cta}}
```

### A6 · Day 33 — Breakup

**Subject:** `Closing the loop with {{org_name}}`

```
{{first_name}},

I will not keep pinging. If NexCort iQ is not on {{org_name}}’s roadmap this cycle, that is fine.

If a later grant, accreditation, or CAD project reopens the conversation, we can pick it up then. Unsubscribe anytime: https://www.rapidcortex.us/unsubscribe
```

---

## 6. Track B — Campus

**Promise:** QR / NFC / SMS reporting into a campus console. **Not a 911 system.** Students are not required to download an app. Clery-aware structured records; campus PD and 911 remain authoritative.

**Asset links:** `/product/campus` · `/campus-safety-software`

### B1 · Day 0 — Problem (Rapid IQ step 1)

**Subject:** `{{org_name}}: most students still will not call 911`  
**Alt subject:** `QR on the lamp post vs another safety app`  
**Preheader:** Report by QR, NFC, or SMS. No app required.

```
{{first_name}},

At {{org_name}}, a lot of welfare and property incidents never become a 911 call. Students will scan a code or text a short keyword. They will not install another app during week one.

NexCort iQ Campus puts QR, NFC, and SMS reports on a live campus console with building / zone context. It is not a 911 emergency dispatch system and it does not replace campus police.

{{signal}}

Fifteen minutes is enough to watch a scan land on the console:
{{cta}}
```

### B2 · Day 5 — Console + Clery (Rapid IQ step 2)

**Subject:** `Re: {{org_name}} — one console, not another ENS`  
**Preheader:** Alongside Rave / Omnilert / Everbridge — not instead of them.

```
{{first_name}},

Campus ENS products blast alerts. NexCort iQ is the intake and coordination layer for what students actually report: location-aware incidents, two-way text with security when you enable it, and structured records that help Clery documentation instead of a reconstruction after the fact.

IT usually asks about FERPA and logs: we design for no PII in operational CloudWatch logs and anonymous reporting options. Your counsel still owns policy.

Demo the student path:
{{cta}}
```

### B3 · Day 12 — Speed to live (Rapid IQ step 3)

**Subject:** `{{org_name}} — semester pilot, not a year-long CAD project`  
**Preheader:** Typical campus path is weeks, not a dispatch rip-and-replace.

```
{{first_name}},

Campus pilots here are usually one semester, a handful of zones, and SMS registration started early (A2P 10DLC). Go-live is measured in weeks after MSA — not a CAD replacement program.

If this semester is already locked, say so. If Public Safety wants to see the QR path before the next board cycle:
{{cta}}
```

### B4 · Day 19 — Objection: “We have a tip line”

**Subject:** `Tip lines go quiet. Live intake does not.`

```
{{first_name}},

Anonymous tip forms collect a paragraph and go dark. Students stop using them when nothing visible happens.

NexCort iQ keeps the report in a live incident with zone context so campus security can acknowledge and work it. Still not 911 dispatch.

If your tip line already does that with location and two-way text, I will stand down. Otherwise:
{{cta}}
```

### B5 · Day 26 — Academic calendar

**Subject:** `Orientation week is the easy install at {{org_name}}`

```
{{first_name}},

The cleanest campus rollout is orientation: QR on existing safety materials, not a competing awareness campaign in October.

Product page for internal forwarding:
https://www.rapidcortex.us/product/campus

Walkthrough:
{{cta}}
```

### B6 · Day 33 — Breakup

**Subject:** `Closing the loop with {{org_name}} Public Safety`

```
{{first_name}},

Stopping here. If Clery findings, a new chief, or a board modernization item puts reporting back on the list, we can reopen.

Unsubscribe: https://www.rapidcortex.us/unsubscribe
```

---

## 7. Track C — Venue

**Promise:** Guest QR/SMS into venue security ops. Section context. Camera views **when those cameras are registered** in NexCort iQ — we do not replace Genetec/Milestone. Guest Services pages must keep the “not a 911 dispatch system” posture.

**Asset links:** `/product/venue` · `/venue-safety-software` · `/stadium-security-software`

### C1 · Day 0 — Problem (Rapid IQ step 1)

**Subject:** `{{org_name}}: fan reports should not die on the radio`  
**Alt subject:** `Section-level guest reports for {{org_name}}`  
**Preheader:** QR on the seatback. Structured incident on the console.

```
{{first_name}},

On event day at {{org_name}}, guest problems still compete with radio traffic. A medical in 112, a fight on the concourse, and a lost child do not wait for a free channel.

NexCort iQ Venue gives guests QR / NFC / SMS reporting into a security console with section and gate context. It is not a 911 dispatch system and it does not replace your VMS or radio.

{{signal}}

Twenty minutes, including how a section report can pull registered cameras when you have them on the map:
{{cta}}
```

### C2 · Day 5 — Ops, not a new camera vendor (Rapid IQ step 2)

**Subject:** `Re: {{org_name}} — your cameras stay yours`  
**Preheader:** RTSP / ONVIF into the console. No rip-and-replace of Genetec or Milestone.

```
{{first_name}},

We do not ask you to rip out the camera platform. NexCort iQ registers venue cameras you already have (RTSP / ONVIF) so a section incident can open the relevant views in the same console as the guest report.

Legal and risk usually want consent and retention in writing before a public QR program. We treat that as a joint plan, not a checkbox in a slide.

Walkthrough:
{{cta}}
```

### C3 · Day 12 — Season / event-day (Rapid IQ step 3)

**Subject:** `{{org_name}} — one section, one event, then decide`  
**Preheader:** Pilot a handful of sections. Pre-event test is mandatory.

```
{{first_name}},

Venue pilots here are a few sections plus concourses, SMS registration, and a required test the day before the first live event. That is how we avoid learning the workflow at doors-open.

If this season’s stack is frozen, I will wait. If Security wants a console walk before the next home stand:
{{cta}}
```

### C4 · Day 19 — Objection: “Guests will abuse it”

**Subject:** `Severity sorting beats a silenced QR code`

```
{{first_name}},

Every venue asks about noise. The console is a queue with severity and location, not an unfiltered public forum on the radio net. Guest Services roles stay guest services — they are not 911 dispatch.

If abuse, not intake, is the real constraint, we should talk about role design rather than skip reporting altogether:
{{cta}}
```

### C5 · Day 26 — Season planning

**Subject:** `{{org_name}} ops packet (one URL)`

```
{{first_name}},

For internal forwarding:
https://www.rapidcortex.us/product/venue

Stadium / SOC framing:
https://www.rapidcortex.us/stadium-security-software

Walkthrough:
{{cta}}
```

### C6 · Day 33 — Breakup

**Subject:** `Closing the loop with {{org_name}} Security`

```
{{first_name}},

I will leave this here. If a new director, insurance review, or league safety item puts guest reporting back on the table, we can reopen.

Unsubscribe: https://www.rapidcortex.us/unsubscribe
```

---

## 8. Trigger overlays (do not stack on an active 6-touch)

Use **instead of** email 1 when Rapid IQ has a hard signal. Then continue with emails 2–6 of that track.

| Trigger | Who | First-line swap |
|---------|-----|-----------------|
| NG911 / E911 board or RFP | 911 | “I saw {{org_name}} moving on {{signal}}. NexCort iQ is the assistive layer beside CAD, not a competing CPE bid.” |
| Grant (BRIC, NG911) | 911 | “If {{org_name}} is lining up surcharge / grant spend, a standalone pilot is the piece that does not wait on a CAD vendor program.” |
| Clery finding / new chief | Campus | “New chiefs usually want reporting they can demo in a week, not another ENS RFP.” |
| Season opener / insurance audit | Venue | “Before {{signal}}, a section-level QR path is the piece you can test without touching radio.” |
| 90-day silence | Any | Use Rapid IQ re-engagement job. Do not restart a full 6-touch. |

Conference pre-outreach (~30 days out) stays on the existing Rapid IQ `conference_pre` job. Invite a meeting; do not paste the whole sequence.

---

## 9. Weekly newsletter (*Inside the Cortex*)

Opted-in contacts only. Rapid IQ composes Monday drafts; approve before send.

- Mix 911 / campus / venue signals. Never imply one product fits all three floors.
- No pricing, no certification claims, no competitor attacks.
- CTA: reply or `/contact-sales?utm_campaign=inside_the_cortex`.

---

## 10. QA checklist before approve-and-send

1. Vertical track matches the org (PSAP vs campus vs venue).  
2. No Ring, no CAD-replacement, no certification language.  
3. `{{signal}}` is true or deleted.  
4. CTA UTM `utm_content` matches the email number.  
5. Unsubscribe link present.  
6. Recipient not in 30-day window / unsubscribed.  
7. If campus: “not a 911 emergency dispatch system” remains.  
8. If venue Guest Services will see the product later: same disclaimer stays in-product.

---

## 11. Related

- [IDEAL_CUSTOMER_PROFILE.md](./IDEAL_CUSTOMER_PROFILE.md) — who to mail  
- [PROMISE_CONTROL.md](./PROMISE_CONTROL.md) — what not to claim  
- [GTM_EXECUTION_PLAN.md](./GTM_EXECUTION_PLAN.md) — 90-day motion  
- Rapid IQ 3-touch copy lives in `apps/api/src/lib/rapid-iq/vertical-email-campaign.ts` (emails 1–3 of each track).
