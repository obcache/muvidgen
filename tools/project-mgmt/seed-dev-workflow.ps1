#command line to install this script: powershell -ExecutionPolicy Bypass -File .\seed-dev-workflow.ps1

Param(
  [switch]$NoPostinstall  # set to skip adding client postinstall
)

$ErrorActionPreference = 'Stop'
$root = Get-Location
function Info($m){ Write-Host "[seed] $m" -ForegroundColor Cyan }

# 1) Ensure docs/ and add/update dev-ledger.md
$docsDir = Join-Path $root "docs"
New-Item -ItemType Directory -Force -Path $docsDir | Out-Null
$devLedgerPath = Join-Path $docsDir "dev-ledger.md"

$devLedgerTemplate = @'
# Dev Ledger

This ledger tracks mid- to high-level development progress and acts as a transactional journal/changelog. Record notable changes here even if they are not committed yet. Use it to generate follow-up or rollback tasks when we need to reproduce, revert, or replay major moves.

## Purpose
- Serve as a living changelog for in-flight and merged work.
- Capture rationale, commands, and impacted areas to enable reproducibility.
- Provide a source of truth for remediation and rollback task generation.

## How To Use
- Add a new entry for any meaningful change: refactors, dependency upgrades, build config changes, infra tweaks, or behavior-affecting edits.
- Prefer small, frequent entries over large batches.
- If changes are exploratory or uncommitted, mark the entry as "Draft"; update status when finalized.
- For every entry, include a rollback plan or link to a rollback task list.

## Entry Template
### [YYYY-MM-DD] Title (Status: Planned | Draft | Complete)
Author: <name/initials>

Summary
- What changed and why in 1–2 lines.

Impact
- Affected areas/modules: <list>
- Risk level: Low | Medium | High

Commands/Steps
- Commands executed or steps taken (copy-paste friendly).

Artifacts
- Files touched: <paths>
- Links/tickets: <refs>

Follow-ups
- [ ] Tasks to complete or validate the change.

Rollback Strategy
- High-level approach and commands to revert.

## Remediation Tasks
- [ ] Add Node types to root devDependencies
  - Command: `npm i -D @types/node@^18` (or `@^20` to match your Node LTS)
  - Verify: `npx tsc -p tsconfig.electron.json`
  - Rationale: tsconfigs include Node types.

- [ ] (Optional) Add Node types to client devDependencies
  - Command: `cd client && npm i -D @types/node@^18`
  - Verify: `cd client && npx tsc -p tsconfig.json`
  - Rationale: Client extends the base tsconfig which includes Node types.

- [ ] Verify postinstall installs client dependencies automatically
  - Clean: remove `client/node_modules`
  - Run: `npm install` at repo root
  - Expect: `client/node_modules` is repopulated (root `postinstall` runs `npm --prefix client ci || install`).

- [ ] Align root Vite configuration usage (pick one)
  - Option A (recommended): Remove or archive unused root `vite.config.ts`; Vite runs from `client/`.
  - Option B: Keep root Vite config and install root devDeps: `npm i -D vite @vitejs/plugin-react`.
  - Verify: No editor/CI warnings about missing Vite packages at root.

- [ ] Validate Node and npm versions
  - `node -v` should be >= 18 (or 20.x).
  - `npm -v` should be >= 9.

- [ ] Sanity-check TypeScript builds
  - Root Electron: `npx tsc -p tsconfig.electron.json`
  - Client: `cd client && npx tsc -p tsconfig.json`

- [ ] Confirm dev server ports are available (optional)
  - Vite dev: 5173; Vite preview: 4173

- [ ] Update README to reflect changes (optional)
  - Note that `npm install` at root now installs `client/` deps via `postinstall`.
  - Mention the Electron bridge mock flags for browser-only UI.

## Entries
Add active entries here. Entries marked `Status: Complete` will be used to auto-generate commit messages and, upon commit, will be moved to the Changelog section with the commit hash.

Example (remove after first use):

### [YYYY-MM-DD] Example Entry Title (Status: Draft)
Author: dev

Summary
- Short 1–2 line description.

Impact
- Modules: <list>
- Risk: Low

Commands/Steps
- Step or command

Follow-ups
- [ ] Next task

Rollback Strategy
- Outline how to revert.

## Changelog
Committed entries are appended here automatically by the ledger tool, including commit hash and date.

## Rollback Task Template
Use this when a major move may need reversing. Keep it near the entry that introduced the change.

### Rollback: <Title/ID>
Prereqs
- Current branch/commit: <ref>
- Backups/snapshots: <paths or links>

Steps
- [ ] Step 1 (command)
- [ ] Step 2 (command)

Verification
- [ ] Build/test pass: <commands>
- [ ] Manual checks: <list>

Restore Plan (if rollback fails)
- Outline the plan to restore the prior state or escalate.
'@

