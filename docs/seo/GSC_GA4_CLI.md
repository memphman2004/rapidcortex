# Google Search Console + GA4 CLI

**Tool:** [`gsc-ga4-cli`](https://github.com/nogataka/gsc-ga4-cli) (`gsc` + `ga4` commands)  
**Install location (this repo):** `tools/gsc-ga4-cli/`  
**Wrappers:** `scripts/gsc`, `scripts/ga4`, and (local machine) `~/.local/bin/gsc` / `~/.local/bin/ga4`

Google does **not** ship an official Search Console / Analytics shell CLI. This package is the agent-friendly CLI we use against the Search Console API and GA4 Data/Admin APIs. `gcloud` remains for GCP project/IAM only — it does not query GSC or GA4 reports.

Measurement ID for marketing (live): **`G-NGT17QK1LW`** via GTM **`GTM-M33PD9HM`** (`apps/marketing/.env.production`). Older docs mentioning `G-S83NHMBHRD` are historical — do not create a second stream. See [GSC_GA4_AUTOMATION.md](./GSC_GA4_AUTOMATION.md) and [GOOGLE_ANALYTICS_INDEX.md](./GOOGLE_ANALYTICS_INDEX.md).  
Canonical site: `https://www.nexcortiq.us` (Search Console: prefer `sc-domain:nexcortiq.us` or the URL-prefix property you verified).

---

## One-time setup

### 1. Install / refresh the CLI in the repo

```bash
cd tools/gsc-ga4-cli
npm install
```

Optional PATH wrappers (already created on Jeff’s machine):

```bash
# ~/.local/bin/gsc and ~/.local/bin/ga4 → tools/gsc-ga4-cli/node_modules/.bin/*
export PATH="$HOME/.local/bin:$PATH"
```

Or call from the repo:

```bash
./scripts/gsc --help
./scripts/ga4 --help
```

### 2. Google Cloud project + APIs

In a GCP project you control for marketing analytics (not the multilingual Translate SA used by Call Assist):

1. Create a **service account** (e.g. `nexcortiq-gsc-ga4@PROJECT.iam.gserviceaccount.com`).
2. Create a JSON key → store **outside the repo** (e.g. `~/.config/gsc-ga4-cli/nexcortiq-gsc-ga4-sa.json`). Never commit the key.
3. Enable:
   - Search Console API — `searchconsole.googleapis.com`
   - Google Analytics Data API — `analyticsdata.googleapis.com`
   - Google Analytics Admin API — `analyticsadmin.googleapis.com`

```bash
gcloud services enable searchconsole.googleapis.com analyticsdata.googleapis.com analyticsadmin.googleapis.com --project=YOUR_GCP_PROJECT
```

### 3. Grant the service account access to data

- **Search Console:** property → Settings → Users → add the SA email (Full).
- **GA4:** Admin → Property access management → add the SA email (Viewer+).

### 4. Config file

Copy the example and edit:

```bash
cp ~/.config/gsc-ga4-cli/config.example.json ~/.config/gsc-ga4-cli/config.json
# or: tools/gsc-ga4-cli/config.example.json → ~/.config/gsc-ga4-cli/config.json
```

```json
{
  "key_file": "/Users/YOU/.config/gsc-ga4-cli/nexcortiq-gsc-ga4-sa.json",
  "default_site": "sc-domain:nexcortiq.us",
  "default_property": "123456789"
}
```

`default_property` is the **numeric GA4 property ID** (Admin → Property settings), not the `G-…` measurement ID.

Env overrides: `GSC_GA4_KEY`, `GSC_GA4_CONFIG`, or `--key /path/to.json`.

---

## Common commands

```bash
# Search Console
gsc sites list
gsc query --site "sc-domain:nexcortiq.us" --dimensions query --row-limit 25
gsc query --dimensions page,query --row-limit 50 --json
gsc inspect https://www.nexcortiq.us/ --site "sc-domain:nexcortiq.us"
gsc sitemaps list --site "sc-domain:nexcortiq.us"

# GA4
ga4 summaries
ga4 report --property PROPERTY_ID
ga4 report --property PROPERTY_ID --dimensions pagePath --metrics screenPageViews --order-by screenPageViews --desc --limit 20
ga4 realtime --property PROPERTY_ID
ga4 streams list --property PROPERTY_ID
```

---

## Security notes

- Do **not** reuse `rapid-cortex/multilingual/google-service-account` for GSC/GA4 — that secret is for Translate/multilingual only.
- Do **not** commit JSON keys or `config.json` with real paths into git.
- Keep CJIS / ops console traffic out of marketing GA4 (see GOOGLE_ANALYTICS_INDEX.md).
