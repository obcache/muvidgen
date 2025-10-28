import { contextBridge, ipcRenderer } from 'electron';
import type { SessionState } from '../common/session';

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
}

const bridge: ElectronBridge = {
  loadSessionState: () => ipcRenderer.invoke('session:load'),
  saveSessionState: (state) => ipcRenderer.invoke('session:save', state),
  exportSession: (request) => ipcRenderer.invoke('session:export', request),
};

contextBridge.exposeInMainWorld('electron', bridge);
