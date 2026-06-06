; Rapid Cortex — Windows installer (Inno Setup 6+)
; Build: run scripts/build-installer.sh from repo (Windows + ISCC), or open in Inno Setup Compiler.

#define MyAppName "Rapid Cortex"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Apps on Demand llc"
#define MyAppExeName "RapidCortexDesktop.exe"
; Fixed AppId — do not change between releases (controls upgrade path).
; Inno: leading "{{" becomes a single "{" in the AppId value.

[Setup]
AppId={{E7F3B8A4-5621-4D9C-9E2F-1A0B3C4D5E6F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://rapidcortex.us
AppSupportURL=https://rapidcortex.us/support
AppUpdatesURL=https://downloads.rapidcortex.us/latest.json
DefaultDirName={autopf}\RapidCortex
DefaultGroupName={#MyAppName}
OutputBaseFilename=RapidCortexSetup
OutputDir=..\..\dist
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
DisableProgramGroupPage=no
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\src\RapidCortexDesktop.Wpf\publish\win-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Registry]
; Default value — friendly protocol description
Root: HKLM; Subkey: "Software\Classes\rapidcortex-desktop"; ValueType: string; ValueName: ""; ValueData: "URL:Rapid Cortex Desktop Protocol"; Flags: uninsdeletekey
; Declares this class as a URL protocol (empty value)
Root: HKLM; Subkey: "Software\Classes\rapidcortex-desktop"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
; Handler: pass full activation URL to the app
Root: HKLM; Subkey: "Software\Classes\rapidcortex-desktop\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
