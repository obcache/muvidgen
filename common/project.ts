export interface ClipSegment {
  path: string;
  index: number;
  start?: number; // seconds
  duration?: number; // seconds
  label?: string;
  color?: string;
}

export interface ProjectSchema {
  version: '1.0';
  audio?: {
    path: string;
    offset?: number; // seconds
  } | null;
  playhead?: number; // seconds
  clips: ClipSegment[];
  output?: {
    path: string;
  };
  metadata?: Record<string, unknown>;
}

export const isProjectSchema = (value: unknown): value is ProjectSchema => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ProjectSchema>;
  if (v.version !== '1.0') return false;
  if (!Array.isArray(v.clips)) return false;
  return true;
};

