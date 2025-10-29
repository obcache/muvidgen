import type { SessionState } from './session';

export interface ExportSessionRequest {
  targetPath: string;
  state: SessionState;
}

export interface ElectronAPI {
  loadSessionState(): Promise<SessionState | undefined>;
  saveSessionState(state: SessionState): Promise<void>;
  exportSession(request: ExportSessionRequest): Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
