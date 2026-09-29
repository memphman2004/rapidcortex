# CAD Integration Setup

NexCort iQ connects through a CAD abstraction layer. Read / copy-assist comes first. Incident create/update write-back stays **fail-closed** until UAT and written authorization.

## Setup path

1. Open **CAD Integration** with Agency IT.
2. Select your CAD adapter (e.g. Motorola PremierOne when configured).
3. Configure credentials via Secrets Manager-backed settings — never paste production secrets into chat or tickets.
4. Run connectivity tests in a non-production window first.
5. Keep `CAD_WRITEBACK_ENABLED` / agency write-back off until go/no-go criteria are met.

A future CAD change should be an adapter project, not a platform rewrite.
