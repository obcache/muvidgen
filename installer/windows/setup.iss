#define MyAppName "MuvidGen"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "MuvidGen"
#define MyAppExeName "MuvidGen.exe"
#define MyAppId "{8A7E0C0A-0000-4000-8000-0000MUVIDGEN}"

; Adjust these source paths to your built app output locations
#define AppBinDir "dist\\electron"             
#define RendererBinDir "renderer\\python\\dist" 
#define VendorRedistDir "vendor\\windows\\redist"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=yes
OutputDir=installer\windows\out
OutputBaseFilename=MuvidGen-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; Electron app files (adjust to your build pipeline)
Source: "{#AppBinDir}\\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

; Packaged Python renderer binary goes under resources\\renderer
Source: "{#RendererBinDir}\\muvidgen-renderer.exe"; DestDir: "{app}\\resources\\renderer"; Flags: ignoreversion

; Redist ffmpeg/ffprobe to {app}\\redist
Source: "{#VendorRedistDir}\\ffmpeg.exe"; DestDir: "{app}\\redist"; Flags: ignoreversion
Source: "{#VendorRedistDir}\\ffprobe.exe"; DestDir: "{app}\\redist"; Flags: ignoreversion
; Include any accompanying license/readme files for ffmpeg/ffprobe
Source: "{#VendorRedistDir}\\*.txt"; DestDir: "{app}\\redist\\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#VendorRedistDir}\\*.md"; DestDir: "{app}\\redist\\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"
Name: "{userdesktop}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\\redist"
