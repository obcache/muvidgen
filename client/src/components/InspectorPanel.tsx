import React, { useEffect, useMemo, useState } from 'react';
import { useTimeline } from '../context/TimelineContext';
import { clamp, nearestBeat, roundToFrame } from '../utils/timelineMath';
import type { Clip } from '../utils/timelineTypes';

const MIN_DURATION = 0.25;

const formatTime = (value: number): string => {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(1)} ${units[index]}`;
};

export const InspectorPanel: React.FC = () => {
  const { layers, selectedClipId, beatMarkers, actions } = useTimeline();
  const clip = useMemo<Clip | undefined>(() => {
    if (!selectedClipId) return undefined;
    return layers.flatMap((layer) => layer.clips).find((item) => item.id === selectedClipId);
  }, [layers, selectedClipId]);

  const [localStart, setLocalStart] = useState(clip?.start ?? 0);
  const [localDuration, setLocalDuration] = useState(clip?.duration ?? MIN_DURATION);

  useEffect(() => {
    if (!clip) return;
    setLocalStart(clip.start);
    setLocalDuration(clip.duration);
  }, [clip?.start, clip?.duration, clip?.id]);

  if (!clip) {
    return (
      <aside className="inspector-panel">
        <h2>Inspector</h2>
        <p>Select a clip to edit its properties.</p>
      </aside>
    );
  }

  const handleStartCommit = (nextStart: number) => {
    const safeStart = clamp(roundToFrame(nextStart), 0, 10000);
    setLocalStart(safeStart);
    actions.updateClip(clip.id, (current) => ({
      ...current,
      start: safeStart,
    }));
  };

  const handleDurationCommit = (nextDuration: number) => {
    const safeDuration = Math.max(MIN_DURATION, roundToFrame(nextDuration));
    setLocalDuration(safeDuration);
    actions.updateClip(clip.id, (current) => ({
      ...current,
      duration: safeDuration,
    }));
  };

  const handleSnapStart = () => {
    const snapped = roundToFrame(nearestBeat(localStart, beatMarkers));
    handleStartCommit(snapped);
  };

  const handleSnapEnd = () => {
    const end = localStart + localDuration;
    const snappedEnd = roundToFrame(nearestBeat(end, beatMarkers));
    const snappedDuration = Math.max(MIN_DURATION, snappedEnd - localStart);
    handleDurationCommit(snappedDuration);
  };

  const clipEnd = useMemo(() => localStart + localDuration, [localDuration, localStart]);

  return (
    <aside className="inspector-panel">
      <h2>Inspector</h2>
      <section className="inspector-panel__section">
        <header>
          <h3>{clip.label}</h3>
          <p className="inspector-panel__meta">
            {clip.kind.toUpperCase()} · {formatTime(localStart)} – {formatTime(clipEnd)} ·
            {clip.file ? ` ${formatFileSize(clip.file.size)}` : ' Generated'}
          </p>
        </header>
        <dl className="inspector-panel__list">
          <div>
            <dt>Layer</dt>
            <dd>{clip.layerId}</dd>
          </div>
          <div>
            <dt>Start</dt>
            <dd>
              <input
                type="number"
                min={0}
                step={0.05}
                value={localStart}
                onChange={(event) => setLocalStart(Number(event.target.value))}
                onBlur={(event) => handleStartCommit(Number(event.target.value))}
              />
              <button type="button" onClick={handleSnapStart} disabled={!beatMarkers.length}>
                Snap to Beat
              </button>
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              <input
                type="number"
                min={MIN_DURATION}
                step={0.05}
                value={localDuration}
                onChange={(event) => setLocalDuration(Number(event.target.value))}
                onBlur={(event) => handleDurationCommit(Number(event.target.value))}
              />
              <button type="button" onClick={handleSnapEnd} disabled={!beatMarkers.length}>
                Snap End to Beat
              </button>
            </dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{formatTime(clipEnd)}</dd>
          </div>
        </dl>
      </section>
      {clip.beatMarkers?.length ? (
        <section className="inspector-panel__section">
          <h4>Beat Markers</h4>
          <div className="inspector-panel__beats">
            {clip.beatMarkers.map((marker) => (
              <span key={marker}>{marker.toFixed(2)}s</span>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
};

export default InspectorPanel;
