#!/usr/bin/env bash
set -euo pipefail

NO_POSTINSTALL=false
for arg in "$@"; do
  case "$arg" in
    --no-postinstall) NO_POSTINSTALL=true ;;
  esac
done

info() { printf "[seed] %s\n" "$1"; }

ROOT_DIR=$(pwd)
DOCS_DIR="$ROOT_DIR/docs"
LEDGER_PATH="$DOCS_DIR/dev-ledger.md"
MANUAL_QA_PATH="$DOCS_DIR/manual-qa.md"
TOOLS_DIR="$ROOT_DIR/tools"
LEDGER_JS_PATH="$TOOLS_DIR/ledger.js"

mkdir -p "$DOCS_DIR" "$TOOLS_DIR"

# 1) Create or ensure dev-ledger.md with required sections
if [[ ! -f "$LEDGER_PATH" ]]; then
  info "Creating docs/dev-ledger.md"
  cat > "$LEDGER_PATH" <<'EOF'
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

- [ ] (Optional) Add Node types to client devDependencies
  - Command: `cd client && npm i -D @types/node@^18`
  - Verify: `cd client && npx tsc -p tsconfig.json`

- [ ] Verify postinstall installs client dependencies automatically
  - Clean: remove `client/node_modules`
  - Run: `npm install` at repo root

- [ ] Align root Vite configuration usage (pick one)
  - Option A (recommended): Remove or archive unused root `vite.config.ts`; Vite runs from `client/`.
  - Option B: Keep root Vite config and install root devDeps: `npm i -D vite @vitejs/plugin-react`.

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
EOF
else
  info "docs/dev-ledger.md exists; ensuring required sections"
  grep -qE '^##\s+Entries\b' "$LEDGER_PATH" || printf "\n\n## Entries\n\n" >> "$LEDGER_PATH"
  grep -qE '^##\s+Changelog\b' "$LEDGER_PATH" || printf "\n\n## Changelog\n\n" >> "$LEDGER_PATH"
fi

# 2) Ensure manual-qa references the ledger
LEDGER_NOTE='Note: Environment remediation tasks and a running development journal now live in `docs/dev-ledger.md`.'
if [[ -f "$MANUAL_QA_PATH" ]]; then
  if ! grep -q 'dev-ledger.md' "$MANUAL_QA_PATH"; then
    info "Updating docs/manual-qa.md with ledger reference"
    awk -v note="$LEDGER_NOTE" '
      BEGIN{added=0}
      /^#\s*Manual QA\s*$/ && !added {print; print ""; print note; added=1; next}
      {print}
      END{if(!added){print "# Manual QA\n\n" note}}
    ' "$MANUAL_QA_PATH" > "$MANUAL_QA_PATH.tmp"
    mv "$MANUAL_QA_PATH.tmp" "$MANUAL_QA_PATH"
  fi
else
  info "Creating docs/manual-qa.md with ledger reference"
  printf "# Manual QA\n\n%s\n" "$LEDGER_NOTE" > "$MANUAL_QA_PATH"
fi

