# Manual QA

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
  - Expect: `client/node_modules` is repopulated (root `postinstall` runs `npm --prefix client ci || install`)

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

## Electron session persistence (nodeIntegration disabled)

1. Launch the Electron application with `npm run electron`.
2. Confirm the developer tools show `nodeIntegration: false` for the renderer process.
3. Enter some text into the "Session Notes" textarea.
4. Click **Save Session** and confirm the status message switches to "Session saved.".
5. Quit and relaunch the app; the previously saved notes should load automatically, confirming `loadSessionState` works through the preload bridge.
6. Click **Export Session** and provide an absolute path (e.g., `/tmp/muvidgen-session.json`).
7. Verify the export file exists and contains the JSON session payload.

## Browser UI previews / Storybook

The renderer can run outside of Electron (for example Storybook or static UI previews). Set the environment flag
`VITE_MUVIDGEN_USE_ELECTRON_BRIDGE_MOCK=true` (or `MUVIDGEN_USE_ELECTRON_BRIDGE_MOCK=true` when booting through Node) and
start the dev server in development mode to opt into a safe mock implementation of the Electron bridge APIs. For setups
without a Node runner you can declare `window.MUVIDGEN_USE_ELECTRON_BRIDGE_MOCK = true` (or the Vite-prefixed variant) in a
bootstrap script before the bundle loads. With the flag enabled, `loadSessionState`, `saveSessionState`, and
`exportSession` become no-ops so that UI workflows continue to function without a preload script. The mock is disabled by
default to avoid impacting production Electron builds.
