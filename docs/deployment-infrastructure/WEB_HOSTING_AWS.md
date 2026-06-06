# Static web hosting on AWS (rapidcortex.us + www)

This repository includes a **separate CloudFormation stack** that provisions:

- **S3** bucket (private; no public reads)
- **CloudFront** distribution with **origin access control** (OAC) to S3
- **ACM certificate** in **us-east-1** (required for CloudFront) for the apex and `www`, with **DNS validation** in your Route 53 public zone
- **Route 53 alias** **A** and **AAAA** records for `rapidcortex.us` and `www.rapidcortex.us` pointing at the distribution

The API stack (`infra/template.yaml`) can still manage `api.rapidcortex.us`. Do **not** also set `WWW_CNAME_TARGET` on the API deploy if you use this stack—`www` must be **alias** records to CloudFront, not a CNAME to another host.

## Requirements

- A **public Route 53 hosted zone** for `rapidcortex.us` (you have the zone ID, e.g. `Z123...`).
- Deploy and sync using an AWS profile with permissions for CloudFormation, S3, CloudFront, ACM, Route 53 (see `infra/iam/sam-deploy-policy.json` — includes `cloudfront:*` and `rapid-cortex-web-hosting-*` stack pattern).
- Run the **web hosting** stack in **`us-east-1`** (CloudFront + ACM convention).

## 1) Deploy the stack

From the repo root:

```bash
chmod +x scripts/deploy-web-hosting.sh scripts/sync-web-static-to-s3.sh

export AWS_PROFILE=rapid-cortex
export ROUTE53_HOSTED_ZONE_ID="Zxxxxxxxxxxxx"   # your public zone for rapidcortex.us
export ROOT_DOMAIN=rapidcortex.us
export DEPLOYMENT_STAGE=prod

./scripts/deploy-web-hosting.sh
```

First run: ACM may take a few minutes after DNS validation records are created; CloudFormation waits until the certificate is **ISSUED**, then creates CloudFront and the alias records.

### Use an existing ACM certificate (optional)

If you already have a **us-east-1** cert that includes `rapidcortex.us` and `www.rapidcortex.us`:

```bash
export WEB_CERTIFICATE_ARN="arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
./scripts/deploy-web-hosting.sh
```

## 2) Build static assets and sync to S3

The production Next.js app is **not** a plain static export by default. For S3 + CloudFront you need a **static or edge-compatible build** (for example **OpenNext**, **`output: 'export'`** where compatible, or another static pipeline). Build to a directory that has **`index.html` at the root** (the sync script defaults to `apps/web/out`).

```bash
# Example: after you produce apps/web/out (or set STATIC_DIR)
export STATIC_DIR="$PWD/apps/web/out"
./scripts/sync-web-static-to-s3.sh
```

The script runs `aws s3 sync` and a **CloudFront invalidation** on `/*`.

## 3) Environment variables for the live site

Set your hosting provider or build env so the browser uses the real origin, for example:

- `NEXT_PUBLIC_SITE_URL=https://www.rapidcortex.us`
- Cognito callback/logout URLs must include `https://www.rapidcortex.us` (and apex if you use it) per your pool app client settings.
- `HTTP_API_CORS_ORIGINS` on the API stack should include `https://www.rapidcortex.us` and `https://rapidcortex.us` if both serve the app.

## Template and stack name

- Template: `infra/web-hosting-template.yaml`
- Default stack name: `rapid-cortex-web-hosting-${DEPLOYMENT_STAGE}` (override with `WEB_HOSTING_STACK_NAME`)

## Related

- [DEPLOYMENT.md](./DEPLOYMENT.md) — API stack, CORS, `api.` custom domain
- [CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md) — parameter overview
- [infra/README.md](../infra/README.md) — domain topology
