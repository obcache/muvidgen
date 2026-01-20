import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Theme = 'dark' | 'light';

export type StoryboardSegment = {
  id: string;
  path: string;
  index: number;
  label: string;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  sourceDuration: number;
  missing?: boolean;
};

export interface StoryboardProps {
  segments: StoryboardSegment[];
  totalDuration?: number;
  zoom?: number;
  scroll?: number; // 0..1
  playhead?: number; // seconds
  onReorder?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  onTrimChange?: (id: string, trimStart: number, duration: number) => void;
  onDurationChange?: (id: string, duration: number) => void;
  onDoubleClick?: (segment: StoryboardSegment) => void;
  onContextMenu?: (segment: StoryboardSegment, clientX: number, clientY: number) => void;
  theme?: Theme;
}

const fileName = (p: string) => {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
};

const colorFor = (key: string) => {
  // Stable hash for friendly HSL, independent of ordering
  let h = 2166136261;
  const seed = key;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const hueBase = Math.abs(h) % 360;
  const hue = hueBase;
  const sat = 55 + (Math.abs((h >> 8)) % 15);
  const light = 45 + (Math.abs((h >> 16)) % 12);
  return `hsl(${hue} ${sat}% ${light}%)`;
};

const formatDur = (sec?: number) => {
  if (!Number.isFinite(sec) || !sec || sec < 0) return '';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

const Storyboard = ({
  segments,
  totalDuration,
  zoom = 1,
  scroll = 0,
  playhead = 0,
  onReorder,
  onRemove,
  onTrimChange,
  onDurationChange,
  onDoubleClick,
  onContextMenu,
  theme = 'dark',
}: StoryboardProps) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const [trimDrag, setTrimDrag] = useState<{
    id: string;
    kind: 'start' | 'end';
    startX: number;
    trimStart: number;
    trimEnd: number;
    sourceDuration: number;
    duration: number;
  } | null>(null);

  const ordered = useMemo(() => segments.map((seg, idx) => ({ ...seg, index: idx })), [segments]);

  const onDragStart = useCallback((idx: number, e: React.DragEvent<HTMLDivElement>) => {
    setDragFrom(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((toIdx: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromStr = e.dataTransfer.getData('text/plain');
    const fromIdx = Number(fromStr);
    if (Number.isFinite(fromIdx) && fromIdx !== toIdx) {
      onReorder?.(fromIdx, toIdx);
    }
    setDragFrom(null);
  }, [onReorder]);

  const updateTrackWidth = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTrackWidth(rect.width);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateTrackWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateTrackWidth());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateTrackWidth);
    return () => window.removeEventListener('resize', updateTrackWidth);
  }, [updateTrackWidth]);

  useEffect(() => {
    updateTrackWidth();
  }, [segments.length, totalDuration, zoom, updateTrackWidth]);

  const startTrimDrag = useCallback((seg: StoryboardSegment, kind: 'start' | 'end', clientX: number) => {
    setTrimDrag({
      id: seg.id,
      kind,
      startX: clientX,
      trimStart: seg.trimStart,
      trimEnd: seg.trimEnd,
      sourceDuration: seg.sourceDuration,
      duration: seg.duration,
    });
  }, []);

  useEffect(() => {
    if (!trimDrag) return;
    const onMove = (e: MouseEvent) => {
      const track = trackRef.current;
      if (!track || !totalDuration || totalDuration <= 0) return;
      const rect = track.getBoundingClientRect();
      const deltaPx = e.clientX - trimDrag.startX;
      const secondsPerPx = totalDuration / Math.max(1, rect.width);
      const delta = deltaPx * secondsPerPx;
      const minLen = 0.05;
      if (trimDrag.kind === 'start') {
        const maxStart = trimDrag.trimEnd - minLen;
        const nextStart = Math.max(0, Math.min(maxStart, trimDrag.trimStart + delta));
        const nextDuration = Math.max(minLen, trimDrag.duration - delta);
        onTrimChange?.(trimDrag.id, nextStart, nextDuration);
      } else {
        const nextDuration = Math.max(minLen, trimDrag.duration + delta);
        onDurationChange?.(trimDrag.id, nextDuration);
      }
    };
    const onUp = () => {
      setTrimDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [trimDrag, totalDuration, onTrimChange, onDurationChange]);

  return (
    <div style={{ overflow: 'hidden', padding: 0, border: 'none', borderRadius: 0, background: 'transparent', position: 'relative' }}>
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          height: 36,
          minWidth: `${100 * Math.max(1, zoom)}%`,
          transform: `translateX(-${Math.max(0, Math.min(1, scroll)) * Math.max(0, (zoom - 1) * 100)}%)`,
          transition: 'transform 0.05s linear',
        }}
      >
        {ordered.map((seg) => {
          const total = totalDuration && totalDuration > 0 ? totalDuration : 1;
          const widthPct = Math.max(0, (seg.duration / total) * 100);
          const leftPct = Math.max(0, (seg.start / total) * 100);
          const widthPx = trackWidth > 0 ? (trackWidth * widthPct) / 100 : 0;
          const showText = widthPx >= 120;
          const showControls = widthPx >= 48;
          const bg = seg.missing ? '#4a2a2a' : colorFor(seg.path);
          return (
            <div
              key={seg.id}
              title={seg.path}
              draggable
              onDragStart={(e) => onDragStart(seg.index, e)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(seg.index, e)}
              onDoubleClick={() => onDoubleClick?.(seg)}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(seg, e.clientX, e.clientY); }}
              style={{
                cursor: 'move',
                userSelect: 'none',
                padding: showText ? '6px 28px 6px 12px' : '6px 18px 6px 12px',
                borderRadius: 4,
                background: bg,
                color: 'white',
                minWidth: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                opacity: dragFrom === seg.index ? 0.6 : 1,
                height: 32,
                boxSizing: 'border-box',
              }}
            >
              {showControls && (
                <>
                  <div
                    role="presentation"
                    title="Trim start"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      startTrimDrag(seg, 'start', e.clientX);
                    }}
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 4,
                      bottom: 4,
                      width: 6,
                      borderRadius: 3,
                      background: 'rgba(0,0,0,0.4)',
                      cursor: 'ew-resize',
                    }}
                  />
                  <div
                    role="presentation"
                    title="Trim end"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      startTrimDrag(seg, 'end', e.clientX);
                    }}
                    style={{
                      position: 'absolute',
                      right: 2,
                      top: 4,
                      bottom: 4,
                      width: 6,
                      borderRadius: 3,
                      background: 'rgba(0,0,0,0.4)',
                      cursor: 'ew-resize',
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${fileName(seg.path)}`}
                    onClick={(e) => { e.stopPropagation(); onRemove?.(seg.index); }}
                    title="Remove clip"
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: 8,
                      background: 'transparent',
                      color: 'white',
                      border: 'none',
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 0,
                    }}
                  >
                    <img
                      src={theme === 'light' ? 'ui/icon-segment-remove-light.png' : 'ui/icon-segment-remove.png'}
                      alt="Remove"
                      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                    />
                  </button>
                </>
              )}
              {showText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={seg.path}>
                    {seg.label || fileName(seg.path)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatDur(seg.duration)}</span>
                </div>
              )}
            </div>
          );
        })}
        {segments.length === 0 && (
          <div style={{ color: '#777' }}>No clips. Use Add Videos to add files.</div>
        )}
        {totalDuration && totalDuration > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 2,
              background: '#ffcc00',
              boxShadow: '0 0 8px rgba(255, 204, 0, 0.85)',
              fontSize: 6,
              left: `${Math.max(0, Math.min(1, (playhead / totalDuration) * zoom - Math.max(0, scroll) * (zoom - 1))) * 100}%`,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Storyboard;
