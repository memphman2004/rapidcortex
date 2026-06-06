# Copy to scripts/env-mac-signing.sh (gitignored) and fill APPLE_ID + APPLE_APP_PASSWORD.
# Usage: source scripts/env-mac-signing.sh && ./scripts/macos-distribution-build.sh
#
# App-specific password: https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
#
export APPLE_DEVELOPER_ID="Developer ID Application: Apps on Demand llc (6D7D94PU3M)"
export APPLE_TEAM_ID="6D7D94PU3M"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
