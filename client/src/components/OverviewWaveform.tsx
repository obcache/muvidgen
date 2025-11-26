import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';

export interface OverviewWaveformProps {
  duration: number;
  playhead: number;
  onSeek: (seconds: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Simple overview strip that lets the user jump within the timeline.
const OverviewWaveform = ({ duration, playhead, onSeek }: OverviewWaveformProps) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setDragging] = useState(false);

  const pct = useMemo(() => {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return clamp((playhead / duration) * 100, 0, 100);
  }, [playhead, duration]);

  const seekToClientX = useCallback((clientX: number) => {
    const el = barRef.current;
    if (!el || !Number.isFinite(duration) || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width === 0 ? 0 : x / rect.width;
    const seconds = ratio * duration;
    onSeek(seconds);
  }, [duration, onSeek]);

  const handleClick = useCallback<React.MouseEventHandler<HTMLDivElement>>((e) => {
    seekToClientX(e.clientX);
  }, [seekToClientX]);

  const handleMouseDown = useCallback<React.MouseEventHandler<HTMLDivElement>>((e) => {
    setDragging(true);
    seekToClientX(e.clientX);
  }, [seekToClientX]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleMouseMove = useCallback<React.MouseEventHandler<HTMLDivElement>>((e) => {
    if (!isDragging) return;
    seekToClientX(e.clientX);
  }, [isDragging, seekToClientX]);

  return (
    <div
      ref={barRef}
      style={{
        width: '100%',
        height: 20,
        background: 'linear-gradient(90deg, #1b1b1b, #222)',
        borderRadius: 6,
        position: 'relative',
        cursor: 'pointer',
        boxShadow: 'inset 0 0 0 1px #333',
        userSelect: 'none',
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #4c8dff, #3f51b5)',
          borderRadius: 6,
          transition: isDragging ? 'none' : 'width 80ms linear',
          opacity: 0.75,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${pct}%`,
          top: -6,
          width: 4,
          height: 32,
          marginLeft: -2,
          background: '#fff',
          borderRadius: 2,
          boxShadow: '0 0 0 1px #3f51b5, 0 0 10px rgba(63,81,181,0.6)',
          transition: isDragging ? 'none' : 'left 80ms linear',
        }}
      />
    </div>
  );
};

export default OverviewWaveform;
