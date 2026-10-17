# Exhibit B — Pre-Arrival iQ (paste-ready for counsel)

**Status:** Internal paste text only. Do **not** regenerate `COMPLETE_MSA_MASTER_DOCUMENT*.docx` without counsel (LEG-007).  
**Catalog source:** `packages/shared/src/billing/addon-catalog.ts`

## Suggested Exhibit B bullets

- **Pre-Arrival iQ Pro** (`caller_media.pre_arrival_iq`) — monthly add-on (Professional plan and above). Includes Response iQ caller guidance while units respond, protocol reconciliation when CAD nature codes change, and ETA notifications via SMS. Does not replace CAD, telephony, or medical direction.
- **Caller SMS Link Generation** (`caller_media.sms_link`) — a la carte precursor for secure media-upload / session links when Pre-Arrival iQ Pro is not purchased.
- **Text-Only Emergency Conversation** (`caller_media.text_conversation`) — a la carte precursor for Silent Text-style chat when purchased without the Pre-Arrival iQ Pro suite.
- **Caller photo / video volume tiers** (`caller_media.photo.*`, `caller_media.video.*`) — stack on Pre-Arrival iQ Pro when agency media volume exceeds base suite allowances.
- Pre-Arrival iQ consumes CAD / EventBridge incident and unit events for reconciliation and ETA; it does **not** enable automated CAD write-back.

## Finance checklist

- [ ] Line item amounts from approved price book
- [ ] Entitlements map to catalog keys above (do not delete a la carte keys)
- [ ] Align Order Form / CPQ SKU names with sales names in the catalog
