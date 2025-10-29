import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SessionState } from '../common/session';
import type { ExportSessionRequest } from './preload';

const SESSION_FILENAME = 'session.json';

const getSessionFilePath = () => path.join(app.getPath('userData'), SESSION_FILENAME);

async function ensureUserDataDir(): Promise<void> {
  const directory = app.getPath('userData');
  await fs.mkdir(directory, { recursive: true });
}

ipcMain.handle('session:load', async (): Promise<SessionState | undefined> => {
  const filePath = getSessionFilePath();

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    console.error('[session:load] Failed to read session file:', error);
    throw error;
  }
});

ipcMain.handle('session:save', async (_event, state: SessionState): Promise<void> => {
  await ensureUserDataDir();
  const filePath = getSessionFilePath();

  try {
    const payload = JSON.stringify(state ?? {}, null, 2);
    await fs.writeFile(filePath, payload, 'utf-8');
  } catch (error) {
    console.error('[session:save] Failed to persist session state:', error);
    throw error;
  }
});

ipcMain.handle('session:export', async (_event, request: ExportSessionRequest): Promise<void> => {
  const { targetPath, state } = request;

  if (!targetPath) {
    throw new Error('No export path provided.');
  }

  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const payload = JSON.stringify(state ?? {}, null, 2);
    await fs.writeFile(targetPath, payload, 'utf-8');
  } catch (error) {
    console.error('[session:export] Failed to export session:', error);
    throw error;
  }
});

async function resolveRendererEntryPoint(): Promise<string> {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '..', '..', 'dist', 'index.html'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Renderer bundle not found. Ensure the renderer has been built before starting Electron.',
  );
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // At runtime the preload script is compiled to JavaScript and emitted
      // to the electron output directory as `preload.js`. Point to that file
      // so the BrowserWindow can load the actual compiled script.
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const indexHtml = await resolveRendererEntryPoint();

  try {
    await win.loadFile(indexHtml);
  } catch (error) {
    dialog.showErrorBox('Failed to load renderer', `${error}`);
    throw error;
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
