# Rapid Cortex Connect — Ring camera & doorbell access

**Audience:** dispatchers, supervisors, agency administrators, and IT leads.  
**Product path:** `/<slug>/media` (dispatcher Media workspace) · **Admin:** `/<slug>/admin/integrations`  
**Also in:** [Complete Operations Manual](/docs/rapidcortex-complete-manual.html) (Chapter 10B) · [COMMON_TASKS.md](../operations-runbooks/COMMON_TASKS.md)

> **Ring Appstore certification:** Device-owner enrollment is **Ring Appstore → Rapid Cortex Connect → Get App**, then account link at `/connect/ring/link`. Do **not** use Media → **Connect Ring Account** for Appstore cert (one-way Appstore flow). See [ring-certification-reviewer-guide.md](../ring-certification-reviewer-guide.md) and [ring-certification/SUBMIT_RUNBOOK.md](../ring-certification/SUBMIT_RUNBOOK.md).

## What this feature does

**Rapid Cortex Connect (Ring)** lets authorized dispatch staff request **temporary, owner-approved** live video from **Ring doorbells and cameras** near an **active incident**. The camera owner (resident or staff member who linked their Ring account) must **explicitly approve** each request. Rapid Cortex does **not** access Ring devices silently or without consent.

Doorbells (Ring “doorbots”) and stick-up cameras follow the **same workflow**; the product labels the device type as **DOORBELL** or **CAMERA** in the Media workspace.

This is **decision support** for situational awareness — not a replacement for CAD, warrants, or agency video-retention policy.

## Who can use it

| Role | Typical access |
|------|----------------|
| **Dispatcher** (`dispatcher`) | Link own Ring account (optional), view available cameras, send emergency video requests, view approved streams |
| **Supervisor** (`supervisor`, `commsupervisor`) | Same as dispatcher |
| **Agency admin** (`agencyadmin`) | Integration health, user provisioning; does not bypass owner consent |
| **Venue security / supervisor roles** | Same request flow when Ring Connect is enabled for the venue tenant |

Users must be **active** in Cognito and pass the operational password gate (forced password reset must be completed first).

## Prerequisites (before any camera request)

### 1. Feature enabled for your agency

Ring Connect requires Rapid Cortex to enable partnership flags for your environment. If the **Ring** tab does not appear under **Media**, contact your Rapid Cortex pilot lead — do not assume the feature is misconfigured locally.

### 2. Ring account linked (for device owners)

Someone with a Ring subscription must link their account:

1. Sign in at `https://app.rapidcortex.us/<slug>/login` (or your agency app URL).
2. Open **`/<slug>/media`**.
3. In the **Live Camera** panel, select the **Ring** tab.
4. Click **Connect Ring Account** and complete Ring OAuth.
5. After authorization, you land on the public confirmation page (`/connect/ring/link?status=success` on the marketing site). Use **Sign in to Rapid Cortex** to return to the app.

Agency **dispatchers** link accounts when they own devices they want to share. **Residents** link when your program enrolls community cameras — they use the same Connect flow.

### 3. Devices synced and opted in

After linking:

1. Open **Linked Ring Devices** from the Ring panel.
2. Click **Refresh devices** to pull the latest list from Ring.
3. For each doorbell or camera you want available to responders:
   - Confirm the device appears in the list.
   - Turn **Enable for Connect** **on**.
   - Confirm the device has a **valid location** (latitude/longitude). Devices **without GPS** do not appear in “near incident” search.

Only devices with **Enable for Connect = on** and coordinates are eligible for emergency requests.

### 4. Active incident with location

Emergency camera search requires an **active incident** with caller/incident coordinates:

- Core PSAP incidents: status **active** or **in_progress**
- Venue incidents: status **open**, **assigned**, or **responding**

Select the incident in the **Incident Context** dropdown on the Media page before opening available cameras.

---

## Per doorbell / camera — emergency access process

Each device is handled **individually**. Approving one doorbell does not approve others.

### Step 1 — Discover nearby devices

1. Go to **`/<slug>/media`**.
2. Select **Ring** under **Live Camera**.
3. Choose the correct incident in **Incident Context**.
4. Click **View Available Ring Cameras** (also available from dispatch command workspace when enabled).
5. The list shows Ring devices within the search radius (default **500 m**, maximum **2000 m**), sorted by distance.
6. Each card shows device name, type (**DOORBELL** / **CAMERA**), approximate distance, and status.

