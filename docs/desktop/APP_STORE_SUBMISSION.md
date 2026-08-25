# Desktop store submission (Mac + Windows)

Mac and Windows desktop clients are **native shells** around `https://app.rapidcortex.us`. They are submitted as **desktop apps**, not the Expo mobile app.

Public consumer store listings often fail App Review / Microsoft certification for “website wrappers.” Use **Unlisted** (Apple) or **Microsoft Store for Business / private audience** when possible.

## macOS — Mac App Store

Bundle id: `com.rapidcortex.desktop` · Team: `6D7D94PU3M` · Version: `MARKETING_VERSION` in Xcode (currently 1.0.2).

1. In [App Store Connect](https://appstoreconnect.apple.com) create a **macOS** app (this is a different record than iOS `us.rapidcortex.app`).
2. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account) create **Apple Distribution** (Mac App Store). Xcode Automatic signing can do this if you are signed into the team.
3. Confirm `Config/Secrets.plist` has `WEB_APP_BASE_URL=https://app.rapidcortex.us`.
4. From the repo root:

```bash
chmod +x scripts/macos-app-store-export.sh
./scripts/macos-app-store-export.sh
```

5. Upload the exported **`.pkg`** with **Transporter**.
6. Complete listing: screenshots, privacy nutrition, review notes (“licensed agency users; assistive co-pilot; does not replace CAD/911”). Prefer **Unlisted App Distribution** or **Custom Apps** (Apple Business Manager).

This machine already has **Developer ID Application** (direct DMG). Mac App Store uses a **different** cert: **Apple Distribution**. Both can exist in the same team.

Direct (non-store) DMG remains `scripts/macos-distribution-build.sh` + `downloads.rapidcortex.us`.

## Windows — Microsoft Store

Package identity: `RapidCortex.Desktop` (update **Publisher CN** in `store/Package.appxmanifest` to the exact Partner Center publisher).

Must be built on **Windows** with Visual Studio 2022 (Windows Application Packaging workload):

1. Reserve the name in [Partner Center](https://partner.microsoft.com/dashboard).
2. Open `apps/desktop-windows/RapidCortexDesktop.sln`.
3. Set **RapidCortexDesktop.Package** as startup project, **Release | x64**.
4. **Project → Publish → Create App Packages** → Microsoft Store (need a store-associated app).
5. Replace `Publisher="CN=Rapid Cortex"` with the Store publisher CN.
6. Submit the `.msixupload` / `.msixbundle`.

`WebAppBaseUrl` in production appsettings must be `https://app.rapidcortex.us`.

Inno Setup (`RapidCortexSetup.exe`) is the **sideload / downloads.rapidcortex.us** path, not the Store package.
