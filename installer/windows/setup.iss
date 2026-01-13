#define MyAppName "muVidGen"
#define MyAppVersion "0.1.1"
#define MyAppPublisher "omnibros"
#define MyAppExeName "MuvidGen.exe"
#define MyAppId "8A7E0C0A-0000-4000-8000-0000MUVIDGEN"
#define LogoFile "E:\Production\Coding\muvidgen\client\public\ui\muvidgen_setupWizard_logo.png"
#define IconFile "E:\Production\Coding\muvidgen\client\public\ui\muvidgen_noText_logo.ico"
#define ShortcutFile "E:\Production\Coding\muvidgen\client\public\ui\muvidgen_noText_logo.png"

; Adjust these source paths to your built app output locations
#define AppBinDir "E:\Production\Coding\muvidgen\release\MuvidGen-win32-x64"             
#define RendererBinDir "E:\Production\Coding\muvidgen\renderer\python\dist" 
#define VendorRedistDir "E:\Production\Coding\muvidgen\vendor\windows\redist"

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
WizardStyle=modern
WizardImageFile={#LogoFile}
WizardSmallImageFile={#LogoFile}
WizardImageStretch=yes
WizardImageAlphaFormat=premultiplied
SetupIconFile

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
Source: "{#VendorRedistDir}\\*.txt"; DestDir: "{app}\\redist\\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs  skipifsourcedoesntexist
Source: "{#VendorRedistDir}\\*.md"; DestDir: "{app}\\redist\\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs  skipifsourcedoesntexist

[Icons]
Name: "{group}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"
Name: "{userdesktop}\\{#MyAppName}"; Filename: "{#ShortcutFile}"; IconFilename: "{#IconFile}";  Tasks: desktopicon

[Run]
Filename: "{app}\\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\\redist"
