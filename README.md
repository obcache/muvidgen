# Muvidgen Desktop UI

This repository contains the Electron shell and React renderer for the Muvidgen desktop application. The project now exposes a root `package.json` so you can install the required dependencies and run the user interface locally.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [npm](https://www.npmjs.com/) 9 or newer (bundled with recent Node.js releases)

Install dependencies once you have Node.js available:

```bash
npm install
```

## Available commands

All commands are defined in the root `package.json` file.

### `npm run dev`

Runs a one-off development cycle that builds the React renderer, transpiles the Electron process TypeScript, and then starts the Electron application against the freshly generated assets.

### `npm run build`

Builds the renderer bundle with Vite and transpiles the Electron code with `tsc`. The compiled assets are written to the `dist/` directory (`dist/index.html` for the renderer and `dist/electron` for the main and preload scripts).

### `npm run electron`

Launches the Electron shell by pointing at the compiled sources in `dist/electron`. This command assumes you have already executed `npm run build` or `npm run dev` so the build artifacts exist.

## Project structure

- `client/` – React renderer source code and Vite configuration.
- `electron/` – Electron main and preload processes written in TypeScript.
- `dist/` – Generated output created by the build scripts (ignored by git).

## Running the UI locally

1. Install dependencies with `npm install`.
2. Build and launch the desktop app in one step with `npm run dev`, or
3. Build everything (`npm run build`) and then open the app with `npm run electron`.

These commands mirror the scripts referenced throughout the documentation and should be the primary way you interact with the Muvidgen desktop UI during development.