### Step 2 — Send emergency video request

For each device you need:

1. Choose a duration: **10**, **30**, **60**, or **120 minutes**.
2. Click **Send Emergency Video Request**.
3. Confirm the prompt (owner must approve before any video is shared).

**System limits (per incident):**

| Rule | Limit |
|------|--------|
| Active request per device | **One** at a time per incident + device |
| Requests per hour | **Five** per incident |
| Consent | **Required** for every request — no silent access |

Status on the card updates to **Sent** when the owner notification delivers.

### Step 3 — Owner notification and consent

The Ring account owner receives **SMS** (preferred) or **email** with:

- Agency name and incident context
- Requested sharing duration
- **Allow Temporary Access** and **Decline** links

The owner does **not** need to sign in to Rapid Cortex to respond. Links are one-time and expire if not used in time.

- **Decline** → dispatcher sees **Owner Declined**; no video is shared.
- **Approve** → dispatcher sees **Approved**; a time-limited live stream session is prepared.

### Step 4 — View live stream (dispatcher)

When status is **Approved**:

1. Refresh or reopen **View Available Ring Cameras**.
2. Click **View Live Stream** on the device card.
3. Video plays in the Media workspace for the **approved duration only**.

If the card shows “Approved — preparing live stream…”, wait briefly and refresh — stream provisioning may still be in progress.

### Step 5 — End of access

Access ends when:

- The **approved duration expires**
- The **owner revokes** sharing (link in the original message)
- A **dispatcher revokes** the session (authorized roles)
- The session is marked **stopped** or **expired** in the system

After **Expired** or **Revoked**, dispatch can send a **new request** for the same device if the incident is still active and limits allow.

---

## Status reference

| Status | Meaning for dispatch |
|--------|----------------------|
| **Available** | Device is in range and eligible; no active request |
| **Sent** | Owner notified; waiting for response |
| **Opened** | Owner opened the consent link (if tracked) |
| **Approved** | Owner allowed sharing; stream may be available |
| **Declined** | Owner declined; do not re-request without cause |
| **Expired** | Request or session timed out |
| **Revoked** | Owner or dispatch ended sharing early |

---

## Privacy, policy, and communications

- **Voluntary sharing** — Owners control approve/decline and can stop sharing at any time.
- **Tenant isolation** — Devices and requests are scoped to your **agency** (`agencyId`); dispatch cannot cross tenants.
- **Audit** — Request create/send/approve/decline/revoke events are recorded for agency audit review where deployed.
- **Agency SOP** — Document when dispatch may request community cameras, how to communicate with owners, and retention expectations for viewed live video.

Train owners that approval shares **live** video for a **fixed window** — not permanent access.

---

## Troubleshooting (agency staff)

| Symptom | Check |
|---------|--------|
| No **Ring** tab under Media | Feature flag / partnership not enabled for your build — contact RC support |
| **Connect Ring Account** fails | Complete OAuth popup; verify Ring app credentials; try reconnect |
| No devices in linked panel | Refresh devices; confirm Ring account has doorbells/cameras |
| Device missing from “near incident” list | **Enable for Connect** off, or **no GPS** on device, or outside radius |
| Request stays **Sent** | Owner may not have received SMS/email — verify phone/email on Cognito user |
| **Approved** but no stream | Wait and refresh; escalate with incident ID and device ID |
| **Request limit reached** | Max 5 requests/hour per incident — wait or use another channel |
| Owner link shows wrong page | Use links **without** a trailing slash before `?` (e.g. `…/connect/ring/link?status=success`) |

For escalations, collect **UTC time**, **incident ID**, **device ID**, **request ID** (if known), and screenshots of the Media panel. See [TROUBLESHOOTING_GUIDE.md](../operations-runbooks/TROUBLESHOOTING_GUIDE.md) and [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md).

---

## Related documents

- [USER_GUIDE.md](../admin-user-management/USER_GUIDE.md) — general operator guide  
- [COMMON_TASKS.md](../operations-runbooks/COMMON_TASKS.md) — step-by-step dispatcher tasks  
- [TRAINING_DISPATCHER.md](../operations-runbooks/TRAINING_DISPATCHER.md) — floor training  
- [ADMIN_SETUP_GUIDE.md](../admin-user-management/ADMIN_SETUP_GUIDE.md) — admin integration surfaces  
- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) — product boundaries  
