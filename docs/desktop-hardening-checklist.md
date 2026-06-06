# Desktop Hardening Checklist — macOS vs Windows

Rapid Cortex may ship Electron / native wrappers under `apps/desktop-macos/` and related workspaces. Treat this checklist as readiness guidance; **presence in-repo does not automatically mean every item is satisfied**.

## Pilot stance

- **Web-only controlled pilot:** Desktop clients are **not required** when dispatchers authenticate through the responsive web deployment.
- **Broad desktop rollout:** **Blocked** until signing, distributor trust, credential storage posture, revocation, and auto-update safeguards are evidenced.

---

## macOS checklist

| Item | Status / notes |
|---|---|
| Developer ID signing | Planned / partial / verified — cite build pipeline step. |
| Hardened runtime | Enabled in signed builds only (flag review with `-o runtime`). |
| Notarization | Apple notarytool submission & stapling receipts for release builds. |
| Keychain-backed token storage | Avoid raw refresh tokens written to plist / plain files. Confirm API surface in desktop session module. |
| Secure auto-update | HTTPS endpoint, signature verification channel, downgrade protection policy. |
| No raw bearer tokens persisted in plaintext app support folders | Periodic secret scan (`npm run security:scan-secrets`). |
| Dispatcher session idle timeout alignment | Respect agency policy (coordinate with SSO + web TTL). |
| Device revocation playbook | Procedures for leaked credentials / lost hardware; remote wipe stance documented. |

## Windows checklist

| Item | Status / notes |
|---|---|
| Code signing certificate (Authenticode EV/SPC) | Document SHA-256 chain + timestamps. |
| MSIX packaging or Authenticode-signed EXE installers | Decide distribution channel (`Store` vs `Squirrel`/custom). |
| DPAPI / Credential Locker / Windows Credential Manager for secrets | Prefer OS vault to flat JSON blobs. |
| Secure auto-update | TLS-only deltas, rollback channel, integrity verification hash. |
| No raw bearer tokens persisted in plaintext `%AppData%` trees | Periodic secret scans + QA checklist. |
| Session timeout parity with web SSO | SSO plugin vs embedded webview behavior must align with agency TTL. |
| Device revocation playbook | Conditional access / Intune parity if applicable. |

## Cross-cutting rollout gates

Before enabling mass desktop provisioning:

1. Signing + notarization / Authenticode evidenced for production channels.
2. Session storage architecture reviewed against CJIS-aligned agency policy.
3. Auto-update infra monitored (distribution availability, outage response).
4. Customer security owner sign-off with explicit linkage to CJIS-aligned controls referenced in contractual schedule.
