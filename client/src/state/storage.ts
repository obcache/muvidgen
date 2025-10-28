import type { SessionState } from '../types/session';
import type { ExportSessionRequest, ElectronAPI } from '../types/global';

const getBridge = (): ElectronAPI => {
  if (typeof window === 'undefined' || !window.electron) {
    throw new Error('Electron bridge is unavailable.');
  }

  return window.electron;
};

export const loadSessionState = async (): Promise<SessionState | undefined> => {
  return getBridge().loadSessionState();
};

export const saveSessionState = async (state: SessionState): Promise<void> => {
  await getBridge().saveSessionState(state);
};

export const exportSession = async (request: ExportSessionRequest): Promise<void> => {
  await getBridge().exportSession(request);
};
