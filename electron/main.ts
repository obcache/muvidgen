import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SessionState } from '../common/session';
import type { ExportSessionRequest } from './preload';
import { isProjectSchema } from '../common/project';
import { spawn } from 'node:child_process';

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

ipcMain.handle('render:cancel', async (): Promise<void> => {
  const child = currentRenderChild;
  if (!child) return;
  try {
    child.kill('SIGINT');
    setTimeout(() => {
      if (!child.killed) {
        try {
          if (process.platform === 'win32') {
            const { spawn: sysSpawn } = require('node:child_process');
            sysSpawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
      }
    }, 750);
  } catch {}
  currentRenderChild = null;
  mainWindow?.webContents.send('render:cancelled');
});

ipcMain.handle('audio:open', async (): Promise<string | undefined> => {
  const result = await dialog.showOpenDialog({
    title: 'Select audio file',
    properties: ['openFile'],
    filters: [
      { name: 'Audio', extensions: ['wav', 'mp3', 'aac', 'flac', 'ogg', 'm4a'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return undefined;
  return result.filePaths[0];
});

ipcMain.handle('videos:open', async (): Promise<string[]> => {
  const result = await dialog.showOpenDialog({
    title: 'Select video files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  return result.filePaths;
});

ipcMain.handle('project:saveAs', async (_event, defaultPath?: string): Promise<string | undefined> => {
  const result = await dialog.showSaveDialog({
    title: 'Save project as JSON',
    defaultPath,
    filters: [{ name: 'Project JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return undefined;
  // ensure folder exists
  await fs.mkdir(path.dirname(result.filePath), { recursive: true });
  return result.filePath;
});

ipcMain.handle('project:open', async (): Promise<{ path: string; project: unknown } | undefined> => {
  const result = await dialog.showOpenDialog({
    title: 'Open project JSON',
    properties: ['openFile'],
    filters: [{ name: 'Project JSON', extensions: ['json'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return undefined;
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('Selected file is not valid JSON.');
  }
  // Basic shape validation; renderer can further validate
  if (!isProjectSchema(parsed)) {
    throw new Error('Selected file is not a valid MuvidGen project JSON.');
  }
  return { path: filePath, project: parsed };
});

ipcMain.handle('project:updateDirty', async (_event, dirty: boolean): Promise<void> => {
  projectDirty = !!dirty;
});

ipcMain.handle('render:start', async (_event, projectJsonPath: string): Promise<void> => {
  if (currentRenderChild) {
    throw new Error('A render is already in progress.');
  }
  if (!projectJsonPath || typeof projectJsonPath !== 'string') {
    throw new Error('Invalid project JSON path.');
  }
  try {
    await fs.access(projectJsonPath);
  } catch {
    throw new Error('Project JSON file does not exist.');
  }

  const rendererOverride = process.env.MUVIDGEN_RENDERER; // path to exe or script
  const pythonOverride = process.env.MUVIDGEN_PYTHON || 'python';

  // Resolve default renderer script location in dev
  const candidates = [
    // packaged binary inside Electron asar/resources
    path.join(process.resourcesPath, 'renderer', process.platform === 'win32' ? 'muvidgen-renderer.exe' : 'muvidgen-renderer'),
    // when running from TS outDir (dist-electron/electron), go up to repo root
    path.join(__dirname, '..', '..', 'renderer', 'python', 'main.py'),
    // alternate relative
    path.join(process.cwd(), 'renderer', 'python', 'main.py'),
  ];

  const rendererPath = rendererOverride ?? (await (async () => {
    for (const c of candidates) {
      try { await fs.access(c); return c; } catch {}
    }
    return undefined;
  })());

  if (!rendererPath) {
    throw new Error('Renderer script not found. Set MUVIDGEN_RENDERER to the Python script or packaged renderer.');
  }

  const isPy = rendererPath.toLowerCase().endsWith('.py');
  const cmd = isPy ? pythonOverride : rendererPath;
  const args = isPy ? [rendererPath, projectJsonPath] : [projectJsonPath];
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  // Prefer redist folder inside Electron resources for ffmpeg/ffprobe
  const redistDir = path.join(process.resourcesPath, 'redist');
  const ffName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const fpName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const redistFfmpeg = path.join(redistDir, ffName);
  const redistFfprobe = path.join(redistDir, fpName);
  if (!childEnv.MUVIDGEN_FFMPEG) childEnv.MUVIDGEN_FFMPEG = redistFfmpeg;
  if (!childEnv.MUVIDGEN_FFPROBE) childEnv.MUVIDGEN_FFPROBE = redistFfprobe;
  // If running a standalone packaged renderer binary, also try sibling fallback
  if (!isPy) {
    const base = path.dirname(rendererPath);
    if (!childEnv.MUVIDGEN_FFMPEG) childEnv.MUVIDGEN_FFMPEG = path.join(base, ffName);
    if (!childEnv.MUVIDGEN_FFPROBE) childEnv.MUVIDGEN_FFPROBE = path.join(base, fpName);
  }

  return await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'pipe', env: childEnv });
    currentRenderChild = child;
    let stdoutBuf = '';
    let stderrBuf = '';
    let totalMs = 0;
    const flushLines = (buf: string, isErr: boolean) => {
      const lines = buf.split(/\r?\n/);
      // Keep last partial if not ending with newline
      const complete = lines.slice(0, lines[lines.length - 1] === '' ? lines.length - 1 : lines.length - 1);
      const remainder = lines[lines.length - 1] ?? '';
      for (const line of complete) {
        const msg = line.trimEnd();
        if (!msg) continue;
        if (isErr) {
          console.error(`[renderer] ${msg}`);
        } else {
          console.log(`[renderer] ${msg}`);
        }
        // Emit log event to renderer
        mainWindow?.webContents.send('render:log', msg);
        // Very basic progress parsing
        const mOut = msg.match(/^out_time_ms=(\d+)/);
        if (mOut) {
          const ms = Number(mOut[1]);
          if (Number.isFinite(ms)) {
            mainWindow?.webContents.send('render:progress', { outTimeMs: ms, totalMs });
          }
        }
        const mTot = msg.match(/^total_duration_ms=(\d+)/);
        if (mTot) {
          const t = Number(mTot[1]);
          if (Number.isFinite(t)) {
            totalMs = t;
            mainWindow?.webContents.send('render:progress', { totalMs });
          }
        }
      }
      return remainder;
    };
    child.stdout.on('data', (d) => {
      stdoutBuf += String(d);
      stdoutBuf = flushLines(stdoutBuf, false);
    });
    child.stderr.on('data', (d) => {
      stderrBuf += String(d);
      stderrBuf = flushLines(stderrBuf, true);
    });
    child.on('error', (err) => { currentRenderChild = null; reject(err); });
    child.on('close', (code) => {
      currentRenderChild = null;
      if (code === 0) {
        mainWindow?.webContents.send('render:done');
        resolve();
      } else {
        const err = new Error(`Renderer exited with code ${code}`);
        mainWindow?.webContents.send('render:error', String(err));
        reject(err);
      }
    });
  });
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

let mainWindow: BrowserWindow | null = null;
let currentRenderChild: import('node:child_process').ChildProcess | null = null;
let projectDirty: boolean = false;

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

  mainWindow = win;
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

app.on('browser-window-created', (_event, window) => {
  window.on('closed', () => {
    if (window === mainWindow) mainWindow = null;
  });
});

// Intercept window close to prompt save for dirty projects
app.on('browser-window-created', (_event, window) => {
  window.on('close', async (e) => {
    // First, if a render is in progress, prompt to stop or cancel exit
    if (currentRenderChild) {
      e.preventDefault();
      const res = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Stop Render', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Render In Progress',
        message: 'A render is currently in progress. Do you want to stop it before exiting? ',
        noLink: true,
      });
      if (res.response === 1) {
        // Cancel exit
        return;
      }
      // Stop render and then continue to dirty-check flow
      try {
        const child = currentRenderChild;
        if (child) {
          child.kill('SIGINT');
          setTimeout(() => {
            if (!child.killed) {
              try {
                if (process.platform === 'win32') {
                  const { spawn: sysSpawn } = require('node:child_process');
                  sysSpawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
                } else {
                  child.kill('SIGKILL');
                }
              } catch {}
            }
          }, 750);
        }
      } catch {}
      // Fall through to dirty prompt below after attempting to stop
    }

    if (!projectDirty) return;
    e.preventDefault();
    const res = await dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Changes',
      message: 'You have unsaved project changes. Save before exiting?',
      noLink: true,
    });
    if (res.response === 1) {
      // Discard
      projectDirty = false;
      window.destroy();
      return;
    }
    if (res.response === 2) {
      // Cancel
      return;
    }
    // Save
    try {
      const once = (evt: string) => new Promise<boolean>((resolve) => {
        const handler = (_event: Electron.IpcMainEvent, ok: boolean) => {
          ipcMain.removeListener('project:saved', handler);
          resolve(!!ok);
        };
        ipcMain.on('project:saved', handler);
      });
      window.webContents.send('project:requestSave');
      const ok = await once('project:saved');
      if (ok) {
        projectDirty = false;
        window.destroy();
      }
    } catch {
      // swallow and keep window open
    }
  });
});
