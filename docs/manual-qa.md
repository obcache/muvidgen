# Manual QA

## Electron session persistence (nodeIntegration disabled)

1. Launch the Electron application with `npm run electron`.
2. Confirm the developer tools show `nodeIntegration: false` for the renderer process.
3. Enter some text into the "Session Notes" textarea.
4. Click **Save Session** and confirm the status message switches to "Session saved.".
5. Quit and relaunch the app; the previously saved notes should load automatically, confirming `loadSessionState` works through the preload bridge.
6. Click **Export Session** and provide an absolute path (e.g., `/tmp/muvidgen-session.json`).
7. Verify the export file exists and contains the JSON session payload.
