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
}

const bridge: ElectronBridge = {
  loadSessionState: () => ipcRenderer.invoke('session:load'),
  saveSessionState: (state) => ipcRenderer.invoke('session:save', state),
  exportSession: (request) => ipcRenderer.invoke('session:export', request),
  openAudioFile: () => ipcRenderer.invoke('audio:open'),
  openVideoFiles: () => ipcRenderer.invoke('videos:open'),
  chooseProjectSavePath: (defaultPath?: string) => ipcRenderer.invoke('project:saveAs', defaultPath),
  startRender: (projectJsonPath: string) => ipcRenderer.invoke('render:start', projectJsonPath),
};

contextBridge.exposeInMainWorld('electron', bridge);
