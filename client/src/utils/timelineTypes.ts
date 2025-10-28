export type MediaKind = 'video' | 'audio' | 'image' | 'effect';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  /** Data URL preview for quick thumbnails when available. */
  previewUrl?: string;
}

export interface Clip {
  id: string;
  label: string;
  start: number;
  duration: number;
  layerId: string;
  kind: MediaKind;
  file?: FileMetadata;
  color?: string;
  beatMarkers?: number[];
}

export interface Layer {
  id: string;
  name: string;
  height: number;
  clips: Clip[];
}

export interface TimelineState {
  layers: Layer[];
  beatMarkers: number[];
  selectedClipId?: string;
  pixelsPerSecond: number;
}

export interface TimelineActions {
  addClip(clip: Clip): void;
  updateClip(clipId: string, updater: (clip: Clip) => Clip): void;
  removeClip(clipId: string): void;
  selectClip(clipId?: string): void;
  setPixelsPerSecond(value: number): void;
  registerBeatMarkers(markers: number[], clipId?: string): void;
}

export interface TimelineContextValue extends TimelineState {
  actions: TimelineActions;
}
