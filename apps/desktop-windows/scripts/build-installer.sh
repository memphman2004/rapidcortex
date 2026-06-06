#!/usr/bin/env bash
set -euo pipefail
# Build Rapid Cortex Windows publish output and compile the Inno Setup installer.
# Produces: apps/desktop-windows/dist/RapidCortexSetup.exe (when ISCC is available on Windows).
#
# Usage: ./apps/desktop-windows/scripts/build-installer.sh
# From repo root or from apps/desktop-windows (paths are resolved from this script).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT="${DESKTOP_ROOT}/src/RapidCortexDesktop.Wpf/RapidCortexDesktop.Wpf.csproj"
PUBLISH_OUT="${DESKTOP_ROOT}/src/RapidCortexDesktop.Wpf/publish/win-x64"
ISS="${DESKTOP_ROOT}/installer/RapidCortexSetup.iss"
DIST_DIR="${DESKTOP_ROOT}/dist"

echo "→ dotnet publish (Release, win-x64, framework-dependent) …"
dotnet publish "${PROJECT}" \
  -c Release \
  -r win-x64 \
  --self-contained false \
  -o "${PUBLISH_OUT}"

if ! command -v iscc >/dev/null 2>&1; then
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      ISCC_EXE=""
      for candidate in \
        "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" \
        "/c/Program Files/Inno Setup 6/ISCC.exe"; do
        if [[ -f "$candidate" ]]; then
          ISCC_EXE="$candidate"
          break
        fi
      done
      if [[ -n "${ISCC_EXE}" ]]; then
        echo "→ Inno Setup: ${ISCC_EXE}"
        mkdir -p "${DIST_DIR}"
        "${ISCC_EXE}" "${ISS}"
        echo "✅ Installer: ${DIST_DIR}/RapidCortexSetup.exe"
        exit 0
      fi
      echo "❌ Inno Setup Compiler (iscc) not found. Install Inno Setup 6 and add ISCC.exe to PATH, or use Git Bash paths above." >&2
      exit 1
      ;;
    *)
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "  Inno Setup (iscc) is not available on this OS."
      echo "  Published files are ready at:"
      echo "    ${PUBLISH_OUT}"
      echo ""
      echo "  To build RapidCortexSetup.exe:"
      echo "  1. Copy the repo to a Windows machine (or use a Windows VM)."
      echo "  2. Install Inno Setup 6: https://jrsoftware.org/isinfo.php"
      echo "  3. Install .NET 8 SDK."
      echo "  4. Run this script again from Git Bash, or compile the .iss in Inno Setup IDE:"
      echo "       \"C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe\" \"${ISS}\""
      echo ""
      echo "  Optional — Wine (advanced): install Wine, install Inno Setup into the prefix,"
      echo "  then run ISCC.exe against the .iss file; path escaping may require a Windows-style"
      echo "  drive mapping for the repo."
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      exit 0
      ;;
  esac
fi

echo "→ Inno Setup (iscc) …"
mkdir -p "${DIST_DIR}"
iscc "${ISS}"
echo "✅ Installer: ${DIST_DIR}/RapidCortexSetup.exe"
