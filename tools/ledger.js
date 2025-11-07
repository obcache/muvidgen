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
      endIdx = i;
      break;
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
        content.push(bodyLines[i]);
        i++;
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
  const tmpDir = ensureTmpDir();
  const tmp = path.join(tmpDir, `message-${Date.now()}.txt`);
  fs.writeFileSync(tmp, message, 'utf8');
  try {
    cp.execSync('git add -A', { stdio: 'inherit' });
    cp.execSync(`git commit -F "${tmp.replace(/"/g, '""')}"`, { stdio: 'inherit', shell: true });
    const hash = cp.execSync('git rev-parse --short HEAD').toString().trim();
    try { fs.unlinkSync(tmp); } catch {}
    return { hash };
  } catch (err) {
    console.error('git commit failed:', err.message);
    process.exit(1);
  }
}

function moveEntriesToChangelog(md, parsed, committedEntries, commitHash) {
  const { lines, startIdx, endIdx } = parsed.range;
  const body = lines.slice(startIdx + 1, endIdx);

  // Remove committed entries from Entries section
  let removeSpans = committedEntries.map((e) => [e.start, e.end]);
  removeSpans.sort((a, b) => b[0] - a[0]);
  let updatedBody = body.slice();
  for (const [s, e] of removeSpans) {
    updatedBody.splice(s, e - s);
  }

  // Ensure Changelog section exists
  let changelog = sectionRange(lines.join('\n'), 'Changelog');
  if (!changelog) {
    // Append a new Changelog section at end
    const append = ['','## Changelog',''];
    lines.push(...append);
    changelog = sectionRange(lines.join('\n'), 'Changelog');
  }

  const committedBlocks = committedEntries.map((e) => {
    const hdr = `### [${e.date}] ${e.title} (Commit: ${commitHash})`;
    const content = e.content.join('\n').trim();
    return [hdr, content ? content : ''].join('\n');
  });

  // Rebuild full file contents
  const newLines = [];
  newLines.push(...lines.slice(0, startIdx + 1));
  newLines.push(...updatedBody);
  newLines.push(...lines.slice(endIdx));

  // Insert committed blocks at end of Changelog section (before next ## or EOF)
  const afterMove = newLines.join('\n');
  const cl = sectionRange(afterMove, 'Changelog');
  if (!cl) return afterMove; // should not happen
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

function parseSemver(v) {
  const m = String(v || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(.*)?$/);
  if (!m) return null;
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10), tail: m[4] || '' };
}

function bumpPatch(v) {
  const p = parseSemver(v);
  if (!p) return null;
  return `${p.major}.${p.minor}.${p.patch + 1}${p.tail}`;
}

function bumpVersions() {
  const changes = [];
  // package.json
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const next = bumpPatch(pkg.version || '0.0.0');
      if (next) {
        pkg.version = next;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        changes.push({ file: pkgPath, version: next });
      }
    } catch (e) {
      console.warn('[ledger] Failed to bump package.json version:', e.message);
    }
  }

  // installer/windows/setup.iss -> #define MyAppVersion "x.y.z"
  const issPath = path.join(process.cwd(), 'installer', 'windows', 'setup.iss');
  if (fs.existsSync(issPath)) {
    try {
      let src = fs.readFileSync(issPath, 'utf8');
      const m = src.match(/#define\s+MyAppVersion\s+"([^"]+)"/);
      if (m) {
        const next = bumpPatch(m[1]);
        if (next) {
          src = src.replace(/(#define\s+MyAppVersion\s+")[^"]+("?)/, `$1${next}$2`);
          fs.writeFileSync(issPath, src, 'utf8');
          changes.push({ file: issPath, version: changes.find(c => c.file === pkgPath)?.version || next });
        }
      }
    } catch (e) {
      console.warn('[ledger] Failed to bump installer version:', e.message);
    }
  }

  return changes;
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
    if (!msg) {
      console.log('No Complete entries found in dev-ledger.');
      process.exit(0);
    }
    console.log(msg);
    return;
  }

  if (cmd === 'commit') {
    const msg = buildCommitMessage(completeEntries);
    if (!msg) {
      console.log('No Complete entries to commit. Update entry statuses in dev-ledger.');
      process.exit(0);
    }

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
      // Bump versions (package.json, installer setup.iss) and commit
      const changed = bumpVersions();
      if (changed.length > 0) {
        const files = changed.map(c => c.file).map(f => f.replace(/ /g, '" "')).join(' ');
        cp.execSync(`git add ${changed.map(c => c.file).map(f => '"' + f + '"').join(' ')}`, { stdio: 'inherit', shell: true });
        const ver = changed.find(c => c.file.endsWith('package.json'))?.version || changed[0].version;
        cp.execSync(`git commit -m "chore(version): bump to v${ver}"`, { stdio: 'inherit', shell: true });
      }
      // Cleanup tmp/ledger directory if empty
      try {
        const tmpDir = path.join(process.cwd(), '.tmp', 'ledger');
        const files = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
        if (files.length === 0) {
          fs.rmdirSync(tmpDir, { recursive: true });
        }
      } catch {}
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
function ensureTmpDir() {
  const dir = path.join(process.cwd(), '.tmp', 'ledger');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}
