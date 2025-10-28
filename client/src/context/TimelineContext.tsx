import React, { createContext, useContext, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import type {
  Clip,
  Layer,
  TimelineActions,
  TimelineContextValue,
  TimelineState,
} from '../utils/timelineTypes';

const colors = [
  '#8ecae6',
  '#219ebc',
  '#023047',
  '#ffb703',
  '#fb8500',
  '#8338ec',
  '#ff006e',
];

const defaultLayers: Layer[] = [
  { id: 'layer-video', name: 'Video', height: 96, clips: [] },
  { id: 'layer-audio', name: 'Audio', height: 72, clips: [] },
  { id: 'layer-effects', name: 'Effects', height: 64, clips: [] },
];

const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

const createColor = (() => {
  let index = 0;
  return () => {
    const value = colors[index % colors.length];
    index += 1;
    return value;
  };
})();

export const TimelineProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<TimelineState>(() => ({
    layers: defaultLayers,
    beatMarkers: [],
    selectedClipId: undefined,
    pixelsPerSecond: 120,
  }));

  const actions = useMemo<TimelineActions>(() => ({
    addClip: (clip) => {
      setState((current) => {
        const nextLayers = current.layers.map((layer) =>
          layer.id === clip.layerId
            ? {
                ...layer,
                clips: [...layer.clips, { ...clip, color: clip.color ?? createColor() }],
              }
            : layer,
        );

        const beatMarkers = clip.beatMarkers?.length ? clip.beatMarkers : current.beatMarkers;
        return {
          ...current,
          layers: nextLayers,
          selectedClipId: clip.id,
          beatMarkers,
        };
      });
    },
    updateClip: (clipId, updater) => {
      setState((current) => {
        const nextLayers = current.layers.map((layer) => ({
          ...layer,
          clips: layer.clips.map((clip) => (clip.id === clipId ? updater(clip) : clip)),
        }));

        const selectedClip = nextLayers
          .flatMap((layer) => layer.clips)
          .find((clip) => clip.id === clipId);

        return {
          ...current,
          layers: nextLayers,
          beatMarkers: selectedClip?.beatMarkers?.length
            ? selectedClip.beatMarkers
            : current.beatMarkers,
        };
      });
    },
    removeClip: (clipId) => {
      setState((current) => ({
        ...current,
        layers: current.layers.map((layer) => ({
          ...layer,
          clips: layer.clips.filter((clip) => clip.id !== clipId),
        })),
        selectedClipId: current.selectedClipId === clipId ? undefined : current.selectedClipId,
      }));
    },
    selectClip: (clipId) => {
      setState((current) => ({
        ...current,
        selectedClipId: clipId,
        beatMarkers:
          clipId && current.layers
            .flatMap((layer) => layer.clips)
            .find((clip) => clip.id === clipId)?.beatMarkers?.length
            ? (current.layers
                .flatMap((layer) => layer.clips)
                .find((clip) => clip.id === clipId)?.beatMarkers as number[])
            : current.beatMarkers,
      }));
    },
    setPixelsPerSecond: (value) => {
      setState((current) => ({ ...current, pixelsPerSecond: Math.max(20, Math.min(400, value)) }));
    },
    registerBeatMarkers: (markers, clipId) => {
      setState((current) => ({
        ...current,
        beatMarkers: markers,
        layers: current.layers.map((layer) => ({
          ...layer,
          clips: layer.clips.map((clip) =>
            clip.id === clipId
              ? {
                  ...clip,
                  beatMarkers: markers,
                }
              : clip,
          ),
        })),
      }));
    },
  }), []);

  const value = useMemo<TimelineContextValue>(() => ({
    ...state,
    actions,
  }), [state, actions]);

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
};

export const useTimeline = (): TimelineContextValue => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }

  return context;
};

export const createClipFromFile = (
  file: File,
  layerId: string,
  overrides?: Partial<Clip>,
): Clip => ({
  id: nanoid(),
  label: file.name,
  start: 0,
  duration: Math.max(5, Math.min(60, Math.round(file.size / 100000) || 5)),
  layerId,
  kind: file.type.startsWith('audio') ? 'audio' : file.type.startsWith('video') ? 'video' : 'image',
  file: {
    id: nanoid(),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  },
  color: createColor(),
  ...overrides,
});

export const createEffectClip = (
  label: string,
  layerId: string,
  duration = 4,
  overrides?: Partial<Clip>,
): Clip => ({
  id: nanoid(),
  label,
  start: 0,
  duration,
  layerId,
  kind: 'effect',
  color: createColor(),
  ...overrides,
});
