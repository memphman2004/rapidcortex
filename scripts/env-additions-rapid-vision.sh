#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rapid Vision — Environment Variable Additions
#
# Add these to env-web-ssr-prod.sh, env-web-pilot-test.sh, and deploy scripts.
#
# NAMING NOTE:
#   Product name is Rapid Vision™ (formerly Rapid Cortex Connect).
#   HTTP routes attach to stack 2 (API_UPSTREAM_BASE_2), not a separate API Gateway.
# ─────────────────────────────────────────────────────────────────────────────

# ── Rapid Vision Feature Flag ─────────────────────────────────────────────────
export NEXT_PUBLIC_ENABLE_RAPID_VISION=1

# ── Vision Sub-Feature Flags ──────────────────────────────────────────────────
# Enable Google Nest as a Rapid Vision source (SDM WebRTC)
export NEXT_PUBLIC_ENABLE_RAPID_VISION_NEST=1
# Enable caller video as a Rapid Vision source
export NEXT_PUBLIC_ENABLE_RAPID_VISION_CALLER_VIDEO=1
# Enable Rapid Vision demo mode (clearly labeled, never real)
export NEXT_PUBLIC_ENABLE_RAPID_VISION_DEMO=1
# Enable AI Writer (Claude watches video and writes observations)
export NEXT_PUBLIC_ENABLE_RAPID_VISION_AI_WRITER=1
# Live camera audio transcript beside WebRTC video
export NEXT_PUBLIC_ENABLE_RAPID_VISION_TRANSCRIPT=1
# Enable Rekognition preliminary detection tier
export NEXT_PUBLIC_ENABLE_RAPID_VISION_REKOGNITION=1
# AI Scene Intelligence — proactive camera alerts (dispatcher Camera AI panel)
export NEXT_PUBLIC_ENABLE_VISION_AI=1
export NEXT_PUBLIC_ENABLE_VISION_AI_CLAUDE=1
export NEXT_PUBLIC_ENABLE_VISION_AI_THUMBNAILS=1
export NEXT_PUBLIC_ENABLE_VISION_AI_WS=1
export NEXT_PUBLIC_ENABLE_VISION_AI_ADMIN=1

# ── Marketing Connect enroll (Nest / Wyze) ───────────────────────────────────
export NEXT_PUBLIC_CONNECT_PUBLIC_BASE="${NEXT_PUBLIC_CONNECT_PUBLIC_BASE:-https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com}"

# ── Lambda Environment (set via SAM template, documented here for reference) ──
# VISION_CAMERAS_TABLE=rc-rapid-vision-cameras-{env}
# VISION_SESSIONS_TABLE=rc-rapid-vision-sessions-{env}
# VISION_OBSERVATIONS_TABLE=rc-rapid-vision-observations-{env}
# VISION_OWNER_CONSENT_TABLE=rc-rapid-vision-owner-consent-{env}
# VISION_ARTIFACTS_BUCKET=rc-rapid-vision-artifacts-{env}-{accountId}
# VISION_REKOGNITION_OUTPUT_STREAM=rc-rapid-vision-rekognition-{env}
# REKOGNITION_ROLE_ARN=arn:aws:iam::{account}:role/rc-rekognition-stream-processor-{env}
# ANTHROPIC_API_KEY=resolved from Secrets Manager: rc/anthropic-api-key
# VISION_AI_WRITER_INTERVAL_SECONDS=30
# VISION_TRANSCRIPT_MOCK=true   # set false for live ffmpeg + Amazon Transcribe Streaming
# VISION_TRANSCRIPTS_TABLE=rapid-cortex-vision-transcripts-{env}
# VISION_EVENTS_TABLE=rapid-cortex-vision-events-{env}
# VISION_SCENE_CLASSIFY_QUEUE_URL=https://sqs.{region}.amazonaws.com/{account}/rapid-cortex-vision-scene-classify-{env}
# VISION_SCENE_DESCRIBE_QUEUE_URL=https://sqs.{region}.amazonaws.com/{account}/rapid-cortex-vision-scene-describe-{env}
# VISION_SCENE_SUPERVISOR_TOPIC_ARN=arn:aws:sns:{region}:{account}:rapid-cortex-vision-scene-supervisor-{env}
# VISION_SCENE_INTEL_AGENCY_IDS=agency-id-1,agency-id-2   # live/mock sampler; empty = HTTP demo seed only
# ENABLE_VISION_AI=true
# VISION_AI_WRITER_ELEVATED_INTERVAL_SECONDS=10
# VISION_MAX_ACTIVE_ANALYSES_PER_AGENCY=10

# ── Required Secrets Manager Entries ─────────────────────────────────────────
# aws secretsmanager create-secret \
#   --name rc/anthropic-api-key \
#   --secret-string "{\"apiKey\":\"sk-ant-...\"}" \
#   --region us-east-1