if (!(Test-Path $devLedgerPath)) {
  Info "Creating docs/dev-ledger.md"
  $devLedgerTemplate | Set-Content -Encoding UTF8 -Path $devLedgerPath
} else {
  Info "docs/dev-ledger.md exists; ensuring required sections"
  $current = Get-Content -Raw $devLedgerPath
  if ($current -notmatch "(?ms)^##\s+Entries\b") {
    Add-Content -Path $devLedgerPath -Value "`n`n## Entries`n`n"
  }
  if ($current -notmatch "(?ms)^##\s+Changelog\b") {
    Add-Content -Path $devLedgerPath -Value "`n`n## Changelog`n`n"
  }
}

# 2) Update or create docs/manual-qa.md to reference dev-ledger
$manualQaPath = Join-Path $docsDir "manual-qa.md"
$ledgerNote = "Note: Environment remediation tasks and a running development journal now live in `docs/dev-ledger.md`."
if (Test-Path $manualQaPath) {
  $qa = Get-Content -Raw $manualQaPath
  if ($qa -notmatch [regex]::Escape("dev-ledger.md")) {
    if ($qa -match "^#\s*Manual QA") {
      $qa = $qa -replace "(?m)^(#\s*Manual QA\s*)$", "`$1`r`n`r`n$ledgerNote"
    } else {
      $qa = "# Manual QA`r`n`r`n$ledgerNote`r`n`r`n$qa"
    }
    Info "Updating docs/manual-qa.md with ledger reference"
    $qa | Set-Content -Encoding UTF8 -Path $manualQaPath
  }
} else {
  Info "Creating docs/manual-qa.md with ledger reference"
  "# Manual QA`r`n`r`n$ledgerNote`r`n" | Set-Content -Encoding UTF8 -Path $manualQaPath
}

# 3) Add tools/ledger.js
$toolsDir = Join-Path $root "tools"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$ledgerJsPath = Join-Path $toolsDir "ledger.js"

