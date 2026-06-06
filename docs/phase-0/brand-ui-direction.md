# Brand and UI direction

## Brand

- **Name:** Rapid Cortex  
- **Positioning:** Real-time AI intelligence for **emergency response**—fast, calm, trustworthy.
- **Voice (external):** Confident, precise, respectful of public safety professionals; never hype “autonomous AI.”

## Visual direction

- **Dark-mode first** — reduces glare on 24/7 operations floors; high contrast for critical badges (urgency, escalation).
- **Accent:** Cool **cyan / teal** for primary actions and “live” state; **amber** for caution; **red** only for true escalation / critical urgency.
- **Density:** **Desktop-first** (16:9 and ultrawide); readable at arm’s length; avoid playful or consumer-game aesthetics.

## UX principles

- **Mission-critical calm** — no distracting motion; subtle transitions only where they aid comprehension.
- **Scannable hierarchy** — incident queue cards, transcript bubbles, AI panel sections clearly separated.
- **Human-in-the-loop visible** — assistive labels on AI blocks; protocol coach clearly labeled as **agency-approved pack** content.
- **Trust cues** — provider id, timestamp, confidence as **0–1** mapped to % in UI; “degraded / mock” states visible in demo.

## Accessibility

- Keyboard navigable primary flows; WCAG contrast targets for text and badges on dark surfaces.

## Assets

- Logo and favicon live under **`apps/web/public/`** (canonical web mark: `rapid-cortex-logo-2.png`; see `SITE_LOGO_*` in `apps/web/lib/site.ts`).
