import { useCallback, useRef, useState } from 'react';
import type React from 'react';

interface VolumeSliderProps {
  value: number; // 0..1
  onChange: (value: number) => void;
  width?: number;
}

// Simple line + thumb volume slider with a text indicator.
const VolumeSlider = ({ value, onChange, width = 200 }: VolumeSliderProps) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = rect.width === 0 ? 0 : clamp01((clientX - rect.left) / rect.width);
      onChange(ratio);
    },
    [onChange],
  );

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging) return;
    setFromClientX(e.clientX);
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const pct = `${(clamp01(value) * 100).toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden="true" style={{ fontSize: 12, color: '#cfd4ff', minWidth: 24, letterSpacing: 0.3 }}>
        VOL
      </span>
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamp01(value) * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            onChange(clamp01(value - 0.05));
            e.preventDefault();
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            onChange(clamp01(value + 0.05));
            e.preventDefault();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setDragging(false)}
        style={{
          position: 'relative',
          width,
          height: 16,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 2,
            background: '#5b6a8e',
            transform: 'translateY(-50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: pct,
            height: 2,
            background: '#a9c1ff',
            transform: 'translateY(-50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: pct,
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            borderRadius: '50%',
            background: '#e5e7ff',
            boxShadow: dragging ? '0 0 0 4px rgba(169,193,255,0.2)' : '0 0 0 1px #5b6a8e',
          }}
        />
      </div>
    </div>
  );
};

export default VolumeSlider;
