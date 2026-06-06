# Status Subdomain Setup

This document covers DNS and hosting steps for serving the public status page at:

- `https://status.rapidcortex.us`

Code route and DNS are separate tasks:

- Code route: `/status` and `/api/status` in the Next.js app.
- DNS/hosting: map `status.rapidcortex.us` to the deployed app infrastructure.

## 1) Add DNS record

- Create a DNS record for `status.rapidcortex.us`.
- Point it to the hosting target for the Next.js app (CloudFront, Amplify, or other edge host).

## 2) If using CloudFront (shared distribution)

1. Add `status.rapidcortex.us` as an Alternate Domain Name (CNAME) on the distribution.
2. Attach an ACM certificate that includes `status.rapidcortex.us`.
3. Route the subdomain to the same Next.js app origin.
4. Verify that `/status` loads from that host.

## 3) If using a separate CloudFront distribution

1. Create a dedicated distribution for status traffic.
2. Attach ACM certificate for `status.rapidcortex.us`.
3. Route a Route 53 record to the new distribution.
4. Confirm `/status` and `/api/status` routing behavior.

## 4) If using Amplify / managed Next hosting

1. Add custom subdomain `status.rapidcortex.us`.
2. Map it to the existing app and route handling for `/status`.
3. Confirm SSL issuance and deployment propagation.

## 5) Verification commands

```bash
curl -I https://status.rapidcortex.us
curl https://status.rapidcortex.us/api/status
```

If the API route is only reachable through the main host in your current routing setup, verify:

```bash
curl https://www.rapidcortex.us/api/status
```

## Notes

- Keep the status page public (no login required).
- Return only public-safe status data.
- Do not expose sensitive internals, customer data, or agency details.
