# Testing Integrations

Use the integration test console before go-live and after CAD or network changes.

1. Open **Integration test**.
2. Select CAD / webhook / API target.
3. Run the canned connectivity check.
4. Save the pass/fail output for change control.
5. If fail, stop — do not enable write-back or novel traffic.

Tests prove connectivity. They do not authorize production write-back by themselves.
