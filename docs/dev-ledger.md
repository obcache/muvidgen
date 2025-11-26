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

```
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
```

## Remediation Tasks

- [ ] Add Node types to root devDependencies
  - Command: `npm i -D @types/node@^18` (or `@^20` to match your Node LTS)
  - Verify: `npx tsc -p tsconfig.electron.json`
  - Rationale: `tsconfig.base.json`, `tsconfig.json`, and `tsconfig.electron.json` include `types: ["node"]`.

- [ ] (Optional) Add Node types to client devDependencies
  - Command: `cd client && npm i -D @types/node@^18`
  - Verify: `cd client && npx tsc -p tsconfig.json`
  - Rationale: Client extends the base tsconfig which includes Node types; adding locally ensures isolation if `client/` is installed independently.

- [ ] Verify postinstall installs client dependencies automatically
  - Clean: remove `client/node_modules` (e.g., `rimraf client/node_modules`)
  - Run: `npm install` at repo root
  - Expect: `client/node_modules` is repopulated (root `postinstall` runs `npm --prefix client ci || install`).

- [ ] Align root Vite configuration usage (pick one)
  - Option A (recommended): Remove or archive unused root `vite.config.ts` to avoid confusion; Vite runs from `client/`.
  - Option B: Keep root Vite config and install root devDeps: `npm i -D vite @vitejs/plugin-react`.
  - Verify: No editor/CI warnings about missing Vite packages at root.

- [ ] Validate Node and npm versions
  - `node -v` should be >= 18 (or 20.x).
  - `npm -v` should be >= 9.
  - Adjust local tooling if versions are out of range.

- [ ] Sanity-check TypeScript builds
  - Root Electron: `npx tsc -p tsconfig.electron.json`
  - Client: `cd client && npx tsc -p tsconfig.json`

- [ ] Confirm dev server ports are available (optional)
  - Vite dev: 5173; Vite preview: 4173
  - Windows: `netstat -ano | findstr :5173` and `:4173`

- [ ] Update README to reflect changes (optional)
  - Note that `npm install` at root now installs `client/` deps via `postinstall`.
  - Mention the Electron bridge mock flags for browser-only UI.

## Entries

Add active entries here. Entries marked `Status: Complete` will be used to auto-generate commit messages and, upon commit, will be moved to the Changelog section with the commit hash.

### [2025-11-03] Project Plan: Media Shuttle UI, Storyboard, and Python Renderer (Status: Planned)
Author: dev

Summary
- Define scope and phased plan to implement audio waveform transport controls, storyboard with drag-and-drop sequencing, JSON export, and a Python/ffmpeg renderer, plus packaging with pyInstaller and Inno Setup.

Impact
- Modules: client (React UI), electron (main/preload IPC), common (types/schema), tools/python (renderer), packaging (pyInstaller/Inno Setup)
- Risk level: Medium (cross-process integration, packaging complexity)

Commands/Steps
- Design `ProjectSchema` in `common/` and add type guards.
- Add IPC: `audio:open`, `videos:open`, `project:saveAs`, `render:start` in main; expose via preload bridge.
- Implement UI: audio browse + waveform (play/pause/seek), video browse + storyboard (DnD, labels, tooltips).
- Export JSON via Save-As; wire Render to spawn Python renderer with project JSON.
- Build Python CLI to compose MP4 via ffmpeg; package with pyInstaller (bundle ffmpeg).
- Package Electron app and author Inno Setup script for one-click install/launch.

Artifacts
- New/updated files (anticipated):
  - `common/project.ts` (schema/types)
  - `electron/main.ts`, `electron/preload.ts` (IPC)
  - `client/src/components/Waveform.tsx`, `client/src/components/Storyboard.tsx`
  - `client/src/state/project.ts`, `client/src/utils/json.ts`
  - `renderer/python/main.py`, `renderer/python/pyinstaller.spec`
  - `installer/windows/setup.iss`

Follow-ups
- [ ] Define `ProjectSchema` (audio path, playhead, clips [{path,index,start,duration}], output path)
- [ ] Extend preload + main IPC for file dialogs and render control
- [ ] Add audio/video browse UI; persist selections in session
- [ ] Integrate waveform lib; implement play/pause/seek
- [ ] Implement storyboard with DnD (color-coded segments, labels, tooltips)
- [ ] Implement Save-As to write project JSON
- [ ] Implement Python renderer CLI (consume JSON, call ffmpeg)
- [ ] Wire Render button to spawn packaged Python exe and stream logs
- [ ] Package Python with pyInstaller (ship ffmpeg)
- [ ] Package Electron app and build Inno Setup installer
- [ ] Expand manual QA for end-to-end flow

