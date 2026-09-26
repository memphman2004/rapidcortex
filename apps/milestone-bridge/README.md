# RC Milestone Bridge (skeleton)

On-prem Windows worker that implements the [Bridge Protocol](../../docs/product-architecture/MILESTONE_XPROTECT_BRIDGE.md).

## Status

This is a **compile-optional skeleton** for IU Year-1. It runs in **mock XProtect mode** without Milestone NuGet packages so macOS/CI developers can exercise the HTTP contract. Production builds add MIP SDK / XProtect REST packages on a Windows build agent.

## Run mock bridge locally

```bash
cd apps/milestone-bridge
dotnet run
# listens on http://127.0.0.1:8443
# set RC HMAC secret via MILESTONE_BRIDGE_HMAC_SECRET (default: local-dev-secret)
```

Point campus Connect UI at `http://127.0.0.1:8443` with matching secret in Secrets Manager / local env.

## Production

1. Replace `MockXProtectClient` with MIP SDK + XProtect REST clients.
2. Terminate TLS with a campus certificate.
3. Restrict inbound to NexCort iQ NAT / VPN egress IPs.
