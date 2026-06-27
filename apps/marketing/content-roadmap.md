# Content roadmap — SEO release calendar

All **67** topics from `Rapid_Cortex_SEO_Blog_Release_Calendar_Mixed_Release_Order.pdf`
are drafted in `apps/marketing/lib/blog/seo-post-content.ts` and wired through
`seo-calendar-posts.ts`. Posts go live on their calendar `publishedAt` date
(see `getPublishedPosts()` in `lib/blog/utils.ts`).

Regenerate content after calendar edits:

```bash
python3 scripts/generate-seo-blog-content.py
```

## Staged legacy brief (superseded by SEO calendar)

These were queued before the SEO calendar PDF and are not yet drafted separately:

| # | Title | Suggested slug | Primary keyword angle |
|---|---|---|---|
| 1 | How AI Is Transforming 911 Centers | `ai-transforming-911-centers` | AI 911 dispatch, dispatch AI software |
| 2 | What Is NG911 and Why Does It Matter? | `what-is-ng911` | NG911, next generation 911 |
| 3 | The Hidden Cost of Delayed Incident Reporting | `cost-of-delayed-incident-reporting` | incident reporting delay, response time |
| 4 | Campus Safety Trends Universities Should Watch | `campus-safety-trends` | campus safety trends, university safety |
| 5 | How Stadiums Can Improve Fan Safety Without Adding Staff | `stadium-fan-safety-without-adding-staff` | stadium security staffing, fan safety |
| 6 | Building a Safer Community Through Real-Time Communication | `safer-community-real-time-communication` | community safety technology |
| 7 | Public Safety Technology Trends for 2027 | `public-safety-technology-trends-2027` | public safety technology trends |
| 8 | Why Every Airport Needs a Modern Incident Reporting Platform | `airport-incident-reporting-platform` | airport security software |
| 9 | Understanding Clery Act Reporting Requirements | `clery-act-reporting-requirements` | Clery Act requirements |
| 10 | The Evolution of Emergency Communications: From Voice Calls to Multimedia Intelligence | `evolution-of-emergency-communications` | emergency communications history |

## Notes for whoever writes these next

- **#9 (Clery Act requirements)** needs the same legal care as the Campus
  launch post: describe what the Act requires and how documentation helps,
  never "Rapid Cortex makes you compliant." Compliance determinations stay
  with the institution.
- **#1 (AI in 911 centers)** is a natural pairing with the existing
  `rapid-cortex-core` post — link both directions once both exist.
- **#7 (2027 trends)** will age out — review and refresh annually or set a
  recurring reminder, since "current year" trend pieces lose relevance fast.