# 3) Add tools/ledger.js
info "Writing tools/ledger.js"
cat > "$LEDGER_JS_PATH" <<'EOF'
#!/usr/bin/env node
/* Orchestrates dev-ledger entries and changelog updates. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const LEDGER_PATH = path.join(process.cwd(), 'docs', 'dev-ledger.md');

function readLedger() { try { return fs.readFileSync(LEDGER_PATH, 'utf8'); } catch (e) { console.error(`Failed to read ${LEDGER_PATH}:`, e.message); process.exit(1);} }
function writeLedger(contents) { fs.writeFileSync(LEDGER_PATH, contents, 'utf8'); }
function sectionRange(md, header) {
  const lines = md.split(/\r?\n/);
  const startIdx = lines.findIndex(l => l.trim().toLowerCase() === (`## ${header}`).toLowerCase());
  if (startIdx === -1) return null; let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) { const t = lines[i].trim(); if (t.startsWith('## ') && i > startIdx + 1) { endIdx = i; break; } }
  return { lines, startIdx, endIdx };
}
function parseEntries(md) {
  const range = sectionRange(md, 'Entries'); if (!range) return { entries: [], range: null };
  const { lines, startIdx, endIdx } = range; const bodyLines = lines.slice(startIdx + 1, endIdx);
  const entries = []; let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i]; const m = line && line.startsWith('### ')
      ? line.match(/^### \[(\d{4}-\d{2}-\d{2})\]\s+(.+?)\s+\(Status:\s*(Planned|Draft|Complete)\s*\)\s*$/)
      : null;
    if (m) { const start = i; const date = m[1]; const title = m[2]; const status = m[3]; i++; const content = [];
      while (i < bodyLines.length && !(bodyLines[i] || '').startsWith('### ')) { content.push(bodyLines[i]); i++; }
      entries.push({ date, title, status, start, end: i, content });
    } else { i++; }
  }
  return { entries, range: { lines, startIdx, endIdx } };
}
function buildCommitMessage(completeEntries) {
  if (!completeEntries.length) return null;
  const subject = completeEntries.length === 1 ? `dev-ledger: ${completeEntries[0].title}`
    : `dev-ledger: ${completeEntries.length} entries — ` + completeEntries.map(e => e.title).join('; ');
  const bodyParts = completeEntries.map(e => [`Entry: ${e.title} (${e.date})`, '', (e.content.join('\n').trim() || '(no additional details)')].join('\n'));
  return [subject, '', bodyParts.join('\n\n---\n\n')].join('\n');
}
function gitCommit(message, dryRun) {
  if (dryRun) return { hash: '(dry-run)' };
  const tmp = path.join(os.tmpdir(), `ledger-commit-${Date.now()}.txt`); fs.writeFileSync(tmp, message, 'utf8');
  try { cp.execSync('git add -A', { stdio: 'inherit' }); cp.execSync(`git commit -F "${tmp.replace(/"/g, '""')}"`, { stdio: 'inherit', shell: true });
    const hash = cp.execSync('git rev-parse --short HEAD').toString().trim(); fs.unlinkSync(tmp); return { hash };
  } catch (e) { console.error('git commit failed:', e.message); process.exit(1); }
}
function moveEntriesToChangelog(md, parsed, committedEntries, commitHash) {
  const { lines, startIdx, endIdx } = parsed.range; const body = lines.slice(startIdx + 1, endIdx);
  const spans = committedEntries.map(e => [e.start, e.end]).sort((a,b) => b[0]-a[0]); const updatedBody = body.slice();
  for (const [s,e] of spans) updatedBody.splice(s, e-s);
  let cl = sectionRange(lines.join('\n'), 'Changelog'); if (!cl) { lines.push('', '## Changelog', ''); cl = sectionRange(lines.join('\n'), 'Changelog'); }
  const blocks = committedEntries.map(e => [`### [${e.date}] ${e.title} (Commit: ${commitHash})`, (e.content.join('\n').trim() || '')].join('\n'));
  const newLines = [].concat(lines.slice(0, startIdx + 1), updatedBody, lines.slice(endIdx));
  const afterMove = newLines.join('\n'); const cl2 = sectionRange(afterMove, 'Changelog'); if (!cl2) return afterMove;
  const clLines = cl2.lines.slice(); const clBody = clLines.slice(cl2.startIdx + 1, cl2.endIdx); const insertion = (clBody.length && clBody[clBody.length-1].trim() !== '') ? [''] : [];
  return [].concat(clLines.slice(0, cl2.startIdx + 1), clBody, insertion, blocks.flatMap(b => [b,'']), clLines.slice(cl2.endIdx)).join('\n');
}
function main() {
  const args = process.argv.slice(2); const cmd = args[0]; const dry = args.includes('--dry-run');
  const md = readLedger(); const parsed = parseEntries(md); const complete = parsed.entries.filter(e => e.status === 'Complete');
  if (cmd === 'message') { const msg = buildCommitMessage(complete); if (!msg) { console.log('No Complete entries found in dev-ledger.'); process.exit(0);} console.log(msg); return; }
  if (cmd === 'commit') {
    const msg = buildCommitMessage(complete); if (!msg) { console.log('No Complete entries to commit. Update entry statuses in dev-ledger.'); process.exit(0);} if (dry) { console.log('--- Commit message (dry-run) ---'); console.log(msg); console.log('\n--- Preview: would move entries to Changelog on commit ---'); complete.forEach(e => console.log(` - ${e.title} (${e.date})`)); return; }
    const { hash } = gitCommit(msg, false); const updated = moveEntriesToChangelog(md, parsed, complete, hash); writeLedger(updated);
    try { cp.execSync('git add docs/dev-ledger.md', { stdio: 'inherit' }); cp.execSync(`git commit -m "dev-ledger: record changelog for ${hash}"`, { stdio: 'inherit', shell: true }); } catch (e) { console.error('Failed to commit ledger update:', e.message); process.exit(1);} console.log(`Committed and moved ${complete.length} entr(y/ies) to Changelog. Commit: ${hash}`); return;
  }
  console.log('Usage:\n  node tools/ledger.js message\n  node tools/ledger.js commit\n  node tools/ledger.js commit --dry-run');
}
main();
EOF
chmod +x "$LEDGER_JS_PATH"

# 4) Update package.json via Node (idempotent)
info "Updating package.json scripts"
node - <<'EOF'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
let pkg = {};
if (fs.existsSync(pkgPath)) pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = pkg.name || 'new-project';
pkg.private = (pkg.private !== false);
pkg.version = pkg.version || '0.0.0';
pkg.scripts = pkg.scripts || {};
pkg.scripts['ledger:message'] = 'node tools/ledger.js message';
pkg.scripts['ledger:commit'] = 'node tools/ledger.js commit';
pkg.scripts['ledger:dry'] = 'node tools/ledger.js commit --dry-run';
const hasClient = fs.existsSync(path.join(root, 'client', 'package.json'));
if (hasClient && !process.env.NO_POSTINSTALL && !pkg.scripts['postinstall']) {
  pkg.scripts['postinstall'] = 'npm --prefix client ci || npm --prefix client install';
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('[seed] package.json updated');
EOF

info "Done. Next steps:"
info "  1) Add your first entry under '## Entries' in docs/dev-ledger.md (set Status: Complete when ready)."
info "  2) Preview message:    npm run ledger:message"
info "  3) Dry-run the commit:  npm run ledger:dry"
info "  4) Commit + record:     npm run ledger:commit"

