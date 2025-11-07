import { contextBridge, ipcRenderer } from 'electron';
import type { SessionState } from '../common/session';
import type { ProjectSchema } from '../common/project';

export interface ExportSessionRequest {
  /**
   * Absolute file path where the exported session should be written.
   */
  targetPath: string;
  /**
   * Session payload that will be persisted to the export file.
   */
  state: SessionState;
}

export interface ElectronBridge {
  loadSessionState: () => Promise<SessionState | undefined>;
  saveSessionState: (state: SessionState) => Promise<void>;
  exportSession: (request: ExportSessionRequest) => Promise<void>;
  openAudioFile: () => Promise<string | undefined>;
  openVideoFiles: () => Promise<string[]>;
  chooseProjectSavePath: (defaultPath?: string) => Promise<string | undefined>;
  startRender: (projectJsonPath: string) => Promise<void>;
  cancelRender: () => Promise<void>;
  openProject: () => Promise<{ path: string; project: ProjectSchema } | undefined>;
  updateProjectDirty: (dirty: boolean) => Promise<void>;
  notifyProjectSaved: (ok: boolean) => void;
  onProjectRequestSave: (listener: () => void) => () => void;
  onRenderLog: (listener: (line: string) => void) => () => void;
  onRenderProgress: (listener: (data: { outTimeMs?: number; totalMs?: number }) => void) => () => void;
  onRenderDone: (listener: () => void) => () => void;
  onRenderError: (listener: (message: string) => void) => () => void;
  onRenderCancelled: (listener: () => void) => () => void;
}

const bridge: ElectronBridge = {
  loadSessionState: () => ipcRenderer.invoke('session:load'),
  saveSessionState: (state) => ipcRenderer.invoke('session:save', state),
  exportSession: (request) => ipcRenderer.invoke('session:export', request),
  openAudioFile: () => ipcRenderer.invoke('audio:open'),
  openVideoFiles: () => ipcRenderer.invoke('videos:open'),
  chooseProjectSavePath: (defaultPath?: string) => ipcRenderer.invoke('project:saveAs', defaultPath),
  startRender: (projectJsonPath: string) => ipcRenderer.invoke('render:start', projectJsonPath),
  cancelRender: () => ipcRenderer.invoke('render:cancel'),
  openProject: () => ipcRenderer.invoke('project:open'),
  updateProjectDirty: (dirty: boolean) => ipcRenderer.invoke('project:updateDirty', dirty),
  notifyProjectSaved: (ok: boolean) => { ipcRenderer.send('project:saved', ok); },
  onProjectRequestSave: (listener) => {
    const channel = 'project:requestSave';
    const handler = () => listener();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onRenderLog: (listener) => {
    const channel = 'render:log';
    const handler = (_e: Electron.IpcRendererEvent, line: string) => listener(line);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onRenderProgress: (listener) => {
    const channel = 'render:progress';
    const handler = (_e: Electron.IpcRendererEvent, data: { outTimeMs?: number; totalMs?: number }) => listener(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onRenderDone: (listener) => {
    const channel = 'render:done';
    const handler = () => listener();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onRenderError: (listener) => {
    const channel = 'render:error';
    const handler = (_e: Electron.IpcRendererEvent, message: string) => listener(message);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onRenderCancelled: (listener) => {
    const channel = 'render:cancelled';
    const handler = () => listener();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('electron', bridge);
