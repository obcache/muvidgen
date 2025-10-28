import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { TimelineLayer } from './TimelineLayer';
import { useTimeline, createClipFromFile, createEffectClip } from '../context/TimelineContext';
import { useFileDialogs } from './hooks/useFileDialogs';
import type { Clip } from '../utils/timelineTypes';
import { clamp, roundToFrame } from '../utils/timelineMath';

type InteractionMode = 'move' | 'resize:start' | 'resize:end';

interface InteractionState {
  clip: Clip;
  mode: InteractionMode;
  originClientX: number;
  initialStart: number;
  initialDuration: number;
  pointerId: number;
}

const MIN_DURATION = 0.25;

const buildAudioBeatMarkers = (duration: number, bpm = 120): number[] => {
  const beatInterval = 60 / bpm;
  const markers: number[] = [];
  for (let beat = 0; beat <= duration; beat += beatInterval) {
    markers.push(parseFloat(beat.toFixed(3)));
  }
  return markers;
};

export const TimelinePanel: React.FC = () => {
  const containerRef = useRef<SVGSVGElement>(null);
  const { layers, pixelsPerSecond, actions } = useTimeline();
  const { openMediaDialog, openEffectDialog, DialogRoot } = useFileDialogs();
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  const totalDuration = useMemo(() => {
    const maxEnd = layers
      .flatMap((layer) => layer.clips)
      .reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
    return Math.max(30, maxEnd + 10);
  }, [layers]);

  const totalHeight = useMemo(
    () =>
      layers.reduce((sum, layer) => sum + layer.height, 0) + layers.length * 24 + 48,
    [layers],
  );

  const gridLines = useMemo(() => {
    const seconds = Math.ceil(totalDuration);
    return new Array(seconds + 1).fill(null).map((_, index) => index);
  }, [totalDuration]);

  const onStartInteraction = useCallback(
    (clip: Clip, mode: InteractionMode, event: React.PointerEvent<SVGRectElement>) => {
      if (!containerRef.current) return;
      const svg = event.currentTarget.ownerSVGElement;
      svg?.setPointerCapture?.(event.pointerId);
      setInteraction({
        clip,
        mode,
        originClientX: event.clientX,
        initialStart: clip.start,
        initialDuration: clip.duration,
        pointerId: event.pointerId,
      });
      actions.selectClip(clip.id);
    },
    [actions],
  );

  useEffect(() => {
    if (!interaction) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) return;
      const deltaPx = event.clientX - interaction.originClientX;
      const deltaSeconds = deltaPx / pixelsPerSecond;
      const applyUpdate = (updater: (clip: Clip) => Clip) => {
        actions.updateClip(interaction.clip.id, updater);
      };

      switch (interaction.mode) {
        case 'move': {
          applyUpdate((clip) => ({
            ...clip,
            start: clamp(roundToFrame(interaction.initialStart + deltaSeconds), 0, totalDuration),
          }));
          break;
        }
        case 'resize:start': {
          applyUpdate((clip) => {
            const nextStart = clamp(
              roundToFrame(interaction.initialStart + deltaSeconds),
              0,
              interaction.initialStart + interaction.initialDuration - MIN_DURATION,
            );
            const delta = interaction.initialStart - nextStart;
            return {
              ...clip,
              start: nextStart,
              duration: Math.max(MIN_DURATION, roundToFrame(interaction.initialDuration + delta)),
            };
          });
          break;
        }
        case 'resize:end': {
          applyUpdate((clip) => ({
            ...clip,
            duration: Math.max(
              MIN_DURATION,
              roundToFrame(interaction.initialDuration + deltaSeconds),
            ),
          }));
          break;
        }
        default:
          break;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) return;
      setInteraction(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interaction, pixelsPerSecond, actions, totalDuration]);

  const handleAddMedia = useCallback(() => {
    openMediaDialog((files) => {
      if (!files || !files.length) return;
      Array.from(files).forEach((file) => {
        const targetLayer = file.type.startsWith('audio')
          ? layers.find((layer) => layer.id === 'layer-audio')
          : layers.find((layer) => layer.id === 'layer-video') ?? layers[0];
        const clip = createClipFromFile(file, targetLayer.id);
        if (clip.kind === 'audio') {
          clip.beatMarkers = buildAudioBeatMarkers(clip.duration);
        }
        actions.addClip(clip);
      });
    });
  }, [actions, layers, openMediaDialog]);

  const handleAddEffect = useCallback(() => {
    openEffectDialog(async (files) => {
      if (!files || !files.length) return;
      const [file] = Array.from(files);
      let metadataLabel = file.name.replace(/\.[^.]+$/, '');
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed?.name) {
          metadataLabel = parsed.name;
        }
      } catch (error) {
        console.warn('Failed to parse effect metadata, using filename.', error);
      }
      const layer = layers.find((layer) => layer.id === 'layer-effects') ?? layers[layers.length - 1];
      const clip = createEffectClip(metadataLabel, layer.id, 4, {
        file: {
          id: nanoid(),
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },
      });
      actions.addClip(clip);
    });
  }, [actions, layers, openEffectDialog]);

  return (
    <section className="timeline-panel">
      <header className="timeline-panel__header">
        <h2>Timeline</h2>
        <div className="timeline-panel__controls">
          <button type="button" onClick={handleAddMedia} className="timeline-panel__button">
            Add Media
          </button>
          <button type="button" onClick={handleAddEffect} className="timeline-panel__button">
            Add Effect
          </button>
          <label className="timeline-panel__zoom">
            Zoom
            <input
              type="range"
              min={40}
              max={320}
              step={10}
              value={pixelsPerSecond}
              onChange={(event) => actions.setPixelsPerSecond(Number(event.target.value))}
            />
          </label>
        </div>
      </header>
      <div className="timeline-panel__body">
        <svg
          ref={containerRef}
          className="timeline-panel__svg"
          width={totalDuration * pixelsPerSecond}
          height={totalHeight}
        >
          <g className="timeline-panel__grid">
            {gridLines.map((second) => (
              <g key={second} transform={`translate(${second * pixelsPerSecond}, 0)`}>
                <line
                  y1={0}
                  y2={totalHeight}
                  stroke={second % 5 === 0 ? '#475569' : '#1f2937'}
                  strokeWidth={1}
                />
                <text x={4} y={16} fill="#94a3b8" fontSize={12}>
                  {second}s
                </text>
              </g>
            ))}
          </g>
          <g transform="translate(0, 48)">
            {(() => {
              let offset = 0;
              return layers.map((layer) => {
                const element = (
                  <TimelineLayer
                    key={layer.id}
                    layer={layer}
                    offsetY={offset}
                    pixelsPerSecond={pixelsPerSecond}
                    totalDuration={totalDuration}
                    onStartInteraction={onStartInteraction}
                  />
                );
                offset += layer.height + 24;
                return element;
              });
            })()}
          </g>
        </svg>
      </div>
      {DialogRoot}
    </section>
  );
};

export default TimelinePanel;
