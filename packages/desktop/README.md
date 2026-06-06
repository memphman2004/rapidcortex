# Rapid Cortex Desktop (Electron + MapKit JS)

Experimental **Electron** shell for **Apple MapKit JS** on macOS with **Mapbox GL** fallback via `rapid-cortex-maps`.

> **Production macOS app:** [`apps/desktop-macos`](../../apps/desktop-macos) is the shipped SwiftUI + WKWebView shell. Use this package when you want MapKit JS in a Chromium renderer or to prototype hybrid maps outside the web app.

## Setup

1. Create a **MapKit JS** key in [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list).
2. Save the `.p8` file under `packages/desktop/keys/` (gitignored).
3. Copy `.env.mapkit.example` → `.env.mapkit` and set `MAPKIT_KEY_ID`, `MAPKIT_TEAM_ID`, `MAPKIT_KEY_PATH`.

## Run

```bash
npm install
npm run build -w rapid-cortex-maps
npm run dev -w rapid-cortex-desktop
```

## Architecture

- **Main process:** JWT signing (`src/main/mapkit-token-server.ts`), IPC `get-mapkit-token` / `is-mapkit-available`.
- **Preload:** exposes `window.electronAPI` (no Node in renderer).
- **Renderer:** React + `AppleMapView` / markers from `packages/maps/src/mapkit/`.

MapKit tiles are cached by the system when offline on macOS; the test UI shows an offline banner when `navigator.onLine` is false.
