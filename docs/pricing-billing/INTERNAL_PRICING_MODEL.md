# Internal pricing model (confidential)

**This file is for internal sales and finance only. Do not link from the public website or marketing PDFs without review.**

## Principles

- **Public** pricing remains quote-based: “Tailored deployment,” “Custom quote,” “Scaled for agency needs,” “Contact sales.”
- **Do not** embed dollar amounts, SKU lists, or discount tiers in the marketing app or in customer-facing help.

## Suggested internal structure (template)

Use your CRM or CPQ for authoritative numbers. Placeholders for planning:

| Line | Description |
|------|-------------|
| Base platform | Seat/site bundle by tier (Essential / Professional / Command / Enterprise) |
| Add-ons | Per registry id or packaged bundles (e.g. translation, media, CAD read path) |
| Onsite / travel | T&M or fixed discovery + training days |
| CAD integration | Discovery workshop + adapter build + UAT (vendor-dependent) |
| Support | Standard / priority / mission (hours and escalation matrix) |
| Overages | Transcription minutes, storage, API volume caps |

## Sample quote packages (illustrative only)

- **Pilot Essential**: small footprint, standard onboarding, limited sites, no automated CAD write.
- **County Professional**: full floor modules, QA, language stack, read-only CAD scope optional.
- **Command regional**: command collaboration + reliability SLOs + premium onboarding; CAD assisted write-back only with explicit SOW.

Replace this section with your approved price book from Finance.

## Caller Media B.5 — Pre-Arrival iQ

Canonical catalog keys live in `packages/shared/src/billing/addon-catalog.ts`.

| Catalog key | Sales name | Notes |
|-------------|------------|--------|
| `caller_media.pre_arrival_iq` | **Pre-Arrival iQ Pro** | Umbrella B.5 SKU (Professional+). Response iQ caller guidance (agency SOP → protocol library → generic), stay-on-line banner, protocol reconciliation on CAD nature change, ETA SMS. |
| `caller_media.sms_link` | Caller SMS Link Generation (a la carte) | Precursor SKU; still purchasable so existing quotes/plans do not break. |
| `caller_media.text_conversation` | Text-Only Emergency Conversation (a la carte) | Precursor (Silent Text); still purchasable alone. |
| `caller_media.photo.*` / `caller_media.video.*` | Photo / video volume tiers | Stack **on top** of Pre-Arrival iQ Pro when media volume exceeds base suite needs. |

Finance: use catalog keys above for Exhibit B line items. Do not remove `sms_link` / `text_conversation` keys from entitlements.
