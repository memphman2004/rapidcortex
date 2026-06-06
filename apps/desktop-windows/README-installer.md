# Rapid Cortex — Windows installer (Inno Setup)

The Windows desktop app is packaged with **Inno Setup** into a single **`RapidCortexSetup.exe`** installer.

## Requirements

- **Windows** (build the installer on Windows; Inno Setup is Windows-native)
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (for `dotnet publish`)
- [Inno Setup 6](https://jrsoftware.org/isinfo.php) (installs `ISCC.exe` — add *Inno Setup* folder to `PATH`, or use the full path shown below)

## Build

From the **repository root**:

```bash
./apps/desktop-windows/scripts/build-installer.sh
```

Or from `apps/desktop-windows`:

```bash
./scripts/build-installer.sh
```

The script will:

1. Run **`dotnet publish`** for `RapidCortexDesktop.Wpf` (**Release**, **win-x64**, framework-dependent) into  
   `apps/desktop-windows/src/RapidCortexDesktop.Wpf/publish/win-x64/`
2. If **`iscc`** (Inno Setup Compiler) is available, compile  
   `apps/desktop-windows/installer/RapidCortexSetup.iss`
3. Write **`apps/desktop-windows/dist/RapidCortexSetup.exe`**

On **macOS/Linux**, the script still runs **`dotnet publish`** if you have the SDK; it then prints instructions for compiling the `.iss` on Windows (or using Wine + Inno Setup for advanced setups).

### Manual compile (Windows)

If `iscc` is not on `PATH`, use the default install location:

```text
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "C:\path\to\repo\apps\desktop-windows\installer\RapidCortexSetup.iss"
```

Or open **`RapidCortexSetup.iss`** in the Inno Setup IDE and choose **Build → Compile**.

## Installer behavior (summary)

- Installs under **`{autopf}\RapidCortex`** (64-bit Program Files).
- Registers **`rapidcortex-desktop://`** with **`HKLM\SOFTWARE\Classes\rapidcortex-desktop`** so Cognito OAuth redirects can return to the app (matches `appsettings` redirect URI).
- Optional **desktop shortcut** (unchecked by default).
- Post-install **Launch Rapid Cortex** (skipped in silent install).

## Uploading a release

After you have **`apps/desktop-windows/dist/RapidCortexSetup.exe`**, upload from the **repo root** (requires AWS CLI + downloads stack; see `scripts/upload-desktop-downloads.sh`):

```bash
./scripts/upload-desktop-downloads.sh prod windows apps/desktop-windows/dist/RapidCortexSetup.exe 1.0.0
```

Adjust **`prod`**, **version**, and path if your environment differs.

## Version bump process

1. **`RapidCortexSetup.iss`** — update `#define MyAppVersion "x.y.z"` (and optionally `[Setup]` / metadata if you add more defines).
2. **`RapidCortexDesktop.Wpf.csproj`** — align **`<Version>`** / **`<AssemblyVersion>`** / **`<FileVersion>`** if you use them for the built exe (optional but recommended for support).
3. Re-run **`build-installer.sh`** and upload with the **same version string** passed to **`upload-desktop-downloads.sh`** so **`latest.json`** and checksums stay consistent.

**`AppId` in the `.iss` file must stay the same** across releases so Windows upgrades replace the same product; only **`AppVersion`** / defines should change for normal releases.

## Authenticode signing

Production installers should be **Authenticode-signed** (EV certificate preferred). Inno Setup can sign **`Setup.exe`** and uninstaller via **`[Setup]`** `SignTool` directives; that configuration is environment-specific and is not committed here—add it locally or in your secure CI pipeline.
