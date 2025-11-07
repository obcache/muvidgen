Param()

$ErrorActionPreference = 'Stop'
function Ok($m){ Write-Host "[ok] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[warn] $m" -ForegroundColor Yellow }
function Err($m){ Write-Host "[err] $m" -ForegroundColor Red }

$thisDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $thisDir

$paths = @{
  RendererExe = Join-Path $repoRoot 'renderer\python\dist\muvidgen-renderer.exe'
  ElectronOut = Join-Path $repoRoot 'dist\electron'
  RedistFfmpeg = Join-Path $repoRoot 'vendor\windows\redist\ffmpeg.exe'
  RedistFfprobe = Join-Path $repoRoot 'vendor\windows\redist\ffprobe.exe'
  RedistDir = Join-Path $repoRoot 'vendor\windows\redist'
}

$failed = $false

Write-Host "MuvidGen Windows installer preflight" -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"

if (Test-Path $paths.RendererExe) { Ok "Renderer exe found: $($paths.RendererExe)" } else { Err "Missing renderer exe. Build with: pip install pyinstaller; powershell -File renderer\python\build.ps1"; $failed=$true }
if (Test-Path $paths.ElectronOut) { Ok "Electron output found: $($paths.ElectronOut)" } else { Warn "Electron output not found: $($paths.ElectronOut). Build with: npm run build" }

if (Test-Path $paths.RedistFfmpeg) { Ok "ffmpeg.exe present" } else { Err "Missing ffmpeg.exe in vendor\\windows\\redist"; $failed=$true }
if (Test-Path $paths.RedistFfprobe) { Ok "ffprobe.exe present" } else { Err "Missing ffprobe.exe in vendor\\windows\\redist"; $failed=$true }

$licenseTxt = Get-ChildItem -Path $paths.RedistDir -Filter *.txt -ErrorAction SilentlyContinue
$licenseMd = Get-ChildItem -Path $paths.RedistDir -Filter *.md -ErrorAction SilentlyContinue
if ($licenseTxt -or $licenseMd) {
  Ok "Found ffmpeg license/readme file(s): $((@($licenseTxt + $licenseMd) | Select-Object -ExpandProperty Name) -join ', ')"
} else {
  Warn "No license/readme files found in vendor\\windows\\redist. Include FFmpeg's LICENSE / COPYING files; installer copies them to {app}\\redist\\licenses."
}

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($iscc) {
  Ok "Inno Setup compiler (ISCC.exe) found: $($iscc.Source)"
} else {
  Warn "ISCC.exe (Inno Setup) not found on PATH. Install Inno Setup 6 and ensure ISCC.exe is available, or build via the GUI."
}

if ($failed) { exit 1 } else { Ok "Preflight checks passed"; exit 0 }

