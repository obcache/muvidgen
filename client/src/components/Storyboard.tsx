import { useCallback, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

export interface StoryboardProps {
  paths: string[];
  onChange: (next: string[]) => void;
  durations?: Record<string, number>;
  names?: Record<string, string>;
  missingPaths?: Set<string>;
  totalDuration?: number;
  zoom?: number;
  scroll?: number; // 0..1
  playhead?: number; // seconds
  onDoubleClick?: (path: string) => void;
  theme?: Theme;
  onContextMenu?: (path: string, index: number, clientX: number, clientY: number) => void;
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

const Storyboard = ({ paths, onChange, durations, names, missingPaths, totalDuration, zoom = 1, scroll = 0, playhead = 0, onDoubleClick, theme = 'dark', onContextMenu }: StoryboardProps) => {
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
    <div style={{ overflow: 'hidden', padding: 0, border: 'none', borderRadius: 0, background: 'transparent', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, padding: 0, minWidth: `${100 * Math.max(1, zoom)}%`, transform: `translateX(-${Math.max(0, Math.min(1, scroll)) * Math.max(0, (zoom - 1) * 100)}%)`, transition: 'transform 0.05s linear' }}>
      {items.map((item) => (
        <div
          key={item.path + ':' + item.index}
          title={item.path}
          draggable
          onDragStart={(e) => onDragStart(item.index, e)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(item.index, e)}
          onDoubleClick={() => onDoubleClick?.(item.path)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(item.path, item.index, e.clientX, e.clientY); }}
          style={{
            cursor: 'move',
            userSelect: 'none',
            padding: '6px 28px 6px 8px',
            borderRadius: 4,
            background: missingPaths?.has(item.path) ? '#4a2a2a' : colorFor(item.path),
            color: 'white',
            minWidth: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            position: 'relative',
            opacity: dragFrom === item.index ? 0.6 : 1,
            flex: '0 0 auto',
            width: totalDuration && durations && durations[item.path] != null && totalDuration > 0
              ? `${Math.max(4, (durations[item.path]! / totalDuration) * 100)}%`
              : `${Math.max(6, 12)}%`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={item.path}>
              {names?.[item.path] ?? fileName(item.path)}
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
