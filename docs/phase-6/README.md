# Phase 6 — Protocol engine

## Implemented

- **Engine** (shared) — `identifyProtocol`, `getCurrentProtocolStep`, `getSuggestedHumanPhrase`, `getEscalationRules`, `buildProtocolGuidance`, **`getProtocolSummary`** in `packages/shared/src/protocol/engine.ts`.
- **Registry** — `packages/shared/src/protocol/registry.ts` (`listProtocolPacks`, `getProtocolPackById`); re-exported from `rapid-cortex-shared` and `rapid-cortex-protocols`.
- **Packs** — `defaultPacks.ts` includes **CPR/cardiac**, **AED**, **choking**, **bleeding**, **stroke**, **unconscious**, **fire evacuation**, **domestic/silent**, plus **welfare check** and **unknown / high-stress clarification** (`ProtocolCategory` extended).
- **Zod** — `guidance-schema.ts` updated for new categories.
- **AI + protocol** — `AnalysisService` attaches `protocolGuidance` from transcript-only selection; **`humanizeApprovedPhraseStrict`** may soften wording without adding facts (currently no LLM).
- **UI** — Protocol coach shows **pack id + category** under the protocol name for clear state.

## Rules

- **Protocol selection** is driven by **transcript text + packs**, not by free-form LLM invention of steps.
- **LLM** output remains triage JSON only; instructional lines come from packs.

## Exit criteria

- CPR/AED and other packs are **protocol-backed** in shared defaults.
- UI shows **protocol identity + step + phrase** clearly.
- AI does **not** invent device-specific or medical procedure steps in prompts; packs hold coach lines.
