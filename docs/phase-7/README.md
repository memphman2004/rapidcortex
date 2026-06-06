# Phase 7 — Transcript streaming and real-time model

## Stage 1 (implemented / extended)

- **Simulated stream** — `useSimulatedTranscriptStream` + `TranscriptChunkPlayer` with pause/resume/reset.
- **Session phases** — `SimulatedTranscriptSessionPhase`: `idle` | `running` | `paused` | `completed` | `interrupted` (`apps/web/lib/transcript-stream-session.ts`), surfaced in the player footer.
- **Incremental analysis (UI)** — `analysisEveryNChunks` still triggers client `onAnalysis` during playback.
- **Incremental analysis (API)** — `POST .../transcript` can auto-run analysis every **N** segments when `AUTO_ANALYZE_EVERY_N_SEGMENTS>0` (see `apps/api/src/handlers/addTranscriptChunk.ts`).

## Stage 2 (adapter boundary)

- **`TranscriptSourceAdapter`** + **`AwsTranscribeStreamPlaceholder`** in `packages/integrations/src/transcript-source.ts` — placeholder for AWS Transcribe Streaming or vendor audio.

## UI / polling / WebSocket

- **Today:** React Query invalidation after transcript POST (live API) or optimistic cache (mock).
- **Later:** WebSocket or HTTP/2 push from a stream fan-out Lambda; keep the same `TranscriptSegment` append contract.

## Exit criteria

- Mock stream feels **live** (pulse, phases, chunk counter).
- Backend processes **incremental** transcript appends and optional **auto-analyze**.
- Frontend handles **streaming UI state** without blocking the main workspace.
