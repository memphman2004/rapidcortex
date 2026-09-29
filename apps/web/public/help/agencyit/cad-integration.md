# CAD Integration Setup (IT)

1. Open **CAD Integration** with Agency Admin present for go/no-go decisions.
2. Select the adapter for your CAD (PremierOne and others as contracted).
3. Load credentials from Secrets Manager / vaulted fields only.
4. Run **Integration test** against a non-production endpoint when available.
5. Confirm read/copy-assist before any write-back discussion.
6. Leave write-back fail-closed until UAT sign-off.

If tests fail, capture request IDs / correlation headers — do not retry blindly against production CAD.
