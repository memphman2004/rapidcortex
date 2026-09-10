#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rapid Vision — Environment Variable Additions
#
# Add these to env-web-ssr-prod.sh, env-web-pilot-test.sh, and deploy scripts.
#
# NAMING NOTE:
#   Product name is Rapid Vision™ (formerly Rapid Cortex Connect).
#   Existing NEXT_PUBLIC_ENABLE_CONNECT_RING is preserved for backward compatibility
#   with Stack 4 Ring Lambdas. New Vision features use NEXT_PUBLIC_ENABLE_RAPID_VISION.
#   HTTP routes attach to stack 2 (API_UPSTREAM_BASE_2), not a separate API Gateway.
# ─────────────────────────────────────────────────────────────────────────────

# ── Rapid Vision Feature Flag ─────────────────────────────────────────────────
export NEXT_PUBLIC_ENABLE_RAPID_VISION=1

# ── Vision Sub-Feature Flags ──────────────────────────────────────────────────
# Enable Ring as a Rapid Vision source (wraps existing Stack 4 Ring integration)
export NEXT_PUBLIC_ENABLE_RAPID_VISION_RING=1
# Enable caller video as a Rapid Vision source
export NEXT_PUBLIC_ENABLE_RAPID_VISION_CALLER_VIDEO=1
# Enable Rapid Vision demo mode (clearly labeled, never real)
export NEXT_PUBLIC_ENABLE_RAPID_VISION_DEMO=1
# Enable AI Writer (Claude watches video and writes observations)
export NEXT_PUBLIC_ENABLE_RAPID_VISION_AI_WRITER=1
# Enable Rekognition preliminary detection tier
export NEXT_PUBLIC_ENABLE_RAPID_VISION_REKOGNITION=1

# ── Kept for backward compat with Stack 4 Ring Lambdas ───────────────────────
# These control existing Ring OAuth / consent / stream flow — do NOT remove.
export NEXT_PUBLIC_ENABLE_CONNECT_RING=1
export NEXT_PUBLIC_ENABLE_CONNECT_RING_AVAILABLE_CAMERAS=1
export NEXT_PUBLIC_ENABLE_CONNECT_RING_EMERGENCY_REQUESTS=1

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
# VISION_AI_WRITER_ELEVATED_INTERVAL_SECONDS=10
# VISION_MAX_ACTIVE_ANALYSES_PER_AGENCY=10

# ── Required Secrets Manager Entries ─────────────────────────────────────────
# aws secretsmanager create-secret \
#   --name rc/anthropic-api-key \
#   --secret-string "{\"apiKey\":\"sk-ant-...\"}" \
#   --region us-east-1
