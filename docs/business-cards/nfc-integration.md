# NFC integration

Path **B**.

The existing tool is the QR/NFC safety-point programmer (`QrNfcHttpFunction`, table `rapid-cortex-qr-nfc-codes-{stage}`, native write log on `QRNFCRecord`). It writes a location URL from the iOS and Android apps. It does not store a business-card profile id.

What changed:

- NFC Card Management links to the existing QR/NFC admin screen (`/{base}/admin/qr-codes`).
- The operator copies the permanent tag URL `https://www.nexcortiq.us/c/{cardId}` into that tool and programs the physical tag there.
- “Mark programmed” calls `PATCH /api/admin/nfc-cards/{cardId}/status` with `programmed`. Verification uses the same call with `verified`.
- Assignment and revocation are stored only on the new business-card table.

What did not change:

- `qrNfcHttp.ts`, `QRNFCRecord`, the QR/NFC table, and the `/api/qr-nfc` routes.

Lifecycle stored on `NFCCard`: unassigned → assigned → programmed → verified, or revoked. Revoked ids are not reused. `GET /api/public/c/{cardId}` answers `302` with `Cache-Control: no-cache`.
