# The NexCortiQ Signal — publishing & distribution

Monthly curated intelligence at **https://nexcortiq.us/newsletter** for **911/PSAP, Campus, Transit, and Venue**.

Blog = individual articles. Signal = volume/issue editions with Across the Verticals.

## Site features

- Index: hero, next-issue banner, vertical filter tabs, jump-to-issue dropdown, issue cards, subscribe
- Edition pages: spotlight, in the news, Across the Verticals (2×2), funding, PDF link
- Data: `apps/marketing/lib/newsletter/newsletter-data.ts` (12 issues Vol. 1)
- PDFs: `apps/web/public/newsletters/` (marketing `public` symlinks here)

## Email (2nd Monday) — two admin approvals (fail-closed)

Nothing sends without an RC admin (`canManageSalesAutomation`). Sales contractors can view/queue only.

1. Active recipients on **RC Admin → Email List**
2. Composer runs Mondays 08:00 UTC; drafts only on **2nd Monday** (`isSecondMondayOfMonthUtc`). Manual: `{"job":"newsletter","force":true}`
3. **Approve copy (queue drafts)** — reviews subject/body; queues one draft sequence per Active recipient. **Does not send.**
4. **Approve & send Signal** (bulk) or **Approve send** (per recipient) — final admin step. Bulk API requires `confirmNewsletterSend: true` when `campaignId` is `newsletter`.
5. Send worker skips any newsletter sequence missing `approvedBy` / `approvedAt`, or with `autoApprove: true`.

## Subscribe

Form posts business email to marketing lead API; optional vertical preference logged via `app.rapidcortex.us/api/newsletter-subscribe`. No paywall on reading.
