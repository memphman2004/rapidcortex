#!/usr/bin/env bash
# Physical QR deployment validation checklist.
AGENCY="${1:-YOUR_AGENCY}"
DATE="${2:-$(date +%Y-%m-%d)}"

cat <<EOF
QR Field Test Checklist — ${AGENCY} — ${DATE}
============================================
[ ] 1. Scan QR with iPhone (native camera) — correct location loads
[ ] 2. Scan QR with Android (native camera) — correct location loads
[ ] 3. Submit text-only report — appears in dispatcher dashboard with location
[ ] 4. Submit report with photo — photo appears in incident, location attached
[ ] 5. Submit report with video — video appears in incident, location attached
[ ] 6. Enable location sharing — GPS coords match QR location zone
[ ] 7. Anonymous report — no name in dispatcher view
[ ] 8. Named report — name/contact visible in dispatcher view
[ ] 9. Scan in low light — resolves within 3 seconds
[ ] 10. Scan small print (1" QR) — resolves within 5 seconds
[ ] 11. Dispatcher sees: location name, zone code, QR badge on incident
[ ] 12. Scan count increments in admin dashboard after each test scan
[ ] 13. Deactivate location — scan returns graceful "not active" message
[ ] 14. Reactivate location — scan works again
[ ] 15. SMS fallback — text keyword to agency number, same intake flow
EOF
