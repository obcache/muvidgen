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
  cancelRender(): Promise<void>;
  openProject(): Promise<{ path: string; project: import('common/project').ProjectSchema } | undefined>;
  updateProjectDirty(dirty: boolean): Promise<void>;
  notifyProjectSaved(ok: boolean): void;
  onProjectRequestSave(listener: () => void): () => void;
  onRenderLog(listener: (line: string) => void): () => void;
  onRenderProgress(listener: (data: { outTimeMs?: number; totalMs?: number }) => void): () => void;
  onRenderDone(listener: () => void): () => void;
  onRenderError(listener: (message: string) => void): () => void;
  onRenderCancelled(listener: () => void): () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
