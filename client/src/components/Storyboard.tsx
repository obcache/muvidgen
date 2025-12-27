import { useCallback, useMemo, useState } from 'react';

export interface StoryboardProps {
  paths: string[];
  onChange: (next: string[]) => void;
  durations?: Record<string, number>;
  totalDuration?: number;
  zoom?: number;
  scroll?: number; // 0..1
  playhead?: number; // seconds
  onDoubleClick?: (path: string) => void;
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

const reorder = (arr: string[], from: number, to: number) => {
  const a = arr.slice();
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
};

const formatDur = (sec?: number) => {
  if (!Number.isFinite(sec) || !sec || sec < 0) return '';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

const Storyboard = ({ paths, onChange, durations, totalDuration, zoom = 1, scroll = 0, playhead = 0, onDoubleClick }: StoryboardProps) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const items = useMemo(() => paths.map((p, i) => ({ path: p, index: i })), [paths]);

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
      onChange(reorder(paths, fromIdx, toIdx));
    }
    setDragFrom(null);
  }, [onChange, paths]);

  const removeAt = useCallback((idx: number) => {
    const next = paths.slice();
    next.splice(idx, 1);
    onChange(next);
  }, [onChange, paths]);

  return (
    <div style={{ overflow: 'hidden', padding: 0, border: '1px solid #333', borderRadius: 4, background: '#0b0b0b', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, padding: 8, minWidth: `${100 * zoom}%`, transform: `translateX(-${Math.max(0, Math.min(1, scroll)) * Math.max(0, (zoom - 1) * 100)}%)`, transition: 'transform 0.05s linear' }}>
      {items.map((item) => (
        <div
          key={item.path + ':' + item.index}
          title={item.path}
          draggable
          onDragStart={(e) => onDragStart(item.index, e)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(item.index, e)}
          onDoubleClick={() => onDoubleClick?.(item.path)}
          style={{
            cursor: 'move',
            userSelect: 'none',
            padding: '6px 28px 6px 8px',
            borderRadius: 4,
            background: colorFor(item.path),
            color: 'white',
            minWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            position: 'relative',
            opacity: dragFrom === item.index ? 0.6 : 1,
            flex: '0 0 auto',
            width: totalDuration && durations && durations[item.path] != null && totalDuration > 0
              ? `${Math.max(4, (durations[item.path]! / totalDuration) * 100 * zoom)}%`
              : `${Math.max(6, 12 * zoom)}%`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={item.path}>
              {fileName(item.path)}
            </span>
            <span style={{ fontWeight: 600 }}>{formatDur(durations?.[item.path])}</span>
          </div>
          <button
            type="button"
            aria-label={`Remove ${fileName(item.path)}`}
            onClick={(e) => { e.stopPropagation(); removeAt(item.index); }}
            title="Remove clip"
            style={{
              position: 'absolute',
              right: 6,
              top: 4,
              background: 'rgba(0,0,0,0.25)',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              width: 20,
              height: 20,
              lineHeight: '20px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            X
          </button>
        </div>
      ))}
      {paths.length === 0 && (
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