Rollback Strategy
- Keep new IPC and UI behind additive changes; revert by removing new components and IPC handlers.
- Python renderer remains isolated under `renderer/python/`; removal does not impact Electron UI.
- Packaging additions (pyInstaller/Inno) can be disabled without affecting dev builds.

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

### [2025-11-03] Add postinstall hook for client deps (Commit: 95c30cc)
Author: dev

Summary
- Add root `postinstall` to automatically install `client/` dependencies after `npm install` at repo root.

Impact
- Modules: package scripts
- Risk level: Low

Commands/Steps
- Update `package.json` scripts with: `"postinstall": "npm --prefix client ci || npm --prefix client install"`.

Artifacts
- Files touched: package.json

Follow-ups
- [ ] Note in README that client deps are installed via postinstall.

Rollback Strategy
- Remove the `postinstall` script from `package.json`.

### [2025-11-03] Add seed-dev-workflow.ps1 seeding script (Commit: 95c30cc)
Author: dev

Summary
- Add PowerShell seeding script to bootstrap dev-ledger, manual QA reference, ledger tooling, and npm scripts across new repos.

Impact
- Modules: docs, tooling, package scripts
- Risk level: Low

Commands/Steps
- Create `seed-dev-workflow.ps1` in repo root.
- Ensure `docs/dev-ledger.md` (journal + changelog) exists.
- Ensure `docs/manual-qa.md` references the ledger.
- Add `tools/ledger.js` orchestration tool.
- Add npm scripts: `ledger:message`, `ledger:dry`, `ledger:commit`.

Artifacts
- Files touched/added: seed-dev-workflow.ps1; docs/dev-ledger.md; docs/manual-qa.md; tools/ledger.js; package.json (scripts).

Follow-ups
- [ ] Optional: add Bash variant `seed-dev-workflow.sh` for non-Windows environments.
- [ ] Document seeding workflow in README.

Rollback Strategy
- Delete `seed-dev-workflow.ps1` and `tools/ledger.js`.
- Remove ledger scripts from `package.json`.
- Revert `docs/manual-qa.md` reference if undesired.

Example (remove after first use):

### [2025-11-03] Renderer Pipeline + Progress + Cancel (Commit: e740c93)
Author: dev

Summary
- Implement Python renderer MVP using ffmpeg (concat videos, optional audio mux), add progress via -progress, total duration via ffprobe, and UI progress bar + log console with Cancel support.

Impact
- Modules: renderer/python, electron IPC (render:start, render:cancel, render:* events), client UI
- Risk level: Medium (process management, platform differences)

Commands/Steps
- Add `renderer/python/main.py` with concat + mux pipeline; print total_duration_ms.
- Electron forwards stdout to `render:log` and parses `out_time_ms` and total.
- Client subscribes to events, renders progress bar/ETA, and can cancel.

Follow-ups
- [ ] Add percent-complete to UI based on out_time_ms / total
- [ ] Add ffprobe bundling/override in packaged app

Rollback Strategy
- Revert IPC additions and remove renderer integration; UI falls back to stub.

### [2025-11-03] Project Load/Save + Dirty-Tracking + Exit Prompts (Commit: e740c93)
Author: dev

Summary
- Add Load/Save/Save As controls for project JSON, track unsaved changes, and prompt on exit to save or discard. When a render is in progress, prompt to stop render or cancel exit.

Impact
- Modules: electron (project:open, project:updateDirty, close handler), preload, client App
- Risk level: Medium (window lifecycle, race conditions)

Commands/Steps
- Add `project:open` (with schema validation) and `project:updateDirty` handlers.
- On close: if rendering, prompt Stop Render/Cancel; then if dirty, prompt Save/Discard/Cancel.
- Renderer handles `project:requestSave` and responds with `project:saved`.

Follow-ups
- [ ] Persist recent projects list and show in UI
- [ ] Add auto-save interval (opt-in)
- [ ] Add Save Project keyboard shortcut (Ctrl+S)

Rollback Strategy
- Remove dirty/close hooks; UI Load/Save continues to function manually.

### [2025-11-03] Version bump test (Commit: aa8d9d1)
Author: dev

Summary
- Minimal entry to verify automated patch version bump and installer version sync in the ledger commit workflow.

## Rollback Task Template

Use this when a major move may need reversing. Keep it near the entry that introduced the change.

```
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
```
