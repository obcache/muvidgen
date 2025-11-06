import type { SessionState } from './session';
import type { ProjectSchema } from 'common/project';

export interface ExportSessionRequest {
  targetPath: string;
  state: SessionState;
}

export interface ElectronAPI {
  loadSessionState(): Promise<SessionState | undefined>;
  saveSessionState(state: SessionState): Promise<void>;
  exportSession(request: ExportSessionRequest): Promise<void>;
  openAudioFile(): Promise<string | undefined>;
  openVideoFiles(): Promise<string[]>;
  chooseProjectSavePath(defaultPath?: string): Promise<string | undefined>;
  startRender(projectJsonPath: string): Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
