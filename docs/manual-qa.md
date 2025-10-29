# Manual QA

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
start the dev server in development mode to opt into a safe mock implementation of the Electron bridge APIs. With the
flag enabled, `loadSessionState`, `saveSessionState`, and `exportSession` become no-ops so that UI workflows continue to
function without a preload script. The mock is disabled by default to avoid impacting production Electron builds.
