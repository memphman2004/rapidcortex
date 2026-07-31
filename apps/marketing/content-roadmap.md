# Content roadmap — blog posts

## Live in `lib/blog/posts.ts` (19 posts)

Weekly Saturday cadence through **2026-07-25**. July posts are pulled from the SEO calendar (`seo-calendar-posts.ts`) by slug.

| # | Title | Slug | Published |
|---|---|---|---|
| — | Why Rapid Cortex Is Needed | `why-rapid-cortex-is-needed` | 2026-03-21 |
| — | Rapid Cortex Offerings | `rapid-cortex-offerings` | 2026-03-28 |
| — | Rapid Cortex Core | `rapid-cortex-core` | 2026-04-04 |
| — | Rapid Cortex Venue | `rapid-cortex-venue` | 2026-04-11 |
| — | Rapid Cortex Campus | `rapid-cortex-campus` | 2026-04-18 |
| 1 | How AI Is Transforming 911 Centers | `ai-transforming-911-centers` | 2026-04-25 |
| 2 | What Is NG911 and Why Does It Matter? | `what-is-ng911` | 2026-05-02 |
| 3 | The Hidden Cost of Delayed Incident Reporting | `cost-of-delayed-incident-reporting` | 2026-05-09 |
| 4 | Campus Safety Trends Universities Should Watch | `campus-safety-trends` | 2026-05-16 |
| 5 | How Stadiums Can Improve Fan Safety Without Adding Staff | `stadium-fan-safety-without-adding-staff` | 2026-05-23 |
| 6 | Building a Safer Community Through Real-Time Communication | `safer-community-real-time-communication` | 2026-05-30 |
| 7 | Public Safety Technology Trends for 2027 | `public-safety-technology-trends-2027` | 2026-06-06 |
| 8 | Why Every Airport Needs a Modern Incident Reporting Platform | `airport-incident-reporting-platform` | 2026-06-13 |
| 9 | Understanding Clery Act Reporting Requirements | `clery-act-reporting-requirements` | 2026-06-20 |
| 10 | The Evolution of Emergency Communications | `evolution-of-emergency-communications` | 2026-06-27 |
| 11 | Why Stadium Safety Reporting Should Be as Easy as Sending a Text | `stadium-safety-text-reporting` | 2026-07-04 |
| 12 | Why Airports Need Faster Ways for Travelers to Report Safety Concerns | `airport-safety-reporting-platform` | 2026-07-11 |
| 13 | What Happens When a 911 Caller Cannot Safely Speak? | `silent-911-text-chat` | 2026-07-18 |
| 14 | What Happens When a Fan Needs Security but Does Not Know Who to Call? | `fan-to-security-communication` | 2026-07-25 |

Posts appear when `publishedAt` ≤ today (`getPublishedPosts()` in `lib/blog/utils.ts`).

## Before publishing the Clery / campus-trends batch

- **#9 (Clery Act)** and **#4 (campus trends)** cite time-sensitive legal facts (Stop Campus Hazing Act deadlines, recent audit findings). Route through compliance owner review before go-live — same standard as any legal-adjacent marketing copy.
- **#7 (2027 trends)** will age out; schedule an annual refresh.

## Adding new posts

Append a typed `BlogPost` object to the `posts` array in `lib/blog/posts.ts`, rebuild, and deploy via `bash scripts/deploy-marketing.sh prod`.

Internal links in body copy use `[label](/path)` — product pages live at `/product/core`, `/product/venue`, `/product/campus`.
