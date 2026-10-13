# NexCort iQ Watch MCP — ChatGPT registration

Public origin: `https://mcp.nexcortiq.us`  
MCP endpoint: `https://mcp.nexcortiq.us/mcp`  
OAuth metadata: `https://mcp.nexcortiq.us/.well-known/oauth-authorization-server`

Internal AWS names may still use `rapid-cortex-*` prefixes. The ingest API key never leaves AWS Secrets Manager and is never exposed to ChatGPT.

## Live smoke (2026-10-12)

Stack: `rapid-cortex-dev-mcp-watch` (standalone; parent `EnableMcpWatch` stays **false** until imported)

| Check | Result |
|-------|--------|
| `GET /health` | `ok: true`, issuer `https://mcp.nexcortiq.us` |
| OAuth AS metadata | authorize + token + PKCE S256 + `watch:write` |
| JWKS | RS256 key `kid=2026-10` |

Roles allowed to write: `rcsuperadmin`, `rcadmin`, `salescontractor` with scope `watch:write`.

## ChatGPT custom MCP registration steps

1. In ChatGPT → Settings → Apps / Connectors (or Custom GPTs → Actions/MCP, depending on product surface), add a new **MCP server**.
2. Server URL: `https://mcp.nexcortiq.us/mcp`
3. Auth: **OAuth**. Discovery URL: `https://mcp.nexcortiq.us/.well-known/oauth-authorization-server`
4. Complete Hosted UI login with an RC staff Cognito user that has a permitted role.
5. Confirm tool list includes only `submit_watch_signal`.
6. Interactive test: call `submit_watch_signal` with one valid WatchSignal for each of:
   - `psap_intelligence`
   - `campus_intelligence`
   - `venue_intelligence`
   - `transit_intelligence`
   - `competitor_intelligence`
7. Confirm each appears in the NexCort iQ Watch Inbox (dashboard) with the same `external_key`.

## Smoke script

```bash
export MCP_PUBLIC_BASE_URL=https://mcp.nexcortiq.us
bash scripts/smoke-mcp-watch.sh
# optional authenticated probe:
export MCP_ACCESS_TOKEN='…'
bash scripts/smoke-mcp-watch.sh
```

## What this does **not** prove

A successful MCP connection and interactive tool call does **not** prove that scheduled ChatGPT Watches can call `submit_watch_signal` unattended.

Treat **unattended scheduled Watch → ingest** as a **separate acceptance test**. Do not assume GPT Actions or custom MCP tools run automatically from scheduled ChatGPT tasks.

## Security notes

- Upstream ingest uses Secrets Manager `RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN` server-side only.
- Access tokens are verified for signature, issuer, audience, expiration, `watch:write` scope, and role.
- Temporary upstream failures retry with bounded exponential backoff; 400/401/403 are not retried.
- `external_key` is preserved across retries for dedupe.
