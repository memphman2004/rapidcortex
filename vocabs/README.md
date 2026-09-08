# Call Assist Transcribe vocabularies

CSV files in this folder are **examples** for custom Amazon Transcribe vocabularies. Production
agency lists (street names, subdivisions, local jargon) should live in a private S3 prefix, not
in git, if they contain sensitive or agency-specific operational data.

## Format

```csv
Phrase,SoundsLike,IPA,DisplayAs
Main Street,,,Main Street
```

Columns match the AWS Transcribe custom vocabulary table. `Phrase` is required.

## Examples (committed)

| File | Use |
|------|-----|
| `baseline-en-US.csv` | Generic public-safety terms safe for any agency |
| `kcpd-en-US.csv` | First-tenant overlay only. Never apply to agency #2+. |

## Seed

```bash
npx tsx scripts/seed-agency-transcribe-vocab.ts <agencyId> ./vocabs/baseline-en-US.csv
```

Onboarding (`POST /api/call-assist/onboarding`) can also pass `customVocabularyPhrases`.
