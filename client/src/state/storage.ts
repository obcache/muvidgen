import type { SessionState } from '../types/session';
import type { ExportSessionRequest, ElectronAPI } from '../types/global';

const BRIDGE_MOCK_ENV_FLAGS = [
  'VITE_MUVIDGEN_USE_ELECTRON_BRIDGE_MOCK',
  'MUVIDGEN_USE_ELECTRON_BRIDGE_MOCK',
];

type EnvValue = string | boolean | number | undefined;
type EnvRecord = Record<string, EnvValue>;

const readFromProcessEnv = (flag: string): EnvValue => {
  const withProcess = globalThis as typeof globalThis & {
    process?: {
      env?: EnvRecord;
    };
  };

  return withProcess.process?.env?.[flag];
};

const readFromImportMeta = (flag: string): EnvValue => {
  try {
    if (typeof import.meta !== 'undefined') {
      const metaEnv = (import.meta as { env?: EnvRecord }).env;
      return metaEnv?.[flag];
    }
  } catch (_error) {
    // Accessing import.meta can throw in non-module builds; swallow and continue.
  }

  return undefined;
};

const readFromGlobal = (flag: string): EnvValue => {
  const globalValue = (globalThis as Record<string, unknown>)[flag];

  if (typeof globalValue === 'string' || typeof globalValue === 'boolean' || typeof globalValue === 'number') {
    return globalValue;
  }

  return undefined;
};

const readEnvFlag = (flag: string): EnvValue => {
  const sources: EnvValue[] = [readFromProcessEnv(flag), readFromImportMeta(flag), readFromGlobal(flag)];

  for (const value of sources) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
};

const isTruthyFlagValue = (value: EnvValue): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }

  return false;
};

const isFlagEnabled = (flag: string): boolean => {
  const value = readEnvFlag(flag);
  return isTruthyFlagValue(value);
};

const isDevelopmentRuntime = (() => {
  const processEnvValue = readFromProcessEnv('NODE_ENV');
  if (typeof processEnvValue === 'string') {
    return processEnvValue !== 'production';
  }

  const metaEnv = readFromImportMeta('MODE');
  if (typeof metaEnv === 'string') {
    return metaEnv !== 'production';
  }

  const metaDev = readFromImportMeta('DEV');
  if (typeof metaDev === 'boolean') {
    return metaDev;
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    return hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'http:';
  }

  return false;
})();

const shouldMockBridge = isDevelopmentRuntime && BRIDGE_MOCK_ENV_FLAGS.some(isFlagEnabled);

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
  async openAudioFile() {
    return undefined;
  },
  async openVideoFiles() {
    return [];
  },
  async chooseProjectSavePath() {
    return undefined;
  },
  async startRender() {
    // no-op
  },
};

let hasLoggedMockWarning = false;

const getBridge = (): ElectronAPI => {
  if (typeof window === 'undefined' || !window.electron) {
    if (shouldMockBridge) {
      if (!hasLoggedMockWarning) {
        console.warn(
          'Electron bridge is unavailable; falling back to a mock because the bridge mock flag is enabled.',
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

export const openAudioFile = async (): Promise<string | undefined> => {
  return getBridge().openAudioFile();
};

export const openVideoFiles = async (): Promise<string[]> => {
  return getBridge().openVideoFiles();
};

export const chooseProjectSavePath = async (defaultPath?: string): Promise<string | undefined> => {
  return getBridge().chooseProjectSavePath(defaultPath);
};

export const startRender = async (projectJsonPath: string): Promise<void> => {
  return getBridge().startRender(projectJsonPath);
};
