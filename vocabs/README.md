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

## Generate at onboarding

Do not hand-copy street names. Build the county GIS overlay, review unusual
pronunciations, then seed Transcribe:

```bash
# Jackson County, MO (KCPD). Comma-separate FIPS for multi-county agencies.
COUNTY_FIPS=29095 AGENCY_ID=kcpd npx tsx scripts/generate-transcribe-vocab.ts
```

Sources (no Amazon Location API key required):

1. Census TIGER/Line **edges** (or `TIGER_LAYER=roads`) — `FULLNAME` on road MTFCC codes
2. OSM named highways in the county bounding box (Census TigerWeb extent)
3. `getBasePublicSafetyVocab()` plus `vocabs/baseline-en-US.csv`
4. Committed overlay `vocabs/${AGENCY_ID}-en-US.csv` when present (SoundsLike wins)

Output defaults to **`vocabs/generated/${AGENCY_ID}-en-US.csv`** (gitignored) so the
hand-curated overlay is not overwritten. Set `OUT=` and `FORCE=1` only if you
intentionally replace `vocabs/${AGENCY_ID}-en-US.csv`.

Then upload (dry-run unless `TRANSCRIBE_VOCAB_NAME` is set):

```bash
AGENCY_ID=kcpd VOCAB_FILE=./vocabs/generated/kcpd-en-US.csv npx tsx scripts/seed-agency-transcribe-vocab.ts
```

Pass `VOCAB_FILE` as the generated GIS file. Running seed against the small
committed overlay alone will replace `vocabs/generated/` and drop street names.

Optional env: `SKIP_OSM=1`, `SKIP_TIGER=1`, `TIGER_YEAR=2024`, `MAX_PHRASES=45000`,
`SKIP_CACHE=1`, `INCLUDE_OVERLAY=0`.

## Examples (committed)

| File | Use |
|------|-----|
| `baseline-en-US.csv` | Generic public-safety terms safe for any agency |
| `kcpd-en-US.csv` | First-tenant overlay only (SoundsLike / local jargon). Never apply to agency #2+. |

## Seed

```bash
npx tsx scripts/seed-agency-transcribe-vocab.ts
```

Onboarding (`POST /api/call-assist/onboarding`) can also pass `customVocabularyPhrases`.
