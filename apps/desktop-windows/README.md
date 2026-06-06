# Rapid Cortex Desktop (Windows)

WPF on **.NET 8**: Cognito **Hosted UI** (PKCE), **`/oauth2/token`** exchange via **loopback** redirect, DPAPI-backed session store, API client with `Authorization: Bearer <id_token>`, environment-based config, dashboard health ping, and incidents preview. **Release** builds hide manual token paste; use sign-in or Debug smoke tests.

## Run locally

**Requires Windows** to run the WPF UI (`dotnet run`). On macOS/Linux you can still **`dotnet build`** the solution for CI compile checks (`EnableWindowsTargeting=true` in the `.csproj`).

```powershell
cd apps/desktop-windows
dotnet restore
dotnet run --project src/RapidCortexDesktop.Wpf/RapidCortexDesktop.Wpf.csproj
```

Override environment (maps to `appsettings.{Environment}.json` merge):

```powershell
$env:DOTNET_ENVIRONMENT = "Staging"
dotnet run --project src/RapidCortexDesktop.Wpf/RapidCortexDesktop.Wpf.csproj
```

Values in JSON may be overridden with environment variables prefixed `RapidCortex__` (see `DesktopConfigurationLoader`).

## Configuration

1. Copy `appsettings.example.json` to `src/RapidCortexDesktop.Wpf/appsettings.Local.json` (gitignored) **or** edit `appsettings.Development.json` with **non-production** placeholders only.
2. Set `ApiBaseUrl` to your API Gateway base URL (no trailing slash required; the client normalizes joins).
3. Set Cognito **Domain** (host only or `https://…`, the client normalizes), **ClientId**, and **RedirectUri**. The default redirect is `http://127.0.0.1:8765/callback` — add that **exact** URL to the Cognito app client **Callback URLs** (Allowed callback URLs). If Windows reports that the loopback listener cannot start, reserve the URL once (elevated): `netsh http add urlacl url=http://127.0.0.1:8765/callback/ user=Everyone` (or your org’s SDDL).
4. Do **not** commit real client secrets or production URLs if your policy forbids it; prefer machine-local `appsettings.Local.json`.

## Sign-in flow

1. **Sign in (Cognito Hosted UI)** starts a local listener, opens the browser, user signs in at Cognito.
2. Cognito redirects to `http://127.0.0.1:8765/callback?code=…`; the app exchanges the code and stores tokens.

## Next steps

- Refresh-token rotation and richer view models for incidents.
- MSIX / signed installer pipeline (see distribution docs).