$ledgerJs = @'
#!/usr/bin/env node
/*
 Orchestrates dev-ledger entries and changelog updates.
 - message: generates a commit message from Complete entries in docs/dev-ledger.md
 - commit: generates message, commits repo, moves entries from Entries -> Changelog with commit hash
   Flags: --dry-run (preview only, no git, no file writes)
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const LEDGER_PATH = path.join(process.cwd(), 'docs', 'dev-ledger.md');

function readLedger() {
  try {
    return fs.readFileSync(LEDGER_PATH, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${LEDGER_PATH}:`, err.message);
    process.exit(1);
  }
}

function writeLedger(contents) {
  fs.writeFileSync(LEDGER_PATH, contents, 'utf8');
}

function sectionRange(md, header) {
  const lines = md.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase() === `## ${header}`.toLowerCase());
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('## ') && i > startIdx + 1) {
      endIdx = i; break;
    }
  }
  return { lines, startIdx, endIdx };
}

function parseEntries(md) {
  const range = sectionRange(md, 'Entries');
  if (!range) return { entries: [], range: null };
  const { lines, startIdx, endIdx } = range;
  const bodyLines = lines.slice(startIdx + 1, endIdx);

  const entries = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    const headerMatch = line && line.startsWith('### ')
      ? line.match(/^### \[(\d{4}-\d{2}-\d{2})\]\s+(.+?)\s+\(Status:\s*(Planned|Draft|Complete)\s*\)\s*$/)
      : null;
    if (headerMatch) {
      const start = i;
      const date = headerMatch[1];
      const title = headerMatch[2];
      const status = headerMatch[3];
      i++;
      const content = [];
      while (i < bodyLines.length && !(bodyLines[i] || '').startsWith('### ')) {
        content.push(bodyLines[i]); i++;
      }
      entries.push({ date, title, status, start, end: i, content });
    } else {
      i++;
    }
  }
  return { entries, range: { lines, startIdx, endIdx } };
}

function buildCommitMessage(completeEntries) {
  if (completeEntries.length === 0) return null;
  const subject = completeEntries.length === 1
    ? `dev-ledger: ${completeEntries[0].title}`
    : `dev-ledger: ${completeEntries.length} entries — ` + completeEntries.map(e => e.title).join('; ');

  const bodyParts = completeEntries.map((e) => {
    const content = e.content.join('\n').trim();
    return [
      `Entry: ${e.title} (${e.date})`,
      '',
      content ? content : '(no additional details)',
    ].join('\n');
  });
  return [subject, '', bodyParts.join('\n\n---\n\n')].join('\n');
}

function gitCommit(message, dryRun) {
  if (dryRun) return { hash: '(dry-run)' };
  const tmp = path.join(os.tmpdir(), `ledger-commit-${Date.now()}.txt`);
  fs.writeFileSync(tmp, message, 'utf8');
  try {
    cp.execSync('git add -A', { stdio: 'inherit' });
    cp.execSync(`git commit -F "${tmp.replace(/"/g, '""')}"`, { stdio: 'inherit', shell: true });
    const hash = cp.execSync('git rev-parse --short HEAD').toString().trim();
    fs.unlinkSync(tmp);
    return { hash };
  } catch (err) {
    console.error('git commit failed:', err.message);
    process.exit(1);
  }
}

function moveEntriesToChangelog(md, parsed, committedEntries, commitHash) {
  const { lines, startIdx, endIdx } = parsed.range;
  const body = lines.slice(startIdx + 1, endIdx);

  // Remove committed entries
  let removeSpans = committedEntries.map((e) => [e.start, e.end]);
  removeSpans.sort((a, b) => b[0] - a[0]);
  let updatedBody = body.slice();
  for (const [s, e] of removeSpans) updatedBody.splice(s, e - s);

  // Ensure Changelog exists
  let changelog = sectionRange(lines.join('\n'), 'Changelog');
  if (!changelog) {
    lines.push('', '## Changelog', '');
    changelog = sectionRange(lines.join('\n'), 'Changelog');
  }

  const committedBlocks = committedEntries.map((e) => {
    const hdr = `### [${e.date}] ${e.title} (Commit: ${commitHash})`;
    const content = e.content.join('\n').trim();
    return [hdr, content ? content : ''].join('\n');
  });

  // Rebuild file
  const newLines = [];
  newLines.push(...lines.slice(0, startIdx + 1));
  newLines.push(...updatedBody);
  newLines.push(...lines.slice(endIdx));

  const afterMove = newLines.join('\n');
  const cl = sectionRange(afterMove, 'Changelog');
  if (!cl) return afterMove;
  const clLines = cl.lines.slice();
  const clBody = clLines.slice(cl.startIdx + 1, cl.endIdx);
  const insertion = (clBody.length && clBody[clBody.length - 1].trim() !== '') ? [''] : [];
  const merged = clLines.slice(0, cl.startIdx + 1)
    .concat(clBody)
    .concat(insertion)
    .concat(committedBlocks.flatMap(b => [b, '']))
    .concat(clLines.slice(cl.endIdx));
  return merged.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const dryRun = args.includes('--dry-run');

  const md = readLedger();
  const parsed = parseEntries(md);
  const completeEntries = parsed.entries.filter((e) => e.status === 'Complete');

  if (cmd === 'message') {
    const msg = buildCommitMessage(completeEntries);
    if (!msg) { console.log('No Complete entries found in dev-ledger.'); process.exit(0); }
    console.log(msg); return;
  }

  if (cmd === 'commit') {
    const msg = buildCommitMessage(completeEntries);
    if (!msg) { console.log('No Complete entries to commit. Update entry statuses in dev-ledger.'); process.exit(0); }

    if (dryRun) {
      console.log('--- Commit message (dry-run) ---');
      console.log(msg);
      console.log('\n--- Preview: would move entries to Changelog on commit ---');
      completeEntries.forEach((e) => console.log(` - ${e.title} (${e.date})`));
      return;
    }

    const { hash } = gitCommit(msg, false);
    const updated = moveEntriesToChangelog(md, parsed, completeEntries, hash);
    writeLedger(updated);
    try {
      cp.execSync('git add docs/dev-ledger.md', { stdio: 'inherit' });
      cp.execSync(`git commit -m "dev-ledger: record changelog for ${hash}"`, { stdio: 'inherit', shell: true });
    } catch (err) {
      console.error('Failed to commit ledger update:', err.message);
      process.exit(1);
    }
    console.log(`Committed and moved ${completeEntries.length} entr(y/ies) to Changelog. Commit: ${hash}`);
    return;
  }

  console.log('Usage:');
  console.log('  node tools/ledger.js message        # print generated commit message');
  console.log('  node tools/ledger.js commit         # commit and move Complete entries');
  console.log('  node tools/ledger.js commit --dry-run');
}
main();
'@

Info "Writing tools/ledger.js"
$ledgerJs | Set-Content -Encoding UTF8 -Path $ledgerJsPath

# 4) Update or create package.json with ledger scripts and optional postinstall
$pkgPath = Join-Path $root "package.json"
$pkg = $null
if (Test-Path $pkgPath) {
  Info "Updating package.json"
  $pkg = Get-Content -Raw $pkgPath | ConvertFrom-Json
} else {
  Info "Creating minimal package.json"
  $pkg = [ordered]@{ name = "new-project"; private = $true; version = "0.0.0"; scripts = @{ } }
}
if ($null -eq $pkg.scripts) { $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value (@{}) }

$pkg.scripts."ledger:message" = "node tools/ledger.js message"
$pkg.scripts."ledger:commit"  = "node tools/ledger.js commit"
$pkg.scripts."ledger:dry"     = "node tools/ledger.js commit --dry-run"

$clientPkgPath = Join-Path $root "client\package.json"
$shouldAddPostinstall = (Test-Path $clientPkgPath) -and (-not $NoPostinstall.IsPresent)
if ($shouldAddPostinstall -and -not $pkg.scripts.PSObject.Properties.Name.Contains("postinstall")) {
  $pkg.scripts."postinstall" = "npm --prefix client ci || npm --prefix client install"
}

($pkg | ConvertTo-Json -Depth 100) | Set-Content -Encoding UTF8 -Path $pkgPath

Info "Done. Next steps:"
Info "  1) Open docs/dev-ledger.md and add your first entry under '## Entries' (set Status: Complete when ready)."
Info "  2) Preview commit message:    npm run ledger:message"
Info "  3) Dry-run the workflow:      npm run ledger:dry"
Info "  4) Commit and record change:  npm run ledger:commit"

