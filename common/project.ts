export interface ClipSegment {
  path: string;
  index: number;
  start?: number; // seconds
  duration?: number; // seconds
  label?: string;
  color?: string;
}

export type LayerType = 'spectrograph' | 'text';

export interface LayerConfigBase {
  id: string;
  type: LayerType;
  color: string;
  x: number; // 0..1 relative position
  y: number; // 0..1 relative position
  width?: number; // pixels
  height?: number; // pixels
  rotate?: number; // degrees
  opacity?: number; // 0..1
}

export interface SpectrographLayer extends LayerConfigBase {
  type: 'spectrograph';
  mode: 'bar' | 'line' | 'solid' | 'dots';
  invert?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  glowColor?: string;
  glowAmount?: number;
  glowOpacity?: number;
  shadowColor?: string;
  shadowDistance?: number;
  lowCutHz?: number;
  highCutHz?: number;
}

export interface TextLayer extends LayerConfigBase {
  type: 'text';
  text: string;
  font: string;
  fontSize: number;
  outlineColor?: string;
  outlineWidth?: number;
  glowColor?: string;
  glowAmount?: number;
  glowOpacity?: number;
  shadowColor?: string;
  shadowDistance?: number;
}

export type LayerConfig = SpectrographLayer | TextLayer;

export interface MediaLibraryItem {
  id: string;
  name: string;
  description?: string;
  path: string;
  duration?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  width?: number;
  height?: number;
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
  layers?: LayerConfig[];
  metadata?: Record<string, unknown>;
}

export const isProjectSchema = (value: unknown): value is ProjectSchema => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ProjectSchema>;
  if (v.version !== '1.0') return false;
  if (!Array.isArray(v.clips)) return false;
  return true;
};
