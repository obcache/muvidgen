import type { SessionState } from '../types/session';
import type { ExportSessionRequest, ElectronAPI } from '../types/global';

const BRIDGE_MOCK_ENV_FLAG = 'MUVIDGEN_USE_ELECTRON_BRIDGE_MOCK';

type EnvRecord = Record<string, string | boolean | undefined>;

const readEnvFlag = (flag: string): string | boolean | undefined => {
  const withProcess = globalThis as typeof globalThis & {
    process?: {
      env?: EnvRecord;
    };
  };

  const processEnv = withProcess.process?.env;

  if (processEnv && flag in processEnv) {
    return processEnv[flag];
  }

  if (typeof import.meta !== 'undefined') {
    const metaEnv = (import.meta as { env?: EnvRecord }).env;
    if (metaEnv && flag in metaEnv) {
      return metaEnv[flag];
    }
  }

  return undefined;
};

const shouldMockBridge = (() => {
  const value = readEnvFlag(BRIDGE_MOCK_ENV_FLAG);
  return value === 'true' || value === true;
})();

const mockBridge: ElectronAPI = {
  async loadSessionState() {
    return undefined;
  },
  async saveSessionState() {
    // no-op
  },
  async exportSession() {
    // no-op
  },
};

let hasLoggedMockWarning = false;

const getBridge = (): ElectronAPI => {
  if (typeof window === 'undefined' || !window.electron) {
    if (shouldMockBridge) {
      if (!hasLoggedMockWarning) {
        console.warn(
          `Electron bridge is unavailable; falling back to a mock because ${BRIDGE_MOCK_ENV_FLAG} is enabled.`,
        );
        hasLoggedMockWarning = true;
      }

      return mockBridge;
    }

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
